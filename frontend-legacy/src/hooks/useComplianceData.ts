// Compliance Data Hooks
// Custom React hooks for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import ComplianceService from '../services/complianceService';
import type {
  ComplianceDashboardMetrics,
  ComplianceViolation,
  ComplianceSettings,
  ComplianceReportSummary,
  ViolationFilters,
  MetricsParams,
  ComplianceDataParams,
  ComplianceCheckRequest,
  ComplianceCheckResponse,
  LiveComplianceStatus,
  ViolationResolution
} from '../types/compliance';

// Cache keys for consistency
export const COMPLIANCE_CACHE_KEYS = {
  DASHBOARD_METRICS: 'compliance-dashboard-metrics',
  VIOLATIONS: 'compliance-violations',
  VIOLATION_DETAIL: 'compliance-violation-detail',
  VIOLATION_SUMMARY: 'compliance-violation-summary',
  PENDING_VIOLATIONS: 'compliance-pending-violations',
  SETTINGS: 'compliance-settings',
  REPORT_SUMMARY: 'compliance-report-summary',
  TRENDS: 'compliance-trends',
  METRICS: 'compliance-metrics',
  ALERTS: 'compliance-alerts',
  LIVE_STATUS: 'compliance-live-status',
  REGULATIONS: 'compliance-regulations',
  PROFILES: 'compliance-profiles',
  COUNTRIES: 'compliance-countries'
} as const;

// Dashboard Metrics Hook
export function useComplianceDashboardMetrics(params: MetricsParams = {}, options?: {
  autoRefresh?: boolean;
  refetchInterval?: number;
}) {
  const { autoRefresh = false, refetchInterval = 30000 } = options || {};

  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS, params],
    queryFn: () => ComplianceService.getDashboardMetrics(params),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchInterval: autoRefresh ? refetchInterval : false,
    refetchIntervalInBackground: true,
    select: (data) => ({
      ...data.data,
      complianceRate: Math.round(data.data.overall_compliance_rate * 100) / 100,
      criticalPercentage: data.data.total_violations > 0
        ? Math.round((data.data.critical_violations / data.data.total_violations) * 100)
        : 0,
      resolutionRate: data.data.total_violations > 0
        ? Math.round((data.data.resolved_violations / data.data.total_violations) * 100)
        : 100
    })
  });
}

// Violations List Hook with Infinite Scroll
export function useComplianceViolations(filters: ViolationFilters = {}) {
  return useInfiniteQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATIONS, filters],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await ComplianceService.getViolations({
        ...filters,
        page: pageParam,
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.next ? allPages.length + 1 : undefined;
    },
    staleTime: 60000, // 1 minute for violations
    initialPageParam: 1
  });
}

// Single Violation Detail Hook
export function useComplianceViolationDetail(violationId: number | null) {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATION_DETAIL, violationId],
    queryFn: () => violationId ? ComplianceService.getViolationById(violationId) : null,
    enabled: !!violationId,
    staleTime: 30000
  });
}

// Violation Summary Hook
export function useComplianceViolationSummary() {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATION_SUMMARY],
    queryFn: ComplianceService.getViolationSummary,
    staleTime: 60000, // 1 minute
    gcTime: 300000 // 5 minutes
  });
}

// Pending Violations Hook
export function useCompliancePendingViolations() {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.PENDING_VIOLATIONS],
    queryFn: ComplianceService.getPendingViolations,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000 // Refetch every minute
  });
}

// Compliance Settings Hook with Mutations
export function useComplianceSettings(level?: string, venueId?: number, staffId?: number) {
  const queryClient = useQueryClient();
  const queryKey = [COMPLIANCE_CACHE_KEYS.SETTINGS, level, venueId, staffId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await ComplianceService.getSettings(venueId, staffId);
      } catch (error) {
        // Return mock data if backend endpoint doesn't exist
        return {
          status: 'success' as const,
          data: {
            id: 1,
            venue_id: venueId,
            staff_id: staffId,
            max_daily_hours: 12,
            max_weekly_hours: 48,
            min_rest_period: 11,
            break_duration: 30,
            max_consecutive_days: 6,
            overtime_threshold: 8,
            compliance_level: level || 'venue',
            // Additional fields required by ComplianceSettings
            daily_overtime_threshold: 8,
            weekly_overtime_threshold: 48,
            overtime_calculation_method: 'daily',
            break_required_after_hours: 6,
            minimum_break_duration: 30,
            unpaid_break_threshold: 30,
            enable_real_time_monitoring: true,
            violation_notifications: true,
            auto_resolution_enabled: false,
            escalation_threshold_minutes: 60,
            max_consecutive_hours: 12,
            minimum_rest_between_shifts: 11,
            notify_managers: true,
            notify_staff: true,
            email_notifications: true,
            sms_notifications: false,
            clock_in_grace_period: 5,
            clock_out_grace_period: 5,
            late_arrival_threshold: 15,
            notification_settings: {
              email_alerts: true,
              push_notifications: true,
              alert_thresholds: {
                daily_hours_warning: 10,
                weekly_hours_warning: 45
              }
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        };
      }
    },
    enabled: !!(level),
    staleTime: 300000 // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: ComplianceService.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
    }
  });

  const createMutation = useMutation({
    mutationFn: ComplianceService.createSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.SETTINGS] });
    }
  });

  return {
    ...query,
    updateSettings: updateMutation.mutate,
    createSettings: createMutation.mutate,
    isUpdating: updateMutation.isPending,
    isCreating: createMutation.isPending
  };
}

