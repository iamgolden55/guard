import api from './api';
import type {
  LeaveType,
  LeavePolicy,
  LeaveEntitlement,
  LeaveRequest,
  LeaveRequestFormData,
  LeaveRequestResponse,
  LeaveEntitlementResponse,
  LeaveBalanceResponse,
  LeaveBalanceSummary,
  LeaveApprovalAction,
  BulkApprovalRequest,
  LeaveRequestFilterOptions,
  LeaveStatistics,
  LeaveCalendarEvent,
  PendingLeaveRequest,
  User
} from '../types/leave';

// Additional interfaces for new functionality
export interface TeamOverviewData {
  teamMembers: TeamMember[];
  pendingApprovals: PendingLeaveRequest[];
  upcomingLeave: LeaveCalendarEvent[];
  teamStatistics: {
    totalTeamMembers: number;
    membersOnLeave: number;
    pendingRequests: number;
    leaveCapacity: number;
  };
}

export interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  department: string;
  position?: string;
  leaveBalances: LeaveBalanceSummary[];
  pendingRequests: LeaveRequest[];
  upcomingLeave: LeaveRequest[];
  avatar?: string;
}

export interface LeaveBalance {
  leaveType: number;
  leaveTypeDetails: LeaveType;
  totalEntitlement: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
  accruedToDate: number;
}

export interface CreateLeavePolicyRequest {
  name: string;
  leave_type: number;
  employment_types: number[];
  accrual_method: string;
  accrual_rate: string;
  max_accrual_per_year?: string;
  max_balance?: string;
  carryover_method: string;
  carryover_limit?: string;
  carryover_expiry_months: number;
  probation_months: number;
  min_employment_days: number;
  allow_negative_balance: boolean;
  negative_balance_limit: string;
  effective_date: string;
  expiry_date?: string;
}

export interface UpdateLeavePolicyRequest extends Partial<CreateLeavePolicyRequest> {}

export interface AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  departments?: string[];
  leaveTypes?: number[];
  employmentTypes?: number[];
}

export interface AnalyticsData {
  summary: {
    totalRequests: number;
    approvedRequests: number;
    pendingRequests: number;
    rejectedRequests: number;
    totalDaysTaken: number;
    averageDaysPerRequest: number;
  };
  byLeaveType: Array<{
    leaveType: LeaveType;
    requestCount: number;
    daysTaken: number;
    averageDays: number;
  }>;
  byDepartment: Array<{
    department: string;
    requestCount: number;
    daysTaken: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    requestCount: number;
    daysTaken: number;
  }>;
  topUsers: Array<{
    user: User;
    requestCount: number;
    daysTaken: number;
  }>;
}

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  departments?: string[];
  users?: number[];
  leaveTypes?: number[];
  status?: string[];
}

export interface ReportSummary {
  totalRequests: number;
  totalDays: number;
  byStatus: Record<string, number>;
  byLeaveType: Record<string, number>;
  byDepartment: Record<string, number>;
}

export interface LeaveSettings {
  id: number;
  organization_name: string;
  default_working_days_per_week: number;
  weekend_days: string[];
  public_holidays_enabled: boolean;
  auto_approval_threshold_days?: number;
  max_future_request_days?: number;
  notifications_enabled: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  manager_auto_approval: boolean;
  require_documentation_days?: number;
  default_accrual_method: string;
  fiscal_year_start_month: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveSettingsUpdate extends Partial<Omit<LeaveSettings, 'id' | 'created_at' | 'updated_at'>> {}

export interface BlackoutPeriod {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  leave_types: LeaveType[];
  departments?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBlackoutPeriodRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  leave_types: number[];
  departments?: string[];
  is_active?: boolean;
}

// Base API endpoints for leave management
const LEAVE_ENDPOINTS = {
  LEAVE_TYPES: '/api/v1/leave/types/',
  LEAVE_POLICIES: '/api/v1/leave/policies/',
  LEAVE_ENTITLEMENTS: '/api/v1/leave/entitlements/',
  LEAVE_REQUESTS: '/api/v1/leave/requests/',
  LEAVE_BALANCES: '/api/v1/leave/balances/',
  LEAVE_APPROVALS: '/api/v1/leave/approvals/',
  LEAVE_CALENDAR: '/api/v1/leave/calendar/',
  LEAVE_STATISTICS: '/api/v1/leave/reports/',
  LEAVE_ANALYTICS: '/api/v1/leave/reports',
  TEAM_OVERVIEW: '/api/v1/leave/team-overview/',
  TEAM_BALANCES: '/api/v1/leave/team-overview/team_balances/',
  TEAM_CALENDAR: '/api/v1/leave/team-overview/team_calendar/',
  LEAVE_SETTINGS: '/api/v1/leave/settings/',
  BLACKOUT_PERIODS: '/api/v1/leave/blackout-periods/'
} as const;

class LeaveService {

