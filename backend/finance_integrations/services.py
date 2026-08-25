from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
import logging

from .models import (
    AccountingProvider, ProviderConnection, AccountMapping, VATCodeMapping,
    EarningsTypeMapping, ContactMapping, InvoiceExport, PayrollExport,
    WebhookEvent, SyncLog
)
from .providers.factory import ProviderFactory
from .providers.base import (
    AccountingProvider as BaseProvider, InvoiceDraft, PayRunDraft, JournalDraft,
    Contact, Employee, InvoiceLineItem, PayrollLineItem,
    AccountingProviderError, AuthenticationError
)
from api.models import Invoice, InvoiceItem, PayRate, Shift

logger = logging.getLogger(__name__)


class FinanceIntegrationService:
    """Main service for finance integrations"""
    
    def __init__(self, connection: ProviderConnection):
        """Initialize service with a provider connection"""
        self.connection = connection
        self.provider = self._create_provider()
    
    def _create_provider(self) -> BaseProvider:
        """Create provider instance from connection"""
        config = {
            'client_id': self.connection.provider.oauth_client_id,
            'client_secret': self.connection.provider.oauth_client_secret,
            'access_token': self.connection.access_token,
            'refresh_token': self.connection.refresh_token,
            'tenant_id': self.connection.tenant_id,
            'is_sandbox': self.connection.is_sandbox,
        }
        
        return ProviderFactory.create_provider(
            self.connection.provider.provider_key, 
            config
        )
    
    def test_connection(self) -> Tuple[bool, Optional[str]]:
        """
        Test the connection to the accounting provider
        
        Returns:
            (success, error_message)
        """
        try:
            # Try to refresh token if needed
            if not self.connection.is_token_valid():
                self.refresh_connection_token()
            
            # Test connection by getting company info
            company_info = self.provider.get_company_info()
            
            # Update connection with company name
            if not self.connection.company_name:
                self.connection.company_name = company_info.name
                self.connection.save()
            
            return True, None
            
        except AuthenticationError as e:
            return False, f"Authentication failed: {str(e)}"
        except Exception as e:
            return False, f"Connection test failed: {str(e)}"
    
    def refresh_connection_token(self) -> bool:
        """
        Refresh the OAuth token for the connection
        
        Returns:
            True if successful
        """
        try:
            if not self.connection.refresh_token:
                raise AuthenticationError("No refresh token available")
            
            tokens = self.provider.refresh_tokens(self.connection.refresh_token)
            
            # Update connection with new tokens
            self.connection.access_token = tokens.access_token
            if tokens.refresh_token:
                self.connection.refresh_token = tokens.refresh_token
            self.connection.token_expires_at = tokens.expires_at
            self.connection.status = 'connected'
            self.connection.error_message = ''
            self.connection.save()
            
            # Update provider config
            self.provider.config['access_token'] = tokens.access_token
            
            # Log success
            SyncLog.objects.create(
                connection=self.connection,
                operation='oauth_refresh',
                level='success',
                message='OAuth token refreshed successfully'
            )
            
            return True
            
        except Exception as e:
            # Update connection status
            self.connection.status = 'expired'
            self.connection.error_message = str(e)
            self.connection.save()
            
            # Log error
            SyncLog.objects.create(
                connection=self.connection,
                operation='oauth_refresh',
                level='error',
                message=f'Token refresh failed: {str(e)}'
            )
            
            raise
    
    def export_invoice(self, invoice: Invoice, user: User) -> InvoiceExport:
        """
        Export an invoice to the accounting provider
        
        Args:
            invoice: Local invoice to export
            user: User performing the export
            
        Returns:
            InvoiceExport record
        """
        # Check if already exported
        existing_export = InvoiceExport.objects.filter(
            connection=self.connection,
            local_invoice=invoice
        ).first()
        
        if existing_export and existing_export.status == 'completed':
            raise ValueError(f"Invoice #{invoice.id} has already been exported")
        
        # Create or update export record
        export_record = existing_export or InvoiceExport.objects.create(
            connection=self.connection,
            local_invoice=invoice,
            exported_by=user,
            status='pending'
        )
        
        try:
            export_record.status = 'processing'
            export_record.save()
            
            # Ensure contact exists in provider
            contact_id = self._ensure_contact_exists(invoice.staff_user)
            
            # Create invoice draft
            invoice_draft = self._build_invoice_draft(invoice, contact_id)
            
            # Export to provider
            result = self.provider.create_invoice(invoice_draft)
            
            # Update export record
            export_record.provider_invoice_id = result['id']
            export_record.provider_invoice_number = result.get('invoice_number')
            export_record.export_data = invoice_draft.__dict__
            export_record.provider_response = result
            export_record.status = 'completed'
            export_record.completed_at = timezone.now()
            export_record.save()
            
            # Upload PDF if supported
            if self.provider.supports_attachments() and invoice.pdf_url:
                self._upload_invoice_pdf(invoice, result['id'])
            
            # Log success
            SyncLog.objects.create(
                connection=self.connection,
                operation='export_invoice',
                level='success',
                message=f'Invoice #{invoice.id} exported successfully',
                invoice_export=export_record,
                created_by=user
            )
            
            return export_record
            
        except Exception as e:
            # Update export record with error
            export_record.status = 'failed'
            export_record.error_message = str(e)
            export_record.save()
            
            # Log error
            SyncLog.objects.create(
                connection=self.connection,
                operation='export_invoice',
                level='error',
                message=f'Invoice export failed: {str(e)}',
                invoice_export=export_record,
                created_by=user
            )
            
            raise
    
    def _ensure_contact_exists(self, user: User) -> str:
        """Ensure contact exists in provider and return provider ID"""
        # Check if mapping exists
        mapping = ContactMapping.objects.filter(
            connection=self.connection,
            local_user=user,
            contact_type='employee'
        ).first()
        
        if mapping:
            return mapping.provider_contact_id
        
        # Create contact in provider
        contact = Contact(
            name=user.get_full_name() or user.username,
            email=user.email,
            is_customer=False,  # Staff are suppliers in this context
            is_supplier=True,
            contact_type='supplier'
        )
        
        # Add staff profile details if available
        if hasattr(user, 'profile'):
            profile = user.profile
            if profile.phone_number:
                contact.phone = profile.phone_number
            if profile.address_line1:
                contact.address_line1 = profile.address_line1
                contact.address_line2 = profile.address_line2
                contact.city = profile.city
                contact.postal_code = profile.postal_code
                contact.country = profile.country
        
        provider_contact_id = self.provider.upsert_contact(contact)
        
        # Create mapping
        ContactMapping.objects.create(
            connection=self.connection,
            contact_type='employee',
            local_user=user,
            provider_contact_id=provider_contact_id,
            provider_contact_name=contact.name,
            last_synced_at=timezone.now()
        )
        
        return provider_contact_id
    
    def _build_invoice_draft(self, invoice: Invoice, contact_id: str) -> InvoiceDraft:
        """Build invoice draft from local invoice"""
        draft = InvoiceDraft(
            contact_id=contact_id,
            invoice_number=invoice.invoice_number or f"INV-{invoice.id}",
            reference=f"Staff Invoice for {invoice.staff_user.get_full_name()}",
            date=invoice.created_at,
            due_date=invoice.created_at + timedelta(days=30)  # 30 day payment terms
        )

        # These are per-connection, not per-line -- looking them up inside the
        # loop cost two queries per line item and always returned the same row.
        # 'expense' because staff pay is pushed as an ACCPAY bill (money out).
        account_mapping = AccountMapping.objects.filter(
            connection=self.connection,
            mapping_type='expense',
            is_default=True
        ).first()

        # Get VAT mapping (assume standard rate for now)
        vat_mapping = VATCodeMapping.objects.filter(
            connection=self.connection,
            local_vat_code='STANDARD'
        ).first()

        for item in invoice.items.all():
            # Line items cover shift work (venue + hours_worked) *and* leave /
            # bank-holiday entries, where venue and hours_worked are both null
            # and the quantity lives in `days` instead. Guard both, or any
            # invoice containing a leave line dies mid-export.
            if item.hours_worked is not None:
                quantity, unit_label = float(item.hours_worked), 'hours'
            elif item.days is not None:
                quantity, unit_label = float(item.days), 'days'
            else:
                quantity, unit_label = 1.0, None

            if item.description:
                description = item.description
            else:
                label = item.venue.name if item.venue_id else item.get_item_type_display()
                description = f"{label} - {item.date.strftime('%Y-%m-%d')}"
                if unit_label:
                    description = f"{description} ({quantity:g} {unit_label})"

            line_item = InvoiceLineItem(
                description=description,
                quantity=quantity,
                unit_amount=float(item.rate),
                account_id=account_mapping.provider_account_id if account_mapping else None,
                vat_code_id=vat_mapping.provider_vat_code if vat_mapping else None
            )

            draft.line_items.append(line_item)

        return draft
    
    def _upload_invoice_pdf(self, invoice: Invoice, provider_invoice_id: str) -> None:
        """Upload invoice PDF as attachment"""
        try:
            if not invoice.pdf_url:
                return
            
            # Read PDF content (this assumes pdf_url is a local file path)
            import os
            if os.path.exists(invoice.pdf_url):
                with open(invoice.pdf_url, 'rb') as f:
                    pdf_content = f.read()
                
                filename = f"invoice_{invoice.id}.pdf"
                self.provider.upload_attachment(
                    provider_invoice_id,
                    filename,
                    pdf_content,
                    'application/pdf'
                )
        
        except Exception as e:
            logger.warning(f"Failed to upload PDF for invoice {invoice.id}: {str(e)}")
    
    def export_payroll_batch(self, start_date: datetime, end_date: datetime, 
                           staff_users: List[User], user: User) -> PayrollExport:
        """
        Export payroll for multiple staff users
        
        Args:
            start_date: Pay period start
            end_date: Pay period end
            staff_users: List of staff users to include
            user: User performing the export
            
        Returns:
            PayrollExport record
        """
        # Create export record
        export_record = PayrollExport.objects.create(
            connection=self.connection,
            export_type='payrun',
            pay_period_start=start_date.date(),
            pay_period_end=end_date.date(),
            exported_by=user,
            status='pending'
        )
        
        export_record.staff_users.set(staff_users)
        
        try:
            export_record.status = 'processing'
            export_record.save()
            
            # Build pay run draft
            payrun_draft = self._build_payrun_draft(start_date, end_date, staff_users)
            
            # Export to provider
            result = self.provider.create_pay_run(payrun_draft)
            
            # Update export record
            export_record.provider_payrun_id = result['id']
            export_record.provider_reference = result.get('reference')
            export_record.export_data = payrun_draft.__dict__
            export_record.provider_response = result
            export_record.status = 'completed'
            export_record.completed_at = timezone.now()
            export_record.save()
            
            # Log success
            SyncLog.objects.create(
                connection=self.connection,
                operation='export_payroll',
                level='success',
                message=f'Payroll exported for {len(staff_users)} staff members',
                payroll_export=export_record,
                created_by=user
            )
            
            return export_record
            
        except Exception as e:
            # Update export record with error
            export_record.status = 'failed'
            export_record.error_message = str(e)
            export_record.save()
            
            # Log error
            SyncLog.objects.create(
                connection=self.connection,
                operation='export_payroll',
                level='error',
                message=f'Payroll export failed: {str(e)}',
                payroll_export=export_record,
                created_by=user
            )
            
            raise
    
    def _build_payrun_draft(self, start_date: datetime, end_date: datetime, 
                           staff_users: List[User]) -> PayRunDraft:
        """Build pay run draft from local data"""
        draft = PayRunDraft(
            pay_period_start=start_date,
            pay_period_end=end_date,
            reference=f"Weekly Payroll {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
        )
        
        for user in staff_users:
            # Ensure employee exists in provider
            employee_id = self._ensure_employee_exists(user)
            
            # Get approved invoices for this period
            user_invoices = Invoice.objects.filter(
                staff_user=user,
                status='paid',
                start_date__gte=start_date.date(),
                end_date__lte=end_date.date()
            )
            
            total_amount = sum(float(inv.total_amount) for inv in user_invoices)
            total_hours = sum(float(inv.total_hours) for inv in user_invoices)
            
            if total_amount > 0:
                # Get earnings type mapping
                earnings_mapping = EarningsTypeMapping.objects.filter(
                    connection=self.connection,
                    local_earnings_name='Regular Hours'
                ).first()
                
                if earnings_mapping:
                    line_item = PayrollLineItem(
                        employee_id=employee_id,
                        earnings_type_id=earnings_mapping.provider_earnings_code,
                        hours=total_hours,
                        amount=total_amount,
                        description=f"Security services for period {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
                    )
                    
                    draft.line_items.append(line_item)
        
        return draft
    
    def _ensure_employee_exists(self, user: User) -> str:
        """Ensure employee exists in provider and return provider ID"""
        # Check if mapping exists
        mapping = ContactMapping.objects.filter(
            connection=self.connection,
            local_user=user,
            contact_type='employee'
        ).first()
        
        if mapping:
            return mapping.provider_contact_id
        
        # Create employee in provider
        employee = Employee(
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            is_active=user.is_active
        )
        
        # Add staff profile details if available
        if hasattr(user, 'profile'):
            profile = user.profile
            if profile.employee_number:
                employee.employee_number = profile.employee_number
            if profile.start_date:
                employee.start_date = profile.start_date
            # Bank details would need to be added to StaffProfile model
        
        provider_employee_id = self.provider.upsert_employee(employee)
        
        # Create mapping
        ContactMapping.objects.create(
            connection=self.connection,
            contact_type='employee',
            local_user=user,
            provider_contact_id=provider_employee_id,
            provider_contact_name=f"{employee.first_name} {employee.last_name}",
            last_synced_at=timezone.now()
        )
        
        return provider_employee_id
    
    def sync_payment_status(self, webhook_data: Dict[str, Any]) -> None:
        """
        Process webhook data to update payment status
        
        Args:
            webhook_data: Webhook payload data
        """
        try:
            # This would be provider-specific implementation
            # For now, we'll implement a generic approach
            
            event_type = webhook_data.get('eventType', '')
            
            if 'invoice' in event_type.lower() and 'paid' in event_type.lower():
                invoice_id = webhook_data.get('resourceId')
                
                if invoice_id:
                    # Find the export record
                    export_record = InvoiceExport.objects.filter(
                        connection=self.connection,
                        provider_invoice_id=invoice_id
                    ).first()
                    
                    if export_record:
                        # Update local invoice status
                        local_invoice = export_record.local_invoice
                        if local_invoice.status != 'paid':
                            local_invoice.status = 'paid'
                            local_invoice.save()
                            
                            # Log the update
                            SyncLog.objects.create(
                                connection=self.connection,
                                operation='import_payment',
                                level='success',
                                message=f'Invoice #{local_invoice.id} marked as paid via webhook',
                                metadata=webhook_data
                            )
        
        except Exception as e:
            # Log error but don't raise - webhooks should not fail
            SyncLog.objects.create(
                connection=self.connection,
                operation='webhook_process',
                level='error',
                message=f'Webhook processing failed: {str(e)}',
                metadata=webhook_data
            )


