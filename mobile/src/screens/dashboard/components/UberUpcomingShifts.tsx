/**
 * UberUpcomingShifts
 * Uber-style upcoming shifts list with clean card design
 * Supports dark mode
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { getUberColors, getUberShadows, uberRadius, fontFamilies, spacing } from '../../../theme';
import type { Shift } from '../../../store/slices/shiftsSlice';

interface UberUpcomingShiftsProps {
  shifts: Shift[];
  onShiftPress: (shift: Shift) => void;
  maxShifts?: number;
}

// Format date for display (e.g., "Mon, 22 Jan")
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

// Format time for display (e.g., "09:00 - 17:00")
const formatTimeRange = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${formatTime(start)} - ${formatTime(end)}`;
};

// Single shift card
const ShiftCard: React.FC<{
  shift: Shift;
  onPress: () => void;
  isDark: boolean;
}> = ({ shift, onPress, isDark }) => {
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

  return (
    <TouchableOpacity
      style={[
        styles.shiftCard,
        {
          backgroundColor: uberColors.background.surface,
          borderColor: uberColors.border.light,
        },
        uberShadows.soft,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Date badge */}
      <View style={[styles.dateBadge, { backgroundColor: uberColors.background.light }]}>
        <Text style={[styles.dateText, { color: uberColors.text.primary }]}>
          {formatDate(shift.start_time)}
        </Text>
      </View>

      {/* Shift details */}
      <View style={styles.shiftDetails}>
        <Text style={[styles.venueName, { color: uberColors.text.primary }]} numberOfLines={1}>
          {shift.venue?.name || 'Unknown Venue'}
        </Text>
        <Text style={[styles.timeText, { color: uberColors.text.secondary }]}>
          {formatTimeRange(shift.start_time, shift.end_time)}
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={uberColors.text.muted}
      />
    </TouchableOpacity>
  );
};

export const UberUpcomingShifts: React.FC<UberUpcomingShiftsProps> = ({
  shifts,
  onShiftPress,
  maxShifts = 3,
}) => {
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);

  if (shifts.length === 0) {
    return null;
  }

  const displayedShifts = shifts.slice(0, maxShifts);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Upcoming Shifts</Text>
      <View style={styles.shiftsList}>
        {displayedShifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            onPress={() => onShiftPress(shift)}
            isDark={isDark}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  shiftsList: {
    gap: spacing.sm,
  },
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: uberRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  dateBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: uberRadius.default,
    marginRight: spacing.md,
  },
  dateText: {
    fontSize: 12,
    fontFamily: fontFamilies.inter.semiBold,
    fontWeight: '600',
  },
  shiftDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
  venueName: {
    fontSize: 15,
    fontFamily: fontFamilies.inter.semiBold,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 13,
    fontFamily: fontFamilies.inter.regular,
  },
});

export default UberUpcomingShifts;
