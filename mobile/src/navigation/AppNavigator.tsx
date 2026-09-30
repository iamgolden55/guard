/**
 * App Navigator
 * Root navigator that handles authentication state
 * Shows AuthNavigator if not authenticated, MainNavigator if authenticated
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

// Navigators
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../hooks/useRedux';
import { logout, selectIsAuthenticated } from '../store/slices/authSlice';
import authService from '../services/authService';
import { syncService } from '../services/syncService';
import { ERROR_MESSAGES } from '../utils/constants';
import { selectHasCompletedOnboarding } from '../store/slices/onboardingSlice';

// Onboarding
import { OnboardingCarousel } from '../screens/onboarding';

// Navigation Ref
import { navigationRef } from './navigationRef';
import { logger } from '../utils/logger';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  // The server couldn't be reached at launch: the session is kept, and we
  // offer a retry rather than sending a signed-in user to the login screen.
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const hasCompletedOnboarding = useAppSelector(selectHasCompletedOnboarding);
  const { checkAuthStatus } = useAuth();
  const dispatch = useAppDispatch();

  // Waiting items belong to the account that made them: when the account
  // changes, the banner counts the new one's and sends what it left waiting.
  useEffect(() => {
    syncService.accountChanged();
  }, [userId, isAuthenticated]);

  // The server refused the refresh token mid-use and the tokens are gone:
  // show the login screen rather than a signed-in app where nothing loads.
  useEffect(
    () =>
      authService.onSessionEnded(() => {
        dispatch(logout());
        Alert.alert('Signed out', ERROR_MESSAGES.SESSION_EXPIRED);
      }),
    [dispatch],
  );

  // Check if user is already authenticated on app startup
  const initAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await checkAuthStatus();

      // Defensive check - ensure result exists and has required properties
      if (!result || typeof result.success === 'undefined') {
        logger.error('[AppNavigator] checkAuthStatus returned invalid result:', result);
        setAuthChecked(true);
        setIsLoading(false);
        return;
      }

      // Log the auth check result - safe to access properties now
      logger.debug('[AppNavigator] Auth check complete:', {
        success: result.success,
        isAuthenticated: result.isAuthenticated
      });

      setSessionUnavailable(!!result.unavailable);

      // Wait a tick to ensure Redux state is updated before rendering
      // This prevents race condition with redux-persist rehydration
      setTimeout(() => {
        setAuthChecked(true);
        setIsLoading(false);
      }, 0);
    } catch (error) {
      logger.error('[AppNavigator] Auth check error:', error);
      setAuthChecked(true);
      setIsLoading(false);
    }
  }, [checkAuthStatus]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Show loading screen while checking auth status
  if (isLoading || !authChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  if (sessionUnavailable && !isAuthenticated) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.unavailableTitle}>Can't reach Mead Security</Text>
        <Text style={styles.unavailableBody}>
          You're still signed in. Check your connection and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={initAuth} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show onboarding first for new users
  if (!hasCompletedOnboarding) {
    return (
      <NavigationContainer ref={navigationRef}>
        <OnboardingCarousel />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 32,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 8,
    textAlign: 'center',
  },
  unavailableBody: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
