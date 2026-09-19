# Remediation progress

Live tracker for fixing the 2026-09-17 engineering audit (`AUDIT-2026-09-17.md`).
The audit says what is wrong. This file says what has been done about it, what is next, and what is waiting on you.

**Last updated:** 2026-09-19 · **Current branch:** `fix/p2-authz` · **Now working on:** Phase 2C (the product bugs 2B surfaced, then money integrity)

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
| 2 | Reliability (backups, alerts, PROTECT, pay basis, Xero, web honesty) | 🟡 in progress (2A) |
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

## Phase 1 report (2026-09-19)

### Executed

| Batch | Branch | Commit | Result |
| --- | --- | --- | --- |
| 1A safety net + docs | `chore/test-safety-net` | `1b42f1f3`, `2850972a` | VERIFIED |
| 1B tenancy and authorisation | `fix/p0-authz` | `be4d3e32` | VERIFIED |
| 1C money | `fix/p0-money` | `513c617e` | VERIFIED |
| 1D mobile check-in | `fix/p0-mobile-checkin` | `418af829` | VERIFIED |
| 1E SIA warn-and-record | `fix/p0-sia-warn` | `e2452f0e` | VERIFIED |

The branches are stacked in that order on top of `fix/sia-licence-cards`. **Nothing is pushed or merged.** `fix/audit-second-pass` and `fix/sia-licence-cards` need to reach `main` first.

### Test delta vs the pre-change baseline (isolated DB, per file)

| | Before | After |
| --- | --- | --- |
| Backend passed | 429 | **496** |
| Backend failed / errors | 170 / 9 | **167 / 9** (all standing; none new) |
| Regression-guard set (CI gate) | 246 | **311**, all passing |
| Mobile Jest | 45 | **58** |
| Mobile `tsc` | did not run | runs; 247 → 246 errors |
| Frontend build / biome | clean / 337 | clean / 337 |

The only per-file changes are new test files, all passing, and `api/test_onboarding_api.py` going from 15 to 12 failures. Every other file is identical to the baseline.

### Did not reproduce, or differed from the audit
- **S-15** (report `limit` injection): real, but weaker than reported. The injected SQL ran, but the response then failed, so an attacker got a timing side-channel rather than rows. Fixed anyway.
- **P0-E** (compliance): **worse** than reported. `set_active` and a country's regulation on/off switch were open to *any* signed-in account, officers included, not just tenant admins.
- **P0-G** (onboarding): the existing test couldn't pass under any correct rule, because its "staff" user had no company. Its fixture was corrected rather than the rule bent to fit it.

### Built but disarmed
Nothing new. `OT_BASIS_ALIGNED` from the previous audit is still off. Don't turn it on until `payable_hours` is backfilled (Phase 2); today it would zero every officer's overtime.

### Pay-affecting (per your decisions)
- **D-G:** if a shift already had attendance, the hours a manager types in force-complete or manual check-out now become a `TimeAdjustment`, which is what pay reads. Before, pay silently stayed at scheduled hours.
- **Client billing:** new client invoices use the bill rate. On the seeded venue that's 24% margin instead of 1.45%. Existing invoices are unchanged; `report_client_billing_delta` lists what they under-billed.

### Deferred: needs a decision
- The company filter on staff payroll generation. It ships only if production check 0.4(c) finds no officer with two active memberships.
- Officers can self-edit `pay_frequency` and `employmentType`. That's pay-adjacent, so I haven't changed it.
- The SIA mapping: confirm that a door supervisor licence covers security guarding (now assumed), and what steward, retail, static, mobile and event require.
- Whether to re-issue historically under-billed client invoices.

### Data findings (dev database; run the SQL for production)
- 413 of 418 approved shifts have no `payable_hours`, which blocks the overtime-basis fix.
- 10 staff invoice headers are no longer supported by their line items (CASCADE deletes).
- No dual-membership officers, no membership-less users and no cross-tenant invoice writes. Production may differ; that's what `docs/audit-2026-09-17-prod-checks.sql` is for.

### Deploying Phase 1 (your call), in order
1. Take a Postgres snapshot, then run the production checks.
2. Merge to `main`, oldest branch first. The backend deploys first; it stays compatible with the mobile builds officers already have installed.
3. Vercel deploys the web app.
4. Build a new EAS release with a build bump. The offline check-in fix only protects officers once they install it.
5. Enable branch protection on `main`, requiring `backend-guards`, `frontend`, `mobile` and `secrets` once CI has run once.

### Next after your review
Phase 2 (reliability). It starts by draining the tenancy-ratchet allowlist, repairing the three fixture drifts behind about 140 standing failures, a real health check, backups with a tested restore, and `PROTECT` on the money path.

---

## Phase 2: reliability 🟡

Batches, in order:

