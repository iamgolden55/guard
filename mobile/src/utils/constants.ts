/**
 * App Constants and Configuration
 *
 * Centralized configuration for the Security Staff Mobile App
 */

import Constants from 'expo-constants';

// Environment Detection
const isDevelopment = __DEV__;
const isProduction = !__DEV__;

// API Configuration
export const API_CONFIG = {
  // Backend API Base URL
  BASE_URL: isDevelopment
    ? 'http://localhost:8000/api/v1'
    : 'https://api.meadsecurity.com/api/v1',

  // WebSocket URL (for real-time features)
  WS_URL: isDevelopment
    ? 'ws://localhost:8000/ws'
    : 'wss://api.meadsecurity.com/ws',

  // API Timeout (milliseconds)
  TIMEOUT: 10000,

  // Retry Configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,

  // Expo Push Notifications
  EXPO_PROJECT_ID: Constants.expoConfig?.extra?.eas?.projectId ?? 'your-expo-project-id',
};

// Authentication Configuration
export const AUTH_CONFIG = {
  // JWT Token Keys (SecureStore)
  ACCESS_TOKEN_KEY: 'access_token',
  REFRESH_TOKEN_KEY: 'refresh_token',

  // Token Refresh Threshold (refresh when 5 minutes remaining)
  REFRESH_THRESHOLD: 5 * 60 * 1000,

  // Session Timeout (30 days)
  SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000,
};

// Location Configuration
export const LOCATION_CONFIG = {
  // Maximum distance from venue for check-in (meters)
  MAX_CHECK_IN_DISTANCE: 50,

  // GPS Accuracy Level
  ACCURACY: {
    HIGH: 'high' as const,
    BALANCED: 'balanced' as const,
    LOW: 'low' as const,
  },

  // Location Update Interval (milliseconds)
  UPDATE_INTERVAL: 5000,
};

// Photo Configuration
export const PHOTO_CONFIG = {
  // Maximum photo size (bytes) - 2MB
  MAX_SIZE: 2 * 1024 * 1024,

  // Photo compression quality (0-1)
  QUALITY: 0.8,

  // Photo resize dimensions
  MAX_WIDTH: 1920,
  MAX_HEIGHT: 1920,

  // Thumbnail dimensions
  THUMB_WIDTH: 400,
  THUMB_HEIGHT: 400,

  // Photo format
  FORMAT: 'jpeg' as const,
};

// Sync Configuration
export const SYNC_CONFIG = {
  // Sync queue priorities
  PRIORITY: {
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  },

  // Maximum sync retries
  MAX_RETRIES: 5,

  // Retry delays (milliseconds) - exponential backoff
  RETRY_DELAYS: [1000, 2000, 5000, 10000, 30000],

  // Sync interval when online (milliseconds)
  SYNC_INTERVAL: 30000, // 30 seconds
};

// Notification Configuration
export const NOTIFICATION_CONFIG = {
  // Shift reminder timing
  ADVANCE_REMINDER_HOURS: 3,      // Advance reminder (3 hours before shift)
  SOON_REMINDER_MINUTES: 45,      // Soon reminder (45 minutes before shift)
  IMMINENT_REMINDER_MINUTES: 5,   // Imminent reminder (5 minutes before shift)
  CHECKIN_REMINDER_MINUTES: 4,    // Check-in reminder (4 minutes after shift start)

  // Legacy alias for backwards compatibility
  FINAL_REMINDER_MINUTES: 45,

  // Exchange expiration
  EXCHANGE_EXPIRY_MINUTES: 30, // Exchanges expire 30 minutes before shift

  // Notification channels (Android)
  CHANNELS: {
    SHIFT_REMINDERS: 'shift-reminders',
    INCIDENT_ALERTS: 'incident-alerts',
    SYNC_STATUS: 'sync-status',
  },
};

