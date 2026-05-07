import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingService, companyService } from '../services';
import {
  OnboardingWizardData,
  OnboardingProgress,
  SecurityCompany,
  RegionalComplianceConfig,
  OnboardingResponse
} from '../types';

// Query Keys
export const onboardingKeys = {
  all: ['onboarding'] as const,
  progress: (sessionId?: string) => [...onboardingKeys.all, 'progress', sessionId] as const,
  countries: () => [...onboardingKeys.all, 'countries'] as const,
  compliance: (countryCode: string) => [...onboardingKeys.all, 'compliance', countryCode] as const,
  stats: () => [...onboardingKeys.all, 'stats'] as const,
  savedProgress: (sessionId: string) => [...onboardingKeys.all, 'saved-progress', sessionId] as const,
};

/**
 * Hook for initiating onboarding
 */
export function useInitiateOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: onboardingService.initiateOnboarding,
    onSuccess: (data) => {
      // Cache the new session progress
      queryClient.setQueryData(
        onboardingKeys.progress(data.sessionId),
        data.progress
      );
    },
  });
}

/**
 * Hook for getting onboarding progress
 */
export function useOnboardingProgress(sessionId?: string) {
  return useQuery({
    queryKey: onboardingKeys.progress(sessionId),
    queryFn: () => onboardingService.getOnboardingProgress(sessionId),
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for saving company information
 */
export function useSaveCompanyInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, sessionId }: {
      data: OnboardingWizardData['companyInfo'];
      sessionId?: string;
    }) => onboardingService.saveCompanyInfo(data, sessionId),
    onSuccess: (_, { sessionId }) => {
      // Invalidate progress to refresh step completion
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.progress(sessionId)
      });
    },
  });
}

/**
 * Hook for saving regional setup
 */
export function useSaveRegionalSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, sessionId }: {
      data: OnboardingWizardData['regionalCompliance'];
      sessionId?: string;
    }) => onboardingService.saveRegionalSetup(data, sessionId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.progress(sessionId)
      });
    },
  });
}

/**
 * Hook for saving staff configuration
 */
export function useSaveStaffConfiguration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, sessionId }: {
      data: OnboardingWizardData['staffOperations'];
      sessionId?: string;
    }) => onboardingService.saveStaffConfiguration(data, sessionId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.progress(sessionId)
      });
    },
  });
}

/**
 * Hook for saving integrations setup
 */
export function useSaveIntegrationsSetup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, sessionId }: {
      data: OnboardingWizardData['integrationsSetup'];
      sessionId?: string;
    }) => onboardingService.saveIntegrationsSetup(data, sessionId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.progress(sessionId)
      });
    },
  });
}

/**
 * Hook for saving account finalization
 */
export function useSaveAccountFinalization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, sessionId }: {
      data: OnboardingWizardData['accountFinalization'];
      sessionId?: string;
    }) => onboardingService.saveAccountFinalization(data, sessionId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({
        queryKey: onboardingKeys.progress(sessionId)
      });
    },
  });
}

/**
 * Hook for completing onboarding
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, sessionId }: {
      data: OnboardingWizardData;
      sessionId?: string;
    }) => onboardingService.completeOnboarding(data, sessionId),
    onSuccess: (data, { sessionId }) => {
      // Clear onboarding cache
      queryClient.removeQueries({
        queryKey: onboardingKeys.progress(sessionId)
      });

      // Clear saved progress
      queryClient.removeQueries({
        queryKey: onboardingKeys.savedProgress(sessionId!)
      });

      // Invalidate company data to show the new company
      queryClient.invalidateQueries({
        queryKey: ['companies']
      });

      // Send completion notification
      if (data.company && data.company.id) {
        const adminEmail = 'admin@example.com'; // Should come from form data
        onboardingService.sendCompletionNotification(data.company.id, adminEmail);
      }
    },
  });
}

/**
 * Hook for validating a step
 */
export function useValidateStep() {
  return useMutation({
    mutationFn: ({ step, data, sessionId }: {
      step: string;
      data: any;
      sessionId?: string;
    }) => onboardingService.validateStep(step, data, sessionId),
  });
}

/**
 * Hook for getting available countries
 */
