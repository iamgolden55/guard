import React from 'react';
import { TimeAxis } from './TimeAxis';
import { TimelineEventBlock } from './TimelineEventBlock';
import { DAY_VIEW_CONFIG, MODERN_STYLES } from '../../constants';
import { generateTimeSlots } from '../../utils/timeUtils';
import type { PositionedEvent, TimeBounds } from '../../types';

interface TimelinePanelProps {
  events: PositionedEvent[];
  selectedEventId?: string | null;
  onEventClick?: (event: PositionedEvent) => void;
  timeBounds: TimeBounds;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  events,
  selectedEventId,
  onEventClick,
  timeBounds
}) => {
  const timeSlots = generateTimeSlots(timeBounds.startHour, timeBounds.endHour);
  const totalHeight = timeSlots.length * DAY_VIEW_CONFIG.slotHeight;

  return (
    <div className="flex-1 flex overflow-hidden">
      <TimeAxis startHour={timeBounds.startHour} endHour={timeBounds.endHour} />

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {/* Grid lines with hour/half-hour distinction */}
          {timeSlots.map((slot, index) => (
            <div
              key={slot.hour}
              className={`absolute w-full border-t ${MODERN_STYLES.gridLine.hour}`}
              style={{ top: `${index * DAY_VIEW_CONFIG.slotHeight}px` }}
            >
              {/* Half-hour line - more subtle */}
              <div
                className={`absolute w-full border-t ${MODERN_STYLES.gridLine.halfHour} border-dashed`}
                style={{ top: `${DAY_VIEW_CONFIG.halfSlotHeight}px` }}
              />
            </div>
          ))}

          <CurrentTimeIndicator startHour={timeBounds.startHour} endHour={timeBounds.endHour} />

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

interface CurrentTimeIndicatorProps {
  startHour: number;
  endHour: number;
}

const CurrentTimeIndicator: React.FC<CurrentTimeIndicatorProps> = ({ startHour, endHour }) => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours < startHour || hours >= endHour) {
    return null;
  }

  const totalMinutes = (hours - startHour) * 60 + minutes;
  const top = (totalMinutes / 60) * DAY_VIEW_CONFIG.slotHeight;
  const { currentTime } = MODERN_STYLES;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        {/* Glowing dot indicator */}
        <div className={`w-3 h-3 ${currentTime.dot} rounded-full -ml-1.5 ${currentTime.glow}`} />
        {/* Time line with glow */}
        <div className={`flex-1 h-[2px] ${currentTime.line} ${currentTime.glow}`} />
      </div>
    </div>
  );
};
