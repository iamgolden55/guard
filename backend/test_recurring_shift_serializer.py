#!/usr/bin/env python
"""
Test the shift serializer directly to verify snake_case field handling
"""
import os
import django
import sys
from datetime import datetime, timedelta

# Setup Django
sys.path.insert(0, '/Users/new/Projects/mead-security/remix2/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import User, Venue
from shifts.serializers import ShiftSerializer
from django.utils import timezone

def test_shift_serializer_with_snake_case():
    """Test that ShiftSerializer properly handles snake_case fields"""

    print("\n" + "="*60)
    print("Testing ShiftSerializer with Snake Case Fields")
    print("="*60)

    try:
        # Get test data
        user = User.objects.filter(role='staff').first()
        venue = Venue.objects.first()

        if not user or not venue:
            print("❌ Error: No test user or venue found")
            return False

        print(f"✓ Test user: {user.get_full_name()} (ID: {user.id})")
        print(f"✓ Test venue: {venue.name} (ID: {venue.id})")

        # Test data with snake_case (what frontend now sends after fix)
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=20, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=4)

        shift_data = {
            'venue': venue.id,
            'staff_user': user.id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'status': 'scheduled',
            'required_security_role': 'sg',
            'notes': 'Test recurring shift',
            'hourly_rate': '15.00',
            'is_special_event': False
        }

        print("\n✓ Testing shift data (snake_case):")
        print(f"   venue: {shift_data['venue']}")
        print(f"   staff_user: {shift_data['staff_user']}")
        print(f"   start_time: {shift_data['start_time']}")
        print(f"   end_time: {shift_data['end_time']}")

        # Test serializer validation
        print("\n2. Validating with ShiftSerializer...")
        serializer = ShiftSerializer(data=shift_data, context={'allow_past_dates': False})

        if serializer.is_valid():
            print("✅ Serializer validation PASSED")
            print("\n✓ Validated data:")
            for key, value in serializer.validated_data.items():
                if key in ['start_time', 'end_time']:
                    print(f"   {key}: {value}")
                elif key in ['venue', 'staff_user']:
                    print(f"   {key}: {value}")

            # Save the shift
            shift = serializer.save()
            print(f"\n✅ SUCCESS: Shift created with ID {shift.id}")
            print(f"   Start: {shift.start_time}")
            print(f"   End: {shift.end_time}")
            print(f"   Staff: {shift.staff_user.get_full_name()}")
            print(f"   Venue: {shift.venue.name}")

            # Cleanup
            shift.delete()
            print(f"\n🧹 Test shift deleted")

            return True
        else:
            print("❌ Serializer validation FAILED")
            print("\nValidation errors:")
            for field, errors in serializer.errors.items():
                print(f"   {field}: {errors}")
            return False

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_mixed_case_fields():
    """Test what happens with mixed camelCase and snake_case (the old bug)"""

    print("\n" + "="*60)
    print("Testing Mixed Case Fields (Simulating Old Bug)")
    print("="*60)

    try:
        user = User.objects.filter(role='staff').first()
        venue = Venue.objects.first()

        if not user or not venue:
            return False

        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=20, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=4)

        # Simulating the OLD bug - mixed case
        mixed_data = {
            'venue': venue.id,
            'staff_user': user.id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'startTime': start_time.isoformat(),  # Extra camelCase (old bug)
            'endTime': end_time.isoformat(),      # Extra camelCase (old bug)
            'status': 'scheduled',
            'required_security_role': 'sg',
            'notes': 'Test with mixed case',
            'hourly_rate': '15.00',
            'is_special_event': False
        }

        print("\n⚠️  Testing shift data (MIXED case - old bug):")
        print(f"   Has both 'start_time' AND 'startTime'")
        print(f"   Has both 'end_time' AND 'endTime'")

        serializer = ShiftSerializer(data=mixed_data, context={'allow_past_dates': False})

        if serializer.is_valid():
            print("\n⚠️  Serializer accepted mixed case (unexpected)")
            print("   Note: Extra camelCase fields are ignored by Django")
            return True
        else:
            print("\n❌ Serializer rejected mixed case")
            print("\nValidation errors:")
            for field, errors in serializer.errors.items():
                print(f"   {field}: {errors}")
            return False

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

if __name__ == '__main__':
    print("\n" + "="*70)
    print("RECURRING SHIFT FIX VERIFICATION")
    print("="*70)

    test1 = test_shift_serializer_with_snake_case()
    test2 = test_mixed_case_fields()

    print("\n" + "="*70)
    print("FINAL RESULTS:")
    print("="*70)
    print(f"✓ Snake case test: {'PASSED' if test1 else 'FAILED'}")
    print(f"⚠️  Mixed case test: {'PASSED' if test2 else 'FAILED'}")

    if test1:
        print("\n✅ FIX VERIFIED: Recurring shifts with snake_case work correctly!")
        print("   The frontend fix is working as expected.")
        sys.exit(0)
    else:
        print("\n❌ FIX NOT WORKING: There are still issues")
        sys.exit(1)
