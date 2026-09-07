"""
Shifts long enough to require a break, with no break recorded — P-M1b.

`Shift.break_duration` is subtracted from paid hours in two places, and
nothing anywhere writes it. A grep across `api/` and `shifts/` returns the
field definition (`default=0`) and those two readers. The mobile side was
wired to endpoints that do not exist: `syncService` posts `start_break` and
`end_break`, no such actions exist in any ViewSet, and the Redux actions were
imported only by an unrouted screen. Had the UI been wired, every break would
have 404'd, burned five retries and been dropped silently.

So `break_duration` is always 0, `max_payable_hours` always equals the full
scheduled duration, and every officer is paid through their unpaid break on
every shift. On a UK security operation where the Working Time Regulations
require a 20-minute break on a shift over six hours, that is a systematic
overpayment of twenty to thirty minutes per officer per shift — and no record
that breaks were taken at all, which is separately the compliance evidence gap.

**This command changes nothing.** Populating `break_duration` would cut every
officer's pay the moment it became non-zero, which needs notice and probably a
conversation about historical overpayment. This makes the gap visible so that
conversation can happen with numbers:

    docker compose exec api python manage.py report_unrecorded_breaks --weeks 12
"""
import csv
import sys
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Shift, WorkingHoursRegulation

PAID_STATUSES = ['completed', 'approved', 'pending_approval']

#: Used when a company has no regulation row. UK Working Time Regulations:
#: a 20-minute break on a shift over six hours.
DEFAULT_TRIGGER_HOURS = Decimal('6.0')
DEFAULT_BREAK_MINUTES = 20


class Command(BaseCommand):
    help = "Count shifts long enough to require a break that have none recorded."

    def add_arguments(self, parser):
        parser.add_argument('--weeks', type=int, default=12)
        parser.add_argument('--csv', dest='csv_path', default=None)

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(weeks=options['weeks'])

        regulations = {
            reg.country_code.upper(): reg
            for reg in WorkingHoursRegulation.objects.filter(is_active=True)
        }

        shifts = (
            Shift.objects
            .filter(start_time__gte=cutoff, status__in=PAID_STATUSES,
                    staff_user__isnull=False, end_time__isnull=False)
            .select_related('staff_user', 'venue', 'venue__company')
        )

        rows = []
        total_unpaid_break_minutes = 0
        for shift in shifts:
            scheduled_hours = Decimal(
                str((shift.end_time - shift.start_time).total_seconds() / 3600)
            )
            company = shift.venue.company if shift.venue else None
            code = (company.country_code or '').upper() if company else ''
            regulation = regulations.get(code) or regulations.get(code[:2])

            trigger = (
                Decimal(str(regulation.break_trigger_hours))
                if regulation and regulation.break_trigger_hours is not None
                else DEFAULT_TRIGGER_HOURS
            )
            expected_minutes = (
                regulation.break_duration_minutes
                if regulation and regulation.break_duration_minutes
                else DEFAULT_BREAK_MINUTES
            )

            if scheduled_hours < trigger or (shift.break_duration or 0) > 0:
                continue

            total_unpaid_break_minutes += expected_minutes
            rows.append({
                'shift_id': shift.id,
                'officer': (
                    shift.staff_user.get_full_name() or shift.staff_user.username
                ),
                'company': company.name if company else '',
                'date': shift.start_time.date().isoformat(),
                'scheduled_hours': f"{scheduled_hours:.2f}",
                'break_trigger_hours': f"{trigger:.2f}",
                'expected_break_minutes': expected_minutes,
                'recorded_break_minutes': shift.break_duration or 0,
            })

        fieldnames = [
            'shift_id', 'officer', 'company', 'date', 'scheduled_hours',
            'break_trigger_hours', 'expected_break_minutes',
            'recorded_break_minutes',
        ]
        if options['csv_path']:
            with open(options['csv_path'], 'w', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            self.stdout.write(f"Wrote {len(rows)} rows to {options['csv_path']}")
        elif rows:
            writer = csv.DictWriter(sys.stdout, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        officers = {row['officer'] for row in rows}
        self.stdout.write("")
        self.stdout.write(f"Window                    last {options['weeks']} weeks")
        self.stdout.write(f"Shifts over the trigger   {len(rows)}")
        self.stdout.write(f"Officers affected         {len(officers)}")
        self.stdout.write(
            f"Unrecorded break time     {total_unpaid_break_minutes} minutes "
            f"({total_unpaid_break_minutes / 60:.1f} hours)"
        )
        self.stdout.write("")
        self.stdout.write(
            "Nothing was changed. Populating break_duration would reduce every "
            "affected officer's pay for every future shift, so it needs a "
            "decision and notice rather than a deploy."
        )
