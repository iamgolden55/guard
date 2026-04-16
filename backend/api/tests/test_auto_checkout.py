"""
Tests for the auto-checkout Celery task and its underlying shift logic.

Covers the regression where shift #10 was stuck at status='active' with a
past end_time and check_in_time set, because can_auto_checkout() only
accepted status='in_progress'.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from api.models import SecurityCompany, Shift, Venue
from api.tasks import process_auto_checkouts

User = get_user_model()


class AutoCheckoutTaskTests(TestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name='Test Security',
            registration_number='TST001',
        )
        self.guard = User.objects.create_user(
            username='guard1',
            email='guard1@test.com',
            password='test123',
            role='staff',
        )
        self.venue = Venue.objects.create(
            company=self.company,
            name='Test Venue',
            address='1 Test St',
            city='Testville',
            postal_code='TE1 1ST',
            country='UK',
            capacity=100,
            latitude=51.5,
            longitude=-0.1,
            contact_name='Contact',
            contact_phone='+441234567890',
            contact_email='venue@test.com',
            terms_and_conditions='Test terms',
        )

    def _make_shift(self, *, status, check_in_time, end_offset_minutes):
        now = timezone.now()
        end_time = now + timedelta(minutes=end_offset_minutes)
        start_time = end_time - timedelta(hours=1)
        return Shift.objects.create(
            staff_user=self.guard,
            venue=self.venue,
            start_time=start_time,
            end_time=end_time,
            required_security_role='sg',
            status=status,
            check_in_time=check_in_time,
        )

    def test_closes_stuck_active_shift_after_grace_period(self):
        """The #10 regression: status='active' with check_in_time and past end_time."""
        checked_in_at = timezone.now() - timedelta(hours=2)
        shift = self._make_shift(
            status='active',
            check_in_time=checked_in_at,
            end_offset_minutes=-60,  # ended 1 hour ago, past 30-min grace period
        )

        processed = process_auto_checkouts()

        self.assertEqual(processed, 1)
        shift.refresh_from_db()
        self.assertTrue(shift.auto_checkout)
        self.assertIsNotNone(shift.check_out_time)
        self.assertEqual(shift.check_out_time, shift.end_time)
        self.assertIn(shift.status, ('pending_approval', 'approved'))

    def test_closes_stuck_in_progress_shift(self):
        """Normal path: status='in_progress' past end_time + grace."""
        shift = self._make_shift(
            status='in_progress',
            check_in_time=timezone.now() - timedelta(hours=2),
            end_offset_minutes=-60,
        )

        processed = process_auto_checkouts()

        self.assertEqual(processed, 1)
        shift.refresh_from_db()
        self.assertTrue(shift.auto_checkout)
        self.assertEqual(shift.check_out_time, shift.end_time)

    def test_skips_no_show_shift_without_checkin(self):
        """status='active' with no check_in_time is a no-show, not a stuck shift."""
        shift = self._make_shift(
            status='active',
            check_in_time=None,
            end_offset_minutes=-60,
        )

        processed = process_auto_checkouts()

        self.assertEqual(processed, 0)
        shift.refresh_from_db()
        self.assertFalse(shift.auto_checkout)
        self.assertIsNone(shift.check_out_time)

    def test_skips_shift_still_within_grace_period(self):
        """Shift ended 5 min ago — default grace is 30 min, so skip."""
        shift = self._make_shift(
            status='in_progress',
            check_in_time=timezone.now() - timedelta(hours=1),
            end_offset_minutes=-5,
        )

        processed = process_auto_checkouts()

        self.assertEqual(processed, 0)
        shift.refresh_from_db()
        self.assertFalse(shift.auto_checkout)
        self.assertIsNone(shift.check_out_time)
