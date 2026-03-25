from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone
from cryptography.fernet import Fernet
import json
import os

User = get_user_model()

class EncryptedJSONField(models.TextField):
    """Custom field that encrypts JSON data at rest"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Get encryption key from environment - require it to be set
        key = os.getenv('FINANCE_ENCRYPTION_KEY')
        if not key:
            raise ImproperlyConfigured(
                "FINANCE_ENCRYPTION_KEY environment variable must be set. "
                "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )
        if isinstance(key, str):
            key = key.encode()
        self.cipher = Fernet(key)
    
    def get_prep_value(self, value):
        if value is None:
            return None
        # Encrypt the JSON string
        json_str = json.dumps(value)
        encrypted = self.cipher.encrypt(json_str.encode())
        return encrypted.decode()
    
    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        try:
            # Decrypt and parse JSON
            decrypted = self.cipher.decrypt(value.encode())
            return json.loads(decrypted.decode())
        except Exception:
            # Fallback for unencrypted data during migration
            try:
                return json.loads(value)
            except:
                return {}

class AccountingProvider(models.Model):
    """Registry of available accounting providers"""
    
    PROVIDER_CHOICES = [
        ('xero', 'Xero'),
        ('quickbooks', 'QuickBooks Online'),
        ('freeagent', 'FreeAgent'),
        ('freshbooks', 'FreshBooks'),
        ('zoho', 'Zoho Books'),
        ('sage', 'Sage Business Cloud'),
        ('wave', 'Wave Accounting'),
        ('netsuite', 'NetSuite'),
    ]
    
    provider_key = models.CharField(max_length=50, choices=PROVIDER_CHOICES, unique=True)
    display_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    oauth_client_id = models.CharField(max_length=500, blank=True)
    oauth_client_secret = EncryptedJSONField(blank=True, null=True)
    oauth_scopes = models.TextField(blank=True, help_text="Comma-separated OAuth scopes")
    api_base_url = models.URLField(blank=True)
    webhook_url = models.URLField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'accounting_providers'
        ordering = ['display_name']
    
    def __str__(self):
        return self.display_name

class ProviderConnection(models.Model):
    """OAuth connections to accounting providers"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Setup'),
        ('connected', 'Connected'),
        ('expired', 'Token Expired'),
        ('error', 'Connection Error'),
        ('disabled', 'Disabled'),
    ]
    
    provider = models.ForeignKey(AccountingProvider, on_delete=models.CASCADE, related_name='connections')
    company_name = models.CharField(max_length=200, blank=True)
    tenant_id = models.CharField(max_length=200, blank=True, help_text="Provider-specific tenant/company ID")
    
    # Encrypted OAuth tokens
    access_token = EncryptedJSONField(null=True, blank=True)
    refresh_token = EncryptedJSONField(null=True, blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    
    # Connection metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    last_sync_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    
    # Settings
    is_sandbox = models.BooleanField(default=False, help_text="Use sandbox/demo environment")
    auto_sync_invoices = models.BooleanField(default=True)
    auto_sync_payroll = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_connections')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'provider_connections'
        ordering = ['-created_at']
        unique_together = ['provider', 'tenant_id']
    
    def __str__(self):
        return f"{self.provider.display_name} - {self.company_name or self.tenant_id}"
    
    def is_token_valid(self):
        """Check if access token is still valid"""
        if not self.token_expires_at:
            return False
        return timezone.now() < self.token_expires_at

class AccountMapping(models.Model):
    """Maps local chart of accounts to provider accounts"""
    
    MAPPING_TYPE_CHOICES = [
        ('revenue', 'Revenue Account'),
        ('expense', 'Expense Account'),
        ('liability', 'Liability Account'),
        ('asset', 'Asset Account'),
        ('equity', 'Equity Account'),
    ]
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='account_mappings')
    mapping_type = models.CharField(max_length=20, choices=MAPPING_TYPE_CHOICES)
    local_account_name = models.CharField(max_length=200)
    provider_account_id = models.CharField(max_length=100)
    provider_account_name = models.CharField(max_length=200)
    is_default = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'account_mappings'
        ordering = ['mapping_type', 'local_account_name']
        unique_together = ['connection', 'mapping_type', 'local_account_name']
    
    def __str__(self):
        return f"{self.local_account_name} → {self.provider_account_name}"

class VATCodeMapping(models.Model):
    """Maps local VAT codes to provider VAT codes"""
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='vat_mappings')
    local_vat_code = models.CharField(max_length=20)
    local_vat_rate = models.DecimalField(max_digits=5, decimal_places=4, help_text="VAT rate as decimal (e.g., 0.20 for 20%)")
    provider_vat_code = models.CharField(max_length=50)
    provider_vat_name = models.CharField(max_length=100)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'vat_code_mappings'
        ordering = ['local_vat_code']
        unique_together = ['connection', 'local_vat_code']
    
    def __str__(self):
        return f"{self.local_vat_code} ({self.local_vat_rate}%) → {self.provider_vat_name}"

class EarningsTypeMapping(models.Model):
    """Maps local pay rates/earnings to provider payroll earnings types"""
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='earnings_mappings')
    local_earnings_name = models.CharField(max_length=100, help_text="e.g., 'Regular Hours', 'Special Event Rate'")
    local_hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    provider_earnings_code = models.CharField(max_length=50)
    provider_earnings_name = models.CharField(max_length=100)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'earnings_type_mappings'
        ordering = ['local_earnings_name']
        unique_together = ['connection', 'local_earnings_name']
    
    def __str__(self):
        return f"{self.local_earnings_name} → {self.provider_earnings_name}"

