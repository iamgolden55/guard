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


class CapacityInOutTests(APITestCase):
    """Door-clicker readings, and what they mean across a reset.

    Officers read a physical clicker every 30 minutes and type what it says.
    The readings are running totals for the night, so they normally only climb
    — until somebody decides the clicker has drifted, zeroes it, and carries
    on. The next reading is then a small number after a large one.

    That must never be refused. An officer on a door at 2am cannot be blocked
    from recording a count because the software finds it implausible; a
    logbook that rejects readings is worse than one that records an odd one.
    A drop is read as a reset: the occupancy at that moment is banked, and the
    fresh clicker counts onward from it. The people already inside are still
    inside.
    """

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Door Co", registration_number="DOOR01",
        )
        self.staff = User.objects.create_user(
            username="door_staff", email="door@test.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=self.staff, company=self.company, is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Door Venue", address="1 St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=200,
            contact_name="C", contact_phone="07700900000",
            contact_email="door@venue.test", terms_and_conditions="Terms",
            requires_capacity_monitoring=True,
        )
        start = timezone.now() - timedelta(hours=4)
        self.shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff, start_time=start,
            end_time=start + timedelta(hours=8), status="scheduled",
            required_security_role="sg", is_published=True,
        )
        self.shift.check_in_time = start
        self.shift.status = "in_progress"
        self.shift.save(update_fields=["check_in_time", "status"])

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _log(self, count_in, count_out, **extra):
        payload = {"shift": self.shift.id, "count_in": count_in, "count_out": count_out}
        payload.update(extra)
        return self.client.post("/api/v1/capacity-checks/", payload, format="json")

    def _occupancy(self, response):
        return CapacityCheck.objects.get(id=response.data["id"]).current_count

    # ── the ordinary night ──────────────────────────────────────────────────

    def test_occupancy_is_derived_from_the_two_readings(self):
        response = self._log(40, 0)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(self._occupancy(response), 40)

    def test_running_totals_recompute_occupancy_each_time(self):
        """Readings climb through the night; occupancy is in minus out."""
        self.assertEqual(self._occupancy(self._log(40, 0)), 40)
        self.assertEqual(self._occupancy(self._log(65, 5)), 60)
        self.assertEqual(self._occupancy(self._log(75, 23)), 52)

    def test_the_readings_are_stored_exactly_as_entered(self):
        """The logbook shows what the clicker said, not what we made of it."""
        response = self._log(75, 23)

        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertEqual(check.count_in, 75)
        self.assertEqual(check.count_out, 23)

    # ── the reset ───────────────────────────────────────────────────────────

    def test_a_reset_clicker_is_not_refused(self):
        """The whole point: a lower reading must still be recordable."""
        self._log(180, 30)

        response = self._log(50, 10)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_a_reset_banks_the_previous_occupancy_and_counts_onward(self):
        """180/30 then a reset to 50/10 is 190 inside, not 40."""
        self._log(180, 30)

        response = self._log(50, 10)

        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertTrue(check.counter_reset)
        self.assertEqual(check.baseline_occupancy, 150)
        self.assertEqual(check.current_count, 190)

    def test_counting_continues_normally_after_a_reset(self):
        self._log(180, 30)
        self._log(50, 10)

        response = self._log(70, 25)

        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertFalse(check.counter_reset)
        self.assertEqual(check.baseline_occupancy, 150)
        self.assertEqual(check.current_count, 195)

    def test_a_drop_on_either_counter_is_treated_as_a_reset(self):
        """Detection triggers on either reading falling, not just the in one.

        Note what this cannot resolve: if only the out counter was zeroed, the
        in counter is still a running total for the night, so adding it to the
        banked occupancy over-counts. A single-counter drop is more often a
        typo than a partial reset, and the system does not pretend to know
        which. It records the reading, flags the reset, and shows the officer
        the resulting occupancy before they submit — over-capacity then demands
        a written action, so an inflated figure surfaces rather than passing
        quietly.
        """
        self._log(100, 30)

        response = self._log(105, 2)

        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertTrue(check.counter_reset)
        self.assertEqual(check.baseline_occupancy, 70)

    def test_an_ordinary_reading_is_not_mistaken_for_a_reset(self):
        self._log(40, 0)

        response = self._log(65, 5)

        self.assertFalse(
            CapacityCheck.objects.get(id=response.data["id"]).counter_reset
        )

    # ── edges ───────────────────────────────────────────────────────────────

    def test_occupancy_never_goes_negative(self):
        """More out than in means bad data, not a negative headcount."""
        response = self._log(10, 40)

        self.assertEqual(self._occupancy(response), 0)

    def test_switching_over_mid_shift_does_not_lose_the_people_inside(self):
        """A check logged the old way, then the first in/out reading."""
        CapacityCheck.objects.create(
            shift=self.shift, current_count=120, venue_capacity=200,
            shift_group=f"shift_{self.shift.id}", performed_by=self.staff,
            timestamp=timezone.now() - timedelta(minutes=30),
        )

        response = self._log(20, 5)

        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertEqual(check.baseline_occupancy, 120)
        self.assertEqual(check.current_count, 135)

    def test_both_readings_are_required_together(self):
        response = self.client.post(
            "/api/v1/capacity-checks/",
            {"shift": self.shift.id, "count_in": 40}, format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_client_cannot_assert_the_occupancy_itself(self):
        response = self._log(40, 0, current_count=9999)

        self.assertEqual(self._occupancy(response), 40)

    # ── capacity still governs ──────────────────────────────────────────────

    def test_at_capacity_is_judged_on_the_derived_occupancy(self):
        response = self._log(250, 20, action_taken="Holding the queue.")

        check = CapacityCheck.objects.get(id=response.data["id"])
        self.assertEqual(check.current_count, 230)
        self.assertTrue(check.is_at_capacity)

    def test_going_over_capacity_still_demands_an_action(self):
        response = self._log(250, 20)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("action_taken", response.data)

    def test_a_reset_that_pushes_the_venue_over_capacity_demands_an_action(self):
        """The action requirement has to see the banked occupancy too."""
        self._log(190, 10, action_taken="Monitoring.")

        response = self._log(30, 5)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("action_taken", response.data)
