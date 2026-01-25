/**
 * UberCalendarStrip - Horizontal week picker with shift dots
 * Uber-inspired minimalist design with smooth animations
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberRadius, uberSpacing } from '../../../../theme/uberTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_WIDTH = (SCREEN_WIDTH - 32) / 7;

interface CalendarDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
  shiftCount: number;
}

interface UberCalendarStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onMonthToggle?: () => void;
  shiftCountByDate: Map<string, number>;
  isMonthExpanded?: boolean;
}

// Helper to format date as YYYY-MM-DD
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get week days around selected date
const getWeekDays = (centerDate: Date, shiftCountByDate: Map<string, number>): CalendarDay[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the Monday of the week containing centerDate
  const dayOfWeek = centerDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(centerDate);
  monday.setDate(centerDate.getDate() + mondayOffset);

  const days: CalendarDay[] = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const dateKey = formatDateKey(date);
    const shiftCount = shiftCountByDate.get(dateKey) || 0;

    days.push({
      date,
      dayName: dayNames[i],
      dayNumber: date.getDate(),
      isToday: date.getTime() === today.getTime(),
      isSelected: formatDateKey(date) === formatDateKey(centerDate),
      shiftCount,
    });
  }

  return days;
};

// Animated Day Component
const AnimatedDay: React.FC<{
  day: CalendarDay;
  onPress: () => void;
}> = ({ day, onPress }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    // Bounce animation on selection
    scale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withSpring(1.05, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Render shift dots (max 3)
  const renderDots = () => {
    const dots = [];
    const count = Math.min(day.shiftCount, 3);
    for (let i = 0; i < count; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.shiftDot,
            day.isSelected && styles.shiftDotSelected,
          ]}
        />
      );
    }
    return dots;
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      <Animated.View
        style={[
          styles.dayItem,
          day.isSelected && styles.dayItemSelected,
          day.isToday && !day.isSelected && styles.dayItemToday,
          animatedStyle,
        ]}
      >
        <Text
          style={[
            styles.dayLabel,
            day.isSelected && styles.dayLabelSelected,
          ]}
        >
          {day.dayName}
        </Text>
        <Text
          style={[
            styles.dayNumber,
            day.isSelected && styles.dayNumberSelected,
            day.isToday && !day.isSelected && styles.dayNumberToday,
          ]}
        >
          {day.dayNumber}
        </Text>
        <View style={styles.dotsContainer}>
          {renderDots()}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

export const UberCalendarStrip: React.FC<UberCalendarStripProps> = ({
  selectedDate,
  onDateSelect,
  onMonthToggle,
  shiftCountByDate,
  isMonthExpanded = false,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  const weekDays = getWeekDays(selectedDate, shiftCountByDate);

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    onDateSelect(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    onDateSelect(newDate);
  };

  // Format month display
  const formatMonth = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Month Header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.arrow}>
          <Ionicons name="chevron-back" size={20} color={uberColors.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onMonthToggle}
          style={styles.monthButton}
          activeOpacity={0.7}
        >
          <Text style={styles.monthText}>{formatMonth(selectedDate)}</Text>
          <Ionicons
            name={isMonthExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={uberColors.text.secondary}
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToNextWeek} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={20} color={uberColors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Days Strip */}
      <View style={styles.daysContainer}>
        {weekDays.map((day) => (
          <AnimatedDay
            key={formatDateKey(day.date)}
            day={day}
            onPress={() => onDateSelect(day.date)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: uberColors.background.surface,
    paddingVertical: uberSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: uberColors.border.light,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: uberSpacing.md,
    paddingHorizontal: uberSpacing.base,
    gap: uberSpacing.lg,
  },
  arrow: {
    padding: uberSpacing.sm,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.xs,
    paddingHorizontal: uberSpacing.sm,
    paddingVertical: uberSpacing.xs,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: uberColors.text.primary,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: uberSpacing.sm,
  },
  dayItem: {
    alignItems: 'center',
    width: DAY_WIDTH - 4,
    paddingVertical: uberSpacing.sm,
    paddingHorizontal: uberSpacing.xs,
    borderRadius: uberRadius.lg,
  },
  dayItemSelected: {
    backgroundColor: uberColors.primary,
  },
  dayItemToday: {
    backgroundColor: uberColors.background.light,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: uberColors.text.muted,
    marginBottom: uberSpacing.xs,
    textTransform: 'uppercase',
  },
  dayLabelSelected: {
    color: uberColors.text.inverse,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: uberColors.text.primary,
  },
  dayNumberSelected: {
    color: uberColors.text.inverse,
  },
  dayNumberToday: {
    color: uberColors.primary,
    fontWeight: '700',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: uberSpacing.xs,
    height: 6,
    gap: 3,
  },
  shiftDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: uberColors.primary,
  },
  shiftDotSelected: {
    backgroundColor: uberColors.text.inverse,
  },
});
