import React, { useState, useEffect } from 'react';
import {
  Text,
  Stack,
  ProgressIndicator,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Icon,
  DefaultButton,
  IStackTokens,
  Shimmer,
  ShimmerElementType,
  IShimmerElement,
  Tooltip,
  DirectionalHint
} from '@fluentui/react';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import type {
  LeaveBalanceResponse,
  LeaveBalanceSummary,
  User
} from '../types/leave';

interface LeaveBalanceDisplayProps {
  userId?: number;
  showTitle?: boolean;
  compact?: boolean;
  className?: string;
  onRequestLeave?: (leaveTypeId: number) => void;
  refreshTrigger?: number; // For external refresh control
}

interface BalanceCardProps {
  balance: LeaveBalanceSummary;
  compact: boolean;
  onRequestLeave?: (leaveTypeId: number) => void;
}

// Individual balance card component
const BalanceCard: React.FC<BalanceCardProps> = ({ balance, compact, onRequestLeave }) => {
  const { leave_type, entitlement } = balance;

  // Calculate progress percentages
  const usedPercentage = parseFloat(entitlement.used_to_date) / parseFloat(entitlement.total_entitlement);
  const availablePercentage = parseFloat(balance.available_balance) / parseFloat(entitlement.total_entitlement);
  const pendingPercentage = parseFloat(balance.pending_balance) / parseFloat(entitlement.total_entitlement);

  // Determine card status color based on available balance
  const availableDays = parseFloat(balance.available_balance);
  const totalDays = parseFloat(entitlement.total_entitlement);

  let statusColor = '#107C10'; // Green - Good balance
  let statusText = 'Good';
  let statusIcon = 'CheckMark';

  if (availableDays <= 0) {
    statusColor = '#D13438'; // Red - No balance
    statusText = 'Depleted';
    statusIcon = 'Warning';
  } else if (availableDays < totalDays * 0.2) {
    statusColor = '#FF8C00'; // Orange - Low balance
    statusText = 'Low';
    statusIcon = 'Info';
  } else if (availableDays < totalDays * 0.5) {
    statusColor = '#FFB900'; // Yellow - Medium balance
    statusText = 'Medium';
    statusIcon = 'Clock';
  }

  // Calculate time until refresh/accrual
  const currentDate = new Date();
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const daysUntilNextAccrual = Math.ceil((nextMonth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5 ${
        compact ? 'min-h-0' : 'min-h-[200px]'
      }`}
      style={{ borderLeft: `4px solid ${leave_type.color_code}` }}
    >
      <Stack tokens={{ childrenGap: compact ? 8 : 12 }}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: leave_type.color_code }}
                aria-hidden="true"
              />
              <Text variant={compact ? 'medium' : 'large'} className="font-semibold text-gray-900">
                {leave_type.name}
              </Text>
              <Text variant="small" className="text-gray-500">
                ({leave_type.code})
              </Text>
            </div>
            {!compact && leave_type.description && (
              <Text variant="small" className="text-gray-600 mt-1">
                {leave_type.description}
              </Text>
            )}
          </div>

          <Tooltip content={`Status: ${statusText}`} directionalHint={DirectionalHint.topCenter}>
            <Icon
              iconName={statusIcon}
              className="text-lg"
              style={{ color: statusColor }}
              aria-label={`Balance status: ${statusText}`}
            />
          </Tooltip>
        </div>

        {/* Balance Overview */}
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-center`}>
          <div className="p-2 bg-blue-50 rounded-lg">
            <Text variant={compact ? 'small' : 'medium'} className="font-bold text-blue-900">
              {balance.available_balance}
            </Text>
            <Text variant="small" className="text-blue-700">
              Available
            </Text>
          </div>

          <div className="p-2 bg-gray-50 rounded-lg">
            <Text variant={compact ? 'small' : 'medium'} className="font-bold text-gray-900">
              {entitlement.used_to_date}
            </Text>
            <Text variant="small" className="text-gray-700">
              Used
            </Text>
          </div>

          {!compact && (
            <div className="p-2 bg-orange-50 rounded-lg">
              <Text variant="small" className="font-bold text-orange-900">
                {balance.pending_balance}
              </Text>
              <Text variant="small" className="text-orange-700">
                Pending
              </Text>
            </div>
          )}

          {compact && parseFloat(balance.pending_balance) > 0 && (
            <div className="p-2 bg-orange-50 rounded-lg">
              <Text variant="small" className="font-bold text-orange-900">
                {balance.pending_balance}
              </Text>
              <Text variant="small" className="text-orange-700">
                Pending
              </Text>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Text variant="small" className="text-gray-600">
              Usage Progress
            </Text>
            <Text variant="small" className="text-gray-800 font-medium">
              {entitlement.used_to_date} / {entitlement.total_entitlement} days
            </Text>
          </div>

          <ProgressIndicator
            percentComplete={Math.min(usedPercentage, 1)}
            barHeight={compact ? 4 : 6}
            className="mb-2"
            progressHidden={false}
            ariaValueText={`${Math.round(usedPercentage * 100)}% of leave entitlement used`}
          />

          {/* Secondary progress indicators for pending/available */}
          {!compact && parseFloat(balance.pending_balance) > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Text variant="small" className="text-orange-600">
                  Pending Requests
                </Text>
                <Text variant="small" className="text-orange-700">
                  {balance.pending_balance} days
                </Text>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-400 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(pendingPercentage * 100, 100)}%`
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>
          )}
        </div>

        {/* Additional Info */}
        {!compact && (
          <div className="pt-2 border-t border-gray-100 space-y-2">
            {entitlement.carried_over !== '0' && (
              <div className="flex justify-between">
                <Text variant="small" className="text-gray-600">Carried Over:</Text>
                <Text variant="small" className="text-green-700 font-medium">
                  {entitlement.carried_over} days
                </Text>
              </div>
            )}

            <div className="flex justify-between">
              <Text variant="small" className="text-gray-600">Annual Entitlement:</Text>
              <Text variant="small" className="text-gray-800 font-medium">
                {entitlement.annual_entitlement} days
              </Text>
            </div>

            {entitlement.last_accrual_date && (
              <div className="flex justify-between">
                <Text variant="small" className="text-gray-600">Last Accrual:</Text>
                <Text variant="small" className="text-gray-800">
                  {new Date(entitlement.last_accrual_date).toLocaleDateString()}
                </Text>
              </div>
            )}

            <div className="flex justify-between">
              <Text variant="small" className="text-blue-600">Next Accrual:</Text>
              <Text variant="small" className="text-blue-700">
                {daysUntilNextAccrual} days
              </Text>
            </div>
          </div>
        )}

        {/* Action Button */}
        {onRequestLeave && availableDays > 0 && (
          <div className="pt-2">
            <DefaultButton
              text={compact ? 'Request' : 'Request Leave'}
              iconProps={{ iconName: 'Add' }}
              onClick={() => onRequestLeave(leave_type.id)}
              className="w-full"
              disabled={!leave_type.is_active}
              ariaLabel={`Request ${leave_type.name} leave`}
            />
          </div>
        )}

        {!leave_type.is_active && (
          <MessageBar
            messageBarType={MessageBarType.info}
            className="mt-2"
            isMultiline={false}
          >
            This leave type is currently not available for new requests.
          </MessageBar>
        )}
      </Stack>
    </div>
  );
};

// Shimmer placeholder for loading state
const BalanceCardShimmer: React.FC<{ compact: boolean }> = ({ compact }) => {
  const shimmerElements: IShimmerElement[] = [
    { type: ShimmerElementType.line, height: compact ? 20 : 24, width: '60%' },
    { type: ShimmerElementType.gap, width: '40%' },
    { type: ShimmerElementType.line, height: 16, width: '100%' },
    { type: ShimmerElementType.line, height: 16, width: '80%' },
  ];

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition-all duration-300 ease-out ${compact ? 'min-h-0' : 'min-h-[200px]'}`}>
      <Shimmer shimmerElements={shimmerElements} />
    </div>
  );
};

// Main component
const LeaveBalanceDisplay: React.FC<LeaveBalanceDisplayProps> = ({
  userId,
  showTitle = true,
  compact = false,
  className = '',
  onRequestLeave,
  refreshTrigger = 0
}) => {
  const { authState } = useAuth();
  const [balanceData, setBalanceData] = useState<LeaveBalanceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load balance data
  const loadBalanceData = async (showRefreshing: boolean = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError('');

      const data = await leaveService.getLeaveBalances(userId);
      setBalanceData(data);

    } catch (err: any) {
      console.error('Error loading leave balances:', err);
      setError('Failed to load leave balances. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load and refresh trigger
  useEffect(() => {
    loadBalanceData();
  }, [userId, refreshTrigger]);

  // Handle refresh
  const handleRefresh = () => {
    loadBalanceData(true);
  };

  const stackTokens: IStackTokens = { childrenGap: compact ? 12 : 20 };

  if (isLoading && !balanceData) {
    return (
      <div className={className}>
        {showTitle && (
          <div className="mb-4">
            <Text variant="xLarge" className="font-semibold text-gray-900">
              Leave Balances
            </Text>
          </div>
        )}

        <div className={`grid ${compact ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'} gap-4`}>
          {[...Array(3)].map((_, index) => (
            <BalanceCardShimmer key={index} compact={compact} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline
          actions={
            <DefaultButton
              text="Retry"
              iconProps={{ iconName: 'Refresh' }}
              onClick={handleRefresh}
              disabled={isRefreshing}
            />
          }
        >
          {error}
        </MessageBar>
      </div>
    );
  }

  if (!balanceData || !balanceData.balances || balanceData.balances.length === 0) {
    return (
      <div className={className}>
        {showTitle && (
          <div className="mb-4">
            <Text variant="xLarge" className="font-semibold text-gray-900">
              Leave Balances
            </Text>
          </div>
        )}

        <MessageBar messageBarType={MessageBarType.info}>
          No leave entitlements found. Contact your administrator if you believe this is an error.
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={className}>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <Text variant="xLarge" className="font-semibold text-gray-900">
              Leave Balances
            </Text>
            {balanceData.user && (
              <Text variant="medium" className="text-gray-600 mt-1">
                {balanceData.user.first_name} {balanceData.user.last_name}
              </Text>
            )}
          </div>

          <DefaultButton
            text="Refresh"
            iconProps={{ iconName: isRefreshing ? 'Clock' : 'Refresh' }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            ariaLabel="Refresh leave balances"
          />
        </div>
      )}

      {/* Summary Cards */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" className="font-bold text-blue-900">
                {balanceData.total_days_available}
              </Text>
              <Text variant="medium" className="text-blue-700">
                Total Available Days
              </Text>
            </Stack>
          </div>

          <div className="bg-gray-50 rounded-2xl shadow-sm border border-gray-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" className="font-bold text-gray-900">
                {balanceData.total_days_used}
              </Text>
              <Text variant="medium" className="text-gray-700">
                Total Days Used
              </Text>
            </Stack>
          </div>

          <div className="bg-orange-50 rounded-2xl shadow-sm border border-orange-200 p-6 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5">
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="large" className="font-bold text-orange-900">
                {balanceData.total_days_pending}
              </Text>
              <Text variant="medium" className="text-orange-700">
                Days Pending Approval
              </Text>
            </Stack>
          </div>
        </div>
      )}

      {/* Individual Balance Cards */}
      <div className={`grid ${
        compact
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
      }`}>
        {(balanceData.balances || []).map((balance) => (
          <BalanceCard
            key={balance.leave_type.id}
            balance={balance}
            compact={compact}
            onRequestLeave={onRequestLeave}
          />
        ))}
      </div>

      {isRefreshing && (
        <div className="fixed bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Spinner size={SpinnerSize.small} />
            <Text variant="small">Refreshing balances...</Text>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceDisplay;