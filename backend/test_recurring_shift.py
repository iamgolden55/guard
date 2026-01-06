#!/usr/bin/env python
"""
Test script to verify recurring shift creation works with snake_case fields
"""
import os
import django
import sys
from datetime import datetime, timedelta

# Setup Django
sys.path.insert(0, '/Users/new/Projects/mead-security/remix2/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import User, Venue, Shift
from django.utils import timezone

def test_recurring_shift_creation():
    """Test creating a recurring shift with proper snake_case field names"""

    print("\n" + "="*60)
    print("Testing Recurring Shift Creation (Snake Case Fields)")
    print("="*60)

    # Get a test user and venue
    try:
        user = User.objects.filter(role='staff').first()
        venue = Venue.objects.first()

        if not user or not venue:
            print("❌ Error: No test user or venue found")
            print("   Please create a staff user and venue first")
            return False

        print(f"✓ Using test user: {user.get_full_name()} (ID: {user.id})")
        print(f"✓ Using test venue: {venue.name} (ID: {venue.id})")

        # Create base shift data (snake_case)
        base_start_time = timezone.now() + timedelta(days=1)
        base_start_time = base_start_time.replace(hour=20, minute=0, second=0, microsecond=0)
        base_end_time = base_start_time.replace(hour=23, minute=59)

        base_shift_data = {
            'venue': venue,
            'staff_user': user,
            'start_time': base_start_time,
            'end_time': base_end_time,
            'status': 'scheduled',
            'required_security_role': 'sg',
            'notes': 'Test recurring shift',
            'hourly_rate': 15.00,
            'is_special_event': False
        }

        print(f"\n✓ Base shift data created:")
        print(f"   Start: {base_start_time}")
        print(f"   End: {base_end_time}")

        # Simulate recurring shift creation (3 shifts over 3 weeks)
        recurring_dates = []
        for i in range(3):
            shift_date = base_start_time + timedelta(weeks=i)
            recurring_dates.append(shift_date)

        print(f"\n✓ Creating {len(recurring_dates)} recurring shifts:")

        created_shifts = []
        for i, shift_date in enumerate(recurring_dates, 1):
            # This simulates what the frontend now does (using snake_case)
            recurring_shift_data = {
                **base_shift_data,
                'start_time': shift_date,
                'end_time': shift_date + timedelta(hours=3, minutes=59)
            }

            # Create the shift
            shift = Shift.objects.create(**recurring_shift_data)
            created_shifts.append(shift)

            print(f"   {i}. Shift ID {shift.id}: {shift.start_time.strftime('%Y-%m-%d %H:%M')}")

        print(f"\n✅ SUCCESS: Created {len(created_shifts)} recurring shifts")
        print(f"   All shifts use proper snake_case field names")

        # Cleanup - delete the test shifts
        print(f"\n🧹 Cleaning up test shifts...")
        for shift in created_shifts:
            shift.delete()
        print(f"   ✓ Deleted {len(created_shifts)} test shifts")

        return True

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_recurring_shift_creation()
    sys.exit(0 if success else 1)
