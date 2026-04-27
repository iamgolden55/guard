import React from 'react';
import { Add20Regular } from '@fluentui/react-icons';
import { DateDisplay } from './DateDisplay';
import { NavigationControls } from './NavigationControls';
import { ViewSwitcher } from './ViewSwitcher';

interface SchedulerHeaderProps {
  currentDate: Date;
  monthYearDisplay: string;
  viewMode: 'month' | 'day';
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: 'month' | 'day') => void;
  onAddEvent?: () => void;
}

export const SchedulerHeader: React.FC<SchedulerHeaderProps> = ({
  currentDate,
  monthYearDisplay,
  viewMode,
  onPrevious,
  onNext,
  onToday,
  onViewModeChange,
  onAddEvent
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
      <div className="flex items-center gap-4">
        <DateDisplay
          currentDate={currentDate}
          monthYearDisplay={monthYearDisplay}
          viewMode={viewMode}
        />
        <NavigationControls
          onPrevious={onPrevious}
          onNext={onNext}
          onToday={onToday}
          viewMode={viewMode}
        />
      </div>

      <div className="flex items-center gap-3">
        <ViewSwitcher
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />

        {onAddEvent && (
          <button
            onClick={onAddEvent}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Add20Regular className="w-5 h-5" />
            <span>Add Event</span>
          </button>
        )}
      </div>
    </div>
  );
};
