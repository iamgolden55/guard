"""
When a shift may be started — P2-8, P2-1, P2-3.

**P2-8.** Found by diffing the mobile client's gate against the server's. The
client refuses check-in once `end_time` has passed
(`ShiftDetailsScreenV2.tsx`: `if (end < now) return false`). The server had no
upper bound at all — only a *date* comparison and a 15-minute early limit. So
for a 09:00–17:00 shift, an officer who never turned up could check in at
23:50 the same day and be accepted. Combined with auto-approval on check-out
and a pay basis of scheduled hours, that is eight hours' pay for a shift that
was not worked, prevented only by the mobile UI declining to send the request.
A hidden button is not a security control.

**P2-1.** SIA eligibility was verified when *claiming* an open shift and never
when *starting* one, so an officer assigned in March with a licence expiring
in April worked an unlicensed shift in May and nothing fired. Per the run's
D3 default this alerts rather than blocks: a hard block strands a real officer
on a real site over a data-entry error, and that is not reversible.

**P2-3.** `Venue.verify_location` returned False on any non-OK Distance Matrix
status, and `ZERO_RESULTS` is routine for walking routes across water, a
motorway or private land — so an officer standing at the venue could be
refused. Haversine is exact for geofencing at this scale, costs nothing and
cannot be unavailable, so it is the primary test.
"""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    SecurityCompany, Shift, StaffProfile, UserCompanyMembership, Venue,
    VenueTermsAcceptance,
)

User = get_user_model()

VENUE_LAT = Decimal("51.454500")
VENUE_LNG = Decimal("-2.587900")


class CheckInWindowTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Window Co", registration_number="WIN001",
        )
        self.staff = User.objects.create_user(
            username="window_staff", email="window@test.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=self.staff, company=self.company, is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Window Venue", address="1 Win St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="win@venue.test", terms_and_conditions="Terms",
            latitude=VENUE_LAT, longitude=VENUE_LNG, check_radius=100,
        )
        VenueTermsAcceptance.objects.create(
            staff_user=self.staff, venue=self.venue,
            terms_version=self.venue.terms_version or "1",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _shift(self, *, started_hours_ago=2, length=8):
        start = timezone.now() - timedelta(hours=started_hours_ago)
        return Shift.objects.create(
            venue=self.venue, staff_user=self.staff, start_time=start,
            end_time=start + timedelta(hours=length), status="scheduled",
            required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )

    def _check_in(self, shift):
        return self.client.post(
            f"/api/v1/shifts/{shift.id}/check_in/",
            {"latitude": float(VENUE_LAT), "longitude": float(VENUE_LNG)},
            format="json",
        )

    # ── P2-8 ────────────────────────────────────────────────────────────────

    def test_check_in_is_refused_after_the_shift_has_ended(self):
        """A 09:00-17:00 shift is not startable at 23:50."""
        shift = self._shift(started_hours_ago=10, length=8)

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        shift.refresh_from_db()
        self.assertIsNone(shift.check_in_time)

    def test_check_in_just_before_the_end_still_works(self):
        shift = self._shift(started_hours_ago=7, length=8)

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        shift.refresh_from_db()
        self.assertIsNotNone(shift.check_in_time)

    def test_a_genuinely_late_arrival_inside_the_grace_period_is_accepted(self):
        """A guard arriving minutes after the scheduled end is still a guard."""
        shift = self._shift(started_hours_ago=8, length=8)
        shift.end_time = timezone.now() - timedelta(minutes=10)
        shift.save(update_fields=["end_time"])

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_an_overnight_shift_still_checks_in_after_midnight(self):
        """Regression guard against test_overnight_attendance.py."""
        now = timezone.now()
        start = now - timedelta(hours=3)
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=start + timedelta(hours=9),
            status="scheduled", required_security_role="sg",
            is_published=True, hourly_rate=Decimal("15.00"),
        )

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # ── P2-1 ────────────────────────────────────────────────────────────────

    def test_an_expired_licence_does_not_block_check_in(self):
        """D3: alert, do not block. A stranded officer is not reversible."""
        StaffProfile.objects.create(
            user=self.staff, phone_number="07700900000",
            date_of_birth=timezone.now().date() - timedelta(days=10000),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
            is_approved=True,
        )
        shift = self._shift()

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        shift.refresh_from_db()
        self.assertIsNotNone(shift.check_in_time)

    def test_an_unlicensed_check_in_is_flagged_for_review(self):
        from api.models import AuditLog

        StaffProfile.objects.create(
            user=self.staff, phone_number="07700900000",
            date_of_birth=timezone.now().date() - timedelta(days=10000),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
            is_approved=True,
        )
        shift = self._shift()

        self._check_in(shift)

        self.assertTrue(
            AuditLog.objects.filter(
                action="compliance_alert",
                resource_type="Shift",
                resource_id=str(shift.id),
            ).exists(),
            "an unlicensed check-in must leave a record a manager can act on",
        )

    def test_a_licensed_officer_raises_no_alert(self):
        from datetime import date

        from api.models import AuditLog, SIALicense

        profile = StaffProfile.objects.create(
            user=self.staff, phone_number="07700900000",
            date_of_birth=timezone.now().date() - timedelta(days=10000),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
            is_approved=True,
        )
        SIALicense.objects.create(
            staff_profile=profile, license_number="1234567890123456",
            license_type="ds", issue_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=365), status="valid",
        )
        shift = self._shift()

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(
            AuditLog.objects.filter(action="compliance_alert").exists()
        )

    def test_a_licence_valid_today_but_expired_on_the_shift_date_is_flagged(self):
        """Validity is checked against the shift, not against today."""
        from datetime import date

        from api.models import AuditLog, SIALicense

        profile = StaffProfile.objects.create(
            user=self.staff, phone_number="07700900000",
            date_of_birth=timezone.now().date() - timedelta(days=10000),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
            is_approved=True,
        )
        SIALicense.objects.create(
            staff_profile=profile, license_number="1234567890123456",
            license_type="ds", issue_date=date.today() - timedelta(days=400),
            expiry_date=date.today() - timedelta(days=1), status="valid",
        )
        shift = self._shift()

        self._check_in(shift)

        self.assertTrue(
            AuditLog.objects.filter(
                action="compliance_alert", resource_id=str(shift.id),
            ).exists()
        )


