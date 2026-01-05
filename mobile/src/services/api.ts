/**
 * API Service
 * Wrapper around fetch for making API calls
 * Used by syncService for executing queued sync operations
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import authService from './authService';

/**
 * Custom Error Classes for API
 */
export class ApiError extends Error {
  public response?: any;

  constructor(
    public statusCode: number,
    public statusText: string,
    public endpoint: string,
    responseData?: any
  ) {
    // Use response data message if available, otherwise use statusText
    const errorMessage = responseData?.detail ||
                        responseData?.error ||
                        responseData?.message ||
                        (Array.isArray(responseData) ? responseData.join(', ') : null) ||
                        (typeof responseData === 'string' ? responseData : null) ||
                        statusText;

    super(`HTTP ${statusCode}: ${errorMessage}`);
    this.name = 'ApiError';
    this.response = responseData;
  }
}

export class ApiTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// API Base URL - Read from environment configuration (.env file)
// To change the backend URL, update the .env file in the mobile directory
// Find your IP with: ipconfig getifaddr en0 (Mac) or ipconfig (Windows)
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:8000';

class ApiService {
  private baseUrl: string;
  private defaultTimeout = 30000; // 30 seconds

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Get base URL for external use
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get authorization headers with token
   */
  private async getHeaders(): Promise<HeadersInit> {
    const token = await SecureStore.getItemAsync('accessToken');

    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Handle 401 errors by attempting token refresh
   * Returns true if token was refreshed, false otherwise
   */
  private async handleUnauthorized(): Promise<boolean> {
    try {
      const newToken = await authService.refreshAccessToken();
      return newToken !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make GET request
   */
  async get<T = any>(endpoint: string, timeout: number = this.defaultTimeout, retryOnAuth: boolean = true): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try to refresh token and retry
      if (response.status === 401 && retryOnAuth) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          // Retry the request with new token (pass retryOnAuth=false to prevent infinite loop)
          return this.get<T>(endpoint, timeout, false);
        }
      }

      if (!response.ok) {
        // Try to parse error response body
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = response.statusText;
        }
        throw new ApiError(response.status, response.statusText, endpoint, errorData);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
      }

      // Check for network errors (TypeError is thrown by fetch when network fails)
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new NetworkError('No internet connection');
      }

      throw error;
    }
  }

  /**
   * Make POST request
   */
  async post<T = any>(endpoint: string, data?: any, timeout: number = this.defaultTimeout, retryOnAuth: boolean = true): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try to refresh token and retry
      if (response.status === 401 && retryOnAuth) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          return this.post<T>(endpoint, data, timeout, false);
        }
      }

      if (!response.ok) {
        // Try to parse error response body
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // If response isn't JSON, use statusText
          errorData = response.statusText;
        }
        throw new ApiError(response.status, response.statusText, endpoint, errorData);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
      }

      // Check for network errors (TypeError is thrown by fetch when network fails)
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new NetworkError('No internet connection');
      }

      throw error;
    }
  }

  /**
   * Make PUT request
   */
  async put<T = any>(endpoint: string, data?: any, timeout: number = this.defaultTimeout, retryOnAuth: boolean = true): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try to refresh token and retry
      if (response.status === 401 && retryOnAuth) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          return this.put<T>(endpoint, data, timeout, false);
        }
      }

      if (!response.ok) {
        // Try to parse error response body
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = response.statusText;
        }
        throw new ApiError(response.status, response.statusText, endpoint, errorData);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
      }

      // Check for network errors (TypeError is thrown by fetch when network fails)
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new NetworkError('No internet connection');
      }

      throw error;
    }
  }

  /**
   * Make PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, timeout: number = this.defaultTimeout, retryOnAuth: boolean = true): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try to refresh token and retry
      if (response.status === 401 && retryOnAuth) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          return this.patch<T>(endpoint, data, timeout, false);
        }
      }

      if (!response.ok) {
        // Try to parse error response body
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = response.statusText;
        }
        throw new ApiError(response.status, response.statusText, endpoint, errorData);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
      }

      // Check for network errors (TypeError is thrown by fetch when network fails)
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new NetworkError('No internet connection');
      }

      throw error;
    }
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(endpoint: string, timeout: number = this.defaultTimeout, retryOnAuth: boolean = true): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 401 Unauthorized - try to refresh token and retry
      if (response.status === 401 && retryOnAuth) {
        const refreshed = await this.handleUnauthorized();
        if (refreshed) {
          return this.delete<T>(endpoint, timeout, false);
        }
      }

      if (!response.ok) {
        throw new ApiError(response.status, response.statusText, endpoint);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
      }

      // Check for network errors (TypeError is thrown by fetch when network fails)
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new NetworkError('No internet connection');
      }

      throw error;
    }
  }

  /**
   * Upload file with FormData
   */
  async uploadFile<T = any>(endpoint: string, formData: FormData, timeout: number = this.defaultTimeout): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const token = await SecureStore.getItemAsync('accessToken');

      const headers: HeadersInit = {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type for FormData - browser will set it with boundary
      };

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ApiError(response.status, response.statusText, endpoint);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiTimeoutError(`Request timeout after ${timeout}ms`);
      }

      // Check for network errors (TypeError is thrown by fetch when network fails)
      if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
        throw new NetworkError('No internet connection');
      }

      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;
