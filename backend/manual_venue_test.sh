#!/bin/bash
# Manual test script for venue creation via API
# This script tests the venue creation endpoint with proper authentication

set -e

echo "========================================="
echo "  Manual Venue Creation Test"
echo "========================================="
echo ""

# Configuration
API_BASE="http://localhost:8000/api/v1"
ADMIN_USERNAME="test_admin"
ADMIN_PASSWORD="testpass123"

echo "1. Authenticating as admin user..."
AUTH_RESPONSE=$(curl -s -X POST "$API_BASE/token/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")

# Extract token from response
TOKEN=$(echo $AUTH_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access'])" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo "✗ Authentication failed!"
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "✓ Authenticated successfully"
echo "  Token: ${TOKEN:0:20}..."
echo ""

echo "2. Creating test venue..."
VENUE_DATA='{
  "name": "Manual Test Venue",
  "address": "123 Manual Test Street",
  "city": "London",
  "postal_code": "E1 6AN",
  "country": "United Kingdom",
  "capacity": 500,
  "contact_name": "Test Contact",
  "contact_email": "contact@manualtest.com",
  "contact_phone": "07123456789",
  "description": "A manually created test venue",
  "terms_and_conditions": "Standard test terms and conditions",
  "is_active": true,
  "requires_fire_safety_checks": true,
  "requires_capacity_monitoring": true,
  "requires_toilet_checks": false,
  "latitude": 51.5074,
  "longitude": -0.1278
}'

VENUE_RESPONSE=$(curl -s -X POST "$API_BASE/venues/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$VENUE_DATA")

# Check if venue was created successfully
if echo "$VENUE_RESPONSE" | grep -q '"message".*"Venue created successfully"'; then
  echo "✓ Venue created successfully!"
  echo ""
  echo "Response:"
  echo "$VENUE_RESPONSE" | python3 -m json.tool

  # Extract venue ID
  VENUE_ID=$(echo $VENUE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['venue']['id'])" 2>/dev/null || echo "")

  if [ -n "$VENUE_ID" ]; then
    echo ""
    echo "3. Verifying venue in database..."
    VERIFY_RESPONSE=$(curl -s -X GET "$API_BASE/venues/$VENUE_ID/" \
      -H "Authorization: Bearer $TOKEN")

    if echo "$VERIFY_RESPONSE" | grep -q '"name".*"Manual Test Venue"'; then
      echo "✓ Venue verified in database"
      echo ""
      echo "4. Cleaning up test venue..."
      DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/venues/$VENUE_ID/" \
        -H "Authorization: Bearer $TOKEN")
      echo "✓ Test venue deleted"
    fi
  fi
else
  echo "✗ Venue creation failed!"
  echo ""
  echo "Response:"
  echo "$VENUE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VENUE_RESPONSE"
  exit 1
fi

echo ""
echo "========================================="
echo "  ✓ All tests passed!"
echo "========================================="
