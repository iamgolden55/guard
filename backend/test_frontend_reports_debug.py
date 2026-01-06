#!/usr/bin/env python3
"""
Debug test script to identify why frontend reports return 0 incidents
"""
import requests
import json
from datetime import datetime, timedelta
import subprocess

BASE_URL = "http://localhost:8000/api/v1"

def test_frontend_reports_debug():
    print("=" * 60)
    print("DEBUG: FRONTEND REPORTS FILTERING")
    print("=" * 60)

    # Step 1: Get token
    print("\n1. Getting auth token...")
    result = subprocess.run([
        'python', 'manage.py', 'shell', '-c',
        "from api.models import User; from rest_framework_simplejwt.tokens import RefreshToken; "
        "user = User.objects.get(id=83); "
        "refresh = RefreshToken.for_user(user); "
        "print(refresh.access_token)"
    ], capture_output=True, text=True)

    token = result.stdout.strip()
    print(f"✅ Got token")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 2: Check incident in database
    print("\n2. Checking incident in database...")
    result = subprocess.run([
        'python', 'manage.py', 'shell', '-c',
        "from api.models import IncidentReport; "
        "incidents = IncidentReport.objects.all(); "
        "print(f'Total incidents: {incidents.count()}'); "
        "for inc in incidents: "
        "    print(f'ID {inc.id}: occurred_at={inc.occurred_at}, incident_time={inc.incident_time}, venue={inc.venue_id}');"
    ], capture_output=True, text=True)
    print(result.stdout)

    # Step 3: Test WITHOUT date filters
    print("\n3. Testing /api/v1/incident-reports/ WITHOUT date filters...")
    response = requests.get(
        f"{BASE_URL}/incident-reports/",
        headers=headers
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(incidents)} incidents (no filters)")

        if incidents:
            print("\nFirst incident details:")
            incident = incidents[0]
            print(f"  ID: {incident.get('id')}")
            print(f"  Title: {incident.get('title')}")
            print(f"  Occurred: {incident.get('occurredAt') or incident.get('occurred_at')}")
            print(f"  Venue: {incident.get('venue')}")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(response.text)

    # Step 4: Test with WIDE date range (last 365 days)
    print("\n4. Testing with wide date range (365 days)...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)

    params_wide = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }

    print(f"Query params: {params_wide}")

    response = requests.get(
        f"{BASE_URL}/incident-reports/",
        headers=headers,
        params=params_wide
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(incidents)} incidents (wide date range)")
    else:
        print(f"❌ Failed: {response.status_code}")

    # Step 5: Test with NARROW date range (last 30 days)
    print("\n5. Testing with narrow date range (30 days)...")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    params_narrow = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }

    print(f"Query params: {params_narrow}")

    response = requests.get(
        f"{BASE_URL}/incident-reports/",
        headers=headers,
        params=params_narrow
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(incidents)} incidents (30 day range)")
    else:
        print(f"❌ Failed: {response.status_code}")

    # Step 6: Test with TODAY only
    print("\n6. Testing with today's date only...")
    today = datetime.now().strftime('%Y-%m-%d')

    params_today = {
        'start_date': today,
        'end_date': today
    }

    print(f"Query params: {params_today}")

    response = requests.get(
        f"{BASE_URL}/incident-reports/",
        headers=headers,
        params=params_today
    )

    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(incidents)} incidents (today only)")

        if incidents:
            for incident in incidents:
                print(f"  - ID {incident.get('id')}: {incident.get('title')}")
    else:
        print(f"❌ Failed: {response.status_code}")

    # Step 7: Check user's staff_profile and venue filtering
    print("\n7. Checking multi-tenant filtering...")
    result = subprocess.run([
        'python', 'manage.py', 'shell', '-c',
        "from api.models import User, IncidentReport, Venue; "
        "user = User.objects.get(id=83); "
        "print(f'User has staff_profile: {hasattr(user, \"staff_profile\")}'); "
        "if hasattr(user, 'staff_profile') and user.staff_profile: "
        "    print(f'Company: {user.staff_profile.security_company}'); "
        "inc = IncidentReport.objects.first(); "
        "if inc: "
        "    venue = inc.venue; "
        "    print(f'Incident venue: {venue.name} (ID: {venue.id})'); "
        "    print(f'Venue company: {venue.security_company if hasattr(venue, \"security_company\") else \"N/A\"}');"
    ], capture_output=True, text=True)
    print(result.stdout)

    print("\n" + "=" * 60)
    print("DEBUG TEST COMPLETE")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        success = test_frontend_reports_debug()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