class ContactMapping(models.Model):
    """Maps local staff/clients to provider contacts"""
    
    CONTACT_TYPE_CHOICES = [
        ('employee', 'Employee'),
        ('client', 'Client/Customer'),
        ('supplier', 'Supplier'),
    ]
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='contact_mappings')
    contact_type = models.CharField(max_length=20, choices=CONTACT_TYPE_CHOICES)
    local_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='provider_mappings')
    provider_contact_id = models.CharField(max_length=100)
    provider_contact_name = models.CharField(max_length=200)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'contact_mappings'
        ordering = ['contact_type', 'provider_contact_name']
        unique_together = ['connection', 'contact_type', 'local_user']
    
    def __str__(self):
        return f"{self.local_user.get_full_name()} → {self.provider_contact_name} ({self.contact_type})"

class InvoiceExport(models.Model):
    """Tracks invoice exports to accounting providers"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='invoice_exports')
    local_invoice = models.ForeignKey('api.Invoice', on_delete=models.CASCADE, related_name='exports')
    provider_invoice_id = models.CharField(max_length=100, blank=True)
    provider_invoice_number = models.CharField(max_length=100, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    export_data = models.JSONField(null=True, blank=True, help_text="Exported invoice data snapshot")
    provider_response = models.JSONField(null=True, blank=True, help_text="Provider API response")
    error_message = models.TextField(blank=True)
    
    exported_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exported_invoices')
    exported_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'invoice_exports'
        ordering = ['-exported_at']
        unique_together = ['connection', 'local_invoice']
    
    def __str__(self):
        return f"Invoice #{self.local_invoice.id} → {self.connection.provider.display_name} ({self.status})"

class PayrollExport(models.Model):
    """Tracks payroll/pay run exports to accounting providers"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    EXPORT_TYPE_CHOICES = [
        ('payrun', 'Pay Run'),
        ('journal', 'Journal Entry'),
    ]
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='payroll_exports')
    export_type = models.CharField(max_length=20, choices=EXPORT_TYPE_CHOICES, default='payrun')
    
    # Period details
    pay_period_start = models.DateField()
    pay_period_end = models.DateField()
    staff_users = models.ManyToManyField(User, related_name='payroll_exports')
    
    provider_payrun_id = models.CharField(max_length=100, blank=True)
    provider_reference = models.CharField(max_length=100, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    export_data = models.JSONField(null=True, blank=True, help_text="Exported payroll data snapshot")
    provider_response = models.JSONField(null=True, blank=True, help_text="Provider API response")
    error_message = models.TextField(blank=True)
    
    exported_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exported_payrolls')
    exported_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'payroll_exports'
        ordering = ['-exported_at']
    
    def __str__(self):
        return f"Payroll {self.pay_period_start} to {self.pay_period_end} → {self.connection.provider.display_name}"

class WebhookEvent(models.Model):
    """Logs incoming webhook events from accounting providers"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
        ('ignored', 'Ignored'),
    ]
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='webhook_events')
    event_type = models.CharField(max_length=100)
    event_id = models.CharField(max_length=100, blank=True, help_text="Provider event ID")
    
    raw_payload = models.JSONField(help_text="Raw webhook payload")
    signature = models.CharField(max_length=500, blank=True, help_text="Webhook signature for verification")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    processed_data = models.JSONField(null=True, blank=True, help_text="Processed data from webhook")
    error_message = models.TextField(blank=True)
    
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'webhook_events'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['event_type', '-received_at']),
            models.Index(fields=['status', '-received_at']),
        ]
    
    def __str__(self):
        return f"{self.connection.provider.display_name} - {self.event_type} ({self.status})"

class SyncLog(models.Model):
    """Audit log for all sync operations"""
    
    LOG_LEVEL_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('success', 'Success'),
    ]
    
    OPERATION_CHOICES = [
        ('oauth_connect', 'OAuth Connection'),
        ('oauth_refresh', 'Token Refresh'),
        ('export_invoice', 'Export Invoice'),
        ('export_payroll', 'Export Payroll'),
        ('import_payment', 'Import Payment'),
        ('webhook_process', 'Process Webhook'),
        ('mapping_update', 'Update Mapping'),
    ]
    
    connection = models.ForeignKey(ProviderConnection, on_delete=models.CASCADE, related_name='sync_logs')
    operation = models.CharField(max_length=50, choices=OPERATION_CHOICES)
    level = models.CharField(max_length=10, choices=LOG_LEVEL_CHOICES)
    message = models.TextField()
    
    # Optional references
    invoice_export = models.ForeignKey(InvoiceExport, null=True, blank=True, on_delete=models.SET_NULL, related_name='logs')
    payroll_export = models.ForeignKey(PayrollExport, null=True, blank=True, on_delete=models.SET_NULL, related_name='logs')
    webhook_event = models.ForeignKey(WebhookEvent, null=True, blank=True, on_delete=models.SET_NULL, related_name='logs')
    
    metadata = models.JSONField(null=True, blank=True, help_text="Additional context data")
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'sync_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['operation', '-created_at']),
            models.Index(fields=['level', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.connection.provider.display_name} - {self.operation} - {self.level}"