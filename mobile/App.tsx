/**
 * Security Staff Mobile App
 * Root Application Component
 */

// Import global polyfills first
import './globals';

import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

// Redux Store
import { store, persistor } from './src/store';

// Navigation
import { AppNavigator } from './src/navigation/AppNavigator';

// Theme Context
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

// Subscription Context
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';

// Font Loading
import { useFonts } from './src/hooks/useFonts';

// Notification Hook
import { useNotifications } from './src/hooks/useNotifications';

// Sync Service
import { syncService } from './src/services/syncService';

// Logger with Sentry
import { logger } from './src/utils/logger';

// Animated Splash — V2 dark premium (Breathing horizon). The original
// Lottie-based `AnimatedSplash` still lives at src/components/AnimatedSplash
// and can be restored by reverting this import + the <LaunchScreenV2> usage
// below.
import LaunchScreenV2 from './src/screens/launch/LaunchScreenV2';

// Initialize Sentry for error tracking (no-op if SDK not installed or DSN not set)
logger.initSentry(process.env.EXPO_PUBLIC_SENTRY_DSN);

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * Main App Component Wrapper
 * Handles notification initialization and sync cleanup after navigation is ready
 */
function AppContent() {
  const [showSplash, setShowSplash] = React.useState(true);
  const { statusBarStyle, isDark, colors } = useTheme();

  // Initialize notifications
  useNotifications();

  // Clear old failed sync items on app startup
  useEffect(() => {
    const clearOldFailedItems = async () => {
      try {
        console.log('[App] Clearing old failed sync items...');
        await syncService.clearFailedItems();
        console.log('[App] Old failed sync items cleared successfully');
      } catch (error) {
        console.error('[App] Error clearing failed sync items:', error);
      }
    };

    clearOldFailedItems();
  }, []);

  // While the launch animation is showing, keep the root dark so the native
  // Expo splash blends into LaunchScreenV2's canvas without a white flash.
  const rootBg = showSplash ? '#0b0b0e' : colors.background.primary;
  return (
    <View style={{ flex: 1, backgroundColor: rootBg }}>
      <StatusBar style={showSplash ? 'light' : statusBarStyle} />
      <AppNavigator />
      {showSplash && (
        <View
          pointerEvents="box-none"
          style={{ ...StyleSheet.absoluteFillObject, zIndex: 9999 }}
        >
          <LaunchScreenV2
            ctaLabel="Get started"
            onFinish={() => setShowSplash(false)}
          />
        </View>
      )}
    </View>
  );
}

export default function App() {
  const { fontsLoaded, fontError } = useFonts();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      // Hide the native splash screen once fonts are loaded
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Belt-and-braces: GestureHandlerRootView's onLayout can be flaky on
  // Android (Expo Go in particular), leaving the native splash stuck on top.
  // Hide via effect as soon as fonts resolve so the RN tree is visible.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Wait for fonts to load
  if (!fontsLoaded && !fontError) {
    return null;
  }

  // Log font error if any (non-blocking)
  if (fontError) {
    console.warn('[App] Font loading error:', fontError);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider>
            <SubscriptionProvider>
              <AppContent />
            </SubscriptionProvider>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}
