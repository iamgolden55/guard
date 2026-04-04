import React, { useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  EventDropArg,
  DateSelectArg,
  EventClickArg,
} from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { ResourceLabelContentArg } from '@fullcalendar/resource';
import { ShiftEventContent } from './ShiftEventContent';
import { ResourceLabel } from './ResourceLabel';
import type { SchedulerResource, SchedulerEvent, GroupBy } from '../types/scheduler';

interface Props {
  resources: SchedulerResource[];
  events: SchedulerEvent[];
  groupBy: GroupBy;
  isLoading: boolean;
  onEventDrop: (info: EventDropArg) => void;
  onEventResize: (info: EventResizeDoneArg) => void;
  onDateSelect: (info: DateSelectArg) => void;
  onEventClick: (info: EventClickArg) => void;
  onDatesSet: (start: string, end: string) => void;
  calendarRef: React.RefObject<FullCalendar | null>;
}

export const ResourceTimeline: React.FC<Props> = ({
  resources,
  events,
  groupBy,
  isLoading,
  onEventDrop,
  onEventResize,
  onDateSelect,
  onEventClick,
  onDatesSet,
  calendarRef,
}) => {
  const handleDatesSet = useCallback(
    (arg: { startStr: string; endStr: string }) => {
      onDatesSet(arg.startStr, arg.endStr);
    },
    [onDatesSet]
  );

  // Map resources to FullCalendar format
  const fcResources = resources.map((r) => ({
    id: r.id,
    title: r.title,
    extendedProps: r,
  }));

  // Map events to FullCalendar format
  const fcEvents = events.map((e) => ({
    id: String(e.id),
    resourceId: e.resourceId,
    title: e.title,
    start: e.start,
    end: e.end || undefined,
    extendedProps: e.extendedProps,
    editable: true,
    resourceEditable: true,
    durationEditable: true,
  }));

  return (
    <div className="flex-1 overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading schedule...
          </div>
        </div>
      )}

      <FullCalendar
        ref={calendarRef}
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineWeek"
        // Resource config
        resources={fcResources}
        resourceAreaHeaderContent={groupBy === 'staff' ? 'Guards' : 'Venues'}
        resourceAreaWidth="240px"
        resourceLabelContent={(info: ResourceLabelContentArg) => <ResourceLabel info={info} />}
        // Row height
        expandRows={true}
        contentHeight="auto"
        // Events
        events={fcEvents}
        eventContent={(info) => <ShiftEventContent eventInfo={info} />}
        // Interaction
        editable={true}
        selectable={true}
        selectMirror={true}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        select={onDateSelect}
        eventClick={onEventClick}
        // Time config
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        scrollTime="06:00:00"
        // Display
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'resourceTimelineDay,resourceTimelineWeek',
        }}
        buttonText={{
          today: 'Today',
          resourceTimelineDay: 'Day',
          resourceTimelineWeek: 'Week',
        }}
        height="100%"
        nowIndicator={true}
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
          startTime: '06:00',
          endTime: '23:00',
        }}
        // License key - FullCalendar Premium required for resource-timeline
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        // Date change callback
        datesSet={handleDatesSet}
        // Event styling
        eventMinWidth={60}
        resourceOrder="title"
      />
    </div>
  );
};
