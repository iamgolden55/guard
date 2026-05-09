# Payroll, Invoicing & Finance-Integration Context

A self-contained technical brief on how shifts, payroll, and invoicing fit together in this codebase, plus the existing Xero / QuickBooks / Sage scaffolding and exactly where the wiring is incomplete. Use this alongside whatever Xero-integration playbook you've got from the other project.

The system is **Django 5.2 + DRF + PostgreSQL** (backend) and **React 18 + TypeScript + Vite + TanStack Query** (frontend). Multi-tenant: every entity scopes to a `SecurityCompany` (e.g. "Mead Security"). Runs in Docker Compose — `docker compose exec api …` and `… web …`, never bare `python manage.py` / `npm run` on host.

---

## 1. The money flow (one paragraph)

A staff member (officer) works a `Shift`. Manager approval flips the shift to `status='approved'`, which triggers `Invoice.auto_generate_invoice()` to create a draft invoice for that staff member's pay period. The next time a payroll run is officially generated (`Invoice.generate_for_staff_period`), the draft is superseded by an official `pending` invoice. Each invoice has many `InvoiceItem` rows (one per shift × OT tier; plus bank-holiday / annual-leave items for permanent employees). Invoices are grouped under a `PayrollRun` keyed by `(company, cycle, period_start, period_end)` — `cycle='weekly'` runs cover Mon–Sun ISO weeks; `cycle='monthly'` runs cover calendar months. Manager **approves** the run (per-officer or bulk), then **marks paid** once payment lands. Both steps are reversible until `paid`. The Xero (or QuickBooks/Sage) integration is supposed to eat the approved-but-not-yet-paid step: export the invoice → Xero pays → webhook flips local status to `paid`.

---

## 2. Data models

All models are in `backend/api/models.py` unless noted. Tenant FK chain: `Shift → Venue → SecurityCompany`, `Invoice.staff_user → UserCompanyMembership → SecurityCompany`, `PayrollRun → SecurityCompany` directly.

### `SecurityCompany` (line 28)
The tenant. Has `name`, `slug`, `memberships` (reverse FK from `UserCompanyMembership`), `venues`, `payroll_runs`, `system_settings` (1-to-1).

### `UserCompanyMembership` (line 409)
Links a `User` to a `SecurityCompany` with a `role` (`'staff'`, `'manager'`, `'owner'`) and `is_active`. **This is the multi-tenant glue** — a User isn't tied to a tenant directly; their memberships are.

### `StaffProfile` (line 1023, 1-to-1 with User)
Key fields:
- `is_approved` (bool) — admin approval gate
- `pay_frequency` ('weekly' | 'monthly') — drives which payroll cycle includes them
- `employment_type` (FK to `EmploymentType`) — determines `'permanent'` vs `'contractor'` vs `'temporary'`. Permanent employees get bank-holiday / annual-leave invoice line items automatically.
- `is_eligible_for_shifts()` (line 1058) — checks `is_approved=True` AND has a valid SIA license
- `bank_details` (1-to-1, optional) — see `BankDetails` below

### `BankDetails` (line 1081)
1-to-1 with `StaffProfile`. Optional. Fields: `account_name`, `account_number` (encrypted), `sort_code` (encrypted), `bank_name`. **Absence is meaningful** — the Payroll page surfaces a "missing bank" flag for staff with no `BankDetails` row, so payroll can't be exported for them. The flag fires automatically — no code change is needed; just `not hasattr(profile, 'bank_details')` in the relevant serializer paths.

### `SIALicense` (line 1097)
FK to `StaffProfile`. Status one of `'valid' | 'expired' | 'pending'`, plus `expiry_date`. The `PayrollRun.sia_blocks` aggregate counts staff whose latest SIA expires before the run's `process_date`.

### `Venue` (line 1197)
FK to `SecurityCompany`. Has GPS coords (`latitude`, `longitude`), `capacity`, `check_radius`, plus boolean toggles for required checks (`requires_fire_safety_checks`, `requires_capacity_monitoring`, `requires_toilet_checks`).

