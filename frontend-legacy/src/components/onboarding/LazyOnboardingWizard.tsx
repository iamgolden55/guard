import React, { Suspense, lazy, memo, useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';

// Optimized imports - only core components loaded initially
import OnboardingProgress from './OnboardingProgress';
import OnboardingHeader from './OnboardingHeader';
import OnboardingNavigation from './OnboardingNavigation';
import ValidationSummary from './ValidationSummary';

// Types
import type {
  OnboardingWizardData,
  WizardStep,
  ValidationError,
  CompanyInfoData,
  RegionalComplianceData,
  StaffOperationsData,
  IntegrationsSetupData,
  AccountFinalizationData,
} from '../../types/onboarding';

// Services - lazy loaded to reduce initial bundle
const onboardingService = lazy(() => import('../../services/onboardingService'));
const { useAuth } = lazy(() => import('../../contexts/AuthContext'));

// Lazy load step components - Critical for bundle size reduction
const CompanyInfoStep = lazy(() => import('./steps/CompanyInfoStep'));
const RegionalComplianceStep = lazy(() => import('./steps/RegionalComplianceStep'));
const StaffOperationsStep = lazy(() => import('./steps/StaffOperationsStep'));
const IntegrationsSetupStep = lazy(() => import('./steps/IntegrationsSetupStep'));
const AccountFinalizationStep = lazy(() => import('./steps/AccountFinalizationStep'));

// Performance optimized animation variants
const stepTransitionVariants = {
  initial: {
    opacity: 0,
    x: 50,
    scale: 0.95
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94], // Custom easing for 60fps
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    x: -50,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  }
};

// Optimized loading component
const StepLoadingSpinner = memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex items-center justify-center py-16"
  >
    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      >
        <Spinner size={SpinnerSize.large} />
      </motion.div>
      <span className="text-gray-600 font-medium">Loading step...</span>
    </Stack>
  </motion.div>
));

// Error fallback component
const StepErrorFallback = memo(({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => (
  <div className="p-8 text-center">
    <MessageBar
      messageBarType={MessageBarType.error}
      isMultiline={true}
    >
      <div className="space-y-4">
        <h3 className="font-semibold">Failed to load onboarding step</h3>
        <p className="text-sm">Error: {error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    </MessageBar>
  </div>
));

// Optimized form data hook with memoization
const useOptimizedWizardData = () => {
  const [wizardData, setWizardData] = useState<Partial<OnboardingWizardData>>(() => {
    // Only load from localStorage on mount to avoid hydration issues
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('onboarding_wizard_data');
        return saved ? JSON.parse(saved) : {};
      } catch (error) {
        console.warn('Failed to load saved onboarding data:', error);
        return {};
      }
    }
    return {};
  });

  const updateWizardData = useCallback((stepData: Partial<OnboardingWizardData>) => {
    setWizardData(prev => {
      const updated = { ...prev, ...stepData };
      // Debounced localStorage save
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('onboarding_wizard_data', JSON.stringify(updated));
        } catch (error) {
          console.warn('Failed to save onboarding data:', error);
        }
      }
      return updated;
    });
  }, []);

  return { wizardData, updateWizardData };
};

