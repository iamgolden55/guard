/**
 * TransferStatusBadge - Wise-Inspired Status Badge
 * Clean, minimal badge for showing transfer status on shift cards
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Shift } from '../../store/slices/shiftsSlice';
import { colors as themeColors, spacing } from '../../theme';

interface TransferStatusBadgeProps {
  exchange?: Shift['pending_exchange'];
  release?: Shift['pending_release'];
  approvedTransfer?: Shift['approved_transfer'];
  compact?: boolean;
}

export const TransferStatusBadge: React.FC<TransferStatusBadgeProps> = ({
  exchange,
  release,
  approvedTransfer,
  compact = false,
}) => {
  // Helper to get initials
  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  // Priority 1: Approved transfer
  if (approvedTransfer) {
    const initials = getInitials(
      approvedTransfer.target_user.first_name,
      approvedTransfer.target_user.last_name
    );

    return (
      <View style={[styles.badge, styles.badgeSuccess, compact && styles.badgeCompact]}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={16} color={themeColors.success} />
        </View>
        <View style={styles.badgeContent}>
          <Text style={[styles.badgeTitle, styles.badgeTitleSuccess]}>
            Transferred
          </Text>
          <View style={styles.userRow}>
            <View style={[styles.miniAvatar, styles.miniAvatarSuccess]}>
              <Text style={styles.miniAvatarText}>{initials}</Text>
            </View>
            <Text style={styles.badgeSubtitle} numberOfLines={1}>
              to {approvedTransfer.target_user.first_name}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Priority 2: Pending exchange
  if (exchange) {
    const isAwaitingTarget = exchange.status === 'pending';
    const initials = getInitials(
      exchange.target_user.first_name,
      exchange.target_user.last_name
    );

    return (
      <View style={[styles.badge, styles.badgePending, compact && styles.badgeCompact]}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="swap-horizontal"
            size={18}
            color={themeColors.primary}
          />
        </View>
        <View style={styles.badgeContent}>
          <Text style={[styles.badgeTitle, styles.badgeTitlePending]}>
            {isAwaitingTarget ? 'Transfer Pending' : 'Awaiting Approval'}
          </Text>
          <View style={styles.userRow}>
            <View style={[styles.miniAvatar, styles.miniAvatarPending]}>
              <Text style={styles.miniAvatarText}>{initials}</Text>
            </View>
            <Text style={styles.badgeSubtitle} numberOfLines={1}>
              {isAwaitingTarget
                ? `to ${exchange.target_user.first_name}`
                : `${exchange.target_user.first_name} accepted`
              }
            </Text>
          </View>
        </View>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            isAwaitingTarget ? styles.statusDotPending : styles.statusDotProgress
          ]} />
        </View>
      </View>
    );
  }

  // Priority 3: Released to pool
  if (release) {
    const isClaimed = release.status === 'claimed';

    if (isClaimed && release.claimed_by) {
      const initials = getInitials(
        release.claimed_by.first_name,
        release.claimed_by.last_name
      );

      return (
        <View style={[styles.badge, styles.badgePool, compact && styles.badgeCompact]}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-add" size={16} color="#00897B" />
          </View>
          <View style={styles.badgeContent}>
            <Text style={[styles.badgeTitle, styles.badgeTitlePool]}>
              Claimed
            </Text>
            <View style={styles.userRow}>
              <View style={[styles.miniAvatar, styles.miniAvatarPool]}>
                <Text style={styles.miniAvatarText}>{initials}</Text>
              </View>
              <Text style={styles.badgeSubtitle} numberOfLines={1}>
                by {release.claimed_by.first_name}
              </Text>
            </View>
          </View>
          <View style={styles.statusIndicator}>
            <View style={styles.statusDotProgress} />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.badge, styles.badgePool, compact && styles.badgeCompact]}>
        <View style={styles.iconContainer}>
          <Ionicons name="globe-outline" size={16} color="#00897B" />
        </View>
        <View style={styles.badgeContent}>
          <Text style={[styles.badgeTitle, styles.badgeTitlePool]}>
            Open Pool
          </Text>
          <Text style={styles.badgeSubtitle}>
            Available for pickup
          </Text>
        </View>
        <View style={styles.pulseContainer}>
          <View style={styles.pulseDot} />
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  // Badge variants
  badgeSuccess: {
    backgroundColor: `${themeColors.success}08`,
    borderColor: `${themeColors.success}20`,
  },
  badgePending: {
    backgroundColor: `${themeColors.primary}08`,
    borderColor: `${themeColors.primary}20`,
  },
  badgePool: {
    backgroundColor: 'rgba(0, 137, 123, 0.06)',
    borderColor: 'rgba(0, 137, 123, 0.15)',
  },

  // Icon container
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: themeColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Content
  badgeContent: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  badgeTitleSuccess: {
    color: themeColors.success,
  },
  badgeTitlePending: {
    color: themeColors.primary,
  },
  badgeTitlePool: {
    color: '#00695C',
  },
  badgeSubtitle: {
    fontSize: 12,
    color: themeColors.text.secondary,
    flex: 1,
  },

  // User row with mini avatar
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarSuccess: {
    backgroundColor: themeColors.success,
  },
  miniAvatarPending: {
    backgroundColor: themeColors.primary,
  },
  miniAvatarPool: {
    backgroundColor: '#00897B',
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Status indicator
  statusIndicator: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotPending: {
    backgroundColor: themeColors.warning,
  },
  statusDotProgress: {
    backgroundColor: themeColors.primary,
  },

  // Pulse animation for open pool
  pulseContainer: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00897B',
  },
});
