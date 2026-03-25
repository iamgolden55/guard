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
import api from '../services/api';

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
      const response = await api.get('/api/v1/companies/');
      const companiesData = response.data.results || response.data;

      // Map API response to SecurityCompany type
      const companies: SecurityCompany[] = (Array.isArray(companiesData) ? companiesData : [companiesData]).map((c: any) => ({
        id: c.id,
        name: c.name,
        registrationNumber: c.registration_number || '',
        countryCode: c.country_code || 'GB',
        complianceProfileId: c.compliance_profile_id || null,
        staffCapacity: c.staff_capacity || 50,
        subscriptionTier: (c.subscription_tier || 'professional').toUpperCase(),
        industry: c.industry_type || 'Security Services',
        website: c.website || '',
        phone: c.primary_contact_phone || '',
        logoUrl: c.logo_url || '',
        createdAt: c.created_at || '',
        updatedAt: c.updated_at || '',
        onboardingCompleted: c.onboarding_completed ?? true,
        onboardingStep: c.onboarding_step || 5
      }));

      // Build memberships from user's role — the companies endpoint returns
      // companies the user has access to, so we create memberships accordingly
      const memberships: UserCompanyMembership[] = companies.map(c => ({
        id: `${authState.user!.id}-${c.id}`,
        userId: authState.user!.id,
        companyId: c.id,
        role: (authState.user!.role === 'admin' ? 'OWNER' : authState.user!.role.toUpperCase()) as CompanyRole,
        isOwner: authState.user!.role === 'admin',
        permissions: authState.user!.role === 'admin' ? Object.values(CompanyPermission) : [],
        joinedAt: c.createdAt
      }));

      setCompanyState(prev => ({
        ...prev,
        companies,
        userMemberships: memberships,
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
      const response = await api.get('/api/v1/companies/current/');
      const data = response.data.company || response.data;

      setSubscriptionDetails({
        tier: (data.subscription_tier || 'professional').toUpperCase(),
        status: data.subscription_status || 'active',
        currentPeriodStart: data.subscription_start_date || '',
        currentPeriodEnd: data.subscription_end_date || '',
        cancelAtPeriodEnd: false
      });

      setCompanyLimits({
        staffCount: data.current_staff_count || 0,
        maxStaff: data.staff_capacity || 50,
        venuesCount: data.current_venue_count || 0,
        maxVenues: data.venue_capacity || 20,
        shiftsPerMonth: data.current_shifts_month || 0,
        maxShiftsPerMonth: data.max_shifts_per_month || 500,
        storageUsed: data.storage_used || 0,
        maxStorage: data.max_storage || 10
      });

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