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
import * as SecureStore from 'expo-secure-store';

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
// Global axios interceptors — auto-attach token + refresh on 401
// ============================================
// Without these, any direct axios.* call (TeamScreen, profile updates,
// social login, etc.) bypasses token refresh and silently 401s after the
// 30-min access token expires. The interceptors unify all direct-axios
// callers under the same auto-refresh that apiService already does.

// Endpoints that must NOT trigger a refresh-on-401 retry. /token/refresh/ would
// loop forever; /login/ and the social-auth exchanges return 401 on bad creds,
// not on expired tokens, so refreshing is pointless. Registration (/users/ POST)
// is intentionally NOT listed — that path also matches /users/team-members/ etc.
// which legitimately need the Authorization header. A logged-out registrant has
// no token in SecureStore, so injection is a harmless no-op there.
const NO_REFRESH_PATHS = [
  '/token/refresh/',
  '/login/',
  '/auth/apple/',
  '/auth/google/',
];
const matchesNoRefresh = (url?: string): boolean =>
  !!url && NO_REFRESH_PATHS.some((p) => url.includes(p));

// Request interceptor: inject the freshest token from SecureStore on every
// request. Overrides any caller-set Authorization (e.g. screens passing a
// stale token from Redux state) so SecureStore is the single source of truth.
axios.interceptors.request.use(async (config) => {
  if (matchesNoRefresh(config.url)) return config;
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh — concurrent 401s share one in-flight refresh so
// we never double-rotate (which would blacklist the just-issued token).
let refreshPromise: Promise<string | null> | null = null;

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      !original ||
      original._retry ||
      error.response?.status !== 401 ||
      matchesNoRefresh(original.url)
    ) {
      return Promise.reject(error);
    }
    original._retry = true;

    // Lazy-import authService to break the api.config.ts ↔ authService.ts cycle.
    const authService = (await import('../services/authService')).default;

    if (!refreshPromise) {
      refreshPromise = authService.refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;
    if (!newToken) return Promise.reject(error);

    original.headers = original.headers ?? {};
    (original.headers as any).Authorization = `Bearer ${newToken}`;
    return axios(original);
  },
);

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

  // Team
  TEAM: {
    MEMBERS: `${API_PREFIX}/users/team-members/`,
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
