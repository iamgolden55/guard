"""
Fill `Shift.payable_hours` on rows written before the column existed.

Migration 0071 added `payable_hours` without a backfill, so every shift saved
before it is NULL. Nothing reads the column while `OT_BASIS_ALIGNED` is off,
which is why this is safe to run now. It matters for what comes next: with the
flag on, the weekly overtime accumulator sums `payable_hours`, and a NULL
contributes nothing. `report_ot_basis_delta` would then understate what
flipping the flag costs, and flipping it would under-count overtime for every
week that reaches back before 0071.

    docker compose exec api python manage.py backfill_payable_hours            # dry run
    docker compose exec api python manage.py backfill_payable_hours --apply

Only NULL rows are written, each from `Shift.compute_payable_hours()` — the
same definition `save()` uses — through a queryset update, so no signal, status
promotion or `updated_at` bump fires. A row that already has a value is never
touched (decision D-D).
"""
from collections import Counter
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Q

from api.models import SecurityCompany, Shift

TWO_PLACES = Decimal('0.01')


class Command(BaseCommand):
    help = "Backfill Shift.payable_hours where it is NULL (dry run unless --apply)."

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Write the values (default is a dry run).')
        parser.add_argument('--company', default=None, help='Limit to one company, by name or id.')
        parser.add_argument('--batch-size', type=int, default=500)

    def handle(self, *args, **options):
        shifts = (
            Shift.objects
            .filter(payable_hours__isnull=True, start_time__isnull=False, end_time__isnull=False)
            .prefetch_related('time_adjustments')
            .order_by('pk')
        )
        if options['company']:
            wanted = options['company']
            query = Q(name__iexact=wanted)
            if _looks_like_uuid(wanted):
                query |= Q(id=wanted)
            company = SecurityCompany.objects.filter(query).first()
            if not company:
                self.stderr.write(self.style.ERROR(f"No company matching {wanted!r}"))
                return
            shifts = shifts.filter(venue__company=company)

        apply = options['apply']
        by_status = Counter()
        written = skipped = 0
        for shift in shifts.iterator(chunk_size=options['batch_size']):
            try:
                value = shift.compute_payable_hours()
            except Exception as exc:  # noqa: BLE001 — report and carry on
                self.stderr.write(f"shift {shift.pk}: could not compute ({exc})")
                skipped += 1
                continue
            if value is None:
                skipped += 1
                continue
            by_status[shift.status] += 1
            if apply:
                # The isnull guard keeps a value a concurrent save() wrote.
                written += Shift.objects.filter(pk=shift.pk, payable_hours__isnull=True).update(
                    payable_hours=value.quantize(TWO_PLACES),
                )

        total = sum(by_status.values())
        self.stdout.write(f"Shifts with no payable_hours   {total + skipped}")
        self.stdout.write(f"  computable                   {total}")
        for status_name, count in sorted(by_status.items()):
            self.stdout.write(f"    {status_name:<26} {count}")
        self.stdout.write(f"  skipped                      {skipped}")
        if apply:
            self.stdout.write(self.style.SUCCESS(f"Wrote payable_hours on {written} shifts."))
        else:
            self.stdout.write(self.style.WARNING("Dry run: nothing written. Re-run with --apply."))


def _looks_like_uuid(value):
    import uuid
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False
