from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.urls import reverse
from django.test import TestCase
from decimal import Decimal
import json

from .models import LeaveType, LeavePolicy, LeaveEntitlement
from api.models import EmploymentType, StaffProfile

User = get_user_model()


class LeaveManagementAPITestCase(APITestCase):
    """Base test case for leave management API tests"""

    def setUp(self):
        """Set up test data"""
        # Create users with different roles
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            is_staff=True,
            is_superuser=True
        )

        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='testpass123'
        )

        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@test.com',
            password='testpass123'
        )

        # Create employment type
        self.employment_type = EmploymentType.objects.create(
            name='Full-time',
            description='Full-time employment'
        )

        # Create staff profiles
        self.admin_profile = StaffProfile.objects.create(
            user=self.admin_user,
            employment_type=self.employment_type,
            role='admin'
        )

        self.manager_profile = StaffProfile.objects.create(
            user=self.manager_user,
            employment_type=self.employment_type,
            role='manager'
        )

        self.staff_profile = StaffProfile.objects.create(
            user=self.staff_user,
            employment_type=self.employment_type,
            role='staff'
        )

        # Create leave types
        self.annual_leave = LeaveType.objects.create(
            name='Annual Leave',
            code='AL',
            description='Annual holiday leave',
            color_code='#007bff',
            requires_approval=True,
            min_notice_days=14
        )

        self.sick_leave = LeaveType.objects.create(
            name='Sick Leave',
            code='SL',
            description='Medical leave',
            color_code='#dc3545',
            requires_approval=False,
            min_notice_days=0
        )

        # Create leave policies
        self.annual_policy = LeavePolicy.objects.create(
            name='Standard Annual Leave',
            leave_type=self.annual_leave,
            accrual_method='monthly',
            accrual_rate=Decimal('1.75'),  # 21 days per year
            max_balance=Decimal('30'),
            carryover_method='partial',
            carryover_limit=Decimal('5'),
            is_active=True,
            effective_date=timezone.now().date()
        )

        self.sick_policy = LeavePolicy.objects.create(
            name='Standard Sick Leave',
            leave_type=self.sick_leave,
            accrual_method='annual',
            accrual_rate=Decimal('10'),  # 10 days per year
            max_balance=Decimal('20'),
            carryover_method='none',
            is_active=True,
            effective_date=timezone.now().date()
        )

        # Create entitlements
        current_year = timezone.now().year
        self.staff_annual_entitlement = LeaveEntitlement.objects.create(
            user=self.staff_user,
            policy=self.annual_policy,
            year=current_year,
            annual_entitlement=Decimal('21'),
            accrued_to_date=Decimal('10.5'),  # Half year accrued
            used_to_date=Decimal('5')
        )

        self.staff_sick_entitlement = LeaveEntitlement.objects.create(
            user=self.staff_user,
            policy=self.sick_policy,
            year=current_year,
            annual_entitlement=Decimal('10'),
            accrued_to_date=Decimal('10'),
            used_to_date=Decimal('2')
        )

        self.client = APIClient()

    def authenticate_user(self, user):
        """Helper method to authenticate a user"""
        self.client.force_authenticate(user=user)

    def get_url(self, viewname, *args, **kwargs):
        """Helper method to get URL with namespace"""
        return reverse(f'leave_management:{viewname}', *args, **kwargs)


