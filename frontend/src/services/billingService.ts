// Billing service — talks to the unified billing facade at /api/v1/billing/.
// Returns objects shaped to match the InvoicesPage mocks 1:1, so React
// components can swap mock imports for query hooks without rendering changes.
import api from './api';
import type {
  InvoiceKind,
  InvoiceRecord,
  InvoiceStats,
} from '../features/invoices/data/mocks';

export interface FinanceProvider {
  id: string;
  name: string;
  color: string;
  connected: boolean;
  default: boolean;
}

class BillingService {
  /** GET /api/v1/billing/invoices/?kind={kind}&status=&search= */
  async getInvoices(kind: InvoiceKind, opts?: { status?: string; search?: string }): Promise<InvoiceRecord[]> {
    const params = new URLSearchParams({ kind });
    if (opts?.status) params.append('status', opts.status);
    if (opts?.search) params.append('search', opts.search);
    const response = await api.get<InvoiceRecord[]>(`/api/v1/billing/invoices/?${params.toString()}`);
    return Array.isArray(response.data) ? response.data : [];
  }

  /** GET /api/v1/billing/invoices/{id}/ */
  async getInvoice(id: string): Promise<InvoiceRecord> {
    const response = await api.get<InvoiceRecord>(`/api/v1/billing/invoices/${encodeURIComponent(id)}/`);
    return response.data;
  }

  /** GET /api/v1/billing/invoices/stats/?kind={kind} */
  async getStats(kind: InvoiceKind): Promise<InvoiceStats> {
    const response = await api.get<InvoiceStats>(`/api/v1/billing/invoices/stats/?kind=${kind}`);
    return response.data;
  }

  /** GET /api/v1/billing/invoices/aging/?kind={kind} */
  async getAging(kind: InvoiceKind): Promise<InvoiceStats['buckets']> {
    const response = await api.get<InvoiceStats['buckets']>(
      `/api/v1/billing/invoices/aging/?kind=${kind}`,
    );
    return response.data;
  }

  /** GET /api/v1/billing/invoices/{id}/activity/ */
  async getActivity(id: string): Promise<InvoiceRecord['history']> {
    const response = await api.get<InvoiceRecord['history']>(
      `/api/v1/billing/invoices/${encodeURIComponent(id)}/activity/`,
    );
    return response.data;
  }

  /** GET /api/v1/billing/finance-providers/ */
  async getFinanceProviders(): Promise<FinanceProvider[]> {
    const response = await api.get<FinanceProvider[]>('/api/v1/billing/finance-providers/');
    return Array.isArray(response.data) ? response.data : [];
  }

  /** POST /api/v1/billing/statements/ */
  async createStatement(payload: {
    venueId: string;
    periodStart: string;
    periodEnd: string;
    invoiceIds?: string[];
    notes?: string;
    sentToEmail?: string;
  }): Promise<unknown> {
    const response = await api.post('/api/v1/billing/statements/', payload);
    return response.data;
  }

  /** POST /api/v1/billing/exports/{id}/export-to-xero/ */
  async exportToXero(invoiceId: string): Promise<{ status: string; created?: boolean }> {
    const response = await api.post<{ status: string; created?: boolean }>(
      `/api/v1/billing/exports/${encodeURIComponent(invoiceId)}/export-to-xero/`,
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/mark-paid/ */
  async markPaid(invoiceId: string, paidDate?: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/mark-paid/`,
      paidDate ? { paid_date: paidDate } : {},
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/reject/ */
  async reject(invoiceId: string, reason: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/reject/`,
      { reason },
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/void/ */
  async void(invoiceId: string, reason?: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/void/`,
      reason ? { reason } : {},
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/remind/ */
  async remind(invoiceId: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/remind/`,
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/duplicate/ — creates a draft clone. */
  async duplicate(invoiceId: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/duplicate/`,
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/resolve/ — duplicates as draft AND
   * marks the original as superseded (so it shows 'Resolved' not 'Rejected'). */
  async resolve(invoiceId: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/resolve/`,
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/from-shifts/ — creates a draft client
   * invoice from approved shifts at the named venue over the given period.
   * Used by the "+ New invoice" button on the Clients ledger. */
  async createClientInvoiceFromShifts(payload: {
    venueId: string | number;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      '/api/v1/billing/invoices/from-shifts/',
      payload,
    );
    return response.data;
  }

  /** POST /api/v1/billing/invoices/{id}/issue/ — flips a draft to pending. */
  async issue(invoiceId: string): Promise<InvoiceRecord> {
    const response = await api.post<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/issue/`,
    );
    return response.data;
  }

  /** PATCH /api/v1/billing/invoices/{id}/update_note/ — updates the note field. */
  async updateNote(invoiceId: string, note: string): Promise<InvoiceRecord> {
    const response = await api.patch<InvoiceRecord>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/update_note/`,
      { note },
    );
    return response.data;
  }

  /** GET /api/v1/billing/invoices/{id}/pdf/ — fetches the PDF and triggers
   * a browser download. Returns the filename written. */
  async downloadPdf(invoiceId: string): Promise<string> {
    const response = await api.get(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/pdf/`,
      { responseType: 'blob' },
    );
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    const filename = `${invoiceId}.pdf`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after a tick so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return filename;
  }

  /** POST /api/v1/billing/invoices/{id}/email-payslip/ — generates the PDF
   * and emails it to the staff member's registered address. */
  async emailPayslip(invoiceId: string): Promise<{ sent: boolean; recipient: string }> {
    const response = await api.post<{ sent: boolean; recipient: string }>(
      `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/email-payslip/`,
    );
    return response.data;
  }
}

const billingService = new BillingService();
export default billingService;
