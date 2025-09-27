import React, { useCallback, useMemo } from 'react';
import { Text, TooltipHost, DirectionalHint } from '@fluentui/react';
import type { LeaveCalendarEvent, LeaveRequestStatus } from '../../types/leave';
import type { Holiday } from '../../services/holidayService';

export interface CalendarDayEvent extends LeaveCalendarEvent {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

interface AppleCalendarDayProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  isOtherMonth: boolean;
  isWeekend: boolean;
  events: CalendarDayEvent[];
  holidays: Holiday[];
  onClick: (date: Date) => void;
  onEventClick: (event: CalendarDayEvent) => void;
  className?: string;
}

const AppleCalendarDay: React.FC<AppleCalendarDayProps> = ({
  date,
  isSelected,
  isToday,
  isOtherMonth,
  isWeekend,
  events,
  holidays,
  onClick,
  onEventClick,
  className = ''
}) => {
  // Get today's holiday if any
  const todayHoliday = useMemo(() => {
    const dateStr = date.toISOString().split('T')[0];
    return holidays.find(holiday => holiday.date === dateStr);
  }, [date, holidays]);

  // Filter events for this specific date
  const dayEvents = useMemo(() => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventStart = event.start.split('T')[0];
      const eventEnd = event.end.split('T')[0];
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  }, [date, events]);

  // Get status-based CSS class for event dots
  const getEventStatusClass = useCallback((status: LeaveRequestStatus): string => {
    switch (status) {
      case 'APPROVED':
        return 'status-approved';
      case 'PENDING':
        return 'status-pending';
      case 'REJECTED':
        return 'status-rejected';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  }, []);

  // Get leave type CSS class
  const getLeaveTypeClass = useCallback((leaveTypeName: string): string => {
    const normalized = leaveTypeName.toLowerCase().replace(/\s+/g, '-');
    return `type-${normalized}`;
  }, []);

  // Handle day click
  const handleDayClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onClick(date);
  }, [date, onClick]);

  // Handle event dot click
  const handleEventClick = useCallback((e: React.MouseEvent, event: CalendarDayEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEventClick(event);
  }, [onEventClick]);

  // Build CSS classes for the day cell
  const dayClasses = useMemo(() => {
    const classes = ['apple-calendar-day'];

    if (isSelected) classes.push('is-selected');
    if (isToday) classes.push('is-today');
    if (isOtherMonth) classes.push('is-other-month');
    if (isWeekend) classes.push('is-weekend');
    if (todayHoliday) classes.push('has-holiday');
    if (className) classes.push(className);

    return classes.join(' ');
  }, [isSelected, isToday, isOtherMonth, isWeekend, todayHoliday, className]);

  // Get day number
  const dayNumber = date.getDate();

  // Maximum number of event dots to show (3 + "more" indicator)
  const MAX_VISIBLE_DOTS = 3;
  const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_DOTS);
  const remainingCount = Math.max(0, dayEvents.length - MAX_VISIBLE_DOTS);

  return (
    <div className={dayClasses} onClick={handleDayClick}>
      {/* Day Number */}
      <div className="apple-calendar-day-number">
        <Text variant="medium" style={{ lineHeight: 1 }}>
          {dayNumber}
        </Text>
      </div>

      {/* Holiday Name (if any) */}
      {todayHoliday && (
        <TooltipHost
          content={todayHoliday.name}
          directionalHint={DirectionalHint.topCenter}
        >
          <div className="apple-calendar-holiday-name">
            {todayHoliday.localName}
          </div>
        </TooltipHost>
      )}

      {/* Event Dots */}
      {dayEvents.length > 0 && (
        <div className="apple-calendar-events">
          {visibleEvents.map((event, index) => {
            const statusClass = getEventStatusClass(event.leave_request.status);
            const typeClass = getLeaveTypeClass(event.leave_request.leave_type.name);

            return (
              <TooltipHost
                key={`${event.id}-${index}`}
                content={
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {event.user_display_name}
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      {event.leave_request.leave_type.name}
                    </div>
                    <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>
                      Status: {event.leave_request.status}
                    </div>
                  </div>
                }
                directionalHint={DirectionalHint.topCenter}
              >
                <button
                  className={`apple-calendar-event-dot ${statusClass} ${typeClass}`}
                  style={{
                    backgroundColor: event.backgroundColor,
                    borderColor: event.borderColor
                  }}
                  onClick={(e) => handleEventClick(e, event)}
                  aria-label={`Leave request by ${event.user_display_name} - ${event.leave_request.leave_type.name}`}
                  tabIndex={0}
                />
              </TooltipHost>
            );
          })}

          {/* More indicator */}
          {remainingCount > 0 && (
            <TooltipHost
              content={`+${remainingCount} more leave request${remainingCount > 1 ? 's' : ''}`}
              directionalHint={DirectionalHint.topCenter}
            >
              <div className="apple-calendar-event-more">
                +{remainingCount}
              </div>
            </TooltipHost>
          )}
        </div>
      )}
    </div>
  );
};

export default AppleCalendarDay;