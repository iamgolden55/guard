/**
 * Subscription Types
 * Defines company subscription tiers and feature access
 */

export enum SubscriptionTier {
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export interface SubscriptionFeatures {
  // Core features (all tiers)
  viewTeam: boolean;
  callTeam: boolean;
  viewShifts: boolean;
  checkInOut: boolean;
  emergencyAlert: boolean;

  // Premium features
  teamChat: boolean;
  broadcastMessages: boolean;
  activityFeed: boolean;
  advancedAnalytics: boolean;
  customNotifications: boolean;
  shiftSwapping: boolean;

  // Enterprise features
  apiIntegrations: boolean;
  customBranding: boolean;
  advancedReporting: boolean;
  multiVenueManagement: boolean;
  dedicatedSupport: boolean;
}

export interface CompanySubscription {
  companyId: number;
  companyName: string;
  tier: SubscriptionTier;
  features: SubscriptionFeatures;
  expiresAt?: string;
  isActive: boolean;
}

// Feature tier requirements
export const FEATURE_REQUIREMENTS: Record<keyof SubscriptionFeatures, SubscriptionTier> = {
  // Basic tier
  viewTeam: SubscriptionTier.BASIC,
  callTeam: SubscriptionTier.BASIC,
  viewShifts: SubscriptionTier.BASIC,
  checkInOut: SubscriptionTier.BASIC,
  emergencyAlert: SubscriptionTier.BASIC,

  // Premium tier
  teamChat: SubscriptionTier.PREMIUM,
  broadcastMessages: SubscriptionTier.PREMIUM,
  activityFeed: SubscriptionTier.PREMIUM,
  advancedAnalytics: SubscriptionTier.PREMIUM,
  customNotifications: SubscriptionTier.PREMIUM,
  shiftSwapping: SubscriptionTier.PREMIUM,

  // Enterprise tier
  apiIntegrations: SubscriptionTier.ENTERPRISE,
  customBranding: SubscriptionTier.ENTERPRISE,
  advancedReporting: SubscriptionTier.ENTERPRISE,
  multiVenueManagement: SubscriptionTier.ENTERPRISE,
  dedicatedSupport: SubscriptionTier.ENTERPRISE,
};

// Helper to get features for a tier
export const getFeaturesByTier = (tier: SubscriptionTier): SubscriptionFeatures => {
  const tierLevel = {
    [SubscriptionTier.BASIC]: 1,
    [SubscriptionTier.PREMIUM]: 2,
    [SubscriptionTier.ENTERPRISE]: 3,
  };

  const features: SubscriptionFeatures = {
    // Basic features
    viewTeam: tierLevel[tier] >= 1,
    callTeam: tierLevel[tier] >= 1,
    viewShifts: tierLevel[tier] >= 1,
    checkInOut: tierLevel[tier] >= 1,
    emergencyAlert: tierLevel[tier] >= 1,

    // Premium features
    teamChat: tierLevel[tier] >= 2,
    broadcastMessages: tierLevel[tier] >= 2,
    activityFeed: tierLevel[tier] >= 2,
    advancedAnalytics: tierLevel[tier] >= 2,
    customNotifications: tierLevel[tier] >= 2,
    shiftSwapping: tierLevel[tier] >= 2,

    // Enterprise features
    apiIntegrations: tierLevel[tier] >= 3,
    customBranding: tierLevel[tier] >= 3,
    advancedReporting: tierLevel[tier] >= 3,
    multiVenueManagement: tierLevel[tier] >= 3,
    dedicatedSupport: tierLevel[tier] >= 3,
  };

  return features;
};
