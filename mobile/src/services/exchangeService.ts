/**
 * Exchange Service
 * Handles shift exchange and open shift pool operations for mobile app
 */

import api from './api';

// Types for exchange-related data
export interface ShiftExchange {
  id: number;
  original_shift: number;
  original_shift_details: {
    id: number;
    venue: {
      id: number;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    };
    start_time: string;
    end_time: string;
    status: string;
    required_security_role?: string;
  };
  requesting_user: number;
  requesting_user_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  target_user: number;
  target_user_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  status: 'pending' | 'accepted_by_target' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  request_reason: string;
  target_response?: string;
  manager_user?: number;
  manager_user_details?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  manager_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OpenShiftRequest {
  id: number;
  original_shift: number;
  original_shift_details: {
    id: number;
    venue: {
      id: number;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
    };
    start_time: string;
    end_time: string;
    status: string;
    required_security_role: string;
  };
  requesting_user: number;
  requesting_user_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  claimed_by?: number;
  claimed_by_details?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  status: 'open' | 'claimed' | 'approved' | 'rejected' | 'cancelled';
  request_reason: string;
  claim_time?: string;
  manager_user?: number;
  manager_user_details?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  manager_notes?: string;
  created_at: string;
  updated_at: string;
}

// Interface for creating exchange requests
export interface CreateExchangeRequest {
  original_shift: number;
  target_user: number;
  request_reason: string;
}

// Interface for creating open shift requests
export interface CreateOpenShiftRequest {
  shift_id: number;
  request_reason: string;
}

// Response interfaces
export interface ExchangeActionResponse {
  message: string;
  exchange: ShiftExchange;
}

export interface OpenShiftActionResponse {
  message: string;
  request: OpenShiftRequest;
}

/**
 * Exchange Service
 * Provides methods for shift exchange and open shift pool operations
 */
class ExchangeService {
  // === Shift Exchange (Direct Swaps) ===

  /**
   * Get all shift exchanges for the current user
   */
  async getMyExchanges(): Promise<ShiftExchange[]> {
    try {
      const response = await api.get<{ results?: ShiftExchange[]; data?: ShiftExchange[] } | ShiftExchange[]>(
        '/api/v1/shift-exchanges/'
      );

      // Handle paginated response structure
      if (response && typeof response === 'object' && 'results' in response && Array.isArray(response.results)) {
        return response.results;
      }

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('getMyExchanges error:', error);
      throw error;
    }
  }

  /**
   * Create a new shift exchange request
   */
  async createExchange(data: CreateExchangeRequest): Promise<ShiftExchange> {
    try {
      const response = await api.post<ShiftExchange>('/api/v1/shift-exchanges/', data);
      return response;
    } catch (error) {
      console.error('createExchange error:', error);
      throw error;
    }
  }

  /**
   * Accept an exchange request (target user)
   */
  async acceptExchange(exchangeId: number, response?: string): Promise<ExchangeActionResponse> {
    try {
      const result = await api.post<ExchangeActionResponse>(
        `/api/v1/shift-exchanges/${exchangeId}/accept/`,
        {
          response: response || '',
        }
      );
      return result;
    } catch (error) {
      console.error('acceptExchange error:', error);
      throw error;
    }
  }

  /**
   * Cancel an exchange request
   */
  async cancelExchange(exchangeId: number): Promise<{ message: string }> {
    try {
      const result = await api.delete<{ message: string }>(
        `/api/v1/shift-exchanges/${exchangeId}/cancel/`
      );
      return result;
    } catch (error) {
      console.error('cancelExchange error:', error);
      throw error;
    }
  }

  // === Open Shift Pool ===

  /**
   * Get all open shift requests for the current user
   */
  async getMyOpenShiftRequests(): Promise<OpenShiftRequest[]> {
    try {
      const response = await api.get<{ results?: OpenShiftRequest[]; data?: OpenShiftRequest[] } | OpenShiftRequest[]>(
        '/api/v1/open-shift-requests/'
      );

      // Handle paginated response structure
      if (response && typeof response === 'object' && 'results' in response && Array.isArray(response.results)) {
        return response.results;
      }

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('getMyOpenShiftRequests error:', error);
      throw error;
    }
  }

