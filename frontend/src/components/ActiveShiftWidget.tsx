import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  Spinner,
  SpinnerSize,
  Icon,
  useTheme,
  mergeStyles,
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
import useIsMobile from '../hooks/useIsMobile';

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
  // Additional fields that might be present
  actual_start_time?: string;
  actual_end_time?: string | null;
}

const ActiveShiftWidget: React.FC = React.memo(() => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('');
  const [showChecksModal, setShowChecksModal] = useState(false);
  const [checkType, setCheckType] = useState<'fire' | 'capacity' | 'toilet' | null>('fire');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Update current time every minute (much more efficient)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);
      
      // Calculate elapsed time here to avoid separate useEffect
      if (activeShift) {
        const checkInTime = activeShift.checkInTime || activeShift.actual_start_time;
        const startTime = checkInTime ? new Date(checkInTime) : new Date(activeShift.startTime);
        const diffMs = now.getTime() - startTime.getTime();
        
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        setElapsedTime(`${hours}h ${minutes}m`);
      }
    };

    // Update immediately
    updateTime();
    
    // Then update every minute (60000ms) instead of every second
    const interval = setInterval(updateTime, 60000);

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
      } catch (error) {
        console.error('Error loading active shift:', error);
        // Don't clear activeShift on error to avoid jarring UX
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    loadActiveShift(true); // Initial load
    
    // Refresh every 2 minutes (120000ms) instead of 30 seconds for better performance
    const interval = setInterval(() => loadActiveShift(false), 120000);
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

  const containerStyle = mergeStyles({
    background: `linear-gradient(135deg, ${theme.palette.themePrimary} 0%, ${theme.palette.themeDark} 100%)`,
    borderRadius: '12px',
    padding: isMobile ? '20px 16px' : '24px',
    color: theme.palette.white,
    boxShadow: theme.effects.elevation8,
    marginBottom: '16px',
    position: 'relative',
    overflow: 'hidden',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      zIndex: 0
    },
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' }
    }
  });

  const contentStyle = mergeStyles({
    position: 'relative',
    zIndex: 1
  });


  const buttonStyle = useMemo(() => ({
    root: {
      backgroundColor: theme.palette.white,
      color: theme.palette.themePrimary,
      border: 'none',
      fontWeight: '600',
      minWidth: isMobile ? '120px' : '140px',
      height: isMobile ? '36px' : '40px'
    }
  }), [theme.palette.white, theme.palette.themePrimary, isMobile]);

  const secondaryButtonStyle = useMemo(() => ({
    root: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      color: theme.palette.white,
      border: `1px solid rgba(255, 255, 255, 0.3)`,
      fontWeight: '600',
      minWidth: isMobile ? '100px' : '120px',
      height: isMobile ? '36px' : '40px'
    }
  }), [theme.palette.white, isMobile]);

  if (isLoading) {
    return (
      <div className={containerStyle}>
        <div className={contentStyle}>
          <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }}>
            <Spinner size={SpinnerSize.medium} />
            <Text style={{ color: theme.palette.white }}>Checking for active shift...</Text>
          </Stack>
        </div>
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className={containerStyle}>
        <div className={contentStyle}>
          <Stack tokens={{ childrenGap: 16 }}>
            <Text style={{ color: theme.palette.white, textAlign: 'center' }}>
              No active shift found
            </Text>
            <Text variant="small" style={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' }}>
              Check console for debugging info
            </Text>
          </Stack>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={containerStyle}>
        <div className={contentStyle}>
          <Stack tokens={{ childrenGap: isMobile ? 16 : 20 }}>
            {/* Header with status */}
            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                <Icon 
                  iconName={isRefreshing ? "Sync" : "Clock"} 
                  style={{ 
                    fontSize: '20px', 
                    color: theme.palette.white,
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                  }} 
                />
                <Text 
                  variant={isMobile ? "medium" : "mediumPlus"} 
                  style={{ 
                    color: theme.palette.white, 
                    fontWeight: '600' 
                  }}
                >
                  SHIFT IN PROGRESS
                </Text>
              </Stack>
              <Text 
                variant="small" 
                style={{ 
                  color: 'rgba(255, 255, 255, 0.9)',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontWeight: '600'
                }}
              >
                {elapsedTime}
              </Text>
            </Stack>

            {/* Current time display */}
            

            {/* Shift details */}
            <Stack 
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: isMobile ? '12px' : '16px'
              }}
              tokens={{ childrenGap: 8 }}
            >
              <Stack horizontal horizontalAlign="space-between">
                <Text 
                  variant={isMobile ? "medium" : "mediumPlus"} 
                  style={{ color: theme.palette.white, fontWeight: '600' }}
                >
                  {activeShift.venue.name}
                </Text>
                <Stack horizontal tokens={{ childrenGap: 4 }}>
                  <Icon iconName="MapPin" style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }} />
                </Stack>
              </Stack>
              
              <Text 
                variant="small" 
                style={{ color: 'rgba(255, 255, 255, 0.9)' }}
              >
                Scheduled: {formatShiftTime(activeShift.startTime)} - {formatShiftTime(activeShift.endTime || '')}
              </Text>
              
              {(activeShift.checkInTime || activeShift.actual_start_time) ? (
                <Text 
                  variant="small" 
                  style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                >
                  Checked in: {formatShiftTime(activeShift.checkInTime || activeShift.actual_start_time || '')}
                </Text>
              ) : (
                <Text 
                  variant="small" 
                  style={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  Started: {formatShiftTime(activeShift.startTime)}
                </Text>
              )}
            </Stack>

            {/* Venue Requirements Section */}
            
            
            {/* Hide venue requirements section since we now have Log Checks button */}
            {false && (activeShift.venue.requiresFireSafetyChecks || activeShift.venue.requiresCapacityMonitoring || activeShift.venue.requiresToiletChecks || true) && (
              <Stack 
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: isMobile ? '12px' : '16px',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
                tokens={{ childrenGap: 12 }}
              >
                <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Text 
                    variant={isMobile ? "medium" : "mediumPlus"} 
                    style={{ color: theme.palette.white, fontWeight: '600' }}
                  >
                    📋 Venue Requirements
                  </Text>
                  <DefaultButton
                    text="View History"
                    iconProps={{ iconName: 'History' }}
                    onClick={handleViewHistory}
                    styles={{
                      root: {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        color: theme.palette.white,
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        minWidth: 'auto',
                        padding: '4px 12px',
                        height: '28px'
                      }
                    }}
                  />
                </Stack>
                
                <Stack tokens={{ childrenGap: 8 }}>
                  {/* Fire Safety Checks - show if required OR always for testing */}
                  {(activeShift.venue.requiresFireSafetyChecks || true) && (
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="FirewallProtected" style={{ color: '#ff6b6b', fontSize: '16px' }} />
                        <Text variant="small" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                          Fire Safety Checks
                          {!activeShift.venue.requiresFireSafetyChecks && (
                            <span style={{ opacity: 0.7 }}> (Optional)</span>
                          )}
                        </Text>
                      </Stack>
                      <DefaultButton
                        text="Add Check"
                        iconProps={{ iconName: 'Add' }}
                        onClick={() => handleLogCheck('fire')}
                        styles={{
                          root: {
                            backgroundColor: 'rgba(255, 107, 107, 0.2)',
                            color: '#ff6b6b',
                            border: '1px solid rgba(255, 107, 107, 0.3)',
                            minWidth: 'auto',
                            padding: '4px 12px',
                            height: '28px'
                          }
                        }}
                      />
                    </Stack>
                  )}
                  
                  {/* Capacity Monitoring - show if required OR always for testing */}
                  {(activeShift.venue.requiresCapacityMonitoring || true) && (
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="People" style={{ color: '#4ecdc4', fontSize: '16px' }} />
                        <Text variant="small" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                          Capacity Monitoring
                          {!activeShift.venue.requiresCapacityMonitoring && (
                            <span style={{ opacity: 0.7 }}> (Optional)</span>
                          )}
                        </Text>
                      </Stack>
                      <DefaultButton
                        text="Add Check"
                        iconProps={{ iconName: 'Add' }}
                        onClick={() => handleLogCheck('capacity')}
                        styles={{
                          root: {
                            backgroundColor: 'rgba(78, 205, 196, 0.2)',
                            color: '#4ecdc4',
                            border: '1px solid rgba(78, 205, 196, 0.3)',
                            minWidth: 'auto',
                            padding: '4px 12px',
                            height: '28px'
                          }
                        }}
                      />
                    </Stack>
                  )}
                  
                  {/* Toilet Checks - show if required OR always for testing */}
                  {(activeShift.venue.requiresToiletChecks || true) && (
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Icon iconName="Health" style={{ color: '#95e1d3', fontSize: '16px' }} />
                        <Text variant="small" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                          Toilet Checks
                          {!activeShift.venue.requiresToiletChecks && (
                            <span style={{ opacity: 0.7 }}> (Optional)</span>
                          )}
                        </Text>
                      </Stack>
                      <DefaultButton
                        text="Add Check"
                        iconProps={{ iconName: 'Add' }}
                        onClick={() => handleLogCheck('toilet')}
                        styles={{
                          root: {
                            backgroundColor: 'rgba(149, 225, 211, 0.2)',
                            color: '#95e1d3',
                            border: '1px solid rgba(149, 225, 211, 0.3)',
                            minWidth: 'auto',
                            padding: '4px 12px',
                            height: '28px'
                          }
                        }}
                      />
                    </Stack>
                  )}
                </Stack>
              </Stack>
            )}

            {/* Action buttons */}
            <Stack 
              horizontal={!isMobile} 
              tokens={{ childrenGap: 12 }} 
              horizontalAlign="center"
            >
              <PrimaryButton
                text="Check Out"
                iconProps={{ iconName: 'SignOut' }}
                onClick={handleCheckOut}
                styles={buttonStyle}
              />
              <DefaultButton
                text="Log Checks"
                iconProps={{ iconName: 'CheckList' }}
                onClick={handleLogChecks}
                styles={secondaryButtonStyle}
              />
            </Stack>

            {/* Help text */}
            <Text 
              variant="small" 
              style={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                textAlign: 'center',
                fontStyle: 'italic'
              }}
            >
              Tap "Check Out" for breaks, "Log Checks" for venue requirements
            </Text>
          </Stack>
        </div>
      </div>
      
      {/* Venue Check Modal */}
      <VenueCheckModal
        isOpen={showChecksModal}
        onClose={handleCloseModal}
        checkType={checkType}
        onCheckTypeChange={setCheckType}
        shiftId={activeShift?.id}
        venue={activeShift?.venue}
        isMobile={isMobile}
      />

      {/* Check History Modal */}
      <CheckHistoryModal
        isOpen={showHistoryModal}
        onClose={handleCloseHistoryModal}
        shiftId={activeShift?.id}
        isMobile={isMobile}
      />
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
  isMobile: boolean;
}

