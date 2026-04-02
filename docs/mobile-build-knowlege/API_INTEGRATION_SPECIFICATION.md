# Mobile App API Integration Specification

## Table of Contents
1. [API Overview](#api-overview)
2. [Base Configuration](#base-configuration)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Formats](#requestresponse-formats)
6. [Error Handling](#error-handling)
7. [Sync Queue Integration](#sync-queue-integration)
8. [Offline Handling](#offline-handling)
9. [Caching Strategy](#caching-strategy)
10. [Rate Limiting & Throttling](#rate-limiting--throttling)
11. [Testing](#testing)

---

## API Overview

### Base URL
```
Production: https://api.meadsecurity.com/api/v1/
Development: http://localhost:8000/api/v1/
Staging: https://staging-api.meadsecurity.com/api/v1/
```

### API Documentation
- Full OpenAPI spec: `https://api.meadsecurity.com/api/v1/docs/`
- Schema browser: Available in Django admin at `/api/schema/`

### API Version
- Current version: **v1**
- Versioning strategy: URL-based (`/api/v1/`, `/api/v2/` for future versions)

---

## Base Configuration

### Axios Setup

```typescript
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { store } from '@/store';
import { logout, setTokens } from '@/store/slices/authSlice';

class APIClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: any[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1/',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          return this.handleTokenRefresh(originalRequest);
        }

        // Handle network errors
        if (!error.response) {
          console.error('Network error:', error.message);
          return Promise.reject({
            type: 'NETWORK_ERROR',
            message: 'Network connection failed',
            originalError: error,
          });
        }

        return Promise.reject(error);
      }
    );
  }

  private async handleTokenRefresh(originalRequest: AxiosRequestConfig<any>) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(
          `${process.env.EXPO_PUBLIC_API_URL}auth/refresh/`,
          { refresh: refreshToken }
        );

        const { access } = response.data;
        await SecureStore.setItemAsync('access_token', access);

        store.dispatch(setTokens({ access, refresh: refreshToken }));

        this.isRefreshing = false;
        this.onRefreshed();

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return this.client(originalRequest);
      } catch (error) {
        this.isRefreshing = false;
        store.dispatch(logout());
        return Promise.reject(error);
      }
    } else {
      // Queue request while refresh is in progress
      return new Promise((resolve) => {
        this.refreshSubscribers.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(this.client(originalRequest));
        });
      });
    }
  }

  private onRefreshed() {
    this.refreshSubscribers.forEach((callback) => {
      const token = store.getState().auth.tokens?.access;
      callback(token);
    });
    this.refreshSubscribers = [];
  }

  public async get<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.patch<T>(url, data, config);
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }

  public async uploadFile<T>(
    url: string,
    file: { uri: string; name: string; type: string },
    additionalData?: Record<string, any>
  ) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    Object.entries(additionalData || {}).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

export const apiClient = new APIClient();
```

---

## Authentication & Authorization

### Login

**Endpoint**: `POST /auth/login/`

```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    role: 'staff' | 'manager' | 'admin';
    company_id: number;
    profile_photo?: string;
  };
}

export const useLogin = () => {
  const dispatch = useAppDispatch();

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login/', {
        email,
        password,
      });

      const { access, refresh, user } = response.data;

      // Store tokens securely
      await SecureStore.setItemAsync('access_token', access);
      await SecureStore.setItemAsync('refresh_token', refresh);

      // Update Redux state
      dispatch(setUser(user));
      dispatch(setTokens({ access, refresh }));

      return { success: true, user };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  return { login };
};
```

### Token Refresh

**Endpoint**: `POST /auth/refresh/`

```typescript
interface RefreshRequest {
  refresh: string;
}

interface RefreshResponse {
  access: string;
  refresh?: string;
}

// Automatically handled by interceptor
```

### Logout

**Endpoint**: `POST /auth/logout/`

```typescript
interface LogoutRequest {
  refresh?: string;
}

export const useLogout = () => {
  const dispatch = useAppDispatch();

  const logout = async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      
      // Notify backend
      await apiClient.post('/auth/logout/', {
        refresh: refreshToken,
      });

      // Clear local data
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');

      dispatch(logoutAction());
      dispatch(clearSyncQueue());

      return { success: true };
    } catch (error) {
      // Still clear local data even if backend call fails
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      dispatch(logoutAction());

      return { success: true };
    }
  };

  return { logout };
};
```

---

## API Endpoints

### Shifts

#### Get Current Shift
**Endpoint**: `GET /shifts/current/`

```typescript
interface Shift {
  id: number;
  shift_id: number;
  venue: {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    capacity: number;
  };
  start_time: string; // ISO 8601
  end_time?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  check_in_time?: string;
  check_out_time?: string;
  check_in_location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  check_in_photo?: string; // URL
  check_out_photo?: string; // URL
  signature?: string; // URL
  break_duration?: number; // minutes
  break_start_time?: string;
  break_end_time?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const useCurrentShift = () => {
  const { data: shift, isLoading, error } = api.useGetCurrentShiftQuery();

  return { shift, isLoading, error };
};
```

#### Get Shifts (Paginated)
**Endpoint**: `GET /shifts/?status=active&page=1&page_size=20`

```typescript
interface ShiftsListResponse {
  count: number;
  next?: string;
  previous?: string;
  results: Shift[];
}

interface GetShiftsParams {
  status?: string;
  venue_id?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export const useGetShifts = (params?: GetShiftsParams) => {
  const { data, isLoading, error } = api.useGetShiftsQuery(params || {});

  return {
    shifts: data?.results || [],
    count: data?.count || 0,
    hasNextPage: !!data?.next,
    isLoading,
    error,
  };
};
```

#### Check In
**Endpoint**: `POST /shifts/{id}/check-in/`

```typescript
interface CheckInRequest {
  latitude: number;
  longitude: number;
  accuracy: number;
  photo: string; // Base64 or file upload
  signature?: string; // Base64
  notes?: string;
}

interface CheckInResponse extends Shift {
  check_in_time: string;
}

export const useCheckIn = () => {
  const [mutate, { isLoading }] = api.useCheckInShiftMutation();

  const checkIn = async (shiftId: number, data: CheckInRequest) => {
    try {
      const response = await mutate({ shiftId, ...data }).unwrap();
      
      // Update local database
      await syncManager.recordSuccess('check_in', shiftId);

      return { success: true, shift: response };
    } catch (error: any) {
      return {
        success: false,
        error: error.data?.detail || 'Check-in failed',
      };
    }
  };

  return { checkIn, isLoading };
};
```

#### Check Out
**Endpoint**: `POST /shifts/{id}/check-out/`

```typescript
interface CheckOutRequest {
  latitude: number;
  longitude: number;
  accuracy: number;
  photo: string;
  signature?: string;
  notes?: string;
}

interface CheckOutResponse extends Shift {
  check_out_time: string;
  total_hours: number;
}

export const useCheckOut = () => {
  const [mutate, { isLoading }] = api.useCheckOutShiftMutation();

  const checkOut = async (shiftId: number, data: CheckOutRequest) => {
    try {
      const response = await mutate({ shiftId, ...data }).unwrap();
      return { success: true, shift: response };
    } catch (error: any) {
      return { success: false, error: error.data?.detail };
    }
  };

  return { checkOut, isLoading };
};
```

### Incidents

#### Create Incident
**Endpoint**: `POST /incidents/`

```typescript
interface CreateIncidentRequest {
  shift_id: number;
  type: string; // 'assault', 'theft', 'damage', etc.
  severity: 'minor' | 'moderate' | 'critical';
  description: string;
  transcription?: string;
  photos?: string[]; // URLs
  people_involved?: string[];
  police_involved: boolean;
  ambulance_called: boolean;
}

interface Incident extends CreateIncidentRequest {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'closed';
}

export const useCreateIncident = () => {
  const [mutate, { isLoading }] = api.useCreateIncidentMutation();

  const createIncident = async (data: CreateIncidentRequest) => {
    try {
      const response = await mutate(data).unwrap();
      await syncManager.recordSuccess('incident', response.id);
      return { success: true, incident: response };
    } catch (error: any) {
      return { success: false, error: error.data?.detail };
    }
  };

  return { createIncident, isLoading };
};
```

### Shift Checks

#### Get Available Checks
**Endpoint**: `GET /shift-checks/available/?shift_id={id}`

```typescript
interface ShiftCheck {
  id: string;
  shift_id: number;
  check_type: 'fire_exit' | 'capacity' | 'toilet' | 'security_equipment';
  description: string;
  due_time: string; // ISO 8601
  required: boolean;
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
}

export const useAvailableChecks = (shiftId: number) => {
  const { data: checks = [] } = api.useGetAvailableChecksQuery({ shiftId });
  return { checks };
};
```

#### Submit Check
**Endpoint**: `POST /shift-checks/`

```typescript
interface SubmitCheckRequest {
  shift_id: number;
  check_type: string;
  status: 'passed' | 'failed';
  notes?: string;
  photos?: string[];
  metadata?: Record<string, any>;
}

interface SubmitCheckResponse extends ShiftCheck {
  completed_at: string;
}

export const useSubmitCheck = () => {
  const [mutate, { isLoading }] = api.useSubmitCheckMutation();

  const submitCheck = async (data: SubmitCheckRequest) => {
    try {
      const response = await mutate(data).unwrap();
      return { success: true, check: response };
    } catch (error: any) {
      return { success: false, error: error.data?.detail };
    }
  };

  return { submitCheck, isLoading };
};
```

### Media

#### Upload Photo
**Endpoint**: `POST /media/upload/`

```typescript
interface UploadPhotoResponse {
  id: string;
  url: string;
  thumbnail_url: string;
  size: number;
  created_at: string;
}

export const useUploadPhoto = () => {
  const uploadPhoto = async (
    fileUri: string,
    metadata?: { type: 'check_in' | 'incident' | 'check' }
  ) => {
    try {
      const response = await apiClient.uploadFile<UploadPhotoResponse>(
        '/media/upload/',
        {
          uri: fileUri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        },
        metadata
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  return { uploadPhoto };
};
```

### User Profile

#### Get Profile
**Endpoint**: `GET /users/me/`

```typescript
interface UserProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  profile_photo?: string;
  role: 'staff' | 'manager' | 'admin';
  company_id: number;
  sia_license?: {
    number: string;
    expiry_date: string;
    verified: boolean;
  };
  bank_details?: {
    account_name: string;
    account_number: string;
    sort_code: string;
  };
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { data: profile } = api.useGetProfileQuery();
  return { profile };
};
```

#### Update Profile
**Endpoint**: `PATCH /users/me/`

```typescript
interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  profile_photo?: string;
}

export const useUpdateProfile = () => {
  const [mutate] = api.useUpdateProfileMutation();

  const updateProfile = async (data: UpdateProfileRequest) => {
    try {
      const response = await mutate(data).unwrap();
      return { success: true, profile: response };
    } catch (error: any) {
      return { success: false, error: error.data?.detail };
    }
  };

  return { updateProfile };
};
```

---

## Request/Response Formats

### Standard Request Format

```typescript
// Headers
{
  "Authorization": "Bearer {access_token}",
  "Content-Type": "application/json",
  "Accept": "application/json",
  "X-Request-ID": "{uuid}", // For tracing
  "X-Client-Version": "1.0.0",
  "X-Platform": "ios" | "android"
}

// Body (example)
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

### Standard Response Format

```typescript
// Success Response (200, 201)
{
  "id": 123,
  "email": "user@example.com",
  "created_at": "2026-02-13T10:30:00Z",
  "updated_at": "2026-02-13T10:30:00Z",
  // ... other fields
}

// List Response (Paginated)
{
  "count": 250,
  "next": "https://api.example.com/api/v1/shifts/?page=2",
  "previous": null,
  "results": [
    { /* item 1 */ },
    { /* item 2 */ }
  ]
}

// Error Response (4xx, 5xx)
{
  "detail": "Error message",
  "code": "INVALID_REQUEST",
  "status": 400,
  "errors": {
    "email": ["This field is required"],
    "password": ["Password too short"]
  }
}
```

### Field Naming Conventions

Frontend sends camelCase, backend accepts/returns snake_case with camelCase aliases:

```typescript
// Frontend sends
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+447700900000"
}

// Backend stores as
{
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+447700900000"
}

// Backend returns (with aliases)
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+447700900000",
  "first_name": "John", // Also available
  "last_name": "Doe",
  "phone_number": "+447700900000"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Handling |
|------|---------|----------|
| **200** | OK | Success - use response data |
| **201** | Created | Resource created - use response data |
| **204** | No Content | Success - no response body |
| **400** | Bad Request | Validation error - show field errors |
| **401** | Unauthorized | Token expired - trigger refresh |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Data conflict (offline sync issue) |
| **429** | Rate Limited | Too many requests - implement backoff |
| **500** | Server Error | Internal server error - retry |
| **503** | Service Unavailable | Maintenance - inform user |

### Error Handling Pattern

```typescript
export const useErrorHandler = () => {
  const { announceForAccessibility } = useLiveRegion();

  const handleApiError = (error: any) => {
    if (!error.response) {
      // Network error
      return {
        type: 'network',
        message: 'No internet connection',
        userMessage: 'Please check your connection and try again',
        retryable: true,
      };
    }

    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return {
          type: 'validation',
          message: data.detail || 'Invalid request',
          errors: data.errors || {},
          userMessage: 'Please check your input and try again',
          retryable: false,
        };

      case 401:
        return {
          type: 'auth',
          message: 'Token expired',
          userMessage: 'Your session has expired. Please log in again.',
          retryable: true,
        };

      case 403:
        return {
          type: 'permission',
          message: 'Insufficient permissions',
          userMessage: 'You do not have permission to perform this action.',
          retryable: false,
        };

      case 404:
        return {
          type: 'notfound',
          message: 'Resource not found',
          userMessage: 'The requested resource was not found.',
          retryable: false,
        };

      case 429:
        return {
          type: 'ratelimit',
          message: 'Rate limit exceeded',
          userMessage: 'Too many requests. Please wait a moment.',
          retryable: true,
          retryAfter: parseInt(error.response.headers['retry-after'] || '60'),
        };

      case 500:
      case 503:
        return {
          type: 'server',
          message: data.detail || 'Server error',
          userMessage: 'Something went wrong on the server. Please try again later.',
          retryable: true,
        };

      default:
        return {
          type: 'unknown',
          message: data.detail || 'Unknown error',
          userMessage: 'An unexpected error occurred. Please try again.',
          retryable: true,
        };
    }
  };

  const showError = (error: any) => {
    const parsed = handleApiError(error);
    
    // Announce to accessibility users
    announceForAccessibility(parsed.userMessage);

    // Show toast/snackbar
    Toast.show({
      type: parsed.type === 'validation' ? 'error' : 'error',
      text1: 'Error',
      text2: parsed.userMessage,
      duration: 4000,
    });

    return parsed;
  };

  return { handleApiError, showError };
};
```

---

## Sync Queue Integration

### Queuing Failed Requests

```typescript
export const useSyncQueueAPI = () => {
  const syncManager = useSync();

  const executeWithQueue = async <T>(
    request: {
      method: 'POST' | 'PUT' | 'PATCH';
      url: string;
      data: any;
    },
    options?: {
      priority?: number;
      maxRetries?: number;
    }
  ): Promise<{ success: boolean; data?: T; queued?: boolean }> => {
    try {
      let response;

      switch (request.method) {
        case 'POST':
          response = await apiClient.post<T>(request.url, request.data);
          break;
        case 'PUT':
          response = await apiClient.put<T>(request.url, request.data);
          break;
        case 'PATCH':
          response = await apiClient.patch<T>(request.url, request.data);
          break;
      }

      return { success: true, data: response.data };
    } catch (error: any) {
      // If network error and offline, queue for later
      if (!error.response) {
        await syncManager.addToQueue({
          type: 'api_call',
          payload: request,
          priority: options?.priority || 1,
          metadata: {
            maxRetries: options?.maxRetries || 5,
            timestamp: Date.now(),
          },
        });

        return { success: false, queued: true };
      }

      return { success: false };
    }
  };

  return { executeWithQueue };
};
```

---

## Offline Handling

### Offline-First API Pattern

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const useOfflineFirstAPI = <T,>(
  onlineFetch: () => Promise<T>,
  cacheKey: string
) => {
  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        if (isOnline) {
          // Fetch from API and cache
          const result = await onlineF etch();
          setData(result);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
          setError(null);
        } else {
          // Use cached data
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            setData(JSON.parse(cached));
            setError(new Error('Offline - using cached data'));
          } else {
            setError(new Error('No data available offline'));
          }
        }
      } catch (err: any) {
        setError(err);

        // Try to use cached data as fallback
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            setData(JSON.parse(cached));
          }
        } catch {}
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isOnline, cacheKey]);

  return { data, isLoading, error, isOffline: !isOnline };
};
```

---

## Caching Strategy

### RTK Query Caching

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.example.com/api/v1/',
    prepareHeaders: async (headers) => {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Shifts', 'Incidents', 'Checks', 'Profile'],
  endpoints: (builder) => ({
    // Queries (GET) - cached by default
    getCurrentShift: builder.query<Shift, void>({
      query: () => 'shifts/current/',
      keepUnusedDataFor: 300, // 5 minutes
      providesTags: ['Shifts'],
    }),

    getShifts: builder.query<{ results: Shift[]; count: number }, GetShiftsParams>({
      query: (params) => ({
        url: 'shifts/',
        params,
      }),
      keepUnusedDataFor: 60, // 1 minute (list changes frequently)
      providesTags: (result) =>
        result?.results
          ? [
              ...result.results.map(({ id }) => ({ type: 'Shifts' as const, id })),
              'Shifts',
            ]
          : ['Shifts'],
    }),

    // Mutations (POST, PUT, PATCH) - invalidate cache
    checkInShift: builder.mutation<CheckInResponse, CheckInRequest & { shiftId: number }>({
      query: ({ shiftId, ...body }) => ({
        url: `shifts/${shiftId}/check-in/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Shifts'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        // Optimistic update
        const patchResult = dispatch(
          api.util.updateQueryData('getCurrentShift', undefined, (draft) => {
            draft.status = 'active';
            draft.check_in_time = new Date().toISOString();
          })
        );

        try {
          await queryFulfilled;
        } catch {
          // Revert on error
          patchResult.undo();
        }
      },
    }),
  }),
});

