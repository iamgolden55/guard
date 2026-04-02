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

  // Show loading state while authentication is being checked
  if (authState.isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
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
        return <Outlet />;
      }

      // Redirect to unauthorized page if user doesn't have the required role
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Render children routes if authenticated and authorized
  return <Outlet />;
};

export default ProtectedRoute;
