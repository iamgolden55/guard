import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

// Subscription tier enum matching backend
export type SubscriptionTier = 'starter' | 'professional' | 'enterprise' | 'custom';

// Subscription status enum matching backend
export type SubscriptionStatus =
  | 'trial_active'
  | 'trial_expired'
  | 'active'
  | 'subscription_expired'
  | 'cancelled';

// Feature names that can be gated
export type FeatureName =
  | 'leave_management'
  | 'deputy_integration'
  | 'compliance_tracking'
  | 'advanced_reports'
  | 'multi_venue'
  | 'api_access'
  | 'custom_branding'
  | 'priority_support'
  | 'basic_scheduling'
  | 'staff_management'
  | 'venue_management'
  | 'shift_tracking';

// Feature tier requirements
const FEATURE_TIER_REQUIREMENTS: Record<FeatureName, SubscriptionTier> = {
  // Starter features (always available)
  basic_scheduling: 'starter',
  staff_management: 'starter',
  venue_management: 'starter',
  shift_tracking: 'starter',
  // Professional features
  leave_management: 'professional',
  deputy_integration: 'professional',
  compliance_tracking: 'professional',
  advanced_reports: 'professional',
  multi_venue: 'professional',
  // Enterprise features
  api_access: 'enterprise',
  custom_branding: 'enterprise',
  priority_support: 'enterprise',
};

// Tier hierarchy for comparison
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
  custom: 3,
};

// Subscription data from the API
export interface SubscriptionData {
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  is_trial: boolean;
  trial_end_date: string | null;
  trial_days_remaining: number;
  features: Record<FeatureName, boolean>;
  staff_capacity: number;
  venue_capacity: number;
  billing_email: string | null;
}

// Context state
interface SubscriptionState {
  isLoading: boolean;
  error: string | null;
  subscriptionData: SubscriptionData | null;
  lastFetched: Date | null;
}

// Context value
interface SubscriptionContextValue {
  // State
  state: SubscriptionState;

  // Subscription info
  subscriptionTier: SubscriptionTier | null;
  subscriptionStatus: SubscriptionStatus | null;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number;

  // Feature access
  hasFeatureAccess: (feature: FeatureName) => boolean;
  getRequiredTier: (feature: FeatureName) => SubscriptionTier;

  // Actions
  refreshSubscription: () => Promise<void>;

  // Helpers
  shouldShowUpgradePrompt: (feature: FeatureName) => boolean;
  getUpgradeMessage: (feature: FeatureName) => string;
}

const initialState: SubscriptionState = {
  isLoading: false,
  error: null,
  subscriptionData: null,
  lastFetched: null,
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { authState } = useAuth();
  const [state, setState] = useState<SubscriptionState>(initialState);

  // Fetch subscription data from the API
  const fetchSubscriptionData = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.currentMembership) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use the company's feature access endpoint
      const companyId = authState.currentMembership.companyId;
      const response = await api.get(`/api/v1/companies/${companyId}/feature-access/`);

      const subscriptionData: SubscriptionData = {
        subscription_tier: response.data.subscription_tier || 'starter',
        subscription_status: response.data.subscription_status || 'trial_active',
        is_trial: response.data.is_trial ?? false,
        trial_end_date: response.data.trial_end_date,
        trial_days_remaining: response.data.trial_days_remaining ?? 0,
        features: response.data.features || {},
        staff_capacity: response.data.staff_capacity || 50,
        venue_capacity: response.data.venue_capacity || 10,
        billing_email: response.data.billing_email,
      };

      setState({
        isLoading: false,
        error: null,
        subscriptionData,
        lastFetched: new Date(),
      });
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);

      // Fallback to defaults if API fails
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load subscription data',
        subscriptionData: {
          subscription_tier: 'starter',
          subscription_status: 'trial_active',
          is_trial: true,
          trial_end_date: null,
          trial_days_remaining: 30,
          features: {
            basic_scheduling: true,
            staff_management: true,
            venue_management: true,
            shift_tracking: true,
            leave_management: true,
            deputy_integration: true,
            compliance_tracking: true,
            advanced_reports: true,
            multi_venue: true,
            api_access: true,
            custom_branding: true,
            priority_support: true,
          },
          staff_capacity: 50,
          venue_capacity: 10,
          billing_email: null,
        },
      }));
    }
  }, [authState.isAuthenticated, authState.currentMembership]);

  // Fetch on mount and when auth changes
  useEffect(() => {
    if (authState.isAuthenticated && authState.currentMembership) {
      fetchSubscriptionData();
    } else {
      setState(initialState);
    }
  }, [authState.isAuthenticated, authState.currentMembership?.companyId, fetchSubscriptionData]);

  // Check if user has access to a feature
  const hasFeatureAccess = useCallback((feature: FeatureName): boolean => {
    const { subscriptionData } = state;

    if (!subscriptionData) {
      // Default to allowing access if we haven't loaded data yet
      return true;
    }

    // During active trial, all features are enabled
    if (subscriptionData.subscription_status === 'trial_active') {
      return true;
    }

    // Check tier hierarchy
    const userTier = subscriptionData.subscription_tier;
    const requiredTier = FEATURE_TIER_REQUIREMENTS[feature];

    if (TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier]) {
      return true;
    }

    // Check explicit feature flag from backend
    if (subscriptionData.features && subscriptionData.features[feature]) {
      return true;
    }

    return false;
  }, [state]);

  // Get required tier for a feature
  const getRequiredTier = useCallback((feature: FeatureName): SubscriptionTier => {
    return FEATURE_TIER_REQUIREMENTS[feature];
  }, []);

  // Should show upgrade prompt
  const shouldShowUpgradePrompt = useCallback((feature: FeatureName): boolean => {
    return !hasFeatureAccess(feature);
  }, [hasFeatureAccess]);

  // Get upgrade message for a feature
  const getUpgradeMessage = useCallback((feature: FeatureName): string => {
    const { subscriptionData } = state;
    const requiredTier = FEATURE_TIER_REQUIREMENTS[feature];
    const tierName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);

    if (!subscriptionData) {
      return `This feature requires a ${tierName} subscription.`;
    }

    if (subscriptionData.subscription_status === 'trial_expired') {
      return `Your trial has expired. This feature requires a ${tierName} subscription. Please upgrade to continue using this feature.`;
    }

    if (subscriptionData.subscription_status === 'subscription_expired') {
      return `Your subscription has expired. This feature requires an active ${tierName} subscription. Please renew to continue using this feature.`;
    }

    return `This feature requires a ${tierName} subscription. Please upgrade from your current ${subscriptionData.subscription_tier} plan to access this feature.`;
  }, [state]);

  // Computed values
  const subscriptionTier = state.subscriptionData?.subscription_tier ?? null;
  const subscriptionStatus = state.subscriptionData?.subscription_status ?? null;
  const isTrialActive = state.subscriptionData?.subscription_status === 'trial_active';
  const isTrialExpired = state.subscriptionData?.subscription_status === 'trial_expired';
  const trialDaysRemaining = state.subscriptionData?.trial_days_remaining ?? 0;

  const value: SubscriptionContextValue = {
    state,
    subscriptionTier,
    subscriptionStatus,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    hasFeatureAccess,
    getRequiredTier,
    refreshSubscription: fetchSubscriptionData,
    shouldShowUpgradePrompt,
    getUpgradeMessage,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export default SubscriptionContext;
