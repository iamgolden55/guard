"""
Capacity-check logbook tests.

Covers the API surface introduced for the digital capacity-check feature:

- POST /api/v1/capacity-checks/ — over-capacity validation requires action_taken,
  triggers a manager Notification on is_at_capacity.
- POST /api/v1/capacity-logbooks/ — signature path and override path; one row
  per shift_group; totals snapshotted at signoff.
- GET  /api/v1/capacity-checks/?shift_group=… — multi-staff continuation:
  any staff in the group sees the others' checks.
- api.tasks.flag_missed_capacity_checks — creates CapacityCheckSlotMiss rows
  for elapsed windows with no checks logged.
- Multi-tenant isolation: a user from Company A cannot read Company B's
  checks, misses, or logbooks via these endpoints.

Geocoding is mocked at the Venue.update_coordinates level so Venue.save()
doesn't make external HTTP calls during tests.
"""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    User,
    SecurityCompany,
    UserCompanyMembership,
    Venue,
    Shift,
    CapacityCheck,
    CapacityCheckSlotMiss,
    CapacityLogbookSignoff,
    Notification,
)
from api.tasks import flag_missed_capacity_checks


def _make_company(name, slug=None):
    return SecurityCompany.objects.create(
        name=name,
        registration_number=f"REG-{slug or name}",
        country_code="GB",
        city="London",
        postal_code="SW1A 1AA",
    )


def _make_venue(company, name="Test Venue", capacity=200, requires_monitoring=True):
    venue = Venue.objects.create(
        company=company,
        name=name,
        address="1 Test St",
        city="London",
        postal_code="SW1A 1AA",
        country="GB",
        capacity=capacity,
        latitude=51.5,
        longitude=-0.12,
        requires_capacity_monitoring=requires_monitoring,
        contact_name="Contact",
        contact_phone="0",
        contact_email="c@test.com",
        terms_and_conditions="t",
    )
    return venue


def _make_user(username, role="staff"):
    u = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="pw123456",
        role=role,
    )
    return u


def _make_membership(user, company, role="staff"):
    return UserCompanyMembership.objects.create(
        user=user, company=company, role=role, is_active=True
    )


def _make_active_shift(*, staff, venue, shift_group, started_minutes_ago=120):
    """Create an in-progress shift starting `started_minutes_ago` minutes ago."""
    now = timezone.now()
    start = now - timedelta(minutes=started_minutes_ago)
    end = start + timedelta(hours=8)
    return Shift.objects.create(
        staff_user=staff,
        venue=venue,
        start_time=start,
        end_time=end,
        check_in_time=start,
        required_security_role="security",
        status="in_progress",
        shift_group=shift_group,
        is_published=True,  # the ShiftViewSet filters drafts out for staff
    )


