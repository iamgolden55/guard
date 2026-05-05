import type React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserRole } from "../types";
import { Spinner } from "./Spinner";

interface AuthGuardProps {
  children?: React.ReactNode;
  requireOnboarding?: boolean;
  allowedRoles?: UserRole[];
  requireCompany?: boolean;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Spinner size={36} />
        <p className="mt-4 text-sm text-ink-600">Loading…</p>
      </div>
    </div>
  );
}

/**
 * Unified AuthGuard — handles authentication, role-based authz, onboarding
 * gates, and company association. Ported from frontend-legacy with the
 * Fluent UI Spinner swapped for the design-system Spinner.
 */
const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  requireOnboarding = false,
  allowedRoles = [],
  requireCompany = false,
}) => {
  const { authState, isUserRole, refreshUserToken } = useAuth();
  const location = useLocation();

  if (
    authState.isLoading ||
    authState.onboardingLoading ||
    (authState.isAuthenticated && authState.onboarding.currentStep === null)
  ) {
    return <FullPageSpinner />;
  }

  if (!authState.isAuthenticated) {
    const user = localStorage.getItem("user");
    if (user) {
      refreshUserToken().catch((err) => {
        console.error("AuthGuard: Token refresh failed during recovery attempt:", err);
      });
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireOnboarding) {
    if (authState.user?.role === "staff") {
      return children ? <>{children}</> : <Outlet />;
    }
    if (location.pathname.startsWith("/onboarding")) {
      return children ? <>{children}</> : <Outlet />;
    }
    if (authState.onboarding.isCompleted === null) {
      return <FullPageSpinner />;
    }
    if (authState.onboarding.isCompleted === false) {
      const currentStep = authState.onboarding.currentStep ?? 1;
      return <Navigate to={`/onboarding/step/${currentStep}`} replace />;
    }
    if (requireCompany && !authState.onboarding.hasCompany) {
      return <Navigate to="/onboarding/step/1" replace />;
    }
  }

  if (allowedRoles.length > 0) {
    const hasAllowedRole = allowedRoles.some((role) => isUserRole(role));
    if (!hasAllowedRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};

export default AuthGuard;
