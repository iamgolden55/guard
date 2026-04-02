"""
Tests for manual check-in/check-out override time validation.
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import SecurityCompany, UserCompanyMembership, Venue, Shift

User = get_user_model()


class ManualCheckinOverrideTimeTests(APITestCase):
    """Test manual check-in with override time validation."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Test Security Co",
            registration_number="TEST001",
        )
        self.manager = User.objects.create_user(
            username="manager1",
            email="manager@test.com",
            password="testpass123",
            role="manager",
            first_name="Test",
            last_name="Manager",
        )
        self.staff = User.objects.create_user(
            username="staff1",
            email="staff@test.com",
            password="testpass123",
            role="staff",
            first_name="Test",
            last_name="Staff",
        )
        UserCompanyMembership.objects.create(
            user=self.manager,
            company=self.company,
            is_active=True,
        )
        UserCompanyMembership.objects.create(
            user=self.staff,
            company=self.company,
            is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company,
            name="Test Venue",
            address="123 Test St",
            city="London",
            postal_code="SW1A 1AA",
            country="UK",
            capacity=100,
            contact_name="Venue Contact",
            contact_phone="07700900000",
            contact_email="venue@test.com",
            terms_and_conditions="Standard terms",
        )
        now = timezone.now()
        self.shift = Shift.objects.create(
            staff_user=self.staff,
            venue=self.venue,
            start_time=now - timedelta(hours=2),
            end_time=now + timedelta(hours=6),
            status="scheduled",
            required_security_role="sg",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def test_manual_checkin_with_override_time(self):
        """Override time is used as check_in_time instead of now."""
        override = timezone.now() - timedelta(hours=1)
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkin/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Staff was here earlier",
                "checkin_time": override.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.shift.refresh_from_db()
        # check_in_time should match the override (within 1 second tolerance)
        self.assertAlmostEqual(
            self.shift.check_in_time.timestamp(),
            override.timestamp(),
            delta=1,
        )

    def test_manual_checkin_without_override_uses_now(self):
        """When no override time is provided, check_in_time defaults to now."""
        before = timezone.now()
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkin/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Checking in now",
            },
        )
        after = timezone.now()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.shift.refresh_from_db()
        self.assertGreaterEqual(self.shift.check_in_time, before)
        self.assertLessEqual(self.shift.check_in_time, after)

    def test_manual_checkin_future_override_rejected(self):
        """Override time in the future returns 400."""
        future_time = timezone.now() + timedelta(hours=1)
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkin/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Future time",
                "checkin_time": future_time.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("future", response.data["detail"].lower())
        # Shift should remain unchanged
        self.shift.refresh_from_db()
        self.assertIsNone(self.shift.check_in_time)

    def test_manual_checkin_staff_cannot_perform(self):
        """Regular staff cannot perform manual check-in."""
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkin/",
            {
                "manager_signature": "Staff Member",
                "manager_notes": "Trying to override",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ManualCheckoutOverrideTimeTests(APITestCase):
    """Test manual check-out with override time validation."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Test Security Co",
            registration_number="TEST002",
        )
        self.manager = User.objects.create_user(
            username="manager2",
            email="manager2@test.com",
            password="testpass123",
            role="manager",
            first_name="Test",
            last_name="Manager",
        )
        self.staff = User.objects.create_user(
            username="staff2",
            email="staff2@test.com",
            password="testpass123",
            role="staff",
            first_name="Test",
            last_name="Staff",
        )
        UserCompanyMembership.objects.create(
            user=self.manager,
            company=self.company,
            is_active=True,
        )
        UserCompanyMembership.objects.create(
            user=self.staff,
            company=self.company,
            is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company,
            name="Test Venue 2",
            address="456 Test Ave",
            city="London",
            postal_code="EC1A 1BB",
            country="UK",
            capacity=200,
            contact_name="Venue Contact",
            contact_phone="07700900001",
            contact_email="venue2@test.com",
            terms_and_conditions="Standard terms",
        )
        now = timezone.now()
        self.check_in_time = now - timedelta(hours=8)
        self.shift = Shift.objects.create(
            staff_user=self.staff,
            venue=self.venue,
            start_time=now - timedelta(hours=9),
            end_time=now - timedelta(hours=1),
            status="in_progress",
            required_security_role="sg",
            check_in_time=self.check_in_time,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def test_manual_checkout_with_override_time(self):
        """Override time is used as check_out_time instead of now."""
        override = timezone.now() - timedelta(minutes=30)
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkout/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Staff left early",
                "checkout_time": override.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.shift.refresh_from_db()
        self.assertAlmostEqual(
            self.shift.check_out_time.timestamp(),
            override.timestamp(),
            delta=1,
        )

    def test_manual_checkout_without_override_uses_now(self):
        """When no override time is provided, check_out_time defaults to now."""
        before = timezone.now()
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkout/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Checking out now",
            },
        )
        after = timezone.now()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.shift.refresh_from_db()
        self.assertGreaterEqual(self.shift.check_out_time, before)
        self.assertLessEqual(self.shift.check_out_time, after)

    def test_manual_checkout_future_override_rejected(self):
        """Override time in the future returns 400."""
        future_time = timezone.now() + timedelta(hours=1)
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkout/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Future time",
                "checkout_time": future_time.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("future", response.data["detail"].lower())
        self.shift.refresh_from_db()
        self.assertIsNone(self.shift.check_out_time)

    def test_manual_checkout_before_checkin_rejected(self):
        """Override time earlier than check_in_time returns 400."""
        before_checkin = self.check_in_time - timedelta(hours=1)
        response = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/manual_checkout/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "Before checkin",
                "checkout_time": before_checkin.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("after check-in", response.data["detail"].lower())
        self.shift.refresh_from_db()
        self.assertIsNone(self.shift.check_out_time)

    def test_manual_checkout_requires_prior_checkin(self):
        """Manual checkout fails if shift was never checked in."""
        # Create a shift that was never checked in
        unchecked_shift = Shift.objects.create(
            staff_user=self.staff,
            venue=self.venue,
            start_time=timezone.now() - timedelta(hours=4),
            end_time=timezone.now() + timedelta(hours=4),
            status="scheduled",
            required_security_role="sg",
        )
        response = self.client.post(
            f"/api/v1/shifts/{unchecked_shift.id}/manual_checkout/",
            {
                "manager_signature": "Test Manager",
                "manager_notes": "No checkin",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
