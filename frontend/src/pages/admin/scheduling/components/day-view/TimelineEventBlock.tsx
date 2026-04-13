import React from 'react';
import { EVENT_COLORS, MODERN_STYLES } from '../../constants';
import type { PositionedEvent } from '../../types';
import { formatTime } from '../../utils/timeUtils';

interface TimelineEventBlockProps {
  event: PositionedEvent;
  onClick?: (event: PositionedEvent) => void;
  isSelected?: boolean;
}

export const TimelineEventBlock: React.FC<TimelineEventBlockProps> = ({
  event,
  onClick,
  isSelected = false
}) => {
  const colors = EVENT_COLORS[event.type];
  const startTime = `${event.start.getHours().toString().padStart(2, '0')}:${event.start.getMinutes().toString().padStart(2, '0')}`;
  const endTime = `${event.end.getHours().toString().padStart(2, '0')}:${event.end.getMinutes().toString().padStart(2, '0')}`;
  const { eventBlock } = MODERN_STYLES;

  return (
    <button
      onClick={() => onClick?.(event)}
      className={`
        absolute ${eventBlock.base}
        ${eventBlock.transition}
        ${eventBlock.hover}
        ${eventBlock.active}
        ${colors.bg} ${colors.border} ${colors.text}
        ${isSelected ? eventBlock.selected : 'shadow-sm hover:shadow-lg'}
      `}
      style={{
        top: `${event.top}px`,
        height: `${Math.max(event.height - 2, 24)}px`,
        left: `${event.left}%`,
        width: `calc(${event.width}% - 4px)`,
        marginLeft: '2px'
      }}
    >
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-r-lg" />

      <div className="relative">
        <div className="font-semibold text-sm truncate leading-tight">
          {event.title}
        </div>

        {event.height > 44 && (
          <div className="text-xs opacity-80 truncate mt-0.5">
            {formatTime(startTime)} - {formatTime(endTime)}
          </div>
        )}

        {event.height > 75 && event.description && (
          <div className="text-xs opacity-60 mt-1 line-clamp-2">
            {event.description}
          </div>
        )}
      </div>
    </button>
  );
};
