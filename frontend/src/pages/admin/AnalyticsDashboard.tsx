import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Header, Container, SpaceBetween, Alert } from '../../components/cloudscape';
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
  const [activeTab, setActiveTab] = useState('quickActions');

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

  const desktopTabs = [
    { id: 'quickActions', label: 'Quick Actions' },
    { id: 'deputyIntegration', label: 'Deputy Integration' },
    { id: 'systemSettings', label: 'System Settings' },
    { id: 'payroll', label: 'Payroll' },
  ];

  return (
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
        <Alert type="warning">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span><strong>Employment Types Required:</strong> Before generating recruitment links, you need to set up employment types for your company.</span>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/admin/employment-types')}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Setup Employment Types
              </button>
              <button
                onClick={() => setShowEmploymentTypePrompt(false)}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Alert>
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
                      <p className="text-sm font-semibold mb-2">Staff Management</p>
                      <p className="mb-4 text-gray-600 text-sm">Add, edit, or deactivate staff members.</p>
                      <button onClick={() => navigate('/admin/staff')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Manage Staff</button>
                    </Card>
                    <Card className="flex flex-col">
                      <p className="text-sm font-semibold mb-2">Venue Management</p>
                      <p className="mb-4 text-gray-600 text-sm">Manage venues and locations.</p>
                      <button onClick={() => navigate('/admin/venues')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Manage Venues</button>
                    </Card>
                    <Card className="flex flex-col">
                      <p className="text-sm font-semibold mb-2">Approve Shifts</p>
                      <p className="mb-4 text-gray-600 text-sm">Review and approve pending shifts.</p>
                      <button onClick={() => navigate('/approvals')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Shift Approvals</button>
                    </Card>
                    <Card className="flex flex-col">
                      <p className="text-sm font-semibold mb-2">Generate Invoices</p>
                      <p className="mb-4 text-gray-600 text-sm">Create and manage staff invoices.</p>
                      <button onClick={() => navigate('/admin/invoices')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Invoice Management</button>
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
                          <button onClick={() => navigate('/admin/deputy')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Configure Deputy</button>
                          <button onClick={() => navigate('/admin/deputy/sync')} disabled={!deputyStatus?.isConnected} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Sync Now</button>
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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-0 -mb-px">
              {desktopTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id
                    ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600'
                    : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === 'quickActions' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Common Tasks</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="flex flex-col">
                  <p className="text-sm font-semibold mb-2">Staff Management</p>
                  <p className="mb-4 text-gray-600 text-sm">Add, edit, or deactivate staff members.</p>
                  <button onClick={() => navigate('/admin/staff')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Manage Staff</button>
                </Card>
                <Card className="flex flex-col">
                  <p className="text-sm font-semibold mb-2">Venue Management</p>
                  <p className="mb-4 text-gray-600 text-sm">Manage venues and locations.</p>
                  <button onClick={() => navigate('/admin/venues')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Manage Venues</button>
                </Card>
                <Card className="flex flex-col">
                  <p className="text-sm font-semibold mb-2">Approve Shifts</p>
                  <p className="mb-4 text-gray-600 text-sm">Review and approve pending shifts.</p>
                  <button onClick={() => navigate('/approvals')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Shift Approvals</button>
                </Card>
                <Card className="flex flex-col">
                  <p className="text-sm font-semibold mb-2">Generate Invoices</p>
                  <p className="mb-4 text-gray-600 text-sm">Create and manage staff invoices.</p>
                  <button onClick={() => navigate('/admin/invoices')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Invoice Management</button>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'deputyIntegration' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Deputy Integration Status</h3>
              <Card className="max-w-lg">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
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
                      <button onClick={() => navigate('/admin/deputy')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Configure Deputy</button>
                      <button onClick={() => navigate('/admin/deputy/sync')} disabled={!deputyStatus?.isConnected} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Sync Now</button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'systemSettings' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Global Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="flex flex-col">
                  <p className="text-sm font-semibold mb-2">System Configuration</p>
                  <p className="mb-4 text-gray-600 text-sm">Manage system-wide settings and defaults.</p>
                  <button onClick={() => navigate('/admin/settings')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">System Settings</button>
                </Card>
                <Card className="flex flex-col">
                  <p className="text-sm font-semibold mb-2">Pay Rates</p>
                  <p className="mb-4 text-gray-600 text-sm">Configure default and venue-specific pay rates.</p>
                  <button onClick={() => navigate('/admin/payrates')} className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors self-start">Manage Pay Rates</button>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Weekly Payroll Management</h3>
              <p className="text-gray-600 mb-6">
                Generate invoices for all staff members for weekly payment periods (Monday-Sunday).
                Staff will receive their payments on Mondays.
              </p>
              <BulkPayrollGeneration />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
