/**
 * Leave Management Types
 * TypeScript interfaces for leave-related data structures
 */

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  description: string;
  color_code: string;
  icon: string;
  requires_documentation: boolean;
  is_paid: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeavePolicy {
  id: number;
  name: string;
  leave_type: number | LeaveType;
  accrual_rate: number;
  accrual_unit: 'MONTHLY' | 'YEARLY' | 'PER_SHIFT';
  max_carryover: number | null;
  carryover_expiry_months: number | null;
  min_notice_days: number;
  max_consecutive_days: number | null;
  is_active: boolean;
}

export interface LeaveBalance {
  id: number;
  staff_user: number;
  leave_type: LeaveType;
  year: number;
  total_entitlement: number;
  accrued_amount: number;
  used_balance: number;
  pending_balance: number;
  available_balance: number;
  carried_over_amount: number;
  last_accrual_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: number;
  staff_user: number;
  staff_user_details?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveRequestStatus;
  supporting_document: string | null;
  approved_by: number | null;
  approved_by_details?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  approved_at: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status?: 'synced' | 'pending' | 'failed';
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';

export interface LeaveRequestFormData {
  leave_type_id: number;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  supporting_document?: string | null;
}

export interface LeaveCalendarEvent {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  staff_user: {
    id: number;
    first_name: string;
    last_name: string;
  };
  status: LeaveRequestStatus;
  total_days: number;
}

export interface LeaveRequestFilterOptions {
  status?: LeaveRequestStatus | 'ALL';
  year?: number;
  leave_type_id?: number;
  page?: number;
  page_size?: number;
}

export interface LeavePaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LeaveStatistics {
  total_leave_days: number;
  used_leave_days: number;
  pending_leave_days: number;
  available_leave_days: number;
  requests_by_status: {
    pending: number;
    approved: number;
    denied: number;
    cancelled: number;
  };
  upcoming_leaves: LeaveRequest[];
}

export interface LeaveError {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, any>;
}

export interface LeaveValidationError {
  field: string;
  message: string;
}

// Leave Status Information
export interface LeaveStatusInfo {
  status: LeaveRequestStatus;
  color: string;
  bgColor: string;
  icon: string;
  text: string;
}

// Date Utilities for Leave Calculations
export interface LeaveDateRange {
  start_date: string;
  end_date: string;
  total_days: number;
  working_days: number;
  weekend_days: number;
}

// Offline Queue Support
export interface QueuedLeaveRequest {
  id: string;
  type: 'CREATE_LEAVE_REQUEST' | 'CANCEL_LEAVE_REQUEST';
  data: LeaveRequestFormData | { requestId: number };
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
}
