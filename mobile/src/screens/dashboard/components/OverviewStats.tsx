/**
 * OverviewStats
 * Uber-style stats display with 3-column grid and vertical dividers
 * Shows hours, checks, and shifts in a clean minimal design
 * Supports dark mode
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { getUberColors, getUberShadows, uberRadius, fontFamilies, spacing } from '../../../theme';

interface OverviewStatsProps {
  hours: number;
  checks: number;
  shifts: number;
  animateOnMount?: boolean;
}

// Animated number component with count-up effect
const AnimatedNumber: React.FC<{ value: number; suffix?: string; color: string }> = ({
  value,
  suffix = '',
  color,
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
    <Text style={[styles.statNumber, { color }]}>
      {value.toString().padStart(2, '0')}{suffix}
    </Text>
  );
};

// Single stat item
interface StatItemProps {
  value: number;
  label: string;
  suffix?: string;
  textColor: string;
  labelColor: string;
}

const StatItem: React.FC<StatItemProps> = ({ value, label, suffix, textColor, labelColor }) => (
  <View style={styles.statItem}>
    <AnimatedNumber value={value} suffix={suffix} color={textColor} />
    <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
  </View>
);

export const OverviewStats: React.FC<OverviewStatsProps> = ({
  hours,
  checks,
  shifts,
  animateOnMount = true,
}) => {
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

  // Vertical divider
  const Divider = () => (
    <View style={[styles.divider, { backgroundColor: uberColors.border.light }]} />
  );

  return (
    <View style={styles.container}>
      <View style={[
        styles.card,
        {
          backgroundColor: uberColors.background.surface,
          borderColor: uberColors.border.light,
        },
        uberShadows.soft,
      ]}>
        {/* Hours Today */}
        <StatItem
          value={hours}
          label="HOURS"
          textColor={uberColors.text.primary}
          labelColor={uberColors.text.secondary}
        />

        <Divider />

        {/* Checks Completed */}
        <StatItem
          value={checks}
          label="CHECKS"
          textColor={uberColors.text.primary}
          labelColor={uberColors.text.secondary}
        />

        <Divider />

        {/* Shifts This Week */}
        <StatItem
          value={shifts}
          label="SHIFTS"
          textColor={uberColors.text.primary}
          labelColor={uberColors.text.secondary}
        />
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
    borderRadius: uberRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 30,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.inter.medium,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 40,
  },
});

export default OverviewStats;
