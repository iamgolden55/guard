/**
 * LiveShiftTimer
 * Real-time elapsed time display since shift check-in
 * Updates every second when shift is active
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { uberColors, uberShadows, uberRadius, spacing } from '../../../theme';

interface LiveShiftTimerProps {
  checkInTime: string | null;
  checkOutTime?: string | null;
  isActive?: boolean;
}

// Format duration as HH:MM:SS
const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
}) => {
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

  if (!checkInTime) {
    return (
      <View style={styles.container}>
        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>SHIFT TIMER</Text>
          <Text style={styles.timerInactive}>--:--:--</Text>
          <Text style={styles.timerSubtext}>No active shift</Text>
        </View>
      </View>
    );
  }

  const isRunning = !checkOutTime && isActive;

  return (
    <View style={styles.container}>
      <View style={[styles.timerBox, isRunning && styles.timerBoxActive]}>
        <View style={styles.timerHeader}>
          <Text style={styles.timerLabel}>SHIFT TIMER</Text>
          {isRunning && (
            <View style={styles.liveIndicator}>
              <PulsingDot />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
        <Text style={[styles.timerValue, isRunning && styles.timerValueActive]}>
          {formatDuration(elapsedSeconds)}
        </Text>
        <Text style={styles.timerSubtext}>
          {isRunning ? 'Time on shift' : 'Shift completed'}
        </Text>
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
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: uberColors.border.light,
    ...uberShadows.soft,
  },
  timerBoxActive: {
    borderColor: uberColors.success,
    backgroundColor: '#F0FDF4', // Very light green
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
    fontWeight: '600',
    color: uberColors.text.secondary,
    letterSpacing: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: uberColors.success,
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timerValue: {
    fontSize: 48,
    fontWeight: '700',
    color: uberColors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerValueActive: {
    color: uberColors.success,
  },
  timerInactive: {
    fontSize: 48,
    fontWeight: '700',
    color: uberColors.text.muted,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerSubtext: {
    fontSize: 13,
    color: uberColors.text.secondary,
    marginTop: spacing.xs,
  },
});

export default LiveShiftTimer;
