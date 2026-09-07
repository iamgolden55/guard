"""
The shift lifecycle audit trail — P2-7, and the release-pool race — P2-6.

**P2-7.** Thirty `AuditLog` write sites existed and between them covered user
creation, role change, invoice status change and batch shift creation. Not
covered: a shift edited, cancelled or deleted; an officer assigned to one or
taken off it; check-in; check-out; attendance corrected; a pay rate changed.
Those are the events a licensing officer, a payroll dispute or an incident
investigation actually asks about, and none of them left a trace.

**P2-6.** Two `OpenShiftRequest` rows could exist for one shift — the
`auto_create_open_shift_request` signal and `release_to_pool` both create them
— and `approve_claim` wrote `original_shift.staff_user` with no lock and no
check that the shift was still unassigned. Two approvals overwrote each other
and the second officer believed they held a shift somebody else had been given.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from api.models import (
    AuditLog, OpenShiftRequest, SecurityCompany, Shift, UserCompanyMembership,
    Venue,
)

User = get_user_model()


class ShiftAuditTrailTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Audit Co", registration_number="AUD001",
        )
        self.manager = self._user("audit_manager", "manager")
        self.officer = self._user("audit_officer", "staff")
        self.replacement = self._user("audit_replacement", "staff")
        self.venue = Venue.objects.create(
            company=self.company, name="Audit Venue", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="audit@venue.test", terms_and_conditions="Terms",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def _shift(self, **overrides):
        start = (timezone.now() + timedelta(days=2)).replace(
            minute=0, second=0, microsecond=0
        )
        defaults = dict(
            venue=self.venue, staff_user=self.officer, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )
        defaults.update(overrides)
        return Shift.objects.create(**defaults)

    def _entries(self, shift, action=None):
        qs = AuditLog.objects.filter(
            resource_type="Shift", resource_id=str(shift.pk),
        )
        return qs.filter(action=action) if action else qs

    def test_creating_a_shift_is_recorded(self):
        shift = self._shift()

        entry = self._entries(shift, "create").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.details["staff_user_id"], self.officer.id)

    def test_a_pay_rate_change_is_recorded_with_before_and_after(self):
        shift = self._shift()
        shift.hourly_rate = Decimal("22.50")
        shift.save()

        entry = self._entries(shift, "update").first()
        self.assertIsNotNone(entry, "a pay rate change left no trace")
        self.assertIn("pay_rate", entry.details["categories"])
        self.assertEqual(entry.details["changes"]["hourly_rate"]["old"], "15.00")
        self.assertEqual(entry.details["changes"]["hourly_rate"]["new"], "22.50")

    def test_reassigning_an_officer_is_recorded(self):
        shift = self._shift()
        shift.staff_user = self.replacement
        shift.save()

        entry = self._entries(shift, "update").first()
        self.assertIsNotNone(entry)
        self.assertIn("assignment", entry.details["categories"])
        self.assertEqual(
            entry.details["changes"]["staff_user_id"]["old"], self.officer.id
        )
        self.assertEqual(
            entry.details["changes"]["staff_user_id"]["new"], self.replacement.id
        )

    def test_cancelling_a_shift_is_recorded(self):
        shift = self._shift()
        shift.status = "cancelled"
        shift.save()

        self.assertTrue(self._entries(shift, "delete").exists())

    def test_deleting_a_shift_is_recorded_before_it_is_gone(self):
        shift = self._shift()
        shift_id = shift.pk

        shift.delete()

        entry = AuditLog.objects.filter(
            resource_type="Shift", resource_id=str(shift_id), action="delete",
        ).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.details["staff_user_id"], self.officer.id)

    def test_attendance_changes_are_recorded(self):
        shift = self._shift(
            start_time=timezone.now() - timedelta(hours=2),
            end_time=timezone.now() + timedelta(hours=6),
        )
        shift.check_in_time = timezone.now()
        shift.save()

        entry = self._entries(shift, "update").first()
        self.assertIsNotNone(entry)
        self.assertIn("attendance", entry.details["categories"])

    def test_an_edit_through_the_api_records_the_actor_and_their_address(self):
        shift = self._shift()
        AuditLog.objects.all().delete()

        response = self.client.patch(
            f"/api/v1/shifts/{shift.id}/", {"hourly_rate": "19.00"},
            format="json", REMOTE_ADDR="203.0.113.9",
        )
        self.assertEqual(response.status_code, 200, response.data)

        entry = self._entries(shift).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.user, self.manager)
        self.assertEqual(entry.ip_address, "203.0.113.9")

    def test_an_unremarkable_save_writes_no_row(self):
        """Noise is the enemy of a trail somebody will actually read."""
        shift = self._shift()
        AuditLog.objects.all().delete()

        shift.notes = "Bring a hi-vis."
        shift.save()

        self.assertFalse(self._entries(shift).exists())

    def test_no_signature_or_photo_reaches_the_audit_log(self):
        shift = self._shift(
            start_time=timezone.now() - timedelta(hours=2),
            end_time=timezone.now() + timedelta(hours=6),
        )
        shift.check_in_time = timezone.now()
        shift.start_signature = "data:image/png;base64,SECRETSIGNATURE"
        shift.check_in_photo = "data:image/png;base64,SECRETPHOTO"
        shift.save()

        blob = str(list(self._entries(shift).values_list("details", flat=True)))
        self.assertNotIn("SECRETSIGNATURE", blob)
        self.assertNotIn("SECRETPHOTO", blob)


class OpenShiftRequestRaceTests(APITestCase):
    """P2-6 — one live offer per shift, and one winner per approval."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Pool Co", registration_number="POOL001",
        )
        self.manager = self._user("pool_manager", "manager")
        self.releaser = self._user("pool_releaser", "staff")
        self.first_claimant = self._user("pool_first", "staff")
        self.second_claimant = self._user("pool_second", "staff")
        self.venue = Venue.objects.create(
            company=self.company, name="Pool Venue", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email="pool@venue.test", terms_and_conditions="Terms",
        )
        start = (timezone.now() + timedelta(days=3)).replace(
            minute=0, second=0, microsecond=0
        )
        self.shift = Shift.objects.create(
            venue=self.venue, staff_user=self.releaser, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
            hourly_rate=Decimal("15.00"),
        )

    def _user(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
            # `OpenShiftRequest.clean` requires the claimant to hold the
            # shift's required security role, an approved profile and a valid
            # licence — the eligibility gate that P2-1 notes is applied when
            # claiming and was never applied when starting a shift.
            security_roles=["sg"] if role == "staff" else [],
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        if role == "staff":
            self._make_eligible(user)
        return user

    def _make_eligible(self, user):
        from datetime import date

        from api.models import SIALicense, StaffProfile

        profile = StaffProfile.objects.create(
            user=user, phone_number="07700900000",
            date_of_birth=date(1990, 1, 1), street="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK", is_approved=True,
        )
        SIALicense.objects.create(
            staff_profile=profile,
            license_number=f"{user.id:016d}",
            license_type="ds", issue_date=date.today() - timedelta(days=30),
            expiry_date=date.today() + timedelta(days=365), status="valid",
        )

    def _request(self):
        return OpenShiftRequest.objects.create(
            original_shift=self.shift, requesting_user=self.releaser,
            request_reason="Family commitment", status="open",
        )

    def test_a_shift_cannot_be_offered_twice_at_once(self):
        self._request()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._request()

    def test_a_settled_offer_does_not_block_a_new_one(self):
        first = self._request()
        first.status = "cancelled"
        first.save()

        second = self._request()

        self.assertIsNotNone(second.pk)

    def test_a_second_approval_is_refused_rather_than_overwriting_the_first(self):
        offer = self._request()
        offer.claim_shift(self.first_claimant)
        offer.refresh_from_db()
        offer.approve_claim(self.manager)

        self.shift.refresh_from_db()
        self.assertEqual(self.shift.staff_user, self.first_claimant)

        # A second offer for the same shift, approved after the first: the
        # shift is no longer the releaser's to give away.
        stale = OpenShiftRequest.objects.create(
            original_shift=self.shift, requesting_user=self.releaser,
            request_reason="Duplicate offer", status="claimed",
            claimed_by=self.second_claimant, claim_time=timezone.now(),
        )

        with self.assertRaises(ValueError):
            stale.approve_claim(self.manager)

        self.shift.refresh_from_db()
        self.assertEqual(
            self.shift.staff_user, self.first_claimant,
            "the second approval overwrote the first officer's shift",
        )

    def test_the_normal_release_and_approval_journey_still_works(self):
        offer = self._request()
        offer.claim_shift(self.first_claimant)
        offer.refresh_from_db()

        offer.approve_claim(self.manager, notes="Approved")

        offer.refresh_from_db()
        self.shift.refresh_from_db()
        self.assertEqual(offer.status, "approved")
        self.assertEqual(self.shift.staff_user, self.first_claimant)
        self.assertEqual(self.shift.status, "scheduled")
