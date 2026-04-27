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
    };
    start_time: string;
    end_time: string;
    status: string;
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
  status: 'pending' | 'accepted_by_target' | 'approved' | 'rejected' | 'cancelled';
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

export const exchangeService = {
  // === Shift Exchange (Direct Swaps) ===
  
  /**
   * Get all shift exchanges for the current user
   */
  async getMyExchanges(): Promise<ShiftExchange[]> {
    const response = await api.get('/api/v1/shift-exchanges/');
    console.log('getMyExchanges API response:', response);
    console.log('getMyExchanges response data:', response.data);

    // Handle paginated response structure
    if (response.data.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }

    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Create a new shift exchange request
   */
  async createExchange(data: CreateExchangeRequest): Promise<ShiftExchange> {
    const response = await api.post('/api/v1/shift-exchanges/', data);
    return response.data;
  },

  /**
   * Accept an exchange request (target user)
   */
  async acceptExchange(exchangeId: number, response?: string): Promise<{ message: string; exchange: ShiftExchange }> {
    const result = await api.post(`/api/v1/shift-exchanges/${exchangeId}/accept/`, {
      response: response || ''
    });
    return result.data;
  },

  /**
   * Manager approves an exchange request
   */
  async approveExchange(exchangeId: number, notes?: string): Promise<{ message: string; exchange: ShiftExchange }> {
    console.log('approveExchange called with:', { exchangeId, notes });
    try {
      const result = await api.post(`/api/v1/shift-exchanges/${exchangeId}/approve/`, {
        notes: notes || ''
      });
      console.log('approveExchange success:', result.data);
      return result.data;
    } catch (error: any) {
      console.error('approveExchange error:', error);
      console.error('approveExchange error response:', error.response);
      console.error('approveExchange error response data:', error.response?.data);
      throw error;
    }
  },

  /**
   * Manager rejects an exchange request
   */
  async rejectExchange(exchangeId: number, notes: string): Promise<{ message: string; exchange: ShiftExchange }> {
    const result = await api.post(`/api/v1/shift-exchanges/${exchangeId}/reject/`, {
      notes
    });
    return result.data;
  },

  /**
   * Cancel an exchange request
   */
  async cancelExchange(exchangeId: number): Promise<{ message: string }> {
    const result = await api.delete(`/api/v1/shift-exchanges/${exchangeId}/cancel/`);
    return result.data;
  },

  // === Open Shift Pool ===

  /**
   * Get all open shift requests for the current user
   */
  async getMyOpenShiftRequests(): Promise<OpenShiftRequest[]> {
    const response = await api.get('/api/v1/open-shift-requests/');
    console.log('getMyOpenShiftRequests API response:', response);
    console.log('getMyOpenShiftRequests response data:', response.data);

    // Handle paginated response structure
    if (response.data.results && Array.isArray(response.data.results)) {
      return response.data.results;
    }

    return Array.isArray(response.data) ? response.data : [];
  },

  /**
   * Get all available shifts that can be claimed
   */
  async getAvailableShifts(): Promise<OpenShiftRequest[]> {
    const response = await api.get('/api/v1/open-shift-requests/available/');
    return response.data;
  },

  /**
   * Release a shift to the open pool
   */
  async releaseShift(data: CreateOpenShiftRequest): Promise<OpenShiftRequest> {
    const response = await api.post('/api/v1/open-shift-requests/', data);
    return response.data;
  },

  /**
   * Claim an available shift
   */
  async claimShift(requestId: number): Promise<{ message: string; request: OpenShiftRequest }> {
    const result = await api.post(`/api/v1/open-shift-requests/${requestId}/claim/`);
    return result.data;
  },

  /**
   * Manager approves a shift claim
   */
  async approveClaim(requestId: number, notes?: string): Promise<{ message: string; request: OpenShiftRequest }> {
    const result = await api.post(`/api/v1/open-shift-requests/${requestId}/approve/`, {
      notes: notes || ''
    });
    return result.data;
  },

  /**
   * Manager rejects a shift claim
   */
  async rejectClaim(requestId: number, notes: string): Promise<{ message: string; request: OpenShiftRequest }> {
    const result = await api.post(`/api/v1/open-shift-requests/${requestId}/reject/`, {
      notes
    });
    return result.data;
  },

  /**
   * Cancel an open shift request
   */
  async cancelOpenShiftRequest(requestId: number): Promise<{ message: string }> {
    const result = await api.delete(`/api/v1/open-shift-requests/${requestId}/cancel/`);
    return result.data;
  },

  // === Combined/Helper Functions ===

  /**
   * Get all exchange-related activities for the current user
   */
  async getAllExchangeActivities(): Promise<{
    direct_exchanges: ShiftExchange[];
    open_requests: OpenShiftRequest[];
    available_shifts: OpenShiftRequest[];
  }> {
    const [directExchanges, openRequests, availableShifts] = await Promise.all([
      this.getMyExchanges(),
      this.getMyOpenShiftRequests(),
      this.getAvailableShifts()
    ]);

    return {
      direct_exchanges: directExchanges,
      open_requests: openRequests,
      available_shifts: availableShifts
    };
  },

  /**
   * Get pending approvals for managers
   */
  async getPendingApprovals(): Promise<{
    exchange_requests: ShiftExchange[];
    shift_claims: OpenShiftRequest[];
  }> {
    const [exchanges, openRequests] = await Promise.all([
      this.getMyExchanges(),
      this.getMyOpenShiftRequests()
    ]);

    console.log('getPendingApprovals - exchanges:', exchanges);
    console.log('getPendingApprovals - openRequests:', openRequests);
    console.log('getPendingApprovals - exchanges type:', typeof exchanges, Array.isArray(exchanges));
    console.log('getPendingApprovals - openRequests type:', typeof openRequests, Array.isArray(openRequests));

    // Ensure we have arrays to work with
    const exchangeArray = Array.isArray(exchanges) ? exchanges : [];
    const openRequestArray = Array.isArray(openRequests) ? openRequests : [];

    return {
      exchange_requests: exchangeArray.filter(ex => ex.status === 'accepted_by_target'),
      shift_claims: openRequestArray.filter(req => req.status === 'claimed')
    };
  }
};

export default exchangeService;