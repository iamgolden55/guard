"""
Regression tests for when an officer is told about a shift.

The rule: an officer hears about a shift exactly once, when it is published.
Creating a draft must stay silent — the scheduler creates drafts, and staff
can't even see them (ShiftViewSet.get_queryset filters is_published=True), so
emailing at create time told officers about work they couldn't look up.

Before the fix, ShiftViewSet.perform_create emailed on every create regardless
of is_published, while the publish endpoint sent no email at all.
"""
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue

User = get_user_model()


class ShiftAssignmentNotificationTests(APITestCase):
    """Covers the create / publish / edit notification boundaries."""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name="Notify Test Co",
            registration_number="NOTIFY001",
        )
        self.admin = User.objects.create_user(
            username="notify_admin",
            email="admin@notify.test",
            password="testpass123",
            role="admin",
            first_name="Ada",
            last_name="Admin",
        )
        self.staff = User.objects.create_user(
            username="notify_staff",
            email="officer@notify.test",
            password="testpass123",
            role="staff",
            first_name="Olu",
            last_name="Officer",
        )
        for user in (self.admin, self.staff):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True,
            )
        self.venue = Venue.objects.create(
            company=self.company,
            name="Notify Venue",
            address="1 Notify St",
            city="London",
            postal_code="SW1A 1AA",
            country="UK",
            capacity=100,
            contact_name="Venue Contact",
            contact_phone="07700900000",
            contact_email="venue@notify.test",
            terms_and_conditions="Standard terms",
        )

        # Run Celery tasks inline so queued emails land in mail.outbox.
        from core.celery_app import app as celery_app
        self._prev_eager = celery_app.conf.task_always_eager
        celery_app.conf.task_always_eager = True
        self.addCleanup(
            setattr, celery_app.conf, 'task_always_eager', self._prev_eager
        )

        # Push delivery talks to Expo/FCM; stub it out and assert on it instead.
        push_patcher = patch(
            'api.services.shift_notifications.push_notification_service'
        )
        self.mock_push = push_patcher.start()
        self.addCleanup(push_patcher.stop)

        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        mail.outbox = []

    # -- helpers ---------------------------------------------------------

    def _payload(self, **overrides):
        start = timezone.now() + timedelta(days=3)
        payload = {
            "venue": self.venue.id,
            "staff_user": self.staff.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=8)).isoformat(),
            "required_security_role": "sg",
            "status": "scheduled",
            "is_published": False,
        }
        payload.update(overrides)
        return payload

    def _make_shift(self, **overrides):
        start = timezone.now() + timedelta(days=3)
        fields = {
            "staff_user": self.staff,
            "venue": self.venue,
            "start_time": start,
            "end_time": start + timedelta(hours=8),
            "status": "scheduled",
            "required_security_role": "sg",
            "is_published": False,
        }
        fields.update(overrides)
        shift = Shift.objects.create(**fields)
        # Creating a shift that is already published is itself a real
        # assignment and fires the signal. That's arrange, not act — reset so
        # each test only sees what its own request produced.
        mail.outbox = []
        self.mock_push.reset_mock()
        return shift

    def _assignment_emails(self):
        return [m for m in mail.outbox if 'New Shift Assigned' in m.subject]

    # -- create ----------------------------------------------------------

    def test_creating_a_draft_shift_emails_nobody(self):
        """The bug: a draft shift emailed its officer the moment it was saved."""
        response = self.client.post("/api/v1/shifts/", self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(Shift.objects.get(id=response.data['id']).is_published)
        self.assertEqual(self._assignment_emails(), [])
        self.mock_push.send_shift_assignment_notification.assert_not_called()

    def test_creating_a_published_shift_emails_exactly_once(self):
        """Guards the old double-send: sync from the view *and* via the signal."""
        # The signal defers the fan-out to on_commit so a rollback can't queue
        # Celery tasks against a shift id that never lands.
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/shifts/", self._payload(is_published=True), format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        emails = self._assignment_emails()
        self.assertEqual(len(emails), 1, [m.subject for m in emails])
        self.assertEqual(emails[0].to, [self.staff.email])

    def test_multi_staff_create_emails_nobody(self):
        """create_multi_staff builds unpublished rows, so it must stay silent."""
        start = timezone.now() + timedelta(days=4)
        response = self.client.post(
            "/api/v1/shifts/create_multi_staff/",
            {
                "venue": self.venue.id,
                "staff_users": [self.staff.id],
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(hours=6)).isoformat(),
                "required_security_role": "sg",
                "status": "scheduled",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(self._assignment_emails(), [])

    # -- publish ---------------------------------------------------------

    def test_publishing_a_draft_emails_the_officer(self):
        """The other half of the bug: publishing used to send no email at all."""
        shift = self._make_shift()

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/shifts/publish/", {"shift_ids": [shift.id]}, format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['published'], 1)
        shift.refresh_from_db()
        self.assertTrue(shift.is_published)

        emails = self._assignment_emails()
        self.assertEqual(len(emails), 1, [m.subject for m in emails])
        self.assertEqual(emails[0].to, [self.staff.email])
        self.mock_push.send_shift_assignment_notification.assert_called_once()

    def test_publishing_a_past_shift_notifies_nobody(self):
        """Publishing after the start time is admin cleanup, not an assignment."""
        shift = self._make_shift(
            start_time=timezone.now() - timedelta(days=2),
            end_time=timezone.now() - timedelta(days=2) + timedelta(hours=8),
        )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/shifts/publish/", {"shift_ids": [shift.id]}, format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['published'], 1)
        self.assertEqual(response.data['notifications_sent'], 0)
        self.assertEqual(self._assignment_emails(), [])
        self.mock_push.send_shift_assignment_notification.assert_not_called()

    def test_republishing_an_already_published_shift_is_a_no_op(self):
        """The endpoint filters is_published=False, so nobody is emailed twice."""
        shift = self._make_shift(is_published=True)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                "/api/v1/shifts/publish/", {"shift_ids": [shift.id]}, format="json",
            )

        self.assertEqual(response.data['published'], 0)
        self.assertEqual(self._assignment_emails(), [])

    # -- edit ------------------------------------------------------------

    def test_rate_edit_on_a_published_shift_emails_nobody(self):
        """Correcting a pay rate is not a reassignment."""
        shift = self._make_shift(is_published=True)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/v1/shifts/{shift.id}/", {"hourly_rate": "15.50"}, format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(self._assignment_emails(), [])

    def test_patch_without_is_published_keeps_the_shift_published(self):
        """The frontend no longer sends is_published on updates; it must stick."""
        shift = self._make_shift(is_published=True)

        response = self.client.patch(
            f"/api/v1/shifts/{shift.id}/", {"notes": "Bring hi-vis"}, format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        shift.refresh_from_db()
        self.assertTrue(shift.is_published)

    def test_publishing_via_patch_notifies_the_officer(self):
        """
        is_published is a writable serializer field, so a draft can go live
        over PATCH as well as through /publish/. That path used to notify
        nobody: perform_update sent nothing and the post_save signal bails
        because staff_user didn't change — the shift appeared in the officer's
        app without anyone telling them.
        """
        shift = self._make_shift(is_published=False)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/v1/shifts/{shift.id}/", {"is_published": True}, format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        shift.refresh_from_db()
        self.assertTrue(shift.is_published)
        emails = self._assignment_emails()
        self.assertEqual(len(emails), 1, [m.subject for m in emails])
        self.assertEqual(emails[0].to, [self.staff.email])
        self.mock_push.send_shift_assignment_notification.assert_called_once()

    def test_patch_on_an_already_published_shift_does_not_renotify(self):
        """Only False -> True counts. Re-saving a live shift must stay quiet."""
        shift = self._make_shift(is_published=True)

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f"/api/v1/shifts/{shift.id}/", {"is_published": True}, format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(self._assignment_emails(), [])
        self.mock_push.send_shift_assignment_notification.assert_not_called()
