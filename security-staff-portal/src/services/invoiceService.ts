import api from './api';
import type { Invoice, InvoiceFilter, InvoiceItem, PayRate } from '../types';

class InvoiceService {
  // Invoice-related methods
  async getInvoices(filters?: InvoiceFilter): Promise<Invoice[]> {
    let url = '/invoices/';

    if (filters) {
      const queryParams = new URLSearchParams();

      if (filters.startDate) queryParams.append('start_date', filters.startDate);
      if (filters.endDate) queryParams.append('end_date', filters.endDate);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.staffUser) queryParams.append('staff_user', filters.staffUser.toString());

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }

    const response = await api.get<Invoice[]>(url);
    return response.data;
  }

  async getInvoiceById(invoiceId: number): Promise<Invoice> {
    const response = await api.get<Invoice>(`/api/invoice/${invoiceId}/`);
    return response.data;
  }

  async getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
    const response = await api.get<InvoiceItem[]>(`/api/invoice/${invoiceId}/items/`);
    return response.data;
  }

  async generateInvoicePdf(invoiceId: number): Promise<string> {
    const response = await api.post<{pdf_url: string}>(`/api/invoice/${invoiceId}/generate-pdf/`);
    return response.data.pdf_url;
  }

  async updateInvoiceStatus(invoiceId: number, status: string): Promise<Invoice> {
    const response = await api.patch<Invoice>(`/api/invoice/${invoiceId}/`, { status });
    return response.data;
  }

  async generateInvoice(data: {
    staffUserId: number,
    startDate: string,
    endDate: string
  }): Promise<Invoice> {
    const response = await api.post<Invoice>('/invoices/generate/', {
      staff_user_id: data.staffUserId,
      start_date: data.startDate,
      end_date: data.endDate
    });
    return response.data;
  }

  // Pay rate methods
  async getPayRates(staffUserId?: number): Promise<PayRate[]> {
    const url = staffUserId ? `/api/payrates/?staff_user=${staffUserId}` : '/api/payrates/';
    const response = await api.get<PayRate[]>(url);
    return response.data;
  }

  async createPayRate(data: {
    staffUserId: number,
    venueId?: number,
    hourlyRate: number,
    isDefault: boolean
  }): Promise<PayRate> {
    const response = await api.post<PayRate>('/api/payrates/', data);
    return response.data;
  }

  async updatePayRate(payRateId: number, data: {
    hourlyRate: number,
    isDefault?: boolean
  }): Promise<PayRate> {
    const response = await api.patch<PayRate>(`/api/payrates/${payRateId}/`, data);
    return response.data;
  }

  async deletePayRate(payRateId: number): Promise<void> {
    await api.delete(`/api/payrates/${payRateId}/`);
  }
}

export default new InvoiceService();
