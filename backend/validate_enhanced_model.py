#!/usr/bin/env python
"""
Validation script for enhanced WorkingHoursRegulation model.
Tests the new functionality without running full Django tests.
"""

import os
import sys
import django
from decimal import Decimal

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import WorkingHoursRegulation


def test_model_creation():
    """Test creating a WorkingHoursRegulation with enhanced fields"""
    print("Testing model creation...")

    # Test UK regulation
    uk_reg = WorkingHoursRegulation(
        country_code='TEST_UK',
        country_name='Test UK',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('12.0'),
        max_weekly_hours=Decimal('60.0'),
        regulatory_source='Test source',
        security_sector_overrides={
            'sia_license_required': True,
            'max_consecutive_shifts': 5
        },
        break_requirements={
            '6_hours': {'duration_minutes': 20, 'paid': True},
            '9_hours': {'duration_minutes': 45, 'paid': True}
        },
        night_shift_rules={
            'max_night_hours_daily': 8,
            'health_assessment_required': True
        },
        opt_out_provisions={
            'allowed': True,
            'max_weekly_hours': 60
        }
    )

    print("✓ Model creation successful")
    print(f"Security overrides: {uk_reg.security_sector_overrides}")
    print(f"Break requirements: {uk_reg.break_requirements}")


def test_effective_rules_method():
    """Test get_effective_rules_for_security method"""
    print("\nTesting get_effective_rules_for_security method...")

    # Create test regulation
    reg = WorkingHoursRegulation(
        country_code='TEST',
        country_name='Test Country',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('12.0'),
        max_weekly_hours=Decimal('48.0'),
        security_sector_overrides={
            'sia_license_required': True,
            'enhanced_checks': True
        },
        state_overrides={
            'CA': {'max_daily_hours': 10.0, 'overtime_daily': 8.0}
        }
    )

    # Test basic rules
    rules = reg.get_effective_rules_for_security()
    assert rules['standard_weekly_hours'] == 40.0
    assert rules['sia_license_required'] == True
    assert rules['enhanced_checks'] == True
    print("✓ Basic rules retrieval successful")

    # Test with location (US state override)
    reg.country_code = 'US'
    ca_rules = reg.get_effective_rules_for_security('CA')
    assert ca_rules['max_daily_hours'] == 10.0
    assert ca_rules['overtime_daily'] == 8.0
    print("✓ State override rules successful")


def test_break_requirements_method():
    """Test get_break_requirements method"""
    print("\nTesting get_break_requirements method...")

    reg = WorkingHoursRegulation(
        country_code='TEST',
        country_name='Test Country',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('12.0'),
        max_weekly_hours=Decimal('48.0'),
        break_requirements={
            '6_hours': {'duration_minutes': 20, 'paid': True},
            '9_hours': {'duration_minutes': 45, 'paid': True}
        },
        break_trigger_hours=Decimal('6.0'),
        break_duration_minutes=30
    )

    # Test 8-hour shift
    break_8h = reg.get_break_requirements(8.0)
    assert break_8h is not None
    assert break_8h['duration_minutes'] == 20
    assert break_8h['paid'] == True
    print("✓ 8-hour break requirement successful")

    # Test 10-hour shift
    break_10h = reg.get_break_requirements(10.0)
    assert break_10h['duration_minutes'] == 45
    print("✓ 10-hour break requirement successful")

    # Test short shift
    break_4h = reg.get_break_requirements(4.0)
    assert break_4h is None
    print("✓ Short shift (no break) successful")


