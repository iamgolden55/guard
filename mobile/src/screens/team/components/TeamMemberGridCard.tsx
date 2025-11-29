/**
 * TeamMemberGridCard Component
 * Grid-style card with large photo for team members
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Caption } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 3) / 2; // 2 columns with spacing

export interface TeamMemberGridData {
  id: number;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  photo?: string;
  status: 'active' | 'on_break' | 'off_duty';
  currentVenue?: string;
  shiftStartTime?: string;
}

interface TeamMemberGridCardProps {
  member: TeamMemberGridData;
  onPress: () => void;
  onLongPress?: () => void;
}

export const TeamMemberGridCard: React.FC<TeamMemberGridCardProps> = ({
  member,
  onPress,
  onLongPress,
}) => {
  // Status configuration
  const statusConfig = {
    active: {
      color: colors.success,
      icon: 'radio-button-on' as const,
      text: 'On Duty',
      ringColor: colors.success,
    },
    on_break: {
      color: colors.warning,
      icon: 'pause-circle' as const,
      text: 'On Break',
      ringColor: colors.warning,
    },
    off_duty: {
      color: colors.gray[400],
      icon: 'radio-button-off' as const,
      text: 'Off Duty',
      ringColor: 'transparent',
    },
  };

  const status = statusConfig[member.status];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Photo Section */}
      <View style={styles.photoSection}>
        <View
          style={[
            styles.photoRing,
            member.status !== 'off_duty' && {
              borderColor: status.ringColor,
              borderWidth: 3,
            },
          ]}
        >
          {member.photo ? (
            <Image source={{ uri: member.photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={48} color={colors.gray[400]} />
            </View>
          )}
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <Ionicons name={status.icon} size={12} color={colors.white} />
        </View>

        {/* Venue Badge (if on duty) */}
        {member.currentVenue && member.status === 'active' && (
          <View style={styles.venueBadge}>
            <Ionicons name="location" size={10} color={colors.primary} />
            <Caption color={colors.primary} style={styles.venueText} numberOfLines={1}>
              {member.currentVenue}
            </Caption>
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Body style={styles.name} numberOfLines={1}>
          {member.name.split(' ')[0]}
        </Body>
        <Body style={styles.lastName} numberOfLines={1}>
          {member.name.split(' ').slice(1).join(' ')}
        </Body>

        <BodySmall color={colors.text.secondary} style={styles.role} numberOfLines={1}>
          {member.role}
        </BodySmall>

        {/* Status Text */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Caption color={status.color} style={styles.statusText}>
            {status.text}
          </Caption>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: layout.borderWidth.thin,
    borderColor: colors.border.light,
    ...layout.shadow.sm,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  photoRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 3,
    backgroundColor: colors.white,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    ...layout.shadow.md,
  },
  venueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: layout.borderRadius.sm,
    marginTop: spacing.xs,
    gap: 2,
    maxWidth: '100%',
  },
  venueText: {
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  infoSection: {
    alignItems: 'center',
  },
  name: {
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
    color: colors.text.primary,
  },
  lastName: {
    fontWeight: '600',
    fontSize: 16,
    textAlign: 'center',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  role: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
