import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api.config';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface DecodedToken {
  user_id: number;
  username: string;
  email: string;
  role: string;
  exp: number;
}

class AuthService {
  /**
   * Login with username and password
   */
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    try {
      const response = await axios.post(API_ENDPOINTS.AUTH.LOGIN, {
        username: credentials.username,
        password: credentials.password,
      });

      const tokens: AuthTokens = response.data;

      // Store tokens securely
      await this.storeTokens(tokens);

      return tokens;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('Login failed. Please check your credentials.');
    }
  }

  /**
   * Store authentication tokens securely
   */
  async storeTokens(tokens: AuthTokens): Promise<void> {
    await SecureStore.setItemAsync('accessToken', tokens.access);
    await SecureStore.setItemAsync('refreshToken', tokens.refresh);
  }

  /**
   * Get stored access token
   */
  async getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('accessToken');
  }

  /**
   * Get stored refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('refreshToken');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string | null> {
    try {
      const refreshToken = await this.getRefreshToken();

      if (!refreshToken) {
        return null;
      }

      const response = await axios.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
        refresh: refreshToken,
      });

      const newAccessToken = response.data.access;
      await SecureStore.setItemAsync('accessToken', newAccessToken);

      return newAccessToken;
    } catch (error) {
      // Refresh token is invalid or expired
      await this.logout();
      return null;
    }
  }

  /**
   * Decode JWT token to get user info
   */
  decodeToken(token: string): DecodedToken {
    return jwtDecode<DecodedToken>(token);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch {
      return true;
    }
  }

  /**
   * Get current user from token
   */
  async getCurrentUser(): Promise<DecodedToken | null> {
    const token = await this.getAccessToken();

    if (!token || this.isTokenExpired(token)) {
      return null;
    }

    return this.decodeToken(token);
  }

  /**
   * Logout - clear all stored data
   */
  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('biometricEnabled');
  }

  /**
   * Check if device supports biometric authentication
   */
  async isBiometricSupported(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  }

  /**
   * Get available biometric types
   */
  async getBiometricTypes(): Promise<string[]> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const typeNames = types.map(type => {
      switch (type) {
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          return 'Touch ID';
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          return 'Face ID';
        case LocalAuthentication.AuthenticationType.IRIS:
          return 'Iris Recognition';
        default:
          return 'Biometric';
      }
    });
    return typeNames;
  }

  /**
   * Authenticate with biometrics
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your account',
        fallbackLabel: 'Use password instead',
        disableDeviceFallback: false,
      });

      // Defensive check - ensure result exists and has success property
      if (!result || typeof result.success === 'undefined') {
        console.error('Biometric authentication returned invalid result:', result);
        return false;
      }

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }

  /**
   * Enable biometric login
   */
  async enableBiometricLogin(credentials: LoginCredentials): Promise<boolean> {
    // First verify the credentials are correct
    try {
      await this.login(credentials);

      // Store encrypted credentials for biometric login
      await SecureStore.setItemAsync('biometricEnabled', 'true');
      await SecureStore.setItemAsync('biometric_username', credentials.username);
      await SecureStore.setItemAsync('biometric_password', credentials.password);

      return true;
    } catch (error) {
      throw new Error('Failed to enable biometric login. Invalid credentials.');
    }
  }

  /**
   * Disable biometric login
   */
  async disableBiometricLogin(): Promise<void> {
    await SecureStore.deleteItemAsync('biometricEnabled');
    await SecureStore.deleteItemAsync('biometric_username');
    await SecureStore.deleteItemAsync('biometric_password');
  }

  /**
   * Check if biometric login is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    const enabled = await SecureStore.getItemAsync('biometricEnabled');
    return enabled === 'true';
  }

  /**
   * Login with biometrics
   */
  async loginWithBiometrics(): Promise<AuthTokens | null> {
    const isEnabled = await this.isBiometricEnabled();

    if (!isEnabled) {
      throw new Error('Biometric login is not enabled');
    }

    const authenticated = await this.authenticateWithBiometrics();

    if (!authenticated) {
      throw new Error('Biometric authentication failed');
    }

    // Retrieve stored credentials
    const username = await SecureStore.getItemAsync('biometric_username');
    const password = await SecureStore.getItemAsync('biometric_password');

    if (!username || !password) {
      throw new Error('Biometric credentials not found');
    }

    // Login with stored credentials
    return await this.login({ username, password });
  }

  /**
   * Fetch user profile from backend
   *
   * IMPORTANT: The backend returns a StaffProfile object with nested user data:
   * {
   *   id: 5,  // StaffProfile ID
   *   user: {
   *     id: 1,  // User ID (the real user ID we need!)
   *     username: "James44",
   *     ...
   *   },
   *   phone_number: "...",
   *   ...
   * }
   *
   * We need to transform this to use the nested user.id as the primary user ID,
   * not the StaffProfile ID. Otherwise, shift exchanges and other features that
   * compare user IDs will fail.
   */
  async fetchUserProfile(token: string): Promise<any> {
    try {
      const response = await axios.get(
        API_ENDPOINTS.AUTH.PROFILE,
        {
          headers: getAuthHeaders(token),
          timeout: 5000, // 5 second timeout for auth checks
        }
      );

      const profileData = response.data;

      // Check if response is StaffProfile format (has nested user object)
      if (profileData.user && profileData.user.id) {
        console.log('[AuthService] Transforming StaffProfile response to User structure');
        console.log('[AuthService] StaffProfile ID:', profileData.id);
        console.log('[AuthService] User ID:', profileData.user.id);

        // Extract user data and move StaffProfile data to staff_profile property
        const userData = {
          ...profileData.user,
          staff_profile: {
            id: profileData.id,
            phone_number: profileData.phone_number,
            emergency_contact_name: profileData.emergency_contact_name,
            emergency_contact_phone: profileData.emergency_contact_phone,
            sia_license_number: profileData.sia_license_number,
            sia_license_expiry: profileData.sia_license_expiry,
            is_approved: profileData.is_approved,
            security_roles: profileData.security_roles,
          }
        };

        console.log('[AuthService] Transformed user ID:', userData.id);
        return userData;
      }

      // If already in User format (e.g., admin users), return as-is
      console.log('[AuthService] Profile already in User format');
      return profileData;
    } catch (error) {
      console.error('[AuthService] Failed to fetch user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }
}

export default new AuthService();
