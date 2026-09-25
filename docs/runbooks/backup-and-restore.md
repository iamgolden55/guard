# Backup and restore runbook

**Why this exists.** The 2026-09-17 audit found no backup script, no restore procedure, and no restore ever tested; the only mention of backups in the repo was an unchecked box in the README. The system holds UK workers' bank details, pay history and SIA licence scans. "Render probably has backups" isn't a recovery position, and several later fixes (any migration rollback) assume a restorable snapshot exists.

This runbook turns that into a known position. Steps marked **(you)** need Render or Cloudflare dashboard access.

---

## 1. Record the current position (one-off, ~15 minutes)

Fill this table in and commit it. It's the answer to "what would we lose, and how long would we be down?"

| Item | Value | How to find it |
| --- | --- | --- |
| Render Postgres plan | _(you)_ | Render dashboard → the Postgres instance → Info |
| Automatic backups enabled? | _(you)_ | Instance → Backups / Recovery |
| Point-in-time recovery window | _(you)_ | Same page. The PITR window is the **RPO** floor |
| Backup retention | _(you)_ | Same page |
| **RPO** (max data loss accepted) | _(decide)_ | Must be ≥ what the plan above provides |
| **RTO** (max downtime accepted) | _(decide)_ | Set from the drill timing in §3 |
| R2 bucket versioning | _(you)_ | Cloudflare → R2 → bucket → Settings |
| R2 lifecycle rules | _(you)_ | Same page |
| Last successful restore drill | _(date)_ | §3 |

`render.yaml` has drifted from the live services, so treat the dashboard as the truth, not the file.

## 2. Before any deploy that includes migrations

1. **(you)** Take a manual snapshot in the Render dashboard (Postgres → Backups → create / export). Note the time.
2. Run the read-only production checks: `psql "$DATABASE_URL" -f docs/audit-2026-09-17-prod-checks.sql`
3. Deploy.

Migrations run inside `backend/build.sh` on purpose (Render drops `preDeployCommand` for this service). A migration that fails aborts the build and the old release keeps serving. A migration that *succeeds* but is wrong needs the snapshot from step 1.

## 3. Restore drill (quarterly, and before go-live)

A backup that has never been restored is a hope. The drill proves the dump restores, and times it: that time is your realistic RTO.

```bash
# 1. Dump production (read-only; run from a machine with the Render external URL)
pg_dump --format=custom --no-owner --no-acl "$PROD_DATABASE_URL" -f mead-$(date +%F).dump

# 2. Restore into a scratch database — NEVER the production one
createdb mead_restore_drill
time pg_restore --no-owner --no-acl --dbname=mead_restore_drill mead-$(date +%F).dump

# 3. Prove it's a working database, not just a file that loaded
DB_NAME=mead_restore_drill python manage.py showmigrations api | tail -3   # latest migration applied
psql mead_restore_drill -c "select count(*) from shifts; select count(*) from invoices; select max(created_at) from shifts;"

# 4. Clean up. The dump contains personal data (bank details, NI numbers):
#    delete it from the machine you used.
dropdb mead_restore_drill && shred -u mead-*.dump 2>/dev/null || rm -P mead-*.dump
```

Record the date, the `pg_restore` wall-clock time, and the row counts in §1.

A Render-native restore (PITR into a new instance) is the faster path in a real incident. Rehearse it once too, so the steps aren't being read for the first time during an outage.

## 4. Files in R2

Licence scans and other uploads live in the private R2 bucket (see `a82bc604`). R2 doesn't version objects by default, so a deleted or overwritten scan is gone.

**(you)** In Cloudflare → R2 → the bucket:
- enable **object versioning**, or keep a scheduled copy to a second bucket;
- add a lifecycle rule expiring non-current versions after an agreed period (e.g. 90 days), so versioning doesn't grow without bound.

## 5. If you need to restore for real

1. Stop writes: put the API in maintenance, or scale the Render web service and the Celery worker to zero, so nothing writes while you restore.
2. Restore the snapshot or PITR point into a **new** instance. Don't overwrite the damaged one; you may need it for forensics.
3. Point `DATABASE_URL` at the new instance and redeploy.
4. Payroll: anything between the restore point and the incident is gone. Re-run the affected payroll periods and compare against Xero before paying anyone.
5. Write down what happened, the restore point, and the data lost.
