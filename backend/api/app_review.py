"""The App Store review demo account and the data behind it.

Apple's reviewer signs in from outside the UK, at a time nobody chooses, and
needs every screen of the staff app to have something on it. Everything here is
confined to one company (`DEMO_COMPANY_SLUG`) that exists only for review: its
venue, its officers and their shifts are fiction, and nothing in this module
reads or writes another company's rows.

`seed_app_review_account` builds it; `refresh_live_shift` (Celery, every 15
minutes) keeps a shift the reviewer can check into right now.
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Max, Min
from django.utils import timezone

logger = logging.getLogger(__name__)

REVIEW_EMAIL = 'appreview@meadsecurity.co.uk'
REVIEW_USERNAME = 'appreview'
DEMO_COMPANY_SLUG = 'app-review-demo'
DEMO_COMPANY_NAME = 'Northgate Security (Demo)'
SHIFT_TAG = '[app-review]'
LIVE_SHIFT_TAG = '[app-review:live]'

# Wide enough that the app's own distance pre-check passes anywhere on Earth.
# Only this company's venue has it; the server-side exemption is the account
# flag, not this number.
DEMO_VENUE_RADIUS_M = 20_100_000

# Ofcom reserves 07700 900xxx and 020 7946 0xxx for drama; they ring nobody.
TEAM = [
    ('Priya', 'Shah', ['ds'], 'ds'),
    ('Daniel', 'Okafor', ['sg'], 'sg'),
    ('Hannah', 'Clarke', ['ds', 'cctv'], 'ds'),
    ('Marcus', 'Reid', ['ds'], 'ds'),
    ('Sofia', 'Novak', ['cctv'], 'cctv'),
]

# Letters and digits without the look-alikes 0/O and 1/l/I.
_PASSWORD_ALPHABET = ''.join(c for c in string.ascii_letters + string.digits if c not in '0O1lI')


def generate_password() -> str:
    """Four groups of five from an alphabet with no look-alike characters:
    ~115 bits, and typeable by someone reading it off App Store Connect."""
    return '-'.join(
        ''.join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(5))
        for _ in range(4)
    )


def _sia_number(n: int) -> str:
    # 16 digits like a real licence, in a block no real licence starts with.
    return f'0000{482177300000 + n:012d}'


def _floor_15(dt: datetime) -> datetime:
    return dt.replace(minute=dt.minute - dt.minute % 15, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

@transaction.atomic
def seed(password: str | None = None, reset_demo_data: bool = False,
         adopt_existing: bool = False) -> dict:
    """Create or repair the review account and its demo company.

    Idempotent. `password` is set only when given — a re-run never rotates the
    credential the reviewer already has. Returns a summary without secrets.
    """
    from api.models import User

    company = _ensure_company()
    venue = _ensure_venue(company)
    reviewer, created = _ensure_reviewer(company, password, adopt_existing)
    team = [_ensure_team_member(company, i, *m) for i, m in enumerate(TEAM, start=2)]

    if reset_demo_data:
        _delete_demo_history(company, [reviewer, *team])

    history_created = 0
    if not reviewer.shifts.filter(notes__startswith=SHIFT_TAG, status='approved').exists():
        history_created = _create_history(reviewer, venue)
        _create_invoices(reviewer)
    upcoming_created = _top_up_upcoming(reviewer, venue)
    live = ensure_live_shift(reviewer, venue)
    _ensure_leave_balance(reviewer)
    _ensure_notifications(reviewer, company)

    return {
        'created': created,
        'user_id': reviewer.pk,
        'company': company.name,
        'venue': venue.name,
        'team_members': len(team),
        'history_shifts_created': history_created,
        'upcoming_shifts_created': upcoming_created,
        'live_shift_id': live.pk if live else None,
        'invoices': reviewer.invoices.count(),
        'review_accounts_total': User.objects.filter(is_review_account=True).count(),
    }


def _ensure_company():
    from api.models import SecurityCompany

    company, _ = SecurityCompany.objects.get_or_create(
        slug=DEMO_COMPANY_SLUG,
        defaults=dict(
            name=DEMO_COMPANY_NAME,
            country_code='GB',
            city='London',
            postal_code='SE1 9PX',
            address_line_1='1 Riverside Walk',
            industry_type='mixed',
            company_size='small',
            # Leave is a professional-tier feature; the reviewer should see it.
            subscription_tier='professional',
            billing_email='billing@example.com',
            primary_contact_name='Demo Operations',
            primary_contact_email='ops@example.com',
            primary_contact_phone='+44 20 7946 0001',
            timezone='Europe/London',
            currency='GBP',
            # A non-null trial_end_date stops the pre_save signal from putting
            # the company on a 14-day trial that would then expire mid-review.
            is_trial=False,
            trial_end_date=timezone.now(),
        ),
    )
    return company


def _ensure_venue(company):
    from api.models import Venue

    venue, _ = Venue.objects.update_or_create(
        company=company,
        name='Riverside Exchange',
        defaults=dict(
            address='1 Riverside Walk',
            city='London',
            postal_code='SE1 9PX',
            country='United Kingdom',
            is_active=True,
            capacity=450,
            latitude=Decimal('51.507600000000000'),
            longitude=Decimal('-0.099400000000000'),
            check_radius=DEMO_VENUE_RADIUS_M,
            contact_name='Venue Operations',
            contact_phone='+44 20 7946 0002',
            contact_email='venue-ops@example.com',
            description=(
                'Riverside events venue and bar. Main entrance on Riverside Walk; '
                'staff entrance and radio collection at the rear loading bay.'
            ),
            terms_and_conditions=(
                'Report to the duty manager on arrival and collect a radio. '
                'Wear your SIA badge visibly at all times. Record every refusal '
                'and ejection in the incident log before the end of your shift.'
            ),
            terms_version='1.0',
            requires_fire_safety_checks=False,
            requires_capacity_monitoring=False,
            requires_toilet_checks=False,
        ),
    )
    return venue


def _ensure_profile(user, n: int, licence_type: str):
    from api.models import SIALicense, StaffProfile

    profile, _ = StaffProfile.objects.update_or_create(
        user=user,
        defaults=dict(
            phone_number=f'+44 7700 900{100 + n:03d}',
            date_of_birth=date(1988 + n % 7, 1 + n % 12, 10 + n),
            street=f'{10 + n} Canal Street',
            city='London',
            postal_code='E1 6AN',
            country='United Kingdom',
            is_approved=True,
            pay_frequency='weekly',
        ),
    )
    today = timezone.now().date()
    # Keyed on the profile too: a clash with a real licence number fails on
    # the unique constraint instead of moving that licence to a demo profile.
    SIALicense.objects.update_or_create(
        license_number=_sia_number(n),
        staff_profile=profile,
        defaults=dict(
            license_type=licence_type,
            level='qualified',
            issue_date=today - timedelta(days=400),
            expiry_date=today + timedelta(days=2 * 365),
            status='valid',
        ),
    )
    return profile


def _ensure_membership(user, company):
    from api.models import UserCompanyMembership

    UserCompanyMembership.objects.update_or_create(
        user=user,
        company=company,
        defaults=dict(role='staff', is_active=True, invitation_status='accepted'),
    )


def _ensure_reviewer(company, password, adopt_existing=False):
    from api.models import User

    user = User.objects.filter(email__iexact=REVIEW_EMAIL).first()
    created = user is None
    if created:
        user = User(username=REVIEW_USERNAME, email=REVIEW_EMAIL)
    elif not user.is_review_account and not adopt_existing:
        # An account with this address that this command didn't make. Flagging
        # it would strip its lockout and geofence, so it takes a deliberate
        # --adopt-existing to do that.
        raise ValueError(
            f'{REVIEW_EMAIL} already exists (user {user.pk}) and is not a review account. '
            'Re-run with --adopt-existing to convert it.'
        )

    user.first_name = 'Alex'
    user.last_name = 'Morgan'
    user.role = 'staff'
    user.security_roles = ['ds']
    user.is_active = True
    user.is_staff = False
    user.is_superuser = False
    user.is_review_account = True
    # Repair anything a previous review left behind: a lock, or a deletion
    # request from the reviewer testing account deletion.
    user.failed_login_attempts = 0
    user.account_locked_until = None
    user.last_failed_login = None
    user.deletion_scheduled_at = None
    if password:
        user.set_password(password)
        user.password_last_changed = timezone.now()
    elif created:
        raise ValueError('A new review account needs a password.')
    user.save()

    _ensure_membership(user, company)
    _ensure_profile(user, 1, 'ds')
    return user, created


def _ensure_team_member(company, n, first, last, roles, licence_type):
    from api.models import User

    username = f'demo.{first.lower()}.{last.lower()}'
    user = User.objects.filter(username=username).first()
    if user is None:
        user = User(username=username)
        # Nobody signs in as a colleague; they exist to fill the Team screen.
        user.set_unusable_password()
    user.email = f'{first.lower()}.{last.lower()}@example.com'
    user.first_name = first
    user.last_name = last
    user.role = 'staff'
    user.security_roles = roles
    user.is_active = True
    user.save()
    _ensure_membership(user, company)
    _ensure_profile(user, n, licence_type)
    return user


def _delete_demo_history(company, users):
    """Remove seeded shifts and the invoices built from them — only for the
    given demo users, only at the demo company's venues."""
    from api.models import Invoice, Shift

    user_ids = [u.pk for u in users]
    assert all(
        u.company_memberships.filter(company=company).exists() for u in users
    ), 'refusing to delete data for a user outside the demo company'
    invoices = Invoice.objects.filter(staff_user_id__in=user_ids)
    for inv in invoices:
        inv.items.all().delete()
    invoices.delete()
    Shift.objects.filter(
        staff_user_id__in=user_ids, venue__company=company, notes__startswith=SHIFT_TAG
    ).delete()


