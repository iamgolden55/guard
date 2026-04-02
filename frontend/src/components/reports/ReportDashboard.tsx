import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  Button,
  Text,
  Title1,
  Title3,
  Badge,
  Spinner,
  MessageBar,
  SearchBox,
  Dropdown,
  Option,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem
} from '@fluentui/react-components';
import {
  ArrowClockwiseRegular,
  AddRegular,
  FilterRegular,
  MoreHorizontalRegular,
  ArrowArrowDownloadRegular,
  PlayRegular,
  DismissRegular,
  ErrorCircleRegular,
  CheckmarkCircleRegular,
  ClockRegular
} from '@fluentui/react-icons';
import { useReportJobs } from '../../hooks/useReportJobs';
import { ReportJobStatus, ExportFormat } from '../../types/reports';
import reportService from '../../services/reportService';
import { useToast } from '../shared/ToastNotificationSystem';
import { ReportDashboardSkeleton, EmptyState } from '../shared/LoadingSkeletons';
import ErrorBoundary from '../shared/ErrorBoundary';
// import AsyncProgressTracker from './AsyncProgressTracker';

interface ReportDashboardProps {
  onCreateReport?: () => void;
  showCreateButton?: boolean;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({
  onCreateReport,
  showCreateButton = true
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Toast notifications
  const toast = useToast();

  const {
    jobs,
    loading,
    error,
    totalJobs,
    refreshJobs,
    cancelJob,
    retryJob,
    deleteJob,
    updateFilters
  } = useReportJobs({
    autoRefresh: true,
    refreshInterval: 10000,
    pollActiveJobs: true,
    filters: {
      search: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : [statusFilter as ReportJobStatus],
      format: formatFilter === 'all' ? undefined : [formatFilter as ExportFormat],
      limit: 20
    }
  });

  // Load dashboard statistics
  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        const stats = await reportService.getJobSummary();
        setDashboardStats(stats);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      }
    };

