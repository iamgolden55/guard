import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';
import * as SecureStore from 'expo-secure-store';

// API Base URL - Update this based on your backend
const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1/'
  : 'https://mead-security-api.onrender.com/api/v1/';

type RefreshTokenResponse = {
  access: string;
  refresh?: string;
};

const isRefreshTokenResponse = (data: unknown): data is RefreshTokenResponse => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const access = (data as { access?: unknown }).access;
  const refresh = (data as { refresh?: unknown }).refresh;
  return typeof access === 'string' && (refresh === undefined || typeof refresh === 'string');
};

// Base query with authentication
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: async (headers, { getState }) => {
    // Get token from secure store
    const token = await SecureStore.getItemAsync('accessToken');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

// Base query with token refresh logic
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQuery(args, api, extraOptions);

  // If we get a 401, try to refresh the token
  if (result.error && result.error.status === 401) {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');

    if (refreshToken) {
      // Try to get a new token
      const refreshResult = await baseQuery(
        {
          url: 'auth/token/refresh/',
          method: 'POST',
          body: { refresh: refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data && isRefreshTokenResponse(refreshResult.data)) {
        // Store the new tokens (refresh token may rotate)
        const { access, refresh } = refreshResult.data;
        await SecureStore.setItemAsync('accessToken', access);
        if (refresh) {
          await SecureStore.setItemAsync('refreshToken', refresh);
        }

        // Retry the original query
        result = await baseQuery(args, api, extraOptions);
      } else {
        // Refresh failed - logout user
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        // Dispatch logout action here
      }
    }
  }

  return result;
};

// Create base API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Shift', 'Incident', 'User', 'Venue', 'ShiftCheck'],
  endpoints: () => ({}),
});
