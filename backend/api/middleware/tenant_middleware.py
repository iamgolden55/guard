"""
Multi-tenant middleware for company-based data isolation.
Ensures users can only access data belonging to their companies.
"""
import logging
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import models
from ..models import SecurityCompany, UserCompanyMembership

User = get_user_model()
logger = logging.getLogger(__name__)


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to handle multi-tenant company context.

    Sets the current company context for authenticated users and ensures
    data isolation between companies. Users can only access data belonging
    to their current company context.
    """

    def process_request(self, request):
        """
        Process incoming request to set company context.

        The company context can be set via:
        1. HTTP header: X-Company-ID
        2. URL parameter: company_id
        3. Default to user's primary company
        """
        # Skip for unauthenticated users
        if not request.user or not request.user.is_authenticated:
            request.current_company = None
            return None

        try:
            # Try to get company ID from various sources
            company_id = self._get_company_id_from_request(request)

            if company_id:
                # Validate user has access to this company
                company = self._validate_user_company_access(request.user, company_id)
                if company:
                    request.current_company = company
                    # Update last accessed time
                    self._update_last_accessed(request.user, company)
                else:
                    return JsonResponse(
                        {'error': 'Access denied to specified company'},
                        status=403
                    )
            else:
                # Use user's primary company
                request.current_company = self._get_user_primary_company(request.user)

            # Store company context for database queries
            if request.current_company:
                request.company_id = request.current_company.id
            else:
                request.company_id = None

        except Exception as e:
            logger.error(f"Error in TenantMiddleware: {str(e)}")
            request.current_company = None
            request.company_id = None

        return None

    def process_response(self, request, response):
        """
        Add company context headers to response.
        """
        if hasattr(request, 'current_company') and request.current_company:
            response['X-Current-Company'] = str(request.current_company.id)
            response['X-Company-Name'] = request.current_company.name

        return response

    def _get_company_id_from_request(self, request):
        """
        Extract company ID from request headers or parameters.
        """
        # Check HTTP header first (preferred for API calls)
        company_id = request.META.get('HTTP_X_COMPANY_ID')

        if not company_id:
            # Check URL parameter (for web interface)
            company_id = request.GET.get('company_id') or request.POST.get('company_id')

        if not company_id:
            # Check JSON body for API requests
            if hasattr(request, 'data') and isinstance(request.data, dict):
                company_id = request.data.get('company_id')

        return company_id

    def _validate_user_company_access(self, user, company_id):
        """
        Validate that user has access to the specified company.
        """
        try:
            membership = UserCompanyMembership.objects.select_related('company').get(
                user=user,
                company_id=company_id,
                is_active=True
            )

            # Additional check for company active status
            if not membership.company.is_active:
                logger.warning(f"User {user.username} tried to access inactive company {company_id}")
                return None

            return membership.company

        except UserCompanyMembership.DoesNotExist:
            logger.warning(f"User {user.username} has no access to company {company_id}")
            return None

    def _get_user_primary_company(self, user):
        """
        Get user's primary company (first active membership or owner company).
        """
        try:
            # First try to find owned company
            membership = UserCompanyMembership.objects.select_related('company').filter(
                user=user,
                is_owner=True,
                is_active=True,
                company__is_active=True
            ).first()

            if membership:
                return membership.company

            # Otherwise get first active membership
            membership = UserCompanyMembership.objects.select_related('company').filter(
                user=user,
                is_active=True,
                company__is_active=True
            ).order_by('-joined_at').first()

            if membership:
                return membership.company

            return None

        except Exception as e:
            logger.error(f"Error getting primary company for user {user.username}: {str(e)}")
            return None

    def _update_last_accessed(self, user, company):
        """
        Update the last accessed timestamp for user's company membership.
        """
        try:
            UserCompanyMembership.objects.filter(
                user=user,
                company=company,
                is_active=True
            ).update(last_accessed_at=timezone.now())
        except Exception as e:
            logger.error(f"Error updating last accessed time: {str(e)}")


class TenantQuerySetMixin:
    """
    Mixin for querysets to automatically filter by current company.
    """

    def filter_by_company(self, company_or_id):
        """
        Filter queryset by company.
        """
        if isinstance(company_or_id, SecurityCompany):
            company_id = company_or_id.id
        else:
            company_id = company_or_id

        return self.filter(company_id=company_id)


class TenantModelMixin:
    """
    Mixin for models that belong to a company.
    Provides helper methods for company-aware operations.
    """

    def belongs_to_company(self, company):
        """
        Check if this instance belongs to the specified company.
        """
        return hasattr(self, 'company') and self.company == company

    @classmethod
    def get_for_company(cls, company):
        """
        Get all instances for a specific company.
        """
        return cls.objects.filter(company=company)


def get_current_company(request):
    """
    Utility function to get current company from request.
    """
    return getattr(request, 'current_company', None)


def resolve_request_company(request):
    """
    Resolve the single SecurityCompany in scope for this request, or None.

    TenantMiddleware cannot do this on its own for API traffic: it runs before
    DRF authenticates the request, and LoginView issues JWTs without ever
    calling django.contrib.auth.login(), so there is no session and
    request.user is AnonymousUser at middleware time. request.current_company
    is therefore None on every API request. This helper works off the
    DRF-authenticated request.user instead.

    It deliberately returns ONE company, never a set. Filtering by "every
    company this user belongs to" does not isolate anything: an admin of both
    A and B could still push A's invoice into B's accounting org.

    Callers must fail closed on None -- return an empty queryset, not
    everything.
    """
    # Honour the middleware's answer if it ever manages to set one; this keeps
    # the helper correct if TenantMiddleware is fixed to run after DRF auth.
    company = getattr(request, 'current_company', None)
    if company:
        return company

    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return None

    membership = UserCompanyMembership.objects.select_related('company').filter(
        user=user,
        is_owner=True,
        is_active=True,
        company__is_active=True
    ).first()

    if not membership:
        membership = UserCompanyMembership.objects.select_related('company').filter(
            user=user,
            is_active=True,
            company__is_active=True
        ).order_by('-joined_at').first()

    return membership.company if membership else None


def require_company_access(view_func):
    """
    Decorator to require company access for views.
    """
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'current_company') or not request.current_company:
            return JsonResponse(
                {'error': 'Company context required'},
                status=400
            )
        return view_func(request, *args, **kwargs)

    return wrapper


# Custom manager for company-aware models
class CompanyManager(models.Manager):
    """
    Manager that automatically filters by current company context.
    """

    def get_queryset(self):
        """
        Return the default queryset for this manager.
        """
        return super().get_queryset()

    def for_company(self, company):
        """
        Filter by company.
        """
        return self.get_queryset().filter(company=company)

    def for_current_company(self, request):
        """
        Filter by current company from request context.
        """
        company = get_current_company(request)
        if company:
            return self.for_company(company)
        return self.none()


# Context processor for templates
def company_context(request):
    """
    Context processor to add company information to template context.
    """
    context = {}

    if hasattr(request, 'current_company') and request.current_company:
        context.update({
            'current_company': request.current_company,
            'company_name': request.current_company.name,
            'company_id': str(request.current_company.id),
            'subscription_tier': request.current_company.subscription_tier,
        })

        # Add user's company memberships for company switcher
        if request.user.is_authenticated:
            user_companies = UserCompanyMembership.objects.filter(
                user=request.user,
                is_active=True,
                company__is_active=True
            ).select_related('company').order_by('company__name')

            context['user_companies'] = [
                {
                    'id': str(membership.company.id),
                    'name': membership.company.name,
                    'role': membership.role,
                    'is_current': membership.company == request.current_company
                }
                for membership in user_companies
            ]

    return context