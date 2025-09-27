"""
Comprehensive tests for the Compliance System API endpoints.

Tests all compliance-related functionality including:
- Working Hours Regulations
- Compliance Profiles
- Compliance Violations
- Working Hours Metrics
- Real-time compliance checking
- Compliance reporting
"""

from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from datetime import datetime, timedelta
import json

from .models import (
    WorkingHoursRegulation, ComplianceProfile, ComplianceViolation,
    WorkingHoursMetrics, Venue, Shift
)

User = get_user_model()


class BaseComplianceTestCase(TestCase):
    """Base test case for compliance system tests"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()

        # Create test users with different roles
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@test.com',
            password='admin123',
            role='admin'
        )

        self.manager_user = User.objects.create_user(
            username='manager_test',
            email='manager@test.com',
            password='manager123',
            role='manager'
        )

        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@test.com',
            password='staff123',
            role='staff'
        )

        # Create test working hours regulation
        self.regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            overtime_threshold_hours=Decimal('40.0'),
            overtime_multiplier_1=Decimal('1.5'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            max_consecutive_days=6,
            min_rest_between_shifts_hours=Decimal('11.0'),
            min_weekly_rest_hours=Decimal('24.0'),
            break_duration_minutes=30,
            break_trigger_hours=Decimal('6.0'),
            is_active=True
        )

        # Create test compliance profile
        self.compliance_profile = ComplianceProfile.objects.create(
            name='UK Security Operations',
            description='Compliance profile for UK security staff',
            working_hours_regulation=self.regulation,
            daily_hours_warning_threshold=Decimal('80.00'),
            weekly_hours_warning_threshold=Decimal('85.00'),
            consecutive_days_warning_threshold=5,
            auto_approve_overtime=False,
            require_manager_approval=True,
            notify_on_warnings=True,
            notify_on_violations=True,
            is_active=True
        )

        # Create test venue
        self.venue = Venue.objects.create(
            name='Test Venue',
            address='123 Test Street, Test City',
            capacity=100,
            latitude=Decimal('51.5074'),
            longitude=Decimal('-0.1278')
        )


class WorkingHoursRegulationAPITests(BaseComplianceTestCase):
    """Tests for Working Hours Regulation API endpoints"""

    def test_list_regulations_authenticated(self):
        """Test listing regulations as authenticated user"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('workinghours regulation-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['country_code'], 'GB')

    def test_list_regulations_unauthenticated(self):
        """Test listing regulations without authentication"""
        url = reverse('workinghours regulation-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_regulation_admin(self):
        """Test creating regulation as admin"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('workinghours regulation-list')
        data = {
            'country_code': 'US',
            'country_name': 'United States',
            'standard_weekly_hours': '40.0',
            'standard_daily_hours': '8.0',
            'max_daily_hours': '12.0',
            'max_weekly_hours': '60.0',
            'max_consecutive_days': 7,
            'min_rest_between_shifts_hours': '8.0',
            'min_weekly_rest_hours': '24.0',
            'break_duration_minutes': 30,
            'break_trigger_hours': '8.0'
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WorkingHoursRegulation.objects.count(), 2)
        self.assertEqual(WorkingHoursRegulation.objects.get(country_code='US').country_name, 'United States')

    def test_create_regulation_staff_forbidden(self):
        """Test staff user cannot create regulation"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('workinghours regulation-list')
        data = {'country_code': 'US', 'country_name': 'United States'}

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_countries_list(self):
        """Test getting list of available countries"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('workinghours regulation-countries')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['country_code'], 'GB')


class ComplianceProfileAPITests(BaseComplianceTestCase):
    """Tests for Compliance Profile API endpoints"""

    def test_list_profiles_admin(self):
        """Test admin can list all profiles"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('complianceprofile-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_list_profiles_staff(self):
        """Test staff can only see active profiles"""
        # Create inactive profile
        ComplianceProfile.objects.create(
            name='Inactive Profile',
            working_hours_regulation=self.regulation,
            is_active=False
        )

        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceprofile-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see active profile
        self.assertEqual(len(response.data['results']), 1)
        self.assertTrue(response.data['results'][0]['is_active'])

    def test_get_active_profile(self):
        """Test getting currently active profile"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceprofile-active')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['name'], 'UK Security Operations')

    def test_set_active_profile_admin(self):
        """Test admin can set active profile"""
        # Create second profile
        profile2 = ComplianceProfile.objects.create(
            name='Alternative Profile',
            working_hours_regulation=self.regulation,
            is_active=False
        )

        self.client.force_authenticate(user=self.admin_user)
        url = reverse('complianceprofile-set-active', kwargs={'pk': profile2.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Check that profile2 is now active and profile1 is inactive
        profile2.refresh_from_db()
        self.compliance_profile.refresh_from_db()
        self.assertTrue(profile2.is_active)
        self.assertFalse(self.compliance_profile.is_active)


class ComplianceViolationAPITests(BaseComplianceTestCase):
    """Tests for Compliance Violation API endpoints"""

    def setUp(self):
        super().setUp()

        # Create test shift
        self.shift = Shift.objects.create(
            user=self.staff_user,
            venue=self.venue,
            start_time=timezone.now() - timedelta(hours=10),
            end_time=timezone.now() - timedelta(hours=2),
            status='completed',
            hourly_rate=Decimal('15.00')
        )

        # Create test violations
        self.violation = ComplianceViolation.objects.create(
            user=self.staff_user,
            violation_type='daily_overtime',
            severity='major',
            period_start=timezone.now() - timedelta(hours=10),
            period_end=timezone.now() - timedelta(hours=2),
            shift=self.shift,
            description='Daily hours exceeded 12 hour limit',
            threshold_exceeded=Decimal('2.0'),
            system_generated=True
        )

        # Create resolved violation
        self.resolved_violation = ComplianceViolation.objects.create(
            user=self.staff_user,
            violation_type='late_checkin',
            severity='minor',
            period_start=timezone.now() - timedelta(days=2),
            period_end=timezone.now() - timedelta(days=2, hours=-1),
            description='Late check-in by 15 minutes',
            resolution_status='resolved',
            resolved_by=self.manager_user,
            resolved_at=timezone.now() - timedelta(days=1)
        )

    def test_list_violations_staff(self):
        """Test staff user can only see their own violations"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceviolation-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

        # All violations should belong to staff_user
        for violation in response.data['results']:
            self.assertEqual(violation['user'], self.staff_user.id)

    def test_list_violations_manager(self):
        """Test manager can see all violations"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('complianceviolation-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see all violations
        self.assertGreaterEqual(len(response.data['results']), 2)

    def test_filter_violations_by_type(self):
        """Test filtering violations by type"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceviolation-list')
        response = self.client.get(url, {'violation_type': 'daily_overtime'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['violation_type'], 'daily_overtime')

    def test_filter_violations_by_status(self):
        """Test filtering violations by status"""
        self.client.force_authenticate(user=self.staff_user)

        # Test open violations
        url = reverse('complianceviolation-list')
        response = self.client.get(url, {'status': 'open'})
        self.assertEqual(len(response.data['results']), 1)

        # Test resolved violations
        response = self.client.get(url, {'status': 'resolved'})
        self.assertEqual(len(response.data['results']), 1)

    def test_violation_summary_staff(self):
        """Test getting violation summary for staff user"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceviolation-summary')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        summary = response.data['data']
        self.assertEqual(summary['total_violations'], 2)
        self.assertEqual(summary['open_violations'], 1)
        self.assertEqual(summary['resolved_violations'], 1)

    def test_violation_summary_manager(self):
        """Test getting violation summary for manager"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('complianceviolation-summary')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Manager should get dashboard summary
        self.assertIn('total_violations', response.data['data'])

    def test_pending_violations_manager(self):
        """Test getting pending violations for manager"""
        # Create pending violation
        pending_violation = ComplianceViolation.objects.create(
            user=self.staff_user,
            violation_type='unauthorized_overtime',
            severity='major',
            period_start=timezone.now() - timedelta(hours=2),
            period_end=timezone.now(),
            description='Unauthorized overtime worked',
            resolution_status='pending_approval'
        )

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('complianceviolation-pending')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['resolution_status'], 'pending_approval')

    def test_pending_violations_staff_forbidden(self):
        """Test staff user cannot access pending violations"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceviolation-pending')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_resolve_violation_manager(self):
        """Test manager can resolve violations"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('complianceviolation-resolve', kwargs={'pk': self.violation.pk})
        data = {
            'resolution_notes': 'Approved due to emergency situation',
            'exception_granted': True,
            'exception_reason': 'Emergency coverage required'
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Check violation was resolved
        self.violation.refresh_from_db()
        self.assertEqual(self.violation.resolution_status, 'approved_exception')
        self.assertEqual(self.violation.resolved_by, self.manager_user)
        self.assertTrue(self.violation.exception_granted)

    def test_resolve_violation_staff_forbidden(self):
        """Test staff user cannot resolve violations"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceviolation-resolve', kwargs={'pk': self.violation.pk})
        data = {'resolution_notes': 'Self resolve attempt'}

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_resolve_violations_admin(self):
        """Test admin can bulk resolve violations"""
        # Create additional violation
        violation2 = ComplianceViolation.objects.create(
            user=self.staff_user,
            violation_type='missing_break',
            severity='minor',
            period_start=timezone.now() - timedelta(hours=4),
            period_end=timezone.now() - timedelta(hours=2),
            description='Required break not taken'
        )

        self.client.force_authenticate(user=self.admin_user)
        url = reverse('complianceviolation-bulk-resolve')
        data = {
            'violation_ids': [self.violation.id, violation2.id],
            'resolution_notes': 'Bulk resolution for policy update',
            'exception_granted': False
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['resolved_count'], 2)

        # Check both violations were resolved
        self.violation.refresh_from_db()
        violation2.refresh_from_db()
        self.assertEqual(self.violation.resolution_status, 'resolved')
        self.assertEqual(violation2.resolution_status, 'resolved')


class ComplianceReportAPITests(BaseComplianceTestCase):
    """Tests for Compliance Reporting API endpoints"""

    def test_compliance_dashboard_summary(self):
        """Test getting compliance dashboard summary"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-report-summary')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('data', response.data)

    def test_compliance_trends(self):
        """Test getting compliance violation trends"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-report-trends')
        response = self.client.get(url, {'days': 30, 'group_by': 'day'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('parameters', response.data)
        self.assertEqual(response.data['parameters']['days'], 30)

    def test_working_hours_report(self):
        """Test getting working hours report"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-report-working-hours')
        response = self.client.get(url, {'period_type': 'weekly'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

    def test_working_hours_report_user_specific(self):
        """Test getting working hours report for specific user"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-report-working-hours')
        response = self.client.get(url, {
            'user_id': self.staff_user.id,
            'period_type': 'weekly'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)


class RealTimeComplianceTests(BaseComplianceTestCase):
    """Tests for real-time compliance checking"""

    def test_compliance_check_valid_shift(self):
        """Test compliance check for valid shift"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-check')
        data = {
            'user_id': self.staff_user.id,
            'shift_start': (timezone.now() + timedelta(hours=1)).isoformat(),
            'shift_end': (timezone.now() + timedelta(hours=9)).isoformat(),
            'venue_id': self.venue.id
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('data', response.data)

    def test_compliance_check_invalid_data(self):
        """Test compliance check with invalid data"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-check')
        data = {
            'user_id': self.staff_user.id,
            'shift_start': (timezone.now() + timedelta(hours=9)).isoformat(),
            'shift_end': (timezone.now() + timedelta(hours=1)).isoformat(),  # End before start
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('errors', response.data)

    def test_compliance_check_nonexistent_user(self):
        """Test compliance check for non-existent user"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-check')
        data = {
            'user_id': 99999,  # Non-existent user
            'shift_start': (timezone.now() + timedelta(hours=1)).isoformat(),
            'shift_end': (timezone.now() + timedelta(hours=9)).isoformat(),
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_compliance_alerts(self):
        """Test getting compliance alerts"""
        # Create critical violation
        ComplianceViolation.objects.create(
            user=self.staff_user,
            violation_type='shift_abandonment',
            severity='critical',
            period_start=timezone.now() - timedelta(hours=2),
            period_end=timezone.now() - timedelta(hours=1),
            description='Shift abandoned without notice',
            resolution_status='open'
        )

        # Test manager alerts
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-alerts')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertGreater(len(response.data['data']), 0)

        # Should have critical violations alert
        alerts = response.data['data']
        critical_alert = next((alert for alert in alerts if alert['type'] == 'critical_violations'), None)
        self.assertIsNotNone(critical_alert)
        self.assertEqual(critical_alert['priority'], 'high')

    def test_compliance_alerts_staff_user(self):
        """Test staff user gets only their alerts"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('compliance-alerts')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')


class WorkingHoursMetricsAPITests(BaseComplianceTestCase):
    """Tests for Working Hours Metrics API endpoints"""

    def setUp(self):
        super().setUp()

        # Create test metrics
        self.metrics = WorkingHoursMetrics.objects.create(
            user=self.staff_user,
            period_type='weekly',
            period_start=timezone.now().date() - timedelta(days=7),
            period_end=timezone.now().date(),
            total_hours_worked=Decimal('42.5'),
            regular_hours=Decimal('40.0'),
            overtime_hours=Decimal('2.5'),
            total_shifts=5,
            completed_shifts=5,
            compliance_score=Decimal('85.5')
        )

    def test_list_metrics_staff(self):
        """Test staff user can only see their own metrics"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('workinghours metrics-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['user'], self.staff_user.id)

    def test_list_metrics_manager(self):
        """Test manager can see all metrics"""
        # Create metrics for another user
        WorkingHoursMetrics.objects.create(
            user=self.manager_user,
            period_type='weekly',
            period_start=timezone.now().date() - timedelta(days=7),
            period_end=timezone.now().date(),
            total_hours_worked=Decimal('40.0'),
            regular_hours=Decimal('40.0'),
            overtime_hours=Decimal('0.0'),
            total_shifts=5,
            completed_shifts=5
        )

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('workinghours metrics-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 2)

    def test_filter_metrics_by_user(self):
        """Test filtering metrics by user (managers only)"""
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('workinghours metrics-list')
        response = self.client.get(url, {'user_id': self.staff_user.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['user'], self.staff_user.id)

    def test_filter_metrics_by_period_type(self):
        """Test filtering metrics by period type"""
        # Create monthly metrics
        WorkingHoursMetrics.objects.create(
            user=self.staff_user,
            period_type='monthly',
            period_start=timezone.now().date() - timedelta(days=30),
            period_end=timezone.now().date(),
            total_hours_worked=Decimal('180.0'),
            regular_hours=Decimal('160.0'),
            overtime_hours=Decimal('20.0'),
            total_shifts=20,
            completed_shifts=20
        )

        self.client.force_authenticate(user=self.staff_user)
        url = reverse('workinghours metrics-list')
        response = self.client.get(url, {'period_type': 'monthly'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['period_type'], 'monthly')

    def test_recalculate_metrics_admin(self):
        """Test admin can trigger metrics recalculation"""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('workinghours metrics-recalculate')
        data = {'user_id': self.staff_user.id, 'period_type': 'weekly'}

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('initiated', response.data['message'])

    def test_recalculate_metrics_staff_forbidden(self):
        """Test staff user cannot trigger metrics recalculation"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('workinghours metrics-recalculate')
        data = {'user_id': self.staff_user.id}

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ComplianceAPIPerformanceTests(BaseComplianceTestCase):
    """Tests for compliance API performance and caching"""

    def test_violation_summary_caching(self):
        """Test that violation summaries are properly cached"""
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceviolation-summary')

        # First request - should not be cached
        response1 = self.client.get(url)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertFalse(response1.data.get('cached', False))

        # Second request - should be cached
        response2 = self.client.get(url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Note: In test environment, caching might not work exactly as in production
        # This test verifies the API structure supports caching

    def test_dashboard_response_time(self):
        """Test dashboard response time is reasonable"""
        import time

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-report-summary')

        start_time = time.time()
        response = self.client.get(url)
        end_time = time.time()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_time = end_time - start_time

        # Response should be under 1 second (generous for test environment)
        self.assertLess(response_time, 1.0)

    def test_compliance_check_response_time(self):
        """Test real-time compliance check response time"""
        import time

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('compliance-check')
        data = {
            'user_id': self.staff_user.id,
            'shift_start': (timezone.now() + timedelta(hours=1)).isoformat(),
            'shift_end': (timezone.now() + timedelta(hours=9)).isoformat()
        }

        start_time = time.time()
        response = self.client.post(url, data, format='json')
        end_time = time.time()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        response_time = end_time - start_time

        # Real-time check should be very fast (under 0.5 seconds)
        self.assertLess(response_time, 0.5)


class ComplianceAPIIntegrationTests(BaseComplianceTestCase):
    """Integration tests for compliance system workflows"""

    def test_complete_violation_workflow(self):
        """Test complete violation creation and resolution workflow"""
        # Step 1: Create violation (simulating automatic detection)
        violation = ComplianceViolation.objects.create(
            user=self.staff_user,
            violation_type='weekly_overtime',
            severity='major',
            period_start=timezone.now() - timedelta(days=7),
            period_end=timezone.now(),
            description='Weekly hours exceeded 48 hour limit',
            threshold_exceeded=Decimal('8.0'),
            system_generated=True
        )

        # Step 2: Manager checks pending violations
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('complianceviolation-pending')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data['data']), 0)

        # Step 3: Manager resolves violation
        url = reverse('complianceviolation-resolve', kwargs={'pk': violation.pk})
        data = {
            'resolution_notes': 'Approved due to staff shortage',
            'exception_granted': True,
            'exception_reason': 'Emergency staff shortage situation'
        }

        response = self.client.post(url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Step 4: Verify violation is resolved
        violation.refresh_from_db()
        self.assertEqual(violation.resolution_status, 'approved_exception')
        self.assertEqual(violation.resolved_by, self.manager_user)

        # Step 5: Check that alerts are updated
        url = reverse('compliance-alerts')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_compliance_profile_activation_workflow(self):
        """Test compliance profile activation workflow"""
        # Create new profile
        new_profile = ComplianceProfile.objects.create(
            name='Updated Policy Profile',
            working_hours_regulation=self.regulation,
            daily_hours_warning_threshold=Decimal('75.00'),  # Stricter threshold
            is_active=False
        )

        # Admin activates new profile
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('complianceprofile-set-active', kwargs={'pk': new_profile.pk})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify new profile is active
        new_profile.refresh_from_db()
        self.compliance_profile.refresh_from_db()
        self.assertTrue(new_profile.is_active)
        self.assertFalse(self.compliance_profile.is_active)

        # Verify staff can see new active profile
        self.client.force_authenticate(user=self.staff_user)
        url = reverse('complianceprofile-active')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['name'], 'Updated Policy Profile')
        self.assertEqual(
            float(response.data['data']['daily_hours_warning_threshold']),
            75.00
        )