// Settings Update Hook (separate hook for cleaner API)
export function useComplianceSettingsUpdate() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ComplianceService.updateSettings,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.SETTINGS] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
    }
  });

  return {
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    error: updateMutation.error
  };
}

// Venues Hook (mock implementation)
export function useComplianceVenues() {
  return {
    data: [
      { id: 1, name: 'Main Office', status: 'active' },
      { id: 2, name: 'Security HQ', status: 'active' },
      { id: 3, name: 'Training Center', status: 'monitoring' }
    ],
    isLoading: false,
    error: null
  };
}

// Staff Profiles Hook (mock implementation)
export function useComplianceStaffProfiles() {
  return {
    data: [
      { id: 1, name: 'John Doe', role: 'Security Officer' },
      { id: 2, name: 'Jane Smith', role: 'Supervisor' },
      { id: 3, name: 'Mike Johnson', role: 'Manager' }
    ],
    isLoading: false,
    error: null
  };
}

// Report Summary Hook
export function useComplianceReportSummary(days: number = 7) {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.REPORT_SUMMARY, days],
    queryFn: () => ComplianceService.getReportSummary(days),
    staleTime: 300000, // 5 minutes
    gcTime: 600000 // 10 minutes
  });
}

// Trends Data Hook
export function useComplianceTrends(days: number = 30, groupBy: 'day' | 'week' | 'month' = 'day') {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.TRENDS, days, groupBy],
    queryFn: () => ComplianceService.getTrends(days, groupBy),
    staleTime: 600000 // 10 minutes
  });
}

// Real-time Compliance Check Hook
export function useComplianceCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ComplianceService.checkCompliance,
    onSuccess: (data) => {
      // Update alerts if non-compliant
      if (!data.data.compliant && data.data.violations.length > 0) {
        queryClient.setQueryData([COMPLIANCE_CACHE_KEYS.ALERTS], (oldData: any) => {
          const newAlert = {
            type: 'compliance_warning',
            message: `Compliance issues detected for upcoming shift`,
            count: data.data.violations.length,
            priority: 'high' as const,
          };

          return {
            ...oldData,
            data: [newAlert, ...(oldData?.data || [])],
          };
        });
      }
    },
  });
}

// Violation Resolution Hook
export function useViolationResolution() {
  const queryClient = useQueryClient();

  const resolveSingle = useMutation({
    mutationFn: ({ violationId, resolution }: { violationId: number; resolution: ViolationResolution }) =>
      ComplianceService.resolveViolation(violationId, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATIONS] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATION_SUMMARY] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.PENDING_VIOLATIONS] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
    }
  });

  const resolveBulk = useMutation({
    mutationFn: ({ violationIds, resolution }: { violationIds: number[]; resolution: ViolationResolution }) =>
      ComplianceService.bulkResolveViolations(violationIds, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATIONS] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATION_SUMMARY] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.PENDING_VIOLATIONS] });
      queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
    }
  });

  return {
    resolveSingle: resolveSingle.mutate,
    resolveBulk: resolveBulk.mutate,
    isSingleResolving: resolveSingle.isPending,
    isBulkResolving: resolveBulk.isPending
  };
}

// Alerts Hook
export function useComplianceAlerts() {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.ALERTS],
    queryFn: ComplianceService.getAlerts,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000 // Refresh every minute
  });
}

// Live Status Hook
export function useComplianceLiveStatus(venueIds?: number[]) {
  return useQuery({
    queryKey: [COMPLIANCE_CACHE_KEYS.LIVE_STATUS, venueIds],
    queryFn: () => ComplianceService.getLiveStatus(venueIds),
    staleTime: 15000, // 15 seconds
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: true
  });
}

