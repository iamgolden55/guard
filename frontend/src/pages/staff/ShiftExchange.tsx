import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  DetailsList,
  SelectionMode,
  IColumn,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  Icon,
  Dialog,
  DialogType,
  DialogFooter,
  TextField,
  Dropdown,
  IDropdownOption,
  Link,
  PersonaSize,
  Persona
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, exchangeService } from '../../services';
import type { Shift, StaffProfile } from '../../types';
import type { ShiftExchange, OpenShiftRequest } from '../../services/exchangeService';

const ShiftExchangePage: React.FC = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('my-shifts');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data states
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [availableShifts, setAvailableShifts] = useState<OpenShiftRequest[]>([]);
  const [directExchanges, setDirectExchanges] = useState<ShiftExchange[]>([]);
  const [myRequests, setMyRequests] = useState<OpenShiftRequest[]>([]);

  // Dialog states
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showExchangeDialog, setShowExchangeDialog] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [exchangeReason, setExchangeReason] = useState('');
  const [eligibleStaff, setEligibleStaff] = useState<StaffProfile[]>([]);
  const [selectedTargetStaff, setSelectedTargetStaff] = useState<number | null>(null);

  // Load data on component mount and tab change
  useEffect(() => {
    loadData();
  }, [selectedTab]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (selectedTab === 'my-shifts') {
        const shifts = await shiftService.getMyShifts();
        const filteredShifts = shifts.filter(s => ['scheduled', 'active'].includes(s.status));
        setMyShifts(filteredShifts);
      } else if (selectedTab === 'available-shifts') {
        const available = await exchangeService.getAvailableShifts();
        setAvailableShifts(Array.isArray(available) ? available : []);
      } else if (selectedTab === 'direct-exchanges') {
        const exchanges = await exchangeService.getMyExchanges();
        setDirectExchanges(Array.isArray(exchanges) ? exchanges : []);
      } else if (selectedTab === 'my-requests') {
        const requests = await exchangeService.getMyOpenShiftRequests();
        setMyRequests(Array.isArray(requests) ? requests : []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // My Shifts tab columns
  const myShiftsColumns: IColumn[] = [
    {
      key: 'venue',
      name: 'Venue',
      fieldName: 'venue',
      minWidth: 120,
      onRender: (item: Shift) => <Text>{item?.venue?.name || 'No venue'}</Text>
    },
    {
      key: 'date',
      name: 'Date',
      fieldName: 'startTime',
      minWidth: 100,
      onRender: (item: Shift) => <Text>{item?.startTime ? new Date(item.startTime).toLocaleDateString() : 'No date'}</Text>
    },
    {
      key: 'time',
      name: 'Time',
      fieldName: 'startTime',
      minWidth: 120,
      onRender: (item: Shift) => (
        <Text>
          {item?.startTime ? new Date(item.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'No time'}
          {item?.endTime && ` - ${new Date(item.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
        </Text>
      )
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 80,
      onRender: (item: Shift) => (
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: item?.status === 'scheduled' ? '#10B981' : '#F59E0B',
          color: 'white',
          fontSize: '12px',
          textTransform: 'capitalize'
        }}>
          {item?.status || 'unknown'}
        </span>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 200,
      onRender: (item: Shift) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton
            text="Release"
            onClick={() => handleReleaseShift(item)}
            styles={{ root: { backgroundColor: '#B91C1C', color: 'white', border: 'none' } }}
          />
          <DefaultButton
            text="Exchange"
            onClick={() => handleExchangeShift(item)}
            styles={{ root: { backgroundColor: '#f8f9fa', color: '#B91C1C', border: '1px solid #dee2e6' } }}
          />
        </Stack>
      )
    }
  ];

  // Available Shifts tab columns
  const availableShiftsColumns: IColumn[] = [
    {
      key: 'venue',
      name: 'Venue',
      fieldName: 'venue',
      minWidth: 120,
      onRender: (item: OpenShiftRequest) => <Text>{item.original_shift_details.venue.name}</Text>
    },
    {
      key: 'date',
      name: 'Date',
      fieldName: 'date',
      minWidth: 100,
      onRender: (item: OpenShiftRequest) => <Text>{new Date(item.original_shift_details.start_time).toLocaleDateString()}</Text>
    },
    {
      key: 'time',
      name: 'Time',
      fieldName: 'time',
      minWidth: 120,
      onRender: (item: OpenShiftRequest) => (
        <Text>
          {new Date(item.original_shift_details.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {item.original_shift_details.end_time && ` - ${new Date(item.original_shift_details.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
        </Text>
      )
    },
    {
      key: 'released_by',
      name: 'Released By',
      minWidth: 120,
      onRender: (item: OpenShiftRequest) => (
        <Text>{`${item.requesting_user_details.first_name} ${item.requesting_user_details.last_name}`}</Text>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 100,
      onRender: (item: OpenShiftRequest) => (
        <DefaultButton
          text="Claim"
          onClick={() => handleClaimShift(item.id)}
          styles={{ root: { backgroundColor: '#B91C1C', color: 'white', border: 'none' } }}
          disabled={item.status !== 'open'}
        />
      )
    }
  ];

  // Direct Exchanges tab columns
  const exchangesColumns: IColumn[] = [
    {
      key: 'type',
      name: 'Type',
      minWidth: 80,
      onRender: (item: ShiftExchange) => (
        <Icon 
          iconName={item.requesting_user === user?.id ? 'Send' : 'Receive'} 
          style={{ color: item.requesting_user === user?.id ? '#B91C1C' : '#10B981' }}
        />
      )
    },
    {
      key: 'other_user',
      name: 'With',
      minWidth: 120,
      onRender: (item: ShiftExchange) => {
        const otherUser = item.requesting_user === user?.id ? item.target_user_details : item.requesting_user_details;
        return <Text>{`${otherUser.first_name} ${otherUser.last_name}`}</Text>;
      }
    },
    {
      key: 'shift',
      name: 'Shift',
      minWidth: 150,
      onRender: (item: ShiftExchange) => (
        <Stack>
          <Text>{item.original_shift_details.venue.name}</Text>
          <Text variant="small">{new Date(item.original_shift_details.start_time).toLocaleDateString()}</Text>
        </Stack>
      )
    },
    {
      key: 'status',
      name: 'Status',
      minWidth: 100,
      onRender: (item: ShiftExchange) => (
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: getStatusColor(item.status),
          color: 'white',
          fontSize: '12px',
          textTransform: 'capitalize'
        }}>
          {item.status.replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      onRender: (item: ShiftExchange) => renderExchangeActions(item)
    }
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'accepted_by_target': return '#3B82F6';
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'cancelled': return '#9CA3AF';
      default: return '#9CA3AF';
    }
  };

  const renderExchangeActions = (item: ShiftExchange) => {
    // Get current user ID - try multiple possible sources
    const currentUserId = user?.id || user?.user_id || parseInt(localStorage.getItem('user')?.match(/"id":(\d+)/)?.[1] || '0');
    
    console.log('renderExchangeActions - item:', item);
    console.log('renderExchangeActions - user object:', user);
    console.log('renderExchangeActions - currentUserId:', currentUserId);
    console.log('renderExchangeActions - item.requesting_user:', item.requesting_user);
    console.log('renderExchangeActions - item.target_user:', item.target_user);
    
    const isRequestingUser = item.requesting_user === currentUserId;
    const isTargetUser = item.target_user === currentUserId;
    
    console.log('renderExchangeActions - isRequestingUser:', isRequestingUser);
    console.log('renderExchangeActions - isTargetUser:', isTargetUser);

    if (item.status === 'pending' && isTargetUser) {
      return (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton
            text="Accept"
            onClick={() => handleAcceptExchange(item.id)}
            styles={{ root: { backgroundColor: '#10B981', color: 'white', border: 'none' } }}
          />
          <DefaultButton
            text="Decline"
            onClick={() => handleDeclineExchange(item.id)}
            styles={{ root: { backgroundColor: '#EF4444', color: 'white', border: 'none' } }}
          />
        </Stack>
      );
    }

    if (['pending', 'accepted_by_target'].includes(item.status) && (isRequestingUser || isTargetUser)) {
      return (
        <DefaultButton
          text="Cancel"
          onClick={() => handleCancelExchange(item.id)}
          styles={{ root: { backgroundColor: '#9CA3AF', color: 'white', border: 'none' } }}
        />
      );
    }

    return <Text variant="small">No actions</Text>;
  };

  // Event handlers
  const handleReleaseShift = (shift: Shift) => {
    setSelectedShift(shift);
    setReleaseReason('');
    setShowReleaseDialog(true);
  };

  const handleExchangeShift = async (shift: Shift) => {
    setSelectedShift(shift);
    setExchangeReason('');
    setSelectedTargetStaff(null);
    
    try {
      const staff = await shiftService.getEligibleStaffForExchange(shift.id);
      setEligibleStaff(staff);
      setShowExchangeDialog(true);
    } catch (err: any) {
      setError('Failed to load eligible staff');
    }
  };

  const handleConfirmRelease = async () => {
    if (!selectedShift || !releaseReason.trim()) return;

    try {
      setIsLoading(true);
      await exchangeService.releaseShift({
        shift_id: selectedShift.id,
        request_reason: releaseReason
      });
      setSuccess('Shift released successfully');
      setShowReleaseDialog(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to release shift');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmExchange = async () => {
    if (!selectedShift || !selectedTargetStaff || !exchangeReason.trim()) return;

    const exchangeData = {
      original_shift: selectedShift.id,
      target_user: selectedTargetStaff,
      request_reason: exchangeReason
    };

    console.log('Creating exchange with data:', exchangeData);
    console.log('Selected shift:', selectedShift);
    console.log('Selected target staff ID:', selectedTargetStaff);

    try {
      setIsLoading(true);
      await exchangeService.createExchange(exchangeData);
      setSuccess('Exchange request sent successfully');
      setShowExchangeDialog(false);
      loadData();
    } catch (err: any) {
      console.error('Exchange creation error:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      
      // Log specific field validation errors
      if (err.response?.data) {
        Object.keys(err.response.data).forEach(field => {
          console.error(`${field} validation errors:`, err.response.data[field]);
        });
      }
      
      let errorMessage = 'Failed to create exchange request';
      if (err.response?.data) {
        // Handle Django validation errors
        if (err.response.data.non_field_errors) {
          errorMessage = err.response.data.non_field_errors[0];
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else {
          // Extract the first validation error message
          const firstError = Object.values(err.response.data)[0];
          if (Array.isArray(firstError) && firstError.length > 0) {
            errorMessage = firstError[0];
          } else {
            errorMessage = JSON.stringify(err.response.data);
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimShift = async (requestId: number) => {
    try {
      setIsLoading(true);
      await exchangeService.claimShift(requestId);
      setSuccess('Shift claimed successfully');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to claim shift');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptExchange = async (exchangeId: number) => {
    try {
      setIsLoading(true);
      await exchangeService.acceptExchange(exchangeId);
      setSuccess('Exchange request accepted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to accept exchange');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineExchange = async (exchangeId: number) => {
    try {
      setIsLoading(true);
      await exchangeService.cancelExchange(exchangeId);
      setSuccess('Exchange request declined');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to decline exchange');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelExchange = async (exchangeId: number) => {
    try {
      setIsLoading(true);
      await exchangeService.cancelExchange(exchangeId);
      setSuccess('Exchange request cancelled');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel exchange');
    } finally {
      setIsLoading(false);
    }
  };

  const staffDropdownOptions: IDropdownOption[] = eligibleStaff.map((staff, index) => ({
    key: staff.userId || staff.id || index,  // Use userId for the exchange request
    text: `${staff.firstName || 'Unknown'} ${staff.lastName || 'User'}`,
    data: staff
  }));

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Text variant="xxLarge" style={{ color: '#B91C1C' }}>Shift Exchange</Text>
        
        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageBar>
        )}

        {success && (
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline={false}
            onDismiss={() => setSuccess(null)}
          >
            {success}
          </MessageBar>
        )}

        
        <Pivot
          selectedKey={selectedTab}
          onLinkClick={(item) => setSelectedTab(item?.props.itemKey || 'my-shifts')}
          headersOnly={false}
          getTabId={(itemKey) => itemKey}
        >
          <PivotItem headerText="My Shifts" itemKey="my-shifts">
            <div className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={SpinnerSize.large} label="Loading shifts..." />
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <Text>Release shifts to the open pool or request exchanges with other staff members.</Text>
                  </div>
                  <div className="hidden md:block">
                    <DetailsList
                      items={myShifts}
                      columns={myShiftsColumns}
                      selectionMode={SelectionMode.none}
                      compact={true}
                    />
                  </div>
                  
                  {/* Mobile view */}
                  <div className="block md:hidden">
                    <Stack tokens={{ childrenGap: 12 }}>
                      {myShifts.map((shift, index) => (
                            <div key={shift.id || index} style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #dee2e6',
                              borderRadius: '8px',
                              padding: '16px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                              <Stack tokens={{ childrenGap: 8 }}>
                                <Stack horizontal horizontalAlign="space-between">
                                  <Text variant="medium" style={{ fontWeight: '600' }}>
                                    {shift?.venue?.name || 'No venue name'}
                                  </Text>
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: shift.status === 'scheduled' ? '#10B981' : '#F59E0B',
                                    color: 'white',
                                    fontSize: '12px',
                                    textTransform: 'capitalize'
                                  }}>
                                    {shift.status}
                                  </span>
                                </Stack>
                                <Text>
                                  {shift?.startTime ? new Date(shift.startTime).toLocaleDateString() : 'No date'}
                                </Text>
                                <Text>
                                  {shift?.startTime ? new Date(shift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'No time'}
                                  {shift?.endTime && ` - ${new Date(shift.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                                </Text>
                                <Stack horizontal tokens={{ childrenGap: 12 }} style={{ marginTop: '12px' }}>
                                  <DefaultButton
                                    text="Release"
                                    onClick={() => handleReleaseShift(shift)}
                                    styles={{ root: { flex: 1, backgroundColor: '#B91C1C', color: 'white', border: 'none' } }}
                                  />
                                  <DefaultButton
                                    text="Exchange"
                                    onClick={() => handleExchangeShift(shift)}
                                    styles={{ root: { flex: 1, backgroundColor: '#f8f9fa', color: '#B91C1C', border: '1px solid #dee2e6' } }}
                                  />
                                </Stack>
                              </Stack>
                              </div>
                      ))}
                    </Stack>
                  </div>
                </div>
              )}
            </div>
          </PivotItem>

          <PivotItem headerText="Available Shifts" itemKey="available-shifts">
            <div className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={SpinnerSize.large} label="Loading available shifts..." />
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <Text>Claim shifts that other staff members have released.</Text>
                  </div>
                  <div className="hidden md:block">
                    <DetailsList
                      items={availableShifts}
                      columns={availableShiftsColumns}
                      selectionMode={SelectionMode.none}
                      compact={true}
                    />
                  </div>
                  
                  {/* Mobile view */}
                  <div className="block md:hidden">
                    <Stack tokens={{ childrenGap: 12 }}>
                      {availableShifts.map((request) => (
                        <div key={request.id} style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #dee2e6',
                          borderRadius: '8px',
                          padding: '16px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                          <Stack tokens={{ childrenGap: 8 }}>
                            <Stack horizontal horizontalAlign="space-between">
                              <Text variant="medium" style={{ fontWeight: '600' }}>{request.original_shift_details.venue.name}</Text>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                backgroundColor: request.status === 'open' ? '#10B981' : '#9CA3AF',
                                color: 'white',
                                fontSize: '12px',
                                textTransform: 'capitalize'
                              }}>
                                {request.status}
                              </span>
                            </Stack>
                            <Text>Released by: {`${request.requesting_user_details.first_name} ${request.requesting_user_details.last_name}`}</Text>
                            <Text>{new Date(request.original_shift_details.start_time).toLocaleDateString()}</Text>
                            <Text>
                              {new Date(request.original_shift_details.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {request.original_shift_details.end_time && ` - ${new Date(request.original_shift_details.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                            </Text>
                            <DefaultButton
                              text="Claim Shift"
                              onClick={() => handleClaimShift(request.id)}
                              disabled={request.status !== 'open'}
                              styles={{ root: { backgroundColor: '#B91C1C', color: 'white', border: 'none', marginTop: '12px' } }}
                            />
                          </Stack>
                        </div>
                      ))}
                    </Stack>
                  </div>
                </div>
              )}
            </div>
          </PivotItem>

          <PivotItem headerText="Direct Exchanges" itemKey="direct-exchanges">
            <div className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={SpinnerSize.large} label="Loading exchanges..." />
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <Text>Direct shift exchanges with specific staff members.</Text>
                  </div>
                  <div className="hidden md:block">
                    <DetailsList
                      items={directExchanges}
                      columns={exchangesColumns}
                      selectionMode={SelectionMode.none}
                      compact={true}
                    />
                  </div>
                  
                  {/* Mobile view */}
                  <div className="block md:hidden">
                    <Stack tokens={{ childrenGap: 12 }}>
                      {directExchanges.map((exchange) => {
                        const otherUser = exchange.requesting_user === user?.id ? exchange.target_user_details : exchange.requesting_user_details;
                        const isRequestingUser = exchange.requesting_user === user?.id;
                        
                        return (
                          <div key={exchange.id} style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <Stack tokens={{ childrenGap: 8 }}>
                              <Stack horizontal horizontalAlign="space-between">
                                <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                                  <Icon 
                                    iconName={isRequestingUser ? 'Send' : 'Receive'} 
                                    style={{ color: isRequestingUser ? '#B91C1C' : '#10B981' }}
                                  />
                                  <Text variant="medium" style={{ fontWeight: '600' }}>
                                    {isRequestingUser ? 'To' : 'From'} {`${otherUser.first_name} ${otherUser.last_name}`}
                                  </Text>
                                </Stack>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: getStatusColor(exchange.status),
                                  color: 'white',
                                  fontSize: '12px',
                                  textTransform: 'capitalize'
                                }}>
                                  {exchange.status.replace('_', ' ')}
                                </span>
                              </Stack>
                              <Text>{exchange.original_shift_details.venue.name}</Text>
                              <Text>{new Date(exchange.original_shift_details.start_time).toLocaleDateString()}</Text>
                              <Text>Reason: {exchange.request_reason}</Text>
                              {renderExchangeActions(exchange)}
                            </Stack>
                          </div>
                        );
                      })}
                    </Stack>
                  </div>
                </div>
              )}
            </div>
          </PivotItem>

          <PivotItem headerText="My Requests" itemKey="my-requests">
            <div className="mt-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size={SpinnerSize.large} label="Loading requests..." />
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <Text>Track your shift release requests and claims.</Text>
                  </div>
                  <Stack tokens={{ childrenGap: 12 }}>
                    {myRequests.map((request) => (
                      <div key={request.id} style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        padding: '16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}>
                        <Stack tokens={{ childrenGap: 8 }}>
                          <Stack horizontal horizontalAlign="space-between">
                            <Text variant="medium" style={{ fontWeight: '600' }}>{request.original_shift_details.venue.name}</Text>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: getStatusColor(request.status),
                              color: 'white',
                              fontSize: '12px',
                              textTransform: 'capitalize'
                            }}>
                              {request.status}
                            </span>
                          </Stack>
                          <Text>{new Date(request.original_shift_details.start_time).toLocaleDateString()}</Text>
                          <Text>Reason: {request.request_reason}</Text>
                          {request.claimed_by_details && (
                            <Text>Claimed by: {`${request.claimed_by_details.first_name} ${request.claimed_by_details.last_name}`}</Text>
                          )}
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                </div>
              )}
            </div>
          </PivotItem>
        </Pivot>

        {/* Release Shift Dialog */}
        <Dialog
          hidden={!showReleaseDialog}
          onDismiss={() => setShowReleaseDialog(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Release Shift to Pool',
            subText: 'This will make your shift available for other staff members to claim.'
          }}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            {selectedShift && (
              <Stack tokens={{ childrenGap: 8 }}>
                <Text><strong>Venue:</strong> {selectedShift.venue?.name}</Text>
                <Text><strong>Date:</strong> {new Date(selectedShift.startTime).toLocaleDateString()}</Text>
                <Text><strong>Time:</strong> {new Date(selectedShift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
              </Stack>
            )}
            <TextField
              label="Reason for releasing shift"
              multiline
              rows={3}
              value={releaseReason}
              onChange={(_, value) => setReleaseReason(value || '')}
              placeholder="Please provide a reason for releasing this shift..."
              required
            />
          </Stack>
          <DialogFooter>
            <PrimaryButton
              text="Release Shift"
              onClick={handleConfirmRelease}
              disabled={!releaseReason.trim() || isLoading}
            />
            <DefaultButton text="Cancel" onClick={() => setShowReleaseDialog(false)} />
          </DialogFooter>
        </Dialog>

        {/* Exchange Request Dialog */}
        <Dialog
          hidden={!showExchangeDialog}
          onDismiss={() => setShowExchangeDialog(false)}
          dialogContentProps={{
            type: DialogType.normal,
            title: 'Request Shift Exchange',
            subText: 'Request to exchange this shift with another staff member.'
          }}
        >
          <Stack tokens={{ childrenGap: 15 }}>
            {selectedShift && (
              <Stack tokens={{ childrenGap: 8 }}>
                <Text><strong>Your Shift:</strong></Text>
                <Text><strong>Venue:</strong> {selectedShift.venue?.name}</Text>
                <Text><strong>Date:</strong> {new Date(selectedShift.startTime).toLocaleDateString()}</Text>
                <Text><strong>Time:</strong> {new Date(selectedShift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</Text>
              </Stack>
            )}
            <Dropdown
              label="Exchange with"
              options={staffDropdownOptions}
              selectedKey={selectedTargetStaff}
              onChange={(_, option) => setSelectedTargetStaff(option?.key as number)}
              placeholder="Select staff member..."
              required
            />
            <TextField
              label="Reason for exchange"
              multiline
              rows={3}
              value={exchangeReason}
              onChange={(_, value) => setExchangeReason(value || '')}
              placeholder="Please provide a reason for this exchange request..."
              required
            />
          </Stack>
          <DialogFooter>
            <PrimaryButton
              text="Send Request"
              onClick={handleConfirmExchange}
              disabled={!selectedTargetStaff || !exchangeReason.trim() || isLoading}
            />
            <DefaultButton text="Cancel" onClick={() => setShowExchangeDialog(false)} />
          </DialogFooter>
        </Dialog>
      </Stack>
    </MainLayout>
  );
};

export default ShiftExchangePage;