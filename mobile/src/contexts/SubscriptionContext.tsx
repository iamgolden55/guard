/**
 * Subscription Context
 * Provides company subscription information and feature access
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  CompanySubscription,
  SubscriptionTier,
  SubscriptionFeatures,
  getFeaturesByTier,
} from '../types/subscription.types';
import { logger } from '../utils/logger';

interface SubscriptionContextValue {
  subscription: CompanySubscription | null;
  isLoading: boolean;
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  tier: SubscriptionTier;
  features: SubscriptionFeatures;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock subscription for development
  // TODO: Replace with actual API call
  const fetchSubscription = async () => {
    try {
      setIsLoading(true);
      logger.info('Fetching company subscription');

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock subscription data - Change tier here for testing
      const mockSubscription: CompanySubscription = {
        companyId: 1,
        companyName: 'Mead Security Services',
        tier: SubscriptionTier.PREMIUM, // Change to BASIC or ENTERPRISE to test
        features: getFeaturesByTier(SubscriptionTier.PREMIUM),
        isActive: true,
      };

      setSubscription(mockSubscription);
      logger.info('Subscription loaded', { tier: mockSubscription.tier });
    } catch (error) {
      logger.error('Failed to load subscription', { error });
      // Fallback to basic tier on error
      setSubscription({
        companyId: 0,
        companyName: 'Unknown Company',
        tier: SubscriptionTier.BASIC,
        features: getFeaturesByTier(SubscriptionTier.BASIC),
        isActive: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const hasFeature = (feature: keyof SubscriptionFeatures): boolean => {
    if (!subscription) return false;
    return subscription.features[feature] === true;
  };

  const value: SubscriptionContextValue = {
    subscription,
    isLoading,
    hasFeature,
    tier: subscription?.tier || SubscriptionTier.BASIC,
    features: subscription?.features || getFeaturesByTier(SubscriptionTier.BASIC),
    refreshSubscription: fetchSubscription,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

// Custom hook to use subscription
export const useSubscription = (): SubscriptionContextValue => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
