/**
 * API Configuration
 * Centralized location for all API endpoints and configuration
 *
 * To change the backend URL:
 * 1. Update the .env file in the mobile directory
 * 2. That's it! All files use this configuration
 *
 * To find your IP: Run `ipconfig getifaddr en0` on Mac or `ipconfig` on Windows
 */

import Constants from 'expo-constants';
import axios from 'axios';

// ============================================
// API Base URLs - Read from .env file
// ============================================

// Read API base URL from environment configuration (.env file)
const ENV_API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:8000';
const PRODUCTION_API_URL = 'https://mead-security-api.onrender.com'; // Render production API

// Base URL for display/reference purposes (not used in requests)
export const API_BASE_URL = __DEV__ ? ENV_API_BASE_URL : PRODUCTION_API_URL;

// API path prefix (used by apiService)
export const API_PREFIX = '/api/v1';

// Configure axios default baseURL for services that use axios directly
axios.defaults.baseURL = API_BASE_URL;

// ============================================
// API Endpoints (Relative paths - baseUrl is prepended by apiService and axios)
// ============================================

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `${API_PREFIX}/login/`,
    REGISTER: `${API_PREFIX}/users/`,
    LOGOUT: `${API_PREFIX}/logout/`,
    REFRESH_TOKEN: `${API_PREFIX}/token/refresh/`,
    PROFILE: `${API_PREFIX}/profiles/me`,
    CHANGE_PASSWORD: `${API_PREFIX}/change-password/`,
    DELETE_ACCOUNT: `${API_PREFIX}/accounts/delete-account/`,
    // Social authentication
    APPLE: `${API_PREFIX}/auth/apple/`,
    GOOGLE: `${API_PREFIX}/auth/google/`,
  },

  // Shifts
  SHIFTS: {
    LIST: `${API_PREFIX}/shifts/`,
    DETAIL: (id: number) => `${API_PREFIX}/shifts/${id}/`,
    // Use underscore format to match DRF's default action URL naming
    CHECK_IN: (id: number) => `${API_PREFIX}/shifts/${id}/check_in/`,
    CHECK_OUT: (id: number) => `${API_PREFIX}/shifts/${id}/check_out/`,
    START_BREAK: (id: number) => `${API_PREFIX}/shifts/${id}/start_break/`,
    END_BREAK: (id: number) => `${API_PREFIX}/shifts/${id}/end_break/`,
    UPCOMING: `${API_PREFIX}/shifts/upcoming/`,
    ACTIVE: `${API_PREFIX}/shifts/active/`,
    COMPLETED: `${API_PREFIX}/shifts/completed/`,
  },

  // Incidents
  INCIDENTS: {
    LIST: `${API_PREFIX}/incidents/`,
    DETAIL: (id: string) => `${API_PREFIX}/incidents/${id}/`,
    CREATE: `${API_PREFIX}/incidents/`,
    UPDATE: (id: string) => `${API_PREFIX}/incidents/${id}/`,
    DELETE: (id: string) => `${API_PREFIX}/incidents/${id}/`,
    UPLOAD_PHOTO: `${API_PREFIX}/incidents/upload-photo/`,
    UPLOAD_VOICE: `${API_PREFIX}/incidents/upload-voice/`,
  },

  // Venues
  VENUES: {
    LIST: `${API_PREFIX}/venues/`,
    DETAIL: (id: number) => `${API_PREFIX}/venues/${id}/`,
  },

  // Shift Checks
  SHIFT_CHECKS: {
    LIST: `${API_PREFIX}/shift-checks/`,
    CREATE: `${API_PREFIX}/shift-checks/`,
    DETAIL: (id: number) => `${API_PREFIX}/shift-checks/${id}/`,
  },

  // Invoices
  INVOICES: {
    LIST: `${API_PREFIX}/invoices/`,
    DETAIL: (id: number) => `${API_PREFIX}/invoices/${id}/`,
    STATS: `${API_PREFIX}/invoices/stats/`,
  },

  // Staff Profile
  PROFILE: {
    GET: `${API_PREFIX}/staff/profile/`,
    UPDATE: `${API_PREFIX}/staff/profile/update/`,
    UPLOAD_PHOTO: `${API_PREFIX}/staff/profile/upload-photo/`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: `${API_PREFIX}/notifications/`,
    MARK_READ: (id: number) => `${API_PREFIX}/notifications/${id}/mark-read/`,
    MARK_ALL_READ: `${API_PREFIX}/notifications/mark-all-read/`,
  },
};

// ============================================
// API Configuration Settings
// ============================================

export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  MAX_PHOTO_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_VOICE_SIZE: 10 * 1024 * 1024, // 10MB
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// ============================================
// Headers
// ============================================

export const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const getMultipartHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'multipart/form-data',
});

// ============================================
// Helper Functions
// ============================================

/**
 * Build full API URL from path
 */
export const buildApiUrl = (path: string): string => {
  return `${API_BASE_URL}${path}`;
};

/**
 * Check if using development mode
 */
export const isDevelopment = (): boolean => {
  return __DEV__;
};

/**
 * Get current API base URL
 */
export const getCurrentApiUrl = (): string => {
  return API_BASE_URL;
};
