/**
 * ShiftCard Component
 * Detailed shift card for calendar/list view
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Body, BodySmall, Heading3, Caption } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';
import { Shift } from '../../../store/slices/shiftsSlice';

interface ShiftCardProps {
  shift: Shift;
  onPress: () => void;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({ shift, onPress }) => {
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Calculate shift duration
  const calculateDuration = () => {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMinutes === 0) {
      return `${diffHours}h`;
    }
    return `${diffHours}h ${diffMinutes}m`;
  };

  // Get status badge color and text
  const getStatusInfo = () => {
    // Check if shift is past scheduled (scheduled but start time has passed)
    const now = new Date();
    const startTime = new Date(shift.start_time);
    const isPastScheduled = shift.status === 'scheduled' && startTime < now;

    switch (shift.status) {
      case 'in_progress':
        return {
          color: colors.success,
          bgColor: `${colors.success}15`,
          text: 'ACTIVE',
          icon: 'checkmark-circle' as const,
        };
      case 'completed':
        return {
          color: colors.gray[600],
          bgColor: colors.gray[100],
          text: 'COMPLETED',
          icon: 'checkmark-done-circle' as const,
        };
      case 'cancelled':
        return {
          color: colors.error,
          bgColor: `${colors.error}15`,
          text: 'CANCELLED',
          icon: 'close-circle' as const,
        };
      case 'scheduled':
        if (isPastScheduled) {
          return {
            color: colors.warning,
            bgColor: `${colors.warning}15`,
            text: 'MISSED',
            icon: 'alert-circle' as const,
          };
        }
        return {
          color: colors.primary,
          bgColor: `${colors.primary}15`,
          text: 'SCHEDULED',
          icon: 'time' as const,
        };
      default:
        return {
          color: colors.primary,
          bgColor: `${colors.primary}15`,
          text: 'SCHEDULED',
          icon: 'time' as const,
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Check if shift is past scheduled for styling
  const now = new Date();
  const startTime = new Date(shift.start_time);
  const isPastScheduled = shift.status === 'scheduled' && startTime < now;

  return (
    <TouchableOpacity
      style={[styles.card, isPastScheduled && styles.pastScheduledCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
        <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
        <Caption style={[styles.statusText, { color: statusInfo.color }]}>
          {statusInfo.text}
        </Caption>
      </View>

      {/* Venue Information */}
      <View style={styles.venueHeader}>
        <Ionicons name="location" size={20} color={colors.primary} />
        <View style={styles.venueInfo}>
          <Heading3 style={styles.venueName}>{shift.venue.name}</Heading3>
          <BodySmall color={colors.text.secondary} style={styles.address}>
            {shift.venue.address}
          </BodySmall>
        </View>
      </View>

      {/* Shift Details */}
      <View style={styles.detailsContainer}>
        {/* Date */}
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.text.secondary} />
          <BodySmall color={colors.text.secondary} style={styles.detailText}>
            {formatDate(shift.start_time)}
          </BodySmall>
        </View>

        {/* Time */}
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
          <BodySmall color={colors.text.secondary} style={styles.detailText}>
            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
          </BodySmall>
        </View>

        {/* Duration */}
        <View style={styles.detailRow}>
          <MaterialCommunityIcons
            name="clock-time-four-outline"
            size={16}
            color={colors.text.secondary}
          />
          <BodySmall color={colors.text.secondary} style={styles.detailText}>
            {calculateDuration()} shift
          </BodySmall>
        </View>
      </View>

      {/* Sync Status Indicator (if pending) */}
      {shift.sync_status === 'pending' && (
        <View style={styles.syncIndicator}>
          <Ionicons name="cloud-upload-outline" size={14} color={colors.warning} />
          <Caption color={colors.warning} style={styles.syncText}>
            Pending sync
          </Caption>
        </View>
      )}

      {shift.sync_status === 'failed' && (
        <View style={styles.syncIndicator}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Caption color={colors.error} style={styles.syncText}>
            Sync failed
          </Caption>
        </View>
      )}

      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.gray[400]}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: layout.borderWidth.thin,
    borderColor: colors.border.light,
    ...layout.shadow.sm,
  },
  pastScheduledCard: {
    backgroundColor: colors.gray[50],
    opacity: 0.85,
    borderColor: colors.gray[300],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.base,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  statusText: {
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  venueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    marginBottom: spacing.xs,
  },
  address: {
    lineHeight: 18,
  },
  detailsContainer: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    flex: 1,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  syncText: {
    fontSize: 12,
  },
  chevron: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    marginTop: -10,
  },
});