class GeofenceFallbackTests(APITestCase):
    """P2-3 — geofencing must not depend on a third-party API being reachable."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Geo Co", registration_number="GEO101",
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Geo Venue", address="1 Geo St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="geo101@venue.test", terms_and_conditions="Terms",
            latitude=VENUE_LAT, longitude=VENUE_LNG, check_radius=100,
        )

    def test_standing_at_the_venue_verifies(self):
        self.assertTrue(
            self.venue.verify_location(float(VENUE_LAT), float(VENUE_LNG))
        )

    def test_a_point_outside_the_radius_does_not(self):
        # ~1.1 km north.
        self.assertFalse(
            self.venue.verify_location(float(VENUE_LAT) + 0.01, float(VENUE_LNG))
        )

    def test_a_zero_results_route_does_not_refuse_someone_standing_there(self):
        """`ZERO_RESULTS` is routine for a walking route across water."""
        with patch("googlemaps.Client") as client:
            client.return_value.distance_matrix.return_value = {
                "status": "ZERO_RESULTS", "rows": [],
            }
            self.assertTrue(
                self.venue.verify_location(float(VENUE_LAT), float(VENUE_LNG))
            )

    def test_an_unreachable_maps_api_does_not_refuse_them_either(self):
        with patch("googlemaps.Client", side_effect=Exception("network down")):
            self.assertTrue(
                self.venue.verify_location(float(VENUE_LAT), float(VENUE_LNG))
            )

    def test_a_venue_with_no_coordinates_cannot_verify_anything(self):
        self.venue.latitude = None
        self.venue.longitude = None
        self.venue.save(update_fields=["latitude", "longitude"])

        self.assertFalse(self.venue.verify_location(51.0, -2.0))
