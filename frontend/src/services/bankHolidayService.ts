import api from './api';

export interface BankHoliday {
  id: number;
  company: number;
  company_name?: string;
  name: string;
  date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBankHolidayRequest {
  name: string;
  date: string;
  is_active?: boolean;
}

export interface UpdateBankHolidayRequest {
  name?: string;
  date?: string;
  is_active?: boolean;
}

export interface BankHolidayListParams {
  year?: number;
  is_active?: boolean;
}

export const bankHolidayService = {
  /**
   * Get all bank holidays for the current company
   */
  async getBankHolidays(params?: BankHolidayListParams): Promise<BankHoliday[]> {
    const response = await api.get('/api/v1/bank-holidays/', { params });
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Get a single bank holiday by ID
   */
  async getBankHoliday(id: number): Promise<BankHoliday> {
    const response = await api.get(`/api/v1/bank-holidays/${id}/`);
    return response.data;
  },

  /**
   * Create a new bank holiday
   */
  async createBankHoliday(data: CreateBankHolidayRequest): Promise<BankHoliday> {
    const response = await api.post('/api/v1/bank-holidays/', data);
    return response.data;
  },

  /**
   * Update an existing bank holiday
   */
  async updateBankHoliday(id: number, data: UpdateBankHolidayRequest): Promise<BankHoliday> {
    const response = await api.patch(`/api/v1/bank-holidays/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a bank holiday
   */
  async deleteBankHoliday(id: number): Promise<void> {
    await api.delete(`/api/v1/bank-holidays/${id}/`);
  },

  /**
   * Populate UK defaults for a given year
   */
  async populateUKDefaults(year: number): Promise<{ message: string; created_count: number; holidays: BankHoliday[] }> {
    const response = await api.post('/api/v1/bank-holidays/populate_uk_defaults/', { year });
    return response.data;
  },

  /**
   * Get upcoming bank holidays
   */
  async getUpcoming(limit?: number): Promise<BankHoliday[]> {
    const response = await api.get('/api/v1/bank-holidays/upcoming/', {
      params: limit ? { limit } : undefined
    });
    return response.data;
  }
};
