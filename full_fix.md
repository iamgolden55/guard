# full_fix.md — Autonomous remediation runbook

**Companion to `GOAL.md`.** `GOAL.md` is the analysis: what is broken, where, and why. This file is the execution contract: the order, the gates, and — critically — **every decision pre-made**, so the run needs no input from the user between start and final report.

**Invoke with:**

```
Read GOAL.md and full_fix.md at the repo root. Execute full_fix.md end to end.
Do not ask me questions — every decision you need is pre-made in the DEFAULTS
table. If you hit something not covered, apply the Unknown-Case Rule and keep
going. Report at the end.
```

---

## 1. The rule that makes this safe

> **Never change what anybody gets paid without an explicit instruction.**

Everything else — authorisation, tenant isolation, constraints, indexes, dead code, silent failures — can be fixed autonomously, because the correct behaviour is not in question. Pay is different: several findings in `GOAL.md` are places where the *current* behaviour is wrong but *changing* it moves real money for real officers, in both directions. Those are implemented but **left switched off**, behind a flag, with a before/after report attached. Flipping the flag is a human decision, made later, with the numbers in hand.

This is why the run needs no questions: the ambiguous cases have a pre-decided answer, and that answer is always "build it, prove it, don't arm it."

### Unknown-Case Rule

If something arises that this file does not cover:

1. Choose the option that **preserves existing observable behaviour**.
2. Do it anyway if it is purely additive (a test, a log line, an index, a comment).
3. Do **not** do it if it changes an API contract, a pay calculation, or a DB row's meaning.
4. Record it in the final report under *Deferred — needs a decision*, with what you would have done.

Never guess at a business rule. Never widen scope to "while I was in there."

---

## 2. DEFAULTS — every open question, pre-answered

These are the six `NEEDS-BUSINESS` items from `GOAL.md`, plus the pay-affecting ones. **Do not ask about any of these. Apply the default.**

| # | Question | **Default for this run** | Why |
| --- | --- | --- | --- |
| D1 | Is auto-approval (P2-2) intended? | **Assume yes. Do not change it.** Add a `system_approved` boolean set alongside `manager_approved`, and populate it going forward so the two become distinguishable. Do not alter who gets approved or when. | Turning it off would stop all invoice generation overnight. Purely additive. |
| D2 | Which "hours" basis is correct? (P1-3, P3-3) | **Scheduled − break is the pay basis** — it is what the code does today and what its docstrings state. Align the OT accumulator and invoice header to it. Ship behind `SETTINGS.OT_BASIS_ALIGNED` defaulting **False**. | Fixes a real inconsistency without moving anyone's pay until the flag flips. |
| D3 | Expired SIA licence at check-in? (P2-1) | **Allow the check-in, raise a blocking manager alert, mark the shift for review.** Do not hard-block. | A hard block strands a real officer on a real site over a data-entry error. Alert-first is reversible; a stranded guard is not. |
| D4 | Shift cancelled / officer unassigned after check-in? (Edges 7, 8) | **Preserve current behaviour.** Add an `AuditLog` entry and a manager notification when it happens. Do not add new blocking rules. | Behaviour is genuinely undefined; inventing a rule is out of scope. |
| D5 | Do breaks start being deducted? (P-M1b) | **No.** Delete the dead break plumbing only. Add a metric counting shifts over `break_trigger_hours` with `break_duration == 0`. **Do not populate `break_duration`.** | The moment it is non-zero, every officer's pay drops ~20-30 min/shift. That needs notice, not a commit. |
| D6 | Firebase key rotation (P-M7) | **Out of scope for code.** Add to the final report as an action for the user. | Console action, not a repo change. |
| D7 | Historical back-corrections (P1-2, Phase 0.3) | **Report only. Write no data-fix migration.** Produce counts and a CSV of affected shifts. | Restating past payroll is the company's call. |
| D8 | Anything that would delete or rewrite existing rows | **Never.** Additive migrations only (new columns, constraints, indexes). | A bad data migration is the one thing here that is not revertable. |

**Constraint migrations are the exception that needs care.** P1-1 and P1-4 add unique/exclusion constraints that **will fail to build if violating rows already exist**. Do not delete the violators. Instead: run the detection query, and if it returns rows, generate the migration but leave it **unapplied**, with the offending IDs in the report. Detection queries are in `GOAL.md` under P1-1 and P1-4.

---

## 3. STOP conditions

Halt and report immediately — do not continue, do not work around:

