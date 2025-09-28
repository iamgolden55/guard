import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { motion } from 'framer-motion';

// Components
import OnboardingProgress from './OnboardingProgress';
import OnboardingHeader from './OnboardingHeader';
import OnboardingNavigation from './OnboardingNavigation';
import ValidationSummary from './ValidationSummary';
import StepTransition from './StepTransition';
import CompanyInfoStep from './steps/CompanyInfoStep';
import RegionalComplianceStep from './steps/RegionalComplianceStep';
import StaffOperationsStep from './steps/StaffOperationsStep';
import IntegrationsSetupStep from './steps/IntegrationsSetupStep';
import AccountFinalizationStep from './steps/AccountFinalizationStep';

// Types and services
import type {
  OnboardingWizardData,
  WizardStep,
  ValidationError,
  CompanyInfoData,
  RegionalComplianceData,
  StaffOperationsData,
  IntegrationsSetupData,
  AccountFinalizationData
} from '../../types/onboarding';
import {
  BusinessType,
  StaffSizeRange,
  DataProtectionLevel,
  AccountingProvider,
  AdminRole
} from '../../types/onboarding';
import onboardingService from '../../services/onboardingService';
import { useAuth } from '../../contexts/AuthContext';

const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { authState, updateOnboardingStatus, completeOnboarding } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Refs to track previous values and prevent circular updates
  const prevOnboardingRef = useRef(authState.onboarding);
  const isUpdatingFromAuthRef = useRef(false);

  // Initialize wizard data with defaults
  const [wizardData, setWizardData] = useState<Partial<OnboardingWizardData>>(() => {
    // Load saved data from localStorage or use defaults
    const savedData = onboardingService.getWizardData();
    return {
      companyInfo: {
        companyName: '',
        registrationNumber: '',
        businessType: BusinessType.PRIVATE_LIMITED,
        industry: '',
        foundedYear: new Date().getFullYear(),
        websiteUrl: '',
        description: '',
        address: {
          street: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'United Kingdom'
        },
        primaryContact: {
          firstName: authState.user?.firstName || '',
          lastName: authState.user?.lastName || '',
          email: authState.user?.email || '',
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
        dataProtectionLevel: DataProtectionLevel.GDPR_COMPLIANT
      },
      staffOperations: {
        staffSize: StaffSizeRange.SMALL,
        expectedGrowth: {
          sixMonths: 0,
          oneYear: 0,
          twoYears: 0
        },
        operationalCapacity: {
          maxConcurrentShifts: 1,
          peakHoursCapacity: 1,
          emergencyStaffing: 1,
          specialEventCapacity: 1
        },
        shiftPatterns: [],
        specialOperations: []
      },
      integrationsSetup: {
        deputy: {
          enabled: false,
          syncFrequency: 'daily' as any,
          syncOptions: {
            employees: false,
            timesheets: false,
            rosters: false,
            locations: false,
            departments: false
          }
        },
        accounting: {
          provider: AccountingProvider.NONE,
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
          payFrequency: 'monthly' as any
        },
        communication: {
          sms: { enabled: false, provider: '' },
          email: { enabled: false, provider: '' },
          whatsapp: { enabled: false }
        },
        customIntegrations: []
      },
      accountFinalization: {
        adminUsers: [{
          firstName: authState.user?.firstName || '',
          lastName: authState.user?.lastName || '',
          email: authState.user?.email || '',
          role: AdminRole.SUPER_ADMIN,
          permissions: []
        }],
        securitySettings: {
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: false,
            expiryDays: 90
          },
          sessionTimeout: 60,
          mfaRequired: false,
          ipWhitelist: [],
          auditLogging: true,
          dataRetentionPeriod: 365
        },
        billingInfo: {
          planType: 'starter' as any,
          billingCycle: 'monthly' as any,
          paymentMethod: {
            type: 'credit_card' as any
          },
          billingAddress: {
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'United Kingdom'
          }
        },
        preferences: {
          timezone: 'Europe/London',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '24h',
          currency: 'GBP',
          language: 'en-GB',
          notifications: {
            email: true,
            sms: false,
            pushNotifications: true,
            systemAlerts: true,
            shiftReminders: true,
            complianceAlerts: true
          }
        }
      },
      ...savedData
    };
  });

  // Define wizard steps - memoized to prevent re-creation on every render
  const steps: WizardStep[] = React.useMemo(() => [
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

  // Check for existing onboarding on component mount
  useEffect(() => {
    const checkExistingOnboarding = () => {
      // Check if user already has onboarding in progress
      const existingProgress = onboardingService.getProgress();
      if (existingProgress?.companyId) {
        console.log('Found existing onboarding in progress:', existingProgress);
      }
    };

    checkExistingOnboarding();
  }, []); // Only run once on mount

  // Load progress from AuthContext only when it actually changes
  useEffect(() => {
    const currentOnboarding = authState.onboarding;
    const prevOnboarding = prevOnboardingRef.current;

    // Check if onboarding data actually changed (deep comparison)
    const onboardingChanged =
      currentOnboarding.currentStep !== prevOnboarding.currentStep ||
      JSON.stringify(currentOnboarding.completedSteps) !== JSON.stringify(prevOnboarding.completedSteps) ||
      currentOnboarding.isCompleted !== prevOnboarding.isCompleted ||
      currentOnboarding.hasCompany !== prevOnboarding.hasCompany;

    if (onboardingChanged && !isUpdatingFromAuthRef.current) {
      // Update local state from AuthContext
      isUpdatingFromAuthRef.current = true;

      // Handle null values from initial state
      const actualCurrentStep = currentOnboarding.currentStep ?? 1;
      if (actualCurrentStep !== currentStep) {
        setCurrentStep(actualCurrentStep);
      }
      if (JSON.stringify(currentOnboarding.completedSteps) !== JSON.stringify(completedSteps)) {
        setCompletedSteps(currentOnboarding.completedSteps);
      }

      // Reset the flag after a microtask to allow state updates to complete
      setTimeout(() => {
        isUpdatingFromAuthRef.current = false;
      }, 0);
    }

    // Update the ref for next comparison
    prevOnboardingRef.current = currentOnboarding;
  }, [authState.onboarding, currentStep, completedSteps]);

  // Save progress to AuthContext when local state changes (but not when we're updating from AuthContext)
  useEffect(() => {
    if (!isUpdatingFromAuthRef.current) {
      // Only update if values are different from AuthContext to prevent circular updates
      // Handle null values from initial state
      const needsUpdate =
        (authState.onboarding.currentStep ?? 1) !== currentStep ||
        JSON.stringify(authState.onboarding.completedSteps) !== JSON.stringify(completedSteps);

      if (needsUpdate) {
        updateOnboardingStatus({
          currentStep,
          completedSteps
        });
      }
    }
  }, [currentStep, completedSteps, updateOnboardingStatus, authState.onboarding.currentStep, authState.onboarding.completedSteps]);

  // Update wizard data and save to localStorage
  const updateWizardData = useCallback((stepData: Partial<OnboardingWizardData>) => {
    setWizardData(prev => {
      const updated = { ...prev, ...stepData };
      onboardingService.saveWizardData(stepData);
      return updated;
    });
  }, []);

  // Validation for current step
  const validateCurrentStep = useCallback((): ValidationError[] => {
    let stepData: any;

    switch (currentStep) {
      case 1:
        stepData = wizardData.companyInfo;
        break;
      case 2:
        stepData = wizardData.regionalCompliance;
        break;
      case 3:
        stepData = wizardData.staffOperations;
        break;
      case 4:
        stepData = wizardData.integrationsSetup;
        break;
      case 5:
        stepData = wizardData.accountFinalization;
        break;
      default:
        return [];
    }

    return onboardingService.validateStep(stepData, currentStep);
  }, [currentStep, wizardData]);

  // Update validation errors when step or data changes
  useEffect(() => {
    const errors = validateCurrentStep();
    setValidationErrors(errors);
  }, [validateCurrentStep]);

  // Navigation handlers
  const handleNext = async () => {
    setIsLoading(true);
    setGlobalError(null);

    try {
      // Validate current step
      const errors = validateCurrentStep();
      if (errors.length > 0) {
        setValidationErrors(errors);
        setIsLoading(false);
        return;
      }

      // Submit current step data to API
      let response;
      switch (currentStep) {
        case 1:
          // For step 1, check if we need to initiate onboarding first
          const existingProgress = onboardingService.getProgress();
          if (!existingProgress?.companyId) {
            // No existing company - initiate onboarding to create one
            console.log('Initiating onboarding with company data...');

            try {
              // Use the updated service method with company data
              response = await onboardingService.initiateOnboarding(wizardData.companyInfo as CompanyInfoData);

              // Store company ID for future use
              if (response.onboarding?.company) {
                onboardingService.updateProgress(1, [1], response.onboarding.company, false);
              }
            } catch (error: any) {
              // Handle case where user already has completed onboarding
              if (error.message?.includes('completed company onboarding') ||
                  error.response?.status === 400) {
                console.log('User already has completed onboarding, redirecting to dashboard...');
                const errorData = error.response?.data || {};
                completeOnboarding(errorData.companyId || 'existing');
                navigate('/dashboard');
                return;
              }
              // Set the specific error message from the service
              setGlobalError(error.message);
              setIsLoading(false);
              return;
            }
          } else {
            // Company already exists, update company info
            response = await onboardingService.submitCompanyInfo(wizardData.companyInfo as CompanyInfoData);
          }
          break;
        case 2:
          response = await onboardingService.submitRegionalCompliance(wizardData.regionalCompliance as RegionalComplianceData);
          break;
        case 3:
          response = await onboardingService.submitStaffOperations(wizardData.staffOperations as StaffOperationsData);
          break;
        case 4:
          response = await onboardingService.submitIntegrationsSetup(wizardData.integrationsSetup as IntegrationsSetupData);
          break;
        case 5:
          // For step 5, complete the entire onboarding process
          response = await onboardingService.completeOnboarding(wizardData as OnboardingWizardData);
          break;
      }

      // Handle response - different formats for different endpoints
      const isSuccessful = response?.success || response?.status === 'success';

      if (isSuccessful) {
        // Mark step as completed
        if (!completedSteps.includes(currentStep)) {
          setCompletedSteps(prev => [...prev, currentStep]);
        }

        // Move to next step or complete
        if (currentStep < 5) {
          setCurrentStep(currentStep + 1);
        } else {
          // Onboarding complete - mark as completed in AuthContext
          const companyId = response?.onboarding?.company || 'temp-company-id';
          completeOnboarding(companyId);

          // Redirect to dashboard
          navigate('/dashboard');
        }
      } else {
        setGlobalError(response?.message || 'An error occurred. Please try again.');
        if (response?.errors) {
          setValidationErrors(response.errors);
        }
      }
    } catch (error: any) {
      console.error('Step submission error:', error);
      // Use the specific error message from the service if available
      const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
      setGlobalError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setGlobalError(null);
      setValidationErrors([]);
    }
  };

  const handleSkip = () => {
    // For optional steps, allow skipping
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
      setGlobalError(null);
      setValidationErrors([]);
    }
  };

  // Get current step component
  const getCurrentStepComponent = () => {
    const stepProps = {
      data: wizardData,
      onChange: updateWizardData,
      errors: validationErrors,
      isLoading
    };

    switch (currentStep) {
      case 1:
        return <CompanyInfoStep {...stepProps} />;
      case 2:
        return <RegionalComplianceStep {...stepProps} />;
      case 3:
        return <StaffOperationsStep {...stepProps} />;
      case 4:
        return <IntegrationsSetupStep {...stepProps} />;
      case 5:
        return <AccountFinalizationStep {...stepProps} />;
      default:
        return null;
    }
  };

  const currentStepData = steps.find(step => step.id === currentStep);
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
            <div className="bg-white rounded-lg shadow-sm min-h-screen">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <OnboardingHeader
                  title={currentStepData?.title || ''}
                  subtitle={currentStepData?.subtitle || ''}
                  description={currentStepData?.description || ''}
                  stepNumber={currentStep}
                  totalSteps={5}
                  icon={getStepIcon(currentStep)}
                />

                {/* Global error message */}
                {globalError && (
                  <MessageBar
                    messageBarType={MessageBarType.error}
                    isMultiline={false}
                    dismissButtonAriaLabel="Close"
                    onDismiss={() => setGlobalError(null)}
                  >
                    {globalError}
                  </MessageBar>
                )}

                {/* Validation summary */}
                <ValidationSummary errors={validationErrors} />
              </div>

              {/* Step content with animations */}
              <div className="p-6 min-h-96">
                <StepTransition currentStep={currentStep} isLoading={isLoading}>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-center py-12"
                    >
                      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 12 }}>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Spinner size={SpinnerSize.large} />
                        </motion.div>
                        <span className="text-gray-600">Processing...</span>
                      </Stack>
                    </motion.div>
                  )}

                  {!isLoading && getCurrentStepComponent()}
                </StepTransition>
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
                onSkip={currentStep === 4 ? handleSkip : undefined}
                showSkip={currentStep === 4}
                nextLabel={currentStep === 5 ? 'Complete Setup' : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to get step icons
const getStepIcon = (step: number): string => {
  const icons = {
    1: 'BuildingOffice',
    2: 'ComplianceAudit',
    3: 'People',
    4: 'PlugConnected',
    5: 'Completed'
  };
  return icons[step as keyof typeof icons] || 'Circle';
};

export default OnboardingWizard;