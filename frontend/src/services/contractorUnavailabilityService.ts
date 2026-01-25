import api from './api';

export interface ContractorUnavailability {
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
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContractorUnavailabilityRequest {
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface UpdateContractorUnavailabilityRequest {
  start_date?: string;
  end_date?: string;
  reason?: string;
}

export interface AvailabilityCheckResult {
  date: string;
  is_available: boolean;
  reason: string;
}

export interface ContractorUnavailabilityListParams {
  staff_user?: number;
  start_date?: string;
  end_date?: string;
}

export const contractorUnavailabilityService = {
  /**
   * Get all contractor unavailability periods (admin/manager view)
   */
  async getAll(params?: ContractorUnavailabilityListParams): Promise<ContractorUnavailability[]> {
    const response = await api.get('/api/v1/contractor-unavailability/', { params });
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Get unavailability periods for the current user
   */
  async getMyUnavailability(): Promise<ContractorUnavailability[]> {
    const response = await api.get('/api/v1/contractor-unavailability/my_unavailability/');
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  /**
   * Get a single unavailability period by ID
   */
  async get(id: number): Promise<ContractorUnavailability> {
    const response = await api.get(`/api/v1/contractor-unavailability/${id}/`);
    return response.data;
  },

  /**
   * Create a new unavailability period
   */
  async create(data: CreateContractorUnavailabilityRequest): Promise<ContractorUnavailability> {
    const response = await api.post('/api/v1/contractor-unavailability/', data);
    return response.data;
  },

  /**
   * Update an existing unavailability period
   */
  async update(id: number, data: UpdateContractorUnavailabilityRequest): Promise<ContractorUnavailability> {
    const response = await api.patch(`/api/v1/contractor-unavailability/${id}/`, data);
    return response.data;
  },

  /**
   * Delete an unavailability period
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/api/v1/contractor-unavailability/${id}/`);
  },

  /**
   * Check if a user is available on a specific date
   */
  async checkAvailability(date: string, userId?: number): Promise<AvailabilityCheckResult> {
    const response = await api.get('/api/v1/contractor-unavailability/check/', {
      params: { date, user_id: userId }
    });
    return response.data;
  }
};
