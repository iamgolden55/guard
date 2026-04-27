import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import type { Shift } from '../types/shift';

// Base API configuration
const API_URL = import.meta.env.VITE_API_URL;

// Refresh lock to prevent race conditions with multiple 401s
let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

// Flag to prevent multiple auth failure handlers from running simultaneously
let isSessionInvalidating = false;

// Create an Axios instance with default config
// Sprint 3: Use relative URLs to leverage Vite proxy in development
const api: AxiosInstance = axios.create({
  baseURL: API_URL || '', // Use VITE_API_URL if set, else relative URLs for Vite proxy
  headers: {
    'Content-Type': 'application/json',
  },
  // Add reasonable timeouts to prevent hanging requests
  timeout: 15000, // 15 seconds
  // Sprint 3: Enable credentials to send httpOnly cookies (XSS protection)
  withCredentials: true,
});

// Sprint 3: Helper function to get CSRF token from cookie
function getCsrfToken(): string | null {
  const name = 'csrftoken';
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1];
  return cookieValue || null;
}

// Request interceptor for adding auth headers
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add CSRF token for non-GET requests (POST, PUT, PATCH, DELETE)
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      const csrfToken = getCsrfToken();
      if (csrfToken && config.headers) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    // HYBRID AUTH: Add Authorization header from localStorage as fallback.
    // Safari and other browsers with ITP block cross-site cookies, so
    // withCredentials alone isn't enough for cross-origin (Vercel→Render).
    // The Authorization header ensures requests are authenticated regardless.
    const accessToken = localStorage.getItem('access_token');
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('API Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig;

    // Specifically handle JSON parsing errors or empty responses
    if (error.message && (
      error.message.includes('JSON') || 
      error.message.includes('Unexpected end of input') || 
      error.message.includes('empty response')
    )) {
      // Create a more helpful error message
      const enhancedError = new Error(
        'The server returned an invalid response. This could be due to authentication issues or server errors.'
      ) as AxiosError;
      enhancedError.isAxiosError = true;
      enhancedError.config = error.config;
      enhancedError.response = error.response;
      enhancedError.request = error.request;
      
      return Promise.reject(enhancedError);
    }

    // Check if session is already being invalidated - prevent multiple handlers
    if (isSessionInvalidating) {
      return Promise.reject(error);
    }

    // HYBRID AUTH: Check if error is 401 and we haven't already tried refreshing
    if (originalRequest && error.response?.status === 401 && !originalRequest.headers?.['X-Retry']) {
      // If already refreshing, wait for the existing refresh to complete
      if (isRefreshing && refreshPromise) {
        try {
          await refreshPromise;
          // Retry the original request — fresh cookies are already set by the refresh response
          if (originalRequest.headers) {
            originalRequest.headers['X-Retry'] = 'true';
          }
          return api(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      }

      // Start the refresh process
      isRefreshing = true;

      refreshPromise = (async () => {
        try {
          // Use API_URL if set (cross-origin), else relative URL (Vercel proxy)
          const refreshUrl = API_URL
            ? `${API_URL}/api/v1/auth/refresh/`
            : '/api/v1/auth/refresh/';

          // Refresh token is in httpOnly cookie — sent automatically via withCredentials
          const response = await axios.post(
            refreshUrl,
            {},
            {
              withCredentials: true,
              headers: {
                'X-CSRFToken': getCsrfToken() || '',
              }
            }
          );

          console.log('Token refreshed successfully');

          // New tokens are set as httpOnly cookies by the backend response.
          // No localStorage storage needed.

          return response;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();

      try {
        const response = await refreshPromise;

        // Retry the original request — fresh cookies are already set by the refresh response
        if (originalRequest.headers) {
          originalRequest.headers['X-Retry'] = 'true';
        }

        return api(originalRequest);
      } catch (refreshError: any) {
        console.error('Token refresh failed:', refreshError?.response?.data || refreshError);

        // Set flag to prevent other handlers from trying
        isSessionInvalidating = true;

        // Clear ALL auth data on refresh failure
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        // Only redirect if not already on the login page (prevents redirect loops)
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?expired=true';
        }

        return Promise.reject(refreshError);
      }
    }

    // For network errors, provide more helpful information
    if (error.message === 'Network Error') {
      console.error('Network error detected. API server may be down or network connectivity issues.');
      
      // Create a more descriptive error
      const enhancedError = new Error(
        'Unable to connect to the server. Please check your internet connection or try again later.'
      ) as AxiosError;
      enhancedError.isAxiosError = true;
      enhancedError.config = error.config;
      enhancedError.response = error.response;
      enhancedError.request = error.request;
      
      return Promise.reject(enhancedError);
    }

    return Promise.reject(error);
  }
);

// Profile endpoints
export const getProfile = async (userId: number | undefined) => {
  if (!userId) throw new Error('User ID is required');
  
  try {
    // First, get the staff profile ID for this user
    const profilesResponse = await api.get(`/staff-profiles/?user=${userId}`);
    
    if (profilesResponse.data && profilesResponse.data.length > 0) {
      const profileId = profilesResponse.data[0].id;
      // Then get the specific profile
      const profileResponse = await api.get(`/staff-profiles/${profileId}/`);
      return profileResponse;
    } else {
      throw new Error('Profile not found');
    }
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};

export const updateProfile = async (profileId: number, data: any) => {
  try {
    const response = await api.patch(`/staff-profiles/${profileId}/`, data);
    return response;
  } catch (error: any) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Authentication endpoints
export const login = async (username: string, password: string) => {
  try {
    const response = await api.post('/login/', { username, password });
    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    throw error;
  }
};

export const register = async (userData: any) => {
  try {
    const response = await api.post('/users/', userData);
    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Re-export Shift type for consumers that import from api.ts
export type { Shift } from '../types/shift';

// Get all shifts - Updated to use correct endpoint and handle pagination
export const getShifts = async (params?: any): Promise<any[]> => {
  try {
    // Build query string if params are provided, but request all records
    let queryString = '?page_size=1000'; // Request large page size to get all shifts
    if (params) {
      const queryParams = new URLSearchParams();
      queryParams.append('page_size', '1000'); // Ensure we get all shifts
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      queryString = `?${queryParams.toString()}`;
    }
    
    console.log(`Fetching shifts with query: ${queryString}`);
    // Use the api instance which has proper auth and interceptors configured
    // In dev: /api/v1/shifts is proxied by Vite to http://localhost:8000/api/v1/shifts
    const response = await api.get(`/api/v1/shifts${queryString}`);
    
    // Ensure we got a valid response with data
    if (!response.data) {
      console.warn('Empty data response from shifts endpoint');
      return [];
    }
    
    // Handle paginated response format
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
      console.log(`Found paginated response, extracting ${response.data.results.length} shifts from total: ${response.data.count}`);
      return Array.isArray(response.data.results) ? response.data.results : [];
    }
    
    // Handle direct array response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    
    console.warn('Unexpected shift data format:', response.data);
    return [];
  } catch (error: any) {
    console.error('Error fetching shifts:', error);
    // Return empty array rather than throwing to avoid breaking UI
    return [];
  }
};

// Get filtered shifts
export const getFilteredShifts = async (venueId?: string, staffId?: string): Promise<any[]> => {
  try {
    let url = '/api/v1/shifts?';
    if (venueId) url += `venueId=${venueId}&`;
    if (staffId) url += `staffId=${staffId}`;
    
    const response = await api.get(url);
    
    // Ensure we got a valid response with data
    if (!response.data) {
      console.warn('Empty data response from filtered shifts endpoint');
      return [];
    }
    
    // Ensure the data is an array
    if (!Array.isArray(response.data)) {
      console.warn('Filtered shift data is not an array:', response.data);
      return [];
    }
    
    return response.data;
  } catch (error: any) {
    console.error('Error fetching filtered shifts:', error);
    return [];
  }
};

// Create a new shift
export const createShift = async (shiftData: Record<string, any>): Promise<Shift | null> => {
  try {
    // Use /api/v1/ prefix to go through Vite proxy to backend
    const response = await api.post(`/api/v1/shifts/`, shiftData);
    return response.data;
  } catch (error: any) {
    console.error('Error creating shift:', error);
    return null;
  }
};

// Update a shift
export const updateShift = async (id: string | number, shiftData: Record<string, any>): Promise<Shift | null> => {
  try {
    // Use /api/v1/ prefix to go through Vite proxy to backend
    const response = await api.put(`/api/v1/shifts/${id}/`, shiftData);
    return response.data;
  } catch (error: any) {
    console.error('Error updating shift:', error);
    // Log the detailed error response for debugging
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    return null;
  }
};

// Delete a shift
export const deleteShift = async (id: string | number): Promise<boolean> => {
  try {
    // Use /api/v1/ prefix to go through Vite proxy to backend
    await api.delete(`/api/v1/shifts/${id}/`);
    return true;
  } catch (error: any) {
    console.error('Error deleting shift:', error);

    // Log detailed error information for debugging
    if (error.response) {
      console.error('Delete error details:');
      console.error('  Status:', error.response.status);
      console.error('  Status Text:', error.response.statusText);
      console.error('  Data:', error.response.data);
    }

    return false;
  }
};

// Bulk create shifts with staff assignment support
export const bulkCreateShifts = async (shifts: Array<{
  venueId: string;
  startTime: string;
  endTime: string;
  staffIds?: number[];
  isSequential?: boolean;
  hourlyRate?: number | null;
  isSpecialEvent?: boolean;
}>, allowPastDates: boolean = false): Promise<any[] | null> => {
  try {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(`Starting bulk creation of ${shifts.length} shifts...`);

    for (const shift of shifts) {
      try {
        // If no staff selected, create unassigned shift
        if (!shift.staffIds || shift.staffIds.length === 0) {
          // Use /api/v1/ prefix to go through Vite proxy to backend
          const response = await api.post(`/api/v1/shifts/`, {
            venue: parseInt(shift.venueId),
            start_time: shift.startTime,
            end_time: shift.endTime,
            status: 'open',
            required_security_role: 'sg',
            allow_past_dates: allowPastDates,
            staff_user: null,
            notes: '',
            hourly_rate: shift.hourlyRate,
            is_special_event: shift.isSpecialEvent || false
          });
          results.push(response.data);
          successCount++;
        } else {
          // Create multi-staff shift using the multi-staff endpoint
          // Use /api/v1/ prefix to go through Vite proxy to backend
          const response = await api.post(`/api/v1/shifts/create_multi_staff/`, {
            venue: parseInt(shift.venueId),
            staff_users: shift.staffIds,
            start_time: shift.startTime,
            end_time: shift.endTime,
            status: 'scheduled',
            required_security_role: 'sg',
            allow_past_dates: allowPastDates,
            hourly_rate: shift.hourlyRate,
            is_special_event: shift.isSpecialEvent || false
          });
          
          // The multi-staff endpoint returns an array of shifts
          if (Array.isArray(response.data)) {
            results.push(...response.data);
            successCount += response.data.length;
          } else {
            results.push(response.data);
            successCount++;
          }
        }
      } catch (shiftError: any) {
        console.error('Error creating individual shift:', shiftError);
        
        // Log detailed error information for debugging
        if (shiftError.response) {
          console.error('Shift creation error details:');
          console.error('  Status:', shiftError.response.status);
          console.error('  Status Text:', shiftError.response.statusText);
          console.error('  Data:', shiftError.response.data);
          console.error('  Headers:', shiftError.response.headers);
          console.error('  Failed shift data:', shift);
          
          // Try to extract specific validation errors
          if (shiftError.response.data && typeof shiftError.response.data === 'object') {
            console.error('  Validation errors:', JSON.stringify(shiftError.response.data, null, 2));
          }
        } else if (shiftError.request) {
          console.error('No response received for shift creation:', shiftError.request);
          console.error('  Failed shift data:', shift);
        } else {
          console.error('Error setting up shift creation request:', shiftError.message);
          console.error('  Failed shift data:', shift);
        }
        
        errorCount++;
        // Continue with other shifts even if one fails
      }
    }
    
    // Log summary of bulk creation operation
    console.log(`Bulk creation completed: ${successCount} successful, ${errorCount} failed out of ${shifts.length} total shifts`);
    
    return results.length > 0 ? results : null;
  } catch (error: any) {
    console.error('Error creating bulk shifts:', error);
    return null;
  }
};

// Publish shifts
export const publishShifts = async (shiftIds: string[]): Promise<boolean> => {
  try {
    await api.post('/api/v1/shifts/publish/', { shiftIds });
    return true;
  } catch (error: any) {
    console.error('Error publishing shifts:', error);
    return false;
  }
};

// Assign staff to shift
export const assignStaffToShift = async (shiftId: string | number, staffId: string | number): Promise<Shift | null> => {
  try {
    const response = await api.put(`/api/v1/shifts/${shiftId}/assign/`, { staffId });
    return response.data;
  } catch (error: any) {
    console.error('Error assigning staff to shift:', error);
    return null;
  }
};

// Pending earnings types
export interface PendingEarnings {
  total_pending: number;
  shift_count: number;
  pending_shifts: Array<{
    shift_id: number;
    venue_name: string;
    start_time: string;
    end_time: string;
    hours_worked: number;
    estimated_payment: number;
  }>;
}

// Fetch pending earnings for staff
export const fetchPendingEarnings = async (): Promise<PendingEarnings> => {
  try {
    const response = await api.get('/api/v1/users/me/pending-earnings/');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching pending earnings:', error);
    throw error;
  }
};

// Weekly earnings types
export interface WeeklyEarnings {
  week_period: {
    start: string;
    end: string;
  };
  approved_earnings: number;
  estimated_total: number;
  next_payment_date: string;
  shift_count: number;
  shifts: Array<{
    shift_id: number;
    venue_name: string;
    start_time: string;
    end_time: string;
    status: string;
    amount: number;
    earning_status: 'confirmed' | 'estimated';
    is_invoiced: boolean;
  }>;
}

// Fetch weekly earnings for staff (includes estimated earnings from scheduled shifts)
export const fetchWeeklyEarnings = async (): Promise<WeeklyEarnings> => {
  try {
    const response = await api.get('/api/v1/users/me/weekly-earnings/');
    return response.data;
  } catch (error: any) {
    console.error('Error fetching weekly earnings:', error);
    throw error;
  }
};

export default api;
