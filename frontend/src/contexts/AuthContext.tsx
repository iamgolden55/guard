import React, { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from 'react';
import type { AuthState, User } from '../types';
import { authService } from '../services';

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
}

// Create context with default values - WITHOUT localStorage
const initialAuthState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
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

  // Initialize auth state from localStorage
  useEffect(() => {
    console.log('AuthContext - Initializing from localStorage');
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');
    
    let user = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
        console.log('Loaded user from localStorage:', user.username);
        
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
    
    const isAuthenticated = !!token;
    console.log('Initial auth state:', { 
      token: token ? 'exists' : 'missing',
      refreshToken: refreshToken ? 'exists' : 'missing',
      user: user ? user.username : 'missing',
      isAuthenticated
    });
    
    // Set initial state from localStorage
    setAuthState(prev => ({
      ...prev,
      token,
      refreshToken,
      user,
      isAuthenticated,
      isLoading: isAuthenticated // Only loading if we have a token to validate
    }));
  }, []);

  // Load user data from localStorage on mount and validate token
  useEffect(() => {
    // Only run when we have a token and are not already initialized
    if (authState.token && initializeRef.current) {
      console.log('Validating token...');
      initializeRef.current = false;

      // Validate the token by fetching user profile
      const validateToken = async () => {
        try {
          console.log('Fetching user profile to validate token...');
          const user = await authService.getUserProfile();
          console.log('Token validation successful, user:', user.username);
          
          setAuthState(prev => ({
            ...prev,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null
          }));
        } catch (error) {
          console.error('Token validation failed:', error);
          // Try to refresh the token once before logging out
          const refreshSuccessful = await refreshUserToken();
          
          if (!refreshSuccessful) {
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
              error: 'Session expired. Please login again.'
            });
          } else {
            // Token refresh was successful, try to get user profile again
            try {
              const user = await authService.getUserProfile();
              setAuthState(prev => ({
                ...prev,
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null
              }));
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
                error: 'Session expired. Please login again.'
              });
            }
          }
        }
      };

      validateToken();
    } else if (!authState.token) {
      // If no token, we're not loading
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, [authState.token, refreshUserToken]); // Depend on token so this effect runs when token changes

  // Login function
  const login = async (username: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await authService.login({ username, password });

      setAuthState({
        user: response.user,
        token: response.access,
        refreshToken: response.refresh,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Login failed:', error);
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
      error: null
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
    refreshUserToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthProvider, useAuth };
export default useAuth;
