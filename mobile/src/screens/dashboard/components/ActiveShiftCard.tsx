/**
 * ActiveShiftCard Component
 * Displays active shift information with check-out and break actions
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Heading3, Body, BodySmall, Button } from '@components/ui';
import { colors, spacing, textStyles, getColors } from '../../../theme';
import { useTheme } from '../../../hooks/useTheme';

interface Shift {
  id: number;
  venue: {
    name: string;
    address?: string;
  };
  start_time: string;
  end_time: string;
  check_in_time?: string;
  check_out_time?: string;
  break_start_time?: string;
  break_end_time?: string;
}

interface ActiveShiftCardProps {
  shift: Shift;
  onCheckOut: () => void;
  onTakeBreak: () => void;
}

export const ActiveShiftCard: React.FC<ActiveShiftCardProps> = ({
  shift,
  onCheckOut,
  onTakeBreak,
}) => {
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
  const [elapsedTime, setElapsedTime] = useState('');
  const [breakElapsedTime, setBreakElapsedTime] = useState('');

  // Check if currently on break
  const isOnBreak = shift.break_start_time && !shift.break_end_time;

  // Calculate elapsed time
  useEffect(() => {
    const updateElapsedTime = () => {
      if (!shift.check_in_time) return;

      const startTime = new Date(shift.check_in_time).getTime();
      const now = Date.now();
      const diff = now - startTime;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setElapsedTime(`${hours}h ${minutes}m`);
    };

    updateElapsedTime();
    const interval = setInterval(updateElapsedTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [shift.check_in_time]);

  // Calculate break elapsed time
  useEffect(() => {
    if (!isOnBreak) {
      setBreakElapsedTime('');
      return;
    }

    const updateBreakElapsedTime = () => {
      if (!shift.break_start_time) return;

      const breakStartTime = new Date(shift.break_start_time).getTime();
      const now = Date.now();
      const diff = now - breakStartTime;

      const minutes = Math.floor(diff / (1000 * 60));
      setBreakElapsedTime(`${minutes} min`);
    };

    updateBreakElapsedTime();
    const interval = setInterval(updateBreakElapsedTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [shift.break_start_time, isOnBreak]);

  const checkInTime = shift.check_in_time
    ? new Date(shift.check_in_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <Card variant="elevated" padding="lg" style={styles.card}>
      {/* Active badge */}
      <View style={[styles.badge, { backgroundColor: themeColors.success }]}>
        <View style={[styles.badgeDot, { backgroundColor: themeColors.white }]} />
        <BodySmall style={[styles.badgeText, { color: themeColors.white }]}>ACTIVE SHIFT</BodySmall>
      </View>

      {/* Venue info */}
      <Heading3 style={[styles.venueName, { color: themeColors.text.primary }]}>{shift.venue.name}</Heading3>

      {/* Time info */}
      <View style={styles.timeRow}>
        <Ionicons name="time-outline" size={16} color={themeColors.text.secondary} />
        <BodySmall color={themeColors.text.secondary} style={styles.timeText}>
          Started at {checkInTime}
        </BodySmall>
      </View>

      {elapsedTime && (
        <View style={styles.timeRow}>
          <Ionicons name="hourglass-outline" size={16} color={themeColors.text.secondary} />
          <BodySmall color={themeColors.text.secondary} style={styles.timeText}>
            Elapsed: {elapsedTime}
          </BodySmall>
        </View>
      )}

      {/* Break Status */}
      {isOnBreak && (
        <View style={[styles.breakStatus, { borderTopColor: themeColors.border.light }]}>
          <View style={[styles.breakBadge, { backgroundColor: themeColors.warning }]}>
            <Ionicons name="cafe-outline" size={14} color={themeColors.white} />
            <BodySmall style={[styles.breakBadgeText, { color: themeColors.white }]}>ON BREAK</BodySmall>
          </View>
          {breakElapsedTime && (
            <BodySmall color={themeColors.warning} style={styles.breakElapsedText}>
              Break duration: {breakElapsedTime}
            </BodySmall>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title={isOnBreak ? "End Break" : "Take Break"}
          variant={isOnBreak ? "warning" : "secondary"}
          size="medium"
          onPress={onTakeBreak}
          icon={
            isOnBreak ? (
              <Ionicons name="checkmark-circle-outline" size={20} color={themeColors.white} style={styles.buttonIcon} />
            ) : undefined
          }
          style={styles.breakButton}
        />
        <Button
          title="Check Out"
          variant="primary"
          size="medium"
          onPress={onCheckOut}
          icon={<Ionicons name="exit-outline" size={20} color={themeColors.white} style={styles.buttonIcon} />}
          style={styles.checkOutButton}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    // backgroundColor applied inline with themeColors
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.base,
    marginBottom: spacing.base,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // backgroundColor applied inline with themeColors
    marginRight: spacing.xs,
  },
  badgeText: {
    // color applied inline with themeColors
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  venueName: {
    marginBottom: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  timeText: {
    marginLeft: spacing.xs,
  },
  breakStatus: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    // borderTopColor applied inline with themeColors
  },
  breakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    // backgroundColor applied inline with themeColors
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.base,
    marginBottom: spacing.xs,
  },
  breakBadgeText: {
    // color applied inline with themeColors
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    marginLeft: spacing.xs,
  },
  breakElapsedText: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  breakButton: {
    flex: 1,
  },
  checkOutButton: {
    flex: 1,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
});
