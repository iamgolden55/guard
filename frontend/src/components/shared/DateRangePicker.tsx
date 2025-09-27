// Date Range Picker Component
// Reusable date range picker for Legal Compliance Reporting System - SSMS-COMPLIANCE-2025

import React, { useState, useCallback } from 'react';
import { Button, Input, Label, Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components';
import { Calendar24Regular } from '@fluentui/react-icons';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from 'date-fns';
import type { DateRange } from '../../types/compliance';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showPresets?: boolean;
  maxDate?: Date;
  minDate?: Date;
}

interface DatePreset {
  label: string;
  getValue: () => DateRange;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date range',
  className = '',
  disabled = false,
  showPresets = true,
  maxDate,
  minDate
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');

  const datePresets: DatePreset[] = [
    {
      label: 'Today',
      getValue: () => [startOfDay(new Date()), endOfDay(new Date())]
    },
    {
      label: 'Yesterday',
      getValue: () => {
        const yesterday = subDays(new Date(), 1);
        return [startOfDay(yesterday), endOfDay(yesterday)];
      }
    },
    {
      label: 'Last 7 days',
      getValue: () => [startOfDay(subDays(new Date(), 6)), endOfDay(new Date())]
    },
    {
      label: 'Last 30 days',
      getValue: () => [startOfDay(subDays(new Date(), 29)), endOfDay(new Date())]
    },
    {
      label: 'This week',
      getValue: () => [startOfWeek(new Date(), { weekStartsOn: 1 }), endOfWeek(new Date(), { weekStartsOn: 1 })]
    },
    {
      label: 'Last week',
      getValue: () => {
        const lastWeek = subWeeks(new Date(), 1);
        return [startOfWeek(lastWeek, { weekStartsOn: 1 }), endOfWeek(lastWeek, { weekStartsOn: 1 })];
      }
    },
    {
      label: 'This month',
      getValue: () => [startOfMonth(new Date()), endOfMonth(new Date())]
    },
    {
      label: 'Last month',
      getValue: () => {
        const lastMonth = subMonths(new Date(), 1);
        return [startOfMonth(lastMonth), endOfMonth(lastMonth)];
      }
    },
    {
      label: 'This year',
      getValue: () => [startOfYear(new Date()), endOfYear(new Date())]
    }
  ];

  const formatDateRange = useCallback((range: DateRange): string => {
    if (!range || !range[0] || !range[1]) return '';

    const start = format(range[0], 'MMM d, yyyy');
    const end = format(range[1], 'MMM d, yyyy');

    if (start === end) return start;
    return `${start} - ${end}`;
  }, []);

  const handlePresetClick = useCallback((preset: DatePreset) => {
    const newRange = preset.getValue();
    onChange(newRange);
    setIsOpen(false);
  }, [onChange]);

  const handleCustomDateApply = useCallback(() => {
    if (!tempStartDate || !tempEndDate) return;

    const startDate = new Date(tempStartDate);
    const endDate = new Date(tempEndDate);

    if (startDate > endDate) {
      // Swap dates if start is after end
      onChange([startOfDay(endDate), endOfDay(startDate)]);
    } else {
      onChange([startOfDay(startDate), endOfDay(endDate)]);
    }

    setIsOpen(false);
  }, [tempStartDate, tempEndDate, onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    setTempStartDate('');
    setTempEndDate('');
  }, [onChange]);

  // Initialize temp dates when opening
  const handleOpen = useCallback(() => {
    if (value && value[0] && value[1]) {
      setTempStartDate(format(value[0], 'yyyy-MM-dd'));
      setTempEndDate(format(value[1], 'yyyy-MM-dd'));
    } else {
      setTempStartDate('');
      setTempEndDate('');
    }
    setIsOpen(true);
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={(_, data) => setIsOpen(data.open)}>
        <PopoverTrigger disableButtonEnhancement>
          <Button
            appearance="outline"
            disabled={disabled}
            onClick={handleOpen}
            icon={<Calendar24Regular />}
            className="w-full justify-start text-left font-normal"
          >
            {value && formatDateRange(value) ? formatDateRange(value) : placeholder}
          </Button>
        </PopoverTrigger>

        <PopoverSurface className="p-4 min-w-80">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Select Date Range</h4>
              {value && (
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={handleClear}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Preset Buttons */}
            {showPresets && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Quick Select</Label>
                <div className="grid grid-cols-2 gap-2">
                  {datePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      appearance="outline"
                      size="small"
                      onClick={() => handlePresetClick(preset)}
                      className="text-sm"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Date Inputs */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-medium text-gray-700">Custom Range</Label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start-date" className="text-xs text-gray-600 mb-1 block">
                    Start Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={tempStartDate}
                    onChange={(_, data) => setTempStartDate(data.value)}
                    min={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
                    max={maxDate ? format(maxDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label htmlFor="end-date" className="text-xs text-gray-600 mb-1 block">
                    End Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={tempEndDate}
                    onChange={(_, data) => setTempEndDate(data.value)}
                    min={tempStartDate || (minDate ? format(minDate, 'yyyy-MM-dd') : undefined)}
                    max={maxDate ? format(maxDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Apply/Cancel Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  appearance="subtle"
                  size="small"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  appearance="primary"
                  size="small"
                  onClick={handleCustomDateApply}
                  disabled={!tempStartDate || !tempEndDate}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverSurface>
      </Popover>
    </div>
  );
};

// Quick date range buttons component
export const QuickDateRangeButtons: React.FC<{
  onRangeSelect: (range: DateRange) => void;
  selectedRange?: DateRange;
  className?: string;
}> = ({ onRangeSelect, selectedRange, className = '' }) => {
  const quickRanges = [
    { label: 'Today', days: 0 },
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
  ];

  const isRangeSelected = (days: number): boolean => {
    if (!selectedRange || !selectedRange[0] || !selectedRange[1]) return false;

    const expectedStart = startOfDay(subDays(new Date(), days === 0 ? 0 : days - 1));
    const expectedEnd = endOfDay(new Date());

    return (
      selectedRange[0].getTime() === expectedStart.getTime() &&
      selectedRange[1].getTime() === expectedEnd.getTime()
    );
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {quickRanges.map(({ label, days }) => (
        <Button
          key={label}
          appearance={isRangeSelected(days) ? 'primary' : 'outline'}
          size="small"
          onClick={() => {
            const range: DateRange = days === 0
              ? [startOfDay(new Date()), endOfDay(new Date())]
              : [startOfDay(subDays(new Date(), days - 1)), endOfDay(new Date())];
            onRangeSelect(range);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
};

export default DateRangePicker;