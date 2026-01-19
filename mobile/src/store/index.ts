import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

// Import slices
import authReducer from './slices/authSlice';
import shiftsReducer from './slices/shiftsSlice';
import incidentsReducer from './slices/incidentsSlice';
import syncReducer from './slices/syncSlice';
import leaveReducer from './slices/leaveSlice';
import onboardingReducer from './slices/onboardingSlice';

// Import API
import { api } from './api/baseApi';

// Persist configuration
const persistConfig = {
  key: 'root',
  version: 2, // Incremented from 1 to 2 to force data migration
  storage: AsyncStorage,
  whitelist: ['auth', 'shifts', 'incidents', 'sync', 'leave', 'onboarding'], // Only persist these reducers
  migrate: (state: any) => {
    // Migration from version 1 to version 2
    // Fix: Clear corrupted auth data where user.id was set to StaffProfile ID instead of User ID
    if (state && state._persist && state._persist.version === 1) {
      console.log('[Redux Persist] Migrating from version 1 to 2 - clearing corrupted auth data');

      return Promise.resolve({
        ...state,
        auth: {
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          // Preserve biometric setting if it exists
          biometricEnabled: state.auth?.biometricEnabled || false,
          lastSync: null,
        },
        _persist: {
          ...state._persist,
          version: 2,
        }
      });
    }

    // For version 2+, no migration needed
    return Promise.resolve(state);
  }
};

// Combine reducers
const rootReducer = combineReducers({
  auth: authReducer,
  shifts: shiftsReducer,
  incidents: incidentsReducer,
  sync: syncReducer,
  leave: leaveReducer,
  onboarding: onboardingReducer,
  [api.reducerPath]: api.reducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware),
});

// Setup listeners for RTK Query
setupListeners(store.dispatch);

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
