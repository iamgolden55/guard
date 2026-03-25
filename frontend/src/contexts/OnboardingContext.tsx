import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  OnboardingState,
  OnboardingWizardData,
  ValidationState,
  WizardStep,
  OnboardingProgress,
  StepValidation
} from '../types';
import api from '../services/api';

// Define the context value structure
interface OnboardingContextValue {
  // State
  onboardingState: OnboardingState;
  wizardSteps: WizardStep[];

  // Navigation
  goToStep: (stepNumber: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canNavigateToStep: (stepNumber: number) => boolean;

  // Form Management
  updateFormData: <T extends keyof OnboardingWizardData>(
    step: T,
    data: Partial<OnboardingWizardData[T]>
  ) => void;
  resetFormData: () => void;

  // Validation
  validateCurrentStep: () => Promise<boolean>;
  validateAllSteps: () => Promise<boolean>;
  getStepValidation: (stepKey: string) => StepValidation;

  // Persistence
  saveProgress: () => Promise<void>;
  loadSavedProgress: () => Promise<void>;
  clearSavedProgress: () => void;

  // Submission
  submitOnboarding: () => Promise<boolean>;

  // Utilities
  calculateProgress: () => number;
  getEstimatedTimeRemaining: () => number;
}

// Initial state
const initialFormData: OnboardingWizardData = {
  companyInfo: {
    companyName: '',
    registrationNumber: '',
    businessType: 'PRIVATE_LIMITED' as any,
    industry: '',
    foundedYear: new Date().getFullYear(),
    websiteUrl: '',
    description: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    },
    primaryContact: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: ''
    }
  },
  regionalCompliance: {
    primaryRegion: '',
    operatingRegions: [],
    complianceProfile: {
      workingHoursRegulation: '',
      overtimeRules: '',
      breakRequirements: '',
      holidayEntitlements: '',
      leaveRequirements: '',
      healthSafetyStandards: []
    },
    specialRequirements: [],
    dataProtectionLevel: 'BASIC' as any
  },
  staffOperations: {
    staffSize: 'SMALL' as any,
    expectedGrowth: {
      sixMonths: 0,
      oneYear: 0,
      twoYears: 0
    },
    operationalCapacity: {
      maxConcurrentShifts: 0,
      peakHoursCapacity: 0,
      emergencyStaffing: 0,
      specialEventCapacity: 0
    },
    shiftPatterns: [],
    specialOperations: []
  },
  integrationsSetup: {
    deputy: {
      enabled: false,
      syncFrequency: 'DAILY' as any,
      syncOptions: {
        employees: true,
        timesheets: true,
        rosters: true,
        locations: true,
        departments: true
      }
    },
    accounting: {
      provider: 'NONE' as any,
      enabled: false,
      syncOptions: {
        invoices: false,
        expenses: false,
        payroll: false,
        taxes: false
      }
    },
    payroll: {
      provider: '',
      enabled: false,
      payFrequency: 'MONTHLY' as any
    },
    communication: {
      sms: { enabled: false, provider: '' },
      email: { enabled: false, provider: '' },
      whatsapp: { enabled: false }
    },
    customIntegrations: []
  },
  accountFinalization: {
    adminUsers: [],
    securitySettings: {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: false,
        expiryDays: 90
      },
      sessionTimeout: 480, // 8 hours in minutes
      mfaRequired: false,
      ipWhitelist: [],
      auditLogging: true,
      dataRetentionPeriod: 36 // months
    },
    billingInfo: {
      planType: 'STARTER' as any,
      billingCycle: 'MONTHLY' as any,
      paymentMethod: {
        type: 'CREDIT_CARD' as any
      },
      billingAddress: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: ''
      }
    },
    preferences: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24',
      currency: 'GBP',
      language: 'en',
      notifications: {
        email: true,
        sms: false,
        pushNotifications: true,
        systemAlerts: true,
        shiftReminders: true,
        complianceAlerts: true
      }
    }
  }
};

const initialOnboardingState: OnboardingState = {
  currentStep: 1,
  totalSteps: 5,
  formData: initialFormData,
  validation: {},
  isSubmitting: false,
  progress: 0,
  sessionId: `onboarding_${Date.now()}`,
  errors: {}
};

