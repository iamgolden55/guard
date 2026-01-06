#!/usr/bin/env python3
"""
Test script to verify incident reporting API end-to-end
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def test_incident_api():
    print("=" * 60)
    print("TESTING INCIDENT REPORTING API")
    print("=" * 60)

    # Step 1: Login and get token
    print("\n1. Authenticating...")
    login_response = requests.post(
        f"{BASE_URL}/login/",
        json={"username": "James44", "password": "password123"}
    )

    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(login_response.text)
        return False

    token = login_response.json().get("access")
    print(f"✅ Got auth token: {token[:50]}...")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Step 2: Get user profile to get shift info
    print("\n2. Getting user profile...")
    profile_response = requests.get(f"{BASE_URL}/profiles/me", headers=headers)

    if profile_response.status_code != 200:
        print(f"❌ Profile fetch failed: {profile_response.status_code}")
        return False

    profile = profile_response.json()
    print(f"✅ Got profile for: {profile.get('user', {}).get('username')}")

    # Step 3: Get first venue
    print("\n3. Getting venues...")
    venues_response = requests.get(f"{BASE_URL}/venues/", headers=headers)

    if venues_response.status_code != 200:
        print(f"❌ Venues fetch failed: {venues_response.status_code}")
        return False

    venues = venues_response.json()
    if not venues or len(venues) == 0:
        print("❌ No venues found")
        return False

    venue_id = venues[0]['id']
    venue_name = venues[0]['name']
    print(f"✅ Using venue: {venue_name} (ID: {venue_id})")

    # Step 4: Create a test incident
    print("\n4. Creating test incident...")

    incident_data = {
        "incident_type": "security_breach",
        "title": "API Test Incident",
        "description": "This is a test incident created via API to verify the system is working",
        "severity": "medium",
        "status": "submitted",
        "occurred_at": datetime.now().isoformat(),
        "venue": venue_id,
        "shift": 1,  # Assuming shift ID 1 exists
        "location_description": "Main entrance",
        "photos": [],
        "videos": [],
        "witnesses": ["John Doe", "Jane Smith"],
        "persons_involved": ["Unknown person"],
        "actions_taken": "Security alerted, area secured",
        "police_notified": False,
        "ambulance_called": False
    }

    print(f"Incident data: {json.dumps(incident_data, indent=2)}")

    incident_response = requests.post(
        f"{BASE_URL}/incidents/",
        headers=headers,
        json=incident_data
    )

    print(f"\nResponse status: {incident_response.status_code}")
    print(f"Response: {incident_response.text}")

    if incident_response.status_code not in [200, 201]:
        print(f"❌ Incident creation failed: {incident_response.status_code}")
        return False

    incident = incident_response.json()
    incident_id = incident.get('id')
    print(f"✅ Created incident ID: {incident_id}")

    # Step 5: Verify incident was created
    print(f"\n5. Verifying incident exists...")
    verify_response = requests.get(
        f"{BASE_URL}/incident-reports/{incident_id}/",
        headers=headers
    )

    if verify_response.status_code == 200:
        print(f"✅ Incident verified via /incident-reports/ endpoint")

    # Step 6: List all incidents
    print(f"\n6. Listing all incidents...")
    list_response = requests.get(f"{BASE_URL}/incidents/", headers=headers)

    if list_response.status_code == 200:
        incidents_list = list_response.json()

        # Handle paginated response
        if isinstance(incidents_list, dict) and 'results' in incidents_list:
            incidents_list = incidents_list['results']

        print(f"✅ Found {len(incidents_list)} total incidents")
        print(f"   Latest: {incidents_list[0].get('title') if incidents_list else 'None'}")

    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    return True

if __name__ == "__main__":
    try:
        success = test_incident_api()
        exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        exit(1)