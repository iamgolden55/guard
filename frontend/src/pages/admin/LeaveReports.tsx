import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IStackTokens,
  DefaultButton,
  IconButton,
  Pivot,
  PivotItem
} from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import {
  LeaveStatistics,
  LeaveType,
  LeaveRequestFilterOptions
} from '../../types/leave';
import LeaveAnalyticsDashboard from '../../components/leave/LeaveAnalyticsDashboard';
import ReportFilters from '../../components/leave/ReportFilters';
import ExportReportButton from '../../components/leave/ExportReportButton';

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

const stackTokens: IStackTokens = {
  childrenGap: 24,
  padding: 16,
};

const LeaveReports: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [statistics, setStatistics] = useState<LeaveStatistics | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [filters, setFilters] = useState<LeaveRequestFilterOptions>({});
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to load reports data. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  }, [authState.token, authState.user]);

  // Initial load
  useEffect(() => {
    fetchReportsData();
  }, [fetchReportsData, refreshTrigger]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: LeaveRequestFilterOptions) => {
    setFilters(newFilters);
    // In a real implementation, you would refetch data with these filters
    console.log('Filters changed:', newFilters);
  }, []);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setFilters({});
    // In a real implementation, you would refetch data without filters
    console.log('Filters reset');
  }, []);

  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'xlsx' | 'pdf', options: ExportOptions) => {
    setIsExporting(true);
    try {
      // Generate filename
      const fileName = options.customFileName || `leave_report_${new Date().toISOString().split('T')[0]}`;

      // In a real implementation, you would call your export service
      console.log('Exporting report:', { format, options, filters });

      // Simulate export delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For demonstration, we'll use the existing leaveService export method
      if (format === 'csv') {
        const blob = await leaveService.exportLeaveRequests('csv', filters);
        downloadBlob(blob, `${fileName}.csv`);
      } else {
        // For xlsx and pdf, you would implement additional export endpoints
        setNotification({
          type: MessageBarType.info,
          message: `${format.toUpperCase()} export functionality would be implemented here.`
        });
      }

    } catch (error) {
      console.error('Export error:', error);
      throw error; // Re-throw to be handled by ExportReportButton
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

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

      setNotification({
        type: MessageBarType.success,
        message: `Analytics exported successfully as ${format.toUpperCase()}!`
      });
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to export analytics. Please try again.'
      });
    }
  }, [handleExport, filters]);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (isLoading) {
    return (
      <div className="leave-reports-page">
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading reports..." />
        </Stack>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <Stack tokens={stackTokens}>
        {/* Page Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack>
            <Text variant="xxLarge" styles={{ root: { fontWeight: 600 } }}>
              Leave Reports & Analytics
            </Text>
            <Text variant="medium" styles={{ root: { color: '#666' } }}>
              Comprehensive insights into leave patterns, trends, and organizational metrics
            </Text>
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <ExportReportButton
              filters={filters}
              onExport={handleExport}
              isExporting={isExporting}
            />
            <IconButton
              iconProps={{ iconName: 'Refresh' }}
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              title="Refresh data"
            />
          </Stack>
        </Stack>

        {/* Notification */}
        {notification && (
          <MessageBar
            messageBarType={notification.type}
            onDismiss={() => setNotification(null)}
            dismissButtonAriaLabel="Close"
          >
            {notification.message}
          </MessageBar>
        )}

        {/* Report Filters */}
        <ReportFilters
          leaveTypes={leaveTypes}
          onFiltersChange={handleFiltersChange}
          onReset={handleResetFilters}
          initialFilters={filters}
        />

        {/* Main Content */}
        <Pivot>
          <PivotItem headerText="Dashboard Overview">
            <LeaveAnalyticsDashboard
              statistics={statistics}
              leaveTypes={leaveTypes}
              isLoading={isLoading}
              onRefresh={handleAnalyticsRefresh}
              onExport={handleAnalyticsExport}
            />
          </PivotItem>

          <PivotItem headerText="Detailed Reports">
            <Stack tokens={{ childrenGap: 16 }}>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <Stack tokens={{ childrenGap: 8 }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                        Report Period
                      </Text>
                      <IconButton iconProps={{ iconName: 'Calendar' }} />
                    </Stack>
                    <Text variant="small" styles={{ root: { color: '#666' } }}>
                      {filters.start_date && filters.end_date
                        ? `${new Date(filters.start_date).toLocaleDateString()} - ${new Date(filters.end_date).toLocaleDateString()}`
                        : 'All Time'
                      }
                    </Text>
                  </Stack>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <Stack tokens={{ childrenGap: 8 }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                        Data Points
                      </Text>
                      <IconButton iconProps={{ iconName: 'Database' }} />
                    </Stack>
                    <Text variant="large" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                      {statistics?.total_requests || 0}
                    </Text>
                    <Text variant="small" styles={{ root: { color: '#666' } }}>
                      Leave requests analyzed
                    </Text>
                  </Stack>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                  <Stack tokens={{ childrenGap: 8 }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                        Last Updated
                      </Text>
                      <IconButton iconProps={{ iconName: 'Refresh' }} />
                    </Stack>
                    <Text variant="small" styles={{ root: { color: '#666' } }}>
                      {new Date().toLocaleString()}
                    </Text>
                  </Stack>
                </div>
              </div>

              {/* Detailed Report Tables - Placeholder */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                    Detailed Leave Request Data
                  </Text>

                  <div className="text-center py-12">
                    <IconButton iconProps={{ iconName: 'Table' }} styles={{ root: { fontSize: 48, marginBottom: 16 } }} />
                    <Text variant="medium" styles={{ root: { color: '#666', marginBottom: 16 } }}>
                      Detailed tabular reports would be displayed here
                    </Text>
                    <Text variant="small" styles={{ root: { color: '#666' } }}>
                      This would include sortable, filterable tables with individual leave request details,
                      employee information, approval timelines, and other granular data points.
                    </Text>
                  </div>
                </Stack>
              </div>
            </Stack>
          </PivotItem>

          <PivotItem headerText="Scheduled Reports">
            <Stack tokens={{ childrenGap: 16 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                  Automated Report Schedule
                </Text>
                <DefaultButton
                  text="New Scheduled Report"
                  iconProps={{ iconName: 'Add' }}
                />
              </Stack>

              {/* Scheduled Reports Placeholder */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="text-center py-12">
                  <IconButton iconProps={{ iconName: 'ClockSchedule' }} styles={{ root: { fontSize: 48, marginBottom: 16 } }} />
                  <Text variant="medium" styles={{ root: { color: '#666', marginBottom: 16 } }}>
                    No scheduled reports configured
                  </Text>
                  <Text variant="small" styles={{ root: { color: '#666' } }}>
                    Set up automated reports to be generated and delivered on a regular schedule.
                    Perfect for monthly manager reports, quarterly analytics, or annual summaries.
                  </Text>
                </div>
              </div>
            </Stack>
          </PivotItem>

          <PivotItem headerText="Custom Reports">
            <Stack tokens={{ childrenGap: 16 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="large" styles={{ root: { fontWeight: 600 } }}>
                  Custom Report Builder
                </Text>
                <DefaultButton
                  text="Build Custom Report"
                  iconProps={{ iconName: 'ReportDocument' }}
                />
              </Stack>

              {/* Custom Report Builder Placeholder */}
              <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="text-center py-12">
                  <IconButton iconProps={{ iconName: 'ReportDocument' }} styles={{ root: { fontSize: 48, marginBottom: 16 } }} />
                  <Text variant="medium" styles={{ root: { color: '#666', marginBottom: 16 } }}>
                    Custom report builder coming soon
                  </Text>
                  <Text variant="small" styles={{ root: { color: '#666' } }}>
                    Create custom reports with drag-and-drop fields, custom calculations,
                    and personalized visualizations tailored to your organization's needs.
                  </Text>
                </div>
              </div>
            </Stack>
          </PivotItem>
        </Pivot>
      </Stack>
    </div>
  );
};

export default LeaveReports;