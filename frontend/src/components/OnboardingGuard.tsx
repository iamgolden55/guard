import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, SpinnerSize } from '@fluentui/react';

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * OnboardingGuard component protects routes that require completed onboarding.
 * Redirects users to onboarding flow if they haven't completed setup.
 */
const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { authState } = useAuth();
  const location = useLocation();

  // If still loading OR onboarding is loading OR if we have a token but no onboarding data yet, show spinner
  if (authState.isLoading || authState.onboardingLoading ||
      (authState.isAuthenticated && authState.onboarding.currentStep === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size={SpinnerSize.large} />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If onboarding status is null (not loaded yet), show loading
  if (authState.onboarding.isCompleted === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size={SpinnerSize.large} />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Only redirect if onboarding is explicitly not completed (false)
  if (authState.onboarding.isCompleted === false) {
    console.log('OnboardingGuard: Onboarding not completed. Status:', authState.onboarding);
    // Allow access to onboarding routes themselves
    if (location.pathname.startsWith('/onboarding')) {
      return <>{children}</>;
    }

    // Redirect to appropriate onboarding step (use 1 as fallback if currentStep is null)
    const currentStep = authState.onboarding.currentStep ?? 1;
    return <Navigate to={`/onboarding/step/${currentStep}`} replace />;
  }

  // If user doesn't have a company assigned (should not happen after onboarding)
  if (!authState.onboarding.hasCompany) {
    return <Navigate to="/onboarding/step/1" replace />;
  }

  // All checks passed, render children
  return <>{children}</>;
};

export default OnboardingGuard;