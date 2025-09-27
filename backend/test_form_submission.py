#!/usr/bin/env python3
"""
Test Form Submission Logic
Simulates the exact form submission flow
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
django.setup()

from api.models import WorkingHoursRegulation, ComplianceProfile
from api.serializers import ComplianceProfileSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

def test_full_form_submission():
    """Test complete form submission flow"""
    print("🧪 TESTING FULL FORM SUBMISSION FLOW\n")

    # Get a regulation (like the form would)
    regulation = WorkingHoursRegulation.objects.first()
    if not regulation:
        print("❌ No regulations available")
        return False

    print(f"✅ Using regulation: {regulation.country_name} ({regulation.country_code})")

    # Simulate form data exactly as frontend would send it
    form_data = {
        'name': 'Test Security Company Profile',
        'description': 'Comprehensive compliance profile for security operations with flexible overtime policies and manager approval requirements.',
        'working_hours_regulation': regulation.id,

        # Warning thresholds (like Step 3 in form)
        'daily_hours_warning_threshold': 80,
        'weekly_hours_warning_threshold': 85,
        'consecutive_days_warning_threshold': 5,

        # Automation settings (like Step 4 in form)
        'auto_approve_overtime': False,
        'auto_approve_extended_hours': False,
        'require_manager_approval': True,
        'notify_on_warnings': True,
        'notify_on_violations': True,
        'allow_break_flexibility': True,
        'grace_period_minutes': 15,

        # Optional overrides
        'override_max_daily_hours': None,
        'override_max_weekly_hours': None,
        'override_max_consecutive_days': None,
    }

    print("\n📝 Form Data:")
    for key, value in form_data.items():
        print(f"   {key}: {value}")

    # Test serializer validation (backend form processing)
    print("\n🔍 Testing Backend Validation...")
    serializer = ComplianceProfileSerializer(data=form_data)

    if serializer.is_valid():
        print("✅ Form data passes all validation rules")

        # Test saving (simulating successful form submission)
        try:
            profile = serializer.save()
            print(f"✅ Profile saved successfully with ID: {profile.id}")
            print(f"   Name: {profile.name}")
            print(f"   Regulation: {profile.working_hours_regulation.country_name}")
            print(f"   Warning Thresholds: {profile.daily_hours_warning_threshold}% daily, {profile.weekly_hours_warning_threshold}% weekly")
            print(f"   Grace Period: {profile.grace_period_minutes} minutes")

            # Clean up
            profile.delete()
            print("✅ Test profile cleaned up")

            return True

        except Exception as e:
            print(f"❌ Failed to save profile: {e}")
            return False
    else:
        print(f"❌ Validation failed: {serializer.errors}")
        return False

def test_edge_cases():
    """Test form edge cases and error handling"""
    print("\n\n🧪 TESTING EDGE CASES\n")

    regulation = WorkingHoursRegulation.objects.first()

    test_cases = [
        {
            'name': 'Minimum Values Test',
            'data': {
                'name': 'Min',  # Minimum length
                'description': 'Test',
                'working_hours_regulation': regulation.id,
                'daily_hours_warning_threshold': 50,  # Minimum allowed
                'weekly_hours_warning_threshold': 50,  # Minimum allowed
                'consecutive_days_warning_threshold': 1,  # Minimum allowed
                'grace_period_minutes': 0,  # Minimum allowed
            },
            'should_pass': True
        },
        {
            'name': 'Maximum Values Test',
            'data': {
                'name': 'A' * 100,  # Maximum length
                'description': 'A' * 500,  # Maximum length
                'working_hours_regulation': regulation.id,
                'daily_hours_warning_threshold': 99,  # Maximum allowed
                'weekly_hours_warning_threshold': 99,  # Maximum allowed
                'consecutive_days_warning_threshold': 13,  # Maximum allowed
                'grace_period_minutes': 120,  # Maximum allowed
            },
            'should_pass': True
        },
        {
            'name': 'Invalid Values Test',
            'data': {
                'name': '',  # Too short
                'description': 'Test description',
                'working_hours_regulation': regulation.id,
                'daily_hours_warning_threshold': 200,  # Too high
                'weekly_hours_warning_threshold': -10,  # Too low
                'consecutive_days_warning_threshold': 50,  # Too high
                'grace_period_minutes': -5,  # Negative
            },
            'should_pass': False
        }
    ]

    passed = 0
    for test_case in test_cases:
        print(f"🔍 {test_case['name']}:")

        serializer = ComplianceProfileSerializer(data=test_case['data'])
        is_valid = serializer.is_valid()

        if is_valid == test_case['should_pass']:
            print(f"   ✅ PASS - Validation result as expected")
            passed += 1
        else:
            expected = "valid" if test_case['should_pass'] else "invalid"
            actual = "valid" if is_valid else "invalid"
            print(f"   ❌ FAIL - Expected {expected}, got {actual}")
            if not is_valid:
                print(f"      Errors: {serializer.errors}")

    print(f"\n📊 Edge Cases: {passed}/{len(test_cases)} passed")
    return passed == len(test_cases)

def main():
    """Main test runner"""
    print("🚀 COMPREHENSIVE FORM LOGIC TESTING\n")

    test1 = test_full_form_submission()
    test2 = test_edge_cases()

    if test1 and test2:
        print("\n\n🎉 ALL FORM TESTS PASSED!")
        print("✅ Forms are working correctly with proper validation")
        print("✅ Submission flow is functional")
        print("✅ Edge cases are handled properly")
    else:
        print("\n\n⚠️ SOME TESTS FAILED")
        print("Check the errors above for issues")

if __name__ == "__main__":
    main()