export const {
  useGetCurrentShiftQuery,
  useGetShiftsQuery,
  useCheckInShiftMutation,
} = api;
```

---

## Rate Limiting & Throttling

### Client-Side Rate Limiting

```typescript
export class RateLimiter {
  private requestMap: Map<string, number[]> = new Map();
  private readonly window = 60000; // 1 minute
  private readonly maxRequests = 100; // requests per window

  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requestMap.get(key) || [];

    // Remove old requests outside window
    const filtered = requests.filter((time) => now - time < this.window);

    if (filtered.length >= this.maxRequests) {
      return false;
    }

    filtered.push(now);
    this.requestMap.set(key, filtered);

    return true;
  }

  getRetryAfter(key: string): number {
    const requests = this.requestMap.get(key) || [];
    if (requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = requests[0];
    const retryAfter = this.window - (Date.now() - oldestRequest);
    return Math.max(0, Math.ceil(retryAfter / 1000)); // seconds
  }
}

export const rateLimiter = new RateLimiter();

// Middleware to enforce rate limiting
export const rateLimitMiddleware = async (config: AxiosRequestConfig) => {
  const key = config.url || 'default';

  if (!rateLimiter.isAllowed(key)) {
    const retryAfter = rateLimiter.getRetryAfter(key);
    throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
  }

  return config;
};
```

### Exponential Backoff for Retries

```typescript
export const retryWithBackoff = async <T,>(
  request: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 1000
): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await request();
    } catch (error: any) {
      if (attempt === maxRetries - 1) {
        throw error;
      }

      // Only retry on network errors or 5xx errors
      if (
        !error.response ||
        (error.response.status >= 500 && error.response.status < 600)
      ) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
};
```

---

## Testing

### Mock API Server

```typescript
import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const server = setupServer(
  rest.post('/api/v1/auth/login/', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access: 'test_access_token',
        refresh: 'test_refresh_token',
        user: {
          id: 1,
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'staff',
        },
      })
    );
  }),

  rest.get('/api/v1/shifts/current/', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        shift_id: 100,
        start_time: '2026-02-13T09:00:00Z',
        status: 'scheduled',
      })
    );
  })
);
```

### API Integration Tests

```typescript
describe('API Client', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should login successfully', async () => {
    const result = await apiClient.post('/auth/login/', {
      email: 'test@example.com',
      password: 'password',
    });

    expect(result.data.access).toBe('test_access_token');
    expect(result.data.user.email).toBe('test@example.com');
  });

  it('should handle 401 with token refresh', async () => {
    server.use(
      rest.get('/api/v1/shifts/current/', (req, res, ctx) => {
        if (req.headers.get('Authorization').includes('new_token')) {
          return res(ctx.status(200), ctx.json({ id: 1 }));
        }
        return res(ctx.status(401));
      })
    );

    // Request should be retried after token refresh
    const result = await apiClient.get('/shifts/current/');
    expect(result.status).toBe(200);
  });
});
```

---

**Status**: ✅ Complete | **Last Updated**: February 2026
