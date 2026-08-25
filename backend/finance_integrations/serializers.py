from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    AccountingProvider, ProviderConnection, AccountMapping, VATCodeMapping,
    EarningsTypeMapping, ContactMapping, InvoiceExport, PayrollExport,
    WebhookEvent, SyncLog
)

User = get_user_model()


class ScopedConnectionSerializerMixin:
    """
    Restrict the writable `connection` field to connections this request can
    actually reach.

    ModelSerializer would otherwise expose `connection` as a plain writable PK
    accepting ANY id, so a POST body could name another company's connection
    and plant a mapping that silently poisons that company's next export --
    _build_invoice_draft() reads AccountMapping/VATCodeMapping by connection.

    Fails closed: with no request in context the field accepts nothing.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        field = self.fields.get('connection')
        if field is None:
            return

        from .scoping import company_connections

        request = self.context.get('request')
        field.queryset = (
            company_connections(request) if request is not None
            else ProviderConnection.objects.none()
        )


class AccountingProviderSerializer(serializers.ModelSerializer):
    """Serializer for accounting providers"""
    
    class Meta:
        model = AccountingProvider
        fields = [
            'id', 'provider_key', 'display_name', 'is_active',
            'oauth_scopes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'oauth_client_id': {'write_only': True},
            'oauth_client_secret': {'write_only': True},
        }


class ProviderConnectionSerializer(serializers.ModelSerializer):
    """Serializer for provider connections"""
    
    provider_name = serializers.CharField(source='provider.display_name', read_only=True)
    provider_key = serializers.CharField(source='provider.provider_key', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    is_token_valid = serializers.SerializerMethodField()
    
    class Meta:
        model = ProviderConnection
        fields = [
            'id', 'provider', 'provider_name', 'provider_key', 'company_name', 
            'tenant_id', 'status', 'last_sync_at', 'error_message', 
            'is_sandbox', 'auto_sync_invoices', 'auto_sync_payroll',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'is_token_valid'
        ]
        read_only_fields = [
            'provider_name', 'provider_key', 'created_by_name', 'status', 
            'last_sync_at', 'error_message', 'created_at', 'updated_at',
            'is_token_valid'
        ]
        extra_kwargs = {
            'access_token': {'write_only': True},
            'refresh_token': {'write_only': True},
            'token_expires_at': {'write_only': True},
        }
    
    def get_is_token_valid(self, obj):
        return obj.is_token_valid()


class AccountMappingSerializer(ScopedConnectionSerializerMixin, serializers.ModelSerializer):
    """Serializer for account mappings"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    
    class Meta:
        model = AccountMapping
        fields = [
            'id', 'connection', 'connection_name', 'mapping_type', 
            'local_account_name', 'provider_account_id', 'provider_account_name',
            'is_default', 'created_at', 'updated_at'
        ]
        read_only_fields = ['connection_name', 'created_at', 'updated_at']


