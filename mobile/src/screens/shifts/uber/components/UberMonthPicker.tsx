/**
 * UberMonthPicker - Expandable month grid view
 * Animated expand/collapse with shift count badges
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getUberColors, uberRadius, uberSpacing } from '../../../../theme/uberTheme';
import { useTheme } from '../../../../hooks/useTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_SIZE = (SCREEN_WIDTH - 48) / 7;

interface MonthDay {
  date: Date | null;
  dayNumber: number | null;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  shiftCount: number;
}

interface UberMonthPickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onMonthChange: (direction: 'prev' | 'next') => void;
  isExpanded: boolean;
  shiftCountByDate: Map<string, number>;
}

// Helper to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get all days for month calendar grid
const getMonthDays = (
  selectedDate: Date,
  shiftCountByDate: Map<string, number>
): MonthDay[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  // First day of month
  const firstDay = new Date(year, month, 1);
  // Last day of month
  const lastDay = new Date(year, month + 1, 0);

  // Day of week for first day (0 = Sunday, adjust for Monday start)
  let startDayOfWeek = firstDay.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const days: MonthDay[] = [];

  // Add empty days for previous month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push({
      date: null,
      dayNumber: null,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false,
      shiftCount: 0,
    });
  }

  // Add days of current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);

    const dateKey = formatDateKey(date);
    const shiftCount = shiftCountByDate.get(dateKey) || 0;

    days.push({
      date,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
      isSelected: formatDateKey(date) === formatDateKey(selectedDate),
      shiftCount,
    });
  }

  // Add empty days to complete last row
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 0; i < remainingDays; i++) {
      days.push({
        date: null,
        dayNumber: null,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        shiftCount: 0,
      });
    }
  }

  return days;
};

export const UberMonthPicker: React.FC<UberMonthPickerProps> = ({
  selectedDate,
  onDateSelect,
  onMonthChange,
  isExpanded,
  shiftCountByDate,
}) => {
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const monthDays = getMonthDays(selectedDate, shiftCountByDate);
  const weeks = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    weeks.push(monthDays.slice(i, i + 7));
  }

  // Animated height for expand/collapse
  const animatedContainerStyle = useAnimatedStyle(() => {
    const targetHeight = isExpanded ? weeks.length * (DAY_SIZE + 8) + 80 : 0;
    return {
      height: withTiming(targetHeight, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      opacity: withTiming(isExpanded ? 1 : 0, { duration: 200 }),
    };
  });

  // Format month for header
  const formatMonth = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    onMonthChange('prev');
  };

  const handleNextMonth = () => {
    onMonthChange('next');
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Animated.View style={[styles.container, { backgroundColor: uberColors.background.surface, borderBottomColor: uberColors.border.light }, animatedContainerStyle]}>
      {/* Month Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={uberColors.text.primary} />
        </TouchableOpacity>

        <Text style={[styles.monthTitle, { color: uberColors.text.primary }]}>{formatMonth(selectedDate)}</Text>

        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={uberColors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Day Labels */}
      <View style={styles.dayLabelsRow}>
        {dayLabels.map((label) => (
          <View key={label} style={styles.dayLabelContainer}>
            <Text style={[styles.dayLabel, { color: uberColors.text.muted }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day, dayIndex) => (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  styles.dayCell,
                  day.isSelected && { backgroundColor: uberColors.primary },
                  day.isToday && !day.isSelected && { backgroundColor: uberColors.background.light },
                ]}
                onPress={() => day.date && onDateSelect(day.date)}
                disabled={!day.date}
                activeOpacity={0.7}
              >
                {day.dayNumber !== null && (
                  <>
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: day.isSelected ? uberColors.text.inverse : uberColors.text.primary },
                        day.isToday && !day.isSelected && { color: uberColors.primary, fontWeight: '700' },
                        !day.isCurrentMonth && { color: uberColors.text.muted },
                      ]}
                    >
                      {day.dayNumber}
                    </Text>
                    {day.shiftCount > 0 && (
                      <View
                        style={[
                          styles.shiftBadge,
                          { backgroundColor: day.isSelected ? uberColors.text.inverse : uberColors.success },
                        ]}
                      >
                        <Text
                          style={[
                            styles.shiftBadgeText,
                            { color: day.isSelected ? uberColors.primary : uberColors.text.inverse },
                          ]}
                        >
                          {day.shiftCount}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.md,
  },
  navButton: {
    padding: uberSpacing.sm,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    paddingHorizontal: uberSpacing.base,
    marginBottom: uberSpacing.xs,
  },
  dayLabelContainer: {
    width: DAY_SIZE,
    alignItems: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  grid: {
    paddingHorizontal: uberSpacing.base,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: uberSpacing.sm,
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: uberRadius.lg,
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '500',
  },
  shiftBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
