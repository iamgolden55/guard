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
    console.log('AuthGuard: User not authenticated, redirecting to login');

    // Check localStorage to see if tokens exist even though auth state says not authenticated
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = localStorage.getItem('user');

    console.log('AuthGuard: LocalStorage check:', {
      token: token ? 'exists' : 'missing',
      refreshToken: refreshToken ? 'exists' : 'missing',
      user: user ? 'exists' : 'missing'
    });

    // If tokens exist in localStorage but authState says not authenticated,
    // try to recover by refreshing the token
    if (token && refreshToken && user) {
      console.log('AuthGuard: Tokens exist in localStorage but authState says not authenticated, trying to recover...');
      // Try to refresh the token, but continue with redirection regardless
      // This is to prevent an infinite loop if the token refresh fails
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
      console.log('AuthGuard: Staff user detected, bypassing onboarding checks');
      return children ? <>{children}</> : <Outlet />;
    }

    // Allow access to onboarding routes themselves
    if (location.pathname.startsWith('/onboarding')) {
      return children ? <>{children}</> : <Outlet />;
    }

    // If onboarding is not completed (null means not loaded, false means loaded but incomplete)
    if (authState.onboarding.isCompleted !== true) {
      console.log('AuthGuard: Onboarding not completed. Status:', authState.onboarding);

      // Redirect to appropriate onboarding step (use 1 as fallback if currentStep is null)
      const currentStep = authState.onboarding.currentStep ?? 1;
      return <Navigate to={`/onboarding/step/${currentStep}`} replace />;
    }

    // Check company requirement if specified
    if (requireCompany && !authState.onboarding.hasCompany) {
      console.log('AuthGuard: Company required but user has no company assigned');
      return <Navigate to="/onboarding/step/1" replace />;
    }
  }

  // Check role-based authorization
  if (allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => isUserRole(role));

    if (!hasAllowedRole) {
      console.log(`AuthGuard: User does not have any of the required roles: ${allowedRoles.join(', ')}`);
      console.log(`AuthGuard: Current user role: ${authState.user?.role}`);
      // Redirect to unauthorized page if user doesn't have the required role
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // All checks passed, render children or outlet
  console.log('AuthGuard: User authenticated and authorized for route:', location.pathname);
  return children ? <>{children}</> : <Outlet />;
};

export default AuthGuard;