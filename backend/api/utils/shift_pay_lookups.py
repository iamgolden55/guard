"""Fetch once for a whole shift list what each shift's pay calculation reads.

`Shift.calculated_payment` is on every row of the shift lists, and it reads the
system settings, the working-hours regulation for the company's country, the
officer's pay rates, their latest time adjustment and the hours they worked
earlier in the same week. Listing N shifts did all of that N times (Sentry
PYTHON-DJANGO-1B).

`prime_shift_pay_lookups(shifts)` fetches each of those in one query for the
whole list and hangs the result on every shift. The model methods it feeds
(`Shift._pay_*`, `get_latest_time_adjustment`) compute exactly what their
per-shift queries did; `shifts/test_shift_list_queries.py` checks each row's
pay against the same shift computed on its own.
"""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone

ACCUMULATING_STATUSES = ('completed', 'approved', 'in_progress')


class ShiftPayLookups:
    def __init__(self, shifts):
        from api.models import Shift, SystemSettings, WorkingHoursRegulation

        self.system_settings = SystemSettings.objects.first()
        # Same order `.first()` used, so ties resolve the same way.
        self._regulations = list(WorkingHoursRegulation.objects.filter(is_active=True))

        # Every shift that could count towards any listed shift's week: the
        # listed officers' accumulating shifts from the earliest week start to
        # the latest week end. A day either side covers any company timezone;
        # the exact week test runs in `prior_week_hours`.
        staff_ids = {s.staff_user_id for s in shifts if s.staff_user_id}
        starts = [s.start_time for s in shifts if s.start_time]
        self._week_shifts = defaultdict(list)
        if staff_ids and starts:
            earliest = min(starts) - timedelta(days=8)
            latest = max(starts) + timedelta(days=8)
            candidates = Shift.objects.filter(
                staff_user_id__in=staff_ids,
                start_time__gte=earliest,
                start_time__lte=latest,
                status__in=ACCUMULATING_STATUSES,
            ).only('id', 'staff_user_id', 'start_time', 'actual_hours_worked', 'payable_hours')
            for candidate in candidates:
                self._week_shifts[candidate.staff_user_id].append(candidate)

    def regulation_for(self, country_code):
        def first(code):
            code = code.upper()
            return next((r for r in self._regulations if (r.country_code or '').upper() == code), None)

        return first(country_code) or first(country_code[:2])

    def prior_week_hours(self, shift, week_start, week_end, accumulator_field):
        """What the per-shift `Sum` aggregate returned: a Decimal, or None if nothing counted."""
        total = None
        for other in self._week_shifts.get(shift.staff_user_id, ()):
            if other.pk == shift.pk or not other.start_time < shift.start_time:
                continue
            # `start_time__date` compares in the current timezone.
            day = timezone.localtime(other.start_time).date()
            if not week_start <= day <= week_end:
                continue
            value = getattr(other, accumulator_field)
            if value is not None:
                total = (total or Decimal('0')) + value
        return total


def pay_prefetches():
    """The prefetches `Shift.calculated_payment` reads when they are present."""
    from api.models import PayRate, TimeAdjustment

    return (
        Prefetch('time_adjustments', queryset=TimeAdjustment.objects.all()),
        Prefetch('staff_user__pay_rates', queryset=PayRate.objects.all()),
    )


def prime_shift_pay_lookups(shifts):
    """Attach one shared `ShiftPayLookups` to every shift in a list; return the list."""
    shifts = list(shifts)
    if shifts:
        lookups = ShiftPayLookups(shifts)
        for shift in shifts:
            shift._pay_lookups = lookups
    return shifts
