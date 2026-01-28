"""
Subscription-based Feature Access Permissions

These permission classes enforce feature restrictions based on company subscription status.
Features are gated based on:
1. Trial status (all features enabled during trial)
2. Subscription tier (starter, professional, enterprise, custom)
3. Subscription expiration (active vs expired)

Usage:
    from api.permissions import HasLeaveManagementAccess

    class LeaveRequestViewSet(viewsets.ModelViewSet):
        permission_classes = [IsAuthenticated, HasLeaveManagementAccess]
"""
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response


class HasFeatureAccess(BasePermission):
    """
    Base permission class that checks subscription-based feature access.

    Subclasses should set `feature_name` to the feature they're gating:
    - leave_management
    - deputy_integration
    - compliance_tracking
    - advanced_reports
    - multi_venue (10+ venues)
    - api_access
    - custom_branding
    - priority_support
    """
    feature_name = None

    # Default tier requirements for features
    FEATURE_TIER_REQUIREMENTS = {
        'leave_management': 'professional',
        'deputy_integration': 'professional',
        'compliance_tracking': 'professional',
        'advanced_reports': 'professional',
        'multi_venue': 'professional',
        'api_access': 'enterprise',
        'custom_branding': 'enterprise',
        'priority_support': 'enterprise',
    }

    def has_permission(self, request, view):
        """
        Check if the user's company has access to the feature.

        Returns True if:
        - User is authenticated
        - User has a company
        - Company has feature access (via trial or subscription tier)
        """
        if not request.user.is_authenticated:
            return False

        # Get company from user's profile or membership
        company = self._get_user_company(request.user)
        if not company:
            self.message = {
                'error': 'no_company',
                'message': 'You must be associated with a company to access this feature.',
            }
            return False

        # Check feature access
        if not company.has_feature_access(self.feature_name):
            subscription_status = company.get_subscription_status()
            required_tier = self.FEATURE_TIER_REQUIREMENTS.get(self.feature_name, 'professional')

            self.message = {
                'error': 'feature_restricted',
                'feature': self.feature_name,
                'required_tier': required_tier,
                'current_tier': company.subscription_tier,
                'subscription_status': subscription_status,
                'is_trial': company.is_trial,
                'trial_days_remaining': company.get_trial_days_remaining() if company.is_trial else 0,
                'message': self._get_denial_message(subscription_status, required_tier),
            }
            return False

        return True

    def _get_user_company(self, user):
        """
        Get the user's company from their profile or membership.
        Handles different user/company relationship patterns.
        """
        # Try StaffProfile.company first (most common pattern)
        if hasattr(user, 'profile') and user.profile and hasattr(user.profile, 'company'):
            return user.profile.company

        # Try direct company memberships
        if hasattr(user, 'company_memberships'):
            membership = user.company_memberships.filter(is_active=True).first()
            if membership:
                return membership.company

        # Try UserCompanyMembership model
        try:
            from .models import UserCompanyMembership
            membership = UserCompanyMembership.objects.filter(
                user=user,
                is_active=True
            ).select_related('company').first()
            if membership:
                return membership.company
        except ImportError:
            pass

        return None

    def _get_denial_message(self, subscription_status, required_tier):
        """Generate user-friendly denial message based on subscription status."""
        tier_names = {
            'starter': 'Starter',
            'professional': 'Professional',
            'enterprise': 'Enterprise',
            'custom': 'Custom',
        }
        required_name = tier_names.get(required_tier, required_tier.title())

        if subscription_status == 'trial_expired':
            return (
                f'Your trial has expired. This feature requires a {required_name} subscription. '
                'Please upgrade to continue using this feature.'
            )
        elif subscription_status == 'subscription_expired':
            return (
                f'Your subscription has expired. This feature requires an active {required_name} subscription. '
                'Please renew your subscription to continue using this feature.'
            )
        else:
            return (
                f'This feature requires a {required_name} subscription. '
                f'Please upgrade from your current plan to access this feature.'
            )


class HasLeaveManagementAccess(HasFeatureAccess):
    """Permission class for leave management features."""
    feature_name = 'leave_management'


class HasDeputyIntegrationAccess(HasFeatureAccess):
    """Permission class for Deputy workforce management integration."""
    feature_name = 'deputy_integration'


class HasComplianceTrackingAccess(HasFeatureAccess):
    """Permission class for compliance tracking features."""
    feature_name = 'compliance_tracking'


class HasAdvancedReportsAccess(HasFeatureAccess):
    """Permission class for advanced reporting features."""
    feature_name = 'advanced_reports'


class HasMultiVenueAccess(HasFeatureAccess):
    """Permission class for multi-venue management (10+ venues)."""
    feature_name = 'multi_venue'


class HasApiAccess(HasFeatureAccess):
    """Permission class for API access (enterprise feature)."""
    feature_name = 'api_access'


class HasCustomBrandingAccess(HasFeatureAccess):
    """Permission class for custom branding features."""
    feature_name = 'custom_branding'


class HasPrioritySupportAccess(HasFeatureAccess):
    """Permission class for priority support features."""
    feature_name = 'priority_support'


# Combined permission classes for convenience
class IsAuthenticatedWithLeaveAccess(BasePermission):
    """
    Combines IsAuthenticated and HasLeaveManagementAccess for common use case.
    """
    def has_permission(self, request, view):
        auth_perm = IsAuthenticated()
        leave_perm = HasLeaveManagementAccess()

        if not auth_perm.has_permission(request, view):
            return False

        return leave_perm.has_permission(request, view)


class IsAuthenticatedWithDeputyAccess(BasePermission):
    """
    Combines IsAuthenticated and HasDeputyIntegrationAccess for common use case.
    """
    def has_permission(self, request, view):
        auth_perm = IsAuthenticated()
        deputy_perm = HasDeputyIntegrationAccess()

        if not auth_perm.has_permission(request, view):
            return False

        return deputy_perm.has_permission(request, view)


class IsAuthenticatedWithComplianceAccess(BasePermission):
    """
    Combines IsAuthenticated and HasComplianceTrackingAccess for common use case.
    """
    def has_permission(self, request, view):
        auth_perm = IsAuthenticated()
        compliance_perm = HasComplianceTrackingAccess()

        if not auth_perm.has_permission(request, view):
            return False

        return compliance_perm.has_permission(request, view)


# Feature access mixin for viewsets
class FeatureAccessMixin:
    """
    Mixin to add feature access checking to viewsets.

    Usage:
        class LeaveRequestViewSet(FeatureAccessMixin, viewsets.ModelViewSet):
            required_feature = 'leave_management'
    """
    required_feature = None

    def get_permissions(self):
        """Add feature-based permission to existing permissions."""
        permissions = super().get_permissions()

        if self.required_feature:
            feature_permission_map = {
                'leave_management': HasLeaveManagementAccess,
                'deputy_integration': HasDeputyIntegrationAccess,
                'compliance_tracking': HasComplianceTrackingAccess,
                'advanced_reports': HasAdvancedReportsAccess,
                'multi_venue': HasMultiVenueAccess,
                'api_access': HasApiAccess,
                'custom_branding': HasCustomBrandingAccess,
                'priority_support': HasPrioritySupportAccess,
            }

            permission_class = feature_permission_map.get(self.required_feature)
            if permission_class:
                permissions.append(permission_class())

        return permissions
