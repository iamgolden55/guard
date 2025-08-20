import requests
import json
from datetime import datetime, timedelta
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


class QuickBooksProvider(AccountingProvider):
    """QuickBooks Online accounting provider implementation"""
    
    PRODUCTION_API_BASE = "https://quickbooks.api.intuit.com"
    PRODUCTION_OAUTH_BASE = "https://appcenter.intuit.com/connect/oauth2"
    
    SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com"
    SANDBOX_OAUTH_BASE = "https://appcenter.intuit.com/connect/oauth2"
    
    def __init__(self, connection_config: Dict[str, Any]):
        super().__init__(connection_config)
        self.api_base = self.SANDBOX_API_BASE if self.is_sandbox else self.PRODUCTION_API_BASE
        self.oauth_base = self.SANDBOX_OAUTH_BASE if self.is_sandbox else self.PRODUCTION_OAUTH_BASE
        
        # Required QuickBooks scopes
        self.scopes = ["com.intuit.quickbooks.accounting"]
    
    @property
    def provider_name(self) -> str:
        return "QuickBooks Online"
    
    @property
    def oauth_authorization_url(self) -> str:
        return f"{self.oauth_base}"
    
    @property
    def oauth_token_url(self) -> str:
        return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
    
    def build_oauth_url(self, client_id: str, redirect_uri: str, state: str, scopes: List[str]) -> str:
        """Build OAuth authorization URL"""
        params = {
            'client_id': client_id,
            'scope': ' '.join(scopes),
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'access_type': 'offline',
            'state': state
        }
        
        return f"{self.oauth_authorization_url}?{urlencode(params)}"
    
    def exchange_code_for_tokens(self, code: str, client_id: str, client_secret: str, redirect_uri: str) -> OAuthTokens:
        """Exchange authorization code for access tokens"""
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri
        }
        
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Basic {base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(self.oauth_token_url, data=data, headers=headers)
        
        if response.status_code != 200:
            raise AuthenticationError(f"Token exchange failed: {response.text}")
        
        token_data = response.json()
        
        # Calculate expiry time
        expires_at = datetime.now() + timedelta(seconds=token_data.get('expires_in', 3600))
        
        return OAuthTokens(
            access_token=token_data['access_token'],
            refresh_token=token_data.get('refresh_token'),
            expires_at=expires_at,
            scope=token_data.get('scope', ''),
            token_type=token_data.get('token_type', 'Bearer')
        )
    
    def refresh_access_token(self, refresh_token: str, client_id: str, client_secret: str) -> OAuthTokens:
        """Refresh access token using refresh token"""
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Basic {base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        response = requests.post(self.oauth_token_url, data=data, headers=headers)
        
        if response.status_code != 200:
            raise AuthenticationError(f"Token refresh failed: {response.text}")
        
        token_data = response.json()
        
        # Calculate expiry time
        expires_at = datetime.now() + timedelta(seconds=token_data.get('expires_in', 3600))
        
        return OAuthTokens(
            access_token=token_data['access_token'],
            refresh_token=token_data.get('refresh_token', refresh_token),  # Keep old if not provided
            expires_at=expires_at,
            scope=token_data.get('scope', ''),
            token_type=token_data.get('token_type', 'Bearer')
        )
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> requests.Response:
        """Make authenticated API request"""
        if not self.access_token:
            raise AuthenticationError("No access token available")
        
        # QuickBooks requires company_id in the URL
        company_id = self.connection_config.get('tenant_id')
        if not company_id:
            raise ValueError("Company ID (tenant_id) is required for QuickBooks API calls")
        
        url = f"{self.api_base}/v3/company/{company_id}/{endpoint.lstrip('/')}"
        
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        response = requests.request(method, url, headers=headers, json=data, params=params)
        
        if response.status_code == 401:
            raise AuthenticationError("Authentication failed - token may be expired")
        elif response.status_code == 429:
            raise RateLimitError("Rate limit exceeded")
        elif response.status_code >= 400:
            raise AccountingProviderError(f"API error: {response.status_code} - {response.text}")
        
        return response
    
    def test_connection(self) -> bool:
        """Test if connection is working"""
        try:
            response = self._make_request('GET', 'companyinfo')
            return response.status_code == 200
        except Exception:
            return False
    
    def get_company_info(self) -> CompanyInfo:
        """Get company information"""
        response = self._make_request('GET', 'companyinfo')
        data = response.json()
        
        if 'QueryResponse' not in data or not data['QueryResponse'].get('CompanyInfo'):
            raise AccountingProviderError("No company info found")
        
        company_data = data['QueryResponse']['CompanyInfo'][0]
        
        return CompanyInfo(
            name=company_data.get('CompanyName', ''),
            currency=company_data.get('Country', 'USD'),  # QuickBooks doesn't directly provide currency
            country_code=company_data.get('Country', 'US'),
            address=company_data.get('CompanyAddr', {}),
            phone=company_data.get('PrimaryPhone', {}),
            email=company_data.get('Email', {}),
            website=company_data.get('WebAddr', {})
        )
    
    def get_accounts(self) -> List[Account]:
        """Get chart of accounts"""
        response = self._make_request('GET', 'accounts', params={'maxresults': 1000})
        data = response.json()
        
        accounts = []
        if 'QueryResponse' in data and 'Account' in data['QueryResponse']:
            for account_data in data['QueryResponse']['Account']:
                accounts.append(Account(
                    id=str(account_data['Id']),
                    name=account_data['Name'],
                    code=account_data.get('AcctNum', ''),
                    type=account_data.get('AccountType', ''),
                    is_active=account_data.get('Active', True)
                ))
        
        return accounts
    
    def get_contacts(self) -> List[Contact]:
        """Get customers and suppliers"""
        customers = self._get_customers()
        vendors = self._get_vendors()
        return customers + vendors
    
    def _get_customers(self) -> List[Contact]:
        """Get customers"""
        response = self._make_request('GET', 'customers', params={'maxresults': 1000})
        data = response.json()
        
        contacts = []
        if 'QueryResponse' in data and 'Customer' in data['QueryResponse']:
            for customer_data in data['QueryResponse']['Customer']:
                contacts.append(Contact(
                    id=str(customer_data['Id']),
                    name=customer_data['Name'],
                    type='customer',
                    email=customer_data.get('PrimaryEmailAddr', {}).get('Address', ''),
                    phone=customer_data.get('PrimaryPhone', {}).get('FreeFormNumber', ''),
                    is_active=customer_data.get('Active', True)
                ))
        
        return contacts
    
    def _get_vendors(self) -> List[Contact]:
        """Get vendors/suppliers"""
        response = self._make_request('GET', 'vendors', params={'maxresults': 1000})
        data = response.json()
        
        contacts = []
        if 'QueryResponse' in data and 'Vendor' in data['QueryResponse']:
            for vendor_data in data['QueryResponse']['Vendor']:
                contacts.append(Contact(
                    id=str(vendor_data['Id']),
                    name=vendor_data['Name'],
                    type='supplier',
                    email=vendor_data.get('PrimaryEmailAddr', {}).get('Address', ''),
                    phone=vendor_data.get('PrimaryPhone', {}).get('FreeFormNumber', ''),
                    is_active=vendor_data.get('Active', True)
                ))
        
        return contacts
    
    def get_tax_codes(self) -> List[VATCode]:
        """Get tax codes"""
        response = self._make_request('GET', 'taxcodes', params={'maxresults': 1000})
        data = response.json()
        
        tax_codes = []
        if 'QueryResponse' in data and 'TaxCode' in data['QueryResponse']:
            for tax_data in data['QueryResponse']['TaxCode']:
                # QuickBooks tax codes don't have rates directly - need to calculate
                tax_codes.append(VATCode(
                    id=str(tax_data['Id']),
                    name=tax_data['Name'],
                    code=tax_data['Name'],
                    rate=0.0,  # Would need to calculate from tax rates
                    is_active=tax_data.get('Active', True)
                ))
        
        return tax_codes
    
    def create_invoice(self, invoice_draft: InvoiceDraft) -> str:
        """Create invoice and return the provider invoice ID"""
        # QuickBooks invoice creation logic would go here
        # This is a complex operation that involves creating line items, calculating taxes, etc.
        raise NotImplementedError("Invoice creation not yet implemented for QuickBooks")
    
    def create_payment(self, payment: Payment) -> str:
        """Record a payment and return the provider payment ID"""
        # QuickBooks payment recording logic would go here
        raise NotImplementedError("Payment recording not yet implemented for QuickBooks")
    
    def create_journal_entry(self, journal_draft: JournalDraft) -> str:
        """Create journal entry and return the provider entry ID"""
        # QuickBooks journal entry creation logic would go here
        raise NotImplementedError("Journal entry creation not yet implemented for QuickBooks")
    
    def validate_webhook_signature(self, payload: bytes, signature: str, webhook_secret: str) -> bool:
        """Validate webhook signature"""
        # QuickBooks webhook validation logic
        return True  # Placeholder - implement actual validation