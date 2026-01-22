# Generated migration for UserPresenceStatus model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0042_add_unique_shift_constraint_invoice_item'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserPresenceStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[
                        ('available', 'Available'),
                        ('busy', 'Busy'),
                        ('away', 'Away'),
                        ('in_call', 'In a Call'),
                        ('presenting', 'Presenting'),
                        ('offline', 'Offline'),
                        ('do_not_disturb', 'Do Not Disturb'),
                    ],
                    db_index=True,
                    default='offline',
                    help_text='Current presence status',
                    max_length=20
                )),
                ('activity', models.CharField(
                    blank=True,
                    choices=[
                        ('working', 'Working'),
                        ('on_break', 'On Break'),
                        ('patrolling', 'Patrolling'),
                        ('incident_response', 'Incident Response'),
                        ('shift_handover', 'Shift Handover'),
                        ('meeting', 'In Meeting'),
                        ('training', 'Training'),
                        ('custom', 'Custom'),
                    ],
                    default='working',
                    help_text='Current activity',
                    max_length=30
                )),
                ('status_message', models.CharField(
                    blank=True,
                    help_text="Custom status message (e.g., 'Available for calls')",
                    max_length=255
                )),
                ('is_mobile_connected', models.BooleanField(
                    db_index=True,
                    default=False,
                    help_text='Whether user has an active mobile app connection'
                )),
                ('last_seen', models.DateTimeField(
                    db_index=True,
                    default=django.utils.timezone.now,
                    help_text='Last time user was active/seen online'
                )),
                ('last_heartbeat', models.DateTimeField(
                    blank=True,
                    help_text='Last WebSocket heartbeat received',
                    null=True
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    help_text='User this presence status belongs to',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='presence_status',
                    to=settings.AUTH_USER_MODEL
                )),
                ('current_venue', models.ForeignKey(
                    blank=True,
                    help_text='Current venue where user is working',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='present_users',
                    to='api.venue'
                )),
                ('current_shift', models.ForeignKey(
                    blank=True,
                    help_text='Current active shift',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='presence_records',
                    to='api.shift'
                )),
            ],
            options={
                'db_table': 'user_presence_status',
                'verbose_name': 'User Presence Status',
                'verbose_name_plural': 'User Presence Statuses',
            },
        ),
        migrations.AddIndex(
            model_name='userpresencestatus',
            index=models.Index(fields=['status', 'is_mobile_connected'], name='user_presen_status_f8d3b9_idx'),
        ),
        migrations.AddIndex(
            model_name='userpresencestatus',
            index=models.Index(fields=['last_seen'], name='user_presen_last_se_a5e1c7_idx'),
        ),
    ]