  // ============ Leave Types ============
  /**
   * Get all available leave types for the current user
   */
  async getLeaveTypes(activeOnly = true): Promise<LeaveType[]> {
    const response = await api.get<{results: LeaveType[]}>(LEAVE_ENDPOINTS.LEAVE_TYPES, {
      params: { active_only: activeOnly }
    });
    // Backend returns paginated response: {count, results, next, previous}
    return response.data.results || [];
  }

  /**
   * Get a specific leave type by ID
   */
  async getLeaveType(id: number): Promise<LeaveType> {
    const response = await api.get<LeaveType>(`${LEAVE_ENDPOINTS.LEAVE_TYPES}/${id}`);
    return response.data;
  }

  // ============ Leave Policies ============
  /**
   * Get leave policies applicable to the current user
   */
  async getLeavePolicies(userId?: number): Promise<LeavePolicy[]> {
    const response = await api.get<LeavePolicy[]>(LEAVE_ENDPOINTS.LEAVE_POLICIES, {
      params: userId ? { user_id: userId } : undefined
    });
    return response.data;
  }

  /**
   * Get policies for a specific leave type
   */
  async getPoliciesByLeaveType(leaveTypeId: number): Promise<LeavePolicy[]> {
    const response = await api.get<LeavePolicy[]>(LEAVE_ENDPOINTS.LEAVE_POLICIES, {
      params: { leave_type: leaveTypeId }
    });
    return response.data;
  }

  // ============ Leave Entitlements ============
  /**
   * Get leave entitlements for a user and year
   */
  async getLeaveEntitlements(
    userId?: number,
    year?: number
  ): Promise<LeaveEntitlementResponse> {
    const params: Record<string, any> = {};
    if (userId) params.user = userId;
    if (year) params.year = year;

    const response = await api.get<LeaveEntitlementResponse>(
      LEAVE_ENDPOINTS.LEAVE_ENTITLEMENTS,
      { params }
    );
    return response.data;
  }

  /**
   * Get current user's entitlements
   */
  async getMyEntitlements(year?: number): Promise<LeaveEntitlementResponse> {
    return this.getLeaveEntitlements(undefined, year);
  }

  // ============ Leave Balances ============
  /**
   * Get comprehensive leave balance information for a user
   */
  async getLeaveBalances(userId?: number): Promise<LeaveBalanceResponse> {
    const response = await api.get<LeaveBalanceResponse>(LEAVE_ENDPOINTS.LEAVE_BALANCES, {
      params: userId ? { user_id: userId } : undefined
    });
    return response.data;
  }

  /**
   * Get current user's leave balances. The list endpoint returns a paginated
   * envelope of every balance the user can see; the my_balances action returns
   * the LeaveBalanceResponse shape (user + balances[] + total_days_*).
   */
  async getMyBalances(): Promise<LeaveBalanceResponse> {
    const response = await api.get<LeaveBalanceResponse>(
      `${LEAVE_ENDPOINTS.LEAVE_BALANCES}my_balances/`,
    );
    return response.data;
  }

