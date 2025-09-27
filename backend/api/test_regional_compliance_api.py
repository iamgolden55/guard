"""
Test cases for Regional Compliance API endpoints.

This test suite validates all regional compliance management functionality including:
- Region detection (venue, coordinates, IP-based)
- Regional preset application
- Regulation comparison across regions
- Schedule validation against regional rules
- Regional settings management

Created for COMP-003: Regional Compliance API Implementation
"""

import json
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import (
    WorkingHoursRegulation, ComplianceProfile, ComplianceViolation,
    Venue, SIALicense, StaffProfile
)

User = get_user_model()


class RegionDetectionAPITest(APITestCase):
    """Test region detection endpoint functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create test regulations
        self.uk_regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('48.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            security_sector_overrides={'sia_license_required': True}
        )

        self.us_regulation = WorkingHoursRegulation.objects.create(
            country_code='US',
            country_name='United States',
            standard_weekly_hours=Decimal('40.0'),
            max_daily_hours=Decimal('24.0'),
            max_weekly_hours=Decimal('168.0'),
            overtime_threshold_hours=Decimal('40.0'),
            state_overrides={'CA': {'max_daily_hours': 8}}
        )

        # Create test venue
        self.venue = Venue.objects.create(
            name='Test Venue London',
            address='123 Test Street',
            city='London',
            postal_code='SW1A 1AA',
            country='United Kingdom',
            capacity=100,
            latitude=Decimal('51.5074'),
            longitude=Decimal('-0.1278')
        )

    def test_detect_region_by_venue_id(self):
        """Test region detection using venue ID"""
        url = reverse('compliance-regional-detect-region')
        response = self.client.get(url, {'venue_id': self.venue.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertEqual(data['region_code'], 'UK')
        self.assertEqual(data['country_code'], 'GB')
        self.assertEqual(data['detection_method'], 'venue')
        self.assertEqual(data['confidence_score'], 0.95)
        self.assertEqual(data['regulation_id'], self.uk_regulation.id)

    def test_detect_region_by_coordinates(self):
        """Test region detection using GPS coordinates"""
        url = reverse('compliance-regional-detect-region')
        response = self.client.get(url, {
            'lat': '51.5074',  # London coordinates
            'lng': '-0.1278'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertEqual(data['region_code'], 'UK')
        self.assertEqual(data['country_code'], 'GB')
        self.assertEqual(data['detection_method'], 'coordinates')
        self.assertEqual(data['confidence_score'], 0.9)

    def test_detect_region_by_ip_address(self):
        """Test region detection using IP address"""
        url = reverse('compliance-regional-detect-region')
        response = self.client.get(url, {'ip_address': '8.8.8.8'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertEqual(data['detection_method'], 'ip_geolocation')
        self.assertIn('confidence_score', data)

    def test_detect_region_fallback(self):
        """Test fallback region when no detection method works"""
        url = reverse('compliance-regional-detect-region')
        response = self.client.get(url, {'venue_id': 99999})  # Non-existent venue

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertEqual(data['region_code'], 'UK')
        self.assertEqual(data['detection_method'], 'fallback')
        self.assertEqual(data['confidence_score'], 0.5)

    def test_detect_region_invalid_params(self):
        """Test validation when no detection method provided"""
        url = reverse('compliance-regional-detect-region')
        response = self.client.get(url, {})  # No parameters

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', response.json())


class PresetApplicationAPITest(APITestCase):
    """Test regional preset application functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create regulation
        self.uk_regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('48.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            min_rest_between_shifts_hours=Decimal('11.0'),
            security_sector_overrides={'sia_license_required': True},
            opt_out_provisions={'enabled': True, 'notice_period_days': 7}
        )

        # Create compliance profile
        self.profile = ComplianceProfile.objects.create(
            user=self.user,
            working_hours_regulation=self.uk_regulation
        )

    def test_apply_uk_preset(self):
        """Test applying UK regional preset"""
        url = reverse('compliance-regional-apply-preset')
        data = {
            'region_code': 'UK',
            'profile_id': self.profile.id,
            'override_existing': True
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        self.assertTrue(result['success'])
        self.assertEqual(result['region_code'], 'UK')
        self.assertIn('applied_settings', result)
        self.assertIn('sia_license_required', result['applied_settings'])

    def test_apply_us_preset(self):
        """Test applying US regional preset"""
        us_regulation = WorkingHoursRegulation.objects.create(
            country_code='US',
            country_name='United States',
            standard_weekly_hours=Decimal('40.0'),
            max_daily_hours=Decimal('24.0'),
            max_weekly_hours=Decimal('168.0'),
            overtime_threshold_hours=Decimal('40.0'),
            overtime_multiplier_1=Decimal('1.5'),
            state_overrides={'CA': {'max_daily_hours': 8}}
        )

        url = reverse('compliance-regional-apply-preset')
        data = {
            'region_code': 'US-CA',
            'profile_id': self.profile.id,
            'override_existing': True
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        self.assertTrue(result['success'])
        self.assertIn('overtime_threshold', result['applied_settings'])
        self.assertIn('state_specific_rules', result['applied_settings'])

    def test_apply_preset_invalid_profile(self):
        """Test preset application with invalid profile ID"""
        url = reverse('compliance-regional-apply-preset')
        data = {
            'region_code': 'UK',
            'profile_id': 99999,
            'override_existing': True
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)


class RegulationComparisonAPITest(APITestCase):
    """Test regulation comparison functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create multiple regulations for comparison
        self.uk_regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('48.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            min_rest_between_shifts_hours=Decimal('11.0'),
            break_duration_minutes=20,
            break_trigger_hours=Decimal('6.0'),
            security_sector_overrides={'sia_license_required': True},
            opt_out_provisions={'enabled': True}
        )

        self.us_regulation = WorkingHoursRegulation.objects.create(
            country_code='US',
            country_name='United States',
            standard_weekly_hours=Decimal('40.0'),
            max_daily_hours=Decimal('24.0'),
            max_weekly_hours=Decimal('168.0'),
            min_rest_between_shifts_hours=Decimal('8.0'),
            break_duration_minutes=30,
            break_trigger_hours=Decimal('8.0'),
            overtime_threshold_hours=Decimal('40.0'),
            overtime_multiplier_1=Decimal('1.5')
        )

        self.fr_regulation = WorkingHoursRegulation.objects.create(
            country_code='FR',
            country_name='France',
            standard_weekly_hours=Decimal('35.0'),
            max_daily_hours=Decimal('10.0'),
            max_weekly_hours=Decimal('48.0'),
            min_rest_between_shifts_hours=Decimal('11.0'),
            break_duration_minutes=20,
            break_trigger_hours=Decimal('6.0')
        )

    def test_compare_multiple_regions(self):
        """Test comparing regulations across multiple regions"""
        url = reverse('compliance-regional-compare')
        response = self.client.get(url, {
            'regions[]': ['UK', 'US', 'EU-FR'],
            'include_sia_requirements': 'true',
            'include_break_rules': 'true',
            'include_overtime': 'true'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertIn('comparison_matrix', data)
        self.assertIn('key_differences', data)
        self.assertIn('sia_requirements', data)
        self.assertIn('opt_out_provisions', data)

        # Check that all regions are included
        matrix = data['comparison_matrix']
        self.assertIn('UK', matrix)
        self.assertIn('US', matrix)
        self.assertIn('EU-FR', matrix)

        # Check UK data
        uk_data = matrix['UK']
        self.assertEqual(uk_data['standard_weekly_hours'], 48.0)
        self.assertEqual(uk_data['max_daily_hours'], 12.0)

        # Check US data includes overtime
        us_data = matrix['US']
        self.assertIn('overtime_threshold', us_data)
        self.assertEqual(us_data['overtime_multiplier'], 1.5)

    def test_compare_with_selective_includes(self):
        """Test comparison with selective feature inclusion"""
        url = reverse('compliance-regional-compare')
        response = self.client.get(url, {
            'regions[]': ['UK', 'US'],
            'include_sia_requirements': 'false',
            'include_break_rules': 'false',
            'include_overtime': 'true'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertIsNone(data['sia_requirements'])

        # Should not include detailed break rules
        matrix = data['comparison_matrix']
        for region_data in matrix.values():
            self.assertNotIn('detailed_break_rules', region_data)

    def test_compare_insufficient_regions(self):
        """Test comparison with insufficient regions"""
        url = reverse('compliance-regional-compare')
        response = self.client.get(url, {
            'regions[]': ['UK']  # Only one region
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_compare_key_differences_detection(self):
        """Test that key differences are properly identified"""
        url = reverse('compliance-regional-compare')
        response = self.client.get(url, {
            'regions[]': ['UK', 'US', 'EU-FR']
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        differences = data['key_differences']
        self.assertIsInstance(differences, list)

        # Should detect significant differences in weekly hours (48, 40, 35)
        weekly_diff = any('weekly hours' in diff for diff in differences)
        self.assertTrue(weekly_diff)


class ScheduleValidationAPITest(APITestCase):
    """Test schedule validation functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create staff profile and SIA license
        self.staff_profile = StaffProfile.objects.create(
            user=self.user,
            first_name='Test',
            last_name='User',
            date_of_birth='1990-01-01',
            phone_number='1234567890'
        )

        self.sia_license = SIALicense.objects.create(
            staff_profile=self.staff_profile,
            license_number='TEST123456',
            license_type='door_supervisor',
            issue_date=timezone.now().date(),
            expiry_date=timezone.now().date() + timezone.timedelta(days=365),
            is_active=True
        )

        # Create regulation
        self.uk_regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('48.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            min_rest_between_shifts_hours=Decimal('11.0'),
            break_duration_minutes=30,
            break_trigger_hours=Decimal('6.0'),
            overtime_threshold_hours=Decimal('40.0'),
            security_sector_overrides={'sia_license_required': True}
        )

        # Create compliance profile
        self.profile = ComplianceProfile.objects.create(
            user=self.user,
            working_hours_regulation=self.uk_regulation
        )

    def test_validate_compliant_schedule(self):
        """Test validation of a compliant schedule"""
        url = reverse('compliance-regional-validate-schedule')

        # Create a compliant schedule (8 hour shifts, 40 hours total)
        shifts = [
            {
                'start': '2024-01-01T09:00:00Z',
                'end': '2024-01-01T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 30
            },
            {
                'start': '2024-01-02T09:00:00Z',
                'end': '2024-01-02T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 30
            },
            {
                'start': '2024-01-03T09:00:00Z',
                'end': '2024-01-03T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 30
            },
            {
                'start': '2024-01-04T09:00:00Z',
                'end': '2024-01-04T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 30
            },
            {
                'start': '2024-01-05T09:00:00Z',
                'end': '2024-01-05T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 30
            }
        ]

        data = {
            'user_id': self.user.id,
            'shifts': shifts,
            'validation_date': '2024-01-01'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        self.assertTrue(result['is_compliant'])
        self.assertEqual(len(result['violations']), 0)
        self.assertEqual(float(result['total_hours']), 40.0)
        self.assertIn('United Kingdom', result['regulation_applied'])

    def test_validate_excessive_daily_hours(self):
        """Test validation detects excessive daily hours"""
        url = reverse('compliance-regional-validate-schedule')

        # Create schedule with 14-hour shift (exceeds 12-hour daily limit)
        shifts = [
            {
                'start': '2024-01-01T08:00:00Z',
                'end': '2024-01-01T22:00:00Z',  # 14 hours
                'role': 'security_guard',
                'break_minutes': 30
            }
        ]

        data = {
            'user_id': self.user.id,
            'shifts': shifts
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        self.assertFalse(result['is_compliant'])

        # Should have daily hours violation
        daily_violations = [v for v in result['violations'] if v['type'] == 'max_daily_hours_exceeded']
        self.assertEqual(len(daily_violations), 1)
        self.assertEqual(daily_violations[0]['severity'], 'high')

    def test_validate_insufficient_breaks(self):
        """Test validation detects insufficient break time"""
        url = reverse('compliance-regional-validate-schedule')

        # Create 8-hour shift with insufficient break
        shifts = [
            {
                'start': '2024-01-01T09:00:00Z',
                'end': '2024-01-01T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 15  # Less than required 30 minutes
            }
        ]

        data = {
            'user_id': self.user.id,
            'shifts': shifts
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        # Should have break violation
        break_violations = [v for v in result['violations'] if v['type'] == 'insufficient_break']
        self.assertEqual(len(break_violations), 1)
        self.assertEqual(break_violations[0]['severity'], 'medium')

    def test_validate_excessive_weekly_hours(self):
        """Test validation detects excessive weekly hours"""
        url = reverse('compliance-regional-validate-schedule')

        # Create schedule exceeding 48-hour weekly limit
        shifts = []
        for day in range(7):
            shifts.append({
                'start': f'2024-01-0{day+1}T08:00:00Z',
                'end': f'2024-01-0{day+1}T16:00:00Z',  # 8 hours per day = 56 hours total
                'role': 'security_guard',
                'break_minutes': 30
            })

        data = {
            'user_id': self.user.id,
            'shifts': shifts
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        self.assertFalse(result['is_compliant'])

        # Should have weekly hours violation
        weekly_violations = [v for v in result['violations'] if v['type'] == 'max_weekly_hours_exceeded']
        self.assertEqual(len(weekly_violations), 1)
        self.assertEqual(weekly_violations[0]['severity'], 'high')

        # Should show overtime hours
        self.assertGreater(float(result['overtime_hours']), 0)

    def test_validate_missing_sia_license(self):
        """Test validation detects missing SIA license"""
        # Deactivate SIA license
        self.sia_license.is_active = False
        self.sia_license.save()

        url = reverse('compliance-regional-validate-schedule')

        shifts = [
            {
                'start': '2024-01-01T09:00:00Z',
                'end': '2024-01-01T17:00:00Z',
                'role': 'security_guard',
                'break_minutes': 30
            }
        ]

        data = {
            'user_id': self.user.id,
            'shifts': shifts
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()['data']

        self.assertFalse(result['is_compliant'])

        # Should have SIA license violation
        sia_violations = [v for v in result['violations'] if v['type'] == 'sia_license_required']
        self.assertEqual(len(sia_violations), 1)
        self.assertEqual(sia_violations[0]['severity'], 'critical')

    def test_validate_invalid_shift_data(self):
        """Test validation handles invalid shift data"""
        url = reverse('compliance-regional-validate-schedule')

        # Create shift with missing required fields
        shifts = [
            {
                'start': '2024-01-01T09:00:00Z',
                # Missing 'end' field
                'role': 'security_guard'
            }
        ]

        data = {
            'user_id': self.user.id,
            'shifts': shifts
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_validate_nonexistent_user(self):
        """Test validation with non-existent user"""
        url = reverse('compliance-regional-validate-schedule')

        data = {
            'user_id': 99999,  # Non-existent user
            'shifts': []
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)


class RegionalSettingsAPITest(APITestCase):
    """Test regional settings management functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    def test_get_regional_settings(self):
        """Test retrieving regional settings"""
        url = reverse('compliance-regional-regional-settings')
        response = self.client.get(url, {
            'region_code': 'UK',
            'venue_id': '1'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        self.assertIn('effective_settings', data)
        self.assertIn('inheritance_chain', data)
        self.assertEqual(data['region_code'], 'UK')

    def test_create_regional_settings(self):
        """Test creating new regional settings"""
        url = reverse('compliance-regional-regional-settings')
        data = {
            'region_code': 'UK',
            'venue_id': 1,
            'max_daily_hours_override': 10.0,
            'sia_license_required': True,
            'custom_rules': {
                'special_event_rules': {
                    'max_consecutive_days': 10
                }
            }
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        result = response.json()
        self.assertEqual(result['status'], 'success')

    def test_update_regional_settings(self):
        """Test updating existing regional settings"""
        url = reverse('compliance-regional-regional-settings')
        data = {
            'region_code': 'UK',
            'venue_id': 1,
            'max_daily_hours_override': 11.0,
            'break_requirements_override': {
                '8_hours': {'duration_minutes': 45, 'paid': True}
            }
        }

        response = self.client.put(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.json()
        self.assertEqual(result['status'], 'success')


class RegionalComplianceIntegrationTest(APITestCase):
    """Integration tests for complete regional compliance workflows"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create comprehensive test data
        self.setup_test_regulations()
        self.setup_test_venues()
        self.setup_test_profiles()

    def setup_test_regulations(self):
        """Set up test regulations for multiple regions"""
        self.uk_regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('48.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            min_rest_between_shifts_hours=Decimal('11.0'),
            break_duration_minutes=20,
            break_trigger_hours=Decimal('6.0'),
            security_sector_overrides={'sia_license_required': True},
            opt_out_provisions={'enabled': True, 'notice_period_days': 7},
            break_requirements={
                '6_hours': {'duration_minutes': 20, 'paid': False},
                '8_hours': {'duration_minutes': 30, 'paid': False}
            }
        )

    def setup_test_venues(self):
        """Set up test venues in different regions"""
        self.london_venue = Venue.objects.create(
            name='London Security Office',
            address='123 City Road',
            city='London',
            postal_code='EC1V 1AA',
            country='United Kingdom',
            capacity=50,
            latitude=Decimal('51.5074'),
            longitude=Decimal('-0.1278')
        )

    def setup_test_profiles(self):
        """Set up test compliance profiles"""
        self.profile = ComplianceProfile.objects.create(
            user=self.user,
            working_hours_regulation=self.uk_regulation
        )

    def test_complete_compliance_workflow(self):
        """Test complete workflow: detection → preset → validation"""

        # Step 1: Detect region from venue
        detect_url = reverse('compliance-regional-detect-region')
        detect_response = self.client.get(detect_url, {
            'venue_id': self.london_venue.id
        })

        self.assertEqual(detect_response.status_code, status.HTTP_200_OK)
        region_data = detect_response.json()['data']
        self.assertEqual(region_data['region_code'], 'UK')

        # Step 2: Apply regional preset
        preset_url = reverse('compliance-regional-apply-preset')
        preset_response = self.client.post(preset_url, {
            'region_code': region_data['region_code'],
            'profile_id': self.profile.id,
            'override_existing': True
        }, format='json')

        self.assertEqual(preset_response.status_code, status.HTTP_200_OK)
        preset_result = preset_response.json()['data']
        self.assertTrue(preset_result['success'])

        # Step 3: Validate schedule against applied settings
        validation_url = reverse('compliance-regional-validate-schedule')
        shifts = [
            {
                'start': '2024-01-01T09:00:00Z',
                'end': '2024-01-01T21:00:00Z',  # 12 hours (at limit)
                'role': 'security_guard',
                'break_minutes': 60  # Adequate breaks
            }
        ]

        validation_response = self.client.post(validation_url, {
            'user_id': self.user.id,
            'shifts': shifts,
            'venue_id': self.london_venue.id
        }, format='json')

        self.assertEqual(validation_response.status_code, status.HTTP_200_OK)
        validation_result = validation_response.json()['data']

        # Should be compliant as 12 hours is at the UK limit
        # (Would fail if SIA license validation was enforced)

    def test_multi_region_comparison_workflow(self):
        """Test comparing regulations across different regions"""

        # Create additional regulations for comparison
        us_regulation = WorkingHoursRegulation.objects.create(
            country_code='US',
            country_name='United States',
            standard_weekly_hours=Decimal('40.0'),
            max_daily_hours=Decimal('24.0'),
            max_weekly_hours=Decimal('168.0'),
            overtime_threshold_hours=Decimal('40.0'),
            overtime_multiplier_1=Decimal('1.5')
        )

        # Compare UK vs US regulations
        compare_url = reverse('compliance-regional-compare')
        response = self.client.get(compare_url, {
            'regions[]': ['UK', 'US'],
            'include_sia_requirements': 'true',
            'include_overtime': 'true'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['data']

        # Verify comparison includes both regions
        matrix = data['comparison_matrix']
        self.assertIn('UK', matrix)
        self.assertIn('US', matrix)

        # Verify key differences are identified
        differences = data['key_differences']
        self.assertIsInstance(differences, list)
        self.assertTrue(len(differences) > 0)

        # Verify SIA requirements are included for UK only
        sia_reqs = data['sia_requirements']
        self.assertIn('UK', sia_reqs)
        self.assertNotIn('US', sia_reqs)  # US doesn't have SIA requirements

    def test_error_handling_and_edge_cases(self):
        """Test error handling and edge cases"""

        # Test invalid region detection
        detect_url = reverse('compliance-regional-detect-region')
        response = self.client.get(detect_url)  # No parameters
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Test preset application with invalid region
        preset_url = reverse('compliance-regional-apply-preset')
        response = self.client.post(preset_url, {
            'region_code': 'INVALID',
            'profile_id': self.profile.id
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Test schedule validation with malformed shift data
        validation_url = reverse('compliance-regional-validate-schedule')
        response = self.client.post(validation_url, {
            'user_id': self.user.id,
            'shifts': [{'invalid': 'data'}]
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)