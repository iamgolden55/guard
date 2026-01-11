import { useState, useCallback, useMemo } from 'react';

export function useCalendar(initialDate: Date = new Date()) {
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get the first day of the month
    const firstDay = new Date(year, month, 1);
    const startingDayOfWeek = firstDay.getDay();

    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    const lastDate = lastDay.getDate();

    // Add days from previous month to fill the first row
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }

    // Add all days from current month
    for (let i = 1; i <= lastDate; i++) {
      days.push(new Date(year, month, i));
    }

    // Add days from next month to complete the last row (always fill to 42 days for consistent 6 rows)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  }, [currentDate]);

  // Navigation functions
  const goToPreviousMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToMonth = useCallback((date: Date) => {
    setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
  }, []);

  // Helper to check if a date is in the current month
  const isCurrentMonth = useCallback((date: Date) => {
    return date.getMonth() === currentDate.getMonth() &&
           date.getFullYear() === currentDate.getFullYear();
  }, [currentDate]);

  // Helper to check if a date is today
  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }, []);

  // Format current month/year for display
  const monthYearDisplay = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, [currentDate]);

  return {
    currentDate,
    calendarDays,
    monthYearDisplay,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    goToMonth,
    isCurrentMonth,
    isToday,
    setCurrentDate
  };
}
