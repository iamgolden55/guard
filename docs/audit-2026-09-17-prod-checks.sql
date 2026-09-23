-- Production checks for AUDIT-2026-09-17.md, Phase 0.4.
--
-- READ-ONLY. Every statement is a SELECT. Run against the live Render Postgres
-- (psql "$DATABASE_URL" -f docs/audit-2026-09-17-prod-checks.sql) BEFORE
-- deploying Phase 1, and keep the output: several answers decide what Phase 1
-- is allowed to ship, and section (b) decides whether a breach notification
-- clock has started.

\echo '== (a) Are the previous audit''s constraint migrations applied? =='
SELECT name, applied
FROM django_migrations
WHERE app = 'api' AND name ~ '^00(69|70|71|72|73|74)_'
ORDER BY name;

-- If 0069 is NOT applied: live duplicate invoices would abort its build.
\echo '== (a1) Duplicate live staff invoices (blocks migration 0069) =='
SELECT staff_user_id, start_date, end_date, COUNT(*) AS n
FROM invoices
WHERE superseded_by_id IS NULL
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;

-- If 0070 is NOT applied: overlapping assignments would abort its build.
-- Mirrors constraint shift_no_overlapping_assignment exactly.
\echo '== (a2) Overlapping assignments for one officer (blocks migration 0070) =='
SELECT a.id AS shift_a, b.id AS shift_b, a.staff_user_id, a.start_time, a.end_time, b.start_time, b.end_time
FROM shifts a
JOIN shifts b
  ON a.staff_user_id = b.staff_user_id
 AND a.id < b.id
 AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(b.start_time, b.end_time, '[)')
WHERE a.staff_user_id IS NOT NULL AND a.end_time IS NOT NULL AND b.end_time IS NOT NULL
  AND a.status NOT IN ('cancelled', 'rejected')
  AND b.status NOT IN ('cancelled', 'rejected');

-- ---------------------------------------------------------------------------
-- (b) Forensics — was the fail-open exposure used?
-- ---------------------------------------------------------------------------

\echo '== (b1) Accounts with no active membership (the P0-A precondition) =='
SELECT u.id, u.username, u.email, u.role, u.date_joined, u.last_login
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_company_memberships m
  WHERE m.user_id = u.id AND m.is_active
)
ORDER BY u.date_joined DESC;

\echo '== (b2) Companies owned by someone who was already staff elsewhere (P0-G) =='
SELECT c.id AS company_id, c.name, c.created_at, u.id AS owner_id, u.username
FROM security_companies c
JOIN user_company_memberships own ON own.company_id = c.id AND own.is_owner
JOIN users u ON u.id = own.user_id
WHERE EXISTS (
  SELECT 1 FROM user_company_memberships other
  WHERE other.user_id = u.id
    AND other.company_id <> c.id
    AND NOT other.is_owner
    AND other.joined_at < c.created_at
)
ORDER BY c.created_at DESC;

\echo '== (b3) Invoice writes by an actor who is not a member of the invoice''s company =='
-- Staff invoices: company is inferred from the officer's memberships.
SELECT l.timestamp, l.action, l.user_id AS actor_id, l.resource_id AS invoice_id
FROM audit_logs l
JOIN invoices i ON l.resource_type = 'Invoice' AND l.resource_id = i.id::text
WHERE l.action IN ('invoice_paid', 'invoice_rejected', 'invoice_voided')
  AND NOT EXISTS (
    SELECT 1
    FROM user_company_memberships actor
    JOIN user_company_memberships officer
      ON officer.company_id = actor.company_id AND officer.user_id = i.staff_user_id
    WHERE actor.user_id = l.user_id
  )
UNION ALL
SELECT l.timestamp, l.action, l.user_id, l.resource_id
FROM audit_logs l
JOIN client_invoices ci ON l.resource_type = 'ClientInvoice' AND l.resource_id = ci.id::text
WHERE l.action IN ('invoice_paid', 'invoice_rejected', 'invoice_voided')
  AND NOT EXISTS (
    SELECT 1 FROM user_company_memberships actor
    WHERE actor.user_id = l.user_id AND actor.company_id = ci.company_id
  )
ORDER BY 1 DESC;

\echo '== (b4) Approved shifts nobody worked or approved (S-22: create_multi_staff with status=approved) =='
-- Shifts have no creator column. A shift born `approved` via create_multi_staff
-- has no check-in and no approving manager; legitimate approvals have at least one.
SELECT s.id, s.venue_id, s.staff_user_id, s.hourly_rate, s.status, s.created_at
FROM shifts s
WHERE s.status = 'approved' AND s.manager_user_id IS NULL AND s.check_in_time IS NULL
ORDER BY s.created_at DESC;

\echo '== (b5) Shift rates more than 3x the venue median (arbitrary-rate injection) =='
WITH med AS (
  SELECT venue_id, percentile_cont(0.5) WITHIN GROUP (ORDER BY hourly_rate) AS median_rate
  FROM shifts WHERE hourly_rate IS NOT NULL GROUP BY venue_id
)
SELECT s.id, s.venue_id, s.staff_user_id, s.hourly_rate, med.median_rate, s.status, s.created_at
FROM shifts s JOIN med USING (venue_id)
WHERE s.hourly_rate > 3 * med.median_rate
ORDER BY s.created_at DESC;

-- ---------------------------------------------------------------------------
-- (c) Decides whether Phase 1C may add a company filter to payroll generation.
-- Any row here means an officer's payroll can currently mix two companies'
-- shifts; fixing that moves pay, so it becomes a decision, not a fix.
-- ---------------------------------------------------------------------------
\echo '== (c) Officers with more than one active membership =='
SELECT user_id, COUNT(*) AS active_memberships
FROM user_company_memberships
WHERE is_active
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ---------------------------------------------------------------------------
-- (d) Sizes the pay-basis and billing-rate work.
-- ---------------------------------------------------------------------------
\echo '== (d1) Approved shifts with NULL payable_hours (OT_BASIS_ALIGNED would zero their OT) =='
SELECT COUNT(*) FILTER (WHERE payable_hours IS NULL) AS null_payable,
       COUNT(*) AS approved_total
FROM shifts
WHERE status = 'approved';

\echo '== (d2) Client-invoiced shifts with no bill_rate (would be held as draft) =='
SELECT COUNT(*) AS lines_without_bill_rate
FROM client_invoice_items it
JOIN shifts s ON s.id = it.shift_id
WHERE s.bill_rate IS NULL;

\echo '== (d3) Staff invoice headers no longer supported by line items (CASCADE loss) =='
SELECT i.id, i.invoice_number, i.total_amount,
       COALESCE(SUM(it.amount), 0) AS items_total
FROM invoices i
LEFT JOIN invoice_items it ON it.invoice_id = i.id
WHERE i.superseded_by_id IS NULL
GROUP BY i.id, i.invoice_number, i.total_amount
HAVING i.total_amount <> COALESCE(SUM(it.amount), 0);
