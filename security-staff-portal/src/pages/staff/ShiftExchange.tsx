import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Dialog,
  DialogType,
  DetailsList,
  SelectionMode,
  IColumn,
  Toggle,
  Dropdown,
  IDropdownOption,
  TextField,
  CommandBar,
  type ICommandBarItemProps,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  Icon,
  mergeStyleSets,
  Persona,
  PersonaSize,
  Label
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { Card } from '../../components';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService } from '../../services';
import type { Shift, Venue } from '../../types';

// Define interfaces for the specific shift types used in this component
interface MyShift {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  venueName: string;
  venueId: number;
  status: string;
}

interface AvailableShift extends MyShift {
  staffName: string;
  staffId: number;
}

interface SwapRequest {
  id: number;
  requestedByName: string;
  requestedById: number;
  requestedShiftId: number;
  requestedShiftDate: Date;
  requestedShiftVenue: string;
  requestedShiftTime: string;
  offeredShiftId: number;
  offeredShiftDate: Date;
  offeredShiftVenue: string;
  offeredShiftTime: string;
  status: string;
}

// Mock data - replace with actual API calls
const mockMyShifts: MyShift[] = [
  {
    id: 1,
    date: new Date(2025, 3, 15),
    startTime: '20:00',
    endTime: '04:00',
    venueName: 'Downtown Club',
    venueId: 1,
    status: 'scheduled'
  },
  {
    id: 2,
    date: new Date(2025, 3, 18),
    startTime: '22:00',
    endTime: '06:00',
    venueName: 'Riverside Bar',
    venueId: 2,
    status: 'scheduled'
  },
  {
    id: 3,
    date: new Date(2025, 3, 20),
    startTime: '18:00',
    endTime: '02:00',
    venueName: 'Westside Security',
    venueId: 3,
    status: 'scheduled'
  }
];

const mockAvailableShifts: AvailableShift[] = [
  {
    id: 4,
    date: new Date(2025, 3, 16),
    startTime: '19:00',
    endTime: '03:00',
    venueName: 'Downtown Club',
    venueId: 1,
    staffName: 'Jane Smith',
    staffId: 2,
    status: 'available'
  },
  {
    id: 5,
    date: new Date(2025, 3, 17),
    startTime: '21:00',
    endTime: '05:00',
    venueName: 'Riverside Bar',
    venueId: 2,
    staffName: 'Mike Johnson',
    staffId: 3,
    status: 'available'
  }
];

const mockSwapRequests: SwapRequest[] = [
  {
    id: 1,
    requestedByName: 'Jane Smith',
    requestedById: 2,
    requestedShiftId: 4,
    requestedShiftDate: new Date(2025, 3, 16),
    requestedShiftVenue: 'Downtown Club',
    requestedShiftTime: '19:00 - 03:00',
    offeredShiftId: 1,
    offeredShiftDate: new Date(2025, 3, 15),
    offeredShiftVenue: 'Downtown Club',
    offeredShiftTime: '20:00 - 04:00',
    status: 'pending'
  },
  {
    id: 2,
    requestedByName: 'Admin User',
    requestedById: 1,
    requestedShiftId: 2,
    requestedShiftDate: new Date(2025, 3, 18),
    requestedShiftVenue: 'Riverside Bar',
    requestedShiftTime: '22:00 - 06:00',
    offeredShiftId: 5,
    offeredShiftDate: new Date(2025, 3, 17),
    offeredShiftVenue: 'Riverside Bar',
    offeredShiftTime: '21:00 - 05:00',
    status: 'approved'
  }
];

