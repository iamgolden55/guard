import React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import { TimelinePanel } from './TimelinePanel';
import { SidebarPanel } from './SidebarPanel';
import type { PositionedEvent, CalendarEvent, TimeBounds } from '../../types';

interface DayViewProps {
  currentDate: Date;
  selectedDate: Date;
  events: PositionedEvent[];
  selectedEvent: CalendarEvent | null;
  eventDates?: Set<string>;
  isLoading?: boolean;
  timeBounds: TimeBounds;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  onEventClick: (event: PositionedEvent) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
}

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  selectedDate,
  events,
  selectedEvent,
  eventDates,
  isLoading = false,
  timeBounds,
  onDateSelect,
  onMonthChange,
  onEventClick,
  onEditEvent,
  onDeleteEvent
}) => {
  return (
    <div className="relative flex bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Spinner size={SpinnerSize.large} label="Loading events..." />
        </div>
      )}

      <TimelinePanel
        events={events}
        selectedEventId={selectedEvent?.id}
        onEventClick={onEventClick}
        timeBounds={timeBounds}
      />

      <SidebarPanel
        currentDate={currentDate}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent}
        eventDates={eventDates}
        onDateSelect={onDateSelect}
        onMonthChange={onMonthChange}
        onEditEvent={onEditEvent}
        onDeleteEvent={onDeleteEvent}
      />
    </div>
  );
};
