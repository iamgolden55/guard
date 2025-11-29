/**
 * TeamQuickActions Component
 * Quick action buttons with premium features
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodySmall } from '@components/ui';
import { colors, spacing, layout } from '../../../theme';
import { FeatureGate } from '../../../components/FeatureGate';
import { logger } from '../../../utils/logger';

interface TeamQuickActionsProps {
  onChatPress?: () => void;
  onBroadcastPress?: () => void;
  onEmergencyPress?: () => void;
  onSharePress?: () => void;
}

export const TeamQuickActions: React.FC<TeamQuickActionsProps> = ({
  onChatPress,
  onBroadcastPress,
  onEmergencyPress,
  onSharePress,
}) => {
  const handleChatPress = () => {
    logger.info('Team chat pressed');
    onChatPress?.();
  };

  const handleBroadcastPress = () => {
    logger.info('Broadcast message pressed');
    onBroadcastPress?.();
  };

  const handleEmergencyPress = () => {
    logger.info('Emergency alert pressed');
    Alert.alert(
      'Emergency Alert',
      'Send emergency alert to all active team members?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: () => {
            onEmergencyPress?.();
            logger.info('Emergency alert sent');
          },
        },
      ]
    );
  };

  const handleSharePress = () => {
    logger.info('Share status pressed');
    onSharePress?.();
  };

  return (
    <View style={styles.container}>
      {/* Team Chat - Premium Feature */}
      <FeatureGate feature="teamChat" showUpgradePrompt={false}>
        <TouchableOpacity style={styles.actionCard} onPress={handleChatPress} activeOpacity={0.7}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="chatbubbles" size={24} color={colors.primary} />
          </View>
          <BodySmall style={styles.actionLabel}>Team Chat</BodySmall>
        </TouchableOpacity>
      </FeatureGate>

      {/* Broadcast Message - Premium Feature */}
      <FeatureGate feature="broadcastMessages" showUpgradePrompt={false}>
        <TouchableOpacity style={styles.actionCard} onPress={handleBroadcastPress} activeOpacity={0.7}>
          <View style={[styles.iconCircle, { backgroundColor: '#8B5CF6' + '15' }]}>
            <Ionicons name="megaphone" size={24} color="#8B5CF6" />
          </View>
          <BodySmall style={styles.actionLabel}>Broadcast</BodySmall>
        </TouchableOpacity>
      </FeatureGate>

      {/* Emergency Alert - All Tiers */}
      <TouchableOpacity style={styles.actionCard} onPress={handleEmergencyPress} activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: colors.error + '15' }]}>
          <Ionicons name="alert-circle" size={24} color={colors.error} />
        </View>
        <BodySmall style={styles.actionLabel}>Emergency</BodySmall>
      </TouchableOpacity>

      {/* Share Status - All Tiers */}
      <TouchableOpacity style={styles.actionCard} onPress={handleSharePress} activeOpacity={0.7}>
        <View style={[styles.iconCircle, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="share-social" size={24} color={colors.success} />
        </View>
        <BodySmall style={styles.actionLabel}>Share</BodySmall>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.white,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: layout.borderRadius.md,
    paddingVertical: spacing.md,
    borderWidth: layout.borderWidth.thin,
    borderColor: colors.border.light,
    ...layout.shadow.xs,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
});
