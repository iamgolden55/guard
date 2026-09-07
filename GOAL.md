# GOAL — Security, Integrity & Workflow Remediation Plan

**Status:** Plan only. No code has been changed.
**Audit date:** 2026-09-07
**Scope:** `backend/` (api, shifts, leave_management, finance_integrations), `frontend/`, `mobile/`
**Author:** Static source audit — see *Verification legend* before acting on anything here.

---

## How to use this document

Each item is a self-contained work order: problem → root cause → exact location → fix → tests → risk → rollback. Work top-down; the ordering is deliberate (security, then data integrity, then correctness, then performance).

**Rules carried from the audit brief:**

1. Do not rewrite working architecture. Every fix below is additive or subtractive at the edges — none replace a subsystem.
2. Do not remove features. Where a route is deleted (P0-2), it is an unused route, verified unused.
3. The backend is authoritative. No fix here relies on frontend validation.
4. Money stays `Decimal`. Nothing below introduces float arithmetic.
5. Assume concurrency. Where a check-then-act exists, the fix is a constraint or a lock, not a bigger check.
6. Hidden UI is not security.
7. Where a business rule is ambiguous, it is listed in *Open questions* — **do not guess**; preserve current behaviour until answered.
8. Record verification honestly (see legend).
9. Keep the change log at the bottom current.

### Verification legend

| Tag | Meaning |
| --- | --- |
| `VERIFIED-STATIC` | Traced in source to line level. Not executed. |
| `NEEDS-RUNTIME` | Must be confirmed by running it before or after the fix. |
| `NEEDS-PROD-CHECK` | Requires a check against the live Render deployment. |
| `NEEDS-BUSINESS` | Blocked on a decision from Mead Security, not an engineering question. |

**Nothing in this plan was executed.** Docker was not running during the audit; no test, request or query was run. Every finding is source-derived. Treat the P0 severities as high-confidence, but confirm each with the reproduction test listed before declaring it fixed.

---

## Phase 0 — Pre-flight (do before touching code)

**0.1 — Confirm production exposure.** `NEEDS-PROD-CHECK`
One authenticated request settles whether P0-2 is live:

```
GET https://mead-security-api.onrender.com/api/v1/shifts/frontend/
```

If the response contains shifts belonging to more than one company, P0-2 is exploitable in production **now** and the P0 batch becomes an incident, not a sprint. If it 404s, the route is not deployed and P0-2 drops to HIGH.

**0.2 — Baseline the test suite.** `NEEDS-RUNTIME`
Per `CLAUDE.md`, ~51 tests already fail on a clean checkout, and `api/tests/test_optimized_reporting_pipeline.py` errors on import (`psutil` missing). Capture a **per-file** baseline on the current commit before any change:

```bash
cd docker && docker compose up -d
docker compose exec api pytest api/tests/ shifts/ shifts/tests.py leave_management/ -q \
  --tb=no -q > /tmp/baseline.txt
```

Never compare totals. Compare per-file counts against this file. Do not "fix" a pre-existing failure inside a security PR.

**0.3 — Size the H1-3 damage.** `NEEDS-PROD-CHECK`
P1-2 (silently unpaid shifts) may already have cost officers money. Before fixing, quantify:

```sql
SELECT id, staff_user_id, start_time, status, check_in_time, check_out_time
FROM shifts
WHERE check_out_time IS NOT NULL
  AND actual_hours_worked IS NULL
  AND status IN ('pending_approval','approved','completed');
```

Any rows are shifts that were worked, closed, and excluded from invoicing. This is a payroll back-correction, not just a bug fix. Escalate the count to Mead Security before the code change ships.

---

## P0 — Security. Ship as one hardening PR.

These six share a single root cause: **business rules enforced in custom DRF actions, absent from the default CRUD routes on the same ViewSet.** The correct patterns already exist in this codebase (`ShiftViewSet.get_queryset`, `InvoiceViewSet.update_status`, `CapacityLogbookSignoffViewSet.perform_create`). This batch applies them where they were missed.

---

### P0-1 — Staff can create and self-approve their own paid shifts

**Severity:** Critical · **Class:** Mass assignment + missing write authorisation · `VERIFIED-STATIC`

**Problem.** `ShiftSerializer` exposes internal payroll and approval columns as client-writable, on a ViewSet with no role gate for writes. An ordinary staff account can mint a paid, pre-approved shift for itself.

**Files.**
- `backend/shifts/serializers.py:88` — `ShiftSerializer`; field list `:103-117`, notably `:112` (`actual_hours_worked`, `manager_approved`) and `:111` (`hourly_rate`, `bill_rate`, `is_published`).
- `backend/shifts/views.py:22` — `ShiftViewSet`, `permission_classes = [permissions.IsAuthenticated]` at `:31`.
- `backend/shifts/views.py:108` — `perform_update`, which blocks only `status == 'in_progress'` for non-admins.
- `backend/api/models.py:1843` — `Shift.save()` sets `status='approved'`; `:1864` triggers `auto_generate_invoice()`.

**Root cause.** The serialiser was built for a manager-operated scheduling UI and reused verbatim for the staff-facing API. There is one serialiser for two audiences with opposite trust levels.

**Attack chain (single request).**
`POST /api/v1/shifts/` `{venue, start_time: <future>, end_time, staff_user: <self>, hourly_rate: 500, actual_hours_worked: 12, status: "approved", manager_approved: true}` → `Shift.save()` → `auto_generate_invoice()` → `Invoice.generate_for_staff_period()`, whose filter is exactly `status='approved', actual_hours_worked__isnull=False`. A real draft invoice exists before the response returns.

**Fix.**
1. Split the serialiser by audience. Keep `ShiftSerializer` as the manager serialiser; add `StaffShiftSerializer` where `hourly_rate`, `bill_rate`, `actual_hours_worked`, `manager_approved`, `status`, `check_in_time`, `check_out_time`, `check_out_location`, `check_in_location`, `is_published` are **read-only**. Select on `self.request.user.role` in `get_serializer_class()`.
2. Add a permission class — `IsManagerOrAdmin` — to `create`, `update`, `partial_update`, `destroy` on `ShiftViewSet` via `get_permissions()`. Staff retain read, `check_in`, `check_out`, and the release/exchange actions.
3. Validate venue tenancy in `ShiftSerializer.validate()`: the `venue` must belong to the acting user's company. `bulk_create` already does this (`shifts/views.py:2461-2463`); the single-shift path does not. Reuse the same check.

**Do not** fix this by blocking `status` alone. The `hourly_rate` write is independently sufficient for fraud, and so is `actual_hours_worked`.

**Tests (new file `backend/shifts/test_shift_authz.py`).**
- staff POST `/api/v1/shifts/` → 403.
- staff PATCH own shift `{hourly_rate}` → 403 or field ignored; assert DB value unchanged.
- staff PATCH own shift `{manager_approved: true, status: "approved"}` → rejected; assert no `Invoice` row created.
- manager POST with a venue from another company → 403.
- manager POST/PATCH still succeeds (regression guard — this is the path the scheduling UI uses).

**Risk.** Medium. The admin scheduling UI writes these fields legitimately; verify `frontend/src/features/scheduling` still functions. **Rollback:** revert the `get_permissions` addition; the serialiser split is independently safe.

---

### P0-2 — `FrontendShiftViewSet` exposes every shift on the platform

**Severity:** Critical · **Class:** BOLA / broken tenant isolation · `VERIFIED-STATIC`, exposure `NEEDS-PROD-CHECK`

**Problem.**

```python
# backend/shifts/views.py:2940
class FrontendShiftViewSet(viewsets.ModelViewSet):
    queryset = Shift.objects.all().order_by('-start_time')
    permission_classes = [permissions.IsAuthenticated]
    # no get_queryset() override
```

`backend/shifts/urls.py:19-36` routes `list`, `create`, `retrieve`, `update`, `partial_update`, `destroy` and `cancel` to it. `get_object()` therefore selects from every `Shift` row in every company. The `cancel` action (`shifts/views.py:3087`) performs no ownership, role or company check at all:

```python
def cancel(self, request, pk=None):
    shift = self.get_object()
    shift.status = 'cancelled'
    shift.save()
```

`hourlyRate` is writable here too (`shifts/serializers.py:360`).

