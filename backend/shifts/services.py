"""Attendance recording service.

Single chokepoint for any code path that writes attendance values onto a Shift:
self-service mobile check-in, auto-checkout, the admin Attendance UI, and the
payroll AdjustHoursModal all funnel through `record_attendance`.

Architectural rule: `Shift.actual_hours_worked / check_in_time / check_out_time`
is the single source of truth read by payroll, dashboards, and exports. A
`TimeAdjustment` row is only created when this call OVERWRITES a prior non-null
value — that is a real correction worth auditing. Recording attendance for a
shift that previously had nothing is just a write, not an "adjustment".

See docs/attendance-source-of-truth.md for the broader rationale.
"""
from __future__ import annotations

from decimal import Decimal
from datetime import datetime
from typing import Optional, Tuple


def _has_prior_attendance(shift) -> bool:
    return bool(
        shift.check_in_time or shift.check_out_time or shift.actual_hours_worked
    )


def record_attendance(
    *,
    shift,
    check_in: Optional[datetime],
    check_out: Optional[datetime],
    hours: Optional[Decimal],
    actor,
    source: str = 'admin',
    reason: str = '',
) -> Tuple[object, object]:
    """Write attendance to a Shift, auditing the change if it overwrites prior data.

    Returns (shift, audit_row_or_None). audit_row is a TimeAdjustment when this
    call replaced a prior value, otherwise None (first-time recording).

    Raises ValueError if the call is a correction but no reason was supplied.
    """
    from api.models import TimeAdjustment

    is_correction = _has_prior_attendance(shift)

    if is_correction and not (reason or '').strip():
        raise ValueError(
            'A reason is required when overwriting previously recorded attendance.'
        )

    # Capture the prior state BEFORE we mutate the Shift, so the audit row's
    # original_* fields reflect what was actually overwritten.
    prior_check_in = shift.check_in_time
    prior_check_out = shift.check_out_time
    prior_hours = shift.actual_hours_worked

    update_fields = []
    if check_in is not None:
        shift.check_in_time = check_in
        update_fields.append('check_in_time')
    if check_out is not None:
        shift.check_out_time = check_out
        update_fields.append('check_out_time')
    if hours is not None:
        shift.actual_hours_worked = hours
        update_fields.append('actual_hours_worked')
    if update_fields:
        # Shift.save() may rewrite actual_hours_worked (it derives the value
        # from check-in/out minus break_duration). The override mutates the
        # instance in-place, so the audit row built below sees the post-save
        # truth without needing refresh_from_db (which triggers a recursion
        # in the Shift.__init__ override).
        shift.save(update_fields=update_fields)

    audit_row = None
    if is_correction:
        # The audit row records what the operator entered. TimeAdjustment.clean
        # validates adjusted_actual_hours against the raw duration of the new
        # times — Shift may have rewritten actual_hours_worked to subtract the
        # break, so we pass the raw input hours instead of the post-save Shift
        # value to keep the model validator happy.
        audit_hours = hours
        if audit_hours is None and check_in and check_out:
            audit_hours = Decimal(
                str((check_out - check_in).total_seconds() / 3600)
            ).quantize(Decimal('0.01'))
        audit_row = TimeAdjustment.objects.create(
            shift=shift,
            original_check_in_time=prior_check_in,
            original_check_out_time=prior_check_out,
            original_actual_hours=prior_hours or Decimal('0.00'),
            adjusted_check_in_time=check_in,
            adjusted_check_out_time=check_out,
            adjusted_actual_hours=audit_hours if audit_hours is not None else Decimal('0.00'),
            reason=reason.strip(),
            manager_signature=source or 'manager',
            adjusted_by=actor,
        )

    return shift, audit_row
