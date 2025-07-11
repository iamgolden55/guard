import datetime
import logging

from django.contrib.auth import get_user_model
from django.utils import timezone
# Create your views here.
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os

from .models import (
    User, StaffProfile, EmergencyContact, BankDetails, SIALicense,
    StaffAvailability, Venue, VenueTermsAcceptance, PreferredVenue,
    Shift, FireExitCheck, CapacityCheck, ToiletCheck, ShiftExchange,
    Invoice, InvoiceItem, PayRate, DeputyConfig, DeputyEmployee,
    DeputyTimesheet, SystemSettings, EmploymentType, RecruitmentApplication
)
from .serializers import (
    UserSerializer, StaffProfileSerializer, EmergencyContactSerializer,
    BankDetailsSerializer, SIALicenseSerializer, StaffAvailabilitySerializer,
    VenueSerializer, VenueTermsAcceptanceSerializer, PreferredVenueSerializer,
    FireExitCheckSerializer, CapacityCheckSerializer, ToiletCheckSerializer,
    ShiftSerializer, ShiftExchangeSerializer, InvoiceSerializer, InvoiceItemSerializer,
    PayRateSerializer, DeputyConfigSerializer, DeputyEmployeeSerializer,
    DeputyTimesheetSerializer, ShiftTemplateSerializer, SystemSettingsSerializer,
    EmploymentTypeSerializer, RecruitmentApplicationSerializer, RecruitmentApplicationPublicSerializer
)

User = get_user_model()

logger = logging.getLogger(__name__)

