import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  Selection,
  SelectionMode,
  PrimaryButton,
  DefaultButton,
  CommandBar,
  ICommandBarItemProps,
  SearchBox,
  Dropdown,
  IDropdownOption,
  Panel,
  PanelType,
  Text,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Modal,
  TextField,
  Stack,
  Icon,
  Persona,
  PersonaSize,
  PersonaPresence,
  TooltipHost,
  DirectionalHint,
  ProgressIndicator,
  DatePicker,
  Pivot,
  PivotItem,
  Facepile,
  IFacepilePersona,
  OverflowButtonType
} from '@fluentui/react';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import type {
  PendingLeaveRequest,
  LeaveRequest,
  LeaveType,
  LeaveRequestStatus,
  LeaveApprovalAction,
  BulkApprovalRequest,
  LeaveRequestFilterOptions,
  User
} from '../types/leave';

interface LeaveApprovalDashboardProps {
  className?: string;
  defaultView?: 'pending' | 'all' | 'approved' | 'rejected';
}

interface RequestDetailsModalProps {
  request: PendingLeaveRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (request: PendingLeaveRequest, comments?: string) => void;
  onReject: (request: PendingLeaveRequest, comments?: string) => void;
  isProcessing: boolean;
}

// Request details modal component
const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
  request,
  isOpen,
  onClose,
  onApprove,
  onReject,
  isProcessing
}) => {
  const [comments, setComments] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = () => {
    if (request) {
      onApprove(request, comments);
      setComments('');
      setActionType(null);
    }
  };

  const handleReject = () => {
    if (request) {
      onReject(request, comments);
      setComments('');
      setActionType(null);
    }
  };

  const urgencyColor = {
    low: '#107C10',
    medium: '#FF8C00',
    high: '#D13438'
  };

  const urgencyIcon = {
    low: 'Clock',
    medium: 'Warning',
    high: 'WarningSolid'
  };

  if (!request) return null;

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
                text={`${request.user.first_name} ${request.user.last_name}`}
                secondaryText={request.user.email}
                size={PersonaSize.size48}
                presence={PersonaPresence.online}
              />
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <Icon
                    iconName={urgencyIcon[request.urgency_level]}
                    style={{ color: urgencyColor[request.urgency_level] }}
                  />
                  <Text variant="medium" style={{ color: urgencyColor[request.urgency_level] }}>
                    {request.urgency_level.toUpperCase()} PRIORITY
                  </Text>
                </div>
                <Text variant="small" className="text-gray-600 mt-1">
                  Starts in {request.days_until_start} days
                </Text>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Text variant="small" className="text-gray-600">Leave Type:</Text>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: request.leave_type.color_code }}
                  />
                  <Text variant="medium" className="font-medium">
                    {request.leave_type.name}
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
            </div>

            {/* Reason */}
            <div>
              <Text variant="small" className="text-gray-600">Reason for Leave:</Text>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border">
                <Text variant="medium">{request.reason}</Text>
              </div>
            </div>
          </Stack>
        </div>

        {/* Manager Comments Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out">
          <Stack tokens={{ childrenGap: 12 }} className="p-4">
            <Text variant="large" className="font-semibold">Manager Comments</Text>
            <TextField
              multiline
              rows={3}
              value={comments}
              onChange={(_, value) => setComments(value || '')}
              placeholder="Add comments about this leave request (optional)..."
              disabled={isProcessing}
            />
          </Stack>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white pt-4 border-t border-gray-200 flex gap-3">
          <PrimaryButton
            text="Approve"
            iconProps={{ iconName: 'Accept' }}
            onClick={handleApprove}
            disabled={isProcessing}
            className="flex-1"
            styles={{ root: { backgroundColor: '#107C10' } }}
          />
          <DefaultButton
            text="Reject"
            iconProps={{ iconName: 'Cancel' }}
            onClick={handleReject}
            disabled={isProcessing}
            className="flex-1"
            styles={{ root: { color: '#D13438', borderColor: '#D13438' } }}
          />
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <Spinner size={SpinnerSize.large} label="Processing request..." />
          </div>
        )}
      </Stack>
    </Panel>
  );
};

// Statistics cards component
const StatisticsCards: React.FC<{
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}> = ({ pendingCount, approvedCount, rejectedCount, totalCount }) => {

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-orange-50 rounded-2xl shadow-sm border border-orange-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="large" className="font-bold text-orange-900">
              {pendingCount}
            </Text>
            <Text variant="medium" className="text-orange-700">
              Pending
            </Text>
          </div>
          <Icon iconName="Clock" className="text-2xl text-orange-600" />
        </div>
      </div>

      <div className="bg-green-50 rounded-2xl shadow-sm border border-green-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="large" className="font-bold text-green-900">
              {approvedCount}
            </Text>
            <Text variant="medium" className="text-green-700">
              Approved
            </Text>
          </div>
          <Icon iconName="Accept" className="text-2xl text-green-600" />
        </div>
      </div>

      <div className="bg-red-50 rounded-2xl shadow-sm border border-red-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="large" className="font-bold text-red-900">
              {rejectedCount}
            </Text>
            <Text variant="medium" className="text-red-700">
              Rejected
            </Text>
          </div>
          <Icon iconName="Cancel" className="text-2xl text-red-600" />
        </div>
      </div>

      <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
        <div className="flex items-center justify-between">
          <div>
            <Text variant="large" className="font-bold text-blue-900">
              {totalCount}
            </Text>
            <Text variant="medium" className="text-blue-700">
              Total
            </Text>
          </div>
          <Icon iconName="BulletedList" className="text-2xl text-blue-600" />
        </div>
      </div>
    </div>
  );
};

// Main component
const LeaveApprovalDashboard: React.FC<LeaveApprovalDashboardProps> = ({
  className = '',
  defaultView = 'pending'
}) => {
  const { authState, isUserRole } = useAuth();

  // State management
  const [pendingRequests, setPendingRequests] = useState<PendingLeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedView, setSelectedView] = useState(defaultView);
  const [selectedRequest, setSelectedRequest] = useState<PendingLeaveRequest | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [bulkCommentsModal, setBulkCommentsModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
    selectedIds: number[];
  }>({ isOpen: false, action: null, selectedIds: [] });
  const [bulkComments, setBulkComments] = useState('');

  // Filtering states
  const [filters, setFilters] = useState<LeaveRequestFilterOptions>({});
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({});

  // Selection management
  const [selection] = useState(
    new Selection({
      onSelectionChanged: () => {
        // Handle selection changes if needed
      },
    })
  );

  // Check if user has manager permissions
  const canApprove = isUserRole('manager') || isUserRole('admin');

  // Load data
  const loadData = useCallback(async () => {
    if (!canApprove) return;

    try {
      setIsLoading(true);
      setError('');

      const [pendingResult, typesResult] = await Promise.all([
        leaveService.getPendingLeaveRequests(filters),
        leaveService.getLeaveTypes(true)
      ]);

      setPendingRequests(pendingResult);
      setLeaveTypes(typesResult);

      // Load all requests if needed
      if (selectedView !== 'pending') {
        const allResult = await leaveService.getLeaveRequests(filters);
        setAllRequests(allResult.results);
      }

    } catch (err: any) {
      console.error('Error loading approval data:', err);
      setError('Failed to load approval data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [canApprove, filters, selectedView]);

  // Initial load and refresh
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle request approval/rejection
  const handleProcessRequest = async (
    request: PendingLeaveRequest,
    action: 'approve' | 'reject',
    comments?: string
  ) => {
    setIsProcessingRequest(true);

    try {
      const approvalAction: LeaveApprovalAction = {
        request_id: request.id,
        action,
        comments
      };

      await leaveService.processLeaveRequest(approvalAction);

      // Remove from pending list
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));

      // Close modal
      setIsDetailsModalOpen(false);
      setSelectedRequest(null);

      // Show success message
      // You could add a toast notification here

    } catch (err: any) {
      console.error('Error processing request:', err);
      setError(`Failed to ${action} request. Please try again.`);
    } finally {
      setIsProcessingRequest(false);
    }
  };

  // Handle bulk approval/rejection
  const handleBulkProcess = async (action: 'approve' | 'reject', requestIds: number[], comments?: string) => {
    try {
      const bulkRequest: BulkApprovalRequest = {
        request_ids: requestIds,
        action,
        comments
      };

      await leaveService.bulkProcessLeaveRequests(bulkRequest);

      // Remove processed requests from pending list
      setPendingRequests(prev => prev.filter(r => !requestIds.includes(r.id)));

      // Clear selection
      selection.setAllSelected(false);

      setBulkCommentsModal({ isOpen: false, action: null, selectedIds: [] });
      setBulkComments('');

    } catch (err: any) {
      console.error('Error bulk processing requests:', err);
      setError(`Failed to bulk ${action} requests. Please try again.`);
    }
  };

  // Filter and search data
  const filteredData = useMemo(() => {
    const data = selectedView === 'pending' ? pendingRequests : allRequests;

    let filtered = [...data];

    // Apply search filter
    if (searchText) {
      filtered = filtered.filter(request =>
        `${request.user.first_name} ${request.user.last_name}`.toLowerCase().includes(searchText.toLowerCase()) ||
        request.leave_type.name.toLowerCase().includes(searchText.toLowerCase()) ||
        request.reason.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Apply date range filter
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(request => {
        const startDate = new Date(request.start_date);
        if (dateRange.start && startDate < dateRange.start) return false;
        if (dateRange.end && startDate > dateRange.end) return false;
        return true;
      });
    }

    return filtered;
  }, [pendingRequests, allRequests, selectedView, searchText, dateRange]);

  // Define columns for the details list
  const columns: IColumn[] = [
    {
      key: 'user',
      name: 'Employee',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: PendingLeaveRequest) => (
        <Persona
          text={`${item.user.first_name} ${item.user.last_name}`}
          secondaryText={item.user.email}
          size={PersonaSize.size32}
        />
      ),
    },
    {
      key: 'leaveType',
      name: 'Leave Type',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: PendingLeaveRequest) => (
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.leave_type.color_code }}
          />
          <Text variant="medium">{item.leave_type.name}</Text>
        </div>
      ),
    },
    {
      key: 'dates',
      name: 'Dates',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: PendingLeaveRequest) => (
        <div>
          <Text variant="medium">
            {new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}
          </Text>
          <Text variant="small" className="text-gray-600">
            {item.days_requested} days
          </Text>
        </div>
      ),
    },
    {
      key: 'urgency',
      name: 'Priority',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: PendingLeaveRequest) => {
        const urgencyColor = {
          low: '#107C10',
          medium: '#FF8C00',
          high: '#D13438'
        };

        return (
          <div className="flex items-center gap-1">
            <Icon
              iconName="Circle"
              style={{ color: urgencyColor[item.urgency_level], fontSize: '8px' }}
            />
            <Text variant="small" style={{ color: urgencyColor[item.urgency_level] }}>
              {item.urgency_level.toUpperCase()}
            </Text>
          </div>
        );
      },
    },
    {
      key: 'submitted',
      name: 'Submitted',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: PendingLeaveRequest) => (
        <Text variant="small">
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 200,
      isResizable: false,
      onRender: (item: PendingLeaveRequest) => (
        <div className="flex gap-2">
          <TooltipHost content="View Details">
            <DefaultButton
              iconProps={{ iconName: 'View' }}
              onClick={() => {
                setSelectedRequest(item);
                setIsDetailsModalOpen(true);
              }}
              ariaLabel="View request details"
            />
          </TooltipHost>
          <TooltipHost content="Quick Approve">
            <PrimaryButton
              iconProps={{ iconName: 'Accept' }}
              onClick={() => handleProcessRequest(item, 'approve')}
              ariaLabel="Approve request"
              styles={{ root: { minWidth: '32px' } }}
            />
          </TooltipHost>
          <TooltipHost content="Quick Reject">
            <DefaultButton
              iconProps={{ iconName: 'Cancel' }}
              onClick={() => handleProcessRequest(item, 'reject')}
              ariaLabel="Reject request"
              styles={{ root: { color: '#D13438', borderColor: '#D13438' } }}
            />
          </TooltipHost>
        </div>
      ),
    },
  ];

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'bulkApprove',
      text: 'Bulk Approve',
      iconProps: { iconName: 'Accept' },
      disabled: selection.getSelectedCount() === 0,
      onClick: () => {
        const selectedItems = selection.getSelection() as PendingLeaveRequest[];
        setBulkCommentsModal({
          isOpen: true,
          action: 'approve',
          selectedIds: selectedItems.map(item => item.id)
        });
      },
    },
    {
      key: 'bulkReject',
      text: 'Bulk Reject',
      iconProps: { iconName: 'Cancel' },
      disabled: selection.getSelectedCount() === 0,
      onClick: () => {
        const selectedItems = selection.getSelection() as PendingLeaveRequest[];
        setBulkCommentsModal({
          isOpen: true,
          action: 'reject',
          selectedIds: selectedItems.map(item => item.id)
        });
      },
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: loadData,
    },
  ];

  const farItems: ICommandBarItemProps[] = [
    {
      key: 'export',
      text: 'Export',
      iconProps: { iconName: 'Download' },
      onClick: () => {
        // Implement export functionality
      },
    },
  ];

  // Statistics counts
  const statisticsCounts = {
    pendingCount: pendingRequests.length,
    approvedCount: allRequests.filter(r => r.status === LeaveRequestStatus.APPROVED).length,
    rejectedCount: allRequests.filter(r => r.status === LeaveRequestStatus.REJECTED).length,
    totalCount: allRequests.length
  };

  if (!canApprove) {
    return (
      <div className={className}>
        <MessageBar messageBarType={MessageBarType.warning}>
          You do not have permission to approve leave requests.
        </MessageBar>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Spinner size={SpinnerSize.large} label="Loading approval dashboard..." />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text variant="xLarge" className="font-semibold text-gray-900">
            Leave Approval Dashboard
          </Text>
          <Text variant="medium" className="text-gray-600 mt-1">
            Review and approve staff leave requests
          </Text>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError('')}
        >
          {error}
        </MessageBar>
      )}

      {/* Statistics Cards */}
      <StatisticsCards {...statisticsCounts} />

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out">
        <Stack tokens={{ childrenGap: 16 }}>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <SearchBox
                placeholder="Search by employee name, leave type, or reason..."
                value={searchText}
                onChange={(_, newValue) => setSearchText(newValue || '')}
                onClear={() => setSearchText('')}
              />
            </div>

            <Dropdown
              placeholder="Leave Type"
              options={[
                { key: 'all', text: 'All Leave Types' },
                ...leaveTypes.map(type => ({
                  key: type.id,
                  text: type.name
                }))
              ]}
              selectedKey={filters.leave_type?.[0] || 'all'}
              onChange={(_, option) => {
                if (option?.key === 'all') {
                  setFilters(prev => ({ ...prev, leave_type: undefined }));
                } else {
                  setFilters(prev => ({ ...prev, leave_type: [option?.key as number] }));
                }
              }}
              styles={{ dropdown: { minWidth: 150 } }}
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

      {/* View Tabs */}
      <Pivot
        selectedKey={selectedView}
        onLinkClick={(item) => setSelectedView(item?.props.itemKey as any)}
      >
        <PivotItem headerText={`Pending (${pendingRequests.length})`} itemKey="pending" />
        <PivotItem headerText="All Requests" itemKey="all" />
        <PivotItem headerText="Approved" itemKey="approved" />
        <PivotItem headerText="Rejected" itemKey="rejected" />
      </Pivot>

      {/* Command Bar */}
      <CommandBar items={commandBarItems} farItems={farItems} />

      {/* Data Grid */}
      <DetailsList
        items={filteredData}
        columns={columns}
        setKey="set"
        layoutMode={DetailsListLayoutMode.justified}
        selection={selection}
        selectionMode={SelectionMode.multiple}
        selectionPreservedOnEmptyClick={true}
        ariaLabelForSelectionColumn="Toggle selection"
        ariaLabelForSelectAllCheckbox="Toggle selection for all items"
        checkButtonAriaLabel="Row checkbox"
      />

      {/* Empty State */}
      {filteredData.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Icon iconName="PageList" className="text-6xl text-gray-400 mb-4" />
          <Text variant="large" className="text-gray-600 mb-2">
            {selectedView === 'pending' ? 'No pending requests' : 'No requests found'}
          </Text>
          <Text variant="medium" className="text-gray-500">
            {searchText || Object.keys(filters).length > 0
              ? 'Try adjusting your filters or search terms'
              : 'There are currently no leave requests to review'
            }
          </Text>
        </div>
      )}

      {/* Request Details Modal */}
      <RequestDetailsModal
        request={selectedRequest}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedRequest(null);
        }}
        onApprove={(request, comments) => handleProcessRequest(request, 'approve', comments)}
        onReject={(request, comments) => handleProcessRequest(request, 'reject', comments)}
        isProcessing={isProcessingRequest}
      />

      {/* Bulk Comments Modal */}
      <Modal
        isOpen={bulkCommentsModal.isOpen}
        onDismiss={() => setBulkCommentsModal({ isOpen: false, action: null, selectedIds: [] })}
        isBlocking={false}
      >
        <div className="p-6 min-w-[400px]">
          <Text variant="xLarge" className="font-semibold mb-4">
            {bulkCommentsModal.action === 'approve' ? 'Bulk Approve' : 'Bulk Reject'} Requests
          </Text>

          <Text variant="medium" className="mb-4">
            You are about to {bulkCommentsModal.action} {bulkCommentsModal.selectedIds.length} leave requests.
          </Text>

          <TextField
            label="Comments (Optional)"
            multiline
            rows={3}
            value={bulkComments}
            onChange={(_, value) => setBulkComments(value || '')}
            placeholder="Add comments for all selected requests..."
          />

          <div className="flex gap-3 mt-6">
            <PrimaryButton
              text={`${bulkCommentsModal.action === 'approve' ? 'Approve' : 'Reject'} All`}
              onClick={() => handleBulkProcess(bulkCommentsModal.action!, bulkCommentsModal.selectedIds, bulkComments)}
              iconProps={{ iconName: bulkCommentsModal.action === 'approve' ? 'Accept' : 'Cancel' }}
            />
            <DefaultButton
              text="Cancel"
              onClick={() => setBulkCommentsModal({ isOpen: false, action: null, selectedIds: [] })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeaveApprovalDashboard;