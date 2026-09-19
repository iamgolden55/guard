"""
SIA role-to-licence at assignment — AUDIT-2026-09-17 P0-C, decision D-B.

Nothing prevented rostering an officer with a CCTV licence onto a nightclub
door. `security_roles` is free-form and unrelated to `SIALicense.license_type`;
the one mapping in the code produced a warning nobody surfaced; and the
expired-licence block lived only in the browser.

The decision for this phase is **warn and record, do not block**:
- the manager assigning the shift is told, in the response the scheduler reads;
- every such assignment leaves an AuditLog row, whichever path made it;
- the check-in alert covers a licence that doesn't match the role, not only a
  missing or expired one.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import (
    AuditLog, SecurityCompany, Shift, SIALicense, StaffProfile,
    UserCompanyMembership, Venue,
)

User = get_user_model()


class LicenceWarningTestCase(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name="SIA Co", registration_number="SIA001")
        self.manager = self._user("sia_mgr", "manager")
        self.cctv_officer = self._officer("sia_cctv", licence_type="cctv", number="1111222233334444")
        self.ds_officer = self._officer("sia_ds", licence_type="ds", number="5555666677778888")
        self.venue = Venue.objects.create(
            company=self.company, name="Club", address="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK", capacity=100, contact_name="C",
            contact_phone="07700900000", contact_email="club@venue.test",
            terms_and_conditions="Terms",
        )
        self.start = (timezone.now() + timedelta(days=2)).replace(
            hour=21, minute=0, second=0, microsecond=0,
        )
        self.client.force_authenticate(user=self.manager)

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test", password="x", role=role,
        )
        UserCompanyMembership.objects.create(user=user, company=self.company, is_active=True)
        return user

    def _officer(self, username, licence_type, number):
        user = self._user(username, "staff")
        profile = StaffProfile.objects.create(
            user=user, phone_number="07700900000", date_of_birth=date(1990, 1, 1),
            street="1 St", city="Bristol", postal_code="BS1 1AA", country="UK",
        )
        SIALicense.objects.create(
            staff_profile=profile, license_number=number, license_type=licence_type,
            issue_date=date.today() - timedelta(days=365),
            expiry_date=date.today() + timedelta(days=365), status="valid",
        )
        return user

    def _create(self, officer, role):
        return self.client.post("/api/v1/shifts/", {
            "venue": self.venue.pk,
            "staff_user": officer.pk,
            "start_time": self.start.isoformat(),
            "end_time": (self.start + timedelta(hours=6)).isoformat(),
            "required_security_role": role,
            "hourly_rate": "15.00",
        }, format="json")

    def _warning_rows(self, shift_id):
        return AuditLog.objects.filter(
            action="licence_warning", resource_type="Shift", resource_id=str(shift_id),
        )


class AssignmentWarningTests(LicenceWarningTestCase):
    def test_a_cctv_officer_on_a_door_is_allowed_but_warned_and_recorded(self):
        response = self._create(self.cctv_officer, "ds")

        self.assertEqual(response.status_code, 201, response.data)  # not blocked (D-B)
        kinds = [w["type"] for w in response.data["licence_warnings"]]
        self.assertIn("missing_qualification", kinds)
        rows = self._warning_rows(response.data["id"])
        self.assertEqual(rows.count(), 1)
        self.assertEqual(rows.get().user, self.manager)
        self.assertEqual(rows.get().company, self.company)

    def test_a_correctly_licensed_officer_raises_nothing(self):
        response = self._create(self.ds_officer, "ds")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["licence_warnings"], [])
        self.assertFalse(self._warning_rows(response.data["id"]).exists())

    def test_a_door_supervisor_licence_covers_a_security_guard_shift(self):
        """The SIA's own rule, and what the existing check-in guard assumes."""
        response = self._create(self.ds_officer, "sg")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["licence_warnings"], [])
        self.assertFalse(self._warning_rows(response.data["id"]).exists())

    def test_a_security_guard_licence_does_not_cover_a_door(self):
        sg_officer = self._officer("sia_sg", licence_type="sg", number="9999000011112222")
        response = self._create(sg_officer, "ds")

        self.assertIn("missing_qualification", [w["type"] for w in response.data["licence_warnings"]])

    def test_a_role_with_no_known_licence_is_flagged_rather_than_passed(self):
        """steward/retail/static/mobile/event have no licence mapping. They used
        to be skipped silently, which read as 'checked and fine'."""
        response = self._create(self.ds_officer, "steward")

        kinds = [w["type"] for w in response.data["licence_warnings"]]
        self.assertEqual(kinds, ["unverifiable_role"])
        self.assertTrue(self._warning_rows(response.data["id"]).exists())

    def test_reassigning_to_an_unlicensed_officer_is_warned_and_recorded(self):
        created = self._create(self.ds_officer, "ds")
        shift_id = created.data["id"]

        response = self.client.patch(
            f"/api/v1/shifts/{shift_id}/", {"staff_user": self.cctv_officer.pk}, format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        kinds = [w["type"] for w in response.data["licence_warnings"]]
        self.assertIn("missing_qualification", kinds)
        self.assertEqual(self._warning_rows(shift_id).count(), 1)

    def test_every_assignment_path_records_it(self):
        """The record doesn't depend on which endpoint made the assignment —
        here a plain ORM save, as bulk tools and swaps do."""
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.cctv_officer, start_time=self.start,
            end_time=self.start + timedelta(hours=6), status="scheduled",
            required_security_role="ds", hourly_rate=Decimal("15.00"),
        )
        self.assertEqual(self._warning_rows(shift.pk).count(), 1)
        shift.notes = "unrelated edit"
        shift.save()
        self.assertEqual(self._warning_rows(shift.pk).count(), 1, "re-saving must not duplicate")

    def test_multi_staff_creation_returns_warnings_per_shift(self):
        response = self.client.post("/api/v1/shifts/create_multi_staff/", {
            "venue": self.venue.pk,
            "staff_users": [self.ds_officer.pk, self.cctv_officer.pk],
            "start_time": self.start.isoformat(),
            "end_time": (self.start + timedelta(hours=6)).isoformat(),
            "required_security_role": "ds",
        }, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        by_officer = {s["staff_user"]: s["licence_warnings"] for s in response.data["shifts"]}
        self.assertEqual(by_officer[self.ds_officer.pk], [])
        self.assertIn("missing_qualification", [w["type"] for w in by_officer[self.cctv_officer.pk]])


class CheckInRoleMismatchAlertTests(LicenceWarningTestCase):
    def test_checking_in_on_a_role_the_licence_does_not_cover_is_alerted_not_blocked(self):
        from shifts.test_checkin_window import VENUE_LAT, VENUE_LNG, clock_at
        from api.models import VenueTermsAcceptance

        self.venue.latitude, self.venue.longitude, self.venue.check_radius = VENUE_LAT, VENUE_LNG, 100
        self.venue.save()
        VenueTermsAcceptance.objects.create(
            staff_user=self.cctv_officer, venue=self.venue,
            terms_version=self.venue.terms_version or "1",
        )
        now = timezone.now().replace(hour=14, minute=0, second=0, microsecond=0)
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.cctv_officer,
            start_time=now - timedelta(minutes=5), end_time=now + timedelta(hours=6),
            status="scheduled", required_security_role="ds", is_published=True,
            hourly_rate=Decimal("15.00"),
        )
        self.client.force_authenticate(user=self.cctv_officer)
        with clock_at(now):
            response = self.client.post(
                f"/api/v1/shifts/{shift.id}/check_in/",
                {"latitude": float(VENUE_LAT), "longitude": float(VENUE_LNG)}, format="json",
            )

        self.assertEqual(response.status_code, 200, response.data)
        alert = AuditLog.objects.filter(
            action="compliance_alert", resource_id=str(shift.id),
            details__reason="licence_does_not_cover_role",
        )
        self.assertTrue(alert.exists())


class BulkPreviewLicenceTests(LicenceWarningTestCase):
    """The bulk wizard previews before committing; the licence check belongs in
    that preview, as a note on an assignable slot — not a conflict (D-B)."""

    def test_preview_marks_the_slot_but_still_assigns_it(self):
        start = timezone.localdate() + timedelta(days=7)
        response = self.client.post("/api/v1/shifts/bulk_create/?preview=true", {
            "mode": "recurrence",
            "venue": self.venue.id,
            "start_date": start.isoformat(),
            "end_date": start.isoformat(),
            "days_of_week": [start.weekday()],
            "start_time": "20:00",
            "end_time": "02:00",
            "officers_needed": 2,
            "staff_users": [self.ds_officer.id, self.cctv_officer.id],
            "required_security_role": "ds",
        }, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        slots = {s["staff_user"]: s for s in response.data["shifts"][0]["slots"]}
        self.assertEqual(slots[self.cctv_officer.id]["status"], "ok")
        self.assertIn("licence", slots[self.cctv_officer.id]["licence_warning"].lower())
        self.assertNotIn("licence_warning", slots[self.ds_officer.id])
