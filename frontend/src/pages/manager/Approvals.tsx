import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  Stack,
  Text,
  StackItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Link,
  PrimaryButton,
  Dialog,
  DialogType,
  DialogFooter,
  TextField,
  DefaultButton,
  Pivot,
  PivotItem,
  SearchBox,
  TooltipHost,
  DirectionalHint,
  Icon,
  IconButton,
  DetailsRow,
  type IDetailsRowProps
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
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
  const PriorityPill: React.FC<{priority: 'low' | 'medium' | 'high' | 'critical'}> = ({ priority }) => {
    let backgroundColor = '';
    let color = 'white';

    switch(priority) {
      case 'critical':
        backgroundColor = '#7C2D12'; // Dark red/maroon
        break;
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
      minWidth: 120,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Text style={{
            color: item.requires_manual_resolution ? '#DC2626' : item.hours_overdue > 2 ? '#EF4444' : '#F59E0B',
            fontWeight: 'bold'
          }}>
            {item.requires_manual_resolution ? '24+' : item.hours_overdue.toFixed(1)}
          </Text>
          {item.requires_manual_resolution && (
            <span title={`Actual: ${item.hours_overdue_raw?.toFixed(1) || '24+'} hours - Requires manual resolution`}
                  style={{ color: '#DC2626', cursor: 'help' }}>
              ⚠️
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'urgency',
      name: 'Action Required',
      minWidth: 160,
      maxWidth: 180,
      isResizable: true,
      onRender: (item: IncompleteShift) => {
        const urgencyConfig = {
          critical: {
            text: 'Immediate action required',
            color: '#dc2626',
            bgColor: '#fef2f2',
            icon: 'WarningSolid'
          },
          high: {
            text: 'Action within 2 hours',
            color: '#ea580c',
            bgColor: '#fff7ed',
            icon: 'Warning'
          },
          medium: {
            text: 'Action within 4 hours',
            color: '#d97706',
            bgColor: '#fffbeb',
            icon: 'Clock'
          },
          low: {
            text: 'Action recommended',
            color: '#059669',
            bgColor: '#ecfdf5',
            icon: 'Info'
          }
        };

        const urgency = urgencyConfig[item.priority];

        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: urgency.bgColor,
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            <Icon iconName={urgency.icon} style={{ color: urgency.color, fontSize: 14 }} />
            <Text style={{ color: urgency.color, fontSize: 12, fontWeight: 500 }}>
              {urgency.text}
            </Text>
          </div>
        );
      },
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
      minWidth: 300,
      maxWidth: 350,
      isResizable: true,
      onRender: (item: IncompleteShift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
          {item.type === 'no_checkin' && (
            <TooltipHost
              content="Record a manual check-in time for this staff member. Use this when staff forgot to check in or had technical issues."
              directionalHint={DirectionalHint.topCenter}
            >
              <PrimaryButton
                text="Check In"
                iconProps={{ iconName: 'BoxCheckmarkSolid' }}
                onClick={() => handleManualCheckin(item)}
                styles={{
                  root: {
                    backgroundColor: '#059669',
                    borderColor: '#059669',
                    borderRadius: '6px',
                    height: '32px',
                    padding: '0 12px'
                  },
                  rootHovered: {
                    backgroundColor: '#047857',
                    borderColor: '#047857'
                  },
                  rootPressed: {
                    backgroundColor: '#065f46',
                    borderColor: '#065f46'
                  }
                }}
              />
            </TooltipHost>
          )}
          {item.type === 'no_checkout' && (
            <TooltipHost
              content="Record a manual check-out time for this staff member. Use this when staff forgot to check out or had technical issues."
              directionalHint={DirectionalHint.topCenter}
            >
              <PrimaryButton
                text="Check Out"
                iconProps={{ iconName: 'BoxCheckmarkSolid' }}
                onClick={() => handleManualCheckout(item)}
                styles={{
                  root: {
                    backgroundColor: '#0078d4',
                    borderColor: '#0078d4',
                    borderRadius: '6px',
                    height: '32px',
                    padding: '0 12px'
                  },
                  rootHovered: {
                    backgroundColor: '#106ebe',
                    borderColor: '#106ebe'
                  },
                  rootPressed: {
                    backgroundColor: '#005a9e',
                    borderColor: '#005a9e'
                  }
                }}
              />
            </TooltipHost>
          )}
          <TooltipHost
            content="Administratively complete this shift. Use this when the shift cannot be resolved normally and needs to be marked complete for payroll."
            directionalHint={DirectionalHint.topCenter}
          >
            <DefaultButton
              text="Force Complete"
              iconProps={{ iconName: 'CompletedSolid' }}
              onClick={() => handleForceComplete(item)}
              styles={{
                root: {
                  borderColor: '#dc2626',
                  color: '#dc2626',
                  borderRadius: '6px',
                  height: '32px',
                  padding: '0 12px'
                },
                rootHovered: {
                  borderColor: '#b91c1c',
                  color: '#b91c1c',
                  backgroundColor: '#fef2f2'
                },
                rootPressed: {
                  borderColor: '#991b1b',
                  color: '#991b1b',
                  backgroundColor: '#fee2e2'
                }
              }}
            />
          </TooltipHost>
          {item.check_in_time && (
            <TooltipHost
              content="Adjust the recorded check-in or check-out times. Use this to correct time tracking errors."
              directionalHint={DirectionalHint.topCenter}
            >
              <IconButton
                iconProps={{ iconName: 'Clock' }}
                title="Adjust Times"
                onClick={() => handleAdjustTimes(item)}
                styles={{
                  root: {
                    backgroundColor: '#eff6ff',
                    borderRadius: '6px',
                    height: '32px',
                    width: '32px'
                  },
                  rootHovered: {
                    backgroundColor: '#dbeafe'
                  },
                  icon: {
                    color: '#0078d4',
                    fontSize: 16
                  }
                }}
              />
            </TooltipHost>
          )}
        </Stack>
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

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Text variant="xxLarge" style={{ color: '#B91C1C' }}>Pending Approvals</Text>
        
        <Pivot
          selectedKey={activeTab}
          onLinkClick={(item) => setActiveTab(item?.props.itemKey || 'exchange-approvals')}
          headersOnly={false}
        >
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
                  <Text variant="large">No exchange requests pending approval</Text><br />
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
                  <Text variant="large">No open shift claims pending approval</Text><br />
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
                  <Text variant="large" style={{ color: '#10B981' }}>All shifts are complete!</Text><br />
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
                    onRenderRow={(props?: IDetailsRowProps) => {
                      if (!props) return null;
                      const item = props.item as IncompleteShift;
                      const isCritical = item.priority === 'critical';
                      const isHigh = item.priority === 'high';

                      const rowStyles = {
                        root: {
                          backgroundColor: isCritical
                            ? '#fef2f2'
                            : isHigh
                            ? '#fff7ed'
                            : undefined,
                          borderLeft: isCritical
                            ? '4px solid #dc2626'
                            : isHigh
                            ? '4px solid #f59e0b'
                            : undefined,
                          transition: 'all 0.2s ease',
                          selectors: {
                            '&:hover': {
                              backgroundColor: isCritical
                                ? '#fee2e2'
                                : isHigh
                                ? '#ffedd5'
                                : '#f9fafb'
                            }
                          }
                        }
                      };

                      return <DetailsRow {...props} styles={rowStyles} />;
                    }}
                  />
                </div>
              )}
            </Stack>
          </PivotItem>
        </Pivot>
      </Stack>

      {/* Manual Action Dialog */}
      <Dialog
        hidden={!showManualDialog}
        dialogContentProps={{
          type: DialogType.largeHeader,
          title: `${
            manualAction === 'checkin' ? 'Manual Check-in' :
            manualAction === 'checkout' ? 'Manual Check-out' :
            'Force Complete Shift'
          }`
        }}
        onDismiss={() => setShowManualDialog(false)}
        minWidth={560}
        maxWidth={600}
      >
        <Stack tokens={{ childrenGap: 16 }}>
          {/* Context Card - Staff & Shift Info */}
          {selectedShiftForManual && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px'
              }}
            >
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    color: '#475569',
                    fontSize: 16
                  }}
                >
                  {selectedShiftForManual.staff_details.first_name[0]}
                  {selectedShiftForManual.staff_details.last_name[0]}
                </div>
                <Stack tokens={{ childrenGap: 4 }}>
                  <Text style={{ fontWeight: 600, fontSize: 15 }}>
                    {selectedShiftForManual.staff_details.first_name} {selectedShiftForManual.staff_details.last_name}
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>
                    {selectedShiftForManual.venue_details.name}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                    Scheduled: {new Date(selectedShiftForManual.start_time).toLocaleString()} - {new Date(selectedShiftForManual.end_time).toLocaleTimeString()}
                  </Text>
                </Stack>
              </Stack>
            </div>
          )}

          {/* Force Complete Warning */}
          {manualAction === 'force_complete' && (
            <MessageBar
              messageBarType={MessageBarType.warning}
              styles={{
                root: { borderRadius: '6px' }
              }}
            >
              <Stack tokens={{ childrenGap: 4 }}>
                <Text style={{ fontWeight: 600 }}>Administrative Action</Text>
                <Text style={{ fontSize: 13 }}>
                  This will mark the shift as complete and process it for payroll.
                  This action cannot be easily undone without creating a manual adjustment.
                </Text>
              </Stack>
            </MessageBar>
          )}

          {/* What This Will Do Section */}
          <div
            style={{
              backgroundColor: manualAction === 'force_complete' ? '#fef3c7' : '#eff6ff',
              border: `1px solid ${manualAction === 'force_complete' ? '#fcd34d' : '#bfdbfe'}`,
              borderRadius: '8px',
              padding: '12px 16px'
            }}
          >
            <Stack tokens={{ childrenGap: 8 }}>
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                <Icon
                  iconName="Info"
                  style={{
                    color: manualAction === 'force_complete' ? '#d97706' : '#3b82f6',
                    fontSize: 14
                  }}
                />
                <Text style={{ fontWeight: 600, fontSize: 13 }}>What this will do:</Text>
              </Stack>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#334155' }}>
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
            </Stack>
          </div>

          {/* Form Fields */}
          <Stack tokens={{ childrenGap: 12 }}>
            <TextField
              label="Manager Signature"
              value={manualSignature}
              onChange={(_, newValue) => setManualSignature(newValue || '')}
              placeholder="Enter your full name as digital signature"
              required
              description="Your name will be recorded as authorization for this action"
            />

            <TextField
              label="Reason for Manual Intervention"
              value={manualNotes}
              onChange={(_, newValue) => setManualNotes(newValue || '')}
              placeholder="e.g., Network issues, Staff emergency, App malfunction"
              multiline
              rows={2}
              description="Explain why this manual action is needed"
            />

            {manualAction === 'checkin' && (
              <TextField
                label="Check-in Time"
                type="datetime-local"
                value={manualCheckinTime ? new Date(manualCheckinTime).toISOString().slice(0, 16) : ''}
                onChange={(_, newValue) => setManualCheckinTime(newValue ? new Date(newValue).toISOString() : '')}
                description="When did the staff member actually start work?"
              />
            )}

            {(manualAction === 'checkout' || manualAction === 'force_complete') && (
              <>
                <TextField
                  label="Actual Hours Worked"
                  type="number"
                  value={manualHours}
                  onChange={(_, newValue) => {
                    setManualHours(newValue || '');

                    // Auto-calculate checkout time if we have check-in time (checkout action only)
                    if (manualAction === 'checkout') {
                      const hours = parseFloat(newValue || '0');
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
                  required={manualAction === 'force_complete'}
                  description="Hours to be used for payroll calculation"
                />

                {manualAction === 'checkout' && (
                  <TextField
                    label="Check-out Time"
                    type="datetime-local"
                    value={manualCheckoutTime ? new Date(manualCheckoutTime).toISOString().slice(0, 16) : ''}
                    onChange={(_, newValue) => {
                      const newCheckoutTime = newValue ? new Date(newValue).toISOString() : '';
                      setManualCheckoutTime(newCheckoutTime);

                      // Auto-calculate hours if we have check-in time
                      if (newCheckoutTime && selectedShiftForManual?.check_in_time) {
                        const hours = calculateHoursWorked(selectedShiftForManual.check_in_time, newCheckoutTime);
                        if (hours > 0 && hours <= 24) {
                          setManualHours(hours.toString());
                        }
                      }
                    }}
                    description="When did the staff member finish work?"
                  />
                )}
              </>
            )}

            {manualAction === 'force_complete' && manualHours === '0' && (
              <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                ⚠️ No-show: Check-in/check-out times will not be recorded for 0 hours worked.
              </div>
            )}

            {manualAction === 'force_complete' && parseFloat(manualHours || '0') > 0 && (
              <>
                <TextField
                  label="Check-in Time"
                  type="datetime-local"
                  value={manualCheckinTime ? new Date(manualCheckinTime).toISOString().slice(0, 16) : ''}
                  onChange={(_, newValue) => setManualCheckinTime(newValue ? new Date(newValue).toISOString() : '')}
                  description="Administrative start time for this shift"
                />

                <TextField
                  label="Check-out Time"
                  type="datetime-local"
                  value={manualCheckoutTime ? new Date(manualCheckoutTime).toISOString().slice(0, 16) : ''}
                  onChange={(_, newValue) => setManualCheckoutTime(newValue ? new Date(newValue).toISOString() : '')}
                  description="Administrative end time for this shift"
                />
              </>
            )}
          </Stack>
        </Stack>

        <DialogFooter>
          <PrimaryButton
            text={
              manualAction === 'checkin' ? 'Record Check-in' :
              manualAction === 'checkout' ? 'Record Check-out' :
              'Force Complete Shift'
            }
            iconProps={{
              iconName: manualAction === 'force_complete' ? 'Warning' : 'CheckMark'
            }}
            onClick={processManualAction}
            disabled={
              isProcessingManual ||
              !manualSignature.trim() ||
              (manualAction === 'force_complete' && !manualHours.trim())
            }
            styles={manualAction === 'force_complete' ? {
              root: {
                backgroundColor: '#dc2626',
                borderColor: '#dc2626'
              },
              rootHovered: {
                backgroundColor: '#b91c1c',
                borderColor: '#b91c1c'
              },
              rootPressed: {
                backgroundColor: '#991b1b',
                borderColor: '#991b1b'
              }
            } : undefined}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowManualDialog(false)}
            disabled={isProcessingManual}
          />
        </DialogFooter>
      </Dialog>

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
    </MainLayout>
  );
};

export default Approvals;
