import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { leaveService } from '../services';
import type {
  LeaveBalanceResponse,
  LeaveBalanceSummary,
} from '../types/leave';
import { Container, SpaceBetween, Alert, EmptyState } from './cloudscape';

interface LeaveBalanceDisplayProps {
  userId?: number;
  showTitle?: boolean;
  compact?: boolean;
  className?: string;
  onRequestLeave?: (leaveTypeId: number) => void;
  refreshTrigger?: number;
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
  const pendingPercentage = parseFloat(balance.pending_balance) / parseFloat(entitlement.total_entitlement);

  // Determine card status color based on available balance
  const availableDays = parseFloat(balance.available_balance);
  const totalDays = parseFloat(entitlement.total_entitlement);

  let statusColor = '#16a34a'; // Green
  let statusText = 'Good';

  if (availableDays <= 0) {
    statusColor = '#dc2626'; // Red
    statusText = 'Depleted';
  } else if (availableDays < totalDays * 0.2) {
    statusColor = '#f97316'; // Orange
    statusText = 'Low';
  } else if (availableDays < totalDays * 0.5) {
    statusColor = '#eab308'; // Yellow
    statusText = 'Medium';
  }

  // Calculate time until refresh/accrual
  const currentDate = new Date();
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const daysUntilNextAccrual = Math.ceil((nextMonth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-md ${
        compact ? 'min-h-0' : 'min-h-[200px]'
      }`}
      style={{ borderLeft: `4px solid ${leave_type.color_code}` }}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: leave_type.color_code }}
              />
              <span className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-gray-900`}>
                {leave_type.name}
              </span>
              <span className="text-xs text-gray-500">({leave_type.code})</span>
            </div>
            {!compact && leave_type.description && (
              <p className="text-xs text-gray-600 mt-1">{leave_type.description}</p>
            )}
          </div>

          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              color: statusColor,
              backgroundColor: `${statusColor}15`
            }}
            title={`Balance status: ${statusText}`}
          >
            {statusText}
          </span>
        </div>

        {/* Balance Overview */}
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-center`}>
          <div className="p-2 bg-gray-50 rounded-lg">
            <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-gray-900`}>
              {balance.available_balance}
            </p>
            <p className="text-xs text-gray-600">Available</p>
          </div>

          <div className="p-2 bg-gray-50 rounded-lg">
            <p className={`${compact ? 'text-sm' : 'text-base'} font-bold text-gray-900`}>
              {entitlement.used_to_date}
            </p>
            <p className="text-xs text-gray-600">Used</p>
          </div>

          {!compact && (
            <div className="p-2 bg-orange-50 rounded-lg">
              <p className="text-sm font-bold text-orange-900">{balance.pending_balance}</p>
              <p className="text-xs text-orange-700">Pending</p>
            </div>
          )}

          {compact && parseFloat(balance.pending_balance) > 0 && (
            <div className="p-2 bg-orange-50 rounded-lg">
              <p className="text-sm font-bold text-orange-900">{balance.pending_balance}</p>
              <p className="text-xs text-orange-700">Pending</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Usage Progress</span>
            <span className="text-xs text-gray-800 font-medium">
              {entitlement.used_to_date} / {entitlement.total_entitlement} days
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full" style={{ height: compact ? '4px' : '6px' }}>
            <div
              className="bg-red-500 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(usedPercentage * 100, 100)}%`,
                height: compact ? '4px' : '6px'
              }}
            />
          </div>

          {/* Secondary progress for pending */}
          {!compact && parseFloat(balance.pending_balance) > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-orange-600">Pending Requests</span>
                <span className="text-xs text-orange-700">{balance.pending_balance} days</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(pendingPercentage * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Additional Info */}
        {!compact && (
          <div className="pt-2 border-t border-gray-100 space-y-1">
            {entitlement.carried_over !== '0' && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">Carried Over:</span>
                <span className="text-xs text-green-700 font-medium">{entitlement.carried_over} days</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Annual Entitlement:</span>
              <span className="text-xs text-gray-800 font-medium">{entitlement.annual_entitlement} days</span>
            </div>
            {entitlement.last_accrual_date && (
              <div className="flex justify-between">
                <span className="text-xs text-gray-600">Last Accrual:</span>
                <span className="text-xs text-gray-800">{new Date(entitlement.last_accrual_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-xs text-gray-600">Next Accrual:</span>
              <span className="text-xs text-gray-800">{daysUntilNextAccrual} days</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {onRequestLeave && availableDays > 0 && (
          <button
            onClick={() => onRequestLeave(leave_type.id)}
            disabled={!leave_type.is_active}
            className="w-full px-4 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            aria-label={`Request ${leave_type.name} leave`}
          >
            {compact ? 'Request' : 'Request Leave'}
          </button>
        )}

        {!leave_type.is_active && (
          <Alert type="info">
            This leave type is currently not available for new requests.
          </Alert>
        )}
      </div>
    </div>
  );
};

// Shimmer placeholder for loading state
const BalanceCardShimmer: React.FC<{ compact: boolean }> = ({ compact }) => (
  <div className={`bg-white rounded-xl border border-gray-200 p-5 animate-pulse ${compact ? 'min-h-0' : 'min-h-[200px]'}`}>
    <div className="space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/5" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-4/5" />
    </div>
  </div>
);

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

  if (isLoading && !balanceData) {
    return (
      <div className={className}>
        {showTitle && (
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Leave Balances</h2>
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
        <Alert type="error">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Retry
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!balanceData || !balanceData.balances || balanceData.balances.length === 0) {
    return (
      <div className={className}>
        {showTitle && (
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Leave Balances</h2>
        )}
        <Alert type="info">
          No leave entitlements found. Contact your administrator if you believe this is an error.
        </Alert>
      </div>
    );
  }

  return (
    <div className={className}>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Leave Balances</h2>
            {balanceData.user && (
              <p className="text-sm text-gray-600 mt-1">
                {balanceData.user.first_name} {balanceData.user.last_name}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            aria-label="Refresh leave balances"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-900">{balanceData.total_days_available}</p>
              <p className="text-sm text-gray-600">Total Available Days</p>
            </div>
          </Container>
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-900">{balanceData.total_days_used}</p>
              <p className="text-sm text-gray-600">Total Days Used</p>
            </div>
          </Container>
          <Container>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-orange-600">{balanceData.total_days_pending}</p>
              <p className="text-sm text-gray-600">Days Pending Approval</p>
            </div>
          </Container>
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
            <svg className="animate-spin w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-gray-600">Refreshing balances...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceDisplay;
