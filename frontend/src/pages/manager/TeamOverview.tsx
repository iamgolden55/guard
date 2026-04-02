import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import api from '../../services/api';
import {
  User,
  LeaveBalanceSummary,
  PendingLeaveRequest,
  LeaveCalendarEvent,
  LeaveRequestFilterOptions
} from '../../types/leave';
import {
  Header,
  Container,
  SpaceBetween,
  EmptyState,
  Alert,
  Pagination,
} from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import TeamMemberCard from '../../components/leave/TeamMemberCard';
import TeamCalendarView from '../../components/leave/TeamCalendarView';
import QuickApprovalWidget from '../../components/leave/QuickApprovalWidget';
import TeamMemberDetailsPanel from '../../components/leave/TeamMemberDetailsPanel';

interface TeamMemberData {
  user: User;
  leaveBalances: LeaveBalanceSummary[];
  pendingRequests: PendingLeaveRequest[];
}

const TeamOverview: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [allPendingRequests, setAllPendingRequests] = useState<PendingLeaveRequest[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<LeaveCalendarEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentView, setCurrentView] = useState('overview');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Details panel state
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // Filter options
  const departmentOptions = [
    { key: 'all', text: 'All Departments' },
    { key: 'security', text: 'Security' },
    { key: 'admin', text: 'Administration' },
    { key: 'management', text: 'Management' }
  ];

  // Fetch team data
  const fetchTeamData = useCallback(async () => {
    if (!authState.user) return;

    setIsLoading(true);
    try {
      // Get team overview data (this would be a specialized endpoint)
      const { data: teamOverviewData } = await api.get('/api/v1/leave/team-overview/');

      // Process team members data
      const processedTeamMembers: TeamMemberData[] = teamOverviewData.team_members.map((member: any) => ({
        user: {
          id: member.id,
          username: member.username,
          email: member.email,
          first_name: member.first_name,
          last_name: member.last_name
        },
        leaveBalances: member.leave_balances || [],
        pendingRequests: member.pending_requests || []
      }));

      setTeamMembers(processedTeamMembers);

      // Get all pending requests for quick approval widget
      const pendingRequests = await leaveService.getPendingLeaveRequests();
      setAllPendingRequests(pendingRequests);

      // Get calendar events for the current month
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const calendarEvents = await leaveService.getLeaveCalendar(
        startOfMonth.toISOString().split('T')[0],
        endOfMonth.toISOString().split('T')[0]
      );
      setCalendarEvents(calendarEvents);

    } catch (error) {
      console.error('Error fetching team data:', error);
      addFlash({
        type: 'error',
        content: 'Failed to load team data. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [authState.user]);

  // Initial load
  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData, refreshTrigger]);

  // Handle search and filtering
  const filteredTeamMembers = teamMembers.filter(member => {
    const matchesSearch = !searchTerm ||
      `${member.user.first_name} ${member.user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.user.email.toLowerCase().includes(searchTerm.toLowerCase());

    // For now, we don't have department info, so we'll show all
    const matchesDepartment = selectedDepartment === 'all';

    return matchesSearch && matchesDepartment;
  });

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDepartment]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTeamMembers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTeamMembers = filteredTeamMembers.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of the team member list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Handle quick approval actions
  const handleQuickApprove = useCallback(async (requestId: number, comments?: string) => {
    try {
      await leaveService.processLeaveRequest({
        request_id: requestId,
        action: 'approve',
        comments
      });

      addFlash({
        type: 'success',
        content: 'Leave request approved successfully!',
      });

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      addFlash({
        type: 'error',
        content: 'Failed to approve request. Please try again.',
      });
    }
  }, []);

  const handleQuickReject = useCallback(async (requestId: number, comments?: string) => {
    try {
      await leaveService.processLeaveRequest({
        request_id: requestId,
        action: 'reject',
        comments
      });

      addFlash({
        type: 'success',
        content: 'Leave request rejected successfully!',
      });

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      addFlash({
        type: 'error',
        content: 'Failed to reject request. Please try again.',
      });
    }
  }, []);

  // Handle member detail view
  const handleViewMemberDetails = useCallback((userId: number) => {
    setSelectedMemberId(userId);
    setIsDetailsPanelOpen(true);
  }, []);

  // Handle calendar date range change
  const handleCalendarDateRangeChange = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      const events = await leaveService.getLeaveCalendar(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      setCalendarEvents(events);
    } catch (error) {
      console.error('Error updating calendar events:', error);
    }
  }, []);

  // Get summary statistics
  const summaryStats = React.useMemo(() => {
    const totalMembers = teamMembers.length;
    const totalPendingRequests = allPendingRequests.length;
    const urgentRequests = allPendingRequests.filter(req => req.urgency_level === 'high').length;

    const totalLeaveDays = teamMembers.reduce((sum, member) => {
      return sum + member.leaveBalances.reduce((memberSum, balance) => {
        return memberSum + parseFloat(balance.available_balance || '0');
      }, 0);
    }, 0);

    return {
      totalMembers,
      totalPendingRequests,
      urgentRequests,
      totalLeaveDays: totalLeaveDays.toFixed(1)
    };
  }, [teamMembers, allPendingRequests]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-sm text-gray-500">Loading team overview...</span>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Team Members' },
    { key: 'approvals', label: 'Quick Approvals' },
    { key: 'calendar', label: 'Team Calendar' },
  ];

  return (
    <div className="max-w-7xl">
      <SpaceBetween size="l">
        {/* Page Header */}
        <Header
          variant="h1"
          description="Manage your team's leave requests and balances"
          actions={
            <div className="flex items-center gap-2">
              <button
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Export Report
              </button>
              <button
                onClick={() => setRefreshTrigger(prev => prev + 1)}
                className="inline-flex items-center justify-center w-9 h-9 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Refresh data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          }
        >
          Team Overview
        </Header>

        {/* Notifications */}
        <Flashbar items={flashItems} onDismiss={removeFlash} />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Container>
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-600">{summaryStats.totalMembers}</p>
              <p className="text-sm text-gray-600 mt-1">Team Members</p>
            </div>
          </Container>

          <Container>
            <div className="text-center">
              <p className="text-2xl font-semibold text-amber-600">{summaryStats.totalPendingRequests}</p>
              <p className="text-sm text-gray-600 mt-1">Pending Requests</p>
            </div>
          </Container>

          <Container>
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-700">{summaryStats.urgentRequests}</p>
              <p className="text-sm text-gray-600 mt-1">Urgent Requests</p>
            </div>
          </Container>

          <Container>
            <div className="text-center">
              <p className="text-2xl font-semibold text-green-600">{summaryStats.totalLeaveDays}</p>
              <p className="text-sm text-gray-600 mt-1">Available Leave Days</p>
            </div>
          </Container>
        </div>

        {/* Tabs */}
        <div>
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCurrentView(tab.key)}
                  className={
                    currentView === tab.key
                      ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                      : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="pt-6">
            {/* Team Members Tab */}
            {currentView === 'overview' && (
              <SpaceBetween size="m">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 sm:max-w-xs">
                    <input
                      type="text"
                      placeholder="Search team members..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>

                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent sm:w-52"
                  >
                    {departmentOptions.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.text}</option>
                    ))}
                  </select>
                </div>

                {/* Pagination Info */}
                {filteredTeamMembers.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-gray-600">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredTeamMembers.length)} of {filteredTeamMembers.length} team members
                    </p>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="h-9 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent w-40"
                    >
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                    </select>
                  </div>
                )}

                {/* Team Members Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {paginatedTeamMembers.map(member => (
                    <TeamMemberCard
                      key={member.user.id}
                      user={member.user}
                      leaveBalances={member.leaveBalances}
                      pendingRequests={member.pendingRequests}
                      onViewDetails={handleViewMemberDetails}
                      onQuickApprove={handleQuickApprove}
                      onQuickReject={handleQuickReject}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {filteredTeamMembers.length > itemsPerPage && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    totalItems={filteredTeamMembers.length}
                  />
                )}

                {filteredTeamMembers.length === 0 && (
                  <EmptyState
                    title="No team members found"
                    description="No team members found matching your criteria."
                    variant="no-match"
                  />
                )}
              </SpaceBetween>
            )}

            {/* Quick Approvals Tab */}
            {currentView === 'approvals' && (
              <QuickApprovalWidget
                pendingRequests={allPendingRequests}
                onApprove={handleQuickApprove}
                onReject={handleQuickReject}
                onRefresh={() => setRefreshTrigger(prev => prev + 1)}
                isLoading={isLoading}
              />
            )}

            {/* Team Calendar Tab */}
            {currentView === 'calendar' && (
              <TeamCalendarView
                events={calendarEvents}
                onDateRangeChange={handleCalendarDateRangeChange}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </SpaceBetween>

      {/* Team Member Details Panel */}
      <TeamMemberDetailsPanel
        isOpen={isDetailsPanelOpen}
        onDismiss={() => {
          setIsDetailsPanelOpen(false);
          setSelectedMemberId(null);
        }}
        userId={selectedMemberId}
        memberData={
          selectedMemberId
            ? teamMembers.find(m => m.user.id === selectedMemberId)
            : undefined
        }
        onQuickApprove={handleQuickApprove}
        onQuickReject={handleQuickReject}
      />
    </div>
  );
};

export default TeamOverview;