// Wizard step configuration
const defaultWizardSteps: WizardStep[] = [
  {
    id: 1,
    title: 'Company Information',
    subtitle: 'Tell us about your security firm',
    description: 'Basic company details and registration information',
    isCompleted: false,
    isActive: true,
    isAccessible: true
  },
  {
    id: 2,
    title: 'Regional Compliance',
    subtitle: 'Configure compliance settings',
    description: 'Set up regional compliance and regulatory requirements',
    isCompleted: false,
    isActive: false,
    isAccessible: false
  },
  {
    id: 3,
    title: 'Staff Operations',
    subtitle: 'Configure your workforce',
    description: 'Set up staff size, shift patterns, and operational capacity',
    isCompleted: false,
    isActive: false,
    isAccessible: false
  },
  {
    id: 4,
    title: 'Integrations Setup',
    subtitle: 'Connect your tools',
    description: 'Configure integrations with Deputy, accounting, and other systems',
    isCompleted: false,
    isActive: false,
    isAccessible: false
  },
  {
    id: 5,
    title: 'Account Finalization',
    subtitle: 'Complete your setup',
    description: 'Finalize admin users, security settings, and billing information',
    isCompleted: false,
    isActive: false,
    isAccessible: false
  }
];

// Create the context
const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

// Custom hook for using the onboarding context
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

