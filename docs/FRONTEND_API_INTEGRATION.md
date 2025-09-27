# Frontend API Integration Guide
## Legal Compliance Reporting System

This guide provides comprehensive documentation for frontend developers to integrate with the Legal Compliance Reporting System APIs. It includes practical examples, TypeScript interfaces, and best practices for React applications.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication Setup](#authentication-setup)
3. [API Client Configuration](#api-client-configuration)
4. [TypeScript Interfaces](#typescript-interfaces)
5. [React Component Examples](#react-component-examples)
6. [Error Handling](#error-handling)
7. [Real-time Features](#real-time-features)
8. [Performance Optimization](#performance-optimization)
9. [Testing Guidelines](#testing-guidelines)

---

## Quick Start

### Installation

```bash
npm install axios react-query @types/axios
# or
yarn add axios react-query @types/axios
```

### Basic Setup

```typescript
// src/services/complianceApi.ts
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export const complianceApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
complianceApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## Authentication Setup

### JWT Token Management

```typescript
// src/services/authService.ts
interface AuthTokens {
  access: string;
  refresh: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

export class AuthService {
  private static instance: AuthService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async login(credentials: LoginCredentials): Promise<boolean> {
    try {
      const response = await complianceApi.post('/token/', credentials);
      const tokens: AuthTokens = response.data;

      this.setTokens(tokens);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  private setTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.access;
    this.refreshToken = tokens.refresh;
    localStorage.setItem('accessToken', tokens.access);
    localStorage.setItem('refreshToken', tokens.refresh);
  }

  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await complianceApi.post('/token/refresh/', {
        refresh: refreshToken
      });

      this.accessToken = response.data.access;
      localStorage.setItem('accessToken', response.data.access);
      return true;
    } catch (error) {
      this.logout();
      return false;
    }
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  }
}

// Setup automatic token refresh
complianceApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const authService = AuthService.getInstance();
      const refreshed = await authService.refreshAccessToken();

      if (refreshed) {
        const token = localStorage.getItem('accessToken');
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return complianceApi(originalRequest);
      } else {
        authService.logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);
```

---

## API Client Configuration

### Compliance API Client

```typescript
// src/services/complianceClient.ts
import { complianceApi } from './complianceApi';
import type {
  ComplianceProfile,
  ComplianceViolation,
  ComplianceMetrics,
  ComplianceReportSummary,
  WorkingHoursRegulation,
  ComplianceCheckRequest,
  ComplianceCheckResponse,
  ViolationResolution,
  ApiResponse,
  PaginatedResponse
} from '../types/compliance';

export class ComplianceClient {
  // Compliance Profiles
  static async getActiveProfile(): Promise<ApiResponse<ComplianceProfile>> {
    const response = await complianceApi.get('/compliance/profiles/active/');
    return response.data;
  }

  static async getAllProfiles(): Promise<PaginatedResponse<ComplianceProfile>> {
    const response = await complianceApi.get('/compliance/profiles/');
    return response.data;
  }

  static async createProfile(profile: Partial<ComplianceProfile>): Promise<ApiResponse<ComplianceProfile>> {
    const response = await complianceApi.post('/compliance/profiles/', profile);
    return response.data;
  }

  static async updateProfile(id: number, profile: Partial<ComplianceProfile>): Promise<ApiResponse<ComplianceProfile>> {
    const response = await complianceApi.put(`/compliance/profiles/${id}/`, profile);
    return response.data;
  }

  static async setActiveProfile(id: number): Promise<ApiResponse<void>> {
    const response = await complianceApi.post(`/compliance/profiles/${id}/set_active/`);
    return response.data;
  }

  // Working Hours Regulations
  static async getRegulations(countryCode?: string): Promise<PaginatedResponse<WorkingHoursRegulation>> {
    const params = countryCode ? { country_code: countryCode } : {};
    const response = await complianceApi.get('/compliance/regulations/', { params });
    return response.data;
  }

  static async getCountries(): Promise<ApiResponse<Array<{country_code: string, country_name: string, is_active: boolean}>>> {
    const response = await complianceApi.get('/compliance/regulations/countries/');
    return response.data;
  }

  // Violations Management
  static async getViolations(filters?: {
    violation_type?: string;
    severity?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    user_id?: number;
  }): Promise<PaginatedResponse<ComplianceViolation>> {
    const response = await complianceApi.get('/compliance/violations/', { params: filters });
    return response.data;
  }

  static async getViolationById(id: number): Promise<ApiResponse<ComplianceViolation>> {
    const response = await complianceApi.get(`/compliance/violations/${id}/`);
    return response.data;
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
    const response = await complianceApi.get('/compliance/violations/summary/');
    return response.data;
  }

  static async getPendingViolations(): Promise<PaginatedResponse<ComplianceViolation>> {
    const response = await complianceApi.get('/compliance/violations/pending/');
    return response.data;
  }

  static async resolveViolation(id: number, resolution: ViolationResolution): Promise<ApiResponse<{
    violation_id: number;
    resolved_at: string;
  }>> {
    const response = await complianceApi.post(`/compliance/violations/${id}/resolve/`, resolution);
    return response.data;
  }

  static async bulkResolveViolations(violationIds: number[], resolution: ViolationResolution): Promise<ApiResponse<void>> {
    const response = await complianceApi.post('/compliance/violations/bulk_resolve/', {
      violation_ids: violationIds,
      ...resolution
    });
    return response.data;
  }

  // Reports & Analytics
  static async getReportSummary(days: number = 7): Promise<ApiResponse<ComplianceReportSummary>> {
    const response = await complianceApi.get('/compliance/reports/summary/', {
      params: { days }
    });
    return response.data;
  }

  static async getTrends(days: number = 30, groupBy: 'day' | 'week' | 'month' = 'day'): Promise<ApiResponse<{
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
    const response = await complianceApi.get('/compliance/reports/trends/', {
      params: { days, group_by: groupBy }
    });
    return response.data;
  }

  static async getWorkingHoursReport(userId?: number, periodType?: 'weekly' | 'monthly' | 'quarterly'): Promise<ApiResponse<any>> {
    const params: any = {};
    if (userId) params.user_id = userId;
    if (periodType) params.period_type = periodType;

    const response = await complianceApi.get('/compliance/reports/working_hours/', { params });
    return response.data;
  }

  // Metrics
  static async getMetrics(filters?: {
    user_id?: number;
    period_type?: string;
  }): Promise<PaginatedResponse<ComplianceMetrics>> {
    const response = await complianceApi.get('/compliance/metrics/', { params: filters });
    return response.data;
  }

  static async recalculateMetrics(userId?: number, periodType?: string): Promise<ApiResponse<void>> {
    const data: any = {};
    if (userId) data.user_id = userId;
    if (periodType) data.period_type = periodType;

    const response = await complianceApi.post('/compliance/metrics/recalculate/', data);
    return response.data;
  }

  // Real-time Compliance
  static async checkCompliance(request: ComplianceCheckRequest): Promise<ApiResponse<ComplianceCheckResponse>> {
    const response = await complianceApi.post('/compliance/check/', request);
    return response.data;
  }

  static async getAlerts(): Promise<ApiResponse<Array<{
    type: string;
    message: string;
    count: number;
    priority: 'high' | 'medium' | 'low';
  }>>> {
    const response = await complianceApi.get('/compliance/alerts/');
    return response.data;
  }
}
```

---

## TypeScript Interfaces

### Core Data Types

```typescript
// src/types/compliance.ts

// API Response Types
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

// Violation Resolution
export interface ViolationResolution {
  resolution_notes: string;
  exception_granted: boolean;
  exception_reason?: string;
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
```

---

## React Component Examples

### Compliance Dashboard Component

```typescript
// src/components/ComplianceDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { ComplianceClient } from '../services/complianceClient';
import type { ComplianceReportSummary } from '../types/compliance';
import { ErrorBoundary } from './common/ErrorBoundary';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ComplianceMetricsCard } from './ComplianceMetricsCard';
import { ViolationTrendsChart } from './ViolationTrendsChart';
import { ComplianceAlertsPanel } from './ComplianceAlertsPanel';

export const ComplianceDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState(7);
  const queryClient = useQueryClient();

  // Fetch compliance summary
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary
  } = useQuery(
    ['compliance-summary', timeRange],
    () => ComplianceClient.getReportSummary(timeRange),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    }
  );

  // Fetch alerts
  const {
    data: alertsData,
    isLoading: alertsLoading,
    error: alertsError
  } = useQuery(
    ['compliance-alerts'],
    ComplianceClient.getAlerts,
    {
      refetchInterval: 30 * 1000, // Refresh every 30 seconds
    }
  );

  // Fetch trends
  const {
    data: trendsData,
    isLoading: trendsLoading,
    error: trendsError
  } = useQuery(
    ['compliance-trends', timeRange],
    () => ComplianceClient.getTrends(timeRange * 4, 'day'),
    {
      staleTime: 10 * 60 * 1000,
    }
  );

  const handleTimeRangeChange = (days: number) => {
    setTimeRange(days);
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries(['compliance-summary']);
    await queryClient.invalidateQueries(['compliance-alerts']);
    await queryClient.invalidateQueries(['compliance-trends']);
  };

  if (summaryLoading) {
    return <LoadingSpinner message="Loading compliance dashboard..." />;
  }

  if (summaryError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium">Failed to load dashboard</h3>
        <p className="text-red-600 mt-1">Please try refreshing the page.</p>
        <button
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = summaryData?.data;

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>

          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>

            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Alerts Panel */}
        {!alertsLoading && !alertsError && alertsData?.data && (
          <ComplianceAlertsPanel alerts={alertsData.data} />
        )}

        {/* Metrics Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ComplianceMetricsCard
              title="Total Violations"
              value={summary.violation_summary.total_violations}
              trend={summary.trends.violations_trend}
              color="red"
            />
            <ComplianceMetricsCard
              title="Critical Violations"
              value={summary.violation_summary.critical_count}
              color="red"
              urgent={summary.violation_summary.critical_count > 0}
            />
            <ComplianceMetricsCard
              title="Resolution Rate"
              value={`${summary.violation_summary.resolution_rate}%`}
              trend={summary.violation_summary.resolution_rate > 80 ? 'improving' : 'declining'}
              color="green"
            />
            <ComplianceMetricsCard
              title="Compliance Score"
              value={`${summary.working_hours_summary.compliance_score}%`}
              trend={summary.trends.compliance_score_trend}
              color="blue"
            />
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Violations Trend Chart */}
          {!trendsLoading && !trendsError && trendsData?.data && (
            <ViolationTrendsChart
              data={trendsData.data.trend_data}
              title="Violations Trend"
            />
          )}

          {/* Additional charts can be added here */}
        </div>
      </div>
    </ErrorBoundary>
  );
};
```

### Real-time Compliance Check Component

```typescript
// src/components/RealTimeComplianceCheck.tsx
import React, { useState, useEffect } from 'react';
import { useMutation } from 'react-query';
import { ComplianceClient } from '../services/complianceClient';
import type { ComplianceCheckRequest, ComplianceCheckResponse } from '../types/compliance';

interface Props {
  userId: number;
  onComplianceResult?: (result: ComplianceCheckResponse) => void;
}

export const RealTimeComplianceCheck: React.FC<Props> = ({ userId, onComplianceResult }) => {
  const [shiftData, setShiftData] = useState<Partial<ComplianceCheckRequest>>({
    user_id: userId,
  });

  const complianceCheckMutation = useMutation(
    ComplianceClient.checkCompliance,
    {
      onSuccess: (data) => {
        if (onComplianceResult) {
          onComplianceResult(data.data);
        }
      },
      onError: (error) => {
        console.error('Compliance check failed:', error);
      }
    }
  );

  const handleShiftTimeChange = (field: 'shift_start' | 'shift_end', value: string) => {
    setShiftData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleVenueChange = (venueId: number) => {
    setShiftData(prev => ({
      ...prev,
      venue_id: venueId
    }));
  };

  const performComplianceCheck = () => {
    if (!shiftData.shift_start || !shiftData.shift_end) {
      alert('Please provide shift start and end times');
      return;
    }

    complianceCheckMutation.mutate(shiftData as ComplianceCheckRequest);
  };

  const result = complianceCheckMutation.data?.data;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border">
      <h3 className="text-lg font-medium mb-4">Real-time Compliance Check</h3>

      {/* Input Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift Start
            </label>
            <input
              type="datetime-local"
              value={shiftData.shift_start || ''}
              onChange={(e) => handleShiftTimeChange('shift_start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shift End
            </label>
            <input
              type="datetime-local"
              value={shiftData.shift_end || ''}
              onChange={(e) => handleShiftTimeChange('shift_end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={performComplianceCheck}
          disabled={complianceCheckMutation.isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {complianceCheckMutation.isLoading ? 'Checking...' : 'Check Compliance'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6 p-4 border rounded-lg">
          {/* Compliance Status */}
          <div className={`flex items-center mb-3 ${result.compliant ? 'text-green-700' : 'text-red-700'}`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${result.compliant ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-medium">
              {result.compliant ? 'Compliant' : 'Non-Compliant'}
            </span>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-yellow-700 mb-2">Warnings:</h4>
              <ul className="space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-600 flex items-start">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Violations */}
          {result.violations.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-red-700 mb-2">Violations:</h4>
              <ul className="space-y-1">
                {result.violations.map((violation, index) => (
                  <li key={index} className="text-sm text-red-600 flex items-start">
                    <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    {violation.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-blue-700 mb-2">Recommendations:</h4>
              <ul className="space-y-1">
                {result.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-blue-600 flex items-start">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 mr-2 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Current Week Hours:</span>
              <span className="ml-2 font-medium">{result.current_week_hours}h</span>
            </div>
            <div>
              <span className="text-gray-600">Projected Week Hours:</span>
              <span className="ml-2 font-medium">{result.projected_week_hours}h</span>
            </div>
            <div>
              <span className="text-gray-600">Consecutive Days:</span>
              <span className="ml-2 font-medium">{result.consecutive_days}</span>
            </div>
            <div>
              <span className="text-gray-600">Last Rest Period:</span>
              <span className="ml-2 font-medium">{result.last_rest_period_hours}h</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## Error Handling

### Comprehensive Error Handling Pattern

```typescript
// src/utils/errorHandling.ts
import { AxiosError } from 'axios';

export interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>;
  isNetworkError?: boolean;
  isValidationError?: boolean;
  isAuthError?: boolean;
}

export const handleApiError = (error: unknown): ApiError => {
  if (error instanceof AxiosError) {
    const response = error.response;

    // Network error (no response)
    if (!response) {
      return {
        message: 'Network error. Please check your connection.',
        isNetworkError: true,
      };
    }

    // HTTP error with response
    const { status, data } = response;

    switch (status) {
      case 401:
        return {
          message: 'Authentication required. Please log in.',
          status,
          isAuthError: true,
        };

      case 403:
        return {
          message: 'You do not have permission to perform this action.',
          status,
        };

      case 400:
        return {
          message: data?.message || 'Invalid request data.',
          status,
          errors: data?.errors,
          isValidationError: true,
        };

      case 404:
        return {
          message: 'The requested resource was not found.',
          status,
        };

      case 429:
        return {
          message: 'Too many requests. Please try again later.',
          status,
        };

      case 500:
      default:
        return {
          message: data?.message || 'An unexpected error occurred.',
          status,
        };
    }
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred.',
  };
};

// React Hook for Error Handling
export const useErrorHandler = () => {
  const showError = (error: unknown) => {
    const apiError = handleApiError(error);

    // Handle different error types
    if (apiError.isAuthError) {
      // Redirect to login or refresh token
      window.location.href = '/login';
      return;
    }

    if (apiError.isValidationError && apiError.errors) {
      // Handle validation errors in form
      console.warn('Validation errors:', apiError.errors);
      return apiError.errors;
    }

    // Show generic error message
    alert(apiError.message); // Replace with your toast/notification system
    console.error('API Error:', apiError);

    return null;
  };

  return { showError };
};
```

### Error Boundary Component

```typescript
// src/components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service
    console.error('Error caught by boundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-medium">Something went wrong</h3>
            <p className="text-red-600 mt-1">
              We encountered an error while loading this component.
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-red-700 font-medium">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

---

## Real-time Features

### WebSocket Integration for Live Updates

```typescript
// src/services/websocketService.ts
interface ComplianceWebSocketMessage {
  type: 'violation_created' | 'violation_resolved' | 'alert_updated' | 'compliance_score_changed';
  data: any;
  timestamp: string;
}

export class ComplianceWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Array<(data: any) => void>> = new Map();

  connect(token: string) {
    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}/ws/compliance/`;

    try {
      this.ws = new WebSocket(`${wsUrl}?token=${token}`);

      this.ws.onopen = () => {
        console.log('Compliance WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ComplianceWebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Compliance WebSocket closed:', event.code, event.reason);
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Compliance WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleReconnect();
    }
  }

  private handleMessage(message: ComplianceWebSocketMessage) {
    const typeListeners = this.listeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(message.data);
        } catch (error) {
          console.error(`Error in WebSocket listener for ${message.type}:`, error);
        }
      });
    }

    // Broadcast to 'all' listeners
    const allListeners = this.listeners.get('all');
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('Error in WebSocket all listener:', error);
        }
      });
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`Attempting to reconnect WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);

      setTimeout(() => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          this.connect(token);
        }
      }, delay);
    } else {
      console.error('Max WebSocket reconnection attempts reached');
    }
  }

  subscribe(eventType: string, callback: (data: any) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(eventType);
      if (typeListeners) {
        const index = typeListeners.indexOf(callback);
        if (index > -1) {
          typeListeners.splice(index, 1);
        }
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }
}

// React Hook for WebSocket
export const useComplianceWebSocket = () => {
  const [wsService] = useState(() => new ComplianceWebSocketService());

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      wsService.connect(token);
    }

    return () => {
      wsService.disconnect();
    };
  }, [wsService]);

  return wsService;
};
```

### Real-time Component Example

```typescript
// src/components/RealTimeViolationsPanel.tsx
import React, { useState, useEffect } from 'react';
import { useComplianceWebSocket } from '../services/websocketService';
import { useQuery, useQueryClient } from 'react-query';
import { ComplianceClient } from '../services/complianceClient';
import type { ComplianceViolation } from '../types/compliance';

export const RealTimeViolationsPanel: React.FC = () => {
  const [realtimeViolations, setRealtimeViolations] = useState<ComplianceViolation[]>([]);
  const wsService = useComplianceWebSocket();
  const queryClient = useQueryClient();

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribeViolationCreated = wsService.subscribe('violation_created', (violation: ComplianceViolation) => {
      setRealtimeViolations(prev => [violation, ...prev.slice(0, 9)]); // Keep last 10

      // Invalidate related queries
      queryClient.invalidateQueries(['compliance-violations']);
      queryClient.invalidateQueries(['compliance-summary']);

      // Show notification
      showNotification(`New ${violation.severity} violation for ${violation.user_data.full_name}`, 'warning');
    });

    const unsubscribeViolationResolved = wsService.subscribe('violation_resolved', (data: { violation_id: number }) => {
      setRealtimeViolations(prev => prev.filter(v => v.id !== data.violation_id));

      queryClient.invalidateQueries(['compliance-violations']);
      queryClient.invalidateQueries(['compliance-summary']);

      showNotification('Violation resolved', 'success');
    });

    return () => {
      unsubscribeViolationCreated();
      unsubscribeViolationResolved();
    };
  }, [wsService, queryClient]);

  const showNotification = (message: string, type: 'success' | 'warning' | 'error') => {
    // Implement your notification system here
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-medium mb-4 flex items-center">
        <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
        Live Violations
      </h3>

      {realtimeViolations.length === 0 ? (
        <p className="text-gray-500 text-sm">No recent violations</p>
      ) : (
        <div className="space-y-3">
          {realtimeViolations.map((violation) => (
            <div
              key={violation.id}
              className={`p-3 rounded-lg border-l-4 ${
                violation.severity === 'critical' ? 'border-red-500 bg-red-50' :
                violation.severity === 'major' ? 'border-orange-500 bg-orange-50' :
                violation.severity === 'minor' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {violation.user_data.full_name}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {violation.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(violation.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  violation.severity === 'critical' ? 'bg-red-100 text-red-800' :
                  violation.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                  violation.severity === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {violation.severity_display}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## Performance Optimization

### React Query Configuration

```typescript
// src/config/queryClient.ts
import { QueryClient } from 'react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default cache time: 5 minutes
      cacheTime: 5 * 60 * 1000,
      // Default stale time: 1 minute
      staleTime: 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Don't refetch on window focus for compliance data
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,
    },
  },
});

// Cache keys for consistency
export const CACHE_KEYS = {
  COMPLIANCE_PROFILE: 'compliance-profile',
  COMPLIANCE_VIOLATIONS: 'compliance-violations',
  COMPLIANCE_SUMMARY: 'compliance-summary',
  COMPLIANCE_TRENDS: 'compliance-trends',
  COMPLIANCE_METRICS: 'compliance-metrics',
  COMPLIANCE_ALERTS: 'compliance-alerts',
  WORKING_HOURS_REGULATIONS: 'working-hours-regulations',
} as const;
```

### Optimized Data Fetching

```typescript
// src/hooks/useComplianceData.ts
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from 'react-query';
import { ComplianceClient } from '../services/complianceClient';
import { CACHE_KEYS } from '../config/queryClient';
import type { ComplianceViolation } from '../types/compliance';

// Optimized violations list with infinite scroll
export const useInfiniteViolations = (filters?: any) => {
  return useInfiniteQuery(
    [CACHE_KEYS.COMPLIANCE_VIOLATIONS, filters],
    async ({ pageParam = 1 }) => {
      const response = await ComplianceClient.getViolations({
        ...filters,
        page: pageParam,
      });
      return response;
    },
    {
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.next ? allPages.length + 1 : undefined;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes for violations
    }
  );
};

// Optimized dashboard summary with background refetch
export const useComplianceSummary = (days: number) => {
  return useQuery(
    [CACHE_KEYS.COMPLIANCE_SUMMARY, days],
    () => ComplianceClient.getReportSummary(days),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchInterval: 2 * 60 * 1000, // Background refetch every 2 minutes
      refetchIntervalInBackground: true,
    }
  );
};

// Optimized real-time compliance check
export const useComplianceCheck = () => {
  const queryClient = useQueryClient();

  return useMutation(
    ComplianceClient.checkCompliance,
    {
      onSuccess: (data) => {
        // Update related cache entries
        queryClient.setQueryData([CACHE_KEYS.COMPLIANCE_ALERTS], (oldData: any) => {
          if (!data.data.compliant && data.data.violations.length > 0) {
            // Add to alerts if non-compliant
            return {
              ...oldData,
              data: [
                {
                  type: 'compliance_warning',
                  message: `Compliance issues detected for upcoming shift`,
                  count: data.data.violations.length,
                  priority: 'high' as const,
                },
                ...(oldData?.data || []),
              ],
            };
          }
          return oldData;
        });
      },
    }
  );
};
```

### Memoization and Performance Hooks

```typescript
// src/hooks/useOptimizedCompliance.ts
import { useMemo, useCallback } from 'react';
import { useComplianceData } from './useComplianceData';
import type { ComplianceViolation, ComplianceMetrics } from '../types/compliance';

interface UseOptimizedComplianceResult {
  processedViolations: ComplianceViolation[];
  violationsByCategory: Record<string, ComplianceViolation[]>;
  criticalViolationsCount: number;
  complianceScore: number;
  isLoading: boolean;
  refetch: () => void;
}

export const useOptimizedCompliance = (userId?: number): UseOptimizedComplianceResult => {
  const { data: violationsData, isLoading: violationsLoading, refetch } = useInfiniteViolations({
    user_id: userId,
  });

  const { data: metricsData, isLoading: metricsLoading } = useComplianceData.useMetrics({
    user_id: userId,
  });

  // Memoized processed violations
  const processedViolations = useMemo(() => {
    if (!violationsData?.pages) return [];

    return violationsData.pages
      .flatMap(page => page.results)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [violationsData]);

  // Memoized violations by category
  const violationsByCategory = useMemo(() => {
    return processedViolations.reduce((acc, violation) => {
      const category = violation.violation_type;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(violation);
      return acc;
    }, {} as Record<string, ComplianceViolation[]>);
  }, [processedViolations]);

  // Memoized critical violations count
  const criticalViolationsCount = useMemo(() => {
    return processedViolations.filter(v => v.severity === 'critical').length;
  }, [processedViolations]);

  // Memoized compliance score
  const complianceScore = useMemo(() => {
    if (!metricsData?.results?.[0]) return 0;
    return parseFloat(metricsData.results[0].compliance_score);
  }, [metricsData]);

  const optimizedRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    processedViolations,
    violationsByCategory,
    criticalViolationsCount,
    complianceScore,
    isLoading: violationsLoading || metricsLoading,
    refetch: optimizedRefetch,
  };
};
```

---

## Testing Guidelines

### API Testing with Mock Service Worker

```typescript
// src/mocks/complianceHandlers.ts
import { rest } from 'msw';
import type { ComplianceViolation, ComplianceReportSummary } from '../types/compliance';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export const complianceHandlers = [
  // Mock compliance summary
  rest.get(`${API_BASE_URL}/compliance/reports/summary/`, (req, res, ctx) => {
    const mockSummary: ComplianceReportSummary = {
      violation_summary: {
        total_violations: 15,
        critical_count: 2,
        major_count: 5,
        minor_count: 6,
        warning_count: 2,
        resolution_rate: 85.5,
      },
      working_hours_summary: {
        avg_weekly_hours: 42.5,
        overtime_percentage: 12.5,
        compliance_score: 88.2,
      },
      trends: {
        violations_trend: 'decreasing',
        compliance_score_trend: 'improving',
      },
    };

    return res(
      ctx.status(200),
      ctx.json({
        status: 'success',
        data: mockSummary,
        cached: false,
      })
    );
  }),

  // Mock violations list
  rest.get(`${API_BASE_URL}/compliance/violations/`, (req, res, ctx) => {
    const mockViolations: ComplianceViolation[] = [
      {
        id: 1,
        user: 5,
        user_data: {
          id: 5,
          username: 'john_doe',
          full_name: 'John Doe',
          email: 'john.doe@example.com',
        },
        violation_type: 'daily_overtime',
        violation_type_display: 'Daily Hours Exceeded',
        severity: 'major',
        severity_display: 'Major Violation',
        period_start: '2025-01-15T08:00:00Z',
        period_end: '2025-01-15T22:00:00Z',
        shift: 123,
        description: 'Daily hours exceeded 12 hour limit by 2.0 hours',
        calculated_values: {
          total_hours: 14.0,
          limit: 12.0,
          exceeded_by: 2.0,
        },
        threshold_exceeded: '2.00',
        evidence_data: {
          check_in_time: '2025-01-15T08:00:00Z',
          check_out_time: '2025-01-15T22:00:00Z',
          break_duration: 30,
        },
        system_generated: true,
        resolution_status: 'open',
        resolution_status_display: 'Open',
        resolution_notes: '',
        resolved_by: null,
        resolved_by_name: '',
        resolved_at: null,
        exception_granted: false,
        exception_reason: '',
        approved_by: null,
        approved_by_name: '',
        financial_impact: null,
        compliance_score_impact: '-5.00',
        duration_hours: '14.00',
        is_resolved: false,
        created_at: '2025-01-16T08:30:00Z',
        updated_at: '2025-01-16T08:30:00Z',
      },
    ];

    return res(
      ctx.status(200),
      ctx.json({
        status: 'success',
        count: mockViolations.length,
        results: mockViolations,
      })
    );
  }),

  // Mock compliance check
  rest.post(`${API_BASE_URL}/compliance/check/`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        status: 'success',
        data: {
          compliant: true,
          warnings: [
            {
              type: 'approaching_weekly_limit',
              message: 'User will reach 85% of weekly hour limit',
              severity: 'warning',
            },
          ],
          violations: [],
          recommendations: ['Consider shorter shift to maintain compliance buffer'],
          current_week_hours: 32.5,
          projected_week_hours: 40.5,
          weekly_limit: 48.0,
          consecutive_days: 4,
          last_rest_period_hours: 12.0,
        },
        timestamp: '2025-01-16T10:00:00Z',
      })
    );
  }),
];
```

### Component Testing Examples

```typescript
// src/components/__tests__/ComplianceDashboard.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ComplianceDashboard } from '../ComplianceDashboard';
import { server } from '../../mocks/server';

// Create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={testQueryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ComplianceDashboard', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders dashboard with compliance data', async () => {
    renderWithQueryClient(<ComplianceDashboard />);

    // Check loading state initially
    expect(screen.getByText(/loading compliance dashboard/i)).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText(/compliance dashboard/i)).toBeInTheDocument();
    });

    // Check that summary data is displayed
    await waitFor(() => {
      expect(screen.getByText(/total violations/i)).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // Total violations count
    });
  });

  it('handles API errors gracefully', async () => {
    // Override with error response
    server.use(
      rest.get('*/compliance/reports/summary/', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Server error' }));
      })
    );

    renderWithQueryClient(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });
  });

  it('allows time range selection', async () => {
    renderWithQueryClient(<ComplianceDashboard />);

    await waitFor(() => {
      const timeRangeSelect = screen.getByDisplayValue(/last 7 days/i);
      expect(timeRangeSelect).toBeInTheDocument();
    });

    // Test time range options are available
    const select = screen.getByDisplayValue(/last 7 days/i);
    expect(select).toHaveTextContent('Last 7 days');
  });
});
```

### Integration Testing

```typescript
// src/integration/__tests__/complianceFlow.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { CompliancePage } from '../../pages/CompliancePage';
import { server } from '../../mocks/server';

