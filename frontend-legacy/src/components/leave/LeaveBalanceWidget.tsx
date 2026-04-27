import React from 'react';
import { Link } from 'react-router-dom';
import {
  Text,
  ProgressIndicator,
  DefaultButton,
  Icon,
  Tooltip,
  DirectionalHint
} from '@fluentui/react';
import type { 
  LeaveBalanceResponse, 
  LeaveBalanceSummary 
} from '../../types/leave';

interface LeaveBalanceWidgetProps {
  balanceData: LeaveBalanceResponse;
  compact?: boolean;
  showTitle?: boolean;
  className?: string;
  onRequestLeave?: (leaveTypeId: number) => void;
}

interface BalanceCardProps {
  balance: LeaveBalanceSummary;
  compact: boolean;
  onRequestLeave?: (leaveTypeId: number) => void;
}

// Individual balance card component for the widget
const BalanceCard: React.FC<BalanceCardProps> = ({ balance, compact, onRequestLeave }) => {
  const { leave_type, entitlement } = balance;

  // Calculate progress percentages
  const usedPercentage = parseFloat(entitlement.used_to_date) / parseFloat(entitlement.total_entitlement);
  const availableDays = parseFloat(balance.available_balance);
  const totalDays = parseFloat(entitlement.total_entitlement);

  // Determine card status
  let statusColor = '#107C10'; // Green
  let statusText = 'Good';
  let statusIcon = 'CheckMark';

  if (availableDays <= 0) {
    statusColor = '#D13438'; // Red
    statusText = 'Depleted';
    statusIcon = 'Warning';
  } else if (availableDays < totalDays * 0.2) {
    statusColor = '#FF8C00'; // Orange
    statusText = 'Low';
    statusIcon = 'Info';
  } else if (availableDays < totalDays * 0.5) {
    statusColor = '#FFB900'; // Yellow
    statusText = 'Medium';
    statusIcon = 'Clock';
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all duration-300 ease-out hover:shadow-md hover:scale-[1.01] hover:-translate-y-0.5 ${
        compact ? 'min-h-0' : 'min-h-[160px]'
      }`}
      style={{ borderLeft: `4px solid ${leave_type.color_code}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: leave_type.color_code }}
            />
            <Text variant={compact ? 'medium' : 'mediumPlus'} className="font-semibold text-gray-900">
              {leave_type.name}
            </Text>
            <Text variant="small" className="text-gray-500">
              ({leave_type.code})
            </Text>
          </div>
        </div>

        <Tooltip content={`Status: ${statusText}`} directionalHint={DirectionalHint.topCenter}>
          <Icon
            iconName={statusIcon}
            className="text-sm"
            style={{ color: statusColor }}
          />
        </Tooltip>
      </div>

      {/* Balance Overview */}
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-center mb-3`}>
        <div className="p-2 bg-blue-50 rounded-md">
          <Text variant={compact ? 'small' : 'medium'} className="font-bold text-blue-900">
            {balance.available_balance}
          </Text>
          <Text variant="small" className="text-blue-700">
            Available
          </Text>
        </div>

        <div className="p-2 bg-gray-50 rounded-md">
          <Text variant={compact ? 'small' : 'medium'} className="font-bold text-gray-900">
            {entitlement.used_to_date}
          </Text>
          <Text variant="small" className="text-gray-700">
            Used
          </Text>
        </div>

        {!compact && (
          <div className="p-2 bg-orange-50 rounded-md">
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
            Usage
          </Text>
          <Text variant="small" className="text-gray-800 font-medium">
            {Math.round(usedPercentage * 100)}%
          </Text>
        </div>

        <ProgressIndicator
          percentComplete={Math.min(usedPercentage, 1)}
          barHeight={compact ? 3 : 4}
          progressHidden={false}
        />
      </div>

      {/* Action Button */}
      {onRequestLeave && availableDays > 0 && (
        <div className="mt-3">
          <DefaultButton
            text={compact ? 'Request' : 'Request Leave'}
            iconProps={{ iconName: 'Add' }}
            onClick={() => onRequestLeave(leave_type.id)}
            size="small"
            styles={{
              root: {
                width: '100%',
                borderRadius: '6px',
                fontSize: '12px',
                height: '28px'
              }
            }}
            disabled={!leave_type.is_active}
          />
        </div>
      )}
    </div>
  );
};

// Main widget component
const LeaveBalanceWidget: React.FC<LeaveBalanceWidgetProps> = ({
  balanceData,
  compact = false,
  showTitle = true,
  className = '',
  onRequestLeave
}) => {
  
  if (!balanceData || !balanceData.balances || balanceData.balances.length === 0) {
    return (
      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
        <Text variant="medium" className="text-gray-600">
          No leave balances found.
        </Text>
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
                Current balances for {balanceData.user.first_name} {balanceData.user.last_name}
              </Text>
            )}
          </div>

          <DefaultButton
            text="View Details"
            iconProps={{ iconName: 'ChevronRight' }}
            as={Link}
            to="/leave/balance"
            styles={{
              root: {
                borderRadius: '8px'
              }
            }}
          />
        </div>
      )}

      {/* Summary Cards */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon iconName="Clock" className="text-blue-600" style={{ fontSize: '16px' }} />
              </div>
              <div className="ml-3">
                <Text variant="large" className="font-bold text-blue-900">
                  {balanceData.total_days_available}
                </Text>
                <Text variant="small" className="text-blue-700">
                  Total Available
                </Text>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Icon iconName="CheckMark" className="text-gray-600" style={{ fontSize: '16px' }} />
              </div>
              <div className="ml-3">
                <Text variant="large" className="font-bold text-gray-900">
                  {balanceData.total_days_used}
                </Text>
                <Text variant="small" className="text-gray-700">
                  Total Used
                </Text>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Icon iconName="Clock" className="text-orange-600" style={{ fontSize: '16px' }} />
              </div>
              <div className="ml-3">
                <Text variant="large" className="font-bold text-orange-900">
                  {balanceData.total_days_pending}
                </Text>
                <Text variant="small" className="text-orange-700">
                  Pending Approval
                </Text>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Balance Cards */}
      <div className={`grid ${
        compact
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
      }`}>
        {balanceData.balances.map((balance) => (
          <BalanceCard
            key={balance.leave_type.id}
            balance={balance}
            compact={compact}
            onRequestLeave={onRequestLeave}
          />
        ))}
      </div>
    </div>
  );
};

export default LeaveBalanceWidget;