// Styles
const styles = mergeStyleSets({
  shiftCard: {
    padding: '12px',
    marginBottom: '10px',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    }
  },
  availableShift: {
    borderLeft: '4px solid #107C10'
  },
  pendingShift: {
    borderLeft: '4px solid #FFB900'
  },
  myShift: {
    borderLeft: '4px solid #0078D4'
  },
  swapRequest: {
    borderLeft: '4px solid #8661C5'
  },
  shiftDate: {
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '4px'
  },
  shiftTime: {
    fontSize: '14px',
    color: '#666'
  },
  shiftVenue: {
    fontSize: '14px',
    marginBottom: '4px'
  },
  shiftStatus: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '10px',
    display: 'inline-block',
    marginTop: '4px'
  },
  statusScheduled: {
    backgroundColor: '#e1efff',
    color: '#0078D4'
  },
  statusAvailable: {
    backgroundColor: '#e5f3e5',
    color: '#107C10'
  },
  statusPending: {
    backgroundColor: '#fff8e5',
    color: '#c19c00'
  },
  statusApproved: {
    backgroundColor: '#e5f3e5',
    color: '#107C10'
  },
  statusRejected: {
    backgroundColor: '#fde7e9',
    color: '#a80000'
  },
  divider: {
    borderTop: '1px solid #edebe9',
    margin: '8px 0'
  },
  swapDirection: {
    textAlign: 'center',
    margin: '8px 0',
    color: '#666'
  }
});

