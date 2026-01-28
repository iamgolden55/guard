import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown20Regular, Calendar20Regular, CalendarDay20Regular } from '@fluentui/react-icons';

interface ViewSwitcherProps {
  viewMode: 'month' | 'day';
  onViewModeChange: (mode: 'month' | 'day') => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  viewMode,
  onViewModeChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'month' as const, label: 'Month View', icon: Calendar20Regular },
    { value: 'day' as const, label: 'Day View', icon: CalendarDay20Regular }
  ];

  const currentOption = options.find(o => o.value === viewMode) || options[0];
  const CurrentIcon = currentOption.icon;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <CurrentIcon className="w-5 h-5" />
        <span>{currentOption.label}</span>
        <ChevronDown20Regular className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 w-40 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  onViewModeChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  viewMode === option.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
