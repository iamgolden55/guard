from django.contrib import admin
from .models import (
    AccountingProvider, ProviderConnection, AccountMapping, VATCodeMapping,
    EarningsTypeMapping, ContactMapping, InvoiceExport, PayrollExport,
    WebhookEvent, SyncLog
)


@admin.register(AccountingProvider)
class AccountingProviderAdmin(admin.ModelAdmin):
    list_display = ['provider_key', 'display_name', 'is_active', 'created_at']
    list_filter = ['is_active', 'provider_key']
    search_fields = ['display_name', 'provider_key']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ProviderConnection)
class ProviderConnectionAdmin(admin.ModelAdmin):
    list_display = ['provider', 'company_name', 'status', 'is_sandbox', 'created_by', 'created_at']
    list_filter = ['provider', 'status', 'is_sandbox', 'auto_sync_invoices', 'auto_sync_payroll']
    search_fields = ['company_name', 'tenant_id']
    readonly_fields = ['created_at', 'updated_at', 'last_sync_at']
    
    fieldsets = (
        (None, {
            'fields': ('provider', 'company_name', 'tenant_id', 'status')
        }),
        ('OAuth Tokens', {
            'fields': ('access_token', 'refresh_token', 'token_expires_at'),
            'classes': ('collapse',)
        }),
        ('Settings', {
            'fields': ('is_sandbox', 'auto_sync_invoices', 'auto_sync_payroll')
        }),
        ('Status', {
            'fields': ('last_sync_at', 'error_message')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(AccountMapping)
class AccountMappingAdmin(admin.ModelAdmin):
    list_display = ['connection', 'mapping_type', 'local_account_name', 'provider_account_name', 'is_default']
    list_filter = ['connection', 'mapping_type', 'is_default']
    search_fields = ['local_account_name', 'provider_account_name']


@admin.register(VATCodeMapping)
class VATCodeMappingAdmin(admin.ModelAdmin):
    list_display = ['connection', 'local_vat_code', 'local_vat_rate', 'provider_vat_name']
    list_filter = ['connection']
    search_fields = ['local_vat_code', 'provider_vat_name']


@admin.register(EarningsTypeMapping)
class EarningsTypeMappingAdmin(admin.ModelAdmin):
    list_display = ['connection', 'local_earnings_name', 'local_hourly_rate', 'provider_earnings_name']
    list_filter = ['connection']
    search_fields = ['local_earnings_name', 'provider_earnings_name']


@admin.register(ContactMapping)
class ContactMappingAdmin(admin.ModelAdmin):
    list_display = ['connection', 'contact_type', 'local_user', 'provider_contact_name', 'last_synced_at']
    list_filter = ['connection', 'contact_type']
    search_fields = ['local_user__username', 'local_user__first_name', 'local_user__last_name', 'provider_contact_name']


@admin.register(InvoiceExport)
class InvoiceExportAdmin(admin.ModelAdmin):
    list_display = ['connection', 'local_invoice', 'provider_invoice_number', 'status', 'exported_by', 'exported_at']
    list_filter = ['connection', 'status']
    search_fields = ['provider_invoice_id', 'provider_invoice_number']
    readonly_fields = ['exported_at', 'completed_at']
    
    fieldsets = (
        (None, {
            'fields': ('connection', 'local_invoice', 'status')
        }),
        ('Provider Details', {
            'fields': ('provider_invoice_id', 'provider_invoice_number')
        }),
        ('Export Data', {
            'fields': ('export_data', 'provider_response', 'error_message'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('exported_by', 'exported_at', 'completed_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(PayrollExport)
class PayrollExportAdmin(admin.ModelAdmin):
    list_display = ['connection', 'export_type', 'pay_period_start', 'pay_period_end', 'status', 'exported_by']
    list_filter = ['connection', 'export_type', 'status']
    readonly_fields = ['exported_at', 'completed_at']
    
    fieldsets = (
        (None, {
            'fields': ('connection', 'export_type', 'pay_period_start', 'pay_period_end', 'status')
        }),
        ('Provider Details', {
            'fields': ('provider_payrun_id', 'provider_reference')
        }),
        ('Export Data', {
            'fields': ('export_data', 'provider_response', 'error_message'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('exported_by', 'exported_at', 'completed_at'),
            'classes': ('collapse',)
        })
    )


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ['connection', 'event_type', 'status', 'received_at']
    list_filter = ['connection', 'event_type', 'status']
    search_fields = ['event_type', 'event_id']
    readonly_fields = ['received_at', 'processed_at']
    
    fieldsets = (
        (None, {
            'fields': ('connection', 'event_type', 'event_id', 'status')
        }),
        ('Payload', {
            'fields': ('raw_payload', 'signature', 'processed_data'),
            'classes': ('collapse',)
        }),
        ('Processing', {
            'fields': ('error_message', 'received_at', 'processed_at')
        })
    )


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    list_display = ['connection', 'operation', 'level', 'message', 'created_at']
    list_filter = ['connection', 'operation', 'level']
    search_fields = ['message']
    readonly_fields = ['created_at']
    
    fieldsets = (
        (None, {
            'fields': ('connection', 'operation', 'level', 'message')
        }),
        ('References', {
            'fields': ('invoice_export', 'payroll_export', 'webhook_event'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_by', 'created_at'),
            'classes': ('collapse',)
        })
    )