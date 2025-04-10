import React, { createContext, useContext, useState, useEffect, type ReactNode, useRef } from 'react';
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
}

// Create context with default values
const initialAuthState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);
  const initializeRef = useRef(true);

  // Load user data from localStorage on mount and validate token
  useEffect(() => {
    // Only run once on component mount
    if (initializeRef.current) {
      initializeRef.current = false;

      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          setAuthState(prev => ({ ...prev, user }));
        } catch (error) {
          console.error('Failed to parse user data:', error);
          // Clear invalid data
          localStorage.removeItem('user');
        }
      }

      // Validate the token by fetching user profile if token exists
      const token = localStorage.getItem('token');
      if (token) {
        const validateToken = async () => {
          setAuthState(prev => ({ ...prev, isLoading: true }));
          try {
            const user = await authService.getUserProfile();
            setAuthState(prev => ({
              ...prev,
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null
            }));
          } catch (error) {
            console.error('Token validation failed:', error);
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
          }
        };

        validateToken();
      }
    }
  }, []); // Empty dependency array as we're using a ref to control execution

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
    isUserRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook for using the auth context
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
