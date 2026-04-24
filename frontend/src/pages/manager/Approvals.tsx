import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Header, Container, CloudscapeTable, StatusIndicator, EmptyState, Alert } from '../../components/cloudscape';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';
import { shiftService, exchangeService, api } from '../../services';
import type { ShiftExchange, OpenShiftRequest } from '../../services/exchangeService';
import AdjustTimeDialog from '../../components/AdjustTimeDialog';
import type { Shift } from '../../types';

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
  hours_overdue_raw?: number;
  requires_manual_resolution?: boolean;
  status: string;
  auto_checkout_eligible: boolean;
  force_timeout_eligible: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

const padDateTimePart = (value: number): string => value.toString().padStart(2, '0');

const formatLocalDateTimeInputValue = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    `${date.getFullYear()}-${padDateTimePart(date.getMonth() + 1)}-${padDateTimePart(date.getDate())}`,
    `${padDateTimePart(date.getHours())}:${padDateTimePart(date.getMinutes())}`,
  ].join('T');
};

const datetimeLocalValueToIso = (value: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const Approvals: React.FC = () => {
  const [activeTab, setActiveTab] = useState('exchange-approvals');

  // Common State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exchange Approvals State
  const [exchanges, setExchanges] = useState<ShiftExchange[]>([]);
  const [openShiftRequests, setOpenShiftRequests] = useState<OpenShiftRequest[]>([]);
  const [filteredExchanges, setFilteredExchanges] = useState<ShiftExchange[]>([]);
  const [filteredOpenRequests, setFilteredOpenRequests] = useState<OpenShiftRequest[]>([]);

  // Incomplete Shifts State
  const [incompleteShifts, setIncompleteShifts] = useState<IncompleteShift[]>([]);
  const [filteredIncompleteShifts, setFilteredIncompleteShifts] = useState<IncompleteShift[]>([]);
  const [incompleteSearchText, setIncompleteSearchText] = useState('');
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualAction, setManualAction] = useState<'checkin' | 'checkout' | 'force_complete'>('checkin');
  const [selectedShiftForManual, setSelectedShiftForManual] = useState<IncompleteShift | null>(null);
  const [manualSignature, setManualSignature] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualHours, setManualHours] = useState('');
  const [manualCheckinTime, setManualCheckinTime] = useState('');
  const [manualCheckoutTime, setManualCheckoutTime] = useState('');
  const [isProcessingManual, setIsProcessingManual] = useState(false);

  // Time Adjustment State
  const [showAdjustTimeDialog, setShowAdjustTimeDialog] = useState(false);
  const [selectedShiftForAdjustment, setSelectedShiftForAdjustment] = useState<Shift | null>(null);

  // Helper function to calculate hours between two times
  const calculateHoursWorked = (checkInTime: string, checkOutTime: string): number => {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 2) / 2; // Round to nearest 0.5
  };

  // Helper function to calculate checkout time from check-in time and hours
  const calculateCheckoutTime = (checkInTime: string, hours: number): string => {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkIn.getTime() + hours * 60 * 60 * 1000);
    return checkOut.toISOString();
  };

  // Exchange columns
  const exchangeColumns: ColumnDefinition<ShiftExchange>[] = [
    {
      id: 'id',
      header: 'ID',
      width: 60,
      cell: (item) => <span className="text-gray-500 font-mono text-xs">#{item.id}</span>,
    },
    {
      id: 'requesting_user',
      header: 'Requesting Staff',
      minWidth: 150,
      cell: (item) => (
        <span>{`${item.requesting_user_details.first_name} ${item.requesting_user_details.last_name}`}</span>
      ),
    },
    {
      id: 'target_user',
      header: 'Target Staff',
      minWidth: 150,
      cell: (item) => (
        <span>{`${item.target_user_details.first_name} ${item.target_user_details.last_name}`}</span>
      ),
    },
    {
      id: 'venue',
      header: 'Venue',
      minWidth: 120,
      cell: (item) => <span>{item.original_shift_details.venue.name}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      width: 110,
      cell: (item) => (
        <span>{new Date(item.original_shift_details.start_time).toLocaleDateString()}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 130,
      cell: (item) => {
        const statusType = item.status === 'accepted_by_target' ? 'warning' : 'stopped';
        return (
          <StatusIndicator type={statusType}>
            {item.status.replace(/_/g, ' ')}
          </StatusIndicator>
        );
      },
    },
    {
      id: 'reason',
      header: 'Reason',
      minWidth: 200,
      cell: (item) => <span className="text-gray-600">{item.request_reason}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 160,
      cell: (item) => (
        <div className="flex items-center gap-2">
          {item.status === 'accepted_by_target' && (
            <>
              <button
                onClick={() => handleApproveExchange(item.id)}
                className="px-3 h-8 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => handleRejectExchange(item.id)}
                className="px-3 h-8 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Open Shift Request columns
  const openRequestColumns: ColumnDefinition<OpenShiftRequest>[] = [
    {
      id: 'id',
      header: 'ID',
      width: 60,
      cell: (item) => <span className="text-gray-500 font-mono text-xs">#{item.id}</span>,
    },
    {
      id: 'requesting_user',
      header: 'Releasing Staff',
      minWidth: 150,
      cell: (item) => (
        <span>{`${item.requesting_user_details.first_name} ${item.requesting_user_details.last_name}`}</span>
      ),
    },
    {
      id: 'claimed_by',
      header: 'Claimed By',
      minWidth: 150,
      cell: (item) => (
        <span>
          {item.claimed_by_details
            ? `${item.claimed_by_details.first_name} ${item.claimed_by_details.last_name}`
            : <span className="text-gray-400 italic">Not claimed</span>
          }
        </span>
      ),
    },
    {
      id: 'venue',
      header: 'Venue',
      minWidth: 120,
      cell: (item) => <span>{item.original_shift_details.venue.name}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      width: 110,
      cell: (item) => (
        <span>{new Date(item.original_shift_details.start_time).toLocaleDateString()}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 110,
      cell: (item) => {
        const statusType = item.status === 'claimed' ? 'warning' : item.status === 'open' ? 'success' : 'stopped';
        return (
          <StatusIndicator type={statusType}>
            {item.status}
          </StatusIndicator>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 160,
      cell: (item) => (
        <div className="flex items-center gap-2">
          {item.status === 'claimed' && (
            <>
              <button
                onClick={() => handleApproveOpenRequest(item.id)}
                className="px-3 h-8 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => handleRejectOpenRequest(item.id)}
                className="px-3 h-8 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Priority indicator component
  const PriorityPill: React.FC<{priority: 'low' | 'medium' | 'high' | 'critical'}> = ({ priority }) => {
    const config: Record<string, { type: 'success' | 'warning' | 'error' | 'stopped' }> = {
      critical: { type: 'error' },
      high: { type: 'error' },
      medium: { type: 'warning' },
      low: { type: 'success' },
    };
    const c = config[priority] || config.low;
    return <StatusIndicator type={c.type}>{priority}</StatusIndicator>;
  };

  // Incomplete Shifts columns
  const incompleteColumns: ColumnDefinition<IncompleteShift>[] = [
    {
      id: 'priority',
      header: 'Priority',
      width: 100,
      cell: (item) => <PriorityPill priority={item.priority} />,
    },
    {
      id: 'type',
      header: 'Issue',
      width: 130,
      cell: (item) => (
        <StatusIndicator type={item.type === 'no_checkin' ? 'error' : 'warning'}>
          {item.type === 'no_checkin' ? 'No Check-in' : 'No Check-out'}
        </StatusIndicator>
      ),
    },
    {
      id: 'staff',
      header: 'Staff Member',
      minWidth: 150,
      cell: (item) => (
        <span>{`${item.staff_details.first_name} ${item.staff_details.last_name}`}</span>
      ),
    },
    {
      id: 'venue',
      header: 'Venue',
      minWidth: 120,
      cell: (item) => <span>{item.venue_details.name}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      width: 110,
      cell: (item) => <span>{new Date(item.start_time).toLocaleDateString()}</span>,
    },
    {
      id: 'hours_overdue',
      header: 'Hours Overdue',
      width: 130,
      cell: (item) => (
        <div className="flex items-center gap-1">
          <span className={`font-bold ${
            item.requires_manual_resolution ? 'text-red-600' : item.hours_overdue > 2 ? 'text-red-500' : 'text-amber-500'
          }`}>
            {item.requires_manual_resolution ? '24+' : item.hours_overdue.toFixed(1)}
          </span>
          {item.requires_manual_resolution && (
            <span
              title={`Actual: ${item.hours_overdue_raw?.toFixed(1) || '24+'} hours - Requires manual resolution`}
              className="text-red-600 cursor-help"
            >
              &#9888;
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'urgency',
      header: 'Action Required',
      minWidth: 170,
      cell: (item) => {
        const urgencyConfig = {
          critical: { text: 'Immediate action required', bgClass: 'bg-red-50', textClass: 'text-red-600' },
          high: { text: 'Action within 2 hours', bgClass: 'bg-orange-50', textClass: 'text-orange-600' },
          medium: { text: 'Action within 4 hours', bgClass: 'bg-amber-50', textClass: 'text-amber-600' },
          low: { text: 'Action recommended', bgClass: 'bg-green-50', textClass: 'text-green-600' },
        };
        const urgency = urgencyConfig[item.priority];
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${urgency.bgClass} ${urgency.textClass}`}>
            {item.priority === 'critical' && (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            )}
            {urgency.text}
          </span>
        );
      },
    },
    {
      id: 'auto_checkout',
      header: 'Auto-Checkout',
      width: 110,
      cell: (item) => (
        <StatusIndicator type={item.auto_checkout_eligible ? 'success' : 'error'}>
          {item.auto_checkout_eligible ? 'Eligible' : 'Not Eligible'}
        </StatusIndicator>
      ),
    },
    {
      id: 'force_timeout',
      header: 'Force Timeout',
      width: 110,
      cell: (item) => (
        <StatusIndicator type={item.force_timeout_eligible ? 'warning' : 'pending'}>
          {item.force_timeout_eligible ? 'Ready' : 'Pending'}
        </StatusIndicator>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      minWidth: 340,
      cell: (item) => (
        <div className="flex items-center gap-2">
          {item.type === 'no_checkin' && (
            <button
              onClick={() => handleManualCheckin(item)}
              title="Record a manual check-in time for this staff member. Use this when staff forgot to check in or had technical issues."
              className="px-3 h-8 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Check In
            </button>
          )}
          {item.type === 'no_checkout' && (
            <button
              onClick={() => handleManualCheckout(item)}
              title="Record a manual check-out time for this staff member. Use this when staff forgot to check out or had technical issues."
              className="px-3 h-8 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors"
            >
              Check Out
            </button>
          )}
          <button
            onClick={() => handleForceComplete(item)}
            title="Administratively complete this shift. Use this when the shift cannot be resolved normally and needs to be marked complete for payroll."
            className="px-3 h-8 text-xs font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Force Complete
          </button>
          {item.check_in_time && (
            <button
              onClick={() => handleAdjustTimes(item)}
              title="Adjust the recorded check-in or check-out times. Use this to correct time tracking errors."
              className="w-8 h-8 inline-flex items-center justify-center text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ];


  // Load exchanges and open requests
  const loadExchanges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get pending approvals from the exchange service
      const approvals = await exchangeService.getPendingApprovals();

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
      // Sprint 3: Use shiftService with cookie authentication
      const data = await shiftService.getIncompleteShifts();
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
    if (activeTab === 'exchange-approvals') {
      await loadExchanges();
    } else if (activeTab === 'incomplete-shifts') {
      await loadIncompleteShifts();
    }
  }, [activeTab, loadExchanges, loadIncompleteShifts]);

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

    const checkoutTime = new Date().toISOString();
    setManualCheckoutTime(checkoutTime);

    // Auto-calculate initial hours if check-in time exists
    if (shift.check_in_time) {
      const hours = calculateHoursWorked(shift.check_in_time, checkoutTime);
      setManualHours(hours > 0 && hours <= 24 ? hours.toString() : '');
    } else {
      setManualHours('');
    }

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

  const handleAdjustTimes = useCallback(async (incompleteShift: IncompleteShift) => {
    try {
      // Fetch the full shift details
      const fullShift = await shiftService.getShiftById(incompleteShift.id);
      setSelectedShiftForAdjustment(fullShift as Shift);
      setShowAdjustTimeDialog(true);
    } catch (error) {
      console.error('Error fetching shift for adjustment:', error);
      setError('Failed to load shift details. Please try again.');
    }
  }, []);

  const handleAdjustmentSuccess = useCallback(() => {
    // Reload incomplete shifts after successful adjustment
    loadIncompleteShifts();
  }, [loadIncompleteShifts]);

  const processManualAction = useCallback(async () => {
    if (!selectedShiftForManual || !manualSignature.trim()) {
      return;
    }

    setIsProcessingManual(true);
    try {
      let endpoint = '';
      const requestData: Record<string, unknown> = {
        manager_signature: manualSignature,
        manager_notes: manualNotes,
      };

      switch (manualAction) {
        case 'checkin':
          endpoint = `/api/v1/shifts/${selectedShiftForManual.id}/manual_checkin/`;
          if (manualCheckinTime) {
            requestData.checkin_time = manualCheckinTime;
          }
          break;
        case 'checkout':
          endpoint = `/api/v1/shifts/${selectedShiftForManual.id}/manual_checkout/`;
          if (manualCheckoutTime) {
            requestData.checkout_time = manualCheckoutTime;
          }
          if (manualHours) {
            requestData.actual_hours = parseFloat(manualHours);
          }
          break;
        case 'force_complete':
          endpoint = `/api/v1/shifts/${selectedShiftForManual.id}/force_complete/`;
          requestData.actual_hours = parseFloat(manualHours);
          // Only send times if hours > 0 (not a no-show)
          if (parseFloat(manualHours) > 0) {
            if (manualCheckinTime) {
              requestData.checkin_time = manualCheckinTime;
            }
            if (manualCheckoutTime) {
              requestData.checkout_time = manualCheckoutTime;
            }
          }
          break;
      }

      // Use api instance which handles auth and base URL properly for both dev and production
      await api.post(endpoint, requestData);

      // Success - reload data and close dialog
      await loadIncompleteShifts();
      setShowManualDialog(false);
      setSelectedShiftForManual(null);
      setManualSignature('');
      setManualNotes('');
      setManualHours('');
      setManualCheckinTime('');
      setManualCheckoutTime('');
    } catch (error: unknown) {
      console.error('Failed to process manual action:', error);
      const axiosError = error as { response?: { data?: { detail?: string } }; message?: string };
      const errorMessage = axiosError?.response?.data?.detail || axiosError?.message || 'Unknown error';
      setError(`Failed to process manual action: ${errorMessage}`);
    } finally {
      setIsProcessingManual(false);
    }
  }, [selectedShiftForManual, manualSignature, manualNotes, manualHours, manualCheckinTime, manualCheckoutTime, manualAction, loadIncompleteShifts]);

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

  const tabs = [
    { key: 'exchange-approvals', label: 'Exchange Approvals' },
    { key: 'incomplete-shifts', label: 'Incomplete Shifts' },
  ];

  return (
    <div className="space-y-6">
      <Header variant="h1" description="Review and manage pending shift exchanges, open shift claims, and incomplete shifts.">
        Pending Approvals
      </Header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'px-4 py-2.5 text-sm font-medium text-red-600 border-b-2 border-red-600 whitespace-nowrap'
                  : 'px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent whitespace-nowrap'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Exchange Approvals Tab */}
      {activeTab === 'exchange-approvals' && (
        <div className="space-y-6">
          {/* Direct Exchange Requests */}
          <Container>
            <CloudscapeTable<ShiftExchange>
              items={filteredExchanges}
              columnDefinitions={exchangeColumns}
              trackBy="id"
              loading={isLoading}
              loadingText="Loading exchange requests..."
              header={
                <Header variant="h2" counter={`${filteredExchanges.length}`}>
                  Direct Exchange Requests
                </Header>
              }
              empty={
                <EmptyState
                  title="No exchange requests pending approval"
                  description="No staff have accepted exchange requests that need manager approval."
                />
              }
              variant="embedded"
              wrapLines
            />
          </Container>

          {/* Open Shift Claims */}
          <Container>
            <CloudscapeTable<OpenShiftRequest>
              items={filteredOpenRequests}
              columnDefinitions={openRequestColumns}
              trackBy="id"
              loading={false}
              header={
                <Header variant="h2" counter={`${filteredOpenRequests.length}`}>
                  Open Shift Claims
                </Header>
              }
              empty={
                <EmptyState
                  title="No open shift claims pending approval"
                  description="No staff have claimed open shifts that need manager approval."
                />
              }
              variant="embedded"
              wrapLines
            />
          </Container>
        </div>
      )}

      {/* Incomplete Shifts Tab */}
      {activeTab === 'incomplete-shifts' && (
        <Container>
          {filteredIncompleteShifts.length > 0 && !isLoading && (
            <Alert type="warning" header={`${filteredIncompleteShifts.length} shifts need manager attention`}>
              High priority items require immediate action. Click on actions to manually resolve.
            </Alert>
          )}

          <div className={filteredIncompleteShifts.length > 0 && !isLoading ? 'mt-4' : ''}>
            <CloudscapeTable<IncompleteShift>
              items={filteredIncompleteShifts}
              columnDefinitions={incompleteColumns}
              trackBy="id"
              loading={isLoading}
              loadingText="Loading incomplete shifts..."
              header={
                <Header variant="h2" counter={`${filteredIncompleteShifts.length}`}>
                  Incomplete Shifts
                </Header>
              }
              filter={
                <input
                  type="text"
                  placeholder="Search by staff name or venue"
                  value={incompleteSearchText}
                  onChange={(e) => setIncompleteSearchText(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              }
              empty={
                <EmptyState
                  title="All shifts are complete!"
                  description="No shifts require manager intervention at this time."
                />
              }
              variant="embedded"
              wrapLines
            />
          </div>
        </Container>
      )}

      {/* Manual Action Dialog */}
      {showManualDialog && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => !isProcessingManual && setShowManualDialog(false)}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {manualAction === 'checkin' ? 'Manual Check-in' :
                 manualAction === 'checkout' ? 'Manual Check-out' :
                 'Force Complete Shift'}
              </h2>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Context Card - Staff & Shift Info */}
              {selectedShiftForManual && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-gray-600 text-base flex-shrink-0">
                      {selectedShiftForManual.staff_details.first_name[0]}
                      {selectedShiftForManual.staff_details.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-[15px]">
                        {selectedShiftForManual.staff_details.first_name} {selectedShiftForManual.staff_details.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedShiftForManual.venue_details.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        Scheduled: {new Date(selectedShiftForManual.start_time).toLocaleString()} - {new Date(selectedShiftForManual.end_time).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Force Complete Warning */}
              {manualAction === 'force_complete' && (
                <Alert type="warning" header="Administrative Action">
                  This will mark the shift as complete and process it for payroll.
                  This action cannot be easily undone without creating a manual adjustment.
                </Alert>
              )}

              {/* What This Will Do Section */}
              <div className={`rounded-xl border p-4 ${
                manualAction === 'force_complete'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className={`w-4 h-4 ${manualAction === 'force_complete' ? 'text-amber-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-sm text-gray-800">What this will do:</span>
                </div>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-0.5">
                  {manualAction === 'checkin' && (
                    <>
                      <li>Record a manual check-in time for this staff member</li>
                      <li>Update shift status to "In Progress"</li>
                      <li>Your signature will be logged as the authorizing manager</li>
                    </>
                  )}
                  {manualAction === 'checkout' && (
                    <>
                      <li>Record a manual check-out time based on hours worked</li>
                      <li>Mark shift as "Completed" and ready for approval</li>
                      <li>Calculate payment based on the hours specified</li>
                      <li>Your signature will be logged as the authorizing manager</li>
                    </>
                  )}
                  {manualAction === 'force_complete' && (
                    <>
                      <li>Set both check-in and check-out times administratively</li>
                      <li>Mark shift as "Completed" immediately</li>
                      <li>Process hours for payroll calculation</li>
                      <li>Skip normal approval workflow</li>
                      <li>Create an audit record of this administrative action</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manager Signature <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualSignature}
                    onChange={(e) => setManualSignature(e.target.value)}
                    placeholder="Enter your full name as digital signature"
                    className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your name will be recorded as authorization for this action</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Manual Intervention
                  </label>
                  <textarea
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    placeholder="e.g., Network issues, Staff emergency, App malfunction"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Explain why this manual action is needed</p>
                </div>

                {manualAction === 'checkin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Actual Arrival Time
                    </label>
                    <input
                      type="datetime-local"
                      value={manualCheckinTime ? formatLocalDateTimeInputValue(manualCheckinTime) : ''}
                      onChange={(e) => setManualCheckinTime(datetimeLocalValueToIso(e.target.value))}
                      max={formatLocalDateTimeInputValue(new Date())}
                      className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Adjust if the staff member arrived at a different time than now</p>
                  </div>
                )}

                {(manualAction === 'checkout' || manualAction === 'force_complete') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actual Hours Worked {manualAction === 'force_complete' && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="number"
                        value={manualHours}
                        onChange={(e) => {
                          setManualHours(e.target.value);

                          // Auto-calculate checkout time if we have check-in time (checkout action only)
                          if (manualAction === 'checkout') {
                            const hours = parseFloat(e.target.value || '0');
                            if (hours > 0 && hours <= 24 && selectedShiftForManual?.check_in_time) {
                              const newCheckoutTime = calculateCheckoutTime(selectedShiftForManual.check_in_time, hours);
                              setManualCheckoutTime(newCheckoutTime);
                            }
                          }
                        }}
                        placeholder="8.5"
                        step="0.5"
                        min="0"
                        max="24"
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Hours to be used for payroll calculation</p>
                    </div>

                    {manualAction === 'checkout' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Actual Departure Time
                        </label>
                        <input
                          type="datetime-local"
                          value={manualCheckoutTime ? formatLocalDateTimeInputValue(manualCheckoutTime) : ''}
                          onChange={(e) => {
                            const newCheckoutTime = datetimeLocalValueToIso(e.target.value);
                            setManualCheckoutTime(newCheckoutTime);

                            // Auto-calculate hours if we have check-in time
                            if (newCheckoutTime && selectedShiftForManual?.check_in_time) {
                              const hours = calculateHoursWorked(selectedShiftForManual.check_in_time, newCheckoutTime);
                              if (hours > 0 && hours <= 24) {
                                setManualHours(hours.toString());
                              }
                            }
                          }}
                          max={formatLocalDateTimeInputValue(new Date())}
                          className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Adjust if the staff member departed at a different time than now</p>
                      </div>
                    )}
                  </>
                )}

                {manualAction === 'force_complete' && manualHours === '0' && (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No-show: Check-in/check-out times will not be recorded for 0 hours worked.
                  </div>
                )}

                {manualAction === 'force_complete' && parseFloat(manualHours || '0') > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Check-in Time
                      </label>
                      <input
                        type="datetime-local"
                        value={manualCheckinTime ? formatLocalDateTimeInputValue(manualCheckinTime) : ''}
                        onChange={(e) => setManualCheckinTime(datetimeLocalValueToIso(e.target.value))}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Administrative start time for this shift</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Check-out Time
                      </label>
                      <input
                        type="datetime-local"
                        value={manualCheckoutTime ? formatLocalDateTimeInputValue(manualCheckoutTime) : ''}
                        onChange={(e) => setManualCheckoutTime(datetimeLocalValueToIso(e.target.value))}
                        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Administrative end time for this shift</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                onClick={() => setShowManualDialog(false)}
                disabled={isProcessingManual}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processManualAction}
                disabled={
                  isProcessingManual ||
                  !manualSignature.trim() ||
                  (manualAction === 'force_complete' && !manualHours.trim())
                }
                className={`px-4 h-9 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  manualAction === 'force_complete'
                    ? 'text-white bg-red-600 hover:bg-red-700'
                    : 'text-white bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessingManual ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  manualAction === 'checkin' ? 'Record Check-in' :
                  manualAction === 'checkout' ? 'Record Check-out' :
                  'Force Complete Shift'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time Adjustment Dialog */}
      {selectedShiftForAdjustment && (
        <AdjustTimeDialog
          shift={selectedShiftForAdjustment}
          isOpen={showAdjustTimeDialog}
          onDismiss={() => {
            setShowAdjustTimeDialog(false);
            setSelectedShiftForAdjustment(null);
          }}
          onSuccess={handleAdjustmentSuccess}
        />
      )}
    </div>
  );
};

export default Approvals;
