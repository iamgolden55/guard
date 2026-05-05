"""Backfill realistic historical shift data for Mead Security.

Wipes all existing Mead shifts/invoices/payroll runs (with --clear), rebalances
StaffProfile.pay_frequency to a 60/40 weekly/monthly split, then seeds shifts
across the requested date range with a controlled mix of edge cases. Approved
shifts are rolled up into per-staff Invoice rows via the production
Invoice.generate_for_staff_period() path, then grouped under PayrollRun rows
for both weekly and monthly cycles.
"""
from __future__ import annotations

import json
import random
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from api.models import (
    BankDetails,
    Invoice,
    InvoiceItem,
    PayrollRun,
    SecurityCompany,
    Shift,
    StaffProfile,
    UserCompanyMembership,
    Venue,
)

User = get_user_model()

CASE_MIX = [
    ('approved', 80),
    ('no_show', 5),
    ('did_not_check_in', 4),
    ('auto_checkout', 4),
    ('pending_approval', 4),
    ('rejected', 2),
    ('special_event', 1),
]

SHIFT_PATTERNS = [
    ('day', time(8, 0), 8),
    ('day', time(9, 0), 8),
    ('evening', time(14, 0), 8),
    ('night', time(18, 0), 10),
    ('night', time(22, 0), 8),
]

SECURITY_ROLES = ['door_supervisor', 'security_officer', 'cctv_operator']

DEFAULT_HOURLY_RATES = [Decimal('14.00'), Decimal('15.50'), Decimal('16.00'), Decimal('17.50')]
SPECIAL_EVENT_RATE = Decimal('20.00')