class VATCodeMappingSerializer(ScopedConnectionSerializerMixin, serializers.ModelSerializer):
    """Serializer for VAT code mappings"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    
    class Meta:
        model = VATCodeMapping
        fields = [
            'id', 'connection', 'connection_name', 'local_vat_code', 
            'local_vat_rate', 'provider_vat_code', 'provider_vat_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['connection_name', 'created_at', 'updated_at']


class EarningsTypeMappingSerializer(ScopedConnectionSerializerMixin, serializers.ModelSerializer):
    """Serializer for earnings type mappings"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    
    class Meta:
        model = EarningsTypeMapping
        fields = [
            'id', 'connection', 'connection_name', 'local_earnings_name', 
            'local_hourly_rate', 'provider_earnings_code', 'provider_earnings_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['connection_name', 'created_at', 'updated_at']


class ContactMappingSerializer(serializers.ModelSerializer):
    """Serializer for contact mappings"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    local_user_name = serializers.CharField(source='local_user.get_full_name', read_only=True)
    
    class Meta:
        model = ContactMapping
        fields = [
            'id', 'connection', 'connection_name', 'contact_type', 
            'local_user', 'local_user_name', 'provider_contact_id', 
            'provider_contact_name', 'last_synced_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'connection_name', 'local_user_name', 'last_synced_at', 
            'created_at', 'updated_at'
        ]


class InvoiceExportSerializer(serializers.ModelSerializer):
    """Serializer for invoice exports"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    invoice_details = serializers.SerializerMethodField()
    exported_by_name = serializers.CharField(source='exported_by.get_full_name', read_only=True)
    
    class Meta:
        model = InvoiceExport
        fields = [
            'id', 'connection', 'connection_name', 'local_invoice', 
            'invoice_details', 'provider_invoice_id', 'provider_invoice_number',
            'status', 'error_message', 'exported_by', 'exported_by_name',
            'exported_at', 'completed_at'
        ]
        read_only_fields = [
            'connection_name', 'invoice_details', 'provider_invoice_id', 
            'provider_invoice_number', 'status', 'error_message',
            'exported_by_name', 'exported_at', 'completed_at'
        ]
    
    def get_invoice_details(self, obj):
        if obj.local_invoice:
            return {
                'id': obj.local_invoice.id,
                'total_amount': float(obj.local_invoice.total_amount),
                'staff_user': obj.local_invoice.staff_user.get_full_name(),
                'start_date': obj.local_invoice.start_date,
                'end_date': obj.local_invoice.end_date
            }
        return None


class PayrollExportSerializer(serializers.ModelSerializer):
    """Serializer for payroll exports"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    exported_by_name = serializers.CharField(source='exported_by.get_full_name', read_only=True)
    staff_count = serializers.SerializerMethodField()
    
    class Meta:
        model = PayrollExport
        fields = [
            'id', 'connection', 'connection_name', 'export_type',
            'pay_period_start', 'pay_period_end', 'staff_users', 'staff_count',
            'provider_payrun_id', 'provider_reference', 'status', 'error_message',
            'exported_by', 'exported_by_name', 'exported_at', 'completed_at'
        ]
        read_only_fields = [
            'connection_name', 'exported_by_name', 'staff_count',
            'provider_payrun_id', 'provider_reference', 'status', 
            'error_message', 'exported_at', 'completed_at'
        ]
    
    def get_staff_count(self, obj):
        return obj.staff_users.count()


class SyncLogSerializer(serializers.ModelSerializer):
    """Serializer for sync logs"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = SyncLog
        fields = [
            'id', 'connection', 'connection_name', 'operation', 'level', 
            'message', 'metadata', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = [
            'connection_name', 'created_by_name', 'created_at'
        ]


class OAuthInitiateSerializer(serializers.Serializer):
    """Serializer for initiating OAuth flow"""
    
    provider_key = serializers.CharField()
    redirect_uri = serializers.URLField()
    is_sandbox = serializers.BooleanField(default=False)


class OAuthCallbackSerializer(serializers.Serializer):
    """Serializer for OAuth callback"""
    
    provider_key = serializers.CharField()
    code = serializers.CharField()
    state = serializers.CharField()
    redirect_uri = serializers.URLField()
    tenant_id = serializers.CharField(required=False, allow_blank=True)
    is_sandbox = serializers.BooleanField(default=False)


class InvoiceExportRequestSerializer(serializers.Serializer):
    """Serializer for invoice export requests"""
    
    connection_id = serializers.IntegerField()
    invoice_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )


class PayrollExportRequestSerializer(serializers.Serializer):
    """Serializer for payroll export requests"""
    
    connection_id = serializers.IntegerField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    staff_user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    export_type = serializers.ChoiceField(
        choices=[('payrun', 'Pay Run'), ('journal', 'Journal Entry')],
        default='payrun'
    )


class ProviderAccountSerializer(serializers.Serializer):
    """Serializer for provider accounts (from API)"""
    
    id = serializers.CharField()
    name = serializers.CharField()
    code = serializers.CharField(required=False)
    type = serializers.CharField()
    is_active = serializers.BooleanField()


class ProviderVATCodeSerializer(serializers.Serializer):
    """Serializer for provider VAT codes (from API)"""
    
    id = serializers.CharField()
    name = serializers.CharField()
    code = serializers.CharField()
    rate = serializers.FloatField()
    is_active = serializers.BooleanField()


class ProviderEarningsTypeSerializer(serializers.Serializer):
    """Serializer for provider earnings types (from API)"""
    
    id = serializers.CharField()
    name = serializers.CharField()
    code = serializers.CharField()
    is_allowance = serializers.BooleanField()
    is_tax_exempt = serializers.BooleanField()


class TestConnectionSerializer(serializers.Serializer):
    """Serializer for connection test results"""
    
    success = serializers.BooleanField()
    error_message = serializers.CharField(required=False, allow_null=True)
    company_info = serializers.DictField(required=False)


class WebhookEventSerializer(serializers.ModelSerializer):
    """Serializer for webhook events"""
    
    connection_name = serializers.CharField(source='connection.company_name', read_only=True)
    
    class Meta:
        model = WebhookEvent
        fields = [
            'id', 'connection', 'connection_name', 'event_type', 'event_id',
            'status', 'error_message', 'received_at', 'processed_at'
        ]
        read_only_fields = [
            'connection_name', 'status', 'error_message', 
            'received_at', 'processed_at'
        ]