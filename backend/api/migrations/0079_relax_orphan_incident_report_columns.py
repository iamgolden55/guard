"""Let incident reports save on a database that kept 0035's columns.

0035 added sixteen mobile-incident columns to `incident_reports` and 0036
removed them. Production recorded both as applied on 2026-01-07 but still has
the columns, eight of them NOT NULL with no default. Django doesn't know they
exist, so every INSERT from `IncidentReport` fails with a NotNullViolation: no
incident report has ever been saved in production.

This drops the NOT NULL constraint on any of those columns that exists, and
nothing else: no column or data is removed. On a database that migrated
correctly the columns aren't there and this does nothing. Dropping the orphan
columns outright is a separate, deliberate decision.
"""
from django.db import migrations

ORPHAN_NOT_NULL_COLUMNS = [
    'ambulance_called', 'incident_type', 'persons_involved', 'photos',
    'police_notified', 'reported_at', 'status', 'videos', 'witnesses',
]

RELAX_SQL = """
DO $$
DECLARE col text;
BEGIN
    FOREACH col IN ARRAY ARRAY[%s] LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'incident_reports'
              AND column_name = col
              AND is_nullable = 'NO'
        ) THEN
            EXECUTE format('ALTER TABLE incident_reports ALTER COLUMN %%I DROP NOT NULL', col);
        END IF;
    END LOOP;
END $$;
""" % ', '.join(f"'{c}'" for c in ORPHAN_NOT_NULL_COLUMNS)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0078_user_is_review_account'),
    ]

    operations = [
        migrations.RunSQL(RELAX_SQL, reverse_sql=migrations.RunSQL.noop),
    ]
