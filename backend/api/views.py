import datetime
import logging
import re
import uuid
from decimal import Decimal
from urllib.parse import quote

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q, Count, Avg, Sum, Max, Min
from django.core.cache import cache
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from .compliance_performance_guide import CompliancePerformanceGuide
# Create your views here.
from rest_framework import viewsets, status, serializers, filters
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed, ValidationError, PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db import models, IntegrityError
import os
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

from .models import (
    User, StaffProfile, EmergencyContact, BankDetails, SIALicense,
    StaffAvailability, Venue, VenueTermsAcceptance, PreferredVenue,
    Shift, ShiftTemplate, FireExitCheck, CapacityCheck, ToiletCheck, ShiftExchange, OpenShiftRequest,
    CapacityCheckSlotMiss, CapacityLogbookSignoff,
    Invoice, InvoiceItem, PayRate, DeputyConfig, DeputyEmployee,
    DeputyTimesheet, SystemSettings, EmploymentType, RecruitmentApplication,
    WorkingHoursRegulation, ComplianceProfile, ComplianceViolation, WorkingHoursMetrics,
    ReportTemplate, ReportJob,
    # Onboarding models
    SecurityCompany, CompanyOnboarding, CompanyIntegration, UserCompanyMembership,
    # Notification models
    SNSDeviceToken, NotificationPreferences, Notification,
    # Password reset models
    PasswordResetToken,
    # Leave/Availability models
    ContractorUnavailability, BankHoliday, StaffLeaveDailyRate,
    # Audit logging
    AuditLog,
    # Client billing models
    ClientInvoice, ClientInvoiceItem,
    # Incident reporting
    IncidentReport,
)
from .serializers import (
    UserSerializer, StaffProfileSerializer, EmergencyContactSerializer,
    BankDetailsSerializer, SIALicenseSerializer, StaffAvailabilitySerializer,
    VenueSerializer, VenueTermsAcceptanceSerializer, PreferredVenueSerializer,
    FireExitCheckSerializer, CapacityCheckSerializer, ToiletCheckSerializer,
    CapacityCheckSlotMissSerializer, CapacityLogbookSignoffSerializer,
    ShiftSerializer, ShiftExchangeSerializer, OpenShiftRequestSerializer, InvoiceSerializer, InvoiceItemSerializer,
    PayRateSerializer, DeputyConfigSerializer, DeputyEmployeeSerializer,
    DeputyTimesheetSerializer, ShiftTemplateSerializer, SystemSettingsSerializer,
    EmploymentTypeSerializer, RecruitmentApplicationSerializer, RecruitmentApplicationPublicSerializer,
    WorkingHoursRegulationSerializer, ComplianceProfileSerializer, ComplianceViolationSerializer,
    WorkingHoursMetricsSerializer, ComplianceViolationResolveSerializer, ComplianceCheckSerializer,
    BulkViolationResolveSerializer, ReportTemplateSerializer, ReportJobSerializer,
    ReportJobCreateSerializer, ReportJobStatusSerializer,
    # Onboarding serializers
    SecurityCompanySerializer, CompanyOnboardingSerializer, CompanyInfoSerializer,
    RegionalSetupSerializer, StaffConfigSerializer, IntegrationsSerializer,
    CompanyIntegrationSerializer, UserCompanyMembershipSerializer,
    # Notification serializers
    SNSDeviceTokenSerializer, NotificationPreferencesSerializer,
    # Leave/Availability serializers
    ContractorUnavailabilitySerializer, ContractorUnavailabilityCreateSerializer,
    BankHolidaySerializer, StaffLeaveDailyRateSerializer, StaffLeaveDailyRateUpdateSerializer,
    # Client billing serializers
    ClientInvoiceSerializer, ClientInvoiceItemSerializer, ClientInvoiceGenerateSerializer,
    # Incident reporting serializers
    IncidentReportSerializer,
)

User = get_user_model()

logger = logging.getLogger(__name__)


# =====================================================
# CUSTOM PERMISSION CLASSES FOR ONBOARDING SYSTEM
# =====================================================

class IsCompanyMember(BasePermission):
    """
    Custom permission to check if user is a member of the company.
    Ensures company-scoped data access.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Allow access if user has company memberships
        return request.user.company_memberships.filter(is_active=True).exists()
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if the object is related to a company the user belongs to
        if hasattr(obj, 'company'):
            company_id = obj.company.id
        elif hasattr(obj, 'company_id'):
            company_id = obj.company_id
        else:
            return True  # Allow access if no company relationship
        
        return request.user.company_memberships.filter(
            company_id=company_id,
            is_active=True
        ).exists()


class IsCompanyOwnerOrAdmin(BasePermission):
    """
    Custom permission to check if user is a company owner or admin.
    Required for sensitive operations like onboarding management.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Allow access if user is owner or admin of any company
        return request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin']
        ).exists()
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user is owner/admin of the specific company
        if hasattr(obj, 'company'):
            company_id = obj.company.id
        elif hasattr(obj, 'company_id'):
            company_id = obj.company_id
        else:
            return True  # Allow access if no company relationship
        
        return request.user.company_memberships.filter(
            company_id=company_id,
            is_active=True,
            role__in=['owner', 'admin']
        ).exists()


