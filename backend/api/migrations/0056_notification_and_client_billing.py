import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0055_venue_company_not_null'),
    ]

    operations = [
        # Notification model
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('notification_type', models.CharField(choices=[
                    ('shift_assigned', 'Shift Assigned'),
                    ('shift_removed', 'Shift Removed'),
                    ('shift_updated', 'Shift Updated'),
                    ('shift_approved', 'Shift Approved'),
                    ('shift_rejected', 'Shift Rejected'),
                    ('open_shift', 'Open Shift Available'),
                    ('exchange_request', 'Exchange Request'),
                    ('exchange_approved', 'Exchange Approved'),
                    ('exchange_rejected', 'Exchange Rejected'),
                    ('leave_approved', 'Leave Approved'),
                    ('leave_rejected', 'Leave Rejected'),
                    ('compliance_alert', 'Compliance Alert'),
                    ('sia_expiry', 'SIA License Expiry'),
                    ('invoice_ready', 'Invoice Ready'),
                    ('general', 'General'),
                ], default='general', max_length=30)),
                ('priority', models.CharField(choices=[
                    ('low', 'Low'), ('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent'),
                ], default='normal', max_length=10)),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('related_type', models.CharField(blank=True, max_length=50)),
                ('related_id', models.CharField(blank=True, max_length=255)),
                ('action_url', models.CharField(blank=True, max_length=500)),
                ('is_read', models.BooleanField(default=False)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to=settings.AUTH_USER_MODEL)),
                ('company', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='api.securitycompany')),
            ],
            options={
                'db_table': 'notifications',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['user', 'is_read', '-created_at'], name='notif_user_read_idx'),
                    models.Index(fields=['user', 'notification_type'], name='notif_user_type_idx'),
                ],
            },
        ),
        # ClientInvoice model
        migrations.CreateModel(
            name='ClientInvoice',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('invoice_number', models.CharField(max_length=50, unique=True)),
                ('start_date', models.DateField()),
                ('end_date', models.DateField()),
                ('subtotal', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('tax_rate', models.DecimalField(decimal_places=2, default=20.00, max_digits=5)),
                ('tax_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('total_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('status', models.CharField(choices=[
                    ('draft', 'Draft'), ('sent', 'Sent'), ('paid', 'Paid'),
                    ('overdue', 'Overdue'), ('cancelled', 'Cancelled'),
                ], default='draft', max_length=20)),
                ('issued_date', models.DateField(blank=True, null=True)),
                ('due_date', models.DateField(blank=True, null=True)),
                ('paid_date', models.DateField(blank=True, null=True)),
                ('client_name', models.CharField(max_length=255)),
                ('client_address', models.TextField(blank=True)),
                ('client_email', models.EmailField(blank=True, max_length=254)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='client_invoices', to='api.securitycompany')),
                ('venue', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='client_invoices', to='api.venue')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_client_invoices', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'client_invoices',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['company', 'status'], name='ci_company_status_idx'),
                    models.Index(fields=['venue', 'start_date'], name='ci_venue_date_idx'),
                    models.Index(fields=['invoice_number'], name='ci_number_idx'),
                ],
            },
        ),
        # ClientInvoiceItem model
        migrations.CreateModel(
            name='ClientInvoiceItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('description', models.CharField(max_length=500)),
                ('date', models.DateField()),
                ('hours', models.DecimalField(decimal_places=2, default=0, max_digits=6)),
                ('rate', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('invoice', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='line_items', to='api.clientinvoice')),
                ('shift', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='client_invoice_items', to='api.shift')),
            ],
            options={
                'db_table': 'client_invoice_items',
                'ordering': ['date'],
            },
        ),
    ]
