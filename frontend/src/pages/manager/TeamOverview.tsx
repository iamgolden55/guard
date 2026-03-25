import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  SearchBox,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  DefaultButton,
  IconButton,
  IStackTokens,
  Pivot,
  PivotItem
} from '@fluentui/react';
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
import TeamMemberCard from '../../components/leave/TeamMemberCard';
import TeamCalendarView from '../../components/leave/TeamCalendarView';
import QuickApprovalWidget from '../../components/leave/QuickApprovalWidget';
import TeamMemberDetailsPanel from '../../components/leave/TeamMemberDetailsPanel';

interface TeamMemberData {
  user: User;
  leaveBalances: LeaveBalanceSummary[];
  pendingRequests: PendingLeaveRequest[];
}

const stackTokens: IStackTokens = {
  childrenGap: 24,
  padding: 16,
};

const TeamOverview: React.FC = () => {
  const { authState } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [allPendingRequests, setAllPendingRequests] = useState<PendingLeaveRequest[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<LeaveCalendarEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [notification, setNotification] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentView, setCurrentView] = useState('overview');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Details panel state
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // Filter options
  const departmentOptions: IDropdownOption[] = [
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
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to load team data. Please try again.'
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

      setNotification({
        type: MessageBarType.success,
        message: 'Leave request approved successfully!'
      });

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to approve request. Please try again.'
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

      setNotification({
        type: MessageBarType.success,
        message: 'Leave request rejected successfully!'
      });

      // Refresh data
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      setNotification({
        type: MessageBarType.error,
        message: 'Failed to reject request. Please try again.'
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

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

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
      <div className="team-overview-page">
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading team overview..." />
        </Stack>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      <Stack tokens={stackTokens}>
        {/* Page Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack>
            <Text variant="xxLarge" styles={{ root: { fontWeight: 600 } }}>
              Team Overview
            </Text>
            <Text variant="medium" styles={{ root: { color: '#666' } }}>
              Manage your team's leave requests and balances
            </Text>
          </Stack>

          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <DefaultButton
              text="Export Report"
              iconProps={{ iconName: 'Download' }}
            />
            <IconButton
              iconProps={{ iconName: 'Refresh' }}
              onClick={() => setRefreshTrigger(prev => prev + 1)}
              title="Refresh data"
            />
          </Stack>
        </Stack>

        {/* Notification */}
        {notification && (
          <MessageBar
            messageBarType={notification.type}
            onDismiss={() => setNotification(null)}
            dismissButtonAriaLabel="Close"
          >
            {notification.message}
          </MessageBar>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#0078d4' } }}>
                {summaryStats.totalMembers}
              </Text>
              <Text variant="medium">Team Members</Text>
            </Stack>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#ff8c00' } }}>
                {summaryStats.totalPendingRequests}
              </Text>
              <Text variant="medium">Pending Requests</Text>
            </Stack>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#d13438' } }}>
                {summaryStats.urgentRequests}
              </Text>
              <Text variant="medium">Urgent Requests</Text>
            </Stack>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" styles={{ root: { fontWeight: 600, color: '#107c10' } }}>
                {summaryStats.totalLeaveDays}
              </Text>
              <Text variant="medium">Available Leave Days</Text>
            </Stack>
          </div>
        </div>

        {/* Main Content with Tabs */}
        <Pivot
          selectedKey={currentView}
          onLinkClick={(item) => setCurrentView(item?.props.itemKey || 'overview')}
        >
          <PivotItem headerText="Team Members" itemKey="overview">
            <Stack tokens={{ childrenGap: 16 }}>
              {/* Filters */}
              <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                <SearchBox
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={(_, newValue) => setSearchTerm(newValue || '')}
                  styles={{ root: { width: 300 } }}
                />

                <Dropdown
                  placeholder="Filter by department"
                  options={departmentOptions}
                  selectedKey={selectedDepartment}
                  onChange={(_, option) => setSelectedDepartment(option?.key as string)}
                  styles={{ dropdown: { width: 200 } }}
                />
              </Stack>

              {/* Pagination Info */}
              {filteredTeamMembers.length > 0 && (
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Text variant="medium">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredTeamMembers.length)} of {filteredTeamMembers.length} team members
                  </Text>
                  <Dropdown
                    placeholder="Items per page"
                    selectedKey={itemsPerPage}
                    onChange={(_, option) => handleItemsPerPageChange(option?.key as number)}
                    options={[
                      { key: 10, text: '10 per page' },
                      { key: 20, text: '20 per page' },
                      { key: 50, text: '50 per page' }
                    ]}
                    styles={{ dropdown: { width: 150 } }}
                  />
                </Stack>
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
                <Stack horizontal horizontalAlign="center" tokens={{ childrenGap: 8 }} wrap>
                  <DefaultButton
                    text="Previous"
                    iconProps={{ iconName: 'ChevronLeft' }}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  />

                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                    // Show first 3, last 3, and current page with neighbors
                    const pageNum = i + 1;
                    const shouldShow =
                      pageNum <= 3 ||
                      pageNum > totalPages - 3 ||
                      Math.abs(pageNum - currentPage) <= 1;

                    if (!shouldShow && (pageNum === 4 || pageNum === totalPages - 3)) {
                      return <Text key={`ellipsis-${i}`} variant="medium">...</Text>;
                    }

                    if (!shouldShow) {
                      return null;
                    }

                    return (
                      <DefaultButton
                        key={pageNum}
                        text={pageNum.toString()}
                        onClick={() => handlePageChange(pageNum)}
                        styles={{
                          root: {
                            minWidth: 40,
                            backgroundColor: currentPage === pageNum ? '#0078d4' : undefined,
                            color: currentPage === pageNum ? '#fff' : undefined
                          }
                        }}
                      />
                    );
                  })}

                  <DefaultButton
                    text="Next"
                    iconProps={{ iconName: 'ChevronRight' }}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  />
                </Stack>
              )}

              {filteredTeamMembers.length === 0 && (
                <Stack horizontalAlign="center" tokens={{ padding: 40 }}>
                  <Text variant="large" styles={{ root: { color: '#666' } }}>
                    No team members found matching your criteria.
                  </Text>
                </Stack>
              )}
            </Stack>
          </PivotItem>

          <PivotItem headerText="Quick Approvals" itemKey="approvals">
            <QuickApprovalWidget
              pendingRequests={allPendingRequests}
              onApprove={handleQuickApprove}
              onReject={handleQuickReject}
              onRefresh={() => setRefreshTrigger(prev => prev + 1)}
              isLoading={isLoading}
            />
          </PivotItem>

          <PivotItem headerText="Team Calendar" itemKey="calendar">
            <TeamCalendarView
              events={calendarEvents}
              onDateRangeChange={handleCalendarDateRangeChange}
              isLoading={isLoading}
            />
          </PivotItem>
        </Pivot>
      </Stack>

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