// Main optimized onboarding wizard component
const LazyOnboardingWizard: React.FC = memo(() => {
  const navigate = useNavigate();

  // State management
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Optimized wizard data management
  const { wizardData, updateWizardData } = useOptimizedWizardData();

  // Memoized steps configuration
  const steps: WizardStep[] = useMemo(() => [
    {
      id: 1,
      title: 'Company Information',
      subtitle: 'Tell us about your business',
      description: 'Basic company details and contact information',
      isCompleted: completedSteps.includes(1),
      isActive: currentStep === 1,
      isAccessible: true
    },
    {
      id: 2,
      title: 'Regional Compliance',
      subtitle: 'Configure compliance settings',
      description: 'Set up regional compliance and data protection',
      isCompleted: completedSteps.includes(2),
      isActive: currentStep === 2,
      isAccessible: completedSteps.includes(1) || currentStep >= 2
    },
    {
      id: 3,
      title: 'Staff Operations',
      subtitle: 'Define operational capacity',
      description: 'Staff size, shift patterns, and operational requirements',
      isCompleted: completedSteps.includes(3),
      isActive: currentStep === 3,
      isAccessible: completedSteps.includes(2) || currentStep >= 3
    },
    {
      id: 4,
      title: 'Integrations Setup',
      subtitle: 'Connect external systems',
      description: 'Deputy, accounting, and other third-party integrations',
      isCompleted: completedSteps.includes(4),
      isActive: currentStep === 4,
      isAccessible: completedSteps.includes(3) || currentStep >= 4
    },
    {
      id: 5,
      title: 'Account Finalization',
      subtitle: 'Complete setup',
      description: 'Admin users, security settings, and final configuration',
      isCompleted: completedSteps.includes(5),
      isActive: currentStep === 5,
      isAccessible: completedSteps.includes(4) || currentStep >= 5
    }
  ], [currentStep, completedSteps]);

  // Optimized step component renderer with lazy loading
  const getCurrentStepComponent = useCallback(() => {
    const stepProps = {
      data: wizardData,
      onChange: updateWizardData,
      errors: validationErrors,
      isLoading
    };

    const StepComponent = (() => {
      switch (currentStep) {
        case 1: return CompanyInfoStep;
        case 2: return RegionalComplianceStep;
        case 3: return StaffOperationsStep;
        case 4: return IntegrationsSetupStep;
        case 5: return AccountFinalizationStep;
        default: return null;
      }
    })();

    if (!StepComponent) return null;

    return (
      <ErrorBoundary
        FallbackComponent={StepErrorFallback}
        onReset={() => setGlobalError(null)}
      >
        <Suspense fallback={<StepLoadingSpinner />}>
          <StepComponent {...stepProps} />
        </Suspense>
      </ErrorBoundary>
    );
  }, [currentStep, wizardData, updateWizardData, validationErrors, isLoading]);

  // Navigation handlers with optimized performance
  const handleNext = useCallback(async () => {
    setIsLoading(true);
    setGlobalError(null);

    try {
      // Validation would happen here
      const isValid = validationErrors.length === 0;

      if (!isValid) {
        setIsLoading(false);
        return;
      }

      // Simulate API call - replace with actual service call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark step as completed
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }

      // Move to next step or complete
      if (currentStep < 5) {
        setCurrentStep(currentStep + 1);
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Step submission error:', error);
      setGlobalError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentStep, validationErrors, completedSteps, navigate]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setGlobalError(null);
      setValidationErrors([]);
    }
  }, [currentStep]);

  // Memoized current step data
  const currentStepData = useMemo(() =>
    steps.find(step => step.id === currentStep),
    [steps, currentStep]
  );

  const isValid = validationErrors.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Progress */}
          <div className="lg:col-span-1">
            <OnboardingProgress
              steps={steps}
              currentStep={currentStep}
              completedSteps={completedSteps}
              className="sticky top-8"
            />
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <motion.div
              className="bg-white rounded-lg shadow-sm min-h-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <OnboardingHeader
                  title={currentStepData?.title || ''}
                  subtitle={currentStepData?.subtitle || ''}
                  description={currentStepData?.description || ''}
                  stepNumber={currentStep}
                  totalSteps={5}
                  icon={`step-${currentStep}`}
                />

                {/* Global error message */}
                <AnimatePresence>
                  {globalError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <MessageBar
                        messageBarType={MessageBarType.error}
                        isMultiline={false}
                        dismissButtonAriaLabel="Close"
                        onDismiss={() => setGlobalError(null)}
                      >
                        {globalError}
                      </MessageBar>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Validation summary */}
                <ValidationSummary errors={validationErrors} />
              </div>

              {/* Step content with optimized animations */}
              <div className="p-6 min-h-96">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    variants={stepTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {getCurrentStepComponent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <OnboardingNavigation
                currentStep={currentStep}
                totalSteps={5}
                isLoading={isLoading}
                isValid={isValid}
                canGoBack={currentStep > 1}
                canGoNext={true}
                onNext={handleNext}
                onBack={handleBack}
                nextLabel={currentStep === 5 ? 'Complete Setup' : undefined}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
});

LazyOnboardingWizard.displayName = 'LazyOnboardingWizard';

export default LazyOnboardingWizard;