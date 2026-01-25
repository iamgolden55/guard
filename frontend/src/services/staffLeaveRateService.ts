import api from './api';

export interface StaffLeaveDailyRate {
  id: number;
  staff_user: number;
  staff_user_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  company: number;
  daily_rate: string;
  effective_from: string;
  updated_by: number | null;
  updated_by_details?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface SetLeaveRateRequest {
  daily_rate: string | number;
  effective_from: string;
}

export interface StaffLeaveRateListParams {
  search?: string;
}

export const staffLeaveRateService = {
  /**
   * Get all staff leave daily rates
   */
  async getStaffLeaveRates(params?: StaffLeaveRateListParams): Promise<StaffLeaveDailyRate[]> {
    const response = await api.get('/api/v1/staff-leave-rates/', { params });
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Get leave daily rate for a specific user
   */
  async getByUser(userId: number): Promise<StaffLeaveDailyRate | null> {
    try {
      const response = await api.get(`/api/v1/staff-leave-rates/by_user/`, {
        params: { user_id: userId }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Set or update leave daily rate for a user
   */
  async setRate(userId: number, data: SetLeaveRateRequest): Promise<StaffLeaveDailyRate> {
    const response = await api.post('/api/v1/staff-leave-rates/set_rate/', {
      user_id: userId,
      ...data
    });
    return response.data;
  },

  /**
   * Get a single staff leave rate by ID
   */
  async getStaffLeaveRate(id: number): Promise<StaffLeaveDailyRate> {
    const response = await api.get(`/api/v1/staff-leave-rates/${id}/`);
    return response.data;
  },

  /**
   * Update an existing staff leave rate
   */
  async updateStaffLeaveRate(id: number, data: SetLeaveRateRequest): Promise<StaffLeaveDailyRate> {
    const response = await api.patch(`/api/v1/staff-leave-rates/${id}/`, data);
    return response.data;
  }
};
