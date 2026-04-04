// ─── FullCalendar Resource & Event Types ─────────────────────────────

export interface SchedulerResource {
  id: string;
  title: string;
  type: 'staff' | 'venue' | 'unassigned';
  role?: string;
  avatar?: string;
  qualifications?: Array<{ type: string; level: string }>;
  weeklyHours?: number;
  address?: string;
  capacity?: number;
}

export interface ShiftExtendedProps {
  shiftId: number;
  venueId: number;
  venueName: string;
  staffId: number | null;
  staffName: string;
  status: ShiftStatus;
  isPublished: boolean;
  hourlyRate: string | null;
  billRate: string | null;
  breakDuration: number;
  requiredRole: string;
  notes: string | null;
  shiftGroup: string | null;
}

export interface SchedulerEvent {
  id: number;
  resourceId: string;
  title: string;
  start: string;
  end: string | null;
  extendedProps: ShiftExtendedProps;
}

export interface ScheduleWarning {
  staffId?: number;
  type: 'overtime' | 'overlap' | 'short_rest' | 'unavailable' | 'missing_qualification' | 'consecutive_days';
  message: string;
  severity: 'warning' | 'error' | 'info';
}

// ─── API Response Types ──────────────────────────────────────────────

export interface ResourceTimelineResponse {
  resources: SchedulerResource[];
  events: SchedulerEvent[];
  warnings: ScheduleWarning[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ type: string; message: string }>;
  warnings: Array<{ type: string; message: string; severity: string }>;
}

export interface BulkUpdateRequest {
  updates: Array<{
    id: number;
    staff_user?: number | null;
    venue?: number;
    start_time?: string;
    end_time?: string;
  }>;
}

export interface BulkUpdateResponse {
  updated: Array<{
    id: number;
    staff_user: number | null;
    venue: number;
    start_time: string;
    end_time: string;
  }>;
  errors: Array<{
    id: number;
    errors: Array<{ type: string; message: string }>;
  }>;
}

export interface PublishRequest {
  shift_ids?: number[];
  date_range?: { start: string; end: string };
  venue_ids?: number[];
}

export interface PublishResponse {
  published: number;
  notifications_sent: number;
}

export interface ScheduleHealth {
  totalShifts: number;
  draftShifts: number;
  publishedShifts: number;
  openShifts: number;
  conflicts: number;
  overtimeWarnings: number;
  totalHours: number;
  estimatedCost: number;
}

// ─── Shift Form Schema ──────────────────────────────────────────────

export type ShiftStatus =
  | 'open'
  | 'scheduled'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'no_show';

export type GroupBy = 'staff' | 'venue';

export interface ShiftFormValues {
  venue: number;
  staff_user: number | null;
  start_time: string;
  end_time: string;
  break_duration: number;
  required_security_role: string;
  hourly_rate: string;
  bill_rate: string;
  notes: string;
  status: ShiftStatus;
}

// ─── Filter State ────────────────────────────────────────────────────

export interface SchedulerFilters {
  venueIds: number[];
  staffIds: number[];
  roles: string[];
  status: string;
  groupBy: GroupBy;
}

// ─── Shift status color mapping ─────────────────────────────────────

export const SHIFT_STATUS_COLORS: Record<ShiftStatus, { bg: string; border: string; text: string }> = {
  open: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
  scheduled: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800' },
  active: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  in_progress: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-900' },
  completed: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700' },
  pending_approval: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800' },
  approved: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' },
  rejected: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  cancelled: { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-500' },
  no_show: { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-900' },
};

export const DRAFT_OVERLAY = 'bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.03)_4px,rgba(0,0,0,0.03)_8px)]';

export const SECURITY_ROLES = [
  { value: 'ds', label: 'Door Supervisor' },
  { value: 'sg', label: 'Security Guard' },
  { value: 'cctv', label: 'CCTV Operator' },
  { value: 'cp', label: 'Close Protection' },
  { value: 'steward', label: 'Steward' },
  { value: 'k9', label: 'K9 Handler' },
  { value: 'retail', label: 'Retail Security' },
  { value: 'static', label: 'Static Guard' },
  { value: 'mobile', label: 'Mobile Patrol' },
  { value: 'event', label: 'Event Security' },
] as const;
