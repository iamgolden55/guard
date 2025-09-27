import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  SecurityCompany,
  UserCompanyMembership,
  CompanyContextState,
  CompanyRole,
  CompanyPermission,
  SubscriptionDetails,
  CompanyLimits,
  CompanyContextResponse
} from '../types';
import useAuth from './AuthContext';

// Define the context value structure
interface CompanyContextValue {
  // State
  companyState: CompanyContextState;

  // Company Management
  setCurrentCompany: (company: SecurityCompany) => void;
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanyData: () => Promise<void>;

  // User Management
  getUserRole: (companyId?: string) => CompanyRole | null;
  getUserPermissions: (companyId?: string) => CompanyPermission[];
  hasPermission: (permission: CompanyPermission, companyId?: string) => boolean;
  isCompanyOwner: (companyId?: string) => boolean;

  // Company Information
  getSubscriptionDetails: () => SubscriptionDetails | null;
  getCompanyLimits: () => CompanyLimits | null;
  isWithinLimits: (resource: keyof CompanyLimits) => boolean;
  getRemainingCapacity: (resource: keyof CompanyLimits) => number;

  // Multi-tenant Utilities
  getAllCompanies: () => SecurityCompany[];
  canAccessMultipleCompanies: () => boolean;
}

// Initial state
const initialCompanyState: CompanyContextState = {
  currentCompany: null,
  companies: [],
  userMemberships: [],
  isLoading: false,
  error: null
};

// Create the context
const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

// Custom hook for using the company context
export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

