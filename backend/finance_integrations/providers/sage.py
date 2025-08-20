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


class SageProvider(AccountingProvider):
    """Sage Business Cloud accounting provider implementation"""
    
    PRODUCTION_API_BASE = "https://api.accounting.sage.com"
    PRODUCTION_OAUTH_BASE = "https://www.sageone.com/oauth2/auth/central"
    
    # Sage uses the same URLs for sandbox
    SANDBOX_API_BASE = "https://api.accounting.sage.com"
    SANDBOX_OAUTH_BASE = "https://www.sageone.com/oauth2/auth/central"
    
    def __init__(self, connection_config: Dict[str, Any]):
        super().__init__(connection_config)
        self.api_base = self.SANDBOX_API_BASE if self.is_sandbox else self.PRODUCTION_API_BASE
        self.oauth_base = self.SANDBOX_OAUTH_BASE if self.is_sandbox else self.PRODUCTION_OAUTH_BASE
        
        # Required Sage scopes
        self.scopes = ["full_access"]
    
    @property
    def provider_name(self) -> str:
        return "Sage Business Cloud"
    
    @property
    def oauth_authorization_url(self) -> str:
        return self.oauth_base
    
    @property
    def oauth_token_url(self) -> str:
        return "https://oauth.accounting.sage.com/token"
    
    def build_oauth_url(self, client_id: str, redirect_uri: str, state: str, scopes: List[str]) -> str:
        """Build OAuth authorization URL"""
        params = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(scopes),
            'state': state
        }
        
        return f"{self.oauth_authorization_url}?{urlencode(params)}"
    
    def exchange_code_for_tokens(self, code: str, client_id: str, client_secret: str, redirect_uri: str) -> OAuthTokens:
        """Exchange authorization code for access tokens"""
        data = {
            'grant_type': 'authorization_code',
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri
        }
        
        headers = {
            'Accept': 'application/json',
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
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': refresh_token
        }
        
        headers = {
            'Accept': 'application/json',
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
            refresh_token=token_data.get('refresh_token', refresh_token),
            expires_at=expires_at,
            scope=token_data.get('scope', ''),
            token_type=token_data.get('token_type', 'Bearer')
        )
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> requests.Response:
        """Make authenticated API request"""
        if not self.access_token:
            raise AuthenticationError("No access token available")
        
        url = f"{self.api_base}/v3.1/{endpoint.lstrip('/')}"
        
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
            response = self._make_request('GET', 'businesses')
            return response.status_code == 200
        except Exception:
            return False
    
    def get_company_info(self) -> CompanyInfo:
        """Get company information"""
        response = self._make_request('GET', 'businesses')
        data = response.json()
        
        if not data.get('$items'):
            raise AccountingProviderError("No business info found")
        
        business_data = data['$items'][0]
        
        return CompanyInfo(
            name=business_data.get('name', ''),
            currency=business_data.get('base_currency_code', 'GBP'),
            country_code=business_data.get('country_code', 'GB'),
            address=business_data.get('address', {}),
            phone=business_data.get('telephone', ''),
            email=business_data.get('email', ''),
            website=business_data.get('website', '')
        )
    
    def get_accounts(self) -> List[Account]:
        """Get chart of accounts"""
        response = self._make_request('GET', 'ledger_accounts')
        data = response.json()
        
        accounts = []
        if data.get('$items'):
            for account_data in data['$items']:
                accounts.append(Account(
                    id=account_data['id'],
                    name=account_data['display_name'],
                    code=account_data.get('ledger_account_code', ''),
                    type=account_data.get('ledger_account_type', {}).get('display_name', ''),
                    is_active=not account_data.get('deleted_at')
                ))
        
        return accounts
    
    def get_contacts(self) -> List[Contact]:
        """Get contacts (customers and suppliers)"""
        customers = self._get_customers()
        suppliers = self._get_suppliers()
        return customers + suppliers
    
    def _get_customers(self) -> List[Contact]:
        """Get customers"""
        response = self._make_request('GET', 'contacts', params={'contact_type': 'CUSTOMER'})
        data = response.json()
        
        contacts = []
        if data.get('$items'):
            for contact_data in data['$items']:
                contacts.append(Contact(
                    id=contact_data['id'],
                    name=contact_data['name'],
                    type='customer',
                    email=contact_data.get('email', ''),
                    phone=contact_data.get('telephone', ''),
                    is_active=not contact_data.get('deleted_at')
                ))
        
        return contacts
    
    def _get_suppliers(self) -> List[Contact]:
        """Get suppliers"""
        response = self._make_request('GET', 'contacts', params={'contact_type': 'VENDOR'})
        data = response.json()
        
        contacts = []
        if data.get('$items'):
            for contact_data in data['$items']:
                contacts.append(Contact(
                    id=contact_data['id'],
                    name=contact_data['name'],
                    type='supplier',
                    email=contact_data.get('email', ''),
                    phone=contact_data.get('telephone', ''),
                    is_active=not contact_data.get('deleted_at')
                ))
        
        return contacts
    
    def get_tax_codes(self) -> List[VATCode]:
        """Get tax rates/codes"""
        response = self._make_request('GET', 'tax_rates')
        data = response.json()
        
        tax_codes = []
        if data.get('$items'):
            for tax_data in data['$items']:
                tax_codes.append(VATCode(
                    id=tax_data['id'],
                    name=tax_data['name'],
                    code=tax_data['name'],
                    rate=float(tax_data.get('percentage', 0)),
                    is_active=tax_data.get('is_visible', True)
                ))
        
        return tax_codes
    
    def create_invoice(self, invoice_draft: InvoiceDraft) -> str:
        """Create invoice and return the provider invoice ID"""
        # Sage invoice creation logic would go here
        raise NotImplementedError("Invoice creation not yet implemented for Sage")
    
    def create_payment(self, payment: Payment) -> str:
        """Record a payment and return the provider payment ID"""
        # Sage payment recording logic would go here
        raise NotImplementedError("Payment recording not yet implemented for Sage")
    
    def create_journal_entry(self, journal_draft: JournalDraft) -> str:
        """Create journal entry and return the provider entry ID"""
        # Sage journal entry creation logic would go here
        raise NotImplementedError("Journal entry creation not yet implemented for Sage")
    
    def validate_webhook_signature(self, payload: bytes, signature: str, webhook_secret: str) -> bool:
        """Validate webhook signature"""
        # Sage webhook validation logic
        return True  # Placeholder - implement actual validation