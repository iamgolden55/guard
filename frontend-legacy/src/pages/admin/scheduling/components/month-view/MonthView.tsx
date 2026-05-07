import React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import type { ScheduleShift } from '../../types';
import { DAYS_OF_WEEK } from '../../types';
import { MonthDayCell } from './MonthDayCell';

interface MonthViewProps {
  calendarDays: Date[];
  currentDate: Date;
  shifts: ScheduleShift[];
  isLoading?: boolean;
  isSelectionMode?: boolean;
  selectedShifts?: Set<number>;
  getShiftsForDay: (date: Date) => ScheduleShift[];
  isCurrentMonth: (date: Date) => boolean;
  isToday: (date: Date) => boolean;
  onAddShift?: (date: Date) => void;
  onEditShift?: (shift: ScheduleShift) => void;
  onSelectShift?: (shiftId: number) => void;
  onDayClick?: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  calendarDays,
  currentDate,
  shifts,
  isLoading = false,
  isSelectionMode = false,
  selectedShifts = new Set(),
  getShiftsForDay,
  isCurrentMonth,
  isToday,
  onAddShift,
  onEditShift,
  onSelectShift,
  onDayClick
}) => {
  return (
    <div className="relative bg-white rounded-xl shadow-sm overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
          <Spinner size={SpinnerSize.large} label="Loading shifts..." />
        </div>
      )}

      <div className="grid grid-cols-7 border-b-2 border-gray-200">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="py-3 px-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 bg-gray-50"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => (
          <MonthDayCell
            key={`${day.toISOString()}-${index}`}
            date={day}
            shifts={getShiftsForDay(day)}
            isCurrentMonth={isCurrentMonth(day)}
            isToday={isToday(day)}
            isSelectionMode={isSelectionMode}
            selectedShifts={selectedShifts}
            onAddShift={onAddShift}
            onEditShift={onEditShift}
            onSelectShift={onSelectShift}
            onDayClick={onDayClick}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 py-3 px-4 border-t border-gray-100 bg-gray-50">
        <LegendItem color="bg-blue-100 border-l-blue-500" label="Assigned" />
        <LegendItem color="bg-emerald-100 border-l-emerald-500" label="Open Shift" />
        <LegendItem color="bg-purple-100 border-l-purple-500" label="Published" />
      </div>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2 text-xs text-gray-600">
    <div className={`w-3 h-3 rounded-sm border-l-2 ${color}`} />
    <span>{label}</span>
  </div>
);
