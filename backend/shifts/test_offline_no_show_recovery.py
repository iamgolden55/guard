"""
An offline check-in that arrives after the no-show job — AUDIT-2026-09-17 P0-B.

The chain the audit reproduced: a check-in fails on poor signal; within 30
minutes `detect_attendance_exceptions` flips the shift to `no_show`; when the
phone's queued check-in finally replays, `Shift.check_in()` refuses anything
not `scheduled` or `active`; and invoicing pays only approved shifts. A worked
shift became an unpaid no-show with an accusatory note.

A flagged offline replay may now lift a no-show — but only one the automatic
job set, and only when the officer's own recorded time falls inside the shift.
The shift is marked for attendance review, so a manager still decides; nothing
is approved or paid by this path. A no-show a manager recorded is never lifted.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    SecurityCompany, Shift, UserCompanyMembership, Venue, VenueTermsAcceptance,
)
from shifts.test_checkin_window import VENUE_LAT, VENUE_LNG, clock_at

User = get_user_model()

AUTO_NOTE = "\n[Auto] No-show detected: no check-in 30 minutes after shift start."


class OfflineNoShowRecoveryTests(APITestCase):
    def setUp(self):
        company = SecurityCompany.objects.create(name="Replay Co", registration_number="RPL001")
        self.staff = User.objects.create_user(
            username="replay_staff", email="replay@test.test", password="x", role="staff",
        )
        UserCompanyMembership.objects.create(user=self.staff, company=company, is_active=True)
        self.venue = Venue.objects.create(
            company=company, name="Replay Venue", address="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK", capacity=100, contact_name="C",
            contact_phone="07700900000", contact_email="rpl@venue.test",
            terms_and_conditions="Terms", latitude=VENUE_LAT, longitude=VENUE_LNG,
            check_radius=100,
        )
        VenueTermsAcceptance.objects.create(
            staff_user=self.staff, venue=self.venue,
            terms_version=self.venue.terms_version or "1",
        )
        # Mid-afternoon so every offset stays inside one calendar day.
        self.now = timezone.now().replace(hour=14, minute=0, second=0, microsecond=0)
        self.start = self.now - timedelta(minutes=50)
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _no_show(self, note=AUTO_NOTE):
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff, start_time=self.start,
            end_time=self.start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True, hourly_rate=Decimal("15.00"),
        )
        # What detect_attendance_exceptions writes.
        Shift.objects.filter(pk=shift.pk).update(status="no_show", notes=note)
        return Shift.objects.get(pk=shift.pk)

    def _check_in(self, shift, **extra):
        body = {"latitude": float(VENUE_LAT), "longitude": float(VENUE_LNG)}
        body.update(extra)
        with clock_at(self.now):
            return self.client.post(f"/api/v1/shifts/{shift.id}/check_in/", body, format="json")

    def test_a_replayed_check_in_lifts_an_automatic_no_show_into_review(self):
        shift = self._no_show()
        pressed_at = self.start + timedelta(minutes=2)

        response = self._check_in(
            shift, offline_replay=True, occurred_at=pressed_at.isoformat(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.status, "in_progress")
        self.assertTrue(shift.needs_attendance_review)
        self.assertEqual(shift.reported_check_in_time, pressed_at)
        self.assertIsNotNone(shift.check_in_time)

    def test_a_no_show_a_manager_recorded_is_never_lifted(self):
        shift = self._no_show(note="Manager: did not attend")

        response = self._check_in(
            shift, offline_replay=True,
            occurred_at=(self.start + timedelta(minutes=2)).isoformat(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        shift.refresh_from_db()
        self.assertEqual(shift.status, "no_show")

    def test_a_live_check_in_does_not_lift_a_no_show(self):
        """Only the queue's replay carries the officer's earlier attempt. A live
        late arrival is the running-late case, which is Phase 3's to design."""
        shift = self._no_show()

        response = self._check_in(shift)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        shift.refresh_from_db()
        self.assertEqual(shift.status, "no_show")

    def test_a_replay_claiming_a_time_outside_the_shift_is_not_believed(self):
        shift = self._no_show()

        response = self._check_in(
            shift, offline_replay=True,
            occurred_at=(self.start - timedelta(hours=3)).isoformat(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        shift.refresh_from_db()
        self.assertEqual(shift.status, "no_show")
