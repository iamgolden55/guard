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
  MessageBarType
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { ShiftStatus } from '../../types';
import { shiftService } from '../../services';

interface Shift {
  id: number;
  venue: {
    id: number;
    name: string;
  };
  startTime: string;
  endTime: string | null;
  status: ShiftStatus;
  managerApproved: boolean;
}

// Status indicator pill component
const StatusPill: React.FC<{status: ShiftStatus}> = ({ status }) => {
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
  );
};

const MyShifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

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
      onRender: (item: Shift) => <Text>{item.venue.name}</Text>,
    },
    {
      key: 'startTime',
      name: 'Start Time',
      fieldName: 'startTime',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{new Date(item.startTime).toLocaleString()}</Text>,
    },
    {
      key: 'endTime',
      name: 'End Time',
      fieldName: 'endTime',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <StatusPill status={item.status} />,
    },
    {
      key: 'approved',
      name: 'Approval',
      fieldName: 'managerApproved',
      minWidth: 70,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: Shift) => (
        <Text>
          {item.managerApproved ?
            <span style={{ color: '#10B981' }}>✓ Approved</span> :
            <span style={{ color: '#9CA3AF' }}>Pending</span>
          }
        </Text>
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
      // In a real application, this would use the actual API
      // const response = await shiftService.getShifts();
      // setShifts(response);

      // For demo purposes, we'll use mock data
      const mockShifts: Shift[] = [
        {
          id: 1,
          venue: { id: 1, name: 'Venue A' },
          startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          endTime: null,
          status: ShiftStatus.ACTIVE,
          managerApproved: false
        },
        {
          id: 2,
          venue: { id: 2, name: 'Venue B' },
          startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          endTime: new Date(Date.now() - 50400000).toISOString(), // 14 hours ago
          status: ShiftStatus.COMPLETED,
          managerApproved: false
        },
        {
          id: 3,
          venue: { id: 3, name: 'Venue C' },
          startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          endTime: new Date(Date.now() - 136800000).toISOString(), // 38 hours ago
          status: ShiftStatus.APPROVED,
          managerApproved: true
        },
        {
          id: 4,
          venue: { id: 1, name: 'Venue A' },
          startTime: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          endTime: new Date(Date.now() - 223200000).toISOString(), // 62 hours ago
          status: ShiftStatus.REJECTED,
          managerApproved: false
        },
      ];

      setShifts(mockShifts);
      setFilteredShifts(mockShifts);
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

  const onRenderItemColumn = (item: Shift, index?: number, column?: IColumn) => {
    if (!column) return null;

    switch (column.key) {
      case 'venue':
        return <Text>{item.venue.name}</Text>;
      case 'startTime':
        return <Text>{new Date(item.startTime).toLocaleString()}</Text>;
      case 'endTime':
        return <Text>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>;
      case 'status':
        return <StatusPill status={item.status} />;
      default:
        return <Text>{String(item[column.fieldName as keyof Shift])}</Text>;
    }
  };

  const handleShiftClick = (item?: Shift) => {
    if (item) {
      navigate(`/shifts/${item.id}`);
    }
  };

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
