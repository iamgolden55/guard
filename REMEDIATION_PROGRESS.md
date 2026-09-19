# Remediation progress

Live tracker for fixing the 2026-09-17 engineering audit (`AUDIT-2026-09-17.md`).
The audit says what is wrong. This file says what has been done about it, what is next, and what is waiting on you.

**Last updated:** 2026-09-19 · **Current branch:** `fix/p2-reliability` · **Now:** Phase 2 finished; stopped for your review (report below)

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
| 2 | Reliability (backups, alerts, PROTECT, pay basis, Xero, web honesty) | ✅ done; report below, waiting on your review |
| 3 | Product completion (no-show alerts, manager inbox, incident evidence) | ⏳ planned |
| 4–5 | Scale, advanced | ⏳ planned |

The full phase plan, with the reasoning for its order, is in `~/.claude/plans/pasted-content-id-e5a5-it-beautifully-valiant-mist.md`.

---

## What's next, in order

1. **Your review of Phase 2** (report below), and the deploy steps in it.
2. Phase 3, starting with a no-show alert that reaches a manager, then the manager inbox on the web and incident evidence reaching storage.

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
  - informational: the full suite and biome (419 standing findings; see the Phase 2 report for why this once read 337)
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
| — | Frontend build (with `tsc`) is clean; biome unchanged (419; see the Phase 2 report) | ✅ |
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
| Frontend build clean, biome unchanged (419; see the Phase 2 report) | ✅ |
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
| Frontend build / biome | clean / 419 | clean / 419 |

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

## Phase 2: reliability ✅

Batches, in order:

