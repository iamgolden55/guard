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

    const response = await api.get<any>(url);
    // Handle pagination - extract results array if paginated response
    if (response.data && typeof response.data === 'object' && response.data.results) {
      return response.data.results;
    }
    // If it's already an array, return as is
    return response.data;
  }

  async getInvoiceById(invoiceId: number): Promise<Invoice> {
    const response = await api.get<Invoice>(`/invoices/${invoiceId}/`);
    return response.data;
  }

  async getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
    const response = await api.get<InvoiceItem[]>(`/invoices/${invoiceId}/items/`);
    return response.data;
  }

  async generateInvoicePdf(invoiceId: number): Promise<Blob> {
    const response = await api.post(`/invoices/${invoiceId}/generate-pdf/`, {}, {
      responseType: 'blob'
    });
    return response.data;
  }

  async getInvoicePdf(invoiceId: number): Promise<Blob> {
    const response = await api.get(`/invoices/${invoiceId}/pdf/`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async updateInvoiceStatus(invoiceId: number, status: string): Promise<Invoice> {
    const response = await api.patch<Invoice>(`/invoices/${invoiceId}/update-status/`, { status });
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

  async previewInvoiceGeneration(data: {
    staffUserId: number,
    startDate: string,
    endDate: string
  }): Promise<any> {
    const response = await api.get(`/invoices/preview/?staff_user_id=${data.staffUserId}&start_date=${data.startDate}&end_date=${data.endDate}`);
    return response.data;
  }

  // Pay rate methods
  async getPayRates(staffUserId?: number): Promise<PayRate[]> {
    const url = staffUserId ? `/pay-rates/?staff_user=${staffUserId}` : '/pay-rates/';
    const response = await api.get<PayRate[]>(url);
    return response.data;
  }

  async createPayRate(data: {
    staffUserId: number,
    venueId?: number,
    hourlyRate: number,
    isDefault: boolean
  }): Promise<PayRate> {
    const response = await api.post<PayRate>('/pay-rates/', data);
    return response.data;
  }

  async updatePayRate(payRateId: number, data: {
    hourlyRate: number,
    isDefault?: boolean
  }): Promise<PayRate> {
    const response = await api.patch<PayRate>(`/pay-rates/${payRateId}/`, data);
    return response.data;
  }

  async deletePayRate(payRateId: number): Promise<void> {
    await api.delete(`/pay-rates/${payRateId}/`);
  }
}

export default new InvoiceService();
