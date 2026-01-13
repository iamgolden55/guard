import axios from 'axios';
import api from './api';

// Types for Finance Integrations
export interface AccountingProvider {
  id: number;
  provider_key: string;
  display_name: string;
  is_active: boolean;
  oauth_scopes: string;
  created_at: string;
  updated_at: string;
}

export interface ProviderConnection {
  id: number;
  provider: number;
  provider_name: string;
  provider_key: string;
  company_name: string;
  tenant_id: string;
  status: 'pending' | 'connected' | 'expired' | 'error' | 'disabled';
  last_sync_at: string | null;
  error_message: string;
  is_sandbox: boolean;
  auto_sync_invoices: boolean;
  auto_sync_payroll: boolean;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  is_token_valid: boolean;
}

export interface AccountMapping {
  id: number;
  connection: number;
  connection_name: string;
  mapping_type: 'revenue' | 'expense' | 'liability' | 'asset' | 'equity';
  local_account_name: string;
  provider_account_id: string;
  provider_account_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface VATCodeMapping {
  id: number;
  connection: number;
  connection_name: string;
  local_vat_code: string;
  local_vat_rate: number;
  provider_vat_code: string;
  provider_vat_name: string;
  created_at: string;
  updated_at: string;
}

export interface EarningsTypeMapping {
  id: number;
  connection: number;
  connection_name: string;
  local_earnings_name: string;
  local_hourly_rate: number | null;
  provider_earnings_code: string;
  provider_earnings_name: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceExport {
  id: number;
  connection: number;
  connection_name: string;
  local_invoice: number;
  invoice_details: {
    id: number;
    total_amount: number;
    staff_user: string;
    start_date: string;
    end_date: string;
  } | null;
  provider_invoice_id: string;
  provider_invoice_number: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message: string;
  exported_by: number;
  exported_by_name: string;
  exported_at: string;
  completed_at: string | null;
}

export interface PayrollExport {
  id: number;
  connection: number;
  connection_name: string;
  export_type: 'payrun' | 'journal';
  pay_period_start: string;
  pay_period_end: string;
  staff_users: number[];
  staff_count: number;
  provider_payrun_id: string;
  provider_reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error_message: string;
  exported_by: number;
  exported_by_name: string;
  exported_at: string;
  completed_at: string | null;
}

export interface SyncLog {
  id: number;
  connection: number;
  connection_name: string;
  operation: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  metadata: any;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

export interface ProviderAccount {
  id: string;
  name: string;
  code?: string;
  type: string;
  is_active: boolean;
}

export interface ProviderVATCode {
  id: string;
  name: string;
  code: string;
  rate: number;
  is_active: boolean;
}

export interface ProviderEarningsType {
  id: string;
  name: string;
  code: string;
  is_allowance: boolean;
  is_tax_exempt: boolean;
}

export interface OAuthInitiateRequest {
  provider_key: string;
  redirect_uri: string;
  is_sandbox?: boolean;
}

export interface OAuthInitiateResponse {
  oauth_url: string;
  state: string;
}

export interface OAuthCallbackRequest {
  provider_key: string;
  code: string;
  state: string;
  redirect_uri: string;
  tenant_id?: string;
  is_sandbox?: boolean;
}

export interface InvoiceExportRequest {
  connection_id: number;
  invoice_ids: number[];
}

export interface PayrollExportRequest {
  connection_id: number;
  start_date: string;
  end_date: string;
  staff_user_ids: number[];
  export_type?: 'payrun' | 'journal';
}

export interface TestConnectionResponse {
  success: boolean;
  error_message?: string;
  company_info?: {
    name: string;
    currency: string;
    country_code: string;
  };
}

class FinanceIntegrationsService {
  private baseUrl = '/api/v1/finance';
  
  // Create axios instance with auth token
  private createAuthenticatedRequest = () => {
    // Use 'access_token' to match the key used by AuthContext and api.ts
    const token = localStorage.getItem('access_token');
    return axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      timeout: 15000,
      withCredentials: true, // Enable credentials for cookie-based auth fallback
    });
  };

  // Provider methods
  async getProviders(): Promise<AccountingProvider[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get('/providers/');
    return response.data.results || response.data;
  }

  async getSupportedProviders(): Promise<Record<string, string>> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get('/providers/supported/');
    return response.data;
  }

  // Connection methods
  async getConnections(): Promise<ProviderConnection[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get('/connections/');
    return response.data.results || response.data;
  }

