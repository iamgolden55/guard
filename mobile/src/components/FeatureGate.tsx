/**
 * FeatureGate Component
 * Conditionally renders content based on subscription tier
 * Shows upgrade prompts for premium features
 */

import React, { ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Card } from './ui';
import { colors, spacing, layout } from '../theme';
import { useSubscription } from '../contexts/SubscriptionContext';
import { SubscriptionFeatures, SubscriptionTier } from '../types/subscription.types';
import { logger } from '../utils/logger';

interface FeatureGateProps {
  feature: keyof SubscriptionFeatures;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
  requiredTier?: SubscriptionTier;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  requiredTier,
}) => {
  const { hasFeature, tier } = useSubscription();

  // Check if user has access to the feature
  const hasAccess = hasFeature(feature);

  // If has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt if enabled
  if (showUpgradePrompt) {
    return <UpgradePrompt feature={feature} currentTier={tier} requiredTier={requiredTier} />;
  }

  // Otherwise, render nothing
  return null;
};

interface UpgradePromptProps {
  feature: keyof SubscriptionFeatures;
  currentTier: SubscriptionTier;
  requiredTier?: SubscriptionTier;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ feature, currentTier, requiredTier }) => {
  const handleUpgrade = () => {
    logger.info('Upgrade prompt tapped', { feature, currentTier, requiredTier });
    // TODO: Navigate to upgrade/subscription screen
  };

  const featureNames: Record<string, string> = {
    teamChat: 'Team Chat',
    broadcastMessages: 'Broadcast Messages',
    activityFeed: 'Activity Feed',
    advancedAnalytics: 'Advanced Analytics',
    customNotifications: 'Custom Notifications',
    shiftSwapping: 'Shift Swapping',
    apiIntegrations: 'API Integrations',
    customBranding: 'Custom Branding',
    advancedReporting: 'Advanced Reporting',
    multiVenueManagement: 'Multi-Venue Management',
    dedicatedSupport: 'Dedicated Support',
  };

  const tierNames = {
    [SubscriptionTier.BASIC]: 'Basic',
    [SubscriptionTier.PREMIUM]: 'Premium',
    [SubscriptionTier.ENTERPRISE]: 'Enterprise',
  };

  return (
    <Card variant="outlined" padding="lg" style={styles.upgradeCard}>
      <View style={styles.lockContainer}>
        <View style={styles.lockIconCircle}>
          <Ionicons name="lock-closed" size={20} color={colors.primary} />
        </View>
      </View>

      <Body style={styles.featureName}>{featureNames[feature] || feature}</Body>

      <BodySmall color={colors.text.secondary} style={styles.upgradeText}>
        This feature requires {requiredTier ? tierNames[requiredTier] : 'Premium'} tier
      </BodySmall>

      <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade} activeOpacity={0.8}>
        <Body style={styles.upgradeButtonText}>Upgrade Plan</Body>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
      </TouchableOpacity>

      <BodySmall color={colors.text.tertiary} style={styles.currentTier}>
        Current plan: {tierNames[currentTier]}
      </BodySmall>
    </Card>
  );
};

const styles = StyleSheet.create({
  upgradeCard: {
    alignItems: 'center',
    marginVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderColor: colors.border.light,
  },
  lockContainer: {
    marginBottom: spacing.md,
  },
  lockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureName: {
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  upgradeText: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: layout.borderRadius.md,
    gap: spacing.sm,
  },
  upgradeButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  currentTier: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
