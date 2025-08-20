from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
from django.contrib.auth.models import User


@dataclass
class CompanyInfo:
    """Company information from accounting provider"""
    id: str
    name: str
    currency: str
    country_code: str
    timezone: str
    financial_year_end: Optional[str] = None


@dataclass
class Contact:
    """Contact/Customer data structure"""
    id: Optional[str] = None
    name: str = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_customer: bool = True
    is_supplier: bool = False
    contact_type: str = "customer"  # customer, supplier, employee


@dataclass
class Employee:
    """Employee data structure for payroll"""
    id: Optional[str] = None
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    employee_number: Optional[str] = None
    start_date: Optional[datetime] = None
    is_active: bool = True
    pay_schedule: str = "weekly"  # weekly, fortnightly, monthly
    bank_account_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_sort_code: Optional[str] = None
    ni_number: Optional[str] = None


@dataclass
class Account:
    """Chart of accounts structure"""
    id: str
    name: str
    code: Optional[str] = None
    type: str = "expense"  # revenue, expense, asset, liability, equity
    is_active: bool = True


@dataclass
class VATCode:
    """VAT/Tax code structure"""
    id: str
    name: str
    code: str
    rate: float  # As decimal, e.g., 0.20 for 20%
    is_active: bool = True


@dataclass
class EarningsType:
    """Payroll earnings type"""
    id: str
    name: str
    code: str
    is_allowance: bool = True  # True for earnings, False for deductions
    is_tax_exempt: bool = False


@dataclass
class InvoiceLineItem:
    """Invoice line item"""
    description: str
    quantity: float = 1.0
    unit_amount: float = 0.0
    vat_code_id: Optional[str] = None
    account_id: Optional[str] = None


@dataclass
class InvoiceDraft:
    """Invoice data to be exported"""
    contact_id: str
    invoice_number: Optional[str] = None
    reference: Optional[str] = None
    date: datetime = datetime.now()
    due_date: Optional[datetime] = None
    line_items: List[InvoiceLineItem] = None
    
    def __post_init__(self):
        if self.line_items is None:
            self.line_items = []


@dataclass
class PayrollLineItem:
    """Payroll line item for an employee"""
    employee_id: str
    earnings_type_id: str
    hours: Optional[float] = None
    amount: float = 0.0
    description: Optional[str] = None


@dataclass
class PayRunDraft:
    """Pay run data to be exported"""
    pay_period_start: datetime
    pay_period_end: datetime
    reference: Optional[str] = None
    line_items: List[PayrollLineItem] = None
    
    def __post_init__(self):
        if self.line_items is None:
            self.line_items = []


@dataclass
class JournalLineEntry:
    """Journal entry line"""
    account_id: str
    description: str
    debit_amount: float = 0.0
    credit_amount: float = 0.0


@dataclass
class JournalDraft:
    """Journal entry data to be exported"""
    date: datetime
    reference: str
    description: str
    line_entries: List[JournalLineEntry] = None
    
    def __post_init__(self):
        if self.line_entries is None:
            self.line_entries = []


@dataclass
class Payment:
    """Payment received notification"""
    id: str
    invoice_id: Optional[str] = None
    contact_id: Optional[str] = None
    amount: float = 0.0
    date: Optional[datetime] = None
    reference: Optional[str] = None
    status: str = "received"  # received, pending, failed


