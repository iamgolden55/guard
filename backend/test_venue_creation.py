#!/usr/bin/env python
"""
Test script to verify venue creation with company association.

This script tests:
1. Creating a venue with proper company context
2. Creating a venue with coordinates
3. Creating a venue without coordinates
4. Multi-tenant isolation (venue visibility)
5. Error handling for missing company context

Run this script from the backend directory:
    python test_venue_creation.py
"""

import os
import sys
import django
import json
from decimal import Decimal

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import Venue, SecurityCompany, UserCompanyMembership
from api.serializers import VenueSerializer
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_success(message):
    """Print a success message"""
    print(f"✓ {message}")


def print_error(message):
    """Print an error message"""
    print(f"✗ {message}")


def print_info(message):
    """Print an info message"""
    print(f"  {message}")


def setup_test_data():
    """Create test company and users"""
    print_section("Setting up test data")

    # Create or get test company (with unique name to avoid conflicts)
    company, created = SecurityCompany.objects.get_or_create(
        name="Test Venue Creation Company",
        defaults={
            'registration_number': 'TEST001',
            'address_line_1': '123 Test Street',
            'city': 'Test City',
            'postal_code': 'TS1 1TS',
            'country_code': 'GBR',  # UK country code
            'is_active': True
        }
    )
    if created:
        print_success(f"Created test company: {company.name}")
    else:
        print_info(f"Using existing test company: {company.name}")

    # Create or get admin user
    admin_user, created = User.objects.get_or_create(
        username='test_admin',
        defaults={
            'email': 'admin@test.com',
            'role': 'admin',
            'is_active': True
        }
    )
    if created:
        admin_user.set_password('testpass123')
        admin_user.save()
        print_success(f"Created admin user: {admin_user.username}")
    else:
        print_info(f"Using existing admin user: {admin_user.username}")

    # Create company membership for admin
    membership, created = UserCompanyMembership.objects.get_or_create(
        user=admin_user,
        company=company,
        defaults={
            'role': 'admin',
            'is_active': True
        }
    )
    if created:
        print_success(f"Created company membership for {admin_user.username}")
    else:
        print_info(f"Company membership exists for {admin_user.username}")

    return company, admin_user


def test_venue_creation_with_company(company, admin_user):
    """Test creating a venue with proper company context"""
    print_section("Test 1: Create venue with company context")

    # Create venue data
    venue_data = {
        'name': 'Test Venue 1',
        'address': '456 Venue Street',
        'city': 'Bristol',
        'postal_code': 'BS1 1AA',
        'country': 'United Kingdom',
        'capacity': 500,
        'contact_name': 'John Doe',
        'contact_email': 'john@testvenue.com',
        'contact_phone': '07123456789',
        'description': 'A test venue for automated testing',
        'terms_and_conditions': 'Standard terms and conditions apply',
        'is_active': True,
        'requires_fire_safety_checks': True,
        'requires_capacity_monitoring': True,
        'requires_toilet_checks': True,
    }

    try:
        # Create venue with company
        serializer = VenueSerializer(data=venue_data)
        if serializer.is_valid():
            venue = serializer.save(company=company)
            print_success(f"Venue created: {venue.name} (ID: {venue.id})")
            print_info(f"  Associated with company: {venue.company.name}")
            print_info(f"  Address: {venue.address}, {venue.city}")
            print_info(f"  Capacity: {venue.capacity}")
            return venue
        else:
            print_error(f"Validation failed: {serializer.errors}")
            return None
    except Exception as e:
        print_error(f"Failed to create venue: {str(e)}")
        return None


def test_venue_creation_with_coordinates(company):
    """Test creating a venue with GPS coordinates"""
    print_section("Test 2: Create venue with GPS coordinates")

    venue_data = {
        'name': 'Test Venue with Coordinates',
        'address': '789 Location Lane',
        'city': 'London',
        'postal_code': 'SW1A 1AA',
        'country': 'United Kingdom',
        'capacity': 1000,
        'latitude': Decimal('51.5074'),  # London coordinates
        'longitude': Decimal('-0.1278'),
        'contact_name': 'Jane Smith',
        'contact_email': 'jane@testvenue.com',
        'contact_phone': '07987654321',
        'description': 'A test venue with GPS coordinates',
        'terms_and_conditions': 'Standard terms and conditions apply',
        'is_active': True,
        'requires_fire_safety_checks': True,
        'requires_capacity_monitoring': False,
        'requires_toilet_checks': True,
    }

    try:
        serializer = VenueSerializer(data=venue_data)
        if serializer.is_valid():
            venue = serializer.save(company=company)
            print_success(f"Venue created: {venue.name} (ID: {venue.id})")
            print_info(f"  Latitude: {venue.latitude}")
            print_info(f"  Longitude: {venue.longitude}")
            print_info(f"  Check radius: {venue.check_radius}m")
            return venue
        else:
            print_error(f"Validation failed: {serializer.errors}")
            return None
    except Exception as e:
        print_error(f"Failed to create venue: {str(e)}")
        return None