### `PayRate` (line 3621)
Per-(staff, venue) pay-rate override. Resolution priority (in `Shift.get_effective_hourly_rate`):
1. `Shift.hourly_rate` (denormalized per-shift override)
2. `SystemSettings.special_event_pay_rate` (only if `Shift.is_special_event=True`)
3. `PayRate` row matching (staff, venue)
4. `PayRate` row for staff with `venue=NULL, is_default=True`
5. `SystemSettings.default_hourly_rate`
6. Hardcoded `14.00` (special event) or `12.50` (regular)

### `Shift` (line 1640) — **central entity**
Status enum (line 1641):
```
'open' | 'scheduled' | 'active' | 'in_progress' | 'completed'
| 'pending_approval' | 'approved' | 'rejected' | 'cancelled' | 'no_show'
```
Auto-progression in `Shift.save()` (line 1796):
- `scheduled → active` when `start_time <= now`
- `active → in_progress` when `check_in_time` is set
- `in_progress → pending_approval` when `check_out_time` is set
- `pending_approval → approved` if `end_signature` present AND checkout location verified

Approval auto-fires `Shift.auto_generate_invoice()` (line 1854) which creates a draft `Invoice` for the staff member's pay period.

Key fields: `staff_user`, `venue`, `start_time`, `end_time`, `check_in_time`, `check_out_time`, `actual_hours_worked`, `hourly_rate`, `bill_rate` (client-facing), `is_special_event`, `auto_checkout`, `manager_approved`, `manager_user`, `start_signature`, `end_signature`.

### `Invoice` (line 2926) — **the staff-facing invoice (= payslip)**
Status enum (just expanded):
```
'draft' | 'pending' | 'sent' | 'approved' | 'paid' | 'rejected'
```
`'approved'` was added in migration `0064`. Means: manager has signed off on hours, money has NOT moved yet, ready to export to Xero. The **only** way to a `'paid'` state is `approved → paid` (we explicitly refuse `pending → paid` server-side).

Key fields:
- `staff_user`, `start_date`, `end_date` — the pay-period window
- `total_hours`, `hourly_rate`, `total_amount` — cached aggregates
- `payroll_run` (FK, nullable) — which `PayrollRun` this invoice belongs to. `related_name='staff_invoices'`.
- `superseded_by` (FK to self) — for the hybrid draft → official invoice flow
- `paid_date` — set when status flips to `paid`
- `invoice_number` — display number e.g. `PAY-2026-00481`
- `source` — `'system'` (auto, on shift approval) or `'admin'` (manually generated)
- `version`, `last_recalculated_at` — bumped by `recalculate_from_shifts()`

Class methods:
- `Invoice.generate_for_staff_period(staff, start, end, source, created_by, default_status='pending')` (line 2989) — **the canonical invoice generator**. Filters approved shifts in date range, builds InvoiceItems per OT tier, supersedes overlapping drafts.
- `invoice.recalculate_from_shifts()` (line 3254) — re-emits all shift-backed line items from current Shift state. Called by the TimeAdjustment signal (see §4).

### `InvoiceItem` (line 3475)
FK to `Invoice` and (optionally) `Shift`. `item_type` one of:
```
'shift' | 'overtime_1' | 'overtime_2' | 'bank_holiday' | 'annual_leave' | 'special'
```
A single shift can produce 1–3 items (base + OT1 + OT2 tiers).

### `PayrollRun` (line 7000) — **the run / pay period rollup**
Status enum (just expanded):
```
'pending' | 'approved' | 'paid' | 'rejected'
```
Derived from child invoices via `update_status_from_invoices()` (line 7196):
- any pending/draft/sent invoice → run is `'pending'` (work to do)
- any approved invoice (no pending) → `'approved'` (ready for Xero)
- all paid → `'paid'`
- all terminal + at least one rejected → `'rejected'`

