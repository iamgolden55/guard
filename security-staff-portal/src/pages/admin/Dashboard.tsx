import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Pivot,
  PivotItem
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, deputyService } from '../../services';
import type { DeputyStatus } from '../../types';

// Placeholder component for statistics card
interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, isLoading = false }) => {
  return (
    <Card className="flex-1 min-w-[200px]">
      <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="center">
        <div
          className="rounded-full p-2 flex items-center justify-center"
          style={{ backgroundColor: color, width: 48, height: 48 }}
        >
          <i className={`ms-Icon ms-Icon--${icon} text-white`} style={{ fontSize: 24 }} />
        </div>
        <Stack>
          <Text variant="medium" className="text-gray-500">{title}</Text>
          {isLoading ? (
            <Spinner size={SpinnerSize.small} />
          ) : (
            <Text variant="xLarge" className="font-semibold">{value}</Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
};

const AdminDashboard: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeShifts: 0,
    pendingApprovals: 0,
    totalStaff: 0,
    pendingInvoices: 0,
    venueCount: 0
  });
  const [deputyStatus, setDeputyStatus] = useState<DeputyStatus | null>(null);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        // Get shifts for stats
        const shifts = await shiftService.getShifts();
        const activeShifts = shifts.filter(shift => shift.status === 'active').length;
        const pendingApprovals = shifts.filter(
          shift => shift.status === 'completed' && !shift.managerApproved
        ).length;

        // Get invoices stats
        const invoices = await invoiceService.getInvoices();
        const pendingInvoices = invoices.filter(invoice => invoice.status === 'pending').length;

        // Get Deputy status
        let deputyStatusData: DeputyStatus | null = null;
        try {
          deputyStatusData = await deputyService.getDeputyStatus();
        } catch (error) {
          console.error('Failed to load Deputy status:', error);
          deputyStatusData = {
            isConnected: false,
            lastSyncDate: null,
            employeeCount: 0,
            timesheetCount: 0,
            errorMessage: 'Failed to connect to Deputy'
          };
        }

        // Set stats (venue count and total staff would come from additional API calls)
        setStats({
          activeShifts,
          pendingApprovals,
          totalStaff: 25, // Placeholder value
          pendingInvoices,
          venueCount: 10 // Placeholder value
        });

        setDeputyStatus(deputyStatusData);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Format date for display
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
    <MainLayout>
      <Stack tokens={{ childrenGap: 24 }}>
        {/* Welcome section */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">
            Admin Dashboard
          </Text>
        </Stack>

        {/* Stats overview section */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">System Overview</Text>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              title="Active Shifts"
              value={stats.activeShifts}
              icon="Clock"
              color="#0078d4"
              isLoading={isLoading}
            />
            <StatCard
              title="Pending Approvals"
              value={stats.pendingApprovals}
              icon="Permissions"
              color="#107c10"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Staff"
              value={stats.totalStaff}
              icon="People"
              color="#5c2d91"
              isLoading={isLoading}
            />
            <StatCard
              title="Pending Invoices"
              value={stats.pendingInvoices}
              icon="PaymentCard"
              color="#d83b01"
              isLoading={isLoading}
            />
            <StatCard
              title="Total Venues"
              value={stats.venueCount}
              icon="POI"
              color="#008272"
              isLoading={isLoading}
            />
          </div>
        </Stack>

        {/* Main dashboard content */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Pivot>
            <PivotItem headerText="Quick Actions">
              <div className="p-4">
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text variant="large">Common Tasks</Text>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">Staff Management</Text>
                      <Text className="mb-4">Add, edit, or deactivate staff members.</Text>
                      <PrimaryButton
                        text="Manage Staff"
                        onClick={() => navigate('/admin/staff')}
                      />
                    </Card>

                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">Venue Management</Text>
                      <Text className="mb-4">Manage venues and locations.</Text>
                      <PrimaryButton
                        text="Manage Venues"
                        onClick={() => navigate('/admin/venues')}
                      />
                    </Card>

                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">Approve Shifts</Text>
                      <Text className="mb-4">Review and approve pending shifts.</Text>
                      <PrimaryButton
                        text="Shift Approvals"
                        onClick={() => navigate('/approvals')}
                      />
                    </Card>

                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">Generate Invoices</Text>
                      <Text className="mb-4">Create and manage staff invoices.</Text>
                      <PrimaryButton
                        text="Invoice Management"
                        onClick={() => navigate('/admin/invoices')}
                      />
                    </Card>
                  </div>
                </Stack>
              </div>
            </PivotItem>

            <PivotItem headerText="Deputy Integration">
              <div className="p-4">
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text variant="large">Deputy Integration Status</Text>

                  <Card>
                    {isLoading ? (
                      <div className="flex justify-center p-4">
                        <Spinner size={SpinnerSize.large} label="Loading Deputy status..." />
                      </div>
                    ) : (
                      <Stack tokens={{ childrenGap: 12 }}>
                        <Stack horizontal horizontalAlign="space-between">
                          <Text variant="medium" className="font-semibold">Connection Status:</Text>
                          <Text className={deputyStatus?.isConnected ? 'text-green-600' : 'text-red-600'}>
                            {deputyStatus?.isConnected ? 'Connected' : 'Disconnected'}
                          </Text>
                        </Stack>

                        <Stack horizontal horizontalAlign="space-between">
                          <Text variant="medium" className="font-semibold">Last Sync:</Text>
                          <Text>{deputyStatus?.lastSyncDate ? formatDate(deputyStatus.lastSyncDate) : 'Never'}</Text>
                        </Stack>

                        <Stack horizontal horizontalAlign="space-between">
                          <Text variant="medium" className="font-semibold">Employees Synced:</Text>
                          <Text>{deputyStatus?.employeeCount || 0}</Text>
                        </Stack>

                        <Stack horizontal horizontalAlign="space-between">
                          <Text variant="medium" className="font-semibold">Timesheets Synced:</Text>
                          <Text>{deputyStatus?.timesheetCount || 0}</Text>
                        </Stack>

                        {deputyStatus?.errorMessage && (
                          <Text className="text-red-600">Error: {deputyStatus.errorMessage}</Text>
                        )}

                        <Stack horizontal tokens={{ childrenGap: 10 }}>
                          <PrimaryButton
                            text="Configure Deputy"
                            onClick={() => navigate('/admin/deputy')}
                          />
                          <PrimaryButton
                            text="Sync Now"
                            disabled={!deputyStatus?.isConnected}
                            onClick={() => navigate('/admin/deputy/sync')}
                          />
                        </Stack>
                      </Stack>
                    )}
                  </Card>
                </Stack>
              </div>
            </PivotItem>

            <PivotItem headerText="System Settings">
              <div className="p-4">
                <Stack tokens={{ childrenGap: 16 }}>
                  <Text variant="large">Global Settings</Text>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">System Configuration</Text>
                      <Text className="mb-4">Manage system-wide settings and defaults.</Text>
                      <PrimaryButton
                        text="System Settings"
                        onClick={() => navigate('/admin/settings')}
                      />
                    </Card>

                    <Card className="flex flex-col">
                      <Text variant="medium" className="font-semibold mb-2">Pay Rates</Text>
                      <Text className="mb-4">Configure default and venue-specific pay rates.</Text>
                      <PrimaryButton
                        text="Manage Pay Rates"
                        onClick={() => navigate('/admin/payrates')}
                      />
                    </Card>
                  </div>
                </Stack>
              </div>
            </PivotItem>
          </Pivot>
        </Stack>
      </Stack>
    </MainLayout>
  );
};

export default AdminDashboard;