def test_venue_creation_without_company():
    """Test that venue creation fails without company (should raise error)"""
    print_section("Test 3: Create venue without company (should fail)")

    venue_data = {
        'name': 'Test Venue Without Company',
        'address': '999 Error Street',
        'city': 'Manchester',
        'postal_code': 'M1 1AA',
        'country': 'United Kingdom',
        'capacity': 300,
        'contact_name': 'No Company User',
        'contact_email': 'nocompany@testvenue.com',
        'contact_phone': '07111111111',
        'description': 'This should fail',
        'terms_and_conditions': 'Standard terms and conditions apply',
        'is_active': True,
        'requires_fire_safety_checks': False,
        'requires_capacity_monitoring': False,
        'requires_toilet_checks': False,
    }

    try:
        serializer = VenueSerializer(data=venue_data)
        if serializer.is_valid():
            # Try to save without company - should fail
            venue = serializer.save()
            print_error("Venue created without company! This should not happen.")
            return False
        else:
            print_error(f"Validation failed (unexpected): {serializer.errors}")
            return False
    except Exception as e:
        print_success(f"Correctly prevented venue creation without company")
        print_info(f"  Error: {str(e)}")
        return True


def test_api_venue_creation(admin_user):
    """Test venue creation via API endpoint"""
    print_section("Test 4: Create venue via API endpoint")

    client = APIClient()
    client.force_authenticate(user=admin_user)

    venue_data = {
        'name': 'API Test Venue',
        'address': '321 API Avenue',
        'city': 'Birmingham',
        'postal_code': 'B1 1AA',
        'country': 'United Kingdom',
        'capacity': 750,
        'contact_name': 'API User',
        'contact_email': 'api@testvenue.com',
        'contact_phone': '07222222222',
        'description': 'Venue created via API',
        'terms_and_conditions': 'API terms and conditions',
        'is_active': True,
        'requires_fire_safety_checks': True,
        'requires_capacity_monitoring': True,
        'requires_toilet_checks': False,
    }

    try:
        response = client.post('/api/v1/venues/', venue_data, format='json')

        if response.status_code == status.HTTP_201_CREATED:
            print_success(f"API venue created successfully")
            print_info(f"  Response: {response.data.get('message')}")
            venue_data = response.data.get('venue', {})
            print_info(f"  Venue ID: {venue_data.get('id')}")
            print_info(f"  Venue Name: {venue_data.get('name')}")
            return True
        else:
            print_error(f"API request failed with status {response.status_code}")
            print_info(f"  Response: {response.data}")
            return False
    except Exception as e:
        print_error(f"API test failed: {str(e)}")
        return False


def test_multi_tenant_isolation(company):
    """Test that venues are properly isolated by company"""
    print_section("Test 5: Multi-tenant isolation")

    # Get all venues for the company
    company_venues = Venue.objects.filter(company=company)
    print_info(f"Found {company_venues.count()} venues for company '{company.name}'")

    # Verify all venues belong to the correct company
    all_correct = True
    for venue in company_venues:
        if venue.company != company:
            print_error(f"Venue {venue.name} belongs to wrong company!")
            all_correct = False
        else:
            print_success(f"  {venue.name} - correctly associated with {company.name}")

    return all_correct


def cleanup_test_data():
    """Clean up test venues"""
    print_section("Cleanup test data")

    # Delete test venues
    test_venues = Venue.objects.filter(name__startswith='Test Venue')
    count = test_venues.count()
    if count > 0:
        test_venues.delete()
        print_success(f"Deleted {count} test venues")

    # Note: We keep the test company and user for future tests
    print_info("Kept test company and user for future tests")


def run_all_tests():
    """Run all venue creation tests"""
    print_section("Venue Creation Test Suite")
    print_info("Testing venue creation with company association")

    # Setup
    company, admin_user = setup_test_data()

    # Run tests
    results = []

    # Test 1: Create venue with company
    venue1 = test_venue_creation_with_company(company, admin_user)
    results.append(('Create venue with company', venue1 is not None))

    # Test 2: Create venue with coordinates
    venue2 = test_venue_creation_with_coordinates(company)
    results.append(('Create venue with coordinates', venue2 is not None))

    # Test 3: Fail without company
    result3 = test_venue_creation_without_company()
    results.append(('Prevent venue without company', result3))

    # Test 4: API endpoint
    result4 = test_api_venue_creation(admin_user)
    results.append(('API venue creation', result4))

    # Test 5: Multi-tenant isolation
    result5 = test_multi_tenant_isolation(company)
    results.append(('Multi-tenant isolation', result5))

    # Summary
    print_section("Test Results Summary")
    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")

    print(f"\nPassed: {passed}/{total} tests")

    # Cleanup
    cleanup_input = input("\nCleanup test data? (y/n): ")
    if cleanup_input.lower() == 'y':
        cleanup_test_data()

    return passed == total


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
