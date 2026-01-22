# Generated migration for multi-staff shift support
# Adds shift_group and performed_by fields to all check models

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0045_invoice_last_recalculated_at_invoice_version_and_more'),
    ]

    operations = [
        # FireExitCheck: Add shift_group field
        migrations.AddField(
            model_name='fireexitcheck',
            name='shift_group',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Links check to all shifts in a group for multi-staff visibility',
                max_length=50,
                null=True
            ),
        ),
        # FireExitCheck: Add performed_by field
        migrations.AddField(
            model_name='fireexitcheck',
            name='performed_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Staff member who performed this check',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='fireexitcheck_performed',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        # CapacityCheck: Add shift_group field
        migrations.AddField(
            model_name='capacitycheck',
            name='shift_group',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Links check to all shifts in a group for multi-staff visibility',
                max_length=50,
                null=True
            ),
        ),
        # CapacityCheck: Add performed_by field
        migrations.AddField(
            model_name='capacitycheck',
            name='performed_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Staff member who performed this check',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='capacitycheck_performed',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        # ToiletCheck: Add shift_group field
        migrations.AddField(
            model_name='toiletcheck',
            name='shift_group',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Links check to all shifts in a group for multi-staff visibility',
                max_length=50,
                null=True
            ),
        ),
        # ToiletCheck: Add performed_by field
        migrations.AddField(
            model_name='toiletcheck',
            name='performed_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Staff member who performed this check',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='toiletcheck_performed',
                to=settings.AUTH_USER_MODEL
            ),
        ),
    ]
