"""
Company switching — P1-6.

`TenantMiddleware` bails when `request.user` is not authenticated, and it sits
after `AuthenticationMiddleware`, which resolves the user from the *session*.
The admin and the mobile app authenticate with JWT, which DRF resolves after
every middleware has run. So `request.user` is `AnonymousUser` at middleware
time on every API request and `request.current_company` is always `None`.

Consequences: the `X-Company-ID` header does nothing, company switching in the
admin UI does not change what data comes back, and every `get_user_company()`
helper silently takes its fallback branch — most recently joined membership —
whatever the UI is displaying.

This is not privilege escalation: the fallback is still limited to the user's
own memberships. It is showing the wrong tenant's data on a platform sold on
multi-tenancy, and the comments in `api/views.py` reading "respects
X-Company-ID header" documented behaviour that did not exist.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue

User = get_user_model()


class CompanySwitchingTests(APITestCase):
    """A manager belonging to two companies must be able to choose one."""

    def setUp(self):
        self.company_a = SecurityCompany.objects.create(
            name="Switch Alpha", registration_number="SWA001",
        )
        self.company_b = SecurityCompany.objects.create(
            name="Switch Bravo", registration_number="SWB001",
        )
        self.outsider_company = SecurityCompany.objects.create(
            name="Switch Charlie", registration_number="SWC001",
        )
        self.manager = User.objects.create_user(
            username="switch_manager", email="switch@test.test",
            password="testpass123", role="manager",
        )
        # Joined A first, B second — so the "most recently joined" fallback
        # resolves to B, and a request asking for A proves the header is read.
        UserCompanyMembership.objects.create(
            user=self.manager, company=self.company_a, is_active=True,
            role="manager", joined_at=timezone.now() - timedelta(days=30),
        )
        UserCompanyMembership.objects.create(
            user=self.manager, company=self.company_b, is_active=True,
            role="manager", joined_at=timezone.now() - timedelta(days=1),
        )

        self.shift_a = self._shift(self.company_a, "A")
        self.shift_b = self._shift(self.company_b, "B")

        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def _shift(self, company, label):
        venue = Venue.objects.create(
            company=company, name=f"Venue {label}", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email=f"venue{label.lower()}@switch.test",
            terms_and_conditions="Terms",
        )
        officer = User.objects.create_user(
            username=f"switch_officer_{label.lower()}",
            email=f"officer{label.lower()}@switch.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=officer, company=company, is_active=True, role="staff",
        )
        start = (timezone.now() + timedelta(days=1)).replace(
            minute=0, second=0, microsecond=0
        )
        return Shift.objects.create(
            venue=venue, staff_user=officer, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )

    def _shift_ids(self, response):
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        return [row["id"] for row in rows]

    def test_the_header_selects_company_a(self):
        response = self.client.get(
            "/api/v1/shifts/", HTTP_X_COMPANY_ID=str(self.company_a.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._shift_ids(response)
        self.assertIn(self.shift_a.id, ids)
        self.assertNotIn(self.shift_b.id, ids)

    def test_the_header_selects_company_b(self):
        response = self.client.get(
            "/api/v1/shifts/", HTTP_X_COMPANY_ID=str(self.company_b.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._shift_ids(response)
        self.assertIn(self.shift_b.id, ids)
        self.assertNotIn(self.shift_a.id, ids)

    def test_a_company_the_user_does_not_belong_to_is_refused(self):
        response = self.client.get(
            "/api/v1/shifts/",
            HTTP_X_COMPANY_ID=str(self.outsider_company.id),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_malformed_company_id_is_refused_not_ignored(self):
        """Silently falling back would show data the caller did not ask for."""
        response = self.client.get(
            "/api/v1/shifts/", HTTP_X_COMPANY_ID="not-a-uuid",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_header_falls_back_to_a_membership(self):
        """Regression guard — every existing client sends no header."""
        response = self.client.get("/api/v1/shifts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = self._shift_ids(response)
        self.assertEqual(len(ids), 1, "fallback must resolve exactly one company")
        self.assertIn(self.shift_b.id, ids)

    def test_switching_also_applies_to_venues(self):
        """The resolver has to be shared, not reimplemented per ViewSet."""
        response = self.client.get(
            "/api/v1/venues/", HTTP_X_COMPANY_ID=str(self.company_a.id),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        names = [row["name"] for row in rows]
        self.assertIn("Venue A", names)
        self.assertNotIn("Venue B", names)
