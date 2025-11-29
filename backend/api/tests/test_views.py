"""
Tests for API views, specifically the eligible_for_transfer endpoint.
"""
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import (
    SecurityCompany,
    UserCompanyMembership,
    StaffProfile
)

User = get_user_model()


class UserViewSetEligibleStaffTests(APITestCase):
    """Test cases for /api/v1/users/eligible-for-transfer/ endpoint"""

    def setUp(self):
        """Set up test data for all test methods"""
        # Create companies
        self.company_a = SecurityCompany.objects.create(
            name="Mead Security",
            registration_number="COMP001"
        )
        self.company_b = SecurityCompany.objects.create(
            name="Other Security",
            registration_number="COMP002"
        )

        # Create users for Company A
        self.james = User.objects.create_user(
            username='james44',
            email='james@mead.com',
            password='test123',
            role='staff',
            first_name='James',
            last_name='Smith'
        )
        self.john = User.objects.create_user(
            username='john_doe',
            email='john@mead.com',
            password='test123',
            role='staff',
            first_name='John',
            last_name='Doe'
        )
        self.mary = User.objects.create_user(
            username='mary_jane',
            email='mary@mead.com',
            password='test123',
            role='staff',
            first_name='Mary',
            last_name='Jane'
        )

        # Create user for Company B
        self.bob = User.objects.create_user(
            username='bob_other',
            email='bob@other.com',
            password='test123',
            role='staff',
            first_name='Bob',
            last_name='Other'
        )

        # Create company memberships
        UserCompanyMembership.objects.create(
            user=self.james, company=self.company_a, role='staff', is_active=True
        )
        UserCompanyMembership.objects.create(
            user=self.john, company=self.company_a, role='staff', is_active=True
        )
        UserCompanyMembership.objects.create(
            user=self.mary, company=self.company_a, role='staff', is_active=True
        )
        UserCompanyMembership.objects.create(
            user=self.bob, company=self.company_b, role='staff', is_active=True
        )

        # Create staff profiles
        StaffProfile.objects.create(user=self.james, is_approved=True)
        StaffProfile.objects.create(user=self.john, is_approved=True)
        StaffProfile.objects.create(user=self.mary, is_approved=False)  # Not approved
        StaffProfile.objects.create(user=self.bob, is_approved=True)

    def test_staff_can_see_company_colleagues(self):
        """Staff user should see approved colleagues from same company"""
        self.client.force_authenticate(user=self.james)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        self.assertEqual(response.status_code, 200)

        # Should only see John (not Mary - unapproved, not Bob - other company, not James - self)
        user_ids = [user['id'] for user in response.data]
        self.assertIn(self.john.id, user_ids)
        self.assertNotIn(self.james.id, user_ids)  # Exclude self
        self.assertNotIn(self.mary.id, user_ids)   # Exclude unapproved
        self.assertNotIn(self.bob.id, user_ids)    # Exclude other company

    def test_excludes_unapproved_staff(self):
        """Unapproved staff should not appear in eligible list"""
        self.client.force_authenticate(user=self.james)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        user_ids = [user['id'] for user in response.data]
        self.assertNotIn(self.mary.id, user_ids)

    def test_excludes_other_company_staff(self):
        """Staff from other companies should not appear"""
        self.client.force_authenticate(user=self.james)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        user_ids = [user['id'] for user in response.data]
        self.assertNotIn(self.bob.id, user_ids)

    def test_requires_authentication(self):
        """Endpoint should require authentication"""
        response = self.client.get('/api/v1/users/eligible-for-transfer/')
        self.assertEqual(response.status_code, 401)

    def test_user_without_company_membership(self):
        """User without company membership should get 404"""
        orphan_user = User.objects.create_user(
            username='orphan',
            email='orphan@test.com',
            password='test123',
            role='staff'
        )
        self.client.force_authenticate(user=orphan_user)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        self.assertEqual(response.status_code, 404)
        self.assertIn('No company membership found', response.data['error'])

    def test_returns_correct_user_fields(self):
        """Endpoint should return UserSerializer fields"""
        self.client.force_authenticate(user=self.james)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) > 0)

        # Check that returned user has expected fields
        user_data = response.data[0]
        expected_fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'is_active']
        for field in expected_fields:
            self.assertIn(field, user_data)

    def test_empty_result_when_no_eligible_staff(self):
        """Should return empty list when no other approved staff in company"""
        # Create a new company with only one staff member
        company_c = SecurityCompany.objects.create(
            name="Solo Security",
            registration_number="COMP003"
        )
        solo_user = User.objects.create_user(
            username='solo',
            email='solo@solo.com',
            password='test123',
            role='staff',
            first_name='Solo',
            last_name='Worker'
        )
        UserCompanyMembership.objects.create(
            user=solo_user, company=company_c, role='staff', is_active=True
        )
        StaffProfile.objects.create(user=solo_user, is_approved=True)

        self.client.force_authenticate(user=solo_user)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)  # Empty list, not error

    def test_filters_by_security_role_when_shift_provided(self):
        """Should filter staff by required security role when shift_id provided"""
        from django.utils import timezone
        from datetime import timedelta
        from api.models import Shift, Venue

        # Create a venue
        venue = Venue.objects.create(
            name="Test Venue",
            company=self.company_a,
            address="123 Test St",
            latitude=51.5074,
            longitude=-0.1278
        )

        # Create shift requiring 'ds' (Door Supervisor) role
        shift = Shift.objects.create(
            venue=venue,
            staff_user=self.james,
            required_security_role='ds',
            start_time=timezone.now() + timedelta(days=1),
            end_time=timezone.now() + timedelta(days=1, hours=8),
            status='scheduled'
        )

        # Set security roles: John has DS, Mary doesn't
        self.john.security_roles = ['ds', 'sg']
        self.john.save()
        self.mary.security_roles = ['sg']  # Only SG, not DS
        self.mary.is_approved = True  # Make Mary approved for this test
        self.mary.save()
        # Update Mary's profile
        mary_profile = StaffProfile.objects.get(user=self.mary)
        mary_profile.is_approved = True
        mary_profile.save()

        self.client.force_authenticate(user=self.james)
        response = self.client.get(
            f'/api/v1/users/eligible-for-transfer/?shift_id={shift.id}'
        )

        self.assertEqual(response.status_code, 200)
        user_ids = [user['id'] for user in response.data]
        self.assertIn(self.john.id, user_ids)  # Has DS role
        self.assertNotIn(self.mary.id, user_ids)  # Missing DS role

    def test_returns_all_staff_when_no_shift_id(self):
        """Should return all eligible staff when no shift_id provided"""
        self.client.force_authenticate(user=self.james)
        response = self.client.get('/api/v1/users/eligible-for-transfer/')

        self.assertEqual(response.status_code, 200)
        # Should see John (approved) but not Mary (unapproved) or Bob (other company)
        user_ids = [user['id'] for user in response.data]
        self.assertIn(self.john.id, user_ids)
        self.assertNotIn(self.mary.id, user_ids)
        self.assertNotIn(self.bob.id, user_ids)

    def test_returns_404_for_non_existent_shift(self):
        """Should return 404 when shift_id doesn't exist"""
        self.client.force_authenticate(user=self.james)
        response = self.client.get('/api/v1/users/eligible-for-transfer/?shift_id=99999')

        self.assertEqual(response.status_code, 404)
        self.assertIn('Shift not found', response.data['error'])

    def test_returns_404_for_shift_not_assigned_to_user(self):
        """Should return 404 when shift belongs to another user"""
        from django.utils import timezone
        from datetime import timedelta
        from api.models import Shift, Venue

        # Create a venue
        venue = Venue.objects.create(
            name="Test Venue",
            company=self.company_a,
            address="123 Test St",
            latitude=51.5074,
            longitude=-0.1278
        )

        # Create shift assigned to John, not James
        shift = Shift.objects.create(
            venue=venue,
            staff_user=self.john,
            required_security_role='ds',
            start_time=timezone.now() + timedelta(days=1),
            end_time=timezone.now() + timedelta(days=1, hours=8),
            status='scheduled'
        )

        # James tries to access John's shift
        self.client.force_authenticate(user=self.james)
        response = self.client.get(
            f'/api/v1/users/eligible-for-transfer/?shift_id={shift.id}'
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn('Shift not found', response.data['error'])
