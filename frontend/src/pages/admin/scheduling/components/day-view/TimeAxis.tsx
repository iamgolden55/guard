import React from 'react';
import { generateTimeSlots } from '../../utils/timeUtils';
import { DAY_VIEW_CONFIG } from '../../constants';

export const TimeAxis: React.FC = () => {
  const timeSlots = generateTimeSlots();

  return (
    <div
      className="flex-shrink-0 border-r border-gray-200"
      style={{ width: `${DAY_VIEW_CONFIG.timeAxisWidth}px` }}
    >
      {timeSlots.map((slot) => (
        <div
          key={slot.hour}
          className="relative text-right pr-3"
          style={{ height: `${DAY_VIEW_CONFIG.slotHeight}px` }}
        >
          <span className="absolute -top-2 right-3 text-xs text-gray-500 font-medium">
            {slot.label}
          </span>
        </div>
      ))}
    </div>
  );
};