class IsCompanyOwner(BasePermission):
    """
    Custom permission to check if user is the company owner.
    Required for critical operations like company deletion.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Allow access if user is owner of any company
        return request.user.company_memberships.filter(
            is_active=True,
            is_owner=True
        ).exists()
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user is owner of the specific company
        if hasattr(obj, 'company'):
            company_id = obj.company.id
        elif hasattr(obj, 'company_id'):
            company_id = obj.company_id
        else:
            return True  # Allow access if no company relationship
        
        return request.user.company_memberships.filter(
            company_id=company_id,
            is_active=True,
            is_owner=True
        ).exists()


# Custom pagination class for report jobs
from rest_framework.pagination import PageNumberPagination

class CustomPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'limit'
    max_page_size = 100


# Authentication and permissions, consider adding TokenAuthentication as well.

@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """
    Handle user login functionality by verifying credentials and providing authentication tokens.

    This class is responsible for managing the login process for users. It validates the
    provided username and password, checks their accuracy, and if valid, generates access
    and refresh tokens for authentication purposes.

    Attributes:
        permission_classes: A list defining the permission required to access this endpoint.
            In this case, it allows unrestricted access to anyone.
        authentication_classes: Defines the authentication required for this endpoint. For
            login purposes, no authentication is required.
        throttle_scope: Specifies the rate-limiting scope for the endpoint to control the
            number of requests a user can make in a specific time frame.
    """
    permission_classes = [AllowAny]  # Allow anyone to access this endpoint
    authentication_classes = []  # No authentication required for login
    throttle_scope = 'rate_limiting'  # Set throttle scope

    @method_decorator(ratelimit(key='ip', rate='20/m', method='POST', block=False))
    @method_decorator(ratelimit(key='post:username', rate='40/h', method='POST', block=False))
    def post(self, request):
        # Check if rate limited (without incrementing yet)
        from django_ratelimit.core import is_ratelimited
        if getattr(request, 'limited', False):
            return Response({
                'message': 'Too many login attempts',
                'detail': 'You have exceeded the maximum number of login attempts. Please try again later.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)


        # Get the username/email and password from the request
        username_or_email = request.data.get('username')
        password = request.data.get('password')
        if not username_or_email or not password:
            return Response({'message': 'Both username/email and password are required',
                             'errors': 'missing required parameters'}, status=400)

        try:
            # Retrieve the user from the database - accept both username and email
            from django.db.models import Q
            user = User.objects.get(Q(username=username_or_email) | Q(email=username_or_email))

            # SECURITY FIX: Check if account is locked
            from django.utils import timezone
            now = timezone.now()

            # Check if account is temporarily locked
            if user.account_locked_until and user.account_locked_until > now:
                lockout_minutes = int((user.account_locked_until - now).total_seconds() / 60)
                return Response({
                    'message': 'Account is locked',
                    'detail': f'Too many failed login attempts. Account is locked for {lockout_minutes} more minutes. Please try again later or contact an administrator.',
                    'locked_until': user.account_locked_until.isoformat()
                }, status=status.HTTP_403_FORBIDDEN)

            # Verify the provided password
            if user.check_password(password):
                # SECURITY FIX: Check if account is active before generating tokens
                if not user.is_active:
                    return Response({
                        'message': 'Account is inactive',
                        'detail': 'Your account has been deactivated. Please contact an administrator.'
                    }, status=status.HTTP_403_FORBIDDEN)

                # SECURITY FIX: Reset failed login attempts on successful login
                if user.failed_login_attempts > 0 or user.last_failed_login:
                    user.failed_login_attempts = 0
                    user.last_failed_login = None
                    user.account_locked_until = None
                    user.save(update_fields=['failed_login_attempts', 'last_failed_login', 'account_locked_until'])

                # Create tokens for authentication
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)

                # Sprint 3: Set tokens as httpOnly cookies (XSS protection)
                # ALSO include tokens in response body for mobile app compatibility
                response = Response({
                    'message': 'Login successful',
                    'user': {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": user.role,
                        "is_active": user.is_active
                    },
                    # Mobile apps need tokens in response body (can't use httpOnly cookies)
                    'access': access_token,
                    'refresh': refresh_token
                }, status=200)

                # Audit log: successful login
                try:
                    company = None
                    membership = user.company_memberships.filter(is_active=True).select_related('company').first()
                    if membership:
                        company = membership.company
                    AuditLog.log(
                        user=user,
                        company=company,
                        action='login',
                        resource_type='User',
                        resource_id=user.id,
                        details={'method': 'credentials'},
                        request=request,
                    )
                except Exception:
                    logger.warning(f'Failed to create audit log for login of user {user.pk}')

                # Set access token cookie
                response.set_cookie(
                    key=settings.SIMPLE_JWT['AUTH_COOKIE'],
                    value=access_token,
                    max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                    httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
                    secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                    samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
                    domain=settings.SIMPLE_JWT['AUTH_COOKIE_DOMAIN'],
                    path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                )

                # Set refresh token cookie
                response.set_cookie(
                    key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
                    value=refresh_token,
                    max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                    httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
                    secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                    samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
                    domain=settings.SIMPLE_JWT['AUTH_COOKIE_DOMAIN'],
                    path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                )

                return response
            else:
                # SECURITY FIX: Increment failed login attempts
                user.failed_login_attempts += 1
                user.last_failed_login = now

                # Lock account after 5 failed attempts for 30 minutes
                if user.failed_login_attempts >= 5:
                    from datetime import timedelta
                    user.account_locked_until = now + timedelta(minutes=30)
                    user.save(update_fields=['failed_login_attempts', 'last_failed_login', 'account_locked_until'])

                    # Send email notification to user about account lockout
                    try:
                        from django.core.mail import send_mail
                        lockout_time = user.account_locked_until.strftime('%Y-%m-%d %H:%M:%S %Z')
                        user_name = user.get_full_name() or user.username
                        send_mail(
                            subject='Account Locked - Too Many Failed Login Attempts',
                            message=(
                                f'Dear {user_name},\n\n'
                                f'Your account has been locked due to too many failed login attempts.\n\n'
                                f'Lockout time: {lockout_time}\n'
                                f'Your account will be automatically unlocked after 30 minutes.\n\n'
                                f'If you did not attempt to log in, someone else may be trying to access '
                                f'your account. Please contact support immediately.\n\n'
                                f'If you need immediate access, please reach out to your administrator.\n\n'
                                f'Regards,\n'
                                f'Mead Security Team'
                            ),
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            recipient_list=[user.email],
                            fail_silently=True,
                        )
                    except Exception:
                        logger.warning(f'Failed to send account lockout email to user {user.pk}')

                    # Audit log: account locked due to failed attempts
                    try:
                        AuditLog.log(
                            user=user,
                            action='login_failed',
                            resource_type='User',
                            resource_id=user.id,
                            details={
                                'reason': 'account_locked',
                                'failed_attempts': user.failed_login_attempts,
                            },
                            request=request,
                        )
                    except Exception:
                        logger.warning(f'Failed to create audit log for locked account {user.pk}')

                    return Response({
                        'message': 'Account locked',
                        'detail': 'Too many failed login attempts. Your account has been temporarily locked. Please try again later or contact an administrator.'
                    }, status=status.HTTP_403_FORBIDDEN)
                else:
                    user.save(update_fields=['failed_login_attempts', 'last_failed_login'])

                    # Audit log: failed login attempt
                    try:
                        AuditLog.log(
                            user=user,
                            action='login_failed',
                            resource_type='User',
                            resource_id=user.id,
                            details={
                                'reason': 'invalid_password',
                                'failed_attempts': user.failed_login_attempts,
                            },
                            request=request,
                        )
                    except Exception:
                        logger.warning(f'Failed to create audit log for failed login of user {user.pk}')

                    # SECURITY: Use generic message to prevent account enumeration
                    return Response({
                        'message': 'Invalid username/email or password'
                    }, status=status.HTTP_401_UNAUTHORIZED)

        except User.DoesNotExist:
            # Don't reveal whether username/email exists (security best practice)
            return Response({'message': 'Invalid username/email or password'}, status=401)
        except AuthenticationFailed as e:
            return Response({'message': str(e)}, status=401)


class LogoutView(APIView):
    """
    Handle user logout by blacklisting the refresh token.

    This endpoint allows authenticated users to logout by blacklisting their refresh token,
    preventing it from being used to generate new access tokens.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Blacklist the refresh token to logout the user.

        Sprint 3: Gets refresh token from cookie and clears both access/refresh cookies.
        Returns a success message if the token is successfully blacklisted.
        """
        try:
            # Sprint 3: Get refresh token from cookie (fallback to request body for backward compatibility)
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
            if not refresh_token:
                refresh_token = request.data.get('refresh')

            if not refresh_token:
                # Even if no token, still clear cookies (graceful logout)
                response = Response({
                    'message': 'Logout successful',
                    'detail': 'You have been logged out.'
                }, status=status.HTTP_200_OK)

                # Clear cookies
                response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
                response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
                return response

            # Import the BlacklistToken model
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
            from rest_framework_simplejwt.tokens import RefreshToken

            # Create a RefreshToken instance to validate and blacklist
            token = RefreshToken(refresh_token)
            token.blacklist()

            # Audit log: successful logout
            try:
                user = request.user
                company = None
                membership = user.company_memberships.filter(is_active=True).select_related('company').first()
                if membership:
                    company = membership.company
                AuditLog.log(
                    user=user,
                    company=company,
                    action='logout',
                    resource_type='User',
                    resource_id=user.id,
                    request=request,
                )
            except Exception:
                logger.warning('Failed to create audit log for logout')

            # Sprint 3: Clear cookies and return success response
            response = Response({
                'message': 'Logout successful',
                'detail': 'You have been successfully logged out.'
            }, status=status.HTTP_200_OK)

            # Clear both access and refresh token cookies
            response.delete_cookie(
                key=settings.SIMPLE_JWT['AUTH_COOKIE'],
                path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                domain=settings.SIMPLE_JWT['AUTH_COOKIE_DOMAIN'],
            )
            response.delete_cookie(
                key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
                path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                domain=settings.SIMPLE_JWT['AUTH_COOKIE_DOMAIN'],
            )

            return response

        except Exception as e:
            # Even on error, try to clear cookies
            logger.exception("Token blacklist failed during logout")
            response = Response({
                'message': 'Logout completed with warning',
                'detail': 'Cookies cleared, but token invalidation encountered an issue'
            }, status=status.HTTP_200_OK)

            response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
            response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])
            return response


class CookieTokenRefreshView(APIView):
    """
    Sprint 3: Token refresh view that works with httpOnly cookies.

    Gets refresh token from cookie, validates it, and returns new access/refresh tokens in cookies.
    This prevents XSS attacks by keeping tokens out of localStorage.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        """
        Refresh access token using refresh token from cookie.
        """
        try:
            # Get refresh token from cookie
            refresh_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'])

            # HYBRID AUTH: Fall back to request body for Safari/browsers that block cross-site cookies
            if not refresh_token:
                refresh_token = request.data.get('refresh')

            if not refresh_token:
                return Response({
                    'message': 'Refresh token not found',
                    'detail': 'No refresh token found in cookies or request body. Please log in again.'
                }, status=status.HTTP_401_UNAUTHORIZED)

            # Create RefreshToken instance and validate
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(refresh_token)

            # Get new access token
            access_token = str(token.access_token)

            # If ROTATE_REFRESH_TOKENS is enabled, rotate the refresh token
            if settings.SIMPLE_JWT['ROTATE_REFRESH_TOKENS']:
                # Blacklist old refresh token before rotating
                if settings.SIMPLE_JWT['BLACKLIST_AFTER_ROTATION']:
                    try:
                        token.blacklist()
                    except Exception:
                        pass  # Token might already be blacklisted

                # Rotate token claims so the client gets a fresh refresh token
                token.set_jti()
                token.set_exp()
                token.set_iat()
                refresh_token = str(token)

            # HYBRID AUTH: Return tokens in response body for Safari/browsers
            # that block cross-site cookies (mirrors LoginView response format)
            response = Response({
                'message': 'Token refreshed successfully',
                'access': access_token,
                'refresh': refresh_token,
            }, status=status.HTTP_200_OK)

            # Set new access token cookie
            response.set_cookie(
                key=settings.SIMPLE_JWT['AUTH_COOKIE'],
                value=access_token,
                max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
                secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
                domain=settings.SIMPLE_JWT['AUTH_COOKIE_DOMAIN'],
                path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
            )

            # Set new refresh token cookie (if rotated)
            if settings.SIMPLE_JWT['ROTATE_REFRESH_TOKENS']:
                response.set_cookie(
                    key=settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'],
                    value=refresh_token,
                    max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                    httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
                    secure=settings.SIMPLE_JWT['AUTH_COOKIE_SECURE'],
                    samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
                    domain=settings.SIMPLE_JWT['AUTH_COOKIE_DOMAIN'],
                    path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
                )

            return response

        except Exception as e:
            logger.exception("Token refresh failed")
            return Response({
                'message': 'Token refresh failed',
                'detail': 'Unable to refresh authentication token'
            }, status=status.HTTP_401_UNAUTHORIZED)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
    def get_permissions(self):
        """
        Allow registration without authentication, but require
        authentication for all other actions.
        """
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin/manager
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    def get_queryset(self):
        """
        Filter users based on role and company context.
        Users can only see other users from their own company.
        """
        user = self.request.user

        if user.role in ['admin', 'manager']:
            # Admin and managers can see users from their company only
            company = self.get_user_company(self.request)
            if not company:
                # No company context, return only the user themselves
                return User.objects.filter(id=user.id)

            # Get all users who are members of the same company
            company_user_ids = company.memberships.filter(
                is_active=True
            ).values_list('user_id', flat=True)

            return User.objects.filter(id__in=company_user_ids)

        # Staff can only see their own user
        return User.objects.filter(id=user.id)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # Create user — role defaults to 'staff', is_staff=False
            # User will be promoted to admin during company onboarding flow
            user = serializer.save()

            return Response({
                'message': 'User created successfully',
                'user': {
                    'username': user.username,
                    'email': user.email
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data,
                                        partial=partial)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                'message': 'User updated successfully',
                'user': {
                    **serializer.validated_data  # This will include any additional fields
                }
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        """Soft-delete a user (the "Remove from team" button on the staff page).

        SECURITY: get_object() uses company-scoped get_queryset(), preventing
        cross-tenant deactivation.

        We do NOT call instance.delete() here — that would CASCADE through
        Shift, Invoice, IncidentReport, PayRate, ShiftExchange, etc. and wipe
        out the user's entire history. The User model has a deletion_scheduled_at
        field for exactly this case (help text: "Hard delete occurs 30 days
        after this date").

        Refuses if the user has an in-progress shift — they need to check out
        first to avoid stranding shift state in a half-finished form.
        """
        instance = self.get_object()

        # Block if there's an in-progress shift — covered by user.shifts via
        # Shift.staff_user related_name.
        if instance.shifts.filter(status='in_progress').exists():
            return Response(
                {
                    'detail': (
                        f'{instance.username} has an in-progress shift. '
                        'They must check out before being removed from the team.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Soft delete: deactivate the user, schedule for hard delete in 30 days,
        # and deactivate company memberships so they stop appearing in
        # company-scoped staff lists / can't log in.
        instance.is_active = False
        instance.deletion_scheduled_at = timezone.now()
        instance.save(update_fields=['is_active', 'deletion_scheduled_at'])

        deactivated_count = instance.company_memberships.filter(
            is_active=True
        ).update(is_active=False)

        logger.info(
            'User %s deactivated by %s — %d active memberships closed',
            instance.username,
            request.user.username,
            deactivated_count,
        )

        return Response({
            'message': (
                f'{instance.username} has been deactivated. '
                'Their records are kept for 30 days then permanently removed.'
            ),
            'status': status.HTTP_200_OK,
        })
    
    @action(detail=False, methods=['post'], url_path='invite', permission_classes=[IsAuthenticated])
    def invite_staff(self, request):
        """Admin/manager invites a staff member by email.

        Mirrors the recruitment convert-to-user flow: creates a User with an
        unusable password, attaches them to the inviting admin's company, and
        queues a welcome email containing a secure password setup link.
        """
        from django.db import transaction as db_transaction

        if request.user.role not in ('admin', 'manager'):
            return Response(
                {'error': 'Only admin or manager users can invite staff'},
                status=status.HTTP_403_FORBIDDEN,
            )

        company = self.get_user_company(request)
        if not company:
            return Response(
                {'error': 'No company context found. Please ensure you are associated with a company.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate via UserSerializer (uniqueness, email format, etc.). Password
        # is not required here — the invitee will set their own via the email link.
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        ip_address = request.META.get('HTTP_X_FORWARDED_FOR')
        if ip_address:
            ip_address = ip_address.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR', '0.0.0.0')

        try:
            with db_transaction.atomic():
                user = User.objects.create(
                    username=data['username'],
                    email=data.get('email', ''),
                    first_name=data.get('first_name', ''),
                    last_name=data.get('last_name', ''),
                    role='staff',
                    is_active=True,
                    is_staff=False,
                )
                user.set_unusable_password()
                user.save()

                UserCompanyMembership.objects.create(
                    user=user,
                    company=company,
                    role='staff',
                    is_owner=False,
                    is_active=True,
                    invited_by=request.user,
                    invitation_status='accepted',
                    joined_at=timezone.now(),
                )

                reset_token = PasswordResetToken.objects.create(
                    user=user,
                    ip_address=ip_address,
                )

                from .tasks import send_staff_welcome_email
                send_staff_welcome_email.delay(
                    user_id=user.id,
                    company_name=company.name,
                    token_uuid=str(reset_token.token),
                    admin_ip=ip_address,
                )

            logger.info(
                f"Staff invited: user_id={user.id}, email={user.email}, "
                f"company={company.name}, invited_by={request.user.username}. "
                f"Welcome email queued."
            )

            return Response({
                'message': 'Invitation sent. The new staff member will receive a welcome email with a setup link.',
                'user': UserSerializer(user).data,
                'welcome_email_queued': True,
                'password_setup_expires_at': reset_token.expires_at.isoformat(),
            }, status=status.HTTP_201_CREATED)

        except IntegrityError as e:
            logger.error(f"Integrity error inviting staff: {str(e)}", exc_info=True)
            return Response(
                {'error': 'A user with that username or email already exists.'},
                status=status.HTTP_409_CONFLICT,
            )
        except Exception as e:
            logger.error(f"Unexpected error inviting staff: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to invite staff. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'], url_path='resend-invite', permission_classes=[IsAuthenticated])
    def resend_invite(self, request, pk=None):
        """Admin/manager re-issues a welcome email with a fresh password setup link.

        Use case: a staff member never received the original invite, the link
        expired, or they need a re-send. Invalidates any outstanding tokens for
        the user, creates a fresh PasswordResetToken, and queues the welcome
        email via the same Celery task used by the initial invite.
        """
        if request.user.role not in ('admin', 'manager'):
            return Response(
                {'error': 'Only admin or manager users can resend invites'},
                status=status.HTTP_403_FORBIDDEN,
            )

        company = self.get_user_company(request)
        if not company:
            return Response(
                {'error': 'No company context found. Please ensure you are associated with a company.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = self.get_object()

        if not UserCompanyMembership.objects.filter(
            user=target, company=company, is_active=True,
        ).exists():
            return Response(
                {'error': 'This user is not in your company.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not target.email:
            return Response(
                {'error': 'This user has no email address on file.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ip_address = request.META.get('HTTP_X_FORWARDED_FOR')
        if ip_address:
            ip_address = ip_address.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR', '0.0.0.0')

        # Invalidate any outstanding tokens so old links stop working
        target.password_reset_tokens.filter(is_used=False).update(is_used=True)

        reset_token = PasswordResetToken.objects.create(
            user=target,
            ip_address=ip_address,
        )

        from .tasks import send_staff_welcome_email
        send_staff_welcome_email.delay(
            user_id=target.id,
            company_name=company.name,
            token_uuid=str(reset_token.token),
            admin_ip=ip_address,
        )

        logger.info(
            f"Invite resent: user_id={target.id}, email={target.email}, "
            f"resent_by={request.user.username}."
        )

        return Response({
            'message': f'Welcome email resent to {target.email}.',
            'welcome_email_queued': True,
            'password_setup_expires_at': reset_token.expires_at.isoformat(),
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='unlock-account', permission_classes=[IsAuthenticated])
    def unlock_account(self, request, pk=None):
        """Admin/manager clears an active 30-minute lockout immediately.

        After 5 failed login attempts the user is locked out for 30 minutes.
        This endpoint lets a manager release that lockout on demand instead of
        making the user wait — useful when the lock is from a forgotten
        password rather than a real attack. Resets failed_login_attempts and
        last_failed_login at the same time so the next failure starts a fresh
        counter.
        """
        if request.user.role not in ('admin', 'manager'):
            return Response(
                {'error': 'Only admin or manager users can unlock accounts'},
                status=status.HTTP_403_FORBIDDEN,
            )

        company = self.get_user_company(request)
        if not company:
            return Response(
                {'error': 'No company context found. Please ensure you are associated with a company.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = self.get_object()

        if not UserCompanyMembership.objects.filter(
            user=target, company=company, is_active=True,
        ).exists():
            return Response(
                {'error': 'This user is not in your company.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        was_locked = bool(
            target.account_locked_until and target.account_locked_until > timezone.now()
        )
        target.failed_login_attempts = 0
        target.last_failed_login = None
        target.account_locked_until = None
        target.save(update_fields=[
            'failed_login_attempts',
            'last_failed_login',
            'account_locked_until',
        ])

        ip_address = request.META.get('HTTP_X_FORWARDED_FOR')
        if ip_address:
            ip_address = ip_address.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR', '0.0.0.0')

        try:
            AuditLog.objects.create(
                user=request.user,
                company=company,
                action='account_unlocked',
                resource_type='user',
                resource_id=str(target.id),
                details={
                    'target_username': target.username,
                    'was_locked': was_locked,
                },
                ip_address=ip_address,
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            )
        except Exception:
            logger.exception('Failed to write account_unlocked audit log')

        logger.info(
            f"Account unlocked: user_id={target.id}, username={target.username}, "
            f"unlocked_by={request.user.username}, was_locked={was_locked}."
        )

        return Response({
            'message': (
                f"{target.username}'s account has been unlocked."
                if was_locked
                else f"{target.username}'s account had no active lockout. Failed-attempt counter reset."
            ),
            'was_locked': was_locked,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='staff')
    def staff_users(self, request):
        """Get all staff users for dropdown selections"""
        if request.user.role not in ['admin', 'manager']:
            return Response({
                'error': 'Permission denied'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            # Scope to company for multi-tenant isolation
            company = self.get_user_company(request)
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                staff_users = User.objects.filter(
                    id__in=company_user_ids,
                    role__in=['staff', 'admin', 'manager'],
                ).select_related('profile')
            else:
                staff_users = User.objects.none()
            staff_data = []

            for user in staff_users:
                profile = getattr(user, 'profile', None)
                staff_data.append({
                    'id': user.id,
                    'staff_profile_id': profile.id if profile else None,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'email': user.email,
                    'role': user.role,
                    'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'is_approved': getattr(profile, 'is_approved', False) if profile else False,
                    'employment_type': profile.employment_type.name if profile and profile.employment_type else None,
                    'pay_frequency': getattr(profile, 'pay_frequency', 'weekly') if profile else 'weekly',
                })
            
            return Response(staff_data)
        except Exception as e:
            logger.error("Failed to fetch staff users: %s", str(e))
            return Response({
                'error': 'Failed to fetch staff users'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='team-members')
    def team_members(self, request):
        """
        Get team members for the Team screen (accessible to all authenticated users).

        Returns company colleagues with SAFE fields only:
        - Name, profile photo, security roles, employment type, SIA license type
        - Current active shift info (venue name, check-in time)

        NEVER exposes: NIN, DOB, address, bank details, emergency contacts, phone.
        """
        user = request.user

        # Get user's company (all roles, not just admin/manager)
        membership = user.company_memberships.filter(
            is_active=True
        ).select_related('company').first()

        if not membership:
            return Response([], status=status.HTTP_200_OK)

        company = membership.company

        # Get all active company members (all roles)
        company_user_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)

        team_users = User.objects.filter(
            id__in=company_user_ids,
            is_active=True,
        ).select_related('profile', 'profile__employment_type').prefetch_related(
            'profile__sia_licenses',
        )

        # Get currently active shifts for these users (checked in, not checked out)
        active_shifts = Shift.objects.filter(
            staff_user_id__in=company_user_ids,
            status__in=['in_progress', 'active', 'checked_in'],
            check_in_time__isnull=False,
            check_out_time__isnull=True,
        ).select_related('venue').only(
            'staff_user_id', 'venue__name', 'check_in_time', 'required_security_role'
        )

        # Build a lookup: user_id -> active shift info
        active_shift_map = {}
        for shift in active_shifts:
            active_shift_map[shift.staff_user_id] = {
                'venue_name': shift.venue.name if shift.venue else None,
                'check_in_time': shift.check_in_time.isoformat() if shift.check_in_time else None,
                'role_on_shift': shift.required_security_role,
            }

        results = []
        for member in team_users:
            profile = getattr(member, 'profile', None)
            is_approved = profile.is_approved if profile else False

            # Only show approved staff (or admins/managers who don't need approval)
            if member.role == 'staff' and not is_approved:
                continue

            active_shift = active_shift_map.get(member.id)

            # SIA license types (non-sensitive)
            sia_license_types = []
            if profile:
                sia_license_types = list(
                    profile.sia_licenses.filter(status='active').values_list('license_type', flat=True)
                )

            # Employment type name only
            employment_type_name = None
            if profile and profile.employment_type:
                employment_type_name = profile.employment_type.name

            results.append({
                'id': member.id,
                'first_name': member.first_name,
                'last_name': member.last_name,
                'role': member.role,
                'security_roles': member.security_roles or [],
                'profile_image_url': profile.profile_image_url if profile else None,
                'employment_type': employment_type_name,
                'sia_license_types': sia_license_types,
                'is_on_shift': active_shift is not None,
                'active_shift': active_shift,
                'is_current_user': member.id == user.id,
            })

        return Response(results)

    @action(detail=False, methods=['get'], url_path='eligible-for-transfer')
    def eligible_for_transfer(self, request):
        """
        Get staff members eligible for shift transfers from user's company.

        Query Parameters:
        - shift_id (optional): Filter staff by required security role for specific shift

        Returns staff from the same company as the requesting user, excluding:
        - The current user themselves
        - Unapproved staff profiles
        - Inactive users
        - Staff without required security role (if shift_id provided)

        Accessible by all authenticated users (any role).
        """
        user = request.user

        # Get optional shift_id for security role filtering
        shift_id = request.query_params.get('shift_id')
        required_role = None

        if shift_id:
            try:
                shift = Shift.objects.get(id=shift_id, staff_user=user)
                required_role = shift.required_security_role
            except Shift.DoesNotExist:
                return Response({
                    'error': 'Shift not found',
                    'detail': 'Shift does not exist or is not assigned to you'
                }, status=status.HTTP_404_NOT_FOUND)

        # Get user's company (include all roles, not just admin/manager)
        membership = user.company_memberships.filter(
            is_active=True
        ).select_related('company').first()

        if not membership:
            return Response({
                'error': 'No company membership found',
                'detail': 'User must be a member of a company to view eligible staff'
            }, status=status.HTTP_404_NOT_FOUND)

        company = membership.company

        # Get all active staff from same company
        company_user_ids = company.memberships.filter(
            is_active=True,
            role='staff'  # Only staff members eligible for shift transfers
        ).values_list('user_id', flat=True)

        # Exclude current user from results
        eligible_users = User.objects.filter(
            id__in=company_user_ids,
            is_active=True
        ).exclude(id=user.id).select_related('profile')

        # Filter for approved profiles and matching security role
        approved_staff = []
        for staff_user in eligible_users:
            # Check if user has profile and is approved
            if not (hasattr(staff_user, 'profile') and staff_user.profile.is_approved):
                continue

            # Check security role if shift_id provided
            if required_role and not staff_user.has_security_role(required_role):
                continue

            approved_staff.append(staff_user)

        # Use existing UserSerializer for consistent response format
        serializer = self.get_serializer(approved_staff, many=True)
        return Response(serializer.data)

    def list(self, request):
        # Use the filtered queryset from get_queryset()
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # Explicitly returning serializer.data for consistency with other methods
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='me/pending-earnings')
    def pending_earnings(self, request):
        """Get pending earnings for the authenticated user"""
        user = request.user
        
        if user.role != 'staff':
            return Response({
                'error': 'Only staff members can view pending earnings'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            earnings_data = user.get_pending_earnings()
            return Response({
                'total_pending': earnings_data['total_pending'],
                'shift_count': earnings_data['shift_count'],
                'pending_shifts': [
                    {
                        'shift_id': item['shift'].id,
                        'venue_name': item['shift'].venue.name,
                        'start_time': item['shift'].start_time,
                        'end_time': item['shift'].end_time,
                        'hours_worked': item['shift'].actual_hours_worked,
                        'estimated_payment': item['estimated_payment']
                    }
                    for item in earnings_data['pending_shifts']
                ]
            })
        except Exception as e:
            logger.exception("Failed to calculate pending earnings")
            return Response({
                'error': 'An internal error occurred while calculating pending earnings'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], url_path='me/weekly-earnings')
    def weekly_earnings(self, request):
        """Get estimated weekly earnings for the authenticated user including unapproved shifts"""
        user = request.user
        
        if user.role != 'staff':
            return Response({
                'error': 'Only staff members can view weekly earnings'
            }, status=status.HTTP_403_FORBIDDEN)
        
        try:
            earnings_data = user.get_estimated_weekly_earnings()
            return Response({
                'week_period': {
                    'start': earnings_data['week_period']['start'],
                    'end': earnings_data['week_period']['end']
                },
                'approved_earnings': earnings_data['approved_earnings'],
                'estimated_total': earnings_data['estimated_total'],
                'next_payment_date': earnings_data['next_payment_date'],
                'shift_count': earnings_data['shift_count'],
                'shifts': [
                    {
                        'shift_id': item['shift'].id,
                        'venue_name': item['shift'].venue.name,
                        'start_time': item['shift'].start_time,
                        'end_time': item['shift'].end_time,
                        'status': item['shift'].status,
                        'amount': item['amount'],
                        'earning_status': item['status'],  # 'confirmed' or 'estimated'
                        'is_invoiced': item['is_invoiced']
                    }
                    for item in earnings_data['shift_breakdown']
                ]
            })
        except Exception as e:
            logger.exception("Failed to calculate weekly earnings")
            return Response({
                'error': 'An internal error occurred while calculating weekly earnings'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_preview(request):
    """Preview payroll for a given date range"""
    if request.user.role not in ['admin', 'manager']:
        return Response({
            'error': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        from datetime import datetime
        from decimal import Decimal

        start_date = datetime.strptime(request.data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(request.data['end_date'], '%Y-%m-%d').date()

        # Get company context for multi-tenant isolation
        company = None
        if hasattr(request, 'current_company') and request.current_company:
            company = request.current_company
        else:
            membership = request.user.company_memberships.filter(
                is_active=True, company__is_active=True
            ).select_related('company').order_by('-joined_at').first()
            company = membership.company if membership else None

        if not company:
            return Response({'error': 'No company context found'}, status=status.HTTP_400_BAD_REQUEST)

        company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)

        # Get all staff with approved shifts in the date range (company-scoped)
        staff_with_shifts = User.objects.filter(
            id__in=company_user_ids,
            role='staff',
            shifts__status='approved',
            shifts__start_time__date__gte=start_date,
            shifts__start_time__date__lte=end_date,
            shifts__actual_hours_worked__isnull=False
        ).distinct()
        
        staff_breakdown = []
        total_amount = Decimal('0.00')
        total_shifts = 0

        for staff_user in staff_with_shifts:
            # Get approved shifts for this staff member in the date range
            shifts = staff_user.shifts.filter(
                status='approved',
                start_time__date__gte=start_date,
                start_time__date__lte=end_date,
                actual_hours_worked__isnull=False
            )

            staff_total = Decimal('0.00')
            for shift in shifts:
                try:
                    payment = shift.calculate_payment()
                    if payment:
                        staff_total += payment
                except Exception as calc_err:
                    logger.warning(f"Failed to calculate payment for shift {shift.id}: {calc_err}")
                    continue
            
            if staff_total > 0:
                staff_breakdown.append({
                    'staff_name': f"{staff_user.username} ({staff_user.first_name} {staff_user.last_name})",
                    'shift_count': shifts.count(),
                    'total_amount': float(staff_total)
                })
                total_amount += staff_total
                total_shifts += shifts.count()
        
        return Response({
            'total_staff': len(staff_breakdown),
            'total_shifts': total_shifts,
            'total_amount': float(total_amount),
            'staff_breakdown': staff_breakdown
        })
        
    except KeyError as e:
        return Response({
            'error': f'Missing required field: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as e:
        return Response({
            'error': f'Invalid date format: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception("Failed to preview payroll")
        return Response({
            'error': f'An internal error occurred: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payroll_generate(request):
    """Generate invoices for all staff for a given date range"""
    if request.user.role not in ['admin', 'manager']:
        return Response({
            'error': 'Permission denied'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        from datetime import datetime
        from decimal import Decimal

        start_date = datetime.strptime(request.data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(request.data['end_date'], '%Y-%m-%d').date()

        # Get company context for multi-tenant isolation
        company = None
        if hasattr(request, 'current_company') and request.current_company:
            company = request.current_company
        else:
            membership = request.user.company_memberships.filter(
                is_active=True, company__is_active=True
            ).select_related('company').order_by('-joined_at').first()
            company = membership.company if membership else None

        if not company:
            return Response({'error': 'No company context found'}, status=status.HTTP_400_BAD_REQUEST)

        company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)

        # Get all staff with approved shifts in the date range (company-scoped)
        staff_with_shifts = User.objects.filter(
            id__in=company_user_ids,
            role='staff',
            shifts__status='approved',
            shifts__start_time__date__gte=start_date,
            shifts__start_time__date__lte=end_date,
            shifts__actual_hours_worked__isnull=False
        ).distinct()
        
        invoices_created = 0
        invoices_existing = 0
        total_amount = Decimal('0.00')
        
        for staff_user in staff_with_shifts:
            # Check if invoice already exists for this period
            existing_invoice = Invoice.objects.filter(
                staff_user=staff_user,
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if existing_invoice:
                invoices_existing += 1
                total_amount += existing_invoice.total_amount
                continue
            
            # Generate new invoice for this staff member for the date range
            # Mark as admin-generated since this is initiated from admin bulk payroll
            invoice = Invoice.generate_for_staff_period(
                staff_user=staff_user,
                start_date=start_date,
                end_date=end_date,
                source='admin',
                created_by=request.user
            )
            
            if invoice:
                invoices_created += 1
                total_amount += invoice.total_amount
        
        # Create informative message
        if invoices_created > 0 and invoices_existing > 0:
            message = f'Generated {invoices_created} new invoices. {invoices_existing} invoices already existed for this period.'
        elif invoices_created > 0:
            message = f'Successfully generated {invoices_created} new invoices'
        elif invoices_existing > 0:
            message = f'All {invoices_existing} invoices already exist for this period. No new invoices created.'
        else:
            message = 'No invoices were created or found.'
        
        return Response({
            'invoices_created': invoices_created,
            'invoices_existing': invoices_existing,
            'total_amount': float(total_amount),
            'message': message
        })
        
    except Exception as e:
        logger.exception("Failed to generate payroll")
        return Response({
            'error': 'An internal error occurred while generating payroll'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StaffProfileViewSet(viewsets.ModelViewSet):
    """
    Handles the management of staff profile records.

    This viewset provides operations for retrieving, updating, and managing staff
    profiles. It enforces restrictions on updates to immutable fields for specific
    user roles and includes additional endpoints for managing pending profiles and
    approving them. Permissions are role-based, allowing only specific users access
    to certain functionalities.

    Attributes:
        permission_classes: List containing the permission classes required for
            this viewset. Only authenticated users can access.
        queryset: Default queryset that contains all staff profiles.
        serializer_class: Serializer class used for transforming staff profile data.
        IMMUTABLE_FIELDS: A list of field names that cannot be updated by the user.
    """
    permission_classes = [IsAuthenticated]
    queryset = StaffProfile.objects.all()
    serializer_class = StaffProfileSerializer
    
    # List of fields that can't be updated by the user
    IMMUTABLE_FIELDS = ['national_insurance_number', 'date_of_birth']
    
    def get_queryset(self):
        """
        Limit staff users to only see their own profile.
        Managers and admins can see profiles within their company only.
        Supports filtering by is_approved query parameter.
        """
        user = self.request.user

        # Admin and managers can see profiles within their company
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(
                    is_active=True
                ).values_list('user_id', flat=True)
                queryset = StaffProfile.objects.filter(user_id__in=company_user_ids)
            else:
                queryset = StaffProfile.objects.filter(user=user)
        else:
            # Staff can only see their own profile
            queryset = StaffProfile.objects.filter(user=user)

        # Filter by user ID if provided (within already-scoped queryset)
        user_id = self.request.query_params.get('user', None)
        if user_id:
            queryset = queryset.filter(user__id=user_id)

        # Filter by approval status if provided (only for admin/manager)
        is_approved = self.request.query_params.get('is_approved', None)
        if is_approved is not None and user.role in ['admin', 'manager']:
            is_approved_bool = is_approved.lower() in ['true', '1', 'yes']
            queryset = queryset.filter(is_approved=is_approved_bool)

        return queryset

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None
    
    def update(self, request, *args, **kwargs):
        """
        Handle partial updates (PATCH) and protect immutable fields
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Check if user is trying to update immutable fields
        for field in self.IMMUTABLE_FIELDS:
            if field in request.data and getattr(instance, field) != request.data[field]:
                # If admin or manager, allow the update
                if request.user.role in ['admin', 'manager']:
                    pass  # Allow admins and managers to update immutable fields
                else:
                    # For staff users, remove immutable fields from request data
                    request.data.pop(field)
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)
    
    def perform_update(self, serializer):
        serializer.save(updated_at=timezone.now())

    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def pending(self, request):
        """List all staff profiles pending admin approval that have submitted SIA licenses"""
        # Get staff profiles that are not approved AND have at least one SIA license with valid data
        pending_profiles = StaffProfile.objects.filter(
            is_approved=False,
            sia_licenses__license_number__isnull=False,  # Must have a license number
            sia_licenses__license_type__isnull=False      # Must have a license type
        ).distinct()
        serializer = self.get_serializer(pending_profiles, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        profile = self.get_object()
        profile.is_approved = True
        profile.save()
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

class EmergencyContactViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = EmergencyContact.objects.all()
    serializer_class = EmergencyContactSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return EmergencyContact.objects.filter(staff_profile__user_id__in=company_user_ids)
            return EmergencyContact.objects.none()
        return EmergencyContact.objects.filter(staff_profile__user=user)

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

class BankDetailsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = BankDetails.objects.all()
    serializer_class = BankDetailsSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return BankDetails.objects.filter(staff_profile__user_id__in=company_user_ids)
            return BankDetails.objects.none()
        return BankDetails.objects.filter(staff_profile__user=user)

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

class SIALicenseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SIALicense.objects.all()
    serializer_class = SIALicenseSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['staff_profile']

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return SIALicense.objects.filter(staff_profile__user_id__in=company_user_ids)
            return SIALicense.objects.none()
        return SIALicense.objects.filter(staff_profile__user=user)

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

class StaffAvailabilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StaffAvailability.objects.all()
    serializer_class = StaffAvailabilitySerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return StaffAvailability.objects.filter(staff_profile__user_id__in=company_user_ids)
            return StaffAvailability.objects.none()
        return StaffAvailability.objects.filter(staff_profile__user=user)

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

class VenueViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Venue.objects.all()
    serializer_class = VenueSerializer
    
    def get_permissions(self):
        """
        Ensure only admin users can create, update or delete venues.
        Other authenticated users can only view venues.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin/manager
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    def get_queryset(self):
        """
        Return venues for the user's company only.
        For venue terms actions, allow staff to access venues they have shifts at.
        """
        # For venue terms actions, staff can access any venue they have shifts at
        # Check if this is a venue terms action by looking at the action or request path
        is_terms_action = (
            getattr(self, 'action', None) in ['accept_terms', 'terms_acceptance'] or
            'accept_terms' in self.request.path or
            'terms_acceptance' in self.request.path
        )

        if is_terms_action:
            # Allow staff to access venues where they have shifts
            from django.db.models import Q
            return Venue.objects.filter(
                Q(shifts__staff_user=self.request.user) |
                Q(company__in=self.request.user.company_memberships.values_list('company', flat=True))
            ).distinct()

        company = self.get_user_company(self.request)
        if not company:
            # No company context, return empty queryset
            return Venue.objects.none()

        return Venue.objects.filter(company=company).select_related('company')

    @action(detail=False, methods=['get'], url_path='map')
    def map_view(self, request):
        """Lightweight endpoint for map display - returns only essential fields."""
        venues = self.get_queryset().only(
            'id', 'name', 'address', 'city', 'postal_code', 'country',
            'latitude', 'longitude', 'is_active'
        )
        data = [
            {
                'id': v.id,
                'name': v.name,
                'address': v.address,
                'city': v.city,
                'latitude': float(v.latitude) if v.latitude else None,
                'longitude': float(v.longitude) if v.longitude else None,
                'is_active': v.is_active,
            }
            for v in venues
        ]
        return Response(data)

    def create(self, request, *args, **kwargs):
        # Only admin users can create venues
        if request.user.role != 'admin':
            return Response({
                'message': 'Only admin users can create venues',
                'error': 'permission_denied'
            }, status=status.HTTP_403_FORBIDDEN)

        # Get the user's company context
        company = self.get_user_company(request)
        if not company:
            logger.error(f"User {request.user.username} attempted to create venue without company context")
            return Response({
                'message': 'No company context found. Please ensure you are associated with a company.',
                'error': 'no_company_context'
            }, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"Creating venue for company: {company.name} (ID: {company.id})")

        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # Save the venue with the company association
            venue = serializer.save(company=company)
            logger.info(f"Venue '{venue.name}' created successfully for company {company.name}")
            return Response({
                'message': 'Venue created successfully',
                'venue': serializer.data
            }, status=status.HTTP_201_CREATED)

        logger.error(f"Venue creation failed. Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        # Only admin users can update venues
        if request.user.role != 'admin':
            return Response({
                'message': 'Only admin users can update venues',
                'error': 'permission_denied'
            }, status=status.HTTP_403_FORBIDDEN)

        # Get the user's company context
        company = self.get_user_company(request)
        if not company:
            logger.error(f"User {request.user.username} attempted to update venue without company context")
            return Response({
                'message': 'No company context found. Please ensure you are associated with a company.',
                'error': 'no_company_context'
            }, status=status.HTTP_400_BAD_REQUEST)

        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Verify the venue belongs to the user's company
        if instance.company != company:
            logger.error(f"User {request.user.username} attempted to update venue '{instance.name}' belonging to different company")
            return Response({
                'message': 'You do not have permission to update this venue.',
                'error': 'company_mismatch'
            }, status=status.HTTP_403_FORBIDDEN)

        # Prevent changing the company field
        if 'company' in request.data and request.data['company'] != company.id:
            logger.error(f"Attempt to change venue company from {instance.company.id} to {request.data['company']}")
            return Response({
                'message': 'Cannot change venue company association.',
                'error': 'company_immutable'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if serializer.is_valid():
            venue = serializer.save()
            logger.info(f"Venue '{venue.name}' updated successfully by {request.user.username}")
            return Response({
                'message': 'Venue updated successfully',
                'venue': serializer.data
            })

        logger.error(f"Venue update failed. Validation errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, *args, **kwargs):
        # Only admin users can delete venues
        if request.user.role != 'admin':
            return Response({
                'message': 'Only admin users can delete venues',
                'error': 'permission_denied'
            }, status=status.HTTP_403_FORBIDDEN)
            
        instance = self.get_object()
        venue_name = instance.name
        
        self.perform_destroy(instance)
        
        return Response({
            'message': f'Venue {venue_name} deleted successfully'
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def terms_acceptance(self, request, pk=None):
        """Check if the current user has accepted terms for this venue"""
        venue = self.get_object()
        has_accepted = VenueTermsAcceptance.has_accepted_terms(request.user, venue)
        
        return Response({
            'hasAccepted': has_accepted,
            'venue': venue.name
        })
    
    @action(detail=True, methods=['post'])
    def accept_terms(self, request, pk=None):
        """Accept terms for this venue"""
        try:
            venue = self.get_object()
            
            # Check if already accepted
            if VenueTermsAcceptance.has_accepted_terms(request.user, venue):
                return Response({
                    'message': 'Terms already accepted for this venue',
                    'hasAccepted': True
                })
            
            # Create new acceptance record
            acceptance = VenueTermsAcceptance.objects.create(
                staff_user=request.user,
                venue=venue,
                terms_version=venue.terms_version or '1'
            )
            
            serializer = VenueTermsAcceptanceSerializer(acceptance)
            return Response({
                'message': 'Terms accepted successfully',
                'acceptance': serializer.data,
                'hasAccepted': True
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.exception("Error accepting venue terms")
            return Response({
                'error': 'An internal error occurred while accepting terms'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VenueTermsAcceptanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = VenueTermsAcceptance.objects.all()
    serializer_class = VenueTermsAcceptanceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return VenueTermsAcceptance.objects.filter(staff_user_id__in=company_user_ids)
            return VenueTermsAcceptance.objects.none()
        return VenueTermsAcceptance.objects.filter(staff_user=user)

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

class PreferredVenueViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PreferredVenue.objects.all()
    serializer_class = PreferredVenueSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return PreferredVenue.objects.filter(staff_profile__user_id__in=company_user_ids)
            return PreferredVenue.objects.none()
        return PreferredVenue.objects.filter(staff_profile__user=user)

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

class ShiftTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ShiftTemplate.objects.all()
    serializer_class = ShiftTemplateSerializer

    def get_queryset(self):
        company = self._get_user_company()
        if company:
            return ShiftTemplate.objects.filter(venue__company=company)
        return ShiftTemplate.objects.none()

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None
    
    @action(detail=True, methods=['post'])
    def apply(self, request, *args, **kwargs):
        """
        Apply a shift template to a date range
        """
        from datetime import datetime, timedelta
        
        template = self.get_object()
        
        # Get request data
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        days_of_week = request.data.get('days_of_week', template.days_of_week)
        staff_ids = request.data.get('staff_ids', [])
        
        # Validation
        if not start_date or not end_date:
            return Response(
                {"error": "Missing required fields: start_date, end_date"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create shifts
        created_shifts = []
        current_date = start_date
        
        while current_date <= end_date:
            # Check if current day is in the selected days of week
            if current_date.weekday() in days_of_week:
                # Create shift start and end times
                shift_start = datetime.combine(current_date.date(), template.start_time)
                shift_end = datetime.combine(current_date.date(), template.end_time)
                
                # Handle overnight shifts
                if template.end_time < template.start_time:
                    shift_end += timedelta(days=1)
                
                # Create shift for each staff member or as an open shift
                if staff_ids:
                    for staff_id in staff_ids:
                        try:
                            staff_user = User.objects.get(id=staff_id)
                            shift = Shift.objects.create(
                                venue=template.venue,
                                template=template,
                                staff_user=staff_user,
                                start_time=shift_start,
                                end_time=shift_end,
                                required_security_role=template.required_security_role,
                                status='scheduled',
                                notes=template.notes
                            )
                            created_shifts.append(shift)
                        except User.DoesNotExist:
                            # Skip invalid staff IDs
                            continue
                else:
                    # Create an open shift
                    shift = Shift.objects.create(
                        venue=template.venue,
                        template=template,
                        staff_user=None,
                        start_time=shift_start,
                        end_time=shift_end,
                        required_security_role=template.required_security_role,
                        status='open',
                        notes=template.notes
                    )
                    created_shifts.append(shift)
            
            # Move to next day
            current_date += timedelta(days=1)
        
        # Serialize the result
        serializer = ShiftSerializer(created_shifts, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# Register the ShiftTemplateViewSet in urls.py like:
# router.register('shift-templates', ShiftTemplateViewSet)

def _resolve_request_company(request):
    """
    Resolve the active company for a request, with a fallback for paths where
    the tenant middleware didn't run before authentication (notably DRF tests
    using force_authenticate, where request.user is populated at the APIView
    level — after middleware). In production, middleware sets current_company
    from session auth before the view runs, so this fallback is a no-op.
    """
    company = getattr(request, 'current_company', None)
    if company:
        return company
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    membership = (
        user.company_memberships.filter(is_active=True, company__is_active=True)
        .select_related('company')
        .order_by('-joined_at')
        .first()
    )
    return membership.company if membership else None


class CompanyScopedCheckMixin:
    """Mixin to add company scoping to venue check viewsets."""

    def _get_company_scoped_queryset(self, base_queryset):
        """Apply company scoping then shift/shift_group filtering."""
        # SECURITY: Scope to company first
        company = _resolve_request_company(self.request)
        if company:
            base_queryset = base_queryset.filter(shift__venue__company=company)

        queryset = base_queryset.select_related('performed_by')
        shift_id = self.request.query_params.get('shift', None)
        shift_group = self.request.query_params.get('shift_group', None)

        if shift_group:
            queryset = queryset.filter(shift_group=shift_group)
        elif shift_id:
            try:
                shift = Shift.objects.get(id=shift_id)
                if shift.shift_group:
                    queryset = queryset.filter(shift_group=shift.shift_group)
                else:
                    queryset = queryset.filter(shift_id=shift_id)
            except Shift.DoesNotExist:
                queryset = queryset.filter(shift_id=shift_id)

        return queryset.order_by('-timestamp')


class FireExitCheckViewSet(CompanyScopedCheckMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = FireExitCheck.objects.all()
    serializer_class = FireExitCheckSerializer

    def get_queryset(self):
        return self._get_company_scoped_queryset(FireExitCheck.objects.all())


class CapacityCheckViewSet(CompanyScopedCheckMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CapacityCheck.objects.all()
    serializer_class = CapacityCheckSerializer

    def get_queryset(self):
        return self._get_company_scoped_queryset(CapacityCheck.objects.all())

    def perform_create(self, serializer):
        from datetime import timedelta
        from .consumers import broadcast_capacity_event
        check = serializer.save()
        shift = check.shift
        venue = shift.venue if shift else None

        # If at/over capacity, alert managers in the venue's company.
        if check.is_at_capacity and venue and venue.company:
            try:
                managers = User.objects.filter(
                    company_memberships__company=venue.company,
                    company_memberships__is_active=True,
                    role__in=['owner', 'admin', 'manager'],
                ).distinct()
                performer_name = (
                    f"{check.performed_by.first_name} {check.performed_by.last_name}".strip()
                    if check.performed_by else 'Staff'
                )
                title = f"Capacity reached at {venue.name}"
                message = (
                    f"{performer_name} logged {check.current_count}/{check.venue_capacity} "
                    f"at {venue.name}. Action: {check.action_taken or '—'}"
                )
                for manager in managers:
                    Notification.send(
                        user=manager,
                        title=title,
                        message=message,
                        notification_type='compliance_alert',
                        priority='high',
                        related_type='shift',
                        related_id=str(shift.id),
                        action_url=f'/shifts/{shift.id}',
                        company=venue.company,
                    )
            except Exception as e:
                logger.warning(f"Failed to notify managers about capacity breach: {e}")

        # Broadcast over WebSocket so teammates' devices reschedule reminders.
        # check.shift_group is always populated by ShiftCheck.save (real
        # group for multi-staff, synthesized 'shift_<id>' for single-staff).
        if check.shift_group:
            try:
                interval = venue.capacity_check_interval_minutes if venue else 30
                logged_at = check.timestamp or timezone.now()
                next_due_at = logged_at + timedelta(minutes=interval)
                broadcast_capacity_event(
                    shift_group=check.shift_group,
                    event='capacity_logged',
                    payload={
                        'shift_id': shift.id,
                        'venue_id': venue.id if venue else None,
                        'current_count': check.current_count,
                        'venue_capacity': check.venue_capacity,
                        'is_at_capacity': check.is_at_capacity,
                        'performed_by': {
                            'id': check.performed_by.id if check.performed_by else None,
                            'first_name': check.performed_by.first_name if check.performed_by else '',
                            'last_name': check.performed_by.last_name if check.performed_by else '',
                        },
                        'logged_at': logged_at.isoformat(),
                        'next_due_at': next_due_at.isoformat(),
                    },
                )
            except Exception as e:
                logger.warning(f"Failed to broadcast capacity_logged event: {e}")


class CapacityCheckSlotMissViewSet(CompanyScopedCheckMixin, viewsets.ModelViewSet):
    """
    Read + acknowledge missed capacity-check slots. Filtering by shift_group
    follows the same convention as the other check ViewSets.
    """
    permission_classes = [IsAuthenticated]
    queryset = CapacityCheckSlotMiss.objects.all()
    serializer_class = CapacityCheckSlotMissSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']  # no destructive ops

    def get_queryset(self):
        # Misses are scoped via venue.company (no shift FK on this model).
        company = _resolve_request_company(self.request)
        qs = CapacityCheckSlotMiss.objects.all().select_related('venue', 'acknowledged_by')
        if company:
            qs = qs.filter(venue__company=company)
        shift_group = self.request.query_params.get('shift_group')
        if shift_group:
            qs = qs.filter(shift_group=shift_group)
        return qs.order_by('-expected_at')

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        miss = self.get_object()
        if miss.acknowledged:
            return Response(
                {'detail': 'Already acknowledged.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = (request.data.get('acknowledgement_reason') or '').strip()
        if not reason:
            return Response(
                {'acknowledgement_reason': 'A reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        miss.acknowledged = True
        miss.acknowledged_by = request.user
        miss.acknowledged_at = timezone.now()
        miss.acknowledgement_reason = reason
        miss.save(update_fields=['acknowledged', 'acknowledged_by', 'acknowledged_at', 'acknowledgement_reason'])
        return Response(self.get_serializer(miss).data)


class CapacityLogbookSignoffViewSet(viewsets.ModelViewSet):
    """
    End-of-shift signoff of the capacity logbook. One row per shift_group.
    Snapshots total_checks/total_missed at creation time.
    """
    permission_classes = [IsAuthenticated]
    queryset = CapacityLogbookSignoff.objects.all()
    serializer_class = CapacityLogbookSignoffSerializer
    http_method_names = ['get', 'post', 'head', 'options']  # signoff is one-shot

    def get_queryset(self):
        company = _resolve_request_company(self.request)
        qs = CapacityLogbookSignoff.objects.all().select_related('venue', 'closed_by_staff')
        if company:
            qs = qs.filter(venue__company=company)
        shift_group = self.request.query_params.get('shift_group')
        if shift_group:
            qs = qs.filter(shift_group=shift_group)
        venue_id = self.request.query_params.get('venue')
        if venue_id:
            qs = qs.filter(venue_id=venue_id)
        # Filter by signoff date (UTC). created_at on the signoff is the most
        # reliable shift-end anchor since it's the moment the venue admin
        # signed off — matches what the admin will be filtering by ("show me
        # logbooks closed last week").
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        from .consumers import broadcast_capacity_event
        shift_group = serializer.validated_data.get('shift_group')

        # Verify the user is part of this shift_group (staff member of one of its shifts).
        user = self.request.user
        is_member = Shift.objects.filter(
            shift_group=shift_group, staff_user=user
        ).exists()
        is_privileged = user.role in ('owner', 'admin', 'manager')
        if not (is_member or is_privileged):
            raise PermissionDenied("Only staff assigned to this shift_group can sign off the logbook.")

        # Snapshot totals from current state.
        total_checks = CapacityCheck.objects.filter(shift_group=shift_group).count()
        total_missed = CapacityCheckSlotMiss.objects.filter(shift_group=shift_group).count()

        signoff = serializer.save(
            closed_by_staff=user,
            total_checks=total_checks,
            total_missed=total_missed,
        )

        try:
            broadcast_capacity_event(
                shift_group=shift_group,
                event='logbook_signed',
                payload={
                    'venue_id': signoff.venue_id,
                    'closed_by_name': signoff.closed_by_name,
                    'override_reason': signoff.override_reason,
                    'logged_at': (signoff.signed_at or signoff.created_at).isoformat(),
                },
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast logbook_signed event: {e}")

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """
        Live view of in-progress monitored shifts for the requester's company.
        Each row carries enough state for the admin "Active" tab to render a
        live status table (last check, next-due-at, miss count) without extra
        per-row queries.
        """
        from datetime import timedelta

        company = _resolve_request_company(request)
        shifts = (
            Shift.objects
            .filter(
                status__in=('in_progress', 'active'),
                venue__requires_capacity_monitoring=True,
            )
            .select_related('venue', 'staff_user')
        )
        if company:
            shifts = shifts.filter(venue__company=company)

        # Collapse multi-staff groups so we don't return three rows for one
        # 3-officer shift_group. We pick the earliest-checked-in shift in each
        # group as the representative — totals are derived from the group.
        seen_groups = set()
        results = []
        now = timezone.now()
        for shift in shifts.order_by('start_time'):
            shift_group = shift.shift_group or f'shift_{shift.id}'
            if shift_group in seen_groups:
                continue
            seen_groups.add(shift_group)

            interval = shift.venue.capacity_check_interval_minutes or 30

            last_check = (
                CapacityCheck.objects
                .filter(shift_group=shift_group)
                .select_related('performed_by')
                .order_by('-timestamp')
                .first()
            )
            total_checks = CapacityCheck.objects.filter(shift_group=shift_group).count()
            total_missed = CapacityCheckSlotMiss.objects.filter(shift_group=shift_group).count()

            anchor = last_check.timestamp if last_check else (shift.check_in_time or shift.start_time)
            next_due_at = (anchor + timedelta(minutes=interval)) if anchor else None

            last_check_payload = None
            if last_check:
                performer = None
                if last_check.performed_by:
                    performer = {
                        'id': last_check.performed_by.id,
                        'first_name': last_check.performed_by.first_name,
                        'last_name': last_check.performed_by.last_name,
                    }
                last_check_payload = {
                    'id': last_check.id,
                    'current_count': last_check.current_count,
                    'venue_capacity': last_check.venue_capacity,
                    'is_at_capacity': last_check.is_at_capacity,
                    'timestamp': last_check.timestamp.isoformat(),
                    'performed_by_details': performer,
                }

            results.append({
                'shift_group': shift_group,
                'venue_id': shift.venue_id,
                'venue_name': shift.venue.name,
                'venue_capacity': shift.venue.capacity,
                'interval_minutes': interval,
                'shift_id': shift.id,
                'start_time': shift.start_time.isoformat() if shift.start_time else None,
                'end_time': shift.end_time.isoformat() if shift.end_time else None,
                'check_in_time': shift.check_in_time.isoformat() if shift.check_in_time else None,
                'last_check': last_check_payload,
                'next_due_at': next_due_at.isoformat() if next_due_at else None,
                'is_overdue': bool(next_due_at and next_due_at < now),
                'total_checks': total_checks,
                'total_missed': total_missed,
            })

        return Response(results)

    @action(detail=False, methods=['get'], url_path='timeline')
    def timeline(self, request):
        """
        Bundled timeline view for a shift_group: signoff (if any) + all
        capacity checks + all missed slots, scoped to the requester's
        company. Lets the admin drawer fetch everything in one round-trip
        instead of three.
        """
        shift_group = request.query_params.get('shift_group')
        if not shift_group:
            return Response(
                {'detail': 'shift_group query param is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = _resolve_request_company(request)
        signoff = self.get_queryset().filter(shift_group=shift_group).first()

        check_qs = CapacityCheck.objects.filter(shift_group=shift_group).select_related('performed_by')
        miss_qs = CapacityCheckSlotMiss.objects.filter(shift_group=shift_group).select_related('venue', 'acknowledged_by')
        if company:
            check_qs = check_qs.filter(shift__venue__company=company)
            miss_qs = miss_qs.filter(venue__company=company)

        return Response({
            'shift_group': shift_group,
            'signoff': CapacityLogbookSignoffSerializer(signoff).data if signoff else None,
            'checks': CapacityCheckSerializer(check_qs.order_by('timestamp'), many=True).data,
            'misses': CapacityCheckSlotMissSerializer(miss_qs.order_by('expected_at'), many=True).data,
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        """Render the audit-ready PDF for a closed logbook."""
        from django.http import FileResponse
        from .utils.capacity_logbook_pdf import generate_capacity_logbook_pdf

        signoff = self.get_object()
        checks = list(
            CapacityCheck.objects.filter(shift_group=signoff.shift_group)
            .select_related('performed_by')
            .order_by('timestamp')
        )
        misses = list(
            CapacityCheckSlotMiss.objects.filter(shift_group=signoff.shift_group)
            .select_related('acknowledged_by')
            .order_by('expected_at')
        )

        try:
            buf = generate_capacity_logbook_pdf(
                signoff=signoff, checks=checks, misses=misses,
            )
        except Exception as e:
            logger.error(f"Failed to render capacity logbook PDF for {signoff.shift_group}: {e}")
            return Response(
                {'detail': 'Failed to generate PDF.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # File name includes venue + date for friendly download UX.
        date_part = (
            checks[0].timestamp.strftime('%Y-%m-%d') if checks
            else signoff.created_at.strftime('%Y-%m-%d')
        )
        venue_slug = ''.join(
            c if c.isalnum() else '-'
            for c in (signoff.venue.name or 'venue').lower()
        ).strip('-') or 'venue'
        filename = f"capacity-logbook-{venue_slug}-{date_part}.pdf"

        return FileResponse(buf, content_type='application/pdf', filename=filename)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        """
        Bulk CSV export of logbook signoffs, scoped to the requester's
        company. Honours the same filters as the list endpoint
        (?venue=&date_from=&date_to=) so the admin can hit Download with
        the same filters they're viewing.
        """
        import csv
        from django.http import StreamingHttpResponse

        qs = self.get_queryset()

        class _EchoBuffer:
            """csv.writer writes here; we yield each row to stream."""
            def write(self, value):
                return value

        writer = csv.writer(_EchoBuffer())
        header = [
            'shift_group', 'venue', 'date', 'total_checks', 'total_missed',
            'closed_by_name', 'closed_by_role', 'signed_at', 'override_reason',
            'submitted_by_staff_id', 'created_at',
        ]

        def _rows():
            yield writer.writerow(header)
            for s in qs.iterator():
                yield writer.writerow([
                    s.shift_group,
                    s.venue.name if s.venue_id else '',
                    s.created_at.date().isoformat() if s.created_at else '',
                    s.total_checks,
                    s.total_missed,
                    s.closed_by_name,
                    s.closed_by_role,
                    s.signed_at.isoformat() if s.signed_at else '',
                    s.override_reason,
                    s.closed_by_staff_id or '',
                    s.created_at.isoformat() if s.created_at else '',
                ])

        response = StreamingHttpResponse(_rows(), content_type='text/csv')
        today = timezone.now().date().isoformat()
        response['Content-Disposition'] = (
            f'attachment; filename="capacity-logbooks-{today}.csv"'
        )
        return response


class ToiletCheckViewSet(CompanyScopedCheckMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ToiletCheck.objects.all()
    serializer_class = ToiletCheckSerializer

    def get_queryset(self):
        return self._get_company_scoped_queryset(ToiletCheck.objects.all())

class ShiftExchangeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ShiftExchange.objects.all()
    serializer_class = ShiftExchangeSerializer

    def get_queryset(self):
        """Filter exchanges to show only relevant ones for the user, scoped to company"""
        user = self.request.user
        if user.role in ['manager', 'admin']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return ShiftExchange.objects.filter(requesting_user_id__in=company_user_ids)
            return ShiftExchange.objects.none()
        else:
            # Staff can only see exchanges they're involved in
            return ShiftExchange.objects.filter(
                models.Q(requesting_user=user) | models.Q(target_user=user)
            )

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None
    
    def perform_create(self, serializer):
        """Set the requesting user to the current user"""
        serializer.save(requesting_user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Target user accepts the exchange request"""
        exchange = self.get_object()

        # Verify the user is the target user
        if exchange.target_user != request.user:
            return Response(
                {"error": "You are not the target user for this exchange"},
                status=status.HTTP_403_FORBIDDEN
            )

        response_text = request.data.get('response', '')

        try:
            was_auto_approved = exchange.accept_by_target(response_text)
            serializer = self.get_serializer(exchange)

            if was_auto_approved:
                return Response({
                    "message": "Exchange accepted and automatically approved!",
                    "auto_approved": True,
                    "exchange": serializer.data
                })
            else:
                return Response({
                    "message": "Exchange accepted. Waiting for manager approval.",
                    "auto_approved": False,
                    "exchange": serializer.data
                })
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Manager approves the exchange request"""
        if request.user.role not in ['manager', 'admin']:
            return Response(
                {"error": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        exchange = self.get_object()
        notes = request.data.get('notes', '')
        
        try:
            exchange.approve(request.user, notes)
            serializer = self.get_serializer(exchange)
            return Response({
                "message": "Exchange approved successfully",
                "exchange": serializer.data
            })
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Manager rejects the exchange request"""
        if request.user.role not in ['manager', 'admin']:
            return Response(
                {"error": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        exchange = self.get_object()
        notes = request.data.get('notes', '')
        
        if not notes:
            return Response(
                {"error": "Rejection notes are required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            exchange.reject(request.user, notes)
            serializer = self.get_serializer(exchange)
            return Response({
                "message": "Exchange rejected successfully",
                "exchange": serializer.data
            })
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['delete'])
    def cancel(self, request, pk=None):
        """Cancel the exchange request"""
        exchange = self.get_object()
        
        # Only requesting or target user can cancel
        if request.user not in [exchange.requesting_user, exchange.target_user]:
            return Response(
                {"error": "You can only cancel exchanges you're involved in"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            exchange.cancel(request.user)
            return Response({"message": "Exchange cancelled successfully"})
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

class OpenShiftRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = OpenShiftRequest.objects.all()
    serializer_class = OpenShiftRequestSerializer

    def get_queryset(self):
        """Filter requests to show only relevant ones for the user, scoped to company"""
        user = self.request.user
        if user.role in ['manager', 'admin']:
            company = self._get_user_company()
            if company:
                company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                return OpenShiftRequest.objects.filter(requesting_user_id__in=company_user_ids)
            return OpenShiftRequest.objects.none()
        else:
            # For list action: Show only requests the user created or claimed
            # For detail actions (claim, retrieve, cancel): Also include open shifts within company
            company = self._get_user_company()
            company_user_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True) if company else []
            if self.action == 'list':
                return OpenShiftRequest.objects.filter(
                    models.Q(requesting_user=user) |
                    models.Q(claimed_by=user)
                )
            else:
                # Detail actions: Include open shifts for claiming (company-scoped)
                return OpenShiftRequest.objects.filter(
                    models.Q(requesting_user=user) |
                    models.Q(claimed_by=user) |
                    models.Q(status='open', requesting_user_id__in=company_user_ids)
                )

    def _get_user_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

    def create(self, request, *args, **kwargs):
        """
        Custom create to handle shift_id instead of original_shift
        Mobile app sends {shift_id, request_reason} but model expects {original_shift, requesting_user, request_reason}
        """
        shift_id = request.data.get('shift_id')
        reason = request.data.get('request_reason')

        # Validation
        if not shift_id:
            return Response(
                {"error": "shift_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reason:
            return Response(
                {"error": "request_reason is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Get shift and verify ownership
            shift = Shift.objects.get(id=shift_id, staff_user=request.user)

            # Use model method to create open shift request (handles business logic)
            open_request = shift.release_to_pool(reason)

            # Serialize and return
            serializer = self.get_serializer(open_request)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Shift.DoesNotExist:
            return Response(
                {"error": "Shift not found or not assigned to you"},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            # Validation errors from release_to_pool (e.g., shift already started)
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_create(self, serializer):
        """Create an open shift request by releasing a shift"""
        # The shift ID should be passed in the request data
        shift_id = self.request.data.get('shift_id')
        reason = self.request.data.get('request_reason')

        if not shift_id:
            raise serializers.ValidationError("shift_id is required")

        if not reason:
            raise serializers.ValidationError("request_reason is required")

        try:
            shift = Shift.objects.get(id=shift_id, staff_user=self.request.user)
            open_request = shift.release_to_pool(reason)
            return open_request
        except Shift.DoesNotExist:
            raise serializers.ValidationError("Shift not found or not assigned to you")
        except ValueError as e:
            # Catch validation errors from release_to_pool (e.g., shift already started)
            raise serializers.ValidationError(str(e))
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        """Get all open shifts available for the current user to claim"""
        try:
            available_shifts = OpenShiftRequest.get_available_shifts(request.user)
            serializer = self.get_serializer(available_shifts, many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("Failed to get available shifts")
            return Response(
                {"error": "An internal error occurred while fetching available shifts"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """Claim an open shift"""
        open_request = self.get_object()
        
        try:
            open_request.claim_shift(request.user)
            serializer = self.get_serializer(open_request)
            return Response({
                "message": "Shift claimed successfully",
                "request": serializer.data
            })
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Manager approves the shift claim"""
        if request.user.role not in ['manager', 'admin']:
            return Response(
                {"error": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        open_request = self.get_object()
        notes = request.data.get('notes', '')
        
        try:
            open_request.approve_claim(request.user, notes)
            serializer = self.get_serializer(open_request)
            return Response({
                "message": "Claim approved successfully",
                "request": serializer.data
            })
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Manager rejects the shift claim"""
        if request.user.role not in ['manager', 'admin']:
            return Response(
                {"error": "Manager or admin permissions required"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        open_request = self.get_object()
        notes = request.data.get('notes', '')
        
        if not notes:
            return Response(
                {"error": "Rejection notes are required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            open_request.reject_claim(request.user, notes)
            serializer = self.get_serializer(open_request)
            return Response({
                "message": "Claim rejected successfully",
                "request": serializer.data
            })
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['delete'])
    def cancel(self, request, pk=None):
        """Cancel the open shift request"""
        open_request = self.get_object()
        
        # Only the requesting user can cancel their own request
        if open_request.requesting_user != request.user:
            return Response(
                {"error": "You can only cancel your own requests"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            open_request.cancel()
            return Response({"message": "Request cancelled successfully"})
        except ValueError as e:
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin/manager
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    def get_queryset(self):
        """Filter invoices based on user role and company context"""
        user = self.request.user

        if user.role == 'staff':
            # Staff can see all their own invoices regardless of source
            queryset = Invoice.objects.filter(staff_user=user)
        elif user.role in ['manager', 'admin']:
            # Managers and admins can see all invoices for their company (including admin-generated)
            company = self.get_user_company(self.request)
            if not company:
                # No company context, return empty queryset
                return Invoice.objects.none()

            # Filter invoices to only include staff from the same company
            company_staff_ids = company.memberships.filter(
                is_active=True
            ).values_list('user_id', flat=True)

            queryset = Invoice.objects.filter(staff_user_id__in=company_staff_ids)
        else:
            # Default to user's own invoices
            queryset = Invoice.objects.filter(staff_user=user)

        # Hide superseded invoices (resolved by reissue or replaced by a period
        # invoice in the hybrid flow). They remain in the DB for audit.
        queryset = queryset.filter(superseded_by__isnull=True)

        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(start_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(end_date__lte=end_date)
            
        return queryset
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get earnings statistics for the current user"""
        user = request.user
        
        # Base filtering (Role & Company) - logic duplicated from get_queryset to avoid Date filtering
        if user.role == 'staff':
            # Staff only see stats for system-generated invoices
            base_queryset = Invoice.objects.filter(staff_user=user, source='system')
        elif user.role in ['manager', 'admin']:
            company = self.get_user_company(request)
            if not company:
                base_queryset = Invoice.objects.none()
            else:
                company_staff_ids = company.memberships.filter(is_active=True).values_list('user_id', flat=True)
                base_queryset = Invoice.objects.filter(staff_user_id__in=company_staff_ids)
        else:
            # Default: only system-generated invoices
            base_queryset = Invoice.objects.filter(staff_user=user, source='system')
        
        now = timezone.now()
        current_year = now.year
        current_month = now.month
        
        # Calculate YTD
        ytd_total = base_queryset.filter(
            start_date__year=current_year
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Calculate Current Month
        current_month_total = base_queryset.filter(
            start_date__year=current_year,
            start_date__month=current_month
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Calculate Last Month
        last_month = current_month - 1
        last_month_year = current_year
        if last_month == 0:
            last_month = 12
            last_month_year = current_year - 1
            
        last_month_total = base_queryset.filter(
            start_date__year=last_month_year,
            start_date__month=last_month
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        # Calculate Custom Period Total if params provided
        custom_total = 0
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date and end_date:
            custom_queryset = base_queryset.filter(start_date__gte=start_date, end_date__lte=end_date)
            custom_total = custom_queryset.aggregate(total=Sum('total_amount'))['total'] or 0
        
        return Response({
            'ytd': float(ytd_total),
            'currentMonth': float(current_month_total),
            'lastMonth': float(last_month_total),
            'customTotal': float(custom_total)
        })

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate an invoice for a staff member for a specific period"""
        try:
            # SECURITY: Only admin/manager can generate invoices
            if request.user.role not in ['admin', 'manager']:
                return Response(
                    {'error': 'Only admin or manager users can generate invoices'},
                    status=status.HTTP_403_FORBIDDEN
                )

            staff_user_id = request.data.get('staff_user_id')
            start_date = request.data.get('start_date')
            end_date = request.data.get('end_date')

            if not all([staff_user_id, start_date, end_date]):
                return Response(
                    {'error': 'staff_user_id, start_date, and end_date are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Parse dates
            from datetime import datetime
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # SECURITY: Verify staff belongs to same company
            company = self.get_user_company(request)
            if not company:
                return Response(
                    {'error': 'No company context available'},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Get staff user scoped to company
            try:
                from api.models import User
                company_staff_ids = company.memberships.filter(
                    is_active=True
                ).values_list('user_id', flat=True)
                staff_user = User.objects.get(id=staff_user_id, id__in=company_staff_ids)
            except User.DoesNotExist:
                return Response(
                    {'error': 'Staff user not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check if invoice already exists for this period
            existing_invoice = Invoice.objects.filter(
                staff_user=staff_user,
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if existing_invoice:
                return Response(
                    {'error': f'Invoice already exists for this period (ID: {existing_invoice.id})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate the invoice (admin-generated, so mark source as 'admin')
            invoice = Invoice.generate_for_staff_period(
                staff_user,
                start_date,
                end_date,
                source='admin',
                created_by=request.user
            )

            # Serialize and return
            serializer = self.get_serializer(invoice)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error generating invoice: {str(e)}")
            return Response(
                {'error': 'Failed to generate invoice'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='preview')
    def preview_generation(self, request):
        """Preview what shifts are available for invoice generation"""
        # SECURITY: Only admin/manager can preview invoice generation
        if request.user.role not in ['admin', 'manager']:
            return Response(
                {'error': 'Only admin or manager users can preview invoices'},
                status=status.HTTP_403_FORBIDDEN
            )

        staff_user_id = request.query_params.get('staff_user_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not all([staff_user_id, start_date, end_date]):
            return Response({
                'error': 'staff_user_id, start_date, and end_date are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            from datetime import datetime
            from api.models import User, Shift

            # Parse dates
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

            # SECURITY: Verify staff belongs to same company
            company = self.get_user_company(request)
            if not company:
                return Response(
                    {'error': 'No company context available'},
                    status=status.HTTP_403_FORBIDDEN
                )
            company_staff_ids = company.memberships.filter(
                is_active=True
            ).values_list('user_id', flat=True)

            # Get staff user scoped to company
            staff_user = User.objects.get(id=staff_user_id, id__in=company_staff_ids)
            
            # Get all shifts for this staff member in the date range
            all_shifts = Shift.objects.filter(
                staff_user=staff_user,
                start_time__date__gte=start_date,
                start_time__date__lte=end_date
            ).order_by('start_time')
            
            # Get eligible shifts (approved with actual hours)
            eligible_shifts = all_shifts.filter(
                status='approved',
                actual_hours_worked__isnull=False
            )
            
            shift_data = []
            for shift in all_shifts:
                shift_data.append({
                    'id': shift.id,
                    'start_time': shift.start_time,
                    'end_time': shift.end_time,
                    'venue': shift.venue.name,
                    'status': shift.status,
                    'actual_hours_worked': shift.actual_hours_worked,
                    'is_eligible': shift.status == 'approved' and shift.actual_hours_worked is not None
                })
            
            return Response({
                'staff_user': staff_user.username,
                'date_range': f"{start_date} to {end_date}",
                'total_shifts': all_shifts.count(),
                'eligible_shifts': eligible_shifts.count(),
                'can_generate_invoice': eligible_shifts.count() > 0,
                'shifts': shift_data
            })
            
        except User.DoesNotExist:
            return Response({
                'error': 'Staff user not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error previewing invoice generation: {str(e)}")
            return Response({
                'error': 'An internal error occurred'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='generate-pdf')
    def generate_pdf(self, request, pk=None):
        """Generate a pay-stub PDF for an invoice on the fly using ReportLab."""
        invoice = self.get_object()

        try:
            from django.http import FileResponse
            from api.utils.invoice_pdf import generate_invoice_pdf

            pdf_buffer = generate_invoice_pdf(invoice)

            # Persist the serving URL so the frontend knows a PDF is available
            pdf_url = f"/api/v1/invoices/{invoice.id}/pdf/"
            invoice.pdf_url = pdf_url
            invoice.save(update_fields=['pdf_url'])

            response = FileResponse(
                pdf_buffer,
                content_type='application/pdf',
                filename=f"invoice_{invoice.id}.pdf",
            )
            return response

        except Exception as e:
            import traceback
            logger.error(f"Error generating PDF for invoice {invoice.id}: {str(e)}\n{traceback.format_exc()}")
            return Response(
                {'error': f'Failed to generate PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['get'], url_path='pdf')
    def serve_pdf(self, request, pk=None):
        """Serve a pay-stub PDF for an invoice (generates on the fly)."""
        invoice = self.get_object()

        try:
            from django.http import FileResponse
            from api.utils.invoice_pdf import generate_invoice_pdf

            pdf_buffer = generate_invoice_pdf(invoice)

            # Ensure pdf_url is set
            if not invoice.pdf_url:
                invoice.pdf_url = f"/api/v1/invoices/{invoice.id}/pdf/"
                invoice.save(update_fields=['pdf_url'])

            response = FileResponse(
                pdf_buffer,
                content_type='application/pdf',
                filename=f"invoice_{invoice.id}.pdf",
            )
            return response

        except Exception as e:
            logger.error(f"Error serving PDF for invoice {invoice.id}: {str(e)}")
            return Response(
                {'error': 'Failed to serve PDF'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        """Update invoice status"""
        # SECURITY: Only admin/manager can update invoice status
        if request.user.role not in ['admin', 'manager']:
            return Response(
                {'error': 'Only admin or manager users can update invoice status'},
                status=status.HTTP_403_FORBIDDEN
            )
        # get_object() uses get_queryset() which is company-scoped
        invoice = self.get_object()

        try:
            new_status = request.data.get('status')
            
            if new_status not in ['pending', 'paid', 'rejected']:
                return Response(
                    {'error': 'Invalid status. Must be pending, paid, or rejected'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            invoice.status = new_status
            invoice.save()
            
            serializer = self.get_serializer(invoice)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error updating invoice status: {str(e)}")
            return Response(
                {'error': 'Failed to update invoice status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class InvoiceItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = InvoiceItem.objects.all()
    serializer_class = InvoiceItemSerializer

    def _get_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').first()
        return membership.company if membership else None

    def get_queryset(self):
        """SECURITY: Scope invoice items to the requesting user's company."""
        company = self._get_company()
        if not company:
            return InvoiceItem.objects.none()
        company_staff_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)
        return InvoiceItem.objects.filter(
            invoice__staff_user_id__in=company_staff_ids
        )

class PayRateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = PayRate.objects.all()
    serializer_class = PayRateSerializer

    def _get_company(self):
        if hasattr(self.request, 'current_company') and self.request.current_company:
            return self.request.current_company
        membership = self.request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').first()
        return membership.company if membership else None

    def get_queryset(self):
        """SECURITY: Scope pay rates to the requesting user's company."""
        company = self._get_company()
        if not company:
            return PayRate.objects.none()
        company_staff_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)
        return PayRate.objects.filter(
            staff_profile__user_id__in=company_staff_ids
        )

class DeputyConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for the DeputyConfig model"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = DeputyConfig.objects.all()
    serializer_class = DeputyConfigSerializer

class DeputyConfigView(APIView):
    """API view for DeputyConfig"""
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get the deputy configuration"""
        try:
            config = DeputyConfig.objects.first()
            if not config:
                config = DeputyConfig.objects.create()
            serializer = DeputyConfigSerializer(config)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("Failed to retrieve Deputy configuration")
            return Response({"error": "An internal error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request):
        """Update the deputy configuration"""
        try:
            config = DeputyConfig.objects.first()
            if not config:
                config = DeputyConfig.objects.create()

            serializer = DeputyConfigSerializer(config, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Failed to update Deputy configuration")
            return Response({"error": "An internal error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeputyEmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = DeputyEmployee.objects.all()
    serializer_class = DeputyEmployeeSerializer

    def get_queryset(self):
        """SECURITY: Scope Deputy employees to the requesting user's company."""
        company = getattr(self.request, 'current_company', None)
        if not company:
            return DeputyEmployee.objects.none()
        company_user_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)
        return DeputyEmployee.objects.filter(
            Q(mapped_to_user_id__in=company_user_ids) | Q(mapped_to_user__isnull=True)
        )

class DeputyTimesheetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = DeputyTimesheet.objects.all()
    serializer_class = DeputyTimesheetSerializer

    def get_queryset(self):
        """SECURITY: Scope Deputy timesheets to the requesting user's company."""
        company = getattr(self.request, 'current_company', None)
        if not company:
            return DeputyTimesheet.objects.none()
        company_user_ids = company.memberships.filter(
            is_active=True
        ).values_list('user_id', flat=True)
        return DeputyTimesheet.objects.filter(
            employee__mapped_to_user_id__in=company_user_ids
        )

class SystemSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    def get(self, request):
        """Get the system settings for the user's company"""
        company = self.get_user_company(request)
        if not company:
            return Response(
                {'error': 'No company context found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        settings = SystemSettings.get_settings(company)
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        """Update the system settings for the user's company"""
        company = self.get_user_company(request)
        if not company:
            return Response(
                {'error': 'No company context found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        settings = SystemSettings.get_settings(company)
        serializer = SystemSettingsSerializer(settings, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    # CRITICAL FIX: Admin users should ALWAYS use company data, not StaffProfile data
    # Even if they have a StaffProfile (e.g., created when saving bank details)
    user = request.user
    is_admin_user = user.role.lower() in ['admin', 'owner']

    # If admin/owner, skip StaffProfile and use company data
    if not is_admin_user:
        try:
            profile = StaffProfile.objects.get(user=request.user)
            # User has a staff profile, handle normally
            if request.method == 'GET':
                serializer = StaffProfileSerializer(profile)
                return Response(serializer.data)
            elif request.method == 'PATCH':
                # List of fields that can't be updated by staff users
                IMMUTABLE_FIELDS = ['national_insurance_number', 'date_of_birth']

                # Separate user fields from profile fields
                user_fields = ['firstName', 'lastName', 'email']
                user_data = {}
                profile_data = request.data.copy()

                # Extract user fields and convert to snake_case
                for field in user_fields:
                    if field in profile_data:
                        if field == 'firstName':
                            user_data['first_name'] = profile_data.pop(field)
                        elif field == 'lastName':
                            user_data['last_name'] = profile_data.pop(field)
                        elif field == 'email':
                            user_data['email'] = profile_data.pop(field)

                # Update user fields if any were provided
                if user_data:
                    for field, value in user_data.items():
                        setattr(request.user, field, value)
                    request.user.save()

                # Check if user is trying to update immutable fields
                for field in IMMUTABLE_FIELDS:
                    if field in profile_data and getattr(profile, field) != profile_data[field]:
                        # If admin or manager, allow the update
                        if request.user.role in ['admin', 'manager']:
                            pass  # Allow admins and managers to update immutable fields
                        else:
                            # For staff users, remove immutable fields from request data
                            profile_data.pop(field)

                # Update profile fields if any remain
                if profile_data:
                    serializer = StaffProfileSerializer(profile, data=profile_data, partial=True, context={'request': request})
                    serializer.is_valid(raise_exception=True)
                    serializer.save()

                # Return updated profile data
                updated_serializer = StaffProfileSerializer(profile, context={'request': request})
                return Response(updated_serializer.data)
        except StaffProfile.DoesNotExist:
            pass  # Fall through to admin/company handling below

    # Handle admin/owner users OR staff users without StaffProfile
    if True:  # Always execute this block for admin users, or staff without profile
        # User doesn't have a staff profile (likely admin/owner)
        user = request.user

        if request.method == 'GET':
            # Get company information to populate contact details
            print(f"[PROFILE DEBUG] Admin user {user.id} GET request started")
            try:
                membership = user.company_memberships.filter(
                    is_active=True,
                    role__in=['owner', 'admin', 'manager']
                ).select_related('company').first()

                print(f"[PROFILE DEBUG] Admin user {user.id} GET: membership found={membership is not None}")
                if membership:
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: membership.company={membership.company is not None}")

                if membership and membership.company:
                    company = membership.company
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Found company {company.id} - {company.name}")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Company phone='{company.primary_contact_phone}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Company email='{company.primary_contact_email}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Company address_line_1='{company.address_line_1}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Company city='{company.city}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Company postal_code='{company.postal_code}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Company state_province='{company.state_province}'")

                    # Prioritize user's actual name over company contact name
                    first_name = user.first_name or ''
                    last_name = user.last_name or ''

                    # Only fall back to company contact name if user names are empty
                    if not first_name and not last_name and company.primary_contact_name:
                        contact_name_parts = company.primary_contact_name.split(' ', 1)
                        first_name = contact_name_parts[0] if contact_name_parts else ''
                        last_name = contact_name_parts[1] if len(contact_name_parts) > 1 else ''

                    # Use company contact details, fallback to user details
                    phone_number = company.primary_contact_phone or ''
                    email = company.primary_contact_email or user.email

                    # Use company address
                    address = {
                        'street': company.address_line_1 or '',
                        'city': company.city or '',
                        'postalCode': company.postal_code or '',
                        'country': company.state_province or ''
                    }
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Set phone_number='{phone_number}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Set email='{email}'")
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: Set address={address}")
                else:
                    # Fallback if no company found
                    print(f"[PROFILE DEBUG] Admin user {user.id} GET: No company membership found - using empty contact info")
                    first_name = user.first_name
                    last_name = user.last_name
                    phone_number = ''
                    email = user.email
                    address = {'street': '', 'city': '', 'postalCode': '', 'country': ''}
            except Exception as e:
                # Fallback in case of any errors
                print(f"[PROFILE DEBUG] Admin user {user.id} GET: EXCEPTION: {str(e)}")
                import traceback
                traceback.print_exc()
                first_name = user.first_name
                last_name = user.last_name
                phone_number = ''
                email = user.email
                address = {'street': '', 'city': '', 'postalCode': '', 'country': ''}

            # Get bank details and employment type if StaffProfile exists for this admin user
            from api.models import StaffProfile as SP
            bank_details_response = {
                'accountName': '',
                'accountNumber': '',
                'sortCode': '',
                'bankName': ''
            }
            employment_type_response = None
            try:
                staff_profile = SP.objects.filter(user=user).select_related('bank_details', 'employment_type').first()
                if staff_profile:
                    try:
                        if staff_profile.bank_details:
                            bd = staff_profile.bank_details
                            bank_details_response = {
                                'accountName': bd.account_name or '',
                                'accountNumber': bd.account_number or '',
                                'sortCode': bd.sort_code or '',
                                'bankName': bd.bank_name or ''
                            }
                    except Exception:
                        pass  # No bank details relation
                    if staff_profile.employment_type:
                        et = staff_profile.employment_type
                        employment_type_response = {
                            'id': et.id,
                            'name': et.name,
                            'description': et.description,
                            'employment_category': et.employment_category,
                            'is_active': et.is_active
                        }
            except Exception:
                pass

            # Create a profile response for admin users with company contact info
            admin_profile_data = {
                'id': user.id,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': user.role,
                    'is_active': user.is_active
                },
                'username': user.username,
                'email': email,
                'firstName': first_name,
                'lastName': last_name,
                'role': user.role,
                'isActive': user.is_active,
                'phoneNumber': phone_number,
                'dateOfBirth': '',
                'nationalInsuranceNumber': '',
                'address': address,
                'siaLicenses': [],
                'bankDetails': bank_details_response,
                'emergencyContact': {
                    'name': '',
                    'relationship': '',
                    'phoneNumber': ''
                },
                'profileImageUrl': None,
                'availableDays': [],
                'preferredVenues': [],
                'notes': '',
                'employment_type': employment_type_response,
                'employment_type_details': employment_type_response,
                'employmentType': employment_type_response,
                'isApproved': True,  # Admin users are always approved
                'securityRoles': getattr(user, 'security_roles', []),
                'passwordLastChanged': user.password_last_changed.isoformat() if user.password_last_changed else None
            }
            print(f"[PROFILE DEBUG] Admin user {user.id} GET: Returning phoneNumber='{admin_profile_data['phoneNumber']}'")
            print(f"[PROFILE DEBUG] Admin user {user.id} GET: Returning address={admin_profile_data['address']}")
            return Response(admin_profile_data)
        elif request.method == 'PATCH':
            # For admin users, allow updating user fields and company contact info
            allowed_user_fields = ['firstName', 'lastName', 'email']
            allowed_company_fields = ['phoneNumber', 'address']
            # Note: emergencyContact, bankDetails, dateOfBirth, nationalInsuranceNumber, and notes
            # are accepted for form compatibility but not stored for admin users

            # DEBUG: Log incoming request data
            logger = logging.getLogger(__name__)
            logger.info(f"Admin user {user.id} PATCH request.data keys: {list(request.data.keys())}")
            logger.info(f"Admin user {user.id} PATCH request.data: {request.data}")

            user_updates = {}
            company_updates = {}

            # Handle user field updates
            for field in allowed_user_fields:
                if field in request.data:
                    if field == 'firstName':
                        user_updates['first_name'] = request.data[field]
                    elif field == 'lastName':
                        user_updates['last_name'] = request.data[field]
                    elif field == 'email':
                        user_updates['email'] = request.data[field]

            # Handle company contact field updates
            for field in allowed_company_fields:
                if field in request.data:
                    if field == 'phoneNumber':
                        company_updates['primary_contact_phone'] = request.data[field]
                    elif field == 'address' and isinstance(request.data[field], dict):
                        address_data = request.data[field]
                        if 'street' in address_data:
                            company_updates['address_line_1'] = address_data['street']
                        if 'city' in address_data:
                            company_updates['city'] = address_data['city']
                        if 'postalCode' in address_data:
                            company_updates['postal_code'] = address_data['postalCode']
                        if 'country' in address_data:
                            company_updates['state_province'] = address_data['country']

            # Handle bank details by creating a StaffProfile if needed
            if 'bankDetails' in request.data:
                from api.models import StaffProfile as SP3, BankDetails
                from django.db import transaction

                try:
                    with transaction.atomic():
                        # Get or create StaffProfile for this admin user
                        profile, created = SP3.objects.get_or_create(
                            user=user,
                            defaults={
                                'phone_number': phone_number if 'phone_number' in locals() else '',
                                'date_of_birth': '1900-01-01',  # Default placeholder for admin users
                                'is_approved': True  # Auto-approve admin profiles
                            }
                        )

                        # Get or create BankDetails
                        bank_details_data = request.data['bankDetails']
                        bank_details, _ = BankDetails.objects.get_or_create(
                            staff_profile=profile
                        )

                        # Update bank details fields
                        if 'accountName' in bank_details_data:
                            bank_details.account_name = bank_details_data['accountName']
                        if 'accountNumber' in bank_details_data:
                            bank_details.account_number = bank_details_data['accountNumber']
                        if 'sortCode' in bank_details_data:
                            bank_details.sort_code = bank_details_data['sortCode']
                        if 'bankName' in bank_details_data:
                            bank_details.bank_name = bank_details_data['bankName']

                        bank_details.save()
                except Exception as e:
                    # Log error but continue
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to save bank details for admin user {user.id}: {str(e)}")

            # Accept but ignore other fields that don't apply to admin users without StaffProfile
            ignored_fields = ['emergencyContact', 'dateOfBirth', 'nationalInsuranceNumber', 'notes']
            for field in ignored_fields:
                if field in request.data:
                    # Accept the field to prevent form errors, but don't store it
                    pass

            # Apply user updates
            if user_updates:
                for field, value in user_updates.items():
                    setattr(user, field, value)
                user.save()

            # Apply company updates
            if company_updates:
                try:
                    membership = user.company_memberships.filter(
                        is_active=True,
                        role__in=['owner', 'admin', 'manager']
                    ).select_related('company').first()

                    if not membership:
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Admin user {user.id} ({user.username}) has no company membership - cannot save contact info")
                        # Continue without failing - contact info just won't be saved
                    elif not membership.company:
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Admin user {user.id} ({user.username}) membership has no company - cannot save contact info")
                        # Continue without failing - contact info just won't be saved
                    else:
                        company = membership.company
                        logger = logging.getLogger(__name__)
                        logger.info(f"Updating company {company.id} contact info for admin user {user.id}")

                        # Update contact name if first/last name changed
                        if 'first_name' in user_updates or 'last_name' in user_updates:
                            company.primary_contact_name = f"{user.first_name} {user.last_name}".strip()
                            logger.info(f"Updated company contact name to: {company.primary_contact_name}")

                        # Update other company fields
                        for field, value in company_updates.items():
                            logger.info(f"Updating company field {field} to: {value}")
                            setattr(company, field, value)

                        company.save()
                        logger.info(f"Successfully saved company {company.id} with contact updates")
                except Exception as e:
                    # Log the actual error for debugging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to save company contact info for admin user {user.id}: {str(e)}", exc_info=True)
                    # Continue without failing - the user data was still saved successfully

            # Return updated admin profile data (reuse the GET logic)
            try:
                membership = user.company_memberships.filter(
                    is_active=True,
                    role__in=['owner', 'admin', 'manager']
                ).select_related('company').first()

                if membership and membership.company:
                    company = membership.company
                    contact_name_parts = (company.primary_contact_name or '').split(' ', 1)
                    first_name = contact_name_parts[0] if contact_name_parts else user.first_name
                    last_name = contact_name_parts[1] if len(contact_name_parts) > 1 else user.last_name
                    phone_number = company.primary_contact_phone or ''
                    email = company.primary_contact_email or user.email
                    address = {
                        'street': company.address_line_1 or '',
                        'city': company.city or '',
                        'postalCode': company.postal_code or '',
                        'country': company.state_province or ''
                    }
                else:
                    first_name = user.first_name
                    last_name = user.last_name
                    phone_number = ''
                    email = user.email
                    address = {'street': '', 'city': '', 'postalCode': '', 'country': ''}
            except Exception as e:
                first_name = user.first_name
                last_name = user.last_name
                phone_number = ''
                email = user.email
                address = {'street': '', 'city': '', 'postalCode': '', 'country': ''}

            # Get bank details if StaffProfile was created/exists
            from api.models import StaffProfile as SP2
            bank_details_response = {
                'accountName': '',
                'accountNumber': '',
                'sortCode': '',
                'bankName': ''
            }
            try:
                staff_profile = SP2.objects.filter(user=user).select_related('bank_details').first()
                if staff_profile and staff_profile.bank_details:
                    bd = staff_profile.bank_details
                    bank_details_response = {
                        'accountName': bd.account_name or '',
                        'accountNumber': bd.account_number or '',
                        'sortCode': bd.sort_code or '',
                        'bankName': bd.bank_name or ''
                    }
            except Exception:
                pass

            updated_profile_data = {
                'id': user.id,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': user.role,
                    'is_active': user.is_active
                },
                'username': user.username,
                'email': email,
                'firstName': first_name,
                'lastName': last_name,
                'role': user.role,
                'isActive': user.is_active,
                'phoneNumber': phone_number,
                'dateOfBirth': '',
                'nationalInsuranceNumber': '',
                'address': address,
                'siaLicenses': [],
                'bankDetails': bank_details_response,
                'emergencyContact': {
                    'name': '',
                    'relationship': '',
                    'phoneNumber': ''
                },
                'profileImageUrl': None,
                'availableDays': [],
                'preferredVenues': [],
                'notes': '',
                'isApproved': True,
                'securityRoles': getattr(user, 'security_roles', [])
            }
            return Response(updated_profile_data)

    return None


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_my_user(request):
    user = request.user
    if 'security_roles' in request.data:
        user.security_roles = request.data['security_roles']
        user.save()
    serializer = UserSerializer(user)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change user password endpoint.
    Expects: current_password, new_password
    """
    user = request.user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    if not current_password or not new_password:
        return Response({
            'detail': 'Both current_password and new_password are required.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Verify current password
    if not user.check_password(current_password):
        return Response({
            'detail': 'Current password is incorrect.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Validate new password strength (basic validation)
    if len(new_password) < 8:
        return Response({
            'detail': 'New password must be at least 8 characters long.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # Set new password
    user.set_password(new_password)

    # Update password_last_changed on User model (for all users)
    user.password_last_changed = timezone.now()

    # Also update password_last_changed if user has a staff profile
    try:
        if hasattr(user, 'profile') and user.profile:
            user.profile.password_last_changed = timezone.now()
            user.profile.save()
    except:
        # If user doesn't have a profile (like admin users), that's okay
        pass

    user.save()

    return Response({
        'detail': 'Password changed successfully.'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_account_deletion(request):
    """
    Self-service account deletion endpoint (Apple App Store compliance).
    Soft-deletes the account immediately and schedules permanent deletion after 30 days.
    Requires password confirmation, or type-to-confirm for social auth users without a password.
    """
    user = request.user

    if user.deletion_scheduled_at:
        return Response(
            {'detail': 'Account deletion is already scheduled.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check for in-progress shifts
    active_shifts = user.shifts.filter(status__in=['checked_in', 'in_progress']).exists()
    if active_shifts:
        return Response(
            {'detail': 'Cannot delete account while you have active shifts. Please check out first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify identity: password for normal users, confirmation phrase for social auth users
    if user.has_usable_password():
        password = request.data.get('password')
        if not password:
            return Response(
                {'detail': 'Password is required to confirm account deletion.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(password):
            return Response(
                {'detail': 'Password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
    else:
        confirmation = request.data.get('confirmation')
        if confirmation != 'DELETE':
            return Response(
                {'detail': 'Please type DELETE to confirm account deletion.', 'requires_confirmation': True},
                status=status.HTTP_400_BAD_REQUEST,
            )

    user.is_active = False
    user.deletion_scheduled_at = timezone.now()
    user.save(update_fields=['is_active', 'deletion_scheduled_at'])

    deletion_date = user.deletion_scheduled_at + datetime.timedelta(days=30)

    return Response({
        'message': 'Your account has been deactivated and is scheduled for permanent deletion.',
        'deletion_date': deletion_date.isoformat(),
    })


class FileUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def sanitize_filename(self, filename):
        """
        Sanitize filename by replacing spaces and special characters.
        Preserves the file extension.
        """
        # Split filename and extension
        name, ext = os.path.splitext(filename)
        # Replace spaces with underscores
        name = name.replace(' ', '_')
        # Remove any other problematic characters (keep alphanumeric, underscores, hyphens, dots)
        name = re.sub(r'[^\w\-.]', '_', name)
        # Remove multiple consecutive underscores
        name = re.sub(r'_+', '_', name)
        # Strip leading/trailing underscores
        name = name.strip('_')
        return f"{name}{ext}"

    # SECURITY: Restrict file types and size for SIA license uploads
    ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    # Magic byte signatures for file type validation
    VALID_FILE_SIGNATURES = [
        b'\xff\xd8\xff',  # JPEG
        b'\x89PNG',       # PNG
        b'%PDF',          # PDF
    ]

    @staticmethod
    def validate_file_magic_bytes(file_obj):
        """Validate file type by checking magic bytes, not just Content-Type header."""
        valid_signatures = [
            b'\xff\xd8\xff',  # JPEG
            b'\x89PNG',       # PNG
            b'%PDF',          # PDF
        ]
        header = file_obj.read(8)
        file_obj.seek(0)
        return any(header.startswith(sig) for sig in valid_signatures)

    def post(self, request, format=None):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided.'}, status=400)

        # Validate file size
        if file_obj.size > self.MAX_FILE_SIZE:
            return Response({'error': 'File too large. Maximum size is 10MB.'}, status=400)

        # Validate file type by Content-Type header
        if file_obj.content_type not in self.ALLOWED_TYPES:
            return Response({
                'error': 'Invalid file type. Allowed types: PDF, JPEG, PNG.'
            }, status=400)

        # SECURITY: Validate file type by magic bytes to prevent Content-Type spoofing
        if not self.validate_file_magic_bytes(file_obj):
            return Response({
                'error': 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
            }, status=400)

        # Sanitize filename to remove spaces and special characters
        sanitized_filename = self.sanitize_filename(file_obj.name)
        # Save the file to MEDIA_ROOT/sia_licenses/
        upload_dir = 'sia_licenses/'
        file_path = os.path.join(upload_dir, sanitized_filename)
        path = default_storage.save(file_path, ContentFile(file_obj.read()))
        # Build absolute URL with proper URL encoding for the path
        encoded_path = quote(path, safe='/')
        if settings.MEDIA_URL.startswith('http'):
            file_url = settings.MEDIA_URL + encoded_path
        else:
            scheme = request.scheme
            host = request.get_host()
            file_url = f"{scheme}://{host}{settings.MEDIA_URL}{encoded_path}"
        return Response({'url': file_url}, status=201)


class ProfilePhotoUploadView(APIView):
    """
    Upload profile photo for the authenticated user's staff profile.
    Accepts multipart form data with 'photo' field.
    Returns the URL of the uploaded photo and updates the staff profile.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    # Allowed image types
    ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

    # Magic byte signatures for image file type validation
    VALID_IMAGE_SIGNATURES = [
        b'\xff\xd8\xff',          # JPEG
        b'\x89PNG',               # PNG
        b'GIF87a',                # GIF87a
        b'GIF89a',                # GIF89a
        b'RIFF',                  # WebP (starts with RIFF....WEBP)
    ]

    @staticmethod
    def validate_image_magic_bytes(file_obj):
        """Validate image file type by checking magic bytes, not just Content-Type header."""
        header = file_obj.read(12)
        file_obj.seek(0)
        # Check standard signatures
        standard_sigs = [
            b'\xff\xd8\xff',  # JPEG
            b'\x89PNG',       # PNG
            b'GIF87a',        # GIF87a
            b'GIF89a',        # GIF89a
        ]
        if any(header.startswith(sig) for sig in standard_sigs):
            return True
        # WebP: starts with RIFF, then 4 bytes of size, then WEBP
        if header[:4] == b'RIFF' and header[8:12] == b'WEBP':
            return True
        return False

    def sanitize_filename(self, filename):
        """Sanitize filename for safe storage."""
        name, ext = os.path.splitext(filename)
        name = name.replace(' ', '_')
        name = re.sub(r'[^\w\-.]', '_', name)
        name = re.sub(r'_+', '_', name)
        name = name.strip('_')
        return f"{name}{ext}"

    def post(self, request, format=None):
        logger = logging.getLogger(__name__)

        # Get the photo file
        photo = request.FILES.get('photo')
        if not photo:
            return Response(
                {'error': 'No photo provided. Please upload an image file.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type by Content-Type header
        content_type = photo.content_type
        if content_type not in self.ALLOWED_TYPES:
            return Response(
                {'error': f'Invalid file type: {content_type}. Allowed types: JPEG, PNG, GIF, WebP'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # SECURITY: Validate file type by magic bytes to prevent Content-Type spoofing
        if not self.validate_image_magic_bytes(photo):
            return Response(
                {'error': 'Invalid file content. The file does not match its declared type.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file size
        if photo.size > self.MAX_FILE_SIZE:
            return Response(
                {'error': f'File too large. Maximum size is {self.MAX_FILE_SIZE // (1024*1024)}MB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Get or create staff profile for the user
            profile, created = StaffProfile.objects.get_or_create(
                user=request.user,
                defaults={
                    'phone_number': '',
                    'date_of_birth': timezone.now().date(),
                    'street': '',
                    'city': '',
                    'postal_code': '',
                    'country': '',
                }
            )

            # Generate unique filename to avoid conflicts
            ext = os.path.splitext(photo.name)[1].lower()
            unique_filename = f"user_{request.user.id}_{uuid.uuid4().hex[:8]}{ext}"
            sanitized_filename = self.sanitize_filename(unique_filename)

            # Save to profile_photos directory
            upload_dir = 'profile_photos/'
            file_path = os.path.join(upload_dir, sanitized_filename)
            
            # Save the file
            path = default_storage.save(file_path, ContentFile(photo.read()))
            
            # Build the URL
            encoded_path = quote(path, safe='/')
            if settings.MEDIA_URL.startswith('http'):
                file_url = settings.MEDIA_URL + encoded_path
            else:
                scheme = request.scheme
                host = request.get_host()
                file_url = f"{scheme}://{host}{settings.MEDIA_URL}{encoded_path}"

            # Update the staff profile with the new photo URL
            old_photo_url = profile.profile_image_url
            profile.profile_image_url = file_url
            profile.save(update_fields=['profile_image_url', 'updated_at'])

            logger.info(f"Profile photo uploaded for user {request.user.id}: {file_url}")

            # Optionally delete old photo file if it exists in our storage
            if old_photo_url and 'profile_photos/' in old_photo_url:
                try:
                    old_path = old_photo_url.split('profile_photos/')[-1]
                    old_file_path = f"profile_photos/{old_path}"
                    if default_storage.exists(old_file_path):
                        default_storage.delete(old_file_path)
                        logger.info(f"Deleted old profile photo: {old_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to delete old profile photo: {e}")

            return Response({
                'url': file_url,
                'message': 'Profile photo uploaded successfully'
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Failed to upload profile photo for user {request.user.id}: {e}")
            return Response(
                {'error': 'Failed to upload profile photo. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EmploymentTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing employment types.
    Only admins can create, update, or delete employment types.
    """
    queryset = EmploymentType.objects.all()
    serializer_class = EmploymentTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin/manager
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    def get_queryset(self):
        """Filter employment types by company context"""
        company = self.get_user_company(self.request)
        if not company:
            # No company context, return empty queryset
            return EmploymentType.objects.none()

        return EmploymentType.objects.filter(company=company)

    def get_serializer_context(self):
        """Add company context to serializer"""
        context = super().get_serializer_context()
        context['company'] = self.get_user_company(self.request)
        return context

    def get_permissions(self):
        """
        Admin-only access for CUD operations, authenticated users can read.
        Public access for 'active' endpoint to support recruitment form.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminUser]
        elif self.action == 'active':
            permission_classes = [AllowAny]  # Public access for recruitment form
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def perform_create(self, serializer):
        """Set the company when creating a new employment type"""
        company = self.get_user_company(self.request)
        if not company:
            raise ValidationError('No company context found')
        serializer.save(company=company)

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """Get only active employment types for the user's company"""
        company = self.get_user_company(request)
        if not company:
            # For public recruitment form, return empty list if no company context
            return Response([])

        active_types = EmploymentType.objects.filter(company=company, is_active=True)
        serializer = self.get_serializer(active_types, many=True)
        return Response(serializer.data)


class RecruitmentApplicationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing recruitment applications.
    Admins can view and manage all applications.
    Regular users cannot access this endpoint.
    """
    queryset = RecruitmentApplication.objects.all()
    serializer_class = RecruitmentApplicationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """
        Only users with admin role can access recruitment applications.
        """
        if self.request.user.is_authenticated and self.request.user.role == 'admin':
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin/manager
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    def get_queryset(self):
        """
        Filter applications based on query parameters and company context.
        """
        # Filter by company context first
        company = self.get_user_company(self.request)
        if not company:
            return RecruitmentApplication.objects.none()

        # Base queryset filtered by company through employment_type relationship
        queryset = RecruitmentApplication.objects.filter(
            employment_type__company=company
        ).select_related('employment_type', 'reviewed_by', 'converted_to_user')
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by employment type
        employment_type = self.request.query_params.get('employment_type', None)
        if employment_type:
            queryset = queryset.filter(employment_type=employment_type)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """Approve a recruitment application"""
        application = self.get_object()
        notes = request.data.get('notes', '')
        
        try:
            application.approve(request.user, notes)
            return Response({
                'message': 'Application approved successfully',
                'application': RecruitmentApplicationSerializer(application).data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Reject a recruitment application"""
        application = self.get_object()
        notes = request.data.get('notes', '')
        
        if not notes:
            return Response({'error': 'Rejection notes are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            application.reject(request.user, notes)
            return Response({
                'message': 'Application rejected successfully',
                'application': RecruitmentApplicationSerializer(application).data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'], url_path='convert-to-user')
    def convert_to_user(self, request, pk=None):
        """Convert approved application to user account with enhanced error handling"""
        application = self.get_object()

        try:
            user = application.convert_to_user(request.user)

            # Get admin IP address for audit trail
            ip_address = request.META.get('HTTP_X_FORWARDED_FOR')
            if ip_address:
                ip_address = ip_address.split(',')[0].strip()
            else:
                ip_address = request.META.get('REMOTE_ADDR', '0.0.0.0')

            # Create password setup token for the new user
            reset_token = PasswordResetToken.objects.create(
                user=user,
                ip_address=ip_address
            )

            # Get company name for welcome email
            company_name = application.employment_type.company.name

            # Queue welcome email task
            from .tasks import send_staff_welcome_email
            send_staff_welcome_email.delay(
                user_id=user.id,
                company_name=company_name,
                token_uuid=str(reset_token.token),
                admin_ip=ip_address
            )

            # Log successful conversion with email queued
            logger.info(
                f"Successfully converted recruitment application {pk} to user {user.id} "
                f"by {request.user.username}. Welcome email queued."
            )

            return Response({
                'message': 'Application converted to user account successfully. Welcome email sent.',
                'user': UserSerializer(user).data,
                'application': RecruitmentApplicationSerializer(application).data,
                'welcome_email_queued': True,
                'password_setup_expires_at': reset_token.expires_at.isoformat()
            })

        except ValueError as e:
            # Business logic errors - safe to expose
            logger.warning(f"Conversion validation failed for application {pk}: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

        except IntegrityError as e:
            # Database constraint violations
            logger.error(f"Database integrity error converting application {pk}: {str(e)}", exc_info=True)
            return Response({
                'error': 'Data conflict during conversion. Please check for duplicate users.'
            }, status=status.HTTP_409_CONFLICT)

        except Exception as e:
            # Unexpected errors - log details but return generic message
            logger.error(f"Unexpected error converting application {pk} to user: {str(e)}", exc_info=True)
            return Response({
                'error': 'Internal error during conversion. Please try again or contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Get recruitment application statistics"""
        # SECURITY: Scope stats to the requesting user's company
        company = self.get_user_company(request)
        if not company:
            return Response({'error': 'No company context available'}, status=status.HTTP_403_FORBIDDEN)

        base_qs = RecruitmentApplication.objects.filter(
            employment_type__company=company
        )
        stats = {
            'total': base_qs.count(),
            'pending': base_qs.filter(status='pending').count(),
            'approved': base_qs.filter(status='approved').count(),
            'rejected': base_qs.filter(status='rejected').count(),
            'converted': base_qs.filter(converted_to_user__isnull=False).count(),
        }

        # Stats by employment type - scoped to company
        employment_type_stats = {}
        for et in EmploymentType.objects.filter(company=company):
            employment_type_stats[et.name] = et.applications.count()

        stats['by_employment_type'] = employment_type_stats

        return Response(stats)


class RecruitmentApplicationPublicViewSet(viewsets.ModelViewSet):
    """
    Public ViewSet for recruitment application submissions.
    Anyone can submit an application, but only create operations are allowed.
    """
    queryset = RecruitmentApplication.objects.all()
    serializer_class = RecruitmentApplicationPublicSerializer
    permission_classes = [AllowAny]
    http_method_names = ['post']  # Only allow POST (create)
    
    def create(self, request, *args, **kwargs):
        """Create a new recruitment application"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            application = serializer.save()
            
            # Send confirmation email (optional - implement as needed)
            # send_application_confirmation_email(application)
            
            return Response({
                'message': 'Application submitted successfully',
                'application_id': application.id,
                'email': application.email
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CompanyRecruitmentViewSet(viewsets.ViewSet):
    """
    Company-specific recruitment endpoints.
    Provides company context for recruitment applications.
    """
    permission_classes = [AllowAny]

    def get_company_from_slug(self, company_slug):
        """Get company by slug"""
        try:
            return SecurityCompany.objects.get(slug=company_slug, is_active=True)
        except SecurityCompany.DoesNotExist:
            return None

    @action(detail=False, methods=['get'], url_path='employment-types/(?P<company_slug>[^/.]+)')
    def employment_types(self, request, company_slug=None):
        """
        GET /api/v1/recruitment/employment-types/{company_slug}/
        Get active employment types for a specific company.
        """
        company = self.get_company_from_slug(company_slug)
        if not company:
            return Response({
                'error': 'Company not found or inactive'
            }, status=status.HTTP_404_NOT_FOUND)

        employment_types = EmploymentType.objects.filter(
            company=company,
            is_active=True
        ).values('id', 'name', 'description')

        return Response({
            'company': {
                'name': company.name,
                'slug': company.slug
            },
            'employment_types': list(employment_types)
        })

    @action(detail=False, methods=['post'], url_path='apply/(?P<company_slug>[^/.]+)')
    def apply(self, request, company_slug=None):
        """
        POST /api/v1/company-recruitment/apply/{company_slug}/
        Submit a recruitment application for a specific company.
        """
        logger.info(f"Recruitment application submission started for company: {company_slug}")

        company = self.get_company_from_slug(company_slug)
        if not company:
            logger.error(f"Company not found or inactive: {company_slug}")
            return Response({
                'error': 'Company not found or inactive'
            }, status=status.HTTP_404_NOT_FOUND)

        # Validate that the employment type is provided and belongs to this company
        employment_type_id = request.data.get('employment_type')
        if not employment_type_id:
            logger.error(f"No employment type provided in recruitment application for company {company.slug}")
            return Response({
                'error': 'Employment type is required for recruitment applications'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            employment_type = EmploymentType.objects.get(
                id=employment_type_id,
                company=company,
                is_active=True
            )
            logger.info(f"Valid employment type {employment_type_id} found for company {company.slug}")
        except EmploymentType.DoesNotExist:
            logger.error(f"Invalid employment type {employment_type_id} for company {company.slug}")
            return Response({
                'error': 'Invalid employment type for this company'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create the application
        logger.info(f"Creating recruitment application with data: {list(request.data.keys())}")
        serializer = RecruitmentApplicationPublicSerializer(data=request.data)
        if serializer.is_valid():
            try:
                application = serializer.save()
                logger.info(f"Recruitment application {application.id} created successfully for {application.email}")

                return Response({
                    'message': 'Application submitted successfully',
                    'application_id': application.id,
                    'email': application.email,
                    'company': company.name
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Failed to save recruitment application: {str(e)}")
                return Response({
                    'error': 'Failed to save application. Please try again.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            logger.error(f"Recruitment application validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='info/(?P<company_slug>[^/.]+)')
    def company_info(self, request, company_slug=None):
        """
        GET /api/v1/recruitment/info/{company_slug}/
        Get basic company information for recruitment page.
        """
        company = self.get_company_from_slug(company_slug)
        if not company:
            return Response({
                'error': 'Company not found or inactive'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'company': {
                'name': company.name,
                'slug': company.slug,
                'trading_name': company.trading_name,
                'city': company.city,
                'state_province': company.state_province,
                'country_code': company.country_code,
                'contact_email': company.primary_contact_email
            }
        })


# =============================================================================
# COMPLIANCE SYSTEM VIEWS
# =============================================================================

class CompliancePermissions:
    """Custom permission classes for compliance system"""

    @staticmethod
    def is_manager_or_admin(user):
        """Check if user is manager or admin"""
        return user.is_authenticated and user.role in ['manager', 'admin']

    @staticmethod
    def is_admin(user):
        """Check if user is admin"""
        return user.is_authenticated and user.role == 'admin'

    @staticmethod
    def can_view_user_data(requesting_user, target_user):
        """Check if user can view another user's compliance data"""
        if not requesting_user.is_authenticated:
            return False

        # Admin can view all
        if requesting_user.role == 'admin':
            return True

        # Manager can view staff they manage
        if requesting_user.role == 'manager':
            # TODO: Implement manager-staff relationship check
            return True

        # Staff can only view their own data
        return requesting_user.id == target_user.id


class WorkingHoursRegulationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing working hours regulations by country.
    Admin users can create custom regulations.
    """
    queryset = WorkingHoursRegulation.objects.all()
    serializer_class = WorkingHoursRegulationSerializer

    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """Filter regulations based on user permissions and query params"""
        queryset = WorkingHoursRegulation.objects.active_regulations()

        # Filter by country code if provided
        country_code = self.request.query_params.get('country_code')
        if country_code:
            queryset = queryset.filter(country_code__iexact=country_code)

        return queryset.order_by('country_name')

    @action(detail=False, methods=['get'])
    def countries(self, request):
        """Get list of available countries"""
        countries = self.get_queryset().values('country_code', 'country_name', 'is_active')
        return Response({
            'status': 'success',
            'data': list(countries),
            'count': len(countries)
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def activate(self, request, pk=None):
        """Activate a regulation"""
        regulation = self.get_object()
        regulation.is_active = True
        regulation.save()

        return Response({
            'status': 'success',
            'message': f'Regulation for {regulation.country_name} activated'
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def deactivate(self, request, pk=None):
        """Deactivate a regulation"""
        regulation = self.get_object()
        regulation.is_active = False
        regulation.save()

        return Response({
            'status': 'success',
            'message': f'Regulation for {regulation.country_name} deactivated'
        })


class ComplianceProfileViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing organizational compliance profiles.
    """
    queryset = ComplianceProfile.objects.all()
    serializer_class = ComplianceProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Set permissions based on action"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdminUser]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """Get queryset based on user permissions"""
        if CompliancePermissions.is_admin(self.request.user):
            return ComplianceProfile.objects.all().select_related('working_hours_regulation')
        else:
            # Non-admin users can only see active profiles
            return ComplianceProfile.objects.filter(is_active=True).select_related('working_hours_regulation')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the currently active compliance profile"""
        active_profile = ComplianceProfile.objects.get_active_profile()

        if not active_profile:
            return Response({
                'status': 'error',
                'message': 'No active compliance profile found'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(active_profile)
        return Response({
            'status': 'success',
            'data': serializer.data
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def set_active(self, request, pk=None):
        """Set this profile as the active one"""
        # Deactivate all profiles
        ComplianceProfile.objects.all().update(is_active=False)

        # Activate this profile
        profile = self.get_object()
        profile.is_active = True
        profile.save()

        # Clear cache
        cache.delete('compliance_settings')

        return Response({
            'status': 'success',
            'message': f'Profile "{profile.name}" is now active'
        })


class ComplianceViolationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing compliance violations with advanced filtering and resolution.
    """
    serializer_class = ComplianceViolationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get queryset with optimized joins and filters"""
        queryset = ComplianceViolation.objects.select_related(
            'user', 'shift__venue', 'resolved_by', 'approved_by'
        )

        # Filter based on user permissions
        user = self.request.user
        if not CompliancePermissions.is_manager_or_admin(user):
            # Staff can only see their own violations
            queryset = queryset.filter(user=user)

        # Apply filters from query parameters
        queryset = self._apply_filters(queryset)

        return queryset.order_by('-created_at')

    def _apply_filters(self, queryset):
        """Apply various filters based on query parameters"""
        params = self.request.query_params

        # Filter by violation type
        violation_type = params.get('violation_type')
        if violation_type:
            queryset = queryset.filter(violation_type=violation_type)

        # Filter by severity
        severity = params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity)

        # Filter by resolution status
        status_filter = params.get('status')
        if status_filter:
            if status_filter == 'open':
                queryset = queryset.filter(resolution_status__in=['open', 'investigating', 'pending_approval'])
            elif status_filter == 'resolved':
                queryset = queryset.filter(resolution_status__in=['resolved', 'approved_exception', 'false_positive', 'dismissed'])
            else:
                queryset = queryset.filter(resolution_status=status_filter)

        # Filter by date range
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        if start_date:
            queryset = queryset.filter(period_start__gte=start_date)
        if end_date:
            queryset = queryset.filter(period_end__lte=end_date)

        # Filter by user (managers/admins only)
        user_id = params.get('user_id')
        if user_id and CompliancePermissions.is_manager_or_admin(self.request.user):
            queryset = queryset.filter(user_id=user_id)

        return queryset

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get violation summary statistics"""
        cache_key = f"violation_summary_{request.user.id}"

        # Try to get from cache
        summary = cache.get(cache_key)
        if summary:
            return Response({'status': 'success', 'data': summary, 'cached': True})

        # Calculate summary using optimized manager methods
        if CompliancePermissions.is_manager_or_admin(request.user):
            summary_data = ComplianceViolation.objects.dashboard_summary()
        else:
            # For staff users, get their own violations only
            summary_data = ComplianceViolation.objects.filter(user=request.user).aggregate(
                total_violations=Count('id'),
                open_violations=Count('id', filter=Q(resolution_status__in=['open', 'investigating', 'pending_approval'])),
                critical_violations=Count('id', filter=Q(severity='critical')),
                resolved_violations=Count('id', filter=Q(resolution_status__in=['resolved', 'approved_exception']))
            )

        # Cache for 15 minutes
        cache.set(cache_key, summary_data, 900)

        return Response({
            'status': 'success',
            'data': summary_data,
            'cached': False
        })

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get violations pending manager approval"""
        if not CompliancePermissions.is_manager_or_admin(request.user):
            return Response({
                'status': 'error',
                'message': 'Insufficient permissions'
            }, status=status.HTTP_403_FORBIDDEN)

        pending_violations = self.get_queryset().filter(
            resolution_status='pending_approval'
        )

        # Paginate results
        page = self.paginate_queryset(pending_violations)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(pending_violations, many=True)
        return Response({
            'status': 'success',
            'data': serializer.data,
            'count': len(serializer.data)
        })

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve a compliance violation"""
        violation = self.get_object()

        # Check permissions
        if not CompliancePermissions.is_manager_or_admin(request.user):
            return Response({
                'status': 'error',
                'message': 'Only managers and admins can resolve violations'
            }, status=status.HTTP_403_FORBIDDEN)

        # Validate resolution data
        serializer = ComplianceViolationResolveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Resolve violation using model method
        violation.resolve(
            resolved_by=request.user,
            resolution_notes=serializer.validated_data.get('resolution_notes', ''),
            exception_granted=serializer.validated_data.get('exception_granted', False),
            exception_reason=serializer.validated_data.get('exception_reason', '')
        )
        violation.save()

        # Clear caches
        cache.delete(f"violation_summary_{violation.user_id}")
        cache.delete(f"compliance_status_{violation.user_id}")

        return Response({
            'status': 'success',
            'message': 'Violation resolved successfully',
            'violation_id': violation.id,
            'resolved_at': violation.resolved_at
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def bulk_resolve(self, request):
        """Bulk resolve multiple violations"""
        serializer = BulkViolationResolveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        violation_ids = serializer.validated_data['violation_ids']
        resolution_notes = serializer.validated_data.get('resolution_notes', '')
        exception_granted = serializer.validated_data.get('exception_granted', False)
        exception_reason = serializer.validated_data.get('exception_reason', '')

        # Get violations to resolve
        violations = ComplianceViolation.objects.filter(
            id__in=violation_ids,
            resolution_status__in=['open', 'investigating', 'pending_approval']
        )

        resolved_count = 0
        user_ids_to_clear = set()

        for violation in violations:
            violation.resolve(
                resolved_by=request.user,
                resolution_notes=resolution_notes,
                exception_granted=exception_granted,
                exception_reason=exception_reason
            )
            violation.save()
            resolved_count += 1
            user_ids_to_clear.add(violation.user_id)

        # Clear caches for affected users
        for user_id in user_ids_to_clear:
            cache.delete(f"violation_summary_{user_id}")
            cache.delete(f"compliance_status_{user_id}")

        return Response({
            'status': 'success',
            'message': f'Resolved {resolved_count} violations',
            'resolved_count': resolved_count,
            'total_requested': len(violation_ids)
        })


class ComplianceReportViewSet(viewsets.ViewSet):
    """
    ViewSet for compliance reporting and analytics.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get compliance dashboard summary with real violation data"""
        try:
            from datetime import timedelta
            from django.db.models import Avg, Count
            from django.db.models.functions import TruncDate

            now = timezone.now()
            period_days = int(request.query_params.get('days', 30))
            period_start = now - timedelta(days=period_days)

            # Get violations for this period
            violations = ComplianceViolation.objects.filter(created_at__gte=period_start)

            total_violations = violations.count()
            critical_violations = violations.filter(severity='critical').count()
            resolved_statuses = ['resolved', 'approved_exception', 'false_positive', 'dismissed']
            resolved_violations = violations.filter(resolution_status__in=resolved_statuses).count()
            open_violations = total_violations - resolved_violations

            # Calculate compliance rate
            if total_violations > 0:
                overall_compliance_rate = round((resolved_violations / total_violations) * 100, 1)
            else:
                overall_compliance_rate = 100.0

            # Average resolution time for resolved violations
            resolved_with_time = violations.filter(
                resolution_status__in=resolved_statuses, resolved_at__isnull=False
            )
            avg_resolution_hours = None
            if resolved_with_time.exists():
                from django.db.models import F, ExpressionWrapper, DurationField
                avg_duration = resolved_with_time.annotate(
                    resolution_time=ExpressionWrapper(
                        F('resolved_at') - F('created_at'),
                        output_field=DurationField()
                    )
                ).aggregate(avg_time=Avg('resolution_time'))['avg_time']
                if avg_duration:
                    avg_resolution_hours = round(avg_duration.total_seconds() / 3600, 1)

            # Compliance trend (daily compliance rate over the period)
            compliance_trend = []
            daily_data = violations.annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                violation_count=Count('id'),
                resolved_count=Count('id', filter=Q(resolution_status__in=resolved_statuses))
            ).order_by('date')

            for day in daily_data:
                rate = round((day['resolved_count'] / day['violation_count']) * 100, 1) if day['violation_count'] > 0 else 100.0
                compliance_trend.append({
                    'date': day['date'].isoformat(),
                    'compliance_rate': rate,
                    'violation_count': day['violation_count'],
                })

            # Violation breakdown by type
            violation_breakdown = list(
                violations.values('violation_type').annotate(
                    count=Count('id')
                ).order_by('-count')
            )
            # Map to frontend expected format
            violation_breakdown = [
                {
                    'type': item['violation_type'] or 'unknown',
                    'count': item['count'],
                    'severity': 'medium',  # Default; could be enhanced
                }
                for item in violation_breakdown
            ]

            data = {
                'overall_compliance_rate': overall_compliance_rate,
                'total_violations': total_violations,
                'critical_violations': critical_violations,
                'resolved_violations': resolved_violations,
                'open_violations': open_violations,
                'average_resolution_time_hours': avg_resolution_hours,
                'compliance_trend': compliance_trend,
                'violation_breakdown': violation_breakdown,
                'weekly_trend': 'stable' if total_violations == 0 else ('improving' if overall_compliance_rate > 80 else 'declining'),
                'last_updated': now.isoformat(),
                'period_start': period_start.isoformat(),
                'period_end': now.isoformat(),
            }

            return Response({
                'status': 'success',
                'data': data,
                'cached': False
            })
        except Exception as e:
            logger.error(f"Compliance dashboard error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to generate dashboard data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def trends(self, request):
        """Get compliance violation trends over time"""
        try:
            days = int(request.query_params.get('days', 30))
            group_by = request.query_params.get('group_by', 'day')

            # Simple fallback implementation for now - replace with actual data when available
            trends_data = {
                'trend_data': [
                    {
                        'period': '2025-09-16',
                        'violation_count': 0,
                        'critical_count': 0,
                        'major_count': 0,
                        'minor_count': 0
                    }
                ],
                'summary': {
                    'total_violations': 0,
                    'avg_daily_violations': 0.0,
                    'trend_direction': 'stable'
                }
            }

            return Response({
                'status': 'success',
                'data': trends_data,
                'parameters': {'days': days, 'group_by': group_by}
            })
        except Exception as e:
            logger.error(f"Compliance trends error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to generate trends data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def working_hours(self, request):
        """Get working hours compliance report"""
        try:
            # Get working hours data using optimized manager
            user_id = request.query_params.get('user_id')
            period_type = request.query_params.get('period_type', 'weekly')

            # Check permissions for user-specific data
            if user_id and not CompliancePermissions.can_view_user_data(request.user, User.objects.get(id=user_id)):
                return Response({
                    'status': 'error',
                    'message': 'Insufficient permissions to view this user\'s data'
                }, status=status.HTTP_403_FORBIDDEN)

            # Use optimized performance guide method
            data = CompliancePerformanceGuide.get_working_hours_dashboard(
                user_id=user_id,
                period_type=period_type
            )

            return Response({
                'status': 'success',
                'data': data
            })
        except User.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Working hours report error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to generate working hours report'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WorkingHoursMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for working hours metrics.
    """
    serializer_class = WorkingHoursMetricsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Get metrics based on user permissions"""
        queryset = WorkingHoursMetrics.objects.select_related('user')

        # Filter based on permissions
        if not CompliancePermissions.is_manager_or_admin(self.request.user):
            queryset = queryset.filter(user=self.request.user)

        # Apply filters
        user_id = self.request.query_params.get('user_id')
        if user_id and CompliancePermissions.is_manager_or_admin(self.request.user):
            queryset = queryset.filter(user_id=user_id)

        period_type = self.request.query_params.get('period_type')
        if period_type:
            queryset = queryset.filter(period_type=period_type)

        return queryset.order_by('-period_start')

    @action(detail=False, methods=['post'], permission_classes=[IsAdminUser])
    def recalculate(self, request):
        """Trigger metrics recalculation"""
        try:
            user_id = request.data.get('user_id')
            period_type = request.data.get('period_type', 'all')

            # Use background task for heavy calculations
            # TODO: Implement celery task for metrics recalculation
            # recalculate_metrics.delay(user_id, period_type)

            return Response({
                'status': 'success',
                'message': 'Metrics recalculation initiated'
            })
        except Exception as e:
            logger.error(f"Metrics recalculation error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to initiate metrics recalculation'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@CompliancePerformanceGuide.monitor_query_performance('real_time_compliance_check')
def check_compliance(request):
    """
    Real-time compliance checking for shift scheduling.
    Performance target: < 50ms
    """
    serializer = ComplianceCheckSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'status': 'error',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Use performance guide for optimized compliance check
        user_id = serializer.validated_data['user_id']

        # Check permissions
        if not CompliancePermissions.can_view_user_data(request.user, User.objects.get(id=user_id)):
            return Response({
                'status': 'error',
                'message': 'Insufficient permissions'
            }, status=status.HTTP_403_FORBIDDEN)

        # Get real-time compliance status
        compliance_status = CompliancePerformanceGuide.get_real_time_compliance_status(
            User.objects.get(id=user_id)
        )

        return Response({
            'status': 'success',
            'data': compliance_status,
            'timestamp': timezone.now()
        })

    except User.DoesNotExist:
        return Response({
            'status': 'error',
            'message': 'User not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Real-time compliance check error: {str(e)}")
        return Response({
            'status': 'error',
            'message': 'Failed to check compliance status'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def compliance_alerts(request):
    """Get active compliance alerts for the user"""
    try:
        user = request.user
        alerts = []

        if CompliancePermissions.is_manager_or_admin(user):
            # Managers get system-wide alerts
            critical_violations = ComplianceViolation.objects.filter(
                severity='critical',
                resolution_status__in=['open', 'investigating']
            ).count()

            if critical_violations > 0:
                alerts.append({
                    'type': 'critical_violations',
                    'message': f'{critical_violations} critical violations require attention',
                    'count': critical_violations,
                    'priority': 'high'
                })

        # Get user-specific alerts
        user_violations = ComplianceViolation.objects.filter(
            user=user,
            resolution_status__in=['open', 'investigating'],
            severity__in=['major', 'critical']
        ).count()

        if user_violations > 0:
            alerts.append({
                'type': 'user_violations',
                'message': f'You have {user_violations} compliance violations',
                'count': user_violations,
                'priority': 'medium'
            })

        return Response({
            'status': 'success',
            'data': alerts,
            'count': len(alerts)
        })

    except Exception as e:
        logger.error(f"Compliance alerts error: {str(e)}")
        return Response({
            'status': 'error',
            'message': 'Failed to retrieve compliance alerts'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# REGIONAL COMPLIANCE API VIEWS
# =============================================================================

import requests
import ipaddress
from decimal import Decimal
from django.utils import timezone
from django.core.cache import cache
from .compliance_query_optimizations import WorkingHoursRegulationQuerySet
from .serializers import (
    RegionDetectionSerializer, RegionDetectionResponseSerializer,
    PresetApplicationSerializer, PresetApplicationResponseSerializer,
    RegulationComparisonSerializer, RegulationComparisonResponseSerializer,
    ScheduleValidationSerializer, ScheduleValidationResponseSerializer,
    RegionalSettingsSerializer, RegionalSettingsResponseSerializer,
    EnhancedWorkingHoursRegulationSerializer
)


class RegionalComplianceViewSet(viewsets.ViewSet):
    """
    ViewSet for regional compliance management endpoints.
    Handles region detection, preset application, and regulation comparison.
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='presets')
    def get_presets(self, request):
        """
        Get available regional compliance presets.
        GET /api/v1/compliance/regional/presets/
        """
        presets = [
            {
                'region_code': 'GB',
                'region_name': 'United Kingdom',
                'preset_type': 'uk_sia',
                'description': 'UK Working Time Regulations 1998 with SIA licensing requirements',
                'regulations': {
                    'country_code': 'GB',
                    'country_name': 'United Kingdom',
                    'standard_daily_hours': 8.0,
                    'standard_weekly_hours': 40.0,
                    'max_daily_hours': 12.0,
                    'max_weekly_hours': 48.0,
                    'overtime_threshold_hours': 8.0,
                    'overtime_multiplier_1': 1.5,
                    'break_duration_minutes': 30,
                    'break_trigger_hours': 6.0,
                    'min_rest_between_shifts_hours': 11.0,
                    'min_weekly_rest_hours': 24.0,
                    'max_consecutive_days': 6
                },
                'profile_defaults': {
                    'daily_hours_warning_threshold': 80,
                    'weekly_hours_warning_threshold': 85,
                    'consecutive_days_warning_threshold': 5,
                    'grace_period_minutes': 15,
                    'auto_approve_overtime': False,
                    'require_manager_approval': True,
                    'notify_on_warnings': True,
                    'notify_on_violations': True
                }
            },
            {
                'region_code': 'US',
                'region_name': 'United States',
                'preset_type': 'us_flsa',
                'description': 'US Fair Labor Standards Act (FLSA) compliance',
                'regulations': {
                    'country_code': 'US',
                    'country_name': 'United States',
                    'standard_daily_hours': 8.0,
                    'standard_weekly_hours': 40.0,
                    'max_daily_hours': 16.0,
                    'max_weekly_hours': 60.0,
                    'overtime_threshold_hours': 8.0,
                    'overtime_multiplier_1': 1.5,
                    'break_duration_minutes': 30,
                    'break_trigger_hours': 8.0,
                    'min_rest_between_shifts_hours': 8.0,
                    'min_weekly_rest_hours': 24.0,
                    'max_consecutive_days': 7
                },
                'profile_defaults': {
                    'daily_hours_warning_threshold': 75,
                    'weekly_hours_warning_threshold': 80,
                    'consecutive_days_warning_threshold': 6,
                    'grace_period_minutes': 10,
                    'auto_approve_overtime': True,
                    'require_manager_approval': False,
                    'notify_on_warnings': True,
                    'notify_on_violations': True
                }
            },
            {
                'region_code': 'EU',
                'region_name': 'European Union',
                'preset_type': 'eu_wtd',
                'description': 'EU Working Time Directive 2003/88/EC compliance',
                'regulations': {
                    'country_code': 'EU',
                    'country_name': 'European Union',
                    'standard_daily_hours': 8.0,
                    'standard_weekly_hours': 40.0,
                    'max_daily_hours': 10.0,
                    'max_weekly_hours': 48.0,
                    'overtime_threshold_hours': 8.0,
                    'overtime_multiplier_1': 1.5,
                    'break_duration_minutes': 20,
                    'break_trigger_hours': 6.0,
                    'min_rest_between_shifts_hours': 11.0,
                    'min_weekly_rest_hours': 35.0,
                    'max_consecutive_days': 6
                },
                'profile_defaults': {
                    'daily_hours_warning_threshold': 85,
                    'weekly_hours_warning_threshold': 90,
                    'consecutive_days_warning_threshold': 5,
                    'grace_period_minutes': 20,
                    'auto_approve_overtime': False,
                    'require_manager_approval': True,
                    'notify_on_warnings': True,
                    'notify_on_violations': True
                }
            }
        ]

        return Response({
            'status': 'success',
            'data': presets
        })

    @action(detail=False, methods=['get'], url_path='detect-region')
    def detect_region(self, request):
        """
        Auto-detect region based on venue coordinates, GPS coordinates, or IP address.

        GET /api/compliance/regulations/detect-region/
        Parameters: venue_id, lat, lng, ip_address
        """
        try:
            serializer = RegionDetectionSerializer(data=request.query_params)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid parameters',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data

            # Region detection logic
            region_data = self._detect_region_from_data(data)

            response_serializer = RegionDetectionResponseSerializer(data=region_data)
            if response_serializer.is_valid():
                return Response({
                    'status': 'success',
                    'data': response_serializer.validated_data
                })

            return Response({
                'status': 'error',
                'message': 'Failed to serialize response'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as e:
            logger.error(f"Region detection error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to detect region'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _detect_region_from_data(self, data):
        """Internal method to detect region from various data sources"""

        # Method 1: Venue-based detection (highest confidence)
        if 'venue_id' in data:
            try:
                venue = Venue.objects.get(id=data['venue_id'])
                if venue.latitude and venue.longitude:
                    region_data = self._detect_region_from_coordinates(
                        float(venue.latitude), float(venue.longitude)
                    )
                    region_data['detection_method'] = 'venue'
                    region_data['confidence_score'] = 0.95
                    region_data['notes'] = f"Detected from venue: {venue.name}"
                    return region_data
                else:
                    # Fall back to venue address-based detection
                    return self._detect_region_from_address(venue.address, venue.country)
            except Venue.DoesNotExist:
                pass

        # Method 2: Coordinates-based detection (high confidence)
        if 'lat' in data and 'lng' in data:
            region_data = self._detect_region_from_coordinates(
                float(data['lat']), float(data['lng'])
            )
            region_data['detection_method'] = 'coordinates'
            return region_data

        # Method 3: IP-based detection (medium confidence)
        if 'ip_address' in data:
            region_data = self._detect_region_from_ip(data['ip_address'])
            region_data['detection_method'] = 'ip_geolocation'
            return region_data

        # Fallback: Default region
        return self._get_fallback_region()

    def _detect_region_from_coordinates(self, lat, lng):
        """Detect region from GPS coordinates using geocoding"""
        try:
            # Use reverse geocoding to determine country
            # This is a simplified implementation - in production, use proper geocoding service

            # UK boundaries (approximate)
            if 49.5 <= lat <= 61.0 and -8.5 <= lng <= 2.0:
                regulation = WorkingHoursRegulation.objects.for_country('GB')
                return {
                    'region_code': 'UK',
                    'country_code': 'GB',
                    'confidence_score': 0.9,
                    'regulation_id': regulation.id if regulation else None,
                    'notes': 'Detected within UK boundaries'
                }

            # US boundaries (approximate)
            elif 24.0 <= lat <= 71.0 and -179.0 <= lng <= -66.0:
                # Simplified state detection - in practice, use proper geocoding
                regulation = WorkingHoursRegulation.objects.for_country('US')
                return {
                    'region_code': 'US-DEFAULT',
                    'country_code': 'US',
                    'confidence_score': 0.85,
                    'regulation_id': regulation.id if regulation else None,
                    'notes': 'Detected within US boundaries, specific state detection requires geocoding service'
                }

            # EU boundaries (simplified - France example)
            elif 41.0 <= lat <= 51.0 and -5.0 <= lng <= 10.0:
                regulation = WorkingHoursRegulation.objects.for_country('FR')
                return {
                    'region_code': 'EU-FR',
                    'country_code': 'FR',
                    'confidence_score': 0.85,
                    'regulation_id': regulation.id if regulation else None,
                    'notes': 'Detected within European boundaries (France approximation)'
                }

            # Default fallback
            return self._get_fallback_region()

        except Exception as e:
            logger.warning(f"Coordinate detection failed: {str(e)}")
            return self._get_fallback_region()

    def _detect_region_from_ip(self, ip_address):
        """Detect region from IP address using IP geolocation"""
        try:
            # Check if it's a private IP
            ip_obj = ipaddress.ip_address(ip_address)
            if ip_obj.is_private:
                return self._get_fallback_region()

            # Use a simple IP geolocation service (in production, use proper service)
            # This is a placeholder implementation
            cache_key = f"ip_geo:{ip_address}"
            cached_result = cache.get(cache_key)

            if cached_result:
                return cached_result

            # Simplified country detection based on IP ranges
            # In practice, use services like MaxMind, IPinfo, etc.
            result = {
                'region_code': 'UNKNOWN',
                'country_code': 'UNKNOWN',
                'confidence_score': 0.6,
                'regulation_id': None,
                'notes': 'IP-based detection requires external geolocation service'
            }

            # Cache result for 1 hour
            cache.set(cache_key, result, 3600)
            return result

        except Exception as e:
            logger.warning(f"IP detection failed: {str(e)}")
            return self._get_fallback_region()

    def _detect_region_from_address(self, address, country):
        """Detect region from venue address"""
        try:
            # Map country names to region codes
            country_mapping = {
                'United Kingdom': 'UK',
                'UK': 'UK',
                'United States': 'US-DEFAULT',
                'USA': 'US-DEFAULT',
                'US': 'US-DEFAULT',
                'France': 'EU-FR',
                'Germany': 'EU-DE',
                'Spain': 'EU-ES',
            }

            region_code = country_mapping.get(country, 'UNKNOWN')
            country_code = region_code.split('-')[0] if '-' in region_code else region_code

            regulation = WorkingHoursRegulation.objects.for_country(country_code)

            return {
                'region_code': region_code,
                'country_code': country_code,
                'confidence_score': 0.8,
                'regulation_id': regulation.id if regulation else None,
                'notes': f'Detected from venue address in {country}'
            }

        except Exception as e:
            logger.warning(f"Address detection failed: {str(e)}")
            return self._get_fallback_region()

    def _get_fallback_region(self):
        """Return default/fallback region when detection fails"""
        # Default to UK regulations as fallback
        uk_regulation = WorkingHoursRegulation.objects.for_country('GB')
        return {
            'region_code': 'UK',
            'country_code': 'GB',
            'confidence_score': 0.5,
            'detection_method': 'fallback',
            'regulation_id': uk_regulation.id if uk_regulation else None,
            'notes': 'Fallback to UK regulations - manual verification recommended'
        }

    @action(detail=False, methods=['post'], url_path='profiles/apply-preset')
    def apply_preset(self, request):
        """
        Apply regional preset to compliance profile.

        POST /api/compliance/profiles/apply-preset/
        Body: {region_code, profile_id, override_existing}
        """
        try:
            serializer = PresetApplicationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid data',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data

            # Apply preset logic
            result = self._apply_regional_preset(
                data['region_code'],
                data['profile_id'],
                data.get('override_existing', False),
                request.user
            )

            return Response({
                'status': 'success',
                'data': result
            })

        except Exception as e:
            logger.error(f"Preset application error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to apply preset'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _apply_regional_preset(self, region_code, profile_id, override_existing, user):
        """Apply regional compliance preset to profile"""
        try:
            # Get the compliance profile
            profile = ComplianceProfile.objects.get(id=profile_id)

            # Get the regulation for the region
            country_code = region_code.split('-')[0]
            regulation = WorkingHoursRegulation.objects.for_country(country_code)

            if not regulation:
                raise ValueError(f"No regulation found for region: {region_code}")

            applied_settings = {}
            warnings = []

            # Apply basic settings
            if override_existing or not profile.max_daily_hours_override:
                profile.max_daily_hours_override = regulation.max_daily_hours
                applied_settings['max_daily_hours'] = float(regulation.max_daily_hours)

            if override_existing or not profile.max_weekly_hours_override:
                profile.max_weekly_hours_override = regulation.max_weekly_hours
                applied_settings['max_weekly_hours'] = float(regulation.max_weekly_hours)

            if override_existing or not profile.min_rest_hours_override:
                profile.min_rest_hours_override = regulation.min_rest_between_shifts_hours
                applied_settings['min_rest_hours'] = float(regulation.min_rest_between_shifts_hours)

            # Apply region-specific settings
            if region_code == 'UK':
                # UK-specific SIA requirements
                if regulation.security_sector_overrides:
                    sia_required = regulation.security_sector_overrides.get('sia_license_required', True)
                    applied_settings['sia_license_required'] = sia_required

                # Working time opt-out provisions
                if regulation.opt_out_provisions:
                    applied_settings['opt_out_provisions'] = regulation.opt_out_provisions
                    if not regulation.opt_out_provisions.get('enabled'):
                        warnings.append("Working time directive opt-out not available in this jurisdiction")

            elif region_code.startswith('US-'):
                # US state-specific settings
                if regulation.state_overrides:
                    state_code = region_code.split('-')[1] if '-' in region_code else 'DEFAULT'
                    state_rules = regulation.state_overrides.get(state_code, {})
                    applied_settings['state_specific_rules'] = state_rules

                # FLSA overtime rules
                if regulation.overtime_threshold_hours:
                    applied_settings['overtime_threshold'] = float(regulation.overtime_threshold_hours)
                    applied_settings['overtime_multiplier'] = float(regulation.overtime_multiplier_1)

            elif region_code.startswith('EU-'):
                # EU Working Time Directive compliance
                applied_settings['eu_working_time_directive'] = True
                if regulation.break_requirements:
                    applied_settings['break_requirements'] = regulation.break_requirements

            # Update profile
            profile.working_hours_regulation = regulation
            profile.save()

            return {
                'success': True,
                'profile_id': profile_id,
                'region_code': region_code,
                'applied_settings': applied_settings,
                'warnings': warnings
            }

        except ComplianceProfile.DoesNotExist:
            raise ValueError(f"Compliance profile {profile_id} not found")
        except Exception as e:
            logger.error(f"Preset application failed: {str(e)}")
            raise

    @action(detail=False, methods=['get'], url_path='compare')
    def compare_regulations(self, request):
        """
        Compare regulations across multiple regions.

        GET /api/compliance/regulations/compare/
        Parameters: regions[] (list), include_sia_requirements, include_break_rules, include_overtime
        """
        try:
            # Convert query params to proper format for serializer
            regions = request.query_params.getlist('regions[]')
            if not regions:
                regions = request.query_params.getlist('regions')

            data = {
                'regions': regions,
                'include_sia_requirements': request.query_params.get('include_sia_requirements', 'true').lower() == 'true',
                'include_break_rules': request.query_params.get('include_break_rules', 'true').lower() == 'true',
                'include_overtime': request.query_params.get('include_overtime', 'true').lower() == 'true',
            }

            serializer = RegulationComparisonSerializer(data=data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid parameters',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            validated_data = serializer.validated_data

            # Generate comparison
            comparison = self._generate_regulation_comparison(validated_data)

            return Response({
                'status': 'success',
                'data': comparison
            })

        except Exception as e:
            logger.error(f"Regulation comparison error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to compare regulations'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _generate_regulation_comparison(self, data):
        """Generate detailed comparison of regulations across regions"""
        regions = data['regions']
        include_sia = data['include_sia_requirements']
        include_breaks = data['include_break_rules']
        include_overtime = data['include_overtime']

        comparison_matrix = {}
        key_differences = []
        sia_requirements = {}
        opt_out_provisions = {}

        for region in regions:
            country_code = region.split('-')[0]
            regulation = WorkingHoursRegulation.objects.for_country(country_code)

            if not regulation:
                comparison_matrix[region] = {'error': 'Regulation not found'}
                continue

            region_data = {
                'standard_weekly_hours': float(regulation.standard_weekly_hours),
                'max_daily_hours': float(regulation.max_daily_hours),
                'max_weekly_hours': float(regulation.max_weekly_hours),
                'min_rest_hours': float(regulation.min_rest_between_shifts_hours),
                'break_duration_minutes': regulation.break_duration_minutes,
                'break_trigger_hours': float(regulation.break_trigger_hours),
            }

            if include_overtime and regulation.overtime_threshold_hours:
                region_data['overtime_threshold'] = float(regulation.overtime_threshold_hours)
                region_data['overtime_multiplier'] = float(regulation.overtime_multiplier_1)

            if include_breaks and regulation.break_requirements:
                region_data['detailed_break_rules'] = regulation.break_requirements

            comparison_matrix[region] = region_data

            # SIA requirements
            if include_sia and regulation.security_sector_overrides:
                sia_requirements[region] = regulation.security_sector_overrides

            # Opt-out provisions
            if regulation.opt_out_provisions:
                opt_out_provisions[region] = regulation.opt_out_provisions

        # Generate key differences
        key_differences = self._identify_key_differences(comparison_matrix)

        return {
            'comparison_matrix': comparison_matrix,
            'key_differences': key_differences,
            'sia_requirements': sia_requirements if include_sia else None,
            'opt_out_provisions': opt_out_provisions,
            'generated_at': timezone.now().isoformat()
        }

    def _identify_key_differences(self, comparison_matrix):
        """Identify major differences between regulations"""
        differences = []

        # Get all valid regions (exclude error entries)
        valid_regions = {k: v for k, v in comparison_matrix.items() if 'error' not in v}

        if len(valid_regions) < 2:
            return ["Insufficient valid regions for comparison"]

        region_names = list(valid_regions.keys())

        # Compare weekly hours
        weekly_hours = [valid_regions[r]['standard_weekly_hours'] for r in region_names]
        if max(weekly_hours) - min(weekly_hours) > 5:
            differences.append(f"Standard weekly hours vary significantly: {min(weekly_hours)}-{max(weekly_hours)} hours")

        # Compare daily limits
        daily_limits = [valid_regions[r]['max_daily_hours'] for r in region_names]
        if max(daily_limits) - min(daily_limits) > 2:
            differences.append(f"Maximum daily hours differ: {min(daily_limits)}-{max(daily_limits)} hours")

        # Compare rest periods
        rest_periods = [valid_regions[r]['min_rest_hours'] for r in region_names]
        if max(rest_periods) - min(rest_periods) > 2:
            differences.append(f"Minimum rest periods vary: {min(rest_periods)}-{max(rest_periods)} hours")

        # Compare overtime rules
        overtime_regions = [r for r in region_names if 'overtime_threshold' in valid_regions[r]]
        if len(overtime_regions) != len(region_names):
            differences.append("Overtime regulations not consistent across all regions")

        return differences

    @action(detail=False, methods=['post'], url_path='validate-schedule')
    def validate_schedule(self, request):
        """
        Pre-validate shift schedules against regional rules.

        POST /api/compliance/validate-schedule/
        Body: {user_id, shifts[], venue_id?, validation_date?}
        """
        try:
            serializer = ScheduleValidationSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid data',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data

            # Validate schedule
            validation_result = self._validate_shift_schedule(data, request.user)

            return Response({
                'status': 'success',
                'data': validation_result
            })

        except Exception as e:
            logger.error(f"Schedule validation error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to validate schedule'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _validate_shift_schedule(self, data, requesting_user):
        """Validate shift schedule against compliance rules"""
        user_id = data['user_id']
        shifts = data['shifts']
        venue_id = data.get('venue_id')
        validation_date = data.get('validation_date', timezone.now().date())

        violations = []
        warnings = []
        total_hours = Decimal('0.00')
        overtime_hours = Decimal('0.00')

        try:
            # Get user and their compliance profile
            user = User.objects.get(id=user_id)

            # Get compliance profile (create default if doesn't exist)
            profile, created = ComplianceProfile.objects.get_or_create(
                user=user,
                defaults={'working_hours_regulation': WorkingHoursRegulation.objects.for_country('GB')}
            )

            regulation = profile.working_hours_regulation
            if not regulation:
                raise ValueError("No working hours regulation available")

            # Convert shift data to proper format and validate
            for i, shift_data in enumerate(shifts):
                try:
                    start_time = timezone.datetime.fromisoformat(shift_data['start'].replace('Z', '+00:00'))
                    end_time = timezone.datetime.fromisoformat(shift_data['end'].replace('Z', '+00:00'))

                    shift_duration = (end_time - start_time).total_seconds() / 3600
                    total_hours += Decimal(str(shift_duration))

                    # Validate shift duration against daily limits
                    max_daily = float(profile.get_max_daily_hours())
                    if shift_duration > max_daily:
                        violations.append({
                            'type': 'max_daily_hours_exceeded',
                            'shift_index': i,
                            'message': f'Shift {i+1} duration ({shift_duration:.1f}h) exceeds daily limit ({max_daily}h)',
                            'severity': 'high',
                            'shift_data': shift_data
                        })

                    # Check break requirements
                    if shift_duration >= float(regulation.break_trigger_hours):
                        required_break = regulation.break_duration_minutes
                        if 'break_minutes' not in shift_data or shift_data['break_minutes'] < required_break:
                            violations.append({
                                'type': 'insufficient_break',
                                'shift_index': i,
                                'message': f'Shift {i+1} requires {required_break} minute break',
                                'severity': 'medium',
                                'shift_data': shift_data
                            })

                except (ValueError, KeyError) as e:
                    violations.append({
                        'type': 'invalid_shift_data',
                        'shift_index': i,
                        'message': f'Shift {i+1} has invalid data: {str(e)}',
                        'severity': 'high',
                        'shift_data': shift_data
                    })

            # Validate weekly hours and overtime
            max_weekly = float(profile.get_max_weekly_hours())
            if total_hours > max_weekly:
                overtime_threshold = regulation.overtime_threshold_hours
                if overtime_threshold:
                    overtime_hours = max(Decimal('0'), total_hours - Decimal(str(float(overtime_threshold))))
                    if overtime_hours > 0:
                        warnings.append(f"Schedule includes {overtime_hours:.1f} hours of overtime")

                violations.append({
                    'type': 'max_weekly_hours_exceeded',
                    'message': f'Total hours ({total_hours:.1f}h) exceed weekly limit ({max_weekly}h)',
                    'severity': 'high'
                })

            # Check consecutive days if shift dates available
            # This would require more sophisticated date handling

            # SIA license validation for UK
            if regulation.country_code == 'GB' and regulation.security_sector_overrides:
                if regulation.security_sector_overrides.get('sia_license_required', False):
                    # Check if user has valid SIA license
                    valid_sia = SIALicense.objects.filter(
                        staff_profile__user=user,
                        expiry_date__gt=validation_date,
                        is_active=True
                    ).exists()

                    if not valid_sia:
                        violations.append({
                            'type': 'sia_license_required',
                            'message': 'Valid SIA license required for security work',
                            'severity': 'critical'
                        })

            return {
                'is_compliant': len([v for v in violations if v['severity'] in ['high', 'critical']]) == 0,
                'violations': violations,
                'warnings': warnings,
                'total_hours': total_hours,
                'overtime_hours': overtime_hours,
                'regulation_applied': f"{regulation.country_name} ({regulation.country_code})"
            }

        except User.DoesNotExist:
            raise ValueError(f"User {user_id} not found")
        except Exception as e:
            logger.error(f"Schedule validation failed: {str(e)}")
            raise

    @action(detail=False, methods=['get', 'post', 'put'], url_path='regional-settings')
    def regional_settings(self, request):
        """
        CRUD operations for venue-specific and staff-specific regional settings.

        GET/POST/PUT /api/compliance/regional-settings/
        Supports inheritance: Global → Regional → Venue → Staff
        """
        if request.method == 'GET':
            return self._get_regional_settings(request)
        elif request.method == 'POST':
            return self._create_regional_settings(request)
        elif request.method == 'PUT':
            return self._update_regional_settings(request)

    def _get_regional_settings(self, request):
        """Get regional settings with inheritance resolution"""
        try:
            venue_id = request.query_params.get('venue_id')
            staff_id = request.query_params.get('staff_id')
            region_code = request.query_params.get('region_code')

            # This is a simplified implementation
            # In practice, you'd have a RegionalSettings model

            settings = {
                'venue_id': venue_id,
                'staff_id': staff_id,
                'region_code': region_code or 'UK',
                'effective_settings': {
                    'max_daily_hours': 12,
                    'max_weekly_hours': 48,
                    'sia_license_required': True,
                    'break_requirements': {
                        '6_hours': {'duration_minutes': 20, 'paid': False},
                        '8_hours': {'duration_minutes': 30, 'paid': False}
                    }
                },
                'inheritance_chain': ['Global', 'Regional', 'Venue', 'Staff'],
                'created_at': timezone.now(),
                'updated_at': timezone.now()
            }

            return Response({
                'status': 'success',
                'data': settings
            })

        except Exception as e:
            logger.error(f"Regional settings retrieval error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to retrieve regional settings'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _create_regional_settings(self, request):
        """Create new regional settings override"""
        try:
            serializer = RegionalSettingsSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid data',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # Implementation would create RegionalSettings record
            # For now, return success response

            return Response({
                'status': 'success',
                'message': 'Regional settings created successfully',
                'data': {'id': 1, **serializer.validated_data}
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Regional settings creation error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to create regional settings'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _update_regional_settings(self, request):
        """Update existing regional settings"""
        try:
            serializer = RegionalSettingsSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid data',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # Implementation would update RegionalSettings record

            return Response({
                'status': 'success',
                'message': 'Regional settings updated successfully',
                'data': serializer.validated_data
            })

        except Exception as e:
            logger.error(f"Regional settings update error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to update regional settings'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# REPORTING SYSTEM VIEWSETS
# =============================================================================

class ReportTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing report templates.

    SECURITY: Only admin users can create/update/delete templates.
    Templates with sql_query fields are restricted to prevent SQL injection.
    """

    queryset = ReportTemplate.objects.all()
    serializer_class = ReportTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Restrict create/update/delete to admin users only"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]

    def get_queryset(self):
        """Filter templates based on user permissions"""
        user = self.request.user
        queryset = super().get_queryset()

        # Admin can see all templates
        if user.role == 'admin':
            return queryset

        # Filter by allowed roles and venues
        queryset = queryset.filter(
            is_active=True,
            allowed_roles__contains=[user.role]
        )

        # Filter by allowed venues if user has venue restrictions
        if hasattr(user, 'profile') and user.profile:
            user_venues = user.profile.preferred_venues.all()
            if user_venues.exists():
                venue_ids = [venue.id for venue in user_venues]
                queryset = queryset.filter(
                    models.Q(allowed_venues__in=venue_ids) |
                    models.Q(allowed_venues__isnull=True)  # Templates without venue restrictions
                )

        return queryset.distinct()

    def perform_create(self, serializer):
        """Set the created_by field when creating templates"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def test_query(self, request, pk=None):
        """Test a template's SQL query with sample parameters"""
        template = self.get_object()

        try:
            from .utils.report_generator import ReportGenerator

            # Use the enhanced validation
            validation_result = ReportGenerator.validate_template(template)

            if not validation_result['valid']:
                return Response({
                    'status': 'error',
                    'message': 'Query validation failed',
                    'errors': validation_result['errors'],
                    'warnings': validation_result['warnings']
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'status': 'success',
                'message': 'Query validation passed',
                'validation': validation_result,
                'estimated_performance': validation_result['estimated_performance']
            })

        except Exception as e:
            logger.exception("Template query test error")
            return Response({
                'status': 'error',
                'message': 'Query test failed due to an internal error'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """Generate a preview of the report with sample data"""
        template = self.get_object()

        try:
            from .utils.report_generator import ReportGenerator
            from datetime import datetime, timedelta
            from django.utils import timezone

            # Get parameters from request or use defaults
            parameters = request.data.get('parameters', {})

            # Set default date range if not provided
            if 'date_range_start' not in parameters:
                parameters['date_range_start'] = timezone.now() - timedelta(days=30)
            if 'date_range_end' not in parameters:
                parameters['date_range_end'] = timezone.now()

            parameters['user'] = request.user

            # Get preview limit from request
            limit = request.data.get('limit', 100)

            preview_data = ReportGenerator.generate_preview(
                template,
                parameters,
                limit=limit
            )

            return Response({
                'status': 'success',
                'preview': preview_data,
                'template_name': template.name,
                'template_type': template.template_type
            })

        except Exception as e:
            logger.exception("Report preview generation error")
            return Response({
                'status': 'error',
                'message': 'Preview generation failed due to an internal error'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Validate template configuration and SQL query"""
        template = self.get_object()

        try:
            from .utils.report_generator import ReportGenerator

            validation_results = ReportGenerator.validate_template(template)

            return Response({
                'status': 'success',
                'validation': validation_results
            })

        except Exception as e:
            logger.exception("Template validation error")
            return Response({
                'status': 'error',
                'message': 'Validation failed due to an internal error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportJobViewSet(viewsets.ModelViewSet):
    """ViewSet for managing report jobs"""

    queryset = ReportJob.objects.all()
    permission_classes = [IsAuthenticated]
    pagination_class = CustomPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'export_format', 'template']

    def get_queryset(self):
        """Filter jobs based on user permissions and query parameters"""
        user = self.request.user
        queryset = super().get_queryset()

        # Admin can see all jobs, users can only see their own jobs
        if hasattr(user, 'role') and user.role == 'admin':
            filtered_queryset = queryset
        else:
            filtered_queryset = queryset.filter(requested_by=user)

        # Handle custom export_format parameter
        export_format = self.request.query_params.get('export_format')
        if export_format:
            filtered_queryset = filtered_queryset.filter(export_format=export_format)

        return filtered_queryset.order_by('-created_at')

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return ReportJobCreateSerializer
        elif self.action in ['status', 'progress']:
            return ReportJobStatusSerializer
        return ReportJobSerializer

    def perform_create(self, serializer):
        """Create a new report job"""
        from django.utils import timezone
        from datetime import timedelta

        # Set default expiry if not provided (7 days from now)
        if not serializer.validated_data.get('expires_at'):
            expires_at = timezone.now() + timedelta(days=7)
            serializer.validated_data['expires_at'] = expires_at

        # Save with the requesting user
        job = serializer.save(requested_by=self.request.user)

        # TODO: Queue the job for background processing
        # For now, we'll just set it to pending
        logger.info(f"Report job {job.job_id} created by user {self.request.user.id}")

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get the current status of a report job"""
        job = self.get_object()
        serializer = ReportJobStatusSerializer(job)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download the generated report file"""
        job = self.get_object()

        if job.status != 'completed':
            return Response({
                'status': 'error',
                'message': 'Report is not ready for download'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not job.file_path or not os.path.exists(job.file_path):
            return Response({
                'status': 'error',
                'message': 'Report file not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if report has expired
        from django.utils import timezone
        if timezone.now() > job.expires_at:
            return Response({
                'status': 'error',
                'message': 'Report has expired'
            }, status=status.HTTP_410_GONE)

        try:
            # Increment download count
            job.download_count += 1
            job.save(update_fields=['download_count'])

            # Return file download response
            from django.http import FileResponse
            response = FileResponse(
                open(job.file_path, 'rb'),
                as_attachment=True,
                filename=f"{job.template.name}_{job.job_id}.{job.export_format}"
            )
            return response

        except Exception as e:
            logger.error(f"Report download error: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to download report'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending or processing report job"""
        job = self.get_object()

        if job.status in ['completed', 'failed', 'cancelled']:
            return Response({
                'status': 'error',
                'message': f'Cannot cancel job with status: {job.status}'
            }, status=status.HTTP_400_BAD_REQUEST)

        job.status = 'cancelled'
        job.save(update_fields=['status'])

        logger.info(f"Report job {job.job_id} cancelled by user {request.user.id}")

        return Response({
            'status': 'success',
            'message': 'Report job cancelled successfully'
        })

    @action(detail=False, methods=['post'])
    def generate_report(self, request):
        """Generate a report immediately (synchronous operation for CSV/JSON)"""
        serializer = ReportJobCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        template = serializer.validated_data['template']
        export_format = serializer.validated_data['export_format']
        parameters = serializer.validated_data.get('parameters', {})

        # For CSV and JSON, we can generate synchronously
        if export_format in ['csv', 'json']:
            try:
                from .utils.report_generator import ReportGenerator

                # Generate the report using ReportGenerator
                generator = ReportGenerator(
                    template=template,
                    parameters=parameters,
                    export_format=export_format
                )

                result = generator.generate()

                return Response({
                    'status': 'success',
                    'data': {
                        'message': 'Report generated successfully',
                        'format': export_format,
                        'template': template.name,
                        'rows': result.get('row_count', 0),
                        'file_path': result.get('file_path'),
                        'data': result.get('data') if export_format == 'json' else None
                    }
                })

            except Exception as e:
                logger.exception("Synchronous report generation error")
                return Response({
                    'status': 'error',
                    'message': 'Failed to generate report due to an internal error'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        else:
            # For Excel/PDF, create a job for async processing
            job = serializer.save(requested_by=request.user)
            return Response({
                'status': 'success',
                'message': 'Report job created',
                'job_id': job.job_id
            }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def my_jobs(self, request):
        """Get current user's report jobs"""
        jobs = self.get_queryset().filter(requested_by=request.user)[:20]
        serializer = ReportJobStatusSerializer(jobs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get dashboard summary statistics"""
        from django.utils import timezone
        from datetime import timedelta

        user_jobs = self.get_queryset().filter(requested_by=request.user)

        # Calculate date ranges
        now = timezone.now()
        last_week = now - timedelta(days=7)
        last_month = now - timedelta(days=30)

        # Basic counts
        total_jobs = user_jobs.count()
        active_jobs = user_jobs.filter(status__in=['pending', 'processing']).count()
        completed_jobs = user_jobs.filter(status='completed').count()
        failed_jobs = user_jobs.filter(status='failed').count()

        # Recent activity
        recent_jobs = user_jobs.filter(created_at__gte=last_week).count()
        this_month_jobs = user_jobs.filter(created_at__gte=last_month).count()

        # Success rate
        processed_jobs = completed_jobs + failed_jobs
        success_rate = (completed_jobs / processed_jobs * 100) if processed_jobs > 0 else 0

        return Response({
            'total_jobs': total_jobs,
            'active_jobs': active_jobs,
            'completed_jobs': completed_jobs,
            'failed_jobs': failed_jobs,
            'recent_jobs': recent_jobs,
            'this_month_jobs': this_month_jobs,
            'success_rate': round(success_rate, 1),
            'recent_activity': user_jobs.order_by('-created_at')[:5].values(
                'job_id', 'template__name', 'status', 'created_at', 'export_format'
            )
        })

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """Get report metrics and performance data"""
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Count, Avg

        # Get period parameter (default 7d)
        period = request.query_params.get('period', '7d')

        # Calculate date range based on period
        now = timezone.now()
        if period == '30d':
            start_date = now - timedelta(days=30)
        elif period == '90d':
            start_date = now - timedelta(days=90)
        else:  # Default to 7d
            start_date = now - timedelta(days=7)

        user_jobs = self.get_queryset().filter(
            requested_by=request.user,
            created_at__gte=start_date
        )

        # Performance metrics
        total_jobs_period = user_jobs.count()
        completed_jobs_period = user_jobs.filter(status='completed').count()
        failed_jobs_period = user_jobs.filter(status='failed').count()
        cancelled_jobs_period = user_jobs.filter(status='cancelled').count()

        # Success rate for period
        processed_jobs_period = completed_jobs_period + failed_jobs_period
        success_rate_period = (completed_jobs_period / processed_jobs_period * 100) if processed_jobs_period > 0 else 0

        # Average processing time for completed jobs (in seconds)
        completed_jobs_with_time = user_jobs.filter(
            status='completed',
            completed_at__isnull=False
        )

        avg_processing_time = 0
        if completed_jobs_with_time.exists():
            processing_times = []
            for job in completed_jobs_with_time:
                if job.completed_at and job.created_at:
                    processing_time = (job.completed_at - job.created_at).total_seconds()
                    processing_times.append(processing_time)

            if processing_times:
                avg_processing_time = sum(processing_times) / len(processing_times)

        # Jobs by format
        format_breakdown = user_jobs.values('export_format').annotate(
            count=Count('id')
        ).order_by('-count')

        # Jobs by status over time (daily for the period)
        daily_stats = []
        for i in range((now.date() - start_date.date()).days + 1):
            date = start_date.date() + timedelta(days=i)
            day_jobs = user_jobs.filter(created_at__date=date)

            daily_stats.append({
                'date': date.isoformat(),
                'total': day_jobs.count(),
                'completed': day_jobs.filter(status='completed').count(),
                'failed': day_jobs.filter(status='failed').count(),
                'cancelled': day_jobs.filter(status='cancelled').count(),
            })

        return Response({
            'period': period,
            'total_jobs': total_jobs_period,
            'completed_jobs': completed_jobs_period,
            'failed_jobs': failed_jobs_period,
            'cancelled_jobs': cancelled_jobs_period,
            'success_rate': round(success_rate_period, 1),
            'avg_processing_time': round(avg_processing_time, 2),
            'format_breakdown': list(format_breakdown),
            'daily_stats': daily_stats,
            'most_recent_job': user_jobs.order_by('-created_at').first().job_id if user_jobs.exists() else None
        })

    @action(detail=False, methods=['get'])
    def types(self, request):
        """Get available report types/templates"""
        # Get available templates based on user permissions
        user = self.request.user
        templates_queryset = ReportTemplate.objects.filter(is_active=True)

        # Admin can see all templates
        if user.role != 'admin':
            templates_queryset = templates_queryset.filter(
                allowed_roles__contains=[user.role]
            )

        # Convert templates to the expected format
        report_types = []
        for template in templates_queryset:
            report_types.append({
                'id': str(template.id),
                'name': template.name,
                'description': template.description or f"Generate {template.name} report"
            })

        return Response(report_types)

    @action(detail=False, methods=['post'])
    def bulk_generate(self, request):
        """Generate multiple reports in bulk"""
        if not isinstance(request.data, list):
            return Response({
                'status': 'error',
                'message': 'Expected a list of report configurations'
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(request.data) > 10:  # Limit bulk operations
            return Response({
                'status': 'error',
                'message': 'Maximum 10 reports can be generated in bulk'
            }, status=status.HTTP_400_BAD_REQUEST)

        results = []
        errors = []

        for i, report_config in enumerate(request.data):
            try:
                serializer = ReportJobCreateSerializer(data=report_config)
                if not serializer.is_valid():
                    errors.append({
                        'index': i,
                        'errors': serializer.errors
                    })
                    continue

                # Create the job
                job = serializer.save(requested_by=request.user)
                results.append({
                    'index': i,
                    'job_id': job.job_id,
                    'template_name': job.template.name,
                    'export_format': job.export_format,
                    'status': job.status
                })

                logger.info(f"Bulk report job {job.job_id} created by user {request.user.id}")

            except Exception as e:
                logger.exception(f"Bulk report generation error at index {i}")
                errors.append({
                    'index': i,
                    'error': 'Failed to create report job due to an internal error'
                })

        return Response({
            'status': 'success' if not errors else 'partial_success',
            'created_jobs': len(results),
            'total_requested': len(request.data),
            'results': results,
            'errors': errors
        })


class ExportViewSet(viewsets.ViewSet):
    """ViewSet for handling various export operations"""

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def formats(self, request):
        """Get available export formats and their capabilities"""
        formats = {
            'csv': {
                'name': 'CSV (Comma Separated Values)',
                'extension': 'csv',
                'mime_type': 'text/csv',
                'supports_charts': False,
                'supports_formatting': False,
                'max_rows': 1000000,
                'description': 'Simple tabular data format, best for data analysis'
            },
            'json': {
                'name': 'JSON (JavaScript Object Notation)',
                'extension': 'json',
                'mime_type': 'application/json',
                'supports_charts': False,
                'supports_formatting': False,
                'max_rows': 100000,
                'description': 'Structured data format, ideal for API consumption'
            },
            'excel': {
                'name': 'Excel Workbook',
                'extension': 'xlsx',
                'mime_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'supports_charts': True,
                'supports_formatting': True,
                'max_rows': 1048576,
                'description': 'Rich spreadsheet format with charts and formatting'
            },
            'pdf': {
                'name': 'PDF Document',
                'extension': 'pdf',
                'mime_type': 'application/pdf',
                'supports_charts': True,
                'supports_formatting': True,
                'max_rows': 50000,
                'description': 'Professional document format for reports and presentations'
            }
        }

        # Convert to the expected array format for frontend
        format_array = []
        for format_key, format_data in formats.items():
            format_array.append({
                'format': format_key,
                'name': format_data['name'],
                'description': format_data['description'],
                'fileExtension': format_data['extension'],
                'mimeType': format_data['mime_type'],
                'maxRows': format_data['max_rows'],
                'supportsCharts': format_data['supports_charts'],
                'supportsImages': format_data['supports_formatting'],  # Use formatting as proxy for images
                'supportsMultipleSheets': format_key == 'excel',  # Only Excel supports multiple sheets
                'supported': True,
                'options': [{
                    'key': 'max_rows',
                    'label': 'Maximum Rows',
                    'type': 'number',
                    'default': format_data['max_rows'],
                    'description': f'Maximum number of rows for {format_data["name"]}'
                }] if format_key != 'pdf' else []
            })

        return Response(format_array)

    @action(detail=False, methods=['post'])
    def convert(self, request):
        """Convert data from one format to another"""
        from .utils.report_generator import ReportGenerator

        source_format = request.data.get('source_format')
        target_format = request.data.get('target_format')
        data = request.data.get('data')

        if not all([source_format, target_format, data]):
            return Response({
                'status': 'error',
                'message': 'source_format, target_format, and data are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if source_format == target_format:
            return Response({
                'status': 'error',
                'message': 'Source and target formats cannot be the same'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Create a temporary template for conversion
            from django.utils import timezone
            temp_template_data = {
                'name': f'temp_conversion_{timezone.now().timestamp()}',
                'query': 'SELECT * FROM temp_data',
                'description': 'Temporary template for conversion'
            }

            # For simplicity, we'll create the generator directly with data
            generator = ReportGenerator(
                template=None,  # We'll handle this specially for conversion
                parameters={},
                export_format=target_format
            )

            # Override the data source for conversion
            result = generator._export_with_handler({
                'data': data,
                'columns': list(data[0].keys()) if data and isinstance(data, list) and data else [],
                'row_count': len(data) if isinstance(data, list) else 0,
                'query': 'Data conversion',
                'parameters': {}
            })

            return Response({
                'status': 'success',
                'message': f'Data converted from {source_format} to {target_format}',
                'result': result
            })

        except Exception as e:
            logger.exception("Export conversion error")
            return Response({
                'status': 'error',
                'message': 'Failed to convert data due to an internal error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def validate_data(self, request):
        """Validate data for export compatibility"""
        data = request.data.get('data')
        export_format = request.data.get('format', 'csv')

        if not data:
            return Response({
                'status': 'error',
                'message': 'Data is required for validation'
            }, status=status.HTTP_400_BAD_REQUEST)

        validation_results = {
            'valid': True,
            'warnings': [],
            'errors': [],
            'recommendations': []
        }

        try:
            # Basic data structure validation
            if not isinstance(data, list):
                validation_results['errors'].append('Data must be a list of objects')
                validation_results['valid'] = False
            elif not data:
                validation_results['warnings'].append('Data list is empty')
            else:
                # Check data consistency
                if not all(isinstance(row, dict) for row in data):
                    validation_results['errors'].append('All data rows must be objects')
                    validation_results['valid'] = False
                else:
                    # Check column consistency
                    if data:
                        first_keys = set(data[0].keys())
                        for i, row in enumerate(data[1:], 1):
                            row_keys = set(row.keys())
                            if row_keys != first_keys:
                                validation_results['warnings'].append(
                                    f'Row {i} has different columns than first row'
                                )

                    # Format-specific validations
                    row_count = len(data)
                    if export_format == 'pdf' and row_count > 50000:
                        validation_results['warnings'].append(
                            f'PDF format recommended for max 50,000 rows, got {row_count}'
                        )
                    elif export_format == 'json' and row_count > 100000:
                        validation_results['warnings'].append(
                            f'JSON format recommended for max 100,000 rows, got {row_count}'
                        )

                    # Check for special characters in CSV
                    if export_format == 'csv':
                        for i, row in enumerate(data[:10]):  # Check first 10 rows
                            for key, value in row.items():
                                if isinstance(value, str) and (',' in value or '\n' in value):
                                    validation_results['recommendations'].append(
                                        'Consider using quotes for CSV fields containing commas or newlines'
                                    )
                                    break

        except Exception as e:
            validation_results['errors'].append(f'Validation error: {str(e)}')
            validation_results['valid'] = False

        return Response({
            'status': 'success',
            'validation': validation_results
        })

    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Get available export templates with format compatibility"""
        from .models import ReportTemplate

        templates = ReportTemplate.objects.all()
        template_data = []

        for template in templates:
            # Determine supported formats based on template characteristics
            supported_formats = ['csv', 'json']  # All templates support these

            # Check if template is suitable for Excel/PDF
            if template.query and len(template.query) < 10000:  # Not too complex
                supported_formats.extend(['excel', 'pdf'])

            template_data.append({
                'id': template.id,
                'name': template.name,
                'description': template.description,
                'supported_formats': supported_formats,
                'parameters': template.parameters,
                'estimated_complexity': 'low' if len(template.query or '') < 1000 else 'medium',
                'created_at': template.created_at
            })

        return Response({
            'status': 'success',
            'templates': template_data
        })

# Force reload

class ReportMetricsViewSet(viewsets.ViewSet):
    """ViewSet for report generation metrics and analytics"""

    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Default metrics endpoint - redirect to summary"""
        return self.summary(request)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get report metrics for a specific time period"""
        from django.db.models import Count, Avg, Q, F
        from django.utils import timezone
        from datetime import timedelta
        import re

        # Get period parameter, default to 7 days
        period = request.query_params.get('period', '7d')

        # Parse period string (e.g., '7d', '30d', '90d', '1y')
        period_match = re.match(r'(\d+)([dmy])', period)
        if not period_match:
            return Response({
                'error': 'Invalid period format. Use format like "7d", "30d", "90d", or "1y"'
            }, status=status.HTTP_400_BAD_REQUEST)

        amount, unit = period_match.groups()
        amount = int(amount)

        # Calculate start date
        now = timezone.now()
        if unit == 'd':
            start_date = now - timedelta(days=amount)
        elif unit == 'm':
            start_date = now - timedelta(days=amount * 30)  # Approximate month as 30 days
        elif unit == 'y':
            start_date = now - timedelta(days=amount * 365)  # Approximate year as 365 days
        else:
            return Response({
                'error': 'Invalid period unit. Use "d" (days), "m" (months), or "y" (years)'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Base queryset for the period
        jobs_in_period = ReportJob.objects.filter(created_at__gte=start_date)

        # Filter by user permissions
        user = request.user
        if not user.is_authenticated:
            return Response({
                'error': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)

        # Check if user has role attribute and is admin
        user_role = getattr(user, 'role', 'staff')
        if user_role != 'admin':
            jobs_in_period = jobs_in_period.filter(requested_by=user)

        # Total reports generated
        total_reports = jobs_in_period.count()

        # Success/failure rates
        completed_jobs = jobs_in_period.filter(status='completed').count()
        failed_jobs = jobs_in_period.filter(status='failed').count()
        pending_jobs = jobs_in_period.filter(status='pending').count()
        processing_jobs = jobs_in_period.filter(status='processing').count()

        success_rate = (completed_jobs / total_reports * 100) if total_reports > 0 else 0
        failure_rate = (failed_jobs / total_reports * 100) if total_reports > 0 else 0

        # Average generation time (only for completed jobs)
        completed_with_times = jobs_in_period.filter(
            status='completed',
            started_at__isnull=False,
            completed_at__isnull=False
        )

        avg_generation_time = None
        if completed_with_times.exists():
            # Calculate average duration in seconds
            durations = []
            for job in completed_with_times:
                duration = (job.completed_at - job.started_at).total_seconds()
                durations.append(duration)

            if durations:
                avg_generation_time = sum(durations) / len(durations)

        # Popular report types
        popular_templates = (
            jobs_in_period
            .values('template__name', 'template__template_type')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )

        # Popular export formats
        popular_formats = (
            jobs_in_period
            .values('export_format')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        # Peak usage times (by hour of day)
        from django.db.models.functions import Extract
        usage_by_hour = (
            jobs_in_period
            .annotate(hour=Extract('created_at', 'hour'))
            .values('hour')
            .annotate(count=Count('id'))
            .order_by('hour')
        )

        # Usage trend over time (daily for periods <= 30 days, weekly for longer)
        if amount <= 30 and unit == 'd':
            # Daily trend
            trend_data = []
            current_date = start_date.date()
            end_date = now.date()

            while current_date <= end_date:
                day_jobs = jobs_in_period.filter(
                    created_at__date=current_date
                ).count()
                trend_data.append({
                    'date': current_date.isoformat(),
                    'count': day_jobs
                })
                current_date += timedelta(days=1)
        else:
            # Weekly trend
            trend_data = []
            current_week = start_date

            while current_week < now:
                week_end = min(current_week + timedelta(days=7), now)
                week_jobs = jobs_in_period.filter(
                    created_at__gte=current_week,
                    created_at__lt=week_end
                ).count()
                trend_data.append({
                    'date': current_week.date().isoformat(),
                    'count': week_jobs
                })
                current_week = week_end

        # File size statistics (for completed jobs with file size)
        file_size_stats = {}
        jobs_with_size = jobs_in_period.filter(
            status='completed',
            file_size__isnull=False,
            file_size__gt=0
        )

        if jobs_with_size.exists():
            file_sizes_mb = []
            for job in jobs_with_size:
                size_mb = job.file_size / (1024 * 1024)  # Convert bytes to MB
                file_sizes_mb.append(size_mb)

            if file_sizes_mb:
                file_size_stats = {
                    'avg_size_mb': sum(file_sizes_mb) / len(file_sizes_mb),
                    'min_size_mb': min(file_sizes_mb),
                    'max_size_mb': max(file_sizes_mb),
                    'total_size_mb': sum(file_sizes_mb)
                }

        # Most active users (admin only)
        user_activity = []
        if user_role == 'admin':
            user_activity = list(
                jobs_in_period
                .values('requested_by__username', 'requested_by__first_name', 'requested_by__last_name')
                .annotate(report_count=Count('id'))
                .order_by('-report_count')[:10]
            )

        return Response({
            'status': 'success',
            'period': period,
            'period_start': start_date.isoformat(),
            'period_end': now.isoformat(),
            'metrics': {
                'total_reports': total_reports,
                'status_breakdown': {
                    'completed': completed_jobs,
                    'failed': failed_jobs,
                    'pending': pending_jobs,
                    'processing': processing_jobs
                },
                'success_rate_percent': round(success_rate, 2),
                'failure_rate_percent': round(failure_rate, 2),
                'avg_generation_time_seconds': round(avg_generation_time, 2) if avg_generation_time else None,
                'popular_report_types': list(popular_templates),
                'popular_export_formats': [
                    {
                        'format': item['export_format'],
                        'count': item['count']
                    } for item in popular_formats
                ],
                'usage_by_hour': [
                    {
                        'hour': item['hour'],
                        'count': item['count']
                    } for item in usage_by_hour
                ],
                'usage_trend': trend_data,
                'file_size_stats': file_size_stats,
                'user_activity': user_activity if user_role == 'admin' else []
            }
        })

# Test endpoint added at Wed Sep 24 13:01:01 BST 2025


class ReportTypesViewSet(viewsets.ViewSet):
    """
    ViewSet for managing report types/templates.
    Provides a dedicated endpoint for retrieving available report types.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        Get available report types/templates based on user permissions.
        Returns report types that the authenticated user can access.
        """
        user = request.user

        # Get active templates based on user permissions
        templates_queryset = ReportTemplate.objects.filter(is_active=True)

        # Non-admin users can only see templates allowed for their role
        if user.role != 'admin':
            templates_queryset = templates_queryset.filter(
                allowed_roles__contains=[user.role]
            )

        # Filter by user's venue access if they have venue restrictions
        if hasattr(user, 'profile') and user.profile:
            user_venues = getattr(user.profile, 'preferred_venues', None)
            if user_venues and user_venues.exists():
                venue_ids = [venue.id for venue in user_venues.all()]
                templates_queryset = templates_queryset.filter(
                    models.Q(allowed_venues__in=venue_ids) |
                    models.Q(allowed_venues__isnull=True)  # Templates without venue restrictions
                ).distinct()

        # Convert templates to expected format
        report_types = []
        for template in templates_queryset.select_related('created_by'):
            report_types.append({
                'id': str(template.id),
                'name': template.name,
                'description': template.description or f"Generate {template.name} report",
                'category': template.template_type,
                'template_type': template.get_template_type_display(),
                'parameters': template.parameters,
                'created_by': template.created_by.get_full_name() if template.created_by else 'System',
                'created_at': template.created_at.isoformat(),
                'updated_at': template.updated_at.isoformat()
            })

        # Sort by name for consistent ordering
        report_types.sort(key=lambda x: x['name'])

        return Response({
            'count': len(report_types),
            'results': report_types
        })


# =====================================================
# ONBOARDING SYSTEM VIEWSETS
# =====================================================

class OnboardingViewSet(viewsets.ViewSet):
    """
    ViewSet for managing company onboarding process.
    Provides all 8 required endpoints for the onboarding wizard.
    """
    permission_classes = [IsAuthenticated, IsCompanyOwnerOrAdmin]

    def get_permissions(self):
        """
        Override permissions for specific actions.
        initiate_onboarding and get_progress only require IsAuthenticated since they handle
        users who don't have company memberships yet during the onboarding process.
        All other actions require IsCompanyOwnerOrAdmin.
        """
        if self.action in ['initiate_onboarding', 'get_progress']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated, IsCompanyOwnerOrAdmin]
        return [permission() for permission in permission_classes]

    def get_user_company(self, request):
        """Get the user's current company context.

        SECURITY: Prefers middleware-provided company context (respects X-Company-ID header)
        for multi-tenant isolation. Falls back to user's primary company.
        """
        # Prefer middleware-provided context (set by TenantMiddleware)
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company

        # Fallback: Get first company where user is owner/admin
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()

        return membership.company if membership else None

    @action(detail=False, methods=['post'], url_path='initiate')
    def initiate_onboarding(self, request):
        """
        POST /api/v1/onboarding/initiate/
        Start the onboarding process for a new company.
        """
        try:
            # Check if user already has a company with incomplete onboarding
            existing_membership = request.user.company_memberships.filter(
                is_active=True,
                is_owner=True
            ).select_related('company__onboarding').first()

            if existing_membership and hasattr(existing_membership.company, 'onboarding'):
                onboarding = existing_membership.company.onboarding
                if not onboarding.is_completed:
                    # Return existing onboarding
                    serializer = CompanyOnboardingSerializer(onboarding)
                    return Response({
                        'status': 'existing_onboarding_found',
                        'message': 'Continuing with existing onboarding process',
                        'onboarding': serializer.data
                    })
                else:
                    # User already has completed onboarding - they shouldn't be here
                    return Response({
                        'status': 'error',
                        'message': 'User already has completed company onboarding',
                        'redirect': '/dashboard'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Create new company and onboarding
            company_data = request.data.get('company', {})
            company_serializer = SecurityCompanySerializer(data=company_data, context={'request': request})
            
            if not company_serializer.is_valid():
                return Response({
                    'status': 'error',
                    'message': 'Invalid company data',
                    'errors': company_serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create company
            company = company_serializer.save(created_by=request.user)

            # Create user membership as owner
            UserCompanyMembership.objects.create(
                user=request.user,
                company=company,
                role='owner',
                is_owner=True,
                is_active=True
            )

            # Promote user to admin role now that they own a company
            request.user.role = 'admin'
            request.user.save(update_fields=['role'])

            # Create onboarding record
            onboarding = CompanyOnboarding.objects.create(
                company=company,
                session_id=request.session.session_key or str(uuid.uuid4())
            )

            # Mark Step 1 (company info) as completed since we just created the company
            onboarding.company_info_completed = True
            onboarding.current_step = 2  # Move to step 2
            onboarding.update_session_activity()
            onboarding.save()

            serializer = CompanyOnboardingSerializer(onboarding)
            return Response({
                'status': 'success',
                'message': 'Onboarding initiated successfully',
                'onboarding': serializer.data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error initiating onboarding: {str(e)}")
            return Response({
                'status': 'error',
                'message': 'Failed to initiate onboarding'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='progress')
    def get_progress(self, request):
        """
        GET /api/v1/onboarding/progress/
        Get current onboarding progress.
        For staff users, onboarding is automatically considered complete.
        """
        # Staff users don't need onboarding - they join existing companies
        if request.user.role == 'staff':
            return Response({
                'status': 'success',
                'onboarding': {
                    'current_step': 5,  # Final step
                    'total_steps': 5,
                    'is_completed': True,
                    'created_at': None,
                    'updated_at': None,
                    'session_id': None,
                    'time_spent_minutes': 0,
                    'last_step_accessed': 5,
                    'company_info_completed': True,
                    'staff_setup_completed': True,
                    'integrations_completed': True,
                    'regional_setup_completed': True,
                    'finalization_completed': True,
                    'step_data': {},
                    'validation_errors': {},
                    'estimated_time_remaining': 0,
                    'completed_at': None,
                    'completed_by': None,
                    'company': None
                }
            })

        # For admin/manager/owner users, check actual onboarding progress
        company = self.get_user_company(request)
        if not company:
            return Response({
                'status': 'error',
                'message': 'No company found or insufficient permissions'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            onboarding = company.onboarding
        except CompanyOnboarding.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Onboarding not found'
            }, status=status.HTTP_404_NOT_FOUND)

        onboarding.update_session_activity()
        serializer = CompanyOnboardingSerializer(onboarding)
        return Response({
            'status': 'success',
            'onboarding': serializer.data
        })

    @action(detail=False, methods=['put'], url_path='company-info')
    def save_company_info(self, request):
        """
        PUT /api/v1/onboarding/company-info/
        Save company information step.
        """
        company = self.get_user_company(request)
        if not company:
            return Response({
                'status': 'error',
                'message': 'No company found or insufficient permissions'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = CompanyInfoSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid company information',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update company with validated data
        validated_data = serializer.validated_data
        for field, value in validated_data.items():
            setattr(company, field, value)
        company.save()

        # Update onboarding progress
        onboarding = company.onboarding
        onboarding.step_data['company_info'] = validated_data
        onboarding.mark_step_completed(1)

        return Response({
            'status': 'success',
            'message': 'Company information saved successfully',
            'onboarding': CompanyOnboardingSerializer(onboarding).data
        })

    @action(detail=False, methods=['put'], url_path='regional-setup')
    def save_regional_setup(self, request):
        """
        PUT /api/v1/onboarding/regional-setup/
        Save regional compliance configuration.
        """
        company = self.get_user_company(request)
        if not company:
            return Response({
                'status': 'error',
                'message': 'No company found or insufficient permissions'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = RegionalSetupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid regional setup data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save regional setup data
        validated_data = serializer.validated_data
        onboarding = company.onboarding
        onboarding.step_data['regional_setup'] = validated_data
        onboarding.mark_step_completed(2)

        # TODO: Create compliance profile based on regional requirements
        # This would integrate with the compliance system

        return Response({
            'status': 'success',
            'message': 'Regional setup saved successfully',
            'onboarding': CompanyOnboardingSerializer(onboarding).data
        })

    @action(detail=False, methods=['put'], url_path='staff-config')
    def save_staff_config(self, request):
        """
        PUT /api/v1/onboarding/staff-config/
        Save staff operations configuration.
        """
        company = self.get_user_company(request)
        if not company:
            return Response({
                'status': 'error',
                'message': 'No company found or insufficient permissions'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = StaffConfigSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid staff configuration data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save staff configuration data
        validated_data = serializer.validated_data
        onboarding = company.onboarding
        onboarding.step_data['staff_config'] = validated_data
        onboarding.mark_step_completed(3)

        # Update company capacity based on expected staff count
        company.staff_capacity = max(company.staff_capacity, validated_data.get('expected_staff_count', 50))
        company.save()

        return Response({
            'status': 'success',
            'message': 'Staff configuration saved successfully',
            'onboarding': CompanyOnboardingSerializer(onboarding).data
        })

    @action(detail=False, methods=['put'], url_path='integrations')
    def save_integrations(self, request):
        """
        PUT /api/v1/onboarding/integrations/
        Save third-party integrations configuration.
        """
        company = self.get_user_company(request)
        if not company:
            return Response({
                'status': 'error',
                'message': 'No company found or insufficient permissions'
            }, status=status.HTTP_404_NOT_FOUND)

        serializer = IntegrationsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'status': 'error',
                'message': 'Invalid integrations data',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save integrations configuration
        validated_data = serializer.validated_data
        onboarding = company.onboarding
        onboarding.step_data['integrations'] = validated_data
        onboarding.mark_step_completed(4)

        # Create integration records for enabled services
        integrations_created = []
        
        if validated_data.get('deputy_enabled'):
            integration, created = CompanyIntegration.objects.get_or_create(
                company=company,
                integration_type='deputy',
                name='Deputy Workforce Management',
                defaults={
                    'description': 'Integration with Deputy for workforce management',
                    'configuration': {
                        'api_key': validated_data.get('deputy_api_key'),
                        'endpoint': validated_data.get('deputy_endpoint')
                    },
                    'status': 'configuring',
                    'configured_by': request.user
                }
            )
            if created:
                integrations_created.append('deputy')

        # Add other integrations as needed
        for system_type in ['payroll_system', 'accounting_system', 'communication_platform']:
            system_value = validated_data.get(system_type)
            if system_value and system_value != 'none':
                integration, created = CompanyIntegration.objects.get_or_create(
                    company=company,
                    integration_type=system_type.replace('_system', '').replace('_platform', ''),
                    name=f"{system_value.title()} Integration",
                    defaults={
                        'description': f'Integration with {system_value.title()}',
                        'configuration': validated_data.get(f"{system_type.replace('_system', '').replace('_platform', '')}_credentials", {}),
                        'status': 'configuring',
                        'configured_by': request.user
                    }
                )
                if created:
                    integrations_created.append(system_value)

        return Response({
            'status': 'success',
            'message': 'Integrations configuration saved successfully',
            'integrations_created': integrations_created,
            'onboarding': CompanyOnboardingSerializer(onboarding).data
        })

    @action(detail=False, methods=['post'], url_path='complete')
    def complete_onboarding(self, request):
        """
        POST /api/v1/onboarding/complete/
        Complete the onboarding process.
        """
        company = self.get_user_company(request)
        if not company:
            return Response({
                'status': 'error',
                'message': 'No company found or insufficient permissions'
            }, status=status.HTTP_404_NOT_FOUND)

        onboarding = company.onboarding
        
        # Check if all steps are completed
        if not all([
            onboarding.company_info_completed,
            onboarding.regional_setup_completed,
            onboarding.staff_setup_completed,
            onboarding.integrations_completed
        ]):
            return Response({
                'status': 'error',
                'message': 'Not all onboarding steps have been completed'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Mark onboarding as completed
        onboarding.mark_step_completed(5)
        onboarding.completed_by = request.user
        onboarding.save()

        # Activate company if not already active
        if not company.is_active:
            company.is_active = True
            company.save()

        # Ensure user has company membership (fix for infinite spinner bug)
        # This prevents the frontend from showing infinite loading spinner
        membership, created = UserCompanyMembership.objects.get_or_create(
            user=request.user,
            company=company,
            defaults={
                'role': 'owner',
                'is_active': True,
                'is_owner': True,
                'date_joined': timezone.now()
            }
        )

        if not created and not membership.is_active:
            # Reactivate existing inactive membership
            membership.is_active = True
            membership.save()
            logger.info(f"Reactivated membership for user {request.user.id} in company {company.id}")
        elif created:
            logger.info(f"Created new membership for user {request.user.id} in company {company.id}")

        # Enable default features based on subscription tier
        default_features = {
            'shift_management': True,
            'staff_tracking': True,
            'basic_reporting': True,
            'mobile_app': True,
        }
        
        if company.subscription_tier in ['professional', 'enterprise']:
            default_features.update({
                'advanced_reporting': True,
                'compliance_tracking': True,
                'api_access': True,
            })
        
        company.features_enabled = default_features
        company.save()

        return Response({
            'status': 'success',
            'message': 'Onboarding completed successfully!',
            'company': SecurityCompanySerializer(company).data,
            'onboarding': CompanyOnboardingSerializer(onboarding).data
        })


class CompaniesViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for managing company information.
    Provides read-only access to company data with proper filtering.
    """
    serializer_class = SecurityCompanySerializer
    permission_classes = [IsAuthenticated, IsCompanyMember]

    def get_queryset(self):
        """Filter companies based on user's memberships"""
        user = self.request.user
        company_ids = user.company_memberships.filter(
            is_active=True
        ).values_list('company_id', flat=True)
        
        return SecurityCompany.objects.filter(
            id__in=company_ids,
            is_active=True
        )

    @action(detail=False, methods=['get'], url_path='current', permission_classes=[IsAuthenticated])
    def get_current_company(self, request):
        """
        GET /api/v1/companies/current/
        Get the user's current company context.

        This endpoint is accessible to all authenticated users, including those
        who haven't completed onboarding yet. It returns null if no company membership exists.
        """
        # Get the user's primary company (first active membership with highest role)
        role_priority = {'owner': 1, 'admin': 2, 'manager': 3, 'staff': 4, 'viewer': 5}

        membership = request.user.company_memberships.filter(
            is_active=True
        ).select_related('company').order_by(
            models.Case(
                *[models.When(role=role, then=priority) for role, priority in role_priority.items()],
                default=6,
                output_field=models.IntegerField()
            )
        ).first()

        if not membership:
            # Return success with null data for users without a company (e.g., during onboarding)
            return Response({
                'status': 'success',
                'company': None,
                'membership': None,
                'message': 'No active company membership found'
            }, status=status.HTTP_200_OK)

        company_serializer = SecurityCompanySerializer(membership.company)
        membership_serializer = UserCompanyMembershipSerializer(membership)

        return Response({
            'status': 'success',
            'company': company_serializer.data,
            'membership': membership_serializer.data
        })


# =====================================================
# NOTIFICATION API ENDPOINTS
# =====================================================

class SNSDeviceTokenViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing device push notification tokens.
    
    Endpoints:
    - GET /api/v1/notifications/devices/ - List user's registered devices
    - POST /api/v1/notifications/devices/ - Register a new device token
    - DELETE /api/v1/notifications/devices/{id}/ - Deactivate a device token
    """
    serializer_class = SNSDeviceTokenSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only return tokens for the current user"""
        return SNSDeviceToken.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """Create token for the current user"""
        serializer.save(user=self.request.user)
    
    def perform_destroy(self, instance):
        """Deactivate instead of deleting"""
        instance.deactivate()
    
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate a device token"""
        token = self.get_object()
        token.activate()
        return Response({'status': 'Device token activated'})
    
    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate a device token"""
        token = self.get_object()
        token.deactivate()
        return Response({'status': 'Device token deactivated'})

    @swagger_auto_schema(
        operation_description="Deactivate a device push token by its value. Used during logout to prevent notifications being sent to the device after user logs out.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['token'],
            properties={
                'token': openapi.Schema(
                    type=openapi.TYPE_STRING,
                    description='The Expo push token to deactivate',
                    example='ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
                ),
            },
        ),
        responses={
            200: openapi.Response(
                description='Token deactivated successfully',
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'status': openapi.Schema(type=openapi.TYPE_STRING, example='Device token deactivated'),
                    },
                ),
            ),
            400: openapi.Response(
                description='Token value is required',
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'error': openapi.Schema(type=openapi.TYPE_STRING, example='Token value is required'),
                    },
                ),
            ),
        },
    )
    @action(detail=False, methods=['post'])
    def deactivate_by_token(self, request):
        """
        Deactivate a device token by its value.

        This is used during logout to deactivate the device's push token
        without needing to know the database ID.

        Request body:
        {
            "token": "ExponentPushToken[xxx]"
        }
        """
        token_value = request.data.get('token')
        if not token_value:
            return Response(
                {'error': 'Token value is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find and deactivate the token for the current user
        device_token = SNSDeviceToken.objects.filter(
            token=token_value,
            user=request.user
        ).first()

        if device_token:
            device_token.deactivate()
            logger.info(f"Deactivated device token {device_token.id} for user {request.user.id} on logout")
            return Response({'status': 'Device token deactivated'})
        else:
            # Token not found for this user - might already be reassigned or doesn't exist
            # This is not an error condition - just means nothing to deactivate
            return Response({'status': 'No matching token found for user'})


class NotificationPreferencesViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user notification preferences.
    
    Endpoints:
    - GET /api/v1/notifications/preferences/ - Get user's notification preferences
    - PUT /api/v1/notifications/preferences/ - Update notification preferences
    - PATCH /api/v1/notifications/preferences/ - Partially update preferences
    """
    serializer_class = NotificationPreferencesSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'put', 'patch', 'head', 'options']
    
    def get_queryset(self):
        """Only return preferences for the current user"""
        return NotificationPreferences.objects.filter(user=self.request.user)
    
    def get_object(self):
        """Get or create preferences for the current user"""
        preferences, created = NotificationPreferences.objects.get_or_create(
            user=self.request.user
        )
        return preferences
    
    def list(self, request, *args, **kwargs):
        """Return the user's preferences (single object, not a list)"""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Update the user's preferences"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        return Response(serializer.data)
    
    def perform_update(self, serializer):
        """Save updated preferences"""
        serializer.save()
    
    @action(detail=False, methods=['post'])
    def reset_to_defaults(self, request):
        """Reset preferences to default values"""
        preferences = self.get_object()
        preferences.shift_reminders_enabled = True
        preferences.advance_reminder_hours = 3
        preferences.final_reminder_minutes = 45
        preferences.exchange_notifications_enabled = True
        preferences.exchange_request_received = True
        preferences.exchange_request_accepted = True
        preferences.exchange_request_approved = True
        preferences.available_shifts_notifications_enabled = True
        preferences.new_available_shift = True
        preferences.incident_alerts_enabled = True
        preferences.sync_notifications_enabled = False
        preferences.sync_errors_only = True
        preferences.quiet_hours_enabled = False
        preferences.quiet_hours_start = None
        preferences.quiet_hours_end = None
        preferences.save()

        serializer = self.get_serializer(preferences)
        return Response(serializer.data)


# =====================================================
# IN-APP NOTIFICATION INBOX VIEWS
# =====================================================

from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for the in-app notification inbox.

    Endpoints:
    - GET  /api/v1/notifications/inbox/          - List notifications (filterable)
    - GET  /api/v1/notifications/inbox/{id}/      - Retrieve a single notification
    - GET  /api/v1/notifications/inbox/unread_count/ - Badge count of unread
    - POST /api/v1/notifications/inbox/{id}/mark_read/ - Mark one as read
    - POST /api/v1/notifications/inbox/mark_all_read/  - Mark all as read
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_read', 'notification_type', 'priority']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """Return notifications for the current user, scoped to their company."""
        user = self.request.user
        qs = Notification.objects.filter(user=user)

        # Company scoping via middleware or membership
        company = getattr(self.request, 'current_company', None)
        if not company:
            membership = user.company_memberships.filter(
                is_active=True
            ).select_related('company').first()
            if membership:
                company = membership.company

        if company:
            qs = qs.filter(Q(company=company) | Q(company__isnull=True))

        return qs

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Return the count of unread notifications for badge display."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notification = self.get_object()
        notification.mark_read()
        return Response({'status': 'Notification marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all unread notifications as read."""
        updated = self.get_queryset().filter(is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'status': f'{updated} notifications marked as read'})


# =====================================================
# PASSWORD RESET VIEWS
# =====================================================

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from .serializers import (
    PasswordResetRequestSerializer,
    PasswordResetValidateSerializer,
    PasswordResetConfirmSerializer
)


class PasswordResetRequestView(APIView):
    """
    API endpoint to request password reset.
    Generates a token and sends reset email.
    Always returns 200 to prevent user enumeration.
    """
    permission_classes = [AllowAny]

    @method_decorator(ratelimit(key='ip', rate='3/h', method='POST'))
    def post(self, request):
        """Handle password reset request"""
        serializer = PasswordResetRequestSerializer(data=request.data)

        if not serializer.is_valid():
            # Still return 200 to prevent user enumeration
            return Response(
                {'message': 'If the email exists, a password reset link has been sent.'},
                status=status.HTTP_200_OK
            )

        email = serializer.validated_data['email']

        try:
            # Try to find user by email
            user = User.objects.get(email=email)

            # Get client IP address for audit trail
            ip_address = request.META.get('HTTP_X_FORWARDED_FOR')
            if ip_address:
                ip_address = ip_address.split(',')[0]
            else:
                ip_address = request.META.get('REMOTE_ADDR')

            # Create password reset token
            reset_token = PasswordResetToken.objects.create(
                user=user,
                ip_address=ip_address
            )

            # Build reset URL
            frontend_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else 'http://localhost:3000'
            reset_url = f"{frontend_url}/reset-password/confirm/{reset_token.token}"

            # Send email
            context = {
                'user': user,
                'reset_url': reset_url,
                'expiry_hours': 24
            }

            html_message = render_to_string('password_reset_email.html', context)
            plain_message = strip_tags(html_message)

            send_mail(
                subject='Password Reset Request',
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )

            logger.info(f"Password reset email sent to {email} from IP {ip_address}")

        except User.DoesNotExist:
            # User doesn't exist, but still return success to prevent enumeration
            logger.warning(f"Password reset requested for non-existent email: {email}")
        except Exception as e:
            # Log error but still return success to prevent enumeration
            logger.error(f"Error sending password reset email: {str(e)}")

        # Always return the same response
        return Response(
            {'message': 'If the email exists, a password reset link has been sent.'},
            status=status.HTTP_200_OK
        )


class PasswordResetValidateView(APIView):
    """
    API endpoint to validate password reset token.
    Returns whether the token is valid and not expired.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        """Validate password reset token"""
        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if reset_token.is_valid():
                return Response(
                    {
                        'valid': True,
                        'message': 'Token is valid',
                        'email': reset_token.user.email
                    },
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {
                        'valid': False,
                        'message': 'Token has expired or already been used'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        except PasswordResetToken.DoesNotExist:
            return Response(
                {
                    'valid': False,
                    'message': 'Invalid token'
                },
                status=status.HTTP_400_BAD_REQUEST
            )


class PasswordResetConfirmView(APIView):
    """
    API endpoint to confirm password reset with new password.
    Updates the password and invalidates all user sessions.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        """Confirm password reset and update password"""
        serializer = PasswordResetConfirmSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            reset_token = PasswordResetToken.objects.get(token=token)

            if not reset_token.is_valid():
                return Response(
                    {'error': 'Token has expired or already been used'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update user password
            user = reset_token.user
            user.set_password(new_password)
            user.password_last_changed = timezone.now()
            user.save()

            # Mark token as used
            reset_token.mark_as_used()

            # Invalidate all existing sessions/tokens for this user
            # This forces the user to log in again with the new password
            user.password_reset_tokens.filter(is_used=False).update(is_used=True)

            logger.info(f"Password reset successful for user {user.username}")

            return Response(
                {'message': 'Password has been reset successfully'},
                status=status.HTTP_200_OK
            )

        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid token'},
                status=status.HTTP_400_BAD_REQUEST
            )


# =============================================================================
# CONTRACTOR UNAVAILABILITY & LEAVE MANAGEMENT VIEWSETS
# =============================================================================

class ContractorUnavailabilityViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing contractor unavailability periods.

    Staff can manage their own unavailability (no approval needed).
    Admins can view all unavailability for their company.
    """
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['staff_user', 'start_date', 'end_date']
    ordering_fields = ['start_date', 'end_date', 'created_at']
    ordering = ['-start_date']

    def get_serializer_class(self):
        if self.action == 'create':
            return ContractorUnavailabilityCreateSerializer
        return ContractorUnavailabilitySerializer

    def _get_user_company(self, user):
        """Get the user's primary company from their company memberships"""
        membership = user.company_memberships.filter(
            is_active=True,
            company__is_active=True
        ).select_related('company').first()
        return membership.company if membership else None

    def get_queryset(self):
        user = self.request.user

        # Get user's company from memberships
        company = self._get_user_company(user)

        # Admins/managers can see all unavailability for their company
        if user.is_superuser or user.role in ['admin', 'manager']:
            if company:
                return ContractorUnavailability.objects.filter(company=company)
            return ContractorUnavailability.objects.none()

        # Regular staff can only see their own unavailability
        return ContractorUnavailability.objects.filter(staff_user=user)

    def perform_create(self, serializer):
        """Create unavailability for the current user"""
        user = self.request.user
        company = self._get_user_company(user)

        serializer.save(staff_user=user, company=company)

    def perform_update(self, serializer):
        """Only allow users to update their own unavailability"""
        if self.get_object().staff_user != self.request.user and not self.request.user.is_superuser:
            raise ValidationError("You can only update your own unavailability")
        serializer.save()

    def perform_destroy(self, instance):
        """Only allow users to delete their own unavailability"""
        if instance.staff_user != self.request.user and not self.request.user.is_superuser:
            raise ValidationError("You can only delete your own unavailability")
        instance.delete()

    @action(detail=False, methods=['get'])
    def check(self, request):
        """
        Check if a user is available on a specific date.
        Query params: date (YYYY-MM-DD), user_id (optional, admin only)
        """
        date_str = request.query_params.get('date')
        if not date_str:
            return Response(
                {'error': 'date parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            check_date = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get user to check
        user_id = request.query_params.get('user_id')
        if user_id and (request.user.is_superuser or (hasattr(request.user, 'profile') and request.user.profile.role in ['admin', 'manager'])):
            try:
                check_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            check_user = request.user

        is_available = ContractorUnavailability.is_user_available(check_user, check_date)

        reason = ''
        if not is_available:
            unavailability = ContractorUnavailability.objects.filter(
                staff_user=check_user,
                start_date__lte=check_date,
                end_date__gte=check_date
            ).first()
            if unavailability and unavailability.reason:
                reason = unavailability.reason

        return Response({
            'date': date_str,
            'user_id': check_user.id,
            'is_available': is_available,
            'reason': reason
        })

    @action(detail=False, methods=['get'])
    def my_unavailability(self, request):
        """Get the current user's upcoming unavailability periods"""
        today = timezone.now().date()
        queryset = ContractorUnavailability.objects.filter(
            staff_user=request.user,
            end_date__gte=today
        ).order_by('start_date')

        serializer = ContractorUnavailabilitySerializer(queryset, many=True)
        return Response(serializer.data)


class BankHolidayFilter(django_filters.FilterSet):
    """Custom filter for BankHoliday to handle year parameter."""
    year = django_filters.NumberFilter(method='filter_year')

    def filter_year(self, queryset, name, value):
        return queryset.filter(date__year=value)

    class Meta:
        model = BankHoliday
        fields = ['date', 'is_active', 'year']


class BankHolidayViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing bank holidays.

    Only admins can create/update/delete bank holidays.
    All authenticated users can view bank holidays for their company.
    """
    serializer_class = BankHolidaySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = BankHolidayFilter  # Use custom filter instead of filterset_fields
    ordering_fields = ['date', 'name']
    ordering = ['date']

    def _get_user_company(self, user):
        """Get the user's primary company from their company memberships"""
        membership = user.company_memberships.filter(
            is_active=True,
            company__is_active=True
        ).select_related('company').first()
        return membership.company if membership else None

    def get_queryset(self):
        user = self.request.user

        # Get user's company from memberships
        company = self._get_user_company(user)

        if company:
            return BankHoliday.objects.filter(company=company)
        else:
            return BankHoliday.objects.none()
        # Note: year filtering is now handled by BankHolidayFilter

    def check_admin_permission(self):
        """Check if user has admin permissions"""
        user = self.request.user
        if not user.is_superuser and user.role not in ['admin', 'owner']:
            raise ValidationError("Only admins can manage bank holidays")

    def perform_create(self, serializer):
        self.check_admin_permission()

        user = self.request.user
        company = self._get_user_company(user)

        if not company:
            raise ValidationError("User is not associated with a company")

        serializer.save(company=company)

    def perform_update(self, serializer):
        self.check_admin_permission()
        serializer.save()

    def perform_destroy(self, instance):
        self.check_admin_permission()
        instance.delete()

    @action(detail=False, methods=['post'])
    def populate_uk_defaults(self, request):
        """
        Populate UK bank holidays for a given year.
        Query params: year (optional, defaults to current year)
        """
        self.check_admin_permission()

        user = request.user
        company = self._get_user_company(user)

        if not company:
            return Response(
                {'error': 'User is not associated with a company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        year = request.data.get('year')
        if year:
            try:
                year = int(year)
            except ValueError:
                return Response(
                    {'error': 'Invalid year format'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        created_holidays = BankHoliday.populate_uk_defaults(company, year)

        return Response({
            'message': f'Created {len(created_holidays)} bank holidays',
            'holidays': BankHolidaySerializer(created_holidays, many=True).data
        })

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming bank holidays for the user's company"""
        today = timezone.now().date()
        queryset = self.get_queryset().filter(
            date__gte=today,
            is_active=True
        ).order_by('date')[:10]

        serializer = BankHolidaySerializer(queryset, many=True)
        return Response(serializer.data)


class StaffLeaveDailyRateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing staff leave daily rates.

    Only admins can view and manage daily rates.
    """
    serializer_class = StaffLeaveDailyRateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['staff_user']
    ordering_fields = ['staff_user__username', 'daily_rate', 'effective_from']
    ordering = ['staff_user__username']

    def _get_user_company(self, user):
        """Get the user's primary company from their company memberships"""
        membership = user.company_memberships.filter(
            is_active=True,
            company__is_active=True
        ).select_related('company').first()
        return membership.company if membership else None

    def get_queryset(self):
        user = self.request.user

        # Only admins can view daily rates
        if not user.is_superuser and user.role not in ['admin', 'owner']:
            return StaffLeaveDailyRate.objects.none()

        # Get user's company from memberships
        company = self._get_user_company(user)

        if company:
            return StaffLeaveDailyRate.objects.filter(company=company)
        return StaffLeaveDailyRate.objects.none()

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return StaffLeaveDailyRateUpdateSerializer
        return StaffLeaveDailyRateSerializer

    def check_admin_permission(self):
        """Check if user has admin permissions"""
        user = self.request.user
        if not user.is_superuser and user.role not in ['admin', 'owner']:
            raise ValidationError("Only admins can manage staff leave daily rates")

    def perform_create(self, serializer):
        self.check_admin_permission()

        user = self.request.user
        company = self._get_user_company(user)

        if not company:
            raise ValidationError("User is not associated with a company")

        serializer.save(company=company, updated_by=user)

    def perform_update(self, serializer):
        self.check_admin_permission()
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        self.check_admin_permission()
        instance.delete()

    @action(detail=False, methods=['get'], url_path='by-user/(?P<user_id>[^/.]+)')
    def by_user(self, request, user_id=None):
        """Get or create daily rate for a specific user"""
        self.check_admin_permission()

        try:
            staff_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            rate = StaffLeaveDailyRate.objects.get(staff_user=staff_user)
            serializer = StaffLeaveDailyRateSerializer(rate)
            return Response(serializer.data)
        except StaffLeaveDailyRate.DoesNotExist:
            return Response(
                {'message': 'No daily rate set for this user'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['put'], url_path='set-rate/(?P<user_id>[^/.]+)')
    def set_rate(self, request, user_id=None):
        """Set or update daily rate for a specific user"""
        self.check_admin_permission()

        try:
            staff_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        user = request.user
        company = self._get_user_company(user)

        if not company:
            return Response(
                {'error': 'User is not associated with a company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = StaffLeaveDailyRateUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rate, created = StaffLeaveDailyRate.objects.update_or_create(
            staff_user=staff_user,
            defaults={
                'company': company,
                'daily_rate': serializer.validated_data['daily_rate'],
                'effective_from': serializer.validated_data['effective_from'],
                'updated_by': user
            }
        )

        return Response({
            'message': 'Daily rate created' if created else 'Daily rate updated',
            'data': StaffLeaveDailyRateSerializer(rate).data
        })


# =====================================================
# EMAIL UNSUBSCRIBE VIEW
# =====================================================

class EmailUnsubscribeView(APIView):
    """
    View for handling email unsubscribe requests.

    Allows users to unsubscribe from email notifications without authentication
    using their unique unsubscribe token.

    GET: Validate token and return masked email address
    POST: Process unsubscribe request
    """
    permission_classes = [AllowAny]
    throttle_classes = []  # No throttling for unsubscribe

    def get(self, request, token):
        """
        Validate unsubscribe token and return user info.

        Returns masked email and available notification types.
        """
        try:
            preferences = NotificationPreferences.objects.select_related('user').get(
                email_unsubscribe_token=token
            )
        except NotificationPreferences.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired unsubscribe link'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Mask the email address (e.g., j****@example.com)
        email = preferences.user.email
        if email and '@' in email:
            local, domain = email.split('@', 1)
            if len(local) > 2:
                masked_email = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"
            else:
                masked_email = f"{'*' * len(local)}@{domain}"
        else:
            masked_email = '****@****'

        return Response({
            'email': masked_email,
            'notification_types': [
                {'key': 'all', 'label': 'All email notifications', 'enabled': preferences.email_notifications_enabled},
                {'key': 'shift_assignments', 'label': 'Shift assignments', 'enabled': preferences.email_shift_assignments},
                {'key': 'shift_reminders', 'label': 'Shift reminders', 'enabled': preferences.email_shift_reminders},
                {'key': 'exchange_notifications', 'label': 'Shift exchanges', 'enabled': preferences.email_exchange_notifications},
                {'key': 'open_shift_notifications', 'label': 'Open shifts', 'enabled': preferences.email_open_shift_notifications},
                {'key': 'approval_notifications', 'label': 'Approvals', 'enabled': preferences.email_approval_notifications},
            ]
        })

    def post(self, request, token):
        """
        Process unsubscribe request.

        Accepts:
        - unsubscribe_type: 'all' or specific notification type key
        """
        try:
            preferences = NotificationPreferences.objects.get(
                email_unsubscribe_token=token
            )
        except NotificationPreferences.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired unsubscribe link'},
                status=status.HTTP_404_NOT_FOUND
            )

        unsubscribe_type = request.data.get('unsubscribe_type', 'all')

        # Map of unsubscribe types to preference fields
        type_field_map = {
            'all': 'email_notifications_enabled',
            'shift_assignments': 'email_shift_assignments',
            'shift_reminders': 'email_shift_reminders',
            'exchange_notifications': 'email_exchange_notifications',
            'open_shift_notifications': 'email_open_shift_notifications',
            'approval_notifications': 'email_approval_notifications',
        }

        if unsubscribe_type not in type_field_map:
            return Response(
                {'error': f'Invalid unsubscribe type: {unsubscribe_type}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update the preference
        field_name = type_field_map[unsubscribe_type]
        setattr(preferences, field_name, False)
        preferences.save(update_fields=[field_name])

        logger.info(
            f"Email unsubscribe: user={preferences.user.id}, type={unsubscribe_type}"
        )

        # Build message based on type
        if unsubscribe_type == 'all':
            message = "You have been unsubscribed from all email notifications."
        else:
            type_labels = {
                'shift_assignments': 'shift assignment',
                'shift_reminders': 'shift reminder',
                'exchange_notifications': 'shift exchange',
                'open_shift_notifications': 'open shift',
                'approval_notifications': 'approval',
            }
            message = f"You have been unsubscribed from {type_labels[unsubscribe_type]} emails."

        return Response({
            'success': True,
            'message': message,
            'unsubscribed_type': unsubscribe_type
        })


# =====================================================
# CLIENT BILLING VIEWSET
# =====================================================

class ClientInvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing client invoices (billing venues/clients for security services).

    Permissions: admin and manager roles only.
    Company-scoped: all queries are filtered to the user's company context.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ClientInvoiceSerializer

    def get_user_company(self, request):
        """Get the user's current company context."""
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company
        membership = request.user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin', 'manager'],
            company__is_active=True
        ).select_related('company').order_by('-joined_at').first()
        return membership.company if membership else None

    def check_admin_or_manager(self, request):
        """Raise 403 if user is not admin or manager."""
        if request.user.role not in ('admin', 'manager'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only admins and managers can access client invoices.")

    def get_queryset(self):
        self.check_admin_or_manager(self.request)
        company = self.get_user_company(self.request)
        if not company:
            return ClientInvoice.objects.none()

        queryset = ClientInvoice.objects.filter(
            company=company
        ).select_related('venue', 'company', 'created_by').prefetch_related('line_items')

        # Filtering
        venue_id = self.request.query_params.get('venue')
        status_filter = self.request.query_params.get('status')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if start_date:
            queryset = queryset.filter(start_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(end_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        self.check_admin_or_manager(self.request)
        company = self.get_user_company(self.request)
        if not company:
            raise ValidationError("No company context found.")
        invoice_number = ClientInvoice.generate_invoice_number(company)
        serializer.save(
            company=company,
            created_by=self.request.user,
            invoice_number=invoice_number,
        )

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate a client invoice from approved shifts at a venue for a date range.

        POST body:
            venue_id: UUID
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD
            billing_rate: Decimal (hourly rate to charge the client)
            tax_rate: Decimal (optional, default 20.00)
            notes: str (optional)
        """
        self.check_admin_or_manager(request)
        company = self.get_user_company(request)
        if not company:
            return Response(
                {'error': 'No company context found.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        gen_serializer = ClientInvoiceGenerateSerializer(data=request.data)
        gen_serializer.is_valid(raise_exception=True)
        data = gen_serializer.validated_data

        # Validate venue belongs to company
        try:
            venue = Venue.objects.get(id=data['venue_id'], company=company)
        except Venue.DoesNotExist:
            return Response(
                {'error': 'Venue not found in your company.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Find approved shifts at this venue in the date range
        shifts = Shift.objects.filter(
            venue=venue,
            start_time__date__gte=data['start_date'],
            start_time__date__lte=data['end_date'],
            status='approved',
            actual_hours_worked__isnull=False,
        ).select_related('staff_user').order_by('start_time')

        if not shifts.exists():
            return Response(
                {'error': 'No approved shifts found for this venue in the specified period.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for existing invoice covering same venue and period
        existing = ClientInvoice.objects.filter(
            company=company,
            venue=venue,
            start_date=data['start_date'],
            end_date=data['end_date'],
            status__in=['draft', 'sent'],
        ).first()
        if existing:
            return Response(
                {
                    'error': 'A client invoice already exists for this venue and period.',
                    'existing_invoice_id': str(existing.id),
                },
                status=status.HTTP_409_CONFLICT
            )

        # Build the invoice
        from decimal import Decimal
        billing_rate = data['billing_rate']
        tax_rate = data.get('tax_rate', Decimal('20.00'))

        invoice = ClientInvoice.objects.create(
            company=company,
            venue=venue,
            invoice_number=ClientInvoice.generate_invoice_number(company),
            start_date=data['start_date'],
            end_date=data['end_date'],
            tax_rate=tax_rate,
            status='draft',
            client_name=venue.contact_name or venue.name,
            client_address=f"{venue.address}, {venue.city}, {venue.postal_code}",
            client_email=venue.contact_email or '',
            notes=data.get('notes', ''),
            created_by=request.user,
        )

        # Create line items from shifts
        items = []
        for shift in shifts:
            hours = shift.actual_hours_worked or Decimal('0')
            staff_name = ''
            if shift.staff_user:
                staff_name = f"{shift.staff_user.first_name} {shift.staff_user.last_name}".strip()
                if not staff_name:
                    staff_name = shift.staff_user.username

            item = ClientInvoiceItem(
                invoice=invoice,
                shift=shift,
                description=f"Security services - {staff_name} ({shift.required_security_role})",
                date=shift.start_time.date(),
                hours=hours,
                rate=billing_rate,
            )
            items.append(item)

        ClientInvoiceItem.objects.bulk_create(items)
        # bulk_create doesn't call save(), so calculate totals manually
        for item in invoice.line_items.all():
            item.save()  # triggers total calculation per item

        invoice.calculate_totals()

        serializer = ClientInvoiceSerializer(invoice)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def send_invoice(self, request, pk=None):
        """Mark invoice as sent, setting issued_date and due_date (net 30)."""
        self.check_admin_or_manager(request)
        invoice = self.get_object()

        if invoice.status not in ('draft',):
            return Response(
                {'error': f'Cannot send invoice with status "{invoice.status}". Only draft invoices can be sent.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        today = timezone.now().date()
        invoice.status = 'sent'
        invoice.issued_date = today
        invoice.due_date = today + timedelta(days=30)
        invoice.save(update_fields=['status', 'issued_date', 'due_date', 'updated_at'])

        AuditLog.log(
            user=request.user,
            company=invoice.company,
            action='client_invoice_sent',
            resource_type='ClientInvoice',
            resource_id=str(invoice.id),
            details={'invoice_number': invoice.invoice_number},
            request=request,
        )

        serializer = ClientInvoiceSerializer(invoice)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid."""
        self.check_admin_or_manager(request)
        invoice = self.get_object()

        if invoice.status not in ('sent', 'overdue'):
            return Response(
                {'error': f'Cannot mark invoice as paid with status "{invoice.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        invoice.status = 'paid'
        invoice.paid_date = request.data.get('paid_date', timezone.now().date())
        invoice.save(update_fields=['status', 'paid_date', 'updated_at'])

        AuditLog.log(
            user=request.user,
            company=invoice.company,
            action='client_invoice_paid',
            resource_type='ClientInvoice',
            resource_id=str(invoice.id),
            details={
                'invoice_number': invoice.invoice_number,
                'paid_date': str(invoice.paid_date),
                'total_amount': str(invoice.total_amount),
            },
            request=request,
        )

        serializer = ClientInvoiceSerializer(invoice)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for client invoices."""
        self.check_admin_or_manager(request)
        company = self.get_user_company(request)
        if not company:
            return Response({'error': 'No company context found.'}, status=status.HTTP_400_BAD_REQUEST)

        invoices = ClientInvoice.objects.filter(company=company)

        total_billed = invoices.exclude(status='cancelled').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        total_paid = invoices.filter(status='paid').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        total_outstanding = invoices.filter(status__in=['sent', 'overdue']).aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        total_draft = invoices.filter(status='draft').aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        return Response({
            'total_billed': float(total_billed),
            'total_paid': float(total_paid),
            'total_outstanding': float(total_outstanding),
            'total_draft': float(total_draft),
            'count_by_status': {
                'draft': invoices.filter(status='draft').count(),
                'sent': invoices.filter(status='sent').count(),
                'paid': invoices.filter(status='paid').count(),
                'overdue': invoices.filter(status='overdue').count(),
                'cancelled': invoices.filter(status='cancelled').count(),
            }
        })


class IncidentReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for incident report management.
    Staff can create and view their own reports.
    Managers/admins can view and resolve all reports for their company.
    """
    serializer_class = IncidentReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'manager']:
            company = self.get_user_company(self.request)
            if company:
                company_user_ids = company.memberships.filter(
                    is_active=True
                ).values_list('user_id', flat=True)
                return IncidentReport.objects.filter(
                    reported_by_id__in=company_user_ids
                ).select_related('venue', 'reported_by', 'shift', 'resolved_by')
            return IncidentReport.objects.none()
        return IncidentReport.objects.filter(
            reported_by=user
        ).select_related('venue', 'reported_by', 'shift', 'resolved_by')

    def get_user_company(self, request):
        if hasattr(request, 'current_company') and request.current_company:
            return request.current_company
        membership = request.user.company_memberships.filter(
            is_active=True, company__is_active=True
        ).select_related('company').first()
        return membership.company if membership else None

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark an incident as resolved"""
        incident = self.get_object()
        if request.user.role not in ['admin', 'manager']:
            return Response(
                {'error': 'Only managers and admins can resolve incidents'},
                status=status.HTTP_403_FORBIDDEN
            )
        incident.resolved = True
        incident.resolved_at = timezone.now()
        incident.resolved_by = request.user
        incident.followup_notes = request.data.get('followup_notes', incident.followup_notes)
        incident.save()
        return Response(IncidentReportSerializer(incident).data)


# =============================================================================
# ADMIN DASHBOARD OVERVIEW
# =============================================================================

class AdminDashboardOverviewView(APIView):
    """
    GET /api/v1/admin/dashboard/overview/

    Manager/admin-only aggregation backing the Operations Dashboard.
    Returns KPIs, pending approvals, venue coverage, SIA compliance,
    live activity, staff roster, and a 7×24 coverage heatmap in one call.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not CompliancePermissions.is_manager_or_admin(request.user):
            return Response(
                {'detail': 'Manager or admin role required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from leave_management.models import LeaveRequest

        now = timezone.now()
        today = timezone.localdate()
        week_start = today - datetime.timedelta(days=today.weekday())  # Monday
        week_end = week_start + datetime.timedelta(days=6)

        # ---- Company scope ----
        # Mirrors LeaveRequestViewSet.get_queryset: surface only data the
        # caller can act on. If the admin has no company membership we fall
        # back to global (super-admin) — same behaviour the per-resource
        # viewsets accept.
        membership = (
            request.user.company_memberships
            .filter(is_active=True, company__is_active=True)
            .select_related('company').first()
        )
        if membership:
            company_id = membership.company_id
            company_user_ids = list(
                membership.company.memberships
                .filter(is_active=True)
                .values_list('user_id', flat=True)
            )
        else:
            company_id = None
            company_user_ids = None

        def by_users(qs, field='staff_user_id'):
            if company_user_ids is None:
                return qs
            return qs.filter(**{f'{field}__in': company_user_ids})

        def by_venue_co(qs, field='venue__company_id'):
            if company_id is None:
                return qs
            return qs.filter(**{field: company_id})

        def by_co(qs, field='company_id'):
            if company_id is None:
                return qs
            return qs.filter(**{field: company_id})

        # ---- KPIs ----
        # Officers expected on shift right now: published + assigned, the shift
        # window contains now, and they aren't already done. This counts both
        # checked-in officers (status=in_progress) and ones who haven't checked
        # in yet — the dashboard surfaces the latter via the delta below.
        expected_on_shift_qs = by_venue_co(
            Shift.objects.filter(
                is_published=True,
                staff_user__isnull=False,
                start_time__lte=now,
                end_time__gte=now,
            ).exclude(status__in=['completed', 'cancelled', 'no_show', 'rejected'])
        )
        on_shift = expected_on_shift_qs.count()
        # "Not checked in" excludes shifts whose check-in came via a manager
        # TimeAdjustment (Mark Present). check_in_time alone is null in that
        # case, but the officer is effectively present.
        from django.db.models import Exists, OuterRef
        from api.models import TimeAdjustment
        has_attestation = TimeAdjustment.objects.filter(
            shift=OuterRef('pk'),
            adjusted_check_in_time__isnull=False,
        )
        on_shift_pending_checkin = (
            expected_on_shift_qs
            .filter(check_in_time__isnull=True)
            .annotate(_attested=Exists(has_attestation))
            .filter(_attested=False)
            .count()
        )

        hours_today = by_venue_co(Shift.objects.filter(
            start_time__date=today,
            actual_hours_worked__isnull=False,
        )).aggregate(total=Sum('actual_hours_worked'))['total'] or Decimal('0')

        # Scheduled hours today: sum (end_time - start_time) for every
        # published shift that starts today, regardless of check-in. Used as
        # the "delta" so admin sees both delivered and scheduled.
        todays_shift_pairs = list(by_venue_co(Shift.objects.filter(
            start_time__date=today,
            is_published=True,
            end_time__isnull=False,
        )).values_list('start_time', 'end_time'))
        scheduled_hours_today = sum(
            (e - s).total_seconds() / 3600
            for s, e in todays_shift_pairs
            if s and e
        )

        leave_pending = by_users(
            LeaveRequest.objects.filter(status='pending')
        ).count()
        recruit_pending = by_co(
            RecruitmentApplication.objects.filter(status='pending'),
            field='employment_type__company_id',
        ).count()
        shift_pending = by_venue_co(
            Shift.objects.filter(status='pending_approval')
        ).count()
        open_approvals_total = leave_pending + recruit_pending + shift_pending

        revenue_week = by_venue_co(Shift.objects.filter(
            start_time__date__gte=week_start,
            start_time__date__lte=week_end,
            status__in=['completed', 'approved'],
            actual_hours_worked__isnull=False,
            bill_rate__isnull=False,
        )).aggregate(
            total=Sum(models.F('actual_hours_worked') * models.F('bill_rate'))
        )['total'] or Decimal('0')

        kpis = {
            'officers_on_shift': {
                'value': on_shift,
                'delta': (
                    f'{on_shift_pending_checkin} not checked in'
                    if on_shift_pending_checkin > 0
                    else ''
                ),
                'delta_dir': (
                    'down' if on_shift_pending_checkin > 0 else 'neutral'
                ),
                'spark': [],
            },
            'hours_delivered_today': {
                'value': float(hours_today),
                'delta': (
                    f'{scheduled_hours_today:.1f}h scheduled'
                    if scheduled_hours_today > 0
                    else ''
                ),
                'delta_dir': 'neutral',
                'spark': [],
            },
            'open_approvals': {
                'value': open_approvals_total,
                'delta': f'{shift_pending} urgent' if shift_pending else '',
                'delta_dir': 'neutral',
                'spark': [],
            },
            'revenue_this_week': {
                'value': float(revenue_week),
                'delta': '',
                'delta_dir': 'neutral',
                'spark': [],
            },
        }

        # ---- Pending approvals (top 10, mixed sources) ----
        approvals = []
        for lr in (by_users(LeaveRequest.objects.filter(status='pending'))
                   .select_related('staff_user', 'leave_type')
                   .order_by('start_date')[:5]):
            approvals.append({
                'id': f'leave:{lr.id}',
                'type': f'{lr.leave_type.name} request' if lr.leave_type else 'Leave request',
                'who': lr.staff_user.get_full_name() or lr.staff_user.username,
                'when': self._format_date_range(lr.start_date, lr.end_date),
                'venue': '—',
                'urgency': self._urgency_for_date(lr.start_date),
                'source': 'leave',
                'source_id': lr.id,
            })
        for app in (by_co(
                        RecruitmentApplication.objects.filter(status='pending'),
                        field='employment_type__company_id',
                    )
                    .order_by('-application_date')[:3]):
            approvals.append({
                'id': f'recruitment:{app.id}',
                'type': 'New application',
                'who': app.full_name,
                'when': app.application_date.strftime('%-d %b'),
                'venue': '—',
                'urgency': 'medium',
                'source': 'recruitment',
                'source_id': app.id,
            })
        for s in (by_venue_co(Shift.objects.filter(status='pending_approval'))
                  .select_related('staff_user', 'venue')
                  .order_by('-end_time')[:3]):
            staff_name = (s.staff_user.get_full_name() if s.staff_user else '') or 'Unassigned'
            approvals.append({
                'id': f'shift:{s.id}',
                'type': 'Shift approval',
                'who': staff_name,
                'when': self._format_shift_time(s),
                'venue': s.venue.name,
                'urgency': self._urgency_for_datetime(s.end_time or s.start_time),
                'source': 'shift',
                'source_id': s.id,
            })
        urgency_rank = {'high': 0, 'medium': 1, 'low': 2}
        approvals.sort(key=lambda a: urgency_rank.get(a['urgency'], 3))
        approvals = approvals[:10]

        # ---- Venue coverage ----
        venue_coverage = []
        venues = by_co(
            Venue.objects.filter(is_active=True)
        ).order_by('name')[:10]
        for v in venues:
            week_shifts = Shift.objects.filter(
                venue=v,
                start_time__date__gte=week_start,
                start_time__date__lte=week_end,
            )
            required = week_shifts.count()
            staffed = week_shifts.filter(staff_user__isnull=False).count()
            incidents = IncidentReport.objects.filter(
                venue=v,
                created_at__date__gte=week_start,
            ).count()
            coverage = int(round((staffed / required * 100))) if required else 100
            venue_coverage.append({
                'id': v.id,
                'name': v.name,
                'staffed': staffed,
                'required': required,
                'coverage': coverage,
                'incidents': incidents,
            })

        # ---- SIA compliance ----
        in_30 = today + datetime.timedelta(days=30)
        valid_count = by_users(
            SIALicense.objects.filter(expiry_date__gte=in_30),
            field='staff_profile__user_id',
        ).count()
        expiring_count = by_users(
            SIALicense.objects.filter(
                expiry_date__gte=today,
                expiry_date__lt=in_30,
            ),
            field='staff_profile__user_id',
        ).count()
        expired_count = by_users(
            SIALicense.objects.filter(expiry_date__lt=today),
            field='staff_profile__user_id',
        ).count()
        expiring_list = []
        for lic in (by_users(
                        SIALicense.objects.filter(
                            expiry_date__gte=today, expiry_date__lt=in_30,
                        ),
                        field='staff_profile__user_id',
                    )
                    .select_related('staff_profile__user')
                    .order_by('expiry_date')[:5]):
            user = lic.staff_profile.user
            expiring_list.append({
                'user_id': user.id,
                'name': user.get_full_name() or user.username,
                'expiresIn': (lic.expiry_date - today).days,
                'license': self._license_label(lic.license_type),
            })
        sia_compliance = {
            'valid': valid_count,
            'expiring_soon': expiring_count,
            'expired': expired_count,
            'expiring_list': expiring_list,
        }

        # ---- Live activity (top 10, mixed kinds) ----
        events = []
        for s in (by_venue_co(Shift.objects.filter(
                      check_in_time__isnull=False,
                      check_in_time__gte=now - datetime.timedelta(hours=24),
                  ))
                  .select_related('staff_user', 'venue')
                  .order_by('-check_in_time')[:10]):
            if not s.staff_user:
                continue
            events.append({
                'when': s.check_in_time,
                'kind': 'check-in',
                'text': f'{s.staff_user.get_full_name() or s.staff_user.username} checked in at {s.venue.name}',
            })
        for s in (by_venue_co(Shift.objects.filter(
                      check_out_time__isnull=False,
                      check_out_time__gte=now - datetime.timedelta(hours=24),
                  ))
                  .select_related('staff_user', 'venue')
                  .order_by('-check_out_time')[:10]):
            if not s.staff_user:
                continue
            hours = s.actual_hours_worked or 0
            events.append({
                'when': s.check_out_time,
                'kind': 'check-out',
                'text': f'{s.staff_user.get_full_name() or s.staff_user.username} checked out — {hours}h',
            })
        for i in (by_venue_co(IncidentReport.objects.filter(
                      created_at__gte=now - datetime.timedelta(hours=72),
                  ))
                  .select_related('venue')
                  .order_by('-created_at')[:5]):
            events.append({
                'when': i.created_at,
                'kind': 'incident',
                'text': f'{i.get_severity_display()} incident at {i.venue.name}',
            })
        events.sort(key=lambda e: e['when'], reverse=True)
        live_activity = [
            {'t': self._relative_time(now, e['when']), 'kind': e['kind'], 'text': e['text']}
            for e in events[:10]
        ]

        # ---- Staff roster (top 50 active users) ----
        users_qs = (by_users(
                        User.objects.filter(
                            role__in=['staff', 'manager'], is_active=True,
                        ),
                        field='id',
                    )
                    .select_related('profile')
                    .prefetch_related('profile__sia_licenses')
                    .order_by('first_name', 'last_name')[:50])
        user_ids = [u.id for u in users_qs]

        # Bulk-fetch current shifts per user
        in_progress = {
            s.staff_user_id: s for s in
            Shift.objects.filter(staff_user_id__in=user_ids, status='in_progress')
                         .select_related('venue')
        }
        late = {
            s.staff_user_id: s for s in
            Shift.objects.filter(
                staff_user_id__in=user_ids,
                status='scheduled',
                start_time__lte=now - datetime.timedelta(minutes=15),
                check_in_time__isnull=True,
            ).select_related('venue')
        }
        last_completed = {}
        for s in Shift.objects.filter(
            staff_user_id__in=user_ids,
            status__in=['completed', 'approved'],
        ).select_related('venue').order_by('staff_user_id', '-start_time'):
            last_completed.setdefault(s.staff_user_id, s)
        week_hours_map = {
            row['staff_user']: row['total'] for row in
            Shift.objects.filter(
                staff_user_id__in=user_ids,
                start_time__date__gte=week_start,
                start_time__date__lte=week_end,
                actual_hours_worked__isnull=False,
            ).values('staff_user').annotate(total=Sum('actual_hours_worked'))
        }

        staff_roster = []
        for u in users_qs:
            if u.id in in_progress:
                status_str = 'on-shift'
                venue_name = in_progress[u.id].venue.name
            elif u.id in late:
                status_str = 'late'
                venue_name = late[u.id].venue.name
            else:
                status_str = 'off-duty'
                last = last_completed.get(u.id)
                venue_name = last.venue.name if last else '—'

            primary_license = None
            if hasattr(u, 'profile') and u.profile:
                licenses = list(u.profile.sia_licenses.all())
                primary_license = max(licenses, key=lambda l: l.expiry_date, default=None)

            license_label = (
                self._license_label(primary_license.license_type)
                if primary_license else '—'
            )
            expires_in = (
                (primary_license.expiry_date - today).days
                if primary_license else 9999
            )

            if u.role == 'manager':
                role_label = 'Manager'
            elif u.security_roles:
                role_label = u.security_roles[0].replace('_', ' ').title()
            else:
                role_label = 'Security Officer'

            week_hrs = week_hours_map.get(u.id) or Decimal('0')

            staff_roster.append({
                'id': u.id,
                'name': u.get_full_name() or u.username,
                'role': role_label,
                'venue': venue_name,
                'status': status_str,
                'license': license_label,
                'expiresIn': expires_in,
                'hours': float(week_hrs),
                'avatarHue': (u.id * 47) % 360,
            })

        # ---- Coverage heatmap (7 × 24, last 7 days) ----
        last_7 = now - datetime.timedelta(days=7)
        counts = [[0] * 24 for _ in range(7)]
        for st_dt in (by_venue_co(
                          Shift.objects.filter(start_time__gte=last_7)
                      ).values_list('start_time', flat=True)):
            local_st = timezone.localtime(st_dt)
            counts[local_st.weekday()][local_st.hour] += 1
        max_count = max((max(row) for row in counts), default=0) or 1
        heatmap = [[round(cell / max_count, 3) for cell in row] for row in counts]

        return Response({
            'kpis': kpis,
            'pending_approvals': approvals,
            'venue_coverage': venue_coverage,
            'sia_compliance': sia_compliance,
            'live_activity': live_activity,
            'staff_roster': staff_roster,
            'coverage_heatmap': heatmap,
        })

    @staticmethod
    def _license_label(code):
        return f'SIA-{(code or "").upper()}' if code else '—'

    @staticmethod
    def _format_date_range(start, end):
        if start == end:
            return start.strftime('%-d %b')
        if start.month == end.month:
            return f'{start.day}–{end.day} {end.strftime("%b")}'
        return f'{start.strftime("%-d %b")} – {end.strftime("%-d %b")}'

    @staticmethod
    def _format_shift_time(shift):
        if not shift.start_time:
            return '—'
        st = timezone.localtime(shift.start_time)
        if shift.end_time:
            et = timezone.localtime(shift.end_time)
            return f'{st.strftime("%a %-d %b, %H:%M")}–{et.strftime("%H:%M")}'
        return st.strftime('%a %-d %b, %H:%M')

    @staticmethod
    def _urgency_for_date(d):
        delta = (d - timezone.localdate()).days
        if delta <= 1:
            return 'high'
        if delta <= 3:
            return 'medium'
        return 'low'

    @staticmethod
    def _urgency_for_datetime(dt):
        if not dt:
            return 'medium'
        delta = (dt - timezone.now()).total_seconds() / 3600
        if delta <= 24:
            return 'high'
        if delta <= 72:
            return 'medium'
        return 'low'

    @staticmethod
    def _relative_time(now, then):
        secs = (now - then).total_seconds()
        if secs < 60:
            return f'{int(secs)}s'
        if secs < 3600:
            return f'{int(secs / 60)}m'
        if secs < 86400:
            return f'{int(secs / 3600)}h'
        return f'{int(secs / 86400)}d'
