import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import authService from '../../services/authService';

export type EmploymentCategory = 'permanent' | 'contractor' | 'temporary';

export interface EmploymentType {
  id: number;
  name: string;
  description?: string;
  employment_category: EmploymentCategory;
  is_active: boolean;
}

export interface StaffProfile {
  id: number;
  phone_number: string;
  profile_image_url?: string | null;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  sia_license_number?: string;
  sia_license_expiry?: string;
  sia_licenses?: Array<{
    id: number;
    license_number: string;
    license_type: string;
    expiry_date: string;
    is_valid?: boolean;
  }>;
  is_approved?: boolean;
  security_roles?: string[];
  employment_type?: EmploymentType;
}

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'staff' | 'manager' | 'admin';
  security_roles?: string[];
  staff_profile?: StaffProfile;
}

// Async thunk for fetching user profile
export const fetchUserProfile = createAsyncThunk<
  User,
  void,
  { state: RootState; rejectValue: string }
>(
  'auth/fetchUserProfile',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const token = state.auth.accessToken;
      
      if (!token) {
        return rejectWithValue('No access token available');
      }

      const user = await authService.fetchUserProfile(token);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch profile');
    }
  }
);

// Async thunk for updating profile
export const updateProfile = createAsyncThunk<
  User,
  { firstName?: string; lastName?: string; email?: string; phone_number?: string },
  { state: RootState; rejectValue: string }
>(
  'auth/updateProfile',
  async (data, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const token = state.auth.accessToken;
      
      if (!token) {
        return rejectWithValue('No access token available');
      }

      const updatedUser = await authService.updateProfile(token, data);
      return updatedUser;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update profile');
    }
  }
);

// Async thunk for requesting account deletion
export const deleteAccount = createAsyncThunk<
  { message: string; deletion_date: string },
  { password?: string; confirmation?: string },
  { state: RootState; rejectValue: string }
>(
  'auth/deleteAccount',
  async (data, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const token = state.auth.accessToken;

      if (!token) {
        return rejectWithValue('No access token available');
      }

      return await authService.requestAccountDeletion(token, data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.detail || error.message || 'Failed to delete account'
      );
    }
  }
);

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  lastSync: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  biometricEnabled: false,
  lastSync: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: User;
        accessToken: string;
        refreshToken: string;
      }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    updateTokens: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken?: string }>
    ) => {
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },
    setLastSync: (state, action: PayloadAction<string>) => {
      state.lastSync = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user profile
      .addCase(fetchUserProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isLoading = false;
      })
      .addCase(fetchUserProfile.rejected, (state) => {
        state.isLoading = false;
      })
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isLoading = false;
      })
      .addCase(updateProfile.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const {
  setCredentials,
  setUser,
  updateTokens,
  logout,
  setLoading,
  setBiometricEnabled,
  setLastSync,
} = authSlice.actions;

// Selectors
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) =>
  state.auth.isAuthenticated;
export const selectAccessToken = (state: RootState) => state.auth.accessToken;
export const selectBiometricEnabled = (state: RootState) =>
  state.auth.biometricEnabled;

export default authSlice.reducer;