Key fields:
- `company` (FK), `cycle` (`'weekly'` | `'monthly'`)
- `run_code` — `W{ISO_week:02d}-{year}` or `M{month:02d}-{year}`. Unique per (company, cycle).
- `period_start`, `period_end`, `process_date`
- Cached aggregates: `invoice_count`, `line_item_count`, `hours_billed`, `gross_total`, `prev_gross`, `time_adjustments`, `sia_blocks`. Recomputed by `recompute_totals()` (line 7137).
- `export_status` — separate from `status`. Tracks whether the run has been pushed to a finance provider (`'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'`).

Class helpers: `PayrollRun.for_iso_week(dt)` and `PayrollRun.for_calendar_month(dt)` derive `run_code/label/period_start/period_end/process_date` from any reference date.

### `TimeAdjustment` (line 2562)
Audit row written every time a manager corrects a shift's check-in / check-out / hours via the Adjust Hours modal. Stores `original_*` and `adjusted_*` columns plus `reason`, `adjusted_by`, `manager_signature`. The `post_save` signal cascades the change down to Shift → Invoice → PayrollRun (see §4).

### `AuditLog` (general-purpose)
Used by every billing / payroll mutation to record `action`, `resource_type`, `resource_id`, `details (JSON)`, `user`. Search audits for `action='officer_approved'` (with `details.bulk: true|false`) and `action='invoice_paid'`.

---

## 3. State machines

### Shift lifecycle
```
                           ┌─────────────┐
                           │    open     │ (unassigned)
                           └─────┬───────┘
                                 │ assignment
                                 ▼
   ┌──────────────────────► scheduled ──────► cancelled
   │                            │
   │                  start_time ≤ now
   │                            ▼
   │                          active ──────► no_show (manual)
   │                            │
   │                       check-in
   │                            ▼
   │                       in_progress ──────► auto_checkout
   │                            │
   │                      check-out
   │                            ▼
   │                    pending_approval
   │                            │
   │           ┌────────────────┴────────┐
   │   manager approve            manager reject
   │           ▼                        ▼
   │       approved ────► (triggers Invoice.auto_generate)
   │                                  rejected
```

### Invoice lifecycle (the new model)
```
   ┌─────────┐       (auto on shift approval)
   │  draft  │ ──── superseded by official period invoice
   └────┬────┘                  │
        │                       ▼
        ▼                   ┌────────┐
    pending  ─────────────► │approved│ ──────► paid
        │                   └────────┘            │
        │                       ▲                 │
        ▼                       │                 ▼
    rejected ─────── reissue ───┘            (terminal)
```
Server-side guarantees:
- `approve_officer` and `approve_all` refuse to flip a `rejected` invoice (must reissue)
- `mark_paid_officer` and `mark_paid_all` **refuse to skip the approval step** — only `approved → paid` is allowed
- The per-invoice `mark_paid` endpoint accepts `pending|draft|sent|overdue|approved` for backward compat, but the run-level path enforces approval

### PayrollRun lifecycle
Auto-derived from children — never directly settable. Flow: `pending → approved → paid`. Edge: `rejected` if all children terminal and at least one rejected without any paid.

---

## 4. Signal cascade (the magic glue)

All in `backend/api/signals.py`.

### `Shift` post_save (existing)
On status change → `'approved'`, fires `auto_generate_invoice()` → creates `'draft'` Invoice. On status change to anything from `'open'`, cancels stray `OpenShiftRequest` rows.

### `TimeAdjustment` post_save (line 627) — **the hours-correction cascade**
1. Writes `adjusted_check_in_time / adjusted_check_out_time / adjusted_actual_hours` back onto the Shift (`update_fields=...`)
2. Looks up the InvoiceItem for that Shift, then its parent Invoice
3. Calls `invoice.recalculate_from_shifts()` — re-emits all shift-backed items from current Shift state, updates `total_hours / total_amount / version / last_recalculated_at`
4. **Cascades to sibling invoices in the same ISO week** — necessary because adjusting one shift's hours can shift OT tier classification of later shifts in the same week (P3.4 fix)

