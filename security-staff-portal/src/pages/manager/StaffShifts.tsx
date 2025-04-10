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
  Link,
  DatePicker,
  DefaultButton,
  TextField,
  PrimaryButton,
  Dialog,
  DialogType,
  DialogFooter,
  Label
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { ShiftStatus } from '../../types';
import { shiftService } from '../../services';

interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface Shift {
  id: number;
  staff: Staff;
  venue: {
    id: number;
    name: string;
  };
  startTime: string;
  endTime: string | null;
  duration: number | null; // in hours
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

const StaffShifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [venueFilter, setVenueFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [venueOptions, setVenueOptions] = useState<IDropdownOption[]>([{ key: '', text: 'All Venues' }]);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);

  // Set up columns for the DetailsList
  const columns: IColumn[] = [
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 50,
      isResizable: true,
    },
    {
      key: 'staff',
      name: 'Staff Member',
      fieldName: 'staff',
      minWidth: 150,
      maxWidth: 180,
      isResizable: true,
      onRender: (item: Shift) => <Text>{`${item.staff.firstName} ${item.staff.lastName}`}</Text>,
    },
    {
      key: 'venue',
      name: 'Venue',
      fieldName: 'venue',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.venue.name}</Text>,
    },
    {
      key: 'startTime',
      name: 'Start Time',
      fieldName: 'startTime',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{new Date(item.startTime).toLocaleString()}</Text>,
    },
    {
      key: 'endTime',
      name: 'End Time',
      fieldName: 'endTime',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.endTime ? new Date(item.endTime).toLocaleString() : '-'}</Text>,
    },
    {
      key: 'duration',
      name: 'Duration',
      fieldName: 'duration',
      minWidth: 70,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.duration ? `${item.duration.toFixed(2)} hrs` : '-'}</Text>,
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: Shift) => <StatusPill status={item.status} />,
    },
    {
      key: 'approved',
      name: 'Approval',
      fieldName: 'managerApproved',
      minWidth: 70,
      maxWidth: 90,
      isResizable: true,
      onRender: (item: Shift) => (
        <Text>
          {item.managerApproved ?
            <span style={{ color: '#10B981' }}>✓ Approved</span> :
            <span style={{ color: '#9CA3AF' }}>Pending</span>
          }
        </Text>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Shift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <Link onClick={() => handleViewShift(item.id)}>
            View
          </Link>
          {item.status === ShiftStatus.COMPLETED && !item.managerApproved && (
            <Link onClick={() => handleApproveShift(item.id)}>
              Approve
            </Link>
          )}
        </Stack>
      ),
    },
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
      // const response = await shiftService.getAllShifts();
      // setShifts(response);

      // For demo purposes, we'll use mock data
      const mockShifts: Shift[] = [
        {
          id: 1,
          staff: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' },
          venue: { id: 1, name: 'Venue A' },
          startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          endTime: null,
          duration: null,
          status: ShiftStatus.ACTIVE,
          managerApproved: false
        },
        {
          id: 2,
          staff: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com' },
          venue: { id: 2, name: 'Venue B' },
          startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          endTime: new Date(Date.now() - 50400000).toISOString(), // 14 hours ago
          duration: 10,
          status: ShiftStatus.COMPLETED,
          managerApproved: false
        },
        {
          id: 3,
          staff: { id: 3, firstName: 'Mike', lastName: 'Johnson', email: 'mike.johnson@example.com' },
          venue: { id: 3, name: 'Venue C' },
          startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          endTime: new Date(Date.now() - 136800000).toISOString(), // 38 hours ago
          duration: 10,
          status: ShiftStatus.APPROVED,
          managerApproved: true
        },
        {
          id: 4,
          staff: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' },
          venue: { id: 1, name: 'Venue A' },
          startTime: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          endTime: new Date(Date.now() - 223200000).toISOString(), // 62 hours ago
          duration: 10,
          status: ShiftStatus.REJECTED,
          managerApproved: false
        },
        {
          id: 5,
          staff: { id: 4, firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@example.com' },
          venue: { id: 2, name: 'Venue B' },
          startTime: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
          endTime: new Date(Date.now() - 396000000).toISOString(), // 4.5 days ago
          duration: 10,
          status: ShiftStatus.APPROVED,
          managerApproved: true
        },
      ];

      // Extract unique venues for the filter dropdown
      const venues = Array.from(new Set(mockShifts.map(shift => shift.venue.id))).map(venueId => {
        const venue = mockShifts.find(shift => shift.venue.id === venueId)?.venue;
        return { key: venueId.toString(), text: venue?.name || '' };
      });

      setVenueOptions([{ key: '', text: 'All Venues' }, ...venues]);
      setShifts(mockShifts);
      setFilteredShifts(mockShifts);
    } catch (error) {
      console.error('Failed to load shifts:', error);
      setError('Failed to load shifts. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleViewShift = useCallback((shiftId: number) => {
    navigate(`/shifts/${shiftId}`);
  }, [navigate]);

  const handleApproveShift = useCallback((shiftId: number) => {
    navigate(`/approvals/${shiftId}`);
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    loadShifts();
    return false; // Return false to prevent default behavior
  }, [loadShifts]);

  const handleShowFilters = useCallback(() => {
    setShowFiltersDialog(true);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setShowFiltersDialog(false);
    // Filters are already applied in useEffect
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchText('');
    setStatusFilter('');
    setVenueFilter('');
    setStartDate(null);
    setEndDate(null);
    setShowFiltersDialog(false);
  }, []);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefresh,
    },
    {
      key: 'filters',
      text: 'Advanced Filters',
      iconProps: { iconName: 'Filter' },
      onClick: handleShowFilters,
    },
    {
      key: 'export',
      text: 'Export',
      iconProps: { iconName: 'ExcelDocument' },
      onClick: () => {
        alert('Export functionality would be implemented here');
        return false;
      },
    },
  ];

  // Apply filters when search text or status filter changes
  useEffect(() => {
    let result = shifts;

    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      result = result.filter(shift =>
        `${shift.staff.firstName} ${shift.staff.lastName}`.toLowerCase().includes(lowerCaseSearch) ||
        shift.venue.name.toLowerCase().includes(lowerCaseSearch) ||
        shift.id.toString().includes(lowerCaseSearch)
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(shift => shift.status === statusFilter);
    }

    // Apply venue filter
    if (venueFilter) {
      result = result.filter(shift => shift.venue.id.toString() === venueFilter);
    }

    // Apply date range filters
    if (startDate) {
      result = result.filter(shift => new Date(shift.startTime) >= startDate);
    }

    if (endDate) {
      // Add one day to include the entire end date
      const endDateTime = new Date(endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      result = result.filter(shift => new Date(shift.startTime) <= endDateTime);
    }

    setFilteredShifts(result);
  }, [searchText, statusFilter, venueFilter, startDate, endDate, shifts]);

  // Load shifts when component mounts
  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Staff Shifts</Text>
        </Stack>

        <CommandBar items={commandBarItems} />

        <Stack horizontal tokens={{ childrenGap: 10 }}>
          <StackItem grow={3}>
            <SearchBox
              placeholder="Search by staff name or venue"
              onChange={(_, newValue) => setSearchText(newValue || '')}
              onClear={() => setSearchText('')}
              value={searchText}
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

        {/* Active filters display */}
        {(statusFilter || venueFilter || startDate || endDate) && (
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            <Text>Active filters:</Text>
            {statusFilter && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                Status: {statusOptions.find(option => option.key === statusFilter)?.text}
              </div>
            )}
            {venueFilter && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                Venue: {venueOptions.find(option => option.key === venueFilter)?.text}
              </div>
            )}
            {startDate && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                From: {startDate.toLocaleDateString()}
              </div>
            )}
            {endDate && (
              <div className="px-2 py-1 bg-gray-100 rounded-md text-sm">
                To: {endDate.toLocaleDateString()}
              </div>
            )}
            <Link onClick={handleClearFilters}>Clear all</Link>
          </Stack>
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
            <Text>Try adjusting your search criteria.</Text>
          </div>
        ) : (
          <DetailsList
            items={filteredShifts}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </Stack>

      {/* Advanced Filters Dialog */}
      <Dialog
        hidden={!showFiltersDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Advanced Filters',
        }}
        onDismiss={() => setShowFiltersDialog(false)}
        minWidth={400}
      >
        <Stack tokens={{ childrenGap: 15 }}>
          <TextField
            label="Search"
            value={searchText}
            onChange={(_, newValue) => setSearchText(newValue || '')}
            placeholder="Staff name, venue, or shift ID"
          />

          <Dropdown
            label="Status"
            options={statusOptions}
            selectedKey={statusFilter}
            onChange={(_, option) => setStatusFilter(option?.key as string)}
          />

          <Dropdown
            label="Venue"
            options={venueOptions}
            selectedKey={venueFilter}
            onChange={(_, option) => setVenueFilter(option?.key as string)}
          />

          <Label>Date Range</Label>
          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <DatePicker
              label="From"
              value={startDate || undefined}
              onSelectDate={(date) => setStartDate(date || null)}
              placeholder="Select start date"
              formatDate={(date?: Date) => date ? date.toLocaleDateString() : ''}
            />
            <DatePicker
              label="To"
              value={endDate || undefined}
              onSelectDate={(date) => setEndDate(date || null)}
              placeholder="Select end date"
              formatDate={(date?: Date) => date ? date.toLocaleDateString() : ''}
              minDate={startDate || undefined}
            />
          </Stack>
        </Stack>
        <DialogFooter>
          <PrimaryButton text="Apply" onClick={handleApplyFilters} />
          <DefaultButton text="Clear" onClick={handleClearFilters} />
          <DefaultButton text="Cancel" onClick={() => setShowFiltersDialog(false)} />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default StaffShifts;
