import React from 'react';
import { Add16Regular } from '@fluentui/react-icons';
import type { ScheduleShift } from '../../types';
import { EventPill } from './EventPill';
import { SHIFT_STATUS_TO_EVENT_TYPE } from '../../constants';

interface MonthDayCellProps {
  date: Date;
  shifts: ScheduleShift[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelectionMode?: boolean;
  selectedShifts?: Set<number>;
  onAddShift?: (date: Date) => void;
  onEditShift?: (shift: ScheduleShift) => void;
  onSelectShift?: (shiftId: number) => void;
  onDayClick?: (date: Date) => void;
}

export const MonthDayCell: React.FC<MonthDayCellProps> = ({
  date,
  shifts,
  isCurrentMonth,
  isToday,
  isSelectionMode = false,
  selectedShifts = new Set(),
  onAddShift,
  onEditShift,
  onSelectShift,
  onDayClick
}) => {
  const maxVisibleShifts = 3;
  const hasOverflow = shifts.length > maxVisibleShifts;
  const visibleShifts = shifts.slice(0, maxVisibleShifts);
  const overflowCount = shifts.length - maxVisibleShifts;

  const handleCellClick = () => {
    if (!isSelectionMode && onAddShift) {
      onAddShift(date);
    }
  };

  const handleDayNumberClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDayClick?.(date);
  };

  const getEventType = (shift: ScheduleShift) => {
    if (!shift.staffId) return 'open';
    if (shift.isPublished) return 'published';
    return SHIFT_STATUS_TO_EVENT_TYPE[shift.status || 'scheduled'] || 'work';
  };

  return (
    <div
      onClick={handleCellClick}
      className={`
        group relative min-h-[140px] p-2 bg-white border-b border-r border-gray-100
        ${!isSelectionMode ? 'cursor-pointer hover:bg-gray-50' : ''}
        ${!isCurrentMonth ? 'opacity-40' : ''}
        ${isToday ? 'bg-indigo-50/50' : ''}
      `}
    >
      <button
        onClick={handleDayNumberClick}
        className={`
          absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-sm font-medium rounded-full
          transition-colors
          ${isToday
            ? 'bg-indigo-600 text-white'
            : 'text-gray-900 hover:bg-gray-100'
          }
        `}
      >
        {date.getDate()}
      </button>

      {!isSelectionMode && isCurrentMonth && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddShift?.(date);
          }}
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all"
          title="Add shift"
        >
          <Add16Regular />
        </button>
      )}

      <div className="mt-8 space-y-1">
        {visibleShifts.map((shift) => (
          <EventPill
            key={shift.id}
            title={shift.venueName}
            startTime={shift.startTime}
            type={getEventType(shift)}
            isSelected={selectedShifts.has(shift.id)}
            onClick={() => {
              if (isSelectionMode && onSelectShift) {
                onSelectShift(shift.id);
              } else if (onEditShift) {
                onEditShift(shift);
              }
            }}
          />
        ))}

        {hasOverflow && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDayClick?.(date);
            }}
            className="text-xs text-indigo-600 font-medium hover:text-indigo-800 hover:underline"
          >
            {overflowCount} more...
          </button>
        )}
      </div>
    </div>
  );
};