### `Invoice` post_save (line ~750) — **the run-aggregate cascade**
Just added. On any Invoice save, if `payroll_run` is set:
1. `run.recompute_totals()` — refreshes cached `gross_total / hours_billed / invoice_count / line_item_count / time_adjustments / sia_blocks`
2. `run.update_status_from_invoices()` — flips run status `pending → approved → paid` based on children

This is what makes the Payroll page's "Previous runs" rail and the run header stay in sync after a TimeAdjustment, an approve-all, or a mark-paid-all. **Without this signal, cached aggregates drift.** Bulk paths that need to bypass the signal should use `queryset.update()` (which doesn't emit `post_save`) and call `recompute_totals()` + `update_status_from_invoices()` once at the end.

---

## 5. API surface

### Payroll (read + state transitions)
Route prefix: `/api/v1/payroll/`. Implemented as a DRF ViewSet keyed by `run_code` (e.g. `W17-2026`).

| Method + path | Purpose |
|---|---|
| `GET /runs/?cycle=weekly|monthly` | List recent runs (capped ~12 most recent) |
| `GET /runs/current/?cycle=weekly|monthly` | Current run for the cycle |
| `GET /runs/{run_code}/` | Run header |
| `GET /runs/{run_code}/officers/` | Per-staff aggregate rows for the table |
| `GET /runs/{run_code}/officers/{officer_id}/` | One officer's invoice items + adjustments |
| `GET /runs/{run_code}/composition/` | Gross-by-line-item-type breakdown |
| `GET /runs/{run_code}/sia-holds/` | Officers blocked by expired SIA |
| `POST /runs/{run_code}/officers/{officer_id}/approve/` | **pending → approved** for one officer |
| `POST /runs/{run_code}/officers/{officer_id}/mark-paid/` | **approved → paid** for one officer |
| `POST /runs/{run_code}/officers/{officer_id}/reject/` | `{ reason }` body. Sets `'rejected'` |
| `POST /runs/{run_code}/approve-all/` | Bulk pending → approved. Body: `{}` or `{"officer_ids": [int, ...]}` to scope |
| `POST /runs/{run_code}/mark-paid-all/` | Bulk approved → paid. Same body shape |
| `POST /runs/{run_code}/regenerate/` | Re-aggregate invoices for this run |
| `POST /shifts/{shift_id}/adjust_time/` | Create a `TimeAdjustment` (in shifts viewset, see line ~1405 of `views.py`) |

All bulk endpoints return `{ approved_count|paid_count, run_status, officers: [...] }` with the refreshed officer list, so the frontend can swap state in one round-trip.

### Billing facade (unified staff + client invoices)
Route prefix: `/api/v1/billing/`.

| Method + path | Purpose |
|---|---|
| `GET /invoices/?kind=staff|client&status=&search=` | List invoices |
| `GET /invoices/{id}/` | Single invoice |
| `GET /invoices/stats/?kind=` | Counts/totals per status |
| `GET /invoices/aging/?kind=` | Aging buckets |
| `GET /invoices/{id}/activity/` | Audit trail for one invoice |
| `POST /invoices/{id}/mark-paid/` | Generic mark-paid (accepts approved/pending/sent/overdue/draft) |
| `POST /invoices/{id}/reject/` | `{ reason }` |
| `POST /invoices/{id}/void/` | |
| `POST /invoices/{id}/remind/` | Email reminder |
| `POST /invoices/{id}/duplicate/` | Draft clone |
| `POST /invoices/{id}/resolve/` | Reissue rejected invoice |
| `POST /invoices/from-shifts/` | Manually generate a client invoice from approved shifts |
| `GET /finance-providers/` | List configured providers |
| `POST /exports/{id}/export-to-xero/` | **Export one invoice to Xero** (line ~1410 of `views_billing.py`) |
| `POST /statements/` | Bundle ClientInvoices into a Statement |