const renderCompleteApp = (component: React.ReactElement) => {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
    },
  });

  return render(
    <BrowserRouter>
      <QueryClientProvider client={testQueryClient}>
        <AuthProvider>
          {component}
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Compliance Flow Integration', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('completes full compliance check flow', async () => {
    const user = userEvent.setup();

    renderCompleteApp(<CompliancePage />);

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText(/compliance dashboard/i)).toBeInTheDocument();
    });

    // Navigate to real-time check
    const checkTab = screen.getByText(/real-time check/i);
    await user.click(checkTab);

    // Fill in shift details
    const startTimeInput = screen.getByLabelText(/shift start/i);
    const endTimeInput = screen.getByLabelText(/shift end/i);

    await user.clear(startTimeInput);
    await user.type(startTimeInput, '2025-01-16T08:00');

    await user.clear(endTimeInput);
    await user.type(endTimeInput, '2025-01-16T16:00');

    // Submit compliance check
    const checkButton = screen.getByText(/check compliance/i);
    await user.click(checkButton);

    // Wait for results
    await waitFor(() => {
      expect(screen.getByText(/compliant/i)).toBeInTheDocument();
    });

    // Verify warning is displayed
    expect(screen.getByText(/approaching weekly limit/i)).toBeInTheDocument();
  });
});
```

---

This comprehensive Frontend API Integration Guide provides everything needed to integrate with the Legal Compliance Reporting System APIs. The examples demonstrate real-world patterns for authentication, error handling, real-time features, and performance optimization that can be directly implemented in your React application.

Next, I'll continue with the other required documentation files. Would you like me to proceed with the Architectural Decision Records documentation?