    loadDashboardStats();
  }, [jobs?.length]); // Refresh stats when jobs change

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshJobs();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    updateFilters({
      search: value || undefined,
      status: statusFilter === 'all' ? undefined : [statusFilter as ReportJobStatus],
      format: formatFilter === 'all' ? undefined : [formatFilter as ExportFormat],
      limit: 20
    });
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    updateFilters({
      search: searchTerm || undefined,
      status: status === 'all' ? undefined : [status as ReportJobStatus],
      format: formatFilter === 'all' ? undefined : [formatFilter as ExportFormat],
      limit: 20
    });
  };

  const handleFormatFilter = (format: string) => {
    setFormatFilter(format);
    updateFilters({
      search: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : [statusFilter as ReportJobStatus],
      format: format === 'all' ? undefined : [format as ExportFormat],
      limit: 20
    });
  };

  const handleDownload = async (jobId: string) => {
    try {
      const blob = await reportService.downloadReport(jobId);
      const job = jobs?.find(j => j.id === jobId);
      if (job) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${job.title}.${job.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.showSuccess(
          'Download Started',
          `"${job.title}" is being downloaded to your device.`
        );
      }
    } catch (err) {
      console.error('Failed to download report:', err);
      toast.showError(
        'Download Failed',
        'Unable to download the report. Please try again.'
      );
    }
  };

  const getStatusBadge = (status: ReportJobStatus) => {
    switch (status) {
      case ReportJobStatus.COMPLETED:
        return (
          <Badge appearance="filled" color="success" icon={<CheckmarkCircleRegular />}>
            Completed
          </Badge>
        );
      case ReportJobStatus.PROCESSING:
        return (
          <Badge appearance="filled" color="important" icon={<Spinner size="tiny" />}>
            Processing
          </Badge>
        );
      case ReportJobStatus.PENDING:
        return (
          <Badge appearance="outline" color="neutral" icon={<ClockRegular />}>
            Pending
          </Badge>
        );
      case ReportJobStatus.FAILED:
        return (
          <Badge appearance="filled" color="danger" icon={<ErrorCircleRegular />}>
            Failed
          </Badge>
        );
      case ReportJobStatus.CANCELLED:
        return (
          <Badge appearance="outline" color="warning" icon={<DismissRegular />}>
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge appearance="outline" color="neutral">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatProgress = (progress: number) => {
    return `${Math.round(progress)}%`;
  };

  const isActiveStatus = (status: ReportJobStatus) => {
    return [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(status);
  };

  if (loading && !jobs?.length) {
    return <ReportDashboardSkeleton />;
  }

  return (
    <ErrorBoundary>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        animation: 'fadeIn 0.3s ease-in-out'
      }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title1>Report Dashboard</Title1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            icon={<ArrowClockwiseRegular />}
            appearance="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          {showCreateButton && (
            <Button
              icon={<AddRegular />}
              appearance="primary"
              onClick={onCreateReport}
              style={{ backgroundColor: '#d13438', borderColor: '#d13438' }}
            >
              Create Report
            </Button>
          )}
        </div>
      </div>

      {error && (
        <MessageBar intent="error">
          {error}
        </MessageBar>
      )}

      {/* Statistics Cards */}
      {dashboardStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <Card>
            <CardHeader>
              <Title3>Total Reports</Title3>
            </CardHeader>
            <div>
              <Text size="large" weight="semibold">{dashboardStats.total_jobs}</Text>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <Title3>Recent Jobs</Title3>
            </CardHeader>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Text>Completed: {dashboardStats.completed_jobs || 0}</Text>
                <Text>Processing: {dashboardStats.active_jobs || 0}</Text>
                <Text>Failed: {dashboardStats.failed_jobs || 0}</Text>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <Title3>Performance</Title3>
            </CardHeader>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Text>Success Rate: {dashboardStats.success_rate || 0}%</Text>
                <Text>This Month: {dashboardStats.this_month_jobs || 0} jobs</Text>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <SearchBox
          placeholder="Search reports..."
          value={searchTerm}
          onChange={(_, data) => handleSearch(data.value)}
          style={{ minWidth: '250px' }}
        />

        <Dropdown
          placeholder="Status"
          value={statusFilter}
          selectedOptions={[statusFilter]}
          onOptionSelect={(_, data) => handleStatusFilter(data.optionValue as string)}
        >
          <Option value="all">All Status</Option>
          <Option value={ReportJobStatus.COMPLETED}>Completed</Option>
          <Option value={ReportJobStatus.PROCESSING}>Processing</Option>
          <Option value={ReportJobStatus.PENDING}>Pending</Option>
          <Option value={ReportJobStatus.FAILED}>Failed</Option>
          <Option value={ReportJobStatus.CANCELLED}>Cancelled</Option>
        </Dropdown>

        <Dropdown
          placeholder="Format"
          value={formatFilter}
          selectedOptions={[formatFilter]}
          onOptionSelect={(_, data) => handleFormatFilter(data.optionValue as string)}
        >
          <Option value="all">All Formats</Option>
          <Option value={ExportFormat.CSV}>CSV</Option>
          <Option value={ExportFormat.EXCEL}>Excel</Option>
          <Option value={ExportFormat.PDF}>PDF</Option>
          <Option value={ExportFormat.JSON}>JSON</Option>
        </Dropdown>
      </div>

      {/* Active Jobs Progress */}
      {jobs?.filter(job => isActiveStatus(job.status)).length > 0 && (
        <Card>
          <CardHeader>
            <Title3>Active Jobs</Title3>
          </CardHeader>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {jobs
                ?.filter(job => isActiveStatus(job.status))
                .map(job => (
                  <div key={job.id} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                    <Text weight="semibold">{job.title}</Text>
                    <div style={{ marginTop: '4px' }}>
                      <Text size="small">Status: {job.status}</Text>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title3>Recent Reports ({totalJobs})</Title3>
            <Button
              icon={<FilterRegular />}
              appearance="subtle"
              size="small"
            >
              Advanced Filters
            </Button>
          </div>
        </CardHeader>
        <div>
          {(jobs?.length ?? 0) === 0 ? (
            <EmptyState
              title="No reports found"
              description="Create your first report to get started with analytics and data exports."
              action={showCreateButton ? {
                label: 'Create Report',
                onClick: onCreateReport || (() => {})
              } : undefined}
              icon={<ErrorCircleRegular />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Format</TableHeaderCell>
                  <TableHeaderCell>Progress</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs?.map(job => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div>
                        <Text weight="semibold">{job.title}</Text>
                        <Text size="small" style={{ display: 'block', color: '#666' }}>
                          {job.reportType}
                        </Text>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell>
                      <Badge appearance="outline">
                        {job.format.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isActiveStatus(job.status) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '60px',
                            height: '4px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${job.progress}%`,
                              height: '100%',
                              backgroundColor: '#0078d4',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                          <Text size="small">{formatProgress(job.progress)}</Text>
                        </div>
                      ) : (
                        <Text>-</Text>
                      )}
                    </TableCell>
                    <TableCell>
                      <Text size="small">
                        {formatDate(job.createdAt)}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Menu>
                        <MenuTrigger>
                          <Button
                            icon={<MoreHorizontalRegular />}
                            appearance="subtle"
                            size="small"
                          />
                        </MenuTrigger>
                        <MenuPopover>
                          <MenuList>
                            {job.status === ReportJobStatus.COMPLETED && (
                              <MenuItem
                                icon={<ArrowDownloadRegular />}
                                onClick={() => handleDownload(job.id)}
                              >
                                Download
                              </MenuItem>
                            )}
                            {isActiveStatus(job.status) && (
                              <MenuItem
                                icon={<DismissRegular />}
                                onClick={() => cancelJob(job.id)}
                              >
                                Cancel
                              </MenuItem>
                            )}
                            {job.status === ReportJobStatus.FAILED && (
                              <MenuItem
                                icon={<PlayRegular />}
                                onClick={() => retryJob(job.id)}
                              >
                                Retry
                              </MenuItem>
                            )}
                            {[ReportJobStatus.COMPLETED, ReportJobStatus.FAILED, ReportJobStatus.CANCELLED].includes(job.status) && (
                              <MenuItem
                                icon={<DismissRegular />}
                                onClick={() => deleteJob(job.id)}
                              >
                                Delete
                              </MenuItem>
                            )}
                          </MenuList>
                        </MenuPopover>
                      </Menu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>


      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideIn {
          from { transform: translateX(-10px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .card-hover {
          transition: all 0.2s ease-in-out;
        }

        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }

        .progress-animation {
          transition: width 0.3s ease-in-out;
        }

        .badge-animation {
          animation: slideIn 0.2s ease-in-out;
        }
      `}</style>
      </div>
    </ErrorBoundary>
  );
};

export default ReportDashboard;