class LeaveTypeAPITests(LeaveManagementAPITestCase):
    """Tests for Leave Type API endpoints"""

    def test_list_leave_types_unauthenticated(self):
        """Test that unauthenticated users cannot access leave types"""
        url = self.get_url('leave-types-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_leave_types_as_staff(self):
        """Test that staff users can list leave types"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-types-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_leave_type_as_admin(self):
        """Test that admin users can create leave types"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-types-list')
        data = {
            'name': 'Maternity Leave',
            'code': 'ML',
            'description': 'Maternity leave',
            'color_code': '#28a745',
            'requires_approval': True,
            'min_notice_days': 30
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Maternity Leave')
        self.assertEqual(response.data['code'], 'ML')

    def test_create_leave_type_as_staff_denied(self):
        """Test that staff users cannot create leave types"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-types-list')
        data = {
            'name': 'Test Leave',
            'code': 'TL',
            'color_code': '#000000'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_active_leave_types(self):
        """Test getting only active leave types"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-types-active')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # All leave types should be active by default
        self.assertEqual(len(response.data), 2)

    def test_toggle_leave_type_active_as_admin(self):
        """Test toggling leave type active status as admin"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-types-toggle-active', pk=self.annual_leave.pk)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Refresh from database
        self.annual_leave.refresh_from_db()
        self.assertFalse(self.annual_leave.is_active)

    def test_leave_type_validation(self):
        """Test leave type validation rules"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-types-list')

        # Test duplicate code validation
        data = {
            'name': 'Another Annual Leave',
            'code': 'AL',  # Duplicate code
            'color_code': '#007bff'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usage_statistics_as_manager(self):
        """Test getting usage statistics as manager"""
        self.authenticate_user(self.manager_user)
        url = self.get_url('leave-types-usage-statistics')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)


class LeavePolicyAPITests(LeaveManagementAPITestCase):
    """Tests for Leave Policy API endpoints"""

    def test_list_leave_policies_as_staff(self):
        """Test that staff users can list applicable leave policies"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-policies-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_leave_policy_as_admin(self):
        """Test that admin users can create leave policies"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-policies-list')
        data = {
            'name': 'Senior Annual Leave',
            'leave_type_id': self.annual_leave.id,
            'accrual_method': 'monthly',
            'accrual_rate': '2.0',
            'max_balance': '35',
            'carryover_method': 'full',
            'is_active': True,
            'effective_date': timezone.now().date().isoformat()
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Senior Annual Leave')

    def test_create_leave_policy_as_staff_denied(self):
        """Test that staff users cannot create leave policies"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-policies-list')
        data = {
            'name': 'Test Policy',
            'leave_type_id': self.annual_leave.id,
            'accrual_method': 'monthly',
            'accrual_rate': '1.0'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_policies_for_user(self):
        """Test getting policies applicable to current user"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-policies-for-user')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_duplicate_policy_as_admin(self):
        """Test duplicating a leave policy"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-policies-duplicate', pk=self.annual_policy.pk)
        data = {'name': 'Duplicated Annual Policy'}
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('duplicated successfully', response.data['message'])

    def test_policy_validation(self):
        """Test leave policy validation rules"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-policies-list')

        # Test missing required fields
        data = {
            'name': 'Invalid Policy'
            # Missing leave_type_id
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_policy_impact(self):
        """Test previewing policy impact"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-policies-preview-impact', pk=self.annual_policy.pk)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('impact', response.data)
        self.assertIn('affected_users_count', response.data['impact'])


class LeaveBalanceAPITests(LeaveManagementAPITestCase):
    """Tests for Leave Balance API endpoints"""

    def test_list_leave_balances_as_staff(self):
        """Test that staff users can list their own balances"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-balances-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Staff should see their own entitlements
        self.assertEqual(len(response.data), 2)

    def test_list_leave_balances_as_admin(self):
        """Test that admin users can list all balances"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-balances-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_get_my_balances(self):
        """Test getting current user's balances"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-balances-my-balances')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_balance_summary(self):
        """Test getting balance summary"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-balances-summary')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_recalculate_all_balances_as_admin(self):
        """Test recalculating all balances as admin"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-balances-recalculate-all')
        response = self.client.post(url, {'year': timezone.now().year})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('updated_count', response.data)

    def test_recalculate_balances_as_staff_denied(self):
        """Test that staff cannot recalculate all balances"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-balances-recalculate-all')
        response = self.client.post(url, {'year': timezone.now().year})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_team_summary_as_manager(self):
        """Test getting team summary as manager"""
        self.authenticate_user(self.manager_user)
        url = self.get_url('leave-balances-team-summary')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)


class LeaveRequestAPITests(LeaveManagementAPITestCase):
    """Tests for Leave Request API endpoints (placeholder tests for TASK-012)"""

    def test_list_leave_requests(self):
        """Test listing leave requests - placeholder"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-requests-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('placeholder', response.data['status'])

    def test_submit_leave_request(self):
        """Test submitting leave request - placeholder"""
        self.authenticate_user(self.staff_user)
        url = self.get_url('leave-requests-list')
        data = {
            'leave_type_id': self.annual_leave.id,
            'start_date': '2024-01-15',
            'end_date': '2024-01-19',
            'days_requested': '5',
            'reason': 'Family vacation'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('placeholder', response.data['status'])

    def test_approve_leave_request(self):
        """Test approving leave request - placeholder"""
        self.authenticate_user(self.manager_user)
        url = self.get_url('leave-requests-approve', pk=1)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('placeholder', response.data['status'])


class LeaveAPIPermissionTests(LeaveManagementAPITestCase):
    """Tests for API permission enforcement"""

    def test_staff_cannot_access_admin_endpoints(self):
        """Test that staff users cannot access admin-only endpoints"""
        self.authenticate_user(self.staff_user)

        # Try to create leave type
        url = self.get_url('leave-types-list')
        response = self.client.post(url, {'name': 'Test', 'code': 'T'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try to create leave policy
        url = self.get_url('leave-policies-list')
        response = self.client.post(url, {'name': 'Test Policy'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_read_permissions(self):
        """Test manager read permissions"""
        self.authenticate_user(self.manager_user)

        # Managers should be able to read all data
        url = self.get_url('leave-types-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        url = self.get_url('leave-policies-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unauthenticated_access_denied(self):
        """Test that unauthenticated users are denied access"""
        endpoints = [
            self.get_url('leave-types-list'),
            self.get_url('leave-policies-list'),
            self.get_url('leave-balances-list'),
            self.get_url('leave-requests-list'),
        ]

        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class LeaveAPIFilteringTests(LeaveManagementAPITestCase):
    """Tests for API filtering and query parameters"""

    def test_filter_active_leave_types(self):
        """Test filtering leave types by active status"""
        self.authenticate_user(self.staff_user)
        url = f"{self.get_url('leave-types-list')}?active_only=true"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filter_policies_by_leave_type(self):
        """Test filtering policies by leave type"""
        self.authenticate_user(self.staff_user)
        url = f"{self.get_url('leave-policies-list')}?leave_type={self.annual_leave.id}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_search_leave_types(self):
        """Test searching leave types"""
        self.authenticate_user(self.staff_user)
        url = f"{self.get_url('leave-types-list')}?search=Annual"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_ordering_leave_types(self):
        """Test ordering leave types"""
        self.authenticate_user(self.staff_user)
        url = f"{self.get_url('leave-types-list')}?ordering=name"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class LeaveAPIValidationTests(LeaveManagementAPITestCase):
    """Tests for API data validation"""

    def test_leave_type_code_uppercase_conversion(self):
        """Test that leave type codes are converted to uppercase"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-types-list')
        data = {
            'name': 'Test Leave',
            'code': 'tl',  # lowercase
            'color_code': '#000000'
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['code'], 'TL')  # Should be uppercase

    def test_invalid_color_code_validation(self):
        """Test validation of color codes"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-types-list')
        data = {
            'name': 'Test Leave',
            'code': 'TL',
            'color_code': 'invalid'  # Invalid color code
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_leave_policy_date_validation(self):
        """Test leave policy date validation"""
        self.authenticate_user(self.admin_user)
        url = self.get_url('leave-policies-list')
        data = {
            'name': 'Test Policy',
            'leave_type_id': self.annual_leave.id,
            'accrual_method': 'monthly',
            'accrual_rate': '1.0',
            'effective_date': '2024-01-01',
            'expiry_date': '2023-12-31'  # Before effective date
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)