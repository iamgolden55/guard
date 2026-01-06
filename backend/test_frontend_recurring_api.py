#!/usr/bin/env python
"""
Test script to simulate the frontend API call for creating recurring shifts
"""
import requests
import json
from datetime import datetime, timedelta

# Test configuration
BASE_URL = "http://localhost:8000"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login/"
SHIFTS_URL = f"{BASE_URL}/api/v1/shifts/"

def test_frontend_recurring_shift_api():
    """Simulate frontend creating recurring shifts via API"""

    print("\n" + "="*60)
    print("Testing Frontend Recurring Shift API Call")
    print("="*60)

    # Step 1: Login to get session cookie
    print("\n1. Logging in...")
    session = requests.Session()
    login_data = {
        "email": "test@test.com",
        "password": "test123"
    }

    try:
        login_response = session.post(LOGIN_URL, json=login_data)
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            return False

        print(f"✓ Login successful")

        # Step 2: Create recurring shifts (simulating the frontend)
        print("\n2. Creating recurring shifts...")

        # Get venues to use a real venue ID
        venues_response = session.get(f"{BASE_URL}/api/v1/venues/")
        if venues_response.status_code != 200:
            print(f"❌ Failed to get venues: {venues_response.status_code}")
            return False

        venues = venues_response.json()
        if not venues:
            print("❌ No venues found")
            return False

        venue_id = venues[0]['id']
        print(f"✓ Using venue ID: {venue_id}")

        # Get staff user to assign
        users_response = session.get(f"{BASE_URL}/api/v1/users/")
        if users_response.status_code != 200:
            print(f"❌ Failed to get users: {users_response.status_code}")
            return False

        users = users_response.json()
        staff_user = next((u for u in users if u.get('role') == 'staff'), None)

        if not staff_user:
            print("❌ No staff user found")
            return False

        staff_user_id = staff_user['id']
        print(f"✓ Using staff user ID: {staff_user_id}")

        # Create 3 recurring shifts (weekly)
        print("\n3. Creating 3 weekly recurring shifts...")

        created_count = 0
        failed_count = 0
        errors = []

        for i in range(3):
            # Calculate shift date (1 day from now + i weeks)
            shift_date = datetime.now() + timedelta(days=1, weeks=i)
            start_time = shift_date.replace(hour=20, minute=0, second=0, microsecond=0)
            end_time = start_time.replace(hour=23, minute=59)

            # THIS IS THE KEY FIX: Using snake_case field names
            shift_data = {
                'venue': venue_id,
                'staff_user': staff_user_id,
                'start_time': start_time.isoformat(),
                'end_time': end_time.isoformat(),
                'status': 'scheduled',
                'required_security_role': 'sg',
                'notes': f'Test recurring shift #{i+1}',
                'hourly_rate': 15.00,
                'is_special_event': False
            }

            response = session.post(SHIFTS_URL, json=shift_data)

            if response.status_code == 201:
                shift = response.json()
                created_count += 1
                print(f"   ✓ Shift {i+1}: ID {shift['id']} - {start_time.strftime('%Y-%m-%d %H:%M')}")
            else:
                failed_count += 1
                error_detail = response.json() if response.text else "No error details"
                errors.append({
                    'shift_num': i+1,
                    'status': response.status_code,
                    'error': error_detail
                })
                print(f"   ❌ Shift {i+1} failed: {response.status_code}")
                print(f"      Error: {error_detail}")

        # Summary
        print(f"\n" + "="*60)
        print("RESULTS:")
        print("="*60)
        print(f"✓ Created: {created_count} shifts")
        print(f"✗ Failed: {failed_count} shifts")

        if created_count == 3 and failed_count == 0:
            print("\n✅ SUCCESS: All recurring shifts created successfully!")
            print("   The snake_case field fix is working correctly.")
            return True
        else:
            print("\n⚠️ PARTIAL SUCCESS: Some shifts failed")
            if errors:
                print("\nError details:")
                for err in errors:
                    print(f"   Shift {err['shift_num']}: {err['error']}")
            return False

    except requests.exceptions.RequestException as e:
        print(f"\n❌ Network error: {str(e)}")
        return False
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    import sys
    success = test_frontend_recurring_shift_api()
    sys.exit(0 if success else 1)
