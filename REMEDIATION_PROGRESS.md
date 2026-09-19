# Remediation progress

Live tracker for fixing the 2026-09-17 engineering audit (`AUDIT-2026-09-17.md`).
The audit says what is wrong. This file says what has been done about it, what is next, and what is waiting on you.

**Last updated:** 2026-09-19 · **Current branch:** `fix/p0-sia-warn` · **Now working on:** Phase 1E (SIA warn-and-record)

Status key: ✅ done and verified · 🟡 in progress · ⏳ not started · 🙋 needs you · ❌ did not reproduce (audit corrected)

---

## At a glance

| Phase | What it is | Status |
| --- | --- | --- |
| 0 | Containment: rotate secrets, lock signup, snapshot, prod checks | 🙋 waiting on you (code parts ✅) |
| 1A | Safety net: pytest config, CI, baseline | ✅ committed |
| 1B | Tenancy and authorisation P0s | ✅ committed, no regressions |
| 1C | Money P0s (client bill rate, manager hour overrides, mark-paid) | ✅ committed, no regressions |
| 1D | Mobile check-in data loss | ✅ committed, no regressions |
| 1E | SIA role↔licence, warn and record | ✅ committed, no regressions |
| — | **Stop and report** after 1E | ✅ report below — waiting on your review |
| 2 | Reliability (backups, alerts, PROTECT, pay basis, Xero, web honesty) | ⏳ planned |
| 3 | Product completion (no-show alerts, manager inbox, incident evidence) | ⏳ planned |
| 4–5 | Scale, advanced | ⏳ planned |

The full phase plan, with the reasoning for its order, is in `~/.claude/plans/pasted-content-id-e5a5-it-beautifully-valiant-mist.md`.

---

## What's next, in order

1. **1C: money** (branch `fix/p0-money`).
   - Price client invoices at `Shift.bill_rate`. A line with no bill rate is held as a draft and can't be issued until a manager sets the rate from the invoice (decision D-A). Officer pay does not move.
   - Route `force_complete` and `manual_checkout` through `record_attendance`, so the hours a manager types are the hours stored, junk and negative hours get a 400, and a locked invoice gets a 409.
   - Facade `mark-paid`: staff invoices must be `approved` first, and client invoices must be issued first.
   - Read-only report of historically under-billed client invoices (CSV only; it changes no data).
2. **1D: mobile** (branch `fix/p0-mobile-checkin`).
   - Delete the dead `CheckInFlowV2.tsx`.
   - Make check-in queue on connectivity failure and show the server's reason on a 4xx, as check-out already does.
   - Stop purging failed queue items at startup, and recover items stuck in `processing`.
   - Add the missing `check_out_time` to queued check-outs.
   - Let a flagged offline replay lift an *automatic* no-show into manager review.
   - Get `tsc` running, and add Jest tests for `syncService`.
3. **1E: SIA** (branch `fix/p0-sia-warn`). One role→licence mapping, evaluated on every assignment path. Warnings are returned to the manager and logged when overridden. The check-in alert extends to role mismatch.
4. **Stop.** Report in the `full_fix.md` §6 format, with the test delta per file.

---

## Phase 0: containment

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 0.1 | Rotate the Twilio SID/token, the WhatsApp webhook secret and the Firebase key | 🙋 | All still in git history: `agents/.env.whatsapp` (`72e8f04d`), `mobile/google-services.json` (`a1e0cd88`). Rotating at the provider is what makes them safe. |
| 0.2 | `REGISTRATION_REQUIRES_INVITE=True` on Render | 🙋 | Pauses web self-serve company signup until GA. Mobile has no signup. |
| 0.3 | Manual Postgres snapshot; confirm the backup plan and retention | 🙋 | Needed before Phase 1 deploys, because 1C adds a migration. |
| 0.4 | Read-only production checks | ✅ written · 🙋 run | `docs/audit-2026-09-17-prod-checks.sql`. Dry-run on dev reproduces the audit's figures. Section (b) says whether the fail-open exposure was used; (c) decides one 1C item. |
| 0.5 | Audit into the repo; `CLAUDE.md` corrected | ✅ | `2850972a` |

