"""
Worked, closed, and invisible to payroll — the D7 / Phase 0.3 detection.

`Invoice.generate_for_staff_period` filters `actual_hours_worked__isnull=False`,
so a shift that has a check-out but no recorded hours is silently excluded from
invoicing. The officer worked and is not paid, and nothing surfaces an error.

The audit predicted a two-step attendance write would produce exactly that
fingerprint. It does not, in fact — the `TimeAdjustment` sync signal happens to
list `actual_hours_worked` in its own `update_fields`, so the recomputed value
lands. But the combination is worth watching for regardless: it is now blocked
at save time, and any historical rows predate that guard.

**Report only.** Repairing historical payroll is a business decision, not a
migration:

    docker compose exec api python manage.py report_unpaid_shifts --csv /tmp/unpaid.csv
"""
import csv
import sys

from django.core.management.base import BaseCommand

from api.models import Shift

AFFECTED_STATUSES = ['pending_approval', 'approved', 'completed']


class Command(BaseCommand):
    help = "List shifts that were worked and closed but excluded from payroll."

    def add_arguments(self, parser):
        parser.add_argument('--csv', dest='csv_path', default=None)

    def handle(self, *args, **options):
        shifts = (
            Shift.objects
            .filter(
                check_out_time__isnull=False,
                actual_hours_worked__isnull=True,
                status__in=AFFECTED_STATUSES,
            )
            .select_related('staff_user', 'venue', 'venue__company')
            .order_by('start_time')
        )

        rows = [{
            'shift_id': shift.id,
            'officer': (
                shift.staff_user.get_full_name() or shift.staff_user.username
                if shift.staff_user else ''
            ),
            'officer_id': shift.staff_user_id or '',
            'company': (
                shift.venue.company.name
                if shift.venue and shift.venue.company else ''
            ),
            'venue': shift.venue.name if shift.venue else '',
            'start_time': shift.start_time.isoformat() if shift.start_time else '',
            'end_time': shift.end_time.isoformat() if shift.end_time else '',
            'check_in_time': (
                shift.check_in_time.isoformat() if shift.check_in_time else ''
            ),
            'check_out_time': (
                shift.check_out_time.isoformat() if shift.check_out_time else ''
            ),
            'status': shift.status,
        } for shift in shifts]

        fieldnames = list(rows[0].keys()) if rows else [
            'shift_id', 'officer', 'officer_id', 'company', 'venue',
            'start_time', 'end_time', 'check_in_time', 'check_out_time', 'status',
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

        officers = {row['officer_id'] for row in rows if row['officer_id']}
        self.stdout.write("")
        self.stdout.write(f"Shifts worked but unpaid   {len(rows)}")
        self.stdout.write(f"Officers affected          {len(officers)}")
        if rows:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING(
                "These shifts were closed and excluded from invoicing. Settling "
                "them is a payroll restatement and a decision for the business; "
                "this command writes nothing."
            ))
        else:
            self.stdout.write("Nothing to report.")
