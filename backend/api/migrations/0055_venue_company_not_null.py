"""
Data migration + schema migration to make Venue.company non-nullable.

Step 1 (RunPython): Backfill any venues where company IS NULL by looking at
        the venue's shifts -> staff_user -> company memberships.
        Falls back to the first SecurityCompany in the system.

Step 2 (AlterField): Change the column to NOT NULL.
"""

from django.db import migrations, models
import django.db.models.deletion


def backfill_venue_company(apps, schema_editor):
    Venue = apps.get_model('api', 'Venue')
    SecurityCompany = apps.get_model('api', 'SecurityCompany')
    UserCompanyMembership = apps.get_model('api', 'UserCompanyMembership')
    Shift = apps.get_model('api', 'Shift')

    orphaned_venues = Venue.objects.filter(company__isnull=True)
    if not orphaned_venues.exists():
        return

    fallback_company = SecurityCompany.objects.order_by('id').first()

    for venue in orphaned_venues:
        assigned = False

        # Try to infer company from the venue's shifts
        shift = Shift.objects.filter(
            venue=venue,
            staff_user__isnull=False,
        ).select_related('staff_user').first()

        if shift and shift.staff_user:
            membership = UserCompanyMembership.objects.filter(
                user=shift.staff_user,
            ).first()
            if membership:
                venue.company = membership.company
                venue.save(update_fields=['company'])
                assigned = True

        if not assigned and fallback_company:
            venue.company = fallback_company
            venue.save(update_fields=['company'])


def reverse_backfill(apps, schema_editor):
    # No-op: we cannot un-assign companies reliably.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0054_add_old_new_status_to_shift_status_history'),
    ]

    operations = [
        migrations.RunPython(
            backfill_venue_company,
            reverse_code=reverse_backfill,
        ),
        migrations.AlterField(
            model_name='venue',
            name='company',
            field=models.ForeignKey(
                help_text='Company that owns this venue',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='venues',
                to='api.securitycompany',
            ),
        ),
    ]
