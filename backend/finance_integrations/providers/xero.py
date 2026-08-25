import requests
import json
from datetime import datetime, timedelta

from django.utils import timezone
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode, parse_qs
import hmac
import hashlib
import base64

from .base import (
    AccountingProvider, CompanyInfo, Contact, Employee, Account, VATCode, EarningsType,
    InvoiceDraft, PayRunDraft, JournalDraft, Payment, OAuthTokens,
    AccountingProviderError, AuthenticationError, RateLimitError, ValidationError
)


class XeroProvider(AccountingProvider):
    """Xero accounting provider implementation"""
    
    PRODUCTION_API_BASE = "https://api.xero.com"
    PRODUCTION_OAUTH_BASE = "https://identity.xero.com"

    # Xero uses the same URLs for sandbox - it's controlled by the organisation.
    # The "Use sandbox" checkbox in the UI is therefore a no-op for Xero; the
    # Demo Company org *is* the sandbox.
    SANDBOX_API_BASE = "https://api.xero.com"
    SANDBOX_OAUTH_BASE = "https://identity.xero.com"

    # Consent is served from login.xero.com; only the token endpoint lives on
    # identity.xero.com. Using identity.xero.com for authorize is a redirect at
    # best and a hard failure at worst.
    AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize"

    # Scopes are a property of this adapter (they must match the endpoints the
    # code below actually calls), so they live in version control where a test
    # can assert on them -- NOT in AccountingProvider.oauth_scopes, which has
    # two writers using two different separators and is read by nothing.
    #
    #   offline_access          -> without this Xero returns NO refresh token and
    #                              the connection dies ~30 minutes after consent.
    #   accounting.contacts     -> write, not .read: upsert_contact() POSTs.
    #   accounting.transactions -> covers invoice create/read.
    #   accounting.settings     -> Organisation, Accounts, TaxRates.
    #
    # Xero apps registered on/after 2 Mar 2026 use granular scopes instead; if
    # consent rejects accounting.transactions, swap it for accounting.invoices.
    # Payroll scopes are deliberately absent -- see create_pay_run().
    SCOPES = [
        "offline_access",
        "accounting.transactions",
        "accounting.contacts",
        "accounting.settings",
    ]
    
    def __init__(self, connection_config: Dict[str, Any]):
        super().__init__(connection_config)
        self.api_base = self.SANDBOX_API_BASE if self.is_sandbox else self.PRODUCTION_API_BASE
        self.oauth_base = self.SANDBOX_OAUTH_BASE if self.is_sandbox else self.PRODUCTION_OAUTH_BASE
        self.scopes = list(self.SCOPES)
    
    @property
    def provider_name(self) -> str:
        return "Xero"
    
    @property
    def oauth_authorization_url(self) -> str:
        return self.AUTHORIZE_URL
    
    @property
    def oauth_token_url(self) -> str:
        return f"{self.oauth_base}/connect/token"
    
    def get_oauth_url(self, state: str, redirect_uri: str) -> str:
        """Generate OAuth authorization URL for Xero"""
        params = {
            'response_type': 'code',
            'client_id': self.config['client_id'],
            'redirect_uri': redirect_uri,
            'scope': ' '.join(self.scopes),
            'state': state
        }
        return f"{self.oauth_authorization_url}?{urlencode(params)}"
    
    def exchange_oauth_code(self, code: str, redirect_uri: str) -> OAuthTokens:
        """Exchange OAuth code for tokens"""
        data = {
            'grant_type': 'authorization_code',
            'client_id': self.config['client_id'],
            'code': code,
            'redirect_uri': redirect_uri
        }
        
        client_id = self.config['client_id']
        client_secret = self.config['client_secret']
        auth_string = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        
        headers = {
            'Authorization': f"Basic {auth_string}",
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(self.oauth_token_url, data=data, headers=headers)
        
        if response.status_code != 200:
            raise AuthenticationError(
                f"OAuth token exchange failed: {response.text}",
                error_code="oauth_exchange_failed"
            )
        
        token_data = response.json()
        
        return OAuthTokens(
            access_token=token_data['access_token'],
            refresh_token=token_data.get('refresh_token'),
            expires_at=timezone.now() + timedelta(seconds=token_data.get('expires_in', 1800)),
            tenant_id=None,  # Xero requires separate call to get tenants
            scope=token_data.get('scope')
        )
    
    def refresh_tokens(self, refresh_token: str) -> OAuthTokens:
        """Refresh OAuth access token"""
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        client_id = self.config['client_id']
        client_secret = self.config['client_secret']
        auth_string = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        
        headers = {
            'Authorization': f"Basic {auth_string}",
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(self.oauth_token_url, data=data, headers=headers)
        
        if response.status_code != 200:
            raise AuthenticationError(
                f"Token refresh failed: {response.text}",
                error_code="token_refresh_failed"
            )
        
        token_data = response.json()
        
        return OAuthTokens(
            access_token=token_data['access_token'],
            refresh_token=token_data.get('refresh_token'),
            expires_at=timezone.now() + timedelta(seconds=token_data.get('expires_in', 1800)),
            tenant_id=self.config.get('tenant_id'),
            scope=token_data.get('scope')
        )
    
    def get_tenants(self) -> List[Dict[str, Any]]:
        """Get available Xero tenants/organisations"""
        response = self._make_request("GET", f"{self.api_base}/connections")
        return response.json()
    
    def _make_request(self, method: str, url: str, data: Optional[Dict] = None, 
                     params: Optional[Dict] = None, files: Optional[Dict] = None) -> requests.Response:
        """Make authenticated API request to Xero"""
        headers = {
            'Authorization': f"Bearer {self.config['access_token']}",
            'Accept': 'application/json',
            'Xero-tenant-id': self.config.get('tenant_id', '')
        }
        
        if data and not files:
            headers['Content-Type'] = 'application/json'
            data = json.dumps(data) if isinstance(data, dict) else data
        
        try:
            response = requests.request(
                method=method, 
                url=url, 
                headers=headers, 
                data=data, 
                params=params,
                files=files
            )
            
            if response.status_code == 401:
                raise AuthenticationError(
                    "Access token expired or invalid",
                    error_code="token_expired",
                    details=response.json() if response.content else {}
                )
            elif response.status_code == 429:
                raise RateLimitError(
                    "Rate limit exceeded",
                    error_code="rate_limit",
                    details={'retry_after': response.headers.get('Retry-After')}
                )
            elif response.status_code >= 400:
                error_data = response.json() if response.content else {}
                raise AccountingProviderError(
                    f"API request failed: {response.status_code}",
                    error_code="api_error",
                    details=error_data
                )
            
            return response
            
        except requests.exceptions.RequestException as e:
            raise AccountingProviderError(
                f"Network error: {str(e)}",
                error_code="network_error"
            )
    
    def get_company_info(self) -> CompanyInfo:
        """Get organisation information from Xero"""
        response = self._make_request("GET", f"{self.api_base}/api.xro/2.0/Organisation")
        org_data = response.json()['Organisations'][0]
        
        return CompanyInfo(
            id=org_data['OrganisationID'],
            name=org_data['Name'],
            currency=org_data['BaseCurrency'],
            country_code=org_data['CountryCode'],
            timezone=org_data.get('Timezone', 'UTC'),
            financial_year_end=org_data.get('FinancialYearEndMonth')
        )
    
    def list_accounts(self) -> List[Account]:
        """Get chart of accounts from Xero"""
        response = self._make_request("GET", f"{self.api_base}/api.xro/2.0/Accounts")
        accounts_data = response.json()['Accounts']
        
        accounts = []
        for acc in accounts_data:
            # Map Xero account types to our standard types
            account_type = self._map_account_type(acc['Type'])
            
            accounts.append(Account(
                id=acc['AccountID'],
                name=acc['Name'],
                code=acc.get('Code'),
                type=account_type,
                is_active=acc['Status'] == 'ACTIVE'
            ))
        
        return accounts
    
    def _map_account_type(self, xero_type: str) -> str:
        """Map Xero account types to standard types"""
        mapping = {
            'REVENUE': 'revenue',
            'OTHERINCOME': 'revenue',
            'EXPENSE': 'expense',
            'DIRECTCOSTS': 'expense',
            'OVERHEAD': 'expense',
            'DEPRECIATION': 'expense',
            'BANK': 'asset',
            'CURRENT': 'asset',
            'FIXED': 'asset',
            'INVENTORY': 'asset',
            'PREPAYMENT': 'asset',
            'CURRENTLIABILITY': 'liability',
            'LIABILITY': 'liability',
            'TERMLIABILITY': 'liability',
            'EQUITY': 'equity'
        }
        return mapping.get(xero_type, 'expense')
    
    def list_vat_codes(self) -> List[VATCode]:
        """Get tax rates from Xero"""
        response = self._make_request("GET", f"{self.api_base}/api.xro/2.0/TaxRates")
        tax_data = response.json()['TaxRates']
        
        vat_codes = []
        for tax in tax_data:
            if tax['Status'] == 'ACTIVE':
                vat_codes.append(VATCode(
                    id=tax['TaxType'],
                    name=tax['Name'],
                    code=tax['TaxType'],
                    rate=float(tax['EffectiveRate']) / 100,  # Xero returns percentage
                    is_active=True
                ))
        
        return vat_codes
    
    def upsert_contact(self, contact: Contact) -> str:
        """Create or update contact in Xero"""
        xero_contact = {
            'Name': contact.name,
            'EmailAddress': contact.email,
            'Phones': [],
            'Addresses': []
        }
        
        if contact.phone:
            xero_contact['Phones'].append({
                'PhoneType': 'DEFAULT',
                'PhoneNumber': contact.phone
            })
        
        if any([contact.address_line1, contact.city, contact.postal_code]):
            address = {
                'AddressType': 'POBOX',
                'AddressLine1': contact.address_line1 or '',
                'City': contact.city or '',
                'PostalCode': contact.postal_code or '',
                'Country': contact.country or ''
            }
            if contact.address_line2:
                address['AddressLine2'] = contact.address_line2
            xero_contact['Addresses'].append(address)
        
        # Set contact type
        if contact.is_customer:
            xero_contact['IsCustomer'] = True
        if contact.is_supplier:
            xero_contact['IsSupplier'] = True
        
        data = {'Contacts': [xero_contact]}
        
        # If we have an ID, update; otherwise create
        if contact.id:
            response = self._make_request(
                "POST", 
                f"{self.api_base}/api.xro/2.0/Contacts/{contact.id}",
                data=data
            )
        else:
            response = self._make_request(
                "POST", 
                f"{self.api_base}/api.xro/2.0/Contacts",
                data=data
            )
        
        result = response.json()
        return result['Contacts'][0]['ContactID']
    
    def upsert_employee(self, employee: Employee) -> str:
        """Create or update employee in Xero Payroll"""
        xero_employee = {
            'FirstName': employee.first_name,
            'LastName': employee.last_name,
            'Email': employee.email,
            'Status': 'ACTIVE' if employee.is_active else 'TERMINATED'
        }
        
        if employee.employee_number:
            xero_employee['EmployeeNumber'] = employee.employee_number
        
        if employee.start_date:
            xero_employee['StartDate'] = employee.start_date.strftime('%Y-%m-%d')
        
        # Bank account details
        if all([employee.bank_account_name, employee.bank_account_number, employee.bank_sort_code]):
            xero_employee['BankAccounts'] = [{
                'AccountName': employee.bank_account_name,
                'AccountNumber': employee.bank_account_number,
                'SortCode': employee.bank_sort_code
            }]
        
        data = {'Employees': [xero_employee]}
        
        # Xero Payroll API endpoint
        if employee.id:
            response = self._make_request(
                "POST",
                f"{self.api_base}/payroll.xro/1.0/Employees/{employee.id}",
                data=data
            )
        else:
            response = self._make_request(
                "POST",
                f"{self.api_base}/payroll.xro/1.0/Employees",
                data=data
            )
        
        result = response.json()
        return result['Employees'][0]['EmployeeID']
    
    def create_invoice(self, invoice: InvoiceDraft) -> Dict[str, Any]:
        """Create invoice in Xero"""
        xero_invoice = {
            # Staff pay invoices are money we owe OUT, and _ensure_contact_exists
            # creates the staff member as a supplier -- so these are Bills
            # (ACCPAY), not sales invoices (ACCREC).
            'Type': 'ACCPAY',  # Accounts Payable (Bill)
            'Contact': {'ContactID': invoice.contact_id},
            'Date': invoice.date.strftime('%Y-%m-%d'),
            'Status': 'DRAFT',
            'LineItems': []
        }
        
        if invoice.invoice_number:
            xero_invoice['InvoiceNumber'] = invoice.invoice_number
        
        if invoice.reference:
            xero_invoice['Reference'] = invoice.reference
        
        if invoice.due_date:
            xero_invoice['DueDate'] = invoice.due_date.strftime('%Y-%m-%d')
        
        # Add line items
        for item in invoice.line_items:
            line_item = {
                'Description': item.description,
                'Quantity': item.quantity,
                'UnitAmount': item.unit_amount
            }
            
            if item.account_id:
                line_item['AccountCode'] = item.account_id
            
            if item.vat_code_id:
                line_item['TaxType'] = item.vat_code_id
            
            xero_invoice['LineItems'].append(line_item)
        
        data = {'Invoices': [xero_invoice]}
        response = self._make_request(
            "POST",
            f"{self.api_base}/api.xro/2.0/Invoices",
            data=data
        )
        
        result = response.json()
        return {
            'id': result['Invoices'][0]['InvoiceID'],
            'invoice_number': result['Invoices'][0].get('InvoiceNumber'),
            'status': result['Invoices'][0]['Status'],
            'total': result['Invoices'][0]['Total']
        }
    
    def list_earnings_types(self) -> List[EarningsType]:
        """Get earnings types from Xero Payroll"""
        response = self._make_request("GET", f"{self.api_base}/payroll.xro/1.0/PayItems")
        pay_items = response.json()
        
        earnings_types = []
        
        # Process earnings rates
        for earnings in pay_items.get('EarningsRates', []):
            earnings_types.append(EarningsType(
                id=earnings['EarningsRateID'],
                name=earnings['Name'],
                code=earnings['EarningsType'],
                is_allowance=True,
                is_tax_exempt=earnings.get('IsExemptFromTax', False)
            ))
        
        # Process deductions
        for deduction in pay_items.get('DeductionTypes', []):
            earnings_types.append(EarningsType(
                id=deduction['DeductionTypeID'],
                name=deduction['Name'],
                code=deduction['DeductionCategory'],
                is_allowance=False,
                is_tax_exempt=False
            ))
        
        return earnings_types
    
    def create_pay_run(self, payrun: PayRunDraft) -> Dict[str, Any]:
        """Create pay run in Xero Payroll"""
        xero_payrun = {
            'PayrollCalendarID': '',  # Would need to be mapped from settings
            'PayPeriodStartDate': payrun.pay_period_start.strftime('%Y-%m-%d'),
            'PayPeriodEndDate': payrun.pay_period_end.strftime('%Y-%m-%d'),
            'PayrunType': 'SCHEDULED',
            'Payslips': []
        }
        
        if payrun.reference:
            xero_payrun['PayRunID'] = payrun.reference
        
        # Group line items by employee
        employee_payslips = {}
        for item in payrun.line_items:
            if item.employee_id not in employee_payslips:
                employee_payslips[item.employee_id] = []
            employee_payslips[item.employee_id].append(item)
        
        # Create payslips
        for employee_id, items in employee_payslips.items():
            payslip = {
                'EmployeeID': employee_id,
                'EarningsLines': [],
                'DeductionLines': []
            }
            
            for item in items:
                line = {
                    'EarningsRateID': item.earnings_type_id,
                    'RatePerUnit': item.amount / (item.hours or 1),
                    'NumberOfUnits': item.hours or 1
                }
                
                # Determine if it's earnings or deduction based on amount
                if item.amount >= 0:
                    payslip['EarningsLines'].append(line)
                else:
                    payslip['DeductionLines'].append({
                        'DeductionTypeID': item.earnings_type_id,
                        'Amount': abs(item.amount)
                    })
            
            xero_payrun['Payslips'].append(payslip)
        
        data = {'PayRuns': [xero_payrun]}
        response = self._make_request(
            "POST",
            f"{self.api_base}/payroll.xro/1.0/PayRuns",
            data=data
        )
        
        result = response.json()
        return {
            'id': result['PayRuns'][0]['PayRunID'],
            'status': result['PayRuns'][0]['PayRunStatus'],
            'pay_period_start': payrun.pay_period_start.isoformat(),
            'pay_period_end': payrun.pay_period_end.isoformat()
        }
    
    def create_journal_entry(self, journal: JournalDraft) -> Dict[str, Any]:
        """Create journal entry in Xero"""
        xero_journal = {
            'Date': journal.date.strftime('%Y-%m-%d'),
            'Reference': journal.reference,
            'Narration': journal.description,
            'JournalLines': []
        }
        
        for entry in journal.line_entries:
            journal_line = {
                'AccountCode': entry.account_id,
                'Description': entry.description
            }
            
            if entry.debit_amount > 0:
                journal_line['TaxAmount'] = entry.debit_amount
                journal_line['GrossAmount'] = entry.debit_amount
            else:
                journal_line['TaxAmount'] = -entry.credit_amount
                journal_line['GrossAmount'] = -entry.credit_amount
            
            xero_journal['JournalLines'].append(journal_line)
        
        data = {'ManualJournals': [xero_journal]}
        response = self._make_request(
            "POST",
            f"{self.api_base}/api.xro/2.0/ManualJournals",
            data=data
        )
        
        result = response.json()
        return {
            'id': result['ManualJournals'][0]['ManualJournalID'],
            'reference': journal.reference,
            'status': result['ManualJournals'][0]['Status']
        }
    
    def list_payments(self, since: Optional[datetime] = None) -> List[Payment]:
        """Get payments from Xero"""
        params = {}
        if since:
            params['If-Modified-Since'] = since.strftime('%Y-%m-%dT%H:%M:%S')
        
        response = self._make_request(
            "GET", 
            f"{self.api_base}/api.xro/2.0/Payments",
            params=params
        )
        
        payments_data = response.json()['Payments']
        
        payments = []
        for payment in payments_data:
            payments.append(Payment(
                id=payment['PaymentID'],
                invoice_id=payment.get('Invoice', {}).get('InvoiceID'),
                contact_id=payment.get('Invoice', {}).get('Contact', {}).get('ContactID'),
                amount=float(payment['Amount']),
                date=datetime.fromisoformat(payment['Date'].replace('Z', '+00:00')) if payment.get('Date') else None,
                reference=payment.get('Reference'),
                status='received' if payment['Status'] == 'AUTHORISED' else 'pending'
            ))
        
        return payments
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify Xero webhook signature"""
        if not self.config.get('webhook_key'):
            return False
        
        # Xero uses HMAC-SHA256
        webhook_key = self.config['webhook_key'].encode()
        expected_signature = hmac.new(
            webhook_key,
            payload,
            hashlib.sha256
        ).digest()
        
        # Xero provides base64 encoded signature
        expected_signature_b64 = base64.b64encode(expected_signature).decode()
        
        return hmac.compare_digest(signature, expected_signature_b64)
    
    def upload_attachment(self, invoice_id: str, filename: str, content: bytes, content_type: str) -> bool:
        """Upload attachment to Xero invoice"""
        try:
            files = {
                'file': (filename, content, content_type)
            }
            
            response = self._make_request(
                "POST",
                f"{self.api_base}/api.xro/2.0/Invoices/{invoice_id}/Attachments/{filename}",
                files=files
            )
            
            return response.status_code == 200
            
        except Exception as e:
            raise AccountingProviderError(
                f"Failed to upload attachment: {str(e)}",
                error_code="attachment_upload_failed"
            )