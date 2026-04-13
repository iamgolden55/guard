import { useState, useMemo, useCallback } from 'react';
import type { ScheduleShift, CalendarEvent, PositionedEvent, TimeBounds } from '../types';
import { SHIFT_STATUS_TO_EVENT_TYPE } from '../constants';
import { calculateEventPositions } from '../utils/eventOverlap';
import { calculateTimeBounds } from '../utils/timeUtils';

interface UseDayViewOptions {
  shifts: ScheduleShift[];
  selectedDate: Date;
}

export function useDayView({ shifts, selectedDate }: UseDayViewOptions) {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Convert shifts to calendar events
  const calendarEvents = useMemo((): CalendarEvent[] => {
    return shifts.map((shift) => {
      const [startHours, startMins] = shift.startTime.split(':').map(Number);
      const [endHours, endMins] = shift.endTime.split(':').map(Number);

      const start = new Date(shift.date);
      start.setHours(startHours, startMins, 0, 0);

      const end = new Date(shift.date);
      end.setHours(endHours, endMins, 0, 0);

      // Handle overnight shifts
      if (end < start) {
        end.setDate(end.getDate() + 1);
      }

      // Determine event type
      let type: CalendarEvent['type'] = 'work';
      if (!shift.staffId) {
        type = 'open';
      } else if (shift.isPublished) {
        type = 'published';
      } else if (shift.status) {
        type = SHIFT_STATUS_TO_EVENT_TYPE[shift.status] || 'work';
      }

      return {
        id: `shift-${shift.id}`,
        title: shift.venueName,
        start,
        end,
        type,
        description: shift.staffName ? `Staff: ${shift.staffName}` : 'Open Shift',
        attendees: shift.staffId && shift.staffName
          ? [{ id: shift.staffId, name: shift.staffName }]
          : [],
        shift
      };
    });
  }, [shifts]);

  // Filter events for selected date
  const dayEvents = useMemo(() => {
    return calendarEvents.filter((event) => {
      const eventDate = event.start.toDateString();
      const targetDate = selectedDate.toDateString();
      return eventDate === targetDate;
    });
  }, [calendarEvents, selectedDate]);

  // Calculate time bounds based on day's events
  const timeBounds = useMemo((): TimeBounds => {
    return calculateTimeBounds(dayEvents);
  }, [dayEvents]);

  // Calculate positioned events for timeline
  const positionedEvents = useMemo((): PositionedEvent[] => {
    return calculateEventPositions(dayEvents, timeBounds.startHour);
  }, [dayEvents, timeBounds.startHour]);

  // Get dates that have events (for mini calendar dots)
  const eventDates = useMemo(() => {
    const dates = new Set<string>();
    calendarEvents.forEach((event) => {
      dates.add(event.start.toISOString().split('T')[0]);
    });
    return dates;
  }, [calendarEvents]);

  // Handle event selection
  const handleEventClick = useCallback((event: PositionedEvent) => {
    setSelectedEvent((prev) =>
      prev?.id === event.id ? null : event
    );
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedEvent(null);
  }, []);

  return {
    calendarEvents,
    dayEvents,
    positionedEvents,
    selectedEvent,
    eventDates,
    timeBounds,
    setSelectedEvent,
    handleEventClick,
    clearSelection
  };
}
