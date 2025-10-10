// Leave Management Type Definitions
// Based on the backend Django models in leave_management/models.py

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
  is_manager: boolean;
  date_joined: string;
}

export interface StaffProfile {
  id: number;
  user: User;
  employment_type?: EmploymentType;
}

export interface EmploymentType {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

// Leave Type Interface
export interface LeaveType {
  id: number;
  name: string;
  code: string;
  description: string;
  color_code: string;
  is_active: boolean;
  requires_approval: boolean;
  min_notice_days: number;
  max_consecutive_days?: number;
  employment_types: EmploymentType[];
  created_at: string;
  updated_at: string;
}

// Leave Policy Interface
export interface LeavePolicy {
  id: number;
  name: string;
  leave_type: LeaveType;
  employment_types: EmploymentType[];

  // Accrual Settings
  accrual_method: 'monthly' | 'annual' | 'per_shift' | 'length_of_service' | 'none';
  accrual_rate: string; // Decimal field as string
  max_accrual_per_year?: string;
  max_balance?: string;
  service_brackets: Array<{
    months: number;
    rate: number;
  }>;

  // Carryover Settings
  carryover_method: 'none' | 'full' | 'partial' | 'use_or_lose';
  carryover_limit?: string;
  carryover_expiry_months: number;

  // Eligibility
  probation_months: number;
  min_employment_days: number;

  // Advanced Settings
  allow_negative_balance: boolean;
  negative_balance_limit: string;

  // Status
  is_active: boolean;
  effective_date: string;
  expiry_date?: string;
  created_at: string;
  updated_at: string;
}

// Leave Entitlement Interface
export interface LeaveEntitlement {
  id: number;
  user: User;
  policy: LeavePolicy;
  year: number;

  // Entitlement amounts (in days)
  annual_entitlement: string; // Decimal as string
  carried_over: string;
  accrued_to_date: string;
  used_to_date: string;

  // Calculated properties
  current_balance: string;
  total_entitlement: string;

  // Tracking
  last_accrual_date?: string;
  carryover_expiry_date?: string;
  created_at: string;
  updated_at: string;
}

// Leave Request Status Enum
export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  WITHDRAWN = 'WITHDRAWN'
}

// Leave Request Interface (extending from backend model)
export interface LeaveRequest {
  id: number;
  user: User;
  leave_type: LeaveType;

  // Request details
  start_date: string;
  end_date: string;
  days_requested: string; // Decimal as string
  reason: string;
  supporting_documents?: Array<{
    id: number;
    file: string;
    name: string;
    uploaded_at: string;
  }>;

  // Status tracking
  status: LeaveRequestStatus;
  manager_comments?: string;
  reviewed_by?: User;
  reviewed_at?: string;

  // Validation
  overlapping_requests?: LeaveRequest[];
  balance_after_request: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Leave Balance Summary Interface
export interface LeaveBalanceSummary {
  leave_type: LeaveType;
  entitlement: LeaveEntitlement;
  pending_requests: LeaveRequest[];
  upcoming_leave: LeaveRequest[];

  // Calculated values
  available_balance: string;
  pending_balance: string;
  projected_balance: string;
}

// Leave Calendar Event Interface
export interface LeaveCalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  color: string;
  leave_request: LeaveRequest;
  user_display_name: string;
}

// Form Data Interfaces
export interface LeaveRequestFormData {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  supporting_documents?: File[];
}

export interface LeaveRequestFilterOptions {
  status?: LeaveRequestStatus[];
  leave_type?: number[];
  start_date?: string;
  end_date?: string;
  user?: number[];
  department?: string[];
}

// API Response Interfaces
export interface LeaveRequestResponse {
  count: number;
  next?: string;
  previous?: string;
  results: LeaveRequest[];
}

export interface LeaveEntitlementResponse {
  count: number;
  next?: string;
  previous?: string;
  results: LeaveEntitlement[];
}

export interface LeaveBalanceResponse {
  user: User;
  balances: LeaveBalanceSummary[];
  total_days_available: string;
  total_days_used: string;
  total_days_pending: string;
}

// Manager Dashboard Interfaces
export interface PendingLeaveRequest {
  id: number;
  user: User;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_requested: string;
  reason: string;
  created_at: string;
  urgency_level: 'low' | 'medium' | 'high';
  days_until_start: number;
}

export interface LeaveApprovalAction {
  request_id: number;
  action: 'approve' | 'reject';
  comments?: string;
}

export interface BulkApprovalRequest {
  request_ids: number[];
  action: 'approve' | 'reject';
  comments?: string;
}

// Leave Statistics Interface
export interface LeaveStatistics {
  total_requests: number;
  pending_requests: number;
  approved_requests: number;
  rejected_requests: number;
  average_days_per_request: string;
  most_popular_leave_type: LeaveType;
  busiest_leave_period: {
    month: number;
    year: number;
    request_count: number;
  };
}

// Error handling
export interface LeaveError {
  field?: string;
  message: string;
  code?: string;
}

export interface LeaveValidationError {
  non_field_errors?: string[];
  [fieldName: string]: string[] | undefined;
}

// Form validation schema types
export interface LeaveRequestFormErrors {
  leave_type_id?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  supporting_documents?: string;
}

// Re-export service-specific interfaces for convenience
export type {
  TeamOverviewData,
  TeamMember,
  LeaveBalance,
  CreateLeavePolicyRequest,
  UpdateLeavePolicyRequest,
  AnalyticsFilters,
  AnalyticsData,
  ReportFilters,
  ReportSummary,
  LeaveSettings,
  LeaveSettingsUpdate,
  BlackoutPeriod,
  CreateBlackoutPeriodRequest
} from '../services/leaveService';