import type React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// For demo mode - allow access to all routes regardless of role
const DEMO_MODE = true;

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

/**
 * ProtectedRoute component that checks if user is authenticated
 * and has the required role before rendering children
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { authState, isUserRole } = useAuth();
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
    console.log('User not authenticated, redirecting to login');
    // Redirect to login if not authenticated, and remember the page they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If allowedRoles is specified, check if user has at least one of the required roles
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some(role => isUserRole(role));

    if (!hasAllowedRole) {
      // In demo mode, allow access to all routes regardless of role restrictions
      // This allows staff users to see manager/admin pages and vice versa
      if (DEMO_MODE) {
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
