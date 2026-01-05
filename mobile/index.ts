// Debug logging
console.log('[index.ts] Starting app initialization...');

try {
  const { registerRootComponent } = require('expo');
  console.log('[index.ts] expo imported successfully');

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
    console.log('[index.ts] Error handler set up');
  }

  const App = require('./App').default;
  console.log('[index.ts] App imported successfully');

  // registerRootComponent calls AppRegistry.registerComponent('main', () => App);
  // It also ensures that whether you load the app in Expo Go or in a native build,
  // the environment is set up appropriately
  registerRootComponent(App);
  console.log('[index.ts] App registered successfully');
} catch (error) {
  console.error('[index.ts] Fatal error during initialization:', error);
  throw error;
}