  async getConnection(id: number): Promise<ProviderConnection> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get(`/connections/${id}/`);
    return response.data;
  }

  async createConnection(data: Partial<ProviderConnection>): Promise<ProviderConnection> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post('/connections/', data);
    return response.data;
  }

  async updateConnection(id: number, data: Partial<ProviderConnection>): Promise<ProviderConnection> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.patch(`/connections/${id}/`, data);
    return response.data;
  }

  async deleteConnection(id: number): Promise<void> {
    const axiosInstance = this.createAuthenticatedRequest();
    await axiosInstance.delete(`/connections/${id}/`);
  }

  async testConnection(id: number): Promise<TestConnectionResponse> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post(`/connections/${id}/test_connection/`);
    return response.data;
  }

  async refreshToken(id: number): Promise<ProviderConnection> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post(`/connections/${id}/refresh_token/`);
    return response.data;
  }

  // Provider data methods
  async getProviderAccounts(connectionId: number): Promise<ProviderAccount[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get(`/connections/${connectionId}/accounts/`);
    return response.data;
  }

  async getProviderVATCodes(connectionId: number): Promise<ProviderVATCode[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get(`/connections/${connectionId}/vat_codes/`);
    return response.data;
  }

  async getProviderEarningsTypes(connectionId: number): Promise<ProviderEarningsType[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.get(`/connections/${connectionId}/earnings_types/`);
    return response.data;
  }

  // Mapping methods
  async getAccountMappings(connectionId?: number): Promise<AccountMapping[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const params = connectionId ? `?connection=${connectionId}` : '';
    const response = await axiosInstance.get(`/account-mappings/${params}`);
    return response.data.results || response.data;
  }

  async createAccountMapping(data: Partial<AccountMapping>): Promise<AccountMapping> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post(`/account-mappings/`, data);
    return response.data;
  }

  async updateAccountMapping(id: number, data: Partial<AccountMapping>): Promise<AccountMapping> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.patch(`/account-mappings/${id}/`, data);
    return response.data;
  }

  async deleteAccountMapping(id: number): Promise<void> {
    const axiosInstance = this.createAuthenticatedRequest();
    await axiosInstance.delete(`/account-mappings/${id}/`);
  }

  async getVATMappings(connectionId?: number): Promise<VATCodeMapping[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const params = connectionId ? `?connection=${connectionId}` : '';
    const response = await axiosInstance.get(`/vat-mappings/${params}`);
    return response.data.results || response.data;
  }

  async createVATMapping(data: Partial<VATCodeMapping>): Promise<VATCodeMapping> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post(`/vat-mappings/`, data);
    return response.data;
  }

  async updateVATMapping(id: number, data: Partial<VATCodeMapping>): Promise<VATCodeMapping> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.patch(`/vat-mappings/${id}/`, data);
    return response.data;
  }

  async deleteVATMapping(id: number): Promise<void> {
    const axiosInstance = this.createAuthenticatedRequest();
    await axiosInstance.delete(`/vat-mappings/${id}/`);
  }

  async getEarningsMappings(connectionId?: number): Promise<EarningsTypeMapping[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const params = connectionId ? `?connection=${connectionId}` : '';
    const response = await axiosInstance.get(`/earnings-mappings/${params}`);
    return response.data.results || response.data;
  }

  async createEarningsMapping(data: Partial<EarningsTypeMapping>): Promise<EarningsTypeMapping> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post(`/earnings-mappings/`, data);
    return response.data;
  }

  async updateEarningsMapping(id: number, data: Partial<EarningsTypeMapping>): Promise<EarningsTypeMapping> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.patch(`/earnings-mappings/${id}/`, data);
    return response.data;
  }

  async deleteEarningsMapping(id: number): Promise<void> {
    const axiosInstance = this.createAuthenticatedRequest();
    await axiosInstance.delete(`/earnings-mappings/${id}/`);
  }

  // OAuth methods
  async initiateOAuth(data: OAuthInitiateRequest): Promise<OAuthInitiateResponse> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post('/oauth/initiate/', data);
    return response.data;
  }

  async completeOAuth(data: OAuthCallbackRequest): Promise<ProviderConnection> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post('/oauth/callback/', data);
    return response.data;
  }

  async getTenants(data: { provider_key: string; code: string; redirect_uri: string; is_sandbox?: boolean }): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: string;
    tenants: Array<{ tenant_id: string; tenant_name: string; tenant_type: string }>;
    provider_key: string;
  }> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post('/oauth/tenants/', data);
    return response.data;
  }

  // Export methods
  async exportInvoices(data: InvoiceExportRequest): Promise<{exports: any[]}> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post('/export/invoices/', data);
    return response.data;
  }

  async exportPayroll(data: PayrollExportRequest): Promise<PayrollExport> {
    const axiosInstance = this.createAuthenticatedRequest();
    const response = await axiosInstance.post('/export/payroll/', data);
    return response.data;
  }

  // Export tracking methods
  async getInvoiceExports(connectionId?: number): Promise<InvoiceExport[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const params = connectionId ? `?connection=${connectionId}` : '';
    const response = await axiosInstance.get(`/invoice-exports/${params}`);
    return response.data.results || response.data;
  }

  async getPayrollExports(connectionId?: number): Promise<PayrollExport[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const params = connectionId ? `?connection=${connectionId}` : '';
    const response = await axiosInstance.get(`/payroll-exports/${params}`);
    return response.data.results || response.data;
  }

  // Sync logs
  async getSyncLogs(filters?: {
    connection?: number;
    operation?: string;
    level?: string;
  }): Promise<SyncLog[]> {
    const axiosInstance = this.createAuthenticatedRequest();
    const params = new URLSearchParams();
    if (filters?.connection) params.append('connection', filters.connection.toString());
    if (filters?.operation) params.append('operation', filters.operation);
    if (filters?.level) params.append('level', filters.level);

    const queryString = params.toString();
    const response = await axiosInstance.get(`/logs/${queryString ? `?${queryString}` : ''}`);
    return response.data.results || response.data;
  }

  // Utility methods
  generateOAuthRedirectUri(): string {
    return `${window.location.origin}/admin/finance-integrations/oauth-callback`;
  }

  getProviderLogo(providerKey: string): string {
    const logos: Record<string, string> = {
      xero: '/logos/xero.svg',
      quickbooks: '/logos/quickbooks.svg',
      freeagent: '/logos/freeagent.svg',
      freshbooks: '/logos/freshbooks.svg',
      zoho: '/logos/zoho.svg',
      sage: '/logos/sage.svg',
      wave: '/logos/wave.svg',
      netsuite: '/logos/netsuite.svg',
    };
    return logos[providerKey] || '/logos/default-accounting.svg';
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      connected: 'green',
      pending: 'orange',
      expired: 'red',
      error: 'red',
      disabled: 'gray',
      completed: 'green',
      processing: 'blue',
      failed: 'red',
      cancelled: 'gray',
    };
    return colors[status] || 'gray';
  }
}

export default new FinanceIntegrationsService();