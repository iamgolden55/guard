/**
 * OverviewStats
 * Uber-style stats display with 3-column grid and vertical dividers
 * Shows hours, checks, and shifts in a clean minimal design
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { uberColors, uberShadows, uberRadius, uberTypography, spacing } from '../../../theme';

interface OverviewStatsProps {
  hours: number;
  checks: number;
  shifts: number;
  animateOnMount?: boolean;
}

// Animated number component with count-up effect
const AnimatedNumber: React.FC<{ value: number; suffix?: string }> = ({
  value,
  suffix = '',
}) => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [value, animValue]);

  // For simple display without animation complexity
  return (
    <Text style={styles.statNumber}>
      {value.toString().padStart(2, '0')}{suffix}
    </Text>
  );
};

// Single stat item
interface StatItemProps {
  value: number;
  label: string;
  suffix?: string;
}

const StatItem: React.FC<StatItemProps> = ({ value, label, suffix }) => (
  <View style={styles.statItem}>
    <AnimatedNumber value={value} suffix={suffix} />
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Vertical divider
const Divider = () => <View style={styles.divider} />;

export const OverviewStats: React.FC<OverviewStatsProps> = ({
  hours,
  checks,
  shifts,
  animateOnMount = true,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Hours Today */}
        <StatItem value={hours} label="HOURS" />

        <Divider />

        {/* Checks Completed */}
        <StatItem value={checks} label="CHECKS" />

        <Divider />

        {/* Shifts This Week */}
        <StatItem value={shifts} label="SHIFTS" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
    borderColor: uberColors.border.light,
    ...uberShadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    ...uberTypography.statNumber,
    marginBottom: 4,
  },
  statLabel: {
    ...uberTypography.statLabel,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: uberColors.border.light,
  },
});

export default OverviewStats;