@patch.object(Venue, "update_coordinates", return_value=True)
class OverCapacityValidationTests(TestCase):
    """POST /capacity-checks/ requires action_taken when at/over capacity."""

    def setUp(self):
        self.company = _make_company("OC Co", "oc")
        self.venue = _make_venue(self.company, capacity=100)
        self.staff = _make_user("oc_staff")
        _make_membership(self.staff, self.company)
        self.manager = _make_user("oc_manager", role="manager")
        _make_membership(self.manager, self.company, role="manager")
        self.shift = _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="oc-grp-1"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _payload(self, count, action_taken=None):
        return {
            "shift": self.shift.id,
            "current_count": count,
            "venue_capacity": self.venue.capacity,
            "is_at_capacity": count >= self.venue.capacity,
            "timestamp": timezone.now().isoformat(),
            **({"action_taken": action_taken} if action_taken else {}),
        }

    def test_at_capacity_without_action_rejected(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-checks/", self._payload(self.venue.capacity), format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("action_taken", resp.json())

    def test_over_capacity_without_action_rejected(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-checks/",
            self._payload(self.venue.capacity + 50),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_under_capacity_does_not_require_action(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-checks/", self._payload(self.venue.capacity - 1), format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        check = CapacityCheck.objects.get(pk=resp.json()["id"])
        self.assertFalse(check.is_at_capacity)

    def test_at_capacity_with_action_accepted_and_notifies_manager(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-checks/",
            self._payload(self.venue.capacity, action_taken="Stopped entry"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        check = CapacityCheck.objects.get(pk=resp.json()["id"])
        self.assertTrue(check.is_at_capacity)

        # Manager got a high-priority compliance Notification.
        manager_notifs = Notification.objects.filter(
            user=self.manager, notification_type="compliance_alert"
        )
        self.assertEqual(manager_notifs.count(), 1)
        self.assertEqual(manager_notifs.first().priority, "high")


@patch.object(Venue, "update_coordinates", return_value=True)
class MultiStaffContinuationTests(TestCase):
    """Any staff in the shift_group sees the others' checks via ?shift_group=…"""

    def setUp(self):
        self.company = _make_company("MS Co", "ms")
        self.venue = _make_venue(self.company, capacity=300)

        self.alice = _make_user("ms_alice")
        self.bob = _make_user("ms_bob")
        _make_membership(self.alice, self.company)
        _make_membership(self.bob, self.company)

        # Two shifts, same group, same venue, overlapping time.
        self.shift_a = _make_active_shift(
            staff=self.alice, venue=self.venue, shift_group="ms-grp-1"
        )
        self.shift_b = _make_active_shift(
            staff=self.bob, venue=self.venue, shift_group="ms-grp-1"
        )

    def test_bob_sees_alices_check_via_shift_group(self, _mock):
        # Alice logs a check on shift_a.
        alice_client = APIClient()
        alice_client.force_authenticate(user=self.alice)
        resp = alice_client.post(
            "/api/v1/capacity-checks/",
            {
                "shift": self.shift_a.id,
                "current_count": 100,
                "venue_capacity": self.venue.capacity,
                "is_at_capacity": False,
                "timestamp": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Bob queries the group — should see Alice's check.
        bob_client = APIClient()
        bob_client.force_authenticate(user=self.bob)
        resp = bob_client.get("/api/v1/capacity-checks/?shift_group=ms-grp-1")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json().get("results", resp.json())
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["current_count"], 100)
        self.assertEqual(results[0]["performed_by"], self.alice.id)


@patch.object(Venue, "update_coordinates", return_value=True)
class MissedSlotDetectionTests(TestCase):
    """flag_missed_capacity_checks creates SlotMiss rows for elapsed windows."""

    def setUp(self):
        self.company = _make_company("MS2 Co", "ms2")
        # 30-minute interval, capacity_check_interval_minutes default
        self.venue = _make_venue(self.company)
        self.staff = _make_user("ms2_staff")
        _make_membership(self.staff, self.company)
        self.manager = _make_user("ms2_manager", role="manager")
        _make_membership(self.manager, self.company, role="manager")

    def test_no_misses_for_freshly_started_shift(self, _mock):
        # Shift started 5 minutes ago; no slots have elapsed.
        Shift.objects.create(
            staff_user=self.staff,
            venue=self.venue,
            start_time=timezone.now() - timedelta(minutes=5),
            end_time=timezone.now() + timedelta(hours=8),
            check_in_time=timezone.now() - timedelta(minutes=5),
            required_security_role="security",
            status="in_progress",
            shift_group="ms2-fresh",
        )
        result = flag_missed_capacity_checks()
        self.assertEqual(result["new_misses"], 0)

    def test_creates_miss_for_elapsed_window(self, _mock):
        # Shift started 70 min ago. The +30→+60 window has fully elapsed
        # (now=+70 ≥ +60+5 grace), so the +30 slot should be flagged. The
        # +60→+90 window hasn't (would need now ≥ +95).
        shift = _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="ms2-stale", started_minutes_ago=70
        )
        result = flag_missed_capacity_checks()

        self.assertEqual(result["new_misses"], 1)
        miss = CapacityCheckSlotMiss.objects.filter(shift_group="ms2-stale").first()
        self.assertIsNotNone(miss)
        self.assertFalse(miss.acknowledged)
        # Manager notified.
        self.assertTrue(
            Notification.objects.filter(
                user=self.manager, notification_type="compliance_alert"
            ).exists()
        )

    def test_no_miss_when_check_logged_in_window(self, _mock):
        shift = _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="ms2-covered", started_minutes_ago=70
        )
        # A check landed at +35 min (inside the +30 to +60 window).
        CapacityCheck.objects.create(
            shift=shift,
            timestamp=shift.start_time + timedelta(minutes=35),
            current_count=50,
            venue_capacity=self.venue.capacity,
            shift_group="ms2-covered",
            performed_by=self.staff,
        )
        result = flag_missed_capacity_checks()
        self.assertFalse(
            CapacityCheckSlotMiss.objects.filter(shift_group="ms2-covered").exists(),
            f"Expected no miss when check covers the window. result={result}",
        )

    def test_idempotent_across_runs(self, _mock):
        _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="ms2-idemp", started_minutes_ago=70
        )
        flag_missed_capacity_checks()
        first_count = CapacityCheckSlotMiss.objects.filter(shift_group="ms2-idemp").count()
        flag_missed_capacity_checks()
        second_count = CapacityCheckSlotMiss.objects.filter(shift_group="ms2-idemp").count()
        self.assertEqual(first_count, second_count)


@patch.object(Venue, "update_coordinates", return_value=True)
class LogbookSignoffTests(TestCase):
    """POST /capacity-logbooks/ — signature and override paths."""

    def setUp(self):
        self.company = _make_company("LB Co", "lb")
        self.venue = _make_venue(self.company)
        self.staff = _make_user("lb_staff")
        _make_membership(self.staff, self.company)
        self.outsider = _make_user("lb_outsider")
        # Outsider has no membership in this company at all.

        self.shift = _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="lb-grp-1", started_minutes_ago=70
        )
        # Pre-existing data so totals snapshot test something real.
        CapacityCheck.objects.create(
            shift=self.shift,
            timestamp=timezone.now() - timedelta(minutes=20),
            current_count=80,
            venue_capacity=self.venue.capacity,
            shift_group="lb-grp-1",
            performed_by=self.staff,
        )
        CapacityCheckSlotMiss.objects.create(
            shift_group="lb-grp-1",
            venue=self.venue,
            expected_at=timezone.now() - timedelta(minutes=40),
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def test_signature_path_creates_signoff_with_totals(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-logbooks/",
            {
                "shift_group": "lb-grp-1",
                "venue": self.venue.id,
                "closed_by_name": "Jane Smith",
                "closed_by_role": "Duty Manager",
                "signature": "data:image/png;base64,AAAA",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        signoff = CapacityLogbookSignoff.objects.get(shift_group="lb-grp-1")
        self.assertEqual(signoff.closed_by_name, "Jane Smith")
        self.assertEqual(signoff.closed_by_staff, self.staff)
        self.assertEqual(signoff.total_checks, 1)
        self.assertEqual(signoff.total_missed, 1)
        self.assertIsNotNone(signoff.signed_at)
        self.assertEqual(signoff.override_reason, "")

    def test_override_path_creates_signoff_without_signature(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-logbooks/",
            {
                "shift_group": "lb-grp-1",
                "venue": self.venue.id,
                "override_reason": "Duty manager left at 02:30, no replacement.",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.content)
        signoff = CapacityLogbookSignoff.objects.get(shift_group="lb-grp-1")
        self.assertEqual(signoff.signature, "")
        self.assertEqual(signoff.closed_by_name, "")
        self.assertIn("Duty manager", signoff.override_reason)

    def test_neither_signature_nor_override_rejected(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-logbooks/",
            {"shift_group": "lb-grp-1", "venue": self.venue.id},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_signature_without_name_rejected(self, _mock):
        resp = self.client.post(
            "/api/v1/capacity-logbooks/",
            {
                "shift_group": "lb-grp-1",
                "venue": self.venue.id,
                "signature": "data:image/png;base64,AAAA",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_one_signoff_per_shift_group(self, _mock):
        first = self.client.post(
            "/api/v1/capacity-logbooks/",
            {
                "shift_group": "lb-grp-1",
                "venue": self.venue.id,
                "override_reason": "First signoff",
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            "/api/v1/capacity-logbooks/",
            {
                "shift_group": "lb-grp-1",
                "venue": self.venue.id,
                "override_reason": "Second signoff (should fail)",
            },
            format="json",
        )
        # 400 from unique-shift_group constraint.
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_outsider_cannot_sign_off(self, _mock):
        outsider_client = APIClient()
        outsider_client.force_authenticate(user=self.outsider)
        resp = outsider_client.post(
            "/api/v1/capacity-logbooks/",
            {
                "shift_group": "lb-grp-1",
                "venue": self.venue.id,
                "override_reason": "Should not work",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


@patch.object(Venue, "update_coordinates", return_value=True)
class MultiTenantIsolationTests(TestCase):
    """Users only see their own company's capacity data through these endpoints."""

    def setUp(self):
        # Company A
        self.company_a = _make_company("A Co", "a")
        self.venue_a = _make_venue(self.company_a, name="Venue A")
        self.staff_a = _make_user("iso_staff_a")
        _make_membership(self.staff_a, self.company_a)
        self.shift_a = _make_active_shift(
            staff=self.staff_a, venue=self.venue_a, shift_group="iso-a-grp"
        )
        CapacityCheck.objects.create(
            shift=self.shift_a,
            timestamp=timezone.now() - timedelta(minutes=20),
            current_count=10,
            venue_capacity=self.venue_a.capacity,
            shift_group="iso-a-grp",
            performed_by=self.staff_a,
        )
        CapacityCheckSlotMiss.objects.create(
            shift_group="iso-a-grp",
            venue=self.venue_a,
            expected_at=timezone.now() - timedelta(minutes=40),
        )
        CapacityLogbookSignoff.objects.create(
            shift_group="iso-a-grp",
            venue=self.venue_a,
            override_reason="A's signoff",
        )

        # Company B
        self.company_b = _make_company("B Co", "b")
        self.venue_b = _make_venue(self.company_b, name="Venue B")
        self.staff_b = _make_user("iso_staff_b")
        _make_membership(self.staff_b, self.company_b)

    def test_company_b_cannot_list_company_a_checks(self, _mock):
        client = APIClient()
        client.force_authenticate(user=self.staff_b)
        resp = client.get("/api/v1/capacity-checks/?shift_group=iso-a-grp")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json().get("results", resp.json())
        self.assertEqual(len(results), 0, "Company B leaked Company A's checks")

    def test_company_b_cannot_list_company_a_misses(self, _mock):
        client = APIClient()
        client.force_authenticate(user=self.staff_b)
        resp = client.get("/api/v1/capacity-check-misses/?shift_group=iso-a-grp")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json().get("results", resp.json())
        self.assertEqual(len(results), 0)

    def test_company_b_cannot_list_company_a_signoffs(self, _mock):
        client = APIClient()
        client.force_authenticate(user=self.staff_b)
        resp = client.get("/api/v1/capacity-logbooks/?shift_group=iso-a-grp")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json().get("results", resp.json())
        self.assertEqual(len(results), 0)


@patch.object(Venue, "update_coordinates", return_value=True)
class CheckoutEnforcementTests(TestCase):
    """The shifts check_out endpoint must reject monitored shifts that haven't been signed off."""

    def setUp(self):
        self.company = _make_company("CO Co", "co")
        self.venue = _make_venue(self.company)  # requires_capacity_monitoring=True
        self.staff = _make_user("co_staff")
        _make_membership(self.staff, self.company)
        self.shift = _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="co-grp", started_minutes_ago=120
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def test_checkout_rejected_without_signoff(self, _mock):
        resp = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/check_out/",
            {"latitude": 51.5, "longitude": -0.12, "signature": "data:,"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        body = resp.json()
        self.assertEqual(body.get("code"), "logbook_signoff_required")

    def test_checkout_proceeds_after_signoff(self, _mock):
        CapacityLogbookSignoff.objects.create(
            shift_group="co-grp",
            venue=self.venue,
            override_reason="Testing — admin not on site",
        )
        resp = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/check_out/",
            {"latitude": 51.5, "longitude": -0.12, "signature": "data:,"},
            format="json",
        )
        # We don't assert 200 (location verification + downstream model logic
        # may push us to 400 for unrelated reasons in this test rig); the
        # important assertion is "no longer the signoff_required code".
        body = resp.json() if resp.content else {}
        self.assertNotEqual(
            body.get("code"), "logbook_signoff_required",
            f"Expected signoff guard to clear; got {resp.status_code} {body}",
        )

    def test_unmonitored_venue_skips_signoff_guard(self, _mock):
        # Flip the flag off and try again — guard should not fire.
        self.venue.requires_capacity_monitoring = False
        self.venue.save(update_fields=["requires_capacity_monitoring"])
        resp = self.client.post(
            f"/api/v1/shifts/{self.shift.id}/check_out/",
            {"latitude": 51.5, "longitude": -0.12, "signature": "data:,"},
            format="json",
        )
        body = resp.json() if resp.content else {}
        self.assertNotEqual(body.get("code"), "logbook_signoff_required")


@patch.object(Venue, "update_coordinates", return_value=True)
class AutoCheckoutSignoffTests(TestCase):
    """process_auto_checkouts must synthesize an auto_closed signoff for monitored shifts."""

    def setUp(self):
        from api.models import SystemSettings
        # Make sure auto-checkout is enabled and that perform_auto_checkout
        # finds a sensible config; we mock the lower-level methods so the
        # sweep proceeds without depending on the full lifecycle wiring.
        SystemSettings.objects.update_or_create(
            id=1, defaults={"auto_checkout_enabled": True}
        )
        self.company = _make_company("AC Co", "ac")
        self.venue = _make_venue(self.company)
        self.staff = _make_user("ac_staff")
        _make_membership(self.staff, self.company)
        self.shift = _make_active_shift(
            staff=self.staff, venue=self.venue,
            shift_group="ac-grp", started_minutes_ago=600,
        )

    def test_auto_checkout_creates_override_signoff(self, _mock):
        from api.tasks import process_auto_checkouts

        with patch("api.models.Shift.can_auto_checkout", return_value=True), \
             patch("api.models.Shift.perform_auto_checkout", return_value=True):
            process_auto_checkouts()

        signoff = CapacityLogbookSignoff.objects.filter(shift_group="ac-grp").first()
        self.assertIsNotNone(signoff, "Auto-checkout should have created a signoff")
        self.assertTrue(signoff.auto_closed)
        self.assertIn("Auto-closed", signoff.override_reason)
        self.assertEqual(signoff.signature, "")

    def test_auto_checkout_does_not_double_create(self, _mock):
        """Re-running the sweep shouldn't create a second signoff."""
        from api.tasks import process_auto_checkouts

        # Pre-existing manual signoff.
        CapacityLogbookSignoff.objects.create(
            shift_group="ac-grp",
            venue=self.venue,
            override_reason="Manual override before auto-sweep",
        )

        with patch("api.models.Shift.can_auto_checkout", return_value=True), \
             patch("api.models.Shift.perform_auto_checkout", return_value=True):
            process_auto_checkouts()

        signoffs = CapacityLogbookSignoff.objects.filter(shift_group="ac-grp")
        self.assertEqual(signoffs.count(), 1)
        # The original (non-auto) signoff should still be the one.
        self.assertFalse(signoffs.first().auto_closed)


@patch.object(Venue, "update_coordinates", return_value=True)
class ActiveShiftsEndpointTests(TestCase):
    """/capacity-logbooks/active/ returns enriched in-progress monitored shifts."""

    def setUp(self):
        self.company = _make_company("AS Co", "as")
        self.venue = _make_venue(self.company)
        # An unmonitored venue in the same company so we verify the filter.
        self.unmonitored = _make_venue(self.company, name="No Monitor", requires_monitoring=False)
        self.staff = _make_user("as_staff")
        _make_membership(self.staff, self.company)

        # Active monitored shift with one check.
        self.active_shift = _make_active_shift(
            staff=self.staff, venue=self.venue, shift_group="as-active",
            started_minutes_ago=70,
        )
        CapacityCheck.objects.create(
            shift=self.active_shift,
            timestamp=timezone.now() - timedelta(minutes=20),
            current_count=120,
            venue_capacity=self.venue.capacity,
            shift_group="as-active",
            performed_by=self.staff,
        )

        # Active *unmonitored* shift — should not appear.
        _make_active_shift(
            staff=self.staff, venue=self.unmonitored, shift_group="as-noflag",
            started_minutes_ago=60,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def test_returns_only_monitored_active_shifts(self, _mock):
        resp = self.client.get("/api/v1/capacity-logbooks/active/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.json()
        self.assertEqual(len(results), 1)
        row = results[0]
        self.assertEqual(row["shift_group"], "as-active")
        self.assertEqual(row["venue_name"], "Test Venue")
        self.assertEqual(row["total_checks"], 1)
        self.assertIsNotNone(row["last_check"])
        self.assertEqual(row["last_check"]["current_count"], 120)
        self.assertIsNotNone(row["next_due_at"])

    def test_other_company_active_shifts_hidden(self, _mock):
        other_company = _make_company("Other Co", "other")
        other_venue = _make_venue(other_company)
        other_staff = _make_user("other_staff")
        _make_membership(other_staff, other_company)
        _make_active_shift(
            staff=other_staff, venue=other_venue, shift_group="other-grp",
            started_minutes_ago=30,
        )

        # Our staff still sees only their own company's shift.
        resp = self.client.get("/api/v1/capacity-logbooks/active/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        groups = {r["shift_group"] for r in resp.json()}
        self.assertIn("as-active", groups)
        self.assertNotIn("other-grp", groups)
