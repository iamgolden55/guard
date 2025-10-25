/**
 * API Configuration
 * Centralized location for all API endpoints and configuration
 *
 * To change for production:
 * 1. Update PRODUCTION_API_URL below
 * 2. That's it! All files use this configuration
 */

// ============================================
// API Base URLs - Change these for production
// ============================================

// IMPORTANT: When testing on physical device, use your computer's IP address
// To find your IP: Run `ipconfig getifaddr en0` on Mac or `ipconfig` on Windows
const DEVELOPMENT_API_URL = 'http://172.16.32.165:8000/api/v1/';
const PRODUCTION_API_URL = 'https://api.meadsecurity.com/api/v1/'; // Update this when deploying

// Automatically select based on environment
export const API_BASE_URL = __DEV__ ? DEVELOPMENT_API_URL : PRODUCTION_API_URL;

// ============================================
// API Endpoints
// ============================================

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: `${API_BASE_URL}login/`,
    LOGOUT: `${API_BASE_URL}logout/`,
    REFRESH_TOKEN: `${API_BASE_URL}token/refresh/`,
    PROFILE: `${API_BASE_URL}profiles/me`,
    CHANGE_PASSWORD: `${API_BASE_URL}change-password/`,
  },

  // Shifts
  SHIFTS: {
    LIST: `${API_BASE_URL}shifts/`,
    DETAIL: (id: number) => `${API_BASE_URL}shifts/${id}/`,
    CHECK_IN: (id: number) => `${API_BASE_URL}shifts/${id}/check-in/`,
    CHECK_OUT: (id: number) => `${API_BASE_URL}shifts/${id}/check-out/`,
    START_BREAK: (id: number) => `${API_BASE_URL}shifts/${id}/start-break/`,
    END_BREAK: (id: number) => `${API_BASE_URL}shifts/${id}/end-break/`,
    UPCOMING: `${API_BASE_URL}shifts/upcoming/`,
    ACTIVE: `${API_BASE_URL}shifts/active/`,
    COMPLETED: `${API_BASE_URL}shifts/completed/`,
  },

  // Incidents
  INCIDENTS: {
    LIST: `${API_BASE_URL}incidents/`,
    DETAIL: (id: string) => `${API_BASE_URL}incidents/${id}/`,
    CREATE: `${API_BASE_URL}incidents/`,
    UPDATE: (id: string) => `${API_BASE_URL}incidents/${id}/`,
    DELETE: (id: string) => `${API_BASE_URL}incidents/${id}/`,
    UPLOAD_PHOTO: `${API_BASE_URL}incidents/upload-photo/`,
    UPLOAD_VOICE: `${API_BASE_URL}incidents/upload-voice/`,
  },

  // Venues
  VENUES: {
    LIST: `${API_BASE_URL}venues/`,
    DETAIL: (id: number) => `${API_BASE_URL}venues/${id}/`,
  },

  // Shift Checks
  SHIFT_CHECKS: {
    LIST: `${API_BASE_URL}shift-checks/`,
    CREATE: `${API_BASE_URL}shift-checks/`,
    DETAIL: (id: number) => `${API_BASE_URL}shift-checks/${id}/`,
  },

  // Invoices
  INVOICES: {
    LIST: `${API_BASE_URL}invoices/`,
    DETAIL: (id: number) => `${API_BASE_URL}invoices/${id}/`,
  },

  // Staff Profile
  PROFILE: {
    GET: `${API_BASE_URL}staff/profile/`,
    UPDATE: `${API_BASE_URL}staff/profile/update/`,
    UPLOAD_PHOTO: `${API_BASE_URL}staff/profile/upload-photo/`,
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: `${API_BASE_URL}notifications/`,
    MARK_READ: (id: number) => `${API_BASE_URL}notifications/${id}/mark-read/`,
    MARK_ALL_READ: `${API_BASE_URL}notifications/mark-all-read/`,
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