class Command(BaseCommand):
    help = 'Seed Mead Security with realistic historical shift data for payroll/invoice testing.'

    def add_arguments(self, parser):
        parser.add_argument('--start', required=True, help='Start date YYYY-MM-DD')
        parser.add_argument('--end', required=True, help='End date YYYY-MM-DD (inclusive)')
        parser.add_argument('--clear', action='store_true',
                            help='Wipe all Mead shifts/invoices/payroll runs before seeding.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Print what would happen without writing.')
        parser.add_argument('--seed', type=int, default=42,
                            help='Random seed for reproducibility (default: 42).')
        parser.add_argument('--shifts-per-day', type=int, default=4,
                            help='Average venue-shifts to schedule per day (default: 4).')

    def handle(self, *args, **opts):
        random.seed(opts['seed'])

        try:
            start_date = datetime.strptime(opts['start'], '%Y-%m-%d').date()
            end_date = datetime.strptime(opts['end'], '%Y-%m-%d').date()
        except ValueError as e:
            raise CommandError(f'Invalid date format: {e}')

        if end_date < start_date:
            raise CommandError('--end must be >= --start')

        dry = opts['dry_run']
        do_clear = opts['clear']

        try:
            company = SecurityCompany.objects.get(name__iexact='Mead Security')
        except SecurityCompany.DoesNotExist:
            raise CommandError("SecurityCompany 'Mead Security' not found.")

        self.stdout.write(self.style.MIGRATE_HEADING(
            f"\n=== Simulating Mead Security history: {start_date} -> {end_date} "
            f"({'DRY-RUN' if dry else 'LIVE'}{', CLEAR' if do_clear else ''}) ==="
        ))

        admin_user = User.objects.filter(
            company_memberships__company=company, company_memberships__role='owner'
        ).first() or User.objects.filter(is_superuser=True).first()

        # Phase 0: Inspect
        memberships = list(
            UserCompanyMembership.objects
            .filter(company=company, is_active=True)
            .select_related('user', 'user__profile')
        )
        venues = list(Venue.objects.filter(company=company))
        if not venues:
            raise CommandError('Mead Security has no venues to schedule shifts at.')

        self._phase_0_inspect(company, memberships, venues, start_date, end_date)

        if dry:
            self.stdout.write(self.style.SUCCESS('\nDry run complete. No writes.'))
            return

        with transaction.atomic():
            backup: dict[str, Any] = {'cleared_at': timezone.now().isoformat()}

            if do_clear:
                self._phase_1_clear(company, memberships, backup)
                self._phase_1b_rebalance_pay_frequency(memberships, backup)

            shift_stats = self._phase_2_generate_shifts(
                company, memberships, venues, start_date, end_date, opts['shifts_per_day']
            )

            invoice_stats = self._phase_3_generate_invoices(
                memberships, start_date, end_date, admin_user
            )

            payroll_stats = self._phase_4_generate_payroll_runs(
                company, memberships, start_date, end_date
            )

            backup_path = self._write_backup(backup) if do_clear else None

        self._phase_5_report(shift_stats, invoice_stats, payroll_stats, backup_path, memberships)

    # ---- Phase 0 ----

    def _phase_0_inspect(self, company, memberships, venues, start_date, end_date):
        self.stdout.write(self.style.HTTP_INFO('\n[Phase 0] Pre-flight inspection'))
        eligible = [m for m in memberships if m.user.profile and m.user.profile.is_eligible_for_shifts()]
        weekly = sum(1 for m in memberships if m.user.profile and m.user.profile.pay_frequency == 'weekly')
        monthly = sum(1 for m in memberships if m.user.profile and m.user.profile.pay_frequency == 'monthly')
        no_bank = sum(1 for m in memberships if not _has_bank(m.user))

        self.stdout.write(f'  Active staff: {len(memberships)} (eligible for shifts: {len(eligible)})')
        self.stdout.write(f'  Pay frequency: {weekly} weekly / {monthly} monthly')
        self.stdout.write(f'  Missing bank details: {no_bank}/{len(memberships)}')
        self.stdout.write(f'  Venues: {len(venues)}')

        existing_shifts = Shift.objects.filter(venue__company=company).count()
        existing_invoices = Invoice.objects.filter(
            staff_user__company_memberships__company=company
        ).distinct().count()
        existing_runs = PayrollRun.objects.filter(company=company).count()
        self.stdout.write(
            f'  Existing data: {existing_shifts} shifts, {existing_invoices} invoices, '
            f'{existing_runs} payroll runs'
        )

    # ---- Phase 1: Clear ----

    def _phase_1_clear(self, company, memberships, backup):
        self.stdout.write(self.style.HTTP_INFO('\n[Phase 1] Wiping existing Mead data'))
        staff_user_ids = [m.user_id for m in memberships]

        # Order matters: invoice items -> invoices -> payroll runs -> shifts
        invoice_items_deleted = InvoiceItem.objects.filter(
            shift__venue__company=company
        ).delete()
        invoices_deleted = Invoice.objects.filter(
            staff_user_id__in=staff_user_ids
        ).delete()
        runs_deleted = PayrollRun.objects.filter(company=company).delete()
        shifts_deleted = Shift.objects.filter(venue__company=company).delete()

        backup['deleted_counts'] = {
            'invoice_items': invoice_items_deleted[0],
            'invoices': invoices_deleted[0],
            'payroll_runs': runs_deleted[0],
            'shifts': shifts_deleted[0],
        }
        self.stdout.write(
            f'  Deleted: {shifts_deleted[0]} shifts, {invoices_deleted[0]} invoices, '
            f'{invoice_items_deleted[0]} invoice items, {runs_deleted[0]} payroll runs'
        )

    def _phase_1b_rebalance_pay_frequency(self, memberships, backup):
        self.stdout.write(self.style.HTTP_INFO('\n[Phase 1b] Rebalancing pay_frequency to 60/40 weekly/monthly'))
        profiles = [m.user.profile for m in memberships if m.user.profile]
        profiles.sort(key=lambda p: p.user_id)

        backup['pay_frequency_before'] = {p.user_id: p.pay_frequency for p in profiles}

        weekly_target = round(len(profiles) * 0.6)
        for i, profile in enumerate(profiles):
            new_freq = 'weekly' if i < weekly_target else 'monthly'
            if profile.pay_frequency != new_freq:
                profile.pay_frequency = new_freq
                profile.save(update_fields=['pay_frequency'])

        weekly_count = sum(1 for p in profiles if p.pay_frequency == 'weekly')
        monthly_count = sum(1 for p in profiles if p.pay_frequency == 'monthly')
        self.stdout.write(f'  After rebalance: {weekly_count} weekly / {monthly_count} monthly')

    # ---- Phase 2: Generate shifts ----

    def _phase_2_generate_shifts(self, company, memberships, venues, start_date, end_date, per_day):
        self.stdout.write(self.style.HTTP_INFO('\n[Phase 2] Generating shifts'))
        eligible_staff = [
            m.user for m in memberships
            if m.user.profile and m.user.profile.is_eligible_for_shifts()
        ]
        if not eligible_staff:
            raise CommandError('No eligible staff (need is_approved=True + valid SIA license).')

        self.stdout.write(f'  Pool: {len(eligible_staff)} eligible staff x {len(venues)} venues')

        shifts_to_create: list[Shift] = []
        case_counts: dict[str, int] = defaultdict(int)
        case_pool = _build_case_pool()

        cur = start_date
        while cur <= end_date:
            assigned_today: set[int] = set()
            day_venues = random.sample(venues, k=min(per_day, len(venues)))

            for venue in day_venues:
                staff_pool = [s for s in eligible_staff if s.id not in assigned_today]
                if not staff_pool:
                    break
                staff = random.choice(staff_pool)
                assigned_today.add(staff.id)

                pattern_kind, start_t, hours = random.choice(SHIFT_PATTERNS)
                start_dt = timezone.make_aware(datetime.combine(cur, start_t))
                end_dt = start_dt + timedelta(hours=hours)

                case = case_pool[(len(shifts_to_create)) % len(case_pool)]
                case_counts[case] += 1

                shift = self._build_shift(staff, venue, start_dt, end_dt, hours, case)
                shifts_to_create.append(shift)

            cur += timedelta(days=1)

        # Shuffle case_pool effect by re-seeding deterministically per run
        random.shuffle(shifts_to_create)

        Shift.objects.bulk_create(shifts_to_create, batch_size=200)

        total = sum(case_counts.values())
        self.stdout.write(f'  Created {total} shifts')
        for case, n in sorted(case_counts.items(), key=lambda kv: -kv[1]):
            self.stdout.write(f'    {case:<22} {n:>4}  ({n*100/total:.1f}%)')

        return {'total': total, 'by_case': dict(case_counts)}

    def _build_shift(self, staff, venue, start_dt, end_dt, hours, case):
        rate = random.choice(DEFAULT_HOURLY_RATES)
        loc = {'latitude': float(venue.latitude), 'longitude': float(venue.longitude)} if venue.latitude else None

        common = dict(
            staff_user=staff,
            venue=venue,
            start_time=start_dt,
            end_time=end_dt,
            required_security_role=random.choice(SECURITY_ROLES),
            hourly_rate=rate,
            bill_rate=rate + Decimal('5.00'),
            terms_accepted=True,
            is_published=True,
        )

        if case == 'no_show':
            return Shift(**common, status='no_show', notes='[seeded] Staff did not show up')

        if case == 'did_not_check_in':
            # Past shift where staff was assigned but never checked in -> no_show with note
            return Shift(
                **common,
                status='no_show',
                notes='[seeded] Assigned but never checked in',
            )

        if case == 'pending_approval':
            ci = start_dt + timedelta(minutes=random.randint(-5, 10))
            co = end_dt + timedelta(minutes=random.randint(-15, 30))
            actual = _hours_between(ci, co)
            return Shift(
                **common,
                status='pending_approval',
                check_in_time=ci,
                check_out_time=co,
                check_in_location=loc,
                check_out_location=loc,
                start_signature='[seeded:start]',
                actual_hours_worked=actual,
                notes='[seeded] Awaiting manager approval',
            )

        if case == 'rejected':
            ci = start_dt + timedelta(minutes=random.randint(-5, 10))
            co = end_dt + timedelta(minutes=random.randint(-15, 30))
            actual = _hours_between(ci, co)
            return Shift(
                **common,
                status='rejected',
                check_in_time=ci,
                check_out_time=co,
                check_in_location=loc,
                check_out_location=loc,
                start_signature='[seeded:start]',
                end_signature='[seeded:end]',
                actual_hours_worked=actual,
                manager_notes='[seeded] Hours disputed by client',
            )

        if case == 'auto_checkout':
            ci = start_dt + timedelta(minutes=random.randint(-5, 10))
            co = end_dt + timedelta(hours=random.randint(2, 6))  # auto-checkout fires after end
            actual = _hours_between(ci, co)
            return Shift(
                **common,
                status='approved',
                manager_approved=True,
                check_in_time=ci,
                check_out_time=co,
                check_in_location=loc,
                check_out_location=loc,
                start_signature='[seeded:start]',
                end_signature='[seeded:auto-checkout]',
                actual_hours_worked=actual,
                auto_checkout=True,
                notes='[seeded] System auto-checkout fired',
            )

        if case == 'special_event':
            ci = start_dt + timedelta(minutes=random.randint(-5, 10))
            co = end_dt + timedelta(minutes=random.randint(-15, 30))
            actual = _hours_between(ci, co)
            common['hourly_rate'] = SPECIAL_EVENT_RATE
            return Shift(
                **common,
                status='approved',
                manager_approved=True,
                check_in_time=ci,
                check_out_time=co,
                check_in_location=loc,
                check_out_location=loc,
                start_signature='[seeded:start]',
                end_signature='[seeded:end]',
                actual_hours_worked=actual,
                is_special_event=True,
                notes='[seeded] Special event',
            )

        # default: approved
        ci = start_dt + timedelta(minutes=random.randint(-5, 10))
        co = end_dt + timedelta(minutes=random.randint(-15, 15))
        actual = _hours_between(ci, co)
        return Shift(
            **common,
            status='approved',
            manager_approved=True,
            check_in_time=ci,
            check_out_time=co,
            check_in_location=loc,
            check_out_location=loc,
            start_signature='[seeded:start]',
            end_signature='[seeded:end]',
            actual_hours_worked=actual,
        )

    # ---- Phase 3: Invoices ----

    def _phase_3_generate_invoices(self, memberships, start_date, end_date, admin_user):
        self.stdout.write(self.style.HTTP_INFO('\n[Phase 3] Generating invoices'))
        weekly_invoices = 0
        monthly_invoices = 0

        for m in memberships:
            profile = m.user.profile
            if not profile:
                continue

            periods = (
                _iso_weeks_in_range(start_date, end_date)
                if profile.pay_frequency == 'weekly'
                else _calendar_months_in_range(start_date, end_date)
            )

            for period_start, period_end in periods:
                try:
                    Invoice.generate_for_staff_period(
                        m.user,
                        period_start,
                        period_end,
                        source='admin',
                        created_by=admin_user,
                        default_status='pending',
                    )
                    if profile.pay_frequency == 'weekly':
                        weekly_invoices += 1
                    else:
                        monthly_invoices += 1
                except ValueError:
                    # No approved shifts in this period for this staff - skip
                    continue

        self.stdout.write(f'  Weekly invoices: {weekly_invoices}, Monthly invoices: {monthly_invoices}')
        return {'weekly': weekly_invoices, 'monthly': monthly_invoices}

    # ---- Phase 4: Payroll runs ----

    def _phase_4_generate_payroll_runs(self, company, memberships, start_date, end_date):
        self.stdout.write(self.style.HTTP_INFO('\n[Phase 4] Generating payroll runs'))

        weekly_runs_created = 0
        monthly_runs_created = 0

        for week_start, week_end in _iso_weeks_in_range(start_date, end_date):
            spec = PayrollRun.for_iso_week(week_start)
            run, created = PayrollRun.objects.get_or_create(
                company=company,
                cycle='weekly',
                period_start=spec['period_start'],
                period_end=spec['period_end'],
                defaults={
                    'run_code': spec['run_code'],
                    'label': spec['label'],
                    'process_date': spec['process_date'],
                    'status': 'pending',
                },
            )
            if created:
                weekly_runs_created += 1
            self._link_invoices_to_run(run)

        for month_start, month_end in _calendar_months_in_range(start_date, end_date):
            spec = PayrollRun.for_calendar_month(month_start)
            run, created = PayrollRun.objects.get_or_create(
                company=company,
                cycle='monthly',
                period_start=spec['period_start'],
                period_end=spec['period_end'],
                defaults={
                    'run_code': spec['run_code'],
                    'label': spec['label'],
                    'process_date': spec['process_date'],
                    'status': 'pending',
                },
            )
            if created:
                monthly_runs_created += 1
            self._link_invoices_to_run(run)

        self.stdout.write(f'  Weekly runs: {weekly_runs_created}, Monthly runs: {monthly_runs_created}')
        return {'weekly': weekly_runs_created, 'monthly': monthly_runs_created}

    def _link_invoices_to_run(self, run):
        cycle_filter = (
            {'pay_frequency': 'weekly'} if run.cycle == 'weekly'
            else {'pay_frequency': 'monthly'}
        )
        invoices = Invoice.objects.filter(
            staff_user__profile__pay_frequency=cycle_filter['pay_frequency'],
            staff_user__company_memberships__company=run.company,
            start_date__gte=run.period_start,
            end_date__lte=run.period_end,
            payroll_run__isnull=True,
        )
        invoices.update(payroll_run=run)
        run.recompute_totals()

    # ---- Phase 5: Report ----

    def _phase_5_report(self, shift_stats, invoice_stats, payroll_stats, backup_path, memberships):
        self.stdout.write(self.style.SUCCESS('\n=== Simulation complete ==='))
        self.stdout.write(f"  Shifts created:   {shift_stats['total']}")
        for case, n in shift_stats['by_case'].items():
            self.stdout.write(f"    {case:<22} {n}")
        self.stdout.write(
            f"  Invoices created: {invoice_stats['weekly']} weekly + {invoice_stats['monthly']} monthly"
        )
        self.stdout.write(
            f"  Payroll runs:     {payroll_stats['weekly']} weekly + {payroll_stats['monthly']} monthly"
        )

        no_bank = [m.user.username for m in memberships if not _has_bank(m.user)]
        if no_bank:
            self.stdout.write(
                f"\n  Staff missing bank details ({len(no_bank)}/{len(memberships)}):"
            )
            for u in no_bank:
                self.stdout.write(f"    - {u}")

        if backup_path:
            self.stdout.write(f"\n  Restore data: {backup_path}")

    def _write_backup(self, backup):
        out_dir = Path(__file__).resolve().parents[3] / 'agent_memory' / 'shared'
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / 'mead_simulation_backup.json'
        with out_path.open('w') as f:
            json.dump(backup, f, indent=2, default=str)
        return str(out_path)


