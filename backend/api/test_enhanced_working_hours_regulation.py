"""
Comprehensive unit tests for enhanced WorkingHoursRegulation model.
Tests all new fields, methods, and regional compliance functionality.
"""

from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from api.models import WorkingHoursRegulation


class EnhancedWorkingHoursRegulationTestCase(TestCase):
    """Test case for enhanced WorkingHoursRegulation model functionality"""

    def setUp(self):
        """Set up test data for each test method"""
        self.uk_regulation = WorkingHoursRegulation.objects.create(
            country_code='GB',
            country_name='United Kingdom',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('60.0'),
            max_consecutive_days=6,
            min_rest_between_shifts_hours=Decimal('11.0'),
            min_weekly_rest_hours=Decimal('24.0'),
            break_duration_minutes=20,
            break_trigger_hours=Decimal('6.0'),
            regulatory_source='UK Health and Safety Executive, Working Time Regulations 1998',
            security_sector_overrides={
                'sia_license_required': True,
                'max_consecutive_shifts': 5,
                'enhanced_background_check': True,
                'specialized_training_hours': 40
            },
            break_requirements={
                '6_hours': {
                    'duration_minutes': 20,
                    'paid': True,
                    'mandatory': True
                },
                '9_hours': {
                    'duration_minutes': 45,
                    'paid': True,
                    'mandatory': True
                },
                '12_hours': {
                    'duration_minutes': 60,
                    'paid': False,
                    'mandatory': True
                }
            },
            night_shift_rules={
                'max_consecutive_nights': 8,
                'max_night_hours_per_week': 40,
                'max_night_hours_daily': 8,
                'health_assessment_required': True,
                'night_start_time': '23:00',
                'night_end_time': '06:00'
            },
            opt_out_provisions={
                'allowed': True,
                'max_weekly_hours': 60,
                'written_agreement_required': True,
                'notice_period_days': 7,
                'health_assessment_required': False
            },
            industry_specific_rules={
                'risk_assessment_required': True,
                'incident_reporting_mandatory': True,
                'regular_welfare_checks': True
            }
        )

        self.us_regulation = WorkingHoursRegulation.objects.create(
            country_code='US',
            country_name='United States',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            max_daily_hours=Decimal('16.0'),
            max_weekly_hours=Decimal('80.0'),
            max_consecutive_days=7,
            min_rest_between_shifts_hours=Decimal('8.0'),
            min_weekly_rest_hours=Decimal('24.0'),
            break_duration_minutes=30,
            break_trigger_hours=Decimal('8.0'),
            regulatory_source='Fair Labor Standards Act (FLSA), Department of Labor',
            security_sector_overrides={
                'security_license_required': True,
                'armed_guard_certification': True,
                'background_check_level': 'federal',
                'firearms_training_hours': 40
            },
            state_overrides={
                'CA': {
                    'max_daily_hours': 12.0,
                    'overtime_threshold_daily': 8.0,
                    'double_time_threshold': 12.0,
                    'meal_break_mandatory': True
                },
                'NY': {
                    'max_daily_hours': 12.0,
                    'spread_of_hours_premium': True,
                    'security_guard_registration': True
                }
            }
        )

    def test_security_sector_overrides_field(self):
        """Test security sector overrides field functionality"""
        self.assertTrue(self.uk_regulation.security_sector_overrides.get('sia_license_required'))
        self.assertEqual(self.uk_regulation.security_sector_overrides.get('max_consecutive_shifts'), 5)
        self.assertEqual(self.uk_regulation.security_sector_overrides.get('specialized_training_hours'), 40)

        # Test empty override
        regulation = WorkingHoursRegulation.objects.create(
            country_code='FR',
            country_name='France',
            standard_weekly_hours=Decimal('35.0'),
            standard_daily_hours=Decimal('7.0'),
            max_daily_hours=Decimal('10.0'),
            max_weekly_hours=Decimal('48.0')
        )
        self.assertEqual(regulation.security_sector_overrides, {})

    def test_break_requirements_field(self):
        """Test break requirements field functionality"""
        break_reqs = self.uk_regulation.break_requirements

        # Test 6-hour break requirement
        six_hour_break = break_reqs.get('6_hours')
        self.assertIsNotNone(six_hour_break)
        self.assertEqual(six_hour_break['duration_minutes'], 20)
        self.assertTrue(six_hour_break['paid'])
        self.assertTrue(six_hour_break['mandatory'])

        # Test 12-hour break requirement
        twelve_hour_break = break_reqs.get('12_hours')
        self.assertIsNotNone(twelve_hour_break)
        self.assertEqual(twelve_hour_break['duration_minutes'], 60)
        self.assertFalse(twelve_hour_break['paid'])
        self.assertTrue(twelve_hour_break['mandatory'])

    def test_night_shift_rules_field(self):
        """Test night shift rules field functionality"""
        night_rules = self.uk_regulation.night_shift_rules

        self.assertEqual(night_rules['max_consecutive_nights'], 8)
        self.assertEqual(night_rules['max_night_hours_per_week'], 40)
        self.assertEqual(night_rules['max_night_hours_daily'], 8)
        self.assertTrue(night_rules['health_assessment_required'])
        self.assertEqual(night_rules['night_start_time'], '23:00')
        self.assertEqual(night_rules['night_end_time'], '06:00')

    def test_opt_out_provisions_field(self):
        """Test opt-out provisions field functionality"""
        opt_out = self.uk_regulation.opt_out_provisions

        self.assertTrue(opt_out['allowed'])
        self.assertEqual(opt_out['max_weekly_hours'], 60)
        self.assertTrue(opt_out['written_agreement_required'])
        self.assertEqual(opt_out['notice_period_days'], 7)
        self.assertFalse(opt_out['health_assessment_required'])

    def test_state_overrides_field(self):
        """Test US state-level overrides field functionality"""
        state_overrides = self.us_regulation.state_overrides

        # Test California overrides
        ca_rules = state_overrides.get('CA')
        self.assertIsNotNone(ca_rules)
        self.assertEqual(ca_rules['max_daily_hours'], 12.0)
        self.assertEqual(ca_rules['overtime_threshold_daily'], 8.0)
        self.assertTrue(ca_rules['meal_break_mandatory'])

        # Test New York overrides
        ny_rules = state_overrides.get('NY')
        self.assertIsNotNone(ny_rules)
        self.assertEqual(ny_rules['max_daily_hours'], 12.0)
        self.assertTrue(ny_rules['spread_of_hours_premium'])
        self.assertTrue(ny_rules['security_guard_registration'])

    def test_regulatory_source_field(self):
        """Test regulatory source field functionality"""
        self.assertEqual(
            self.uk_regulation.regulatory_source,
            'UK Health and Safety Executive, Working Time Regulations 1998'
        )
        self.assertEqual(
            self.us_regulation.regulatory_source,
            'Fair Labor Standards Act (FLSA), Department of Labor'
        )

    def test_get_effective_rules_for_security_method(self):
        """Test get_effective_rules_for_security method"""
        # Test UK rules without location
        uk_rules = self.uk_regulation.get_effective_rules_for_security()

        self.assertEqual(uk_rules['standard_weekly_hours'], 40.0)
        self.assertEqual(uk_rules['max_daily_hours'], 12.0)
        self.assertTrue(uk_rules['sia_license_required'])
        self.assertEqual(uk_rules['max_consecutive_shifts'], 5)

        # Test US rules with California location
        us_ca_rules = self.us_regulation.get_effective_rules_for_security('CA')

        self.assertEqual(us_ca_rules['standard_weekly_hours'], 40.0)
        self.assertEqual(us_ca_rules['max_daily_hours'], 12.0)  # CA override
        self.assertTrue(us_ca_rules['security_license_required'])
        self.assertTrue(us_ca_rules['meal_break_mandatory'])  # CA specific

        # Test US rules with New York location
        us_ny_rules = self.us_regulation.get_effective_rules_for_security('NY')

        self.assertEqual(us_ny_rules['max_daily_hours'], 12.0)  # NY override
        self.assertTrue(us_ny_rules['spread_of_hours_premium'])  # NY specific
        self.assertTrue(us_ny_rules['security_guard_registration'])  # NY specific

    def test_supports_opt_out_method(self):
        """Test supports_opt_out method"""
        # UK supports opt-out
        self.assertTrue(self.uk_regulation.supports_opt_out())

        # US doesn't have opt-out provisions configured
        self.assertFalse(self.us_regulation.supports_opt_out())

        # Test regulation with opt-out disabled
        regulation = WorkingHoursRegulation.objects.create(
            country_code='DE',
            country_name='Germany',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            max_daily_hours=Decimal('10.0'),
            max_weekly_hours=Decimal('48.0'),
            opt_out_provisions={'allowed': False}
        )
        self.assertFalse(regulation.supports_opt_out())

    def test_get_break_requirements_method(self):
        """Test get_break_requirements method"""
        # Test 6-hour shift
        break_req_6h = self.uk_regulation.get_break_requirements(6.0)
        self.assertIsNotNone(break_req_6h)
        self.assertEqual(break_req_6h['duration_minutes'], 20)
        self.assertTrue(break_req_6h['paid'])

        # Test 9-hour shift
        break_req_9h = self.uk_regulation.get_break_requirements(9.0)
        self.assertIsNotNone(break_req_9h)
        self.assertEqual(break_req_9h['duration_minutes'], 45)
        self.assertTrue(break_req_9h['paid'])

        # Test 12-hour shift
        break_req_12h = self.uk_regulation.get_break_requirements(12.0)
        self.assertIsNotNone(break_req_12h)
        self.assertEqual(break_req_12h['duration_minutes'], 60)
        self.assertFalse(break_req_12h['paid'])

        # Test short shift (no break required)
        break_req_5h = self.uk_regulation.get_break_requirements(5.0)
        self.assertIsNone(break_req_5h)

        # Test regulation without configured break requirements (fallback)
        regulation = WorkingHoursRegulation.objects.create(
            country_code='TEST',
            country_name='Test Country',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0'),
            break_trigger_hours=Decimal('6.0'),
            break_duration_minutes=30
        )

        fallback_break = regulation.get_break_requirements(8.0)
        self.assertIsNotNone(fallback_break)
        self.assertEqual(fallback_break['duration_minutes'], 30)
        self.assertTrue(fallback_break['paid'])
        self.assertTrue(fallback_break['mandatory'])

    def test_get_night_work_limits_method(self):
        """Test get_night_work_limits method"""
        night_limits = self.uk_regulation.get_night_work_limits()

        self.assertEqual(night_limits['max_consecutive_nights'], 8)
        self.assertEqual(night_limits['max_night_hours_per_week'], 40)
        self.assertEqual(night_limits['max_night_hours_daily'], 8)
        self.assertTrue(night_limits['health_assessment_required'])
        self.assertEqual(night_limits['night_start_time'], '23:00')
        self.assertEqual(night_limits['night_end_time'], '06:00')

        # Test regulation without night shift rules (defaults)
        regulation = WorkingHoursRegulation.objects.create(
            country_code='TEST2',
            country_name='Test Country 2',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0')
        )

        default_limits = regulation.get_night_work_limits()
        self.assertEqual(default_limits['max_consecutive_nights'], 8)
        self.assertEqual(default_limits['max_night_hours_per_week'], 40)
        self.assertFalse(default_limits['health_assessment_required'])

    def test_get_opt_out_requirements_method(self):
        """Test get_opt_out_requirements method"""
        # UK supports opt-out
        uk_opt_out = self.uk_regulation.get_opt_out_requirements()
        self.assertIsNotNone(uk_opt_out)
        self.assertTrue(uk_opt_out['allowed'])
        self.assertEqual(uk_opt_out['max_weekly_hours'], 60)
        self.assertTrue(uk_opt_out['written_agreement_required'])

        # US doesn't support opt-out
        us_opt_out = self.us_regulation.get_opt_out_requirements()
        self.assertIsNone(us_opt_out)

    def test_validate_security_shift_method(self):
        """Test validate_security_shift method"""
        # Test valid shift
        valid_shift = {
            'duration_hours': 8.0,
            'is_night_shift': False,
            'venue_location': None,
            'staff_has_sia_license': True,
            'break_scheduled': True
        }

        result = self.uk_regulation.validate_security_shift(valid_shift)
        self.assertTrue(result['valid'])
        self.assertEqual(len(result['violations']), 0)
        self.assertEqual(len(result['warnings']), 0)

        # Test shift exceeding maximum daily hours
        invalid_shift = {
            'duration_hours': 15.0,
            'is_night_shift': False,
            'venue_location': None,
            'staff_has_sia_license': True,
            'break_scheduled': True
        }

        result = self.uk_regulation.validate_security_shift(invalid_shift)
        self.assertFalse(result['valid'])
        self.assertGreater(len(result['violations']), 0)
        self.assertIn('exceeds maximum daily hours', result['violations'][0])

        # Test night shift validation
        night_shift = {
            'duration_hours': 10.0,
            'is_night_shift': True,
            'venue_location': None,
            'staff_has_sia_license': True,
            'break_scheduled': True
        }

        result = self.uk_regulation.validate_security_shift(night_shift)
        self.assertFalse(result['valid'])
        self.assertGreater(len(result['violations']), 0)
        self.assertIn('Night shift exceeds maximum', result['violations'][0])

        # Test SIA license requirement
        no_sia_shift = {
            'duration_hours': 8.0,
            'is_night_shift': False,
            'venue_location': None,
            'staff_has_sia_license': False,
            'break_scheduled': True
        }

        result = self.uk_regulation.validate_security_shift(no_sia_shift)
        self.assertFalse(result['valid'])
        self.assertIn('SIA license required', result['violations'][0])

        # Test break warning
        no_break_shift = {
            'duration_hours': 8.0,
            'is_night_shift': False,
            'venue_location': None,
            'staff_has_sia_license': True,
            'break_scheduled': False
        }

        result = self.uk_regulation.validate_security_shift(no_break_shift)
        self.assertTrue(result['valid'])  # Valid but with warning
        self.assertGreater(len(result['warnings']), 0)
        self.assertIn('Break required', result['warnings'][0])

        # Test US state override validation
        ca_shift = {
            'duration_hours': 10.0,
            'is_night_shift': False,
            'venue_location': 'CA',
            'staff_has_sia_license': True,
            'break_scheduled': True
        }

        result = self.us_regulation.validate_security_shift(ca_shift)
        self.assertTrue(result['valid'])  # 10 hours OK in CA
        self.assertEqual(result['effective_rules']['max_daily_hours'], 12.0)  # CA override

    def test_model_string_representation(self):
        """Test model __str__ method"""
        expected = "United Kingdom (GB) - 40.0h/week"
        self.assertEqual(str(self.uk_regulation), expected)

    def test_model_fields_validation(self):
        """Test model field validation"""
        # Test that JSON fields default to empty dict
        regulation = WorkingHoursRegulation(
            country_code='TEST',
            country_name='Test',
            standard_weekly_hours=Decimal('40.0'),
            standard_daily_hours=Decimal('8.0'),
            max_daily_hours=Decimal('12.0'),
            max_weekly_hours=Decimal('48.0')
        )

        # These should all default to empty dicts
        self.assertEqual(regulation.security_sector_overrides, {})
        self.assertEqual(regulation.break_requirements, {})
        self.assertEqual(regulation.night_shift_rules, {})
        self.assertEqual(regulation.opt_out_provisions, {})
        self.assertEqual(regulation.state_overrides, {})
        self.assertEqual(regulation.industry_specific_rules, {})

    def test_last_regulatory_update_auto_update(self):
        """Test that last_regulatory_update is automatically updated"""
        original_time = self.uk_regulation.last_regulatory_update

        # Update the regulation
        self.uk_regulation.regulatory_source = 'Updated source'
        self.uk_regulation.save()

        # Check that timestamp was updated
        self.assertGreater(self.uk_regulation.last_regulatory_update, original_time)