| Batch | Scope | Status |
| --- | --- | --- |
| 2A | Remaining authorisation gaps: default write routes weaker than their own actions; drain the ratchet allowlist | ✅ |
| 2B | Trustworthy tests: repair the fixture drift behind ~140 standing failures, then make the full suite a required CI check | ✅ fixtures repaired (48 real failures left; full suite becomes required once they're fixed) |
| 2C | Money integrity: `PROTECT` invoice lines, time adjustments and status history; backfill `payable_hours`; one definition of "outstanding"; Xero idempotency | ⏳ |
| 2D | Would we know? A readiness health check, one beat scheduler, an alert when a payroll run is missing, startup checks for security settings, a backup/restore runbook | ⏳ |
| 2E | Web honesty: fake payroll composition, dead bulk buttons, failures shown as "empty", admin role gate, company-scoped cache | ✅ |
| 2F | Mobile minimum-version gate; remove dead code | 🟡 mobile side done; server gate after 2B |

### 2A: authorisation gaps ✅ (`fix/p2-authz`)

| Finding | Fix | Status |
| --- | --- | --- |
| **Shift swaps:** creating a swap never checked the requester owned the shift. An officer could offer a colleague's shift, even another company's, to an accomplice, who accepted, and auto-approval reassigned it. | Requester must own the shift; the other officer must be in the same company; a bilateral swap's second shift must be theirs | ✅ |
| Swaps and releases could be created or PATCHed straight to `approved` (notifications go out as if a manager signed off), or deleted outright | Workflow fields are server-controlled; default update and delete are disabled (no client used them; the dedicated actions still work) | ✅ |
| 28 other ViewSets let an officer pass the permission check on default writes | Triaged one by one: 17 were escalations, all closed (below); the rest are genuine self-service | ✅ |
| **Finance:** an officer could repoint, reconfigure or delete the company's Xero connection, move it to another company by rewriting `created_by`, delete the earnings mapping payroll lines are built from, or run exports | The whole finance-integration surface is manager/admin only; `created_by` is read-only | ✅ |
| **Leave:** an officer could extend already-approved leave, which is paid per day | Officers can change or withdraw only draft/pending requests | ✅ |
| **Evidence:** an officer could rewrite or delete a colleague's fire-exit, capacity or toilet check, clear missed-check alerts, clear or delete their own compliance violations, or resolve their own incident reports | Those writes are manager/admin only; incident resolution goes through `resolve` only; incident venue/shift checked | ✅ |
| **Pay settings:** an officer could set their own employment category (drives paid leave and bank-holiday pay) and pay cycle, through either profile endpoint | Employer-set only | ✅ |
| **Other people's records:** an officer could move their unavailability onto a colleague (blocking their shifts), record terms acceptance for a colleague (unlocking their check-in), or add emergency contacts or preferred venues to anyone's profile | Bound to the caller's own profile and company | ✅ |
| Shift templates editable by officers, and templatable onto another company's venue; `apply` accepted any staff | Manager/admin only; venue and staff checked against the company | ✅ |
| Logbook sign-off could name another company's venue | Checked against the shift group | ✅ |
| `PATCH /users/{id}/` echoed a newly set password back in plain text | Password never returned | ✅ |
| Refused writes to leave types and policies crashed with a 500 (a permission *class* instead of an instance) | Refused cleanly with 403 | ✅ |
| **New guard** against this recurring | A second ratchet walks every ViewSet as an officer; the 52 remaining open write routes are each listed with a reason. A new open route fails CI until it's gated or justified. | ✅ |
| Full backend suite, per file vs end of Phase 1 | ✅ only change: +31 passing tests; every other file identical (527 passed / 167 failed / 9 errors — all standing) |

Tests:
- `api/tests/test_p2_exchange_authz.py` (9): 7 failed before the fix
- `api/tests/test_p2_writes_authz.py` (21): 19 failed before the fixes, checked by stashing them
- `WriteRouteRatchetTests` (1)

### 2E: web honesty ✅ (`fix/p2-reliability`)

| Finding | Fix |
| --- | --- |
| Payroll sign-off screen showed £84,210 of made-up composition whenever its data was loading, failed, or had no run | Says loading / couldn't load / no run instead |
| "No SIA issues this run" shown when the licence check hadn't loaded or had failed | Says so, and warns not to sign off |
| Five buttons did nothing when clicked ("Approve N selected", "Approve N ready", "Bulk approve", "Review N", "Browse marketplace"); help text promised bulk approval | Disabled with a reason and where to do it instead; help text corrected. Real bulk approval needs a signature step: Phase 3 |
| Compliance said "No violations — staff are within thresholds" when the list failed (it failed on *every* request until 1B fixed the endpoint) | "Couldn't load violations. This is not an all-clear." |
| Leave approvals said "You're all caught up" when refused; incidents said "every incident has been reviewed"; recruitment "no applications yet", all on failure | Each says it couldn't load |
| The dashboard had no role gate: officers could sign in and browse every page | Admin/manager only; officers see a page pointing them to the app |
| The query cache survived logout, with no user or company in its keys, so a shared computer showed the previous user's (possibly another company's) data for up to 10 minutes | Cache cleared at login and logout |

