/**
 * Security Staff Mobile App
 * Root Application Component
 */

// Import global polyfills first
import './globals';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Redux Store
import { store, persistor } from './src/store';

// Navigation
import { AppNavigator } from './src/navigation/AppNavigator';

// Subscription Context
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';

// Notification Hook
import { useNotifications } from './src/hooks/useNotifications';

/**
 * Main App Component Wrapper
 * Handles notification initialization after navigation is ready
 */
function AppContent() {
  // Initialize notifications
  useNotifications();

  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SubscriptionProvider>
            <AppContent />
          </SubscriptionProvider>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}
