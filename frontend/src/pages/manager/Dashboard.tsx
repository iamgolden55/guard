import type React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  DetailsList,
  DetailsListLayoutMode,
  Selection,
  SelectionMode,
  type IColumn,
  Spinner,
  SpinnerSize,
  SearchBox,
  CommandBar,
  type ICommandBarItemProps
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card } from '../../components';
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

  // Selection object for DetailsList
  const selection = new Selection({
    onSelectionChanged: () => {
      const selectedItems = selection.getSelection() as Shift[];
      setSelectedShifts(selectedItems);
    },
  });

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
    if (!endTime) return 'In Progress';

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

  // Column definitions for pending approvals list
  const approvalColumns: IColumn[] = [
    {
      key: 'staffName',
      name: 'Staff Name',
      fieldName: 'staffUser',
      minWidth: 100,
      isResizable: true,
      onRender: (item: Shift) => `Staff ID: ${item.staffUser}` // Would display name if full staffUser object available
    },
    {
      key: 'venue',
      name: 'Venue',
      fieldName: 'venue',
      minWidth: 100,
      isResizable: true,
      onRender: (item: Shift) => item.venue.name
    },
    {
      key: 'date',
      name: 'Date',
      fieldName: 'startTime',
      minWidth: 90,
      isResizable: true,
      onRender: (item: Shift) => formatDate(item.startTime)
    },
    {
      key: 'startTime',
      name: 'Start Time',
      fieldName: 'startTime',
      minWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => formatTime(item.startTime)
    },
    {
      key: 'endTime',
      name: 'End Time',
      fieldName: 'endTime',
      minWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => item.endTime ? formatTime(item.endTime) : 'N/A'
    },
    {
      key: 'duration',
      name: 'Duration',
      minWidth: 90,
      isResizable: true,
      onRender: (item: Shift) => getShiftDuration(item.startTime, item.endTime)
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 90,
      isResizable: true
    }
  ];

  // Command bar items for pending approvals
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'approve',
      text: 'Approve',
      iconProps: { iconName: 'Accept' },
      disabled: selectedShifts.length === 0,
      onClick: () => {
        const shiftId = selectedShifts[0].id;
        navigate(`/approvals/${shiftId}`);
      }
    },
    {
      key: 'reject',
      text: 'Reject',
      iconProps: { iconName: 'Cancel' },
      disabled: selectedShifts.length === 0,
      onClick: () => {
        const shiftId = selectedShifts[0].id;
        navigate(`/approvals/${shiftId}?reject=true`);
      }
    },
    {
      key: 'viewDetails',
      text: 'View Details',
      iconProps: { iconName: 'RedEye' },
      disabled: selectedShifts.length !== 1,
      onClick: () => {
        const shiftId = selectedShifts[0].id;
        navigate(`/shifts/${shiftId}`);
      }
    }
  ];

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        {/* Welcome section */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">
            Manager Dashboard
          </Text>
        </Stack>

        {/* Pending Approvals section */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">Pending Approvals</Text>

          <Card>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Spinner size={SpinnerSize.large} label="Loading pending approvals..." />
              </div>
            ) : (
              <Stack tokens={{ childrenGap: 12 }}>
                <Stack horizontal horizontalAlign="space-between">
                  <SearchBox
                    placeholder="Search by venue"
                    value={searchText}
                    onChange={(_, newValue) => setSearchText(newValue || '')}
                    styles={{ root: { width: 300 } }}
                  />
                  <Text>
                    {filteredApprovals.length} pending approval{filteredApprovals.length !== 1 ? 's' : ''}
                  </Text>
                </Stack>

                <CommandBar
                  items={commandBarItems}
                  ariaLabel="Approval actions"
                />

                {filteredApprovals.length > 0 ? (
                  <DetailsList
                    items={filteredApprovals}
                    columns={approvalColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selection={selection}
                    selectionMode={SelectionMode.single}
                    selectionPreservedOnEmptyClick
                    isHeaderVisible
                    compact
                    setKey="pendingApprovals"
                    onItemInvoked={(item) => navigate(`/approvals/${item.id}`)}
                  />
                ) : (
                  <Stack horizontalAlign="center" verticalAlign="center" className="p-4">
                    <Text>No pending approvals found.</Text>
                  </Stack>
                )}
              </Stack>
            )}
          </Card>
        </Stack>

        {/* Staff Activity section */}
        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="xLarge">Recent Approvals</Text>

          <Card>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Spinner size={SpinnerSize.large} label="Loading recent activity..." />
              </div>
            ) : (
              <Stack tokens={{ childrenGap: 16 }}>
                {recentShifts.length > 0 ? (
                  <DetailsList
                    items={recentShifts}
                    columns={[
                      ...approvalColumns,
                      {
                        key: 'managerApproved',
                        name: 'Approved',
                        minWidth: 80,
                        isResizable: true,
                        onRender: (item: Shift) => item.managerApproved ? 'Yes' : 'No'
                      }
                    ]}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                    isHeaderVisible
                    compact
                    setKey="recentApprovals"
                  />
                ) : (
                  <Text>No recent approvals found.</Text>
                )}
              </Stack>
            )}
          </Card>
        </Stack>

        {/* Action buttons */}
        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <PrimaryButton
            text="View All Staff Shifts"
            iconProps={{ iconName: 'Calendar' }}
            onClick={() => navigate('/staff-shifts')}
          />
          <PrimaryButton
            text="Manage Approvals"
            iconProps={{ iconName: 'Checkmark' }}
            onClick={() => navigate('/approvals')}
          />
        </Stack>
      </Stack>
    </MainLayout>
  );
};

export default ManagerDashboard;