**This chains with open registration.** `UserViewSet.get_permissions` (`api/views.py:623-627`) grants `AllowAny` to `create`. Anyone on the internet can register and reach all of the above.

**Root cause.** A camelCase compatibility shim for the React client. Only its two attendance actions were ever secured — and they *were* secured correctly (`shift.staff_user != request.user` at `:2969` and `:3027`). The CRUD routes arrived free with `ModelViewSet` and were never considered.

**Fix.** The frontend uses exactly two of these routes — `checkIn/` and `checkOut/` (`frontend/src/services/shiftService.ts:480,494`). Nothing else in `frontend/` or `mobile/` references `shifts/frontend/`. Therefore:

1. Delete the `frontend/`, `frontend/<pk>/` and `frontend/<pk>/cancel/` URL patterns in `shifts/urls.py:19-36`. Keep only the `checkIn` and `checkOut` paths.
2. Narrow the class from `ModelViewSet` to `viewsets.GenericViewSet` so no default CRUD can ever be re-routed onto it.
3. Add the company-scoped `get_queryset()` from `ShiftViewSet:34` regardless — defence in depth, and it makes the two surviving actions tenant-safe by construction.
4. Port the two gates that `ShiftViewSet.check_in` has and this one lacks: the `is_published` check (`shifts/views.py:1035`) and the capacity-logbook checkout gate (`shifts/views.py:1166`). Right now the frontend path bypasses both.

**Tests (`backend/shifts/test_shift_authz.py`).**
- company-A staff GET `/api/v1/shifts/frontend/<company-B shift id>/` → 404.
- company-A staff POST `.../cancel/` on a company-B shift → 404/405.
- staff DELETE `/api/v1/shifts/frontend/<id>/` → 405.
- assigned staff `checkIn` still succeeds (regression).
- `checkIn` on an unpublished shift → 400.

**Risk.** Low — verified-unused routes. **Rollback:** restore the URL patterns.

---

### P0-3 — Staff can rewrite and self-approve their own invoices

**Severity:** Critical · **Class:** Mass assignment + missing write authorisation · `VERIFIED-STATIC`

**Problem.** `InvoiceSerializer` (`api/serializers.py:892`) uses `fields = '__all__'` (`:900`) with `read_only_fields = ('created_at','updated_at','payment_breakdown','source','created_by')` (`:901`). Left writable: `total_amount`, `total_hours`, `hourly_rate`, `status`, `paid_date`, `staff_user`, `payroll_run`, `superseded_by`, `invoice_number`.

`InvoiceViewSet` spans `api/views.py:2937-3358`. I read the full span: there is **no** `create`, `update`, `partial_update`, `destroy` or `perform_*` override. The custom `update_status` action at `:3326` *does* check `request.user.role not in ['admin','manager']`. The default `PATCH` beside it does not.

**Root cause.** Authorisation was implemented per-action rather than per-verb. The action that *looks* like the write path is guarded; the framework's own write path is not.

**Exploit.** `PATCH /api/v1/invoices/<own id>/ {"total_amount": "9999.00", "status": "approved"}`. `get_queryset` limits staff to their own invoices, so this is self-payment rather than cross-tenant — but `create` is not queryset-filtered and `staff_user` is writable, so invoices can be minted for arbitrary users.

**Fix.**
1. Replace `fields = '__all__'` with an explicit list. Everything financial (`total_amount`, `total_hours`, `hourly_rate`, `status`, `paid_date`, `payroll_run`, `superseded_by`, `invoice_number`) becomes read-only; money is only ever written by `generate_for_staff_period` / `recalculate_from_shifts` / `update_status`.
2. Add `get_permissions()` requiring manager/admin for `create`, `update`, `partial_update`, `destroy`.
3. Force `staff_user` server-side on create; never accept it from the client.

**Tests (new `backend/api/tests/test_invoice_authz.py`).**
- staff PATCH own invoice `{total_amount}` → 403; DB unchanged.
- staff PATCH own invoice `{status: "approved"}` → 403.
- staff POST invoice for another user → 403.
- staff DELETE own invoice → 403.
- manager `update_status` still works (regression).
- staff GET own invoices still works (regression — mobile earnings screen depends on it).

**Risk.** Medium — the payroll UI writes some of these. Check `frontend/src/features/payroll` and `frontend/src/features/invoices` before narrowing.

---

### P0-4 — Staff can self-issue a valid SIA licence

**Severity:** Critical (regulatory) · **Class:** Missing write authorisation · `VERIFIED-STATIC`

**Problem.** `SIALicenseViewSet` (`api/views.py:1664-1688`) is a `ModelViewSet` with `permission_classes = [IsAuthenticated]`, no `create`/`update` guard, and `SIALicenseSerializer` uses `fields = '__all__'`. `status` and `expiry_date` are client-writable.

The gate this defeats (`api/models.py:1058`):

```python
def is_eligible_for_shifts(self):
    has_valid_sia = self.sia_licenses.filter(
        status='valid', expiry_date__gte=timezone.now().date()).exists()
    return self.is_approved and has_valid_sia
```

**Why this outranks the financial findings.** This is not money, it is **licensing**. An officer with no SIA licence self-certifies as valid, passes eligibility, claims shifts, and is deployed to a client site. Mead Security believes the system verified them. Under the Private Security Industry Act the exposure sits with the company.

**Fix.**
1. Manager/admin only for `create`, `update`, `partial_update`, `destroy`. Staff keep read on their own licences and keep the document-upload path.
2. Make `status` server-derived — never client-set. Derive from `expiry_date` plus an explicit `verified_by` / `verified_at` set only by an approver.
3. Add `license_number` format validation (SIA numbers are 16 digits).
4. Keep the staff submission journey: staff upload a document and enter details; the record lands `pending` and only an approver moves it to `valid`. `StaffProfileViewSet.pending` / `approve` (`api/views.py:1598,1610`) already model this shape — mirror it.

**Tests (new `backend/api/tests/test_sia_authz.py`).**
- staff POST licence `{status: "valid"}` → 403, or created as `pending`; assert `is_eligible_for_shifts()` is still `False`.
- staff PATCH own expired licence's `expiry_date` → 403.
- manager POST/approve → succeeds and flips eligibility.
- expired licence → `is_eligible_for_shifts()` `False` (regression).

**Risk.** Medium — check the mobile onboarding flow, which likely POSTs licences during signup. Preserve that journey; change only the resulting `status`.

---

### P0-5 — `security_roles` is client-writable

**Severity:** Critical (paired with P0-4) · `VERIFIED-STATIC`

**Problem.** `UserSerializer` (`api/serializers.py:111-115`) correctly makes `role` and `is_active` read-only — but `security_roles` is writable. `User.has_security_role()` (`api/models.py:919`) gates shift claiming against `Shift.required_security_role`.

```python
def has_security_role(self, role):
    return self.role == 'staff' and role in self.security_roles
```

`PATCH /api/v1/users/<self>/ {"security_roles": ["ds","cctv","cp","k9"]}` and the officer is qualified for everything. With P0-4 this removes the qualification model entirely: self-granted competencies plus a self-issued licence.

**Fix.** Add `security_roles` to `read_only_fields` on `UserSerializer`. Expose a manager/admin-only endpoint (or reuse `UserViewSet.update` gated by role) for legitimate changes. Log every change to `AuditLog` alongside the existing `audit_user_role_change` signal (`api/signals.py:861`) — that handler is the right pattern; extend it to cover `security_roles`.

**Tests.** staff PATCH own `security_roles` → unchanged in DB; manager PATCH → succeeds and writes an `AuditLog` row.

---

### P0-6 — `VenueViewSet.get_permissions` is a no-op guarding the geofence

**Severity:** High (latent Critical) · `VERIFIED-STATIC`

**Problem.** `api/views.py:1716-1726`:

```python
def get_permissions(self):
    """Ensure only admin users can create, update or delete venues."""
    if self.action in ['create', 'update', 'partial_update', 'destroy']:
        permission_classes = [IsAuthenticated]
    else:
        permission_classes = [IsAuthenticated]     # ← both branches identical
    return [permission() for permission in permission_classes]
```

The docstring states an intent the code does not implement. `VenueSerializer` (`api/serializers.py:298-309`) exposes `latitude`, `longitude` and `check_radius` as writable — **these are the geofence**. Anyone who reaches this endpoint can move a venue to their home address or widen `check_radius` to 50 km, and every location check in the system passes from anywhere.

