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
import { logger } from '../utils/logger';

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

        // Fetch user profile. The password was right by now, so one slow
        // response must not turn into "Login Failed": try once more.
        let userProfile;
        try {
          userProfile = await authService.fetchUserProfile(tokens.access, 20000);
        } catch {
          try {
            userProfile = await authService.fetchUserProfile(tokens.access, 20000);
          } catch {
            throw new Error(
              "You're signed in, but your profile didn't load. Please check your connection and try again.",
            );
          }
        }

        // Update Redux state
        dispatch(
          setCredentials({
            user: userProfile,
            accessToken: tokens.access,
            refreshToken: tokens.refresh,
          })
        );

        // Process any pending token deactivations from failed logouts (non-blocking)
        notificationService.processPendingDeactivation().catch((error) => {
          logger.debug('[useAuth] Pending deactivation processing failed (non-critical):', error);
        });

        // Register push notification token (non-blocking)
        notificationService.registerPushToken().catch((error) => {
          logger.debug('[useAuth] Push token registration failed (non-critical):', error);
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

      // Process any pending token deactivations from failed logouts (non-blocking)
      notificationService.processPendingDeactivation().catch((error) => {
        logger.debug('[useAuth] Pending deactivation processing failed (non-critical):', error);
      });

      // Register push notification token (non-blocking)
      notificationService.registerPushToken().catch((error) => {
        logger.debug('[useAuth] Push token registration failed (non-critical):', error);
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
   * Check if user is authenticated (on app startup).
   *
   * Signs the user out only when the session is really over. When the server
   * can't be reached it returns `unavailable: true` and keeps the tokens, so
   * AppNavigator can offer a retry instead of dropping them at the login screen.
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      const session = await authService.restoreSession();

      if (session.status === 'signed-out') {
        logger.debug('[useAuth] No valid session, logging out');
        dispatch(logoutAction());
        return { success: false, isAuthenticated: false, unavailable: false, user: null };
      }

      if (session.status === 'unavailable') {
        logger.warn('[useAuth] Session could not be checked, keeping tokens:', session.error);
        return { success: false, isAuthenticated: false, unavailable: true, user: null };
      }

      dispatch(setCredentials({
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      }));

      // Process any pending token deactivations from failed logouts (non-blocking)
      notificationService.processPendingDeactivation().catch((error) => {
        logger.debug('[useAuth] Pending deactivation processing failed (non-critical):', error);
      });

      // Register push notification token (non-blocking)
      notificationService.registerPushToken().catch((error) => {
        logger.debug('[useAuth] Push token registration failed (non-critical):', error);
      });

      return { success: true, isAuthenticated: true, unavailable: false, user: session.user };
    } catch (error) {
      logger.error('[useAuth] checkAuthStatus error:', error);
      // Unexpected — keep the tokens and let the user retry.
      return { success: false, isAuthenticated: false, unavailable: true, user: null };
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