- **S1** — A P0 fix breaks an existing passing test and the cause is not obvious within two attempts.
- **S2** — A constraint migration fails to apply against local data (this means production has violating rows).
- **S3** — A finding does not reproduce. Do not "fix" it. Record that the audit was wrong and move to the next item.
- **S4** — Any change would require deleting or rewriting existing rows.
- **S5** — Test baseline cannot be established (Docker won't start). Everything downstream depends on it.
- **S6** — A fix requires a credential, an external service, or production access.

On any stop: commit what is complete and green, then report. Partial progress that is verified beats a full pass that is not.

---

## 4. Execution

### Batch 0 — Baseline (blocking)

```bash
cd docker && docker compose up -d          # wait for api healthy
docker compose exec api pytest api/tests/ shifts/ shifts/tests.py leave_management/ \
  -q --tb=no > /tmp/baseline.txt 2>&1 || true
```

`shifts/tests.py` **must be named explicitly** — pytest's `python_files` patterns don't match the bare name `tests.py`, so `pytest shifts/` silently skips the largest suite in that app. Same for `api/tests.py`, `leave_management/tests.py`, `finance_integrations/tests.py`.

Never compare totals — ~51 tests already fail on a clean checkout, and `api/tests/test_optimized_reporting_pipeline.py` errors on import (`psutil` missing). **Compare per-file counts.** Do not fix a pre-existing failure inside any batch below; note it and move on.

Then run the D7 detection queries and save the output. Do not act on them.

**Gate:** baseline file exists and is non-empty, or **S5**.

---

### Batch 1 — P0 security (branch `fix/p0-security`)

`GOAL.md` P0-1 … P0-6. One branch, one PR.

Order matters — do P0-2 first (it is deletion, lowest risk, highest exposure), then the serialiser work:

1. **P0-2** — delete unused routes, narrow to `GenericViewSet`, add scoped `get_queryset`, port the `is_published` and logbook gates.
2. **P0-1** — split `ShiftSerializer` by audience; role-gate writes; validate venue tenancy.
3. **P0-3** — explicit field list on `InvoiceSerializer`; role-gate write verbs; force `staff_user` server-side.
4. **P0-4** — role-gate `SIALicenseViewSet`; make `status` server-derived.
5. **P0-5** — `security_roles` read-only; extend the existing `audit_user_role_change` signal to cover it.
6. **P0-6** — implement `VenueViewSet.get_permissions`'s docstring; audit geofence changes.

**Write the reproduction test first, watch it fail, then fix.** If it passes before the fix, that is **S3** — the audit was wrong about that item; record it and move on.

**Safe to proceed on P0-1:** the live mobile check-in payload is `{latitude, longitude, photo, signature}` only (`mobile/src/screens/shifts/v2/ShiftDetailsScreenV2.tsx:315-320`) — it does not send `check_in_time`, so making those fields read-only cannot break mobile. Verified during the audit.

**Gate:** new tests pass · per-file baseline unchanged · `npm run lint` and `npm run build` clean in `frontend/`.

---

### Batch 2 — P1 data integrity (branch `fix/p1-integrity`)

`GOAL.md` P1-1, P1-2, P1-4, P1-5, P1-7, P1-8. **P1-3 and P1-6 are excluded** — see Batches 3 and 4.

- **P1-2 first.** It corrupts the column P1-3 later reads, it is the smallest fix here, and it is the one currently costing officers money. Produce the D7 report as part of it.
- **P1-1 and P1-4** add constraints — run detection first, honour the D8 exception.
- **P1-4's indexes are unconditionally safe.** Ship them even if the exclusion constraint is held back.
- **P1-7** — sweep the whole `leave_management/views.py` module, not just the three cited lines.

**Gate:** as Batch 1, plus every new migration applies cleanly on a fresh `docker compose down -v && up`.

---

### Batch 3 — P1-6 tenant resolution (branch `fix/p1-tenant-context`, alone)

`X-Company-ID` is currently a no-op — `TenantMiddleware` runs before DRF authenticates, so `request.current_company` is always `None` on JWT requests, and every helper silently takes its fallback branch.

**This gets its own branch and its own test pass.** It touches every scoped queryset in the codebase; bundling it with anything else makes the diff unreviewable and a regression untraceable.

Include: the DRF-level resolver, replacing the ~6 duplicated `get_user_company` copies with one helper, and **correcting the misleading `SECURITY: respects X-Company-ID header` comments** — they currently document behaviour that does not exist.

**Gate:** the multi-company test matrix in `GOAL.md` P1-6 passes, plus full baseline unchanged.

---

### Batch 4 — Pay-affecting, built but disarmed (branch `fix/p1-ot-basis`)

**P1-3** (OT accumulator basis) and **P3-3** (invoice header reconciliation).

Per **D2**: implement the `payable_hours` column and align the accumulator and invoice header to it — **behind `SETTINGS.OT_BASIS_ALIGNED`, default `False`.** With the flag off, behaviour is byte-identical to today.

Then produce the evidence for the human decision:

- A management command that runs both bases over the last 12 weeks and emits a per-officer CSV: current pay, aligned pay, delta.
- Summary totals in the final report.

**Do not flip the flag.** Do not "fix" a delta you think looks wrong.

**Gate:** with the flag off, `api/tests/test_payroll_math.py` is byte-identical in outcome to baseline. With it on, the new tests pass. Both asserted.

---

### Batch 5 — P2 compliance and attendance (branch `fix/p2-compliance`)

P2-1 (per **D3**: allow + alert, never block) · P2-3 (Haversine primary; skip the self-comparison Maps call) · P2-4 (server-set `timestamp` and `venue_capacity`; validate shift ownership; apply to `FireExitCheck` and `ToiletCheck` too) · P2-5 + P-M3 (accuracy and `mocked`, one change across backend, web, mobile) · P2-6 (constraint + lock in `approve_claim`) · P2-7 (audit trail) · **P2-8** (server-side end-time bound on check-in, aligned client constant).

P2-8 is a genuine hole — the server currently accepts a check-in hours after a shift ended, and only the mobile UI declines to send it.

---

### Batch 6 — Mobile (branch `fix/mobile`)

`GOAL.md` P-M section.

- **P-M1** — offline replay: `occurred_at` in a **separate** column, never overwriting the server-stamped time; surface failed queue items to the user. This is the silent-data-loss fix; it matters most.
- **P-M1b** — per **D5**: delete the dead break plumbing, add the metric, **do not populate `break_duration`.**
- **P-M1c** — delete the unrouted v1 screens (~4,400+ lines). Verify each is unrouted by grepping the *navigators for the component*, not the filename — the navigators alias V2 screens to v1 names.
- **P-M2** — pass `venue.check_radius` through; delete the dead `MAX_CHECK_IN_DISTANCE`.
- **P-M4** — machine-readable `code` on already-completed responses; match on that, never on prose.
- **P-M5**, **P-M6**, **P-M7** — timeout, delete the dead 404 methods, route logs through the existing `logger`.

**Gate:** `cd mobile && npm test` · `npx tsc --noEmit`.

---

### Batch 7 — P3 cleanup (branch `chore/p3-cleanup`)

Everything in the `GOAL.md` P3 table **except P3-1** (open registration). P3-1 changes who can create an account — treat as pay-adjacent: implement the invite gate behind a setting defaulting to current behaviour, and report.

Run `pip-audit` and report; upgrade patch versions only.

---

## 5. Per-batch discipline

Every batch, without exception:

1. Branch from latest `main`.
2. Reproduction test first — watch it fail.
3. Smallest fix that addresses the root cause, not the symptom.
4. Full scoped test run; compare **per-file** against `/tmp/baseline.txt`.
5. `npm run lint` + `npm run build` if `frontend/` changed; `npm test` + `tsc --noEmit` if `mobile/` changed.
6. `makemigrations --check --dry-run` to catch unintended model drift.
7. Update the **Change log** table in `GOAL.md` — intended vs actual, per Rule 9.
8. Commit: conventional, lowercase, domain-scoped, describing behaviour not files — `fix(shifts): scope the frontend shift viewset to the acting company`.
9. Do not push and do not open a PR unless explicitly asked.

Everything runs inside Docker: `docker compose exec api …`, `docker compose exec web …`. Never bare `python manage.py` or `npm run` on the host.

---

## 6. Final report

```markdown
## Executed
Batch N — <branch> — <commits> — VERIFIED / PARTIAL / STOPPED(<code>)

## Fixed and verified
<item> — <what changed> — <test that proves it>

## Did not reproduce (S3)
<item> — what the audit claimed — what is actually true

## Built but disarmed
<item> — flag name — current state — what flipping it would do

## Deferred — needs a decision
<item> — why — what I would have done   ← D1-D8 land here

## Data findings (no code change)
P1-2 unpaid shifts: <count>, CSV at <path>
P1-1 duplicate invoices: <count>
P1-4 overlapping shifts: <count>
OT basis delta: <total £>, per-officer CSV at <path>

## Test delta vs baseline
Per file. Any change explained.

## Your actions
- Rotate the Firebase key (D6)
- Decide: OT basis flag, break deduction, unpaid-shift back-correction
```

**Report honestly.** Distinguish verified from assumed. If something was not run, say so. A partial run reported accurately is worth more than a complete run reported optimistically — every finding in `GOAL.md` came from reading source, not from executing it, and some of them will be wrong.
