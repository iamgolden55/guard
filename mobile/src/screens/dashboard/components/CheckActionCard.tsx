/**
 * CheckActionCard
 * Uber-style card for check-in/check-out actions
 * Reusable component with multiple states: active, disabled, completed
 * Supports dark mode
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { getUberColors, getUberShadows, uberRadius, fontFamilies, spacing } from '../../../theme';

type CardStatus = 'active' | 'disabled' | 'completed' | 'too_far' | 'overdue';
type CardType = 'check-in' | 'check-out';

interface CheckActionCardProps {
  type: CardType;
  time?: string | null;
  status: CardStatus;
  venueName?: string;
  onPress: () => void;
  isLoading?: boolean;
  scheduledStartTime?: string | null;  // For lateness calculation
  actualCheckInTime?: string | null;   // For lateness calculation
  distanceToVenue?: number | null;     // Distance in meters (for too_far status)
  isLocationLoading?: boolean;         // Whether location is being fetched
}

// Get icon for card type
const getIcon = (type: CardType): keyof typeof Ionicons.glyphMap => {
  return type === 'check-in' ? 'log-in-outline' : 'log-out-outline';
};

// Get title for card type
const getTitle = (type: CardType): string => {
  return type === 'check-in' ? 'Check In' : 'Check Out';
};

// Get subtitle based on status
const getSubtitle = (
  type: CardType,
  status: CardStatus,
  venueName?: string,
  distanceToVenue?: number | null
): string => {
  if (status === 'completed') {
    return type === 'check-in' ? 'Shift started' : 'Shift completed';
  }
  if (status === 'disabled') {
    return type === 'check-in' ? 'No upcoming shift' : 'Check in first';
  }
  if (status === 'overdue') {
    return venueName ? `You're late! Check in at ${venueName}` : 'You\'re late! Check in now';
  }
  if (status === 'too_far' && distanceToVenue !== null && distanceToVenue !== undefined) {
    return `You're ${formatDistance(distanceToVenue)}`;
  }
  if (venueName) {
    return type === 'check-in' ? `Start at ${venueName}` : `End shift at ${venueName}`;
  }
  return type === 'check-in' ? 'Scan QR to start' : 'Complete your shift';
};

// Get button text based on status
const getButtonText = (type: CardType, status: CardStatus): string => {
  if (status === 'completed') {
    return 'Done';
  }
  return type === 'check-in' ? 'Check In' : 'Check Out';
};

// Calculate lateness in minutes
const calculateLateness = (
  scheduledTime: string | null | undefined,
  actualTime: string | null | undefined
): { isLate: boolean; minutes: number } => {
  if (!scheduledTime || !actualTime) {
    return { isLate: false, minutes: 0 };
  }

  const scheduled = new Date(scheduledTime).getTime();
  const actual = new Date(actualTime).getTime();
  const diffMinutes = Math.floor((actual - scheduled) / (1000 * 60));

  // Consider late if more than 5 minutes after scheduled time
  return {
    isLate: diffMinutes > 5,
    minutes: Math.max(0, diffMinutes),
  };
};

// Format lateness for display
const formatLateness = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m late`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m late` : `${hours}h late`;
};

// Format distance for display
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)}km away`;
};

export const CheckActionCard: React.FC<CheckActionCardProps> = ({
  type,
  time,
  status,
  venueName,
  onPress,
  isLoading = false,
  scheduledStartTime,
  actualCheckInTime,
  distanceToVenue,
  isLocationLoading = false,
}) => {
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isDisabled = status === 'disabled';
  const isTooFar = status === 'too_far';
  const isOverdue = status === 'overdue';

  // Calculate lateness for check-in card
  const lateness = type === 'check-in'
    ? calculateLateness(scheduledStartTime, actualCheckInTime)
    : { isLate: false, minutes: 0 };

  // Dynamic colors based on theme and status
  const cardBackgroundColor = isCompleted && !lateness.isLate
    ? uberColors.successLight
    : (isCompleted && lateness.isLate) || isTooFar
      ? isDark ? '#78350F' : '#FEF3C7'  // amber colors
      : isOverdue
        ? isDark ? '#7F1D1D' : '#FEF2F2'  // red colors for overdue
        : uberColors.background.surface;

  const cardBorderColor = isCompleted && !lateness.isLate
    ? uberColors.success
    : (isCompleted && lateness.isLate) || isTooFar
      ? uberColors.warning
      : isOverdue
        ? uberColors.error || '#EF4444'
        : uberColors.border.light;

  const iconContainerBg = isCompleted && !lateness.isLate
    ? uberColors.successLight
    : (isCompleted && lateness.isLate) || isTooFar
      ? isDark ? '#78350F' : '#FEF3C7'
      : isOverdue
        ? isDark ? '#7F1D1D' : '#FEE2E2'
        : uberColors.border.light;

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: cardBackgroundColor,
        borderColor: cardBorderColor,
      },
      uberShadows.soft,
      isDisabled && styles.cardDisabled,
    ]}>
      {/* Left: Icon in circle */}
      <View style={[styles.iconContainer, { backgroundColor: iconContainerBg }]}>
        {isCompleted ? (
          lateness.isLate ? (
            <Ionicons name="alert" size={24} color={uberColors.warning} />
          ) : (
            <Ionicons name="checkmark" size={24} color={uberColors.success} />
          )
        ) : isTooFar ? (
          <Ionicons name="location-outline" size={24} color={uberColors.warning} />
        ) : isOverdue ? (
          <Ionicons name="alert-circle" size={24} color={uberColors.error || '#EF4444'} />
        ) : (
          <Ionicons
            name={getIcon(type)}
            size={24}
            color={isDisabled ? uberColors.disabledText : uberColors.text.secondary}
          />
        )}
      </View>

      {/* Middle: Title and subtitle */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[
            styles.title,
            { color: isDisabled ? uberColors.disabledText : uberColors.text.primary }
          ]}>
            {getTitle(type)}
          </Text>
          {/* Overdue badge */}
          {isOverdue && (
            <View style={[styles.latenessBadge, { backgroundColor: uberColors.error || '#EF4444' }]}>
              <Text style={styles.latenessText}>LATE</Text>
            </View>
          )}
          {/* Lateness badge */}
          {isCompleted && lateness.isLate && (
            <View style={[styles.latenessBadge, { backgroundColor: uberColors.warning }]}>
              <Text style={styles.latenessText}>{formatLateness(lateness.minutes)}</Text>
            </View>
          )}
        </View>
        <Text style={[
          styles.subtitle,
          {
            color: isDisabled
              ? uberColors.disabledText
              : isOverdue
                ? uberColors.error || '#EF4444'
                : isTooFar
                  ? isDark ? '#FCD34D' : '#92400E'
                  : uberColors.text.secondary
          }
        ]}>
          {getSubtitle(type, status, venueName, distanceToVenue)}
        </Text>
      </View>

      {/* Right: Time and button */}
      <View style={styles.rightSection}>
        {/* Time display */}
        <Text style={[
          styles.time,
          { color: time ? uberColors.text.primary : uberColors.text.muted }
        ]}>
          {time || '--:--'}
        </Text>

        {/* Action button */}
        <TouchableOpacity
          style={[
            styles.button,
            isActive && { backgroundColor: uberColors.primary },
            isOverdue && { backgroundColor: uberColors.error || '#EF4444' },
            isCompleted && {
              backgroundColor: uberColors.successLight,
              borderWidth: 1,
              borderColor: uberColors.success,
            },
            isDisabled && { backgroundColor: uberColors.disabled },
            isTooFar && { backgroundColor: uberColors.warning },
          ]}
          onPress={onPress}
          disabled={isDisabled || isTooFar || isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={isActive ? uberColors.text.inverse : uberColors.text.secondary}
            />
          ) : isCompleted ? (
            <>
              <Ionicons name="checkmark" size={14} color={uberColors.success} />
              <Text style={[styles.buttonText, { color: uberColors.success }]}>
                {getButtonText(type, status)}
              </Text>
            </>
          ) : (
            <Text style={[
              styles.buttonText,
              {
                color: isActive || isOverdue
                  ? uberColors.text.inverse
                  : isDisabled
                    ? uberColors.disabledText
                    : isTooFar
                      ? uberColors.white
                      : uberColors.text.secondary
              }
            ]}>
              {getButtonText(type, status)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: uberRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
  },
  cardDisabled: {
    opacity: 0.6,
  },

  // Icon container
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },

  // Content area
  content: {
    flex: 1,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700',
  },
  latenessBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  latenessText: {
    fontSize: 10,
    fontFamily: fontFamilies.inter.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fontFamilies.inter.regular,
    fontWeight: '400',
  },

  // Right section
  rightSection: {
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 13,
    fontFamily: fontFamilies.mono,
    fontWeight: '600',
    marginBottom: 8,
  },

  // Button styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: uberRadius.full,
    minWidth: 90,
    gap: 4,
  },

  // Button text
  buttonText: {
    fontSize: 13,
    fontFamily: fontFamilies.inter.semiBold,
    fontWeight: '600',
  },
});

export default CheckActionCard;