def test_opt_out_methods():
    """Test opt-out related methods"""
    print("\nTesting opt-out methods...")

    # UK regulation with opt-out
    uk_reg = WorkingHoursRegulation(
        country_code='GB',
        country_name='United Kingdom',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('12.0'),
        max_weekly_hours=Decimal('48.0'),
        opt_out_provisions={
            'allowed': True,
            'max_weekly_hours': 60,
            'written_agreement_required': True
        }
    )

    assert uk_reg.supports_opt_out() == True
    opt_out_reqs = uk_reg.get_opt_out_requirements()
    assert opt_out_reqs is not None
    assert opt_out_reqs['max_weekly_hours'] == 60
    print("✓ UK opt-out support successful")

    # US regulation without opt-out
    us_reg = WorkingHoursRegulation(
        country_code='US',
        country_name='United States',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('16.0'),
        max_weekly_hours=Decimal('80.0')
    )

    assert us_reg.supports_opt_out() == False
    assert us_reg.get_opt_out_requirements() is None
    print("✓ US no opt-out successful")


def test_night_work_limits():
    """Test get_night_work_limits method"""
    print("\nTesting get_night_work_limits method...")

    reg = WorkingHoursRegulation(
        country_code='TEST',
        country_name='Test Country',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('12.0'),
        max_weekly_hours=Decimal('48.0'),
        night_shift_rules={
            'max_night_hours_daily': 8,
            'health_assessment_required': True,
            'night_start_time': '23:00'
        }
    )

    limits = reg.get_night_work_limits()
    assert limits['max_night_hours_daily'] == 8
    assert limits['health_assessment_required'] == True
    assert limits['night_start_time'] == '23:00'
    print("✓ Night work limits successful")


def test_shift_validation():
    """Test validate_security_shift method"""
    print("\nTesting validate_security_shift method...")

    reg = WorkingHoursRegulation(
        country_code='GB',
        country_name='United Kingdom',
        standard_weekly_hours=Decimal('40.0'),
        standard_daily_hours=Decimal('8.0'),
        max_daily_hours=Decimal('12.0'),
        max_weekly_hours=Decimal('48.0'),
        security_sector_overrides={
            'sia_license_required': True
        },
        break_requirements={
            '6_hours': {'duration_minutes': 20, 'paid': True, 'mandatory': True}
        },
        night_shift_rules={
            'max_night_hours_daily': 8
        }
    )

    # Test valid shift
    valid_shift = {
        'duration_hours': 8.0,
        'is_night_shift': False,
        'staff_has_sia_license': True,
        'break_scheduled': True
    }

    result = reg.validate_security_shift(valid_shift)
    assert result['valid'] == True
    assert len(result['violations']) == 0
    print("✓ Valid shift validation successful")

    # Test invalid shift (too long)
    invalid_shift = {
        'duration_hours': 15.0,
        'is_night_shift': False,
        'staff_has_sia_license': True,
        'break_scheduled': True
    }

    result = reg.validate_security_shift(invalid_shift)
    assert result['valid'] == False
    assert len(result['violations']) > 0
    print("✓ Invalid shift validation successful")

    # Test night shift violation
    night_shift = {
        'duration_hours': 10.0,
        'is_night_shift': True,
        'staff_has_sia_license': True,
        'break_scheduled': True
    }

    result = reg.validate_security_shift(night_shift)
    assert result['valid'] == False
    print("✓ Night shift validation successful")

    # Test SIA license requirement
    no_sia_shift = {
        'duration_hours': 8.0,
        'is_night_shift': False,
        'staff_has_sia_license': False,
        'break_scheduled': True
    }

    result = reg.validate_security_shift(no_sia_shift)
    assert result['valid'] == False
    assert any('SIA license' in v for v in result['violations'])
    print("✓ SIA license validation successful")


def main():
    """Run all validation tests"""
    print("=== Enhanced WorkingHoursRegulation Model Validation ===\n")

    try:
        test_model_creation()
        test_effective_rules_method()
        test_break_requirements_method()
        test_opt_out_methods()
        test_night_work_limits()
        test_shift_validation()

        print("\n=== ALL TESTS PASSED ===")
        print("✓ Enhanced WorkingHoursRegulation model working correctly")
        print("✓ All new fields and methods functional")
        print("✓ Security industry compliance features operational")
        print("✓ Regional compliance logic working")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()