## Phase 1A: safety net ✅ (`chore/test-safety-net`, `1b42f1f3`)

- A bare `pytest` now collects all 609 real tests and none of the loose scripts. `api/tests.py` had been uncollectable, so it moved into the `api/tests/` package. One dead test file was removed.
- `DJANGO_TEST_DB_NAME` isolates concurrent test runs.
- **Baseline (isolated DB):** 429 passed · 170 failed · 9 errors · 1 skipped. The regression-guard set passes 246/246.
- CI (`.github/workflows/ci.yml`):
  - required: regression guards, frontend build (`tsc` + vite), mobile Jest, gitleaks
  - informational: the full suite and biome (337 standing errors)
- Mobile baseline: Jest 45 passed, 1 skipped.

## Phase 1B: tenancy and authorisation ✅ (`fix/p0-authz`)

Every fix below has a reproduction test that failed before the fix and passes after, in `api/tests/test_p0_authz.py` (35 tests).

| Audit ref | Fix | Status |
| --- | --- | --- |
| P0-A / ENG-002 | Billing helpers `_client_qs`, `_staff_qs` and `_company_qs`, plus `StatementViewSet`, return `.none()` when no company resolves | ✅ |
| P0-F / ENG-004 | Billing facade, payroll runs, statements, finance providers and the Xero export are manager/admin only. Officers read their own pay via `/invoices/`. | ✅ |
| S-22 / ENG-005 | `create_multi_staff`: role gate; the venue and every staff member must belong to the acting company; it can't create a shift already `approved` | ✅ |
| ENG-006 | `PATCH /users/me` no longer writes `security_roles`; `is_approved` is read-only on staff profiles | ✅ |
| P0-G | An officer of an existing company can't create a tenant. A genuine new signup still can. | ✅ |
| P0-E / ENG-009 | Compliance violations, working-hours metrics, summaries, reports, alerts and bulk resolve are scoped to the company. `set_active` chooses the profile for the admin's own company. | ✅ |
| S-3 / S-15 | Running a report template's stored SQL is platform-staff only; preview `limit` must be an integer from 1 to 1000 before any SQL runs | ✅ |
| P1-k | The shadow company resolver in `shifts/serializers.py` delegates to the shared one; the venue guard fails closed | ✅ |
| ENG-010 | Tenancy ratchet (`api/tests/test_tenancy_ratchet.py`): queryset inspection plus an HTTP pass over every list route. Proven to catch a reverted P0-A fix. | ✅ |
| — | Full backend suite, per file vs baseline | ✅ only improvements: `test_onboarding_api.py` 15 → 12 failures, +37 new passing tests, every other file identical (469 passed / 167 failed / 9 errors) |

**Found beyond the audit, and fixed:**
- `StatementViewSet` and `PayrollRunViewSet` had the same fail-open / no-role-gate shape.
- `initiate_onboarding` also promoted the caller to `role='admin'`.
- The facade's `PAY-<n>` fallback matched *any* invoice with pk `n`, so mark-paid on one number could settle a different invoice.
- `set_active`, and regulation `activate`/`deactivate`, declared `IsAdminUser`, but the ViewSet's `get_permissions()` override discarded it. **Any logged-in account**, officers included, could switch a tenant's working-time profile, or switch off a country's regulation that the overtime engine reads.
- Five statutory-check ViewSets (capacity, fire exit, toilet, logbook sign-off, missed slots) failed open the same way. The ratchet found them.
- Report jobs, and their downloadable files, were visible across tenants to any `role='admin'` user.
- The Xero export bound an invoice to whichever tenant connected Xero first.
- The compliance violations endpoint crashed on every request: two DRF `source=` assertions in its serializer.

**Corrected from the audit:**
- S-15 (report `limit` injection) is real, but weaker than reported. The injected SQL executed and the response then failed, so an attacker got a 400 and a timing side-channel, not rows. Fixed anyway.

