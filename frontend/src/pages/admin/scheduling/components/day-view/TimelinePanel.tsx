import React from 'react';
import { TimeAxis } from './TimeAxis';
import { TimelineEventBlock } from './TimelineEventBlock';
import { DAY_VIEW_CONFIG } from '../../constants';
import { generateTimeSlots } from '../../utils/timeUtils';
import type { PositionedEvent } from '../../types';

interface TimelinePanelProps {
  events: PositionedEvent[];
  selectedEventId?: string | null;
  onEventClick?: (event: PositionedEvent) => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  events,
  selectedEventId,
  onEventClick
}) => {
  const timeSlots = generateTimeSlots();
  const totalHeight = timeSlots.length * DAY_VIEW_CONFIG.slotHeight;

  return (
    <div className="flex-1 flex overflow-hidden">
      <TimeAxis />

      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {timeSlots.map((slot, index) => (
            <div
              key={slot.hour}
              className="absolute w-full border-t border-gray-100"
              style={{ top: `${index * DAY_VIEW_CONFIG.slotHeight}px` }}
            >
              <div
                className="absolute w-full border-t border-gray-50"
                style={{ top: `${DAY_VIEW_CONFIG.halfSlotHeight}px` }}
              />
            </div>
          ))}

          <CurrentTimeIndicator />

          <div className="absolute inset-0 ml-1 mr-2">
            {events.map((event) => (
              <TimelineEventBlock
                key={event.id}
                event={event}
                isSelected={event.id === selectedEventId}
                onClick={onEventClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CurrentTimeIndicator: React.FC = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours < DAY_VIEW_CONFIG.startHour || hours >= DAY_VIEW_CONFIG.endHour) {
    return null;
  }

  const totalMinutes = (hours - DAY_VIEW_CONFIG.startHour) * 60 + minutes;
  const top = (totalMinutes / 60) * DAY_VIEW_CONFIG.slotHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
};