// UI Configuration
export const UI_CONFIG = {
  // Touch target minimum size (dp)
  MIN_TOUCH_TARGET: 48,

  // Animation duration (milliseconds)
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },

  // Haptic feedback patterns
  HAPTIC: {
    LIGHT: 'light' as const,
    MEDIUM: 'medium' as const,
    HEAVY: 'heavy' as const,
    SUCCESS: 'success' as const,
    WARNING: 'warning' as const,
    ERROR: 'error' as const,
  },
};

// Theme Colors (Liquid Glass UI)
export const COLORS = {
  // Primary Colors (iOS Blue)
  primary: {
    blue: '#007AFF',
    light: '#5AC8FA',
    dark: '#0051D5',
  },

  // Semantic Colors
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',

  // Neutral Colors
  background: {
    light: '#FFFFFF',
    dark: '#000000',
    glass: 'rgba(255, 255, 255, 0.1)',
  },

  text: {
    primary: '#000000',
    secondary: '#8E8E93',
    tertiary: '#C7C7CC',
    inverse: '#FFFFFF',
  },

  border: {
    light: '#C7C7CC',
    dark: '#38383A',
  },

  // System Colors
  separator: 'rgba(60, 60, 67, 0.29)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// Typography
export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'Courier',
  },

  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.8,
  },
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Shadows (Elevation)
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

// Feature Flags
export const FEATURES = {
  // Enable offline mode
  OFFLINE_MODE: true,

  // Enable biometric authentication
  BIOMETRIC_AUTH: true,

  // Enable voice incident reporting
  VOICE_REPORTING: true,

  // Enable push notifications
  PUSH_NOTIFICATIONS: true,

  // Enable analytics
  ANALYTICS: isProduction,

  // Enable debug logging
  DEBUG_LOGGING: isDevelopment,
};

// App Metadata
export const APP_METADATA = {
  name: 'Security Staff Portal',
  version: Constants.expoConfig?.version ?? '1.0.0',
  buildNumber: Constants.expoConfig?.ios?.buildNumber ?? '1',
  bundleId: Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.meadsecurity.staffapp',
};

// Error Messages
export const ERROR_MESSAGES = {
  // Network Errors
  NETWORK_ERROR: 'Unable to connect to server. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  SERVER_ERROR: 'Server error. Please try again later.',

  // Authentication Errors
  AUTH_FAILED: 'Invalid email or password.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',

  // Location Errors
  LOCATION_DENIED: 'Location permission denied. Please enable location services.',
  LOCATION_UNAVAILABLE: 'Unable to determine your location.',
  TOO_FAR_FROM_VENUE: 'You are too far from the venue. Please move closer to check in.',

  // Camera Errors
  CAMERA_DENIED: 'Camera permission denied. Please enable camera access.',
  CAMERA_UNAVAILABLE: 'Camera is not available on this device.',

  // Photo Errors
  PHOTO_TOO_LARGE: 'Photo is too large. Please use a smaller image.',
  PHOTO_UPLOAD_FAILED: 'Failed to upload photo. Please try again.',

  // Sync Errors
  SYNC_FAILED: 'Failed to sync data. Your changes are saved locally and will sync when online.',

  // Generic Errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  CHECK_IN_SUCCESS: 'Successfully checked in to shift.',
  CHECK_OUT_SUCCESS: 'Successfully checked out of shift.',
  INCIDENT_SUBMITTED: 'Incident report submitted successfully.',
  CHECK_COMPLETED: 'Shift check completed successfully.',
  SYNC_SUCCESS: 'All changes synced successfully.',
};

// Validation Rules
export const VALIDATION = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address.',
  },
  password: {
    minLength: 8,
    message: 'Password must be at least 8 characters.',
  },
  phone: {
    pattern: /^\+?[1-9]\d{1,14}$/,
    message: 'Please enter a valid phone number.',
  },
};

// Export all constants as a single object
export default {
  API_CONFIG,
  AUTH_CONFIG,
  LOCATION_CONFIG,
  PHOTO_CONFIG,
  SYNC_CONFIG,
  NOTIFICATION_CONFIG,
  UI_CONFIG,
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FEATURES,
  APP_METADATA,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION,
};
