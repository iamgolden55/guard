import type React from 'react';
import { useState, useEffect } from 'react';
import { Header, Container, SpaceBetween, StatusIndicator, Alert, ConfirmationModal, EmptyState } from '../../components/cloudscape';
import { useAuth } from '../../contexts/AuthContext';
import { shiftService, exchangeService } from '../../services';
import type { Shift, StaffProfile } from '../../types';
import type { ShiftExchange, OpenShiftRequest } from '../../services/exchangeService';

const ShiftExchangePage: React.FC = () => {
  const { authState } = useAuth();
  const user = authState?.user;
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

  const getStatusType = (status: string): 'success' | 'warning' | 'error' | 'info' | 'pending' | 'stopped' => {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted_by_target': return 'info';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'cancelled': return 'stopped';
      case 'scheduled': return 'success';
      case 'active': return 'warning';
      case 'open': return 'success';
      default: return 'stopped';
    }
  };

  const renderExchangeActions = (item: ShiftExchange) => {
    const currentUserId = user?.id || user?.user_id || parseInt(localStorage.getItem('user')?.match(/"id":(\d+)/)?.[1] || '0');

    const isRequestingUser = item.requesting_user === currentUserId;
    const isTargetUser = item.target_user === currentUserId;

    if (item.status === 'pending' && isTargetUser) {
      return (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => handleAcceptExchange(item.id)}
            className="px-4 h-9 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => handleDeclineExchange(item.id)}
            className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Decline
          </button>
        </div>
      );
    }

    if (['pending', 'accepted_by_target'].includes(item.status) && (isRequestingUser || isTargetUser)) {
      return (
        <div className="mt-3">
          <button
            onClick={() => handleCancelExchange(item.id)}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      );
    }

    return <p className="text-xs text-gray-400 mt-3">No actions available</p>;
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

    try {
      setIsLoading(true);
      await exchangeService.createExchange(exchangeData);
      setSuccess('Exchange request sent successfully');
      setShowExchangeDialog(false);
      loadData();
    } catch (err: any) {
      console.error('Exchange creation error:', err);

      let errorMessage = 'Failed to create exchange request';
      if (err.response?.data) {
        if (err.response.data.non_field_errors) {
          errorMessage = err.response.data.non_field_errors[0];
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else {
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

  const tabs = [
    { key: 'my-shifts', label: 'My Shifts' },
    { key: 'available-shifts', label: 'Available Shifts' },
    { key: 'direct-exchanges', label: 'Direct Exchanges' },
    { key: 'my-requests', label: 'My Requests' },
  ];

  return (
    <SpaceBetween size="l">
      <Header variant="h1">Shift Exchange</Header>

      {error && (
        <Alert type="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert type="success" dismissible onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                selectedTab === tab.key
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
        </div>
      )}

      {/* My Shifts Tab */}
      {!isLoading && selectedTab === 'my-shifts' && (
        <Container>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-500">Release shifts to the open pool or request exchanges with other staff members.</p>
            {myShifts.length === 0 ? (
              <EmptyState title="No active or scheduled shifts" description="You have no shifts available for exchange." />
            ) : (
              <div className="space-y-3">
                {myShifts.map((shift, index) => (
                  <div key={shift.id || index} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{shift?.venue?.name || 'No venue name'}</p>
                        <p className="text-xs text-gray-500">
                          {shift?.startTime ? new Date(shift.startTime).toLocaleDateString() : 'No date'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {shift?.startTime ? new Date(shift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'No time'}
                          {shift?.endTime && ` - ${new Date(shift.endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <StatusIndicator type={getStatusType(shift.status)}>
                        {shift.status}
                      </StatusIndicator>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleReleaseShift(shift)}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Release
                      </button>
                      <button
                        onClick={() => handleExchangeShift(shift)}
                        className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Exchange
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Available Shifts Tab */}
      {!isLoading && selectedTab === 'available-shifts' && (
        <Container>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-500">Claim shifts that other staff members have released.</p>
            {availableShifts.length === 0 ? (
              <EmptyState title="No available shifts" description="There are no shifts available to claim right now." />
            ) : (
              <div className="space-y-3">
                {availableShifts.map((request) => (
                  <div key={request.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{request.original_shift_details.venue.name}</p>
                        <p className="text-xs text-gray-500">
                          Released by: {
                            (request.request_reason?.includes('System-generated') ||
                             request.request_reason?.includes('unassigned venue shift'))
                              ? 'System'
                              : `${request.requesting_user_details.first_name} ${request.requesting_user_details.last_name}`
                          }
                        </p>
                        <p className="text-xs text-gray-500">{new Date(request.original_shift_details.start_time).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(request.original_shift_details.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {request.original_shift_details.end_time && ` - ${new Date(request.original_shift_details.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <StatusIndicator type={getStatusType(request.status)}>
                        {request.status}
                      </StatusIndicator>
                    </div>
                    <div className="mt-3">
                      <button
                        onClick={() => handleClaimShift(request.id)}
                        disabled={request.status !== 'open'}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        Claim Shift
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Direct Exchanges Tab */}
      {!isLoading && selectedTab === 'direct-exchanges' && (
        <Container>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-500">Direct shift exchanges with specific staff members.</p>
            {directExchanges.length === 0 ? (
              <EmptyState title="No direct exchanges" description="You have no active exchange requests." />
            ) : (
              <div className="space-y-3">
                {directExchanges.map((exchange) => {
                  const currentUserId = user?.id || user?.user_id || 0;
                  const otherUser = exchange.requesting_user === currentUserId ? exchange.target_user_details : exchange.requesting_user_details;
                  const isRequestingUser = exchange.requesting_user === currentUserId;

                  return (
                    <div key={exchange.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {isRequestingUser ? 'To' : 'From'} {`${otherUser.first_name} ${otherUser.last_name}`}
                          </p>
                          <p className="text-xs text-gray-500">{exchange.original_shift_details.venue.name}</p>
                          <p className="text-xs text-gray-500">{new Date(exchange.original_shift_details.start_time).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">Reason: {exchange.request_reason}</p>
                        </div>
                        <StatusIndicator type={getStatusType(exchange.status)}>
                          {exchange.status.replace('_', ' ')}
                        </StatusIndicator>
                      </div>
                      {renderExchangeActions(exchange)}
                    </div>
                  );
                })}
              </div>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* My Requests Tab */}
      {!isLoading && selectedTab === 'my-requests' && (
        <Container>
          <SpaceBetween size="m">
            <p className="text-sm text-gray-500">Track your shift release requests and claims.</p>
            {myRequests.length === 0 ? (
              <EmptyState title="No requests" description="You have no shift release requests." />
            ) : (
              <div className="space-y-3">
                {myRequests.map((request) => (
                  <div key={request.id} className="p-4 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{request.original_shift_details.venue.name}</p>
                        <p className="text-xs text-gray-500">{new Date(request.original_shift_details.start_time).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">Reason: {request.request_reason}</p>
                        {request.claimed_by_details && (
                          <p className="text-xs text-gray-500">Claimed by: {`${request.claimed_by_details.first_name} ${request.claimed_by_details.last_name}`}</p>
                        )}
                      </div>
                      <StatusIndicator type={getStatusType(request.status)}>
                        {request.status}
                      </StatusIndicator>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* Release Shift Modal */}
      <ConfirmationModal
        visible={showReleaseDialog}
        header="Release Shift to Pool"
        confirmLabel="Release Shift"
        onConfirm={handleConfirmRelease}
        onCancel={() => setShowReleaseDialog(false)}
        loading={isLoading}
      >
        <SpaceBetween size="m">
          <p className="text-sm text-gray-600">This will make your shift available for other staff members to claim.</p>
          {selectedShift && (
            <div className="space-y-1">
              <p className="text-sm"><span className="font-medium">Venue:</span> {selectedShift.venue?.name}</p>
              <p className="text-sm"><span className="font-medium">Date:</span> {new Date(selectedShift.startTime).toLocaleDateString()}</p>
              <p className="text-sm"><span className="font-medium">Time:</span> {new Date(selectedShift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for releasing shift *</label>
            <textarea
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="Please provide a reason for releasing this shift..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </SpaceBetween>
      </ConfirmationModal>

      {/* Exchange Request Modal */}
      <ConfirmationModal
        visible={showExchangeDialog}
        header="Request Shift Exchange"
        confirmLabel="Send Request"
        onConfirm={handleConfirmExchange}
        onCancel={() => setShowExchangeDialog(false)}
        loading={isLoading}
      >
        <SpaceBetween size="m">
          <p className="text-sm text-gray-600">Request to exchange this shift with another staff member.</p>
          {selectedShift && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Your Shift:</p>
              <p className="text-sm"><span className="font-medium">Venue:</span> {selectedShift.venue?.name}</p>
              <p className="text-sm"><span className="font-medium">Date:</span> {new Date(selectedShift.startTime).toLocaleDateString()}</p>
              <p className="text-sm"><span className="font-medium">Time:</span> {new Date(selectedShift.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exchange with *</label>
            <select
              value={selectedTargetStaff || ''}
              onChange={(e) => setSelectedTargetStaff(Number(e.target.value) || null)}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Select staff member...</option>
              {eligibleStaff.map((staff, index) => (
                <option key={staff.userId || staff.id || index} value={staff.userId || staff.id}>
                  {`${staff.firstName || 'Unknown'} ${staff.lastName || 'User'}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for exchange *</label>
            <textarea
              value={exchangeReason}
              onChange={(e) => setExchangeReason(e.target.value)}
              placeholder="Please provide a reason for this exchange request..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </SpaceBetween>
      </ConfirmationModal>
    </SpaceBetween>
  );
};

export default ShiftExchangePage;
