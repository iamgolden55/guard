import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import { LeaveRequestStatus } from '../types/leave';
import type {
  LeaveRequest,
  LeaveType,
  LeaveRequestFilterOptions,
} from '../types/leave';
import { Container, SpaceBetween, StatusIndicator, Alert, EmptyState, ConfirmationModal } from './cloudscape';

interface LeaveHistoryTableProps {
  userId?: number;
  showUserColumn?: boolean;
  compact?: boolean;
  maxHeight?: number;
  className?: string;
  defaultFilters?: LeaveRequestFilterOptions;
  onRequestSelect?: (request: LeaveRequest) => void;
}

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
  const [isCancelling, setIsCancelling] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filtering
  const [filters, setFilters] = useState<LeaveRequestFilterOptions>(defaultFilters);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');

  // Check permissions
  const canEdit = !userId || userId === authState.user?.id;

  // Load data
  const loadData = useCallback(async (page: number = 1, showLoading: boolean = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError('');

      const combinedFilters: LeaveRequestFilterOptions = {
        ...filters,
        ...(dateRangeStart && { start_date: dateRangeStart }),
        ...(dateRangeEnd && { end_date: dateRangeEnd }),
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
  }, [filters, dateRangeStart, dateRangeEnd, userId, pageSize]);

  useEffect(() => {
    loadData(1, true);
  }, [loadData]);

  // Handle request cancellation
  const handleCancelRequest = async (request: LeaveRequest) => {
    setIsCancelling(true);
    try {
      await leaveService.cancelLeaveRequest(request.id, 'Cancelled by user');
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
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await leaveService.exportLeaveRequests(format, filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `leave-history-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Error exporting data:', err);
      setError('Failed to export data. Please try again.');
    }
  };

  // Filter data
  const filteredData = useMemo(() => {
    let filtered = [...(requests || [])];
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

  const getStatusType = (status: LeaveRequestStatus): 'success' | 'pending' | 'error' | 'stopped' | 'info' => {
    switch (status) {
      case LeaveRequestStatus.APPROVED: return 'success';
      case LeaveRequestStatus.PENDING: return 'pending';
      case LeaveRequestStatus.REJECTED: return 'error';
      case LeaveRequestStatus.CANCELLED: return 'stopped';
      case LeaveRequestStatus.WITHDRAWN: return 'stopped';
      default: return 'info';
    }
  };

  if (error) {
    return (
      <div className={className}>
        <Alert type="error">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => { setError(''); loadData(1, true); }}
              className="px-4 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Retry
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Leave History</h2>
            <p className="text-sm text-gray-600 mt-1">View and manage leave request history</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search requests..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <select
            value={filters.status?.[0] || ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilters(prev => ({
                ...prev,
                status: val ? [val as LeaveRequestStatus] : undefined
              }));
            }}
            className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
          >
            <option value="">All Statuses</option>
            <option value={LeaveRequestStatus.APPROVED}>Approved</option>
            <option value={LeaveRequestStatus.PENDING}>Pending</option>
            <option value={LeaveRequestStatus.REJECTED}>Rejected</option>
            <option value={LeaveRequestStatus.CANCELLED}>Cancelled</option>
            <option value={LeaveRequestStatus.WITHDRAWN}>Withdrawn</option>
          </select>

          <select
            value={filters.leave_type?.[0] || ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilters(prev => ({
                ...prev,
                leave_type: val ? [Number(val)] : undefined
              }));
            }}
            className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
          >
            <option value="">All Leave Types</option>
            {leaveTypes.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>

          <input
            type="date"
            placeholder="From Date"
            value={dateRangeStart}
            onChange={(e) => setDateRangeStart(e.target.value)}
            className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />

          <input
            type="date"
            placeholder="To Date"
            value={dateRangeEnd}
            onChange={(e) => setDateRangeEnd(e.target.value)}
            className="h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
      </Container>

      {/* Action Bar */}
      <div className="flex gap-2">
        <button
          onClick={() => loadData(1, true)}
          className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Export
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (requests || []).length === 0 && (
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-gray-500">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Loading leave history...</span>
          </div>
        </div>
      )}

      {/* Data Table */}
      {filteredData.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined, overflowY: maxHeight ? 'auto' : undefined }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {showUserColumn && <th className="text-left px-4 py-3 font-medium text-gray-700">Employee</th>}
                <th className="text-left px-4 py-3 font-medium text-gray-700">Leave Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Dates</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Submitted</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  {showUserColumn && (
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.user ? `${item.user.first_name} ${item.user.last_name}` : 'Unknown User'}
                        </p>
                        <p className="text-xs text-gray-500">{item.user?.email || ''}</p>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.leave_type && (
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.leave_type.color_code }} />
                      )}
                      <span>{item.leave_type?.name || 'Unknown Leave Type'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p>{new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{item.days_requested} days</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusIndicator type={getStatusType(item.status)}>
                      {item.status}
                    </StatusIndicator>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setSelectedRequest(item);
                        setIsDetailsOpen(true);
                        if (onRequestSelect) onRequestSelect(item);
                      }}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      title="View Details"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !isLoading ? (
        <EmptyState
          title="No leave requests found"
          description={
            searchText || Object.keys(filters).length > 0 || dateRangeStart || dateRangeEnd
              ? 'Try adjusting your search criteria or filters'
              : "You haven't submitted any leave requests yet"
          }
          icon={
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      ) : null}

      {/* Load More */}
      {hasNextPage && (
        <div className="text-center">
          <button
            onClick={() => loadData(currentPage + 1, false)}
            disabled={isLoading}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* Pagination Info */}
      {totalCount > 0 && (
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span className="text-xs">Showing {filteredData.length} of {totalCount} requests</span>
          {isLoading && (requests || []).length > 0 && (
            <div className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs">Loading more...</span>
            </div>
          )}
        </div>
      )}

      {/* Details Slide-over Panel */}
      {isDetailsOpen && selectedRequest && (
        <div className="fixed inset-0 z-[2000]">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setIsDetailsOpen(false); setSelectedRequest(null); }} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Leave Request Details</h2>
                <button onClick={() => { setIsDetailsOpen(false); setSelectedRequest(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <Container>
                <SpaceBetween size="s">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedRequest.user ? `${selectedRequest.user.first_name} ${selectedRequest.user.last_name}` : 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500">{selectedRequest.user?.email || ''}</p>
                    </div>
                    <StatusIndicator type={getStatusType(selectedRequest.status)}>
                      {selectedRequest.status}
                    </StatusIndicator>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500">Leave Type</p>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedRequest.leave_type && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedRequest.leave_type.color_code }} />
                        )}
                        <span className="text-sm font-medium">{selectedRequest.leave_type?.name || 'Unknown'}</span>
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
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Submitted</p>
                      <p className="text-sm mt-1">{new Date(selectedRequest.created_at).toLocaleDateString('en-GB')} at {new Date(selectedRequest.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Reason</p>
                    <div className="mt-1 p-3 bg-gray-50 rounded-lg border">
                      <p className="text-sm">{selectedRequest.reason}</p>
                    </div>
                  </div>

                  {selectedRequest.manager_comments && (
                    <div>
                      <p className="text-xs text-gray-500">Manager Comments</p>
                      <div className="mt-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm">{selectedRequest.manager_comments}</p>
                      </div>
                    </div>
                  )}
                </SpaceBetween>
              </Container>

              <div className="flex gap-3 pt-4 border-t">
                {canEdit && selectedRequest.status === LeaveRequestStatus.PENDING && new Date(selectedRequest.start_date) > new Date() && (
                  <button
                    onClick={() => handleCancelRequest(selectedRequest)}
                    disabled={isCancelling}
                    className="flex-1 px-4 h-9 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                )}
                <button
                  onClick={() => { setIsDetailsOpen(false); setSelectedRequest(null); }}
                  className="flex-1 px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsExportModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-lg font-semibold text-gray-900">Export Leave History</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">Choose a format to export {totalCount} records.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExport('csv')}
                  className="flex-1 px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('xlsx')}
                  className="flex-1 px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Export Excel
                </button>
              </div>
            </div>
            <div className="flex justify-end px-6 pb-6">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveHistoryTable;