### Finance integrations (the connector layer)
Route prefix: `/api/v1/finance-integrations/` (plus webhooks). Lives in a separate Django app: `backend/finance_integrations/`. See §7 for the full surface.

---

## 6. Frontend pages

### Payroll page — `/payroll`
File: `frontend/src/features/payroll/PayrollPage.tsx`. Structure:
- **PayrollHeader** — breadcrumb, **Weekly | Monthly cycle toggle**, "Download payslips" + "Export to Xero" topbar buttons
- **RunHero** — big card with status pills (pending/approved/paid/rejected), run code, period label, **multi-segment progress bar** (green paid / blue approved / orange pending / red rejected), 3 KPI columns (Gross, Officers billed, Needs attention), and the **action button stack**:
  - `Approve N pending` (green, primary, only if pending count > 0)
  - `Mark N approved paid` (green, primary, only if approved count > 0)
  - `Export run to Xero` (always)
  - `Download all payslips` (always)
  - `Regenerate invoices` (always)
  - All three Approve/Mark-paid actions are **selection-aware** — when officer rows are checked, the labels switch to `Approve N selected` / `Mark N selected paid` and the API calls scope to those `officer_ids`.
- **FilterBar** — chip filter (All / Pending / Approved / Paid / Rejected / Needs attention) + search + venue dropdown + bulk actions
- **OfficersTable** — expandable rows; click expands to show invoice line items + per-shift Adjust hours, Reject, Export PDF, Export to Xero
- **OfficerDrawer** — slide-out detail with Adjust hours, contextual Approve / Mark paid button (depending on current state), Payslip PDF, Export invoice
- **AdjustHoursModal** — dropdown of shift line items showing currently-logged hours (`8.00h logged`); datetime fields **prefill** from the shift's recorded `check_in_time` / `check_out_time`. Submit hits `POST /shifts/{id}/adjust_time/` which fires the cascade in §4.
- **Right rail**: CompositionCard (gross by line-item type), SiaHoldsCard, RunHistoryCard (last 12 runs of the active cycle)

State / data layer: TanStack Query keys are `["payroll", "current"|"run"|"officers"|"officer"|"composition"|"sia-holds"|"history", ...]`. The `usePayrollMutations` hook centralizes the mutation set: `approveOfficer`, `approveAllPending(officerIds?)`, `markPaidOfficer`, `markPaidAllApproved(officerIds?)`, `rejectOfficer`, `adjustTime`. All call `invalidateRun()` which invalidates every `["payroll", ...]` key the page consumes — including `["payroll", "history"]` so the right rail also refreshes.

### Invoices page — `/invoices`
File: `frontend/src/features/invoices/InvoicesPage.tsx`. Structure:
- **Ledger toggle**: `client` vs `staff` (the Invoices page is dual-purpose — client-facing invoices for venues, and staff-facing invoices = payslips)
- **Status filter**: all / draft / sent / pending / overdue / paid / rejected / resolved
- Tabs: Outbox (active), Aging, Activity log, Statements
- Each row has: invoice number, party (client venue or staff officer), period, total, status pill, action menu (mark paid, reject, void, duplicate, resolve, send statement)
- Templates / paper effect for printable view

**Gap**: the Invoices page has **no cycle filter on the staff ledger**. You can filter by status but not by weekly vs monthly. The Payroll page is run-centric (one run = one period); the Invoices page is ledger-centric (everything ever). For finance staff hunting an old payment, a weekly/monthly toggle would be useful — call it (b) in the order of work.

### Integrations page — `/integrations`
File: `frontend/src/features/integrations/IntegrationsPage.tsx`. The OAuth callback lives at `/integrations/oauth/callback` (`OAuthCallbackPage.tsx`). This is where users connect Xero / QuickBooks / Sage. UI exists; the wiring to actually trigger flows + render synced state from `WebhookEvent` / `SyncLog` is partially stubbed.

---

## 7. Existing finance-integrations scaffolding (Django app)

App lives at `backend/finance_integrations/`. **A lot of plumbing already exists** — don't rebuild it.

