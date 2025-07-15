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
  DefaultButton,
  Pivot,
  PivotItem
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { ShiftStatus } from '../../types';
import { shiftService, exchangeService } from '../../services';
import type { ShiftExchange, OpenShiftRequest } from '../../services/exchangeService';

interface IncompleteShift {
  id: number;
  type: 'no_checkin' | 'no_checkout';
  staff_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  venue_details: {
    id: number;
    name: string;
    address: string;
  };
  start_time: string;
  end_time: string;
  check_in_time?: string;
  hours_overdue: number;
  status: string;
  auto_checkout_eligible: boolean;
  force_timeout_eligible: boolean;
  priority: 'low' | 'medium' | 'high';
}

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
  const [activeTab, setActiveTab] = useState('shift-approvals');
  
  // Shift Approvals State
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

  // Exchange Approvals State
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [openShiftRequests, setOpenShiftRequests] = useState<OpenShiftRequest[]>([]);
  const [filteredExchanges, setFilteredExchanges] = useState<ShiftExchange[]>([]);
  const [filteredOpenRequests, setFilteredOpenRequests] = useState<OpenShiftRequest[]>([]);
  const [exchangeSearchText, setExchangeSearchText] = useState('');
  const [selectedExchanges, setSelectedExchanges] = useState<ShiftExchange[]>([]);
  const [selectedOpenRequests, setSelectedOpenRequests] = useState<OpenShiftRequest[]>([]);
  const [exchangeSelection, setExchangeSelection] = useState<Selection | null>(null);
  const [openRequestSelection, setOpenRequestSelection] = useState<Selection | null>(null);

  // Incomplete Shifts State
  const [incompleteShifts, setIncompleteShifts] = useState<IncompleteShift[]>([]);
  const [filteredIncompleteShifts, setFilteredIncompleteShifts] = useState<IncompleteShift[]>([]);
  const [incompleteSearchText, setIncompleteSearchText] = useState('');
  const [selectedIncompleteShifts, setSelectedIncompleteShifts] = useState<IncompleteShift[]>([]);
  const [incompleteSelection, setIncompleteSelection] = useState<Selection | null>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualAction, setManualAction] = useState<'checkin' | 'checkout' | 'force_complete'>('checkin');
  const [selectedShiftForManual, setSelectedShiftForManual] = useState<IncompleteShift | null>(null);
  const [manualSignature, setManualSignature] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualHours, setManualHours] = useState('');
  const [manualCheckinTime, setManualCheckinTime] = useState('');
  const [manualCheckoutTime, setManualCheckoutTime] = useState('');
  const [isProcessingManual, setIsProcessingManual] = useState(false);

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

  // Exchange columns
  const exchangeColumns: IColumn[] = [
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 50,
      isResizable: true,
    },
    {
      key: 'requesting_user',
      name: 'Requesting Staff',
      minWidth: 150,
      maxWidth: 170,
      isResizable: true,
      onRender: (item: ShiftExchange) => (
        <Text>{`${item.requesting_user_details.first_name} ${item.requesting_user_details.last_name}`}</Text>
      ),
    },
    {
      key: 'target_user',
      name: 'Target Staff',
      minWidth: 150,
      maxWidth: 170,
      isResizable: true,
      onRender: (item: ShiftExchange) => (
        <Text>{`${item.target_user_details.first_name} ${item.target_user_details.last_name}`}</Text>
      ),
    },
    {
      key: 'venue',
      name: 'Venue',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: ShiftExchange) => <Text>{item.original_shift_details.venue.name}</Text>,
    },
    {
      key: 'date',
      name: 'Date',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: ShiftExchange) => (
        <Text>{new Date(item.original_shift_details.start_time).toLocaleDateString()}</Text>
      ),
    },
    {
      key: 'status',
      name: 'Status',
      minWidth: 120,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: ShiftExchange) => (
        <div
          style={{
            backgroundColor: item.status === 'accepted_by_target' ? '#F59E0B' : '#9CA3AF',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'inline-block',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          {item.status.replace('_', ' ')}
        </div>
      ),
    },
    {
      key: 'reason',
      name: 'Reason',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: ShiftExchange) => <Text>{item.request_reason}</Text>,
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: ShiftExchange) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {item.status === 'accepted_by_target' && (
            <>
              <Link onClick={() => handleApproveExchange(item.id)}>
                Approve
              </Link>
              <Link onClick={() => handleRejectExchange(item.id)}>
                Reject
              </Link>
            </>
          )}
        </Stack>
      ),
    },
  ];

  // Open Shift Request columns
  const openRequestColumns: IColumn[] = [
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 50,
      maxWidth: 50,
      isResizable: true,
    },
    {
      key: 'requesting_user',
      name: 'Releasing Staff',
      minWidth: 150,
      maxWidth: 170,
      isResizable: true,
      onRender: (item: OpenShiftRequest) => (
        <Text>{`${item.requesting_user_details.first_name} ${item.requesting_user_details.last_name}`}</Text>
      ),
    },
    {
      key: 'claimed_by',
      name: 'Claimed By',
      minWidth: 150,
      maxWidth: 170,
      isResizable: true,
      onRender: (item: OpenShiftRequest) => (
        <Text>
          {item.claimed_by_details 
            ? `${item.claimed_by_details.first_name} ${item.claimed_by_details.last_name}`
            : 'Not claimed'
          }
        </Text>
      ),
    },
    {
      key: 'venue',
      name: 'Venue',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: OpenShiftRequest) => <Text>{item.original_shift_details.venue.name}</Text>,
    },
    {
      key: 'date',
      name: 'Date',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: OpenShiftRequest) => (
        <Text>{new Date(item.original_shift_details.start_time).toLocaleDateString()}</Text>
      ),
    },
    {
      key: 'status',
      name: 'Status',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: OpenShiftRequest) => (
        <div
          style={{
            backgroundColor: item.status === 'claimed' ? '#F59E0B' : item.status === 'open' ? '#10B981' : '#9CA3AF',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'inline-block',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          {item.status}
        </div>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: OpenShiftRequest) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {item.status === 'claimed' && (
            <>
              <Link onClick={() => handleApproveOpenRequest(item.id)}>
                Approve
              </Link>
              <Link onClick={() => handleRejectOpenRequest(item.id)}>
                Reject
              </Link>
            </>
          )}
        </Stack>
      ),
    },
  ];

  // Priority indicator component
  const PriorityPill: React.FC<{priority: 'low' | 'medium' | 'high'}> = ({ priority }) => {
    let backgroundColor = '';
    let color = 'white';

    switch(priority) {
      case 'high':
        backgroundColor = '#EF4444'; // Red
        break;
      case 'medium':
        backgroundColor = '#F59E0B'; // Yellow
        color = 'black';
        break;
      case 'low':
        backgroundColor = '#10B981'; // Green
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
        {priority}
      </div>
    );
  };

  // Incomplete Shifts columns
  const incompleteColumns: IColumn[] = [
    {
      key: 'priority',
      name: 'Priority',
      minWidth: 70,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: IncompleteShift) => <PriorityPill priority={item.priority} />,
    },
    {
      key: 'type',
      name: 'Issue',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <div
          style={{
            backgroundColor: item.type === 'no_checkin' ? '#EF4444' : '#F59E0B',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'inline-block',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          {item.type === 'no_checkin' ? 'No Check-in' : 'No Check-out'}
        </div>
      ),
    },
    {
      key: 'staff',
      name: 'Staff Member',
      minWidth: 150,
      maxWidth: 170,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <Text>{`${item.staff_details.first_name} ${item.staff_details.last_name}`}</Text>
      ),
    },
    {
      key: 'venue',
      name: 'Venue',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: IncompleteShift) => <Text>{item.venue_details.name}</Text>,
    },
    {
      key: 'date',
      name: 'Date',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IncompleteShift) => <Text>{new Date(item.start_time).toLocaleDateString()}</Text>,
    },
    {
      key: 'hours_overdue',
      name: 'Hours Overdue',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <Text style={{ color: item.hours_overdue > 2 ? '#EF4444' : '#F59E0B', fontWeight: 'bold' }}>
          {item.hours_overdue.toFixed(1)}
        </Text>
      ),
    },
    {
      key: 'auto_checkout',
      name: 'Auto-Checkout',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <Text>
          {item.auto_checkout_eligible ? 
            <span style={{ color: '#10B981' }}>✓ Eligible</span> : 
            <span style={{ color: '#EF4444' }}>✗ Not Eligible</span>
          }
        </Text>
      ),
    },
    {
      key: 'force_timeout',
      name: 'Force Timeout',
      minWidth: 100,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <Text>
          {item.force_timeout_eligible ? 
            <span style={{ color: '#EF4444' }}>⚠ Ready</span> : 
            <span style={{ color: '#9CA3AF' }}>⏳ Pending</span>
          }
        </Text>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 200,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          {item.type === 'no_checkin' && (
            <Link onClick={() => handleManualCheckin(item)}>
              Manual Check-in
            </Link>
          )}
          {item.type === 'no_checkout' && (
            <Link onClick={() => handleManualCheckout(item)}>
              Manual Check-out
            </Link>
          )}
          <Link onClick={() => handleForceComplete(item)}>
            Force Complete
          </Link>
        </Stack>
      ),
    },
  ];

  // Initialize selections
  useEffect(() => {
    const selectionInstance = new Selection({
      onSelectionChanged: () => {
        const selectedItems = selectionInstance.getSelection() as Shift[];
        setSelectedShifts(selectedItems);
      },
    });
    setSelection(selectionInstance);

    const exchangeSelectionInstance = new Selection({
      onSelectionChanged: () => {
        const selectedItems = exchangeSelectionInstance.getSelection() as ShiftExchange[];
        setSelectedExchanges(selectedItems);
      },
    });
    setExchangeSelection(exchangeSelectionInstance);

    const openRequestSelectionInstance = new Selection({
      onSelectionChanged: () => {
        const selectedItems = openRequestSelectionInstance.getSelection() as OpenShiftRequest[];
        setSelectedOpenRequests(selectedItems);
      },
    });
    setOpenRequestSelection(openRequestSelectionInstance);

    const incompleteSelectionInstance = new Selection({
      onSelectionChanged: () => {
        const selectedItems = incompleteSelectionInstance.getSelection() as IncompleteShift[];
        setSelectedIncompleteShifts(selectedItems);
      },
    });
    setIncompleteSelection(incompleteSelectionInstance);
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

  // Load exchanges and open requests
  const loadExchanges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get pending approvals from the exchange service
      const approvals = await exchangeService.getPendingApprovals();
      
      console.log('Pending approvals:', approvals);
      
      setExchanges(approvals.exchange_requests || []);
      setOpenShiftRequests(approvals.shift_claims || []);
      setFilteredExchanges(approvals.exchange_requests || []);
      setFilteredOpenRequests(approvals.shift_claims || []);
    } catch (error) {
      console.error('Failed to load exchange approvals:', error);
      setError('Failed to load exchange approvals. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load incomplete shifts
  const loadIncompleteShifts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Call the new API endpoint for incomplete shifts using the shift service
      const response = await fetch('http://localhost:8000/api/shifts/incomplete/', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch incomplete shifts');
      }
      
      const data = await response.json();
      setIncompleteShifts(data);
      setFilteredIncompleteShifts(data);
    } catch (error) {
      console.error('Failed to load incomplete shifts:', error);
      setError('Failed to load incomplete shifts. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    if (activeTab === 'shift-approvals') {
      await loadShifts();
    } else if (activeTab === 'exchange-approvals') {
      await loadExchanges();
    } else if (activeTab === 'incomplete-shifts') {
      await loadIncompleteShifts();
    }
  }, [activeTab, loadShifts, loadExchanges, loadIncompleteShifts]);

  // Exchange handler functions
  const handleApproveExchange = useCallback(async (exchangeId: number) => {
    try {
      await exchangeService.approveExchange(exchangeId, 'Approved by manager');
      await loadExchanges(); // Reload data
    } catch (error) {
      console.error('Failed to approve exchange:', error);
      setError('Failed to approve exchange. Please try again.');
    }
  }, [loadExchanges]);

  const handleRejectExchange = useCallback(async (exchangeId: number) => {
    try {
      await exchangeService.rejectExchange(exchangeId, 'Rejected by manager');
      await loadExchanges(); // Reload data
    } catch (error) {
      console.error('Failed to reject exchange:', error);
      setError('Failed to reject exchange. Please try again.');
    }
  }, [loadExchanges]);

  const handleApproveOpenRequest = useCallback(async (requestId: number) => {
    try {
      await exchangeService.approveClaim(requestId, 'Approved by manager');
      await loadExchanges(); // Reload data
    } catch (error) {
      console.error('Failed to approve open request:', error);
      setError('Failed to approve open request. Please try again.');
    }
  }, [loadExchanges]);

  const handleRejectOpenRequest = useCallback(async (requestId: number) => {
    try {
      await exchangeService.rejectClaim(requestId, 'Rejected by manager');
      await loadExchanges(); // Reload data
    } catch (error) {
      console.error('Failed to reject open request:', error);
      setError('Failed to reject open request. Please try again.');
    }
  }, [loadExchanges]);

  // Incomplete shift handler functions
  const handleManualCheckin = useCallback((shift: IncompleteShift) => {
    setSelectedShiftForManual(shift);
    setManualAction('checkin');
    setManualSignature('');
    setManualNotes('');
    setManualCheckinTime(new Date().toISOString());
    setShowManualDialog(true);
  }, []);

  const handleManualCheckout = useCallback((shift: IncompleteShift) => {
    setSelectedShiftForManual(shift);
    setManualAction('checkout');
    setManualSignature('');
    setManualNotes('');
    setManualHours('');
    setManualCheckoutTime(new Date().toISOString());
    setShowManualDialog(true);
  }, []);

  const handleForceComplete = useCallback((shift: IncompleteShift) => {
    setSelectedShiftForManual(shift);
    setManualAction('force_complete');
    setManualSignature('');
    setManualNotes('');
    setManualHours('');
    setManualCheckinTime(shift.check_in_time || new Date(shift.start_time).toISOString());
    setManualCheckoutTime(new Date().toISOString());
    setShowManualDialog(true);
  }, []);

  const processManualAction = useCallback(async () => {
    if (!selectedShiftForManual || !manualSignature.trim()) {
      return;
    }

    setIsProcessingManual(true);
    try {
      const baseUrl = 'http://localhost:8000/api/shifts';
      let endpoint = '';
      const requestData: any = {
        manager_signature: manualSignature,
        manager_notes: manualNotes,
      };

      switch (manualAction) {
        case 'checkin':
          endpoint = `${baseUrl}/${selectedShiftForManual.id}/manual_checkin/`;
          if (manualCheckinTime) {
            requestData.checkin_time = manualCheckinTime;
          }
          break;
        case 'checkout':
          endpoint = `${baseUrl}/${selectedShiftForManual.id}/manual_checkout/`;
          if (manualCheckoutTime) {
            requestData.checkout_time = manualCheckoutTime;
          }
          if (manualHours) {
            requestData.actual_hours = parseFloat(manualHours);
          }
          break;
        case 'force_complete':
          endpoint = `${baseUrl}/${selectedShiftForManual.id}/force_complete/`;
          requestData.actual_hours = parseFloat(manualHours);
          if (manualCheckinTime) {
            requestData.checkin_time = manualCheckinTime;
          }
          if (manualCheckoutTime) {
            requestData.checkout_time = manualCheckoutTime;
          }
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to process manual action');
      }

      // Success - reload data and close dialog
      await loadIncompleteShifts();
      setShowManualDialog(false);
      setSelectedShiftForManual(null);
      setManualSignature('');
      setManualNotes('');
      setManualHours('');
      setManualCheckinTime('');
      setManualCheckoutTime('');
    } catch (error) {
      console.error('Failed to process manual action:', error);
      setError(`Failed to process manual action: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingManual(false);
    }
  }, [selectedShiftForManual, manualSignature, manualNotes, manualHours, manualCheckinTime, manualCheckoutTime, manualAction, loadIncompleteShifts]);

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

  // Apply filters for incomplete shifts
  useEffect(() => {
    let result = incompleteShifts;

    // Apply search filter
    if (incompleteSearchText) {
      const lowerCaseSearch = incompleteSearchText.toLowerCase();
      result = result.filter(shift =>
        `${shift.staff_details.first_name} ${shift.staff_details.last_name}`.toLowerCase().includes(lowerCaseSearch) ||
        shift.venue_details.name.toLowerCase().includes(lowerCaseSearch) ||
        shift.id.toString().includes(lowerCaseSearch)
      );
    }

    setFilteredIncompleteShifts(result);
  }, [incompleteSearchText, incompleteShifts]);

  // Load data when component mounts or active tab changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Text variant="xxLarge" style={{ color: '#B91C1C' }}>Pending Approvals</Text>
        
        <Pivot
          selectedKey={activeTab}
          onLinkClick={(item) => setActiveTab(item?.props.itemKey || 'shift-approvals')}
          headersOnly={false}
        >
          <PivotItem headerText="Shift Approvals" itemKey="shift-approvals">
            <Stack tokens={{ childrenGap: 20 }}>
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
          </PivotItem>

          <PivotItem headerText="Exchange Approvals" itemKey="exchange-approvals">
            <Stack tokens={{ childrenGap: 20 }}>
              <Text variant="large">Direct Exchange Requests</Text>
              
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
                  <Spinner size={SpinnerSize.large} label="Loading exchange requests..." />
                </div>
              ) : filteredExchanges.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Text variant="large">No exchange requests pending approval</Text>
                  <Text>No staff have accepted exchange requests that need manager approval.</Text>
                </div>
              ) : (
                <DetailsList
                  items={filteredExchanges}
                  columns={exchangeColumns}
                  layoutMode={DetailsListLayoutMode.justified}
                  selectionMode={SelectionMode.none}
                />
              )}

              <Text variant="large" style={{ marginTop: '20px' }}>Open Shift Claims</Text>
              
              {filteredOpenRequests.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <Text variant="large">No open shift claims pending approval</Text>
                  <Text>No staff have claimed open shifts that need manager approval.</Text>
                </div>
              ) : (
                <DetailsList
                  items={filteredOpenRequests}
                  columns={openRequestColumns}
                  layoutMode={DetailsListLayoutMode.justified}
                  selectionMode={SelectionMode.none}
                />
              )}
            </Stack>
          </PivotItem>

          <PivotItem headerText="Incomplete Shifts" itemKey="incomplete-shifts">
            <Stack tokens={{ childrenGap: 20 }}>
              <Stack horizontal tokens={{ childrenGap: 10 }}>
                <StackItem grow={3}>
                  <SearchBox
                    placeholder="Search by staff name or venue"
                    onChange={(_, newValue) => setIncompleteSearchText(newValue || '')}
                    onClear={() => setIncompleteSearchText('')}
                    value={incompleteSearchText}
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
                  <Spinner size={SpinnerSize.large} label="Loading incomplete shifts..." />
                </div>
              ) : filteredIncompleteShifts.length === 0 ? (
                <div className="bg-green-50 rounded-lg p-8 text-center">
                  <Text variant="large" style={{ color: '#10B981' }}>All shifts are complete!</Text>
                  <Text>No shifts require manager intervention at this time.</Text>
                </div>
              ) : (
                <div>
                  <div className="bg-yellow-50 p-3 rounded-md mb-4">
                    <Text style={{ color: '#D97706', fontWeight: 'bold' }}>
                      ⚠ {filteredIncompleteShifts.length} shifts need manager attention
                    </Text>
                    <Text style={{ color: '#92400E' }}>
                      High priority items require immediate action. Click on actions to manually resolve.
                    </Text>
                  </div>
                  
                  <DetailsList
                    items={filteredIncompleteShifts}
                    columns={incompleteColumns}
                    layoutMode={DetailsListLayoutMode.justified}
                    selectionMode={SelectionMode.none}
                  />
                </div>
              )}
            </Stack>
          </PivotItem>
        </Pivot>
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

      {/* Manual Action Dialog */}
      <Dialog
        hidden={!showManualDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: `${
            manualAction === 'checkin' ? 'Manual Check-in' : 
            manualAction === 'checkout' ? 'Manual Check-out' : 
            'Force Complete Shift'
          }`,
          subText: selectedShiftForManual ? 
            `Processing ${manualAction} for ${selectedShiftForManual.staff_details.first_name} ${selectedShiftForManual.staff_details.last_name} at ${selectedShiftForManual.venue_details.name}` : 
            ''
        }}
        onDismiss={() => setShowManualDialog(false)}
        minWidth={500}
      >
        <Stack tokens={{ childrenGap: 10 }}>
          <TextField
            label="Manager Signature (required)"
            value={manualSignature}
            onChange={(_, newValue) => setManualSignature(newValue || '')}
            placeholder="Enter your full name as digital signature"
            required
          />

          <TextField
            label="Manager Notes"
            value={manualNotes}
            onChange={(_, newValue) => setManualNotes(newValue || '')}
            placeholder="Reason for manual intervention (e.g., Network issues, Staff emergency)"
            multiline
            rows={2}
          />

          {manualAction === 'checkin' && (
            <TextField
              label="Check-in Time"
              type="datetime-local"
              value={manualCheckinTime ? new Date(manualCheckinTime).toISOString().slice(0, 16) : ''}
              onChange={(_, newValue) => setManualCheckinTime(newValue ? new Date(newValue).toISOString() : '')}
            />
          )}

          {(manualAction === 'checkout' || manualAction === 'force_complete') && (
            <>
              <TextField
                label="Actual Hours Worked"
                type="number"
                value={manualHours}
                onChange={(_, newValue) => setManualHours(newValue || '')}
                placeholder="8.5"
                step="0.5"
                min="0"
                max="24"
                required={manualAction === 'force_complete'}
              />
              
              {manualAction === 'checkout' && (
                <TextField
                  label="Check-out Time"
                  type="datetime-local"
                  value={manualCheckoutTime ? new Date(manualCheckoutTime).toISOString().slice(0, 16) : ''}
                  onChange={(_, newValue) => setManualCheckoutTime(newValue ? new Date(newValue).toISOString() : '')}
                />
              )}
            </>
          )}

          {manualAction === 'force_complete' && (
            <>
              <TextField
                label="Check-in Time"
                type="datetime-local"
                value={manualCheckinTime ? new Date(manualCheckinTime).toISOString().slice(0, 16) : ''}
                onChange={(_, newValue) => setManualCheckinTime(newValue ? new Date(newValue).toISOString() : '')}
              />
              
              <TextField
                label="Check-out Time"
                type="datetime-local"
                value={manualCheckoutTime ? new Date(manualCheckoutTime).toISOString().slice(0, 16) : ''}
                onChange={(_, newValue) => setManualCheckoutTime(newValue ? new Date(newValue).toISOString() : '')}
              />
            </>
          )}
        </Stack>
        
        <DialogFooter>
          <PrimaryButton
            text={
              manualAction === 'checkin' ? 'Check In' : 
              manualAction === 'checkout' ? 'Check Out' : 
              'Force Complete'
            }
            onClick={processManualAction}
            disabled={
              isProcessingManual || 
              !manualSignature.trim() || 
              (manualAction === 'force_complete' && !manualHours.trim())
            }
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowManualDialog(false)}
            disabled={isProcessingManual}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default Approvals;
