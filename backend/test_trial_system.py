"""
Test script to verify the trial system is working correctly.
This creates a new company and verifies trial is auto-enabled.
"""

import os
import sys
import django
from datetime import timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'security_staff_management.settings')
django.setup()

from django.utils import timezone
from api.models import SecurityCompany, User

def test_trial_system():
    """Test the automatic trial system"""
    print("=" * 80)
    print("TRIAL SYSTEM TEST")
    print("=" * 80)
    print()

    # Get or create a test user to be the creator
    test_user, created = User.objects.get_or_create(
        username='trialtest_admin',
        defaults={
            'email': 'trialtest@example.com',
            'first_name': 'Trial',
            'last_name': 'Test',
            'role': 'Admin',
        }
    )
    if created:
        test_user.set_password('testpassword123')
        test_user.save()
        print(f"✅ Created test user: {test_user.username}")
    else:
        print(f"✅ Using existing test user: {test_user.username}")

    print()

    # Create a new test company
    print("Creating new test company...")
    test_company = SecurityCompany.objects.create(
        name='Trial Test Company',
        trading_name='Trial Test Company',
        registration_number='TEST' + str(timezone.now().timestamp())[:8],
        tax_id='TAX' + str(timezone.now().timestamp())[:8],
        country_code='GBR',
        city='London',
        postal_code='SW1A 1AA',
        address_line_1='Test Address',
        billing_email='billing@trialtest.com',
        primary_contact_name='Test Contact',
        primary_contact_email='contact@trialtest.com',
        primary_contact_phone='+44 20 1234 5678',
        industry_type='events',
        company_size='small',
        subscription_tier='professional',  # User selected tier
        staff_capacity=50,
        venue_capacity=20,
        timezone='Europe/London',
        currency='GBP',
        created_by=test_user,
    )

    print(f"✅ Created company: {test_company.name} (ID: {test_company.id})")
    print()

    # Verify trial settings
    print("-" * 80)
    print("TRIAL VERIFICATION")
    print("-" * 80)
    print(f"Company Name: {test_company.name}")
    print(f"Selected Tier: {test_company.subscription_tier}")
    print(f"Is Trial: {test_company.is_trial}")
    print(f"Trial End Date: {test_company.trial_end_date}")
    print(f"Created At: {test_company.created_at}")
    print()

    # Check if trial was auto-enabled
    if test_company.is_trial:
        print("✅ PASS: Trial mode automatically enabled!")
    else:
        print("❌ FAIL: Trial mode NOT enabled (signal didn't work)")
        return False

    if test_company.trial_end_date:
        expected_end = test_company.created_at + timedelta(days=30)
        actual_end = test_company.trial_end_date
        diff_seconds = abs((actual_end - expected_end).total_seconds())

        if diff_seconds < 60:  # Within 1 minute is acceptable
            print("✅ PASS: Trial end date set to 30 days from creation!")
            print(f"   Expected: ~{expected_end}")
            print(f"   Actual: {actual_end}")
        else:
            print("❌ FAIL: Trial end date not set correctly")
            print(f"   Expected: {expected_end}")
            print(f"   Actual: {actual_end}")
            return False
    else:
        print("❌ FAIL: Trial end date NOT set")
        return False

    print()

    # Test subscription status
    print("-" * 80)
    print("SUBSCRIPTION STATUS TEST")
    print("-" * 80)
    status = test_company.get_subscription_status()
    print(f"Subscription Status: {status}")

    if status == 'trial_active':
        print("✅ PASS: Status correctly shows 'trial_active'")
    else:
        print(f"❌ FAIL: Expected 'trial_active', got '{status}'")
        return False

    print()

    # Test trial days remaining
    print("-" * 80)
    print("TRIAL DAYS REMAINING TEST")
    print("-" * 80)
    days_remaining = test_company.get_trial_days_remaining()
    print(f"Days Remaining: {days_remaining}")

    if 29 <= days_remaining <= 30:
        print("✅ PASS: Trial days remaining is correct (29-30 days)")
    else:
        print(f"❌ FAIL: Expected 29-30 days, got {days_remaining}")
        return False

    print()

    # Test feature access
    print("-" * 80)
    print("FEATURE ACCESS TEST")
    print("-" * 80)
    print("Testing feature access during trial period...")
    print()

    # During trial, all features should be enabled
    test_features = [
        'basic_scheduling',
        'deputy_integration',
        'advanced_reports',
        'api_access',  # Only available in enterprise, but should work during trial
        'custom_branding',  # Only available in enterprise, but should work during trial
    ]

    all_features_enabled = True
    for feature in test_features:
        has_access = test_company.has_feature_access(feature)
        status_icon = "✅" if has_access else "❌"
        print(f"  {status_icon} {feature}: {has_access}")
        if not has_access:
            all_features_enabled = False

    print()
    if all_features_enabled:
        print("✅ PASS: All features enabled during trial (even enterprise features)!")
    else:
        print("❌ FAIL: Some features are restricted during trial")
        return False

    print()

    # Test feature access summary
    print("-" * 80)
    print("FEATURE ACCESS SUMMARY")
    print("-" * 80)
    summary = test_company.get_feature_access_summary()
    print(f"Subscription Status: {summary['subscription_status']}")
    print(f"Is Trial: {summary['is_trial']}")
    print(f"Trial Days Remaining: {summary['trial_days_remaining']}")
    print(f"Subscription Tier: {summary['subscription_tier']}")
    print(f"Staff Capacity: {summary['current_staff_count']}/{summary['staff_capacity']}")
    print(f"Venue Capacity: {summary['current_venue_count']}/{summary['venue_capacity']}")
    print()

    # Cleanup - delete test company
    print("-" * 80)
    print("CLEANUP")
    print("-" * 80)
    print("Deleting test company...")
    test_company.delete()
    print("✅ Test company deleted")
    print()

    print("=" * 80)
    print("ALL TESTS PASSED! ✅")
    print("=" * 80)
    print()
    print("Trial system is working correctly:")
    print("  ✅ New companies automatically get 30-day trial")
    print("  ✅ Trial end date is set correctly")
    print("  ✅ Subscription status shows 'trial_active'")
    print("  ✅ All features are enabled during trial")
    print("  ✅ Feature access enforcement logic is working")
    print()

    return True


if __name__ == '__main__':
    try:
        success = test_trial_system()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
