import { apiService } from './api';

export interface ContractorUnavailability {
  id: number;
  staff_user: number;
  staff_user_name?: string;
  company: number;
  start_date: string;
  end_date: string;
  reason?: string;
  created_at: string;
}

export interface CreateUnavailabilityRequest {
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface UpdateUnavailabilityRequest {
  start_date?: string;
  end_date?: string;
  reason?: string;
}

export interface UnavailabilityCheckResponse {
  is_available: boolean;
  unavailability_periods: ContractorUnavailability[];
}

class ContractorUnavailabilityService {
  private baseUrl = '/api/v1/contractor-unavailability';

  /**
   * Get all unavailability periods for the current user
   */
  async getMyUnavailability(): Promise<ContractorUnavailability[]> {
    const response = await apiService.get<ContractorUnavailability[] | { results: ContractorUnavailability[] }>(`${this.baseUrl}/`);
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response)) {
      return response;
    }
    // DRF pagination returns { count, next, previous, results }
    if (response && 'results' in response) {
      return response.results;
    }
    return [];
  }

  /**
   * Get a specific unavailability period by ID
   */
  async getUnavailability(id: number): Promise<ContractorUnavailability> {
    const response = await apiService.get<ContractorUnavailability>(`${this.baseUrl}/${id}/`);
    return response;
  }

  /**
   * Create a new unavailability period
   */
  async createUnavailability(data: CreateUnavailabilityRequest): Promise<ContractorUnavailability> {
    const response = await apiService.post<ContractorUnavailability>(`${this.baseUrl}/`, data);
    return response;
  }

  /**
   * Update an existing unavailability period
   */
  async updateUnavailability(id: number, data: UpdateUnavailabilityRequest): Promise<ContractorUnavailability> {
    const response = await apiService.patch<ContractorUnavailability>(`${this.baseUrl}/${id}/`, data);
    return response;
  }

  /**
   * Delete an unavailability period
   */
  async deleteUnavailability(id: number): Promise<void> {
    await apiService.delete(`${this.baseUrl}/${id}/`);
  }

  /**
   * Check if the user is available on a specific date
   */
  async checkAvailability(date: string): Promise<UnavailabilityCheckResponse> {
    const response = await apiService.get<UnavailabilityCheckResponse>(`${this.baseUrl}/check/`, {
      params: { date }
    });
    return response;
  }

  /**
   * Get upcoming unavailability periods (future dates only)
   */
  async getUpcomingUnavailability(): Promise<ContractorUnavailability[]> {
    const today = new Date().toISOString().split('T')[0];
    const allPeriods = await this.getMyUnavailability();
    return allPeriods.filter(period => period.end_date >= today);
  }
}

const contractorUnavailabilityService = new ContractorUnavailabilityService();
export default contractorUnavailabilityService;