### Models (`finance_integrations/models.py`)
- **`AccountingProvider`** — registry row per provider (xero, quickbooks, sage). Has `display_name`, OAuth config, connected status.
- **`ProviderConnection`** — one tenant's connection to a provider. Stores OAuth tokens via `EncryptedJSONField`, `company_name`, `is_sandbox`, `status`. Multiple connections per company allowed (e.g. sandbox + prod).
- **`AccountMapping`** — maps a local account name (e.g. "Wages") to a provider-side account ID. Same idea for `VATCodeMapping`, `EarningsTypeMapping`, `ContactMapping`.
- **`InvoiceExport`** — record of a single staff Invoice having been pushed to a provider. Stores `local_invoice` (FK), `provider_invoice_id`, `status`, error history. **This is what the webhook handler looks up on payment confirmation.**
- **`ClientInvoiceExport`** — same but for client-facing invoices.
- **`PayrollExport`** — bundle of multiple staff invoices pushed as one Xero pay run.
- **`WebhookEvent`** — incoming webhook log. Stores `event_type`, `event_id`, `raw_payload`, `signature`, `status` (`pending|processing|processed|failed`), `processed_at`, `error_message`. **Use this for idempotency** — check `event_id` before processing.
- **`SyncLog`** — generic audit trail for any sync operation.

### Provider classes (`finance_integrations/providers/`)
- `base.py` — abstract `AccountingProvider` interface that all providers implement
- `xero.py` — Xero implementation. Methods already exist: `get_oauth_url`, `exchange_oauth_code`, `refresh_tokens`, `get_tenants`, `get_company_info`, `list_accounts`, `list_vat_codes`, `upsert_contact`, `upsert_employee`, `create_invoice`, `list_earnings_types`, `create_pay_run`, `create_journal_entry`, `list_payments`, **`verify_webhook_signature`**, `upload_attachment`. The OAuth + REST plumbing is largely there.
- `quickbooks.py`, `sage.py` — same shape, varying levels of completeness
- `factory.py` — returns the right provider instance given a connection

### Service layer (`finance_integrations/services.py`)
- `FinanceIntegrationService` — wraps a `ProviderConnection` and exposes `export_invoice`, `export_payroll`, `sync_payment_status(webhook_data)` (line 479).
- **`sync_payment_status` is the missing piece's other half.** Current implementation looks for `event_type` containing `'invoice'` and `'paid'`, finds the `InvoiceExport` by `provider_invoice_id`, and flips `local_invoice.status = 'paid'`. **This is generic — it doesn't know about the new `'approved'` state.** It should:
  1. Refuse to flip a `pending` invoice straight to paid (force approval first), OR
  2. Auto-approve-then-pay if the export already happened (which implies approval was the export trigger)

  Option (b) is probably right: only `approved` invoices are exportable, so if a webhook arrives saying "invoice X is paid", we know it was approved before export. Just do the `approved → paid` flip and call `invoice.save()` so the run-aggregate signal fires.
- `ConnectionSetupService` — handles OAuth handshake.

### Views (`finance_integrations/views.py`)
- OAuth: initiate / callback / disconnect endpoints
- Mapping CRUD endpoints (account, VAT, contacts, earnings)
- Test-connection endpoint
- **Webhook endpoint** — generic `/webhook/{provider_key}/`. Verifies signature, creates `WebhookEvent` row, calls `service.sync_payment_status(payload)`. Idempotency: check `event_id` against existing `WebhookEvent` rows.

---

## 8. The integration contract — how everything should fit together

**Outbound (our system → Xero):**

| Trigger in our app | What happens locally | What we send to Xero |
|---|---|---|
| Manager clicks "Approve N pending" on a run | invoice.status: pending → approved (via signal: run goes pending → approved) | nothing yet |
| Manager / cron clicks "Export run to Xero" | for each approved invoice: `XeroProvider.upsert_contact()` then `XeroProvider.create_invoice()` (or `create_pay_run` for payroll-style export) | One Xero Invoice per officer; `InvoiceExport` row written with `provider_invoice_id` |
| Manager clicks "Mark N approved paid" (bypass) | invoice.status: approved → paid; run goes approved → paid | nothing — manual fallback when webhook isn't wired |

