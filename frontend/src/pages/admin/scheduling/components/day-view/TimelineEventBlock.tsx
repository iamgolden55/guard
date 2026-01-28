import React from 'react';
import { EVENT_COLORS } from '../../constants';
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

  return (
    <button
      onClick={() => onClick?.(event)}
      className={`
        absolute rounded-lg border-l-4 px-2 py-1 text-left overflow-hidden
        transition-all hover:shadow-md cursor-pointer
        ${colors.bg} ${colors.border} ${colors.text}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-md' : ''}
      `}
      style={{
        top: `${event.top}px`,
        height: `${Math.max(event.height - 2, 22)}px`,
        left: `${event.left}%`,
        width: `calc(${event.width}% - 4px)`,
        marginLeft: '2px'
      }}
    >
      <div className="font-semibold text-sm truncate leading-tight">
        {event.title}
      </div>

      {event.height > 40 && (
        <div className="text-xs opacity-75 truncate">
          {formatTime(startTime)} - {formatTime(endTime)}
        </div>
      )}

      {event.height > 70 && event.description && (
        <div className="text-xs opacity-60 mt-1 line-clamp-2">
          {event.description}
        </div>
      )}
    </button>
  );
};
