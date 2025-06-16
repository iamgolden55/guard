import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';

// Base API configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create an Axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add reasonable timeouts to prevent hanging requests
  timeout: 15000, // 15 seconds
});

// Debug the API URL
console.log('API URL configured as:', API_URL);

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`API Request to ${config.url}: Added token to request`);
    } else {
      console.warn(`API Request to ${config.url}: No token available`);
    }
    
    // Log outgoing requests for debugging
    console.log('API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      data: config.data,
      timestamp: new Date().toISOString()
    });
    
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
    // Log successful responses
    console.log(`API Response from ${response.config.url}: Status ${response.status}`);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig;
    console.error(`API Error for ${originalRequest?.url}:`, error.response?.status, error.message);

    // Specifically handle JSON parsing errors or empty responses
    if (error.message && (
      error.message.includes('JSON') || 
      error.message.includes('Unexpected end of input') || 
      error.message.includes('empty response')
    )) {
      console.error('JSON parsing error or empty response:', error.message);
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

    // Check if error is 401 and we haven't already tried refreshing
    if (originalRequest && error.response?.status === 401 && !originalRequest.headers?.['X-Retry']) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          console.log('Attempting to refresh token...');
          
          // Try to get a new token with direct axios to avoid interceptors
          const response = await axios.post(`${API_URL}/token/refresh/`, {
            refresh: refreshToken
          });

          // Save the new token
          const newToken = response.data.access;
          console.log('Token refreshed successfully');
          
          localStorage.setItem('token', newToken);

          // Retry the original request with the new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            originalRequest.headers['X-Retry'] = 'true';
          }

          return api(originalRequest);
        } catch (refreshError: any) {
          console.error('Token refresh failed:', refreshError?.response?.data || refreshError);
          
          // If refresh token fails, log out the user
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');

          // Don't redirect immediately if it's an API call during page load
          // This prevents redirect loops on pages that make multiple API calls
          setTimeout(() => {
            // Check if we're still missing tokens (user hasn't logged in again in the meantime)
            if (!localStorage.getItem('token')) {
              console.log('Redirecting to login page due to authentication failure');
              window.location.href = '/login?expired=true';
            }
          }, 500);
          
          return Promise.reject(refreshError);
        }
      } else {
        console.warn('No refresh token available for token refresh');
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
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};

export const updateProfile = async (profileId: number, data: any) => {
  try {
    const response = await api.patch(`/staff-profiles/${profileId}/`, data);
    return response;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Authentication endpoints
export const login = async (username: string, password: string) => {
  try {
    const response = await api.post('/login/', { username, password });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const register = async (userData: any) => {
  try {
    const response = await api.post('/users/', userData);
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

// Shift types
export interface Shift {
  id: string;
  venueId: string;
  venueName: string;
  staffId?: string;
  staffName?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'draft' | 'published' | 'assigned';
}

// Get all shifts
export const getShifts = async (params?: any): Promise<Shift[]> => {
  try {
    // Build query string if params are provided
    let queryString = '';
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
      if (queryParams.toString()) {
        queryString = `?${queryParams.toString()}`;
      }
    }
    
    console.log(`Fetching shifts with query: ${queryString}`);
    const response = await api.get(`/shifts${queryString}`);
    
    // Ensure we got a valid response with data
    if (!response.data) {
      console.warn('Empty data response from shifts endpoint');
      return [];
    }
    
    // Ensure the data is an array
    if (!Array.isArray(response.data)) {
      console.warn('Shift data is not an array:', response.data);
      return [];
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching shifts:', error);
    // Return empty array rather than throwing to avoid breaking UI
    return [];
  }
};

// Get filtered shifts
export const getFilteredShifts = async (venueId?: string, staffId?: string): Promise<Shift[]> => {
  try {
    let url = '/shifts?';
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
  } catch (error) {
    console.error('Error fetching filtered shifts:', error);
    return [];
  }
};

// Create a new shift
export const createShift = async (shiftData: Omit<Shift, 'id'>): Promise<Shift | null> => {
  try {
    const response = await api.post('/shifts', shiftData);
    return response.data;
  } catch (error) {
    console.error('Error creating shift:', error);
    return null;
  }
};

// Update a shift
export const updateShift = async (id: string, shiftData: Partial<Shift>): Promise<Shift | null> => {
  try {
    const response = await api.put(`/shifts/${id}`, shiftData);
    return response.data;
  } catch (error) {
    console.error('Error updating shift:', error);
    return null;
  }
};

// Delete a shift
export const deleteShift = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/shifts/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting shift:', error);
    return false;
  }
};

// Bulk create shifts
export const bulkCreateShifts = async (shifts: Array<{
  venueId: string;
  startTime: string;
  endTime: string;
}>): Promise<Shift[] | null> => {
  try {
    const response = await fetch('/api/shifts/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shifts }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create shifts');
    }

    return response.json();
  } catch (error) {
    console.error('Error creating bulk shifts:', error);
    return null;
  }
};

// Publish shifts
export const publishShifts = async (shiftIds: string[]): Promise<boolean> => {
  try {
    await api.post('/shifts/publish', { shiftIds });
    return true;
  } catch (error) {
    console.error('Error publishing shifts:', error);
    return false;
  }
};

// Assign staff to shift
export const assignStaffToShift = async (shiftId: string, staffId: string): Promise<Shift | null> => {
  try {
    const response = await api.put(`/shifts/${shiftId}/assign`, { staffId });
    return response.data;
  } catch (error) {
    console.error('Error assigning staff to shift:', error);
    return null;
  }
};

export default api;