# ---- helpers ----

def _has_bank(user) -> bool:
    profile = getattr(user, 'profile', None)
    if not profile:
        return False
    try:
        return profile.bank_details is not None
    except BankDetails.DoesNotExist:
        return False


def _build_case_pool() -> list[str]:
    """Build a 100-item pool reflecting the CASE_MIX percentages."""
    pool: list[str] = []
    for case, pct in CASE_MIX:
        pool.extend([case] * pct)
    random.shuffle(pool)
    return pool


def _hours_between(start: datetime, end: datetime) -> Decimal:
    seconds = (end - start).total_seconds()
    return Decimal(round(seconds / 3600, 2))


def _iso_weeks_in_range(start_date: date, end_date: date) -> list[tuple[date, date]]:
    """Return list of (monday, sunday) tuples for ISO weeks that overlap [start, end]."""
    weeks: list[tuple[date, date]] = []
    seen: set[tuple[date, date]] = set()
    cur = start_date
    while cur <= end_date:
        monday = cur - timedelta(days=cur.weekday())
        sunday = monday + timedelta(days=6)
        key = (monday, sunday)
        if key not in seen:
            weeks.append(key)
            seen.add(key)
        cur += timedelta(days=1)
    return weeks


def _calendar_months_in_range(start_date: date, end_date: date) -> list[tuple[date, date]]:
    """Return list of (first, last) tuples for calendar months that overlap [start, end]."""
    from calendar import monthrange
    months: list[tuple[date, date]] = []
    cur = date(start_date.year, start_date.month, 1)
    while cur <= end_date:
        last_day = monthrange(cur.year, cur.month)[1]
        month_end = date(cur.year, cur.month, last_day)
        months.append((cur, month_end))
        cur = date(cur.year + 1, 1, 1) if cur.month == 12 else date(cur.year, cur.month + 1, 1)
    return months
