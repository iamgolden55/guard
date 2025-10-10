#!/bin/bash

# Get access token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"Ctrindex","password":"Test123456"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['access'])")

echo "Token: ${TOKEN:0:20}..."

# Test venue creation with null values (like frontend sends)
curl -v -X POST http://localhost:8000/api/v1/venues/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Null Test Venue",
    "address": "123 Null Test",
    "city": "London",
    "postal_code": "E1 6AN",
    "country": "United Kingdom",
    "is_active": true,
    "capacity": 500,
    "latitude": null,
    "longitude": null,
    "contact_name": "Test",
    "contact_email": "test@null.com",
    "contact_phone": "07123456789",
    "description": null,
    "terms_and_conditions": "Test",
    "requires_fire_safety_checks": true,
    "requires_capacity_monitoring": true,
    "requires_toilet_checks": true,
    "terms_version": null
  }'
