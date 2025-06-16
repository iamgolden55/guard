import type React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// For demo mode - allow access to all routes regardless of role
// This is only for role-based access, not authentication itself
const DEMO_ROLE_BYPASS = false;

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

/**
 * ProtectedRoute component that checks if user is authenticated
 * and has the required role before rendering children
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { authState, isUserRole, refreshUserToken } = useAuth();
  const location = useLocation();

  // Add debugging to track authentication state
  console.log('ProtectedRoute - Auth State:', {
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    token: authState.token ? 'exists' : 'missing',
    user: authState.user ? `${authState.user.username} (${authState.user.role})` : 'missing',
    location: location.pathname
  });

  // Show loading state while authentication is being checked
  if (authState.isLoading) {
    console.log('Auth is still loading - showing spinner');
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Check if the user is authenticated
  if (!authState.isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    // Check localStorage to see if tokens exist even though auth state says not authenticated
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const user = localStorage.getItem('user');
    console.log('LocalStorage check:', { 
      token: token ? 'exists' : 'missing',
      refreshToken: refreshToken ? 'exists' : 'missing',
      user: user ? 'exists' : 'missing'
    });

    // If tokens exist in localStorage but authState says not authenticated,
    // try to recover by refreshing the token
    if (token && refreshToken && user) {
      console.log('Tokens exist in localStorage but authState says not authenticated, trying to recover...');
      // Try to refresh the token, but continue with redirection regardless
      // This is to prevent an infinite loop if the token refresh fails
      refreshUserToken().catch(err => {
        console.error('Token refresh failed during recovery attempt:', err);
      });
    }
    
    // Redirect to login if not authenticated, and remember the page they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If allowedRoles is specified, check if user has at least one of the required roles
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => isUserRole(role));

    if (!hasAllowedRole) {
      // In demo mode, allow access to all routes regardless of role restrictions
      // This allows staff users to see manager/admin pages and vice versa
      if (DEMO_ROLE_BYPASS) {
        console.log(`DEMO MODE: Bypassing role restriction for ${authState.user?.role} to access:`, location.pathname);
        return <Outlet />;
      }

      console.log(`User does not have any of the required roles: ${allowedRoles.join(', ')}`);
      console.log(`Current user role: ${authState.user?.role}`);
      // Redirect to unauthorized page if user doesn't have the required role
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Render children routes if authenticated and authorized
  console.log('User authenticated and authorized for route:', location.pathname);
  return <Outlet />;
};

export default ProtectedRoute;