// Provider component
export function CompanyProvider({ children }: { children: ReactNode }) {
  const { authState } = useAuth();
  const [companyState, setCompanyState] = useState<CompanyContextState>(initialCompanyState);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails | null>(null);
  const [companyLimits, setCompanyLimits] = useState<CompanyLimits | null>(null);

  // Load company data when user authenticates
  useEffect(() => {
    if (authState.isAuthenticated && authState.user && !companyState.isLoading) {
      loadUserCompanies();
    }
  }, [authState.isAuthenticated, authState.user]);

  // Auto-select single company or load saved company preference
  useEffect(() => {
    if (companyState.companies.length === 1 && !companyState.currentCompany) {
      setCurrentCompany(companyState.companies[0]);
    } else if (companyState.companies.length > 1 && !companyState.currentCompany) {
      loadSavedCompanyPreference();
    }
  }, [companyState.companies]);

  // Company Management Functions
  const loadUserCompanies = useCallback(async () => {
    if (!authState.user) return;

    setCompanyState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // TODO: Replace with actual API call
      const mockCompanies: SecurityCompany[] = [
        {
          id: '1',
          name: 'Elite Security Services',
          registrationNumber: 'ESS-001',
          countryCode: 'GB',
          complianceProfileId: 1,
          staffCapacity: 50,
          subscriptionTier: 'PROFESSIONAL' as any,
          industry: 'Security Services',
          website: 'https://elitesecurity.com',
          phone: '+44 20 1234 5678',
          logoUrl: '',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          onboardingCompleted: true,
          onboardingStep: 5
        }
      ];

      const mockMemberships: UserCompanyMembership[] = [
        {
          id: '1',
          userId: authState.user.id,
          companyId: '1',
          role: 'OWNER' as CompanyRole,
          isOwner: true,
          permissions: Object.values(CompanyPermission),
          joinedAt: '2024-01-01T00:00:00Z'
        }
      ];

      setCompanyState(prev => ({
        ...prev,
        companies: mockCompanies,
        userMemberships: mockMemberships,
        isLoading: false
      }));

    } catch (error) {
      console.error('Failed to load user companies:', error);
      setCompanyState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load company data'
      }));
    }
  }, [authState.user]);

  const setCurrentCompany = useCallback((company: SecurityCompany) => {
    setCompanyState(prev => ({
      ...prev,
      currentCompany: company
    }));

    // Save company preference
    localStorage.setItem('selectedCompanyId', company.id);

    // Load company-specific data
    loadCompanyDetails(company.id);
  }, []);

  const switchCompany = useCallback(async (companyId: string) => {
    const company = companyState.companies.find(c => c.id === companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    setCurrentCompany(company);
  }, [companyState.companies, setCurrentCompany]);

  const refreshCompanyData = useCallback(async () => {
    if (!companyState.currentCompany) return;

    try {
      setCompanyState(prev => ({ ...prev, isLoading: true }));

      // TODO: Replace with actual API call to refresh current company data
      await loadCompanyDetails(companyState.currentCompany.id);

      setCompanyState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      console.error('Failed to refresh company data:', error);
      setCompanyState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh company data'
      }));
    }
  }, [companyState.currentCompany]);

  // User Permission Functions
  const getUserRole = useCallback((companyId?: string): CompanyRole | null => {
    const targetCompanyId = companyId || companyState.currentCompany?.id;
    if (!targetCompanyId) return null;

    const membership = companyState.userMemberships.find(m => m.companyId === targetCompanyId);
    return membership?.role || null;
  }, [companyState.currentCompany, companyState.userMemberships]);

  const getUserPermissions = useCallback((companyId?: string): CompanyPermission[] => {
    const targetCompanyId = companyId || companyState.currentCompany?.id;
    if (!targetCompanyId) return [];

    const membership = companyState.userMemberships.find(m => m.companyId === targetCompanyId);
    return membership?.permissions || [];
  }, [companyState.currentCompany, companyState.userMemberships]);

  const hasPermission = useCallback((permission: CompanyPermission, companyId?: string): boolean => {
    const userPermissions = getUserPermissions(companyId);
    return userPermissions.includes(permission);
  }, [getUserPermissions]);

  const isCompanyOwner = useCallback((companyId?: string): boolean => {
    const targetCompanyId = companyId || companyState.currentCompany?.id;
    if (!targetCompanyId) return false;

    const membership = companyState.userMemberships.find(m => m.companyId === targetCompanyId);
    return membership?.isOwner || false;
  }, [companyState.currentCompany, companyState.userMemberships]);

  // Company Information Functions
  const getSubscriptionDetails = useCallback((): SubscriptionDetails | null => {
    return subscriptionDetails;
  }, [subscriptionDetails]);

  const getCompanyLimits = useCallback((): CompanyLimits | null => {
    return companyLimits;
  }, [companyLimits]);

  const isWithinLimits = useCallback((resource: keyof CompanyLimits): boolean => {
    if (!companyLimits) return true;

    const maxKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof CompanyLimits;
    const current = companyLimits[resource];
    const max = companyLimits[maxKey];

    if (typeof current === 'number' && typeof max === 'number') {
      return current < max;
    }

    return true;
  }, [companyLimits]);

  const getRemainingCapacity = useCallback((resource: keyof CompanyLimits): number => {
    if (!companyLimits) return 0;

    const maxKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof CompanyLimits;
    const current = companyLimits[resource];
    const max = companyLimits[maxKey];

    if (typeof current === 'number' && typeof max === 'number') {
      return Math.max(0, max - current);
    }

    return 0;
  }, [companyLimits]);

  // Multi-tenant Utilities
  const getAllCompanies = useCallback((): SecurityCompany[] => {
    return companyState.companies;
  }, [companyState.companies]);

  const canAccessMultipleCompanies = useCallback((): boolean => {
    return companyState.companies.length > 1;
  }, [companyState.companies]);

  // Helper Functions
  const loadSavedCompanyPreference = useCallback(() => {
    try {
      const savedCompanyId = localStorage.getItem('selectedCompanyId');
      if (savedCompanyId) {
        const savedCompany = companyState.companies.find(c => c.id === savedCompanyId);
        if (savedCompany) {
          setCurrentCompany(savedCompany);
        }
      }
    } catch (error) {
      console.error('Failed to load saved company preference:', error);
    }
  }, [companyState.companies, setCurrentCompany]);

  const loadCompanyDetails = useCallback(async (companyId: string) => {
    try {
      // TODO: Replace with actual API calls
      const mockSubscriptionDetails: SubscriptionDetails = {
        tier: 'PROFESSIONAL' as any,
        status: 'active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        cancelAtPeriodEnd: false
      };

      const mockCompanyLimits: CompanyLimits = {
        staffCount: 25,
        maxStaff: 50,
        venuesCount: 8,
        maxVenues: 20,
        shiftsPerMonth: 150,
        maxShiftsPerMonth: 500,
        storageUsed: 2.5,
        maxStorage: 10
      };

      setSubscriptionDetails(mockSubscriptionDetails);
      setCompanyLimits(mockCompanyLimits);

    } catch (error) {
      console.error('Failed to load company details:', error);
    }
  }, []);

  // Context value
  const value: CompanyContextValue = {
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
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

// Company selector hook for components that need to work with multiple companies
export function useCompanySelector() {
  const { companyState, switchCompany, canAccessMultipleCompanies } = useCompany();

  return {
    companies: companyState.companies,
    currentCompany: companyState.currentCompany,
    switchCompany,
    canAccessMultipleCompanies: canAccessMultipleCompanies(),
    isLoading: companyState.isLoading
  };
}

// Permission-based hook for conditional rendering
export function useCompanyPermissions(requiredPermissions: CompanyPermission | CompanyPermission[]) {
  const { hasPermission, getUserPermissions, isCompanyOwner } = useCompany();

  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  const hasAllPermissions = permissions.every(permission => hasPermission(permission));
  const hasAnyPermission = permissions.some(permission => hasPermission(permission));

  return {
    hasAllPermissions,
    hasAnyPermission,
    userPermissions: getUserPermissions(),
    isOwner: isCompanyOwner()
  };
}

export default CompanyContext;