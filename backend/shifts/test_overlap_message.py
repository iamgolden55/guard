"""The refusal a manager gets when a shift overlaps one the officer already has.

The message was built from UTC (`TIME_ZONE = 'UTC'`), so in British Summer Time
an 18:00-01:00 shift read "17:00 - 00:00" (Sentry REACT-NATIVE-Q: "already has a
shift during this time: 2026-09-25 17:00 - 00:00 at Small Bar"). The staff app
shows this text to the manager, so it has to be in the time they scheduled.
"""
import zoneinfo
from datetime import datetime

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue

User = get_user_model()
LONDON = zoneinfo.ZoneInfo("Europe/London")


def london(*args):
    return datetime(*args, tzinfo=LONDON)


class OverlapMessageTests(APITestCase):
    def setUp(self):
        # The model default, which every company that never changed it has.
        self.company = SecurityCompany.objects.create(
            name="Overlap Co", registration_number="OVL001", timezone="UTC",
        )
        self.manager = self._member("overlap_manager", "manager")
        self.officer = self._member("overlap_officer", "staff")
        self.venue = self._venue("Small Bar")
        self.other_venue = self._venue("Big Hall")
        # 18:00-01:00 on a July evening in London: 17:00-00:00 UTC.
        self.existing = Shift.objects.create(
            staff_user=self.officer, venue=self.venue, manager_user=self.manager,
            start_time=london(2027, 7, 15, 18, 0), end_time=london(2027, 7, 16, 1, 0),
            status="scheduled",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.manager)

    def _member(self, username, role):
        user = User.objects.create_user(
            username=username, email=f"{username}@test.test",
            password="testpass123", role=role,
        )
        UserCompanyMembership.objects.create(
            user=user, company=self.company, is_active=True,
            role="staff" if role == "staff" else "manager",
        )
        return user

    def _venue(self, name):
        return Venue.objects.create(
            company=self.company, name=name, address="1 Test St",
            city="Bristol", postal_code="BS1 1AA", country="UK", capacity=100,
            contact_name="C", contact_phone="07700900000",
            contact_email=f"{name.replace(' ', '').lower()}@venue.test",
            terms_and_conditions="Terms",
        )

    def test_the_message_uses_uk_time_when_the_company_left_the_utc_default(self):
        from api.utils.shift_validators import overlap_message

        self.assertEqual(
            overlap_message(self.existing),
            "This staff member already has a shift during this time: "
            "2027-07-15 18:00 - 01:00 at Small Bar",
        )

    def test_a_company_timezone_that_was_set_is_respected(self):
        from api.utils.shift_validators import overlap_message

        self.company.timezone = "America/New_York"
        self.company.save(update_fields=["timezone"])
        self.existing.refresh_from_db()
        self.assertIn("13:00 - 20:00", overlap_message(self.existing))

    def test_creating_an_overlapping_shift_is_refused_with_uk_times(self):
        response = self.client.post(
            "/api/v1/shifts/",
            {
                "staff_user": self.officer.id,
                "venue": self.other_venue.id,
                "start_time": london(2027, 7, 15, 20, 0).isoformat(),
                "end_time": london(2027, 7, 16, 2, 0).isoformat(),
                "status": "scheduled",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.assertIn("2027-07-15 18:00 - 01:00 at Small Bar", str(response.data))
        self.assertEqual(Shift.objects.filter(staff_user=self.officer).count(), 1)
