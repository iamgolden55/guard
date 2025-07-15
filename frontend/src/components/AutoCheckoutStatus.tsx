import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Icon,
  ProgressIndicator,
  MessageBar,
  MessageBarType,
  Link,
  DefaultButton
} from '@fluentui/react';
import { Card } from '.';
import { shiftService } from '../services';
import type { Shift } from '../types';

interface AutoCheckoutStatusProps {
  currentShift?: Shift;
  onCheckOutClick?: () => void;
}

interface VenueCheckRequirement {
  type: 'fire_safety' | 'capacity' | 'toilet';
  name: string;
  completed: boolean;
  required: boolean;
}

const AutoCheckoutStatus: React.FC<AutoCheckoutStatusProps> = ({ 
  currentShift,
  onCheckOutClick 
}) => {
  const [checkRequirements, setCheckRequirements] = useState<VenueCheckRequirement[]>([]);
  const [timeUntilAutoCheckout, setTimeUntilAutoCheckout] = useState<string | null>(null);
  const [isEligible, setIsEligible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isForceTimeoutEligible, setIsForceTimeoutEligible] = useState(false);

  useEffect(() => {
    if (!currentShift || currentShift.status !== 'in_progress') {
      setCheckRequirements([]);
      setTimeUntilAutoCheckout(null);
      setIsEligible(false);
      return;
    }

    loadCheckRequirements();
    const interval = setInterval(updateTimeStatus, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [currentShift]);

  const loadCheckRequirements = async () => {
    if (!currentShift) return;

    setLoading(true);
    try {
      // Fetch real check requirements and completion status from API
      const checkStatus = await shiftService.getVenueCheckStatus(currentShift.id);
      
      const requirements: VenueCheckRequirement[] = [
        {
          type: 'fire_safety',
          name: 'Fire Exit Checks',
          required: checkStatus.fireExitCheck.required,
          completed: checkStatus.fireExitCheck.completed
        },
        {
          type: 'capacity',
          name: 'Capacity Monitoring',
          required: checkStatus.capacityCheck.required,
          completed: checkStatus.capacityCheck.completed
        },
        {
          type: 'toilet',
          name: 'Toilet Checks',
          required: checkStatus.toiletCheck.required,
          completed: checkStatus.toiletCheck.completed
        }
      ].filter(req => req.required);

      setCheckRequirements(requirements);
      updateEligibilityStatus(requirements);
    } catch (error) {
      console.error('Failed to load check requirements:', error);
      // Fallback to venue-based requirements if API fails
      const fallbackRequirements: VenueCheckRequirement[] = [
        {
          type: 'fire_safety',
          name: 'Fire Exit Checks',
          required: currentShift.venue.requiresFireSafetyChecks || false,
          completed: false
        },
        {
          type: 'capacity',
          name: 'Capacity Monitoring',
          required: currentShift.venue.requiresCapacityMonitoring || false,
          completed: false
        },
        {
          type: 'toilet',
          name: 'Toilet Checks',
          required: currentShift.venue.requiresToiletChecks || false,
          completed: false
        }
      ].filter(req => req.required);
      
      setCheckRequirements(fallbackRequirements);
      updateEligibilityStatus(fallbackRequirements);
    } finally {
      setLoading(false);
    }
  };

  const updateEligibilityStatus = (requirements: VenueCheckRequirement[]) => {
    const allCompleted = requirements.length === 0 || requirements.every(req => req.completed);
    setIsEligible(allCompleted);
  };

  const updateTimeStatus = () => {
    if (!currentShift?.endTime) return;

    const now = new Date();
    const shiftEnd = new Date(currentShift.endTime);
    const autoCheckoutTime = new Date(shiftEnd.getTime() + 30 * 60 * 1000); // +30 minutes
    const forceTimeoutTime = new Date(shiftEnd.getTime() + 12 * 60 * 60 * 1000); // +12 hours

    // Check if force timeout is eligible
    setIsForceTimeoutEligible(now >= forceTimeoutTime);

    if (now >= forceTimeoutTime) {
      setTimeUntilAutoCheckout('Force timeout active - Auto-checkout available regardless of checks');
    } else if (now >= autoCheckoutTime) {
      const hoursUntilForceTimeout = Math.ceil((forceTimeoutTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      setTimeUntilAutoCheckout(`Auto-checkout available now (Force timeout in ${hoursUntilForceTimeout}h)`);
    } else if (now >= shiftEnd) {
      const minutesLeft = Math.ceil((autoCheckoutTime.getTime() - now.getTime()) / (1000 * 60));
      setTimeUntilAutoCheckout(`Auto-checkout in ${minutesLeft} minutes`);
    } else {
      const minutesLeft = Math.ceil((shiftEnd.getTime() - now.getTime()) / (1000 * 60));
      setTimeUntilAutoCheckout(`Shift ends in ${minutesLeft} minutes`);
    }
  };

  const getCompletionProgress = () => {
    if (checkRequirements.length === 0) return 1;
    const completed = checkRequirements.filter(req => req.completed).length;
    return completed / checkRequirements.length;
  };

  if (!currentShift || currentShift.status !== 'in_progress') {
    return null;
  }

  return (
    <Card className="p-4">
      <Stack tokens={{ childrenGap: 16 }}>
        {/* Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            <Icon iconName="Clock" className="text-blue-600" />
            <Text variant="mediumPlus" className="font-semibold">
              Smart Checkout Protection
            </Text>
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 8 }}>
            <DefaultButton
              iconProps={{ iconName: "Refresh" }}
              onClick={loadCheckRequirements}
              disabled={loading}
              title="Refresh check status"
            />
            {currentShift.autoCheckout && (
              <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                Auto-checked out
              </div>
            )}
          </Stack>
        </Stack>

        {/* Status Messages */}
        {isForceTimeoutEligible ? (
          <MessageBar messageBarType={MessageBarType.error}>
            <Text className="font-medium">
              🚨 Force timeout active! Auto-checkout will occur soon due to excessive overtime. Please check out manually if still on duty.
            </Text>
          </MessageBar>
        ) : isEligible && timeUntilAutoCheckout?.includes('Auto-checkout available now') ? (
          <MessageBar messageBarType={MessageBarType.success}>
            <Text className="font-medium">
              ✅ You're protected! Auto-checkout will occur if you forget to check out manually.
            </Text>
          </MessageBar>
        ) : isEligible ? (
          <MessageBar messageBarType={MessageBarType.info}>
            <Text>
              🛡️ All duties completed. {timeUntilAutoCheckout}
            </Text>
          </MessageBar>
        ) : (
          <MessageBar messageBarType={MessageBarType.warning}>
            <Text>
              ⚠️ Complete all venue requirements to be eligible for auto-checkout protection.
              {timeUntilAutoCheckout && <><br />{timeUntilAutoCheckout}</>}
            </Text>
          </MessageBar>
        )}

        {/* Requirements Progress */}
        {checkRequirements.length > 0 && (
          <Stack tokens={{ childrenGap: 12 }}>
            <Stack horizontal horizontalAlign="space-between">
              <Text variant="medium" className="font-semibold">
                Venue Requirements
              </Text>
              <Text variant="small" className="text-gray-600">
                {checkRequirements.filter(req => req.completed).length} of {checkRequirements.length} completed
              </Text>
            </Stack>
            
            <ProgressIndicator 
              percentComplete={getCompletionProgress()}
              description={`${Math.round(getCompletionProgress() * 100)}% complete`}
            />

            <Stack tokens={{ childrenGap: 8 }}>
              {checkRequirements.map((requirement, index) => (
                <Stack key={index} horizontal horizontalAlign="space-between" verticalAlign="center">
                  <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                    <Icon 
                      iconName={requirement.completed ? "CheckMark" : "Circle"} 
                      className={requirement.completed ? "text-green-600" : "text-gray-400"}
                    />
                    <Text variant="small">{requirement.name}</Text>
                  </Stack>
                  {requirement.completed ? (
                    <Text variant="small" className="text-green-600 font-medium">Complete</Text>
                  ) : (
                    <Link 
                      href="/shifts/checks" 
                      className="text-blue-600 text-sm"
                    >
                      Add Check
                    </Link>
                  )}
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}

        {/* Manual Checkout Option */}
        <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center">
          <Text variant="small" className="text-gray-600">
            You can still check out manually at any time
          </Text>
          {onCheckOutClick && (
            <Link onClick={onCheckOutClick} className="text-blue-600 font-medium">
              Check Out Now
            </Link>
          )}
        </Stack>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="start">
            <Icon iconName="Info" className="text-blue-600 mt-1" />
            <Stack>
              <Text variant="small" className="text-blue-800">
                <strong>How it works:</strong> Complete all venue requirements and our system will 
                automatically check you out 30 minutes after your scheduled end time if you forget. 
                You'll be paid for your actual hours worked.
              </Text>
            </Stack>
          </Stack>
        </div>
      </Stack>
    </Card>
  );
};

export default AutoCheckoutStatus;