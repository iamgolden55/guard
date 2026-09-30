"""An incident report is accepted with no "actions taken".

The staff app's incident form marks "Actions taken" as optional and sends an
empty string when it is left blank. The model required it, so the API answered
400 "This field may not be blank", the app's sync queue gave up on the report,
and the officer was left with a banner saying "1 item waiting to sync" for as
long as the app was open. Builds that can't take an over-the-air update send
the same payload, so the server has to accept it.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from api.models import IncidentReport, SecurityCompany, Shift, UserCompanyMembership, Venue

User = get_user_model()


class IncidentActionsTakenOptionalTests(APITestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name="Incident Co", registration_number="INC001")
        self.officer = User.objects.create_user(
            username="incident_officer", email="incident_officer@test.test",
            password="testpass123", role="staff",
        )
        UserCompanyMembership.objects.create(
            user=self.officer, company=self.company, is_active=True, role="staff",
        )
        self.venue = Venue.objects.create(
            company=self.company, name="Bull Dogs", address="1 St", city="Bristol",
            postal_code="BS1", country="UK", capacity=100, contact_name="C",
            contact_phone="07700900000", contact_email="bulldogs@venue.test",
            terms_and_conditions="T",
        )
        start = timezone.now() - timedelta(minutes=5)
        self.shift = Shift.objects.create(
            staff_user=self.officer, venue=self.venue, start_time=start,
            end_time=start + timedelta(hours=5, minutes=30), status="in_progress",
            is_published=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.officer)

    def _payload(self, **overrides):
        # What the app's sync queue sends (incidentService.submitIncident).
        payload = {
            "venue": self.venue.id,
            "shift": self.shift.id,
            "incident_time": timezone.now().isoformat(),
            "description": "Fight at the door\n\nTwo guests pushed past the queue.",
            "severity": "medium",
        }
        payload.update(overrides)
        return payload

    def test_blank_actions_taken_is_accepted(self):
        response = self.client.post("/api/v1/incidents/", self._payload(actions_taken=""), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(IncidentReport.objects.get().actions_taken, "")

    def test_missing_actions_taken_is_accepted(self):
        response = self.client.post("/api/v1/incidents/", self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(IncidentReport.objects.get().actions_taken, "")

    def test_actions_taken_is_kept_when_given(self):
        response = self.client.post(
            "/api/v1/incidents/", self._payload(actions_taken="Separated them, called the manager"),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(IncidentReport.objects.get().actions_taken, "Separated them, called the manager")

    def test_description_is_still_required(self):
        response = self.client.post("/api/v1/incidents/", self._payload(description=""), format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("description", response.data)