# Authentication and permissions, consider adding TokenAuthentication as well.

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

    def post(self, request):
        # Get the username and password from the request
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'message': 'Both username and password are required',
                             'errors': 'missing required parameters'}, status=400)

        try:
            # Retrieve the user from the database
            user = User.objects.get(username=username)

            # Verify the provided password
            if user.check_password(password):
                # Create tokens for authentication
                refresh = RefreshToken.for_user(user)
                return Response({
                    'message': 'Login successful',
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                    'user': {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "role": user.role,
                        "is_active": user.is_active
                    }
                }, status=200)
            else:
                raise AuthenticationFailed('Incorrect password')
        except User.DoesNotExist:
            return Response({'message': 'Invalid username'}, status=401)
        except AuthenticationFailed as e:
            return Response({'message': str(e)}, status=401)

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
    
    def get_queryset(self):
        """
        Limit staff users to only see their own user details.
        Managers and admins can see all users.
        """
        user = self.request.user
        
        # Admin and managers can see all users
        if user.role in ['admin', 'manager']:
            return User.objects.all()
        
        # Staff can only see their own user
        return User.objects.filter(id=user.id)
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # Create user with proper permissions
            user = serializer.save()
            user.is_staff = True  # Enable staff status for API access
            user.save()

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
        instance = self.get_object()
        username = instance.username
        
        try:
            user = User.objects.filter(username=username).delete()[0]
            
            if user:  # In case of multiple users with same name
                response_data = {
                    'message': f'User {username} deleted successfully',
                    'status': status.HTTP_200_OK
                }
                
                return Response(response_data)
        except User.DoesNotExist:
            pass
        
        return Response({
            'error': f'Failed to delete user with username {username}',
            'details': "The requested resource was not found.",
            'code': status.HTTP_404_NOT_FOUND
        }, status=status.HTTP_404_NOT_FOUND)

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
            return Response({
                'error': 'Failed to calculate pending earnings',
                'details': str(e)
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
            return Response({
                'error': 'Failed to calculate weekly earnings',
                'details': str(e)
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
        
        # Get all staff with approved shifts in the date range
        staff_with_shifts = User.objects.filter(
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
                payment = shift.calculate_payment()
                if payment:
                    staff_total += payment
            
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
        
    except Exception as e:
        return Response({
            'error': 'Failed to preview payroll',
            'details': str(e)
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
        
        # Get all staff with approved shifts in the date range
        staff_with_shifts = User.objects.filter(
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
            invoice = Invoice.generate_for_staff_period(
                staff_user=staff_user,
                start_date=start_date,
                end_date=end_date
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
        return Response({
            'error': 'Failed to generate payroll',
            'details': str(e)
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
        Managers and admins can see all profiles.
        """
        user = self.request.user
        queryset = StaffProfile.objects.all()
        
        # Filter by user ID if provided
        user_id = self.request.query_params.get('user', None)
        if user_id:
            return queryset.filter(user__id=user_id)
        
        # Admin and managers can see all profiles
        if user.role in ['admin', 'manager']:
            return queryset
        
        # Staff can only see their own profile
        return queryset.filter(user=user)
    
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

class BankDetailsViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = BankDetails.objects.all()
    serializer_class = BankDetailsSerializer

class SIALicenseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = SIALicense.objects.all()
    serializer_class = SIALicenseSerializer

class StaffAvailabilityViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = StaffAvailability.objects.all()
    serializer_class = StaffAvailabilitySerializer

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
    
    def get_queryset(self):
        """
        Return all venues for any authenticated user.
        """
        return Venue.objects.all()
    
    def create(self, request, *args, **kwargs):
        # Only admin users can create venues
        if request.user.role != 'admin':
            return Response({
                'message': 'Only admin users can create venues',
                'error': 'permission_denied'
            }, status=status.HTTP_403_FORBIDDEN)
            
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            venue = serializer.save()
            return Response({
                'message': 'Venue created successfully',
                'venue': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def update(self, request, *args, **kwargs):
        # Only admin users can update venues
        if request.user.role != 'admin':
            return Response({
                'message': 'Only admin users can update venues',
                'error': 'permission_denied'
            }, status=status.HTTP_403_FORBIDDEN)
            
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        
        if serializer.is_valid():
            venue = serializer.save()
            return Response({
                'message': 'Venue updated successfully',
                'venue': serializer.data
            })
            
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
            logger.error(f"Error accepting venue terms: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return Response({
                'error': f'Failed to accept terms: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class VenueTermsAcceptanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = VenueTermsAcceptance.objects.all()
    serializer_class = VenueTermsAcceptanceSerializer

class PreferredVenueViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PreferredVenue.objects.all()
    serializer_class = PreferredVenueSerializer

class ShiftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    
    def get_serializer_class(self):
        """
        Use the frontend-compatible serializer if 'frontend' query param is present
        """
        if self.request.query_params.get('frontend', None) == 'true':
            from .serializers_frontend import FrontendShiftSerializer
            return FrontendShiftSerializer
        return ShiftSerializer
    
    def get_queryset(self):
        """
        Filter shifts based on query parameters
        """
        queryset = Shift.objects.all()
        
        # Filter by staff_user if provided
        staff_user_id = self.request.query_params.get('staff_user', None)
        staff_id = self.request.query_params.get('staffId', None)
        if staff_user_id:
            queryset = queryset.filter(staff_user_id=staff_user_id)
        elif staff_id:  # Support camelCase frontend param
            queryset = queryset.filter(staff_user_id=staff_id)
        
        # Filter by venue if provided
        venue_id = self.request.query_params.get('venue', None)
        venue_id_frontend = self.request.query_params.get('venueId', None)
        if venue_id:
            queryset = queryset.filter(venue_id=venue_id)
        elif venue_id_frontend:  # Support camelCase frontend param
            queryset = queryset.filter(venue_id=venue_id_frontend)
        
        # Filter by status if provided
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date', None)
        start_date_frontend = self.request.query_params.get('startDate', None)
        
        end_date = self.request.query_params.get('end_date', None)
        end_date_frontend = self.request.query_params.get('endDate', None)
        
        if start_date:
            queryset = queryset.filter(start_time__gte=start_date)
        elif start_date_frontend:  # Support camelCase frontend param
            queryset = queryset.filter(start_time__gte=start_date_frontend)
            
        if end_date:
            queryset = queryset.filter(start_time__lte=end_date)
        elif end_date_frontend:  # Support camelCase frontend param
            queryset = queryset.filter(start_time__lte=end_date_frontend)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """
        Create a new shift, with special handling for staff_user
        """
        # Use frontend serializer if specified
        if request.query_params.get('frontend', None) == 'true':
            from .serializers_frontend import FrontendShiftSerializer
            serializer = FrontendShiftSerializer(data=request.data)
        else:
            serializer = self.get_serializer(data=request.data)
            
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        serializer.save()
    
    @action(detail=False, methods=['post'])
    def bulk(self, request, *args, **kwargs):
        """
        Create multiple shifts in bulk based on date range and days of week
        """
        from datetime import datetime, timedelta
        
        # Support both snake_case and camelCase parameters
        # Get request data
        venue_id = request.data.get('venue_id') or request.data.get('venueId')
        start_date_str = request.data.get('start_date') or request.data.get('startDate')
        end_date_str = request.data.get('end_date') or request.data.get('endDate')
        start_time = request.data.get('start_time') or request.data.get('startTime')
        end_time = request.data.get('end_time') or request.data.get('endTime')
        days_of_week = request.data.get('days_of_week') or request.data.get('daysOfWeek', [])
        staff_ids = request.data.get('staff_ids') or request.data.get('staffIds', [])
        notes = request.data.get('notes', '')
        is_published = request.data.get('is_published') or request.data.get('isPublished', False)
        required_security_role = request.data.get('required_security_role') or request.data.get('requiredSecurityRole', 'ds')
        
        # Validation
        if not venue_id or not start_date_str or not end_date_str or not start_time or not end_time:
            return Response(
                {"error": "Missing required fields: venueId, startDate, endDate, startTime, endTime"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Parse dates
        try:
            if isinstance(start_date_str, str):
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            else:
                start_date = start_date_str
                
            if isinstance(end_date_str, str):
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            else:
                end_date = end_date_str
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get venue
        try:
            venue = Venue.objects.get(id=venue_id)
        except Venue.DoesNotExist:
            return Response(
                {"error": f"Venue with ID {venue_id} does not exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create shifts
        created_shifts = []
        current_date = start_date
        
        while current_date <= end_date:
            # Check if current day is in the selected days of week
            if current_date.weekday() in days_of_week:
                # Parse times
                shift_start_time = None
                shift_end_time = None
                
                # Handle different time formats
                if isinstance(start_time, str):
                    if ':' in start_time:
                        try:
                            # Handle HH:MM format
                            hour, minute = map(int, start_time.split(':'))
                            shift_start_time = current_date.replace(
                                hour=hour, 
                                minute=minute,
                                second=0,
                                microsecond=0
                            )
                        except (ValueError, TypeError):
                            # Try ISO format
                            try:
                                shift_start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                                # Use only the time portion with current_date
                                shift_start_time = current_date.replace(
                                    hour=shift_start_time.hour,
                                    minute=shift_start_time.minute,
                                    second=0,
                                    microsecond=0
                                )
                            except (ValueError, TypeError):
                                return Response(
                                    {"error": f"Invalid time format for startTime: {start_time}. Use HH:MM or ISO format."},
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                    else:
                        # Try ISO format directly
                        try:
                            shift_start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                        except (ValueError, TypeError):
                            return Response(
                                {"error": f"Invalid time format for startTime: {start_time}. Use HH:MM or ISO format."},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                else:
                    # Assume it's already a datetime object
                    shift_start_time = start_time
                
                # Same logic for end time
                if isinstance(end_time, str):
                    if ':' in end_time:
                        try:
                            # Handle HH:MM format
                            hour, minute = map(int, end_time.split(':'))
                            shift_end_time = current_date.replace(
                                hour=hour, 
                                minute=minute,
                                second=0,
                                microsecond=0
                            )
                        except (ValueError, TypeError):
                            # Try ISO format
                            try:
                                shift_end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                                # Use only the time portion with current_date
                                shift_end_time = current_date.replace(
                                    hour=shift_end_time.hour,
                                    minute=shift_end_time.minute,
                                    second=0,
                                    microsecond=0
                                )
                            except (ValueError, TypeError):
                                return Response(
                                    {"error": f"Invalid time format for endTime: {end_time}. Use HH:MM or ISO format."},
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                    else:
                        # Try ISO format directly
                        try:
                            shift_end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                        except (ValueError, TypeError):
                            return Response(
                                {"error": f"Invalid time format for endTime: {end_time}. Use HH:MM or ISO format."},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                else:
                    # Assume it's already a datetime object
                    shift_end_time = end_time
                
                # Handle overnight shifts
                if shift_end_time < shift_start_time:
                    shift_end_time += timedelta(days=1)
                
                # Create shift for each staff member or as an open shift
                if staff_ids:
                    for staff_id in staff_ids:
                        try:
                            staff_user = User.objects.get(id=staff_id)
                            # Validate staff eligibility
                            if not hasattr(staff_user, 'profile') or not staff_user.profile.is_eligible_for_shifts():
                                # Skip ineligible staff but log a warning
                                print(f"Warning: Staff {staff_user.username} (ID: {staff_id}) is not eligible for shifts")
                                continue
                            
                            shift = Shift.objects.create(
                                venue=venue,
                                staff_user=staff_user,
                                start_time=shift_start_time,
                                end_time=shift_end_time,
                                required_security_role=required_security_role,
                                status='scheduled',
                                notes=notes
                            )
                            created_shifts.append(shift)
                        except User.DoesNotExist:
                            # Skip invalid staff IDs
                            continue
                else:
                    # Create an open shift
                    shift = Shift.objects.create(
                        venue=venue,
                        staff_user=None,
                        start_time=shift_start_time,
                        end_time=shift_end_time,
                        required_security_role=required_security_role,
                        status='open',
                        notes=notes
                    )
                    created_shifts.append(shift)
            
            # Move to next day
            current_date += timedelta(days=1)
        
        # Serialize the result - use the appropriate serializer
        if request.query_params.get('frontend', None) == 'true':
            from .serializers_frontend import FrontendShiftSerializer
            serializer = FrontendShiftSerializer(created_shifts, many=True)
        else:
            serializer = self.get_serializer(created_shifts, many=True)
            
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['put'])
    def assign(self, request, *args, **kwargs):
        """
        Assign a staff member to an existing shift
        """
        shift = self.get_object()
        
        # Support both snake_case and camelCase for staffId
        staff_id = request.data.get('staff_id') or request.data.get('staffId')
        
        if not staff_id:
            return Response(
                {"error": "staffId is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            staff_user = User.objects.get(id=staff_id)
            
            # Verify staff eligibility
            if not hasattr(staff_user, 'profile') or not staff_user.profile.is_eligible_for_shifts():
                return Response({
                    "error": "Staff must have a valid SIA license and be admin approved to be assigned shifts."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update the shift
            shift.staff_user = staff_user
            shift.status = 'scheduled'
            shift.save()
            
            # Return the updated shift
            if request.query_params.get('frontend', None) == 'true':
                from .serializers_frontend import FrontendShiftSerializer
                serializer = FrontendShiftSerializer(shift)
            else:
                serializer = self.get_serializer(shift)
                
            return Response(serializer.data)
        except User.DoesNotExist:
            return Response({"error": "Staff not found"}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['post'])
    def unassign(self, request, *args, **kwargs):
        """
        Unassign a staff member from a shift (make it an open shift)
        """
        shift = self.get_object()
        
        if not shift.staff_user:
            return Response({"error": "Shift is already unassigned"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Store for message
        staff_name = f"{shift.staff_user.first_name} {shift.staff_user.last_name}"
        
        # Unassign
        shift.staff_user = None
        shift.status = 'open'
        shift.save()
        
        # Return the updated shift
        if request.query_params.get('frontend', None) == 'true':
            from .serializers_frontend import FrontendShiftSerializer
            serializer = FrontendShiftSerializer(shift)
        else:
            serializer = self.get_serializer(shift)
            
        return Response({
            "message": f"Staff {staff_name} unassigned from shift",
            "shift": serializer.data
        })
    
    @action(detail=False, methods=['post'])
    def publish(self, request, *args, **kwargs):
        """
        Publish multiple shifts (change status from 'draft' to 'published')
        """
        # Get shift IDs - support both snake_case and camelCase
        shift_ids = request.data.get('shift_ids') or request.data.get('shiftIds', [])
        
        if not shift_ids:
            return Response({"error": "No shifts specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get shifts
        shifts = Shift.objects.filter(id__in=shift_ids)
        
        if not shifts.exists():
            return Response({"error": "No matching shifts found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Update status
        count = shifts.update(status='published')
        
        return Response({
            "success": True,
            "message": f"{count} shifts published successfully",
            "count": count
        })
    
    @action(detail=False, methods=['post'])
    def copy(self, request, *args, **kwargs):
        """
        Copy shifts from one month to another
        """
        # Get parameters - support both snake_case and camelCase
        source_month = request.data.get('source_month') or request.data.get('sourceMonth')
        target_month = request.data.get('target_month') or request.data.get('targetMonth')
        
        if not source_month or not target_month:
            return Response({
                "error": "source_month and target_month are required"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse dates
        try:
            source_date = datetime.fromisoformat(source_month.replace('Z', '+00:00'))
            target_date = datetime.fromisoformat(target_month.replace('Z', '+00:00'))
        except ValueError:
            return Response({
                "error": "Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get shifts in source month
        source_shifts = Shift.objects.filter(
            start_time__year=source_date.year,
            start_time__month=source_date.month
        )
        
        if not source_shifts.exists():
            return Response({
                "error": f"No shifts found in source month {source_date.year}-{source_date.month}"
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Calculate month difference
        month_diff = (target_date.year - source_date.year) * 12 + (target_date.month - source_date.month)
        
        # Clone shifts
        new_shifts = []
        for shift in source_shifts:
            # Calculate new dates
            start_time = shift.start_time.replace(
                year=target_date.year,
                month=target_date.month,
                day=min(shift.start_time.day, self._days_in_month(target_date.year, target_date.month))
            )
            
            if shift.end_time:
                # Handle overnight shifts that cross month boundary
                if shift.end_time.month != shift.start_time.month:
                    # Add the same number of days as the original shift
                    days_diff = (shift.end_time.day - shift.start_time.day)
                    if days_diff < 0:  # Handle month boundary crossing in original shift
                        days_diff += self._days_in_month(shift.start_time.year, shift.start_time.month)
                    
                    # Calculate target end day
                    target_end_day = start_time.day + days_diff
                    target_end_month = target_date.month
                    target_end_year = target_date.year
                    
                    # Handle month boundary crossing in target shift
                    days_in_target_month = self._days_in_month(target_date.year, target_date.month)
                    if target_end_day > days_in_target_month:
                        target_end_day -= days_in_target_month
                        target_end_month += 1
                        if target_end_month > 12:
                            target_end_month = 1
                            target_end_year += 1
                    
                    end_time = shift.end_time.replace(
                        year=target_end_year,
                        month=target_end_month,
                        day=target_end_day
                    )
                else:
                    # Regular case - just update the month/year
                    end_time = shift.end_time.replace(
                        year=target_date.year,
                        month=target_date.month,
                        day=min(shift.end_time.day, self._days_in_month(target_date.year, target_date.month))
                    )
            else:
                end_time = None
            
            # Create a new shift based on the source shift
            new_shift = Shift.objects.create(
                venue=shift.venue,
                staff_user=None,  # Don't copy staff assignments
                start_time=start_time,
                end_time=end_time,
                required_security_role=shift.required_security_role,
                status='open',  # Always start as open
                notes=shift.notes
            )
            
            new_shifts.append(new_shift)
        
        # Serialize the result
        if request.query_params.get('frontend', None) == 'true':
            from .serializers_frontend import FrontendShiftSerializer
            serializer = FrontendShiftSerializer(new_shifts, many=True)
        else:
            serializer = self.get_serializer(new_shifts, many=True)
            
        return Response({
            "success": True,
            "message": f"{len(new_shifts)} shifts copied from {source_date.year}-{source_date.month} to {target_date.year}-{target_date.month}",
            "shifts": serializer.data
        })
    
    def _days_in_month(self, year, month):
        """Helper to get the number of days in a month"""
        import calendar
        return calendar.monthrange(year, month)[1]

# Now let's create a ShiftTemplateViewSet
from .models import ShiftTemplate  # Re-import to ensure it's in scope for this class
class ShiftTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ShiftTemplate.objects.all()
    serializer_class = ShiftTemplateSerializer
    
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

class FireExitCheckViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = FireExitCheck.objects.all()
    serializer_class = FireExitCheckSerializer

class CapacityCheckViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CapacityCheck.objects.all()
    serializer_class = CapacityCheckSerializer

class ToiletCheckViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ToiletCheck.objects.all()
    serializer_class = ToiletCheckSerializer

class ShiftExchangeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = ShiftExchange.objects.all()
    serializer_class = ShiftExchangeSerializer

class InvoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    
    def get_queryset(self):
        """Filter invoices to only show those belonging to the requesting user"""
        if self.request.user.role == 'staff':
            return Invoice.objects.filter(staff_user=self.request.user)
        elif self.request.user.role in ['manager', 'admin']:
            # Managers and admins can see all invoices
            return Invoice.objects.all()
        else:
            # Default to only user's own invoices
            return Invoice.objects.filter(staff_user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate an invoice for a staff member for a specific period"""
        try:
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
            
            # Get staff user
            try:
                from api.models import User
                staff_user = User.objects.get(id=staff_user_id)
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
            
            # Generate the invoice
            invoice = Invoice.generate_for_staff_period(staff_user, start_date, end_date)
            
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

class InvoiceItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = InvoiceItem.objects.all()
    serializer_class = InvoiceItemSerializer

class PayRateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PayRate.objects.all()
    serializer_class = PayRateSerializer

class DeputyConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for the DeputyConfig model"""
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
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
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
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeputyEmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = DeputyEmployee.objects.all()
    serializer_class = DeputyEmployeeSerializer

class DeputyTimesheetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = DeputyTimesheet.objects.all()
    serializer_class = DeputyTimesheetSerializer

class SystemSettingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]
    
    def get(self, request):
        """Get the system settings"""
        settings = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data)
    
    def put(self, request):
        """Update the system settings"""
        settings = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def my_profile(request):
    try:
        profile = StaffProfile.objects.get(user=request.user)
    except StaffProfile.DoesNotExist:
        return Response({'detail': 'Profile not found.'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'GET':
        serializer = StaffProfileSerializer(profile)
        return Response(serializer.data)
    elif request.method == 'PATCH':
        serializer = StaffProfileSerializer(profile, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
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

class FileUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, format=None):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided.'}, status=400)
        # Save the file to MEDIA_ROOT/sia_licenses/
        upload_dir = 'sia_licenses/'
        file_path = os.path.join(upload_dir, file_obj.name)
        path = default_storage.save(file_path, ContentFile(file_obj.read()))
        # Build absolute URL
        if settings.MEDIA_URL.startswith('http'):
            file_url = settings.MEDIA_URL + path
        else:
            scheme = request.scheme
            host = request.get_host()
            file_url = f"{scheme}://{host}{settings.MEDIA_URL}{path}"
        return Response({'url': file_url}, status=201)


class EmploymentTypeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing employment types.
    Only admins can create, update, or delete employment types.
    """
    queryset = EmploymentType.objects.all()
    serializer_class = EmploymentTypeSerializer
    permission_classes = [IsAuthenticated]
    
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
    
    def get_queryset(self):
        """
        Return active employment types by default.
        Admins can see all employment types.
        """
        if self.request.user.role == 'admin':
            return EmploymentType.objects.all()
        return EmploymentType.objects.filter(is_active=True)
    
    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """Get only active employment types"""
        active_types = EmploymentType.objects.filter(is_active=True)
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
    
    def get_queryset(self):
        """
        Filter applications based on query parameters.
        """
        queryset = RecruitmentApplication.objects.all()
        
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
        """Convert approved application to user account"""
        application = self.get_object()
        
        try:
            user = application.convert_to_user(request.user)
            return Response({
                'message': 'Application converted to user account successfully',
                'user': UserSerializer(user).data,
                'application': RecruitmentApplicationSerializer(application).data
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """Get recruitment application statistics"""
        stats = {
            'total': RecruitmentApplication.objects.count(),
            'pending': RecruitmentApplication.objects.filter(status='pending').count(),
            'approved': RecruitmentApplication.objects.filter(status='approved').count(),
            'rejected': RecruitmentApplication.objects.filter(status='rejected').count(),
            'converted': RecruitmentApplication.objects.filter(converted_to_user__isnull=False).count(),
        }
        
        # Stats by employment type
        employment_type_stats = {}
        for et in EmploymentType.objects.all():
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