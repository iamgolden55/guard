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

interface ActiveShift {
  id: number;
  staff_details: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  venue_details: {
    id: number;
    name: string;
    address: string;
  } | null;
  start_time: string;
  end_time: string;
  check_in_time: string;
  elapsed_hours: number;
  scheduled_duration: number;
  is_overdue: boolean;
  overdue_hours: number;
  status: string;
}

interface ActiveShiftsWidgetProps {
  maxItems?: number;
  showQuickActions?: boolean;
  onActionComplete?: () => void;
  onCountChange?: (count: number) => void;
}

// Icons
const Icons = {
  Play: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
  AlertCircle: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const ActiveShiftsWidget: React.FC<ActiveShiftsWidgetProps> = ({
  maxItems = 5,
  showQuickActions = true,
  onActionComplete,
  onCountChange
}) => {
  const navigate = useNavigate();
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingShiftId, setProcessingShiftId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every 30 seconds for elapsed time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveShifts = useCallback(async () => {
    try {
      setError(null);
      const data = await shiftService.getActiveShifts();

      // Sort: overdue shifts first, then by elapsed time (longest first)
      const sortedData = [...data].sort((a, b) => {
        if (a.is_overdue && !b.is_overdue) return -1;
        if (!a.is_overdue && b.is_overdue) return 1;
        return b.elapsed_hours - a.elapsed_hours;
      });

      setActiveShifts(sortedData);
      onCountChange?.(sortedData.length);
    } catch (err) {
      console.error('Failed to load active shifts:', err);
      setError('Failed to load active shifts');
    } finally {
      setIsLoading(false);
    }
  }, [onCountChange]);

  // Initial load and auto-refresh every 30 seconds
  useEffect(() => {
    loadActiveShifts();
    const interval = setInterval(loadActiveShifts, 30000);
    return () => clearInterval(interval);
  }, [loadActiveShifts]);

  // Quick checkout handler
  const handleQuickCheckout = async (shift: ActiveShift) => {
    setProcessingShiftId(shift.id);
    try {
      const checkoutTime = new Date();
      const checkInTime = new Date(shift.check_in_time);
      const hoursWorked = (checkoutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      await api.post(`/api/v1/shifts/${shift.id}/manual_checkout/`, {
        manager_signature: 'Quick action from dashboard',
        manager_notes: 'Processed via Active Shifts widget',
        checkout_time: checkoutTime.toISOString(),
        actual_hours: Math.round(hoursWorked * 2) / 2 // Round to nearest 0.5
      });
      await loadActiveShifts();
      onActionComplete?.();
    } catch (err) {
      console.error('Failed to process check-out:', err);
      setError('Failed to process check-out');
    } finally {
      setProcessingShiftId(null);
    }
  };

  // Format elapsed time display
  const formatElapsedTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Format check-in time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const overdueCount = activeShifts.filter(s => s.is_overdue).length;
  const displayedShifts = activeShifts.slice(0, maxItems);

  // Show empty state when no active shifts
  if (!isLoading && activeShifts.length === 0) {
    return (
      <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gray-100">
              <Icons.Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Active Shifts</h3>
              <p className="text-sm text-gray-500">No shifts currently in progress</p>
            </div>
          </div>
        </div>
        {/* Empty state content */}
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Icons.Clock className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-1">No active shifts</h4>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">
            Staff members who have checked in will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-lg overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${overdueCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${overdueCount > 0 ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <Icons.Play className={`w-5 h-5 ${overdueCount > 0 ? 'text-amber-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Active Shifts</h3>
              <p className="text-sm text-gray-500">
                {activeShifts.length} shift{activeShifts.length !== 1 ? 's' : ''} currently in progress
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Overdue badge */}
            {overdueCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-700">
                <Icons.AlertCircle className="w-3 h-3" />
                {overdueCount} overdue
              </span>
            )}

            <button
              onClick={() => navigate('/staff-shifts')}
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
            <Spinner size={SpinnerSize.medium} label="Loading active shifts..." />
          </div>
        ) : error ? (
          <MessageBar messageBarType={MessageBarType.error}>
            {error}
          </MessageBar>
        ) : (
          <>
            {/* Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Staff</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600 hidden sm:table-cell">Venue</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Checked In</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Elapsed</th>
                    {showQuickActions && (
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedShifts.map((shift) => (
                    <tr key={shift.id} className={`border-b border-gray-100 hover:bg-gray-50 ${shift.is_overdue ? 'bg-amber-50/50' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {shift.is_overdue && (
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                          )}
                          <span className="font-medium text-gray-900">
                            {shift.staff_details?.first_name || 'Unknown'} {shift.staff_details?.last_name?.charAt(0) || ''}.
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600 hidden sm:table-cell">
                        {shift.venue_details?.name || 'Unknown Venue'}
                      </td>
                      <td className="py-3 px-3 text-gray-600">
                        {formatTime(shift.check_in_time)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-medium ${shift.is_overdue ? 'text-amber-700' : 'text-gray-900'}`}>
                            {formatElapsedTime(shift.elapsed_hours)}
                          </span>
                          {shift.is_overdue && (
                            <TooltipHost
                              content={`${formatElapsedTime(shift.overdue_hours)} past scheduled end time`}
                              directionalHint={DirectionalHint.topCenter}
                            >
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                +{formatElapsedTime(shift.overdue_hours)}
                              </span>
                            </TooltipHost>
                          )}
                        </div>
                      </td>
                      {showQuickActions && (
                        <td className="py-3 px-3 text-right">
                          <TooltipHost
                            content="Record a manual check-out using current time"
                            directionalHint={DirectionalHint.topCenter}
                          >
                            <button
                              disabled={processingShiftId === shift.id}
                              onClick={() => handleQuickCheckout(shift)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {processingShiftId === shift.id ? (
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Icons.Check className="w-3 h-3" />
                                  Check Out
                                </>
                              )}
                            </button>
                          </TooltipHost>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Show more indicator */}
            {activeShifts.length > maxItems && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/staff-shifts')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  +{activeShifts.length - maxItems} more active shifts
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActiveShiftsWidget;
