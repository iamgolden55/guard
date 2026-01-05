import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './useRedux';
import {
  setCredentials,
  setUser,
  logout as logoutAction,
  setLoading,
  setBiometricEnabled,
  selectCurrentUser,
  selectIsAuthenticated,
  selectBiometricEnabled,
} from '../store/slices/authSlice';
import authService, { LoginCredentials } from '../services/authService';
import notificationService from '../services/notificationService';
import type { User } from '../store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const biometricEnabled = useAppSelector(selectBiometricEnabled);

  /**
   * Login with username and password
   */
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        dispatch(setLoading(true));

        // Authenticate with backend
        const tokens = await authService.login(credentials);

        // Fetch user profile
        const userProfile = await authService.fetchUserProfile(tokens.access);

        // Update Redux state
        dispatch(
          setCredentials({
            user: userProfile,
            accessToken: tokens.access,
            refreshToken: tokens.refresh,
          })
        );

        // Register push notification token (non-blocking)
        notificationService.registerPushToken().catch((error) => {
          console.log('[useAuth] Push token registration failed (non-critical):', error);
        });

        dispatch(setLoading(false));
        return { success: true, user: userProfile };
      } catch (error: any) {
        dispatch(setLoading(false));
        return { success: false, error: error.message };
      }
    },
    [dispatch]
  );

  /**
   * Login with biometrics (Face ID / Touch ID)
   */
  const loginWithBiometrics = useCallback(async () => {
    try {
      dispatch(setLoading(true));

      // Authenticate with biometrics
      const tokens = await authService.loginWithBiometrics();

      if (!tokens) {
        dispatch(setLoading(false));
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Fetch user profile
      const userProfile = await authService.fetchUserProfile(tokens.access);

      // Update Redux state
      dispatch(
        setCredentials({
          user: userProfile,
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
        })
      );

      // Register push notification token (non-blocking)
      notificationService.registerPushToken().catch((error) => {
        console.log('[useAuth] Push token registration failed (non-critical):', error);
      });

      dispatch(setLoading(false));
      return { success: true, user: userProfile };
    } catch (error: any) {
      dispatch(setLoading(false));
      return { success: false, error: error.message };
    }
  }, [dispatch]);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
      dispatch(logoutAction());
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [dispatch]);

  /**
   * Enable biometric login
   */
  const enableBiometric = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        const success = await authService.enableBiometricLogin(credentials);
        if (success) {
          dispatch(setBiometricEnabled(true));
        }
        return { success };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
    [dispatch]
  );

  /**
   * Disable biometric login
   */
  const disableBiometric = useCallback(async () => {
    try {
      await authService.disableBiometricLogin();
      dispatch(setBiometricEnabled(false));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [dispatch]);

  /**
   * Check if biometric is supported on this device
   */
  const checkBiometricSupport = useCallback(async () => {
    const supported = await authService.isBiometricSupported();
    return supported;
  }, []);

  /**
   * Get biometric types available on device
   */
  const getBiometricTypes = useCallback(async () => {
    const types = await authService.getBiometricTypes();
    return types;
  }, []);

  /**
   * Check if user is authenticated (on app startup)
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      const accessToken = await authService.getAccessToken();
      const refreshToken = await authService.getRefreshToken();

      // If no tokens, logout immediately
      if (!accessToken || !refreshToken) {
        console.log('[useAuth] No tokens found, logging out');
        dispatch(logoutAction());
        return { success: false, isAuthenticated: false, user: null };
      }

      // Check if token is expired before making API call
      if (authService.isTokenExpired(accessToken)) {
        console.log('[useAuth] Token expired, logging out');
        dispatch(logoutAction());
        return { success: false, isAuthenticated: false, user: null };
      }

      // Token exists and is not expired - fetch user profile
      console.log('[useAuth] Fetching user profile with valid token');
      const userProfile = await authService.fetchUserProfile(accessToken);

      // Use setCredentials to properly set authentication state
      dispatch(setCredentials({
        user: userProfile,
        accessToken,
        refreshToken,
      }));

      // Register push notification token (non-blocking)
      notificationService.registerPushToken().catch((error) => {
        console.log('[useAuth] Push token registration failed (non-critical):', error);
      });

      return { success: true, isAuthenticated: true, user: userProfile };
    } catch (error) {
      console.error('[useAuth] checkAuthStatus error:', error);
      // Authentication check failed - clear Redux state
      dispatch(logoutAction());
      return { success: false, isAuthenticated: false, user: null };
    }
  }, [dispatch]);

  /**
   * Refresh user profile
   */
  const refreshProfile = useCallback(async () => {
    try {
      const token = await authService.getAccessToken();
      if (token) {
        const userProfile = await authService.fetchUserProfile(token);
        dispatch(setUser(userProfile));
        return { success: true, user: userProfile };
      }
      return { success: false, error: 'No token found' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [dispatch]);

  return {
    // State
    user,
    isAuthenticated,
    biometricEnabled,

    // Methods
    login,
    loginWithBiometrics,
    logout,
    enableBiometric,
    disableBiometric,
    checkBiometricSupport,
    getBiometricTypes,
    checkAuthStatus,
    refreshProfile,
  };
};
