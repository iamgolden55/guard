import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Container, CloudscapeTable, StatusIndicator, SpaceBetween, EmptyState } from '../../components/cloudscape';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService } from '../../services';
import { type Shift, ShiftStatus } from '../../types';

const ManagerDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState<Shift[]>([]);
  const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<Shift[]>([]);
  const [searchText, setSearchText] = useState('');

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        // Get all shifts
        const shifts = await shiftService.getShifts();

        // Filter pending approvals (completed but not approved)
        const pendingApprovalShifts = shifts.filter(
          shift => shift.status === ShiftStatus.COMPLETED && !shift.managerApproved
        );

        // Get recent approved/rejected shifts
        const recentApprovedShifts = shifts
          .filter(shift =>
            shift.status === ShiftStatus.APPROVED ||
            shift.status === ShiftStatus.REJECTED
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 10);

        setPendingApprovals(pendingApprovalShifts);
        setRecentShifts(recentApprovedShifts);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate shift duration
  const getShiftDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 'In progress';

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  // Filter pending approvals based on search text
  const filteredApprovals = pendingApprovals.filter(shift =>
    searchText === '' ||
    shift.venue.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Column definitions for pending approvals table
  const approvalColumns: ColumnDefinition<Shift>[] = [
    {
      id: 'staffName',
      header: 'Staff',
      cell: (item: Shift) => (
        <span className="font-medium text-gray-900">Staff ID: {item.staffUser}</span>
      ),
      sortingField: 'staffUser',
    },
    {
      id: 'venue',
      header: 'Venue',
      cell: (item: Shift) => item.venue.name,
      sortingField: 'venue',
    },
    {
      id: 'date',
      header: 'Date',
      cell: (item: Shift) => formatDate(item.startTime),
      sortingField: 'startTime',
    },
    {
      id: 'startTime',
      header: 'Start',
      cell: (item: Shift) => formatTime(item.startTime),
    },
    {
      id: 'endTime',
      header: 'End',
      cell: (item: Shift) => item.endTime ? formatTime(item.endTime) : 'N/A',
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: (item: Shift) => getShiftDuration(item.startTime, item.endTime),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item: Shift) => (
        <StatusIndicator type="pending">{item.status}</StatusIndicator>
      ),
    },
  ];

  // Column definitions for recent approvals table (extends approval columns)
  const recentColumns: ColumnDefinition<Shift>[] = [
    ...approvalColumns.map(col => {
      if (col.id === 'status') {
        return {
          ...col,
          cell: (item: Shift) => {
            const statusType = item.status === ShiftStatus.APPROVED ? 'success' as const : 'error' as const;
            return <StatusIndicator type={statusType}>{item.status}</StatusIndicator>;
          },
        };
      }
      return col;
    }),
    {
      id: 'approved',
      header: 'Approved',
      cell: (item: Shift) => (
        <StatusIndicator type={item.managerApproved ? 'success' : 'error'}>
          {item.managerApproved ? 'Yes' : 'No'}
        </StatusIndicator>
      ),
    },
  ];

  return (
    <SpaceBetween size="l">
      {/* Page header */}
      <Header
        variant="h1"
        description={`Welcome back, ${authState.user?.firstName || 'Manager'}. Here's your shift approval overview.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => navigate('/staff-shifts')}
            >
              View all staff shifts
            </button>
            <button
              type="button"
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              onClick={() => navigate('/approvals')}
            >
              Manage approvals
            </button>
          </div>
        }
      >
        Manager dashboard
      </Header>

      {/* Pending approvals */}
      <CloudscapeTable<Shift>
        items={filteredApprovals}
        columnDefinitions={approvalColumns}
        loading={isLoading}
        loadingText="Loading pending approvals"
        trackBy="id"
        selectionType="single"
        selectedItems={selectedShifts}
        onSelectionChange={setSelectedShifts}
        header={
          <Header
            variant="h2"
            counter={`${filteredApprovals.length}`}
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedShifts.length === 0}
                  onClick={() => {
                    const shiftId = selectedShifts[0].id;
                    navigate(`/approvals/${shiftId}`);
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedShifts.length === 0}
                  onClick={() => {
                    const shiftId = selectedShifts[0].id;
                    navigate(`/approvals/${shiftId}?reject=true`);
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedShifts.length !== 1}
                  onClick={() => {
                    const shiftId = selectedShifts[0].id;
                    navigate(`/shifts/${shiftId}`);
                  }}
                >
                  View details
                </button>
              </div>
            }
          >
            Pending approvals
          </Header>
        }
        filter={
          <input
            type="text"
            placeholder="Search by venue"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors"
          />
        }
        empty={
          <EmptyState
            title="No pending approvals"
            description="All shifts have been reviewed. Check back later for new submissions."
          />
        }
        cardDefinition={{
          header: (item: Shift) => item.venue.name,
          sections: [
            { id: 'staff', header: 'Staff', content: (item: Shift) => `Staff ID: ${item.staffUser}` },
            { id: 'date', header: 'Date', content: (item: Shift) => formatDate(item.startTime) },
            { id: 'time', header: 'Time', content: (item: Shift) => `${formatTime(item.startTime)} - ${item.endTime ? formatTime(item.endTime) : 'N/A'}` },
            { id: 'duration', header: 'Duration', content: (item: Shift) => getShiftDuration(item.startTime, item.endTime) },
            { id: 'status', header: 'Status', content: (item: Shift) => <StatusIndicator type="pending">{item.status}</StatusIndicator> },
          ],
        }}
      />

      {/* Recent approvals */}
      <CloudscapeTable<Shift>
        items={recentShifts}
        columnDefinitions={recentColumns}
        loading={isLoading}
        loadingText="Loading recent activity"
        trackBy="id"
        header={
          <Header variant="h2" counter={`${recentShifts.length}`}>
            Recent approvals
          </Header>
        }
        empty={
          <EmptyState
            title="No recent approvals"
            description="Approved and rejected shifts will appear here."
          />
        }
        cardDefinition={{
          header: (item: Shift) => item.venue.name,
          sections: [
            { id: 'staff', header: 'Staff', content: (item: Shift) => `Staff ID: ${item.staffUser}` },
            { id: 'date', header: 'Date', content: (item: Shift) => formatDate(item.startTime) },
            { id: 'time', header: 'Time', content: (item: Shift) => `${formatTime(item.startTime)} - ${item.endTime ? formatTime(item.endTime) : 'N/A'}` },
            {
              id: 'status',
              header: 'Status',
              content: (item: Shift) => {
                const statusType = item.status === ShiftStatus.APPROVED ? 'success' as const : 'error' as const;
                return <StatusIndicator type={statusType}>{item.status}</StatusIndicator>;
              },
            },
            {
              id: 'approved',
              header: 'Approved',
              content: (item: Shift) => (
                <StatusIndicator type={item.managerApproved ? 'success' : 'error'}>
                  {item.managerApproved ? 'Yes' : 'No'}
                </StatusIndicator>
              ),
            },
          ],
        }}
      />
    </SpaceBetween>
  );
};

export default ManagerDashboard;
