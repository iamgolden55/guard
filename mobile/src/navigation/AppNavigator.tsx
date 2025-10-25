/**
 * App Navigator
 * Root navigator that handles authentication state
 * Shows AuthNavigator if not authenticated, MainNavigator if authenticated
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList } from '../types/navigation';

// Navigators
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useAppSelector } from '../hooks/useRedux';
import { selectIsAuthenticated } from '../store/slices/authSlice';

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const { checkAuthStatus } = useAuth();

  // Check if user is already authenticated on app startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const result = await checkAuthStatus();

        // Defensive check - ensure result exists and has required properties
        if (!result || typeof result.success === 'undefined') {
          console.error('[AppNavigator] checkAuthStatus returned invalid result:', result);
          setAuthChecked(true);
          setIsLoading(false);
          return;
        }

        // Log the auth check result - safe to access properties now
        console.log('[AppNavigator] Auth check complete:', {
          success: result.success,
          isAuthenticated: result.isAuthenticated
        });

        // Wait a tick to ensure Redux state is updated before rendering
        // This prevents race condition with redux-persist rehydration
        setTimeout(() => {
          setAuthChecked(true);
          setIsLoading(false);
        }, 0);
      } catch (error) {
        console.error('[AppNavigator] Auth check error:', error);
        setAuthChecked(true);
        setIsLoading(false);
      }
    };

    initAuth();
  }, [checkAuthStatus]);

  // Show loading screen while checking auth status
  if (isLoading || !authChecked) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
  },
});