const ShiftExchange: React.FC = () => {
  const { authState } = useAuth();
  const [myShifts, setMyShifts] = useState<MyShift[]>(mockMyShifts);
  const [availableShifts, setAvailableShifts] = useState<AvailableShift[]>(mockAvailableShifts);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>(mockSwapRequests);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected shifts for offering/requesting
  const [selectedMyShift, setSelectedMyShift] = useState<MyShift | null>(null);
  const [selectedAvailableShift, setSelectedAvailableShift] = useState<AvailableShift | null>(null);

  // Dialog visibility states
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);

  // Load shifts on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Load all shift data
  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In real implementation, these would be API calls
      // const myShiftsResponse = await shiftService.getMyShifts();
      // const availableShiftsResponse = await shiftService.getAvailableShifts();
      // const swapRequestsResponse = await shiftService.getSwapRequests();

      // Using mock data for now
      setTimeout(() => {
        setMyShifts(mockMyShifts);
        setAvailableShifts(mockAvailableShifts);
        setSwapRequests(mockSwapRequests);
        setIsLoading(false);
      }, 800);
    } catch (err) {
      setError('Failed to load shifts. Please try again.');
      setIsLoading(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle offering a shift
  const handleOfferShift = (shift: MyShift) => {
    setSelectedMyShift(shift);
    setIsOfferDialogOpen(true);
  };

  // Handle requesting a shift swap
  const handleRequestSwap = (shift: AvailableShift) => {
    setSelectedAvailableShift(shift);
    setIsRequestDialogOpen(true);
  };

  // Submit a shift offer
  const submitShiftOffer = () => {
    // In real implementation, this would be an API call
    // await shiftService.offerShift(selectedMyShift.id);

    if (!selectedMyShift) return;

    // Mock implementation
    const updatedMyShifts = myShifts.map(shift => {
      if (shift.id === selectedMyShift.id) {
        return { ...shift, status: 'offered' };
      }
      return shift;
    });

    setMyShifts(updatedMyShifts);
    setIsOfferDialogOpen(false);
    setIsSuccessDialogOpen(true);
  };

  // Submit a shift swap request
  const submitSwapRequest = () => {
    // In real implementation, this would be an API call
    // await shiftService.requestSwap(selectedMyShift.id, selectedAvailableShift.id);

    if (!selectedMyShift || !selectedAvailableShift || !authState.user) return;

    // Mock implementation
    const newSwapRequest: SwapRequest = {
      id: swapRequests.length + 1,
      requestedByName: `${authState.user.firstName} ${authState.user.lastName}`,
      requestedById: authState.user.id || 0,
      requestedShiftId: selectedAvailableShift.id,
      requestedShiftDate: selectedAvailableShift.date,
      requestedShiftVenue: selectedAvailableShift.venueName,
      requestedShiftTime: `${selectedAvailableShift.startTime} - ${selectedAvailableShift.endTime}`,
      offeredShiftId: selectedMyShift.id,
      offeredShiftDate: selectedMyShift.date,
      offeredShiftVenue: selectedMyShift.venueName,
      offeredShiftTime: `${selectedMyShift.startTime} - ${selectedMyShift.endTime}`,
      status: 'pending'
    };

    setSwapRequests([...swapRequests, newSwapRequest]);
    setIsRequestDialogOpen(false);
    setIsSuccessDialogOpen(true);
  };

  // Accept a swap request
  const acceptSwapRequest = (requestId: number) => {
    // In real implementation, this would be an API call
    // await shiftService.acceptSwapRequest(requestId);

    // Mock implementation
    const updatedRequests = swapRequests.map(request => {
      if (request.id === requestId) {
        return { ...request, status: 'approved' };
      }
      return request;
    });

    setSwapRequests(updatedRequests);
  };

  // Reject a swap request
  const rejectSwapRequest = (requestId: number) => {
    // In real implementation, this would be an API call
    // await shiftService.rejectSwapRequest(requestId);

    // Mock implementation
    const updatedRequests = swapRequests.map(request => {
      if (request.id === requestId) {
        return { ...request, status: 'rejected' };
      }
      return request;
    });

    setSwapRequests(updatedRequests);
  };

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: () => {
        loadData();
        return true;
      }
    }
  ];

  // Render each of my shifts
  const renderMyShift = (shift: MyShift) => (
    <div
      key={shift.id}
      className={`${styles.shiftCard} ${styles.myShift}`}
      onClick={() => handleOfferShift(shift)}
    >
      <Stack horizontal horizontalAlign="space-between">
        <Stack>
          <Text className={styles.shiftDate}>{formatDate(shift.date)}</Text>
          <Text className={styles.shiftVenue}>{shift.venueName}</Text>
          <Text className={styles.shiftTime}>{shift.startTime} - {shift.endTime}</Text>
        </Stack>
        <Stack horizontalAlign="end">
          <span className={`${styles.shiftStatus} ${styles.statusScheduled}`}>
            {shift.status}
          </span>
          <DefaultButton
            text="Offer Shift"
            iconProps={{ iconName: 'Share' }}
            onClick={(e) => {
              e.stopPropagation();
              handleOfferShift(shift);
            }}
            styles={{ root: { marginTop: 8 } }}
          />
        </Stack>
      </Stack>
    </div>
  );

  // Render each available shift
  const renderAvailableShift = (shift: AvailableShift) => (
    <div
      key={shift.id}
      className={`${styles.shiftCard} ${styles.availableShift}`}
      onClick={() => selectedMyShift ? handleRequestSwap(shift) : null}
    >
      <Stack horizontal horizontalAlign="space-between">
        <Stack>
          <Text className={styles.shiftDate}>{formatDate(shift.date)}</Text>
          <Text className={styles.shiftVenue}>{shift.venueName}</Text>
          <Text className={styles.shiftTime}>{shift.startTime} - {shift.endTime}</Text>
          <Text>Posted by: {shift.staffName}</Text>
        </Stack>
        <Stack horizontalAlign="end">
          <span className={`${styles.shiftStatus} ${styles.statusAvailable}`}>
            available
          </span>
          <PrimaryButton
            text="Request Swap"
            iconProps={{ iconName: 'SwitcherStartEnd' }}
            onClick={(e) => {
              e.stopPropagation();
              if (selectedMyShift) {
                handleRequestSwap(shift);
              } else {
                alert('Please select one of your shifts first to request a swap.');
              }
            }}
            styles={{ root: { marginTop: 8 } }}
            disabled={!selectedMyShift}
          />
        </Stack>
      </Stack>
    </div>
  );

  // Render each swap request
  const renderSwapRequest = (request: SwapRequest) => (
    <div key={request.id} className={`${styles.shiftCard} ${styles.swapRequest}`}>
      <Stack tokens={{ childrenGap: 8 }}>
        <Text variant="mediumPlus" style={{ fontWeight: 600 }}>
          Swap Request {request.id} -
          <span style={{
            color:
              request.status === 'pending' ? '#c19c00' :
              request.status === 'approved' ? '#107C10' :
              '#a80000'
          }}>
            {' '}{request.status}
          </span>
        </Text>

        <Stack horizontal horizontalAlign="space-between">
          <Stack tokens={{ childrenGap: 4 }} style={{ width: '45%' }}>
            <Label>Requested shift:</Label>
            <Text className={styles.shiftDate}>{formatDate(request.requestedShiftDate)}</Text>
            <Text className={styles.shiftVenue}>{request.requestedShiftVenue}</Text>
            <Text className={styles.shiftTime}>{request.requestedShiftTime}</Text>
            <Text>Staff: {request.requestedByName}</Text>
          </Stack>

          <Stack horizontalAlign="center" verticalAlign="center" style={{ width: '10%' }}>
            <Icon iconName="SwapArrows" style={{ fontSize: 24 }} />
          </Stack>

          <Stack tokens={{ childrenGap: 4 }} style={{ width: '45%' }}>
            <Label>Offered shift:</Label>
            <Text className={styles.shiftDate}>{formatDate(request.offeredShiftDate)}</Text>
            <Text className={styles.shiftVenue}>{request.offeredShiftVenue}</Text>
            <Text className={styles.shiftTime}>{request.offeredShiftTime}</Text>
          </Stack>
        </Stack>

        {request.status === 'pending' && request.requestedById !== authState.user?.id && (
          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} style={{ marginTop: 8 }}>
            <DefaultButton
              text="Reject"
              iconProps={{ iconName: 'Cancel' }}
              onClick={() => rejectSwapRequest(request.id)}
            />
            <PrimaryButton
              text="Accept"
              iconProps={{ iconName: 'Accept' }}
              onClick={() => acceptSwapRequest(request.id)}
            />
          </Stack>
        )}
      </Stack>
    </div>
  );

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Shift Exchange</Text>
          <CommandBar items={commandBarItems} />
        </Stack>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <Spinner size={SpinnerSize.large} label="Loading shifts..." />
        ) : (
          <Pivot>
            <PivotItem headerText="My Shifts">
              <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: 16 }}>
                {/* Info card with instructions */}
                <Card>
                  <Text variant="mediumPlus">Select a shift you want to offer for exchange</Text>
                  <Text>Offering your shift will make it available for others to request.</Text>
                </Card>

                {/* Display list of my shifts */}
                {selectedMyShift && (
                  <div className={`${styles.shiftCard}`} style={{ backgroundColor: '#f0f8ff' }}>
                    <Stack horizontal horizontalAlign="space-between">
                      <Stack>
                        <Text variant="medium" style={{ fontWeight: 600 }}>Selected Shift:</Text>
                        <Text>{formatDate(selectedMyShift.date)} | {selectedMyShift.venueName} | {selectedMyShift.startTime} - {selectedMyShift.endTime}</Text>
                      </Stack>
                      <DefaultButton
                        text="Clear Selection"
                        onClick={() => setSelectedMyShift(null)}
                      />
                    </Stack>
                  </div>
                )}

                {myShifts.length > 0 ? (
                  myShifts.map(shift => renderMyShift(shift))
                ) : (
                  <Text>You don't have any upcoming shifts.</Text>
                )}
              </Stack>
            </PivotItem>

            <PivotItem headerText="Available Shifts">
              <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: 16 }}>
                {/* Info card with instructions */}
                <Card>
                  <Text variant="mediumPlus">Available shifts for swapping</Text>
                  <Text>First select one of your shifts from the 'My Shifts' tab, then request a swap with an available shift.</Text>
                </Card>

                {/* Display list of available shifts */}
                {selectedMyShift && (
                  <div className={`${styles.shiftCard}`} style={{ backgroundColor: '#f0f8ff' }}>
                    <Stack horizontal horizontalAlign="space-between">
                      <Stack>
                        <Text variant="medium" style={{ fontWeight: 600 }}>You're offering:</Text>
                        <Text>{formatDate(selectedMyShift.date)} | {selectedMyShift.venueName} | {selectedMyShift.startTime} - {selectedMyShift.endTime}</Text>
                      </Stack>
                      <DefaultButton
                        text="Clear Selection"
                        onClick={() => setSelectedMyShift(null)}
                      />
                    </Stack>
                  </div>
                )}

                {availableShifts.length > 0 ? (
                  availableShifts.map(shift => renderAvailableShift(shift))
                ) : (
                  <Text>There are no available shifts for swapping at the moment.</Text>
                )}
              </Stack>
            </PivotItem>

            <PivotItem headerText="Swap Requests">
              <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: 16 }}>
                {/* Info card with instructions */}
                <Card>
                  <Text variant="mediumPlus">Shift Swap Requests</Text>
                  <Text>View and manage your shift swap requests and respond to requests from others.</Text>
                </Card>

                {/* Display list of swap requests */}
                {swapRequests.length > 0 ? (
                  swapRequests.map(request => renderSwapRequest(request))
                ) : (
                  <Text>You don't have any swap requests at the moment.</Text>
                )}
              </Stack>
            </PivotItem>
          </Pivot>
        )}

        {/* Offer Shift Dialog */}
        <Dialog
          hidden={!isOfferDialogOpen}
          onDismiss={() => setIsOfferDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Offer Shift for Exchange',
            subText: 'This will make your shift available for others to request. Are you sure?'
          }}
        >
          {selectedMyShift && (
            <Stack tokens={{ childrenGap: 15 }}>
              <Text variant="medium">Shift details:</Text>
              <Text>{formatDate(selectedMyShift.date)}</Text>
              <Text>{selectedMyShift.venueName}</Text>
              <Text>{selectedMyShift.startTime} - {selectedMyShift.endTime}</Text>

              <TextField
                label="Comments (optional)"
                placeholder="Add any relevant information about this shift"
                multiline
                rows={3}
              />
            </Stack>
          )}

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsOfferDialogOpen(false)} />
            <PrimaryButton text="Offer Shift" onClick={submitShiftOffer} />
          </Stack>
        </Dialog>

        {/* Request Swap Dialog */}
        <Dialog
          hidden={!isRequestDialogOpen}
          onDismiss={() => setIsRequestDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Request Shift Swap',
            subText: 'You are requesting to swap your shift with another. This will need approval.'
          }}
          minWidth={600}
        >
          {selectedMyShift && selectedAvailableShift && (
            <Stack tokens={{ childrenGap: 15 }}>
              <Stack horizontal tokens={{ childrenGap: 20 }}>
                <Stack style={{ width: '45%' }}>
                  <Text variant="medium" style={{ fontWeight: 600 }}>Your shift:</Text>
                  <Text>{formatDate(selectedMyShift.date)}</Text>
                  <Text>{selectedMyShift.venueName}</Text>
                  <Text>{selectedMyShift.startTime} - {selectedMyShift.endTime}</Text>
                </Stack>

                <Stack horizontalAlign="center" verticalAlign="center" style={{ width: '10%' }}>
                  <Icon iconName="SwapArrows" style={{ fontSize: 24 }} />
                </Stack>

                <Stack style={{ width: '45%' }}>
                  <Text variant="medium" style={{ fontWeight: 600 }}>Requested shift:</Text>
                  <Text>{formatDate(selectedAvailableShift.date)}</Text>
                  <Text>{selectedAvailableShift.venueName}</Text>
                  <Text>{selectedAvailableShift.startTime} - {selectedAvailableShift.endTime}</Text>
                  <Text>Posted by: {selectedAvailableShift.staffName}</Text>
                </Stack>
              </Stack>

              <TextField
                label="Reason for swap (optional)"
                placeholder="Explain why you're requesting this swap"
                multiline
                rows={3}
              />
            </Stack>
          )}

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }} styles={{ root: { marginTop: 20 } }}>
            <DefaultButton text="Cancel" onClick={() => setIsRequestDialogOpen(false)} />
            <PrimaryButton text="Request Swap" onClick={submitSwapRequest} />
          </Stack>
        </Dialog>

        {/* Success Dialog */}
        <Dialog
          hidden={!isSuccessDialogOpen}
          onDismiss={() => setIsSuccessDialogOpen(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Success',
            subText: 'Your request has been submitted successfully.'
          }}
        >
          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 10 }}>
            <PrimaryButton text="OK" onClick={() => {
              setIsSuccessDialogOpen(false);
              setSelectedMyShift(null);
              setSelectedAvailableShift(null);
            }} />
          </Stack>
        </Dialog>
      </Stack>
    </MainLayout>
  );
};

export default ShiftExchange;
