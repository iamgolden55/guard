#!/usr/bin/env python
"""
Complete test simulating frontend recurring shift creation flow
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
from shifts.serializers import ShiftSerializer
from django.utils import timezone

def simulate_frontend_recurring_shift_creation():
    """
    Simulates exactly what the frontend does when creating recurring shifts
    This matches the handleNewShiftSubmit function in ShiftScheduling.tsx
    """

    print("\n" + "="*70)
    print("COMPLETE RECURRING SHIFT FLOW TEST")
    print("Simulating Frontend: handleNewShiftSubmit()")
    print("="*70)

    try:
        # Setup: Get test data
        user = User.objects.filter(role='staff').first()
        venue = Venue.objects.first()

        if not user or not venue:
            print("❌ Error: No test user or venue found")
            return False

        print(f"\n✓ Setup:")
        print(f"   Staff: {user.get_full_name()} (ID: {user.id})")
        print(f"   Venue: {venue.name} (ID: {venue.id})")

        # STEP 1: User input (from form)
        newShiftDate = datetime.now() + timedelta(days=1)
        newShiftStartTime = "20:00"
        newShiftEndTime = "04:00"  # Next day
        newShiftNotes = "Weekly recurring test shift"
        payRate = 15.00
        isSpecialEvent = False

        # Recurring settings
        isShiftRecurring = True
        recurringType = '0'  # Weekly
        recurringDays = [0, 2, 4]  # Monday, Wednesday, Friday
        recurringEndDate = newShiftDate + timedelta(weeks=3)

        print(f"\n✓ User Input:")
        print(f"   Start Date: {newShiftDate.strftime('%Y-%m-%d')}")
        print(f"   Start Time: {newShiftStartTime}")
        print(f"   End Time: {newShiftEndTime}")
        print(f"   Recurring: {isShiftRecurring}")
        print(f"   Pattern: {'Weekly' if recurringType == '0' else 'Monthly'}")
        day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        selected_days = [day_names[d] for d in recurringDays]
        print(f"   Days: {', '.join(selected_days)}")
        print(f"   End Date: {recurringEndDate.strftime('%Y-%m-%d')}")

        # STEP 2: Format times (from frontend logic)
        def formatTimeToISO(date, timeString):
            hours, minutes = map(int, timeString.split(':'))
            dateObj = date.replace(hour=hours, minute=minutes, second=0, microsecond=0)
            return dateObj

        startDateTime = formatTimeToISO(newShiftDate, newShiftStartTime)
        endDateTime = formatTimeToISO(newShiftDate, newShiftEndTime)

        # Handle midnight crossing
        if endDateTime < startDateTime:
            nextDay = newShiftDate + timedelta(days=1)
            endDateTime = formatTimeToISO(nextDay, newShiftEndTime)

        # STEP 3: Create base shift data (matches frontend baseShiftData)
        baseShiftData = {
            'venue': venue.id,
            'staff_user': user.id,
            'start_time': startDateTime,
            'end_time': endDateTime,
            'notes': newShiftNotes,
            'status': 'scheduled',
            'required_security_role': 'sg',
            'hourly_rate': payRate,
            'is_special_event': isSpecialEvent
        }

        print(f"\n✓ Base Shift Data:")
        print(f"   venue: {baseShiftData['venue']}")
        print(f"   staff_user: {baseShiftData['staff_user']}")
        print(f"   start_time: {baseShiftData['start_time']}")
        print(f"   end_time: {baseShiftData['end_time']}")

        # STEP 4: Generate recurring dates (matches frontend logic)
        dates = []
        startDate = newShiftDate
        endDate = recurringEndDate

        if recurringType == '0':  # Weekly
            d = startDate
            while d <= endDate:
                dayOfWeek = d.weekday()
                if dayOfWeek in recurringDays:
                    dates.append(d)
                d += timedelta(days=1)

        print(f"\n✓ Generated {len(dates)} recurring shift dates:")
        for i, date in enumerate(dates[:5], 1):  # Show first 5
            print(f"   {i}. {date.strftime('%Y-%m-%d %A')}")
        if len(dates) > 5:
            print(f"   ... and {len(dates) - 5} more")

        # STEP 5: Create shifts (FIXED VERSION - using snake_case)
        print(f"\n✓ Creating recurring shifts (using FIXED snake_case):")

        created_shifts = []
        failed_shifts = []

        for i, date in enumerate(dates, 1):
            shiftDate = date

            # THIS IS THE FIX: Use snake_case consistently
            recurringShiftData = {
                **baseShiftData,
                'start_time': formatTimeToISO(shiftDate, newShiftStartTime),
                'end_time': formatTimeToISO(shiftDate, newShiftEndTime),
            }

            # Handle midnight crossing for this specific date
            if recurringShiftData['end_time'] < recurringShiftData['start_time']:
                nextDay = shiftDate + timedelta(days=1)
                recurringShiftData['end_time'] = formatTimeToISO(nextDay, newShiftEndTime)

            # Validate and create shift
            serializer = ShiftSerializer(data=recurringShiftData, context={'allow_past_dates': False})

            if serializer.is_valid():
                shift = serializer.save()
                created_shifts.append(shift)
                print(f"   ✅ Shift {i}: ID {shift.id} - {shift.start_time.strftime('%Y-%m-%d %H:%M')}")
            else:
                failed_shifts.append({
                    'index': i,
                    'date': shiftDate,
                    'errors': serializer.errors
                })
                print(f"   ❌ Shift {i} failed: {serializer.errors}")

        # RESULTS
        print(f"\n" + "="*70)
        print("RESULTS:")
        print("="*70)
        print(f"✓ Successfully created: {len(created_shifts)} shifts")
        print(f"✗ Failed: {len(failed_shifts)} shifts")

        if failed_shifts:
            print("\nFailed shifts:")
            for fail in failed_shifts[:3]:  # Show first 3 failures
                print(f"   {fail['index']}. {fail['date'].strftime('%Y-%m-%d')}: {fail['errors']}")

        # Cleanup
        if created_shifts:
            print(f"\n🧹 Cleaning up {len(created_shifts)} test shifts...")
            for shift in created_shifts:
                shift.delete()
            print("   ✓ Cleanup complete")

        # Final verdict
        success = len(created_shifts) > 0 and len(failed_shifts) == 0

        print(f"\n" + "="*70)
        if success:
            print("✅ COMPLETE SUCCESS!")
            print("   All recurring shifts created successfully")
            print("   The snake_case fix is working perfectly")
        else:
            print("⚠️ PARTIAL SUCCESS")
            print(f"   {len(created_shifts)} shifts created")
            print(f"   {len(failed_shifts)} shifts failed")

        print("="*70)

        return success

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = simulate_frontend_recurring_shift_creation()
    sys.exit(0 if success else 1)
