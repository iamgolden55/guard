import type React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Pivot,
  PivotItem,
  Text,
  PrimaryButton,
  MessageBar,
  MessageBarType,
  DefaultButton
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import MetricCard from '../../components/MetricCard';
import ActivityHeatMap from '../../components/ActivityHeatMap';
import { BulkPayrollGeneration, Card, SwipeableTabs } from '../../components';
import IncompleteShiftsWidget from '../../components/IncompleteShiftsWidget';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, deputyService, venueService, employmentTypeService, exchangeService } from '../../services';
import api from '../../services/api';
import type { DeputyStatus, User, Shift, Invoice, ActivityHeatMapData, HeatMapDayData } from '../../types';
import useIsMobile from '../../hooks/useIsMobile';

// Alert icon for Needs Attention banner
const AlertIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

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
  const [activityHeatMapData, setActivityHeatMapData] = useState<ActivityHeatMapData>({
    days: [],
    summary: { totalScheduled: 0, totalCompleted: 0, completionRate: 0 },
    dateRange: { start: '', end: '' }
  });
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

  return (
    <MainLayout>
      <div className="space-y-6 pb-20 lg:pb-0">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Welcome back. Here's what's happening today.</p>
          </div>
        </div>

        {/* Needs Attention Banner */}
        {hasAttentionItems && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900">Needs Attention</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  {incompleteShiftsCount > 0 && (
                    <button
                      onClick={scrollToIncomplete}
                      className="text-red-700 hover:underline"
                    >
                      {incompleteShiftsCount} incomplete shift{incompleteShiftsCount !== 1 ? 's' : ''}
                    </button>
                  )}
                  {stats.onTimePercentage < 75 && (
                    <span className="text-red-700">
                      On-time rate at {stats.onTimePercentage.toFixed(0)}%
                    </span>
                  )}
                  {stats.pendingApprovals > 0 && (
                    <button
                      onClick={() => navigate('/approvals')}
                      className="text-red-700 hover:underline"
                    >
                      {stats.pendingApprovals} pending approval{stats.pendingApprovals !== 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Metric Cards - 3 column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Active Shifts"
            value={stats.activeShifts}
            icon="Clock"
            iconColor="#0078D4"
            isLoading={isLoading}
            onClick={() => navigate('/staff-shifts')}
          />
          <MetricCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon="Permissions"
            iconColor={stats.pendingApprovals > 0 ? '#D83B01' : '#107C10'}
            isLoading={isLoading}
            onClick={() => navigate('/approvals')}
            variant={stats.pendingApprovals > 5 ? 'warning' : 'default'}
          />
          <MetricCard
            title="On-time Rate"
            value={`${stats.onTimePercentage.toFixed(0)}%`}
            icon="Timer"
            iconColor={stats.onTimePercentage >= 75 ? '#10B981' : '#EF4444'}
            isLoading={isLoading}
            onClick={() => navigate('/admin/attendance')}
            trend={stats.onTimePercentage >= 90 ? 'Good' : stats.onTimePercentage >= 75 ? 'Fair' : 'Needs attention'}
            trendDirection={stats.onTimePercentage >= 90 ? 'up' : stats.onTimePercentage >= 75 ? 'neutral' : 'down'}
            variant={stats.onTimePercentage < 75 ? 'critical' : stats.onTimePercentage < 85 ? 'warning' : 'default'}
          />
        </div>

        {/* Secondary Metrics - 3 column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Staff"
            value={stats.totalStaff}
            icon="People"
            iconColor="#5C2D91"
            isLoading={isLoading}
            onClick={() => navigate('/admin/staff')}
          />
          <MetricCard
            title="Total Venues"
            value={stats.venueCount}
            icon="POI"
            iconColor="#008272"
            isLoading={isLoading}
            onClick={() => navigate('/admin/venues')}
          />
          <MetricCard
            title="Pending Invoices"
            value={stats.pendingInvoices}
            icon="PaymentCard"
            iconColor={stats.pendingInvoices > 0 ? '#D83B01' : '#6B7280'}
            isLoading={isLoading}
            onClick={() => navigate('/admin/invoices')}
            variant={stats.pendingInvoices > 10 ? 'warning' : 'default'}
          />
        </div>

        {/* Activity Heat Map */}
        <ActivityHeatMap data={activityHeatMapData} isLoading={isLoading} />

        {/* Incomplete Shifts + Quick Actions Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Incomplete Shifts Widget - Left (60% width) */}
          <div ref={incompleteShiftsRef} className="lg:col-span-3 min-h-[300px]">
            <IncompleteShiftsWidget onCountChange={setIncompleteShiftsCount} maxItems={5} />
          </div>

          {/* Tabbed Content - Right (40% width) */}
          <div className="lg:col-span-2 min-h-[300px]">
            {isMobile ? (
              <SwipeableTabs
            tabs={[
              {
                key: 'quickActions',
                headerText: 'Quick Actions',
                content: (
                  <div className="space-y-4 p-4">
                    <h3 className="text-lg font-medium text-gray-900">Common Tasks</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <Card className="flex flex-col">
                        <Text variant="medium" className="font-semibold mb-2">Staff Management</Text>
                        <Text className="mb-4 text-gray-600">Add, edit, or deactivate staff members.</Text>
                        <PrimaryButton text="Manage Staff" onClick={() => navigate('/admin/staff')} />
                      </Card>
                      <Card className="flex flex-col">
                        <Text variant="medium" className="font-semibold mb-2">Venue Management</Text>
                        <Text className="mb-4 text-gray-600">Manage venues and locations.</Text>
                        <PrimaryButton text="Manage Venues" onClick={() => navigate('/admin/venues')} />
                      </Card>
                      <Card className="flex flex-col">
                        <Text variant="medium" className="font-semibold mb-2">Approve Shifts</Text>
                        <Text className="mb-4 text-gray-600">Review and approve pending shifts.</Text>
                        <PrimaryButton text="Shift Approvals" onClick={() => navigate('/approvals')} />
                      </Card>
                      <Card className="flex flex-col">
                        <Text variant="medium" className="font-semibold mb-2">Generate Invoices</Text>
                        <Text className="mb-4 text-gray-600">Create and manage staff invoices.</Text>
                        <PrimaryButton text="Invoice Management" onClick={() => navigate('/admin/invoices')} />
                      </Card>
                    </div>
                  </div>
                )
              },
              {
                key: 'deputyIntegration',
                headerText: 'Deputy',
                content: (
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Deputy Integration Status</h3>
                    <Card>
                      {isLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Connection Status:</span>
                            <span className={deputyStatus?.isConnected ? 'text-green-600' : 'text-red-600'}>
                              {deputyStatus?.isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Last Sync:</span>
                            <span className="text-gray-600">{deputyStatus?.lastSyncDate ? formatDate(deputyStatus.lastSyncDate) : 'Never'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Employees Synced:</span>
                            <span className="text-gray-600">{deputyStatus?.employeeCount || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Timesheets Synced:</span>
                            <span className="text-gray-600">{deputyStatus?.timesheetCount || 0}</span>
                          </div>
                          {deputyStatus?.errorMessage && (
                            <p className="text-red-600 text-sm">Error: {deputyStatus.errorMessage}</p>
                          )}
                          <div className="flex gap-2 pt-2">
                            <PrimaryButton text="Configure Deputy" onClick={() => navigate('/admin/deputy')} />
                            <PrimaryButton text="Sync Now" disabled={!deputyStatus?.isConnected} onClick={() => navigate('/admin/deputy/sync')} />
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                )
              },
              {
                key: 'payroll',
                headerText: 'Payroll',
                content: (
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Weekly Payroll Management</h3>
                    <p className="text-gray-600 mb-4">Generate invoices for all staff members for weekly payment periods (Monday-Sunday).</p>
                    <BulkPayrollGeneration />
                  </div>
                )
              }
            ]}
            defaultSelectedKey="quickActions"
            isMobile={true}
          />
        ) : (
          <div className="bg-white border border-[#F0F0F0] rounded-lg overflow-hidden">
            <Pivot>
              <PivotItem headerText="Quick Actions">
                <div className="p-4">
                  <h3 className="text-base font-medium text-gray-900 mb-3">Common Tasks</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="flex flex-col p-3">
                      <Text variant="medium" className="font-semibold mb-1 text-sm">Staff Management</Text>
                      <Text className="mb-3 text-gray-600 text-xs">Add or edit staff members</Text>
                      <PrimaryButton text="Manage" onClick={() => navigate('/admin/staff')} className="text-sm" />
                    </Card>
                    <Card className="flex flex-col p-3">
                      <Text variant="medium" className="font-semibold mb-1 text-sm">Venue Management</Text>
                      <Text className="mb-3 text-gray-600 text-xs">Manage venues & locations</Text>
                      <PrimaryButton text="Manage" onClick={() => navigate('/admin/venues')} className="text-sm" />
                    </Card>
                    <Card className="flex flex-col p-3">
                      <Text variant="medium" className="font-semibold mb-1 text-sm">Approve Shifts</Text>
                      <Text className="mb-3 text-gray-600 text-xs">Review pending shifts</Text>
                      <PrimaryButton text="Review" onClick={() => navigate('/approvals')} className="text-sm" />
                    </Card>
                    <Card className="flex flex-col p-3">
                      <Text variant="medium" className="font-semibold mb-1 text-sm">Generate Invoices</Text>
                      <Text className="mb-3 text-gray-600 text-xs">Create staff invoices</Text>
                      <PrimaryButton text="Invoices" onClick={() => navigate('/admin/invoices')} className="text-sm" />
                    </Card>
                  </div>
                </div>
              </PivotItem>

              <PivotItem headerText="Deputy Integration">
                <div className="p-4">
                  <h3 className="text-base font-medium text-gray-900 mb-3">Deputy Integration Status</h3>
                  <Card className="p-3">
                    {isLoading ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Status:</span>
                          <span className={deputyStatus?.isConnected ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {deputyStatus?.isConnected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Last Sync:</span>
                          <span className="text-gray-600">{deputyStatus?.lastSyncDate ? formatDate(deputyStatus.lastSyncDate) : 'Never'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Employees:</span>
                          <span className="text-gray-600">{deputyStatus?.employeeCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Timesheets:</span>
                          <span className="text-gray-600">{deputyStatus?.timesheetCount || 0}</span>
                        </div>
                        {deputyStatus?.errorMessage && (
                          <p className="text-red-600 text-xs mt-1">Error: {deputyStatus.errorMessage}</p>
                        )}
                        <div className="flex gap-2 pt-2">
                          <PrimaryButton text="Configure" onClick={() => navigate('/admin/deputy')} className="text-sm" />
                          <PrimaryButton text="Sync Now" disabled={!deputyStatus?.isConnected} onClick={() => navigate('/admin/deputy/sync')} className="text-sm" />
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </PivotItem>

              <PivotItem headerText="System Settings">
                <div className="p-4">
                  <h3 className="text-base font-medium text-gray-900 mb-3">Global Settings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="flex flex-col p-3">
                      <Text variant="medium" className="font-semibold mb-1 text-sm">System Config</Text>
                      <Text className="mb-3 text-gray-600 text-xs">System-wide settings</Text>
                      <PrimaryButton text="Settings" onClick={() => navigate('/admin/settings')} className="text-sm" />
                    </Card>
                    <Card className="flex flex-col p-3">
                      <Text variant="medium" className="font-semibold mb-1 text-sm">Pay Rates</Text>
                      <Text className="mb-3 text-gray-600 text-xs">Configure pay rates</Text>
                      <PrimaryButton text="Manage" onClick={() => navigate('/admin/payrates')} className="text-sm" />
                    </Card>
                  </div>
                </div>
              </PivotItem>

              <PivotItem headerText="Payroll">
                <div className="p-4">
                  <h3 className="text-base font-medium text-gray-900 mb-2">Weekly Payroll</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Generate invoices for weekly payment periods (Mon-Sun).
                  </p>
                  <BulkPayrollGeneration />
                </div>
              </PivotItem>
            </Pivot>
          </div>
        )}
          </div>
        </div>

        {/* Employment Type Setup Prompt - Moved to bottom as it's a one-time setup task */}
        {showEmploymentTypePrompt && (
          <MessageBar
            messageBarType={MessageBarType.warning}
            actions={
              <div className="flex gap-2">
                <PrimaryButton
                  text="Setup Employment Types"
                  onClick={() => navigate('/admin/employment-types')}
                />
                <DefaultButton
                  text="Dismiss"
                  onClick={() => setShowEmploymentTypePrompt(false)}
                />
              </div>
            }
          >
            <strong>Employment Types Required:</strong> Before generating recruitment links, you need to set up employment types for your company.
          </MessageBar>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