**Inbound (Xero → our system):**

| Xero event | Webhook | What we do |
|---|---|---|
| Invoice paid in Xero | `eventType` contains "invoice" + "paid" | look up `InvoiceExport` by `provider_invoice_id`, flip local invoice approved → paid, set `paid_date`, signal cascades to PayrollRun |
| Invoice voided in Xero | `eventType` contains "invoice" + "voided" | optionally flip local to `rejected` with reason "voided in Xero" — needs a product decision |
| Payment failed | provider-specific | log to SyncLog, leave local at approved, flag in UI |
| Token expired | (not a webhook — just a 401 from Xero) | `XeroProvider.refresh_tokens()` already implemented; needs to be called from `_make_request` retry |

**Key invariants the integration must respect:**
1. **Don't skip approval.** Server enforces this for the run-level mark-paid-all endpoint. The webhook bypass *should* check that the invoice is in `approved` state and either force-approve-with-system-user or fail loudly.
2. **Idempotent webhooks.** Use `WebhookEvent.event_id` to deduplicate. Xero retries on 5xx.
3. **Cascade is automatic.** Once invoice.status flips, the post_save signal handles the run-status flip and aggregate refresh. Don't manually update `PayrollRun.gross_total` in the integration code.
4. **Multi-tenant.** Every `ProviderConnection` belongs to a `SecurityCompany`. Webhooks for tenant A must not flip invoices belonging to tenant B. The webhook handler iterates by `provider`, not by company — verify scoping in `sync_payment_status`.
5. **Bank details gate.** Don't export an invoice if the staff member has no `BankDetails` row — Xero will accept it but the payment will fail. Filter at export time, surface the missing-bank flag in the UI.
6. **Contact upsert before invoice.** Xero requires the contact to exist before invoice creation. `upsert_contact()` is implemented; call it first.

---

## 9. Known gaps / open decisions

1. **No "approve run + export" combined action.** Today: click Approve, then click Export. Could be one button "Approve & queue for Xero".
2. **Export-to-Xero is per-invoice, not run-level.** The `Export run to Xero` button in RunHero loops over officers and hits per-invoice `export-to-xero` endpoints. Xero has a **PayRun** concept (`XeroProvider.create_pay_run` exists) which would be more idiomatic — one pay run per PayrollRun, child invoices roll up. Decision: which model do we want? Sticking with per-invoice is simpler; PayRun is more correct for Xero Payroll.
3. **Invoices page has no monthly view.** Add a cycle filter (item (b) in the user-agreed order).
4. **The webhook handler's `sync_payment_status` doesn't know about the new `'approved'` state.** Needs to handle `approved → paid` (and probably auto-approve any stale exported `pending` for safety).
5. **Token refresh is implemented but not auto-triggered on 401.** Needs a wrapper in `_make_request` that catches 401, refreshes, retries once.
6. **No connection health monitoring.** A disconnected provider is silent until someone tries to export.
7. **Audit trail.** Today we audit `officer_approved` and `invoice_paid`. Need to also log `invoice_exported`, `webhook_received`, `webhook_processed`, `payment_synced`. The `SyncLog` model is meant for this — just use it consistently.
8. **The Mead Security simulation data** (Jan 1 → Apr 1, 2026) is seeded by `backend/api/management/commands/simulate_mead_history.py`. Re-run with `--clear` to reset for testing. 364 shifts, 56 invoices, 18 payroll runs (14 weekly + 4 monthly), realistic edge cases (no-shows, pending approvals, rejections). 5 staff have missing bank details on purpose.

---

## 10. Quick-reference file paths