const VenueCheckModal: React.FC<VenueCheckModalProps> = ({ 
  isOpen, 
  onClose, 
  checkType, 
  onCheckTypeChange,
  shiftId, 
  venue, 
  isMobile 
}) => {
  const theme = useTheme();
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
      containerClassName={mergeStyles({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      })}
    >
      <div className={mergeStyles({
        backgroundColor: theme.palette.white,
        borderRadius: '8px',
        padding: '24px',
        minWidth: isMobile ? '90vw' : '400px',
        maxWidth: isMobile ? '90vw' : '500px',
        boxShadow: theme.effects.elevation16
      })}>
        <Stack tokens={{ childrenGap: 20 }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text variant="xLarge" style={{ fontWeight: '600' }}>
              {getModalTitle()}
            </Text>
            <DefaultButton
              iconProps={{ iconName: 'Cancel' }}
              onClick={handleClose}
              styles={{
                root: { minWidth: 'auto', padding: '8px' }
              }}
            />
          </Stack>

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
          />

          <Stack tokens={{ childrenGap: 16 }}>
            {checkType === 'fire' && (
              <>
                <Dropdown
                  label="Exit Name"
                  options={exitOptions}
                  selectedKey={exitName}
                  onChange={(_, option) => setExitName(option?.key as string || '')}
                  required
                />
                <Dropdown
                  label="Status"
                  options={[
                    { key: 'passed', text: '✅ Clear' },
                    { key: 'failed', text: '❌ Blocked' }
                  ]}
                  selectedKey={isPassed ? 'passed' : 'failed'}
                  onChange={(_, option) => setIsPassed(option?.key === 'passed')}
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
                />
                {venue?.maxCapacity && (
                  <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
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
                />
                <Dropdown
                  label="Condition"
                  options={conditionOptions}
                  selectedKey={condition}
                  onChange={(_, option) => setCondition(option?.key as ConditionRating)}
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
            />
          </Stack>

          <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 12 }}>
            <DefaultButton
              text="Cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            />
            <PrimaryButton
              text={isSubmitting ? 'Saving...' : 'Log Check'}
              onClick={handleSubmit}
              disabled={isSubmitting || success}
            />
          </Stack>
        </Stack>
      </div>
    </Modal>
  );
};

// Check History Modal Component
interface CheckHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId?: number;
  isMobile: boolean;
}

const CheckHistoryModal: React.FC<CheckHistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  shiftId, 
  isMobile 
}) => {
  const theme = useTheme();
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
      containerClassName={mergeStyles({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      })}
    >
      <div className={mergeStyles({
        backgroundColor: theme.palette.white,
        borderRadius: '8px',
        padding: '24px',
        minWidth: isMobile ? '90vw' : '600px',
        maxWidth: isMobile ? '90vw' : '800px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: theme.effects.elevation16
      })}>
        <Stack tokens={{ childrenGap: 20 }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text variant="xLarge" style={{ fontWeight: '600' }}>
              📋 Check History
            </Text>
            <DefaultButton
              iconProps={{ iconName: 'Cancel' }}
              onClick={onClose}
              styles={{
                root: { minWidth: 'auto', padding: '8px' }
              }}
            />
          </Stack>

          {error && (
            <MessageBar messageBarType={MessageBarType.error}>
              {error}
            </MessageBar>
          )}

          {isLoading ? (
            <Stack horizontalAlign="center" tokens={{ childrenGap: 16 }}>
              <Spinner size={SpinnerSize.medium} />
              <Text>Loading check history...</Text>
            </Stack>
          ) : (
            <Stack tokens={{ childrenGap: 20 }}>
              {totalChecks === 0 ? (
                <Stack horizontalAlign="center" style={{ padding: '40px' }}>
                  <Text variant="medium" style={{ color: theme.palette.neutralSecondary }}>
                    No checks logged yet
                  </Text>
                  <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
                    Start logging venue checks to see them here
                  </Text>
                </Stack>
              ) : (
                <>
                  <Text variant="medium" style={{ fontWeight: '600' }}>
                    Total checks logged: {totalChecks}
                  </Text>

                  {/* Fire Exit Checks */}
                  {fireChecks.length > 0 && (
                    <Stack tokens={{ childrenGap: 12 }}>
                      <Text variant="mediumPlus" style={{ fontWeight: '600', color: '#ff6b6b' }}>
                        🔥 Fire Safety Checks ({fireChecks.length})
                      </Text>
                      <Stack tokens={{ childrenGap: 8 }}>
                        {fireChecks.map((check, index) => (
                          <div key={check.id} style={{
                            border: '1px solid #e1e5e9',
                            borderRadius: '8px',
                            padding: '12px',
                            backgroundColor: '#f8f9fa'
                          }}>
                            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                              <Stack tokens={{ childrenGap: 4 }}>
                                <Text variant="small" style={{ fontWeight: '600' }}>
                                  {check.exitName}
                                </Text>
                                <Text variant="small">
                                  {formatDate(check.timestamp)} at {formatTime(check.timestamp)}
                                </Text>
                                {check.comments && (
                                  <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
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
                  {capacityChecks.length > 0 && (
                    <Stack tokens={{ childrenGap: 12 }}>
                      <Text variant="mediumPlus" style={{ fontWeight: '600', color: '#4ecdc4' }}>
                        👥 Capacity Checks ({capacityChecks.length})
                      </Text>
                      <Stack tokens={{ childrenGap: 8 }}>
                        {capacityChecks.map((check, index) => (
                          <div key={check.id} style={{
                            border: '1px solid #e1e5e9',
                            borderRadius: '8px',
                            padding: '12px',
                            backgroundColor: '#f8f9fa'
                          }}>
                            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                              <Stack tokens={{ childrenGap: 4 }}>
                                <Text variant="small" style={{ fontWeight: '600' }}>
                                  Count: {check.count} people
                                </Text>
                                <Text variant="small">
                                  {formatDate(check.timestamp)} at {formatTime(check.timestamp)}
                                </Text>
                                {check.comments && (
                                  <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
                                    {check.comments}
                                  </Text>
                                )}
                              </Stack>
                              <div style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                backgroundColor: '#e1f5fe',
                                color: '#0277bd',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                #{index + 1}
                              </div>
                            </Stack>
                          </div>
                        ))}
                      </Stack>
                    </Stack>
                  )}

                  {/* Toilet Checks */}
                  {toiletChecks.length > 0 && (
                    <Stack tokens={{ childrenGap: 12 }}>
                      <Text variant="mediumPlus" style={{ fontWeight: '600', color: '#95e1d3' }}>
                        🚻 Toilet Checks ({toiletChecks.length})
                      </Text>
                      <Stack tokens={{ childrenGap: 8 }}>
                        {toiletChecks.map((check, index) => (
                          <div key={check.id} style={{
                            border: '1px solid #e1e5e9',
                            borderRadius: '8px',
                            padding: '12px',
                            backgroundColor: '#f8f9fa'
                          }}>
                            <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                              <Stack tokens={{ childrenGap: 4 }}>
                                <Text variant="small" style={{ fontWeight: '600' }}>
                                  {check.location}
                                </Text>
                                <Text variant="small">
                                  {formatDate(check.timestamp)} at {formatTime(check.timestamp)}
                                </Text>
                                {check.comments && (
                                  <Text variant="small" style={{ color: theme.palette.neutralSecondary }}>
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
                </>
              )}
            </Stack>
          )}

          <Stack horizontal horizontalAlign="end">
            <PrimaryButton
              text="Close"
              onClick={onClose}
            />
          </Stack>
        </Stack>
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