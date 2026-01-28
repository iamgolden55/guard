/**
 * UberShiftCard - Uber-style shift card with time badge
 * Features press animation and stagger entrance
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getUberColors, getUberShadows, getUberShiftStatus, uberRadius, uberSpacing } from '../../../../theme/uberTheme';
import { useTheme } from '../../../../hooks/useTheme';
import type { Shift } from '../../../../store/slices/shiftsSlice';

interface UberShiftCardProps {
  shift: Shift;
  index: number;
  onPress: () => void;
}

// Format hour from date string (e.g., "09")
const formatHour = (dateString: string): string => {
  const date = new Date(dateString);
  let hours = date.getHours();
  if (hours === 0) hours = 12;
  else if (hours > 12) hours = hours - 12;
  return hours.toString().padStart(2, '0');
};

// Format period from date string (e.g., "AM" or "PM")
const formatPeriod = (dateString: string): string => {
  const date = new Date(dateString);
  return date.getHours() >= 12 ? 'PM' : 'AM';
};

// Format time range (e.g., "09:00 - 17:00")
const formatTimeRange = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return `${formatTime(start)} - ${formatTime(end)}`;
};

// Calculate duration (e.g., "8h")
const calculateDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  return `${diffHours}h`;
};

// Get status display text
const getStatusText = (status: Shift['status']): string => {
  switch (status) {
    case 'scheduled':
      return 'CONFIRMED';
    case 'in_progress':
      return 'IN PROGRESS';
    case 'completed':
      return 'COMPLETED';
    case 'approved':
      return 'APPROVED';
    case 'cancelled':
      return 'CANCELLED';
    case 'pending_approval':
      return 'PENDING';
    default:
      return status.toUpperCase();
  }
};

// Get status colors (dynamic based on theme)
const getStatusColors = (status: Shift['status'], shiftStatus: ReturnType<typeof getUberShiftStatus>): { bg: string; text: string } => {
  const statusKey = status as keyof typeof shiftStatus;
  return shiftStatus[statusKey] || shiftStatus.pending;
};

export const UberShiftCard: React.FC<UberShiftCardProps> = ({
  shift,
  index,
  onPress,
}) => {
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);
  const uberShiftStatus = getUberShiftStatus(isDark);

  const scale = useSharedValue(1);
  const statusColors = getStatusColors(shift.status, uberShiftStatus);
  const isInProgress = shift.status === 'in_progress';

  // Press animation
  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Pulse animation for in-progress status
  const pulseOpacity = useSharedValue(1);

  React.useEffect(() => {
    if (isInProgress) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [isInProgress]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: isInProgress ? pulseOpacity.value : 1,
  }));

  const hour = formatHour(shift.start_time);
  const period = formatPeriod(shift.start_time);
  const timeRange = formatTimeRange(shift.start_time, shift.end_time);
  const duration = calculateDuration(shift.start_time, shift.end_time);
  const role = shift.required_security_role || 'Security Staff';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
      >
        <Animated.View style={[styles.card, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light, ...uberShadows.soft }, animatedCardStyle]}>
          {/* Time Badge */}
          <View style={[styles.timeBadge, { backgroundColor: uberColors.background.light }]}>
            <Text style={[styles.timeNumber, { color: uberColors.text.primary }]}>{hour}</Text>
            <Text style={[styles.timePeriod, { color: uberColors.text.muted }]}>{period}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.venueName, { color: uberColors.text.primary }]} numberOfLines={1}>
              {shift.venue.name}
            </Text>
            <Text style={[styles.role, { color: uberColors.text.secondary }]} numberOfLines={1}>
              {role}
            </Text>
            <Text style={[styles.timeRange, { color: uberColors.text.secondary }]}>
              {timeRange} • {duration}
            </Text>

            {/* Status Badge */}
            <Animated.View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColors.bg },
                isInProgress && animatedPulseStyle,
              ]}
            >
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {getStatusText(shift.status)}
              </Text>
            </Animated.View>
          </View>

          {/* Chevron */}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={uberColors.text.muted}
            style={styles.chevron}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: uberRadius.xl,
    padding: uberSpacing.base,
    marginHorizontal: uberSpacing.base,
    marginBottom: uberSpacing.md,
    borderWidth: 1,
  },
  timeBadge: {
    width: 56,
    height: 56,
    borderRadius: uberRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: uberSpacing.md,
  },
  timeNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  timePeriod: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  role: {
    fontSize: 14,
    marginBottom: uberSpacing.xs,
  },
  timeRange: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: uberSpacing.sm,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: uberSpacing.sm,
    paddingVertical: uberSpacing.xs,
    borderRadius: uberRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chevron: {
    alignSelf: 'center',
    marginLeft: uberSpacing.sm,
  },
});
