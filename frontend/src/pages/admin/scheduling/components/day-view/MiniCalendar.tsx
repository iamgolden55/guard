import React, { useMemo } from 'react';
import { ChevronLeft16Regular, ChevronRight16Regular } from '@fluentui/react-icons';
import { DAYS_OF_WEEK } from '../../types';

interface MiniCalendarProps {
  currentDate: Date;
  selectedDate: Date;
  eventDates?: Set<string>;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({
  currentDate,
  selectedDate,
  eventDates = new Set(),
  onDateSelect,
  onMonthChange
}) => {
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = lastDay.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }

    for (let i = 1; i <= lastDate; i++) {
      days.push(new Date(year, month, i));
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  }, [currentDate]);

  const monthYearDisplay = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const isCurrentMonth = (date: Date) =>
    date.getMonth() === currentDate.getMonth();

  const isTodayDate = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) =>
    date.toDateString() === selectedDate.toDateString();

  const hasEvents = (date: Date) =>
    eventDates.has(date.toISOString().split('T')[0]);

  const handlePrevMonth = () => {
    onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft16Regular className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {monthYearDisplay}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight16Regular className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
            {day[0]}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => onDateSelect(day)}
            className={`
              relative w-7 h-7 flex items-center justify-center text-xs rounded-full
              transition-colors
              ${!isCurrentMonth(day) ? 'text-gray-300' : 'text-gray-700'}
              ${isTodayDate(day) ? 'font-bold' : ''}
              ${isSelected(day)
                ? 'bg-indigo-600 text-white'
                : 'hover:bg-gray-100'
              }
            `}
          >
            {day.getDate()}
            {hasEvents(day) && !isSelected(day) && (
              <span className="absolute bottom-0.5 w-1 h-1 bg-indigo-500 rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