**Backend:**
- `backend/api/models.py` — Shift, Invoice, InvoiceItem, PayrollRun, TimeAdjustment, BankDetails, StaffProfile, SecurityCompany, UserCompanyMembership, Venue, PayRate, SystemSettings
- `backend/api/views_billing.py` — All payroll + billing endpoints (the InvoicesViewSet at top, PayrollRunsViewSet around line 800)
- `backend/api/serializers_billing.py` — `_aggregate_officer`, `_line_item_payload`, `_adjustment_payload` (all the response shapes the frontend reads)
- `backend/api/signals.py` — TimeAdjustment cascade (line 627), Invoice → PayrollRun aggregate refresh (`refresh_payrollrun_aggregates_on_invoice_save`)
- `backend/api/management/commands/simulate_mead_history.py` — seeded test data
- `backend/finance_integrations/` — entire integrations app (models, providers, services, views, urls)

**Frontend:**
- `frontend/src/features/payroll/` — PayrollPage, RunHero, OfficersTable, OfficerDrawer, AdjustHoursModal, FilterBar, RightRailCards, hooks, data
- `frontend/src/features/invoices/` — InvoicesPage and components
- `frontend/src/features/integrations/` — IntegrationsPage, OAuthCallbackPage
- `frontend/src/services/payrollService.ts` — calls /api/v1/payroll/*
- `frontend/src/services/billingService.ts` — calls /api/v1/billing/*
- `frontend/src/services/financeIntegrationsService.ts` — calls /api/v1/finance-integrations/*

**Docker:**
- `docker/docker-compose.yml` — services: api (Daphne 8000), web (serves built dist on 3000), db (Postgres 16), redis, celery-worker, celery-beat, flower, mailhog
- `docker/Dockerfile.web` — **important**: builds Vite bundle into `dist/` and serves with `serve`. Source-file mounts only mount `src/`, `index.html`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js` — **changes to `src/` need a rebuild + `docker cp dist/` to take effect**, not a hot-reload. Workflow: `npm run build` on host → `docker cp /Users/new/Projects/guard/frontend/dist/. meadsecurity-web-1:/app/dist/` → `docker compose restart web`. The api container also runs Daphne (no autoreload) so backend changes also need `docker compose restart api`.

---

## 11. The exact sequence for a clean Xero integration build

Given the above, here's the order I'd build (regardless of how the other project did it):

1. **Decide PayRun vs per-invoice export model.** Pick one; document.
2. **Wire `IntegrationsPage` OAuth flow end-to-end.** Connect to Xero sandbox, store tokens in `ProviderConnection`. Test `XeroProvider.get_company_info()` round-trip.
3. **Mapping UI.** Let admin pick which Xero account to post wages to, which VAT code, which contact corresponds to each `Venue` (for client invoices) or each `User` (for payroll).
4. **`Export run to Xero` for staff invoices.** Already-stubbed endpoint — flesh out to call `upsert_employee()` then `create_pay_run()` (or per-invoice `create_invoice()` depending on (1)). Write `InvoiceExport` rows. Surface export status pills on RunHero.
5. **Webhook endpoint hardening.** Currently exists; needs:
   - `event_id` idempotency check
   - HMAC verification using `XeroProvider.verify_webhook_signature`
   - Update `sync_payment_status` to handle the `approved → paid` transition correctly
   - Auto-approve-then-pay safety for stale exports (or refuse and SyncLog-error)
6. **Token refresh on 401.** Wrap `_make_request` to auto-refresh once.
7. **Connection health UI.** Show last-seen webhook, last sync, token expiry countdown on IntegrationsPage.
8. **Tests.** End-to-end: simulate a webhook payload via the Django test client, verify local invoice flips, verify run status cascades, verify duplicate webhook is no-op.
9. **The (b) item: cycle filter on staff Invoices page.** Add weekly/monthly chip after step 4 lands so finance staff can drill historical exports.

The `simulate_mead_history` command gives you a fully populated test dataset to validate every step against — **don't test the integration on synthetic-only data; the seeded edge cases (no-shows, rejections, pending approvals, missing bank) are exactly the cases that break naïve implementations.**
