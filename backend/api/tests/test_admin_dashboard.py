"""Smoke tests for /api/v1/admin/dashboard/overview/."""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    SecurityCompany,
    Shift,
    TimeAdjustment,
    User,
    UserCompanyMembership,
    Venue,
)


class AdminDashboardOverviewTests(TestCase):
    """Smoke tests for /api/v1/admin/dashboard/overview/."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='dash_admin', email='dash_admin@example.com', password='pw123456'
        )
        self.admin.role = 'admin'
        self.admin.save()

        self.staff = User.objects.create_user(
            username='dash_staff', email='dash_staff@example.com', password='pw123456'
        )
        self.staff.role = 'staff'
        self.staff.save()

        self.url = reverse('admin-dashboard-overview')
        self.client = APIClient()

    def _login(self, user):
        self.client.force_authenticate(user=user)

    def test_dashboard_overview_returns_all_sections(self):
        """Admin can fetch overview; response has every documented section."""
        self._login(self.admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        for key in (
            'kpis', 'pending_approvals', 'venue_coverage',
            'sia_compliance', 'live_activity', 'staff_roster',
            'coverage_heatmap',
        ):
            self.assertIn(key, data, f'missing section: {key}')

        # KPI shape
        self.assertIn('officers_on_shift', data['kpis'])
        self.assertIn('value', data['kpis']['officers_on_shift'])

        # Heatmap is 7×24
        self.assertEqual(len(data['coverage_heatmap']), 7)
        for row in data['coverage_heatmap']:
            self.assertEqual(len(row), 24)

        # SIA compliance counters present
        for key in ('valid', 'expiring_soon', 'expired', 'expiring_list'):
            self.assertIn(key, data['sia_compliance'])

    def test_dashboard_overview_rejects_staff(self):
        """Staff role gets 403."""
        self._login(self.staff)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_dashboard_overview_requires_auth(self):
        """Anonymous gets 401 or 403 depending on auth backend ordering."""
        response = self.client.get(self.url)
        self.assertIn(response.status_code, (
            status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN,
        ))


class DashboardOnDutyTests(TestCase):
    """
    "On duty" used to be four different questions.

    The roster tab keyed off Shift.status == 'in_progress' and only listed
    role staff/manager; the KPI keyed off the live time window; venue coverage
    counted a whole week of assignments; live activity keyed off check-ins in
    the last 24h. On screen that meant an owner who worked a shift could be
    visible in the activity feed, counted in venue coverage, and still leave
    the roster's "On duty" tab reading 0.
    """

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name='On Duty Co', registration_number='ONDUTY01',
        )
        self.owner = User.objects.create_user(
            username='onduty_owner', email='owner@onduty.test',
            password='pw123456', role='admin',
            first_name='Dana', last_name='Owner',
        )
        self.officer = User.objects.create_user(
            username='onduty_officer', email='officer@onduty.test',
            password='pw123456', role='staff',
            first_name='Ola', last_name='Officer',
        )
        for user in (self.owner, self.officer):
            UserCompanyMembership.objects.create(
                user=user, company=self.company, is_active=True,
            )
        self.venue = Venue.objects.create(
            company=self.company, name='Left Handed Giant',
            address='1 Test St', city='Bristol', postal_code='BS1 1AA',
            country='UK', capacity=200, contact_name='Venue Contact',
            contact_phone='07700900000', contact_email='venue@onduty.test',
            terms_and_conditions='Standard terms',
        )
        self.idle_venue = Venue.objects.create(
            company=self.company, name='dBs Location House',
            address='2 Test St', city='Bristol', postal_code='BS1 2AA',
            country='UK', capacity=100, contact_name='Venue Contact',
            contact_phone='07700900001', contact_email='idle@onduty.test',
            terms_and_conditions='Standard terms',
        )
        self.url = reverse('admin-dashboard-overview')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def _live_shift(self, user, checked_in=True, started_hours_ago=1, **kwargs):
        now = timezone.now()
        shift = Shift.objects.create(
            venue=kwargs.pop('venue', self.venue),
            staff_user=user,
            start_time=now - timedelta(hours=started_hours_ago),
            end_time=now + timedelta(hours=4),
            status='scheduled',
            required_security_role='sg',
            is_published=True,
            **kwargs,
        )
        if checked_in:
            shift.check_in_time = now - timedelta(minutes=30)
            shift.status = 'in_progress'
            shift.save(update_fields=['check_in_time', 'status'])
        return shift

    def _roster_entry(self, data, user):
        return next(
            (r for r in data['staff_roster'] if r['id'] == user.id), None,
        )

    def test_admin_who_works_a_shift_shows_as_on_duty(self):
        """The reported bug: the owner checked in and the tab still read 0."""
        self._live_shift(self.owner)

        data = self.client.get(self.url).json()
        entry = self._roster_entry(data, self.owner)

        self.assertIsNotNone(entry, 'owner missing from roster entirely')
        self.assertEqual(entry['status'], 'on-shift')
        self.assertEqual(entry['venue'], self.venue.name)

    def test_back_office_admin_without_shifts_stays_off_the_roster(self):
        """Including admins is about people who work, not every admin."""
        User.objects.create_user(
            username='onduty_backoffice', email='back@onduty.test',
            password='pw123456', role='admin',
            first_name='Bea', last_name='Backoffice',
        )
        back_office = User.objects.get(username='onduty_backoffice')
        UserCompanyMembership.objects.create(
            user=back_office, company=self.company, is_active=True,
        )

        data = self.client.get(self.url).json()

        self.assertIsNone(self._roster_entry(data, back_office))

    def test_roster_on_duty_count_matches_the_kpi(self):
        """The two panels describe the same moment, so they must agree."""
        self._live_shift(self.owner)
        self._live_shift(self.officer)

        data = self.client.get(self.url).json()
        roster_on_duty = [
            r for r in data['staff_roster'] if r['status'] == 'on-shift'
        ]

        self.assertEqual(len(roster_on_duty), 2)
        self.assertEqual(data['kpis']['officers_on_shift']['value'], 2)

    def test_attended_shift_with_a_stale_status_still_reads_on_duty(self):
        """
        Keying the roster off status='in_progress' made it hostage to a flip
        that several write paths drop: saving with update_fields discards
        Shift.save()'s in-memory status change, so a recorded check-in could
        leave the status at 'scheduled'. Deriving on-duty from the shift window
        instead means a stale status can't hide a present officer.
        """
        shift = self._live_shift(self.officer)
        # Reproduce the dropped flip without going through save().
        Shift.objects.filter(id=shift.id).update(status='scheduled')

        data = self.client.get(self.url).json()

        self.assertEqual(self._roster_entry(data, self.officer)['status'], 'on-shift')

    def test_time_adjustment_persists_the_status_flip(self):
        """
        The TimeAdjustment sync saved with update_fields covering only the
        attendance columns, so Shift.save()'s status change was computed and
        then thrown away — leaving an attended shift stuck at 'scheduled'.
        """
        shift = self._live_shift(self.officer, checked_in=False, started_hours_ago=2)
        original_check_in = timezone.now() - timedelta(hours=2)
        shift.check_in_time = original_check_in
        shift.actual_hours_worked = Decimal('2.00')
        shift.save(update_fields=['check_in_time', 'actual_hours_worked'])
        Shift.objects.filter(id=shift.id).update(status='scheduled')
        shift.refresh_from_db()

        TimeAdjustment.objects.create(
            shift=shift,
            adjusted_by=self.owner,
            original_check_in_time=original_check_in,
            original_actual_hours=Decimal('2.00'),
            adjusted_check_in_time=timezone.now() - timedelta(minutes=30),
            adjusted_actual_hours=Decimal('0.50'),
            manager_signature='data:image/png;base64,AAAA',
            reason='Corrected check-in time',
        )

        shift.refresh_from_db()
        self.assertEqual(shift.status, 'in_progress')

    def test_no_show_past_the_grace_period_reads_late(self):
        """
        The late bucket required status='scheduled', but Shift.save() promotes
        that to 'active' once the shift starts — so it could never match.
        """
        self._live_shift(self.officer, checked_in=False, started_hours_ago=2)

        data = self.client.get(self.url).json()

        self.assertEqual(self._roster_entry(data, self.officer)['status'], 'late')

    def test_venue_coverage_counts_officers_on_duty_now(self):
        """
        Coverage counted every shift row in the Mon-Sun week and called the
        total "officers deployed" — so finished and not-yet-started shifts
        propped up the number, and two rows for one officer counted twice.
        """
        self._live_shift(self.officer)
        # Same officer, second live row at the same venue: one officer deployed.
        self._live_shift(self.officer, checked_in=False, started_hours_ago=0)
        # A shift that finished earlier today must not prop the number up.
        finished = timezone.now() - timedelta(hours=8)
        Shift.objects.create(
            venue=self.venue, staff_user=self.owner,
            start_time=finished, end_time=finished + timedelta(hours=2),
            status='completed', required_security_role='sg', is_published=True,
        )

        data = self.client.get(self.url).json()
        row = next(v for v in data['venue_coverage'] if v['name'] == self.venue.name)

        self.assertEqual(row['staffed'], 1)
        self.assertEqual(row['required'], 2)
        self.assertEqual(row['coverage'], 50)

    def test_venue_with_nothing_scheduled_reports_no_coverage(self):
        """0/0 used to render as 100% — a reassuring lie about an idle venue."""
        data = self.client.get(self.url).json()
        row = next(
            v for v in data['venue_coverage'] if v['name'] == self.idle_venue.name
        )

        self.assertEqual(row['required'], 0)
        self.assertIsNone(row['coverage'])
