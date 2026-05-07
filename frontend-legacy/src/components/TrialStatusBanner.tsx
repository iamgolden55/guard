import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';

interface TrialStatusBannerProps {
  /** Threshold in days to start showing warnings (default: 7) */
  warningThreshold?: number;
  /** Whether the banner can be dismissed */
  dismissable?: boolean;
  /** Custom class name for positioning */
  className?: string;
}

/**
 * TrialStatusBanner - Shows trial expiration warnings and subscription status
 *
 * Displays:
 * - Warning when trial expires in less than 7 days
 * - Alert when trial has expired
 * - Alert when subscription has expired
 *
 * Usage:
 * ```tsx
 * // In your layout or dashboard
 * <TrialStatusBanner />
 * ```
 */
export function TrialStatusBanner({
  warningThreshold = 7,
  dismissable = true,
  className = '',
}: TrialStatusBannerProps) {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);
  const {
    subscriptionStatus,
    subscriptionTier,
    trialDaysRemaining,
    isTrialActive,
    isTrialExpired,
    state,
  } = useSubscription();

  // Don't show while loading
  if (state.isLoading) {
    return null;
  }

  // Don't show if dismissed
  if (isDismissed) {
    return null;
  }

  // Don't show if no subscription data
  if (!subscriptionStatus) {
    return null;
  }

  // Determine what to show
  const isSubscriptionExpired = subscriptionStatus === 'subscription_expired';
  const isTrialExpiring = isTrialActive && trialDaysRemaining <= warningThreshold && trialDaysRemaining > 0;

  // Don't show for active subscriptions with plenty of trial time
  if (!isTrialExpiring && !isTrialExpired && !isSubscriptionExpired) {
    return null;
  }

  // Determine banner style and content
  let bannerStyle: 'warning' | 'error';
  let title: string;
  let message: string;
  let icon: React.ReactNode;

  if (isSubscriptionExpired) {
    bannerStyle = 'error';
    title = 'Subscription Expired';
    message =
      'Your subscription has expired. Some features are now restricted. Please renew your subscription to restore full access.';
    icon = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    );
  } else if (isTrialExpired) {
    bannerStyle = 'error';
    title = 'Trial Expired';
    message =
      'Your free trial has ended. Upgrade now to continue using all premium features without interruption.';
    icon = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  } else {
    // Trial expiring soon
    bannerStyle = 'warning';
    title = `Trial Expires in ${trialDaysRemaining} Day${trialDaysRemaining === 1 ? '' : 's'}`;
    message =
      trialDaysRemaining <= 3
        ? 'Your trial is almost over! Upgrade now to keep all your features and data.'
        : 'Upgrade before your trial ends to continue enjoying premium features.';
    icon = (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }

  const baseClasses =
    'relative flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-lg shadow-sm';
  const styleClasses =
    bannerStyle === 'error'
      ? 'bg-red-50 text-red-800 border border-red-200'
      : 'bg-amber-50 text-amber-800 border border-amber-200';

  return (
    <div className={`${baseClasses} ${styleClasses} ${className}`} role="alert">
      {/* Icon */}
      <div
        className={`flex-shrink-0 ${bannerStyle === 'error' ? 'text-red-500' : 'text-amber-500'}`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{title}</p>
        <p className={`mt-0.5 ${bannerStyle === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
          {message}
        </p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => navigate('/admin/settings?tab=subscription')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            bannerStyle === 'error'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {isTrialExpired || isSubscriptionExpired ? 'Upgrade Now' : 'Choose Plan'}
        </button>

        {dismissable && (
          <button
            onClick={() => setIsDismissed(true)}
            className={`p-2 rounded-md transition-colors ${
              bannerStyle === 'error'
                ? 'text-red-500 hover:bg-red-100'
                : 'text-amber-500 hover:bg-amber-100'
            }`}
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact trial status indicator for sidebar or header
 */
export function TrialStatusIndicator() {
  const navigate = useNavigate();
  const { subscriptionStatus, trialDaysRemaining, isTrialActive, isTrialExpired, state } =
    useSubscription();

  if (state.isLoading || !subscriptionStatus) {
    return null;
  }

  const isSubscriptionExpired = subscriptionStatus === 'subscription_expired';
  const isTrialExpiring = isTrialActive && trialDaysRemaining <= 7 && trialDaysRemaining > 0;

  // Don't show for active subscriptions
  if (subscriptionStatus === 'active') {
    return null;
  }

  // Show trial days remaining for active trials
  if (isTrialActive && trialDaysRemaining > 7) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-md">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{trialDaysRemaining} days left in trial</span>
      </div>
    );
  }

  // Show warning for expiring or expired status
  let bgColor: string;
  let textColor: string;
  let label: string;

  if (isSubscriptionExpired || isTrialExpired) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
    label = isTrialExpired ? 'Trial Expired' : 'Subscription Expired';
  } else if (isTrialExpiring && trialDaysRemaining <= 3) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-700';
    label = `${trialDaysRemaining}d left`;
  } else {
    bgColor = 'bg-amber-100';
    textColor = 'text-amber-700';
    label = `${trialDaysRemaining}d left`;
  }

  return (
    <button
      onClick={() => navigate('/admin/settings?tab=subscription')}
      className={`flex items-center gap-2 px-3 py-1.5 ${bgColor} ${textColor} text-sm font-medium rounded-md hover:opacity-80 transition-opacity`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{label}</span>
    </button>
  );
}

export default TrialStatusBanner;
