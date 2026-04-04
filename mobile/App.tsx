/**
 * Security Staff Mobile App
 * Root Application Component
 */

// Import global polyfills first
import './globals';

import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
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

// Animated Splash
import { AnimatedSplash } from './src/components/AnimatedSplash';

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <StatusBar style={statusBarStyle} />
      <AppNavigator />
      {showSplash && (
        <AnimatedSplash
          onAnimationFinish={() => setShowSplash(false)}
        />
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
