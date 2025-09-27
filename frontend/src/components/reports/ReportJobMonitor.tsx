import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  Text,
  Title3,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Checkbox,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  SearchBox,
  Dropdown,
  Option,
  MessageBar,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogBody,
  Spinner,
  Tooltip
} from '@fluentui/react-components';
import {
  MoreHorizontalRegular,
  SelectAllOnRegular,
  SelectAllOffRegular,
  ArrowArrowDownloadRegular,
  PlayRegular,
  DismissRegular,
  DeleteRegular,
  FilterRegular,
  ChartMultipleRegular,
  CalendarRegular,
  ClockRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular
} from '@fluentui/react-icons';
import { useReportJobs } from '../../hooks/useReportJobs';
import { ReportJobStatus, ExportFormat, ReportMetrics } from '../../types/reports';
import reportService from '../../services/reportService';

interface ReportJobMonitorProps {
  showTitle?: boolean;
  maxHeight?: string;
  showBulkActions?: boolean;
  showMetrics?: boolean;
}

const ReportJobMonitor: React.FC<ReportJobMonitorProps> = ({
  showTitle = true,
  maxHeight = '600px',
  showBulkActions = true,
  showMetrics = true
}) => {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bulkOperationInProgress, setBulkOperationInProgress] = useState(false);
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);

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
    refreshInterval: 5000, // Refresh every 5 seconds for monitoring
    pollActiveJobs: true,
    filters: {
      search: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : [statusFilter as ReportJobStatus],
      format: formatFilter === 'all' ? undefined : [formatFilter as ExportFormat],
      limit: 50 // Show more jobs for monitoring
    }
  });

  // Load metrics
  useEffect(() => {
    if (showMetrics) {
      const loadMetrics = async () => {
        try {
          const metricsData = await reportService.getReportMetrics('7d');
          setMetrics(metricsData);
        } catch (err) {
          console.error('Failed to load metrics:', err);
        }
      };

      loadMetrics();
      const interval = setInterval(loadMetrics, 30000); // Refresh metrics every 30 seconds
      return () => clearInterval(interval);
    }
  }, [showMetrics, jobs?.length]);

  const handleSelectAll = () => {
    if (selectedJobs.length === (jobs?.length || 0)) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs?.map(job => job.id) || []);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleBulkCancel = async () => {
    setBulkOperationInProgress(true);
    try {
      const activeJobs = selectedJobs.filter(jobId => {
        const job = jobs?.find(j => j.id === jobId);
        return job && [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(job.status);
      });

      const result = await reportService.bulkJobAction({
        jobIds: activeJobs,
        action: 'cancel'
      });

      console.log(`Cancelled ${result.success.length} jobs, ${result.failed.length} failed`);
      setSelectedJobs([]);
      await refreshJobs();
    } catch (err) {
      console.error('Bulk cancel failed:', err);
    } finally {
      setBulkOperationInProgress(false);
    }
  };

  const handleBulkRetry = async () => {
    setBulkOperationInProgress(true);
    try {
      const failedJobs = selectedJobs.filter(jobId => {
        const job = jobs?.find(j => j.id === jobId);
        return job && job.status === ReportJobStatus.FAILED;
      });

      const result = await reportService.bulkJobAction({
        jobIds: failedJobs,
        action: 'retry'
      });

      console.log(`Retried ${result.success.length} jobs, ${result.failed.length} failed`);
      setSelectedJobs([]);
      await refreshJobs();
    } catch (err) {
      console.error('Bulk retry failed:', err);
    } finally {
      setBulkOperationInProgress(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkOperationInProgress(true);
    try {
      const completedJobs = selectedJobs.filter(jobId => {
        const job = jobs?.find(j => j.id === jobId);
        return job && [ReportJobStatus.COMPLETED, ReportJobStatus.FAILED, ReportJobStatus.CANCELLED].includes(job.status);
      });

      const result = await reportService.bulkJobAction({
        jobIds: completedJobs,
        action: 'delete'
      });

      console.log(`Deleted ${result.success.length} jobs, ${result.failed.length} failed`);
      setSelectedJobs([]);
      await refreshJobs();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkOperationInProgress(false);
      setShowDeleteDialog(false);
    }
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
      }
    } catch (err) {
      console.error('Failed to download report:', err);
    }
  };

  const getStatusIcon = (status: ReportJobStatus) => {
    switch (status) {
      case ReportJobStatus.COMPLETED:
        return <CheckmarkCircleRegular style={{ color: '#107c10' }} />;
      case ReportJobStatus.PROCESSING:
      case ReportJobStatus.RETRYING:
        return <span style={{ color: '#0078d4', animation: 'spin 1s linear infinite' }}>⚙️</span>;
      case ReportJobStatus.PENDING:
        return <ClockRegular style={{ color: '#797775' }} />;
      case ReportJobStatus.FAILED:
        return <ErrorCircleRegular style={{ color: '#d83b01' }} />;
      case ReportJobStatus.CANCELLED:
        return <DismissRegular style={{ color: '#ca5010' }} />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ReportJobStatus) => {
    const colors = {
      [ReportJobStatus.COMPLETED]: 'success',
      [ReportJobStatus.PROCESSING]: 'important',
      [ReportJobStatus.RETRYING]: 'important',
      [ReportJobStatus.PENDING]: 'neutral',
      [ReportJobStatus.FAILED]: 'danger',
      [ReportJobStatus.CANCELLED]: 'warning'
    };

    return (
      <Badge appearance="filled" color={colors[status] as any}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const seconds = Math.floor(durationMs / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const canCancelJob = (status: ReportJobStatus) => {
    return [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(status);
  };

  const canRetryJob = (status: ReportJobStatus) => {
    return status === ReportJobStatus.FAILED;
  };

  const canDeleteJob = (status: ReportJobStatus) => {
    return [ReportJobStatus.COMPLETED, ReportJobStatus.FAILED, ReportJobStatus.CANCELLED].includes(status);
  };

  const renderMetrics = () => {
    if (!showMetrics || !metrics) return null;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <Card size="small">
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChartMultipleRegular style={{ color: '#0078d4' }} />
              <div>
                <Text size="small" style={{ display: 'block', color: '#666' }}>Success Rate</Text>
                <Text weight="semibold">{Math.round(metrics.successRate * 100)}%</Text>
              </div>
            </div>
          </div>
        </Card>

        <Card size="small">
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClockRegular style={{ color: '#ca5010' }} />
              <div>
                <Text size="small" style={{ display: 'block', color: '#666' }}>Avg Time</Text>
                <Text weight="semibold">{Math.round(metrics.averageProcessingTime)}s</Text>
              </div>
            </div>
          </div>
        </Card>

        <Card size="small">
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarRegular style={{ color: '#107c10' }} />
              <div>
                <Text size="small" style={{ display: 'block', color: '#666' }}>Total Jobs</Text>
                <Text weight="semibold">{metrics.totalJobs}</Text>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderBulkActions = () => {
    if (!showBulkActions || selectedJobs.length === 0) return null;

    const selectedJobObjects = jobs?.filter(job => selectedJobs.includes(job.id)) || [];
    const canCancel = selectedJobObjects.some(job => canCancelJob(job.status));
    const canRetry = selectedJobObjects.some(job => canRetryJob(job.status));
    const canDelete = selectedJobObjects.some(job => canDeleteJob(job.status));

    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <Text weight="semibold">{selectedJobs.length} selected</Text>

        {canCancel && (
          <Button
            size="small"
            appearance="secondary"
            icon={<DismissRegular />}
            onClick={handleBulkCancel}
            disabled={bulkOperationInProgress}
          >
            Cancel
          </Button>
        )}

        {canRetry && (
          <Button
            size="small"
            appearance="secondary"
            icon={<PlayRegular />}
            onClick={handleBulkRetry}
            disabled={bulkOperationInProgress}
          >
            Retry
          </Button>
        )}

        {canDelete && (
          <>
            <DialogTrigger>
              <Button
                size="small"
                appearance="secondary"
                icon={<DeleteRegular />}
                disabled={bulkOperationInProgress}
              >
                Delete
              </Button>
            </DialogTrigger>

            <Dialog open={showDeleteDialog} onOpenChange={(_, data) => setShowDeleteDialog(data.open)}>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>Confirm Bulk Delete</DialogTitle>
                  <DialogContent>
                    Are you sure you want to delete {selectedJobs.length} selected job(s)? This action cannot be undone.
                  </DialogContent>
                  <DialogActions>
                    <Button appearance="secondary" onClick={() => setShowDeleteDialog(false)}>
                      Cancel
                    </Button>
                    <Button appearance="primary" onClick={handleBulkDelete}>
                      Delete
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          </>
        )}

        <Button
          size="small"
          appearance="subtle"
          onClick={() => setSelectedJobs([])}
        >
          Clear Selection
        </Button>
      </div>
    );
  };

  if (loading && !jobs?.length) {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', padding: '16px' }}>
          <Spinner size="medium" label="Loading jobs..." />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title3>Job Monitor</Title3>
            <Button
              icon={<FilterRegular />}
              appearance="subtle"
              size="small"
            >
              {totalJobs} jobs
            </Button>
          </div>
        </CardHeader>
      )}

      <div style={{ padding: '16px' }}>
        {error && (
          <MessageBar intent="error" style={{ marginBottom: '16px' }}>
            {error}
          </MessageBar>
        )}

        {/* Metrics */}
        {renderMetrics()}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <SearchBox
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(_, data) => setSearchTerm(data.value)}
            style={{ minWidth: '200px' }}
          />

          <Dropdown
            placeholder="Status"
            value={statusFilter}
            selectedOptions={[statusFilter]}
            onOptionSelect={(_, data) => setStatusFilter(data.optionValue as string)}
          >
            <Option value="all">All Status</Option>
            <Option value={ReportJobStatus.PROCESSING}>Processing</Option>
            <Option value={ReportJobStatus.PENDING}>Pending</Option>
            <Option value={ReportJobStatus.COMPLETED}>Completed</Option>
            <Option value={ReportJobStatus.FAILED}>Failed</Option>
            <Option value={ReportJobStatus.CANCELLED}>Cancelled</Option>
          </Dropdown>

          <Dropdown
            placeholder="Format"
            value={formatFilter}
            selectedOptions={[formatFilter]}
            onOptionSelect={(_, data) => setFormatFilter(data.optionValue as string)}
          >
            <Option value="all">All Formats</Option>
            <Option value={ExportFormat.CSV}>CSV</Option>
            <Option value={ExportFormat.EXCEL}>Excel</Option>
            <Option value={ExportFormat.PDF}>PDF</Option>
            <Option value={ExportFormat.JSON}>JSON</Option>
          </Dropdown>
        </div>

        {/* Bulk Actions */}
        {renderBulkActions()}

        {/* Jobs Table */}
        <div style={{ maxHeight, overflow: 'auto' }}>
          {(jobs?.length || 0) === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text>No jobs found matching the current filters.</Text>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell style={{ width: '40px' }}>
                    <Checkbox
                      checked={selectedJobs.length === (jobs?.length || 0) && (jobs?.length || 0) > 0}
                      indeterminate={selectedJobs.length > 0 && selectedJobs.length < (jobs?.length || 0)}
                      onChange={handleSelectAll}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>Job</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Progress</TableHeaderCell>
                  <TableHeaderCell>Duration</TableHeaderCell>
                  <TableHeaderCell>Created</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs?.map(job => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onChange={(_, data) => handleSelectJob(job.id, data.checked!)}
                      />
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusIcon(job.status)}
                        <div>
                          <Text weight="semibold" style={{ display: 'block' }}>{job.title}</Text>
                          <Text size="small" style={{ color: '#666' }}>
                            {job.reportType} • {job.format.toUpperCase()}
                          </Text>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell>
                      {[ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(job.status) ? (
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
                          <Text size="small">{Math.round(job.progress)}%</Text>
                        </div>
                      ) : (
                        <Text>-</Text>
                      )}
                    </TableCell>
                    <TableCell>
                      <Text size="small">
                        {formatDuration(
                          job.createdAt,
                          job.completedAt || job.failedAt || job.cancelledAt
                        )}
                      </Text>
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
                            {canCancelJob(job.status) && (
                              <MenuItem
                                icon={<DismissRegular />}
                                onClick={() => cancelJob(job.id)}
                              >
                                Cancel
                              </MenuItem>
                            )}
                            {canRetryJob(job.status) && (
                              <MenuItem
                                icon={<PlayRegular />}
                                onClick={() => retryJob(job.id)}
                              >
                                Retry
                              </MenuItem>
                            )}
                            {canDeleteJob(job.status) && (
                              <MenuItem
                                icon={<DeleteRegular />}
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
      </div>
    </Card>
  );
};

export default ReportJobMonitor;