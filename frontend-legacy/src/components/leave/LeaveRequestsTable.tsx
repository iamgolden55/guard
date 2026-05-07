import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  DetailsList,
  DetailsListLayoutMode,
  Selection,
  SelectionMode,
  IColumn,
  IconButton,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  CommandBar,
  ICommandBarItemProps,
  SearchBox
} from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveRequestFilterOptions } from '../../types/leave';
import api from '../../services/api';

interface DetailedLeaveRequest {
  id: number;
  staff_user: {
    id: number;
    name: string;
    email: string;
    department: string | null;
  };
  leave_type: {
    id: number;
    name: string;
    code: string;
    color_code: string;
  };
  start_date: string;
  end_date: string;
  days_requested: number;
  status: string;
  reason: string;
  created_at: string;
  approved_by: {
    id: number;
    name: string;
  } | null;
  approved_at: string | null;
  manager_notes: string | null;
  rejection_reason: string | null;
}

interface PaginationInfo {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface LeaveRequestsTableProps {
  filters?: LeaveRequestFilterOptions;
  onRefresh?: () => void;
  className?: string;
}

const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  filters = {},
  onRefresh,
  className = ''
}) => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<DetailedLeaveRequest[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [sortField, setSortField] = useState<string>('-created_at');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch detailed requests
  const fetchDetailedRequests = useCallback(async () => {
    if (!authState.user) return;

    setIsLoading(true);
    setError('');

    try {
      const year = new Date().getFullYear();
      const params = new URLSearchParams();
      params.append('year', year.toString());
      params.append('page', currentPage.toString());
      params.append('page_size', pageSize.toString());
      params.append('ordering', sortField);

      // Add filters
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

      const { data } = await api.get(`/api/v1/leave/reports/detailed_requests/?${params.toString()}`);
      setRequests(data.results || []);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error('Error fetching detailed requests:', err);
      setError('Failed to load detailed requests. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [authState.user, currentPage, pageSize, sortField, filters]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchDetailedRequests();
  }, [fetchDetailedRequests]);

  // Handle column click for sorting
  const onColumnClick = useCallback((ev?: React.MouseEvent<HTMLElement>, column?: IColumn) => {
    if (!column || !column.key) return;

    const fieldMap: { [key: string]: string } = {
      'staff_user': 'staff_user__first_name',
      'leave_type': 'leave_type__name',
      'start_date': 'start_date',
      'days_requested': 'days_requested',
      'status': 'status',
      'created_at': 'created_at'
    };

    const field = fieldMap[column.key] || column.key;
    const newSortField = sortField === field ? `-${field}` : field;
    setSortField(newSortField);
    setCurrentPage(1); // Reset to first page when sorting changes
  }, [sortField]);

  // Table columns
  const columns: IColumn[] = [
    {
      key: 'staff_user',
      name: 'Employee',
      fieldName: 'staff_user',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      isSorted: sortField.includes('staff_user'),
      isSortedDescending: sortField.startsWith('-') && sortField.includes('staff_user'),
      onColumnClick: onColumnClick,
      onRender: (item: DetailedLeaveRequest) => (
        <div>
          <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
            {item.staff_user.name}
          </Text>
          <Text variant="small" styles={{ root: { color: '#666', display: 'block' } }}>
            {item.staff_user.email}
          </Text>
          {item.staff_user.department && (
            <Text variant="small" styles={{ root: { color: '#888', display: 'block' } }}>
              {item.staff_user.department}
            </Text>
          )}
        </div>
      )
    },
    {
      key: 'leave_type',
      name: 'Leave Type',
      fieldName: 'leave_type',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      isSorted: sortField.includes('leave_type'),
      isSortedDescending: sortField.startsWith('-') && sortField.includes('leave_type'),
      onColumnClick: onColumnClick,
      onRender: (item: DetailedLeaveRequest) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: item.leave_type.color_code
            }}
          />
          <Text variant="medium">{item.leave_type.name}</Text>
        </div>
      )
    },
    {
      key: 'start_date',
      name: 'Dates',
      fieldName: 'start_date',
      minWidth: 150,
      maxWidth: 180,
      isResizable: true,
      isSorted: sortField.includes('start_date'),
      isSortedDescending: sortField.startsWith('-') && sortField.includes('start_date'),
      onColumnClick: onColumnClick,
      onRender: (item: DetailedLeaveRequest) => (
        <div>
          <Text variant="small" styles={{ root: { display: 'block' } }}>
            {new Date(item.start_date).toLocaleDateString()}
          </Text>
          <Text variant="small" styles={{ root: { color: '#666', display: 'block' } }}>
            to {new Date(item.end_date).toLocaleDateString()}
          </Text>
        </div>
      )
    },
    {
      key: 'days_requested',
      name: 'Days',
      fieldName: 'days_requested',
      minWidth: 60,
      maxWidth: 80,
      isResizable: true,
      isSorted: sortField.includes('days_requested'),
      isSortedDescending: sortField.startsWith('-') && sortField.includes('days_requested'),
      onColumnClick: onColumnClick,
      onRender: (item: DetailedLeaveRequest) => (
        <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
          {item.days_requested}
        </Text>
      )
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      isSorted: sortField.includes('status'),
      isSortedDescending: sortField.startsWith('-') && sortField.includes('status'),
      onColumnClick: onColumnClick,
      onRender: (item: DetailedLeaveRequest) => {
        const statusColors: { [key: string]: { bg: string; text: string } } = {
          'approved': { bg: '#D4EDDA', text: '#155724' },
          'pending': { bg: '#FFF3CD', text: '#856404' },
          'rejected': { bg: '#F8D7DA', text: '#721C24' },
          'cancelled': { bg: '#E2E3E5', text: '#383D41' }
        };
        const colors = statusColors[item.status.toLowerCase()] || { bg: '#E2E3E5', text: '#383D41' };

        return (
          <div
            style={{
              backgroundColor: colors.bg,
              color: colors.text,
              padding: '4px 12px',
              borderRadius: '12px',
              display: 'inline-block',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {item.status.toLowerCase()}
          </div>
        );
      }
    },
    {
      key: 'created_at',
      name: 'Requested',
      fieldName: 'created_at',
      minWidth: 100,
      maxWidth: 130,
      isResizable: true,
      isSorted: sortField.includes('created_at'),
      isSortedDescending: sortField.startsWith('-') && sortField.includes('created_at'),
      onColumnClick: onColumnClick,
      onRender: (item: DetailedLeaveRequest) => (
        <Text variant="small">
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      )
    },
    {
      key: 'approved_by',
      name: 'Approved By',
      fieldName: 'approved_by',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: DetailedLeaveRequest) => (
        <div>
          {item.approved_by ? (
            <>
              <Text variant="small" styles={{ root: { display: 'block' } }}>
                {item.approved_by.name}
              </Text>
              {item.approved_at && (
                <Text variant="small" styles={{ root: { color: '#666', display: 'block' } }}>
                  {new Date(item.approved_at).toLocaleDateString()}
                </Text>
              )}
            </>
          ) : (
            <Text variant="small" styles={{ root: { color: '#666' } }}>
              -
            </Text>
          )}
        </div>
      )
    }
  ];

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: () => {
        setCurrentPage(1);
        fetchDetailedRequests();
        if (onRefresh) onRefresh();
      }
    },
    {
      key: 'pageSize',
      text: `${pageSize} per page`,
      iconProps: { iconName: 'Page' },
      subMenuProps: {
        items: [
          { key: '10', text: '10 per page', onClick: () => { setPageSize(10); setCurrentPage(1); } },
          { key: '25', text: '25 per page', onClick: () => { setPageSize(25); setCurrentPage(1); } },
          { key: '50', text: '50 per page', onClick: () => { setPageSize(50); setCurrentPage(1); } },
          { key: '100', text: '100 per page', onClick: () => { setPageSize(100); setCurrentPage(1); } }
        ]
      }
    }
  ];

  if (isLoading) {
    return (
      <div className={`leave-requests-table ${className}`}>
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading leave requests..." />
        </Stack>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`leave-requests-table ${className}`}>
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError('')}
        >
          {error}
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={`leave-requests-table ${className}`}>
      <Stack tokens={{ childrenGap: 16 }}>
        {/* Command Bar */}
        <CommandBar items={commandBarItems} />

        {/* Summary */}
        {pagination && (
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text variant="medium">
              Showing {requests.length} of {pagination.count} requests
              {pagination.total_pages > 1 && ` (Page ${pagination.page} of ${pagination.total_pages})`}
            </Text>
          </Stack>
        )}

        {/* Table */}
        <DetailsList
          items={requests}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
        />

        {/* Pagination Controls */}
        {pagination && pagination.total_pages > 1 && (
          <Stack horizontal horizontalAlign="center" tokens={{ childrenGap: 8 }}>
            <IconButton
              iconProps={{ iconName: 'ChevronLeft' }}
              disabled={!pagination.has_previous}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              title="Previous page"
            />
            <Text variant="medium" styles={{ root: { padding: '4px 12px' } }}>
              Page {pagination.page} of {pagination.total_pages}
            </Text>
            <IconButton
              iconProps={{ iconName: 'ChevronRight' }}
              disabled={!pagination.has_next}
              onClick={() => setCurrentPage(prev => prev + 1)}
              title="Next page"
            />
          </Stack>
        )}

        {/* Empty state */}
        {requests.length === 0 && (
          <Stack horizontalAlign="center" tokens={{ padding: 40 }}>
            <Text variant="large" styles={{ root: { color: '#666' } }}>
              No leave requests found
            </Text>
            <Text variant="small" styles={{ root: { color: '#888', marginTop: 8 } }}>
              Try adjusting your filters or date range
            </Text>
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export default LeaveRequestsTable;
