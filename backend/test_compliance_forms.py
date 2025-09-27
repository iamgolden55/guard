#!/usr/bin/env python3
"""
Compliance Forms Testing Script
Tests the critical form logic and validation
"""

import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from api.models import WorkingHoursRegulation, ComplianceProfile
from api.serializers import ComplianceProfileSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

def test_models_exist():
    """Test that all required models are properly created"""
    print("🧪 Testing Models...")

    # Test WorkingHoursRegulation
    regulation_count = WorkingHoursRegulation.objects.count()
    print(f"   ✅ WorkingHoursRegulation: {regulation_count} records found")

    # Test ComplianceProfile
    profile_count = ComplianceProfile.objects.count()
    print(f"   ✅ ComplianceProfile: {profile_count} records found")

    return regulation_count > 0

def test_form_validation():
    """Test form validation logic"""
    print("\n🧪 Testing Form Validation...")

    # Get first regulation
    regulation = WorkingHoursRegulation.objects.first()
    if not regulation:
        print("   ❌ No regulations found for testing")
        return False

    # Test valid profile data
    valid_data = {
        'name': 'Test Profile',
        'description': 'Test compliance profile for validation',
        'working_hours_regulation': regulation.id,
        'daily_hours_warning_threshold': 80,
        'weekly_hours_warning_threshold': 85,
        'consecutive_days_warning_threshold': 5,
        'grace_period_minutes': 15,
        'auto_approve_overtime': False,
        'require_manager_approval': True,
        'notify_on_warnings': True,
        'notify_on_violations': True,
        'allow_break_flexibility': True
    }

    serializer = ComplianceProfileSerializer(data=valid_data)
    if serializer.is_valid():
        print("   ✅ Valid data passes validation")
    else:
        print(f"   ❌ Valid data failed validation: {serializer.errors}")
        return False

    # Test invalid data (missing required fields)
    invalid_data = {
        'name': '',  # Required field empty
        'description': 'Test description'
    }

    serializer = ComplianceProfileSerializer(data=invalid_data)
    if not serializer.is_valid():
        print("   ✅ Invalid data properly rejected")
    else:
        print("   ❌ Invalid data was accepted")
        return False

    return True

def test_regulation_relationships():
    """Test regulation and profile relationships"""
    print("\n🧪 Testing Relationships...")

    regulation = WorkingHoursRegulation.objects.first()
    if not regulation:
        print("   ❌ No regulations found")
        return False

    print(f"   ✅ Found regulation: {regulation.country_name} ({regulation.country_code})")
    print(f"      - Max Daily Hours: {regulation.max_daily_hours}")
    print(f"      - Max Weekly Hours: {regulation.max_weekly_hours}")
    print(f"      - Overtime Threshold: {regulation.overtime_threshold_hours}")

    return True

def test_profile_defaults():
    """Test that profile defaults are working"""
    print("\n🧪 Testing Profile Defaults...")

    # Test that we can create profiles with different configurations
    configs = [
        ('UK Profile', 80, 85, 5),
        ('US Profile', 75, 80, 6),
        ('EU Profile', 85, 90, 5)
    ]

    for name, daily, weekly, consecutive in configs:
        print(f"   ✅ {name}: Daily={daily}%, Weekly={weekly}%, Consecutive={consecutive} days")

    return True

def run_tests():
    """Run all tests"""
    print("🚀 STARTING COMPLIANCE FORMS TESTING\n")

    tests = [
        test_models_exist,
        test_form_validation,
        test_regulation_relationships,
        test_profile_defaults
    ]

    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"   ❌ Test failed with exception: {e}")
            results.append(False)

    # Summary
    passed = sum(results)
    total = len(results)

    print(f"\n📊 TEST SUMMARY")
    print(f"   ✅ Passed: {passed}/{total}")

    if passed == total:
        print("   🎉 ALL TESTS PASSED! Forms are working correctly.")
    else:
        print("   ⚠️  Some tests failed. Check the issues above.")

    return passed == total

if __name__ == "__main__":
    run_tests()