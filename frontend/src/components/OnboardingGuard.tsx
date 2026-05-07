import type React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "./Spinner";

interface OnboardingGuardProps {
  children: React.ReactNode;
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

const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
  const { authState } = useAuth();
  const location = useLocation();

  if (
    authState.isLoading ||
    authState.onboardingLoading ||
    (authState.isAuthenticated && authState.onboarding.currentStep === null)
  ) {
    return <FullPageSpinner />;
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (authState.onboarding.isCompleted === null) {
    return <FullPageSpinner />;
  }

  if (authState.onboarding.isCompleted === false) {
    if (location.pathname.startsWith("/onboarding")) {
      return <>{children}</>;
    }
    const currentStep = authState.onboarding.currentStep ?? 1;
    return <Navigate to={`/onboarding/step/${currentStep}`} replace />;
  }

  if (!authState.onboarding.hasCompany) {
    return <Navigate to="/onboarding/step/1" replace />;
  }

  return <>{children}</>;
};

export default OnboardingGuard;
