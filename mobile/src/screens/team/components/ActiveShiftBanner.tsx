/**
 * ActiveShiftBanner Component
 * Microsoft Teams-style interactive banner with animations
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Heading3, Body, BodySmall, Caption } from '@components/ui';
import { getTeamsColors } from '../../../theme/teamsColors';
import { spacing, layout } from '../../../theme';

interface ActiveShiftBannerProps {
  companyName: string;
  activeCount: number;
  totalCount: number;
  venuesCount: number;
  onPress?: () => void;
  onStatPress?: (stat: 'active' | 'venues' | 'total') => void;
  isDark?: boolean;
}

export const ActiveShiftBanner: React.FC<ActiveShiftBannerProps> = ({
  companyName,
  activeCount,
  totalCount,
  venuesCount,
  onPress,
  onStatPress,
  isDark = false,
}) => {
  const teamsColors = getTeamsColors(isDark);
  // Pulse animation for live indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Pulse animation loop
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  // Interactive stat component
  const StatButton = ({
    icon,
    count,
    label,
    statType
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    count: number;
    label: string;
    statType: 'active' | 'venues' | 'total';
  }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity
        onPress={() => onStatPress?.(statType)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={styles.statButton}
      >
        <Animated.View style={[styles.statContent, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name={icon} size={18} color={teamsColors.white} />
          <Body style={[styles.statNumber, { color: teamsColors.white }]}>{count}</Body>
          <Caption style={[styles.statLabel, { color: teamsColors.white }]}>{label}</Caption>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[teamsColors.primary, teamsColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Background Pattern - More Subtle */}
        <View style={styles.patternContainer}>
          <Ionicons name="shield" size={120} color="rgba(255,255,255,0.04)" style={styles.patternIcon1} />
          <Ionicons name="people" size={80} color="rgba(255,255,255,0.04)" style={styles.patternIcon2} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Top Row: Company Badge + Live Indicator */}
          <View style={styles.topRow}>
            <View style={[styles.companyBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.95)' }]}>
              <View style={[styles.companyIconCircle, { backgroundColor: teamsColors.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={14} color={teamsColors.primary} />
              </View>
              <BodySmall style={[styles.companyName, { color: isDark ? teamsColors.white : teamsColors.text.primary }]}>{companyName}</BodySmall>
            </View>

            <View style={styles.liveIndicator}>
              <View style={styles.pulseContainer}>
                <View style={[styles.pulseDot, { backgroundColor: teamsColors.status.success }]} />
                <Animated.View
                  style={[
                    styles.pulseOuter,
                    {
                      backgroundColor: teamsColors.status.success,
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
              </View>
              <Caption style={[styles.liveText, { color: teamsColors.white }]}>LIVE</Caption>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            <Heading3 style={[styles.title, { color: teamsColors.white }]}>Active Shift</Heading3>
          </View>

          {/* Interactive Stats Row */}
          <View style={styles.statsRow}>
            <StatButton
              icon="people"
              count={activeCount}
              label="On Duty"
              statType="active"
            />
            <View style={styles.statDivider} />
            <StatButton
              icon="location"
              count={venuesCount}
              label="Venues"
              statType="venues"
            />
            <View style={styles.statDivider} />
            <StatButton
              icon="people-outline"
              count={totalCount}
              label="Total"
              statType="total"
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: layout.borderRadius.xl,
    overflow: 'hidden',
    ...layout.shadow.md,
  },
  gradient: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  patternContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  patternIcon1: {
    position: 'absolute',
    top: -20,
    right: -30,
    transform: [{ rotate: '12deg' }],
  },
  patternIcon2: {
    position: 'absolute',
    bottom: -15,
    left: -15,
    transform: [{ rotate: '-12deg' }],
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: layout.borderRadius.full,
    gap: 6,
    // backgroundColor applied inline based on isDark
  },
  companyIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 11,
    fontWeight: '700',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseContainer: {
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // backgroundColor applied inline with teamsColors
  },
  pulseOuter: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    // backgroundColor applied inline with teamsColors
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    // color applied inline with teamsColors
  },
  titleRow: {
    marginBottom: spacing.md,
  },
  title: {
    fontWeight: '800',
    fontSize: 24,
    letterSpacing: -0.5,
    // color applied inline with teamsColors
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statButton: {
    flex: 1,
    alignItems: 'center',
  },
  statContent: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    // color applied inline with teamsColors
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    // color applied inline with teamsColors
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
