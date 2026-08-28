"""
Overnight shifts — a shift that starts in the evening and ends after midnight.

Nothing in the suite covered this before: the bulk-create tests deliberately use
same-day times, so even the server-side recurrence rollover was untested, and
the only "coverage" was two standalone print scripts that re-implemented the
rollover rather than exercising it.

The bug that prompted these: the Attendance editor built a check-out timestamp
from a bare "HH:mm" stamped onto the shift's start day, so closing an
18:00 → 03:00 shift produced a check-out nine hours *before* the check-in and
was rejected outright. That left the shift unapprovable and its hours invisible
to payroll.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue

User = get_user_model()


class OvernightAttendanceTests(APITestCase):
    """An 18:00 → 03:00 shift, closed the next morning."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Overnight Co", registration_number="NIGHT001",
        )
        self.admin = User.objects.create_user(
            username="night_admin", email="admin@night.test",
            password="testpass123", role="admin",
            first_name="Ada", last_name="Admin",
        )
        self.staff = User.objects.create_user(
            username="night_staff", email="officer@night.test",
            password="testpass123", role="staff",
            first_name="Olu", last_name="Officer",
        )
        for user in (self.admin, self.staff):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True,
            )
        self.venue = Venue.objects.create(
            company=self.company, name="Night Venue",
            address="1 Night St", city="Bristol", postal_code="BS1 1AA",
            country="UK", capacity=200, contact_name="Venue Contact",
            contact_phone="07700900000", contact_email="venue@night.test",
            terms_and_conditions="Standard terms",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _overnight_shift(self, checked_in=True):
        """18:00 yesterday → 03:00 today, so 'now' sits after the end."""
        now = timezone.now()
        start = (now - timedelta(hours=12)).replace(minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=9)
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=end,
            status="scheduled", required_security_role="sg",
            is_published=True, hourly_rate=Decimal("15.00"),
        )
        if checked_in:
            shift.check_in_time = start
            shift.status = "in_progress"
            shift.save(update_fields=["check_in_time", "status"])
        return shift

    def test_check_out_on_the_following_day_is_accepted(self):
        """The reported failure: the save was rejected as end-before-start."""
        shift = self._overnight_shift()

        response = self.client.post(
            f"/api/v1/shifts/{shift.id}/record_attendance/",
            {
                "adjusted_check_in_time": shift.start_time.isoformat(),
                "adjusted_check_out_time": shift.end_time.isoformat(),
                "reason": "Officer did not check out — closed at scheduled end.",
                "manager_signature": "manager",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.check_out_time, shift.end_time)
        self.assertEqual(shift.actual_hours_worked, Decimal("9.00"))
        self.assertEqual(shift.status, "pending_approval")

    def test_hours_are_derived_server_side_not_taken_from_the_client(self):
        """
        The browser computed hours by subtracting clock times, which yields 0
        for 18:00 → 03:00. Trusting that would have silently under-paid the
        officer even once the timestamps were right.
        """
        shift = self._overnight_shift()

        response = self.client.post(
            f"/api/v1/shifts/{shift.id}/record_attendance/",
            {
                "adjusted_check_in_time": shift.start_time.isoformat(),
                "adjusted_check_out_time": shift.end_time.isoformat(),
                "adjusted_actual_hours": 0,
                "reason": "Closed at scheduled end.",
                "manager_signature": "manager",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.actual_hours_worked, Decimal("9.00"))

    def test_check_out_before_check_in_is_rejected_with_a_useful_message(self):
        """
        Still invalid — but the message should point at the actual cause rather
        than leaving an admin staring at a bare model assertion.
        """
        shift = self._overnight_shift()
        backwards = shift.start_time - timedelta(hours=2)

        response = self.client.post(
            f"/api/v1/shifts/{shift.id}/record_attendance/",
            {
                "adjusted_check_in_time": shift.start_time.isoformat(),
                "adjusted_check_out_time": backwards.isoformat(),
                "reason": "Typo.",
                "manager_signature": "manager",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("past midnight", response.data["detail"])
        shift.refresh_from_db()
        self.assertIsNone(shift.check_out_time)

    def test_same_day_shift_is_unaffected(self):
        """Regression guard: the ordinary 09:00–17:00 case must not change."""
        now = timezone.now()
        start = (now - timedelta(hours=8)).replace(minute=0, second=0, microsecond=0)
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=start + timedelta(hours=8),
            status="scheduled", required_security_role="sg",
            is_published=True, hourly_rate=Decimal("15.00"),
        )

        response = self.client.post(
            f"/api/v1/shifts/{shift.id}/record_attendance/",
            {
                "adjusted_check_in_time": shift.start_time.isoformat(),
                "adjusted_check_out_time": shift.end_time.isoformat(),
                "reason": "Recorded by manager.",
                "manager_signature": "manager",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        shift.refresh_from_db()
        self.assertEqual(shift.actual_hours_worked, Decimal("8.00"))


class OvernightAttendanceSerializerTests(APITestCase):
    """The decimal-hour projection the timeline ribbon and the editor read."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Ribbon Co", registration_number="NIGHT002",
        )
        self.staff = User.objects.create_user(
            username="ribbon_staff", email="ribbon@night.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=self.staff, company=self.company, is_active=True,
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Ribbon Venue",
            address="2 Night St", city="Bristol", postal_code="BS1 2AA",
            country="UK", capacity=100, contact_name="Venue Contact",
            contact_phone="07700900001", contact_email="ribbon@night.test",
            terms_and_conditions="Standard terms",
        )

    def _row(self, shift):
        from shifts.attendance_serializers import AttendanceShiftSerializer

        return AttendanceShiftSerializer(context={"now": timezone.now()}).to_representation(shift)

    def test_actual_end_past_midnight_is_projected_past_24(self):
        """
        sch_end already extends past 24 for an overnight shift. act_end did not,
        so a recorded 03:00 checkout came back as 3.0 against sch_end 27.0 and
        rendered in the wrong place on the ribbon.
        """
        start = timezone.localtime(timezone.now()).replace(
            hour=18, minute=0, second=0, microsecond=0,
        ) - timedelta(days=1)
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=start + timedelta(hours=9),
            status="pending_approval", required_security_role="sg",
            is_published=True,
        )
        shift.check_in_time = start
        shift.check_out_time = start + timedelta(hours=9)
        shift.save(update_fields=["check_in_time", "check_out_time"])

        row = self._row(shift)

        self.assertAlmostEqual(row["sch_start"], 18.0, places=2)
        self.assertAlmostEqual(row["sch_end"], 27.0, places=2)
        self.assertAlmostEqual(row["act_start"], 18.0, places=2)
        self.assertAlmostEqual(row["act_end"], 27.0, places=2)

    def test_row_carries_absolute_scheduled_timestamps(self):
        """Decimal hours have no date; the editor needs one to anchor to."""
        start = timezone.now().replace(microsecond=0) + timedelta(days=1)
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=start + timedelta(hours=9),
            status="scheduled", required_security_role="sg", is_published=True,
        )

        row = self._row(shift)

        self.assertEqual(row["sch_start_at"], shift.start_time.isoformat())
        self.assertEqual(row["sch_end_at"], shift.end_time.isoformat())

    def test_same_day_shift_hours_are_not_projected(self):
        """Regression guard for the ordinary case."""
        start = timezone.localtime(timezone.now()).replace(
            hour=9, minute=0, second=0, microsecond=0,
        )
        shift = Shift.objects.create(
            venue=self.venue, staff_user=self.staff,
            start_time=start, end_time=start + timedelta(hours=8),
            status="scheduled", required_security_role="sg", is_published=True,
        )
        shift.check_in_time = start
        shift.check_out_time = start + timedelta(hours=8)
        shift.save(update_fields=["check_in_time", "check_out_time"])

        row = self._row(shift)

        self.assertAlmostEqual(row["sch_end"], 17.0, places=2)
        self.assertAlmostEqual(row["act_end"], 17.0, places=2)


class OvernightBulkCreateTests(APITestCase):
    """
    The recurrence expander rolls end_time onto the next day when the end time
    of day is not after the start (shifts/serializers.py). Every existing bulk
    test uses same-day times, so that branch had never run.
    """

    BULK_CREATE_URL = "/api/v1/shifts/bulk_create/"

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Bulk Night Co", registration_number="NIGHT003",
        )
        self.admin = User.objects.create_user(
            username="bulk_night_admin", email="admin@bulknight.test",
            password="testpass123", role="admin",
        )
        self.staff = User.objects.create_user(
            username="bulk_night_staff", email="officer@bulknight.test",
            password="testpass123", role="staff",
        )
        for user in (self.admin, self.staff):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True,
            )
        self.venue = Venue.objects.create(
            company=self.company, name="Bulk Night Venue",
            address="3 Night St", city="Bristol", postal_code="BS1 3AA",
            country="UK", capacity=100, contact_name="Venue Contact",
            contact_phone="07700900002", contact_email="bulk@bulknight.test",
            terms_and_conditions="Standard terms",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def _future_monday(self):
        today = timezone.localdate()
        days_to_monday = (7 - today.weekday()) % 7 or 7
        return today + timedelta(days=days_to_monday)

    def test_recurrence_rolls_the_end_onto_the_next_day(self):
        start = self._future_monday()
        response = self.client.post(
            self.BULK_CREATE_URL,
            {
                "mode": "recurrence",
                "venue": self.venue.id,
                "start_date": start.isoformat(),
                "end_date": start.isoformat(),
                "days_of_week": [start.weekday()],
                "start_time": "18:00",
                "end_time": "03:00",
                "officers_needed": 1,
                "staff_users": [self.staff.id],
                "required_security_role": "sg",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["created"], 1)

        shift = Shift.objects.get(id=response.data["shifts"][0]["id"])
        self.assertGreater(shift.end_time, shift.start_time)
        self.assertEqual(
            (shift.end_time - shift.start_time), timedelta(hours=9),
        )
        local_start = timezone.localtime(shift.start_time)
        local_end = timezone.localtime(shift.end_time)
        self.assertEqual(local_end.date(), local_start.date() + timedelta(days=1))

    def test_same_day_recurrence_keeps_one_date(self):
        start = self._future_monday()
        response = self.client.post(
            self.BULK_CREATE_URL,
            {
                "mode": "recurrence",
                "venue": self.venue.id,
                "start_date": start.isoformat(),
                "end_date": start.isoformat(),
                "days_of_week": [start.weekday()],
                "start_time": "09:00",
                "end_time": "17:00",
                "officers_needed": 1,
                "staff_users": [self.staff.id],
                "required_security_role": "sg",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        shift = Shift.objects.get(id=response.data["shifts"][0]["id"])
        local_start = timezone.localtime(shift.start_time)
        local_end = timezone.localtime(shift.end_time)
        self.assertEqual(local_end.date(), local_start.date())
        self.assertEqual((shift.end_time - shift.start_time), timedelta(hours=8))
