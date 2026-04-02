/**
 * LiveShiftTimer
 * Real-time elapsed time display since shift check-in
 * Updates every second when shift is active
 * Supports dark mode
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { getUberColors, getUberShadows, uberRadius, fontFamilies, spacing } from '../../../theme';

interface LiveShiftTimerProps {
  checkInTime: string | null;
  checkOutTime?: string | null;
  isActive?: boolean;
  scheduledEndTime?: string | null;
}

// Format duration as HH:MM:SS
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Format time as "7:30 PM"
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Format overtime as "1h 30m"
const formatOvertime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

// Pulsing dot animation
const PulsingDot = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.pulsingDot, { opacity: pulseAnim }]} />
  );
};

export const LiveShiftTimer: React.FC<LiveShiftTimerProps> = ({
  checkInTime,
  checkOutTime,
  isActive = true,
  scheduledEndTime,
}) => {
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!checkInTime || checkOutTime) {
      setElapsedSeconds(0);
      return;
    }

    // Calculate initial elapsed time
    const startTime = new Date(checkInTime).getTime();
    const endTime = checkOutTime ? new Date(checkOutTime).getTime() : Date.now();
    const initialElapsed = Math.floor((endTime - startTime) / 1000);
    setElapsedSeconds(Math.max(0, initialElapsed));

    // If shift is still active (no checkout), start the timer
    if (!checkOutTime && isActive) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedSeconds(Math.max(0, elapsed));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [checkInTime, checkOutTime, isActive]);

  const isRunning = !checkOutTime && isActive;

  // Detect if shift is past scheduled end time
  const isOverdue = React.useMemo(() => {
    if (!isRunning || !scheduledEndTime) return false;
    const now = new Date();
    const endTime = new Date(scheduledEndTime);
    return now > endTime;
  }, [isRunning, scheduledEndTime, elapsedSeconds]); // elapsedSeconds triggers re-check every second

  // Calculate overtime duration for display
  const overtimeSeconds = React.useMemo(() => {
    if (!isOverdue || !scheduledEndTime) return 0;
    const now = new Date();
    const endTime = new Date(scheduledEndTime);
    return Math.floor((now.getTime() - endTime.getTime()) / 1000);
  }, [isOverdue, scheduledEndTime, elapsedSeconds]);

  // Dynamic styles based on theme and state
  const timerBoxStyle = [
    styles.timerBox,
    {
      backgroundColor: isRunning
        ? isOverdue
          ? isDark ? '#450A0A' : '#FEF2F2'  // Red tint for overdue
          : isDark ? '#052E16' : '#F0FDF4'  // Green for normal
        : uberColors.background.surface,
      borderColor: isRunning
        ? isOverdue ? uberColors.error : uberColors.success
        : uberColors.border.light,
    },
    uberShadows.soft,
  ];

  if (!checkInTime) {
    return (
      <View style={styles.container}>
        <View style={[
          styles.timerBox,
          {
            backgroundColor: uberColors.background.surface,
            borderColor: uberColors.border.light,
          },
          uberShadows.soft,
        ]}>
          <Text style={[styles.timerLabel, { color: uberColors.text.secondary }]}>SHIFT TIMER</Text>
          <Text style={[styles.timerInactive, { color: uberColors.text.muted }]}>--:--:--</Text>
          <Text style={[styles.timerSubtext, { color: uberColors.text.secondary }]}>No active shift</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={timerBoxStyle}>
        <View style={styles.timerHeader}>
          <Text style={[styles.timerLabel, { color: uberColors.text.secondary }]}>SHIFT TIMER</Text>
          {isRunning && (
            <View style={[
              styles.liveIndicator,
              { backgroundColor: isOverdue ? uberColors.error : uberColors.success }
            ]}>
              <PulsingDot />
              <Text style={styles.liveText}>{isOverdue ? 'OVERDUE' : 'LIVE'}</Text>
            </View>
          )}
        </View>
        <Text style={[
          styles.timerValue,
          { color: isRunning
            ? isOverdue ? uberColors.error : uberColors.success
            : uberColors.text.primary
          }
        ]}>
          {formatDuration(elapsedSeconds)}
        </Text>
        <Text style={[styles.timerSubtext, { color: isOverdue ? uberColors.error : uberColors.text.secondary }]}>
          {isRunning
            ? isOverdue
              ? `${formatOvertime(overtimeSeconds)} past scheduled end`
              : 'Time on shift'
            : 'Shift completed'}
        </Text>
        {isRunning && scheduledEndTime && (
          <View style={styles.endTimeContainer}>
            <Ionicons
              name={isOverdue ? "alert-circle" : "time-outline"}
              size={14}
              color={isOverdue ? uberColors.error : uberColors.text.muted}
            />
            <Text style={[styles.endTimeText, { color: isOverdue ? uberColors.error : uberColors.text.muted }]}>
              {isOverdue ? `Should have ended at ${formatTime(scheduledEndTime)}` : `Shift ends at ${formatTime(scheduledEndTime)}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  timerBox: {
    borderRadius: uberRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  timerLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.inter.semiBold,
    fontWeight: '600',
    letterSpacing: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: uberRadius.full,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 10,
    fontFamily: fontFamilies.inter.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timerValue: {
    fontSize: 48,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerInactive: {
    fontSize: 48,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerSubtext: {
    fontSize: 13,
    fontFamily: fontFamilies.inter.regular,
    marginTop: spacing.xs,
  },
  endTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  endTimeText: {
    fontSize: 12,
    fontFamily: fontFamilies.inter.medium,
    fontWeight: '500',
  },
});

export default LiveShiftTimer;
