import { registerRootComponent } from 'expo';

// Add global error handler to catch runtime errors
if (typeof ErrorUtils !== 'undefined') {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[Global Error Handler]', {
      error: error?.message || String(error),
      stack: error?.stack,
      isFatal
    });

    // Call original handler
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
