import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, type FeatureName, type SubscriptionTier } from '../contexts/SubscriptionContext';

interface FeatureGateProps {
  /** The feature to gate access for */
  feature: FeatureName;
  /** Required tier for this feature (optional, will be inferred from feature) */
  requiredTier?: SubscriptionTier;
  /** Content to display when user has access */
  children: React.ReactNode;
  /** Custom fallback component (optional) */
  fallback?: React.ReactNode;
  /** Whether to show upgrade prompt or redirect to upgrade page */
  behavior?: 'prompt' | 'redirect' | 'hide';
  /** Custom redirect path for 'redirect' behavior */
  redirectPath?: string;
}

/**
 * FeatureGate - Conditionally renders content based on subscription access
 *
 * Usage:
 * ```tsx
 * <FeatureGate feature="leave_management">
 *   <LeaveManagement />
 * </FeatureGate>
 * ```
 *
 * With custom fallback:
 * ```tsx
 * <FeatureGate
 *   feature="deputy_integration"
 *   fallback={<CustomUpgradeMessage />}
 * >
 *   <DeputyIntegration />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  behavior = 'prompt',
  redirectPath = '/upgrade',
}: FeatureGateProps) {
  const navigate = useNavigate();
  const {
    hasFeatureAccess,
    getRequiredTier,
    getUpgradeMessage,
    subscriptionStatus,
    subscriptionTier,
    trialDaysRemaining,
    state,
  } = useSubscription();

  // While loading, show a subtle loading state
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Check if user has access
  const hasAccess = hasFeatureAccess(feature);

  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // Handle different behaviors when access is denied
  if (behavior === 'hide') {
    return null;
  }

  if (behavior === 'redirect') {
    navigate(redirectPath);
    return null;
  }

  // Custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  const requiredTier = getRequiredTier(feature);
  const message = getUpgradeMessage(feature);

  return (
    <UpgradePrompt
      feature={feature}
      requiredTier={requiredTier}
      currentTier={subscriptionTier}
      subscriptionStatus={subscriptionStatus}
      message={message}
      trialDaysRemaining={trialDaysRemaining}
    />
  );
}

interface UpgradePromptProps {
  feature: FeatureName;
  requiredTier: SubscriptionTier;
  currentTier: SubscriptionTier | null;
  subscriptionStatus: string | null;
  message: string;
  trialDaysRemaining: number;
}

/**
 * Default upgrade prompt displayed when feature access is denied
 */
function UpgradePrompt({
  feature,
  requiredTier,
  currentTier,
  subscriptionStatus,
  message,
  trialDaysRemaining,
}: UpgradePromptProps) {
  const navigate = useNavigate();

  const featureDisplayNames: Record<FeatureName, string> = {
    leave_management: 'Leave Management',
    deputy_integration: 'Deputy Integration',
    compliance_tracking: 'Compliance Tracking',
    advanced_reports: 'Advanced Reports',
    multi_venue: 'Multi-Venue Management',
    api_access: 'API Access',
    custom_branding: 'Custom Branding',
    priority_support: 'Priority Support',
    basic_scheduling: 'Basic Scheduling',
    staff_management: 'Staff Management',
    venue_management: 'Venue Management',
    shift_tracking: 'Shift Tracking',
  };

  const tierPricing: Record<SubscriptionTier, { price: string; features: string[] }> = {
    starter: {
      price: '$29/month',
      features: ['Basic Scheduling', 'Staff Management', 'Venue Management'],
    },
    professional: {
      price: '$79/month',
      features: [
        'Everything in Starter',
        'Leave Management',
        'Deputy Integration',
        'Compliance Tracking',
        'Advanced Reports',
      ],
    },
    enterprise: {
      price: '$199/month',
      features: [
        'Everything in Professional',
        'API Access',
        'Custom Branding',
        'Priority Support',
        'Dedicated Account Manager',
      ],
    },
    custom: {
      price: 'Contact Us',
      features: ['Custom features tailored to your needs'],
    },
  };

  const tierInfo = tierPricing[requiredTier];
  const isTrialExpired = subscriptionStatus === 'trial_expired';
  const isSubscriptionExpired = subscriptionStatus === 'subscription_expired';

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">{featureDisplayNames[feature]}</h2>
          <p className="text-blue-100">Upgrade Required</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Status Badge */}
          {(isTrialExpired || isSubscriptionExpired) && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                isTrialExpired
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {isTrialExpired
                ? 'Your free trial has ended. Upgrade to continue using premium features.'
                : 'Your subscription has expired. Please renew to regain access.'}
            </div>
          )}

          {/* Message */}
          <p className="text-gray-600 mb-6">{message}</p>

          {/* Tier Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900 capitalize">
                {requiredTier} Plan
              </span>
              <span className="text-lg font-bold text-blue-600">{tierInfo.price}</span>
            </div>
            <ul className="space-y-2">
              {tierInfo.features.slice(0, 4).map((f, i) => (
                <li key={i} className="flex items-center text-sm text-gray-600">
                  <svg
                    className="w-4 h-4 mr-2 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/settings?tab=subscription')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Upgrade Now
            </button>
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>

          {/* Help Link */}
          <p className="text-center text-sm text-gray-500 mt-4">
            Need help?{' '}
            <a href="mailto:support@meadsecurity.com" className="text-blue-600 hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for checking feature access in components
 * Returns a boolean and helper functions
 */
export function useFeatureAccess(feature: FeatureName) {
  const { hasFeatureAccess, getRequiredTier, getUpgradeMessage, shouldShowUpgradePrompt } =
    useSubscription();

  return {
    hasAccess: hasFeatureAccess(feature),
    requiredTier: getRequiredTier(feature),
    upgradeMessage: getUpgradeMessage(feature),
    showUpgradePrompt: shouldShowUpgradePrompt(feature),
  };
}

/**
 * Component for conditionally rendering UI elements based on feature access
 * (simpler than FeatureGate, just hides/shows content)
 */
export function FeatureFlag({
  feature,
  children,
  fallback = null,
}: {
  feature: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasFeatureAccess } = useSubscription();

  if (hasFeatureAccess(feature)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

export default FeatureGate;
