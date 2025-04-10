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
  CheckboxVisibility,
  MarqueeSelection,
  Selection,
  PrimaryButton,
  Dialog,
  DialogType,
  DialogFooter,
  TextField,
  DefaultButton
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
  endTime: string;
  duration: number; // in hours
  status: ShiftStatus;
  managerApproved: boolean;
  firesExitChecksCompleted: boolean;
  capacityChecksCompleted: boolean;
  toiletChecksCompleted: boolean;
  enforcementVisitsLogged: boolean;
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

// Completion status component
const CompletionStatus: React.FC<{completed: boolean}> = ({ completed }) => (
  <Text>
    {completed ?
      <span style={{ color: '#10B981' }}>✓ Complete</span> :
      <span style={{ color: '#EF4444' }}>✗ Incomplete</span>
    }
  </Text>
);

const Approvals: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [filteredShifts, setFilteredShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [venueFilter, setVenueFilter] = useState<string>('');
  const [venueOptions, setVenueOptions] = useState<IDropdownOption[]>([{ key: '', text: 'All Venues' }]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedShifts, setSelectedShifts] = useState<Shift[]>([]);
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

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
      maxWidth: 170,
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
      key: 'date',
      name: 'Date',
      fieldName: 'startTime',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: Shift) => <Text>{new Date(item.startTime).toLocaleDateString()}</Text>,
    },
    {
      key: 'duration',
      name: 'Duration',
      fieldName: 'duration',
      minWidth: 70,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => <Text>{item.duration.toFixed(2)} hrs</Text>,
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
      key: 'firesExitChecks',
      name: 'Fire Exits',
      fieldName: 'firesExitChecksCompleted',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => <CompletionStatus completed={item.firesExitChecksCompleted} />,
    },
    {
      key: 'capacityChecks',
      name: 'Capacity',
      fieldName: 'capacityChecksCompleted',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => <CompletionStatus completed={item.capacityChecksCompleted} />,
    },
    {
      key: 'toiletChecks',
      name: 'Toilets',
      fieldName: 'toiletChecksCompleted',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Shift) => <CompletionStatus completed={item.toiletChecksCompleted} />,
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Shift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <Link onClick={() => handleApproveShift(item.id)}>
            Approve
          </Link>
          <Link onClick={() => handleRejectShift(item.id)}>
            Reject
          </Link>
          <Link onClick={() => handleViewShift(item.id)}>
            Details
          </Link>
        </Stack>
      ),
    },
  ];

  // Initialize selection
  useEffect(() => {
    const selectionInstance = new Selection({
      onSelectionChanged: () => {
        const selectedItems = selectionInstance.getSelection() as Shift[];
        setSelectedShifts(selectedItems);
      },
    });
    setSelection(selectionInstance);
  }, []);

  // Load shifts from API - using useCallback to avoid dependency issues in useEffect
  const loadShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In a real application, this would use the actual API
      // const response = await shiftService.getShiftsForApproval();
      // setShifts(response);

      // For demo purposes, we'll use mock data
      const mockShifts: Shift[] = [
        {
          id: 1,
          staff: { id: 1, firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' },
          venue: { id: 1, name: 'Venue A' },
          startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          endTime: new Date(Date.now() - 50400000).toISOString(), // 14 hours ago
          duration: 10,
          status: ShiftStatus.COMPLETED,
          managerApproved: false,
          firesExitChecksCompleted: true,
          capacityChecksCompleted: true,
          toiletChecksCompleted: true,
          enforcementVisitsLogged: true
        },
        {
          id: 2,
          staff: { id: 2, firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com' },
          venue: { id: 2, name: 'Venue B' },
          startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          endTime: new Date(Date.now() - 136800000).toISOString(), // 38 hours ago
          duration: 10,
          status: ShiftStatus.COMPLETED,
          managerApproved: false,
          firesExitChecksCompleted: true,
          capacityChecksCompleted: true,
          toiletChecksCompleted: false,
          enforcementVisitsLogged: false
        },
        {
          id: 3,
          staff: { id: 3, firstName: 'Mike', lastName: 'Johnson', email: 'mike.johnson@example.com' },
          venue: { id: 3, name: 'Venue C' },
          startTime: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          endTime: new Date(Date.now() - 223200000).toISOString(), // 62 hours ago
          duration: 10,
          status: ShiftStatus.COMPLETED,
          managerApproved: false,
          firesExitChecksCompleted: true,
          capacityChecksCompleted: true,
          toiletChecksCompleted: true,
          enforcementVisitsLogged: true
        },
        {
          id: 4,
          staff: { id: 4, firstName: 'Sarah', lastName: 'Williams', email: 'sarah.williams@example.com' },
          venue: { id: 2, name: 'Venue B' },
          startTime: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          endTime: new Date(Date.now() - 309600000).toISOString(), // 3.5 days ago
          duration: 10,
          status: ShiftStatus.COMPLETED,
          managerApproved: false,
          firesExitChecksCompleted: false,
          capacityChecksCompleted: true,
          toiletChecksCompleted: true,
          enforcementVisitsLogged: false
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
      console.error('Failed to load shifts for approval:', error);
      setError('Failed to load shifts for approval. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleViewShift = useCallback((shiftId: number) => {
    navigate(`/approvals/${shiftId}`);
  }, [navigate]);

  const handleApproveShift = useCallback((shiftId: number) => {
    navigate(`/approvals/${shiftId}`);
  }, [navigate]);

  const handleRejectShift = useCallback((shiftId: number) => {
    // Find the shift and pre-select it
    const shift = shifts.find(s => s.id === shiftId);
    if (shift && selection) {
      selection.setAllSelected(false);
      selection.setKeySelected(shiftId.toString(), true, false);
      setSelectedShifts([shift]);
      setShowBulkRejectDialog(true);
    }
  }, [shifts, selection]);

  const handleRefresh = useCallback(() => {
    loadShifts();
    return false; // Return false to prevent default behavior
  }, [loadShifts]);

  const handleBulkApprove = useCallback(() => {
    if (selectedShifts.length === 0) return;
    setShowBulkApproveDialog(true);
  }, [selectedShifts]);

  const handleBulkReject = useCallback(() => {
    if (selectedShifts.length === 0) return;
    setShowBulkRejectDialog(true);
  }, [selectedShifts]);

  const confirmBulkApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      // In a real application, this would call the API
      // await Promise.all(selectedShifts.map(shift => shiftService.approveShift(shift.id)));

      // For demo purposes, we'll just log and update the UI
      console.log(`Approved ${selectedShifts.length} shifts`);

      // Update local state
      const updatedShifts = shifts.map(shift =>
        selectedShifts.some(s => s.id === shift.id)
          ? { ...shift, status: ShiftStatus.APPROVED, managerApproved: true }
          : shift
      );

      setShifts(updatedShifts);
      // Reset selection
      if (selection) {
        selection.setAllSelected(false);
      }
      setSelectedShifts([]);
      setShowBulkApproveDialog(false);
    } catch (error) {
      console.error('Failed to approve shifts:', error);
      setError('Failed to approve shifts. Please try again.');
    } finally {
      setIsApproving(false);
    }
  }, [selectedShifts, shifts, selection]);

  const confirmBulkReject = useCallback(async () => {
    setIsRejecting(true);
    try {
      // In a real application, this would call the API
      // await Promise.all(selectedShifts.map(shift =>
      //   shiftService.rejectShift(shift.id, rejectionReason)
      // ));

      // For demo purposes, we'll just log and update the UI
      console.log(`Rejected ${selectedShifts.length} shifts with reason: ${rejectionReason}`);

      // Update local state
      const updatedShifts = shifts.map(shift =>
        selectedShifts.some(s => s.id === shift.id)
          ? { ...shift, status: ShiftStatus.REJECTED, managerApproved: false }
          : shift
      );

      setShifts(updatedShifts);
      // Reset selection
      if (selection) {
        selection.setAllSelected(false);
      }
      setSelectedShifts([]);
      setRejectionReason('');
      setShowBulkRejectDialog(false);
    } catch (error) {
      console.error('Failed to reject shifts:', error);
      setError('Failed to reject shifts. Please try again.');
    } finally {
      setIsRejecting(false);
    }
  }, [selectedShifts, shifts, selection, rejectionReason]);

  // Command bar items - enabled based on selection state
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'approveSelected',
      text: 'Approve Selected',
      iconProps: { iconName: 'CheckMark' },
      onClick: handleBulkApprove,
      disabled: selectedShifts.length === 0,
    },
    {
      key: 'rejectSelected',
      text: 'Reject Selected',
      iconProps: { iconName: 'Cancel' },
      onClick: handleBulkReject,
      disabled: selectedShifts.length === 0,
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefresh,
    },
  ];

  // Apply filters when search text or venue filter changes
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

    // Apply venue filter
    if (venueFilter) {
      result = result.filter(shift => shift.venue.id.toString() === venueFilter);
    }

    setFilteredShifts(result);
  }, [searchText, venueFilter, shifts]);

  // Load shifts when component mounts
  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Shifts Pending Approval</Text>
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
              placeholder="Filter by venue"
              options={venueOptions}
              selectedKey={venueFilter}
              onChange={(_, option) => setVenueFilter(option?.key as string)}
            />
          </StackItem>
        </Stack>

        {/* Selection count */}
        {selectedShifts.length > 0 && (
          <div className="bg-blue-50 p-2 rounded-md">
            <Text>{selectedShifts.length} shift{selectedShifts.length === 1 ? '' : 's'} selected</Text>
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
            <Text variant="large">No shifts pending approval</Text>
            <Text>All shifts have been processed or no shifts have been completed yet.</Text>
          </div>
        ) : selection ? (
          <MarqueeSelection selection={selection}>
            <DetailsList
              items={filteredShifts}
              columns={columns}
              layoutMode={DetailsListLayoutMode.justified}
              selection={selection}
              selectionMode={SelectionMode.multiple}
              checkboxVisibility={CheckboxVisibility.always}
            />
          </MarqueeSelection>
        ) : (
          <DetailsList
            items={filteredShifts}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </Stack>

      {/* Bulk Approve Dialog */}
      <Dialog
        hidden={!showBulkApproveDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Approve Shifts',
          subText: `Are you sure you want to approve ${selectedShifts.length} shift${selectedShifts.length === 1 ? '' : 's'}?`
        }}
        onDismiss={() => setShowBulkApproveDialog(false)}
      >
        <DialogFooter>
          <PrimaryButton
            text="Approve"
            onClick={confirmBulkApprove}
            disabled={isApproving}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowBulkApproveDialog(false)}
            disabled={isApproving}
          />
        </DialogFooter>
      </Dialog>

      {/* Bulk Reject Dialog */}
      <Dialog
        hidden={!showBulkRejectDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Reject Shifts',
          subText: `Please provide a reason for rejecting ${selectedShifts.length} shift${selectedShifts.length === 1 ? '' : 's'}.`
        }}
        onDismiss={() => setShowBulkRejectDialog(false)}
      >
        <TextField
          label="Reason for rejection"
          multiline
          rows={3}
          value={rejectionReason}
          onChange={(_, newValue) => setRejectionReason(newValue || '')}
          required
        />
        <DialogFooter>
          <PrimaryButton
            text="Reject"
            onClick={confirmBulkReject}
            disabled={isRejecting || !rejectionReason.trim()}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowBulkRejectDialog(false)}
            disabled={isRejecting}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default Approvals;
