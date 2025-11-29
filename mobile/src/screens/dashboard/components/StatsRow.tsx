/**
 * StatsRow Component
 * Animated circular stat indicators with count-up animation
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Heading3, Caption } from '@components/ui';
import { colors, spacing } from '../../../theme';

interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
  delay?: number;
}

const StatItem: React.FC<StatItemProps> = ({ icon, value, label, color, delay = 0 }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    // Scale animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // Count animation
    Animated.timing(countAnim, {
      toValue: value,
      duration: 1200,
      delay: delay + 200,
      useNativeDriver: false,
    }).start();

    // Listen to animation value
    const listenerId = countAnim.addListener(({ value: animValue }) => {
      setDisplayValue(Math.floor(animValue));
    });

    return () => {
      countAnim.removeListener(listenerId);
    };
  }, [value, delay]);

  return (
    <Animated.View style={[styles.statItem, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Heading3 style={styles.statValue}>{displayValue}</Heading3>
      <Caption style={styles.statLabel}>{label}</Caption>
    </Animated.View>
  );
};

interface StatsRowProps {
  hoursToday: number;
  checksCompleted: number;
  shiftsThisWeek: number;
}

export const StatsRow: React.FC<StatsRowProps> = ({
  hoursToday,
  checksCompleted,
  shiftsThisWeek,
}) => {
  return (
    <View style={styles.container}>
      <StatItem
        icon="time"
        value={hoursToday}
        label="Hours Today"
        color={colors.primary}
        delay={0}
      />
      <StatItem
        icon="checkmark-done"
        value={checksCompleted}
        label="Checks Done"
        color="#4CAF50"
        delay={100}
      />
      <StatItem
        icon="calendar"
        value={shiftsThisWeek}
        label="This Week"
        color="#FF9800"
        delay={200}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
