"""
The App Store review account — what it is exempt from, and what it is not.

Apple rejected the staff app under Guideline 2.1 because the reviewer could not
sign in with the demo account. The reviewer is outside the UK, opens the app at
an unknown time, and more than one reviewer may mistype the password. So one
account, flagged `is_review_account`, skips the venue geofence, the
failed-login lockout and automatic no-show marking.

These tests pin the scope: the exemptions apply to that account and to no
other, the flag cannot be set through the API, and the seed confines itself to
the demo company.
"""
from datetime import timedelta
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import AnonRateThrottle

from api import app_review
from api.models import SecurityCompany, Shift, UserCompanyMembership, Venue, VenueTermsAcceptance
from api.tasks import detect_attendance_exceptions

User = get_user_model()

# A fixture, not a credential: these users exist only in the test database.
TEST_PASSWORD = 'testpass123'
WRONG_PASSWORD = 'testpass124'

# Cupertino, ~8,600 km from the London venues below.
FAR_LAT, FAR_LNG = 37.3349, -122.0090


def _venue(company, radius=100):
    return Venue.objects.create(
        company=company, name='Guard Venue', address='1 Test St', city='London',
        postal_code='SE1 1AA', country='UK', capacity=100, contact_name='C',
        contact_phone='07700900000', contact_email='v@venue.test',
        terms_and_conditions='Terms', latitude=Decimal('51.5076'),
        longitude=Decimal('-0.0994'), check_radius=radius,
    )


class ReviewExemptionScopeTests(TestCase):
    def setUp(self):
        self.company = SecurityCompany.objects.create(name='Real Co', registration_number='R1')
        self.venue = _venue(self.company)
        self.officer = self._user('officer', review=False)
        self.reviewer = self._user('reviewer', review=True)

    def _user(self, name, review):
        u = User.objects.create_user(username=name, email=f'{name}@test.test',
                                     password=TEST_PASSWORD, role='staff')
        u.is_review_account = review
        u.save()
        UserCompanyMembership.objects.create(user=u, company=self.company, role='staff')
        VenueTermsAcceptance.objects.create(staff_user=u, venue=self.venue, terms_version='1')
        return u

    def _live_shift(self, user):
        start = timezone.now() - timedelta(minutes=5)
        return Shift.objects.create(
            staff_user=user, venue=self.venue, start_time=start,
            end_time=start + timedelta(hours=8), required_security_role='ds',
            status='scheduled', is_published=True, terms_accepted=True,
        )

    # --- geofence -------------------------------------------------------

    def test_ordinary_officer_is_still_geofenced(self):
        shift = self._live_shift(self.officer)
        with self.assertRaisesMessage(ValueError, 'Location verification failed'):
            shift.check_in(FAR_LAT, FAR_LNG)

    def test_review_account_checks_in_and_out_from_anywhere(self):
        shift = self._live_shift(self.reviewer)
        shift.check_in(FAR_LAT, FAR_LNG)
        shift.refresh_from_db()
        self.assertEqual(shift.status, 'in_progress')
        # The location is still recorded, just not required to be at the venue.
        self.assertAlmostEqual(shift.check_in_location['latitude'], FAR_LAT, places=3)
        shift.check_out(FAR_LAT, FAR_LNG)
        self.assertIsNotNone(Shift.objects.get(pk=shift.pk).check_out_time)

    # --- lockout --------------------------------------------------------

    # The per-IP limits would answer 429 before the lockout is reached and
    # carry over between tests; the lockout is what is under test here.
    @override_settings(RATELIMIT_ENABLE=False)
    @mock.patch.object(AnonRateThrottle, 'allow_request', return_value=True)
    def _fail_login(self, username, times, _throttle=None):
        client = APIClient()
        codes = [client.post('/api/v1/login/', {'username': username, 'password': WRONG_PASSWORD},
                             format='json').status_code for _ in range(times)]
        return codes, client

    def test_ordinary_officer_still_locks_after_five_failures(self):
        codes, client = self._fail_login('officer', 5)
        self.assertEqual(codes[-1], 403)
        self.officer.refresh_from_db()
        self.assertIsNotNone(self.officer.account_locked_until)
        with override_settings(RATELIMIT_ENABLE=False), \
                mock.patch.object(AnonRateThrottle, 'allow_request', return_value=True):
            ok = client.post('/api/v1/login/', {'username': 'officer', 'password': TEST_PASSWORD},
                         format='json')
        self.assertEqual(ok.status_code, 403)

    def test_review_account_failures_are_401_and_never_lock(self):
        codes, client = self._fail_login('reviewer', 6)
        self.assertEqual(codes, [401] * 6)
        self.reviewer.refresh_from_db()
        self.assertIsNone(self.reviewer.account_locked_until)
        self.assertEqual(self.reviewer.failed_login_attempts, 0)
        with override_settings(RATELIMIT_ENABLE=False), \
                mock.patch.object(AnonRateThrottle, 'allow_request', return_value=True):
            ok = client.post('/api/v1/login/', {'username': 'reviewer', 'password': TEST_PASSWORD},
                         format='json')
        self.assertEqual(ok.status_code, 200)
        self.assertIn('access', ok.json())

    # --- no-show --------------------------------------------------------

    def test_only_the_review_account_is_spared_auto_no_show(self):
        start = timezone.now() - timedelta(hours=1)
        mk = lambda u: Shift.objects.create(
            staff_user=u, venue=self.venue, start_time=start, end_time=start + timedelta(hours=8),
            required_security_role='ds', status='scheduled', is_published=True,
        )
        officer_shift, reviewer_shift = mk(self.officer), mk(self.reviewer)
        detect_attendance_exceptions()
        self.assertEqual(Shift.objects.get(pk=officer_shift.pk).status, 'no_show')
        self.assertNotEqual(Shift.objects.get(pk=reviewer_shift.pk).status, 'no_show')

    # --- the flag is not writable through the API -----------------------

    def test_flag_cannot_be_self_assigned(self):
        client = APIClient()
        client.force_authenticate(self.officer)
        client.patch('/api/v1/profiles/me', {'is_review_account': True,
                                             'user': {'is_review_account': True}}, format='json')
        client.patch(f'/api/v1/users/{self.officer.pk}/', {'is_review_account': True}, format='json')
        self.officer.refresh_from_db()
        self.assertFalse(self.officer.is_review_account)


