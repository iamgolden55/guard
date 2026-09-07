"""
Write authorisation on the shift API — P0-1 and P0-2.

Two audiences share one ViewSet and one serialiser. The scheduling UI is
operated by managers and legitimately writes pay rates, approval flags and
publication state; the staff app is operated by the officer being paid. Until
these tests existed, nothing stopped an officer using the manager's write
surface against their own row.

P0-1 — `ShiftSerializer` exposed `hourly_rate`, `bill_rate`,
`actual_hours_worked`, `manager_approved` and `status` as client-writable on a
ViewSet whose only permission was `IsAuthenticated`. `Shift.save()` promotes a
`pending_approval` shift to `approved`, and approval calls
`auto_generate_invoice()` — so one POST minted a paid, pre-approved shift and a
draft invoice to go with it.

P0-2 — `FrontendShiftViewSet` was a `ModelViewSet` over `Shift.objects.all()`
with no `get_queryset()`, routed to list/create/retrieve/update/destroy/cancel.
`get_object()` therefore selected from every company's shifts, and `cancel`
performed no ownership check whatsoever. Only its two attendance actions are
used by the React client; the CRUD routes arrived free with `ModelViewSet`.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    Invoice, SecurityCompany, Shift, UserCompanyMembership, Venue,
    VenueTermsAcceptance,
)

User = get_user_model()


def make_company(name, reg):
    return SecurityCompany.objects.create(name=name, registration_number=reg)


# Geocoding is unavailable in the container (no Maps key), so coordinates have
# to be set explicitly or `verify_location` refuses every check-in.
VENUE_LAT = Decimal("51.454500")
VENUE_LNG = Decimal("-2.587900")


def make_venue(company, name):
    return Venue.objects.create(
        company=company, name=name, address="1 Test St", city="Bristol",
        postal_code="BS1 1AA", country="UK", capacity=100,
        contact_name="Contact", contact_phone="07700900000",
        contact_email=f"{name.lower().replace(' ', '')}@venue.test",
        terms_and_conditions="Standard terms",
        latitude=VENUE_LAT, longitude=VENUE_LNG, check_radius=100,
    )


def accept_terms(user, venue):
    VenueTermsAcceptance.objects.create(
        staff_user=user, venue=venue, terms_version=venue.terms_version or "1",
    )


def make_user(username, role, company, **extra):
    user = User.objects.create_user(
        username=username, email=f"{username}@test.test",
        password="testpass123", role=role, **extra
    )
    UserCompanyMembership.objects.create(
        user=user, company=company, is_active=True,
        role="staff" if role == "staff" else "manager",
    )
    return user


class StaffShiftWriteAuthzTests(APITestCase):
    """P0-1 — an officer must not be able to write their own pay or approval."""

    def setUp(self):
        self.company = make_company("Authz Co", "AUTHZ001")
        self.venue = make_venue(self.company, "Authz Venue")
        self.manager = make_user("authz_manager", "manager", self.company)
        self.staff = make_user("authz_staff", "staff", self.company)
        self.client = APIClient()

    def _future(self, hours_ahead=24, length=8):
        start = (timezone.now() + timedelta(hours=hours_ahead)).replace(
            minute=0, second=0, microsecond=0
        )
        return start, start + timedelta(hours=length)

    def _existing_shift(self, **overrides):
        start, end = self._future()
        defaults = dict(
            venue=self.venue, staff_user=self.staff, start_time=start,
            end_time=end, status="scheduled", required_security_role="sg",
            is_published=True, hourly_rate=Decimal("15.00"),
        )
        defaults.update(overrides)
        return Shift.objects.create(**defaults)

    def test_staff_cannot_create_a_shift(self):
        """The single-request fraud chain: mint a paid, pre-approved shift."""
        self.client.force_authenticate(user=self.staff)
        start, end = self._future()
        response = self.client.post("/api/v1/shifts/", {
            "venue": self.venue.id,
            "staff_user": self.staff.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "hourly_rate": "500.00",
            "actual_hours_worked": "12.00",
            "status": "approved",
            "manager_approved": True,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Shift.objects.filter(staff_user=self.staff).exists())
        self.assertFalse(Invoice.objects.filter(staff_user=self.staff).exists())

    def test_staff_cannot_raise_their_own_hourly_rate(self):
        shift = self._existing_shift()
        self.client.force_authenticate(user=self.staff)

        response = self.client.patch(
            f"/api/v1/shifts/{shift.id}/", {"hourly_rate": "500.00"}, format="json"
        )

        shift.refresh_from_db()
        self.assertEqual(shift.hourly_rate, Decimal("15.00"))
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_staff_cannot_self_approve_a_shift(self):
        shift = self._existing_shift(status="pending_approval")
        self.client.force_authenticate(user=self.staff)

        response = self.client.patch(f"/api/v1/shifts/{shift.id}/", {
            "manager_approved": True,
            "status": "approved",
            "actual_hours_worked": "12.00",
        }, format="json")

        shift.refresh_from_db()
        self.assertFalse(shift.manager_approved)
        self.assertNotEqual(shift.status, "approved")
        self.assertIsNone(shift.actual_hours_worked)
        self.assertFalse(Invoice.objects.filter(staff_user=self.staff).exists())
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_manager_cannot_schedule_into_another_companys_venue(self):
        other_company = make_company("Other Co", "OTHER001")
        other_venue = make_venue(other_company, "Other Venue")
        self.client.force_authenticate(user=self.manager)
        start, end = self._future()

        response = self.client.post("/api/v1/shifts/", {
            "venue": other_venue.id,
            "staff_user": self.staff.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
        }, format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST),
        )
        self.assertFalse(Shift.objects.filter(venue=other_venue).exists())

    def test_manager_can_still_schedule_and_edit(self):
        """Regression guard — this is the path the scheduling UI uses."""
        self.client.force_authenticate(user=self.manager)
        start, end = self._future()

        response = self.client.post("/api/v1/shifts/", {
            "venue": self.venue.id,
            "staff_user": self.staff.id,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "hourly_rate": "18.50",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        shift = Shift.objects.get(id=response.data["id"])
        self.assertEqual(shift.hourly_rate, Decimal("18.50"))

        patch = self.client.patch(
            f"/api/v1/shifts/{shift.id}/", {"hourly_rate": "19.50"}, format="json"
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK, patch.data)
        shift.refresh_from_db()
        self.assertEqual(shift.hourly_rate, Decimal("19.50"))

    def test_staff_can_still_read_their_own_shifts(self):
        """Regression guard — the officer's shift list must keep working."""
        shift = self._existing_shift()
        self.client.force_authenticate(user=self.staff)

        response = self.client.get("/api/v1/shifts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        rows = body["results"] if isinstance(body, dict) and "results" in body else body
        self.assertIn(shift.id, [row["id"] for row in rows])


class FrontendShiftViewSetTenancyTests(APITestCase):
    """P0-2 — the camelCase shim must not be a platform-wide CRUD surface."""

    def setUp(self):
        self.company_a = make_company("Company A", "COMPA001")
        self.company_b = make_company("Company B", "COMPB001")
        self.venue_a = make_venue(self.company_a, "Venue A")
        self.venue_b = make_venue(self.company_b, "Venue B")
        self.staff_a = make_user("frontend_staff_a", "staff", self.company_a)
        self.staff_b = make_user("frontend_staff_b", "staff", self.company_b)
        accept_terms(self.staff_a, self.venue_a)
        accept_terms(self.staff_b, self.venue_b)
        self.client = APIClient()

    def _shift(self, venue, staff, **overrides):
        start = (timezone.now() - timedelta(hours=1)).replace(
            minute=0, second=0, microsecond=0
        )
        defaults = dict(
            venue=venue, staff_user=staff, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )
        defaults.update(overrides)
        return Shift.objects.create(**defaults)

    def test_cannot_retrieve_another_companys_shift(self):
        foreign = self._shift(self.venue_b, self.staff_b)
        self.client.force_authenticate(user=self.staff_a)

        response = self.client.get(f"/api/v1/shifts/frontend/{foreign.id}/")

        self.assertIn(
            response.status_code,
            (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_cannot_cancel_another_companys_shift(self):
        foreign = self._shift(self.venue_b, self.staff_b)
        self.client.force_authenticate(user=self.staff_a)

        response = self.client.post(f"/api/v1/shifts/frontend/{foreign.id}/cancel/")

        foreign.refresh_from_db()
        self.assertNotEqual(foreign.status, "cancelled")
        self.assertIn(
            response.status_code,
            (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_cannot_delete_through_the_frontend_shim(self):
        own = self._shift(self.venue_a, self.staff_a)
        self.client.force_authenticate(user=self.staff_a)

        response = self.client.delete(f"/api/v1/shifts/frontend/{own.id}/")

        self.assertTrue(Shift.objects.filter(id=own.id).exists())
        self.assertIn(
            response.status_code,
            (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_cannot_list_every_shift_on_the_platform(self):
        self._shift(self.venue_b, self.staff_b)
        self.client.force_authenticate(user=self.staff_a)

        response = self.client.get("/api/v1/shifts/frontend/")

        if response.status_code == status.HTTP_200_OK:
            body = response.json()
            rows = body["results"] if isinstance(body, dict) and "results" in body else body
            self.assertEqual(rows, [], "frontend shim leaked another company's shifts")
        else:
            self.assertIn(
                response.status_code,
                (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED),
            )

    def test_assigned_staff_can_still_check_in(self):
        """Regression guard — this is one of the two routes the web app uses."""
        shift = self._shift(self.venue_a, self.staff_a)
        self.client.force_authenticate(user=self.staff_a)

        response = self.client.post(
            f"/api/v1/shifts/frontend/{shift.id}/checkIn/",
            {
                "latitude": float(VENUE_LAT),
                "longitude": float(VENUE_LNG),
                "signature": "data:image/png;base64,AAAA",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        shift.refresh_from_db()
        self.assertIsNotNone(shift.check_in_time)

    def test_staff_cannot_check_in_to_an_unpublished_shift(self):
        """The snake_case path enforces this; the shim must too.

        For staff the scoped queryset already hides drafts, so the request
        never reaches the gate — 404 rather than 400. Either way the draft
        cannot be started, which is the property that matters.
        """
        shift = self._shift(self.venue_a, self.staff_a, is_published=False)
        self.client.force_authenticate(user=self.staff_a)

        response = self.client.post(
            f"/api/v1/shifts/frontend/{shift.id}/checkIn/",
            {"latitude": float(VENUE_LAT), "longitude": float(VENUE_LNG)},
            format="json",
        )

        self.assertIn(
            response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )
        shift.refresh_from_db()
        self.assertIsNone(shift.check_in_time)

    def test_manager_hits_the_published_gate_on_their_own_draft(self):
        """A manager can see company drafts, so the explicit gate has to fire."""
        manager = make_user("frontend_manager_a", "manager", self.company_a)
        accept_terms(manager, self.venue_a)
        shift = self._shift(self.venue_a, manager, is_published=False)
        self.client.force_authenticate(user=manager)

        response = self.client.post(
            f"/api/v1/shifts/frontend/{shift.id}/checkIn/",
            {"latitude": float(VENUE_LAT), "longitude": float(VENUE_LNG)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("published", str(response.data).lower())
        shift.refresh_from_db()
        self.assertIsNone(shift.check_in_time)
