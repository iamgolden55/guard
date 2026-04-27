import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import api from '../../services/api';
import {
  LeaveStatistics,
  LeaveType,
  LeaveRequestFilterOptions
} from '../../types/leave';
import LeaveAnalyticsDashboard from '../../components/leave/LeaveAnalyticsDashboard';
import ReportFilters from '../../components/leave/ReportFilters';
import ExportReportButton from '../../components/leave/ExportReportButton';
import LeaveRequestsTable from '../../components/leave/LeaveRequestsTable';
import { Header, Container, SpaceBetween, EmptyState } from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';

interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf';
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  customFileName?: string;
  dateRange: {
    start?: string;
    end?: string;
  };
}

const LeaveReports: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [statistics, setStatistics] = useState<LeaveStatistics | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [filters, setFilters] = useState<LeaveRequestFilterOptions>({});
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'detailed' | 'scheduled' | 'custom'>('dashboard');

  // Fetch reports data
  const fetchReportsData = useCallback(async () => {
    if (!authState.user) return;

    setIsLoading(true);
    try {
      // Fetch statistics and leave types in parallel
      const [statisticsResponse, leaveTypesResponse] = await Promise.all([
        leaveService.getLeaveStatistics(new Date().getFullYear()),
        leaveService.getLeaveTypes(false) // Include inactive types for comprehensive reporting
      ]);

      setStatistics(statisticsResponse);
      setLeaveTypes(leaveTypesResponse);

    } catch (error) {
      console.error('Error fetching reports data:', error);
      addFlash({ type: 'error', content: 'Failed to load reports data. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [authState.user]);

  // Initial load
  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData, refreshTrigger]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: LeaveRequestFilterOptions) => {
    setFilters(newFilters);
  }, []);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setFilters({});
    console.log('Filters reset');
  }, []);

  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'xlsx' | 'pdf', options: ExportOptions) => {
    if (!authState.user) {
      addFlash({ type: 'error', content: 'Authentication required for export' });
      return;
    }

    setIsExporting(true);
    try {
      // Generate filename
      const fileName = options.customFileName || `leave_report_${new Date().toISOString().split('T')[0]}`;

      // Build query parameters from filters
      const params = new URLSearchParams();
      const year = new Date().getFullYear();
      params.append('year', year.toString());

      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.leave_type && filters.leave_type.length > 0) {
        filters.leave_type.forEach(id => params.append('leave_type', id.toString()));
      }
      if (filters.status && filters.status.length > 0) {
        filters.status.forEach(status => params.append('status', status));
      }
      if (filters.department && filters.department.length > 0) {
        filters.department.forEach(dept => params.append('department', dept));
      }

      let endpoint: string;
      let fileExtension: string;

      if (format === 'csv') {
        endpoint = `/api/v1/leave/reports/export_csv/?${params.toString()}`;
        fileExtension = 'csv';
      } else if (format === 'xlsx') {
        endpoint = `/api/v1/leave/reports/export_xlsx/?${params.toString()}`;
        fileExtension = 'xlsx';
      } else if (format === 'pdf') {
        endpoint = `/api/v1/leave/reports/export_pdf/?${params.toString()}`;
        fileExtension = 'pdf';
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }

      // Fetch the file from backend
      const response = await api.get(endpoint, { responseType: 'blob' });

      // Download the file
      downloadBlob(response.data, `${fileName}.${fileExtension}`);

    } catch (error) {
      console.error('Export error:', error);
      throw error; // Re-throw to be handled by ExportReportButton
    } finally {
      setIsExporting(false);
    }
  }, [filters, authState.user]);

  // Utility function to download blob
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  // Handle analytics refresh
  const handleAnalyticsRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Handle analytics export
  const handleAnalyticsExport = useCallback(async (format: 'csv' | 'pdf') => {
    try {
      await handleExport(format, {
        format,
        includeCharts: format === 'pdf',
        includeSummary: true,
        includeDetails: true,
        dateRange: {
          start: filters.start_date,
          end: filters.end_date
        }
      });

      addFlash({ type: 'success', content: `Analytics exported successfully as ${format.toUpperCase()}!` });
    } catch (error) {
      addFlash({ type: 'error', content: 'Failed to export analytics. Please try again.' });
    }
  }, [handleExport, filters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading reports...</span>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'dashboard', label: 'Dashboard Overview' },
    { key: 'detailed', label: 'Detailed Reports' },
    { key: 'scheduled', label: 'Scheduled Reports' },
    { key: 'custom', label: 'Custom Reports' },
  ] as const;

  return (
    <div className="max-w-7xl">
      <SpaceBetween size="l">
        {/* Page Header */}
        <Header
          variant="h1"
          description="Comprehensive insights into leave patterns, trends, and organizational metrics"
          actions={
            <div className="flex items-center gap-2">
              <ExportReportButton
                filters={filters}
                onExport={handleExport}
                isExporting={isExporting}
              />
              <button
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh data"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          }
        >
          Leave Reports & Analytics
        </Header>

        <Flashbar items={flashItems} onDismiss={removeFlash} />

        {/* Report Filters */}
        <ReportFilters
          leaveTypes={leaveTypes}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
          initialFilters={filters}
        />

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={
                  activeTab === tab.key
                    ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                    : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                }
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <LeaveAnalyticsDashboard
            statistics={statistics}
            leaveTypes={leaveTypes}
            isLoading={isLoading}
            filters={filters}
            onRefresh={handleAnalyticsRefresh}
            onExport={handleAnalyticsExport}
          />
        )}

        {activeTab === 'detailed' && (
          <SpaceBetween size="m">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Container>
                <SpaceBetween size="xs">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Report Period</p>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500">
                    {filters.start_date && filters.end_date
                      ? `${new Date(filters.start_date).toLocaleDateString()} - ${new Date(filters.end_date).toLocaleDateString()}`
                      : 'All Time'
                    }
                  </p>
                </SpaceBetween>
              </Container>

              <Container>
                <SpaceBetween size="xs">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Data Points</p>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{statistics?.total_requests || 0}</p>
                  <p className="text-xs text-gray-500">Leave requests analyzed</p>
                </SpaceBetween>
              </Container>

              <Container>
                <SpaceBetween size="xs">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Last Updated</p>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
                </SpaceBetween>
              </Container>
            </div>

            {/* Detailed Leave Requests Table */}
            <Container>
              <SpaceBetween size="m">
                <h3 className="text-lg font-semibold text-gray-900">Detailed Leave Request Data</h3>
                <LeaveRequestsTable
                  filters={filters}
                  onRefresh={handleAnalyticsRefresh}
                />
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        )}

        {activeTab === 'scheduled' && (
          <SpaceBetween size="m">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Automated Report Schedule</h3>
              <button className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                New Scheduled Report
              </button>
            </div>
            <Container>
              <EmptyState
                title="No scheduled reports configured"
                description="Set up automated reports to be generated and delivered on a regular schedule. Perfect for monthly manager reports, quarterly analytics, or annual summaries."
                icon={
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
            </Container>
          </SpaceBetween>
        )}

        {activeTab === 'custom' && (
          <SpaceBetween size="m">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Custom Report Builder</h3>
              <button className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Build Custom Report
              </button>
            </div>
            <Container>
              <EmptyState
                title="Custom report builder coming soon"
                description="Create custom reports with drag-and-drop fields, custom calculations, and personalized visualizations tailored to your organization's needs."
                icon={
                  <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
            </Container>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </div>
  );
};

export default LeaveReports;