**Currently mitigated, by accident.** `get_queryset` calls `get_user_company()`, whose fallback filters memberships to `role__in=['owner','admin','manager']` (`api/views.py:1735-1741`). Invited staff receive `role='staff'` (`api/views.py:819-822`), so the helper returns `None` and staff get `Venue.objects.none()`. **The protection is an unrelated side effect of the tenant helper, not this permission check.** Any future "fix" to `get_user_company` that returns a staff member's company — an entirely reasonable change — silently grants every officer the ability to edit geofences.

**Fix.** Implement the docstring: `[IsAuthenticated, IsManagerOrAdmin]` on the write actions. Additionally treat `latitude`, `longitude`, `check_radius` as audited fields — write an `AuditLog` row on change, since these silently alter attendance validity for every future shift at that venue.

**Tests.** staff PATCH venue coordinates → 403 (assert on the permission, not on an empty queryset); manager PATCH → succeeds and writes an audit row.

---

## P1 — Data integrity and payroll correctness

---

### P1-1 — Duplicate invoice generation → double payment

**Severity:** Critical · **Class:** Check-then-act race, no DB constraint · `VERIFIED-STATIC`

**Problem.** Three compounding gaps:

1. **No DB constraint.** `Invoice` has no unique constraint on `(staff_user, start_date, end_date)`. Confirmed across all 70 migrations in `api/migrations/`. The code acknowledges it — `api/models.py`, docstring of `generate_for_staff_period`: *"two concurrent calls racing the existence check before either has inserted can both create an invoice for the same period. A proper fix requires a partial UNIQUE constraint (where superseded_by IS NULL) added by migration."* A known, accepted, unfixed race.
2. **`payroll_generate`** (`api/views.py`) loops staff doing check-then-create with **no lock and no enclosing `atomic`**. Two managers clicking "Generate payroll" concurrently both pass the existence check.
3. **`auto_generate_invoice()`** (`api/models.py:1869`) fires on every shift approval, so bulk approval multiplies the window.

**Fix.**
1. **Migration:** partial unique index on `Invoice(staff_user, start_date, end_date) WHERE superseded_by IS NULL`. Generate it inside the `api` container so it matches prod Postgres. **Before applying, find existing duplicates** — the constraint will fail to build otherwise:
   ```sql
   SELECT staff_user_id, start_date, end_date, COUNT(*)
   FROM invoices WHERE superseded_by_id IS NULL
   GROUP BY 1,2,3 HAVING COUNT(*) > 1;
   ```
   Any rows are **existing double-payment exposure** and need a business decision before the migration runs. `NEEDS-PROD-CHECK`
2. Wrap the `payroll_generate` loop in `transaction.atomic()` and take `select_for_update()` on the staff row (or a Postgres advisory lock keyed on `staff_id + period`) before the existence check.
3. Make `generate_for_staff_period` idempotent under the constraint: catch `IntegrityError` and return the winning row rather than raising. That turns the race into a no-op instead of an error.

**Tests (extend `backend/api/tests/test_payroll_math.py` or new `test_invoice_concurrency.py`).**
- Two concurrent `generate_for_staff_period` calls for the same staff/period → exactly one `Invoice`, no exception. Use `TransactionTestCase` with threads; `TestCase` wraps in one transaction and will not exercise the race.
- Re-running `payroll_generate` for a period already generated → 0 created, existing returned.

**Risk.** Medium — the migration can fail on live data. Run the duplicate query first.

---

### P1-2 — Two-step attendance recording silently loses the hours (officers unpaid)

**Severity:** High · **Class:** Persistence bug with financial consequence · `VERIFIED-STATIC`

**Problem.** In `backend/shifts/services.py:60-89`, `update_fields` is assembled only from what the caller supplied:

```python
if hours is not None:
    shift.actual_hours_worked = hours
    update_fields.append('actual_hours_worked')
...
shift.save(update_fields=update_fields)     # :89
```

`Shift.save()` (`api/models.py:1811-1817`) recomputes `actual_hours_worked` from the timestamps — but `save(update_fields=[...])` writes **only the listed columns**, so the recomputed value is never persisted.

The natural admin flow triggers it: record check-in now (call 1), record check-out later (call 2). Call 2 carries only `adjusted_check_out_time`, so `_handle_attendance_write` never derives `hours` (its derivation at `shifts/views.py:1504` requires *both* timestamps in the same request), `hours` stays `None`, and `actual_hours_worked` remains `NULL`.

`Invoice.generate_for_staff_period` filters `actual_hours_worked__isnull=False`. **The shift is silently excluded from payroll. The officer worked and is not paid.** Nothing surfaces an error.

**Second defect, same lines.** When both timestamps *are* present, `Shift.save()` overwrites the admin's explicit `adjusted_actual_hours` with its own derivation. Pay is still correct — `get_effective_actual_hours()` reads `TimeAdjustment` first — but `Shift.actual_hours_worked` is left wrong, and that column is what the overtime accumulator reads (see P1-3).

**Fix.**
1. In `record_attendance`, whenever `check_in_time` or `check_out_time` is in `update_fields`, always append `'actual_hours_worked'`. Cheap, surgical, correct.
2. Decide precedence explicitly: if an operator supplied `hours`, that must win over `Shift.save()`'s derivation. Add an internal flag (e.g. `shift._explicit_hours = True`) that `save()` honours, rather than letting the two silently fight.
3. Add a guard so a shift cannot reach `approved` with `check_out_time IS NOT NULL AND actual_hours_worked IS NULL` — that combination is the fingerprint of this bug and should be impossible.
4. **Back-correction:** run the Phase 0.3 query and repair historical rows. This is a payroll restatement — Mead Security decides how to settle it. `NEEDS-BUSINESS`

**Tests (extend `backend/shifts/test_overnight_attendance.py`).**
- POST `record_attendance` with check-in only, then a second POST with check-out only → assert `actual_hours_worked` is non-NULL and correct.
- Then generate an invoice for the period → assert the shift appears as a line item.
- POST with explicit `adjusted_actual_hours` + both timestamps → assert the explicit value persists on the Shift.

**Risk.** Low. High value — this one is costing money today.

---

### P1-3 — Overtime is computed on a different quantity than it pays

**Severity:** High · **Class:** Business-logic inconsistency · `VERIFIED-STATIC`

**Problem.** `calculate_payment_breakdown` (`api/models.py:2237-2247`) pays `max_payable_hours` (scheduled − break) by default. But the weekly accumulator at `api/models.py:2302` sums a different column:

```python
.aggregate(total=_Sum('actual_hours_worked'))['total']
```

`prior_hours` is therefore *actual clock time* while `current_hours` is *payable time*. An officer who habitually checks in 15 minutes early and out 15 minutes late accrues 0.5 h/shift of phantom hours that push them over the 48 h threshold sooner than their paid hours justify — inflating OT at 1.5×/2×.

**Fix.** Make the accumulator sum the same quantity that gets paid. Two options:

- **(a) Preferred:** persist the payable figure at approval time in a new `payable_hours` column, and have the accumulator sum that. Explicit, indexable, auditable, and it makes the invoice header reconcilable (see P2-4).
- **(b) Cheaper:** have the accumulator recompute `max_payable_hours` per prior shift in Python. Correct but O(n) per shift and it re-derives a value that should be stored.

Take (a). It also resolves P2-4 and gives the OT query something to index.

**Ordering.** Do P1-2 first — it corrupts the column this fix reads.

**Tests (extend `backend/api/tests/test_payroll_math.py`).**
- Officer with 5 shifts scheduled 8 h, each actually worked 9 h, 40 h threshold → assert **zero** OT (paid hours = 40).
- Same with a `TimeAdjustment` raising one shift to 10 h → assert OT appears only for the genuine excess.
- Assert `base + ot1 + ot2 == calculate_payment()` still holds (the existing revenue-neutral invariant).

**Risk.** Medium — changes pay outcomes. Run against a copy of production data and diff before/after totals per officer before shipping. `NEEDS-RUNTIME`

---

### P1-4 — No constraints or indexes on `shifts`; assignment race

**Severity:** High · `VERIFIED-STATIC`

