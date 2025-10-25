/**
 * UpcomingShiftCard Component
 * Displays a single upcoming shift with details
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';

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
}

export const UpcomingShiftCard: React.FC<UpcomingShiftCardProps> = ({ shift, onPress }) => {
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

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.venueInfo}>
          <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
          <Body style={styles.venueName} numberOfLines={1}>
            {shift.venue.name}
          </Body>
        </View>
        {shift.status && (
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
        <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
        <BodySmall color={colors.text.secondary} style={styles.timeText}>
          {formatDate(shift.start_time)} • {formatTime(shift.start_time)} -{' '}
          {formatTime(shift.end_time)}
        </BodySmall>
      </View>

      {shift.role && (
        <View style={styles.timeRow}>
          <Ionicons name="shield-outline" size={14} color={colors.text.tertiary} />
          <BodySmall color={colors.text.tertiary} style={styles.timeText}>
            {shift.role}
          </BodySmall>
        </View>
      )}

      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: layout.borderWidth.thin,
    borderColor: colors.border.light,
    ...layout.shadow.sm,
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
