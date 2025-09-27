// Compliance System TypeScript Interfaces
// Generated for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

// Base API Response Types
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  message?: string;
  cached?: boolean;
}

export interface PaginatedResponse<T> {
  status: 'success' | 'error';
  count: number;
  next?: string;
  previous?: string;
  results: T[];
  cached?: boolean;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  errors?: Record<string, string[]>;
}

// Working Hours Regulation
export interface WorkingHoursRegulation {
  id: number;
  country_code: string;
  country_name: string;
  country_name_display: string;
  standard_weekly_hours: string;
  standard_daily_hours: string;
  overtime_threshold_hours: string;
  overtime_multiplier_1: string;
  overtime_threshold_2?: string;
  overtime_multiplier_2?: string;
  max_daily_hours: string;
  max_weekly_hours: string;
  max_consecutive_days: number;
  min_rest_between_shifts_hours: string;
  min_weekly_rest_hours: string;
  break_duration_minutes: number;
  break_trigger_hours: string;
  special_rules: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Compliance Profile
export interface ComplianceProfile {
  id: number;
  name: string;
  description: string;
  working_hours_regulation: number;
  working_hours_regulation_data: {
    id: number;
    country_code: string;
    country_name: string;
  };
  override_max_daily_hours?: string;
  override_max_weekly_hours?: string;
  override_max_consecutive_days?: number;
  daily_hours_warning_threshold: string;
  weekly_hours_warning_threshold: string;
  consecutive_days_warning_threshold: number;
  auto_approve_overtime: boolean;
  auto_approve_extended_hours: boolean;
  require_manager_approval: boolean;
  notify_on_warnings: boolean;
  notify_on_violations: boolean;
  notification_recipients: string[];
  grace_period_minutes: number;
  allow_break_flexibility: boolean;
  custom_rules: Record<string, any>;
  exception_roles: string[];
  is_active: boolean;
  effective_max_daily_hours: string;
  effective_max_weekly_hours: string;
  effective_max_consecutive_days: number;
  created_at: string;
  updated_at: string;
}

// Compliance Violation
export interface ComplianceViolation {
  id: number;
  user: number;
  user_data: {
    id: number;
    username: string;
    full_name: string;
    email: string;
  };
  violation_type: 'daily_overtime' | 'weekly_overtime' | 'consecutive_days' | 'insufficient_rest' | 'missing_break' | 'location_violation';
  violation_type_display: string;
  severity: 'info' | 'warning' | 'minor' | 'major' | 'critical';
  severity_display: string;
  period_start: string;
  period_end: string;
  shift?: number;
  shift_data?: {
    id: number;
    venue_name: string;
    start_time: string;
    end_time: string;
    status: string;
  };
  description: string;
  calculated_values: {
    total_hours?: number;
    limit?: number;
    exceeded_by?: number;
    [key: string]: any;
  };
  threshold_exceeded: string;
  evidence_data: Record<string, any>;
  system_generated: boolean;
  resolution_status: 'open' | 'resolved' | 'investigating' | 'dismissed';
  resolution_status_display: string;
  resolution_notes: string;
  resolved_by?: number;
  resolved_by_name: string;
  resolved_at?: string;
  exception_granted: boolean;
  exception_reason: string;
  approved_by?: number;
  approved_by_name: string;
  financial_impact?: string;
  compliance_score_impact: string;
  duration_hours: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
}

// Compliance Metrics
export interface ComplianceMetrics {
  id: number;
  user: number;
  user_data: {
    id: number;
    username: string;
    full_name: string;
  };
  period_type: 'weekly' | 'monthly' | 'quarterly';
  period_type_display: string;
  period_start: string;
  period_end: string;
  total_hours_worked: string;
  regular_hours: string;
  overtime_hours: string;
  break_hours: string;
  total_shifts: number;
  completed_shifts: number;
  cancelled_shifts: number;
  no_show_shifts: number;
  late_arrivals: number;
  early_departures: number;
  average_shift_length: string;
  longest_shift_hours: string;
  shortest_shift_hours: string;
  violation_count: number;
  warning_count: number;
  compliance_score: string;
  overtime_cost: string;
  penalty_cost: string;
  overtime_percentage: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
}

// Dashboard Metrics
export interface ComplianceDashboardMetrics {
  overall_compliance_rate: number;
  total_violations: number;
  critical_violations: number;
  resolved_violations: number;
  average_resolution_time_hours: number;
  compliance_trend: Array<{
    date: string;
    compliance_rate: number;
    violation_count: number;
  }>;
  violation_breakdown: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
}

// Report Summary
export interface ComplianceReportSummary {
  violation_summary: {
    total_violations: number;
    critical_count: number;
    major_count: number;
    minor_count: number;
    warning_count: number;
    resolution_rate: number;
  };
  working_hours_summary: {
    avg_weekly_hours: number;
    overtime_percentage: number;
    compliance_score: number;
  };
  trends: {
    violations_trend: 'increasing' | 'decreasing' | 'stable';
    compliance_score_trend: 'improving' | 'declining' | 'stable';
  };
}

// Real-time Compliance Check
export interface ComplianceCheckRequest {
  user_id: number;
  shift_start: string;
  shift_end: string;
  venue_id?: number;
}

export interface ComplianceCheckResponse {
  compliant: boolean;
  warnings: Array<{
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'major';
  }>;
  violations: Array<{
    type: string;
    message: string;
    severity: 'minor' | 'major' | 'critical';
  }>;
  recommendations: string[];
  current_week_hours: number;
  projected_week_hours: number;
  weekly_limit: number;
  consecutive_days: number;
  last_rest_period_hours: number;
}

// Real-time Status
export interface LiveComplianceStatus {
  venue_id: number;
  venue_name: string;
  active_shifts: number;
  current_violations: number;
  compliance_status: 'compliant' | 'warning' | 'violation';
  last_check: string;
  next_check: string;
}

// Violation Resolution
export interface ViolationResolution {
  resolution_notes: string;
  exception_granted: boolean;
  exception_reason?: string;
}

export interface BulkResolution extends ViolationResolution {
  violation_ids: number[];
}

export interface BulkResolutionResult {
  successful: number;
  failed: number;
  results: Array<{
    violation_id: number;
    success: boolean;
    error?: string;
  }>;
}

// Compliance Settings
export interface ComplianceSettings {
  id: number;
  venue?: number;
  staff_member?: number;
  max_daily_hours: number;
  max_weekly_hours: number;
  min_break_duration_minutes: number;
  max_consecutive_hours: number;
  min_rest_period_hours: number;
  overtime_threshold_daily: number;
  overtime_threshold_weekly: number;
  break_frequency_hours: number;
  allow_overtime: boolean;
  require_break_acknowledgment: boolean;
  auto_clock_out: boolean;
  notification_preferences: {
    email_alerts: boolean;
    sms_alerts: boolean;
    in_app_notifications: boolean;
    violation_threshold: 'immediate' | 'daily' | 'weekly';
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Form Data Types
export interface ComplianceProfileFormData {
  name: string;
  description: string;
  working_hours_regulation: number;
  override_max_daily_hours?: number;
  override_max_weekly_hours?: number;
  override_max_consecutive_days?: number;
  daily_hours_warning_threshold: number;
  weekly_hours_warning_threshold: number;
  consecutive_days_warning_threshold: number;
  auto_approve_overtime: boolean;
  auto_approve_extended_hours: boolean;
  require_manager_approval: boolean;
  notify_on_warnings: boolean;
  notify_on_violations: boolean;
  notification_recipients: string[];
  grace_period_minutes: number;
  allow_break_flexibility: boolean;
  custom_rules: Record<string, any>;
  exception_roles: string[];
}

// Filter Types
export interface ViolationFilters {
  violation_type?: string[];
  severity?: string[];
  status?: string[];
  start_date?: string;
  end_date?: string;
  user_id?: number;
  venue_id?: number;
  resolved?: boolean;
}

export interface ComplianceFilters {
  date_range?: [Date, Date];
  venue_ids?: number[];
  staff_ids?: number[];
  violation_types?: string[];
  severity_levels?: string[];
}

// Chart Data Types
export interface TrendChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension?: number;
  }>;
}

export interface ComplianceScoreData {
  user_id: number;
  username: string;
  full_name: string;
  compliance_score: number;
  total_violations: number;
  recent_trend: 'improving' | 'declining' | 'stable';
}

// WebSocket Message Types
export interface ComplianceWebSocketMessage {
  type: 'violation_created' | 'violation_resolved' | 'alert_updated' | 'compliance_score_changed' | 'status_update';
  data: any;
  timestamp: string;
}

// Alert Types
export interface ComplianceAlert {
  id: string;
  type: 'violation' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
  actions?: Array<{
    label: string;
    action: string;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
}

// Regional Compliance Types
export interface RegionalPreset {
  region_code: string;
  region_name: string;
  preset_type: 'uk_sia' | 'us_flsa' | 'eu_wtd';
  description: string;
  regulations: Partial<WorkingHoursRegulation>;
  profile_defaults: Partial<ComplianceProfile>;
}

export interface RegionDetection {
  country_code: string;
  country_name: string;
  detected_by: string;
  confidence: number;
  suggested_regulation: number;
}

export interface RegionComparison {
  country_code: string;
  country_name: string;
  regulations: WorkingHoursRegulation;
  key_differences: string[];
  compliance_complexity: 'low' | 'medium' | 'high';
}

export interface RegionalSettings {
  current_region: string;
  available_regions: Array<{
    code: string;
    name: string;
    is_active: boolean;
    regulation_id: number;
  }>;
  auto_detect_enabled: boolean;
  preset_preferences: Record<string, any>;
}

export interface ScheduleValidation {
  compliant: boolean;
  region_used: string;
  violations: Array<{
    type: string;
    message: string;
    severity: 'minor' | 'major' | 'critical';
    shift_index?: number;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    recommendation: string;
  }>;
  summary: {
    total_hours: number;
    overtime_hours: number;
    rest_violations: number;
    break_violations: number;
  };
}

// Date Range Utility Type
export type DateRange = [Date, Date] | null;

// Component Props Types
export interface ComplianceDashboardProps {
  userId?: number;
  venueId?: number;
  timeRange?: DateRange;
  autoRefresh?: boolean;
}

export interface RealTimeMonitorProps {
  venues?: number[];
  alertThreshold?: number;
  onViolationDetected?: (violation: ComplianceViolation) => void;
}

export interface ViolationsListProps {
  filters?: ViolationFilters;
  onViolationSelect?: (violation: ComplianceViolation) => void;
  allowResolution?: boolean;
  showBulkActions?: boolean;
}

export interface ComplianceSettingsProps {
  initialSettings?: ComplianceSettings;
  onSettingsChange?: (settings: ComplianceSettings) => void;
  readOnly?: boolean;
}

// Hook Parameters Types
export interface ComplianceDataParams {
  venueId?: number;
  userId?: number;
  timeRange?: DateRange;
  autoRefresh?: boolean;
}

export interface MetricsParams {
  venue_id?: number;
  user_id?: number;
  period_type?: string;
  start_date?: string;
  end_date?: string;
}

// Status and State Types
export type ComplianceStatus = 'compliant' | 'warning' | 'violation' | 'critical';
export type ViolationSeverity = 'info' | 'warning' | 'minor' | 'major' | 'critical';
export type ResolutionStatus = 'open' | 'resolved' | 'investigating' | 'dismissed';

// Colors and Styling
export interface ComplianceColorConfig {
  primary: string;
  background: string;
  border: string;
}

export const complianceColors: Record<ComplianceStatus, ComplianceColorConfig> = {
  compliant: {
    primary: '#10B981', // Green-500
    background: '#D1FAE5', // Green-100
    border: '#86EFAC' // Green-300
  },
  warning: {
    primary: '#F59E0B', // Amber-500
    background: '#FEF3C7', // Amber-100
    border: '#FCD34D' // Amber-300
  },
  violation: {
    primary: '#EF4444', // Red-500
    background: '#FEE2E2', // Red-100
    border: '#FCA5A5' // Red-300
  },
  critical: {
    primary: '#DC2626', // Red-600
    background: '#FECACA', // Red-200
    border: '#F87171' // Red-400
  }
};

export const severityColors: Record<ViolationSeverity, ComplianceColorConfig> = {
  info: complianceColors.compliant,
  warning: complianceColors.warning,
  minor: complianceColors.warning,
  major: complianceColors.violation,
  critical: complianceColors.critical
};