class ConnectionSetupService:
    """Service for setting up provider connections"""

    # OAuth round-trips are a browser redirect to the provider and back; ten
    # minutes is generous for a human clicking Allow.
    OAUTH_STATE_TTL_SECONDS = 600

    @staticmethod
    def _oauth_state_key(state: str) -> str:
        return f'finance_oauth_state:{state}'

    @staticmethod
    def _consume_oauth_state(state: str, user: User, provider_key: str) -> None:
        """
        Verify a callback's state against the value stored at initiate time and
        burn it so a code cannot be replayed. Raises ValueError on mismatch.
        """
        if not state:
            raise ValueError('Missing OAuth state parameter')

        key = ConnectionSetupService._oauth_state_key(state)
        stored = cache.get(key)
        if not stored:
            raise ValueError('OAuth state is unknown or has expired -- please start the connection again')
        if stored.get('user_id') != user.id or stored.get('provider_key') != provider_key:
            raise ValueError('OAuth state does not match the user or provider that started this flow')

        cache.delete(key)
    
    @staticmethod
    def initiate_oauth_flow(provider_key: str, user: User, redirect_uri: str, 
                          is_sandbox: bool = False) -> Tuple[str, str]:
        """
        Initiate OAuth flow for a provider
        
        Args:
            provider_key: Provider identifier
            user: User setting up the connection
            redirect_uri: OAuth callback URL
            is_sandbox: Whether to use sandbox mode
            
        Returns:
            (oauth_url, state) tuple
        """
        # Get provider config
        provider_model = AccountingProvider.objects.filter(
            provider_key=provider_key,
            is_active=True
        ).first()
        
        if not provider_model:
            raise ValueError(f"Provider {provider_key} not found or inactive")
        
        # Create temporary provider instance
        config = {
            'client_id': provider_model.oauth_client_id,
            'client_secret': provider_model.oauth_client_secret,
            'is_sandbox': is_sandbox
        }
        
        provider = ProviderFactory.create_provider(provider_key, config)
        
        # Generate state for CSRF protection and persist it so the callback can
        # verify the response came from a flow *this* user actually started.
        import uuid
        state = str(uuid.uuid4())
        cache.set(
            ConnectionSetupService._oauth_state_key(state),
            {'user_id': user.id, 'provider_key': provider_key},
            timeout=ConnectionSetupService.OAUTH_STATE_TTL_SECONDS,
        )

        oauth_url = provider.get_oauth_url(state, redirect_uri)

        return oauth_url, state
    
    @staticmethod
    def get_available_tenants(provider_key: str, code: str, redirect_uri: str,
                            is_sandbox: bool = False) -> Dict[str, Any]:
        """
        Get available tenants/organizations after OAuth token exchange

        This is specifically for Xero which requires a separate API call to fetch
        the list of organizations after getting the access token.

        Args:
            provider_key: Provider identifier
            code: OAuth authorization code
            redirect_uri: OAuth callback URL
            is_sandbox: Whether to use sandbox mode

        Returns:
            Dict with 'access_token', 'refresh_token', 'expires_at', 'tenants' list
        """
        # Get provider config
        provider_model = AccountingProvider.objects.get(
            provider_key=provider_key,
            is_active=True
        )

        # Create provider instance
        config = {
            'client_id': provider_model.oauth_client_id,
            'client_secret': provider_model.oauth_client_secret,
            'is_sandbox': is_sandbox
        }

        provider = ProviderFactory.create_provider(provider_key, config)

        # Exchange code for tokens
        tokens = provider.exchange_oauth_code(code, redirect_uri)

        # For Xero, fetch available tenants
        tenants = []
        if provider_key == 'xero':
            config['access_token'] = tokens.access_token
            provider_with_token = ProviderFactory.create_provider(provider_key, config)
            tenants_data = provider_with_token.get_tenants()

            # Format tenant data for frontend
            tenants = [
                {
                    'tenant_id': t.get('tenantId'),
                    'tenant_name': t.get('tenantName'),
                    'tenant_type': t.get('tenantType'),
                }
                for t in tenants_data
            ]

        return {
            'access_token': tokens.access_token,
            'refresh_token': tokens.refresh_token,
            'expires_at': tokens.expires_at.isoformat(),
            'tenants': tenants,
            'provider_key': provider_key
        }

    @staticmethod
    def complete_oauth_flow(provider_key: str, code: str, state: str,
                          redirect_uri: str, user: User, tenant_id: Optional[str] = None,
                          is_sandbox: bool = False) -> ProviderConnection:
        """
        Complete OAuth flow and create connection

        Args:
            provider_key: Provider identifier
            code: OAuth authorization code
            state: CSRF state parameter
            redirect_uri: OAuth callback URL
            user: User setting up the connection
            tenant_id: Provider-specific tenant ID (for Xero - REQUIRED)
            is_sandbox: Whether to use sandbox mode

        Returns:
            ProviderConnection instance
        """
        ConnectionSetupService._consume_oauth_state(state, user, provider_key)

        # Get provider config
        provider_model = AccountingProvider.objects.get(
            provider_key=provider_key,
            is_active=True
        )

        # Create provider instance
        config = {
            'client_id': provider_model.oauth_client_id,
            'client_secret': provider_model.oauth_client_secret,
            'is_sandbox': is_sandbox
        }

        provider = ProviderFactory.create_provider(provider_key, config)

        # Exchange code for tokens
        tokens = provider.exchange_oauth_code(code, redirect_uri)

        # For Xero, if tenant_id not provided, fetch tenants and use first one
        if provider_key == 'xero' and not tenant_id:
            config['access_token'] = tokens.access_token
            provider_with_token = ProviderFactory.create_provider(provider_key, config)
            tenants = provider_with_token.get_tenants()

            if not tenants:
                raise ValueError("No Xero organizations found for this connection")

            # Auto-select first tenant if only one exists
            tenant_id = tenants[0].get('tenantId')

            # Log tenant auto-selection
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Auto-selected Xero tenant: {tenants[0].get('tenantName')} ({tenant_id})")

        # Get company info
        config['access_token'] = tokens.access_token
        config['tenant_id'] = tenant_id or tokens.tenant_id
        provider_with_token = ProviderFactory.create_provider(provider_key, config)

        company_info = provider_with_token.get_company_info()

        # Re-connecting an org that is already linked must UPDATE it. With
        # objects.create() the unique_together ('provider', 'tenant_id') raises
        # IntegrityError, and the only workaround -- disconnect first -- CASCADE
        # deletes every mapping and the whole export audit trail. Any change to
        # the requested scopes forces exactly this re-consent, so update_or_create
        # is what makes a scope change survivable.
        connection, _created = ProviderConnection.objects.update_or_create(
            provider=provider_model,
            tenant_id=tenant_id or tokens.tenant_id,
            defaults=dict(
                company_name=company_info.name,
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
                token_expires_at=tokens.expires_at,
                status='connected',
                error_message='',
                is_sandbox=is_sandbox,
                created_by=user,
            ),
        )

        # Log successful connection
        SyncLog.objects.create(
            connection=connection,
            operation='oauth_connect',
            level='success',
            message=f'Successfully connected to {provider_model.display_name}',
            created_by=user
        )

        return connection