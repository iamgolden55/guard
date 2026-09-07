"""
What flipping OT_BASIS_ALIGNED would cost, per officer.

The weekly overtime accumulator sums `Shift.actual_hours_worked` — raw clock
time — while the hours it pays are scheduled minus break. An officer who
habitually checks in early and out late accrues phantom hours that push them
over the overtime threshold sooner than their paid hours justify, and the
excess is paid at 1.5x or 2x.

Correcting that moves real money for real people, in both directions, so the
switch is a decision rather than a commit. This command produces the numbers
that decision needs: every officer's pay under the current basis, under the
aligned basis, and the difference.

    docker compose exec api python manage.py report_ot_basis_delta --weeks 12
    docker compose exec api python manage.py report_ot_basis_delta --csv /tmp/ot.csv

Read-only. It writes nothing to the database and does not touch the flag.
"""
import csv
import sys
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.test import override_settings
from django.utils import timezone

from api.models import SecurityCompany, Shift

PAID_STATUSES = ['completed', 'approved']


class Command(BaseCommand):
    help = "Compare pay under the current and aligned overtime bases, per officer."

    def add_arguments(self, parser):
        parser.add_argument(
            '--weeks', type=int, default=12,
            help='How many weeks back to cover (default 12).',
        )
        parser.add_argument(
            '--csv', dest='csv_path', default=None,
            help='Write the per-officer rows to this path instead of stdout.',
        )
        parser.add_argument(
            '--company', dest='company', default=None,
            help='Limit to one company, by name or id.',
        )

    def handle(self, *args, **options):
        weeks = options['weeks']
        cutoff = timezone.now() - timedelta(weeks=weeks)

        shifts = (
            Shift.objects
            .filter(
                start_time__gte=cutoff,
                staff_user__isnull=False,
                status__in=PAID_STATUSES,
            )
            .select_related('staff_user', 'venue', 'venue__company')
            .order_by('staff_user_id', 'start_time')
        )

        if options['company']:
            wanted = options['company']
            company = SecurityCompany.objects.filter(
                Q(name__iexact=wanted) | Q(id=wanted)
                if _looks_like_uuid(wanted) else Q(name__iexact=wanted)
            ).first()
            if not company:
                self.stderr.write(self.style.ERROR(f"No company matching {wanted!r}"))
                return
            shifts = shifts.filter(venue__company=company)

        shift_list = list(shifts)
        if not shift_list:
            self.stdout.write(
                f"No approved or completed shifts in the last {weeks} weeks. "
                "Nothing to compare."
            )
            return

        # Both passes run over the same rows, changing only which column the
        # accumulator sums. Each is a pure read — `calculate_payment` writes
        # nothing.
        with override_settings(OT_BASIS_ALIGNED=False):
            current = {s.pk: _pay(s) for s in shift_list}
        with override_settings(OT_BASIS_ALIGNED=True):
            aligned = {s.pk: _pay(s) for s in shift_list}

        rows = {}
        for shift in shift_list:
            officer = shift.staff_user
            row = rows.setdefault(officer.id, {
                'officer_id': officer.id,
                'officer': officer.get_full_name() or officer.username,
                'company': (
                    shift.venue.company.name
                    if shift.venue and shift.venue.company else ''
                ),
                'shifts': 0,
                'current_pay': Decimal('0.00'),
                'aligned_pay': Decimal('0.00'),
            })
            row['shifts'] += 1
            row['current_pay'] += current[shift.pk]
            row['aligned_pay'] += aligned[shift.pk]

        ordered = sorted(
            rows.values(),
            key=lambda r: abs(r['aligned_pay'] - r['current_pay']),
            reverse=True,
        )
        for row in ordered:
            row['delta'] = row['aligned_pay'] - row['current_pay']

        total_current = sum(r['current_pay'] for r in ordered)
        total_aligned = sum(r['aligned_pay'] for r in ordered)
        total_delta = total_aligned - total_current
        affected = [r for r in ordered if r['delta'] != 0]

        fieldnames = [
            'officer_id', 'officer', 'company', 'shifts',
            'current_pay', 'aligned_pay', 'delta',
        ]
        if options['csv_path']:
            with open(options['csv_path'], 'w', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                for row in ordered:
                    writer.writerow({k: row[k] for k in fieldnames})
            self.stdout.write(f"Wrote {len(ordered)} rows to {options['csv_path']}")
        else:
            writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
            writer.writeheader()
            for row in ordered:
                writer.writerow({k: row[k] for k in fieldnames})

        self.stdout.write("")
        self.stdout.write(f"Window            last {weeks} weeks ({cutoff.date()} onwards)")
        self.stdout.write(f"Shifts compared   {len(shift_list)}")
        self.stdout.write(f"Officers          {len(ordered)} ({len(affected)} would change)")
        self.stdout.write(f"Current basis     {total_current:.2f}")
        self.stdout.write(f"Aligned basis     {total_aligned:.2f}")
        self.stdout.write(
            self.style.WARNING(f"Delta             {total_delta:+.2f}")
            if total_delta else "Delta             0.00"
        )
        self.stdout.write("")
        self.stdout.write(
            "OT_BASIS_ALIGNED is not changed by this command. Set it in the "
            "environment when the numbers above have been agreed."
        )


def _pay(shift):
    """Total pay for one shift, or zero if it cannot be determined."""
    try:
        return shift.calculate_payment() or Decimal('0.00')
    except Exception:
        return Decimal('0.00')


def _looks_like_uuid(value):
    import uuid
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False