**Problem.** Migration `0006_add_unique_constraint_to_shifts.py` added `unique_together (venue, staff_user, start_time, end_time)`; `0007_add_shift_group_field.py` replaced it with `(shift_group, staff_user)`; `0008_remove_shift_group_unique_constraint.py` removed it entirely. The model `Meta` (`api/models.py:1696-1705`) defers to serialiser validation. **Today the table has no unique constraints and no indexes beyond the FK columns Django creates automatically.**

Consequences:
- Nothing prevents duplicate or overlapping assignments at the DB level.
- `bulk_create` runs `validate_shift_warnings` **outside** its `transaction.atomic()` block (`shifts/views.py:2557`, atomic opens at `:2624`) and re-checks nothing inside — a textbook TOCTOU. Two managers scheduling concurrently can double-book an officer.
- No index on `start_time`, `status`, or `is_published`, despite `ordering = ['-start_time']` and a dashboard filtering on exactly those (`api/views.py:9168-9177`).

**Note on capacity.** Your brief asked hard about capacity going negative or exceeding maximum. **It structurally cannot.** There is no `ShiftAssignment` table and no counter: one `Shift` row *is* one staffing slot, grouped by `shift_group`. There is no `assigned_count` to drift, and `OpenShiftRequest.claim_shift()` already guards the last-slot race correctly with `select_for_update()`. **Keep this design.** The gap is not the counter — it is that row-level uniqueness was removed and never replaced.

**Fix.**
1. **Migration — indexes** (do this first, it is pure win and zero risk):
   `(start_time)`, `(staff_user, start_time)`, `(status, is_published)`, `(venue, start_time)`. Use `AddIndex`; on a large table consider `CONCURRENTLY` via `SeparateDatabaseAndState`.
2. **Migration — overlap constraint.** Postgres `ExclusionConstraint` with `btree_gist` prevents two non-cancelled shifts for the same `staff_user` whose `[start_time, end_time)` ranges overlap. This is the correct DB-level expression of "an officer cannot be in two places at once" and it closes the TOCTOU permanently. Check for existing violations first — this will fail to build otherwise. `NEEDS-PROD-CHECK`
3. **Re-check inside the transaction.** In `bulk_create`, re-run conflict detection inside the `atomic()` block, and catch `IntegrityError` from the exclusion constraint to downgrade a slot to `conflict` rather than 500-ing the whole batch.

**Tests.** Concurrent `bulk_create` of two overlapping assignments for one officer (`TransactionTestCase`) → exactly one persists, the other reports a conflict. Existing `bulk_create` tests in `shifts/tests.py` must still pass — **remember to name that file explicitly**, `pytest shifts/` silently skips it.

---

### P1-5 — Invoices lock only at `paid`, not at `approved`/exported

**Severity:** High · `VERIFIED-STATIC`

**Problem.** `api/signals.py:617` skips recalculation only when `invoice.status == 'paid'`. Per `PayrollRun`'s own model docstring, `approved` means *"exportable to Xero"*. An attendance correction after export silently restates the local invoice while Xero keeps the original — reconciliation drift nobody is alerted to.

**Fix.** Extend the lock to `status in ('approved', 'paid')` **or** `export_status == 'completed'`. When a locked invoice would change, do not silently skip: raise a domain error and require an explicit credit-note / reissue flow. The `superseded_by` mechanism already exists for exactly this (`api/models.py:3085`) — route corrections through it.

**Tests.** `TimeAdjustment` against a shift on an `approved` invoice → invoice unchanged, operator receives an actionable error. Against a `pending` invoice → recalculates as today (regression).

---

### P1-6 — `X-Company-ID` is entirely non-functional

**Severity:** High · **Class:** Multi-tenant correctness · `VERIFIED-STATIC`

**Problem.** `TenantMiddleware.process_request` (`api/middleware/tenant_middleware.py:36-38`) bails immediately when the user is unauthenticated:

```python
if not request.user or not request.user.is_authenticated:
    request.current_company = None
    return None
```

`MIDDLEWARE` (`core/settings.py:86-87`) places it directly after `AuthenticationMiddleware`, which resolves `request.user` from the **session**. The React admin and the mobile app authenticate with JWT (header or cookie) resolved by DRF, **after** all middleware. So `request.user` is `AnonymousUser` at middleware time for every API request, and `request.current_company` is always `None`.

I grepped for any other writer: the only assignments to `current_company` anywhere in the codebase are the four inside this middleware. **Nothing sets it post-authentication.**

Consequences:
- The `X-Company-ID` header does nothing. Company switching in the admin UI does not change data scoping.
- Every `get_user_company()` / `_resolve_request_company()` helper always takes its fallback branch: `order_by('-joined_at').first()` among owner/admin/manager memberships. A user in two companies always sees the most recently joined one, whatever the UI displays.
- The comments throughout `api/views.py` reading *"SECURITY: Uses middleware-provided company context (respects X-Company-ID header)"* are **factually wrong** and will mislead the next engineer.

This is not a privilege escalation — the fallback is still restricted to the user's own memberships — but for a platform selling multi-tenancy, showing the wrong tenant's data is a serious correctness failure.

**Fix.** Resolve tenancy after DRF authentication, not in Django middleware. Options:
- **(a) Preferred:** a small DRF-level resolver — a base ViewSet mixin or a custom authentication wrapper — that reads `X-Company-ID`, validates membership (reuse `_validate_user_company_access`, which is already correct), and caches on the request. Replace the ~6 duplicated `get_user_company` copies with the single helper.
- **(b)** Keep the middleware but have it lazily resolve the JWT itself. Duplicates DRF's work; not preferred.

Then correct the misleading comments.

**Tests.** Manager belonging to companies A and B: request with `X-Company-ID: A` returns A's shifts; with `B`, B's; with a company they do not belong to → 403. Today all three return the same thing.

**Risk.** Medium-high blast radius — it touches every scoped queryset. Do it as its own PR with its own test pass, **not** bundled into P0.

---

### P1-7 — `LeaveReportsViewSet` leaks leave data across all tenants

**Severity:** High · **Class:** Broken tenant isolation · `VERIFIED-STATIC`

**Problem.** `leave_management/views.py:1268` — `ReadOnlyModelViewSet` with `[IsAuthenticated, ManagerOrAdminPermission]`, **no `get_queryset`**, and unscoped queries throughout:

```python
# :1282-1284  list
total_requests   = LeaveRequest.objects.filter(created_at__year=current_year).count()
pending_requests = LeaveRequest.objects.filter(status='pending').count()
approved_requests= LeaveRequest.objects.filter(status='approved', ...).count()
# :1319  analytics
requests_qs      = LeaveRequest.objects.filter(created_at__year=year)
# :1452  usage_summary
entitlements     = LeaveEntitlement.objects.filter(year=year)
```

Any manager in any company sees platform-wide leave counts, analytics and entitlements. `LeaveRequestViewSet` (`:746`) *is* properly scoped — the reporting viewset beside it is not.

**The leak is broader than this viewset.** A grep for unscoped aggregates across `leave_management/views.py` also returns `:455`, `:458` and `:1687` (`LeaveEntitlement.objects.filter(year=year)` / `LeaveRequest.objects.filter(created_at__year=year)` with no company predicate), plus multi-line filters at `:185`, `:538` and `:1603` that need individual inspection to confirm whether they are scoped.

**Fix.** Do not patch the three lines above in isolation. Sweep the whole module: every `LeaveRequest.objects` / `LeaveEntitlement.objects` call site must go through a company-scoped helper, following `LeaveRequestViewSet.get_queryset`'s pattern. Then add the module to the tenant-isolation test matrix so a future unscoped query fails CI.

**Tests.** Seed leave data in companies A and B; assert a manager in A sees only A's counts across *every* action on `LeaveReportsViewSet`, not just `list`.

---

### P1-8 — SIA licence documents are publicly readable, and may not persist

**Severity:** High · **Class:** Sensitive data exposure · `VERIFIED-STATIC` + `NEEDS-PROD-CHECK`

**Problem.** `FileUploadView` (`api/views.py`) is genuinely well-built for *upload* — magic-byte validation, 10 MB cap, MIME allowlist, filename sanitisation. The problem is *serving*:

