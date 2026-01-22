/**
 * CheckActionCard
 * Uber-style card for check-in/check-out actions
 * Reusable component with multiple states: active, disabled, completed
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
import { uberColors, uberShadows, uberRadius, uberTypography, spacing } from '../../../theme';

type CardStatus = 'active' | 'disabled' | 'completed' | 'too_far';
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
  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isDisabled = status === 'disabled';
  const isTooFar = status === 'too_far';

  // Calculate lateness for check-in card
  const lateness = type === 'check-in'
    ? calculateLateness(scheduledStartTime, actualCheckInTime)
    : { isLate: false, minutes: 0 };

  // Get dynamic styles based on status
  const cardStyle = [
    styles.card,
    isCompleted && !lateness.isLate && styles.cardCompleted,
    isCompleted && lateness.isLate && styles.cardLate,
    isTooFar && styles.cardTooFar,
    isDisabled && styles.cardDisabled,
  ];

  const buttonStyle = [
    styles.button,
    isActive && styles.buttonActive,
    isCompleted && styles.buttonCompleted,
    isTooFar && styles.buttonTooFar,
    isDisabled && styles.buttonDisabled,
  ];

  const buttonTextStyle = [
    styles.buttonText,
    isActive && styles.buttonTextActive,
    isCompleted && styles.buttonTextCompleted,
    isTooFar && styles.buttonTextTooFar,
    isDisabled && styles.buttonTextDisabled,
  ];

  return (
    <View style={cardStyle}>
      {/* Left: Icon in circle */}
      <View style={[
        styles.iconContainer,
        isCompleted && !lateness.isLate && styles.iconContainerCompleted,
        isCompleted && lateness.isLate && styles.iconContainerLate,
        isTooFar && styles.iconContainerTooFar,
      ]}>
        {isCompleted ? (
          lateness.isLate ? (
            <Ionicons name="alert" size={24} color={uberColors.warning} />
          ) : (
            <Ionicons name="checkmark" size={24} color={uberColors.success} />
          )
        ) : isTooFar ? (
          <Ionicons name="location-outline" size={24} color={uberColors.warning} />
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
          <Text style={[styles.title, isDisabled && styles.titleDisabled]}>
            {getTitle(type)}
          </Text>
          {/* Lateness badge */}
          {isCompleted && lateness.isLate && (
            <View style={styles.latenessBadge}>
              <Text style={styles.latenessText}>{formatLateness(lateness.minutes)}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.subtitle, isDisabled && styles.subtitleDisabled, isTooFar && styles.subtitleTooFar]}>
          {getSubtitle(type, status, venueName, distanceToVenue)}
        </Text>
      </View>

      {/* Right: Time and button */}
      <View style={styles.rightSection}>
        {/* Time display */}
        <Text style={[styles.time, !time && styles.timeEmpty]}>
          {time || '--:--'}
        </Text>

        {/* Action button */}
        <TouchableOpacity
          style={buttonStyle}
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
              <Text style={buttonTextStyle}>{getButtonText(type, status)}</Text>
            </>
          ) : (
            <Text style={buttonTextStyle}>{getButtonText(type, status)}</Text>
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
    backgroundColor: uberColors.background.surface,
    borderRadius: uberRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: uberColors.border.light,
    ...uberShadows.soft,
  },
  cardCompleted: {
    borderColor: uberColors.success,
    backgroundColor: uberColors.successLight,
  },
  cardLate: {
    borderColor: uberColors.warning,
    backgroundColor: '#FEF3C7',  // amber-100
  },
  cardTooFar: {
    borderColor: uberColors.warning,
    backgroundColor: '#FEF3C7',  // amber-100
  },
  cardDisabled: {
    opacity: 0.6,
  },

  // Icon container
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: uberColors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconContainerCompleted: {
    backgroundColor: uberColors.successLight,
  },
  iconContainerLate: {
    backgroundColor: '#FEF3C7',  // amber-100
  },
  iconContainerTooFar: {
    backgroundColor: '#FEF3C7',  // amber-100
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
    ...uberTypography.cardTitle,
    fontSize: 16,
  },
  titleDisabled: {
    color: uberColors.disabledText,
  },
  latenessBadge: {
    backgroundColor: uberColors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  latenessText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  subtitle: {
    ...uberTypography.cardSubtitle,
    fontSize: 13,
  },
  subtitleDisabled: {
    color: uberColors.disabledText,
  },
  subtitleTooFar: {
    color: '#92400E',  // amber-800 for better contrast on amber background
  },

  // Right section
  rightSection: {
    alignItems: 'flex-end',
  },
  time: {
    ...uberTypography.time,
    marginBottom: 8,
    color: uberColors.text.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  timeEmpty: {
    color: uberColors.text.muted,
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
  buttonActive: {
    backgroundColor: uberColors.primary,
  },
  buttonCompleted: {
    backgroundColor: uberColors.successLight,
    borderWidth: 1,
    borderColor: uberColors.success,
  },
  buttonDisabled: {
    backgroundColor: uberColors.disabled,
  },
  buttonTooFar: {
    backgroundColor: '#F59E0B',  // amber-500
  },

  // Button text
  buttonText: {
    ...uberTypography.button,
    fontSize: 13,
  },
  buttonTextActive: {
    color: uberColors.text.inverse,
  },
  buttonTextCompleted: {
    color: uberColors.success,
  },
  buttonTextDisabled: {
    color: uberColors.disabledText,
  },
  buttonTextTooFar: {
    color: '#FFFFFF',
  },
});

export default CheckActionCard;
