import React, { useState, useCallback, useMemo } from 'react';
import {

  Stack,
  Text,
  IconButton,
  Dropdown,
  IDropdownOption,
  DefaultButton,
  Spinner,
  SpinnerSize,
  IStackTokens,
  Persona,
  PersonaSize,
  TooltipHost,
  Modal,
  Icon
} from '@fluentui/react';
import { LeaveCalendarEvent, LeaveRequestStatus } from '../../types/leave';

interface TeamCalendarViewProps {
  events: LeaveCalendarEvent[];
  isLoading?: boolean;
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  onEventClick?: (event: LeaveCalendarEvent) => void;
  className?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: LeaveCalendarEvent[];
}

const stackTokens: IStackTokens = {
  childrenGap: 16,
  padding: 16,
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const TeamCalendarView: React.FC<TeamCalendarViewProps> = ({
  events,
  isLoading = false,
  onDateRangeChange,
  onEventClick,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<LeaveCalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewType, setViewType] = useState<'month' | 'week'>('month');

  // Get calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const days: CalendarDay[] = [];
    const today = new Date();

    // Add previous month's days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return date >= eventStart && date <= eventEnd;
      });

      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: dayEvents
      });
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return date >= eventStart && date <= eventEnd;
      });

      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        events: dayEvents
      });
    }

    // Add next month's days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return date >= eventStart && date <= eventEnd;
      });

      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: dayEvents
      });
    }

    return days;
  }, [currentDate, events]);

  // Get week days for the current week
  const weekDays = useMemo(() => {
    const days: CalendarDay[] = [];
    const today = new Date();

    // Get the start of the week (Sunday) for the current date
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    // Generate 7 days starting from Sunday
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const dayEvents = events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return date >= eventStart && date <= eventEnd;
      });

      days.push({
        date,
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        isToday: date.toDateString() === today.toDateString(),
        events: dayEvents
      });
    }

    return days;
  }, [currentDate, events]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    if (viewType === 'week') {
      // Move to previous week
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);

      // Calculate week start and end for date range change
      const startOfWeek = new Date(newDate);
      startOfWeek.setDate(newDate.getDate() - newDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      onDateRangeChange?.(startOfWeek, endOfWeek);
    } else {
      // Move to previous month
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      setCurrentDate(newDate);
      onDateRangeChange?.(new Date(newDate.getFullYear(), newDate.getMonth(), 1), new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0));
    }
  }, [currentDate, onDateRangeChange, viewType]);

  const goToNext = useCallback(() => {
    if (viewType === 'week') {
      // Move to next week
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
      setCurrentDate(newDate);

      // Calculate week start and end for date range change
      const startOfWeek = new Date(newDate);
      startOfWeek.setDate(newDate.getDate() - newDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      onDateRangeChange?.(startOfWeek, endOfWeek);
    } else {
      // Move to next month
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      setCurrentDate(newDate);
      onDateRangeChange?.(new Date(newDate.getFullYear(), newDate.getMonth(), 1), new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0));
    }
  }, [currentDate, onDateRangeChange, viewType]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);

    if (viewType === 'week') {
      // Calculate week start and end for today
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      onDateRangeChange?.(startOfWeek, endOfWeek);
    } else {
      // Month view
      onDateRangeChange?.(new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0));
    }
  }, [onDateRangeChange, viewType]);

  // Event handlers
  const handleEventClick = useCallback((event: LeaveCalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
    onEventClick?.(event);
  }, [onEventClick]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  }, []);

  // View type options
  const viewTypeOptions: IDropdownOption[] = [
    { key: 'month', text: 'Month View' },
    { key: 'week', text: 'Week View' }
  ];

  // Get status color
  const getStatusColor = (status: LeaveRequestStatus) => {
    switch (status) {
      case LeaveRequestStatus.APPROVED:
        return '#107c10';
      case LeaveRequestStatus.PENDING:
        return '#ff8c00';
      case LeaveRequestStatus.REJECTED:
        return '#d13438';
      default:
        return '#0078d4';
    }
  };

  // Get status text
  const getStatusText = (status: LeaveRequestStatus) => {
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 team-calendar-view ${className}`}>
        <Stack horizontal horizontalAlign="center" verticalAlign="center" tokens={{ padding: 40 }}>
          <Spinner size={SpinnerSize.large} label="Loading calendar..." />
        </Stack>
      </div>
    );
  }

  return (
    <>
      <div className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 team-calendar-view ${className}`}>
        <Stack tokens={stackTokens}>
          {/* Header Controls */}
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }}>
              <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
                {viewType === 'week' ? (
                  (() => {
                    // Calculate week range for display
                    const startOfWeek = new Date(currentDate);
                    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(startOfWeek.getDate() + 6);

                    const startMonth = MONTH_NAMES[startOfWeek.getMonth()];
                    const endMonth = MONTH_NAMES[endOfWeek.getMonth()];
                    const startYear = startOfWeek.getFullYear();
                    const endYear = endOfWeek.getFullYear();

                    if (startOfWeek.getMonth() === endOfWeek.getMonth() && startYear === endYear) {
                      // Same month and year
                      return `${startMonth} ${startOfWeek.getDate()}-${endOfWeek.getDate()}, ${startYear}`;
                    } else if (startYear === endYear) {
                      // Same year, different months
                      return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${startYear}`;
                    } else {
                      // Different years
                      return `${startMonth} ${startOfWeek.getDate()}, ${startYear} - ${endMonth} ${endOfWeek.getDate()}, ${endYear}`;
                    }
                  })()
                ) : (
                  `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                )}
              </Text>

              <Stack horizontal tokens={{ childrenGap: 4 }}>
                <IconButton
                  iconProps={{ iconName: 'ChevronLeft' }}
                  onClick={goToPrevious}
                  title={viewType === 'week' ? 'Previous week' : 'Previous month'}
                />
                <IconButton
                  iconProps={{ iconName: 'ChevronRight' }}
                  onClick={goToNext}
                  title={viewType === 'week' ? 'Next week' : 'Next month'}
                />
              </Stack>

              <DefaultButton
                text="Today"
                onClick={goToToday}
              />
            </Stack>

            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }}>
              <Dropdown
                selectedKey={viewType}
                options={viewTypeOptions}
                onChange={(_, option) => setViewType(option?.key as 'month' | 'week')}
                styles={{ dropdown: { width: 120 } }}
              />
            </Stack>
          </Stack>

          {/* Calendar Grid */}
          <div className="calendar-grid">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="text-center py-2">
                  <Text variant="medium" styles={{ root: { fontWeight: 600, color: '#666' } }}>
                    {day}
                  </Text>
                </div>
              ))}
            </div>

            {/* Conditional rendering based on view type */}
            {viewType === 'month' ? (
              /* Month View */
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => (
                  <div
                    key={index}
                    className={`
                      min-h-24 p-1 border border-gray-200 relative
                      ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                      ${day.isToday ? 'border-blue-500 border-2' : ''}
                    `}
                  >
                    <Text
                      variant="small"
                      styles={{
                        root: {
                          fontWeight: day.isToday ? 600 : 400,
                          color: day.isCurrentMonth ? '#000' : '#666'
                        }
                      }}
                    >
                      {day.date.getDate()}
                    </Text>

                    {/* Events for this day */}
                    <Stack tokens={{ childrenGap: 1 }} className="mt-1">
                      {day.events.slice(0, 3).map((event, eventIndex) => (
                        <TooltipHost
                          key={eventIndex}
                          content={`${event.user_display_name} - ${event.leave_request.leave_type.name}`}
                        >
                          <div
                            className="text-xs px-1 py-0.5 rounded text-white cursor-pointer hover:opacity-80 truncate"
                            style={{ backgroundColor: event.color || getStatusColor(event.leave_request.status) }}
                            onClick={() => handleEventClick(event)}
                          >
                            {event.user_display_name.split(' ')[0]}
                          </div>
                        </TooltipHost>
                      ))}

                      {day.events.length > 3 && (
                        <Text variant="tiny" styles={{ root: { color: '#666', textAlign: 'center' } }}>
                          +{day.events.length - 3} more
                        </Text>
                      )}
                    </Stack>
                  </div>
                ))}
              </div>
            ) : (
              /* Week View */
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => (
                  <div
                    key={index}
                    className={`
                      min-h-32 p-3 border border-gray-200 relative bg-white rounded-lg
                      ${day.isToday ? 'border-blue-500 border-2 shadow-sm' : ''}
                    `}
                  >
                    <Text
                      variant="medium"
                      styles={{
                        root: {
                          fontWeight: day.isToday ? 600 : 500,
                          color: day.isToday ? '#0078d4' : '#000',
                          textAlign: 'center',
                          marginBottom: 8
                        }
                      }}
                    >
                      {day.date.getDate()}
                    </Text>

                    {/* Events for this day - more detailed in week view */}
                    <Stack tokens={{ childrenGap: 2 }} className="mt-2">
                      {day.events.map((event, eventIndex) => (
                        <TooltipHost
                          key={eventIndex}
                          content={`${event.user_display_name} - ${event.leave_request.leave_type.name} (${event.leave_request.days_requested} days)`}
                        >
                          <div
                            className="text-xs px-2 py-1 rounded text-white cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: event.color || getStatusColor(event.leave_request.status) }}
                            onClick={() => handleEventClick(event)}
                          >
                            <div className="font-medium">{event.user_display_name.split(' ')[0]}</div>
                            <div className="text-xs opacity-90">{event.leave_request.leave_type.name}</div>
                          </div>
                        </TooltipHost>
                      ))}

                      {day.events.length === 0 && (
                        <div className="text-center text-gray-400 text-xs py-4">
                          No leave
                        </div>
                      )}
                    </Stack>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <Stack horizontal tokens={{ childrenGap: 16 }} horizontalAlign="center">
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
              <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor(LeaveRequestStatus.APPROVED) }} />
              <Text variant="small">Approved</Text>
            </Stack>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
              <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor(LeaveRequestStatus.PENDING) }} />
              <Text variant="small">Pending</Text>
            </Stack>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
              <div className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor(LeaveRequestStatus.REJECTED) }} />
              <Text variant="small">Rejected</Text>
            </Stack>
          </Stack>
        </Stack>
      </div>

      {/* Event Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onDismiss={handleCloseModal}
        containerClassName="event-details-modal"
      >
        {selectedEvent && (
          <div className="p-6 bg-white min-w-96 max-w-lg">
            <Stack tokens={{ childrenGap: 16 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="xLarge" styles={{ root: { fontWeight: 600 } }}>
                  Leave Details
                </Text>
                <IconButton
                  iconProps={{ iconName: 'Cancel' }}
                  onClick={handleCloseModal}
                />
              </Stack>

              {/* Employee Info */}
              <Stack>
                <Text variant="medium" styles={{ root: { fontWeight: 600, marginBottom: 8 } }}>
                  Employee
                </Text>
                <Persona
                  text={selectedEvent.user_display_name}
                  size={PersonaSize.size40}
                />
              </Stack>

              {/* Leave Details */}
              <Stack tokens={{ childrenGap: 12 }}>
                <Stack horizontal tokens={{ childrenGap: 20 }}>
                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      Leave Type
                    </Text>
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: selectedEvent.leave_request.leave_type.color_code || '#0078d4',
                        }}
                      />
                      <Text variant="medium">{selectedEvent.leave_request.leave_type.name}</Text>
                    </Stack>
                  </Stack>

                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      Status
                    </Text>
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 6 }}>
                      <Icon
                        iconName={selectedEvent.leave_request.status === LeaveRequestStatus.APPROVED ? 'CheckMark' : 'Clock'}
                        styles={{ root: { color: getStatusColor(selectedEvent.leave_request.status), fontSize: 14 } }}
                      />
                      <Text
                        variant="medium"
                        styles={{ root: { color: getStatusColor(selectedEvent.leave_request.status), fontWeight: 600 } }}
                      >
                        {getStatusText(selectedEvent.leave_request.status)}
                      </Text>
                    </Stack>
                  </Stack>
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 20 }}>
                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      Start Date
                    </Text>
                    <Text variant="medium">
                      {new Date(selectedEvent.leave_request.start_date).toLocaleDateString()}
                    </Text>
                  </Stack>

                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      End Date
                    </Text>
                    <Text variant="medium">
                      {new Date(selectedEvent.leave_request.end_date).toLocaleDateString()}
                    </Text>
                  </Stack>

                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      Duration
                    </Text>
                    <Text variant="medium">
                      {selectedEvent.leave_request.days_requested} days
                    </Text>
                  </Stack>
                </Stack>

                {selectedEvent.leave_request.reason && (
                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      Reason
                    </Text>
                    <Text variant="medium" styles={{ root: { fontStyle: 'italic' } }}>
                      "{selectedEvent.leave_request.reason}"
                    </Text>
                  </Stack>
                )}

                {selectedEvent.leave_request.manager_comments && (
                  <Stack tokens={{ childrenGap: 4 }}>
                    <Text variant="small" styles={{ root: { color: '#666', fontWeight: 600 } }}>
                      Manager Comments
                    </Text>
                    <Text variant="medium">
                      {selectedEvent.leave_request.manager_comments}
                    </Text>
                  </Stack>
                )}
              </Stack>

              <Stack horizontal horizontalAlign="end">
                <DefaultButton text="Close" onClick={handleCloseModal} />
              </Stack>
            </Stack>
          </div>
        )}
      </Modal>
    </>
  );
};

export default TeamCalendarView;