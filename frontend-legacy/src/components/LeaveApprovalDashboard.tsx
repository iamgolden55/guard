import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '../types/leave';
import { Header, Container, SpaceBetween, StatusIndicator, Alert, EmptyState, ConfirmationModal } from './cloudscape';
import Flashbar, { useFlashbar } from './cloudscape/Flashbar';

interface LeaveApprovalDashboardProps {
  className?: string;
  defaultView?: 'pending' | 'all' | 'approved' | 'rejected';
  onApprovalChange?: () => void;
}

// Statistics cards component
const StatisticsCards: React.FC<{
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}> = ({ pendingCount, approvedCount, rejectedCount, totalCount }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
          <p className="text-sm text-gray-600">Pending</p>
        </div>
        <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </Container>
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
          <p className="text-sm text-gray-600">Approved</p>
        </div>
        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </Container>
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
          <p className="text-sm text-gray-600">Rejected</p>
        </div>
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    </Container>
    <Container>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-700">{totalCount}</p>
          <p className="text-sm text-gray-600">Total</p>
        </div>
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </div>
    </Container>
  </div>
);

// Main component
const LeaveApprovalDashboard: React.FC<LeaveApprovalDashboardProps> = ({
  className = '',
  defaultView = 'pending',
  onApprovalChange
}) => {
  const { authState, isUserRole } = useAuth();
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  // State management
  const [pendingRequests, setPendingRequests] = useState<PendingLeaveRequest[]>([]);
  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedView, setSelectedView] = useState(defaultView);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);

  // Detail panel state
  const [selectedRequest, setSelectedRequest] = useState<PendingLeaveRequest | null>(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [managerComments, setManagerComments] = useState('');

  // Bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [bulkComments, setBulkComments] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Filtering states
  const [filters, setFilters] = useState<LeaveRequestFilterOptions>({});
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Check if user has manager permissions
  const canApprove = isUserRole('manager') || isUserRole('admin');

  // Load data
  const loadData = useCallback(async () => {
    if (!canApprove) return;
    try {
      setIsLoading(true);
      const [pendingResult, typesResult] = await Promise.all([
        leaveService.getPendingLeaveRequests(filters),
        leaveService.getLeaveTypes(true)
      ]);
      setPendingRequests(pendingResult);
      setLeaveTypes(typesResult);

      if (selectedView !== 'pending') {
        const allResult = await leaveService.getLeaveRequests(filters);
        setAllRequests(allResult.results);
      }
    } catch (err: any) {
      console.error('Error loading approval data:', err);
      addFlash({ type: 'error', content: 'Failed to load approval data. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [canApprove, filters, selectedView]);

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
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));
      setIsDetailsPanelOpen(false);
      setSelectedRequest(null);
      setManagerComments('');
      addFlash({ type: 'success', content: `Leave request ${action}d successfully.` });
      if (onApprovalChange) onApprovalChange();
    } catch (err: any) {
      console.error('Error processing request:', err);
      addFlash({ type: 'error', content: `Failed to ${action} request. Please try again.` });
    } finally {
      setIsProcessingRequest(false);
    }
  };

  // Handle bulk actions
  const handleBulkProcess = async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    try {
      const bulkRequest: BulkApprovalRequest = {
        request_ids: Array.from(selectedIds),
        action: bulkAction,
        comments: bulkComments
      };
      await leaveService.bulkProcessLeaveRequests(bulkRequest);
      setPendingRequests(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setIsBulkModalOpen(false);
      setBulkComments('');
      setBulkAction(null);
      addFlash({ type: 'success', content: `${selectedIds.size} requests ${bulkAction}d successfully.` });
      if (onApprovalChange) onApprovalChange();
    } catch (err: any) {
      console.error('Error bulk processing requests:', err);
      addFlash({ type: 'error', content: `Failed to bulk ${bulkAction} requests. Please try again.` });
    }
  };

  // Filter and search data
  const filteredData = useMemo(() => {
    const data = selectedView === 'pending' ? pendingRequests : allRequests;
    let filtered = [...data];
    if (searchText) {
      filtered = filtered.filter(request =>
        `${request.user.first_name} ${request.user.last_name}`.toLowerCase().includes(searchText.toLowerCase()) ||
        request.leave_type.name.toLowerCase().includes(searchText.toLowerCase()) ||
        request.reason.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (dateRangeStart || dateRangeEnd) {
      filtered = filtered.filter(request => {
        const startDate = new Date(request.start_date);
        if (dateRangeStart && startDate < new Date(dateRangeStart)) return false;
        if (dateRangeEnd && startDate > new Date(dateRangeEnd)) return false;
        return true;
      });
    }
    return filtered;
  }, [pendingRequests, allRequests, selectedView, searchText, dateRangeStart, dateRangeEnd]);

  const statisticsCounts = {
    pendingCount: pendingRequests.length,
    approvedCount: allRequests.filter(r => r.status === 'approved').length,
    rejectedCount: allRequests.filter(r => r.status === 'rejected').length,
    totalCount: allRequests.length
  };

  // Toggle selection
  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(r => r.id)));
    }
  };

  if (!canApprove) {
    return (
      <div className={className}>
        <Alert type="warning">You do not have permission to approve leave requests.</Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading approval dashboard...</span>
        </div>
      </div>
    );
  }

  const viewTabs = [
    { key: 'pending', label: `Pending (${pendingRequests.length})` },
    { key: 'all', label: 'All Requests' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ] as const;

  return (
    <div className={`space-y-6 ${className}`}>
      <Header
        variant="h1"
        description="Review and approve staff leave requests"
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => { setBulkAction('approve'); setIsBulkModalOpen(true); }}
                  className="px-4 h-9 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve ({selectedIds.size})
                </button>
                <button
                  onClick={() => { setBulkAction('reject'); setIsBulkModalOpen(true); }}
                  className="px-4 h-9 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Reject ({selectedIds.size})
                </button>
              </>
            )}
            <button
              onClick={loadData}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        }
      >
        Leave Approval Dashboard
      </Header>

      <Flashbar items={flashItems} onDismiss={removeFlash} />

      <StatisticsCards {...statisticsCounts} />

      {/* Filters */}
      <Container>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by employee name, leave type, or reason..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Leave Type</label>
            <select
              value={filters.leave_type?.[0] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setFilters(prev => ({ ...prev, leave_type: val ? [Number(val)] : undefined }));
              }}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white min-w-[150px]"
            >
              <option value="">All Leave Types</option>
              {leaveTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateRangeStart}
              onChange={(e) => setDateRangeStart(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => setDateRangeEnd(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>
      </Container>

      {/* View Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-0">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedView(tab.key as any)}
              className={
                selectedView === tab.key
                  ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                  : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Data Table */}
      {filteredData.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredData.length && filteredData.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Leave Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Dates</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item: any) => {
                const urgencyColors = { low: 'text-green-700 bg-green-50', medium: 'text-orange-700 bg-orange-50', high: 'text-red-700 bg-red-50' };
                return (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.user.first_name} {item.user.last_name}</p>
                        <p className="text-xs text-gray-500">{item.user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.leave_type.color_code }} />
                        <span>{item.leave_type.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p>{new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{item.days_requested} days</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.urgency_level && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyColors[item.urgency_level as keyof typeof urgencyColors] || ''}`}>
                          {item.urgency_level?.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setSelectedRequest(item); setIsDetailsPanelOpen(true); }}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleProcessRequest(item, 'approve')}
                          className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                          title="Approve"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleProcessRequest(item, 'reject')}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          title="Reject"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={selectedView === 'pending' ? 'No pending requests' : 'No requests found'}
          description={
            searchText || Object.keys(filters).length > 0
              ? 'Try adjusting your filters or search terms'
              : 'There are currently no leave requests to review'
          }
          icon={
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      )}

      {/* Details Slide-over Panel */}
      {isDetailsPanelOpen && selectedRequest && (
        <div className="fixed inset-0 z-[2000]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsDetailsPanelOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Leave Request Details</h2>
                <button onClick={() => setIsDetailsPanelOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <Container>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{selectedRequest.user.first_name} {selectedRequest.user.last_name}</p>
                    <p className="text-sm text-gray-500">{selectedRequest.user.email}</p>
                  </div>
                  {selectedRequest.urgency_level && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedRequest.urgency_level === 'high' ? 'text-red-700 bg-red-50' :
                      selectedRequest.urgency_level === 'medium' ? 'text-orange-700 bg-orange-50' :
                      'text-green-700 bg-green-50'
                    }`}>
                      {selectedRequest.urgency_level.toUpperCase()} PRIORITY
                    </span>
                  )}
                </div>
              </Container>

              <Container>
                <SpaceBetween size="s">
                  <h3 className="font-semibold text-gray-900">Leave Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Leave Type</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedRequest.leave_type.color_code }} />
                        <span className="text-sm font-medium">{selectedRequest.leave_type.name}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm font-medium mt-1">{selectedRequest.days_requested} days</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Start Date</p>
                      <p className="text-sm mt-1">{new Date(selectedRequest.start_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">End Date</p>
                      <p className="text-sm mt-1">{new Date(selectedRequest.end_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reason</p>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm">{selectedRequest.reason}</p>
                    </div>
                  </div>
                </SpaceBetween>
              </Container>

              <Container>
                <SpaceBetween size="s">
                  <h3 className="font-semibold text-gray-900">Manager Comments</h3>
                  <textarea
                    rows={3}
                    value={managerComments}
                    onChange={(e) => setManagerComments(e.target.value)}
                    placeholder="Add comments about this leave request (optional)..."
                    disabled={isProcessingRequest}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                </SpaceBetween>
              </Container>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => handleProcessRequest(selectedRequest, 'approve', managerComments)}
                  disabled={isProcessingRequest}
                  className="flex-1 px-4 h-9 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleProcessRequest(selectedRequest, 'reject', managerComments)}
                  disabled={isProcessingRequest}
                  className="flex-1 px-4 h-9 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modal */}
      <ConfirmationModal
        visible={isBulkModalOpen}
        header={`Bulk ${bulkAction === 'approve' ? 'Approve' : 'Reject'} Requests`}
        confirmLabel={`${bulkAction === 'approve' ? 'Approve' : 'Reject'} All`}
        variant={bulkAction === 'reject' ? 'destructive' : 'default'}
        onConfirm={handleBulkProcess}
        onCancel={() => { setIsBulkModalOpen(false); setBulkAction(null); setBulkComments(''); }}
      >
        <div className="space-y-4">
          <p>You are about to {bulkAction} {selectedIds.size} leave requests.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comments (Optional)</label>
            <textarea
              rows={3}
              value={bulkComments}
              onChange={(e) => setBulkComments(e.target.value)}
              placeholder="Add comments for all selected requests..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </ConfirmationModal>
    </div>
  );
};

export default LeaveApprovalDashboard;
