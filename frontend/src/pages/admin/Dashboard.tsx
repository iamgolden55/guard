import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Header, Container, SpaceBetween, ColumnLayout, StatusIndicator, Alert } from '../../components/cloudscape';
import { BulkPayrollGeneration } from '../../components';
import IncompleteShiftsWidget from '../../components/IncompleteShiftsWidget';
import ActiveShiftsWidget from '../../components/ActiveShiftsWidget';
import ActivityHeatMap from '../../components/ActivityHeatMap';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, deputyService, venueService, employmentTypeService, exchangeService } from '../../services';
import api from '../../services/api';
import type { DeputyStatus, User, Shift, Invoice, ActivityHeatMapData, HeatMapDayData } from '../../types';
import useIsMobile from '../../hooks/useIsMobile';

const AdminDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeShifts: 0,
    pendingApprovals: 0,
    totalStaff: 0,
    pendingInvoices: 0,
    venueCount: 0,
    onTimePercentage: 0
  });
  const [deputyStatus, setDeputyStatus] = useState<DeputyStatus | null>(null);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [showEmploymentTypePrompt, setShowEmploymentTypePrompt] = useState(false);
  const [incompleteShiftsCount, setIncompleteShiftsCount] = useState(0);
  const [activeShiftsCount, setActiveShiftsCount] = useState(0);
  const [activityHeatMapData, setActivityHeatMapData] = useState<ActivityHeatMapData>({
    days: [],
    summary: { totalScheduled: 0, totalCompleted: 0, completionRate: 0 },
    dateRange: { start: '', end: '' }
  });
  const [activeTab, setActiveTab] = useState('quickActions');
  const incompleteShiftsRef = useRef<HTMLDivElement>(null);

  // Scroll to incomplete shifts section
  const scrollToIncomplete = useCallback(() => {
    incompleteShiftsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // CRITICAL: Verify user is actually admin before rendering
  useEffect(() => {
    if (!authState.user || !authState.currentMembership) {
      console.warn('AdminDashboard: User or membership not loaded');
      return;
    }

    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';

    if (!isAdmin) {
      console.error('Non-admin user accessed admin dashboard!', {
        userRole: authState.user.role,
        membershipRole: membershipRole,
        isOwner: authState.currentMembership.isOwner
      });
      navigate('/dashboard', { replace: true });
    }
  }, [authState.user, authState.currentMembership, navigate]);

  // Early return if user is not admin
  if (authState.user && authState.currentMembership) {
    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';

    if (!isAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const [
          shiftsResult,
          invoicesResult,
          deputyStatusDataResult,
          usersResult,
          venuesResult,
          employmentTypesResult,
          pendingApprovalsResult,
          attendanceResult
        ] = await Promise.allSettled([
          shiftService.getShifts(),
          invoiceService.getInvoices(),
          deputyService.getDeputyStatus(),
          api.get<User[]>('/api/v1/users/'),
          venueService.getAllVenues(),
          employmentTypeService.getEmploymentTypes(),
          exchangeService.getPendingApprovals(),
          shiftService.getAttendanceReport({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            pageSize: 1
          })
        ]);

        const shiftsData = shiftsResult.status === 'fulfilled' && Array.isArray(shiftsResult.value) ? shiftsResult.value : [];
        const activeShifts = shiftsData.filter((shift: Shift) =>
          (shift.status as string) === 'active' || (shift.status as string) === 'in_progress'
        ).length;
        if (shiftsResult.status === 'rejected') {
          console.error("Failed to load shifts:", shiftsResult.reason);
        }

        let pendingApprovals = 0;
        if (pendingApprovalsResult.status === 'fulfilled') {
          const approvals = pendingApprovalsResult.value;
          pendingApprovals = (approvals.exchange_requests?.length || 0) + (approvals.shift_claims?.length || 0);
        } else {
          console.error("Failed to load pending approvals:", pendingApprovalsResult.reason);
        }

        const invoicesData = invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value) ? invoicesResult.value : [];
        const pendingInvoices = invoicesData.filter((invoice: Invoice) => invoice.status === 'pending').length;
        if (invoicesResult.status === 'rejected') {
          console.error("Failed to load invoices:", invoicesResult.reason);
        }

        let deputyStatusData: DeputyStatus | null = null;
        if (deputyStatusDataResult.status === 'fulfilled') {
          deputyStatusData = deputyStatusDataResult.value;
        } else {
          console.error('Failed to load Deputy status:', deputyStatusDataResult.reason);
          deputyStatusData = {
            isConnected: false,
            lastSyncDate: null,
            employeeCount: 0,
            timesheetCount: 0,
            errorMessage: 'Failed to connect to Deputy'
          };
        }
        setDeputyStatus(deputyStatusData);

        let totalStaff = 0;
        if (usersResult.status === 'fulfilled') {
          totalStaff = Array.isArray(usersResult.value?.data) ? usersResult.value.data.length : 0;
        } else {
          console.error('Failed to load user data:', usersResult.reason);
        }

        let venueCount = 0;
        if (venuesResult.status === 'fulfilled') {
          if (Array.isArray(venuesResult.value)) {
            venueCount = venuesResult.value.length;
          } else {
            console.warn('Unexpected response structure for venues:', venuesResult.value);
          }
        } else {
          console.error('Failed to load venue data:', venuesResult.reason);
        }

        let employmentTypesData: any[] = [];
        if (employmentTypesResult.status === 'fulfilled') {
          employmentTypesData = Array.isArray(employmentTypesResult.value) ? employmentTypesResult.value : [];
        } else {
          console.error('Failed to load employment types:', employmentTypesResult.reason);
        }
        setEmploymentTypes(employmentTypesData);
        setShowEmploymentTypePrompt(employmentTypesData.length === 0);

        let onTimePercentage = 0;
        if (attendanceResult.status === 'fulfilled') {
          onTimePercentage = attendanceResult.value?.summary?.onTimePercentage || 0;
        } else {
          console.error('Failed to load attendance data:', attendanceResult.reason);
        }

        // Generate heat map activity data from shifts (13 weeks = 91 days)
        const WEEKS_TO_SHOW = 13;
        const DAYS_TO_SHOW = WEEKS_TO_SHOW * 7;
        const todayDate = new Date();
        todayDate.setHours(12, 0, 0, 0); // Normalize to noon to avoid timezone issues

        // Align end date to Saturday (end of week)
        const heatMapEndDate = new Date(todayDate);
        heatMapEndDate.setDate(todayDate.getDate() + (6 - todayDate.getDay()));

        // Start from beginning of the period (91 days before end date)
        const heatMapStartDate = new Date(heatMapEndDate);
        heatMapStartDate.setDate(heatMapEndDate.getDate() - (DAYS_TO_SHOW - 1));

        const heatMapDays: HeatMapDayData[] = [];
        let totalScheduled = 0;
        let totalCompleted = 0;

        for (let i = 0; i < DAYS_TO_SHOW; i++) {
          const date = new Date(heatMapStartDate);
          date.setDate(heatMapStartDate.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];
          const dayOfWeek = date.getDay();
          const weekIndex = Math.floor(i / 7);
          const isToday = date.toDateString() === todayDate.toDateString();
          const isFuture = date > todayDate;

          const dayShifts = shiftsData.filter((shift: Shift) => {
            const shiftDate = new Date(shift.startTime || (shift as any).start_time).toISOString().split('T')[0];
            return shiftDate === dateStr;
          });

          const scheduled = dayShifts.length;
          const completed = dayShifts.filter((shift: Shift) =>
            (shift.status as string) === 'completed'
          ).length;

          if (!isFuture) {
            totalScheduled += scheduled;
            totalCompleted += completed;
          }

          heatMapDays.push({
            date: dateStr,
            dayOfWeek,
            weekIndex,
            scheduled,
            completed,
            isToday,
            isFuture
          });
        }

        const completionRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

        setActivityHeatMapData({
          days: heatMapDays,
          summary: {
            totalScheduled,
            totalCompleted,
            completionRate
          },
          dateRange: {
            start: heatMapStartDate.toISOString().split('T')[0],
            end: heatMapEndDate.toISOString().split('T')[0]
          }
        });

        setStats({
          activeShifts,
          pendingApprovals,
          totalStaff,
          pendingInvoices,
          venueCount,
          onTimePercentage
        });
      } catch (error) {
        console.error('An unexpected error occurred while loading dashboard data:', error);
        setStats({
          activeShifts: 0,
          pendingApprovals: 0,
          totalStaff: 0,
          pendingInvoices: 0,
          venueCount: 0,
          onTimePercentage: 0
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Determine if there are items needing attention
  const hasAttentionItems = incompleteShiftsCount > 0 || stats.onTimePercentage < 75 || stats.pendingApprovals > 0;

  const tabs = [
    { key: 'quickActions', label: 'Quick actions' },
    { key: 'deputyIntegration', label: 'Deputy' },
    { key: 'systemSettings', label: 'Settings' },
    { key: 'payroll', label: 'Payroll' },
  ];

  return (
    <SpaceBetween size="l">
      {/* Page header */}
      <Header
        variant="h1"
        description="Welcome back. Here's what's happening today."
      >
        Dashboard
      </Header>

      {/* Needs attention alert */}
      {hasAttentionItems && !isLoading && (
        <Alert
          type="error"
          header="Needs attention"
        >
          <div className="flex flex-wrap gap-4">
            {incompleteShiftsCount > 0 && (
              <button
                onClick={scrollToIncomplete}
                className="underline hover:no-underline"
              >
                {incompleteShiftsCount} incomplete shift{incompleteShiftsCount !== 1 ? 's' : ''}
              </button>
            )}
            {stats.onTimePercentage < 75 && (
              <span>
                On-time rate at {stats.onTimePercentage.toFixed(0)}%
              </span>
            )}
            {stats.pendingApprovals > 0 && (
              <button
                onClick={() => navigate('/approvals')}
                className="underline hover:no-underline"
              >
                {stats.pendingApprovals} pending approval{stats.pendingApprovals !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </Alert>
      )}

      {/* Employment type setup prompt */}
      {showEmploymentTypePrompt && (
        <Alert
          type="warning"
          header="Employment types required"
          dismissible
          onDismiss={() => setShowEmploymentTypePrompt(false)}
          action={
            <button
              onClick={() => navigate('/admin/employment-types')}
              className="text-sm font-medium text-amber-800 underline hover:no-underline"
            >
              Set up employment types
            </button>
          }
        >
          Before generating recruitment links, you need to set up employment types for your company.
        </Alert>
      )}

      {/* Primary metrics */}
      <ColumnLayout columns={3}>
        <MetricContainer
          title="Active shifts"
          value={stats.activeShifts}
          isLoading={isLoading}
          onClick={() => navigate('/staff-shifts')}
        />
        <MetricContainer
          title="Pending approvals"
          value={stats.pendingApprovals}
          statusType={stats.pendingApprovals > 0 ? 'warning' : 'success'}
          statusLabel={stats.pendingApprovals > 0 ? 'Action required' : 'All clear'}
          isLoading={isLoading}
          onClick={() => navigate('/approvals')}
        />
        <MetricContainer
          title="On-time rate"
          value={`${stats.onTimePercentage.toFixed(0)}%`}
          statusType={stats.onTimePercentage >= 90 ? 'success' : stats.onTimePercentage >= 75 ? 'warning' : 'error'}
          statusLabel={stats.onTimePercentage >= 90 ? 'Good' : stats.onTimePercentage >= 75 ? 'Fair' : 'Needs attention'}
          isLoading={isLoading}
          onClick={() => navigate('/admin/attendance')}
        />
      </ColumnLayout>

      {/* Secondary metrics */}
      <ColumnLayout columns={3}>
        <MetricContainer
          title="Total staff"
          value={stats.totalStaff}
          isLoading={isLoading}
          onClick={() => navigate('/admin/staff')}
        />
        <MetricContainer
          title="Total venues"
          value={stats.venueCount}
          isLoading={isLoading}
          onClick={() => navigate('/admin/venues')}
        />
        <MetricContainer
          title="Pending invoices"
          value={stats.pendingInvoices}
          statusType={stats.pendingInvoices > 0 ? 'warning' : undefined}
          statusLabel={stats.pendingInvoices > 0 ? 'Awaiting review' : undefined}
          isLoading={isLoading}
          onClick={() => navigate('/admin/invoices')}
        />
      </ColumnLayout>

      {/* Activity heat map */}
      <Container header="Shift activity">
        <ActivityHeatMap data={activityHeatMapData} isLoading={isLoading} />
      </Container>

      {/* Active shifts */}
      <Container header="Active shifts">
        <ActiveShiftsWidget onCountChange={setActiveShiftsCount} maxItems={5} />
      </Container>

      {/* Incomplete shifts + Tabbed content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Incomplete shifts */}
        <div ref={incompleteShiftsRef} className="lg:col-span-3 min-h-[300px]">
          <Container header="Incomplete shifts">
            <IncompleteShiftsWidget onCountChange={setIncompleteShiftsCount} maxItems={5} />
          </Container>
        </div>

        {/* Tabbed panel */}
        <div className="lg:col-span-2 min-h-[300px]">
          <Container disablePadding>
            {/* Tab bar */}
            <div className="border-b border-gray-200 px-5">
              <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Dashboard tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div className="p-5">
              {activeTab === 'quickActions' && (
                <SpaceBetween size="s">
                  <p className="text-sm font-medium text-gray-900">Common tasks</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <QuickActionCard
                      title="Staff management"
                      description="Add or edit staff members"
                      buttonLabel="Manage"
                      onClick={() => navigate('/admin/staff')}
                    />
                    <QuickActionCard
                      title="Venue management"
                      description="Manage venues and locations"
                      buttonLabel="Manage"
                      onClick={() => navigate('/admin/venues')}
                    />
                    <QuickActionCard
                      title="Approve shifts"
                      description="Review pending shifts"
                      buttonLabel="Review"
                      onClick={() => navigate('/approvals')}
                    />
                    <QuickActionCard
                      title="Generate invoices"
                      description="Create staff invoices"
                      buttonLabel="Invoices"
                      onClick={() => navigate('/admin/invoices')}
                    />
                  </div>
                </SpaceBetween>
              )}

              {activeTab === 'deputyIntegration' && (
                <SpaceBetween size="m">
                  <p className="text-sm font-medium text-gray-900">Deputy integration status</p>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <SpaceBetween size="s">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status</span>
                        <StatusIndicator type={deputyStatus?.isConnected ? 'success' : 'error'}>
                          {deputyStatus?.isConnected ? 'Connected' : 'Disconnected'}
                        </StatusIndicator>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last sync</span>
                        <span className="text-gray-900">{deputyStatus?.lastSyncDate ? formatDate(deputyStatus.lastSyncDate) : 'Never'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Employees synced</span>
                        <span className="text-gray-900">{deputyStatus?.employeeCount || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Timesheets synced</span>
                        <span className="text-gray-900">{deputyStatus?.timesheetCount || 0}</span>
                      </div>
                      {deputyStatus?.errorMessage && (
                        <p className="text-sm text-red-600">Error: {deputyStatus.errorMessage}</p>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => navigate('/admin/deputy')}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          Configure
                        </button>
                        <button
                          onClick={() => navigate('/admin/deputy/sync')}
                          disabled={!deputyStatus?.isConnected}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Sync now
                        </button>
                      </div>
                    </SpaceBetween>
                  )}
                </SpaceBetween>
              )}

              {activeTab === 'systemSettings' && (
                <SpaceBetween size="s">
                  <p className="text-sm font-medium text-gray-900">Global settings</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <QuickActionCard
                      title="System config"
                      description="System-wide settings"
                      buttonLabel="Settings"
                      onClick={() => navigate('/admin/settings')}
                    />
                    <QuickActionCard
                      title="Pay rates"
                      description="Configure pay rates"
                      buttonLabel="Manage"
                      onClick={() => navigate('/admin/payrates')}
                    />
                  </div>
                </SpaceBetween>
              )}

              {activeTab === 'payroll' && (
                <SpaceBetween size="m">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Weekly payroll</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Generate invoices for weekly payment periods (Mon-Sun).
                    </p>
                  </div>
                  <BulkPayrollGeneration />
                </SpaceBetween>
              )}
            </div>
          </Container>
        </div>
      </div>
    </SpaceBetween>
  );
};

// --- Sub-components ---

interface MetricContainerProps {
  title: string;
  value: number | string;
  statusType?: 'success' | 'warning' | 'error';
  statusLabel?: string;
  isLoading: boolean;
  onClick?: () => void;
}

const MetricContainer: React.FC<MetricContainerProps> = ({
  title,
  value,
  statusType,
  statusLabel,
  isLoading,
  onClick,
}) => (
  <Container>
    <button
      onClick={onClick}
      className="w-full text-left group"
    >
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      {isLoading ? (
        <div className="h-9 flex items-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
            {value}
          </span>
          {statusType && statusLabel && (
            <StatusIndicator type={statusType}>{statusLabel}</StatusIndicator>
          )}
        </div>
      )}
    </button>
  </Container>
);

interface QuickActionCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  description,
  buttonLabel,
  onClick,
}) => (
  <div className="flex flex-col rounded-lg border border-gray-200 p-3">
    <p className="text-sm font-medium text-gray-900">{title}</p>
    <p className="text-xs text-gray-500 mt-0.5 mb-3">{description}</p>
    <button
      onClick={onClick}
      className="mt-auto self-start px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
    >
      {buttonLabel}
    </button>
  </div>
);

export default AdminDashboard;
