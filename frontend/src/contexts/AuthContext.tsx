import React, { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from 'react';
import type { AuthState, User, OnboardingStatus, CompanyMembership } from '../types';
import { authService } from '../services';
import onboardingService from '../services/onboardingService';
import companyService from '../services/companyService';
import api from '../services/api';

// Define the context value structure
interface AuthContextValue {
  authState: AuthState;
  login: (username: string, password: string) => Promise<void>;
  register: (formData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  isUserRole: (role: string) => boolean;
  refreshUserToken: () => Promise<boolean>;
  refreshUserData: () => void;
  updateOnboardingStatus: (status: Partial<OnboardingStatus>) => void;
  completeOnboarding: (companyId: string) => Promise<void>;
}

// Sprint 3: Create context with default values - Tokens now in httpOnly cookies
const initialAuthState: AuthState = {
  user: null,
  // Sprint 3: Removed token and refreshToken - they're in httpOnly cookies now
  isAuthenticated: false,
  isLoading: true,
  onboardingLoading: false,
  error: null,
  onboarding: {
    isCompleted: null, // null = not loaded, false = loaded but incomplete
    currentStep: null, // null = not loaded, number = actual step
    completedSteps: [],
    hasCompany: false
  },
  currentMembership: null
};

// Create context with undefined as default value
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Custom hook for using the auth context
function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Provider component
function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);
  const initializeRef = useRef(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingInRef = useRef(false);
  const onboardingFetchedRef = useRef(false); // Track if we've already successfully fetched onboarding

  // Function to fetch onboarding status
  // Sprint 3: Removed token parameter - cookies are sent automatically
  const fetchOnboardingStatus = useCallback(async (user?: any): Promise<OnboardingStatus> => {
    // Sprint 3: Authentication is based on cookies, not tokens in state
    const currentUser = user || authState.user;

    // Set loading state before fetch
    setAuthState(prev => ({ ...prev, onboardingLoading: true }));

    try {
      // Sprint 3: If no user, return default status (cookies will be checked by API)
      if (!currentUser) {
        return {
          isCompleted: false,
          currentStep: 1,
          completedSteps: [],
          hasCompany: false
        };
      }

      // Staff users don't need onboarding - they join existing companies
      if (currentUser?.role === 'staff') {
        console.log('AuthContext: Staff user detected, skipping onboarding API call');
        return {
          isCompleted: true,
          currentStep: 5,
          completedSteps: [1, 2, 3, 4, 5],
          hasCompany: true
        };
      }

      // Try to get onboarding status from backend API
      try {
        const apiResponse = await onboardingService.getOnboardingProgress();

        // Use API response directly (OnboardingProgress type)
        const result = {
          isCompleted: apiResponse.isCompleted,
          currentStep: apiResponse.currentStep || 1,
          completedSteps: apiResponse.completedSteps || [],
          companyId: undefined, // OnboardingProgress doesn't have company info
          hasCompany: apiResponse.isCompleted // If onboarding is completed, user has company
        };

        console.log('AuthContext fetchOnboardingStatus result:', {
          raw_isCompleted: apiResponse.isCompleted,
          raw_currentStep: apiResponse.currentStep,
          raw_completedSteps: apiResponse.completedSteps,
          parsed_result: result
        });

        return result;
      } catch (apiError) {
        console.error('API call failed, falling back to localStorage:', apiError);

        // Fallback to localStorage if API call fails
        const savedProgress = onboardingService.getProgress();
        console.log('DEBUG: Using localStorage fallback:', savedProgress);

        const fallbackResult = {
          isCompleted: savedProgress?.isCompleted || false,
          currentStep: savedProgress?.currentStep || 1,
          completedSteps: savedProgress?.completedSteps || [],
          companyId: savedProgress?.companyId,
          hasCompany: !!savedProgress?.companyId
        };

        console.log('DEBUG: Fallback result:', fallbackResult);
        return fallbackResult;
      }
    } catch (error) {
      console.error('Failed to fetch onboarding status:', error);
      return {
        isCompleted: false,
        currentStep: 1,
        completedSteps: [],
        hasCompany: false
      };
    } finally {
      // Clear loading state
      setAuthState(prev => ({ ...prev, onboardingLoading: false }));
    }
  }, []); // No dependencies needed as we access current values directly

  // Function to update onboarding status
  const updateOnboardingStatus = useCallback((status: Partial<OnboardingStatus>) => {
    setAuthState(prev => {
      const updatedOnboarding = {
        ...prev.onboarding,
        ...status
      };

      // Save to localStorage with updated status
      onboardingService.updateProgress(
        updatedOnboarding.currentStep,
        updatedOnboarding.completedSteps
      );

      return {
        ...prev,
        onboarding: updatedOnboarding
      };
    });
  }, []);

  // Sprint 3: Function to fetch current company membership (cookies handle auth)
  const fetchCompanyMembership = useCallback(async (): Promise<CompanyMembership | null> => {
    try {
      // Sprint 3: No need to set Authorization header - cookies are sent automatically
      const response = await companyService.getCurrentCompanyContext();

      // Handle null response (user doesn't have a company yet)
      if (!response || !response.membership) {
        console.log('No company membership found - user may be in onboarding');
        return null;
      }

      return {
        id: response.membership.id,
        role: response.membership.role,
        isOwner: response.membership.is_owner,
        isActive: response.membership.is_active,
        companyId: response.membership.company,
        companyName: response.membership.company_name
      };
    } catch (error) {
      console.log('Failed to fetch company membership (this is expected for new users):', error);
      return null;
    }
  }, []);

  // Function to complete onboarding
  const completeOnboarding = useCallback(async (companyId: string) => {
    console.log('Completing onboarding and refreshing company membership...');

    // Update onboarding state
    setAuthState(prev => ({
      ...prev,
      onboarding: {
        ...prev.onboarding,
        isCompleted: true,
        companyId,
        hasCompany: true
      }
    }));

    // Clear onboarding data from localStorage
    onboardingService.clearProgress();

    // Sprint 3: Fetch the new company membership (cookies handle auth)
    try {
      const companyMembership = await fetchCompanyMembership();
      setAuthState(prev => ({
        ...prev,
        currentMembership: companyMembership,
        onboarding: {
          ...prev.onboarding,
          isCompleted: true,
          companyId,
          hasCompany: true
        }
      }));
      console.log('Company membership refreshed successfully:', companyMembership);
    } catch (error) {
      console.error('Failed to refresh company membership after onboarding:', error);
      // Don't throw - the onboarding is still complete, user can refresh page
    }
  }, [fetchCompanyMembership]);

  // Sprint 3: Function to refresh the user token (cookie-based)
  const refreshUserToken = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Proactively refreshing token via cookies...');
      // Sprint 3: Call cookie-based refresh endpoint (refresh token is in httpOnly cookie)
      await authService.refreshToken();

      // Sprint 3: No need to update state - tokens are in cookies
      // Just return success
      return true;
    } catch (error) {
      console.error('Proactive token refresh failed:', error);
      return false;
    }
  }, []);

  // Sprint 3: Set up automatic token refresh (every 12 hours) - cookie-based
  useEffect(() => {
    // Clear any existing timers
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Sprint 3: If we're authenticated, set up a new refresh timer
    if (authState.isAuthenticated) {
      // Refresh every 12 hours
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      refreshTimerRef.current = setInterval(() => {
        refreshUserToken();
      }, TWELVE_HOURS);
    }

    // Cleanup on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [authState.isAuthenticated, refreshUserToken]);

  // Sprint 3: Initialize auth state from localStorage (only user, cookies handle tokens)
  useEffect(() => {
    // Only run initialization once
    if (!initializeRef.current) {
      console.log('DEBUG: Initialization already ran, skipping');
      return;
    }

    console.log('DEBUG: Starting AuthContext initialization (Sprint 3: Cookie-based)');
    // Mark as initialized immediately to prevent re-runs
    initializeRef.current = false;

    const initializeAuth = async () => {
      // Sprint 3: Only get user from localStorage (tokens are in httpOnly cookies)
      const userStr = localStorage.getItem('user');

      console.log('DEBUG: Retrieved from localStorage:', {
        hasUser: !!userStr
      });

      let user = null;
      if (userStr) {
        try {
          user = JSON.parse(userStr);

          // Make sure firstName and lastName exist and are properly formatted
          if (user) {
            // If we have snake_case fields but no camelCase ones, create the camelCase ones
            if (user.first_name !== undefined && user.firstName === undefined) {
              user.firstName = user.first_name;
            }
            if (user.last_name !== undefined && user.lastName === undefined) {
              user.lastName = user.last_name;
            }

            // Ensure firstName and lastName aren't undefined
            user.firstName = user.firstName || '';
            user.lastName = user.lastName || '';
          }
        } catch (error) {
          console.error('Failed to parse user data:', error);
        }
      }

      // Sprint 3: If no user, set auth state to not authenticated
      if (!user) {
        console.log('DEBUG: No user found, setting unauthenticated state');
        setAuthState(prev => ({
          ...prev,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          onboardingLoading: false
        }));
        return;
      }

      // Sprint 3: We have a user, validate session by calling API (cookies handle auth)
      console.log('DEBUG: User found, setting loading state and validating session');
      setAuthState(prev => ({
        ...prev,
        user,
        isAuthenticated: false, // Will be set to true after validation
        isLoading: true, // Loading while we validate
        onboardingLoading: true
      }));

      // Don't validate if we're currently logging in
      if (isLoggingInRef.current) {
        console.log('DEBUG: Currently logging in, skipping session validation');
        return;
      }

      console.log('DEBUG: Starting session validation (cookie-based)');

      try {
        // Sprint 3: Validate the session by fetching user profile (cookies sent automatically)
        const validatedUser = await authService.getUserProfile();

        // Fetch onboarding status (no token parameter needed)
        const onboardingStatus = await fetchOnboardingStatus(validatedUser);

        // Fetch company membership (no token parameter needed)
        const companyMembership = await fetchCompanyMembership();

        setAuthState(prev => ({
          ...prev,
          user: validatedUser,
          isAuthenticated: true,
          isLoading: false,
          onboardingLoading: false,
          error: null,
          onboarding: onboardingStatus,
          currentMembership: companyMembership
        }));

        // Mark onboarding as successfully fetched
        onboardingFetchedRef.current = true;
        console.log('DEBUG: Session validation successful');
      } catch (error) {
        console.log('DEBUG: Session validation failed');

        // Check if user was already cleared by api.ts interceptor (session invalidated)
        const userStillExists = localStorage.getItem('user');
        if (!userStillExists) {
          console.log('DEBUG: User already cleared by interceptor, skipping recovery');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            onboardingLoading: false,
            error: null,
            onboarding: { isCompleted: null, currentStep: null, completedSteps: [], hasCompany: false },
            currentMembership: null
          });
          return;
        }

        console.log('DEBUG: Attempting token refresh');
        // Sprint 3: Try to refresh the token once before logging out (cookie-based)
        const refreshSuccessful = await refreshUserToken();

        if (!refreshSuccessful) {
          console.log('DEBUG: Token refresh failed, clearing auth data');
          // Sprint 3: Clear user data (tokens are in httpOnly cookies, cleared by backend)
          localStorage.removeItem('user');

          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            onboardingLoading: false,
            error: 'Session expired. Please login again.',
            onboarding: {
              isCompleted: null, // null = not loaded
              currentStep: null, // null = not loaded
              completedSteps: [],
              hasCompany: false
            },
            currentMembership: null
          });
        } else {
          console.log('DEBUG: Token refresh successful, validating user again');
          // Sprint 3: Token refresh was successful, try to get user profile again
          try {
            const validatedUser = await authService.getUserProfile();

            // Fetch onboarding status (no token parameter)
            const onboardingStatus = await fetchOnboardingStatus(validatedUser);

            // Fetch company membership (no token parameter)
            const companyMembership = await fetchCompanyMembership();

            setAuthState(prev => ({
              ...prev,
              user: validatedUser,
              isAuthenticated: true,
              isLoading: false,
              onboardingLoading: false,
              error: null,
              onboarding: onboardingStatus,
              currentMembership: companyMembership
            }));

            // Mark onboarding as successfully fetched
            onboardingFetchedRef.current = true;
            console.log('DEBUG: User validation successful after token refresh');
          } catch (secondError) {
            console.error('Profile fetch failed after token refresh:', secondError);
            // Sprint 3: Clear user data (tokens in httpOnly cookies)
            localStorage.removeItem('user');

            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              onboardingLoading: false,
              error: 'Session expired. Please login again.',
              onboarding: {
                isCompleted: null, // null = not loaded
                currentStep: null, // null = not loaded
                completedSteps: [],
                hasCompany: false
              },
              currentMembership: null
            });
          }
        }
      }
    };

    initializeAuth();
  }, [refreshUserToken, fetchOnboardingStatus, fetchCompanyMembership]); // Only run on mount

  // Sprint 3: Login function (cookie-based authentication)
  const login = async (username: string, password: string) => {
    isLoggingInRef.current = true; // Prevent token validation useEffect from interfering
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Sprint 3: Login returns only user object (tokens are in httpOnly cookies)
      const response = await authService.login({ username, password });

      // Fetch onboarding status for the logged in user (no token parameter needed)
      const onboardingStatus = await fetchOnboardingStatus(response.user);
      // Fetch company membership (no token parameter needed)
      const companyMembership = await fetchCompanyMembership();

      // Set refs earlier and prevent validation effect immediately
      onboardingFetchedRef.current = true; // Prevent validation effect immediately

      // Sprint 3: CRITICAL - Set ALL state in ONE update (no tokens in state)
      setAuthState(prev => ({
        ...prev,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        onboardingLoading: false,
        error: null,
        onboarding: onboardingStatus,
        currentMembership: companyMembership
      }));

      isLoggingInRef.current = false; // Allow token validation useEffect to run again
    } catch (error) {
      console.error('Login failed:', error);
      isLoggingInRef.current = false; // Reset flag on error
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Invalid username or password'
      }));
    }
  };

  // Register function
  const register = async (formData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await authService.register(formData);
      // After successful registration, log the user in
      await login(formData.username, formData.password);
    } catch (error) {
      console.error('Registration failed:', error);
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Registration failed. Please try again.'
      }));
    }
  };

  // Sprint 3: Logout function (clears httpOnly cookies via backend)
  const logout = async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Sprint 3: Call backend to clear httpOnly cookies (now async)
    await authService.logout();

    // Sprint 3: Clear state (no tokens, they're in httpOnly cookies)
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      onboardingLoading: false,
      error: null,
      onboarding: {
        isCompleted: null, // null = not loaded
        currentStep: null, // null = not loaded
        completedSteps: [],
        hasCompany: false
      },
      currentMembership: null
    });
  };

  // Refresh user data from localStorage (useful after profile updates)
  const refreshUserData = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        let user = JSON.parse(userStr);
        // Make sure firstName and lastName exist and are properly formatted
        if (user) {
          // If we have snake_case fields but no camelCase ones, create the camelCase ones
          if (user.first_name !== undefined && user.firstName === undefined) {
            user.firstName = user.first_name;
          }
          if (user.last_name !== undefined && user.lastName === undefined) {
            user.lastName = user.last_name;
          }
          // Ensure firstName and lastName aren't undefined
          user.firstName = user.firstName || '';
          user.lastName = user.lastName || '';
        }

        // Update the auth state with the refreshed user data
        setAuthState(prevState => ({
          ...prevState,
          user: user
        }));
      } catch (error) {
        console.error('Failed to refresh user data from localStorage:', error);
      }
    }
  };

  // Role check utility - checks company membership role, not user role
  const isUserRole = (role: string): boolean => {
    // CRITICAL: Always check if user is loaded
    if (!authState.user) {
      console.warn('isUserRole called but no user loaded');
      return false;
    }

    if (!authState.currentMembership) {
      // Fallback to user role if no company membership (shouldn't happen in normal flow)
      console.warn('isUserRole: No membership found, using user role as fallback', {
        userRole: authState.user.role,
        targetRole: role
      });
      const hasRole = authState.user?.role.toLowerCase() === role.toLowerCase();
      console.log(`isUserRole(${role}): ${hasRole} (using user.role: ${authState.user.role})`);
      return hasRole;
    }

    // Check company membership role
    const membershipRole = authState.currentMembership.role.toLowerCase();
    const targetRole = role.toLowerCase();

    // Map owner role to admin for dashboard purposes
    if (membershipRole === 'owner' && targetRole === 'admin') {
      console.log(`isUserRole(${role}): true (owner mapped to admin)`);
      return true;
    }

    const hasRole = membershipRole === targetRole;
    console.log(`isUserRole(${role}): ${hasRole} (membership.role: ${membershipRole})`);
    return hasRole;
  };

  const value: AuthContextValue = {
    authState,
    login,
    register,
    logout,
    isUserRole,
    refreshUserToken,
    refreshUserData,
    updateOnboardingStatus,
    completeOnboarding
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider, useAuth };
export default useAuth;