| Batch | Scope | Status |
| --- | --- | --- |
| 2A | Remaining authorisation gaps: default write routes weaker than their own actions; drain the ratchet allowlist | ✅ |
| 2B | Trustworthy tests: repair the fixture drift behind ~140 standing failures, then make the full suite a required CI check | ✅ fixtures repaired (48 real failures left; full suite becomes required once they're fixed) |
| 2C | Money integrity: `PROTECT` invoice lines, time adjustments and status history; backfill `payable_hours`; one definition of "outstanding"; Xero idempotency | ✅ |
| 2D | Would we know? A readiness health check, one beat scheduler, an alert when a payroll run is missing, startup checks for security settings, a backup/restore runbook | ✅ code; 🙋 runbook needs your dashboard values |
| 2E | Web honesty: fake payroll composition, dead bulk buttons, failures shown as "empty", admin role gate, company-scoped cache | ✅ |
| 2F | Mobile minimum-version gate; remove dead code | ✅ built, off until you set the minimum |

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

Verified: `npm run build` clean (it runs `tsc`); biome unchanged at 419. There is no frontend test suite.

**Found, for later batches:**
- **Managers can't approve leave.** A real manager gets a 403 on the approval queue: leave permissions read a role field that doesn't exist, so only Django platform staff pass. Backend fix in 2C; it also has to scope global leave types, policies and blackout periods first.
- **No onboarding UI.** Self-serve signup can't create a company in the current frontend (Phase 3).

### 2F: mobile ✅ (`fix/p2-reliability`)

| What | Status |
| --- | --- |
| Dead code: a reachability scan from `index.ts` found **63 files, about 18,400 lines** nothing can reach (v1 screens the navigators replaced with V2 but kept importing under old names). Deleted; they held 91 of the type errors. `ResetPasswordConfirmScreen` kept for the Phase 3 deep-link fix. | ✅ `b65b007f` |
| Microphone permission declared "for voice-to-text incident reporting", which was never built, and re-added by expo-camera and expo-av. Removed on both platforms and blocked on Android (App Store / privacy risk). | ✅ `b65b007f` |
| Version gate, app side: every request sends `X-App-Platform` and `X-App-Build`; a 426 shows one blocking "update required" message | ✅ `a9fcb135` |
| Version gate, server side: `MIN_APP_BUILD_IOS` / `MIN_APP_BUILD_ANDROID` on Render; a build below it gets 426 and the app shows "Update required". Off (0) until you set it. Requests without the headers (the web admin, older builds) pass | ✅ |
| Build number bumped 15 → 16, so the fixed build is distinguishable from the one officers have now (EAS reads it from `app.config.js`) | ✅ |
| Checks: mobile `tsc` 246 → 155 errors (none new); Jest 58 → 61 passing | ✅ |

**Note:** builds from before this one send no header, and the server deliberately lets them through. Those builds have the offline queue that loses a check-in when a request fails, so a refusal would push their check-ins straight into it. They're retired by getting officers onto build 16 (and TestFlight builds expire after 90 days); the floor protects every build from 16 onwards.

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

### 2C (part 2): money integrity ✅

| Finding | Fix |
| --- | --- |
| **Deleting a shift, venue or officer silently deleted pay history.** A shift delete took its invoice line (the audit found 10 invoices, £1,304.80, claiming lines that no longer existed). One "Delete venue" click took every shift ever worked there, their invoice lines and the venue's client invoices, while the dialog promised "past shifts keep their record" | Those links now refuse the delete: invoice line → shift, time adjustment → shift, shift → venue and officer, staff invoice → officer, client invoice → venue. The API answers **409** saying what's in the way and what to do instead ("deactivate the venue", "cancel the shift"). An unworked shift or an unused venue still deletes. The migration changes no SQL, so it's instant to deploy. The venue dialog now tells the truth, and the web shows the server's reason |
| **The nightly account purge failed every night** (`return result`, a NameError) | Returns `{anonymized, failed}` |
| **`payable_hours` is empty on every shift before migration 0071**, so the "what would aligning overtime cost" report understates the change | `manage.py backfill_payable_hours` (dry run by default; fills empty rows only, via the same formula as `save()`; no signals, no status changes). Nothing reads the column while `OT_BASIS_ALIGNED` is off, so it moves no pay. The OT report now warns while rows are empty |
| **Invoice "Outstanding" meant something different on each screen.** Pending and approved invoices were in no money total at all; the Outbox count covered a wider set than the Outstanding total beside it | One definition: **Outstanding = everything not yet paid** (draft, pending, approved, sent, overdue), the same set the Outbox lists and counts. For any officer, paid + outstanding on the web equals their earnings on the phone |
| **Accounting webhook payments** marked any exported invoice paid (draft, rejected, unapproved), never set a paid date, and could be replayed indefinitely | Only an approved invoice is settled; anything else is logged for a manager. Paid date recorded, audit row written, payroll run totals refreshed. A replayed event is recorded as ignored and not applied again |
| Duplicate-shift clean-up scripts would have crashed halfway on an invoiced duplicate | They skip and list shifts with pay records |

**Found on the way:** the Xero webhook has never processed a payment. Its two signature checks read the same header as a hex and as a base64 HMAC, which can never both match, and it doesn't read Xero's real payload format. So nothing above has ever fired in production; it's made safe before anyone wires it up. Wiring it to Xero properly is a Phase 3 item.

### 2D: would we know? ✅

| Gap | Now |
| --- | --- |
| The only health check answered "healthy" whatever state Postgres and Redis were in | `/api/v1/health/` stays a plain liveness check for Render, so a Redis blip can't cause restart loops. New **`/api/v1/health/ready/`** checks Postgres and Redis and answers 503 if either is down. **Point an uptime monitor at it** |
| If the payroll job didn't run, nobody was paid and nothing said so | A daily 09:00 UTC check that every active company has last week's and last month's payroll run; each gap logs an error, which Sentry turns into an alert |
| Unsafe production settings went unnoticed | `manage.py check` (run by `migrate` in the Render build) now **fails the deploy if DEBUG is on in production** and warns in the build log when self-serve signup is open, Sentry isn't set, or document storage isn't durable |
| Dev and prod ran different beat schedulers; a second beat schedule in `celery_app.py` was silently ignored | Database scheduler everywhere (settings + compose). The dead schedule was removed; its two report-clean-up jobs have never run (see "Waiting on you") |
| No backup or restore procedure | `docs/runbooks/backup-and-restore.md` (needs your dashboard values) |

Also found: `core/settings/production.py` is never loaded, because `core.settings` resolves to `settings.py`, so nothing in it applies in production. Sentry is initialised twice in `settings.py`, the first time with `send_default_pii=True`, which sends officers' emails and IPs to Sentry. Both are listed for clean-up, not changed.

Full suite after 2C/2D: **684 passed, 22 failed** (the same 22 known failures, no regressions). At that point the CI guard set was 28 files, **375 passed**.

---

## Phase 2 report (2026-09-19)

### Executed

All on `fix/p2-reliability`, stacked on the Phase 1 branches (2A is also on `fix/p2-authz`). **Nothing is pushed or merged.**

| Batch | Commit | Result |
| --- | --- | --- |
| 2A authorisation gaps | `f70df73b` | VERIFIED |
| 2E web honesty | `fcddab4e` | VERIFIED |
| 2F mobile clean-up, app side of the version gate | `b65b007f`, `a9fcb135` | VERIFIED |
| 2D backup and restore runbook | `494873dc` | Written; needs your dashboard values |
| 2B fixture repair | `fb7af53f` | VERIFIED |
| 2C bugs the repaired tests exposed | `6091213f` | VERIFIED |
| 2C money integrity | `b736e2cd` | VERIFIED |
| 2D would we know | `3aaa8b30` | VERIFIED |
| 2F server gate, build 16 | this commit | VERIFIED |

### Test delta (isolated DB, per file)

| | End of Phase 1 | End of Phase 2 |
| --- | --- | --- |
| Backend passed | 496 | **715** |
| Backend failed / errors | 167 / 9 | **22 / 0** |
| Regression-guard set (CI gate) | 311 (23 files) | **384 (29 files)**, all passing |
| Mobile Jest | 58 | **61** |
| Mobile `tsc` errors | 246 | **155** |
| Frontend build / biome | clean / 419 | clean / 419 |

The remaining failures are all known product bugs, none new: 16 in regional compliance (the feature is Phase 3; guards are already in place), 3 in onboarding and 3 in recruitment conversion (Phase 3). Every per-file change in Phase 2 was an improvement or a new file.

**Test hygiene fix:** `api/tests/test_recruitment_conversion.py` switched all logging off at import. Pytest imports every file during collection, so logging was off for every test that ran before it, and `assertLogs` in an earlier file failed only in a full run. It's now scoped to that module (`setUpModule` / `tearDownModule`).

**Biome correction:** the Phase 1 report said 337. Measured the same way at every commit, from before Phase 1 to now, it's 419 and has never moved. The 337 came from a different measurement. The count and the CI job are unaffected; the job is informational.

### Did not reproduce, or differed from the audit
- **The Xero payment webhook has never processed a payment.** Its two signature checks read one header as a hex and as a base64 HMAC, which can't both match, and it doesn't read Xero's real payload. The risks the audit named (paying unapproved invoices, no paid date, replays) were real but latent. They're fixed before anyone wires it up.
- **Leave was worse than reported.** Once admins were recognised, leave balances were visible across companies. The tenancy ratchet caught it before it shipped.
- **"Outstanding" was worse than reported.** Approved invoices, not just pending ones, were in no money total.
- **The discarded beat schedule** was confirmed. Its two report clean-up jobs have never run anywhere.
- **`core/settings/production.py` is never loaded**, so nothing in it applies in production.

### Built but disarmed
- **Minimum app build:** `MIN_APP_BUILD_IOS` / `MIN_APP_BUILD_ANDROID`, 0 (off) until you set them.
- **`OT_BASIS_ALIGNED`** stays off. `backfill_payable_hours` is ready; run it, then `report_ot_basis_delta`, then decide.
- **Report clean-up jobs** are not enabled (they delete generated report files).

### Pay-affecting
None of Phase 2 moves anyone's pay. The backfill writes a column that nothing reads while `OT_BASIS_ALIGNED` is off. "Outstanding" is a display total. The webhook settles fewer invoices than before (approved only), and it has never run.

### Deferred: needs a decision
- Turn on `OT_BASIS_ALIGNED`, after the backfill and the report.
- Enable the two report clean-up jobs.
- Stop sending personal data to Sentry (`send_default_pii=True`), and remove the second Sentry initialisation.
- Encrypt `CompanyIntegration.credentials` at rest (third-party secrets are now kept only there).
- Protect incident reports the way pay records now are: they still go when their shift or venue is deleted. They're evidence, so I'd do this next.
- Make the full backend suite a required CI check once the 22 known failures are fixed (Phase 3).

### Deploying Phase 2 (your call), in order
1. Take a Postgres snapshot, then run `docs/audit-2026-09-17-prod-checks.sql`. Check (e) lists companies whose integration credentials were exposed; rotate those.
2. Merge after the Phase 1 branches. Migration `0076` changes no SQL. The build's `migrate` now runs the new settings checks: **DEBUG on in production fails the deploy** (intended), and an open signup flag or a missing Sentry DSN shows as a warning in the build log.
3. Run `manage.py backfill_payable_hours` (dry run), then with `--apply`, then `report_ot_basis_delta --weeks 12`.
4. Point an uptime monitor at `/api/v1/health/ready/`.
5. Vercel deploys the web app.
6. EAS build 16 to TestFlight / internal testing. Once officers have it, set `MIN_APP_BUILD_IOS=16` and `MIN_APP_BUILD_ANDROID=16` on Render.
7. Enable branch protection on `main`.

### Next after your review
Phase 3: a no-show alert that reaches a manager, the manager inbox on the web, incident evidence reaching storage, wiring the Xero webhook properly, and the regional compliance, onboarding and recruitment bugs behind the 22 failures.

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
- [ ] Point an uptime monitor (e.g. Better Stack, UptimeRobot) at `https://mead-security-api.onrender.com/api/v1/health/ready/` (2D)
- [ ] After deploying 2C: run `manage.py backfill_payable_hours` (dry run), then `--apply`, then `report_ot_basis_delta --weeks 12`, and decide on `OT_BASIS_ALIGNED` (D-C)
- [ ] Decide: enable the two report-clean-up jobs that have never run (they delete generated report files older than `REPORT_FILE_RETENTION_DAYS`, 7 days by default)
- [ ] Decide: stop sending personal data to Sentry (`send_default_pii=True`)