def _shift_kwargs(user, venue, start, hours, **extra):
    return dict(
        staff_user=user,
        venue=venue,
        start_time=start,
        end_time=start + timedelta(hours=hours),
        required_security_role='ds',
        hourly_rate=Decimal('15.50'),
        bill_rate=Decimal('21.00'),
        is_published=True,
        **extra,
    )


def _create_history(user, venue) -> int:
    """Ten worked, approved shifts over the last three weeks. bulk_create so no
    "you've been assigned" push fires for a shift that is already over."""
    from api.models import Shift

    now = timezone.now()
    loc = {'latitude': float(venue.latitude), 'longitude': float(venue.longitude)}
    shifts = []
    for days_ago in (2, 3, 5, 6, 9, 10, 12, 16, 17, 19):
        day = (now - timedelta(days=days_ago)).date()
        start = timezone.make_aware(datetime.combine(day, time(18, 0)))
        ci = start + timedelta(minutes=-4)
        co = start + timedelta(hours=8, minutes=6)
        shifts.append(Shift(
            **_shift_kwargs(user, venue, start, 8),
            status='approved',
            manager_approved=True,
            terms_accepted=True,
            check_in_time=ci,
            check_out_time=co,
            check_in_location=loc,
            check_out_location=loc,
            start_signature='[seeded:start]',
            end_signature='[seeded:end]',
            actual_hours_worked=Decimal('8.00'),
            payable_hours=Decimal('8.00'),
            notes=f'{SHIFT_TAG} worked shift',
        ))
    Shift.objects.bulk_create(shifts)
    return len(shifts)


