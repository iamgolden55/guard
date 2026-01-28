/**
 * UpcomingShiftCard Component
 * Displays a single upcoming shift with details
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall } from '@components/ui';
import { colors, spacing, layout, getColors } from '../../../theme';
import { useTheme } from '../../../hooks/useTheme';

interface Shift {
  id: number;
  venue: {
    name: string;
  };
  start_time: string;
  end_time: string;
  role?: string;
  status?: string;
}

interface UpcomingShiftCardProps {
  shift: Shift;
  onPress: () => void;
  isOverdue?: boolean;
}

export const UpcomingShiftCard: React.FC<UpcomingShiftCardProps> = ({ shift, onPress, isOverdue = false }) => {
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'scheduled':
      default:
        return colors.primary;
    }
  };

  const getStatusBgColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return colors.background.secondary;
      case 'pending':
        return '#FEF3C7';
      case 'scheduled':
      default:
        return '#EFF6FF';
    }
  };

  // Theme-aware overdue colors
  const overdueCardBg = isDark ? '#450A0A' : '#FEF2F2';
  const overdueBadgeBg = isDark ? '#7F1D1D' : '#FEE2E2';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: themeColors.background.primary, borderColor: themeColors.border.light },
        isOverdue && { borderColor: themeColors.error, borderWidth: 2, backgroundColor: overdueCardBg },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Overdue alert badge */}
      {isOverdue && (
        <View style={[styles.overdueBadge, { backgroundColor: overdueBadgeBg }]}>
          <Ionicons name="alert-circle" size={14} color={themeColors.error} />
          <BodySmall style={[styles.overdueText, { color: themeColors.error }]}>
            Check in now!
          </BodySmall>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.venueInfo}>
          <Ionicons name="location-outline" size={16} color={themeColors.text.secondary} />
          <Body style={[styles.venueName, { color: themeColors.text.primary }]} numberOfLines={1}>
            {shift.venue.name}
          </Body>
        </View>
        {isOverdue ? (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: overdueBadgeBg },
            ]}
          >
            <BodySmall
              style={[styles.statusText, { color: themeColors.error }]}
            >
              LATE
            </BodySmall>
          </View>
        ) : shift.status && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusBgColor(shift.status) },
            ]}
          >
            <BodySmall
              style={[styles.statusText, { color: getStatusColor(shift.status) }]}
            >
              {shift.status}
            </BodySmall>
          </View>
        )}
      </View>

      <View style={styles.timeRow}>
        <Ionicons name="calendar-outline" size={14} color={themeColors.text.tertiary} />
        <BodySmall color={themeColors.text.secondary} style={styles.timeText}>
          {formatDate(shift.start_time)} • {formatTime(shift.start_time)} -{' '}
          {formatTime(shift.end_time)}
        </BodySmall>
      </View>

      {shift.role && (
        <View style={styles.timeRow}>
          <Ionicons name="shield-outline" size={14} color={themeColors.text.tertiary} />
          <BodySmall color={themeColors.text.tertiary} style={styles.timeText}>
            {shift.role}
          </BodySmall>
        </View>
      )}

      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color={themeColors.gray[400]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: layout.borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: layout.borderWidth.thin,
    ...layout.shadow.sm,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.xs,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  overdueText: {
    fontWeight: '700',
    marginLeft: spacing.xs,
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  venueName: {
    marginLeft: spacing.xs,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: spacing.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },
  timeText: {
    marginLeft: spacing.xs,
    fontSize: 13,
  },
  chevron: {
    position: 'absolute',
    right: spacing.base,
    top: '50%',
    marginTop: -10,
  },
});
