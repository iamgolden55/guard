import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  Selection,
  SelectionMode,
  CommandBar,
  ICommandBarItemProps,
  SearchBox,
  Dropdown,
  IDropdownOption,
  DatePicker,
  PrimaryButton,
  DefaultButton,
  Panel,
  PanelType,
  Text,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Stack,
  Icon,
  Persona,
  PersonaSize,
  Modal,
  Pivot,
  PivotItem,
  TooltipHost,
  DirectionalHint,
  Checkbox,
  Label,
  Link,
  ProgressIndicator
} from '@fluentui/react';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import { LeaveRequestStatus } from '../types/leave';
import type {
  LeaveRequest,
  LeaveRequestResponse,
  LeaveType,
  LeaveRequestFilterOptions,
  User
} from '../types/leave';

interface LeaveHistoryTableProps {
  userId?: number;
  showUserColumn?: boolean;
  compact?: boolean;
  maxHeight?: number;
  className?: string;
  defaultFilters?: LeaveRequestFilterOptions;
  onRequestSelect?: (request: LeaveRequest) => void;
}

interface RequestDetailsProps {
  request: LeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
  canEdit: boolean;
  onEdit?: (request: LeaveRequest) => void;
  onCancel?: (request: LeaveRequest) => void;
}

// Request details panel component
const RequestDetailsPanel: React.FC<RequestDetailsProps> = ({
  request,
  isOpen,
  onClose,
  canEdit,
  onEdit,
  onCancel
}) => {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!request || !onCancel) return;

    setIsCancelling(true);
    try {
      await onCancel(request);
    } catch (error) {
      console.error('Error cancelling request:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: LeaveRequestStatus) => {
    switch (status) {
      case LeaveRequestStatus.APPROVED:
        return '#107C10';
      case LeaveRequestStatus.PENDING:
        return '#FF8C00';
      case LeaveRequestStatus.REJECTED:
        return '#D13438';
      case LeaveRequestStatus.CANCELLED:
        return '#605E5C';
      case LeaveRequestStatus.WITHDRAWN:
        return '#8A8886';
      default:
        return '#323130';
    }
  };

  const getStatusIcon = (status: LeaveRequestStatus) => {
    switch (status) {
      case LeaveRequestStatus.APPROVED:
        return 'Accept';
      case LeaveRequestStatus.PENDING:
        return 'Clock';
      case LeaveRequestStatus.REJECTED:
        return 'Cancel';
      case LeaveRequestStatus.CANCELLED:
        return 'StatusCircleBlock';
      case LeaveRequestStatus.WITHDRAWN:
        return 'Undo';
      default:
        return 'Info';
    }
  };

  if (!request) return null;

  const statusColor = getStatusColor(request.status);
  const statusIcon = getStatusIcon(request.status);
  const canCancelRequest = request.status === LeaveRequestStatus.PENDING &&
                          new Date(request.start_date) > new Date();

  return (
    <Panel
      headerText="Leave Request Details"
      isOpen={isOpen}
      onDismiss={onClose}
      type={PanelType.medium}
      closeButtonAriaLabel="Close request details panel"
    >
      <Stack tokens={{ childrenGap: 20 }}>
        {/* Request Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out">
          <Stack tokens={{ childrenGap: 12 }} className="p-4">
            <div className="flex items-start justify-between">
              <Persona
                text={request.user ? `${request.user.first_name} ${request.user.last_name}` : 'Unknown User'}
                secondaryText={request.user?.email || ''}
                size={PersonaSize.size48}
              />
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Icon iconName={statusIcon} style={{ color: statusColor }} />
                  <Text variant="medium" style={{ color: statusColor }} className="font-medium">
                    {request.status}
                  </Text>
                </div>
                {request.reviewed_at && request.reviewed_by && (
                  <Text variant="small" className="text-gray-600 mt-1">
                    Reviewed by {request.reviewed_by.first_name} {request.reviewed_by.last_name}
                  </Text>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Text variant="small" className="text-gray-600">Leave Type:</Text>
                <div className="flex items-center gap-2 mt-1">
                  {request.leave_type && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: request.leave_type.color_code }}
                    />
                  )}
                  <Text variant="medium" className="font-medium">
                    {request.leave_type?.name || 'Unknown Leave Type'}
                  </Text>
                </div>
              </div>

              <div>
                <Text variant="small" className="text-gray-600">Duration:</Text>
                <Text variant="medium" className="font-medium mt-1">
                  {request.days_requested} days
                </Text>
              </div>
            </div>
          </Stack>
        </div>

        {/* Leave Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out">
          <Stack tokens={{ childrenGap: 12 }} className="p-4">
            <Text variant="large" className="font-semibold">Leave Details</Text>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text variant="small" className="text-gray-600">Start Date:</Text>
                <Text variant="medium" className="font-medium mt-1">
                  {new Date(request.start_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </div>

              <div>
                <Text variant="small" className="text-gray-600">End Date:</Text>
                <Text variant="medium" className="font-medium mt-1">
                  {new Date(request.end_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </div>

              <div className="col-span-2">
                <Text variant="small" className="text-gray-600">Submitted:</Text>
                <Text variant="medium" className="mt-1">
                  {new Date(request.created_at).toLocaleDateString('en-GB')} at{' '}
                  {new Date(request.created_at).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </div>

              {request.reviewed_at && (
                <div className="col-span-2">
                  <Text variant="small" className="text-gray-600">Reviewed:</Text>
                  <Text variant="medium" className="mt-1">
                    {new Date(request.reviewed_at).toLocaleDateString('en-GB')} at{' '}
                    {new Date(request.reviewed_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <Text variant="small" className="text-gray-600">Reason for Leave:</Text>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border">
                <Text variant="medium">{request.reason}</Text>
              </div>
            </div>

            {/* Manager Comments */}
            {request.manager_comments && (
              <div>
                <Text variant="small" className="text-gray-600">Manager Comments:</Text>
                <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <Text variant="medium">{request.manager_comments}</Text>
                </div>
              </div>
            )}

            {/* Supporting Documents */}
            {request.supporting_documents && request.supporting_documents.length > 0 && (
              <div>
                <Text variant="small" className="text-gray-600">Supporting Documents:</Text>
                <div className="mt-2 space-y-2">
                  {request.supporting_documents.map((doc, index) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                      <Icon iconName="Attach" className="text-blue-600" />
                      <Link
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            const blob = await leaveService.downloadSupportingDocument(request.id, doc.id);
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = doc.name;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          } catch (error) {
                            console.error('Error downloading document:', error);
                          }
                        }}
                        className="flex-1"
                      >
                        <Text variant="small">{doc.name}</Text>
                      </Link>
                      <Text variant="small" className="text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Stack>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200 flex gap-3">
          {canEdit && request.status === LeaveRequestStatus.PENDING && onEdit && (
            <DefaultButton
              text="Edit Request"
              iconProps={{ iconName: 'Edit' }}
              onClick={() => onEdit(request)}
              className="flex-1"
            />
          )}

          {canCancelRequest && onCancel && (
            <DefaultButton
              text={isCancelling ? 'Cancelling...' : 'Cancel Request'}
              iconProps={{ iconName: isCancelling ? 'Clock' : 'Cancel' }}
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1"
              styles={{ root: { color: '#D13438', borderColor: '#D13438' } }}
            />
          )}

          <DefaultButton
            text="Close"
            iconProps={{ iconName: 'ChromeClose' }}
            onClick={onClose}
            className="flex-1"
          />
        </div>
      </Stack>
    </Panel>
  );
};

// Export modal component
const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'xlsx', filters?: LeaveRequestFilterOptions) => void;
  filters: LeaveRequestFilterOptions;
  totalRecords: number;
}> = ({ isOpen, onClose, onExport, filters, totalRecords }) => {
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const [includeFilters, setIncludeFilters] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(exportFormat, includeFilters ? filters : {});
      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions: IDropdownOption[] = [
    { key: 'csv', text: 'CSV (Comma Separated Values)' },
    { key: 'xlsx', text: 'Excel (XLSX)' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      isBlocking={false}
    >
      <div className="p-6 min-w-[400px]">
        <Text variant="xLarge" className="font-semibold mb-4">
          Export Leave History
        </Text>

        <Stack tokens={{ childrenGap: 16 }}>
          <div>
            <Label>Export Format</Label>
            <Dropdown
              selectedKey={exportFormat}
              onChange={(_, option) => setExportFormat(option?.key as 'csv' | 'xlsx')}
              options={formatOptions}
            />
          </div>

          <Checkbox
            label={`Apply current filters (${totalRecords} records)`}
            checked={includeFilters}
            onChange={(_, checked) => setIncludeFilters(checked || false)}
          />

          <div className="pt-4 border-t border-gray-200 flex gap-3">
            <PrimaryButton
              text={isExporting ? 'Exporting...' : 'Export'}
              onClick={handleExport}
              disabled={isExporting}
              iconProps={{ iconName: isExporting ? 'Clock' : 'Download' }}
              className="flex-1"
            />
            <DefaultButton
              text="Cancel"
              onClick={onClose}
              disabled={isExporting}
              className="flex-1"
            />
          </div>
        </Stack>
      </div>
    </Modal>
  );
};

// Main component
const LeaveHistoryTable: React.FC<LeaveHistoryTableProps> = ({
  userId,
  showUserColumn = true,
  compact = false,
  maxHeight,
  className = '',
  defaultFilters = {},
  onRequestSelect
}) => {
  const { authState, isUserRole } = useAuth();

  // State management
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filtering
  const [filters, setFilters] = useState<LeaveRequestFilterOptions>(defaultFilters);
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});

  // Selection
  const [selection] = useState(new Selection());

  // Check permissions
  const canEdit = !userId || userId === authState.user?.id;
  const canViewAll = isUserRole('manager') || isUserRole('admin');

  // Load data
  const loadData = useCallback(async (page: number = 1, showLoading: boolean = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError('');

      // Combine filters with date range
      const combinedFilters: LeaveRequestFilterOptions = {
        ...filters,
        ...(dateRange.start && { start_date: dateRange.start.toISOString().split('T')[0] }),
        ...(dateRange.end && { end_date: dateRange.end.toISOString().split('T')[0] }),
        ...(userId && { user: [userId] })
      };

      const [requestsResult, typesResult] = await Promise.all([
        userId
          ? leaveService.getMyLeaveRequests(combinedFilters, page, pageSize)
          : leaveService.getLeaveRequests(combinedFilters, page, pageSize),
        leaveService.getLeaveTypes(true)
      ]);

      if (page === 1) {
        setRequests(requestsResult?.results || []);
      } else {
        setRequests(prev => [...(prev || []), ...(requestsResult?.results || [])]);
      }

      setTotalCount(requestsResult.count);
      setHasNextPage(!!requestsResult.next);
      setLeaveTypes(typesResult);
      setCurrentPage(page);

    } catch (err: any) {
      console.error('Error loading leave history:', err);
      setError('Failed to load leave history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, dateRange, userId, pageSize]);

  // Initial load and filter changes
  useEffect(() => {
    loadData(1, true);
  }, [loadData]);

  // Handle request cancellation
  const handleCancelRequest = async (request: LeaveRequest) => {
    try {
      await leaveService.cancelLeaveRequest(request.id, 'Cancelled by user');

      // Update the request in the list
      setRequests(prev =>
        prev.map(r =>
          r.id === request.id
            ? { ...r, status: LeaveRequestStatus.CANCELLED }
            : r
        )
      );

      setIsDetailsOpen(false);
      setSelectedRequest(null);

    } catch (err: any) {
      console.error('Error cancelling request:', err);
      setError('Failed to cancel request. Please try again.');
    }
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'xlsx', exportFilters?: LeaveRequestFilterOptions) => {
    try {
      const blob = await leaveService.exportLeaveRequests(format, exportFilters);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `leave-history-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err: any) {
      console.error('Error exporting data:', err);
      setError('Failed to export data. Please try again.');
    }
  };

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = [...(requests || [])];

    // Apply search filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(request =>
        `${request.user.first_name} ${request.user.last_name}`.toLowerCase().includes(searchLower) ||
        request.leave_type.name.toLowerCase().includes(searchLower) ||
        request.reason.toLowerCase().includes(searchLower) ||
        request.status.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [requests, searchText]);

  // Define columns
  const columns: IColumn[] = [
    ...(showUserColumn ? [{
      key: 'user',
      name: 'Employee',
      minWidth: 180,
      maxWidth: 220,
      isResizable: true,
      onRender: (item: LeaveRequest) => {
        const displayName = item.user
          ? `${item.user.first_name} ${item.user.last_name}`
          : 'Unknown User';
        const email = item.user?.email || '';

        return (
          <Persona
            text={displayName}
            secondaryText={email}
            size={compact ? PersonaSize.size24 : PersonaSize.size32}
          />
        );
      },
    }] : []),
    {
      key: 'leaveType',
      name: 'Leave Type',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: LeaveRequest) => (
        <div className="flex items-center gap-2">
          {item.leave_type && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.leave_type.color_code }}
            />
          )}
          <Text variant={compact ? 'small' : 'medium'}>
            {item.leave_type?.name || 'Unknown Leave Type'}
          </Text>
        </div>
      ),
    },
    {
      key: 'dates',
      name: 'Dates',
      minWidth: 180,
      maxWidth: 220,
      isResizable: true,
      onRender: (item: LeaveRequest) => (
        <div>
          <Text variant={compact ? 'small' : 'medium'}>
            {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
          </Text>
          <Text variant="small" className="text-gray-600">
            {item.days_requested} days
          </Text>
        </div>
      ),
    },
    {
      key: 'status',
      name: 'Status',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: LeaveRequest) => {
        const statusColors = {
          [LeaveRequestStatus.APPROVED]: '#107C10',
          [LeaveRequestStatus.PENDING]: '#FF8C00',
          [LeaveRequestStatus.REJECTED]: '#D13438',
          [LeaveRequestStatus.CANCELLED]: '#605E5C',
          [LeaveRequestStatus.WITHDRAWN]: '#8A8886'
        };

        const statusIcons = {
          [LeaveRequestStatus.APPROVED]: 'Accept',
          [LeaveRequestStatus.PENDING]: 'Clock',
          [LeaveRequestStatus.REJECTED]: 'Cancel',
          [LeaveRequestStatus.CANCELLED]: 'StatusCircleBlock',
          [LeaveRequestStatus.WITHDRAWN]: 'Undo'
        };

        return (
          <div className="flex items-center gap-2">
            <Icon
              iconName={statusIcons[item.status]}
              style={{ color: statusColors[item.status] }}
            />
            <Text
              variant={compact ? 'small' : 'medium'}
              style={{ color: statusColors[item.status] }}
              className="font-medium"
            >
              {item.status}
            </Text>
          </div>
        );
      },
    },
    {
      key: 'submitted',
      name: 'Submitted',
      minWidth: 100,
      maxWidth: 130,
      isResizable: true,
      onRender: (item: LeaveRequest) => (
        <Text variant={compact ? 'small' : 'medium'}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 80,
      maxWidth: 100,
      isResizable: false,
      onRender: (item: LeaveRequest) => (
        <TooltipHost content="View Details">
          <DefaultButton
            iconProps={{ iconName: 'View' }}
            onClick={() => {
              setSelectedRequest(item);
              setIsDetailsOpen(true);
              if (onRequestSelect) onRequestSelect(item);
            }}
            ariaLabel="View request details"
            styles={{ root: { minWidth: '32px' } }}
          />
        </TooltipHost>
      ),
    },
  ];

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: () => loadData(1, true),
    },
    {
      key: 'export',
      text: 'Export',
      iconProps: { iconName: 'Download' },
      onClick: () => setIsExportModalOpen(true),
    },
  ];

  // Status filter options
  const statusOptions: IDropdownOption[] = [
    { key: 'all', text: 'All Statuses' },
    { key: LeaveRequestStatus.APPROVED, text: 'Approved' },
    { key: LeaveRequestStatus.PENDING, text: 'Pending' },
    { key: LeaveRequestStatus.REJECTED, text: 'Rejected' },
    { key: LeaveRequestStatus.CANCELLED, text: 'Cancelled' },
    { key: LeaveRequestStatus.WITHDRAWN, text: 'Withdrawn' }
  ];

  // Leave type filter options
  const leaveTypeOptions: IDropdownOption[] = [
    { key: 'all', text: 'All Leave Types' },
    ...leaveTypes.map(type => ({ key: type.id, text: type.name }))
  ];

  if (error) {
    return (
      <div className={className}>
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError('')}
          actions={
            <DefaultButton
              text="Retry"
              iconProps={{ iconName: 'Refresh' }}
              onClick={() => loadData(1, true)}
            />
          }
        >
          {error}
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <Text variant="xLarge" className="font-semibold text-gray-900">
              Leave History
            </Text>
            <Text variant="medium" className="text-gray-600 mt-1">
              View and manage leave request history
            </Text>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out">
        <Stack tokens={{ childrenGap: 16 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <SearchBox
                placeholder="Search requests..."
                value={searchText}
                onChange={(_, newValue) => setSearchText(newValue || '')}
                onClear={() => setSearchText('')}
              />
            </div>

            <Dropdown
              placeholder="Status"
              options={statusOptions}
              selectedKey={filters.status?.[0] || 'all'}
              onChange={(_, option) => {
                if (option?.key === 'all') {
                  setFilters(prev => ({ ...prev, status: undefined }));
                } else {
                  setFilters(prev => ({
                    ...prev,
                    status: [option?.key as LeaveRequestStatus]
                  }));
                }
              }}
            />

            <Dropdown
              placeholder="Leave Type"
              options={leaveTypeOptions}
              selectedKey={filters.leave_type?.[0] || 'all'}
              onChange={(_, option) => {
                if (option?.key === 'all') {
                  setFilters(prev => ({ ...prev, leave_type: undefined }));
                } else {
                  setFilters(prev => ({
                    ...prev,
                    leave_type: [option?.key as number]
                  }));
                }
              }}
            />

            <DatePicker
              placeholder="From Date"
              value={dateRange.start}
              onSelectDate={(date) => setDateRange(prev => ({ ...prev, start: date || undefined }))}
            />

            <DatePicker
              placeholder="To Date"
              value={dateRange.end}
              onSelectDate={(date) => setDateRange(prev => ({ ...prev, end: date || undefined }))}
            />
          </div>
        </Stack>
      </div>

      {/* Command Bar */}
      <CommandBar items={commandBarItems} />

      {/* Loading State */}
      {isLoading && (requests || []).length === 0 && (
        <div className="flex items-center justify-center p-8">
          <Spinner size={SpinnerSize.large} label="Loading leave history..." />
        </div>
      )}

      {/* Data Table */}
      <div style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined, overflowY: 'auto' }}>
        <DetailsList
          items={filteredData}
          columns={columns}
          setKey="set"
          layoutMode={DetailsListLayoutMode.justified}
          selection={selection}
          selectionMode={SelectionMode.none}
          compact={compact}
        />
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="text-center">
          <DefaultButton
            text="Load More"
            iconProps={{ iconName: 'ChevronDown' }}
            onClick={() => loadData(currentPage + 1, false)}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Empty State */}
      {filteredData.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Icon iconName="Calendar" className="text-6xl text-gray-400 mb-4" />
          <Text variant="large" className="text-gray-600 mb-2">
            No leave requests found
          </Text>
          <Text variant="medium" className="text-gray-500">
            {searchText || Object.keys(filters).length > 0 || dateRange.start || dateRange.end
              ? 'Try adjusting your search criteria or filters'
              : 'You haven\'t submitted any leave requests yet'
            }
          </Text>
        </div>
      )}

      {/* Pagination Info */}
      {totalCount > 0 && (
        <div className="flex justify-between items-center text-sm text-gray-600">
          <Text variant="small">
            Showing {filteredData.length} of {totalCount} requests
          </Text>
          {isLoading && (requests || []).length > 0 && (
            <div className="flex items-center gap-2">
              <Spinner size={SpinnerSize.small} />
              <Text variant="small">Loading more...</Text>
            </div>
          )}
        </div>
      )}

      {/* Request Details Panel */}
      <RequestDetailsPanel
        request={selectedRequest}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedRequest(null);
        }}
        canEdit={canEdit}
        onCancel={handleCancelRequest}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        filters={filters}
        totalRecords={totalCount}
      />
    </div>
  );
};

export default LeaveHistoryTable;