- Files land in a shared `sia_licenses/` prefix under a sanitised **original filename** (e.g. `John_Smith_SIA_Licence.pdf`) and the endpoint returns an absolute URL with no access control. **Anyone with the URL — or who guesses it — can read an officer's identity document.** No authentication, no ownership check.
- `core/urls.py:74` calls `static(settings.MEDIA_URL, ...)` with the comment *"Serve media files in all environments"*. `django.conf.urls.static.static()` returns `[]` when `DEBUG=False`. **The comment is wrong**: in production this serves nothing.
- `core/settings/production.py:68` sets `MEDIA_ROOT='/app/media'`, with S3 configured only when `AWS_STORAGE_BUCKET_NAME` is set (`:75-88`). If it is not set on Render, licence documents are written to an ephemeral container filesystem — wiped on every deploy — and were never servable anyway.

**Fix.**
1. **First, confirm whether S3 is configured on Render.** `NEEDS-PROD-CHECK` If not, documents uploaded to date may already be gone.
2. Serve licence documents through an authenticated view that checks the requester owns the profile or is a manager/admin of that company — never a bare media URL.
3. Use unguessable stored names (UUID), keeping the original only as display metadata.
4. If S3: private bucket + short-lived presigned URLs. Never public-read.
5. Correct the misleading comment in `core/urls.py`.

---

## P2 — Compliance, attendance integrity, operational safety

### P2-1 — SIA licence is never checked at check-in
`VERIFIED-STATIC` · `Shift.can_start_shift()` (`api/models.py:1965`) checks only `VenueTermsAcceptance`. Eligibility is verified when *claiming* an open shift, never when *starting* one. An officer assigned in March with a licence expiring in April works an unlicensed shift in May and nothing fires.
**Fix:** call `profile.is_eligible_for_shifts()` in `can_start_shift()`, and additionally assert the licence is valid **on the shift date**, not merely today. Decide the failure mode with the business — hard block, or allow-with-alert so an officer is never stranded on site by a data error. `NEEDS-BUSINESS`
**Tests:** check-in with a licence expiring the day before → blocked; expiring the day after → allowed.

### P2-2 — Approval is automatic; there is no human gate
`VERIFIED-STATIC` · `Shift.save()` (`api/models.py:1836-1845`) sets `status='approved'` and `manager_approved=True` for any `pending_approval` shift with an end signature and a verifying location. A normal check-out always produces both, so **every ordinary shift self-approves and immediately generates an invoice**. Your brief asks whether pay can be generated from unapproved attendance: in practice *all* pay is, and `manager_approved` records something no manager did.
This may be deliberate. **Do not change it without a decision.** `NEEDS-BUSINESS`
**If a real gate is wanted:** keep auto-approve as a `system_approved` flag distinct from `manager_approved`; require explicit manager sign-off before an invoice leaves `draft`. The draft/supersede machinery already supports this.

### P2-3 — Geofencing depends on a live Google Maps call and fails closed
`VERIFIED-STATIC` · `Venue.verify_location` (`api/models.py`) calls the Distance Matrix API for **walking** distance on every check-in and check-out. On an exception it falls back to Haversine (fine). But on a non-`OK` API status it falls through to `return False` — and `ZERO_RESULTS` is routine for walking routes across water, motorways or private land. **An officer standing at the venue cannot check in.** Separately, `perform_auto_checkout` and the P2-2 auto-approve each fire a billable API call comparing the venue *to itself*.
**Fix:** make Haversine the primary test — it is exact for geofencing at this scale, has no latency, no cost and no availability dependency. Keep the Maps call, if wanted, only as an optional secondary signal that can never *deny* a check-in. Skip location verification entirely on the auto-checkout self-comparison.

### P2-4 — Statutory capacity records can be forged and backdated
`VERIFIED-STATIC` · `CapacityCheckViewSet.perform_create` (`api/views.py:2161`) calls `serializer.save()` with no validation that `shift` belongs to the requester, and `CapacityCheckSerializer` is `fields='__all__'`. So: (a) `shift` accepts any PK platform-wide — **cross-tenant record injection**; (b) `timestamp` is client-set (`ShiftCheck.save` defaults to `now()` only when blank), so missed 30-minute slots can be **back-filled after the fact**; (c) `venue_capacity` is client-supplied rather than read from the venue, so `is_at_capacity` is whatever the client asserts.
For a licensed-premises capacity logbook, tamper-evidence is the whole point.
**Fix:** server-set `timestamp`; read `venue_capacity` from `shift.venue.capacity`; validate the shift belongs to the requester (or that they are a manager of its company). `CapacityLogbookSignoffViewSet.perform_create` (`api/views.py:2306-2313`) already does this membership check correctly — **copy that pattern**.
Apply the same treatment to `FireExitCheckViewSet` and `ToiletCheckViewSet`, which share the base class and the same gap.

### P2-5 — GPS accuracy is collected and discarded
`VERIFIED-STATIC` · `frontend/src/services/shiftService.ts:475` types `location.accuracy` and then never sends it. `mobile/src/services/locationService.ts:54` calls `getCurrentPositionAsync` with no mock-location detection anywhere.
**Fix:** transmit `accuracy`; reject or flag fixes above a threshold (e.g. > 100 m) for geofencing; persist it alongside `check_in_location` for audit. On mobile, surface Android's mock-location flag and iOS location-integrity signals and record them. Client coordinates remain inherently spoofable — the goal is evidence and anomaly detection, not prevention.

### P2-6 — Two `OpenShiftRequest` rows can exist per shift
`VERIFIED-STATIC` · The `auto_create_open_shift_request` signal (`api/signals.py:282`) and `release_to_pool` (`api/models.py`) can both create requests for one shift; there is no partial unique on `original_shift WHERE status='open'`. `approve_claim` (`api/models.py`) sets `original_shift.staff_user` **without locking the shift** or checking it is still unassigned. Two approvals overwrite each other and the second officer believes they hold the shift.
**Fix:** partial unique constraint; `select_for_update()` on the shift inside `approve_claim` with an explicit "already assigned" error. `claim_shift`'s existing lock is the right pattern — extend it to approval.

### P2-8 — An officer can check in hours after the shift ended
`VERIFIED-STATIC` · Found by diffing the mobile client's gate against the server's. The client blocks check-in once `end_time` has passed (`ShiftDetailsScreenV2.tsx:211-219`: `if (end < now) return false`). **The server has no end-time bound at all.** Its only window checks are (a) `now.date() == shift.start_time.date()` — a *date*, not a time (`backend/shifts/views.py:1053-1066`) — and (b) not more than 15 minutes early (`:1080-1097`). `Shift.check_in()` then requires only `status in ['active','scheduled']`, and `Shift.save()` leaves an un-started shift at `'active'` indefinitely.

So for a 09:00–17:00 shift, an officer who never turned up can check in at 23:50 the same day and the server accepts it. Combined with **P2-2** (auto-approval on checkout) and the default pay basis of *scheduled* hours, that check-in leads to a full eight hours' pay for a shift that was not worked. The only thing preventing it today is that the mobile UI declines to send the request — which is exactly the "hidden button is not a security control" case from Rule 6.

**Fix.** Add a server-side upper bound: reject check-in after `end_time` (plus a small grace, e.g. 30 minutes, for a genuinely late arrival), and align the client's rule to the same constant. Where a genuinely late start needs recording, it belongs in the manager `record_attendance` path, which is role-gated and audited. Also replace the UTC-date window with a company-timezone-aware window — the OT calculation already resolves company timezone correctly (`api/models.py:2275-2283`); check-in should use the same helper rather than raw UTC dates.

**Tests.** Check-in at `end_time + 1min` → 400. At `end_time − 1min` → 200. Overnight shift crossing midnight → still works (regression against `shifts/test_overnight_attendance.py`).

---

### P2-7 — Audit trail gaps
`VERIFIED-STATIC` · 30 `AuditLog` write sites: 21 in `views_billing.py`, 3 in `shifts/views.py`, 3 in `signals.py`, 1 each in `views.py`/`tasks.py`. Covered today: user creation, role change, invoice status change, shift *batch* creation. **Not covered — all named in your Phase 14 list:** shift edited, shift cancelled, shift deleted, employee assigned, employee removed, check-in, check-out, attendance modified, pay rate modified, permissions changed.
**Fix:** cover the lifecycle with actor / action / target / timestamp / before / after / IP / user-agent. `bulk_create`'s `AuditLog.objects.create` (`shifts/views.py:2663`) is the reference shape. Never log signatures, photos, tokens or bank details.

---

## P3 — Correctness, performance, cleanup

