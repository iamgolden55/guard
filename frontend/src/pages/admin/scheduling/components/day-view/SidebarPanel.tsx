import React from 'react';
import { MiniCalendar } from './MiniCalendar';
import { EventDetails } from './EventDetails';
import type { CalendarEvent } from '../../types';

interface SidebarPanelProps {
  currentDate: Date;
  selectedDate: Date;
  selectedEvent: CalendarEvent | null;
  eventDates?: Set<string>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onDeleteEvent?: (event: CalendarEvent) => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  currentDate,
  selectedDate,
  selectedEvent,
  eventDates,
  onDateSelect,
  onMonthChange,
  onEditEvent,
  onDeleteEvent
}) => {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col gap-4 p-4 border-l border-gray-200 bg-gray-50 overflow-y-auto">
      <MiniCalendar
        currentDate={currentDate}
        selectedDate={selectedDate}
        eventDates={eventDates}
        onDateSelect={onDateSelect}
        onMonthChange={onMonthChange}
      />

      <EventDetails
        event={selectedEvent}
        onEdit={onEditEvent}
        onDelete={onDeleteEvent}
      />
    </div>
  );
};
