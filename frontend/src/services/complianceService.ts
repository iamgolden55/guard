// Compliance Service
// API client for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import { api } from './index';
import type {
  ApiResponse,
  PaginatedResponse,
  ComplianceProfile,
  ComplianceViolation,
  ComplianceMetrics,
  ComplianceReportSummary,
  WorkingHoursRegulation,
  ComplianceCheckRequest,
  ComplianceCheckResponse,
  ViolationResolution,
  BulkResolution,
  BulkResolutionResult,
  ComplianceSettings,
  ViolationFilters,
  MetricsParams,
  ComplianceDashboardMetrics,
  LiveComplianceStatus,
  RegionalPreset,
  RegionDetection,
  RegionComparison,
  RegionalSettings,
  ScheduleValidation
} from '../types/compliance';

// Pull a human-readable error out of a DRF response. DRF returns either:
//   { detail: "..." } | { message: "..." } | { fieldA: ["err1"], fieldB: [...] } | "..."
// We surface field errors as "field: message" lines so the user knows which
// input was rejected — otherwise validation failures look like generic errors.
function describeError(error: any, fallback: string): string {
  const data = error?.response?.data;
  if (data == null) return fallback;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
    if (typeof data.error === "string") return data.error;
    const lines = Object.entries(data)
      .filter(([, v]) => Array.isArray(v) || typeof v === "string")
      .map(([field, v]) => {
        const text = Array.isArray(v) ? (v as unknown[]).join(", ") : String(v);
        return `${field}: ${text}`;
      });
    if (lines.length > 0) return lines.join("\n");
  }
  return fallback;
}

export class ComplianceService {
  private static baseURL = '/api/v1/compliance';

