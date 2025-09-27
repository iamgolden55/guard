import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Text,
  Icon,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  SearchBox,
  Dropdown,
  IDropdownOption,
  Stack
} from '@fluentui/react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../services';
import holidayService, { type Holiday } from '../../services/holidayService';
import AppleCalendarDay, { type CalendarDayEvent } from './AppleCalendarDay';
import AppleCalendarSidebar from './AppleCalendarSidebar';
import type {
  LeaveCalendarEvent,
  LeaveType,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveRequestFilterOptions
} from '../../types/leave';
import '../../styles/apple-calendar.css';

interface AppleCalendarProps {
  className?: string;
  showAllStaff?: boolean;
  onEventSelect?: (event: CalendarDayEvent) => void;
  onDateSelect?: (date: Date) => void;
  teamOnly?: boolean;
}

const AppleCalendar: React.FC<AppleCalendarProps> = ({
  className = '',
  showAllStaff = true,
  onEventSelect,
  onDateSelect,
  teamOnly = false
}) => {
  const { authState, isUserRole } = useAuth();

  // State management
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarDayEvent[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Filtering
  const [selectedLeaveTypes, setSelectedLeaveTypes] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<LeaveRequestStatus[]>([]);

  // Permissions
  const canManage = isUserRole('manager') || isUserRole('admin');
  const canViewAll = showAllStaff && (canManage || isUserRole('staff'));

  // Get weekday names
  const weekdays = useMemo(() =>
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], []);

  // Get calendar month data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Get the day of the week for first day (0 = Sunday, 1 = Monday, etc.)
    // Adjust so Monday = 0, Sunday = 6
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Calculate total days to show (complete weeks)
    const totalDays = Math.ceil((lastDay.getDate() + startDayOfWeek) / 7) * 7;

    // Generate all days for the calendar view
    const days: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(year, month, 1 - startDayOfWeek + i);
      days.push(date);
    }

    return {
      year,
      month,
      days,
      firstDay,
      lastDay
    };
  }, [currentDate]);

  // Format current month/year for display
  const formattedMonthYear = useMemo(() => {
    return currentDate.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric'
    });
  }, [currentDate]);

  // Load calendar data
  const loadCalendarData = useCallback(async () => {
    if (!canViewAll) return;

    try {
      setIsLoading(true);
      setError('');

      const { firstDay, lastDay } = calendarData;

      // Prepare filters for API call
      const filters: LeaveRequestFilterOptions = {
        start_date: firstDay.toISOString().split('T')[0],
        end_date: lastDay.toISOString().split('T')[0],
        ...(selectedLeaveTypes.length > 0 && { leave_type: selectedLeaveTypes }),
        ...(selectedStatuses.length > 0 && { status: selectedStatuses }),
      };

      // Load data in parallel
      const [eventsData, typesData, holidaysData] = await Promise.all([
        leaveService.getLeaveCalendarEvents(filters),
        leaveService.getLeaveTypes(true),
        holidayService.getHolidaysInRange(firstDay, lastDay)
      ]);

      // Transform events for calendar display
      const transformedEvents: CalendarDayEvent[] = eventsData.map(event => ({
        ...event,
        backgroundColor: getEventBackgroundColor(event.leave_request),
        borderColor: event.leave_request.leave_type.color_code,
        textColor: getEventTextColor(event.leave_request.status),
      }));

      setEvents(transformedEvents);
      setLeaveTypes(typesData);
      setHolidays(holidaysData);

    } catch (err: any) {
      console.error('Error loading calendar data:', err);
      setError('Failed to load calendar data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [canViewAll, calendarData, selectedLeaveTypes, selectedStatuses]);

  // Helper to get event background color
  const getEventBackgroundColor = useCallback((request: LeaveRequest): string => {
    const baseColor = request.leave_type.color_code;

    switch (request.status) {
      case 'APPROVED':
        return baseColor;
      case 'PENDING':
        return `${baseColor}80`; // 50% opacity
      case 'REJECTED':
        return '#FF3B30'; // Apple red
      case 'CANCELLED':
        return '#8E8E93'; // Apple gray
      default:
        return baseColor;
    }
  }, []);

  // Helper to get event text color
  const getEventTextColor = useCallback((status: LeaveRequestStatus): string => {
    switch (status) {
      case 'PENDING':
        return '#000000';
      default:
        return '#FFFFFF';
    }
  }, []);

  // Filter events based on search
  const filteredEvents = useMemo(() => {
    if (!searchText) return events;

    const searchLower = searchText.toLowerCase();
    return events.filter(event =>
      event.user_display_name.toLowerCase().includes(searchLower) ||
      event.leave_request.leave_type.name.toLowerCase().includes(searchLower) ||
      event.leave_request.reason.toLowerCase().includes(searchLower)
    );
  }, [events, searchText]);

  // Load data when component mounts or dependencies change
  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  // Navigation handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDate(null);
    setIsSidebarOpen(false);
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDate(null);
    setIsSidebarOpen(false);
  }, []);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
    setIsSidebarOpen(true);
  }, []);

  // Date selection
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setIsSidebarOpen(true);
    if (onDateSelect) {
      onDateSelect(date);
    }
  }, [onDateSelect]);

  // Event selection
  const handleEventSelect = useCallback((event: CalendarDayEvent) => {
    if (onEventSelect) {
      onEventSelect(event);
    }
  }, [onEventSelect]);

  // Request management
  const handleProcessRequest = useCallback(async (requestId: number, action: 'approve' | 'reject') => {
    if (!canManage) return;

    try {
      setIsProcessing(true);

      await leaveService.processLeaveRequest({
        request_id: requestId,
        action
      });

      // Refresh data
      await loadCalendarData();

    } catch (err: any) {
      console.error(`Error ${action}ing request:`, err);
      setError(`Failed to ${action} request. Please try again.`);
    } finally {
      setIsProcessing(false);
    }
  }, [canManage, loadCalendarData]);

  // Get events and holidays for selected date
  const selectedDateData = useMemo(() => {
    if (!selectedDate) return { events: [], holidays: [] };

    const dateStr = selectedDate.toISOString().split('T')[0];

    return {
      events: filteredEvents.filter(event => {
        const eventStart = event.start.split('T')[0];
        const eventEnd = event.end.split('T')[0];
        return dateStr >= eventStart && dateStr <= eventEnd;
      }),
      holidays: holidays.filter(holiday => holiday.date === dateStr)
    };
  }, [selectedDate, filteredEvents, holidays]);

  // Filter options
  const leaveTypeOptions: IDropdownOption[] = leaveTypes.map(type => ({
    key: type.id,
    text: type.name,
    data: type
  }));

  const statusOptions: IDropdownOption[] = [
    { key: 'APPROVED', text: 'Approved' },
    { key: 'PENDING', text: 'Pending' },
    { key: 'REJECTED', text: 'Rejected' },
    { key: 'CANCELLED', text: 'Cancelled' }
  ];

  // Check if date should have special styling
  const getDateInfo = useCallback((date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = selectedDate?.toDateString() === date.toDateString();
    const isOtherMonth = date.getMonth() !== currentDate.getMonth();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    return { isToday, isSelected, isOtherMonth, isWeekend };
  }, [selectedDate, currentDate]);

  if (!canViewAll) {
    return (
      <div className={className}>
        <MessageBar messageBarType={MessageBarType.warning}>
          You do not have permission to view the leave calendar.
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={`apple-calendar-fade-in ${className}`}>
      {/* Error Display */}
      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError('')}
          className="mb-4"
        >
          {error}
        </MessageBar>
      )}

      {/* Filter Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end">
          <SearchBox
            placeholder="Search leave requests..."
            value={searchText}
            onChange={(_, newValue) => setSearchText(newValue || '')}
            onClear={() => setSearchText('')}
            styles={{ root: { width: '300px' } }}
          />

          <Dropdown
            placeholder="Leave Types"
            multiSelect
            options={leaveTypeOptions}
            selectedKeys={selectedLeaveTypes}
            onChange={(_, option) => {
              if (option) {
                const newSelection = option.selected
                  ? [...selectedLeaveTypes, option.key as number]
                  : selectedLeaveTypes.filter(id => id !== option.key);
                setSelectedLeaveTypes(newSelection);
              }
            }}
            styles={{ root: { width: '200px' } }}
          />

          <Dropdown
            placeholder="Status"
            multiSelect
            options={statusOptions}
            selectedKeys={selectedStatuses}
            onChange={(_, option) => {
              if (option) {
                const newSelection = option.selected
                  ? [...selectedStatuses, option.key as LeaveRequestStatus]
                  : selectedStatuses.filter(status => status !== option.key);
                setSelectedStatuses(newSelection);
              }
            }}
            styles={{ root: { width: '150px' } }}
          />

          <DefaultButton
            text="Today"
            iconProps={{ iconName: 'GotoToday' }}
            onClick={handleToday}
          />
        </Stack>
      </div>

      {/* Main Calendar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <div className="apple-calendar">
            {/* Header */}
            <div className="apple-calendar-header">
              <button
                className="apple-calendar-nav-button"
                onClick={handlePreviousMonth}
                aria-label="Previous month"
              >
                <Icon iconName="ChevronLeft" />
              </button>

              <Text className="apple-calendar-title">
                {formattedMonthYear}
              </Text>

              <button
                className="apple-calendar-nav-button"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                <Icon iconName="ChevronRight" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="apple-calendar-weekdays">
              {weekdays.map(day => (
                <div key={day} className="apple-calendar-weekday">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            {isLoading ? (
              <div className="apple-calendar-loading">
                <div className="apple-calendar-spinner" />
                <Text variant="small" style={{ color: 'rgba(60, 60, 67, 0.6)' }}>
                  Loading calendar...
                </Text>
              </div>
            ) : (
              <div className="apple-calendar-grid">
                {calendarData.days.map((date, index) => {
                  const dateInfo = getDateInfo(date);
                  const dayEvents = filteredEvents.filter(event => {
                    const dateStr = date.toISOString().split('T')[0];
                    const eventStart = event.start.split('T')[0];
                    const eventEnd = event.end.split('T')[0];
                    return dateStr >= eventStart && dateStr <= eventEnd;
                  });
                  const dayHolidays = holidays.filter(holiday =>
                    holiday.date === date.toISOString().split('T')[0]
                  );

                  return (
                    <AppleCalendarDay
                      key={index}
                      date={date}
                      isSelected={dateInfo.isSelected}
                      isToday={dateInfo.isToday}
                      isOtherMonth={dateInfo.isOtherMonth}
                      isWeekend={dateInfo.isWeekend}
                      events={dayEvents}
                      holidays={dayHolidays}
                      onClick={handleDateSelect}
                      onEventClick={handleEventSelect}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <AppleCalendarSidebar
            isOpen={isSidebarOpen}
            selectedDate={selectedDate}
            dayEvents={selectedDateData.events}
            dayHolidays={selectedDateData.holidays}
            canManage={canManage}
            isProcessing={isProcessing}
            onClose={() => {
              setIsSidebarOpen(false);
              setSelectedDate(null);
            }}
            onEventSelect={handleEventSelect}
            onApprove={(requestId) => handleProcessRequest(requestId, 'approve')}
            onReject={(requestId) => handleProcessRequest(requestId, 'reject')}
          />
        </div>
      </div>
    </div>
  );
};

export default AppleCalendar;