  /**
   * Get balance summary for a specific leave type
   */
  async getBalanceByLeaveType(leaveTypeId: number, userId?: number): Promise<LeaveBalanceSummary> {
    const response = await api.get<LeaveBalanceSummary>(
      `${LEAVE_ENDPOINTS.LEAVE_BALANCES}/by-type/${leaveTypeId}`,
      { params: userId ? { user_id: userId } : undefined }
    );
    return response.data;
  }

  // ============ Leave Requests ============
  /**
   * Create a new leave request
   */
  async createLeaveRequest(requestData: LeaveRequestFormData): Promise<LeaveRequest> {
    const formData = new FormData();

    // Add basic fields
    formData.append('leave_type_id', requestData.leave_type_id.toString());
    formData.append('start_date', requestData.start_date);
    formData.append('end_date', requestData.end_date);
    formData.append('days_requested', requestData.days_requested.toString());
    formData.append('reason', requestData.reason);

    // Add supporting documents if provided
    if (requestData.supporting_documents) {
      requestData.supporting_documents.forEach((file, index) => {
        formData.append(`supporting_document_${index}`, file);
      });
    }

    const response = await api.post<LeaveRequest>(
      LEAVE_ENDPOINTS.LEAVE_REQUESTS,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  /**
   * Get leave requests with filtering and pagination
   */
  async getLeaveRequests(
    filters?: LeaveRequestFilterOptions,
    page = 1,
    pageSize = 20
  ): Promise<LeaveRequestResponse> {
    const params: Record<string, any> = {
      page,
      page_size: pageSize
    };

    if (filters) {
      if (filters.status) params.status = filters.status.join(',');
      if (filters.leave_type) params.leave_type = filters.leave_type.join(',');
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.user) params.user = filters.user.join(',');
      if (filters.department) params.department = filters.department.join(',');
    }

    const response = await api.get<LeaveRequestResponse>(
      LEAVE_ENDPOINTS.LEAVE_REQUESTS,
      { params }
    );
    return response.data;
  }

  /**
   * Get current user's leave requests
   */
  async getMyLeaveRequests(
    filters?: Omit<LeaveRequestFilterOptions, 'user'>,
    page = 1,
    pageSize = 20
  ): Promise<LeaveRequestResponse> {
    return this.getLeaveRequests(filters, page, pageSize);
  }

  /**
   * Get a specific leave request by ID
   */
  async getLeaveRequest(id: number): Promise<LeaveRequest> {
    const response = await api.get<LeaveRequest>(`${LEAVE_ENDPOINTS.LEAVE_REQUESTS}/${id}`);
    return response.data;
  }

  /**
   * Update a leave request (only allowed for pending requests)
   */
  async updateLeaveRequest(id: number, requestData: Partial<LeaveRequestFormData>): Promise<LeaveRequest> {
    const formData = new FormData();

    if (requestData.leave_type_id) {
      formData.append('leave_type_id', requestData.leave_type_id.toString());
    }
    if (requestData.start_date) formData.append('start_date', requestData.start_date);
    if (requestData.end_date) formData.append('end_date', requestData.end_date);
    if (requestData.days_requested !== undefined) {
      formData.append('days_requested', requestData.days_requested.toString());
    }
    if (requestData.reason) formData.append('reason', requestData.reason);

    if (requestData.supporting_documents) {
      requestData.supporting_documents.forEach((file, index) => {
        formData.append(`supporting_document_${index}`, file);
      });
    }

    const response = await api.put<LeaveRequest>(
      `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}/${id}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  /**
   * Cancel/withdraw a leave request
   */
  async cancelLeaveRequest(id: number, reason?: string): Promise<LeaveRequest> {
    const response = await api.patch<LeaveRequest>(
      `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}/${id}/cancel`,
      { reason }
    );
    return response.data;
  }

  /**
   * Delete a leave request (only if pending)
   */
  async deleteLeaveRequest(id: number): Promise<void> {
    await api.delete(`${LEAVE_ENDPOINTS.LEAVE_REQUESTS}/${id}`);
  }

  // ============ Manager/Admin Functions ============
  /**
   * Get pending leave requests for approval (managers only)
   */
  async getPendingLeaveRequests(
    filters?: LeaveRequestFilterOptions
  ): Promise<PendingLeaveRequest[]> {
    const params: Record<string, any> = {};

    if (filters) {
      if (filters.leave_type) params.leave_type = filters.leave_type.join(',');
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.user) params.user = filters.user.join(',');
      if (filters.department) params.department = filters.department.join(',');
    }

    const response = await api.get<{ pending_requests: any[]; count: number; urgent_count: number }>(
      `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}pending_approvals/`,
      { params }
    );

    // Transform backend data to include urgency_level and days_until_start
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return response.data.pending_requests.map(request => {
      const startDate = new Date(request.start_date);
      startDate.setHours(0, 0, 0, 0);
      const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Determine urgency based on days until start
      let urgencyLevel: 'low' | 'medium' | 'high';
      if (daysUntilStart <= 3) {
        urgencyLevel = 'high';
      } else if (daysUntilStart <= 7) {
        urgencyLevel = 'medium';
      } else {
        urgencyLevel = 'low';
      }

      return {
        ...request,
        urgency_level: urgencyLevel,
        days_until_start: daysUntilStart
      };
    });
  }

  /**
   * Approve or reject a leave request
   */
  async processLeaveRequest(approval: LeaveApprovalAction): Promise<LeaveRequest> {
    const endpoint = approval.action === 'approve'
      ? `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}${approval.request_id}/approve/`
      : `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}${approval.request_id}/reject/`;

    const response = await api.post<LeaveRequest>(
      endpoint,
      { notes: approval.comments || '' }
    );
    return response.data;
  }

  /**
   * Bulk approve/reject multiple leave requests
   */
  async bulkProcessLeaveRequests(bulkApproval: BulkApprovalRequest): Promise<LeaveRequest[]> {
    // Process each request individually since backend doesn't have bulk endpoint
    const results = await Promise.all(
      bulkApproval.request_ids.map(requestId =>
        this.processLeaveRequest({
          request_id: requestId,
          action: bulkApproval.action,
          comments: bulkApproval.comments
        })
      )
    );
    return results;
  }

  // ============ Calendar and Statistics ============
  /**
   * Get leave calendar events for display
   */
  async getLeaveCalendar(
    startDate: string,
    endDate: string,
    userId?: number
  ): Promise<LeaveCalendarEvent[]> {
    const params: Record<string, any> = {
      start_date: startDate,
      end_date: endDate
    };

    if (userId) params.user_id = userId;

    const response = await api.get<LeaveCalendarEvent[]>(
      LEAVE_ENDPOINTS.LEAVE_CALENDAR,
      { params }
    );
    return response.data;
  }

  /**
   * Get leave calendar events with filtering support
   */
  async getLeaveCalendarEvents(
    filters?: LeaveRequestFilterOptions
  ): Promise<LeaveCalendarEvent[]> {
    const params: Record<string, any> = {};

    if (filters) {
      if (filters.status) params.status = filters.status.join(',');
      if (filters.leave_type) params.leave_type = filters.leave_type.join(',');
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.user) params.user = filters.user.join(',');
      if (filters.department) params.department = filters.department.join(',');
    }

    const response = await api.get<LeaveCalendarEvent[]>(
      `${LEAVE_ENDPOINTS.LEAVE_CALENDAR}/events`,
      { params }
    );
    return response.data;
  }

  /**
   * Get leave statistics for reporting (managers/admins)
   */
  async getLeaveStatistics(
    year?: number,
    departmentId?: number
  ): Promise<LeaveStatistics> {
    const params: Record<string, any> = {};
    if (year) params.year = year;
    if (departmentId) params.department_id = departmentId;

    const response = await api.get<LeaveStatistics>(
      LEAVE_ENDPOINTS.LEAVE_STATISTICS,
      { params }
    );
    return response.data;
  }

  // ============ Validation Helpers ============
  // NOTE: These endpoints are not yet implemented in the backend
  // Validation is done server-side during request submission

  /**
   * Check if a leave request would be valid without creating it
   * TODO: Implement backend endpoint for this feature
   */
  // async validateLeaveRequest(requestData: LeaveRequestFormData): Promise<{
  //   is_valid: boolean;
  //   errors: string[];
  //   warnings: string[];
  //   balance_after: string;
  // }> {
  //   const response = await api.post(
  //     `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}/validate/`,
  //     requestData
  //   );
  //   return response.data;
  // }

  /**
   * Calculate working days between two dates
   * TODO: Implement backend endpoint for this feature
   * Currently calculated client-side in LeaveRequestForm
   */
  // async calculateWorkingDays(startDate: string, endDate: string): Promise<{
  //   working_days: number;
  //   weekends: number;
  //   holidays: number;
  //   total_days: number;
  // }> {
  //   const response = await api.post('/leave/calculate-days/', {
  //     start_date: startDate,
  //     end_date: endDate
  //   });
  //   return response.data;
  // }

  // ============ File Downloads ============
  /**
   * Export leave requests to CSV/Excel
   */
  async exportLeaveRequests(
    format: 'csv' | 'xlsx',
    filters?: LeaveRequestFilterOptions
  ): Promise<Blob> {
    const params: Record<string, any> = { format };

    if (filters) {
      if (filters.status) params.status = filters.status.join(',');
      if (filters.leave_type) params.leave_type = filters.leave_type.join(',');
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.user) params.user = filters.user.join(',');
    }

    const response = await api.get(
      `${LEAVE_ENDPOINTS.LEAVE_REQUESTS}/export`,
      {
        params,
        responseType: 'blob'
      }
    );
    return response.data;
  }

  /**
   * Download supporting document
   */
  async downloadSupportingDocument(requestId: number, documentId: number): Promise<Blob> {
    const response = await api.get(
      `/api/v1/leave/requests/${requestId}/documents/${documentId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  // ============ Team Overview Methods ============
  /**
   * Get comprehensive team overview data for managers
   */
  async getTeamOverview(): Promise<TeamOverviewData> {
    const response = await api.get<TeamOverviewData>(LEAVE_ENDPOINTS.TEAM_OVERVIEW);
    return response.data;
  }

  /**
   * Get team member leave balances
   */
  async getTeamBalances(): Promise<LeaveBalance[]> {
    const response = await api.get<LeaveBalance[]>(LEAVE_ENDPOINTS.TEAM_BALANCES);
    return response.data;
  }

  /**
   * Get team calendar events for a specific date range
   */
  async getTeamCalendar(startDate: string, endDate: string): Promise<LeaveCalendarEvent[]> {
    const response = await api.get<LeaveCalendarEvent[]>(LEAVE_ENDPOINTS.TEAM_CALENDAR, {
      params: {
        start_date: startDate,
        end_date: endDate
      }
    });
    return response.data;
  }

  /**
   * Approve a leave request (manager action)
   */
  async approveLeaveRequest(id: number, comments?: string): Promise<LeaveRequest> {
    return this.processLeaveRequest({
      request_id: id,
      action: 'approve',
      comments
    });
  }

  /**
   * Reject a leave request (manager action)
   */
  async rejectLeaveRequest(id: number, reason: string): Promise<LeaveRequest> {
    return this.processLeaveRequest({
      request_id: id,
      action: 'reject',
      comments: reason
    });
  }

  // ============ Leave Policies Methods ============
  /**
   * Create a new leave policy (admin only)
   */
  async createLeavePolicy(policy: CreateLeavePolicyRequest): Promise<LeavePolicy> {
    const response = await api.post<LeavePolicy>(LEAVE_ENDPOINTS.LEAVE_POLICIES, policy);
    return response.data;
  }

  /**
   * Update an existing leave policy (admin only)
   */
  async updateLeavePolicy(id: number, policy: UpdateLeavePolicyRequest): Promise<LeavePolicy> {
    const response = await api.patch<LeavePolicy>(`${LEAVE_ENDPOINTS.LEAVE_POLICIES}/${id}`, policy);
    return response.data;
  }

  /**
   * Activate a leave policy (admin only)
   */
  async activateLeavePolicy(id: number): Promise<LeavePolicy> {
    const response = await api.post<LeavePolicy>(`${LEAVE_ENDPOINTS.LEAVE_POLICIES}/${id}/activate`);
    return response.data;
  }

  /**
   * Deactivate a leave policy (admin only)
   */
  async deactivateLeavePolicy(id: number): Promise<LeavePolicy> {
    const response = await api.post<LeavePolicy>(`${LEAVE_ENDPOINTS.LEAVE_POLICIES}/${id}/deactivate`);
    return response.data;
  }

  /**
   * Delete a leave policy (admin only)
   */
  async deleteLeavePolicy(id: number): Promise<void> {
    await api.delete(`${LEAVE_ENDPOINTS.LEAVE_POLICIES}/${id}`);
  }

  // Reports & analytics for leave removed

  // ============ Leave Settings Methods ============
  /**
   * Get current leave system settings (admin only)
   */
  async getLeaveSettings(): Promise<LeaveSettings> {
    const response = await api.get<LeaveSettings>(LEAVE_ENDPOINTS.LEAVE_SETTINGS);
    return response.data;
  }

  /**
   * Update leave system settings (admin only)
   */
  async updateLeaveSettings(settings: LeaveSettingsUpdate): Promise<LeaveSettings> {
    const response = await api.patch<LeaveSettings>(LEAVE_ENDPOINTS.LEAVE_SETTINGS, settings);
    return response.data;
  }

  /**
   * Get all blackout periods
   */
  async getBlackoutPeriods(): Promise<BlackoutPeriod[]> {
    const response = await api.get<{ results: BlackoutPeriod[] }>(LEAVE_ENDPOINTS.BLACKOUT_PERIODS);
    return response.data.results || [];
  }

  /**
   * Create a new blackout period (admin only)
   */
  async createBlackoutPeriod(period: CreateBlackoutPeriodRequest): Promise<BlackoutPeriod> {
    const response = await api.post<BlackoutPeriod>(LEAVE_ENDPOINTS.BLACKOUT_PERIODS, period);
    return response.data;
  }

  /**
   * Update a blackout period (admin only)
   */
  async updateBlackoutPeriod(id: number, period: Partial<CreateBlackoutPeriodRequest>): Promise<BlackoutPeriod> {
    const response = await api.patch<BlackoutPeriod>(`${LEAVE_ENDPOINTS.BLACKOUT_PERIODS}/${id}`, period);
    return response.data;
  }

  /**
   * Delete a blackout period (admin only)
   */
  async deleteBlackoutPeriod(id: number): Promise<void> {
    await api.delete(`${LEAVE_ENDPOINTS.BLACKOUT_PERIODS}/${id}`);
  }

  // ============ Advanced Analytics Methods ============
  /**
   * Get leave capacity analysis for team planning
   */
  async getLeaveCapacityAnalysis(startDate: string, endDate: string): Promise<{
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    criticalPeriods: Array<{
      date: string;
      capacity: number;
      used: number;
      percentage: number;
    }>;
    recommendations: string[];
  }> {
    const response = await api.get(`${LEAVE_ENDPOINTS.LEAVE_ANALYTICS}/capacity`, {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  /**
   * Get leave trends analysis
   */
  async getLeaveTrends(period: 'monthly' | 'quarterly' | 'yearly' = 'monthly'): Promise<{
    trends: Array<{
      period: string;
      requests: number;
      days: number;
      approvalRate: number;
    }>;
    predictions: Array<{
      period: string;
      predictedRequests: number;
      predictedDays: number;
    }>;
  }> {
    const response = await api.get(`${LEAVE_ENDPOINTS.LEAVE_ANALYTICS}/trends`, {
      params: { period }
    });
    return response.data;
  }
}

// Create and export a singleton instance
const leaveService = new LeaveService();
export default leaveService;

// Also export the class for testing purposes
export { LeaveService };