def _create_invoices(user):
    """One invoice per past ISO week through the production path, the older
    ones marked paid."""
    from api.models import Invoice

    today = timezone.now().date()
    this_monday = today - timedelta(days=today.weekday())
    for weeks_back in (3, 2, 1, 0):
        start = this_monday - timedelta(weeks=weeks_back)
        end = start + timedelta(days=6)
        try:
            inv = Invoice.generate_for_staff_period(user, start, end, source='system')
        except ValueError:
            continue  # no approved shifts that week
        if weeks_back >= 2:
            # .update(): the paid-status signal path emails a payslip.
            Invoice.objects.filter(pk=inv.pk).update(
                status='paid', issued_date=end + timedelta(days=1),
                paid_date=end + timedelta(days=5),
            )


def _top_up_upcoming(user, venue, want: int = 4) -> int:
    from api.models import Shift

    now = timezone.now()
    horizon = now + timedelta(days=14)
    have = user.shifts.filter(
        notes__startswith=SHIFT_TAG, status='scheduled',
        start_time__gt=now + timedelta(days=1), start_time__lte=horizon,
    ).count()
    new = []
    for days_ahead in (2, 4, 6, 9, 11, 13):
        if have + len(new) >= want:
            break
        day = (now + timedelta(days=days_ahead)).date()
        start = timezone.make_aware(datetime.combine(day, time(19, 0)))
        if user.shifts.filter(start_time=start).exists():
            continue
        new.append(Shift(
            **_shift_kwargs(user, venue, start, 7),
            status='scheduled',
            notes=f'{SHIFT_TAG} upcoming shift',
        ))
    Shift.objects.bulk_create(new)
    return len(new)


def _ensure_leave_balance(user):
    try:
        from leave_management.models import LeaveBalance, LeaveType
    except ImportError:
        return
    annual = LeaveType.objects.filter(code='AL', is_active=True).first()
    if annual is None:
        return
    LeaveBalance.objects.get_or_create(
        staff_user=user, leave_type=annual, year=timezone.now().year,
        defaults=dict(opening_balance=Decimal('28.0'), used_balance=Decimal('3.0')),
    )


