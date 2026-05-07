import React from 'react';
import { getWeekNumber } from '../../constants';

interface DateDisplayProps {
  currentDate: Date;
  monthYearDisplay: string;
  viewMode: 'month' | 'day';
}

export const DateDisplay: React.FC<DateDisplayProps> = ({
  currentDate,
  monthYearDisplay,
  viewMode
}) => {
  const weekNumber = getWeekNumber(currentDate);
  const dayNumber = currentDate.getDate();

  return (
    <div className="flex items-center gap-4">
      <h1 className="text-2xl font-bold text-gray-900">
        {monthYearDisplay}
      </h1>

      <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
        Week {weekNumber}
      </span>

      {viewMode === 'month' && (
        <div className="flex items-center justify-center w-10 h-10 text-lg font-bold text-white bg-indigo-600 rounded-full">
          {dayNumber}
        </div>
      )}
    </div>
  );
};
