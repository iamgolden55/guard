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
  PivotItem,
  MessageBar,
  MessageBarType,
  DefaultButton
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card, BulkPayrollGeneration, SwipeableTabs } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, invoiceService, deputyService, venueService, employmentTypeService } from '../../services';
import api from '../../services/api';
import type { DeputyStatus, User, Venue, Shift, Invoice } from '../../types';
import useIsMobile from '../../hooks/useIsMobile';

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

// Helper function to format dates
const formatDate = (dateString: string | null) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString();
};

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
    venueCount: 0
  });
  const [deputyStatus, setDeputyStatus] = useState<DeputyStatus | null>(null);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [showEmploymentTypePrompt, setShowEmploymentTypePrompt] = useState(false);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch all data in parallel for better performance
        const [
          shiftsResult,
          invoicesResult,
          deputyStatusDataResult,
          usersResult, // Fetch the full user list
          venuesResult, // Fetch the full venue list
          employmentTypesResult // Fetch employment types
        ] = await Promise.allSettled([
          shiftService.getShifts(),
          invoiceService.getInvoices(),
          deputyService.getDeputyStatus(),
          api.get<User[]>('/users/'), // Use api.get to fetch users
          venueService.getAllVenues(), // Use venueService to fetch venues
          employmentTypeService.getEmploymentTypes() // Check employment types
        ]);

        // Process shifts - Assuming shiftService returns Shift[] directly
        const shiftsData = shiftsResult.status === 'fulfilled' && Array.isArray(shiftsResult.value) ? shiftsResult.value : [];
        const activeShifts = shiftsData.filter((shift: Shift) => 
          shift.status === 'active' || shift.status === 'in_progress'
        ).length;
        const pendingApprovals = shiftsData.filter(
          (shift: Shift) => shift.status === 'completed' && !shift.managerApproved
        ).length;
        if (shiftsResult.status === 'rejected') {
            console.error("Failed to load shifts:", shiftsResult.reason);
        }

        // Process invoices - Assuming invoiceService returns Invoice[] directly
        const invoicesData = invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value) ? invoicesResult.value : [];
        const pendingInvoices = invoicesData.filter((invoice: Invoice) => invoice.status === 'pending').length;
        if (invoicesResult.status === 'rejected') {
            console.error("Failed to load invoices:", invoicesResult.reason);
        }

        // Process Deputy Status
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

        // Process user list to get staff count
        let totalStaff = 0;
        if (usersResult.status === 'fulfilled') {
             // Assuming the API response has a 'data' property containing the array
            totalStaff = Array.isArray(usersResult.value?.data) ? usersResult.value.data.length : 0;
        } else {
             console.error('Failed to load user data:', usersResult.reason);
             // Keep totalStaff as 0 or set to specific error indicator if needed
        }

        // Process venue list to get venue count - Assuming venueService returns Venue[] directly
        let venueCount = 0;
        if (venuesResult.status === 'fulfilled') {
          if (Array.isArray(venuesResult.value)) {
               venueCount = venuesResult.value.length;
           } else {
               // Log a warning if the structure is unexpected
               console.warn('Unexpected response structure for venues:', venuesResult.value);
           }
        } else {
             console.error('Failed to load venue data:', venuesResult.reason);
             // Keep venueCount as 0 or set to specific error indicator if needed
        }

        // Process employment types to check if setup is needed
        let employmentTypesData: any[] = [];
        if (employmentTypesResult.status === 'fulfilled') {
          employmentTypesData = Array.isArray(employmentTypesResult.value) ? employmentTypesResult.value : [];
        } else {
          console.error('Failed to load employment types:', employmentTypesResult.reason);
        }
        setEmploymentTypes(employmentTypesData);
        setShowEmploymentTypePrompt(employmentTypesData.length === 0);

        // Set stats
        setStats({
          activeShifts,
          pendingApprovals,
          totalStaff,
          pendingInvoices,
          venueCount // Use fetched value
        });

      } catch (error) {
        // This catch block might not be necessary if using Promise.allSettled and handling errors individually
        console.error('An unexpected error occurred while loading dashboard data:', error);
        // Optionally set stats to error values or show an error message
         setStats({
          activeShifts: 0,
          pendingApprovals: 0,
          totalStaff: 0, // Indicate error or N/A
          pendingInvoices: 0,
          venueCount: 0 // Indicate error or N/A
        });
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

        {/* Employment Type Setup Prompt */}
        {showEmploymentTypePrompt && (
          <MessageBar
            messageBarType={MessageBarType.warning}
            actions={
              <div>
                <PrimaryButton
                  text="Setup Employment Types"
                  onClick={() => navigate('/admin/employment-types')}
                  style={{ marginRight: 8 }}
                />
                <DefaultButton
                  text="Dismiss"
                  onClick={() => setShowEmploymentTypePrompt(false)}
                />
              </div>
            }
          >
            <strong>Employment Types Required:</strong> Before generating recruitment links, you need to set up employment types for your company.
            This will define the job categories candidates can apply for.
          </MessageBar>
        )}

        {/* Main dashboard content */}
        <Stack tokens={{ childrenGap: 16 }}>
          {isMobile ? (
            <SwipeableTabs
              tabs={[
                {
                  key: 'quickActions',
                  headerText: 'Quick Actions',
                  content: (
                    <div className="p-4">
                      <Stack tokens={{ childrenGap: 16 }}>
                        <Text variant="large">Common Tasks</Text>

                        <div className="grid grid-cols-1 gap-4">
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
                  )
                },
                {
                  key: 'deputyIntegration',
                  headerText: 'Deputy Integration',
                  content: (
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

                              <Stack tokens={{ childrenGap: 10 }}>
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
                  )
                },
                {
                  key: 'systemSettings',
                  headerText: 'System Settings',
                  content: (
                    <div className="p-4">
                      <Stack tokens={{ childrenGap: 16 }}>
                        <Text variant="large">Global Settings</Text>

                        <div className="grid grid-cols-1 gap-4">
                          <Card className="flex flex-col">
                            <Text variant="medium" className="font-semibold mb-2">System Configuration</Text>
                            <Text className="mb-4">Manage global system settings.</Text>
                            <PrimaryButton
                              text="System Settings"
                              onClick={() => navigate('/admin/settings')}
                            />
                          </Card>

                          <Card className="flex flex-col">
                            <Text variant="medium" className="font-semibold mb-2">Pay Rates</Text>
                            <Text className="mb-4">Configure staff pay rates and bonuses.</Text>
                            <PrimaryButton
                              text="Manage Pay Rates"
                              onClick={() => navigate('/admin/payrates')}
                            />
                          </Card>
                        </div>
                      </Stack>
                    </div>
                  )
                }
              ]}
              defaultSelectedKey="quickActions"
              isMobile={true}
            />
          ) : (
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

            <PivotItem headerText="Payroll" key="payroll">
              <div className="mt-6">
                <Stack tokens={{ childrenGap: 20 }}>
                  <Text variant="large" className="font-semibold">
                    Weekly Payroll Management
                  </Text>
                  <Text className="text-gray-600">
                    Generate invoices for all staff members for weekly payment periods (Monday-Sunday). 
                    Staff will receive their payments on Mondays.
                  </Text>
                  
                  <BulkPayrollGeneration />
                </Stack>
              </div>
            </PivotItem>
          </Pivot>
          )}
        </Stack>
      </Stack>
    </MainLayout>
  );
};

export default AdminDashboard;
