/**
 * HeroStatusCard Component
 * Wise-inspired hero card with 3D flip animation showing shift status
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Heading2, Heading3, Body, BodySmall, Caption } from '@components/ui';
import { colors, spacing } from '../../../theme';
import type { Shift } from '../../../types/shift';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = CARD_WIDTH / 1.586; // Credit card ratio

interface HeroStatusCardProps {
  activeShift?: Shift | null;
  upcomingShift?: Shift | null;
  onPress?: () => void;
  onFlip?: (isFlipped: boolean) => void;
}

export const HeroStatusCard: React.FC<HeroStatusCardProps> = ({
  activeShift,
  upcomingShift,
  onPress,
  onFlip,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Determine card state
  const cardState = activeShift ? 'active' : upcomingShift ? 'upcoming' : 'empty';

  // Calculate shift duration if active
  const getShiftDuration = () => {
    if (!activeShift?.check_in_time) return '0h 0m';

    const checkInTime = new Date(activeShift.check_in_time);
    const now = new Date();
    const diffMs = now.getTime() - checkInTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    return `${hours}h ${mins}m`;
  };

  // Format time for upcoming shift
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Get time until upcoming shift
  const getTimeUntilShift = () => {
    if (!upcomingShift?.start_time) return '';
    const start = new Date(upcomingShift.start_time);
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();

    if (diffMs < 0) return 'Starting now';

    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `In ${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `In ${hours}h ${mins}m`;
    }
    return `In ${mins}m`;
  };

  // Get status info based on card state
  const isOnBreak = activeShift?.break_start_time && !activeShift?.break_end_time;

  const statusText = cardState === 'active'
    ? isOnBreak
      ? 'On Break'
      : 'Active Shift'
    : cardState === 'upcoming'
      ? 'Upcoming Shift'
      : 'No Active Shift';

  const statusIcon = cardState === 'active'
    ? isOnBreak
      ? 'pause-circle'
      : 'checkmark-circle'
    : cardState === 'upcoming'
      ? 'time'
      : 'time-outline';

  const gradientColors = cardState === 'active'
    ? isOnBreak
      ? ['#FFA726', '#FB8C00'] // Orange for break
      : ['#66BB6A', '#43A047'] // Green for active
    : cardState === 'upcoming'
      ? ['#42A5F5', '#1E88E5'] // Blue for upcoming
      : ['#78909C', '#546E7A']; // Gray for no shift

  // Flip animation effect
  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    onFlip?.(isFlipped);
  }, [isFlipped]);

  // Interpolations
  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 90.1, 180],
    outputRange: [1, 1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 90.1, 180],
    outputRange: [0, 0, 1, 1],
  });

  const handleCardPress = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <View style={styles.container}>
      {/* Front Card */}
      <Animated.View
        style={[
          styles.cardFace,
          {
            transform: [{ rotateY: frontRotate }],
            opacity: frontOpacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleCardPress}
          style={styles.touchable}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Watermark Text */}
            <View style={styles.watermarkContainer}>
              <Body style={styles.watermarkText}>SECURE</Body>
            </View>

            {/* Card Chip */}
            <View style={styles.chipIcon}>
              <View style={styles.chipInner}>
                <View style={styles.chipLine} />
                <View style={styles.chipLine} />
                <View style={styles.chipLine} />
              </View>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
              <View style={styles.statusBadge}>
                <Ionicons name={statusIcon} size={20} color={colors.white} />
                <Caption style={styles.statusBadgeText}>{statusText.toUpperCase()}</Caption>
              </View>

              {cardState === 'active' && (
                <>
                  <Heading2 style={styles.cardTitle}>{activeShift?.venue?.name || 'Shift'}</Heading2>
                  <BodySmall style={styles.cardSubtitle}>
                    {activeShift?.required_security_role || 'Security Staff'} • {getShiftDuration()}
                  </BodySmall>
                </>
              )}

              {cardState === 'upcoming' && (
                <>
                  <Heading2 style={styles.cardTitle}>{upcomingShift?.venue?.name || 'Shift'}</Heading2>
                  <BodySmall style={styles.cardSubtitle}>
                    {upcomingShift?.required_security_role || 'Security Staff'} • Starts {formatTime(upcomingShift?.start_time || '')}
                  </BodySmall>
                  <BodySmall style={styles.countdownText}>{getTimeUntilShift()}</BodySmall>
                </>
              )}

              {cardState === 'empty' && (
                <Heading3 style={styles.cardTitle}>Ready for your shift</Heading3>
              )}
            </View>

            {/* Footer with Logo */}
            <View style={styles.footer}>
              <View style={styles.logoCircle}>
                <Ionicons name="shield-checkmark" size={24} color="rgba(255,255,255,0.9)" />
              </View>
              <Caption style={styles.tapHint}>Tap to see stats</Caption>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Back Card - Stats */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.cardBack,
          {
            transform: [{ rotateY: backRotate }],
            opacity: backOpacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleCardPress}
          style={styles.touchable}
        >
          <View style={styles.backCard}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Heading3 style={styles.statNumber}>
                  {cardState === 'active'
                    ? getShiftDuration()
                    : cardState === 'upcoming'
                      ? getTimeUntilShift()
                      : '0h'}
                </Heading3>
                <Caption style={styles.statLabel}>
                  {cardState === 'active' ? 'Duration' : cardState === 'upcoming' ? 'Starts' : 'Duration'}
                </Caption>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Heading3 style={styles.statNumber}>
                  {activeShift?.venue?.name?.substring(0, 3).toUpperCase()
                    || upcomingShift?.venue?.name?.substring(0, 3).toUpperCase()
                    || '—'}
                </Heading3>
                <Caption style={styles.statLabel}>Venue</Caption>
              </View>
            </View>

            <View style={styles.backFooter}>
              <Caption style={styles.backTapHint}>Tap to flip back</Caption>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    top: 0,
    left: 0,
  },
  touchable: {
    width: '100%',
    height: '100%',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: spacing.lg,
    justifyContent: 'space-between',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  watermarkContainer: {
    position: 'absolute',
    top: '35%',
    left: '-10%',
    right: 0,
    bottom: 0,
  },
  watermarkText: {
    fontSize: 120,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: 4,
    transform: [{ rotate: '-15deg' }],
  },
  chipIcon: {
    width: 48,
    height: 38,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 6,
  },
  chipInner: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: 4,
    padding: 4,
    justifyContent: 'center',
  },
  chipLine: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: spacing.sm,
  },
  statusBadgeText: {
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.98)',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
    marginTop: spacing.xs,
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapHint: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 11,
  },
  // Back card styles
  backCard: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.border.light,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backFooter: {
    alignItems: 'center',
  },
  backTapHint: {
    color: colors.text.tertiary,
    fontWeight: '600',
    fontSize: 11,
  },
});
