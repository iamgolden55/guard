import { useCallback, useMemo } from 'react';
import { useOnboarding } from '../contexts/OnboardingContext';
import {
  OnboardingWizardData,
  WizardStep,
  OnboardingProgress,
  StepValidation
} from '../types';

/**
 * Hook for managing onboarding progress and step navigation
 */
export function useOnboardingProgress() {
  const {
    onboardingState,
    wizardSteps,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    canNavigateToStep,
    validateCurrentStep,
    validateAllSteps,
    getStepValidation,
    calculateProgress,
    getEstimatedTimeRemaining,
    submitOnboarding
  } = useOnboarding();

  // Navigation helpers
  const navigation = useMemo(() => ({
    canGoNext: canNavigateToStep(onboardingState.currentStep + 1),
    canGoPrevious: onboardingState.currentStep > 1,
    isFirstStep: onboardingState.currentStep === 1,
    isLastStep: onboardingState.currentStep === onboardingState.totalSteps,
    currentStepIndex: onboardingState.currentStep - 1, // 0-based index for arrays
  }), [onboardingState.currentStep, onboardingState.totalSteps, canNavigateToStep]);

  // Progress information
  const progressInfo = useMemo(() => ({
    currentStep: onboardingState.currentStep,
    totalSteps: onboardingState.totalSteps,
    percentage: calculateProgress(),
    completedSteps: wizardSteps.filter(step => step.isCompleted).length,
    remainingSteps: onboardingState.totalSteps - onboardingState.currentStep + 1,
    estimatedTimeRemaining: getEstimatedTimeRemaining(),
    isSubmitting: onboardingState.isSubmitting
  }), [
    onboardingState.currentStep,
    onboardingState.totalSteps,
    onboardingState.isSubmitting,
    calculateProgress,
    getEstimatedTimeRemaining,
    wizardSteps
  ]);

  // Current step information
  const currentStep = useMemo(() => {
    return wizardSteps.find(step => step.id === onboardingState.currentStep) || null;
  }, [wizardSteps, onboardingState.currentStep]);

  // Validation helpers
  const validation = useMemo(() => {
    const currentStepKey = getStepKey(onboardingState.currentStep);
    const currentStepValidation = getStepValidation(currentStepKey);

    return {
      currentStepValid: currentStepValidation.isValid,
      currentStepErrors: currentStepValidation.errors,
      currentStepWarnings: currentStepValidation.warnings,
      hasErrors: Object.values(onboardingState.validation).some(v => v.errors.length > 0),
      totalErrors: Object.values(onboardingState.validation).reduce(
        (sum, v) => sum + v.errors.length, 0
      ),
      totalWarnings: Object.values(onboardingState.validation).reduce(
        (sum, v) => sum + v.warnings.length, 0
      )
    };
  }, [onboardingState.validation, getStepValidation, onboardingState.currentStep]);

  // Step completion status
  const completionStatus = useMemo(() => {
    const completedSteps = wizardSteps.filter(step => step.isCompleted);
    const accessibleSteps = wizardSteps.filter(step => step.isAccessible);

    return {
      allStepsCompleted: completedSteps.length === onboardingState.totalSteps,
      readyForSubmission: completedSteps.length >= onboardingState.totalSteps - 1,
      stepsAccessible: accessibleSteps.length,
      completionRate: (completedSteps.length / onboardingState.totalSteps) * 100
    };
  }, [wizardSteps, onboardingState.totalSteps]);

  // Enhanced navigation functions
  const goToNextStepWithValidation = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      await goToNextStep();
    }
    return isValid;
  }, [validateCurrentStep, goToNextStep]);

  const goToStepWithValidation = useCallback(async (stepNumber: number) => {
    if (stepNumber < onboardingState.currentStep) {
      // Allow going back without validation
      goToStep(stepNumber);
      return true;
    } else {
      // Validate current step before moving forward
      const isValid = await validateCurrentStep();
      if (isValid) {
        goToStep(stepNumber);
      }
      return isValid;
    }
  }, [onboardingState.currentStep, validateCurrentStep, goToStep]);

  // Step-specific helpers
  const getStepByNumber = useCallback((stepNumber: number): WizardStep | null => {
    return wizardSteps.find(step => step.id === stepNumber) || null;
  }, [wizardSteps]);

  const getStepProgress = useCallback((stepNumber: number) => {
    const step = getStepByNumber(stepNumber);
    if (!step) return { isCompleted: false, isAccessible: false, isActive: false };

    return {
      isCompleted: step.isCompleted,
      isAccessible: step.isAccessible,
      isActive: step.isActive,
      title: step.title,
      subtitle: step.subtitle,
      description: step.description
    };
  }, [getStepByNumber]);

  // Form data summary for review
  const getFormSummary = useCallback(() => {
    return {
      companyInfo: {
        name: onboardingState.formData.companyInfo.companyName,
        industry: onboardingState.formData.companyInfo.industry,
        size: onboardingState.formData.staffOperations.staffSize,
        country: onboardingState.formData.companyInfo.address.country
      },
      integrations: {
        deputy: onboardingState.formData.integrationsSetup.deputy.enabled,
        accounting: onboardingState.formData.integrationsSetup.accounting.enabled,
        payroll: onboardingState.formData.integrationsSetup.payroll.enabled
      },
      subscription: {
        plan: onboardingState.formData.accountFinalization.billingInfo.planType,
        billing: onboardingState.formData.accountFinalization.billingInfo.billingCycle
      }
    };
  }, [onboardingState.formData]);

  // Final submission with comprehensive validation
  const submitWithValidation = useCallback(async () => {
    const allValid = await validateAllSteps();
    if (!allValid) {
      // Find the first step with errors and navigate to it
      for (let i = 1; i <= onboardingState.totalSteps; i++) {
        const stepKey = getStepKey(i);
        const stepValidation = getStepValidation(stepKey);
        if (!stepValidation.isValid) {
          goToStep(i);
          break;
        }
      }
      return false;
    }

    return await submitOnboarding();
  }, [validateAllSteps, submitOnboarding, getStepValidation, goToStep, onboardingState.totalSteps]);

  return {
    // State
    currentStep,
    allSteps: wizardSteps,

    // Progress
    progress: progressInfo,
    navigation,
    validation,
    completion: completionStatus,

    // Actions
    goToStep,
    goToPreviousStep,
    goToNextStep: goToNextStepWithValidation,
    goToStepWithValidation,
    validateCurrentStep,
    validateAllSteps,
    submitWithValidation,

    // Utilities
    getStepByNumber,
    getStepProgress,
    getFormSummary,
    canNavigateToStep
  };
}

// Helper function to get step key from step number
function getStepKey(stepNumber: number): string {
  const stepKeys = [
    'companyInfo',
    'regionalCompliance',
    'staffOperations',
    'integrationsSetup',
    'accountFinalization'
  ];
  return stepKeys[stepNumber - 1] || 'companyInfo';
}

export default useOnboardingProgress;