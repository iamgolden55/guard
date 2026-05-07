import React from 'react';
import { generateTimeSlots } from '../../utils/timeUtils';
import { DAY_VIEW_CONFIG } from '../../constants';

interface TimeAxisProps {
  startHour: number;
  endHour: number;
}

// Major hours that should be emphasized (noon, 6 PM, midnight indicators)
const MAJOR_HOURS = [0, 6, 12, 18, 24];

export const TimeAxis: React.FC<TimeAxisProps> = ({ startHour, endHour }) => {
  const timeSlots = generateTimeSlots(startHour, endHour);
  const currentHour = new Date().getHours();

  return (
    <div
      className="flex-shrink-0 border-r border-gray-200 bg-gray-50/50"
      style={{ width: `${DAY_VIEW_CONFIG.timeAxisWidth}px` }}
    >
      {timeSlots.map((slot) => {
        const isMajorHour = MAJOR_HOURS.includes(slot.hour);
        const isCurrentHour = slot.hour === currentHour;

        return (
          <div
            key={slot.hour}
            className={`relative text-right pr-3 ${isCurrentHour ? 'bg-amber-50/50' : ''}`}
            style={{ height: `${DAY_VIEW_CONFIG.slotHeight}px` }}
          >
            <span
              className={`
                absolute -top-2.5 right-3 text-xs
                ${isMajorHour ? 'font-semibold text-gray-700' : 'font-medium text-gray-500'}
                ${isCurrentHour ? 'text-amber-700 font-semibold' : ''}
              `}
            >
              {slot.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
