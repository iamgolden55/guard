from rest_framework import permissions
from rest_framework.permissions import BasePermission, SAFE_METHODS
from django.contrib.auth import get_user_model

User = get_user_model()


class LeaveManagementBasePermission(BasePermission):
    """Base permission class for leave management with role checking"""

    def has_permission(self, request, view):
        """Check if user is authenticated and has basic access"""
        if not request.user.is_authenticated:
            return False

        # All authenticated users can access safe methods (GET, HEAD, OPTIONS)
        if request.method in SAFE_METHODS:
            return True

        return True

    def get_user_role(self, user):
        """Get user role from profile"""
        if not hasattr(user, 'profile') or not user.profile:
            return 'staff'

        return getattr(user.profile, 'role', 'staff').lower()

    def is_admin(self, user):
        """Check if user is admin"""
        return user.is_superuser or user.is_staff or self.get_user_role(user) == 'admin'

    def is_manager(self, user):
        """Check if user is manager or above"""
        role = self.get_user_role(user)
        return self.is_admin(user) or role == 'manager'

    def is_staff_user(self, user):
        """Check if user is regular staff"""
        return self.get_user_role(user) == 'staff'


class LeaveTypePermission(LeaveManagementBasePermission):
    """
    Permission class for leave types:
    - Admin: Full CRUD access
    - Manager: Read access only
    - Staff: Read access only
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Read permissions for all authenticated users
        if request.method in SAFE_METHODS:
            return True

        # Write permissions only for admins
        return self.is_admin(request.user)

    def has_object_permission(self, request, view, obj):
        """Object-level permissions for leave types"""
        # Read permissions for all authenticated users
        if request.method in SAFE_METHODS:
            return True

        # Write permissions only for admins
        return self.is_admin(request.user)


class LeavePolicyPermission(LeaveManagementBasePermission):
    """
    Permission class for leave policies:
    - Admin: Full CRUD access
    - Manager: Read access only
    - Staff: Read access only for applicable policies
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Read permissions for all authenticated users
        if request.method in SAFE_METHODS:
            return True

        # Write permissions only for admins
        return self.is_admin(request.user)

    def has_object_permission(self, request, view, obj):
        """Object-level permissions for leave policies"""
        # Read permissions for all authenticated users
        if request.method in SAFE_METHODS:
            return True

        # Write permissions only for admins
        return self.is_admin(request.user)


class LeaveEntitlementPermission(LeaveManagementBasePermission):
    """
    Permission class for leave entitlements:
    - Admin: Full access to all entitlements
    - Manager: Read access to team members' entitlements
    - Staff: Read access to own entitlements only
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        return True

    def has_object_permission(self, request, view, obj):
        """Object-level permissions for leave entitlements"""
        user = request.user

        # Admin can access all entitlements
        if self.is_admin(user):
            return True

        # Manager can read team members' entitlements
        if self.is_manager(user):
            if request.method in SAFE_METHODS:
                # TODO: Add team hierarchy logic when available
                return True
            # Managers cannot modify entitlements directly
            return False

        # Staff can only access their own entitlements
        if request.method in SAFE_METHODS:
            return obj.user == user

        return False


class LeaveBalancePermission(LeaveManagementBasePermission):
    """
    Permission class for leave balances:
    - Admin: Access to all balances
    - Manager: Access to team members' balances
    - Staff: Access to own balances only
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Only allow safe methods for balance viewing
        return request.method in SAFE_METHODS

    def filter_queryset_for_user(self, queryset, user):
        """Filter queryset based on user permissions"""
        if self.is_admin(user):
            return queryset

        if self.is_manager(user):
            # TODO: Filter by team members when team hierarchy is implemented
            # For now, managers can see all balances
            return queryset

        # Staff can only see their own balances
        return queryset.filter(user=user)


class LeaveRequestPermission(LeaveManagementBasePermission):
    """
    Permission class for leave requests:
    - Admin: Full access to all requests
    - Manager: Can approve/reject requests for team members
    - Staff: Can submit requests and view own requests
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        return True

    def has_object_permission(self, request, view, obj):
        """Object-level permissions for leave requests"""
        user = request.user

        # Admin can access all requests
        if self.is_admin(user):
            return True

        # Manager permissions
        if self.is_manager(user):
            # Managers can read all requests and approve/reject team members' requests
            if request.method in SAFE_METHODS:
                return True

            # For modification, check if it's an approval/rejection action
            if hasattr(view, 'action') and view.action in ['approve', 'reject']:
                # TODO: Add team hierarchy check
                return obj.user != user  # Managers can't approve their own requests

            return False

        # Staff permissions
        if self.is_staff_user(user):
            # Staff can view and submit their own requests
            if request.method in SAFE_METHODS or request.method == 'POST':
                return obj.user == user if hasattr(obj, 'user') else True

        return False


class IsOwnerOrManagerOrAdmin(LeaveManagementBasePermission):
    """
    Permission to allow:
    - Object owners to read/write their own objects
    - Managers to read team members' objects
    - Admins to read/write all objects
    """

    def has_object_permission(self, request, view, obj):
        user = request.user

        # Admin has full access
        if self.is_admin(user):
            return True

        # Manager has read access to team members
        if self.is_manager(user):
            if request.method in SAFE_METHODS:
                # TODO: Add team hierarchy check
                return True
            return False

        # Owner has full access to their own objects
        if hasattr(obj, 'user'):
            return obj.user == user

        return False


class AdminOnlyPermission(LeaveManagementBasePermission):
    """Permission that only allows admin users"""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        return self.is_admin(request.user)


class ManagerOrAdminPermission(LeaveManagementBasePermission):
    """Permission that allows managers and admins"""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        return self.is_manager(request.user) or self.is_admin(request.user)


# Utility permission mixins
class ReadOnlyForStaffMixin:
    """Mixin to make viewset read-only for staff users"""

    def get_permissions(self):
        """Override permissions based on user role and action"""
        permission_classes = super().get_permissions()

        if hasattr(self.request, 'user') and self.request.user.is_authenticated:
            base_permission = LeaveManagementBasePermission()

            # If staff user and non-safe method, deny
            if (base_permission.is_staff_user(self.request.user) and
                self.request.method not in SAFE_METHODS):
                permission_classes = [permissions.IsAuthenticated]
                # Add a custom permission that always returns False for write operations
                class DenyWritePermission(BasePermission):
                    def has_permission(self, request, view):
                        return request.method in SAFE_METHODS
                permission_classes.append(DenyWritePermission())

        return permission_classes


# Custom permission for calendar integration
class CalendarAccessPermission(LeaveManagementBasePermission):
    """
    Permission for calendar access:
    - Own calendar: All users
    - Team calendar: Managers and admins
    - System calendar: Admins only
    """

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Check calendar scope from request parameters
        scope = request.query_params.get('scope', 'own')

        if scope == 'own':
            return True
        elif scope == 'team':
            return self.is_manager(request.user)
        elif scope == 'system':
            return self.is_admin(request.user)

        return True  # Default to allowing access


# Permissions for specific leave management workflows
class LeaveApprovalPermission(LeaveManagementBasePermission):
    """Permission specifically for leave approval/rejection actions"""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Only managers and admins can approve/reject
        return self.is_manager(request.user)

    def has_object_permission(self, request, view, obj):
        """Managers cannot approve their own requests"""
        if hasattr(obj, 'user'):
            return obj.user != request.user

        return True


class BulkOperationPermission(LeaveManagementBasePermission):
    """Permission for bulk operations on leave data"""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False

        # Only admins can perform bulk operations
        return self.is_admin(request.user)