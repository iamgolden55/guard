import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  CommandBar,
  type ICommandBarItemProps,
  SearchBox,
  Dropdown,
  type IDropdownOption,
  Stack,
  Text,
  StackItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  DefaultButton
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { ShiftStatus } from '../../types';
import { shiftService } from '../../services';
import { fetchPendingEarnings, type PendingEarnings } from '../../services/api';

interface MyShift {
  id: number;
  venue: {
    id: number;
    name: string;
  };
  startTime: string;
  endTime: string | null;
  status: ShiftStatus;
  managerApproved: boolean;
  autoCheckout?: boolean;
  calculated_payment?: number;
  is_invoiced?: boolean;
}

// Status indicator pill component
const StatusPill: React.FC<{status: ShiftStatus, autoCheckout?: boolean}> = ({ status, autoCheckout }) => {
  let backgroundColor = '';
  let color = 'white';

  switch(status) {
    case ShiftStatus.ACTIVE:
      backgroundColor = '#10B981'; // Green
      break;
    case ShiftStatus.COMPLETED:
      backgroundColor = '#F59E0B'; // Yellow
      color = 'black';
      break;
    case ShiftStatus.APPROVED:
      backgroundColor = '#3B82F6'; // Blue
      break;
    case ShiftStatus.REJECTED:
      backgroundColor = '#EF4444'; // Red
      break;
    default:
      backgroundColor = '#9CA3AF'; // Gray
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div
        style={{
          backgroundColor,
          color,
          padding: '4px 8px',
          borderRadius: '12px',
          display: 'inline-block',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}
      >
        {status}
      </div>
      {autoCheckout && (
        <div
          style={{
            backgroundColor: '#10B981',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '8px',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
          title="This shift was automatically checked out"
        >
          🤖 Auto
        </div>
      )}
    </div>
  );
};

const MyShifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<MyShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pendingEarnings, setPendingEarnings] = useState<PendingEarnings | null>(null);

  // Set up columns for the DetailsList
  const columns: IColumn[] = [
    {
      key: 'id',
      name: 'Shift ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 70,
      isResizable: true,
    },
    {
      key: 'venue',
      name: 'Venue',
      fieldName: 'venue',
      minWidth: 100,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: MyShift) => <Text>{item.venue.name}</Text>,
    },
    {
      key: 'startTime',
      name: 'Start Time',
      fieldName: 'startTime',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: MyShift) => <Text>{new Date(item.startTime).toLocaleString()}</Text>,
    },
    {
      key: 'endTime',
      name: 'End Time',
      fieldName: 'endTime',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: MyShift) => <Text>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: MyShift) => <StatusPill status={item.status} autoCheckout={item.autoCheckout} />,
    },
    {
      key: 'approved',
      name: 'Approval',
      fieldName: 'managerApproved',
      minWidth: 70,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: MyShift) => (
        <Text>
          {item.managerApproved ?
            <span style={{ color: '#10B981' }}>✓ Approved</span> :
            <span style={{ color: '#9CA3AF' }}>Pending</span>
          }
        </Text>
      ),
    },
    {
      key: 'earnings',
      name: 'Earnings',
      fieldName: 'calculated_payment',
      minWidth: 80,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: MyShift) => (
        <Stack>
          {item.calculated_payment ? (
            <Text>£{item.calculated_payment.toFixed(2)}</Text>
          ) : (
            <Text style={{ color: '#9CA3AF' }}>--</Text>
          )}
          {item.status === 'approved' && !item.is_invoiced && item.calculated_payment && (
            <Text variant="small" style={{ color: '#F59E0B' }}>Pending</Text>
          )}
          {item.is_invoiced && (
            <Text variant="small" style={{ color: '#10B981' }}>Invoiced</Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 120,
      maxWidth: 150,
      isResizable: false,
      onRender: (item: MyShift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {item.status === 'scheduled' && (
            <PrimaryButton
              text="Check In"
              onClick={() => handleCheckIn(item)}
              iconProps={{ iconName: 'CheckMark' }}
              styles={{ root: { minWidth: 'auto', padding: '4px 8px' } }}
            />
          )}
          {item.status === 'in_progress' && (
            <PrimaryButton
              text="Check Out"
              onClick={() => handleCheckOut(item)}
              iconProps={{ iconName: 'SignOut' }}
              styles={{ root: { minWidth: 'auto', padding: '4px 8px' } }}
            />
          )}
          {item.status === 'active' && (
            <DefaultButton
              text="End Shift"
              onClick={() => handleEndShift(item)}
              iconProps={{ iconName: 'Stop' }}
              styles={{ root: { minWidth: 'auto', padding: '4px 8px' } }}
            />
          )}
        </Stack>
      ),
    }
  ];

  // Status filter options
  const statusOptions: IDropdownOption[] = [
    { key: '', text: 'All Statuses' },
    { key: ShiftStatus.ACTIVE, text: 'Active' },
    { key: ShiftStatus.COMPLETED, text: 'Completed' },
    { key: ShiftStatus.APPROVED, text: 'Approved' },
    { key: ShiftStatus.REJECTED, text: 'Rejected' },
  ];

  // Load shifts from API - using useCallback to avoid dependency issues in useEffect
  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [shiftsResponse, earningsResponse] = await Promise.all([
        shiftService.getMyShifts(),
        fetchPendingEarnings().catch(err => {
          console.warn('Failed to load pending earnings:', err);
          return null;
        })
      ]);
      
      setShifts(shiftsResponse);
      setFilteredShifts(shiftsResponse);
      setPendingEarnings(earningsResponse);
    } catch (error) {
      console.error('Failed to load shifts:', error);
      setError('Failed to load shifts. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions for CommandBar
  const handleNewShift = useCallback(() => {
    navigate('/shifts/new');
    return false; // Return false to prevent default behavior
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadShifts();
    return false; // Return false to prevent default behavior
  }, [loadShifts]);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'newShift',
      text: 'Start New Shift',
      iconProps: { iconName: 'Add' },
      onClick: handleNewShift,
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefresh,
    },
  ];

  // Apply filters when search text or status filter changes
  useEffect(() => {
    let result = shifts;

    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      result = result.filter(shift =>
        shift.venue.name.toLowerCase().includes(lowerCaseSearch) ||
        shift.id.toString().includes(lowerCaseSearch)
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(shift => shift.status === statusFilter);
    }

    setFilteredShifts(result);
  }, [searchText, statusFilter, shifts]);

  // Load shifts when component mounts
  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const onRenderItemColumn = (item: MyShift, _?: number, column?: IColumn) => {
    if (!column) return null;

    switch (column.key) {
      case 'venue':
        return <Text>{item.venue.name}</Text>;
      case 'startTime':
        return <Text>{new Date(item.startTime).toLocaleString()}</Text>;
      case 'endTime':
        return <Text>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>;
      case 'status':
        return <StatusPill status={item.status} autoCheckout={item.autoCheckout} />;
      default:
        return <Text>{String(item[column.fieldName as keyof MyShift])}</Text>;
    }
  };

  const handleShiftClick = (item?: MyShift) => {
    if (item) {
      navigate(`/shifts/${item.id}`);
    }
  };

  const handleCheckIn = useCallback((shift: MyShift) => {
    // Navigate to a check-in page with the shift ID
    navigate(`/shifts/${shift.id}/checkin`);
  }, [navigate]);

  const handleCheckOut = useCallback((shift: MyShift) => {
    // Navigate to a check-out page with the shift ID
    navigate(`/shifts/${shift.id}/checkout`);
  }, [navigate]);

  const handleEndShift = useCallback((shift: MyShift) => {
    // Navigate to end shift page
    navigate(`/shifts/${shift.id}/end`);
  }, [navigate]);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">My Shifts</Text>
        </Stack>

        <CommandBar items={commandBarItems} />

        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <StackItem grow={3}>
            <SearchBox
              placeholder="Search by venue or shift ID"
              onChange={(_, newValue) => setSearchText(newValue || '')}
              onClear={() => setSearchText('')}
            />
          </StackItem>
          <StackItem grow={1}>
            <Dropdown
              placeholder="Filter by status"
              options={statusOptions}
              selectedKey={statusFilter}
              onChange={(_, option) => setStatusFilter(option?.key as string)}
            />
          </StackItem>
        </Stack>

        {/* Pending Earnings Display */}
        {pendingEarnings && pendingEarnings.total_pending > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
              <Stack>
                <Text variant="large" className="text-blue-800 font-semibold">
                  Pending Earnings: £{pendingEarnings.total_pending.toFixed(2)}
                </Text>
                <Text variant="small" className="text-blue-600">
                  {pendingEarnings.shift_count} approved shift{pendingEarnings.shift_count !== 1 ? 's' : ''} awaiting invoice
                </Text>
              </Stack>
              <DefaultButton
                text="View Details"
                iconProps={{ iconName: 'Money' }}
                onClick={() => navigate('/invoices')}
              />
            </Stack>
          </div>
        )}

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size={SpinnerSize.large} label="Loading shifts..." />
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Text variant="large">No shifts found</Text>
            <Text>Start a new shift or adjust your search criteria.</Text>
          </div>
        ) : (
          <DetailsList
            items={filteredShifts}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
            onRenderItemColumn={onRenderItemColumn}
            onItemInvoked={handleShiftClick}
          />
        )}
      </Stack>
    </MainLayout>
  );
};

export default MyShifts;
