"""
Tamper-evidence on the statutory logbooks — P2-4.

For a licensed-premises capacity logbook, tamper-evidence is the whole point:
it exists to show a licensing officer what the count was at each half-hour, and
that it was recorded then rather than reconstructed afterwards.

Three gaps let a client write whatever it liked. `perform_create` called
`serializer.save()` with no validation that `shift` belonged to the requester,
so `shift` accepted any primary key on the platform — cross-tenant record
injection. `timestamp` was client-set (`ShiftCheck.save` defaults to `now()`
only when it is blank), so a missed 30-minute slot could be back-filled after
the fact. And `venue_capacity` came from the client rather than the venue, so
`is_at_capacity` — the only field that matters — was whatever the client
asserted.

`CapacityLogbookSignoffViewSet.perform_create` already validated shift-group
membership correctly. This applies the same rule to the three check
endpoints, which share a base class and shared the same gap.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import (
    CapacityCheck, FireExitCheck, SecurityCompany, Shift, ToiletCheck,
    UserCompanyMembership, Venue,
)

User = get_user_model()


class StatutoryCheckIntegrityTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Logbook Co", registration_number="LOG001",
        )
        self.other_company = SecurityCompany.objects.create(
            name="Other Logbook Co", registration_number="LOG002",
        )
        self.staff = self._user("log_staff", "staff", self.company)
        self.colleague = self._user("log_colleague", "staff", self.company)
        self.other_staff = self._user("log_other", "staff", self.other_company)

        self.venue = self._venue(self.company, "Logbook Venue", capacity=200)
        self.other_venue = self._venue(
            self.other_company, "Other Venue", capacity=50,
        )
        self.shift = self._shift(self.venue, self.staff)
        self.other_shift = self._shift(self.other_venue, self.other_staff)

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _user(self, username, role, company):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def _venue(self, company, name, capacity):
        return Venue.objects.create(
            company=company, name=name, address="1 St", city="Bristol",
            postal_code="BS1 1AA", country="UK", capacity=capacity,
            contact_name="C", contact_phone="07700900000",
            contact_email=f"{name.lower().replace(' ', '')}@venue.test",
            terms_and_conditions="Terms", requires_capacity_monitoring=True,
        )

    def _shift(self, venue, staff):
        start = timezone.now() - timedelta(hours=2)
        shift = Shift.objects.create(
            venue=venue, staff_user=staff, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
        )
        shift.check_in_time = start
        shift.status = "in_progress"
        shift.save(update_fields=["check_in_time", "status"])
        return shift

    # ── cross-tenant injection ──────────────────────────────────────────────

    def test_a_check_cannot_be_filed_against_another_companys_shift(self):
        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.other_shift.id,
            "current_count": 10,
            "venue_capacity": 1000,
            "timestamp": timezone.now().isoformat(),
        }, format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST),
        )
        self.assertFalse(CapacityCheck.objects.filter(shift=self.other_shift).exists())

    def test_a_colleague_not_on_the_shift_cannot_file_against_it(self):
        self.client.force_authenticate(user=self.colleague)

        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.shift.id, "current_count": 10,
            "venue_capacity": 200, "timestamp": timezone.now().isoformat(),
        }, format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST),
        )

    # ── back-dating ─────────────────────────────────────────────────────────

    def test_the_timestamp_is_server_set_and_cannot_be_back_dated(self):
        """Back-filling a missed 30-minute slot is the forgery this prevents."""
        an_hour_ago = timezone.now() - timedelta(hours=1)
        before = timezone.now()

        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.shift.id,
            "current_count": 120,
            "timestamp": an_hour_ago.isoformat(),
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertGreaterEqual(check.timestamp, before)

    # ── asserted capacity ───────────────────────────────────────────────────

    def test_venue_capacity_is_read_from_the_venue_not_the_client(self):
        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.shift.id,
            "current_count": 250,
            "venue_capacity": 100000,
            "action_taken": "Held the queue at the door.",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertEqual(check.venue_capacity, 200)
        self.assertTrue(
            check.is_at_capacity,
            "250 in a 200-capacity venue is over capacity whatever the client says",
        )

    def test_asserting_a_huge_capacity_does_not_dodge_the_action_requirement(self):
        """An over-capacity record must carry what was done about it."""
        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.shift.id,
            "current_count": 250,
            "venue_capacity": 100000,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("action_taken", response.data)

    # ── the same rule on the sibling logbooks ───────────────────────────────

    def test_fire_exit_checks_are_held_to_the_same_rule(self):
        response = self.client.post("/api/v1/fire-exit-checks/", {
            "shift": self.other_shift.id, "exit_name": "Rear exit",
            "timestamp": timezone.now().isoformat(),
        }, format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST),
        )
        self.assertFalse(FireExitCheck.objects.filter(shift=self.other_shift).exists())

    def test_toilet_checks_are_held_to_the_same_rule(self):
        response = self.client.post("/api/v1/toilet-checks/", {
            "shift": self.other_shift.id, "location_name": "Ground floor",
            "condition": "clean", "timestamp": timezone.now().isoformat(),
        }, format="json")

        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST),
        )
        self.assertFalse(ToiletCheck.objects.filter(shift=self.other_shift).exists())

    def test_a_fire_exit_check_timestamp_is_also_server_set(self):
        before = timezone.now()

        response = self.client.post("/api/v1/fire-exit-checks/", {
            "shift": self.shift.id, "exit_name": "Rear exit",
            "timestamp": (timezone.now() - timedelta(hours=3)).isoformat(),
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        check = FireExitCheck.objects.get(id=response.data["id"])
        self.assertGreaterEqual(check.timestamp, before)

    # ── regression guards ───────────────────────────────────────────────────

    def test_the_assigned_officer_can_still_file_a_check(self):
        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.shift.id, "current_count": 120,
            "action_taken": "Monitoring",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertEqual(check.current_count, 120)
        self.assertEqual(check.performed_by, self.staff)
        self.assertFalse(check.is_at_capacity)

    def test_a_manager_can_file_against_a_shift_in_their_company(self):
        manager = self._user("log_manager", "manager", self.company)
        self.client.force_authenticate(user=manager)

        response = self.client.post("/api/v1/capacity-checks/", {
            "shift": self.shift.id, "current_count": 50,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
