import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Spinner,
  SpinnerSize,
  TooltipHost,
  DirectionalHint,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { shiftService, api } from '../services';

interface IncompleteShift {
  id: number;
  type: 'no_checkin' | 'no_checkout';
  staff_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  venue_details: {
    id: number;
    name: string;
    address: string;
  };
  start_time: string;
  end_time: string;
  check_in_time?: string;
  hours_overdue: number;
  hours_overdue_raw?: number;
  requires_manual_resolution?: boolean;
  status: string;
  auto_checkout_eligible: boolean;
  force_timeout_eligible: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface IncompleteShiftsWidgetProps {
  maxItems?: number;
  showQuickActions?: boolean;
  onActionComplete?: () => void;
  onCountChange?: (count: number) => void;
}

// Icons
const Icons = {
  AlertTriangle: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  ),
  Check: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Clock: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  MoreHorizontal: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
};

export const IncompleteShiftsWidget: React.FC<IncompleteShiftsWidgetProps> = ({
  maxItems = 6,
  showQuickActions = true,
  onActionComplete,
  onCountChange
}) => {
  const navigate = useNavigate();
  const [incompleteShifts, setIncompleteShifts] = useState<IncompleteShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingShiftId, setProcessingShiftId] = useState<number | null>(null);

  // Calculate priority counts
  const priorityCounts = {
    critical: incompleteShifts.filter(s => s.priority === 'critical').length,
    high: incompleteShifts.filter(s => s.priority === 'high').length,
    medium: incompleteShifts.filter(s => s.priority === 'medium').length,
    low: incompleteShifts.filter(s => s.priority === 'low').length
  };

  const loadIncompleteShifts = useCallback(async () => {
    try {
      setError(null);
      const data = await shiftService.getIncompleteShifts();

      // Sort by priority (critical first) then by hours overdue
      const sortedData = [...data].sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.hours_overdue - a.hours_overdue;
      });

      setIncompleteShifts(sortedData);
      onCountChange?.(sortedData.length);
    } catch (err) {
      console.error('Failed to load incomplete shifts:', err);
      setError('Failed to load incomplete shifts');
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  // Initial load and auto-refresh every 60 seconds
  useEffect(() => {
    loadIncompleteShifts();
    const interval = setInterval(loadIncompleteShifts, 60000);
    return () => clearInterval(interval);
  }, [loadIncompleteShifts]);

  // Quick action handlers
  const handleQuickCheckin = async (shift: IncompleteShift) => {
    setProcessingShiftId(shift.id);
    try {
      await api.post(`/api/v1/shifts/${shift.id}/manual_checkin/`, {
        manager_signature: 'Quick action from dashboard',
        manager_notes: 'Processed via dashboard widget',
        checkin_time: new Date(shift.start_time).toISOString()
      });
      await loadIncompleteShifts();
      onActionComplete?.();
    } catch (err) {
      console.error('Failed to process check-in:', err);
      setError('Failed to process check-in');
    } finally {
      setProcessingShiftId(null);
    }
  };

  const handleQuickCheckout = async (shift: IncompleteShift) => {
    setProcessingShiftId(shift.id);
    try {
      const checkoutTime = new Date();
      const checkInTime = shift.check_in_time ? new Date(shift.check_in_time) : new Date(shift.start_time);
      const hoursWorked = (checkoutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      await api.post(`/api/v1/shifts/${shift.id}/manual_checkout/`, {
        manager_signature: 'Quick action from dashboard',
        manager_notes: 'Processed via dashboard widget',
        checkout_time: checkoutTime.toISOString(),
        actual_hours: Math.round(hoursWorked * 2) / 2
      });
      await loadIncompleteShifts();
      onActionComplete?.();
    } catch (err) {
      console.error('Failed to process check-out:', err);
      setError('Failed to process check-out');
    } finally {
      setProcessingShiftId(null);
    }
  };

  // Priority dot component
  const PriorityDot: React.FC<{ priority: 'low' | 'medium' | 'high' | 'critical' }> = ({ priority }) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-600',
      high: 'bg-red-500',
      medium: 'bg-amber-500',
      low: 'bg-emerald-500'
    };

    return (
      <span className={`w-2 h-2 rounded-full ${colors[priority]}`} />
    );
  };

  // Don't render if no incomplete shifts and not loading
  if (!isLoading && incompleteShifts.length === 0) {
    return null;
  }

  const hasCritical = priorityCounts.critical > 0;
  const displayedShifts = incompleteShifts.slice(0, maxItems);

  return (
    <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${hasCritical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${hasCritical ? 'bg-red-100' : 'bg-amber-100'}`}>
              <Icons.AlertTriangle className={`w-5 h-5 ${hasCritical ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Incomplete Shifts</h3>
              <p className="text-sm text-gray-500">
                {incompleteShifts.length} shift{incompleteShifts.length !== 1 ? 's' : ''} requiring attention
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Priority badges */}
            <div className="hidden sm:flex items-center gap-2">
              {priorityCounts.critical > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                  {priorityCounts.critical} critical
                </span>
              )}
              {priorityCounts.high > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600">
                  {priorityCounts.high} high
                </span>
              )}
            </div>

            <button
              onClick={() => navigate('/approvals', { state: { activeTab: 'incomplete-shifts' } })}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
            >
              View All
              <Icons.ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={SpinnerSize.medium} label="Loading incomplete shifts..." />
          </div>
        ) : error ? (
          <MessageBar messageBarType={MessageBarType.error}>
            {error}
          </MessageBar>
        ) : (
          <>
            {/* Shift Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                >
                  {/* Header: Staff name + Priority */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {shift.staff_details.first_name[0]}{shift.staff_details.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {shift.staff_details.first_name} {shift.staff_details.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{shift.venue_details.name}</p>
                      </div>
                    </div>
                    <PriorityDot priority={shift.priority} />
                  </div>

                  {/* Issue type */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                      shift.type === 'no_checkin'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {shift.type === 'no_checkin' ? 'No Check-in' : 'No Check-out'}
                    </span>
                    {shift.hours_overdue > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Icons.Clock className="w-3.5 h-3.5" />
                        {shift.hours_overdue >= 24 ? '24+' : shift.hours_overdue.toFixed(1)}h overdue
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  {showQuickActions && (
                    <div className="flex items-center gap-2">
                      <TooltipHost
                        content={shift.type === 'no_checkin'
                          ? "Record a manual check-in using the scheduled start time"
                          : "Record a manual check-out using current time"
                        }
                        directionalHint={DirectionalHint.topCenter}
                      >
                        <button
                          disabled={processingShiftId === shift.id}
                          onClick={() => shift.type === 'no_checkin'
                            ? handleQuickCheckin(shift)
                            : handleQuickCheckout(shift)
                          }
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            shift.type === 'no_checkin'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {processingShiftId === shift.id ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Icons.Check className="w-4 h-4" />
                              {shift.type === 'no_checkin' ? 'Check In' : 'Check Out'}
                            </>
                          )}
                        </button>
                      </TooltipHost>

                      <TooltipHost
                        content="View full details and more options"
                        directionalHint={DirectionalHint.topCenter}
                      >
                        <button
                          onClick={() => navigate('/approvals', { state: { activeTab: 'incomplete-shifts' } })}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Icons.MoreHorizontal className="w-5 h-5" />
                        </button>
                      </TooltipHost>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Show more indicator */}
            {incompleteShifts.length > maxItems && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/approvals', { state: { activeTab: 'incomplete-shifts' } })}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  +{incompleteShifts.length - maxItems} more shifts requiring attention
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default IncompleteShiftsWidget;
