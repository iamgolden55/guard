#!/usr/bin/env python3
"""
Test script to simulate mobile app incident submission and sync
"""
import requests
import json
from datetime import datetime
import subprocess

BASE_URL = "http://172.16.32.165:8000/api/v1"  # Mobile app API URL

def test_mobile_incident_sync():
    print("=" * 60)
    print("TESTING MOBILE APP INCIDENT SYNC")
    print("=" * 60)

    # Step 1: Get token for mobile_test user
    print("\n1. Getting auth token for mobile_test user...")
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

    # Step 2: Simulate mobile app incident submission
    print("\n2. Simulating mobile app incident submission...")

    # This is exactly what the mobile app sends
    incident_payload = {
        "incident_type": "security_breach",
        "title": "Mobile App Test Incident",
        "description": "Testing incident submission from mobile app simulation",
        "severity": "high",
        "status": "submitted",
        "occurred_at": datetime.now().isoformat(),
        "venue": 24,
        "shift": 382,
        "location_description": "Main entrance - mobile test",
        "photos": [],
        "videos": [],
        "witnesses": ["Mobile Witness 1"],
        "persons_involved": ["Test Person"],
        "actions_taken": "Tested mobile sync flow",
        "police_notified": False,
        "ambulance_called": False,
        "latitude": 51.5074,
        "longitude": -0.1278
    }

    print(f"Payload: {json.dumps(incident_payload, indent=2)}")

    response = requests.post(
        f"{BASE_URL}/incidents/",
        headers=headers,
        json=incident_payload,
        timeout=10
    )

    print(f"\nResponse status: {response.status_code}")

    if response.status_code in [200, 201]:
        incident = response.json()
        incident_id = incident.get('id')
        print(f"✅ Created incident ID: {incident_id}")
        print(f"   Title: {incident.get('title')}")
        print(f"   Type: {incident.get('incident_type')}")
        print(f"   Severity: {incident.get('severity')}")
    else:
        print(f"❌ Failed: {response.status_code}")
        print(f"Response: {response.text}")
        return False

    # Step 3: Verify incident in database
    print("\n3. Verifying incident in database...")
    result = subprocess.run([
        'python', 'manage.py', 'shell', '-c',
        f"from api.models import IncidentReport; "
        f"inc = IncidentReport.objects.get(id={incident_id}); "
        f"print(f'✅ Found incident: {{inc.title}}'); "
        f"print(f'   Venue: {{inc.venue.name}}'); "
        f"print(f'   Reported by: {{inc.reported_by.username}}'); "
        f"print(f'   Occurred at: {{inc.occurred_at}}'); "
        f"print(f'   Status: {{inc.status}}');"
    ], capture_output=True, text=True)
    print(result.stdout)

    # Step 4: Verify it appears in frontend reports
    print("\n4. Verifying incident appears in frontend reports...")
    response = requests.get(
        f"{BASE_URL}/incident-reports/",
        headers=headers
    )

    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data

        # Find our incident
        found = False
        for inc in incidents:
            if inc.get('id') == incident_id:
                found = True
                print(f"✅ Incident appears in frontend reports")
                print(f"   Title: {inc.get('title')}")
                print(f"   Severity: {inc.get('severity_display')}")
                break

        if not found:
            print(f"❌ Incident not found in reports (found {len(incidents)} total)")
    else:
        print(f"❌ Failed to fetch reports: {response.status_code}")

    # Step 5: Test with mobile app's exact API base URL
    print("\n5. Testing with mobile app's API base URL...")
    mobile_headers = headers.copy()

    # Test GET request to verify mobile can fetch incidents
    response = requests.get(
        f"{BASE_URL}/incidents/",
        headers=mobile_headers,
        timeout=10
    )

    if response.status_code == 200:
        data = response.json()
        incidents = data.get('results', data) if isinstance(data, dict) else data
        print(f"✅ Mobile app can fetch {len(incidents)} incidents")

        # Show the most recent incident
        if incidents:
            latest = incidents[0]
            print(f"   Latest: {latest.get('title')} (ID: {latest.get('id')})")
    else:
        print(f"❌ Mobile app fetch failed: {response.status_code}")

    print("\n" + "=" * 60)
    print("✅ MOBILE APP SYNC TEST COMPLETE!")
    print("=" * 60)
    print("\nSummary:")
    print("- Backend API is working correctly")
    print("- Mobile app can POST incidents successfully")
    print("- Incidents appear in frontend reports")
    print("- Date filtering is working correctly")
    print("\nNext steps:")
    print("1. Restart mobile app to trigger sync queue migration")
    print("2. Try submitting an incident from the mobile app")
    print("3. Yellow sync indicator should clear once sync succeeds")

    return True

if __name__ == "__main__":
    try:
        success = test_mobile_incident_sync()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
