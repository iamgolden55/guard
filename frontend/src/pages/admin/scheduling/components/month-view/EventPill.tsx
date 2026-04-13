import React from 'react';
import { EVENT_COLORS } from '../../constants';
import type { EventType } from '../../types';

interface EventPillProps {
  title: string;
  startTime: string;
  type: EventType;
  onClick?: () => void;
  isSelected?: boolean;
}

export const EventPill: React.FC<EventPillProps> = ({
  title,
  startTime,
  type,
  onClick,
  isSelected = false
}) => {
  const colors = EVENT_COLORS[type];

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`w-full text-left px-2 py-1 mb-1 text-xs rounded border-l-2 transition-all truncate
        ${colors.pill}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
        hover:opacity-80 hover:shadow-sm
      `}
    >
      <span className="font-medium">{startTime}</span>
      <span className="ml-1 opacity-80">{title}</span>
    </button>
  );
};
