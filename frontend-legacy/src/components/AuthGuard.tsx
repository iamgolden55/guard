import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Spinner, SpinnerSize } from '@fluentui/react';

interface AuthGuardProps {
  children?: React.ReactNode;
  requireOnboarding?: boolean;
  allowedRoles?: UserRole[];
  requireCompany?: boolean;
}

/**
 * Unified AuthGuard component that handles:
 * 1. Authentication verification
 * 2. Role-based authorization
 * 3. Onboarding completion validation
 * 4. Company association checks
 * 5. Unified loading states
 * 6. Token recovery logic
 */
const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireOnboarding = false,
  allowedRoles = [],
  requireCompany = false
}) => {
  const { authState, isUserRole, refreshUserToken } = useAuth();
  const location = useLocation();

  // Show loading state while authentication or onboarding is being checked
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

  // Check if the user is authenticated
  if (!authState.isAuthenticated) {
    // If user data exists but auth state says not authenticated,
    // try to recover by refreshing the cookie-based session
    const user = localStorage.getItem('user');
    if (user) {
      refreshUserToken().catch(err => {
        console.error('AuthGuard: Token refresh failed during recovery attempt:', err);
      });
    }

    // Redirect to login if not authenticated, and remember the page they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check onboarding requirements
  if (requireOnboarding) {
    // Staff users don't need onboarding - they join existing companies
    if (authState.user?.role === 'staff') {
      return children ? <>{children}</> : <Outlet />;
    }

    // Allow access to onboarding routes themselves
    if (location.pathname.startsWith('/onboarding')) {
      return children ? <>{children}</> : <Outlet />;
    }

    // If onboarding status hasn't loaded yet, show loading instead of redirecting
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

    // Only redirect to onboarding if explicitly not completed (false, not null)
    if (authState.onboarding.isCompleted === false) {
      // Redirect to appropriate onboarding step (use 1 as fallback if currentStep is null)
      const currentStep = authState.onboarding.currentStep ?? 1;
      return <Navigate to={`/onboarding/step/${currentStep}`} replace />;
    }

    // Check company requirement if specified
    if (requireCompany && !authState.onboarding.hasCompany) {
      return <Navigate to="/onboarding/step/1" replace />;
    }
  }

  // Check role-based authorization
  if (allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => isUserRole(role));

    if (!hasAllowedRole) {
      // Redirect to unauthorized page if user doesn't have the required role
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // All checks passed, render children or outlet
  return children ? <>{children}</> : <Outlet />;
};

export default AuthGuard;