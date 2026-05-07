import React, { useState, useEffect, useCallback } from 'react';
import {
  Text,
  PrimaryButton,
  DefaultButton,
  Spinner,
  SpinnerSize,
  Icon,
  Modal,
  TextField,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { useNavigate } from 'react-router-dom';
import { shiftService } from '../services';
import { ShiftStatus, FireExitCheck, CapacityCheck, ToiletCheck, ConditionRating } from '../types';

interface ActiveShift {
  id: number;
  venue: {
    id: number;
    name: string;
    requiresFireSafetyChecks?: boolean;
    requiresCapacityMonitoring?: boolean;
    requiresToiletChecks?: boolean;
    maxCapacity?: number;
  };
  startTime: string;
  endTime: string | null;
  status: ShiftStatus;
  checkInTime?: string;
  checkOutTime?: string | null;
  // Additional fields that might be present from backend
  actual_start_time?: string;
  actual_end_time?: string | null;
  check_in_time?: string;
  check_out_time?: string | null;
  checkin_time?: string;
  checkout_time?: string | null;
  actualStartTime?: string;
  actualEndTime?: string | null;
}

const ActiveShiftWidget: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('');
  const [showChecksModal, setShowChecksModal] = useState(false);
  const [checkType, setCheckType] = useState<'fire' | 'capacity' | 'toilet' | null>('fire');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [venueCheckStatus, setVenueCheckStatus] = useState<{
    fireExitCheck: { required: boolean; completed: boolean };
    capacityCheck: { required: boolean; completed: boolean };
    toiletCheck: { required: boolean; completed: boolean };
  } | null>(null);

  // Update current time more frequently for accurate timing
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);
      
      // Calculate elapsed time from actual check-in time, not scheduled time
      if (activeShift) {
        // Try multiple possible field names for check-in time (prioritize snake_case from API)
        const actualCheckInTime = activeShift.check_in_time ||
                                 activeShift.checkInTime || 
                                 activeShift.actual_start_time || 
                                 activeShift.checkin_time ||
                                 activeShift.actualStartTime;
        
        if (actualCheckInTime) {
          // Use the actual check-in time for elapsed calculation
          const startTime = new Date(actualCheckInTime);
          const diffMs = now.getTime() - startTime.getTime();
          
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          
          setElapsedTime(`${hours}h ${minutes}m`);
        } else {
          // Fallback: if no check-in time, show minimal time
          setElapsedTime('0h 1m');
        }
      }
    };

    // Update immediately
    updateTime();
    
    // Update every 10 seconds for more accurate real-time display
    const interval = setInterval(updateTime, 10000);

    return () => clearInterval(interval);
  }, [activeShift]);

  // Load active shift data
  useEffect(() => {
    const loadActiveShift = async (isInitialLoad = false) => {
      try {
        // Show loading only on initial load, use refreshing for subsequent loads
        if (isInitialLoad) {
          setIsLoading(true);
        } else {
          setIsRefreshing(true);
        }
        
        const shifts = await shiftService.getMyShifts();
        
        // Find the active shift (checked in but not checked out)
        const active = shifts.find((shift: any) => {
          // Check if status is ACTIVE or in_progress
          const isActive = shift.status === ShiftStatus.ACTIVE || 
                          shift.status === 'active' || 
                          shift.status === 'in_progress';
          
          // For shifts with 'in_progress' status, we can assume they're checked in
          // since that's what the status implies
          const hasCheckedIn = shift.checkInTime || shift.actual_start_time || 
                              shift.startSignature || (shift.status === 'in_progress');
          
          // Check if shift has NOT been checked out (look for various possible field names)
          const hasNotCheckedOut = !shift.checkOutTime && !shift.actual_end_time && 
                                  !shift.checkout_time && !shift.check_out_time && 
                                  !shift.endSignature;
          
          return isActive && hasCheckedIn && hasNotCheckedOut;
        });
        setActiveShift(active || null);
        
        // Load venue check status if there's an active shift
        if (active) {
          try {
            const checkStatus = await shiftService.getVenueCheckStatus(active.id);
            setVenueCheckStatus(checkStatus);
          } catch (error) {
            console.error('Error loading venue check status:', error);
            // Don't block the UI if check status fails
          }
        } else {
          setVenueCheckStatus(null);
        }
      } catch (error) {
        console.error('Error loading active shift:', error);
        // Don't clear activeShift on error to avoid jarring UX
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    loadActiveShift(true); // Initial load
    
    // Refresh every 30 seconds for more responsive shift status updates
    const interval = setInterval(() => loadActiveShift(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckOut = useCallback(() => {
    if (activeShift) {
      navigate(`/shifts/${activeShift.id}/checkout`);
    }
  }, [activeShift, navigate]);

  const handleLogChecks = useCallback(() => {
    setShowChecksModal(true);
    setCheckType('fire'); // Default to fire check, user can switch in modal
  }, []);

  const handleLogCheck = useCallback((type: 'fire' | 'capacity' | 'toilet') => {
    setCheckType(type);
    setShowChecksModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowChecksModal(false);
    setCheckType(null);
  }, []);

  const handleViewHistory = useCallback(() => {
    setShowHistoryModal(true);
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setShowHistoryModal(false);
  }, []);

  const formatShiftTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }, []);

  // Modern card component for consistent styling
  const ModernCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
    children, 
    className = '' 
  }) => (
    <div 
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 transition-all duration-300 ease-out ${className}`}
      style={{ 
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transform: 'translateZ(0)'
      }}
    >
      {children}
    </div>
  );

  const buttonStyles = {
    primary: {
      root: {
        backgroundColor: '#dc2626',
        borderRadius: '16px',
        height: '52px',
        fontSize: '16px',
        fontWeight: '600',
        minWidth: '160px',
        border: 'none'
      }
    },
    secondary: {
      root: {
        borderRadius: '16px',
        border: '2px solid #e5e7eb',
        height: '52px',
        fontSize: '16px',
        fontWeight: '600',
        minWidth: '160px',
        backgroundColor: '#f9fafb'
      }
    }
  };

  if (isLoading) {
    return (
      <ModernCard className="p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Spinner size={SpinnerSize.medium} />
          </div>
          <Text style={{ color: '#6b7280', textAlign: 'center', fontSize: '16px' }}>
            Checking for active shift...
          </Text>
        </div>
      </ModernCard>
    );
  }

  if (!activeShift) {
    return (
      <ModernCard className="p-8">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-gray-50 mx-auto flex items-center justify-center">
            <Icon iconName="Clock" className="text-gray-400" style={{ fontSize: '32px' }} />
          </div>
          <div className="space-y-2">
            <Text style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
              No Active Shift
            </Text>
          </div>
          <PrimaryButton
            text="Start New Shift"
            iconProps={{ iconName: 'Add' }}
            onClick={() => navigate('/shifts/new')}
            styles={buttonStyles.primary}
          />
        </div>
      </ModernCard>
    );
  }

  return (
    <>
      <ModernCard className="text-center py-8 px-6">
        {/* Large elapsed time display */}
        <div className="mb-4">
          <Text style={{ 
            fontSize: '72px', 
            fontWeight: '800',
            color: '#1f2937',
            lineHeight: '1',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {elapsedTime}
          </Text>
        </div>

        {/* Working at venue description */}
        <div className="mb-6">
          <Text style={{ 
            fontSize: '18px', 
            fontWeight: '500',
            color: '#6b7280',
            marginBottom: '4px'
          }}>
            Working at {activeShift.venue.name}
          </Text>.<br/>
          <Text style={{ 
            fontSize: '16px', 
            fontWeight: '500',
            color: '#6b7280'
          }}>
            {formatShiftTime(activeShift.startTime)} - {formatShiftTime(activeShift.endTime || '')}
          </Text>
        </div>

        {/* Venue dropdown style section */}
        <div className="mb-8">
          <button 
            className="w-full max-w-md mx-auto bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
            onClick={() => navigate(`/shifts/${activeShift.id}`)}
          >
            <div className="text-left">
              <Text style={{ 
                fontSize: '16px', 
                fontWeight: '600',
                color: '#4f46e5'
              }}>
                {activeShift.venue.name}, {formatShiftTime(activeShift.startTime)} - {formatShiftTime(activeShift.endTime || '')}
              </Text>
            </div>
            <Icon iconName="ChevronDown" style={{ fontSize: '16px', color: '#4f46e5' }} />
          </button>
        </div>

        {/* Venue Check Status Indicators */}
        {venueCheckStatus && (
          <div className="mb-6">
            <Text style={{ 
              fontSize: '14px', 
              fontWeight: '600',
              color: '#6b7280',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              Required Checks
            </Text>
            <div className="flex items-center justify-center space-x-4">
              {venueCheckStatus.fireExitCheck.required && (
                <div className="flex flex-col items-center space-y-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    venueCheckStatus.fireExitCheck.completed 
                      ? 'bg-green-100' 
                      : 'bg-orange-100'
                  }`}>
                    <Icon 
                      iconName={venueCheckStatus.fireExitCheck.completed ? 'CheckMark' : 'FirewallProtected'} 
                      style={{ 
                        fontSize: '14px', 
                        color: venueCheckStatus.fireExitCheck.completed ? '#059669' : '#f59e0b' 
                      }} 
                    />
                  </div>
                  <Text style={{ fontSize: '10px', color: '#6b7280', fontWeight: '500' }}>
                    Fire
                  </Text>
                </div>
              )}
              
              {venueCheckStatus.capacityCheck.required && (
                <div className="flex flex-col items-center space-y-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    venueCheckStatus.capacityCheck.completed 
                      ? 'bg-green-100' 
                      : 'bg-orange-100'
                  }`}>
                    <Icon 
                      iconName={venueCheckStatus.capacityCheck.completed ? 'CheckMark' : 'People'} 
                      style={{ 
                        fontSize: '14px', 
                        color: venueCheckStatus.capacityCheck.completed ? '#059669' : '#f59e0b' 
                      }} 
                    />
                  </div>
                  <Text style={{ fontSize: '10px', color: '#6b7280', fontWeight: '500' }}>
                    Capacity
                  </Text>
                </div>
              )}
              
              {venueCheckStatus.toiletCheck.required && (
                <div className="flex flex-col items-center space-y-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    venueCheckStatus.toiletCheck.completed 
                      ? 'bg-green-100' 
                      : 'bg-orange-100'
                  }`}>
                    <Icon 
                      iconName={venueCheckStatus.toiletCheck.completed ? 'CheckMark' : 'Health'} 
                      style={{ 
                        fontSize: '14px', 
                        color: venueCheckStatus.toiletCheck.completed ? '#059669' : '#f59e0b' 
                      }} 
                    />
                  </div>
                  <Text style={{ fontSize: '10px', color: '#6b7280', fontWeight: '500' }}>
                    Toilet
                  </Text>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center space-x-4">
          <PrimaryButton
            text="End Shift"
            onClick={handleCheckOut}
            styles={{
              root: {
                backgroundColor: '#4f46e5',
                borderRadius: '12px',
                height: '48px',
                fontSize: '16px',
                fontWeight: '600',
                minWidth: '140px',
                border: 'none'
              }
            }}
          />
        </div>

        {/* Quick actions menu */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center justify-center space-x-6">
            <button 
              className="flex flex-col items-center space-y-2 text-gray-600 hover:text-blue-600 transition-colors duration-200"
              onClick={handleLogChecks}
            >
              <Icon iconName="CheckList" style={{ fontSize: '20px' }} />
              <Text style={{ fontSize: '12px', fontWeight: '500' }}>Quick Check</Text>
            </button>
            <button 
              className="flex flex-col items-center space-y-2 text-gray-600 hover:text-purple-600 transition-colors duration-200"
              onClick={() => navigate(`/shifts/${activeShift.id}/checks`)}
            >
              <Icon iconName="ContactInfo" style={{ fontSize: '20px' }} />
              <Text style={{ fontSize: '12px', fontWeight: '500' }}>All Checks</Text>
            </button>
            <button 
              className="flex flex-col items-center space-y-2 text-gray-600 hover:text-orange-600 transition-colors duration-200"
              onClick={handleViewHistory}
            >
              <Icon iconName="History" style={{ fontSize: '20px' }} />
              <Text style={{ fontSize: '12px', fontWeight: '500' }}>History</Text>
            </button>
            <button 
              className="flex flex-col items-center space-y-2 text-gray-600 hover:text-green-600 transition-colors duration-200"
              onClick={() => navigate(`/shifts/${activeShift.id}`)}
            >
              <Icon iconName="View" style={{ fontSize: '20px' }} />
              <Text style={{ fontSize: '12px', fontWeight: '500' }}>Details</Text>
            </button>
          </div>
        </div>
      </ModernCard>
      
      {/* Venue Check Modal */}
      <VenueCheckModal
        isOpen={showChecksModal}
        onClose={handleCloseModal}
        checkType={checkType}
        onCheckTypeChange={setCheckType}
        shiftId={activeShift?.id}
        venue={activeShift?.venue}
      />

      {/* Check History Modal */}
      <CheckHistoryModal
        isOpen={showHistoryModal}
        onClose={handleCloseHistoryModal}
        shiftId={activeShift?.id}
      />

      <style>{`
        @keyframes shimmer {
          0% { opacity: 0.8; }
          50% { opacity: 1; }
          100% { opacity: 0.8; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
});

// VenueCheckModal Component
interface VenueCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkType: 'fire' | 'capacity' | 'toilet' | null;
  onCheckTypeChange: (checkType: 'fire' | 'capacity' | 'toilet') => void;
  shiftId?: number;
  venue?: ActiveShift['venue'];
}

const VenueCheckModal: React.FC<VenueCheckModalProps> = ({ 
  isOpen, 
  onClose, 
  checkType, 
  onCheckTypeChange,
  shiftId, 
  venue 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form states
  const [exitName, setExitName] = useState('');
  const [isPassed, setIsPassed] = useState(true);
  const [count, setCount] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState<ConditionRating>(ConditionRating.GOOD);
  const [comments, setComments] = useState('');

  const resetForm = useCallback(() => {
    setExitName('');
    setIsPassed(true);
    setCount('');
    setLocation('');
    setCondition(ConditionRating.GOOD);
    setComments('');
    setError(null);
    setSuccess(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!shiftId || !checkType) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const checkData = {
        shift: shiftId,
        timestamp: new Date().toISOString(),
        comments
      };

      switch (checkType) {
        case 'fire':
          if (!exitName.trim()) {
            setError('Exit name is required');
            return;
          }
          await shiftService.addFireExitCheck(shiftId, {
            exitName,
            isPassed,
            comments
          });
          break;
        
        case 'capacity':
          if (!count.trim() || isNaN(Number(count))) {
            setError('Valid count is required');
            return;
          }
          await shiftService.addCapacityCheck(shiftId, {
            count: Number(count),
            comments
          });
          break;
        
        case 'toilet':
          if (!location.trim()) {
            setError('Location is required');
            return;
          }
          await shiftService.addToiletCheck(shiftId, {
            location,
            condition,
            comments
          });
          break;
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setError('Failed to log check. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [shiftId, checkType, exitName, isPassed, count, location, condition, comments, handleClose]);

  const getModalTitle = () => {
    switch (checkType) {
      case 'fire': return '🔥 Fire Safety Check';
      case 'capacity': return '👥 Capacity Check';
      case 'toilet': return '🚻 Toilet Check';
      default: return 'Venue Check';
    }
  };

  const exitOptions: IDropdownOption[] = [
    { key: 'Main Exit', text: 'Main Exit' },
    { key: 'Fire Exit 1', text: 'Fire Exit 1' },
    { key: 'Fire Exit 2', text: 'Fire Exit 2' },
    { key: 'Emergency Exit', text: 'Emergency Exit' },
    { key: 'Side Exit', text: 'Side Exit' }
  ];

  const conditionOptions: IDropdownOption[] = [
    { key: ConditionRating.EXCELLENT, text: 'Excellent' },
    { key: ConditionRating.GOOD, text: 'Good' },
    { key: ConditionRating.FAIR, text: 'Fair' },
    { key: ConditionRating.POOR, text: 'Poor' },
    { key: ConditionRating.CRITICAL, text: 'Critical' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={handleClose}
      isBlocking={false}
      styles={{
        main: {
          borderRadius: '16px',
          overflow: 'hidden'
        }
      }}
    >
      <div className="bg-white rounded-2xl p-6 min-w-[400px] max-w-[500px] shadow-xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Text style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
              {getModalTitle()}
            </Text>
            <DefaultButton
              iconProps={{ iconName: 'Cancel' }}
              onClick={handleClose}
              styles={{
                root: { 
                  minWidth: 'auto', 
                  padding: '8px',
                  borderRadius: '8px'
                }
              }}
            />
          </div>

          {error && (
            <MessageBar messageBarType={MessageBarType.error}>
              {error}
            </MessageBar>
          )}

          {success && (
            <MessageBar messageBarType={MessageBarType.success}>
              Check logged successfully!
            </MessageBar>
          )}

          {/* Check Type Selector */}
          <Dropdown
            label="Check Type"
            options={[
              { key: 'fire', text: '🔥 Fire Safety Check', data: { icon: 'FirewallProtected' } },
              { key: 'capacity', text: '👥 Capacity Check', data: { icon: 'People' } },
              { key: 'toilet', text: '🚻 Toilet Check', data: { icon: 'Health' } }
            ]}
            selectedKey={checkType}
            onChange={(_, option) => {
              const newCheckType = option?.key as 'fire' | 'capacity' | 'toilet';
              onCheckTypeChange(newCheckType);
              // Reset form fields when changing check type
              setExitName('');
              setIsPassed(true);
              setCount('');
              setLocation('');
              setCondition(ConditionRating.GOOD);
              setComments('');
              setError(null);
              setSuccess(false);
            }}
            styles={{
              dropdown: { borderRadius: '8px' }
            }}
          />

          <div className="space-y-4">
            {checkType === 'fire' && (
              <>
                <Dropdown
                  label="Exit Name"
                  options={exitOptions}
                  selectedKey={exitName}
                  onChange={(_, option) => setExitName(option?.key as string || '')}
                  required
                  styles={{ dropdown: { borderRadius: '8px' } }}
                />
                <Dropdown
                  label="Status"
                  options={[
                    { key: 'passed', text: '✅ Clear' },
                    { key: 'failed', text: '❌ Blocked' }
                  ]}
                  selectedKey={isPassed ? 'passed' : 'failed'}
                  onChange={(_, option) => setIsPassed(option?.key === 'passed')}
                  styles={{ dropdown: { borderRadius: '8px' } }}
                />
              </>
            )}

            {checkType === 'capacity' && (
              <>
                <TextField
                  label="Current Count"
                  type="number"
                  value={count}
                  onChange={(_, value) => setCount(value || '')}
                  required
                  suffix="people"
                  styles={{ fieldGroup: { borderRadius: '8px' } }}
                />
                {venue?.maxCapacity && (
                  <Text style={{ fontSize: '14px', color: '#6b7280' }}>
                    Maximum capacity: {venue.maxCapacity} people
                  </Text>
                )}
              </>
            )}

            {checkType === 'toilet' && (
              <>
                <TextField
                  label="Location"
                  value={location}
                  onChange={(_, value) => setLocation(value || '')}
                  required
                  placeholder="e.g., Ground Floor Men's"
                  styles={{ fieldGroup: { borderRadius: '8px' } }}
                />
                <Dropdown
                  label="Condition"
                  options={conditionOptions}
                  selectedKey={condition}
                  onChange={(_, option) => setCondition(option?.key as ConditionRating)}
                  styles={{ dropdown: { borderRadius: '8px' } }}
                />
              </>
            )}

            <TextField
              label="Comments"
              multiline
              rows={3}
              value={comments}
              onChange={(_, value) => setComments(value || '')}
              placeholder="Optional notes about this check..."
              styles={{ fieldGroup: { borderRadius: '8px' } }}
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <DefaultButton
              text="Cancel"
              onClick={handleClose}
              disabled={isSubmitting}
              styles={{
                root: {
                  flex: 1,
                  height: '48px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600'
                }
              }}
            />
            <PrimaryButton
              text={isSubmitting ? 'Saving...' : 'Log Check'}
              onClick={handleSubmit}
              disabled={isSubmitting || success}
              styles={{
                root: {
                  flex: 1,
                  height: '48px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  backgroundColor: '#dc2626',
                  border: 'none'
                }
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Check History Modal Component
interface CheckHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId?: number;
}

const CheckHistoryModal: React.FC<CheckHistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  shiftId 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [fireChecks, setFireChecks] = useState<FireExitCheck[]>([]);
  const [capacityChecks, setCapacityChecks] = useState<CapacityCheck[]>([]);
  const [toiletChecks, setToiletChecks] = useState<ToiletCheck[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadCheckHistory = useCallback(async () => {
    if (!shiftId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [fireData, capacityData, toiletData] = await Promise.all([
        shiftService.getFireExitChecks(shiftId).catch(() => []),
        shiftService.getCapacityChecks(shiftId).catch(() => []),
        shiftService.getToiletChecks(shiftId).catch(() => [])
      ]);

      setFireChecks(fireData);
      setCapacityChecks(capacityData);
      setToiletChecks(toiletData);
    } catch (err) {
      setError('Failed to load check history');
    } finally {
      setIsLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    if (isOpen && shiftId) {
      loadCheckHistory();
    }
  }, [isOpen, shiftId, loadCheckHistory]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-GB');
  };

  const totalChecks = fireChecks.length + capacityChecks.length + toiletChecks.length;

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      isBlocking={false}
      styles={{
        main: {
          borderRadius: '16px',
          overflow: 'hidden'
        }
      }}
    >
      <div className="bg-white rounded-2xl p-6 min-w-[600px] max-w-[800px] max-h-[80vh] overflow-auto shadow-xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Text style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
              📋 Check History
            </Text>
            <DefaultButton
              iconProps={{ iconName: 'Cancel' }}
              onClick={onClose}
              styles={{
                root: { 
                  minWidth: 'auto', 
                  padding: '8px',
                  borderRadius: '8px'
                }
              }}
            />
          </div>

          {error && (
            <MessageBar messageBarType={MessageBarType.error}>
              {error}
            </MessageBar>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center space-y-4 py-12">
              <Spinner size={SpinnerSize.medium} />
              <Text style={{ color: '#6b7280' }}>Loading check history...</Text>
            </div>
          ) : (
            <div className="space-y-6">
              {totalChecks === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                    <Icon iconName="CheckList" className="text-gray-400" style={{ fontSize: '24px' }} />
                  </div>
                  <Text style={{ fontSize: '18px', color: '#6b7280', fontWeight: '600' }}>
                    No checks logged yet
                  </Text>
                  <Text style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px' }}>
                    Start logging venue checks to see them here
                  </Text>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <Text style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                      Total checks logged: {totalChecks}
                    </Text>
                  </div>

                  {/* Fire Exit Checks */}
                  {fireChecks.length > 0 && (
                    <div className="space-y-3">
                      <Text style={{ fontSize: '18px', fontWeight: '600', color: '#dc2626' }}>
                        🔥 Fire Safety Checks ({fireChecks.length})
                      </Text>
                      <div className="space-y-2">
                        {fireChecks.map((check, index) => (
                          <div key={check.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <Text style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                                  {check.exitName}
                                </Text>
                                <Text style={{ fontSize: '12px', color: '#6b7280' }}>
                                  {formatDate(check.timestamp)} at {formatTime(check.timestamp)}
                                </Text>
                                {check.comments && (
                                  <Text style={{ fontSize: '12px', color: '#6b7280' }}>
                                    {check.comments}
                                  </Text>
                                )}
                              </div>
                              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                check.isPassed 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {check.isPassed ? '✅ Clear' : '❌ Blocked'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other check types would follow similar pattern... */}
                </>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <PrimaryButton
              text="Close"
              onClick={onClose}
              styles={{
                root: {
                  backgroundColor: '#dc2626',
                  border: 'none',
                  borderRadius: '12px',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: '600',
                  minWidth: '120px'
                }
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

// Helper function to get condition colors
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

export default ActiveShiftWidget;