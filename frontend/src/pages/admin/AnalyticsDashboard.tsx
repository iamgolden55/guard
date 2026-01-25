import type React from 'react';
import { useState, useEffect } from 'react';
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
import { AdminLayout } from '../../layouts';
import MetricCard from '../../components/MetricCard';
import { BulkPayrollGeneration, Card, SwipeableTabs } from '../../components';
import IncompleteShiftsWidget from '../../components/IncompleteShiftsWidget';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, deputyService, venueService, employmentTypeService, exchangeService } from '../../services';
import api from '../../services/api';
import type { DeputyStatus, User, Shift, Invoice } from '../../types';
import useIsMobile from '../../hooks/useIsMobile';

const AnalyticsDashboard: React.FC = () => {
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

  // CRITICAL: Verify user is actually admin before rendering
  useEffect(() => {
    if (!authState.user || !authState.currentMembership) {
      console.warn('AnalyticsDashboard: User or membership not loaded');
      return;
    }

    const membershipRole = authState.currentMembership.role.toLowerCase();
    const isAdmin = membershipRole === 'admin' || membershipRole === 'owner';

    if (!isAdmin) {
      console.error('Non-admin user accessed admin dashboard!');
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

        let pendingApprovals = 0;
        if (pendingApprovalsResult.status === 'fulfilled') {
          const approvals = pendingApprovalsResult.value;
          pendingApprovals = (approvals.exchange_requests?.length || 0) + (approvals.shift_claims?.length || 0);
        }

        const invoicesData = invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value) ? invoicesResult.value : [];
        const pendingInvoices = invoicesData.filter((invoice: Invoice) => invoice.status === 'pending').length;

        let deputyStatusData: DeputyStatus | null = null;
        if (deputyStatusDataResult.status === 'fulfilled') {
          deputyStatusData = deputyStatusDataResult.value;
        } else {
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
        }

        let venueCount = 0;
        if (venuesResult.status === 'fulfilled') {
          if (Array.isArray(venuesResult.value)) {
            venueCount = venuesResult.value.length;
          }
        }

        let employmentTypesData: any[] = [];
        if (employmentTypesResult.status === 'fulfilled') {
          employmentTypesData = Array.isArray(employmentTypesResult.value) ? employmentTypesResult.value : [];
        }
        setEmploymentTypes(employmentTypesData);
        setShowEmploymentTypePrompt(employmentTypesData.length === 0);

        let onTimePercentage = 0;
        if (attendanceResult.status === 'fulfilled') {
          onTimePercentage = attendanceResult.value?.summary?.onTimePercentage || 0;
        }

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

  return (
    <AdminLayout>
      <div className="space-y-6 pb-20 lg:pb-0">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Welcome back. Here's what's happening today.</p>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            iconColor="#107C10"
            isLoading={isLoading}
            onClick={() => navigate('/approvals')}
          />
          <MetricCard
            title="Total Staff"
            value={stats.totalStaff}
            icon="People"
            iconColor="#5C2D91"
            isLoading={isLoading}
            onClick={() => navigate('/admin/staff')}
          />
          <MetricCard
            title="On-time Rate"
            value={`${stats.onTimePercentage.toFixed(0)}%`}
            icon="Timer"
            iconColor="#10B981"
            isLoading={isLoading}
            onClick={() => navigate('/admin/attendance')}
            trend={stats.onTimePercentage >= 90 ? 'Good' : stats.onTimePercentage >= 75 ? 'Fair' : 'Needs attention'}
            trendDirection={stats.onTimePercentage >= 90 ? 'up' : stats.onTimePercentage >= 75 ? 'neutral' : 'down'}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            title="Pending Invoices"
            value={stats.pendingInvoices}
            icon="PaymentCard"
            iconColor="#D83B01"
            isLoading={isLoading}
            onClick={() => navigate('/admin/invoices')}
          />
          <MetricCard
            title="Total Venues"
            value={stats.venueCount}
            icon="POI"
            iconColor="#008272"
            isLoading={isLoading}
            onClick={() => navigate('/admin/venues')}
          />
        </div>

        {/* Employment Type Setup Prompt */}
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

        {/* Incomplete Shifts Widget */}
        <IncompleteShiftsWidget />

        {/* Tabbed Content */}
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
                          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Common Tasks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              </PivotItem>

              <PivotItem headerText="Deputy Integration">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Deputy Integration Status</h3>
                  <Card className="max-w-lg">
                    {isLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Connection Status:</span>
                          <span className={deputyStatus?.isConnected ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
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
                          <p className="text-red-600 text-sm mt-2">Error: {deputyStatus.errorMessage}</p>
                        )}
                        <div className="flex gap-3 pt-3">
                          <PrimaryButton text="Configure Deputy" onClick={() => navigate('/admin/deputy')} />
                          <PrimaryButton text="Sync Now" disabled={!deputyStatus?.isConnected} onClick={() => navigate('/admin/deputy/sync')} />
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              </PivotItem>

              <PivotItem headerText="System Settings">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Global Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">System Configuration</Text>
                      <Text className="mb-4 text-gray-600">Manage system-wide settings and defaults.</Text>
                      <PrimaryButton text="System Settings" onClick={() => navigate('/admin/settings')} />
                    </Card>
                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">Pay Rates</Text>
                      <Text className="mb-4 text-gray-600">Configure default and venue-specific pay rates.</Text>
                      <PrimaryButton text="Manage Pay Rates" onClick={() => navigate('/admin/payrates')} />
                    </Card>
                  </div>
                </div>
              </PivotItem>

              <PivotItem headerText="Payroll">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Weekly Payroll Management</h3>
                  <p className="text-gray-600 mb-6">
                    Generate invoices for all staff members for weekly payment periods (Monday-Sunday).
                    Staff will receive their payments on Mondays.
                  </p>
                  <BulkPayrollGeneration />
                </div>
              </PivotItem>
            </Pivot>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AnalyticsDashboard;