  /**
   * Get all available shifts that can be claimed
   */
  async getAvailableShifts(): Promise<OpenShiftRequest[]> {
    try {
      const response = await api.get<OpenShiftRequest[]>('/api/v1/open-shift-requests/available/');
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('getAvailableShifts error:', error);
      throw error;
    }
  }

  /**
   * Release a shift to the open pool
   */
  async releaseShift(data: CreateOpenShiftRequest): Promise<OpenShiftRequest> {
    try {
      const response = await api.post<OpenShiftRequest>('/api/v1/open-shift-requests/', data);
      return response;
    } catch (error) {
      console.error('releaseShift error:', error);
      throw error;
    }
  }

  /**
   * Claim an available shift
   */
  async claimShift(requestId: number): Promise<OpenShiftActionResponse> {
    try {
      const result = await api.post<OpenShiftActionResponse>(
        `/api/v1/open-shift-requests/${requestId}/claim/`
      );
      return result;
    } catch (error) {
      console.error('claimShift error:', error);
      throw error;
    }
  }

  /**
   * Cancel an open shift request
   */
  async cancelOpenShiftRequest(requestId: number): Promise<{ message: string }> {
    try {
      const result = await api.delete<{ message: string }>(
        `/api/v1/open-shift-requests/${requestId}/cancel/`
      );
      return result;
    } catch (error) {
      console.error('cancelOpenShiftRequest error:', error);
      throw error;
    }
  }

  // === Combined/Helper Functions ===

  /**
   * Get all exchange-related activities for the current user
   */
  async getAllExchangeActivities(): Promise<{
    direct_exchanges: ShiftExchange[];
    open_requests: OpenShiftRequest[];
    available_shifts: OpenShiftRequest[];
  }> {
    try {
      const [directExchanges, openRequests, availableShifts] = await Promise.all([
        this.getMyExchanges(),
        this.getMyOpenShiftRequests(),
        this.getAvailableShifts(),
      ]);

      return {
        direct_exchanges: directExchanges,
        open_requests: openRequests,
        available_shifts: availableShifts,
      };
    } catch (error) {
      console.error('getAllExchangeActivities error:', error);
      throw error;
    }
  }

  /**
   * Get pending exchanges for the current user (exchanges they need to respond to)
   */
  async getPendingExchanges(): Promise<ShiftExchange[]> {
    try {
      const exchanges = await this.getMyExchanges();
      return exchanges.filter((ex) => ex.status === 'pending');
    } catch (error) {
      console.error('getPendingExchanges error:', error);
      throw error;
    }
  }

  /**
   * Get accepted exchanges awaiting manager approval
   */
  async getAcceptedExchanges(): Promise<ShiftExchange[]> {
    try {
      const exchanges = await this.getMyExchanges();
      return exchanges.filter((ex) => ex.status === 'accepted_by_target');
    } catch (error) {
      console.error('getAcceptedExchanges error:', error);
      throw error;
    }
  }

  /**
   * Get count of pending incoming exchanges that need user's attention
   * These are exchanges where the user is the target and status is 'pending'
   * (meaning they need to accept or decline the exchange request)
   */
  async getPendingIncomingExchangesCount(userId: number): Promise<number> {
    try {
      const exchanges = await this.getMyExchanges();
      const pendingIncoming = exchanges.filter(
        (ex) => ex.status === 'pending' && ex.target_user === userId
      );
      return pendingIncoming.length;
    } catch (error) {
      console.error('getPendingIncomingExchangesCount error:', error);
      return 0; // Return 0 on error to not block UI
    }
  }

  /**
   * Get count of available shifts that the user can claim
   * These are open shifts released by other users
   */
  async getAvailableShiftsCount(): Promise<number> {
    try {
      const availableShifts = await this.getAvailableShifts();
      return availableShifts.length;
    } catch (error) {
      console.error('getAvailableShiftsCount error:', error);
      return 0; // Return 0 on error to not block UI
    }
  }
}

// Export singleton instance
const exchangeService = new ExchangeService();
export default exchangeService;
