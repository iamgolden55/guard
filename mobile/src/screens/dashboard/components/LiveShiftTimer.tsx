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

  // Dynamic styles based on theme and state
  const timerBoxStyle = [
    styles.timerBox,
    {
      backgroundColor: isRunning
        ? isDark ? '#052E16' : '#F0FDF4'
        : uberColors.background.surface,
      borderColor: isRunning ? uberColors.success : uberColors.border.light,
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
            <View style={[styles.liveIndicator, { backgroundColor: uberColors.success }]}>
              <PulsingDot />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <Text style={[
          styles.timerValue,
          { color: isRunning ? uberColors.success : uberColors.text.primary }
        ]}>
          {formatDuration(elapsedSeconds)}
        </Text>
        <Text style={[styles.timerSubtext, { color: uberColors.text.secondary }]}>
          {isRunning ? 'Time on shift' : 'Shift completed'}
        </Text>
        {isRunning && scheduledEndTime && (
          <View style={styles.endTimeContainer}>
            <Ionicons name="time-outline" size={14} color={uberColors.text.muted} />
            <Text style={[styles.endTimeText, { color: uberColors.text.muted }]}>
              Shift ends at {formatTime(scheduledEndTime)}
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
