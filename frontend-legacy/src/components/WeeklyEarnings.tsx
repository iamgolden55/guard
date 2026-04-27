import type React from 'react';
import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  DefaultButton,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Icon,
  Separator
} from '@fluentui/react';
import { Card } from '.';
import { fetchWeeklyEarnings, type WeeklyEarnings } from '../services/api';

const WeeklyEarningsComponent: React.FC = () => {
  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWeeklyEarnings();
  }, []);

  const loadWeeklyEarnings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWeeklyEarnings();
      setWeeklyEarnings(data);
    } catch (error) {
      console.error('Failed to load weekly earnings:', error);
      setError('Failed to load weekly earnings. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPaymentDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex justify-center items-center py-8">
          <Spinner size={SpinnerSize.medium} label="Loading weekly earnings..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4">
        <MessageBar messageBarType={MessageBarType.error}>
          {error}
        </MessageBar>
        <div className="mt-3">
          <DefaultButton text="Retry" onClick={loadWeeklyEarnings} />
        </div>
      </Card>
    );
  }

  if (!weeklyEarnings) {
    return null;
  }

  const pendingEstimate = weeklyEarnings.estimated_total - weeklyEarnings.approved_earnings;

  return (
    <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-l-blue-500">
      <Stack tokens={{ childrenGap: 16 }}>
        {/* Header */}
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Stack>
            <Text variant="xLarge" className="font-semibold text-blue-900">
              💰 This Week's Earnings
            </Text>
            <Text variant="medium" className="text-blue-700">
              {formatDate(weeklyEarnings.week_period.start)} - {formatDate(weeklyEarnings.week_period.end)}
            </Text>
          </Stack>
          <Icon iconName="Money" className="text-blue-600 text-3xl" />
        </Stack>

        {/* Main Earnings Display */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Stack>
              <Text variant="xxLarge" className="font-bold text-green-600">
                £{weeklyEarnings.estimated_total.toFixed(2)}
              </Text>
              <Text variant="medium" className="text-gray-600">
                Total Expected
              </Text>
            </Stack>
            <Stack horizontal tokens={{ childrenGap: 20 }}>
              <Stack>
                <Text variant="large" className="font-semibold text-green-700">
                  £{weeklyEarnings.approved_earnings.toFixed(2)}
                </Text>
                <Text variant="small" className="text-gray-600">
                  ✅ Confirmed
                </Text>
              </Stack>
              {pendingEstimate > 0 && (
                <Stack>
                  <Text variant="large" className="font-semibold text-orange-600">
                    £{pendingEstimate.toFixed(2)}
                  </Text>
                  <Text variant="small" className="text-gray-600">
                    🟡 Estimated
                  </Text>
                </Stack>
              )}
            </Stack>
          </Stack>
        </div>

        {/* Payment Date */}
        <div className="bg-blue-100 rounded-lg p-3">
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Stack>
              <Text variant="mediumPlus" className="font-semibold text-blue-800">
                📅 Payment Date
              </Text>
              <Text variant="large" className="text-blue-900 font-bold">
                {formatPaymentDate(weeklyEarnings.next_payment_date)}
              </Text>
            </Stack>
            <Icon iconName="Calendar" className="text-blue-600 text-xl" />
          </Stack>
        </div>

        {/* Shift Breakdown */}
        {weeklyEarnings.shifts.length > 0 && (
          <>
            <Separator />
            <Stack>
              <Text variant="mediumPlus" className="font-semibold mb-2">
                📋 Shift Breakdown ({weeklyEarnings.shift_count} shifts)
              </Text>
              <Stack tokens={{ childrenGap: 8 }}>
                {weeklyEarnings.shifts.map((shift) => (
                  <div key={shift.shift_id} className="bg-gray-50 rounded p-3">
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                      <Stack>
                        <Text variant="medium" className="font-semibold">
                          {shift.earning_status === 'confirmed' ? '✅' : '🟡'} {shift.venue_name}
                        </Text>
                        <Text variant="small" className="text-gray-600">
                          {formatDate(shift.start_time)} • {shift.status}
                          {shift.is_invoiced && ' • Invoiced'}
                        </Text>
                      </Stack>
                      <Text variant="medium" className="font-semibold">
                        £{shift.amount.toFixed(2)}
                        <Text variant="small" className="text-gray-500 ml-1">
                          ({shift.earning_status})
                        </Text>
                      </Text>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </Stack>
          </>
        )}

        {/* Status Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            <Icon iconName="Info" className="text-yellow-600" />
            <Stack>
              <Text variant="small" className="text-yellow-800">
                {pendingEstimate > 0 
                  ? `£${pendingEstimate.toFixed(2)} is estimated based on scheduled shifts. Final amount may vary after completion and approval.`
                  : 'All earnings are confirmed and will be included in your next payment.'
                }
              </Text>
            </Stack>
          </Stack>
        </div>
      </Stack>
    </Card>
  );
};

export default WeeklyEarningsComponent;