export function useAvailableCountries() {
  return useQuery({
    queryKey: onboardingKeys.countries(),
    queryFn: onboardingService.getAvailableCountries,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook for getting regional compliance configuration
 */
export function useRegionalCompliance(countryCode: string) {
  return useQuery({
    queryKey: onboardingKeys.compliance(countryCode),
    queryFn: () => onboardingService.getRegionalCompliance(countryCode),
    enabled: !!countryCode,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook for testing integration connections
 */
export function useTestIntegration() {
  return useMutation({
    mutationFn: ({ integrationId, credentials }: {
      integrationId: string;
      credentials: Record<string, string>;
    }) => onboardingService.testIntegrationConnection(integrationId, credentials),
  });
}

/**
 * Hook for uploading company logo
 */
export function useUploadCompanyLogo() {
  return useMutation({
    mutationFn: ({ file, sessionId }: {
      file: File;
      sessionId?: string;
    }) => onboardingService.uploadCompanyLogo(file, sessionId),
  });
}

/**
 * Hook for getting onboarding statistics
 */
export function useOnboardingStats() {
  return useQuery({
    queryKey: onboardingKeys.stats(),
    queryFn: onboardingService.getOnboardingStats,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook for saving progress (auto-save)
 */
export function useSaveProgress() {
  return useMutation({
    mutationFn: ({ data, currentStep, sessionId }: {
      data: Partial<OnboardingWizardData>;
      currentStep: number;
      sessionId: string;
    }) => onboardingService.saveProgress(data, currentStep, sessionId),
    // Don't show loading states for auto-save
    meta: {
      hideLoading: true,
    },
  });
}

/**
 * Hook for loading saved progress
 */
export function useLoadSavedProgress(sessionId: string) {
  return useQuery({
    queryKey: onboardingKeys.savedProgress(sessionId),
    queryFn: () => onboardingService.loadProgress(sessionId),
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh data
    retry: false, // Don't retry if no saved progress
  });
}

/**
 * Hook for clearing saved progress
 */
export function useClearProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => onboardingService.clearProgress(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.removeQueries({
        queryKey: onboardingKeys.savedProgress(sessionId)
      });
    },
  });
}

/**
 * Combined hook for onboarding step operations
 */
export function useOnboardingStep(stepName: keyof OnboardingWizardData) {
  const saveCompanyInfo = useSaveCompanyInfo();
  const saveRegionalSetup = useSaveRegionalSetup();
  const saveStaffConfig = useSaveStaffConfiguration();
  const saveIntegrations = useSaveIntegrationsSetup();
  const saveAccountFinalization = useSaveAccountFinalization();

  const getSaveMutation = () => {
    switch (stepName) {
      case 'companyInfo':
        return saveCompanyInfo;
      case 'regionalCompliance':
        return saveRegionalSetup;
      case 'staffOperations':
        return saveStaffConfig;
      case 'integrationsSetup':
        return saveIntegrations;
      case 'accountFinalization':
        return saveAccountFinalization;
      default:
        throw new Error(`Unknown step: ${stepName}`);
    }
  };

  const saveMutation = getSaveMutation();

  return {
    save: saveMutation.mutate,
    saveAsync: saveMutation.mutateAsync,
    isLoading: saveMutation.isPending,
    error: saveMutation.error,
    isSuccess: saveMutation.isSuccess,
    reset: saveMutation.reset,
  };
}

/**
 * Hook for optimistic onboarding updates
 */
export function useOptimisticOnboarding(sessionId: string) {
  const queryClient = useQueryClient();

  const updateOptimistically = (stepData: Partial<OnboardingWizardData>, currentStep: number) => {
    // Optimistically update the progress
    queryClient.setQueryData(
      onboardingKeys.progress(sessionId),
      (old: OnboardingProgress | undefined) => {
        if (!old) return old;

        return {
          ...old,
          currentStep,
          completedSteps: [...new Set([...old.completedSteps, currentStep - 1])].filter(s => s >= 0),
          lastUpdatedAt: new Date().toISOString(),
        };
      }
    );

    // Also save progress in background
    onboardingService.saveProgress(stepData, currentStep, sessionId)
      .catch(console.error); // Silent fail for auto-save
  };

  const revertOptimisticUpdate = () => {
    queryClient.invalidateQueries({
      queryKey: onboardingKeys.progress(sessionId)
    });
  };

  return {
    updateOptimistically,
    revertOptimisticUpdate,
  };
}