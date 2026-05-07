import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header, Container, SpaceBetween, KeyValuePairs, StatusIndicator, Alert, EmptyState } from '../../components/cloudscape';
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

const ShiftDetailsPage: React.FC = () => {
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

      setShift(shiftData);
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

  const getConditionType = (condition: ConditionRating): 'success' | 'warning' | 'error' | 'info' => {
    switch (condition) {
      case ConditionRating.EXCELLENT:
      case ConditionRating.GOOD:
        return 'success';
      case ConditionRating.FAIR:
        return 'warning';
      case ConditionRating.POOR:
      case ConditionRating.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  };

  // Ensure arrays are properly initialized
  const safeFireChecks = Array.isArray(fireChecks) ? fireChecks : [];
  const safeCapacityChecks = Array.isArray(capacityChecks) ? capacityChecks : [];
  const safeToiletChecks = Array.isArray(toiletChecks) ? toiletChecks : [];

  const totalChecks = safeFireChecks.length + safeCapacityChecks.length + safeToiletChecks.length;
  const criticalIssues = safeFireChecks.filter(c => !c.isPassed).length +
                        safeCapacityChecks.filter(c => c.count >= 100).length +
                        safeToiletChecks.filter(c => c.condition === ConditionRating.POOR || c.condition === ConditionRating.CRITICAL).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading shift details...</p>
        </div>
      </div>
    );
  }

  if (error || !shift) {
    return (
      <SpaceBetween size="l">
        <Alert type="error">{error || 'Shift not found'}</Alert>
        <button
          onClick={() => navigate('/shifts')}
          className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back to Shifts
        </button>
      </SpaceBetween>
    );
  }

  const getStatusType = (status: string): 'success' | 'warning' | 'info' | 'pending' | 'in-progress' => {
    switch (status) {
      case 'completed': return 'success';
      case 'active':
      case 'in_progress': return 'in-progress';
      case 'scheduled': return 'pending';
      default: return 'info';
    }
  };

  return (
    <SpaceBetween size="l">
      <Header
        variant="h1"
        actions={
          <button
            onClick={() => navigate('/shifts')}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Shifts
          </button>
        }
      >
        Shift Details
      </Header>

      {/* Shift Information */}
      <Container header={<Header variant="h2">Shift Information</Header>}>
        <KeyValuePairs
          columns={4}
          items={[
            {
              label: 'Staff',
              value: (
                <div>
                  <p className="font-medium">{shift.staff_details?.first_name || 'Unknown'} {shift.staff_details?.last_name || 'Staff'}</p>
                  <p className="text-xs text-gray-500">{shift.staff_details?.email || 'No email'}</p>
                </div>
              )
            },
            {
              label: 'Venue',
              value: (
                <div>
                  <p className="font-medium">{shift.venue_details?.name || 'Unknown Venue'}</p>
                  {shift.venue_details?.address && (
                    <p className="text-xs text-gray-500">{shift.venue_details.address}</p>
                  )}
                </div>
              )
            },
            {
              label: 'Timing',
              value: (
                <div className="space-y-1">
                  <p className="text-xs"><span className="font-medium">Scheduled:</span> {formatDateTime(shift.start_time)}</p>
                  {shift.check_in_time && (
                    <p className="text-xs"><span className="font-medium">Checked In:</span> {formatDateTime(shift.check_in_time)}</p>
                  )}
                  {shift.check_out_time && (
                    <p className="text-xs"><span className="font-medium">Checked Out:</span> {formatDateTime(shift.check_out_time)}</p>
                  )}
                </div>
              )
            },
            {
              label: 'Status',
              value: (
                <div className="space-y-2">
                  <StatusIndicator type={getStatusType(shift.status)}>
                    {shift.status.replace('_', ' ')}
                  </StatusIndicator>
                  <p className="text-xs">
                    <span className="font-medium">Approved:</span> {shift.managerApproved ? 'Yes' : 'Pending'}
                  </p>
                </div>
              )
            }
          ]}
        />
      </Container>

      {/* Venue Requirements */}
      <Container header={<Header variant="h2">Venue Requirements</Header>}>
        <div className="flex flex-wrap gap-6">
          <StatusIndicator type={shift.venue_details?.requires_fire_safety_checks ? 'success' : 'stopped'}>
            Fire Safety: {shift.venue_details?.requires_fire_safety_checks ? 'Required' : 'Not Required'}
          </StatusIndicator>
          <StatusIndicator type={shift.venue_details?.requires_capacity_monitoring ? 'success' : 'stopped'}>
            Capacity: {shift.venue_details?.requires_capacity_monitoring ? 'Required' : 'Not Required'}
          </StatusIndicator>
          <StatusIndicator type={shift.venue_details?.requires_toilet_checks ? 'success' : 'stopped'}>
            Toilets: {shift.venue_details?.requires_toilet_checks ? 'Required' : 'Not Required'}
          </StatusIndicator>
        </div>
        {shift.venue_details?.capacity && (
          <p className="mt-3 text-sm text-gray-600">
            <span className="font-medium">Maximum Capacity:</span> {shift.venue_details.capacity} people
          </p>
        )}
      </Container>

      {/* Venue Check Summary */}
      <Container
        header={
          <Header
            variant="h2"
            info={
              criticalIssues > 0 ? (
                <StatusIndicator type="error">
                  {criticalIssues} Critical Issue{criticalIssues !== 1 ? 's' : ''}
                </StatusIndicator>
              ) : undefined
            }
          >
            Venue Check Summary
          </Header>
        }
      >
        <KeyValuePairs
          columns={4}
          items={[
            { label: 'Total Checks', value: totalChecks },
            { label: 'Fire Exit Checks', value: safeFireChecks.length },
            { label: 'Capacity Checks', value: safeCapacityChecks.length },
            { label: 'Toilet Checks', value: safeToiletChecks.length },
          ]}
        />
      </Container>

      {/* Detailed Check History */}
      {totalChecks > 0 && (
        <Container header={<Header variant="h2">Detailed Check History</Header>}>
          <SpaceBetween size="l">
            {/* Fire Exit Checks */}
            {safeFireChecks.length > 0 && (
              <SpaceBetween size="s">
                <h3 className="text-sm font-semibold text-gray-900">Fire Safety Checks ({safeFireChecks.length})</h3>
                <div className="space-y-2">
                  {safeFireChecks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{check.exitName}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(check.timestamp)}</p>
                        {check.comments && <p className="text-xs text-gray-500">{check.comments}</p>}
                      </div>
                      <StatusIndicator type={check.isPassed ? 'success' : 'error'}>
                        {check.isPassed ? 'Clear' : 'Blocked'}
                      </StatusIndicator>
                    </div>
                  ))}
                </div>
              </SpaceBetween>
            )}

            {/* Capacity Checks */}
            {safeCapacityChecks.length > 0 && (
              <SpaceBetween size="s">
                <h3 className="text-sm font-semibold text-gray-900">Capacity Checks ({safeCapacityChecks.length})</h3>
                <div className="space-y-2">
                  {safeCapacityChecks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">Count: {check.count} people</p>
                        <p className="text-xs text-gray-500">{formatDateTime(check.timestamp)}</p>
                        {check.comments && <p className="text-xs text-gray-500">{check.comments}</p>}
                      </div>
                      <StatusIndicator type={check.count >= 100 ? 'error' : 'success'}>
                        {check.count >= 100 ? 'At Capacity' : 'Normal'}
                      </StatusIndicator>
                    </div>
                  ))}
                </div>
              </SpaceBetween>
            )}

            {/* Toilet Checks */}
            {safeToiletChecks.length > 0 && (
              <SpaceBetween size="s">
                <h3 className="text-sm font-semibold text-gray-900">Toilet Checks ({safeToiletChecks.length})</h3>
                <div className="space-y-2">
                  {safeToiletChecks.map((check) => (
                    <div key={check.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{check.location}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(check.timestamp)}</p>
                        {check.comments && <p className="text-xs text-gray-500">{check.comments}</p>}
                      </div>
                      <StatusIndicator type={getConditionType(check.condition)}>
                        {check.condition}
                      </StatusIndicator>
                    </div>
                  ))}
                </div>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Container>
      )}

      {/* No checks message */}
      {totalChecks === 0 && (
        <Container>
          <EmptyState
            title="No venue checks logged yet"
            description="Staff can log venue checks during their shift using the active shift widget"
          />
        </Container>
      )}
    </SpaceBetween>
  );
};

export default ShiftDetailsPage;
