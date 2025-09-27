"""
Test suite for the new leave management API endpoints

Tests the comprehensive implementation of:
- Team Overview endpoints
- Leave Reports endpoints
- Leave System Settings endpoints
- Enhanced Leave Request workflow
"""

from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.urls import reverse
from django.test import TestCase
from decimal import Decimal
from datetime import date, timedelta
import json

from .models import (
    LeaveType, LeavePolicy, LeaveEntitlement, LeaveRequest,
    BlackoutPeriod, LeaveBalance
)
from api.models import EmploymentType, StaffProfile, Venue

User = get_user_model()


class TeamOverviewAPITestCase(APITestCase):
    """Test Team Overview endpoints"""

    def setUp(self):
        """Set up test data"""
        # Create users
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            role='admin'
        )

        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='testpass123',
            role='manager'
        )

        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@test.com',
            password='testpass123',
            role='staff'
        )

        # Create employment type
        self.employment_type = EmploymentType.objects.create(
            name='Full-time',
            description='Full-time employment'
        )

        # Create staff profiles
        for user in [self.admin_user, self.manager_user, self.staff_user]:
            StaffProfile.objects.create(
                user=user,
                employment_type=self.employment_type,
                hourly_rate=Decimal('25.00')
            )

        # Create leave type and policy
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL',
            color_code='#007bff'
        )

        self.leave_policy = LeavePolicy.objects.create(
            name='Standard Annual Leave',
            leave_type=self.leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('1.67'),
            max_balance=Decimal('20')
        )

        # Create entitlements
        current_year = timezone.now().year
        for user in [self.admin_user, self.manager_user, self.staff_user]:
            LeaveEntitlement.objects.create(
                user=user,
                policy=self.leave_policy,
                year=current_year,
                annual_entitlement=Decimal('20'),
                accrued_to_date=Decimal('10'),
                used_to_date=Decimal('2')
            )

        self.client = APIClient()

    def test_team_overview_list_admin(self):
        """Test team overview list as admin"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:team-overview-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('team_members', response.data)
        self.assertIn('summary', response.data)
        self.assertEqual(response.data['summary']['total_team_members'], 3)

    def test_team_overview_list_staff_forbidden(self):
        """Test team overview list as staff (should be forbidden)"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('leave_management:team-overview-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_team_balances(self):
        """Test team balances endpoint"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:team-overview-team-balances')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('team_balances', response.data)
        self.assertIn('year', response.data)
        self.assertTrue(len(response.data['team_balances']) > 0)

    def test_team_calendar(self):
        """Test team calendar endpoint"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:team-overview-team-calendar')

        # Test with date range
        start_date = date.today().replace(day=1)
        end_date = start_date + timedelta(days=30)

        response = self.client.get(url, {
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d')
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('calendar_data', response.data)
        self.assertIn('period', response.data)
        self.assertIn('summary', response.data)

    def test_pending_requests(self):
        """Test pending requests endpoint"""
        # Create a pending leave request
        LeaveRequest.objects.create(
            staff_user=self.staff_user,
            leave_type=self.leave_type,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=7),
            days_requested=Decimal('1'),
            reason='Test leave request',
            status='pending',
            submitted_at=timezone.now()
        )

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:team-overview-pending-requests')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('pending_requests', response.data)
        self.assertIn('count', response.data)
        self.assertIn('urgent_requests', response.data)
        self.assertEqual(response.data['count'], 1)


class LeaveReportsAPITestCase(APITestCase):
    """Test Leave Reports endpoints"""

    def setUp(self):
        """Set up test data"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            role='admin'
        )

        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='testpass123',
            role='manager'
        )

        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@test.com',
            password='testpass123',
            role='staff'
        )

        self.client = APIClient()

    def test_reports_list_admin(self):
        """Test reports list as admin"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:leave-reports-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('available_reports', response.data)
        self.assertIn('quick_metrics', response.data)

    def test_reports_list_staff_forbidden(self):
        """Test reports list as staff (should be forbidden)"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('leave_management:leave-reports-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analytics_report(self):
        """Test analytics report endpoint"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:leave-reports-analytics')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('summary', response.data)
        self.assertIn('leave_types_breakdown', response.data)
        self.assertIn('monthly_trends', response.data)

    def test_usage_summary_report(self):
        """Test usage summary report endpoint"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:leave-reports-usage-summary')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('overall_summary', response.data)
        self.assertIn('by_leave_type', response.data)
        self.assertIn('by_employment_type', response.data)

    def test_export_report(self):
        """Test export report endpoint"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:leave-reports-export')

        # Test JSON export
        response = self.client.get(url, {'format': 'json', 'type': 'analytics'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('data', response.data)
        self.assertIn('export_format', response.data)


class LeaveSettingsAPITestCase(APITestCase):
    """Test Leave System Settings endpoints"""

    def setUp(self):
        """Set up test data"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            role='admin'
        )

        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='testpass123',
            role='manager'
        )

        self.client = APIClient()

    def test_settings_overview_admin(self):
        """Test settings overview as admin"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:leave-settings-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('system_settings', response.data)
        self.assertIn('active_blackout_periods', response.data)

    def test_settings_overview_manager_forbidden(self):
        """Test settings overview as manager (should be forbidden)"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:leave-settings-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_config_get(self):
        """Test get system configuration"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:leave-settings-system-config')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('working_week', response.data)
        self.assertIn('approval_settings', response.data)
        self.assertIn('notification_settings', response.data)

    def test_system_config_update(self):
        """Test update system configuration"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:leave-settings-system-config')

        config_data = {
            'working_week': {
                'days_per_week': 5,
                'hours_per_day': 8
            },
            'approval_settings': {
                'require_manager_notes_on_rejection': False
            }
        }

        response = self.client.put(url, config_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('updated_config', response.data)


class BlackoutPeriodsAPITestCase(APITestCase):
    """Test Blackout Periods endpoints"""

    def setUp(self):
        """Set up test data"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            role='admin'
        )

        # Create venue for testing
        self.venue = Venue.objects.create(
            name='Test Venue',
            address='123 Test St',
            postcode='12345',
            capacity=100
        )

        # Create leave type
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL',
            color_code='#007bff'
        )

        # Create blackout period
        self.blackout_period = BlackoutPeriod.objects.create(
            name='Christmas Blackout',
            description='No leave allowed during Christmas period',
            start_date=date(2024, 12, 23),
            end_date=date(2024, 12, 31),
            restriction_level='no_requests',
            is_active=True
        )

        self.client = APIClient()

    def test_blackout_periods_list(self):
        """Test blackout periods list"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:blackout-periods-list')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('blackout_periods', response.data)
        self.assertIn('summary', response.data)

    def test_blackout_periods_create(self):
        """Test create blackout period"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:blackout-periods-list')

        data = {
            'name': 'Summer Blackout',
            'description': 'Limited leave during summer period',
            'start_date': '2024-07-01',
            'end_date': '2024-07-31',
            'restriction_level': 'limit_percentage',
            'max_staff_percentage': 20,
            'is_active': True
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BlackoutPeriod.objects.count(), 2)

    def test_current_restrictions(self):
        """Test current restrictions endpoint"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:blackout-periods-current-restrictions')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('current_restrictions', response.data)
        self.assertIn('count', response.data)

    def test_check_conflicts(self):
        """Test check conflicts endpoint"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:blackout-periods-check-conflicts')

        # Check for conflicts with existing blackout period
        response = self.client.get(url, {
            'start_date': '2024-12-25',
            'end_date': '2024-12-30'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('has_conflicts', response.data)
        self.assertIn('conflicting_periods', response.data)
        self.assertTrue(response.data['has_conflicts'])

    def test_bulk_create(self):
        """Test bulk create blackout periods"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('leave_management:blackout-periods-bulk-create')

        data = {
            'blackout_periods': [
                {
                    'name': 'Easter Blackout',
                    'description': 'Easter period restrictions',
                    'start_date': '2024-04-01',
                    'end_date': '2024-04-07',
                    'restriction_level': 'emergency_only',
                    'is_active': True
                },
                {
                    'name': 'Summer Peak',
                    'description': 'Summer busy period',
                    'start_date': '2024-08-01',
                    'end_date': '2024-08-15',
                    'restriction_level': 'limit_percentage',
                    'max_staff_percentage': 30,
                    'is_active': True
                }
            ]
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['created_count'], 2)
        self.assertEqual(response.data['error_count'], 0)


class EnhancedLeaveRequestAPITestCase(APITestCase):
    """Test Enhanced Leave Request workflow"""

    def setUp(self):
        """Set up test data"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            role='admin'
        )

        self.manager_user = User.objects.create_user(
            username='manager',
            email='manager@test.com',
            password='testpass123',
            role='manager'
        )

        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@test.com',
            password='testpass123',
            role='staff'
        )

        # Create employment type
        self.employment_type = EmploymentType.objects.create(
            name='Full-time',
            description='Full-time employment'
        )

        # Create staff profiles
        for user in [self.admin_user, self.manager_user, self.staff_user]:
            StaffProfile.objects.create(
                user=user,
                employment_type=self.employment_type,
                hourly_rate=Decimal('25.00')
            )

        # Create leave type and policy
        self.leave_type = LeaveType.objects.create(
            name='Annual Leave',
            code='AL',
            color_code='#007bff'
        )

        self.leave_policy = LeavePolicy.objects.create(
            name='Standard Annual Leave',
            leave_type=self.leave_type,
            accrual_method='monthly',
            accrual_rate=Decimal('1.67'),
            max_balance=Decimal('20')
        )

        # Create entitlement for staff user
        current_year = timezone.now().year
        self.entitlement = LeaveEntitlement.objects.create(
            user=self.staff_user,
            policy=self.leave_policy,
            year=current_year,
            annual_entitlement=Decimal('20'),
            accrued_to_date=Decimal('20'),
            used_to_date=Decimal('0')
        )

        self.client = APIClient()

    def test_create_leave_request_with_validation(self):
        """Test creating leave request with business rule validation"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('leave_management:leave-requests-list')

        data = {
            'leave_type': self.leave_type.id,
            'start_date': (date.today() + timedelta(days=7)).strftime('%Y-%m-%d'),
            'end_date': (date.today() + timedelta(days=7)).strftime('%Y-%m-%d'),
            'days_requested': '1.0',
            'reason': 'Personal day off',
            'request_type': 'full_day'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('leave_request', response.data)
        self.assertIn('message', response.data)

        # Verify the request was created
        self.assertEqual(LeaveRequest.objects.count(), 1)
        leave_request = LeaveRequest.objects.first()
        self.assertEqual(leave_request.staff_user, self.staff_user)
        self.assertEqual(leave_request.status, 'pending')

    def test_create_leave_request_insufficient_balance(self):
        """Test creating leave request with insufficient balance"""
        # Reduce balance to test insufficient balance scenario
        self.entitlement.used_to_date = Decimal('19')
        self.entitlement.save()

        self.client.force_authenticate(user=self.staff_user)
        url = reverse('leave_management:leave-requests-list')

        data = {
            'leave_type': self.leave_type.id,
            'start_date': (date.today() + timedelta(days=7)).strftime('%Y-%m-%d'),
            'end_date': (date.today() + timedelta(days=9)).strftime('%Y-%m-%d'),
            'days_requested': '3.0',
            'reason': 'Long weekend',
            'request_type': 'full_day'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('Insufficient leave balance', response.data['error'])

    def test_approve_leave_request(self):
        """Test approving a leave request"""
        # Create a pending leave request
        leave_request = LeaveRequest.objects.create(
            staff_user=self.staff_user,
            leave_type=self.leave_type,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=7),
            days_requested=Decimal('1'),
            reason='Test leave request',
            status='pending',
            submitted_at=timezone.now()
        )

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:leave-requests-approve', args=[leave_request.id])

        data = {
            'notes': 'Approved - enjoy your day off'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

        # Verify the request was approved
        leave_request.refresh_from_db()
        self.assertEqual(leave_request.status, 'approved')
        self.assertEqual(leave_request.approved_by, self.manager_user)

    def test_reject_leave_request(self):
        """Test rejecting a leave request"""
        # Create a pending leave request
        leave_request = LeaveRequest.objects.create(
            staff_user=self.staff_user,
            leave_type=self.leave_type,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=7),
            days_requested=Decimal('1'),
            reason='Test leave request',
            status='pending',
            submitted_at=timezone.now()
        )

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:leave-requests-reject', args=[leave_request.id])

        data = {
            'notes': 'Rejected - insufficient coverage'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

        # Verify the request was rejected
        leave_request.refresh_from_db()
        self.assertEqual(leave_request.status, 'rejected')
        self.assertEqual(leave_request.approved_by, self.manager_user)
        self.assertEqual(leave_request.manager_notes, 'Rejected - insufficient coverage')

    def test_my_requests(self):
        """Test getting user's own requests"""
        # Create some requests for the staff user
        LeaveRequest.objects.create(
            staff_user=self.staff_user,
            leave_type=self.leave_type,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=7),
            days_requested=Decimal('1'),
            reason='Test leave request 1',
            status='pending'
        )

        LeaveRequest.objects.create(
            staff_user=self.staff_user,
            leave_type=self.leave_type,
            start_date=date.today() + timedelta(days=14),
            end_date=date.today() + timedelta(days=14),
            days_requested=Decimal('1'),
            reason='Test leave request 2',
            status='approved'
        )

        self.client.force_authenticate(user=self.staff_user)
        url = reverse('leave_management:leave-requests-my-requests')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_pending_approvals_manager(self):
        """Test getting pending approvals as manager"""
        # Create some pending requests
        LeaveRequest.objects.create(
            staff_user=self.staff_user,
            leave_type=self.leave_type,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=7),
            days_requested=Decimal('1'),
            reason='Test leave request',
            status='pending',
            submitted_at=timezone.now()
        )

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('leave_management:leave-requests-pending-approvals')

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('pending_requests', response.data)
        self.assertIn('count', response.data)
        self.assertIn('urgent_count', response.data)
        self.assertEqual(response.data['count'], 1)


if __name__ == '__main__':
    import django
    from django.conf import settings
    from django.test.utils import get_runner

    django.setup()
    TestRunner = get_runner(settings)
    test_runner = TestRunner()
    failures = test_runner.run_tests([
        'leave_management.test_new_endpoints'
    ])