| # | Item | Location | Note |
| --- | --- | --- | --- |
| P3-1 | Open registration — anyone can create an account | `api/views.py:623-627` | The amplifier for P0-2. Gate behind invite, or require company association before any data route resolves. |
| P3-2 | Mass assignment is systemic — **28** serialisers use `fields='__all__'` | `api/serializers.py` +3 files | P0-3/4 fix two. Sweep the rest; treat `__all__` as a lint failure going forward. |
| P3-3 | Invoice header/line reconciliation | `api/models.py` `generate_for_staff_period` | Header `total_hours` uses *actual*; items use *scheduled*. `hourly_rate = total_amount / total_hours` also divides leave pay by shift hours — a meaningless "rate" printed on a document sent to contractors. Resolved for free by P1-3 option (a). |
| P3-4 | Rounding | `api/models.py:2219-2221` | `Decimal(str(seconds/3600))` keeps full float expansion; `DecimalField(decimal_places=2)` quantises on write, so stored `hours × rate ≠ stored amount`. Quantise explicitly, `ROUND_HALF_UP`, at one defined boundary. |
| P3-5 | Cache-key injection / cache-fill DoS in the holiday proxy | `leave_management/views.py:2589-2601` | `country_code`/`year` flow unvalidated into both the outbound path and `cache_key`. **Not** arbitrary-host SSRF — the host is fixed — but the path and cache key are attacker-controlled and the cache is unbounded. Validate against ISO-3166-alpha-2 and a sane year range. |
| P3-6 | Dead frontend code | `frontend/src/services/shiftService.ts` `startShift`/`endShift` | Call `/api/v1/shifts/submit/` and `/api/v1/shifts/{id}/end/`. Neither exists in any router — guaranteed 404. Delete or implement. |
| P3-7 | Duplicated check-in/check-out implementations | `shifts/views.py:1013,1141` vs `:2965,3023` | Already drifted: only the first enforces `is_published` and the logbook gate. Collapse to one service function after P0-2. |
| P3-8 | Broken related field | `shifts/serializers.py:357` | `queryset=Shift.objects.all().values_list('staff_user', flat=True).distinct()` — a values queryset, so `.get(pk=…)` returns an `int`, which cannot be assigned to a FK. |
| P3-9 | No 409/conflict handling in the UI | `frontend/src/features/scheduling` | Phase 10's "second manager sees a now-full shift" is unhandled — zero matches for conflict handling. Surface a conflict state and refetch. |
| P3-10 | No `invalidateQueries` in the attendance feature | `frontend/src/features/attendance/**` | Zero occurrences; risk of stale data after mutations. Double-submit *is* guarded (`AttendanceDrawer.tsx:733,1000,1054`). |
| P3-11 | `Shift.clean()` runs on every `save()` | `api/models.py:1809` | Issues availability/leave queries on every write, including bulk paths. |
| P3-12 | Dependencies pinned at `.0` | `backend/requirements.txt` | `Django==5.2`, `djangorestframework==3.14.0`, `cryptography==43.0.0` exclude published patch fixes. Advisories not checkable offline — run `pip-audit`. `NEEDS-RUNTIME` |
| P3-13 | 67 `console.log` in `frontend/src` | — | Strip or route through a logger. |
| P3-14 | `notifications_general` WebSocket group | `api/consumers.py:386,407` | Every authenticated user joins one global group. Nothing currently broadcasts to it, but any future send is cross-tenant by construction. Remove or scope by company. |
| P3-15 | `ALLOWED_HOSTS` default embeds private LAN IPs | `core/settings.py:49` | Cosmetic; tidy. |
| P3-16 | Login can 500 on duplicate email | `api/views.py` `LoginView.post` | `User.objects.get(Q(username=…)|Q(email=…))` raises `MultipleObjectsReturned` if an email is ever duplicated. `email` is validated for uniqueness in the serialiser but not constrained in the DB. |

---

## P-M — Mobile app (`mobile/`)

Audited separately after the backend pass. The mobile app is **better built than the backend API surface**: JWT access and refresh tokens live in `SecureStore` (not `AsyncStorage`), the axios layer has a correct single-flight refresh with a no-refresh path list (`src/config/api.config.ts:56-101`), the offline queue has bounded retries with exponential backoff, and `google-services.json` is correctly untracked (commit `656b89a6`) with history rewritten via BFG. Do not "fix" any of that.

**One finding de-risks P0-1.** The live mobile check-in payload is `{latitude, longitude, photo, signature}` only — `ShiftDetailsScreenV2.tsx:315-320` and `ShiftDetailsScreen.tsx:487`. It does **not** send `check_in_time`. Making `check_in_time` / `check_out_time` read-only in P0-1 therefore cannot break mobile check-in. `VERIFIED-STATIC`

---

### P-M1 — Offline check-ins are silently lost, and record the wrong time

**Severity:** High · **Class:** Attendance data loss · `VERIFIED-STATIC`

**Problem.** Two defects compounding, in the exact scenario this app exists for — an officer in a basement, car park or steel-framed venue with no signal.

1. **The recorded time is the sync time, not the work time.** `CheckInFlowV2.tsx:245` queues `check_in_time: new Date().toISOString()`, and `syncService.executeAction` (`src/services/syncService.ts:214`) POSTs that payload to the check-in endpoint. But the server ignores it entirely — `Shift.check_in()` (`backend/api/models.py:2038`) stamps `timezone.now()`. An officer who checks in offline at 18:00 and regains signal at 23:00 is recorded as checking in at **23:00**.
2. **A late sync is rejected outright, then silently dropped.** The server's check-in window requires `now.date()` to equal the shift's start date (`backend/shifts/views.py:1058-1066`). An offline check-in that syncs after midnight gets *"Cannot check in to a shift from a previous date."* `isAlreadyCompletedError` (`syncService.ts:250-265`) does not match that wording, so it counts as a failure, burns all 5 retries (`syncService.ts:29,289`), and is marked `failed` at `:291` — **with a `logger.warn` and nothing else. No user notification, no manager alert.**

The officer was told *"Check-in saved locally; will sync when you have internet"* (`ShiftDetailsScreenV2.tsx:334`). They worked the shift. No attendance record exists. Nobody is told.

**Fix.**
1. **Server:** accept a client-asserted `occurred_at` on check-in/check-out, used **only** when the request also carries an offline-sync marker. Store it in a distinct column (`reported_check_in_time`) alongside the server-stamped `check_in_time` — never overwrite the trusted value. Pay and hours continue to read the server column until a manager reconciles, so this cannot become a pay-manipulation vector.
2. **Server:** relax the date-window rejection for flagged offline replays — accept them and mark the shift for manager review rather than refusing.
3. **Mobile:** on `status: 'failed'`, surface a blocking, persistent alert naming the shift, and offer "contact your manager". Silent failure is the actual harm here.
4. **Backend:** add failed offline replays to the manager attendance-exceptions queue.

**Tests.** Backend: offline replay with `occurred_at` on the previous day → accepted, flagged for review, `check_in_time` and `reported_check_in_time` both persisted and distinct. Mobile (`mobile/jest.config.js`): a queue item exhausting retries fires a user-visible notification.

**Risk.** Medium — touches the check-in contract. Ship behind the offline marker so the online path is untouched.

---

### P-M1b — Breaks are not implemented end to end; officers are paid through them

**Severity:** High · **Class:** Missing feature with direct payroll consequence · `VERIFIED-STATIC`

**Problem.** `Shift.break_duration` is subtracted from paid hours in two places — `Shift.save()` (`backend/api/models.py:1816`) and `calculate_payment_breakdown` (`:2221`, `max_payable_hours = scheduled_hours − break_hours`). **Nothing anywhere writes it.** A grep across `api/` and `shifts/` returns only the field definition (`:1686`, `default=0`) and those two readers. `WorkingHoursRegulation.break_duration_minutes` (`:4769`) is a separate regulation setting, not the shift's.

The mobile side is wired to a backend that does not exist:

- `syncService.executeAction` handles `'start_break'` / `'end_break'` (`src/services/syncService.ts:219-224`), POSTing to `/api/v1/shifts/{id}/start_break/` and `/end_break/` (`src/config/api.config.ts:131-132`).
- **Neither endpoint exists.** No `start_break` or `end_break` action in `shifts/views.py` or `api/views.py`.
- The Redux actions `startBreak` / `endBreak` (`src/store/slices/shiftsSlice.ts:310,323`) are imported only by `WiseDashboardScreen.tsx:17`, which is **not routed** — `TabNavigator.tsx:16` routes `DashboardHomeV2`.