@dataclass
class OAuthTokens:
    """OAuth token data structure"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    tenant_id: Optional[str] = None
    scope: Optional[str] = None


class AccountingProviderError(Exception):
    """Base exception for accounting provider errors"""
    
    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.error_code = error_code
        self.details = details or {}


class AuthenticationError(AccountingProviderError):
    """Authentication/authorization errors"""
    pass


class RateLimitError(AccountingProviderError):
    """Rate limiting errors"""
    pass


class ValidationError(AccountingProviderError):
    """Data validation errors"""
    pass


class AccountingProvider(ABC):
    """Abstract base class for accounting provider adapters"""
    
    def __init__(self, connection_config: Dict[str, Any]):
        """
        Initialize the provider adapter
        
        Args:
            connection_config: Configuration dictionary containing:
                - client_id: OAuth client ID
                - client_secret: OAuth client secret
                - access_token: Current access token
                - refresh_token: Refresh token
                - tenant_id: Provider-specific tenant ID
                - is_sandbox: Whether to use sandbox environment
        """
        self.config = connection_config
        self.is_sandbox = connection_config.get('is_sandbox', False)
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name"""
        pass
    
    @property
    @abstractmethod
    def oauth_authorization_url(self) -> str:
        """Return OAuth authorization URL"""
        pass
    
    @property
    @abstractmethod
    def oauth_token_url(self) -> str:
        """Return OAuth token exchange URL"""
        pass
    
    @abstractmethod
    def get_oauth_url(self, state: str, redirect_uri: str) -> str:
        """
        Generate OAuth authorization URL
        
        Args:
            state: CSRF protection state parameter
            redirect_uri: OAuth callback URL
            
        Returns:
            OAuth authorization URL
        """
        pass
    
    @abstractmethod
    def exchange_oauth_code(self, code: str, redirect_uri: str) -> OAuthTokens:
        """
        Exchange OAuth authorization code for tokens
        
        Args:
            code: OAuth authorization code
            redirect_uri: OAuth callback URL
            
        Returns:
            OAuth tokens
            
        Raises:
            AuthenticationError: If code exchange fails
        """
        pass
    
    @abstractmethod
    def refresh_tokens(self, refresh_token: str) -> OAuthTokens:
        """
        Refresh OAuth access token
        
        Args:
            refresh_token: Current refresh token
            
        Returns:
            New OAuth tokens
            
        Raises:
            AuthenticationError: If refresh fails
        """
        pass
    
    @abstractmethod
    def get_company_info(self) -> CompanyInfo:
        """
        Get company information from the provider
        
        Returns:
            Company information
            
        Raises:
            AuthenticationError: If not authenticated
            AccountingProviderError: If API call fails
        """
        pass
    
    @abstractmethod
    def list_accounts(self) -> List[Account]:
        """
        Get chart of accounts
        
        Returns:
            List of accounts
        """
        pass
    
    @abstractmethod
    def list_vat_codes(self) -> List[VATCode]:
        """
        Get VAT/tax codes
        
        Returns:
            List of VAT codes
        """
        pass
    
    @abstractmethod
    def upsert_contact(self, contact: Contact) -> str:
        """
        Create or update a contact
        
        Args:
            contact: Contact data
            
        Returns:
            Provider contact ID
        """
        pass
    
    @abstractmethod
    def upsert_employee(self, employee: Employee) -> str:
        """
        Create or update an employee (if payroll is supported)
        
        Args:
            employee: Employee data
            
        Returns:
            Provider employee ID
        """
        pass
    
    @abstractmethod
    def create_invoice(self, invoice: InvoiceDraft) -> Dict[str, Any]:
        """
        Create an invoice
        
        Args:
            invoice: Invoice data
            
        Returns:
            Provider response with invoice ID and details
        """
        pass
    
    @abstractmethod
    def list_earnings_types(self) -> List[EarningsType]:
        """
        Get payroll earnings types (if payroll is supported)
        
        Returns:
            List of earnings types
        """
        pass
    
    @abstractmethod
    def create_pay_run(self, payrun: PayRunDraft) -> Dict[str, Any]:
        """
        Create a pay run (if payroll is supported)
        
        Args:
            payrun: Pay run data
            
        Returns:
            Provider response with pay run ID and details
        """
        pass
    
    @abstractmethod
    def create_journal_entry(self, journal: JournalDraft) -> Dict[str, Any]:
        """
        Create a journal entry
        
        Args:
            journal: Journal entry data
            
        Returns:
            Provider response with journal ID and details
        """
        pass
    
    @abstractmethod
    def list_payments(self, since: Optional[datetime] = None) -> List[Payment]:
        """
        Get payments/receipts
        
        Args:
            since: Get payments since this date
            
        Returns:
            List of payments
        """
        pass
    
    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify webhook signature
        
        Args:
            payload: Raw webhook payload
            signature: Webhook signature
            
        Returns:
            True if signature is valid
        """
        pass
    
    def supports_payroll(self) -> bool:
        """
        Check if provider supports payroll functionality
        
        Returns:
            True if payroll is supported
        """
        return True  # Override in providers that don't support payroll
    
    def supports_attachments(self) -> bool:
        """
        Check if provider supports invoice attachments
        
        Returns:
            True if attachments are supported
        """
        return True  # Override in providers that don't support attachments
    
    def upload_attachment(self, invoice_id: str, filename: str, content: bytes, content_type: str) -> bool:
        """
        Upload an attachment to an invoice
        
        Args:
            invoice_id: Provider invoice ID
            filename: Attachment filename
            content: File content as bytes
            content_type: MIME content type
            
        Returns:
            True if successful
        """
        if not self.supports_attachments():
            raise NotImplementedError("Provider does not support attachments")
        return False  # Override in providers that support attachments