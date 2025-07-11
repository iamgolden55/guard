import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Icon,
  ProgressIndicator,
  MessageBar,
  MessageBarType,
  Link
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
      // Mock check requirements based on venue - in real app, fetch from API
      const requirements: VenueCheckRequirement[] = [
        {
          type: 'fire_safety',
          name: 'Fire Exit Checks',
          required: currentShift.venue.requiresFireSafetyChecks || false,
          completed: false // Would fetch from API
        },
        {
          type: 'capacity',
          name: 'Capacity Monitoring',
          required: currentShift.venue.requiresCapacityMonitoring || false,
          completed: false // Would fetch from API
        },
        {
          type: 'toilet',
          name: 'Toilet Checks',
          required: currentShift.venue.requiresToiletChecks || false,
          completed: false // Would fetch from API
        }
      ].filter(req => req.required);

      setCheckRequirements(requirements);
      updateEligibilityStatus(requirements);
    } catch (error) {
      console.error('Failed to load check requirements:', error);
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

    if (now >= autoCheckoutTime) {
      setTimeUntilAutoCheckout('Auto-checkout available now');
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
          {currentShift.autoCheckout && (
            <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
              Auto-checked out
            </div>
          )}
        </Stack>

        {/* Status Messages */}
        {isEligible && timeUntilAutoCheckout === 'Auto-checkout available now' ? (
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