Verified: `npm run build` clean (it runs `tsc`); biome unchanged at 337. There is no frontend test suite.

**Found, for later batches:**
- **Managers can't approve leave.** A real manager gets a 403 on the approval queue: leave permissions read a role field that doesn't exist, so only Django platform staff pass. Backend fix in 2C; it also has to scope global leave types, policies and blackout periods first.
- **No onboarding UI.** Self-serve signup can't create a company in the current frontend (Phase 3).

### 2F: mobile 🟡 (`fix/p2-reliability`)

| What | Status |
| --- | --- |
| Dead code: a reachability scan from `index.ts` found **63 files, about 18,400 lines** nothing can reach (v1 screens the navigators replaced with V2 but kept importing under old names). Deleted; they held 91 of the type errors. `ResetPasswordConfirmScreen` kept for the Phase 3 deep-link fix. | ✅ `b65b007f` |
| Microphone permission declared "for voice-to-text incident reporting", which was never built, and re-added by expo-camera and expo-av. Removed on both platforms and blocked on Android (App Store / privacy risk). | ✅ `b65b007f` |
| Version gate, app side: every request sends `X-App-Platform` and `X-App-Build`; a 426 shows one blocking "update required" message | ✅ `a9fcb135` |
| Version gate, server side: a configurable minimum build per platform | ⏳ after 2B |
| Checks: mobile `tsc` 246 → 155 errors (none new); Jest 58 → 61 passing | ✅ |

**Note:** builds from before this one send no header, so the floor only applies from this build onwards. Getting everyone onto this build is still an EAS release plus asking officers to update.

### 2B: trustworthy tests ✅ (`fix/p2-reliability`)

A subagent repaired fixture drift in 12 test files, and **no product code**. Stale constructors (`Venue` without a company, removed `SecurityCompany` fields, `StaffProfile` required fields, `Shift(company=)`), renamed URLs, response shapes and a hard-coded 2024 were fixed.

| | Before | After |
| --- | --- | --- |
| Full suite | 527 passed · 167 failed · 9 errors | **643 passed · 48 failed · 0 errors · 13 skipped** |

Every other test file is identical. Assertions removed: 28 (each tied to a documented behaviour change). Added: 30.

**The 48 remaining failures are all real.** They're now signal, not noise:

| # | Finding | Severity | Plan |
| --- | --- | --- | --- |
| A | Leave permissions read a role field that doesn't exist, so tenant managers and admins get **403 on approvals, team overview, reports, settings and blackout periods** (19 tests) | High (functional) | 2C |
| E1 | **Onboarding returns third-party credentials** (Deputy API key, payroll/accounting client secrets, Slack webhook) to any member via `step_data`; they're also stored in plain `configuration` | **High (security)** | 2C |
| B | Regional compliance returns 500 on every call (missing manager method, plus three bugs behind it). Once fixed, **any officer could repoint shared compliance profiles** (same class as P0-E) | Medium + latent security | 2C: guard now; finish the feature in Phase 3 |
| C | Compliance metrics endpoint crashes: its serializer lists 10 fields the model doesn't have | Medium | 2C |
| D | Violation bulk-resolve and metrics recalculate are platform-staff only, so tenant admins get 403 | Low | decide |
| E2/E3 | Regional-setup public holidays 500; registration numbers have no max-length check | Low | later |
| F1–F3 | Recruitment conversion: a DB error on one licence fails the whole conversion; a second licence type is silently dropped; raw DB errors reach the client | Low–medium | later / decide |

Also found: `regional-settings` create/update return "saved successfully" without saving anything.

### 2C (part 1): the bugs 2B surfaced ✅

| Finding | Fix |
| --- | --- |
| **E1: onboarding returned third-party credentials** (Deputy API key, payroll/accounting client secrets, Slack webhook) to any company member | Secrets stored only in `credentials`, which no serializer exposes; all output redacted. **Action for you:** production check (e) lists any company whose credentials were exposed; rotate those at the provider |
| **A: managers couldn't approve leave** (403 on approvals, team overview, reports) | Leave permissions read `User.role`. Global leave configuration stays platform-staff only; the ratchet caught leave balances leaking across companies the moment admins were recognised, and they're scoped now |
| C: compliance metrics endpoint crashed on any data | Serializer matches the model |
| D: bulk-resolve locked to platform staff; "recalculate" claimed to start work it never did | Bulk-resolve opened to tenant managers/admins (scoped); recalculate says "not implemented" |
| B: regional compliance: latent cross-tenant write behind a 500 | Guards in place before the repair; fake "settings saved" responses now say "not implemented". The feature itself is Phase 3 |
| Leave report export always 500 | Fixed |

Full suite: **48 → 22 failures**, all known and listed: 16 regional-compliance bugs (Phase 3), 3 onboarding, 3 recruitment.

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