// Provider component
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(initialOnboardingState);
  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>(defaultWizardSteps);

  // Load saved progress on mount
  useEffect(() => {
    loadSavedProgress();
  }, []);

  // Save progress whenever state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProgress();
    }, 1000); // Debounce saves by 1 second

    return () => clearTimeout(timer);
  }, [onboardingState.formData]);

  // Update wizard steps based on current state
  useEffect(() => {
    setWizardSteps(prevSteps =>
      prevSteps.map(step => ({
        ...step,
        isActive: step.id === onboardingState.currentStep,
        isCompleted: step.id < onboardingState.currentStep,
        isAccessible: step.id <= Math.max(onboardingState.currentStep, 1)
      }))
    );
  }, [onboardingState.currentStep]);

  // Navigation functions
  const goToStep = useCallback((stepNumber: number) => {
    if (!canNavigateToStep(stepNumber)) {
      console.warn(`Cannot navigate to step ${stepNumber}`);
      return;
    }

    setOnboardingState(prev => ({
      ...prev,
      currentStep: stepNumber
    }));
  }, []);

  const goToNextStep = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      console.warn('Current step validation failed');
      return;
    }

    const nextStep = onboardingState.currentStep + 1;
    if (nextStep <= onboardingState.totalSteps) {
      goToStep(nextStep);
    }
  }, [onboardingState.currentStep, onboardingState.totalSteps, goToStep]);

  const goToPreviousStep = useCallback(() => {
    const previousStep = onboardingState.currentStep - 1;
    if (previousStep >= 1) {
      goToStep(previousStep);
    }
  }, [onboardingState.currentStep, goToStep]);

  const canNavigateToStep = useCallback((stepNumber: number) => {
    return stepNumber >= 1 &&
           stepNumber <= onboardingState.totalSteps &&
           stepNumber <= Math.max(onboardingState.currentStep, 1);
  }, [onboardingState.currentStep, onboardingState.totalSteps]);

  // Form management
  const updateFormData = useCallback(<T extends keyof OnboardingWizardData>(
    step: T,
    data: Partial<OnboardingWizardData[T]>
  ) => {
    setOnboardingState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [step]: {
          ...prev.formData[step],
          ...data
        }
      },
      lastSavedAt: new Date().toISOString()
    }));
  }, []);

  const resetFormData = useCallback(() => {
    setOnboardingState(prev => ({
      ...prev,
      formData: initialFormData,
      currentStep: 1,
      validation: {},
      errors: {}
    }));
    clearSavedProgress();
  }, []);

  // Validation functions
  const validateCurrentStep = useCallback(async (): Promise<boolean> => {
    const stepKey = getStepKey(onboardingState.currentStep);
    const validation = await validateStep(stepKey, onboardingState.formData);

    setOnboardingState(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        [stepKey]: validation
      }
    }));

    return validation.isValid;
  }, [onboardingState.currentStep, onboardingState.formData]);

  const validateAllSteps = useCallback(async (): Promise<boolean> => {
    const allValidations: ValidationState = {};
    let allValid = true;

    for (let step = 1; step <= onboardingState.totalSteps; step++) {
      const stepKey = getStepKey(step);
      const validation = await validateStep(stepKey, onboardingState.formData);
      allValidations[stepKey] = validation;
      if (!validation.isValid) {
        allValid = false;
      }
    }

    setOnboardingState(prev => ({
      ...prev,
      validation: allValidations
    }));

    return allValid;
  }, [onboardingState.formData, onboardingState.totalSteps]);

  const getStepValidation = useCallback((stepKey: string): StepValidation => {
    return onboardingState.validation[stepKey] || {
      isValid: false,
      errors: [],
      warnings: []
    };
  }, [onboardingState.validation]);

  // Persistence functions
  const saveProgress = useCallback(async () => {
    try {
      const progressData = {
        ...onboardingState,
        timestamp: new Date().toISOString()
      };

      localStorage.setItem(`onboarding_progress_${onboardingState.sessionId}`,
        JSON.stringify(progressData));
    } catch (error) {
      console.error('Failed to save onboarding progress:', error);
    }
  }, [onboardingState]);

  const loadSavedProgress = useCallback(async () => {
    try {
      const savedKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('onboarding_progress_'));

      if (savedKeys.length > 0) {
        // Get the most recent session
        const mostRecentKey = savedKeys.sort().reverse()[0];
        const savedData = localStorage.getItem(mostRecentKey);

        if (savedData) {
          const progressData = JSON.parse(savedData);
          // Only load if it's less than 24 hours old
          const savedTime = new Date(progressData.timestamp);
          const now = new Date();
          const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);

          if (hoursDiff < 24) {
            setOnboardingState(progressData);
          } else {
            // Clean up old data
            localStorage.removeItem(mostRecentKey);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load saved progress:', error);
    }
  }, []);

  const clearSavedProgress = useCallback(() => {
    try {
      const savedKeys = Object.keys(localStorage).filter(key =>
        key.startsWith('onboarding_progress_'));

      savedKeys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear saved progress:', error);
    }
  }, []);

  // Submission
  const submitOnboarding = useCallback(async (): Promise<boolean> => {
    setOnboardingState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const isValid = await validateAllSteps();
      if (!isValid) {
        console.error('Onboarding validation failed');
        return false;
      }

      const formData = onboardingState.formData;

      // Submit each onboarding section to the API
      if (formData.companyInfo) {
        await api.put('/api/v1/onboarding/company-info/', formData.companyInfo);
      }

      if (formData.regionalSetup) {
        await api.put('/api/v1/onboarding/regional-setup/', formData.regionalSetup);
      }

      if (formData.staffConfig) {
        await api.put('/api/v1/onboarding/staff-config/', formData.staffConfig);
      }

      if (formData.integrations) {
        await api.put('/api/v1/onboarding/integrations/', formData.integrations);
      }

      // Mark onboarding as complete
      await api.post('/api/v1/onboarding/complete/');

      // Clear saved progress after successful submission
      clearSavedProgress();

      return true;
    } catch (error) {
      console.error('Onboarding submission failed:', error);
      return false;
    } finally {
      setOnboardingState(prev => ({ ...prev, isSubmitting: false }));
    }
  }, [onboardingState.formData, validateAllSteps, clearSavedProgress]);

  // Utility functions
  const calculateProgress = useCallback((): number => {
    let completedSteps = 0;
    const totalFields = getTotalRequiredFields();
    let completedFields = 0;

    // Count completed fields across all steps
    Object.entries(onboardingState.validation).forEach(([stepKey, validation]) => {
      if (validation.isValid) {
        completedSteps++;
      }
    });

    // More granular progress based on actual field completion
    completedFields = getCompletedFieldsCount(onboardingState.formData);

    return Math.min(Math.round((completedFields / totalFields) * 100), 100);
  }, [onboardingState.formData, onboardingState.validation]);

  const getEstimatedTimeRemaining = useCallback((): number => {
    const baseTimePerStep = 3; // minutes
    const remainingSteps = onboardingState.totalSteps - onboardingState.currentStep + 1;
    return remainingSteps * baseTimePerStep;
  }, [onboardingState.currentStep, onboardingState.totalSteps]);

  // Context value
  const value: OnboardingContextValue = {
    onboardingState,
    wizardSteps,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    canNavigateToStep,
    updateFormData,
    resetFormData,
    validateCurrentStep,
    validateAllSteps,
    getStepValidation,
    saveProgress,
    loadSavedProgress,
    clearSavedProgress,
    submitOnboarding,
    calculateProgress,
    getEstimatedTimeRemaining
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

// Helper functions
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

async function validateStep(stepKey: string, formData: OnboardingWizardData): Promise<StepValidation> {
  // TODO: Implement comprehensive validation logic for each step
  // For now, return basic validation based on required fields

  const validation: StepValidation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  switch (stepKey) {
    case 'companyInfo':
      if (!formData.companyInfo.companyName.trim()) {
        validation.errors.push({
          field: 'companyName',
          message: 'Company name is required',
          code: 'REQUIRED'
        });
      }
      break;

    case 'regionalCompliance':
      if (!formData.regionalCompliance.primaryRegion) {
        validation.errors.push({
          field: 'primaryRegion',
          message: 'Primary region is required',
          code: 'REQUIRED'
        });
      }
      break;

    // Add validation for other steps...
  }

  validation.isValid = validation.errors.length === 0;
  return validation;
}

function getTotalRequiredFields(): number {
  // TODO: Calculate based on actual required fields
  return 25;
}

function getCompletedFieldsCount(formData: OnboardingWizardData): number {
  // TODO: Count actual completed fields
  let count = 0;

  if (formData.companyInfo.companyName.trim()) count++;
  if (formData.companyInfo.industry.trim()) count++;
  if (formData.regionalCompliance.primaryRegion) count++;
  // ... count other fields

  return count;
}

export default OnboardingContext;