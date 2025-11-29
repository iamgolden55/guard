/**
 * TeamMemberListCard Component
 * Microsoft Teams-style horizontal list card
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Caption } from '@components/ui';
import { teamsColors } from '../../../theme/teamsColors';
import { spacing } from '../../../theme';
import { PresenceBadge, PresenceStatus } from './PresenceBadge';

export interface TeamMemberListData {
  id: number;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  photo?: string;
  presenceStatus: PresenceStatus;
  statusMessage?: string;
  currentVenue?: string;
  activity?: string; // "In a call", "Typing...", "Presenting", etc.
}

interface TeamMemberListCardProps {
  member: TeamMemberListData;
  onPress: () => void;
  onCallPress?: () => void;
  onChatPress?: () => void;
  onVideoPress?: () => void;
  onMorePress?: () => void;
}

export const TeamMemberListCard: React.FC<TeamMemberListCardProps> = ({
  member,
  onPress,
  onCallPress,
  onChatPress,
  onVideoPress,
  onMorePress,
}) => {
  // Presence text mapping
  const presenceText = {
    available: 'Available',
    away: 'Away',
    busy: 'Busy',
    in_call: 'In a call',
    offline: 'Offline',
    presenting: 'Presenting',
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.6}
      android_ripple={{ color: teamsColors.background.hover }}
    >
      <View style={styles.content}>
        {/* Avatar with Presence */}
        <View style={styles.avatarContainer}>
          {member.photo ? (
            <Image source={{ uri: member.photo }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={teamsColors.text.secondary} />
            </View>
          )}

          {/* Presence Badge */}
          <View style={styles.presenceBadge}>
            <PresenceBadge
              status={member.presenceStatus}
              size="medium"
              showRing={member.presenceStatus === 'in_call'}
            />
          </View>
        </View>

        {/* Member Info */}
        <View style={styles.info}>
          <Body style={styles.name} numberOfLines={1}>
            {member.name}
          </Body>

          {/* Role and Venue */}
          <View style={styles.detailsRow}>
            <BodySmall color={teamsColors.text.secondary} numberOfLines={1}>
              {member.role}
              {member.currentVenue && ` • ${member.currentVenue}`}
            </BodySmall>
          </View>

          {/* Status Message or Activity */}
          {(member.statusMessage || member.activity) && (
            <Caption color={teamsColors.text.tertiary} numberOfLines={1} style={styles.statusMessage}>
              {member.activity ? (
                <>
                  {member.activity === 'In a call' && '📞 '}
                  {member.activity === 'Typing...' && '💬 '}
                  {member.activity === 'Presenting' && '📺 '}
                  {member.activity}
                </>
              ) : (
                member.statusMessage
              )}
            </Caption>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          {member.phone && onCallPress && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onCallPress();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="call" size={20} color={teamsColors.actions.call} />
            </TouchableOpacity>
          )}

          {onChatPress && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onChatPress();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chatbubble" size={20} color={teamsColors.actions.chat} />
            </TouchableOpacity>
          )}

          {onVideoPress && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onVideoPress();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="videocam" size={20} color={teamsColors.actions.video} />
            </TouchableOpacity>
          )}

          {/* More Menu */}
          <TouchableOpacity
            style={styles.moreButton}
            onPress={(e) => {
              e.stopPropagation();
              onMorePress?.();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={teamsColors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: teamsColors.background.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: teamsColors.border.light,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: teamsColors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontWeight: '600',
    fontSize: 15,
    color: teamsColors.text.primary,
    marginBottom: spacing.xs / 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },
  statusMessage: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: teamsColors.background.hover,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
