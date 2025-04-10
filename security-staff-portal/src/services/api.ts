import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';

// Base API configuration
const API_URL = 'https://api.securitystaff.example.com'; // This would be replaced with the actual API URL

// Create an Axios instance with default config
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

    // Check if error is 401 and we haven't already tried refreshing
    if (originalRequest && error.response?.status === 401 && !originalRequest.headers?.['X-Retry']) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          // Try to get a new token
          const response = await axios.post(`${API_URL}/accounts/refresh/`, {
            refresh: refreshToken
          });

          // Save the new token
          localStorage.setItem('token', response.data.access);

          // Retry the original request with the new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
            originalRequest.headers['X-Retry'] = 'true';
          }

          return api(originalRequest);
        } catch (refreshError) {
          // If refresh token fails, log out the user
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');

          // Redirect to login page
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
