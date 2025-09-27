// Compliance Dashboard Component
// Main dashboard for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardHeader,
  CardPreview,
  Button,
  Spinner,
  Text,
  Title1,
  Title3,
  Badge,
  Select,
  Body1,
  Caption1
} from '@fluentui/react-components';
import {
  ArrowSync24Regular,
  Warning24Regular,
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Info24Regular
} from '@fluentui/react-icons';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

import {
  useComplianceDashboardMetrics,
  useComplianceAlerts,
  useComplianceTrends,
  useComplianceRealTimeUpdates
} from '../../hooks/useComplianceData';
import { ComplianceStatusBadge, ComplianceScoreBadge, LiveStatusIndicator, ViolationSeverityBadge } from '../shared/ComplianceStatusBadge';
import DateRangePicker, { QuickDateRangeButtons } from '../shared/DateRangePicker';
import type { DateRange, ComplianceDashboardProps } from '../../types/compliance';
import { complianceColors } from '../../types/compliance';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  userId,
  venueId,
  timeRange: initialTimeRange,
  autoRefresh = true
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<DateRange>(
    initialTimeRange || [
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      new Date()
    ]
  );
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  // API Hooks
  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useComplianceDashboardMetrics(
    {
      venue_id: venueId,
      user_id: userId,
      start_date: selectedTimeRange?.[0]?.toISOString(),
      end_date: selectedTimeRange?.[1]?.toISOString()
    },
    {
      autoRefresh,
      refetchInterval: refreshInterval * 1000
    }
  );

  const {
    data: alertsData,
    isLoading: alertsLoading
  } = useComplianceAlerts();

  const {
    data: trendsData,
    isLoading: trendsLoading
  } = useComplianceTrends(7, 'day');

  // Real-time updates
  const {
    connectionStatus,
    isConnected,
    latestViolations
  } = useComplianceRealTimeUpdates({
    onViolationReceived: (violation) => {
      console.log('New violation received:', violation);
      // Could show a toast notification here
    }
  });

  const handleRefresh = useCallback(async () => {
    await refetchMetrics();
  }, [refetchMetrics]);

  const handleTimeRangeChange = useCallback((range: DateRange) => {
    setSelectedTimeRange(range);
  }, []);

  // Memoized chart data
  const complianceTrendChart = useMemo(() => {
    if (!metricsData?.compliance_trend) return null;

    return {
      labels: metricsData.compliance_trend.map(item =>
        new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [
        {
          label: 'Compliance Rate (%)',
          data: metricsData.compliance_trend.map(item => item.compliance_rate),
          borderColor: complianceColors.compliant.primary,
          backgroundColor: complianceColors.compliant.background,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Violations',
          data: metricsData.compliance_trend.map(item => item.violation_count),
          borderColor: complianceColors.violation.primary,
          backgroundColor: complianceColors.violation.background,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    };
  }, [metricsData]);

  const violationBreakdownChart = useMemo(() => {
    if (!metricsData?.violation_breakdown) return null;

    return {
      labels: metricsData.violation_breakdown.map(item =>
        item.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      ),
      datasets: [
        {
          data: metricsData.violation_breakdown.map(item => item.count),
          backgroundColor: metricsData.violation_breakdown.map(item => {
            switch (item.severity) {
              case 'critical': return complianceColors.critical.primary;
              case 'major': return complianceColors.violation.primary;
              case 'minor': return complianceColors.warning.primary;
              default: return complianceColors.compliant.primary;
            }
          }),
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };
  }, [metricsData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
      },
    },
  };

  if (metricsLoading && !metricsData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Spinner size="large" />
              <Text className="mt-4 block text-gray-600">Loading compliance dashboard...</Text>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ErrorCircle24Regular className="text-red-600 w-8 h-8" />
              </div>
              <Title3 className="text-red-800 mb-2">Failed to Load Dashboard</Title3>
              <Body1 className="text-red-600 mb-6">
                Unable to fetch compliance data. Please try refreshing.
              </Body1>
              <Button
                appearance="primary"
                onClick={handleRefresh}
                icon={<ArrowSync24Regular />}
                style={{
                  backgroundColor: '#dc2626',
                  borderRadius: '8px',
                  border: '#dc2626'
                }}
                className="hover:bg-red-700 transition-colors duration-200"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <CheckmarkCircle24Regular className="text-red-600" />
                </div>
                <div>
                  <Title1 className="text-gray-900 font-semibold">Compliance Dashboard</Title1>
                  <Caption1 className="text-gray-500">Monitor compliance metrics and violations</Caption1>
                </div>
              </div>
              <LiveStatusIndicator
                status={isConnected ? 'compliant' : 'warning'}
                isConnected={isConnected}
                lastUpdate={new Date().toISOString()}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Time Range Controls */}
              <QuickDateRangeButtons
                onRangeSelect={handleTimeRangeChange}
                selectedRange={selectedTimeRange}
                className="hidden sm:flex"
              />

              <DateRangePicker
                value={selectedTimeRange}
                onChange={handleTimeRangeChange}
                className="w-full sm:w-auto"
              />

              {/* Refresh Controls */}
              <div className="flex items-center gap-2">
                <Select
                  value={refreshInterval.toString()}
                  onChange={(_, data) => setRefreshInterval(Number(data.value))}
                  className="w-24"
                >
                  <option value="30">30s</option>
                  <option value="60">1m</option>
                  <option value="300">5m</option>
                  <option value="0">Off</option>
                </Select>

                <Button
                  appearance="primary"
                  icon={<ArrowSync24Regular />}
                  onClick={handleRefresh}
                  disabled={metricsLoading}
                  style={{
                    backgroundColor: '#dc2626',
                    borderRadius: '8px',
                    border: '#dc2626'
                  }}
                  className="hover:bg-red-700 transition-colors duration-200"
                >
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {alertsData?.data && alertsData.data.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Warning24Regular className="text-red-600" />
              </div>
              <div className="flex-1">
                <Title3 className="text-red-800 mb-3">Active Compliance Alerts</Title3>
                <div className="space-y-3">
                  {alertsData.data.slice(0, 3).map((alert, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-100 hover:bg-red-50 transition-colors duration-200">
                      <span className="text-gray-700 font-medium">{alert.message}</span>
                      <Badge
                        appearance="filled"
                        color={alert.priority === 'high' ? 'danger' : 'warning'}
                        className="ml-3"
                      >
                        {alert.count} {alert.count === 1 ? 'item' : 'items'}
                      </Badge>
                    </div>
                  ))}
                  {alertsData.data.length > 3 && (
                    <Caption1 className="text-red-600 text-center">
                      +{alertsData.data.length - 3} more alerts
                    </Caption1>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Cards */}
        {metricsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Compliance Rate Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckmarkCircle24Regular className="text-green-600 w-6 h-6" />
                  </div>
                  <div>
                    <Body1 className="text-gray-900 font-semibold">Compliance Rate</Body1>
                    <Caption1 className="text-gray-500">Overall performance</Caption1>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {metricsData.complianceRate || 0}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      (metricsData.complianceRate || 0) >= 95 ? 'bg-green-500' :
                      (metricsData.complianceRate || 0) >= 80 ? 'bg-red-500' :
                      (metricsData.complianceRate || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(metricsData.complianceRate || 0, 100)}%` }}
                  />
                </div>
              </div>
              <Caption1 className={`font-medium ${
                (metricsData.complianceRate || 0) >= 95 ? 'text-green-600' :
                (metricsData.complianceRate || 0) >= 80 ? 'text-red-600' :
                (metricsData.complianceRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-700'
              }`}>
                {(metricsData.complianceRate || 0) >= 95 ? 'Excellent' :
                 (metricsData.complianceRate || 0) >= 80 ? 'Good' :
                 (metricsData.complianceRate || 0) >= 60 ? 'Needs Improvement' : 'Critical'}
              </Caption1>
            </div>

            {/* Total Violations Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    (metricsData.total_violations || 0) > 0 ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    <ErrorCircle24Regular className={`w-6 h-6 ${
                      (metricsData.total_violations || 0) > 0 ? 'text-red-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div>
                    <Body1 className="text-gray-900 font-semibold">Total Violations</Body1>
                    <Caption1 className="text-gray-500">Current period</Caption1>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-3">
                {metricsData.total_violations || 0}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    (metricsData.critical_violations || 0) > 0 ? 'bg-red-500' : 'bg-green-500'
                  }`} />
                  <Caption1 className="text-gray-600">
                    {metricsData.critical_violations || 0} critical
                  </Caption1>
                </div>
              </div>
            </div>

            {/* Resolution Rate Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <CheckmarkCircle24Regular className="text-red-600 w-6 h-6" />
                  </div>
                  <div>
                    <Body1 className="text-gray-900 font-semibold">Resolution Rate</Body1>
                    <Caption1 className="text-gray-500">Resolved issues</Caption1>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-3">
                {metricsData.resolutionRate || 0}%
              </div>
              <Caption1 className="text-gray-600">
                {metricsData.resolved_violations || 0} of {metricsData.total_violations || 0} resolved
              </Caption1>
            </div>

            {/* Average Resolution Time Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <Info24Regular className="text-red-600 w-6 h-6" />
                  </div>
                  <div>
                    <Body1 className="text-gray-900 font-semibold">Avg Resolution Time</Body1>
                    <Caption1 className="text-gray-500">Time to resolve</Caption1>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-3">
                {metricsData.average_resolution_time_hours &&
                 !isNaN(metricsData.average_resolution_time_hours) &&
                 isFinite(metricsData.average_resolution_time_hours)
                  ? `${Math.round(metricsData.average_resolution_time_hours)}h`
                  : 'N/A'
                }
              </div>
              <Caption1 className="text-gray-600">
                {metricsData.average_resolution_time_hours &&
                 !isNaN(metricsData.average_resolution_time_hours) &&
                 isFinite(metricsData.average_resolution_time_hours)
                  ? 'Average time to resolve'
                  : 'No data available'
                }
              </Caption1>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Trend Chart */}
          {complianceTrendChart && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <ArrowSync24Regular className="text-red-600 w-5 h-5" />
                  </div>
                  <Title3 className="text-gray-900 font-semibold">Compliance Trends</Title3>
                </div>
                <Caption1 className="text-gray-500">Last 7 days compliance rate and violation trends</Caption1>
              </div>
              <div className="h-64 p-2">
                <Line data={complianceTrendChart} options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      position: 'top' as const,
                      labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                          size: 12,
                          family: 'Inter, system-ui, sans-serif'
                        }
                      }
                    }
                  },
                  elements: {
                    point: {
                      radius: 4,
                      hoverRadius: 6
                    }
                  }
                }} />
              </div>
            </div>
          )}

          {/* Violation Breakdown Chart */}
          {violationBreakdownChart && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <ErrorCircle24Regular className="text-red-600 w-5 h-5" />
                  </div>
                  <Title3 className="text-gray-900 font-semibold">Violation Breakdown</Title3>
                </div>
                <Caption1 className="text-gray-500">Distribution of violations by type and severity</Caption1>
              </div>
              <div className="h-64 p-2">
                <Doughnut
                  data={violationBreakdownChart}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          usePointStyle: true,
                          padding: 15,
                          font: {
                            size: 11,
                            family: 'Inter, system-ui, sans-serif'
                          }
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                      }
                    },
                    elements: {
                      arc: {
                        borderWidth: 2,
                        borderColor: '#ffffff'
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Recent Violations */}
        {latestViolations.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-300">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Warning24Regular className="text-red-600 w-5 h-5" />
                </div>
                <Title3 className="text-gray-900 font-semibold">Recent Violations</Title3>
              </div>
              <Caption1 className="text-gray-500">Live violations detected in real-time</Caption1>
            </div>
            <div className="space-y-4">
              {latestViolations.slice(0, 5).map((violation) => (
                <div
                  key={violation.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-red-50 hover:border-red-200 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <ViolationSeverityBadge severity={violation.severity} size="small" />
                      <Body1 className="font-medium text-gray-900">{violation.user_data.full_name}</Body1>
                    </div>
                    <Caption1 className="text-gray-600 mb-2">{violation.description}</Caption1>
                    <Caption1 className="text-gray-500 flex items-center gap-1">
                      <Info24Regular className="w-3 h-3" />
                      {new Date(violation.created_at).toLocaleString()}
                    </Caption1>
                  </div>
                  <div className="ml-4">
                    <Badge appearance="outline" className="bg-white border-gray-300">
                      {violation.violation_type_display}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceDashboard;