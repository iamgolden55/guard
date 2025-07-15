import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Text,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  DefaultButton,
  PrimaryButton
} from '@fluentui/react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layouts';
import { shiftService } from '../../services';
import { FireExitCheck, CapacityCheck, ToiletCheck, ConditionRating } from '../../types';

interface ShiftDetails {
  id: number;
  staff: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  venue: {
    id: number;
    name: string;
    address?: string;
    requiresFireSafetyChecks?: boolean;
    requiresCapacityMonitoring?: boolean;
    requiresToiletChecks?: boolean;
    capacity?: number;
  };
  startTime: string;
  endTime: string | null;
  checkInTime?: string;
  checkOutTime?: string | null;
  status: string;
  managerApproved: boolean;
  durationHours?: number;
}

const ShiftDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shift, setShift] = useState<ShiftDetails | null>(null);
  const [fireChecks, setFireChecks] = useState<FireExitCheck[]>([]);
  const [capacityChecks, setCapacityChecks] = useState<CapacityCheck[]>([]);
  const [toiletChecks, setToiletChecks] = useState<ToiletCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadShiftData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const shiftId = parseInt(id);
      
      // Load shift details and all check data in parallel
      const [allShifts, fireData, capacityData, toiletData] = await Promise.all([
        shiftService.getAllShiftsForManager().catch(() => []),
        shiftService.getFireExitChecks(shiftId).catch(() => []),
        shiftService.getCapacityChecks(shiftId).catch(() => []),
        shiftService.getToiletChecks(shiftId).catch(() => [])
      ]);

      // Find the specific shift from the manager data
      const shiftData = allShifts.find((shift: any) => shift.id === shiftId);

      if (!shiftData) {
        setError('Shift not found');
        return;
      }

      // Debug: Log the actual data structure
      console.log('Fire checks data:', fireData);
      console.log('Capacity checks data:', capacityData);
      console.log('Toilet checks data:', toiletData);

      setShift(shiftData);
      // Handle paginated API responses - extract results array
      setFireChecks(fireData?.results || []);
      setCapacityChecks(capacityData?.results || []);
      setToiletChecks(toiletData?.results || []);
    } catch (err) {
      console.error('Failed to load shift data:', err);
      setError('Failed to load shift details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConditionColor = (condition: ConditionRating) => {
    switch (condition) {
      case ConditionRating.EXCELLENT:
        return { background: '#d4edda', text: '#155724' };
      case ConditionRating.GOOD:
        return { background: '#d1ecf1', text: '#0c5460' };
      case ConditionRating.FAIR:
        return { background: '#fff3cd', text: '#856404' };
      case ConditionRating.POOR:
        return { background: '#f8d7da', text: '#721c24' };
      case ConditionRating.CRITICAL:
        return { background: '#f5c6cb', text: '#721c24' };
      default:
        return { background: '#e2e3e5', text: '#383d41' };
    }
  };

  const cardStyle = {
    padding: '20px',
    border: '1px solid #e1e1e1',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '16px'
  };

  // Ensure arrays are properly initialized
  const safeFireChecks = Array.isArray(fireChecks) ? fireChecks : [];
  const safeCapacityChecks = Array.isArray(capacityChecks) ? capacityChecks : [];
  const safeToiletChecks = Array.isArray(toiletChecks) ? toiletChecks : [];

  const totalChecks = safeFireChecks.length + safeCapacityChecks.length + safeToiletChecks.length;
  const criticalIssues = safeFireChecks.filter(c => !c.isPassed).length + 
                        safeCapacityChecks.filter(c => c.count >= 100).length + // Assuming 100 is capacity limit
                        safeToiletChecks.filter(c => c.condition === ConditionRating.POOR || c.condition === ConditionRating.CRITICAL).length;

  if (isLoading) {
    return (
      <MainLayout>
        <Stack horizontalAlign="center" tokens={{ childrenGap: 20 }} style={{ padding: '40px' }}>
          <Spinner size={SpinnerSize.large} />
          <Text variant="large">Loading shift details...</Text>
        </Stack>
      </MainLayout>
    );
  }

  if (error || !shift) {
    return (
      <MainLayout>
        <Stack tokens={{ childrenGap: 20 }}>
          <MessageBar messageBarType={MessageBarType.error}>
            {error || 'Shift not found'}
          </MessageBar>
          <DefaultButton
            text="Back to Shifts"
            onClick={() => navigate('/shifts')}
          />
        </Stack>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 24 }}>
        {/* Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge" style={{ fontWeight: '600' }}>
            📋 Shift Details
          </Text>
          <DefaultButton
            text="Back to Shifts"
            iconProps={{ iconName: 'Back' }}
            onClick={() => navigate('/shifts')}
          />
        </Stack>

        {/* Shift Information */}
        <div style={cardStyle}>
          <Stack tokens={{ childrenGap: 16 }}>
            <Text variant="xLarge" style={{ fontWeight: '600', marginBottom: '8px' }}>
              Shift Information
            </Text>
            
            <Stack horizontal tokens={{ childrenGap: 40 }} wrap>
              <Stack tokens={{ childrenGap: 8 }} style={{ minWidth: '200px' }}>
                <Text variant="medium" style={{ fontWeight: '600' }}>Staff</Text>
                <Text variant="medium">
                  {shift.staff_details?.first_name || 'Unknown'} {shift.staff_details?.last_name || 'Staff'}
                </Text>
                <Text variant="small" style={{ color: '#666' }}>
                  {shift.staff_details?.email || 'No email'}
                </Text>
              </Stack>

              <Stack tokens={{ childrenGap: 8 }} style={{ minWidth: '200px' }}>
                <Text variant="medium" style={{ fontWeight: '600' }}>Venue</Text>
                <Text variant="medium">{shift.venue_details?.name || 'Unknown Venue'}</Text>
                {shift.venue_details?.address && (
                  <Text variant="small" style={{ color: '#666' }}>{shift.venue_details.address}</Text>
                )}
              </Stack>

              <Stack tokens={{ childrenGap: 8 }} style={{ minWidth: '200px' }}>
                <Text variant="medium" style={{ fontWeight: '600' }}>Timing</Text>
                <Text variant="small">
                  <strong>Scheduled:</strong> {formatDateTime(shift.start_time)}
                </Text>
                {shift.check_in_time && (
                  <Text variant="small">
                    <strong>Checked In:</strong> {formatDateTime(shift.check_in_time)}
                  </Text>
                )}
                {shift.check_out_time && (
                  <Text variant="small">
                    <strong>Checked Out:</strong> {formatDateTime(shift.check_out_time)}
                  </Text>
                )}
              </Stack>

              <Stack tokens={{ childrenGap: 8 }} style={{ minWidth: '200px' }}>
                <Text variant="medium" style={{ fontWeight: '600' }}>Status</Text>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  backgroundColor: shift.status === 'completed' ? '#d4edda' : '#fff3cd',
                  color: shift.status === 'completed' ? '#155724' : '#856404',
                  display: 'inline-block',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  {shift.status}
                </div>
                <Text variant="small">
                  <strong>Manager Approved:</strong> {shift.managerApproved ? '✅ Yes' : '⏳ Pending'}
                </Text>
              </Stack>
            </Stack>
          </Stack>
        </div>

        {/* Venue Requirements */}
        <div style={cardStyle}>
          <Stack tokens={{ childrenGap: 16 }}>
            <Text variant="xLarge" style={{ fontWeight: '600', marginBottom: '8px' }}>
              Venue Requirements
            </Text>
            
            <Stack horizontal tokens={{ childrenGap: 30 }}>
              <Text variant="medium">
                🔥 Fire Safety: {shift.venue_details?.requires_fire_safety_checks ? '✅ Required' : '⭕ Not Required'}
              </Text>
              <Text variant="medium">
                👥 Capacity: {shift.venue_details?.requires_capacity_monitoring ? '✅ Required' : '⭕ Not Required'}
              </Text>
              <Text variant="medium">
                🚻 Toilets: {shift.venue_details?.requires_toilet_checks ? '✅ Required' : '⭕ Not Required'}
              </Text>
            </Stack>
            
            {shift.venue_details?.capacity && (
              <Text variant="medium">
                <strong>Maximum Capacity:</strong> {shift.venue_details.capacity} people
              </Text>
            )}
          </Stack>
        </div>

        {/* Venue Check Summary */}
        <div style={cardStyle}>
          <Stack tokens={{ childrenGap: 16 }}>
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
              <Text variant="xLarge" style={{ fontWeight: '600' }}>
                Venue Check Summary
              </Text>
              {criticalIssues > 0 && (
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  backgroundColor: '#f8d7da',
                  color: '#721c24',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  ⚠️ {criticalIssues} Critical Issue{criticalIssues !== 1 ? 's' : ''}
                </div>
              )}
            </Stack>
            
            <Stack horizontal tokens={{ childrenGap: 40 }}>
              <Text variant="medium">
                <strong>Total Checks:</strong> {totalChecks}
              </Text>
              <Text variant="medium">
                <strong>Fire Exit Checks:</strong> {safeFireChecks.length}
              </Text>
              <Text variant="medium">
                <strong>Capacity Checks:</strong> {safeCapacityChecks.length}
              </Text>
              <Text variant="medium">
                <strong>Toilet Checks:</strong> {safeToiletChecks.length}
              </Text>
            </Stack>
          </Stack>
        </div>

        {/* Detailed Check History */}
        {totalChecks > 0 && (
          <div style={cardStyle}>
            <Stack tokens={{ childrenGap: 20 }}>
              <Text variant="xLarge" style={{ fontWeight: '600' }}>
                📝 Detailed Check History
              </Text>

              {/* Fire Exit Checks */}
              {safeFireChecks.length > 0 && (
                <Stack tokens={{ childrenGap: 12 }}>
                  <Text variant="large" style={{ fontWeight: '600', color: '#ff6b6b' }}>
                    🔥 Fire Safety Checks ({safeFireChecks.length})
                  </Text>
                  <Stack tokens={{ childrenGap: 8 }}>
                    {safeFireChecks.map((check, index) => (
                      <div key={check.id} style={{
                        border: '1px solid #e1e5e9',
                        borderRadius: '6px',
                        padding: '12px',
                        backgroundColor: '#f8f9fa'
                      }}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="medium" style={{ fontWeight: '600' }}>
                              {check.exitName}
                            </Text>
                            <Text variant="small">
                              {formatDateTime(check.timestamp)}
                            </Text>
                            {check.comments && (
                              <Text variant="small" style={{ color: '#666' }}>
                                {check.comments}
                              </Text>
                            )}
                          </Stack>
                          <div style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: check.isPassed ? '#d4edda' : '#f8d7da',
                            color: check.isPassed ? '#155724' : '#721c24',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {check.isPassed ? '✅ Clear' : '❌ Blocked'}
                          </div>
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                </Stack>
              )}

              {/* Capacity Checks */}
              {safeCapacityChecks.length > 0 && (
                <Stack tokens={{ childrenGap: 12 }}>
                  <Text variant="large" style={{ fontWeight: '600', color: '#4ecdc4' }}>
                    👥 Capacity Checks ({safeCapacityChecks.length})
                  </Text>
                  <Stack tokens={{ childrenGap: 8 }}>
                    {safeCapacityChecks.map((check, index) => (
                      <div key={check.id} style={{
                        border: '1px solid #e1e5e9',
                        borderRadius: '6px',
                        padding: '12px',
                        backgroundColor: '#f8f9fa'
                      }}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="medium" style={{ fontWeight: '600' }}>
                              Count: {check.count} people
                            </Text>
                            <Text variant="small">
                              {formatDateTime(check.timestamp)}
                            </Text>
                            {check.comments && (
                              <Text variant="small" style={{ color: '#666' }}>
                                {check.comments}
                              </Text>
                            )}
                          </Stack>
                          <div style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: check.count >= 100 ? '#f8d7da' : '#d4edda',
                            color: check.count >= 100 ? '#721c24' : '#155724',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {check.count >= 100 ? '⚠️ At Capacity' : '✅ Normal'}
                          </div>
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                </Stack>
              )}

              {/* Toilet Checks */}
              {safeToiletChecks.length > 0 && (
                <Stack tokens={{ childrenGap: 12 }}>
                  <Text variant="large" style={{ fontWeight: '600', color: '#95e1d3' }}>
                    🚻 Toilet Checks ({safeToiletChecks.length})
                  </Text>
                  <Stack tokens={{ childrenGap: 8 }}>
                    {safeToiletChecks.map((check, index) => (
                      <div key={check.id} style={{
                        border: '1px solid #e1e5e9',
                        borderRadius: '6px',
                        padding: '12px',
                        backgroundColor: '#f8f9fa'
                      }}>
                        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                          <Stack tokens={{ childrenGap: 4 }}>
                            <Text variant="medium" style={{ fontWeight: '600' }}>
                              {check.location}
                            </Text>
                            <Text variant="small">
                              {formatDateTime(check.timestamp)}
                            </Text>
                            {check.comments && (
                              <Text variant="small" style={{ color: '#666' }}>
                                {check.comments}
                              </Text>
                            )}
                          </Stack>
                          <div style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: getConditionColor(check.condition).background,
                            color: getConditionColor(check.condition).text,
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}>
                            {check.condition}
                          </div>
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </div>
        )}

        {/* No checks message */}
        {totalChecks === 0 && (
          <div style={cardStyle}>
            <Stack horizontalAlign="center" tokens={{ childrenGap: 16 }} style={{ padding: '40px' }}>
              <Text variant="large" style={{ color: '#666' }}>
                📝 No venue checks logged yet
              </Text>
              <Text variant="medium" style={{ color: '#666' }}>
                Staff can log venue checks during their shift using the active shift widget
              </Text>
            </Stack>
          </div>
        )}
      </Stack>
    </MainLayout>
  );
};

export default ShiftDetails;