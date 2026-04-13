import React from 'react';
import { ChevronLeft20Regular, ChevronRight20Regular } from '@fluentui/react-icons';

interface NavigationControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  viewMode: 'month' | 'day';
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  onPrevious,
  onNext,
  onToday,
  viewMode
}) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevious}
        className="flex items-center justify-center w-9 h-9 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
        title={viewMode === 'month' ? 'Previous month' : 'Previous day'}
      >
        <ChevronLeft20Regular />
      </button>

      <button
        onClick={onNext}
        className="flex items-center justify-center w-9 h-9 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
        title={viewMode === 'month' ? 'Next month' : 'Next day'}
      >
        <ChevronRight20Regular />
      </button>

      <button
        onClick={onToday}
        className="px-4 py-2 ml-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        Today
      </button>
    </div>
  );
};