  // Compliance Profiles
  static async getActiveProfile(): Promise<ApiResponse<ComplianceProfile>> {
    try {
      const response = await api.get(`${this.baseURL}/profiles/active/`);
      return {
        status: 'success',
        data: response.data,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch active compliance profile');
    }
  }

  static async getAllProfiles(): Promise<PaginatedResponse<ComplianceProfile>> {
    try {
      const response = await api.get(`${this.baseURL}/profiles/`);
      return {
        status: 'success',
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch compliance profiles');
    }
  }

  static async createProfile(profile: Partial<ComplianceProfile>): Promise<ApiResponse<ComplianceProfile>> {
    try {
      const response = await api.post(`${this.baseURL}/profiles/`, profile);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(describeError(error, 'Failed to create compliance profile'));
    }
  }

  static async updateProfile(id: number, profile: Partial<ComplianceProfile>): Promise<ApiResponse<ComplianceProfile>> {
    try {
      const response = await api.put(`${this.baseURL}/profiles/${id}/`, profile);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(describeError(error, 'Failed to update compliance profile'));
    }
  }

  static async setActiveProfile(id: number): Promise<ApiResponse<void>> {
    try {
      await api.post(`${this.baseURL}/profiles/${id}/set_active/`);
      return {
        status: 'success',
        data: undefined
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to set active profile');
    }
  }

  // Working Hours Regulations
  static async getRegulations(countryCode?: string): Promise<PaginatedResponse<WorkingHoursRegulation>> {
    try {
      const params = countryCode ? { country_code: countryCode } : {};
      const response = await api.get(`${this.baseURL}/regulations/`, { params });
      return {
        status: 'success',
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch working hours regulations');
    }
  }

  static async getCountries(): Promise<ApiResponse<Array<{country_code: string, country_name: string, is_active: boolean}>>> {
    try {
      const response = await api.get(`${this.baseURL}/regulations/countries/`);
      return {
        status: 'success',
        data: response.data,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch countries');
    }
  }

  // Dashboard Metrics
  static async getDashboardMetrics(params: MetricsParams = {}): Promise<ApiResponse<ComplianceDashboardMetrics>> {
    try {
      // Backend endpoint is /compliance/reports/summary/ not /dashboard/metrics/
      const response = await api.get(`${this.baseURL}/reports/summary/`, { params });
      return {
        status: 'success',
        data: response.data.data || response.data, // Handle nested data structure
        cached: response.headers['x-cache-status'] === 'hit' || response.data.cached
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch dashboard metrics');
    }
  }

  // Violations Management
  static async getViolations(filters: ViolationFilters = {}): Promise<PaginatedResponse<ComplianceViolation>> {
    try {
      const response = await api.get(`${this.baseURL}/violations/`, { params: filters });
      return {
        status: 'success',
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch violations');
    }
  }

  static async getViolationById(id: number): Promise<ApiResponse<ComplianceViolation>> {
    try {
      const response = await api.get(`${this.baseURL}/violations/${id}/`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch violation details');
    }
  }

  static async getViolationSummary(): Promise<ApiResponse<{
    total_violations: number;
    open_violations: number;
    critical_violations: number;
    major_violations: number;
    minor_violations: number;
    warning_violations: number;
    resolved_violations: number;
    overtime_violations: number;
    rest_violations: number;
    location_violations: number;
    avg_resolution_days: number;
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/violations/summary/`);
      return {
        status: 'success',
        data: response.data,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch violation summary');
    }
  }

  static async getPendingViolations(): Promise<PaginatedResponse<ComplianceViolation>> {
    try {
      const response = await api.get(`${this.baseURL}/violations/pending/`);
      return {
        status: 'success',
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch pending violations');
    }
  }

  static async resolveViolation(id: number, resolution: ViolationResolution): Promise<ApiResponse<{
    violation_id: number;
    resolved_at: string;
  }>> {
    try {
      const response = await api.post(`${this.baseURL}/violations/${id}/resolve/`, resolution);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to resolve violation');
    }
  }

  static async bulkResolveViolations(violationIds: number[], resolution: ViolationResolution): Promise<ApiResponse<BulkResolutionResult>> {
    try {
      const response = await api.post(`${this.baseURL}/violations/bulk_resolve/`, {
        violation_ids: violationIds,
        ...resolution
      });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to bulk resolve violations');
    }
  }

  // Reports & Analytics
  static async getReportSummary(days = 7): Promise<ApiResponse<ComplianceReportSummary>> {
    try {
      const response = await api.get(`${this.baseURL}/reports/summary/`, {
        params: { days }
      });
      return {
        status: 'success',
        data: response.data,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch report summary');
    }
  }

  static async getTrends(days = 30, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<ApiResponse<{
    trend_data: Array<{
      period: string;
      violation_count: number;
      critical_count: number;
      major_count: number;
      minor_count: number;
    }>;
    summary: {
      total_violations: number;
      avg_daily_violations: number;
      trend_direction: string;
    };
    parameters: {
      days: number;
      group_by: string;
    };
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/reports/trends/`, {
        params: { days, group_by: groupBy }
      });
      return {
        status: 'success',
        data: response.data,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch trends data');
    }
  }

  static async getWorkingHoursReport(userId?: number, periodType?: 'weekly' | 'monthly' | 'quarterly'): Promise<ApiResponse<any>> {
    try {
      const params: any = {};
      if (userId) params.user_id = userId;
      if (periodType) params.period_type = periodType;

      const response = await api.get(`${this.baseURL}/reports/working_hours/`, { params });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch working hours report');
    }
  }

  // Metrics
  static async getMetrics(filters: MetricsParams = {}): Promise<PaginatedResponse<ComplianceMetrics>> {
    try {
      const response = await api.get(`${this.baseURL}/metrics/`, { params: filters });
      return {
        status: 'success',
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results,
        cached: response.headers['x-cache-status'] === 'hit'
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch compliance metrics');
    }
  }

  static async recalculateMetrics(userId?: number, periodType?: string): Promise<ApiResponse<void>> {
    try {
      const data: any = {};
      if (userId) data.user_id = userId;
      if (periodType) data.period_type = periodType;

      await api.post(`${this.baseURL}/metrics/recalculate/`, data);
      return {
        status: 'success',
        data: undefined
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to recalculate metrics');
    }
  }

  // Real-time Compliance
  static async checkCompliance(request: ComplianceCheckRequest): Promise<ApiResponse<ComplianceCheckResponse>> {
    try {
      const response = await api.post(`${this.baseURL}/check/`, request);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to perform compliance check');
    }
  }

  static async getAlerts(): Promise<ApiResponse<Array<{
    type: string;
    message: string;
    count: number;
    priority: 'high' | 'medium' | 'low';
  }>>> {
    try {
      const response = await api.get(`${this.baseURL}/alerts/`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch alerts');
    }
  }

  static async getLiveStatus(venueIds?: number[]): Promise<ApiResponse<LiveComplianceStatus[]>> {
    try {
      const params = venueIds ? { venue_ids: venueIds.join(',') } : {};
      const response = await api.get(`${this.baseURL}/live-status/`, { params });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch live status');
    }
  }

  // Settings Management
  static async getSettings(venueId?: number, staffId?: number): Promise<ApiResponse<ComplianceSettings>> {
    try {
      const params: any = {};
      if (venueId) params.venue_id = venueId;
      if (staffId) params.staff_id = staffId;

      const response = await api.get(`${this.baseURL}/settings/`, { params });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch compliance settings');
    }
  }

  static async updateSettings(settings: Partial<ComplianceSettings>): Promise<ApiResponse<ComplianceSettings>> {
    try {
      const response = await api.put(`${this.baseURL}/settings/${settings.id}/`, settings);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update compliance settings');
    }
  }

  static async createSettings(settings: Omit<ComplianceSettings, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<ComplianceSettings>> {
    try {
      const response = await api.post(`${this.baseURL}/settings/`, settings);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to create compliance settings');
    }
  }

  // Export Functions
  static async exportViolations(filters: ViolationFilters, format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseURL}/violations/export/`, {
        params: { ...filters, format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to export violations');
    }
  }

  static async exportMetrics(filters: MetricsParams, format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseURL}/metrics/export/`, {
        params: { ...filters, format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to export metrics');
    }
  }

  // Regional Compliance Features
  static async detectRegion(): Promise<ApiResponse<{
    country_code: string;
    country_name: string;
    detected_by: string;
    confidence: number;
    suggested_regulation: number;
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/regional/detect-region/`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to detect region');
    }
  }

  static async applyRegionalPreset(profileId: number, regionCode: string): Promise<ApiResponse<ComplianceProfile>> {
    try {
      const response = await api.post(`${this.baseURL}/regional/profiles/apply-preset/`, {
        profile_id: profileId,
        region_code: regionCode
      });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to apply regional preset');
    }
  }

  static async compareRegions(regions: string[]): Promise<ApiResponse<Array<{
    country_code: string;
    country_name: string;
    regulations: WorkingHoursRegulation;
    key_differences: string[];
    compliance_complexity: 'low' | 'medium' | 'high';
  }>>> {
    try {
      const response = await api.get(`${this.baseURL}/regional/compare/`, {
        params: { regions: regions.join(',') }
      });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to compare regions');
    }
  }

  static async validateScheduleAgainstRegion(scheduleData: {
    user_id: number;
    shifts: Array<{
      start_time: string;
      end_time: string;
      venue_id?: number;
    }>;
    region_code?: string;
  }): Promise<ApiResponse<{
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
  }>> {
    try {
      const response = await api.post(`${this.baseURL}/regional/validate-schedule/`, scheduleData);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to validate schedule against region');
    }
  }

  static async getRegionalSettings(): Promise<ApiResponse<{
    current_region: string;
    available_regions: Array<{
      code: string;
      name: string;
      is_active: boolean;
      regulation_id: number;
    }>;
    auto_detect_enabled: boolean;
    preset_preferences: Record<string, any>;
  }>> {
    try {
      const response = await api.get(`${this.baseURL}/regional/regional-settings/`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch regional settings');
    }
  }

  static async updateRegionalSettings(settings: {
    current_region?: string;
    auto_detect_enabled?: boolean;
    preset_preferences?: Record<string, any>;
  }): Promise<ApiResponse<void>> {
    try {
      await api.post(`${this.baseURL}/regional/regional-settings/`, settings);
      return {
        status: 'success',
        data: undefined
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update regional settings');
    }
  }

  static async getRegionalPresets(): Promise<ApiResponse<Array<{
    region_code: string;
    region_name: string;
    preset_type: 'uk_sia' | 'us_flsa' | 'eu_wtd';
    description: string;
    regulations: Partial<WorkingHoursRegulation>;
    profile_defaults: Partial<ComplianceProfile>;
  }>>> {
    try {
      const response = await api.get(`${this.baseURL}/regional/presets/`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch regional presets');
    }
  }

  // Utility Methods
  static async validateComplianceRule(rule: any): Promise<ApiResponse<{ valid: boolean; errors?: string[] }>> {
    try {
      const response = await api.post(`${this.baseURL}/validate-rule/`, rule);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to validate compliance rule');
    }
  }

  static async getComplianceHistory(userId: number, days = 30): Promise<ApiResponse<Array<{
    date: string;
    compliance_score: number;
    violations: number;
    hours_worked: number;
  }>>> {
    try {
      const response = await api.get(`${this.baseURL}/history/${userId}/`, {
        params: { days }
      });
      return {
        status: 'success',
        data: response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch compliance history');
    }
  }
}

// Default export for consistency with other services
export default ComplianceService;