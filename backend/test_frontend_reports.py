#!/usr/bin/env python3
"""
Test script to verify frontend can fetch incidents from backend
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"

def test_frontend_reports():
    print("=" * 60)
    print("TESTING FRONTEND REPORTS PAGE")
    print("=" * 60)

    # Step 1: Get token (simulating frontend login)
    print("\n1. Getting auth token (as admin)...")

    # Generate token for user 83
    import subprocess
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

    # Step 2: Test the incident-reports endpoint (what frontend uses)
    print("\n2. Testing /api/v1/incident-reports/ endpoint...")

    # Calculate date range (last 30 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)

    params = {
        'start_date': start_date.strftime('%Y-%m-%d'),
        'end_date': end_date.strftime('%Y-%m-%d')
    }

    response = requests.get(
        f"{BASE_URL}/incident-reports/",
        headers=headers,
        params=params
    )

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()

        # Handle pagination
        incidents = data.get('results', data) if isinstance(data, dict) else data

        print(f"✅ Found {len(incidents)} incidents")

        if incidents:
            print(f"\nFirst incident:")
            incident = incidents[0]
            print(f"  ID: {incident.get('id')}")
            print(f"  Title: {incident.get('title')}")
            print(f"  Type: {incident.get('incident_type_display')}")
            print(f"  Severity: {incident.get('severity_display')}")
            print(f"  Status: {incident.get('status_display')}")
            print(f"  Occurred: {incident.get('occurredAt') or incident.get('occurred_at')}")
            print(f"  Venue: {incident.get('venue_details', {}).get('name')}")
            print(f"  Reported by: {incident.get('reported_by_details', {}).get('username')}")

    else:
        print(f"❌ Failed: {response.status_code}")
        print(response.text)
        return False

    # Step 3: Test via /incidents/ endpoint (mobile app uses this)
    print("\n3. Testing /api/v1/incidents/ endpoint (mobile)...")

    response = requests.get(
        f"{BASE_URL}/incidents/",
        headers=headers,
        params=params
    )

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Found {len(incidents)} incidents via /incidents/")
    else:
        print(f"❌ Failed: {response.status_code}")

    print("\n" + "=" * 60)
    print("✅ FRONTEND REPORTS TEST COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Open http://localhost:3000/admin/reports in your browser")
    print("2. Navigate to the '🚨 Incident Reports' tab")
    print("3. You should see the test incident we just created")

    return True

if __name__ == "__main__":
    try:
        success = test_frontend_reports()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
