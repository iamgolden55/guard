# Attendance source of truth

## Rule

`Shift.actual_hours_worked` / `check_in_time` / `check_out_time` are the **single
source of truth** for attendance data. Payroll, dashboards, exports, and reports
read from these fields and only these fields.

`TimeAdjustment` is an audit log: one row per **correction**, capturing the
diff between a prior recorded value and the new one. It is never the primary
record of "did this person work?".

## Why

Before this refactor we had two competing sources of truth. The mobile/auto
checkout flow wrote `Shift.actual_hours_worked`; the admin Attendance UI
wrote `TimeAdjustment.adjusted_actual_hours` and left `Shift` untouched. The
payroll generator only read from `Shift.actual_hours_worked`, so manually
recorded shifts silently failed to invoice. The audit log was also dishonest —
"first-time recording" rows were stored as TimeAdjustments with
`original_actual_hours=0`, which doesn't mean "previously was 0" but
"previously was unset".

## How (the chokepoint)

All write paths route through `shifts.services.record_attendance`:

```python
from shifts.services import record_attendance

shift, audit = record_attendance(
    shift=shift,
    check_in=check_in,
    check_out=check_out,
    hours=hours,         # auto-computed from times if None
    actor=request.user,
    source='mobile' | 'admin' | 'auto' | 'qr',
    reason='...',        # required only when overwriting prior data
)
```

Behaviour:
- The `Shift` table is updated in place. `Shift.save()` may rewrite
  `actual_hours_worked` (subtracting `break_duration`); the service does not
  fight the save override.
- A `TimeAdjustment` audit row is created **only when** prior values existed
  on the Shift. First-time recording writes nothing to `TimeAdjustment`.
- `reason` is required when overwriting; raises `ValueError` otherwise.

The `TimeAdjustment.clean()` validator enforces this on the model side: any new
`TimeAdjustment` must have non-empty `original_*` fields, otherwise it's a
ghost row that should have gone through the service instead.

## Endpoints

| Endpoint | Purpose | `reason` required? |
|---|---|---|
| `POST /api/v1/shifts/<id>/record_attendance/` | Canonical write — recording or correcting | Only when overwriting |
| `POST /api/v1/shifts/<id>/adjust_time/` | Legacy / explicit-correction shim | Always |

Both endpoints share the `_handle_attendance_write` view helper and call the
same `record_attendance` service. The legacy endpoint stays so external
integrations (and the payroll AdjustHoursModal) keep working unchanged.

## Frontend wiring

| UI surface | Service method | Endpoint |
|---|---|---|
| Attendance drawer (admin records check-in/out) | `attendanceService.adjustShiftTime` → `shiftService.recordAttendance` | `/record_attendance/` |
| Payroll AdjustHoursModal (correction after invoice) | `payrollService.adjustTime` | `/adjust_time/` |

## What used to be wrong (and is now fixed)

1. **Bug E — convergence:** Admin Attendance writes never reached
   `Shift.actual_hours_worked`. Payroll cron skipped those shifts. Fixed by
   `record_attendance` writing Shift fields directly + a one-shot backfill
   that swept up existing ghost rows.
2. **Dishonest audit:** `TimeAdjustment.original_actual_hours=0` for
   first-time recordings was misleading. Fixed by no longer creating
   audit rows for first-time recordings, plus a model-level validator.
3. **Crash on multi-tier shifts:** `InvoiceItem.objects.get(shift=...)` in
   the signal and the legacy view raised `MultipleObjectsReturned` when a
   shift was split across base + OT + special. Fixed in the same pass
   (`.filter().first()`).

## Migration notes

The 8 ghost `TimeAdjustment` rows present in dev as of 2026-04-30 were
deleted; their values had already been backfilled to the parent `Shift`s
via the post-save signal sync.

The post-save signal `sync_shift_and_recalc_invoice_on_time_adjustment` in
`backend/api/signals.py` handles the legacy-data path — if any
`TimeAdjustment` is created with adjusted values that would otherwise leave
the Shift empty (e.g. external sync, raw ORM use), it back-syncs the Shift
fields. This is defensive: in normal operation the service writes Shift
fields *before* creating the audit row, so the signal's sync block is a
no-op.
