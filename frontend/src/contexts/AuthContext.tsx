import React, { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from 'react';
import type { AuthState, User, OnboardingStatus } from '../types';
import { authService } from '../services';
import onboardingService from '../services/onboardingService';

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
  updateOnboardingStatus: (status: Partial<OnboardingStatus>) => void;
  completeOnboarding: (companyId: string) => void;
}

// Create context with default values - WITHOUT localStorage
const initialAuthState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  onboardingLoading: false,
  error: null,
  onboarding: {
    isCompleted: null, // null = not loaded, false = loaded but incomplete
    currentStep: null, // null = not loaded, number = actual step
    completedSteps: [],
    hasCompany: false
  }
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
  const fetchOnboardingStatus = useCallback(async (overrideToken?: string): Promise<OnboardingStatus> => {
    // Get current auth state to avoid stale closure
    const currentToken = overrideToken || localStorage.getItem('token');
    const isAuthenticated = overrideToken ? true : !!currentToken;

    // Set loading state before fetch (only if not using override token which means we're in login flow)
    if (!overrideToken) {
      setAuthState(prev => ({ ...prev, onboardingLoading: true }));
    }

    try {
      // If user is not authenticated, return default status
      if (!isAuthenticated || !currentToken) {
        return {
          isCompleted: false,
          currentStep: 1,
          completedSteps: [],
          hasCompany: false
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
      // Clear loading state (only if not using override token which means we're in login flow)
      if (!overrideToken) {
        setAuthState(prev => ({ ...prev, onboardingLoading: false }));
      }
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

  // Function to complete onboarding
  const completeOnboarding = useCallback((companyId: string) => {
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
  }, []);

  // Function to refresh the user token
  const refreshUserToken = useCallback(async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      console.log('Proactively refreshing token...');
      const newToken = await authService.refreshToken(refreshToken);
      
      // Update auth state with new token
      setAuthState(prev => ({
        ...prev,
        token: newToken,
        isAuthenticated: true,
      }));
      
      return true;
    } catch (error) {
      console.error('Proactive token refresh failed:', error);
      return false;
    }
  }, []);

  // Set up automatic token refresh (every 12 hours)
  useEffect(() => {
    // Clear any existing timers
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // If we're authenticated, set up a new refresh timer
    if (authState.isAuthenticated && authState.token) {
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
  }, [authState.isAuthenticated, authState.token, refreshUserToken]);

  // Initialize auth state from localStorage and validate token in a single effect
  useEffect(() => {
    // Only run initialization once
    if (!initializeRef.current) {
      console.log('DEBUG: Initialization already ran, skipping');
      return;
    }

    console.log('DEBUG: Starting AuthContext initialization');
    // Mark as initialized immediately to prevent re-runs
    initializeRef.current = false;

    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refreshToken');
      const userStr = localStorage.getItem('user');

      console.log('DEBUG: Retrieved from localStorage:', {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
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

      // If no token, set auth state to not authenticated and not loading
      if (!token) {
        console.log('DEBUG: No token found, setting unauthenticated state');
        setAuthState(prev => ({
          ...prev,
          token: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
          onboardingLoading: false
        }));
        return;
      }

      // We have a token, set initial state and start validation
      console.log('DEBUG: Token found, setting loading state and starting validation');
      setAuthState(prev => ({
        ...prev,
        token,
        refreshToken,
        user,
        isAuthenticated: false, // Will be set to true after validation
        isLoading: true, // Loading while we validate
        onboardingLoading: true
      }));

      // Don't validate token if we're currently logging in
      if (isLoggingInRef.current) {
        console.log('DEBUG: Currently logging in, skipping token validation');
        return;
      }

      console.log('DEBUG: Starting token validation for stored token');

      try {
        // Validate the token by fetching user profile
        const validatedUser = await authService.getUserProfile();

        // Fetch onboarding status using the current token
        const onboardingStatus = await fetchOnboardingStatus(token);

        setAuthState(prev => ({
          ...prev,
          user: validatedUser,
          isAuthenticated: true,
          isLoading: false,
          onboardingLoading: false,
          error: null,
          onboarding: onboardingStatus
        }));

        // Mark onboarding as successfully fetched
        onboardingFetchedRef.current = true;
        console.log('DEBUG: Token validation successful');
      } catch (error) {
        console.log('DEBUG: Token validation failed, attempting refresh');

        // Try to refresh the token once before logging out
        const refreshSuccessful = await refreshUserToken();

        if (!refreshSuccessful) {
          console.log('DEBUG: Token refresh failed, clearing auth data');
          // Clear invalid auth data
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');

          setAuthState({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            onboardingLoading: false,
            error: 'Session expired. Please login again.',
            onboarding: {
              isCompleted: null, // null = not loaded
              currentStep: null, // null = not loaded
              completedSteps: [],
              hasCompany: false
            }
          });
        } else {
          console.log('DEBUG: Token refresh successful, validating user again');
          // Token refresh was successful, try to get user profile again
          try {
            const validatedUser = await authService.getUserProfile();

            // Fetch onboarding status with refreshed token
            const onboardingStatus = await fetchOnboardingStatus();

            setAuthState(prev => ({
              ...prev,
              user: validatedUser,
              isAuthenticated: true,
              isLoading: false,
              onboardingLoading: false,
              error: null,
              onboarding: onboardingStatus
            }));

            // Mark onboarding as successfully fetched
            onboardingFetchedRef.current = true;
            console.log('DEBUG: User validation successful after token refresh');
          } catch (secondError) {
            console.error('Profile fetch failed after token refresh:', secondError);
            // Clear all auth data
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');

            setAuthState({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false,
              onboardingLoading: false,
              error: 'Session expired. Please login again.',
              onboarding: {
                isCompleted: null, // null = not loaded
                currentStep: null, // null = not loaded
                completedSteps: [],
                hasCompany: false
              }
            });
          }
        }
      }
    };

    initializeAuth();
  }, [refreshUserToken]); // Only run on mount

  // Login function
  const login = async (username: string, password: string) => {
    isLoggingInRef.current = true; // Prevent token validation useEffect from interfering
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.login({ username, password });

      // Fetch onboarding status for the logged in user using the new token
      const onboardingStatus = await fetchOnboardingStatus(response.access);

      // Set refs earlier and prevent validation effect immediately
      onboardingFetchedRef.current = true; // Prevent validation effect immediately

      // Restructure state setting to avoid token change trigger
      const loginData = {
        user: response.user,
        refreshToken: response.refresh,
        isAuthenticated: true,
        isLoading: false,
        onboardingLoading: false,
        error: null,
        onboarding: onboardingStatus
      };

      // Set state without token first
      setAuthState(prev => ({ ...prev, ...loginData }));

      // Set token separately to avoid triggering effects during critical login flow
      setAuthState(prev => ({ ...prev, token: response.access }));

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

  // Logout function
  const logout = () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    authService.logout();
    setAuthState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      onboardingLoading: false,
      error: null,
      onboarding: {
        isCompleted: null, // null = not loaded
        currentStep: null, // null = not loaded
        completedSteps: [],
        hasCompany: false
      }
    });
  };

  // Role check utility
  const isUserRole = (role: string): boolean => {
    return authState.user?.role.toLowerCase() === role.toLowerCase();
  };

  const value: AuthContextValue = {
    authState,
    login,
    register,
    logout,
    isUserRole,
    refreshUserToken,
    updateOnboardingStatus,
    completeOnboarding
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider, useAuth };
export default useAuth;
