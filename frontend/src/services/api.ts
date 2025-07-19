import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';

// Base API configuration  
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Create an Axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add reasonable timeouts to prevent hanging requests
  timeout: 15000, // 15 seconds
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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

    // Check if error is 401 and we haven't already tried refreshing
    if (originalRequest && error.response?.status === 401 && !originalRequest.headers?.['X-Retry']) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          
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

// Get all shifts - Updated to use correct endpoint and handle pagination
export const getShifts = async (params?: any): Promise<Shift[]> => {
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
    // Use the shifts API endpoint instead of the main API
    const shiftsApiUrl = 'http://localhost:8000/api/shifts';
    const response = await axios.get(`${shiftsApiUrl}${queryString}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
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
    const shiftsApiUrl = 'http://localhost:8000/api/shifts';
    const response = await axios.post(`${shiftsApiUrl}/`, shiftData, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error creating shift:', error);
    return null;
  }
};

// Update a shift
export const updateShift = async (id: string, shiftData: Partial<Shift>): Promise<Shift | null> => {
  try {
    const shiftsApiUrl = 'http://localhost:8000/api/shifts';
    const response = await axios.put(`${shiftsApiUrl}/${id}/`, shiftData, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
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
export const deleteShift = async (id: string): Promise<boolean> => {
  try {
    const shiftsApiUrl = 'http://localhost:8000/api/shifts';
    await axios.delete(`${shiftsApiUrl}/${id}/`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    return true;
  } catch (error) {
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
}>, allowPastDates: boolean = false): Promise<Shift[] | null> => {
  try {
    const shiftsApiUrl = 'http://localhost:8000/api/shifts';
    const token = localStorage.getItem('token');
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`Starting bulk creation of ${shifts.length} shifts...`);
    
    for (const shift of shifts) {
      try {
        // If no staff selected, create unassigned shift
        if (!shift.staffIds || shift.staffIds.length === 0) {
          const response = await axios.post(`${shiftsApiUrl}/`, {
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
          }, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          results.push(response.data);
          successCount++;
        } else {
          // Create multi-staff shift using the multi-staff endpoint
          const response = await axios.post(`${shiftsApiUrl}/create_multi_staff/`, {
            venue: parseInt(shift.venueId),
            staff_users: shift.staffIds,
            start_time: shift.startTime,
            end_time: shift.endTime,
            status: 'scheduled',
            required_security_role: 'sg',
            allow_past_dates: allowPastDates,
            hourly_rate: shift.hourlyRate,
            is_special_event: shift.isSpecialEvent || false
          }, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
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
      } catch (shiftError) {
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
    const response = await api.get('/users/me/pending-earnings/');
    return response.data;
  } catch (error) {
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
    const response = await api.get('/users/me/weekly-earnings/');
    return response.data;
  } catch (error) {
    console.error('Error fetching weekly earnings:', error);
    throw error;
  }
};

export default api;