**Recorded for Phase 2, not changed:**
- Officers can self-edit `pay_frequency` and `employmentType` on their own profile. These may decide which payroll run includes them; changing them would affect pay behaviour, so it needs a decision.
- `BlackoutPeriodsViewSet` is admin-only but unscoped. It's on the ratchet allowlist.
- Two compliance dashboard endpoints return hard-coded fixture numbers rather than data.

## Phase 1C: money ✅ (`fix/p0-money`)

Reproduction tests: `api/tests/test_p0_money.py` (13). 11 failed before the fixes; all 13 pass after.

| Audit ref | Fix | Status |
| --- | --- | --- |
| P0-D / ENG-008 | Client lines are priced at `Shift.bill_rate`. A line with no bill rate is held (priced at £0, flagged `needs_rate`), and issue/send refuse until a manager sets the rate. | ✅ |
| P0-D | Managers set a missing client rate from the invoice itself: the click-to-edit rate cell now works on client drafts and writes `bill_rate` only. Officer pay (`hourly_rate`) never moves. A held line reads "Rate needed" rather than £0.00. | ✅ |
| P0-D | Measured on the seeded venue, 77 lines, in a rolled-back transaction: **24.00% realised margin**. The audit measured 1.45%. | ✅ |
| D-E | `manage.py report_client_billing_delta [--csv path]`: read-only, per-line under-billing on existing client invoices | ✅ |
| P1-a / P1-b | `force_complete` and `manual_checkout` go through `record_attendance` in one transaction. Typed hours persist (the audit's case was 8 typed, 9 stored). Negative or junk hours get a 400; over 24 h gets a 400 (was a raw 500); a locked invoice gets a 409 with nothing written. | ✅ |
| Payments that never happened | Facade mark-paid: staff invoices must be `approved`, and client invoices must have been issued | ✅ |
| — | Migration `0075` is additive only (one column, default false); `makemigrations --check` is clean | ✅ |
| — | Frontend build (with `tsc`) is clean; biome unchanged at 337 | ✅ |
| — | Full backend suite, per file vs baseline | ✅ versus 1B, the only change is +13 passing money tests; every other file identical (482 passed / 167 failed / 9 errors — all standing) |

**Pay-affecting, per decision D-G (please note):**
- If a shift already had attendance, the hours a manager types in force-complete or manual check-out now become a `TimeAdjustment`, and that is what pay reads. Before, the typed figure was silently ignored and pay stayed at scheduled hours.
- If a shift had no attendance, it still pays scheduled hours.

**Waiting on you:** the company filter on staff payroll generation (the "unverified but material" item) ships only if production check 0.4(c) shows no officer with two active memberships.

## Phase 1D: mobile check-in ✅ (`fix/p0-mobile-checkin`)

| Audit ref | Fix | Status |
| --- | --- | --- |
| Dead code first | Deleted `CheckInFlowV2.tsx`: 1,219 lines, routed but unreachable, and the file the last audit's offline fix went into | ✅ |
| P0-B / MOB-1 | Check-in handling follows one rule, shared with the tests (`src/utils/attendanceFailure.ts`). If the server refused, the officer sees its reason and "you are not checked in", and nothing is queued. If it's a connection problem or the server is down, the check-in is queued with the device time, and only then does the app say "saved on this phone". | ✅ |
| MOB-2 | Failed queue items are no longer deleted at every app launch | ✅ |
| Stranded items | On start-up, items left in `processing` when the app was killed are put back in the queue | ✅ |
| Replay time | Queued check-outs now carry `check_out_time` (the replay was sending `undefined`) | ✅ |
| P0-B backend | A replayed offline check-in can lift an *automatic* no-show into manager review, if the device time falls inside the shift. A manager-recorded no-show is never lifted. Nothing is auto-approved or auto-paid. | ✅ |
| Type-check | `tsc` runs again (it aborted on a config error): 247 errors before, 246 after, none in the files touched | ✅ |
| Tests | Mobile Jest 45 → 58 passing: the first coverage of the offline queue. Backend: `shifts/test_offline_no_show_recovery.py` (4). | ✅ |
| — | Full backend suite, per file vs baseline | ✅ versus 1C, the only change is +4 passing recovery tests (486 passed / 167 failed / 9 errors — all standing) |

**Honest limits:**
- If the officer is offline for the *whole* shift, the replay arrives after the shift has ended. The server still refuses it, and the app then shows its existing permanent-failure alert naming the shift and telling the officer to contact their manager. That is honest, but it is not automatic recovery.
- A live late arrival (running late, no queued attempt) still meets the no-show. That's the "running late" case in Phase 3.
- This only protects officers once they install the new build (EAS). Phase 2 adds a minimum-version gate.

## Phase 1E: SIA warn-and-record ✅ (`fix/p0-sia-warn`)

Following your choice: **warn and record, never block.**

| What | Status |
| --- | --- |
| One role→licence mapping (`api/utils/licence_requirements.py`) used by the scheduling preview, the create/update responses, the audit record and the check-in alert | ✅ |
| Roles with no licence mapping (steward, retail, static, mobile, event) are flagged `unverifiable_role`, not silently passed | ✅ |
| Every new assignment to an officer whose licence doesn't cover the role writes an AuditLog `licence_warning` row, whichever path made it. It's recorded once, not on every re-save. | ✅ |
| Manager sees it: a warning toast on create, edit, assign and move in the scheduler; a "licence check" marker on the bulk-wizard slot; `licence_warnings` in the multi-staff response | ✅ |
| Check-in alert now also fires for a valid licence of the *wrong kind* (e.g. CCTV on a door) | ✅ |
| Tests: `api/tests/test_sia_assignment_warnings.py` (10). 7 failed without the fix, confirmed by stashing it; all pass with it. | ✅ |
| Frontend build clean, biome unchanged at 337 | ✅ |
| Full backend suite, per file vs baseline | ✅ versus 1D, the only change is +10 passing SIA tests (496 passed / 167 failed / 9 errors — all standing) |

**Caught by the regression guards:** my first mapping accepted only a licence with the same name as the role. So it flagged door-supervisor holders on security-guard shifts, which the previous audit's check-in guard says is fine. That matches the SIA's rule that a door supervisor licence also covers security guarding, so the mapping now accepts it. The guard was not changed, and two new tests pin the rule both ways.

**Needs your confirmation (business rules I didn't invent):**
- A door supervisor licence covering security-guarding shifts: now assumed, per the SIA and the existing guard. Tell me if your contracts say otherwise.
- What do the steward, retail, static, mobile and event roles require? They are flagged "unverifiable" until you tell me.

---

## Decisions in force

| # | Decision |
| --- | --- |
| D-A | A client line with no `bill_rate` is held as a draft until a manager sets it |
| D-B | SIA role↔licence mismatch at assignment: warn and record, don't block |
| D-C | Nothing that moves an officer's pay ships armed: build it, prove it, report it, and you flip it |
| D-D | Migrations are additive only; existing rows are never deleted or rewritten |
| D-E | Historical under-billing and orphaned invoice headers: report only |
| D-F | Client invoice hours basis unchanged in Phase 1 (only the rate changes) |
| D-G | Manager-typed hours on force-complete / manual check-out are honoured |

## Waiting on you

- [ ] Rotate the Twilio, WhatsApp and Firebase credentials (0.1)
- [ ] Set `REGISTRATION_REQUIRES_INVITE=True` on Render (0.2)
- [ ] Take a Postgres snapshot and confirm the backup plan (0.3)
- [ ] Run `docs/audit-2026-09-17-prod-checks.sql` against production and share the output (0.4)
- [ ] Confirm the SIA role→licence mapping, including whether a door supervisor licence covers security guarding (1E)
- [ ] After Phase 1: review, merge, deploy (backend → web → EAS build), and enable branch protection once CI has run