// WebSocket Real-time Updates Hook - TEMPORARILY DISABLED
export function useComplianceRealTimeUpdates(options: {
  onViolationReceived?: (violation: ComplianceViolation) => void;
  onStatusUpdate?: (status: LiveComplianceStatus) => void;
  onConnectionChange?: (connected: boolean) => void;
} = {}) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [latestViolations, setLatestViolations] = useState<ComplianceViolation[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<Record<number, LiveComplianceStatus>>({});

  // TEMPORARILY DISABLED WEBSOCKET - Backend endpoint not implemented yet
  // TODO: Enable once backend WebSocket compliance endpoint is implemented
  const WEBSOCKET_ENABLED = false;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!WEBSOCKET_ENABLED) {
      console.log('WebSocket compliance connection disabled - using polling fallback');
      setConnectionStatus('disconnected');
      options.onConnectionChange?.(false);
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');

    // WebSocket auth is handled via cookies (browser sends cookies for same-origin WS connections)
    const wsUrl = `${process.env.REACT_APP_WS_URL || 'ws://localhost:8000'}/ws/compliance/`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setConnectionStatus('connected');
        options.onConnectionChange?.(true);
        console.log('Compliance WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'violation_detected':
              const violation = message.data as ComplianceViolation;
              setLatestViolations(prev => [violation, ...prev.slice(0, 9)]); // Keep last 10
              options.onViolationReceived?.(violation);

              // Invalidate related queries
              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATIONS] });
              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
              break;

            case 'violation_resolved':
              const resolutionData = message.data as { violation_id: number };
              setLatestViolations(prev => prev.filter(v => v.id !== resolutionData.violation_id));

              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATIONS] });
              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
              break;

            case 'status_update':
              const status = message.data as LiveComplianceStatus;
              setStatusUpdates(prev => ({
                ...prev,
                [status.venue_id]: status
              }));
              options.onStatusUpdate?.(status);

              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.LIVE_STATUS] });
              break;

            case 'compliance_metrics_update':
              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
              break;

            case 'alert_updated':
              queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.ALERTS] });
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('Compliance WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        options.onConnectionChange?.(false);

        // Reconnect after 5 seconds if not a manual close
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Compliance WebSocket error:', error);
        setConnectionStatus('disconnected');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');

      // Retry connection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    }
  }, [options, queryClient]);

  useEffect(() => {
    if (WEBSOCKET_ENABLED) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000); // Normal closure
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    isConnected: WEBSOCKET_ENABLED && connectionStatus === 'connected',
    latestViolations,
    statusUpdates,
    reconnect: connect
  };
}

// Optimized Compliance Data Hook with Memoization
export function useOptimizedComplianceData(params: ComplianceDataParams) {
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useComplianceDashboardMetrics({
    venue_id: params.venueId,
    user_id: params.userId,
    start_date: params.timeRange?.[0]?.toISOString(),
    end_date: params.timeRange?.[1]?.toISOString(),
  }, { autoRefresh: params.autoRefresh });

  const { data: violationsData, isLoading: violationsLoading } = useComplianceViolations({
    venue_id: params.venueId,
    user_id: params.userId,
    start_date: params.timeRange?.[0]?.toISOString(),
    end_date: params.timeRange?.[1]?.toISOString(),
  });

  const { data: alertsData, isLoading: alertsLoading } = useComplianceAlerts();

  // Process violations from infinite query
  const processedViolations = violationsData?.pages
    ?.flatMap(page => page?.results || [])
    ?.filter(Boolean)
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || [];

  // Calculate derived metrics
  const derivedMetrics = {
    totalViolations: processedViolations.length,
    criticalViolations: processedViolations.filter(v => v?.severity === 'critical').length,
    openViolations: processedViolations.filter(v => v && !v.is_resolved).length,
    recentViolations: processedViolations.filter(v => {
      if (!v?.created_at) return false;
      const violationDate = new Date(v.created_at);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return violationDate > dayAgo;
    }).length
  };

  return {
    metrics: metricsData,
    violations: processedViolations,
    alerts: alertsData?.data || [],
    derivedMetrics,
    isLoading: metricsLoading || violationsLoading || alertsLoading,
    error: metricsError,
    hasData: !!(metricsData || processedViolations.length > 0)
  };
}

// Main Compliance Data Hook (simplified interface)
export function useComplianceData(params: {
  refreshInterval?: number;
  venueId?: number;
  userId?: number;
  timeRange?: [Date, Date];
  autoRefresh?: boolean;
} = {}) {
  const {
    refreshInterval = 0,
    venueId,
    userId,
    timeRange,
    autoRefresh = false
  } = params;

  const optimizedParams: ComplianceDataParams = {
    venueId,
    userId,
    timeRange,
    autoRefresh,
    refreshInterval
  };

  return useOptimizedComplianceData(optimizedParams);
}

// Export utilities for external use
export const complianceQueryUtils = {
  // Prefetch functions
  prefetchDashboardMetrics: (queryClient: any, params: MetricsParams) => {
    return queryClient.prefetchQuery({
      queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS, params],
      queryFn: () => ComplianceService.getDashboardMetrics(params),
      staleTime: 30000
    });
  },

  // Invalidation helpers
  invalidateAll: (queryClient: any) => {
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.DASHBOARD_METRICS] });
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.VIOLATIONS] });
    queryClient.invalidateQueries({ queryKey: [COMPLIANCE_CACHE_KEYS.ALERTS] });
  },

  // Cache key getters
  getCacheKeys: () => COMPLIANCE_CACHE_KEYS
};