def _ensure_notifications(user, company):
    from api.models import Notification

    if user.notifications.exists():
        return
    Notification.objects.bulk_create([
        Notification(user=user, company=company, title='Welcome to Mead Security',
                     message='Your shifts, digital ID and earnings are all in the app.'),
        Notification(user=user, company=company, title='Shift published',
                     message='You have new shifts at Riverside Exchange next week.'),
        Notification(user=user, company=company, title='Payment sent',
                     message='Your invoice for two weeks ago has been paid.', is_read=True),
    ])


# ---------------------------------------------------------------------------
# Keeping a shift live
# ---------------------------------------------------------------------------

def ensure_live_shift(user, venue=None):
    """Make sure `user` has a shift they can check into, or are already on.

    The server only accepts a check-in from 15 minutes before start until
    shortly after the end, so a shift seeded on submission day is useless by
    the time the reviewer opens the app. One that has started (or starts
    within 15 minutes) and runs 8 hours is inside the window whenever this
    runs every 15 minutes.
    """
    from api.models import Shift

    now = timezone.now()
    current = user.shifts.filter(
        status__in=['scheduled', 'in_progress'],
        start_time__lte=now + timedelta(minutes=15),
        end_time__gte=now + timedelta(hours=1),
    ).order_by('-start_time').first()
    if current:
        return current

    venue = venue or _demo_venue_for(user)
    if venue is None:
        return None

    # One officer's shifts may not overlap (`shift_no_overlapping_assignment`),
    # so fit the new shift between whatever ended last and whatever is next.
    counted = user.shifts.exclude(status__in=['cancelled', 'rejected'])
    start = _floor_15(now)
    latest_end = counted.filter(start_time__lte=now, end_time__gt=start).aggregate(m=Max('end_time'))['m']
    if latest_end:
        start = latest_end
    if start > now + timedelta(minutes=15):
        return None
    end = start + timedelta(hours=8)
    next_start = counted.filter(start_time__gte=start).aggregate(m=Min('start_time'))['m']
    if next_start and next_start < end:
        end = next_start
    if end - start < timedelta(hours=1):
        return None  # the next scheduled shift is about to open instead

    shift = Shift(
        **_shift_kwargs(user, venue, start, 0),
        status='scheduled',
        notes=f'{SHIFT_TAG} {LIVE_SHIFT_TAG} available now',
    )
    shift.end_time = end
    try:
        with transaction.atomic():
            Shift.objects.bulk_create([shift])
    except IntegrityError:
        logger.warning('App review live shift for user %s overlapped another shift; skipped', user.pk)
        return None
    return shift


def _demo_venue_for(user):
    from api.models import Venue

    return Venue.objects.filter(
        company__slug=DEMO_COMPANY_SLUG,
        company__memberships__user=user,
        is_active=True,
    ).first()


def refresh_live_shift() -> dict:
    """Celery entry point. Touches review accounts in the demo company only."""
    from api.models import Shift, User

    users = User.objects.filter(
        is_review_account=True, is_active=True,
        company_memberships__company__slug=DEMO_COMPANY_SLUG,
    ).distinct()
    now = timezone.now()
    created = removed = 0
    for user in users:
        # A live shift the reviewer checked out of early keeps its eight-hour
        # slot, and the no-overlap constraint then blocks the next one until
        # it ends. Close the slot at the check-out.
        Shift.objects.filter(
            staff_user=user, venue__company__slug=DEMO_COMPANY_SLUG,
            notes__contains=LIVE_SHIFT_TAG, check_out_time__isnull=False,
            end_time__gt=F('check_out_time'), check_out_time__gt=F('start_time'),
        ).update(end_time=F('check_out_time'))
        # Live shifts the reviewer never used would otherwise pile up in the
        # past-shifts list, one every eight hours.
        removed += Shift.objects.filter(
            staff_user=user, venue__company__slug=DEMO_COMPANY_SLUG,
            notes__contains=LIVE_SHIFT_TAG, status='scheduled',
            check_in_time__isnull=True, end_time__lt=now,
        ).delete()[0]
        before = user.shifts.count()
        ensure_live_shift(user)
        venue = _demo_venue_for(user)
        if venue:
            _top_up_upcoming(user, venue)
        created += user.shifts.count() - before
    return {'review_accounts': users.count(), 'shifts_created': created, 'rows_removed': removed}