class SeedCommandTests(TestCase):
    def _seed(self, *args):
        out = StringIO()
        call_command('seed_app_review_account', *args, stdout=out)
        return out.getvalue()

    def test_seed_is_idempotent_and_prints_the_password_only_once(self):
        first = self._seed()
        self.assertIn('password (shown once', first)
        second = self._seed()
        self.assertIn('password: unchanged', second)
        self.assertNotIn('shown once', second)

        reviewer = User.objects.get(email=app_review.REVIEW_EMAIL)
        self.assertTrue(reviewer.is_review_account)
        self.assertEqual(reviewer.role, 'staff')
        self.assertFalse(reviewer.is_staff or reviewer.is_superuser)
        self.assertEqual(User.objects.filter(is_review_account=True).count(), 1)
        self.assertEqual(reviewer.shifts.filter(status='approved').count(), 10)
        self.assertTrue(reviewer.invoices.exists())
        # Seeded colleagues exist to fill the Team screen and cannot sign in.
        team = User.objects.filter(username__startswith='demo.')
        self.assertEqual(team.count(), len(app_review.TEAM))
        self.assertFalse(any(u.has_usable_password() for u in team))

    def test_generated_password_works_at_login(self):
        out = self._seed()
        password = out.split('shown once, not stored anywhere): ')[1].split()[0]
        with override_settings(RATELIMIT_ENABLE=False), \
                mock.patch.object(AnonRateThrottle, 'allow_request', return_value=True):
            resp = APIClient().post('/api/v1/login/', {'username': app_review.REVIEW_EMAIL,
                                                   'password': password}, format='json')
        self.assertEqual(resp.status_code, 200)

    def test_seed_touches_only_the_demo_company(self):
        other = SecurityCompany.objects.create(name='Real Co', registration_number='R2')
        venue = _venue(other)
        self._seed()
        demo = SecurityCompany.objects.get(slug=app_review.DEMO_COMPANY_SLUG)
        reviewer = User.objects.get(email=app_review.REVIEW_EMAIL)
        self.assertEqual(set(reviewer.company_memberships.values_list('company', flat=True)), {demo.pk})
        self.assertFalse(Shift.objects.filter(venue=venue).exists())
        self.assertFalse(Shift.objects.filter(staff_user=reviewer).exclude(venue__company=demo).exists())

    def test_refuses_to_convert_an_existing_account_without_adopt(self):
        from django.core.management.base import CommandError
        User.objects.create_user(username='someone', email=app_review.REVIEW_EMAIL, password=TEST_PASSWORD)
        with self.assertRaises(CommandError):
            self._seed()
        self.assertFalse(User.objects.get(email=app_review.REVIEW_EMAIL).is_review_account)

    def test_rerun_repairs_a_locked_or_deleted_account(self):
        self._seed()
        reviewer = User.objects.get(email=app_review.REVIEW_EMAIL)
        User.objects.filter(pk=reviewer.pk).update(
            is_active=False, account_locked_until=timezone.now() + timedelta(hours=1),
            deletion_scheduled_at=timezone.now(),
        )
        self._seed()
        reviewer.refresh_from_db()
        self.assertTrue(reviewer.is_active)
        self.assertIsNone(reviewer.account_locked_until)
        self.assertIsNone(reviewer.deletion_scheduled_at)


class LiveShiftTests(TestCase):
    def setUp(self):
        call_command('seed_app_review_account', stdout=StringIO())
        self.reviewer = User.objects.get(email=app_review.REVIEW_EMAIL)

    def _live(self):
        now = timezone.now()
        return self.reviewer.shifts.filter(
            status__in=['scheduled', 'in_progress'],
            start_time__lte=now + timedelta(minutes=15), end_time__gte=now + timedelta(hours=1),
        )

    def test_a_shift_is_open_for_check_in_now(self):
        self.assertTrue(self._live().exists())

    def test_after_early_check_out_the_refresh_opens_another(self):
        shift = self._live().get()
        VenueTermsAcceptance.objects.create(staff_user=self.reviewer, venue=shift.venue,
                                            terms_version=shift.venue.terms_version or '1')
        shift.check_in(FAR_LAT, FAR_LNG)
        shift.check_out(FAR_LAT, FAR_LNG)
        self.assertFalse(self._live().exists())
        app_review.refresh_live_shift()
        self.assertTrue(self._live().exists())
        # Repeated runs do not stack shifts.
        before = self.reviewer.shifts.count()
        app_review.refresh_live_shift()
        self.assertEqual(self.reviewer.shifts.count(), before)

    def test_refresh_ignores_ordinary_officers(self):
        company = SecurityCompany.objects.create(name='Real Co', registration_number='R3')
        officer = User.objects.create_user(username='o', email='o@t.test', password=TEST_PASSWORD)
        UserCompanyMembership.objects.create(user=officer, company=company, role='staff')
        app_review.refresh_live_shift()
        self.assertFalse(officer.shifts.exists())
