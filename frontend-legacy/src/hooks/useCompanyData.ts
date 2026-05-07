import { useCallback, useMemo } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import {
  SecurityCompany,
  CompanyRole,
  CompanyPermission,
  SubscriptionTier,
  CompanyLimits,
  SubscriptionDetails
} from '../types';

/**
 * Hook for accessing and managing company data and permissions
 */
export function useCompanyData() {
  const {
    companyState,
    setCurrentCompany,
    switchCompany,
    refreshCompanyData,
    getUserRole,
    getUserPermissions,
    hasPermission,
    isCompanyOwner,
    getSubscriptionDetails,
    getCompanyLimits,
    isWithinLimits,
    getRemainingCapacity,
    getAllCompanies,
    canAccessMultipleCompanies
  } = useCompany();

  // Current company information
  const currentCompany = useMemo(() => {
    return companyState.currentCompany;
  }, [companyState.currentCompany]);

  // User role and permissions for current company
  const userAccess = useMemo(() => {
    const role = getUserRole();
    const permissions = getUserPermissions();
    const isOwner = isCompanyOwner();

    return {
      role,
      permissions,
      isOwner,
      isAdmin: role === CompanyRole.ADMIN || isOwner,
      isManager: role === CompanyRole.MANAGER || role === CompanyRole.ADMIN || isOwner,
      canManageUsers: hasPermission(CompanyPermission.MANAGE_USERS),
      canManageVenues: hasPermission(CompanyPermission.MANAGE_VENUES),
      canManageShifts: hasPermission(CompanyPermission.MANAGE_SHIFTS),
      canManageInvoices: hasPermission(CompanyPermission.MANAGE_INVOICES),
      canManageSettings: hasPermission(CompanyPermission.MANAGE_SETTINGS),
      canViewReports: hasPermission(CompanyPermission.VIEW_REPORTS),
      canManageIntegrations: hasPermission(CompanyPermission.MANAGE_INTEGRATIONS)
    };
  }, [getUserRole, getUserPermissions, isCompanyOwner, hasPermission]);

  // Subscription and limits information
  const subscription = useMemo(() => {
    const details = getSubscriptionDetails();
    const limits = getCompanyLimits();

    if (!details || !limits) {
      return {
        isLoading: companyState.isLoading,
        details: null,
        limits: null,
        tier: null,
        status: null,
        isActive: false,
        isTrialActive: false,
        daysUntilExpiry: null
      };
    }

    const isTrialActive = details.trialEnd ? new Date(details.trialEnd) > new Date() : false;
    const daysUntilExpiry = details.currentPeriodEnd
      ? Math.ceil((new Date(details.currentPeriodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      isLoading: false,
      details,
      limits,
      tier: details.tier,
      status: details.status,
      isActive: details.status === 'active',
      isTrialActive,
      daysUntilExpiry,
      willCancelAtPeriodEnd: details.cancelAtPeriodEnd
    };
  }, [getSubscriptionDetails, getCompanyLimits, companyState.isLoading]);

  // Resource usage and capacity
  const capacity = useMemo(() => {
    const limits = getCompanyLimits();

    if (!limits) {
      return {
        staff: { current: 0, max: 0, remaining: 0, percentage: 0, isWithinLimit: true },
        venues: { current: 0, max: 0, remaining: 0, percentage: 0, isWithinLimit: true },
        shifts: { current: 0, max: 0, remaining: 0, percentage: 0, isWithinLimit: true },
        storage: { current: 0, max: 0, remaining: 0, percentage: 0, isWithinLimit: true }
      };
    }

    const calculateMetrics = (current: number, max: number) => ({
      current,
      max,
      remaining: Math.max(0, max - current),
      percentage: max > 0 ? (current / max) * 100 : 0,
      isWithinLimit: current < max
    });

    return {
      staff: calculateMetrics(limits.staffCount, limits.maxStaff),
      venues: calculateMetrics(limits.venuesCount, limits.maxVenues),
      shifts: calculateMetrics(limits.shiftsPerMonth, limits.maxShiftsPerMonth),
      storage: calculateMetrics(limits.storageUsed, limits.maxStorage)
    };
  }, [getCompanyLimits]);

  // Multi-company management
  const multiCompany = useMemo(() => {
    const companies = getAllCompanies();
    const hasMultiple = canAccessMultipleCompanies();

    return {
      companies,
      hasMultiple,
      count: companies.length,
      canSwitch: hasMultiple,
      otherCompanies: companies.filter(c => c.id !== currentCompany?.id)
    };
  }, [getAllCompanies, canAccessMultipleCompanies, currentCompany]);

  // Company status and health
  const companyHealth = useMemo(() => {
    if (!currentCompany || !subscription.limits) {
      return {
        overall: 'unknown' as const,
        issues: [],
        warnings: [],
        recommendations: []
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check subscription status
    if (!subscription.isActive) {
      issues.push('Subscription is not active');
    }

    if (subscription.daysUntilExpiry && subscription.daysUntilExpiry < 7) {
      warnings.push(`Subscription expires in ${subscription.daysUntilExpiry} days`);
    }

    // Check capacity limits
    if (capacity.staff.percentage > 90) {
      warnings.push('Staff capacity is near limit');
    } else if (capacity.staff.percentage > 80) {
      recommendations.push('Consider upgrading plan for more staff capacity');
    }

    if (capacity.venues.percentage > 90) {
      warnings.push('Venue capacity is near limit');
    }

    if (capacity.storage.percentage > 90) {
      warnings.push('Storage capacity is near limit');
    }

    // Check onboarding completion
    if (!currentCompany.onboardingCompleted) {
      recommendations.push('Complete company onboarding setup');
    }

    const overall = issues.length > 0 ? 'critical'
      : warnings.length > 0 ? 'warning'
      : recommendations.length > 0 ? 'good'
      : 'excellent';

    return {
      overall: overall as 'excellent' | 'good' | 'warning' | 'critical' | 'unknown',
      issues,
      warnings,
      recommendations
    };
  }, [currentCompany, subscription, capacity]);

  // Action handlers
  const switchToCompany = useCallback(async (companyId: string) => {
    try {
      await switchCompany(companyId);
      return true;
    } catch (error) {
      console.error('Failed to switch company:', error);
      return false;
    }
  }, [switchCompany]);

  const refreshData = useCallback(async () => {
    try {
      await refreshCompanyData();
      return true;
    } catch (error) {
      console.error('Failed to refresh company data:', error);
      return false;
    }
  }, [refreshCompanyData]);

  // Permission checking utilities
  const checkPermission = useCallback((permission: CompanyPermission | CompanyPermission[]) => {
    if (Array.isArray(permission)) {
      return permission.every(p => hasPermission(p));
    }
    return hasPermission(permission);
  }, [hasPermission]);

  const checkAnyPermission = useCallback((permissions: CompanyPermission[]) => {
    return permissions.some(p => hasPermission(p));
  }, [hasPermission]);

  // Resource limit checking
  const canAddResource = useCallback((resource: keyof CompanyLimits, quantity: number = 1) => {
    const limits = getCompanyLimits();
    if (!limits) return true;

    const maxKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof CompanyLimits;
    const current = limits[resource];
    const max = limits[maxKey];

    if (typeof current === 'number' && typeof max === 'number') {
      return (current + quantity) <= max;
    }

    return true;
  }, [getCompanyLimits]);

  // Company profile helpers
  const getCompanyDisplayName = useCallback(() => {
    return currentCompany?.name || 'No Company Selected';
  }, [currentCompany]);

  const getCompanyInitials = useCallback(() => {
    if (!currentCompany?.name) return 'NC';

    return currentCompany.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }, [currentCompany]);

  return {
    // Company data
    currentCompany,
    isLoading: companyState.isLoading,
    error: companyState.error,

    // User access
    userAccess,

    // Subscription & limits
    subscription,
    capacity,

    // Multi-company
    multiCompany,

    // Company health
    companyHealth,

    // Actions
    switchToCompany,
    refreshData,

    // Permission utilities
    hasPermission,
    checkPermission,
    checkAnyPermission,

    // Resource utilities
    isWithinLimits,
    getRemainingCapacity,
    canAddResource,

    // Display utilities
    getCompanyDisplayName,
    getCompanyInitials
  };
}

export default useCompanyData;