**Consequence.** `break_duration` is always `0`, so `max_payable_hours` always equals the full scheduled duration. **Every officer is paid through their unpaid break on every shift.** On a UK security operation where the Working Time Regulations require a 20-minute break on shifts over six hours, that is a systematic overpayment of ~20-30 minutes per officer per shift, and there is no record that breaks were taken at all — which is also the compliance evidence gap.

Had the break UI been wired, it would have been *worse*: the queued action would 404, burn 5 retries, and be dropped silently via the P-M1 path, while the app showed the officer as on break.

**Fix.** This is a feature decision, not a bug fix, so **the default for the autonomous run is: change nothing about pay.** See `full_fix.md`. Specifically:
1. **Now (safe, in scope):** delete the dead `start_break`/`end_break` sync action types, endpoint constants and Redux actions, so nothing enqueues actions to endpoints that do not exist. Removes a silent-failure path.
2. **Now (safe):** add a log/metric when `break_duration == 0` on a shift over the regulation's `break_trigger_hours`, so the gap becomes visible instead of invisible.
3. **Deferred, needs a decision:** implement break capture properly (endpoints, model fields for `break_started_at`/`break_ended_at`, UI). **Do not** simply start populating `break_duration` — the moment it becomes non-zero, every officer's pay drops. That is a payroll change requiring notice, and possibly a conversation about historical overpayment. `NEEDS-BUSINESS`

**Tests.** Assert `break_duration` defaults to 0 and that removing the dead break plumbing changes no pay outcome (`api/tests/test_payroll_math.py` must be unchanged by step 1).

---

### P-M1c — ~4,400 lines of dead v1 screens shadow the live V2 files

**Severity:** Medium · **Class:** Maintenance trap · `VERIFIED-STATIC`

**Problem.** The navigators import V2 screens **aliased to the v1 names**:

```ts
// src/navigation/MainNavigator.tsx:22-23,37
import { CheckInFlowV2 as CheckInFlowScreen, ShiftDetailsScreenV2 as ShiftDetailsScreen } from '...';
import { EarningsScreenV2 as EarningsScreen } from '../screens/profile/v2';
// src/navigation/TabNavigator.tsx:16,20
import { DashboardHomeV2 as UberDashboardScreen } from '../screens/dashboard/v2';
import { ProfileScreenV2 as ProfileScreen } from '../screens/profile/v2';
```

So `<Stack.Screen component={ShiftDetailsScreen} />` renders `ShiftDetailsScreenV2` — while `src/screens/shifts/ShiftDetailsScreen.tsx` (1,802 lines) sits unrouted and dead. Measuring just five of them: **4,402 lines**, and there are more (`ProfileScreen.tsx` 813, `WiseDashboardScreen.tsx`, `UberDashboardScreen.tsx`).

**Why it matters beyond tidiness.** Each dead file contains its own full copy of check-in logic, location handling, payload construction and error handling. An engineer told to "fix check-in" opens `ShiftDetailsScreen.tsx` — the obvious filename — edits it, tests nothing, and ships a no-op. During this audit the dead v1 file's check-in payload (`ShiftDetailsScreen.tsx:487`) was the first hit for several greps; the live path had to be established separately via the navigator.

**Fix.** Delete the unrouted v1 screens, or drop the aliases so imports read `ShiftDetailsScreenV2` and the live file is obvious from the navigator. Deleting is better. Verify each is unrouted before removal — grep the navigators for the component, not the filename.

---

### P-M2 — Three different geofence radii, none of them the venue's

**Severity:** Medium · `VERIFIED-STATIC`

`CheckInFlowV2.tsx:116-118` passes a hardcoded `100` to `locationService.verifyLocation`. `src/utils/constants.ts:52` declares `MAX_CHECK_IN_DISTANCE: 50`, used nowhere in the flow. The server's actual truth is `venue.check_radius` (`backend/api/models.py:1215`, default 100 but configurable per venue).

A venue set to 500 m has the app block officers the server would accept. A venue set to 25 m has the app accept, then the server reject — **after** the officer has captured a photo and drawn a signature, which is the worst possible moment to fail.

**Fix.** Pass `venue.check_radius` from the shift payload into `verifyLocation`; delete the dead `MAX_CHECK_IN_DISTANCE` constant. Confirm `check_radius` is present on the mobile shift serializer output; add it if not. Treat the client check as advisory UX only — the server remains authoritative (it already is).

---

### P-M3 — GPS accuracy and mock-location flags are discarded

**Severity:** Medium · `VERIFIED-STATIC` · pairs with backend **P2-5**

`LocationCoordinates` (`src/services/locationService.ts:9-12`) carries only `latitude`/`longitude`. `expo-location` returns `coords.accuracy` and, on Android, `location.mocked` — both dropped at `:57-60`. The web client discards accuracy the same way (`frontend/src/services/shiftService.ts:475`), so this is systemic, not a mobile quirk.

**Fix.** Widen the type to carry `accuracy` and `mocked`; send both on check-in and check-out; persist server-side alongside the location JSON. Flag low-accuracy (> 100 m) and mock-provider fixes for manager review rather than blocking — a false block strands a real officer on a real site. Do the backend column in the same change as P2-5.

---

### P-M4 — Offline idempotency depends on matching server prose

**Severity:** Medium · `VERIFIED-STATIC`

`syncService.isAlreadyCompletedError` (`:250-265`) decides whether a queued action already succeeded by substring-matching English error text:

```ts
return errorMessage.includes('already checked in') ||
       errorMessage.includes('shift already checked in');
```

The server returns exactly `"Shift already checked in"` (`backend/shifts/views.py:1039`) — so it works **today**, by coincidence of wording. Any copy edit to that string silently converts a correctly-completed action into a retry storm and then a `failed` item. This is the idempotency gap the audit brief asked about, and it is one string edit from breaking.

**Fix.** Return a stable machine-readable `code` on these responses (the checkout logbook gate already does this — `"code": "logbook_signoff_required"`, `backend/shifts/views.py:1173`). Match on `code`, never on prose. Better still: send a client-generated idempotency key per queued action and have the server treat a replay as a success.

---

### P-M5 — Location fetch can hang forever

**Severity:** Low · `VERIFIED-STATIC`

`getCurrentPositionAsync` (`src/services/locationService.ts:54-58`) has no timeout, so a device that cannot get a fix hangs the check-in flow indefinitely. It is also passed `timeInterval` and `distanceInterval`, which are `watchPositionAsync` options and no-ops here.

**Fix.** Wrap in `Promise.race` with a ~15 s timeout and an actionable error; drop the two inert options.

---

### P-M6 — Dead check-in methods that would 404

**Severity:** Low · `VERIFIED-STATIC`

`shiftsService.checkIn` / `checkOut` (`src/services/shiftsService.ts:268,294`) POST to `/api/v1/shifts/{id}/check-in/` and `/check-out/` with **hyphens**. DRF's `@action` with no `url_path` derives the path from the method name, so the real routes are `check_in/` and `check_out/` with **underscores** (`backend/shifts/views.py:1012,1140`). These two methods have **zero callers** — every live path goes through `API_ENDPOINTS.SHIFTS.CHECK_IN` (`src/config/api.config.ts:129`), which is correct. They are dead code holding a loaded 404 for whoever wires them up next.

**Fix.** Delete both, or point them at `API_ENDPOINTS`. Do not leave them.

---

### P-M7 — Debug hygiene and key rotation

**Severity:** Low · `VERIFIED-STATIC`

- **134** `console.log` calls in `mobile/src` (67 more in `frontend/src`). A `logger` utility already exists and is used properly in the services — route everything through it and strip in release builds.
- **Rotate the historically leaked Firebase key.** `..bfg-report/2026-01-22` shows history was rewritten and `656b89a6` untracked the file — both correct — but the key in `mobile/google-services.json` was public before the rewrite. History rewriting does not un-leak a credential. Confirm with Mead Security that it was rotated in the Google console; if not, rotate. `NEEDS-BUSINESS`

---

## Test plan

**New files**

