"""
Tests for manual check-in/check-out override time validation.
"""
from datetime import timedelta, date, datetime
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from django.core import mail

from api.models import SecurityCompany, UserCompanyMembership, Venue, Shift, AuditLog

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
        # Published: check-in on a draft is blocked outright, so a draft here
        # would only ever exercise that guard instead of the override-time
        # logic these tests are about.
        self.shift = Shift.objects.create(
            staff_user=self.staff,
            venue=self.venue,
            start_time=now - timedelta(hours=2),
            end_time=now + timedelta(hours=6),
            status="scheduled",
            required_security_role="sg",
            is_published=True,
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


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class BulkCreateShiftTests(APITestCase):
    """Tests for POST /api/v1/shifts/bulk_create/."""

    URL = "/api/v1/shifts/bulk_create/"

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Bulk Co",
            registration_number="BULK001",
        )
        self.other_company = SecurityCompany.objects.create(
            name="Other Co",
            registration_number="BULK002",
        )
        self.manager = User.objects.create_user(
            username="bulk_manager",
            email="bulk_manager@test.com",
            password="testpass123",
            role="manager",
        )
        self.staff_a = User.objects.create_user(
            username="bulk_staff_a",
            email="staff_a@test.com",
            password="testpass123",
            role="staff",
        )
        self.staff_b = User.objects.create_user(
            username="bulk_staff_b",
            email="staff_b@test.com",
            password="testpass123",
            role="staff",
        )
        self.staff_c = User.objects.create_user(
            username="bulk_staff_c",
            email="staff_c@test.com",
            password="testpass123",
            role="staff",
        )
        UserCompanyMembership.objects.create(user=self.manager, company=self.company, is_active=True)
        UserCompanyMembership.objects.create(user=self.staff_a, company=self.company, is_active=True)
        UserCompanyMembership.objects.create(user=self.staff_b, company=self.company, is_active=True)
        UserCompanyMembership.objects.create(user=self.staff_c, company=self.company, is_active=True)
        self.venue = Venue.objects.create(
            company=self.company,
            name="Bulk Venue",
            address="1 Bulk St",
            city="London",
            postal_code="SW1 1AA",
            country="UK",
            capacity=100,
            contact_name="V",
            contact_phone="07700900100",
            contact_email="v@test.com",
            terms_and_conditions="t",
        )
        self.other_venue = Venue.objects.create(
            company=self.other_company,
            name="Cross-tenant Venue",
            address="2 Other St",
            city="London",
            postal_code="EC1 1AA",
            country="UK",
            capacity=100,
            contact_name="V",
            contact_phone="07700900200",
            contact_email="v2@test.com",
            terms_and_conditions="t",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def _future_monday(self):
        today = timezone.localdate()
        days_to_monday = (7 - today.weekday()) % 7 or 7
        return today + timedelta(days=days_to_monday)

    def _recurrence_payload(self, **overrides):
        start = self._future_monday()
        payload = {
            "mode": "recurrence",
            "venue": self.venue.id,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=13)).isoformat(),
            "days_of_week": [4, 5],
            "start_time": "20:00",
            "end_time": "04:00",
            "officers_needed": 1,
            "staff_users": [],
            "required_security_role": "sg",
        }
        payload.update(overrides)
        return payload

    def test_recurrence_expansion_basic(self):
        payload = self._recurrence_payload()
        response = self.client.post(self.URL + "?preview=true", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["summary"]["to_create"], 4)
        for shift_row in response.data["shifts"]:
            start_iso = shift_row["start"]
            end_iso = shift_row["end"]
            self.assertNotEqual(start_iso[:10], end_iso[:10])

    def test_recurrence_padding_open_slots(self):
        payload = self._recurrence_payload(
            officers_needed=3,
            staff_users=[self.staff_a.id, self.staff_b.id],
        )
        response = self.client.post(self.URL + "?preview=true", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        first = response.data["shifts"][0]
        statuses = [s["status"] for s in first["slots"]]
        self.assertEqual(statuses.count("ok"), 2)
        self.assertEqual(statuses.count("open"), 1)

    def test_recurrence_too_many_staff(self):
        payload = self._recurrence_payload(
            officers_needed=2,
            staff_users=[self.staff_a.id, self.staff_b.id, self.staff_c.id],
        )
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_preview_does_not_write(self):
        baseline = Shift.objects.count()
        payload = self._recurrence_payload(
            officers_needed=2,
            staff_users=[self.staff_a.id],
        )
        response = self.client.post(self.URL + "?preview=true", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["preview"])
        self.assertEqual(Shift.objects.count(), baseline)

    def test_commit_creates_shifts(self):
        baseline = Shift.objects.count()
        payload = self._recurrence_payload(
            officers_needed=2,
            staff_users=[self.staff_a.id],
        )
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["created"], 4 * 2)
        self.assertEqual(Shift.objects.count(), baseline + 8)
        self.assertTrue(all(s.is_published is False for s in Shift.objects.filter(venue=self.venue)))

    def test_leave_conflict_collapses_to_open(self):
        try:
            from leave_management.models import LeaveType, LeaveRequest
        except ImportError:
            self.skipTest("leave_management app not installed")

        start = self._future_monday()
        leave_type = LeaveType.objects.create(name="Annual Leave Bulk", code="ALB")
        LeaveRequest.objects.create(
            staff_user=self.staff_a,
            leave_type=leave_type,
            start_date=start - timedelta(days=1),
            end_date=start + timedelta(days=20),
            days_requested=Decimal("21.00"),
            reason="vacation",
            status="approved",
        )
        payload = self._recurrence_payload(
            officers_needed=1,
            staff_users=[self.staff_a.id],
        )

        preview = self.client.post(self.URL + "?preview=true", payload, format="json")
        self.assertEqual(preview.status_code, status.HTTP_200_OK, preview.data)
        first_slots = preview.data["shifts"][0]["slots"]
        self.assertEqual(first_slots[0]["status"], "conflict")
        self.assertIn("leave", first_slots[0]["reason"].lower())

        commit = self.client.post(self.URL, payload, format="json")
        self.assertEqual(commit.status_code, status.HTTP_201_CREATED, commit.data)
        self.assertEqual(commit.data["skipped_assignments"], 4)
        for shift in Shift.objects.filter(venue=self.venue):
            self.assertIsNone(shift.staff_user_id)
            self.assertEqual(shift.status, "open")

    def test_in_batch_overlap(self):
        start = timezone.now() + timedelta(days=3)
        payload = {
            "mode": "explicit",
            "shifts": [
                {
                    "venue": self.venue.id,
                    "start_time": start.isoformat(),
                    "end_time": (start + timedelta(hours=8)).isoformat(),
                    "staff_users": [self.staff_a.id],
                    "officers_needed": 1,
                },
                {
                    "venue": self.venue.id,
                    "start_time": (start + timedelta(hours=4)).isoformat(),
                    "end_time": (start + timedelta(hours=12)).isoformat(),
                    "staff_users": [self.staff_a.id],
                    "officers_needed": 1,
                },
            ],
        }
        response = self.client.post(self.URL + "?preview=true", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        first = response.data["shifts"][0]["slots"][0]
        second = response.data["shifts"][1]["slots"][0]
        self.assertEqual(first["status"], "ok")
        self.assertEqual(second["status"], "conflict")
        self.assertIn("batch", second["reason"].lower())

    def test_tenant_guard_cross_company_venue(self):
        payload = self._recurrence_payload(venue=self.other_venue.id)
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_role_gate_non_manager(self):
        self.client.force_authenticate(user=self.staff_a)
        response = self.client.post(self.URL, self._recurrence_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cap_200(self):
        start = self._future_monday()
        payload = self._recurrence_payload(
            start_date=start.isoformat(),
            end_date=(start + timedelta(days=60)).isoformat(),
            days_of_week=[0, 1, 2, 3, 4, 5, 6],
            officers_needed=10,
        )
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("200", str(response.data))

    def test_atomic_rollback(self):
        baseline = Shift.objects.count()
        payload = self._recurrence_payload(
            officers_needed=1,
            staff_users=[self.staff_a.id],
        )

        original_save = Shift.save
        call_count = {"n": 0}

        def flaky_save(self, *args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 2:
                raise RuntimeError("boom")
            return original_save(self, *args, **kwargs)

        with mock.patch.object(Shift, "save", flaky_save):
            with self.assertRaises(RuntimeError):
                self.client.post(self.URL, payload, format="json")

        self.assertEqual(Shift.objects.count(), baseline)

    def test_send_notifications_off_by_default(self):
        payload = self._recurrence_payload(
            officers_needed=1,
            staff_users=[self.staff_a.id],
            is_published=True,
        )
        # captureOnCommitCallbacks(execute=True) flushes on_commit hooks
        # that would otherwise never fire under TestCase's outer transaction.
        with mock.patch(
            "api.services.email_notification_service.EmailNotificationService.send_shift_assignment_email"
        ) as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        mock_email.assert_not_called()

    def test_send_notifications_requires_publish(self):
        payload = self._recurrence_payload(
            officers_needed=1,
            staff_users=[self.staff_a.id],
            send_notifications=True,
            is_published=False,
        )
        with mock.patch(
            "api.services.email_notification_service.EmailNotificationService.send_shift_assignment_email"
        ) as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        mock_email.assert_not_called()

    def test_audit_log_one_per_batch(self):
        baseline = AuditLog.objects.filter(resource_type="shift_batch").count()
        payload = self._recurrence_payload(
            officers_needed=2,
            staff_users=[self.staff_a.id, self.staff_b.id],
        )
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        rows = AuditLog.objects.filter(resource_type="shift_batch")
        self.assertEqual(rows.count(), baseline + 1)
        latest = rows.order_by("-timestamp").first()
        self.assertEqual(latest.action, "create")
        self.assertEqual(latest.details["total_created"], 8)
        self.assertEqual(latest.details["mode"], "recurrence")

    def test_tenant_guard_cross_company_staff(self):
        # A user that belongs only to other_company must not be assignable to
        # shifts under the manager's company, even if the venue resolves cleanly.
        foreign_staff = User.objects.create_user(
            username="foreign_staff",
            email="foreign@test.com",
            password="testpass123",
            role="staff",
        )
        UserCompanyMembership.objects.create(
            user=foreign_staff, company=self.other_company, is_active=True
        )

        baseline = Shift.objects.count()
        payload = self._recurrence_payload(
            officers_needed=1,
            staff_users=[foreign_staff.id],
        )
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertIn(str(foreign_staff.id), str(response.data))
        self.assertEqual(Shift.objects.count(), baseline)

        # Explicit mode: same guarantee.
        start = timezone.now() + timedelta(days=3)
        explicit_payload = {
            "mode": "explicit",
            "shifts": [
                {
                    "venue": self.venue.id,
                    "start_time": start.isoformat(),
                    "end_time": (start + timedelta(hours=8)).isoformat(),
                    "staff_users": [foreign_staff.id],
                    "officers_needed": 1,
                },
            ],
        }
        response = self.client.post(self.URL, explicit_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertEqual(Shift.objects.count(), baseline)

    def test_past_start_blocks_open_slot(self):
        # Pure-open slot (no staff) with a past start_time used to slip through
        # the past-time guard because the check was nested in the per-staff loop.
        baseline = Shift.objects.count()
        baseline_past = Shift.objects.filter(start_time__lt=timezone.now()).count()
        past_start = timezone.now() - timedelta(days=2)
        payload = {
            "mode": "explicit",
            "shifts": [
                {
                    "venue": self.venue.id,
                    "start_time": past_start.isoformat(),
                    "end_time": (past_start + timedelta(hours=4)).isoformat(),
                    "staff_users": [],
                    "officers_needed": 1,
                },
            ],
            "allow_past_dates": False,
        }
        response = self.client.post(self.URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["created"], 0)
        self.assertGreaterEqual(response.data["skipped_past"], 1)
        self.assertEqual(
            Shift.objects.filter(start_time__lt=timezone.now()).count(),
            baseline_past,
        )
        self.assertEqual(Shift.objects.count(), baseline)

    def test_past_start_preview_flags_as_conflict(self):
        past_start = timezone.now() - timedelta(days=2)
        payload = {
            "mode": "explicit",
            "shifts": [
                {
                    "venue": self.venue.id,
                    "start_time": past_start.isoformat(),
                    "end_time": (past_start + timedelta(hours=4)).isoformat(),
                    "staff_users": [self.staff_a.id],
                    "officers_needed": 2,
                },
            ],
            "allow_past_dates": False,
        }
        response = self.client.post(self.URL + "?preview=true", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        slots = response.data["shifts"][0]["slots"]
        self.assertTrue(all(s["status"] == "conflict" for s in slots))
        self.assertTrue(all("past" in s["reason"].lower() for s in slots))
        self.assertGreaterEqual(response.data["summary"]["skipped_past"], 1)


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class ShiftScheduleDigestTests(APITestCase):
    """Tests for the shift schedule digest email path (publish + bulk_create)."""

    PUBLISH_URL = "/api/v1/shifts/publish/"
    BULK_CREATE_URL = "/api/v1/shifts/bulk_create/"
    CREATE_URL = "/api/v1/shifts/"

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Digest Co",
            registration_number="DIGEST001",
        )
        self.manager = User.objects.create_user(
            username="digest_manager",
            email="digest_manager@test.com",
            password="testpass123",
            role="manager",
            first_name="Manager",
            last_name="One",
        )
        self.staff_a = User.objects.create_user(
            username="digest_staff_a",
            email="digest_a@test.com",
            password="testpass123",
            role="staff",
            first_name="Alice",
            last_name="A",
        )
        self.staff_b = User.objects.create_user(
            username="digest_staff_b",
            email="digest_b@test.com",
            password="testpass123",
            role="staff",
            first_name="Bob",
            last_name="B",
        )
        UserCompanyMembership.objects.create(user=self.manager, company=self.company, is_active=True)
        UserCompanyMembership.objects.create(user=self.staff_a, company=self.company, is_active=True)
        UserCompanyMembership.objects.create(user=self.staff_b, company=self.company, is_active=True)
        self.venue = Venue.objects.create(
            company=self.company,
            name="Digest Venue",
            address="9 Digest Rd",
            city="London",
            postal_code="SW1 9DD",
            country="UK",
            capacity=100,
            contact_name="V",
            contact_phone="07700900900",
            contact_email="v@digest.test",
            terms_and_conditions="t",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.manager)

    def _make_draft(self, staff_user, start_offset_days=2, hours_in=20, duration=4):
        start = (timezone.now() + timedelta(days=start_offset_days)).replace(
            hour=hours_in, minute=0, second=0, microsecond=0
        )
        return Shift.objects.create(
            venue=self.venue,
            staff_user=staff_user,
            start_time=start,
            end_time=start + timedelta(hours=duration),
            status="scheduled",
            required_security_role="sg",
            is_published=False,
            hourly_rate=Decimal("15.00"),
        )

    def test_publish_sends_one_email_per_staff(self):
        shift_ids = []
        for staff in (self.staff_a, self.staff_b):
            for offset in (2, 3, 4):
                shift_ids.append(self._make_draft(staff, start_offset_days=offset).id)

        mail.outbox = []
        response = self.client.post(
            self.PUBLISH_URL, {"shift_ids": shift_ids}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["published"], 6)
        self.assertEqual(response.data["digests_queued"], 2)
        self.assertEqual(len(mail.outbox), 2)

        recipients = sorted(addr for m in mail.outbox for addr in m.to)
        self.assertEqual(recipients, sorted([self.staff_a.email, self.staff_b.email]))
        for msg in mail.outbox:
            self.assertIn("3 new shift", msg.subject)

    def test_publish_digest_excludes_past_shifts(self):
        future_ids = [
            self._make_draft(self.staff_a, start_offset_days=2).id,
            self._make_draft(self.staff_a, start_offset_days=3).id,
        ]
        past_start = (timezone.now() - timedelta(days=1)).replace(microsecond=0)
        past_shift = Shift.objects.create(
            venue=self.venue,
            staff_user=self.staff_a,
            start_time=past_start,
            end_time=past_start + timedelta(hours=4),
            status="scheduled",
            required_security_role="sg",
            is_published=False,
            hourly_rate=Decimal("15.00"),
        )

        mail.outbox = []
        response = self.client.post(
            self.PUBLISH_URL,
            {"shift_ids": future_ids + [past_shift.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["published"], 3)
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertIn("2 new shift", msg.subject)
        body = msg.body + (msg.alternatives[0][0] if msg.alternatives else "")
        self.assertNotIn(past_start.strftime("%H:%M"), body)

    def test_publish_no_email_for_unassigned_shifts(self):
        start = (timezone.now() + timedelta(days=2)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )
        open_shift = Shift.objects.create(
            venue=self.venue,
            staff_user=None,
            start_time=start,
            end_time=start + timedelta(hours=4),
            status="open",
            required_security_role="sg",
            is_published=False,
            hourly_rate=Decimal("15.00"),
        )

        mail.outbox = []
        response = self.client.post(
            self.PUBLISH_URL, {"shift_ids": [open_shift.id]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["published"], 1)
        self.assertEqual(response.data["digests_queued"], 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_publish_digest_resilient_to_one_failure(self):
        a_ids = [self._make_draft(self.staff_a, start_offset_days=o).id for o in (2, 3)]
        b_ids = [self._make_draft(self.staff_b, start_offset_days=o).id for o in (2, 3)]

        real_delay = None
        from api.tasks import send_shift_schedule_email_task
        real_delay = send_shift_schedule_email_task.delay

        def flaky_delay(user_id, shift_id_list, *args, **kwargs):
            if user_id == self.staff_a.id:
                raise RuntimeError("broker boom")
            return real_delay(user_id, shift_id_list, *args, **kwargs)

        mail.outbox = []
        with mock.patch(
            "api.tasks.send_shift_schedule_email_task.delay",
            side_effect=flaky_delay,
        ):
            response = self.client.post(
                self.PUBLISH_URL, {"shift_ids": a_ids + b_ids}, format="json"
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["published"], 4)
        self.assertEqual(response.data["digests_queued"], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.staff_b.email])

    def _future_monday(self):
        today = timezone.localdate()
        days_to_monday = (7 - today.weekday()) % 7 or 7
        return today + timedelta(days=days_to_monday)

    def test_bulk_create_publish_and_notify_uses_digest(self):
        start = self._future_monday()
        payload = {
            "mode": "recurrence",
            "venue": self.venue.id,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=27)).isoformat(),
            "days_of_week": [start.weekday()],
            "start_time": "20:00",
            "end_time": "23:00",
            "officers_needed": 1,
            "staff_users": [self.staff_a.id],
            "required_security_role": "sg",
            "is_published": True,
            "send_notifications": True,
        }

        mail.outbox = []
        response = self.client.post(self.BULK_CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["created"], 4)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.staff_a.email])
        self.assertIn("4 new shift", mail.outbox[0].subject)

    def test_bulk_create_drafts_send_no_email(self):
        start = self._future_monday()
        payload = {
            "mode": "recurrence",
            "venue": self.venue.id,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=13)).isoformat(),
            "days_of_week": [start.weekday()],
            "start_time": "20:00",
            "end_time": "23:00",
            "officers_needed": 1,
            "staff_users": [self.staff_a.id],
            "required_security_role": "sg",
        }

        mail.outbox = []
        response = self.client.post(self.BULK_CREATE_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(len(mail.outbox), 0)

    def _create_payload(self, **overrides):
        start = (timezone.now() + timedelta(days=3)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )
        payload = {
            "venue": self.venue.id,
            "staff_user": self.staff_a.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=4)).isoformat(),
            "status": "scheduled",
            "required_security_role": "sg",
            "hourly_rate": "15.00",
        }
        payload.update(overrides)
        return payload

    def test_single_published_create_sends_one_per_shift_email(self):
        # A one-off published create is an ordinary assignment, so it keeps the
        # per-shift email rather than being folded into a digest.
        mail.outbox = []
        with mock.patch(
            "api.services.email_notification_service."
            "EmailNotificationService.send_shift_assignment_email",
            return_value=True,
        ) as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.CREATE_URL,
                    self._create_payload(is_published=True),
                    format="json",
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        mock_email.assert_called_once()
        self.assertEqual(mock_email.call_args.kwargs["user_id"], self.staff_a.id)

    def test_single_draft_create_sends_no_email(self):
        # The regression this whole path exists for: creating a shift is not
        # telling the officer about it. Drafts are invisible to staff, so an
        # email here would point at a shift they can't open.
        mail.outbox = []
        with mock.patch(
            "api.services.email_notification_service."
            "EmailNotificationService.send_shift_assignment_email",
            return_value=True,
        ) as mock_email:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.CREATE_URL, self._create_payload(), format="json"
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(Shift.objects.get(id=response.data["id"]).is_published)
        mock_email.assert_not_called()
        self.assertEqual(len(mail.outbox), 0)

    def test_digest_task_filters_by_company(self):
        # Defence-in-depth: even if a wrong company_id is passed, the task
        # must not email Company A's shift details to a recipient.
        from api.tasks import send_shift_schedule_email_task

        other_company = SecurityCompany.objects.create(
            name="Digest Other Co", registration_number="DIGEST002",
        )

        start = (timezone.now() + timedelta(days=2)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )
        shift = Shift.objects.create(
            venue=self.venue,
            staff_user=self.staff_a,
            start_time=start,
            end_time=start + timedelta(hours=4),
            status="scheduled",
            required_security_role="sg",
            is_published=True,
            hourly_rate=Decimal("15.00"),
        )

        mail.outbox = []
        result = send_shift_schedule_email_task.run(
            self.staff_a.id, [shift.id], other_company.id
        )
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(result.get("status"), "skipped")
        self.assertEqual(result.get("reason"), "no_shifts")

        mail.outbox = []
        result = send_shift_schedule_email_task.run(
            self.staff_a.id, [shift.id], self.company.id
        )
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.staff_a.email])

    def test_bulk_publish_digest_sends_one_email_and_one_push(self):
        # publish_shifts on N drafts for one officer yields exactly one digest
        # email and one push — the interrupting channels speak once for the
        # batch. In-app rows stay per-shift: they're the officer's record of
        # what landed, and each one deep-links to its shift.
        from api.models import Notification

        shift_ids = [
            self._make_draft(self.staff_a, start_offset_days=o).id
            for o in (2, 3, 4)
        ]

        baseline_inapp = Notification.objects.filter(user=self.staff_a).count()
        mail.outbox = []
        with mock.patch(
            "api.services.push_notification_service.send_shift_assignment_notification",
            return_value=True,
        ) as mock_push:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.PUBLISH_URL, {"shift_ids": shift_ids}, format="json"
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["published"], 3)
        self.assertEqual(response.data["digests_queued"], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.staff_a.email])
        mock_push.assert_called_once()
        self.assertEqual(
            Notification.objects.filter(user=self.staff_a).count(),
            baseline_inapp + 3,
        )

    def test_bulk_create_publish_suppresses_email_and_push(self):
        # bulk_create with is_published + send_notifications hits the digest
        # path: one email, no per-shift push. In-app rows still land so the
        # officer's app reflects the new work.
        from api.models import Notification

        start = self._future_monday()
        payload = {
            "mode": "recurrence",
            "venue": self.venue.id,
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=27)).isoformat(),
            "days_of_week": [start.weekday()],
            "start_time": "20:00",
            "end_time": "23:00",
            "officers_needed": 1,
            "staff_users": [self.staff_a.id],
            "required_security_role": "sg",
            "is_published": True,
            "send_notifications": True,
        }

        baseline_inapp = Notification.objects.filter(user=self.staff_a).count()
        mail.outbox = []
        with mock.patch(
            "api.services.push_notification_service.send_shift_assignment_notification",
            return_value=True,
        ) as mock_push:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(self.BULK_CREATE_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["created"], 4)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.staff_a.email])
        mock_push.assert_not_called()
        self.assertEqual(
            Notification.objects.filter(user=self.staff_a).count(),
            baseline_inapp + 4,
        )

    def test_signal_tasks_deferred_to_on_commit(self):
        # Side-effects fired from the post_save signal must be wrapped in
        # transaction.on_commit so a rollback later in the atomic block doesn't
        # leave orphan Celery tasks pointing at IDs that no longer exist.
        from django.db import transaction as _txn
        from api.tasks import send_shift_assignment_email_task, schedule_shift_reminders

        start = (timezone.now() + timedelta(days=2)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )

        with mock.patch.object(send_shift_assignment_email_task, "delay") as mock_email_delay, \
             mock.patch.object(schedule_shift_reminders, "delay") as mock_reminders_delay, \
             mock.patch(
                 "api.services.push_notification_service.send_shift_assignment_notification",
                 return_value=True,
             ) as mock_push:
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                with _txn.atomic():
                    Shift.objects.create(
                        venue=self.venue,
                        staff_user=self.staff_a,
                        start_time=start,
                        end_time=start + timedelta(hours=4),
                        status="scheduled",
                        required_security_role="sg",
                        is_published=True,
                        hourly_rate=Decimal("15.00"),
                    )
                    # Inside the atomic block on_commit callbacks have NOT fired yet.
                    mock_email_delay.assert_not_called()
                    mock_reminders_delay.assert_not_called()
                    mock_push.assert_not_called()

            # On exit, the captureOnCommitCallbacks context executed the deferred
            # callbacks — now the side effects must have fired exactly once.
            # One callback covers the whole fan-out: the signal hands off to
            # notify_shift_assigned rather than deferring each channel itself.
            self.assertGreaterEqual(len(callbacks), 1)
            mock_email_delay.assert_called_once()
            mock_reminders_delay.assert_called_once()
            mock_push.assert_called_once()

    def test_signal_tasks_not_called_on_rollback(self):
        # If the surrounding atomic block raises, on_commit callbacks must be
        # discarded — no phantom emails or pushes for shifts that don't exist.
        from django.db import transaction as _txn
        from api.tasks import send_shift_assignment_email_task, schedule_shift_reminders

        start = (timezone.now() + timedelta(days=2)).replace(
            hour=20, minute=0, second=0, microsecond=0
        )

        with mock.patch.object(send_shift_assignment_email_task, "delay") as mock_email_delay, \
             mock.patch.object(schedule_shift_reminders, "delay") as mock_reminders_delay, \
             mock.patch(
                 "api.services.push_notification_service.send_shift_assignment_notification",
                 return_value=True,
             ) as mock_push:
            with self.captureOnCommitCallbacks(execute=True):
                try:
                    with _txn.atomic():
                        Shift.objects.create(
                            venue=self.venue,
                            staff_user=self.staff_a,
                            start_time=start,
                            end_time=start + timedelta(hours=4),
                            status="scheduled",
                            required_security_role="sg",
                            is_published=True,
                            hourly_rate=Decimal("15.00"),
                        )
                        raise RuntimeError("forced rollback")
                except RuntimeError:
                    pass

        mock_email_delay.assert_not_called()
        mock_reminders_delay.assert_not_called()
        mock_push.assert_not_called()
