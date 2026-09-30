"""Incident reports keep their evidence photos in `photos`.

Production already has a `photos` jsonb column on `incident_reports`, left
behind by 0035/0036 (see 0079) and made nullable there. Django doesn't know
about it, so a plain AddField would fail in production with "column already
exists" while passing everywhere else. This adds the column only where it is
missing and records the field in Django's state either way.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0081_alter_capacitycheck_baseline_occupancy_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS photos jsonb NULL",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="incidentreport",
                    name="photos",
                    field=models.JSONField(blank=True, default=list, null=True),
                ),
            ],
        ),
    ]
