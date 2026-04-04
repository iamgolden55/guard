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

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        const shifts = await shiftService.getShifts();

        const pendingApprovalShifts = shifts.filter(
          shift => shift.status === ShiftStatus.COMPLETED && !shift.managerApproved
        );

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

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const getShiftDuration = (startTime: string, endTime: string | null) => {
    if (!endTime) return 'In progress';
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const filteredApprovals = pendingApprovals.filter(shift =>
    searchText === '' ||
    shift.venue.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const approvalColumns: ColumnDefinition<Shift>[] = [
    {
      id: 'staffName',
      header: 'Staff',
      cell: (item: Shift) => (
        <span className="font-medium text-[#1A1A2E]">Staff ID: {item.staffUser}</span>
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
    <SpaceBetween size="xl">
      {/* Page header */}
      <Header
        variant="h1"
        description={`Welcome back, ${authState.user?.firstName || 'Manager'}. Here's your shift approval overview.`}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="px-4 py-2.5 text-[13px] font-medium text-[#1A1A2E] bg-white border border-[#EAEAF0] rounded-[10px] hover:bg-[#F7F7FA] transition-colors"
              onClick={() => navigate('/staff-shifts')}
            >
              View all staff shifts
            </button>
            <button
              type="button"
              className="px-4 py-2.5 text-[13px] font-medium text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors"
              onClick={() => navigate('/approvals')}
            >
              Manage approvals
            </button>
          </div>
        }
      >
        Manager dashboard
      </Header>

      {/* Summary stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white border border-[#EAEAF0] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#D97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-[13px] font-medium text-[#9CA3AF] mb-1">Pending approvals</p>
          <p className="text-[32px] font-bold text-[#1A1A2E] tracking-[-0.02em] leading-10">{pendingApprovals.length}</p>
          {pendingApprovals.length > 0 && (
            <span className="inline-flex mt-2 items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#FFFBEB] text-[#D97706]">
              Needs review
            </span>
          )}
        </div>
        <div className="bg-white border border-[#EAEAF0] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#059669]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-[13px] font-medium text-[#9CA3AF] mb-1">Recently approved</p>
          <p className="text-[32px] font-bold text-[#1A1A2E] tracking-[-0.02em] leading-10">
            {recentShifts.filter(s => s.status === ShiftStatus.APPROVED).length}
          </p>
        </div>
        <div className="bg-white border border-[#EAEAF0] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#DC2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <p className="text-[13px] font-medium text-[#9CA3AF] mb-1">Recently rejected</p>
          <p className="text-[32px] font-bold text-[#1A1A2E] tracking-[-0.02em] leading-10">
            {recentShifts.filter(s => s.status === ShiftStatus.REJECTED).length}
          </p>
        </div>
      </div>

      {/* Pending approvals table */}
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
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  className="px-4 py-2 text-[13px] font-medium text-white bg-[#DC2626] rounded-[10px] hover:bg-[#B91C1C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="px-4 py-2 text-[13px] font-medium text-[#1A1A2E] bg-white border border-[#EAEAF0] rounded-[10px] hover:bg-[#F7F7FA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="px-4 py-2 text-[13px] font-medium text-[#1A1A2E] bg-white border border-[#EAEAF0] rounded-[10px] hover:bg-[#F7F7FA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="w-full max-w-xs px-3.5 py-2.5 text-[13px] border border-[#EAEAF0] rounded-[10px] focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] outline-none transition-colors placeholder-[#9CA3AF]"
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

      {/* Recent approvals table */}
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
