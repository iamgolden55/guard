/**
 * TeamMemberCard Component
 * Card showing team member information
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Caption } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  photo?: string;
  status: 'active' | 'off_duty';
}

interface TeamMemberCardProps {
  member: TeamMember;
  onPress: () => void;
}

export const TeamMemberCard: React.FC<TeamMemberCardProps> = ({ member, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        {/* Profile Photo */}
        <View style={styles.photoContainer}>
          {member.photo ? (
            <Image source={{ uri: member.photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={24} color={colors.gray[400]} />
            </View>
          )}
          {/* Status Indicator */}
          <View
            style={[
              styles.statusDot,
              member.status === 'active' ? styles.statusActive : styles.statusOffDuty,
            ]}
          />
        </View>

        {/* Member Info */}
        <View style={styles.info}>
          <Body style={styles.name}>{member.name}</Body>
          <BodySmall color={colors.text.secondary} style={styles.role}>
            {member.role}
          </BodySmall>

          {/* Contact Info */}
          {member.phone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={14} color={colors.text.secondary} />
              <Caption color={colors.text.secondary}>{member.phone}</Caption>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {member.phone && (
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          {member.email && (
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="mail" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
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
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  photo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  photoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.white,
  },
  statusActive: {
    backgroundColor: colors.success,
  },
  statusOffDuty: {
    backgroundColor: colors.gray[400],
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  role: {
    marginBottom: spacing.xs,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