| File | Covers |
| --- | --- |
| `backend/shifts/test_shift_authz.py` | P0-1, P0-2 |
| `backend/api/tests/test_invoice_authz.py` | P0-3 |
| `backend/api/tests/test_sia_authz.py` | P0-4, P0-5, P2-1 |
| `backend/api/tests/test_tenant_isolation.py` | P0-2, P0-6, P1-6, P1-7 — cross-tenant matrix |
| `backend/api/tests/test_invoice_concurrency.py` | P1-1 (`TransactionTestCase`) |

**Extended:** `shifts/test_overnight_attendance.py` (P1-2) · `api/tests/test_payroll_math.py` (P1-3) · `shifts/tests.py` (P1-4)

**Running them — repo-specific traps:**

```bash
# scope the path; a bare pytest collects ~24 legacy scripts that hit the dev DB on import
docker compose exec api pytest api/tests/ shifts/ shifts/tests.py leave_management/ -q
```

`shifts/tests.py` **must be named explicitly** — pytest's default `python_files` patterns do not match the bare name `tests.py`, so `pytest shifts/` silently skips the largest suite in that app. Same trap for `api/tests.py`, `leave_management/tests.py`, `finance_integrations/tests.py`.

**Edge cases from the brief, mapped:**

| # | Case | Status |
| --- | --- | --- |
| 1 | Two people claim the final slot | Already safe — `claim_shift` uses `select_for_update`. Add a regression test. |
| 2,3,4 | Double check-in / double check-out / check-out without check-in | Already blocked by state guards. Add regression tests. |
| 5,6 | Two shifts at once / overlapping assignment | **P1-4** |
| 7,8 | Shift cancelled or officer removed after check-in | `NEEDS-BUSINESS` — behaviour undefined today |
| 9,10 | Shift edited / time changed after check-in | Partly guarded (`perform_update` blocks `in_progress` for non-admins); admin path unguarded |
| 11,12,13 | Network drop / duplicate request / refresh mid-operation | Largely idempotent by accident — attendance is columns on the shift row, not append-only rows. Verify, then make it idempotent *by design*. |
| 15 | Device clock manipulated | **Already safe** — timestamps are `timezone.now()` server-side |
| 16,17 | GPS unavailable / spoofed | **P2-3, P2-5** |
| 18 | Shift crosses midnight | Handled — `is_overnight_shift` logic + `test_overnight_attendance.py` |
| 19 | Shift crosses DST | Safe — durations are computed from absolute UTC timestamps |
| 20,22 | Expired SIA licence | **P2-1** |
| 23 | Payment generated twice | **P1-1** |
| 24 | Attendance modified after payroll approval | **P1-5** |
| 25 | Access another user's data | **P0-2, P0-3, P1-7** |

---

## Regression protocol

Per PR: `pytest` on the scoped paths, compared **per-file** against `/tmp/baseline.txt` · `npm run lint` (biome + `tsc --noEmit`) · `npm run build` · `makemigrations --check --dry-run` to catch model drift · `mobile: npm test` if mobile is touched.

There is **no frontend test suite and no `npm test` script** (`docker/README.md` still advertises one — it is stale). Do not claim frontend test coverage. Frontend verification is lint + build + manual walkthrough of scheduling, attendance and payroll.

---

## Open questions — do not guess (Rule 7)

1. **Is auto-approval intended?** (P2-2) Every location-verified check-out currently self-approves and generates an invoice. Real policy, or drift?
2. **Hours basis.** (P1-3, P3-3) Four consumers, three answers: pay uses scheduled−break, OT accumulates on actual, invoice headers report actual, invoice lines report scheduled. The docstrings say scheduled is intended — confirm, then make everything agree.
3. **Expired licence at check-in.** (P2-1) Hard block, or allow-with-alert? A hard block can strand an officer on site over a data-entry error.
4. **Cancelled or unassigned after check-in.** (Edge 7, 8) Undefined today. What *should* happen to the hours already worked?
5. **Historical rate changes.** Does changing a `PayRate` today alter what an unpaid-but-approved past shift is worth? Current behaviour: `Shift.hourly_rate` is snapshotted at creation and wins, so past shifts are stable — but only if `hourly_rate` was set. If it was `NULL`, the shift resolves live through the `PayRate` cascade and **will** change retroactively. Confirm this is understood.
6. **P1-2 back-correction.** (Phase 0.3) If historical shifts went unpaid, how does Mead Security want to settle them?

---

## Change log

Rule 9: record intent before modifying, and outcome after. Nothing has been modified yet.

| Date | Item | Files | Intended change | Actual change | Verified by | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-07 | P0-2 | `shifts/urls.py`, `shifts/views.py` | Delete the unused `frontend/` CRUD routes, narrow to `GenericViewSet`, add a company-scoped `get_queryset`, port the `is_published` and logbook gates. | As intended. `cancel` removed with the routes. | `shifts/test_shift_authz.py::FrontendShiftViewSetTenancyTests` (7 tests) — all failed pre-fix. | Done |
| 2026-09-07 | P0-1 | `shifts/serializers.py`, `shifts/views.py`, `api/permissions.py` | Split the serialiser by audience, role-gate the write verbs, validate venue tenancy. | As intended. Added `IsManagerOrAdmin`; `StaffShiftSerializer` freezes pay/approval/attendance columns; venue tenancy check reuses the `bulk_create` rule. | `shifts/test_shift_authz.py::StaffShiftWriteAuthzTests` (6 tests) — 4 failed pre-fix. | Done |
| 2026-09-07 | P0-3 | `api/serializers.py`, `api/views.py` | Explicit field list on `InvoiceSerializer`, role-gate write verbs, force `staff_user` server-side. | As intended. All financial columns read-only; `perform_create` resolves `staff_user` from the acting company. | `api/tests/test_invoice_authz.py` (7 tests) — 6 failed pre-fix. | Done |
| 2026-09-07 | P0-4 | `api/models.py`, `api/serializers.py`, `api/views.py`, migration `0068` | Role-gate the licence ViewSet, make `status` server-derived, add 16-digit validation, keep the staff submission journey. | As intended. New `verified_by`/`verified_at` columns and an `approve` action; approving an already-expired licence yields `expired`, not `valid`. | `api/tests/test_sia_authz.py::SIALicenceAuthzTests` (9 tests) — 6 failed pre-fix. | Done |
| 2026-09-07 | P0-5 | `api/serializers.py`, `api/signals.py`, migration `0068` | `security_roles` read-only for non-approvers; audit every change. | As intended. Fails closed when no request is in serialiser context. New `audit_security_roles_change` signal. | `api/tests/test_sia_authz.py::SecurityRolesAuthzTests` (2 tests) — both failed pre-fix. | Done |
| 2026-09-07 | P0-6 | `api/permissions.py`, `api/views.py` | Implement the no-op `get_permissions`; audit geofence changes. | **Partially did not reproduce.** The exploit is not live: `create`/`update`/`destroy` each carry an explicit `role != 'admin'` check, so staff already got 403. Implemented the declarative gate at the *enforced* strictness (admin-only, not manager-or-admin as the plan proposed — that would have loosened it) and added the missing geofence audit. | `api/tests/test_venue_geofence_authz.py` (7 tests) — 1 failed pre-fix (the missing audit). | Done, finding corrected |

---

## Appendix — what is already right

Worth stating so nobody "fixes" it:

- **Money is `Decimal` end to end.** No float arithmetic in the pay path.
- **Attendance timestamps are server-stamped** (`timezone.now()`), so device-clock manipulation cannot affect hours.
- **The row-per-slot shift model** makes capacity-counter drift structurally impossible. Do not introduce a counter.
- **`claim_shift` uses `select_for_update`** — the last-slot race is already correct.
- **Login has rate limiting (IP *and* per-username) plus account lockout.**
- **Bank details use `EncryptedCharField`**; OAuth client secrets use `EncryptedJSONField` and are `write_only`.
- **File uploads validate magic bytes**, not just `Content-Type`.
- **`bulk_create` has a genuine tenant guard** on both venues and staff — it is the model the single-shift path should copy.
- **WebSocket auth requires a valid JWT** and uses per-user groups.
- **Security headers, HSTS, SSL redirect, secure cookies** are all correctly gated on `not DEBUG`; CORS does not allow all origins in production.
- **The payroll OT engine** — per-tier line items, revenue-neutral assertion, sibling-invoice cascade, paid-invoice lock — is careful work. P1-3 and P1-5 are gaps in it, not reasons to replace it.
