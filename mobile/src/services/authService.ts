import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api.config';
import notificationService from './notificationService';
import { logger } from '../utils/logger';
import { migrateTokenAccessibility, setToken } from './tokenStorage';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

/**
 * The session could not be checked right now (no signal, timeout, server
 * error, keychain locked) — as opposed to the server rejecting it. The tokens
 * are kept; the caller should retry later rather than sign the user out.
 */
export class SessionUnavailableError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'SessionUnavailableError';
  }
}

/** Only these refresh responses mean the refresh token itself is dead. */
const isRejectedRefresh = (error: any) => {
  const status = error?.response?.status;
  return status === 400 || status === 401;
};

export type RestoredSession =
  | { status: 'signed-in'; user: any; accessToken: string; refreshToken: string }
  | { status: 'signed-out' }
  | { status: 'unavailable'; error: unknown };

const PROFILE_ATTEMPTS = 3;
const PROFILE_RETRY_DELAY_MS = 1500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const response = await axios.post(
        API_ENDPOINTS.AUTH.LOGIN,
        {
          username: credentials.username,
          password: credentials.password,
        },
        // The API can take a while to answer its first request after idling.
        { timeout: 45000 },
      );

      const tokens: AuthTokens = response.data;

      // Store tokens securely
      await this.storeTokens(tokens);

      return tokens;
    } catch (error: any) {
      throw new Error(this.describeLoginError(error));
    }
  }

  /**
   * Every failure used to read "please check your credentials", so a slow
   * network looked like a wrong password and nobody could tell which.
   */
  private describeLoginError(error: any): string {
    const response = error?.response;
    if (!response) {
      if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
        return 'The server took too long to respond. Please check your connection and try again.';
      }
      return "Can't reach Mead Security. Please check your internet connection and try again.";
    }
    const serverMessage = response.data?.detail || response.data?.message;
    switch (response.status) {
      case 400:
      case 401:
        return 'Incorrect email or password. Please try again.';
      case 403:
      case 429:
        return serverMessage || 'Sign-in is temporarily unavailable. Please try again later.';
      default:
        return `Something went wrong signing in (error ${response.status}). Please try again.`;
    }
  }

  /**
   * Request account deletion (soft-delete with 30-day grace period)
   */
  async requestAccountDeletion(
    token: string,
    data: { password?: string; confirmation?: string }
  ): Promise<{ message: string; deletion_date: string }> {
    const response = await axios.post(API_ENDPOINTS.AUTH.DELETE_ACCOUNT, data, {
      headers: getAuthHeaders(token),
      timeout: 10000,
    });
    return response.data;
  }

  /**
   * Store authentication tokens securely
   */
  async storeTokens(tokens: AuthTokens): Promise<void> {
    await setToken('accessToken', tokens.access);
    await setToken('refreshToken', tokens.refresh);
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
   * Refresh access token using refresh token.
   *
   * Returns the new access token, or null when the session is over (no
   * refresh token, or the server rejected it) — the user is signed out then.
   * Throws SessionUnavailableError when the refresh could not be attempted or
   * answered (offline, timeout, 5xx, keychain locked): the tokens are kept.
   * This used to sign the user out on any error, so a phone locked in a pocket
   * or one slow Render response ended the session.
   */
  async refreshAccessToken(): Promise<string | null> {
    let refreshToken: string | null;
    try {
      refreshToken = await this.getRefreshToken();
    } catch (error) {
      throw new SessionUnavailableError('Secure storage is unavailable', error);
    }

    if (!refreshToken) {
      return null;
    }

    let response;
    try {
      response = await axios.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
        refresh: refreshToken,
      });
    } catch (error) {
      if (isRejectedRefresh(error)) {
        // Refresh token is invalid, expired or blacklisted
        await this.logout();
        return null;
      }
      throw new SessionUnavailableError('Could not reach the server to refresh the session', error);
    }

    const newAccessToken = response.data.access;
    try {
      await setToken('accessToken', newAccessToken);

      // Backend rotates refresh tokens (BLACKLIST_AFTER_ROTATION) — persist the
      // new one or the next refresh sends a blacklisted token and force-logs out.
      if (response.data.refresh) {
        await setToken('refreshToken', response.data.refresh);
      }
    } catch (error) {
      logger.warn('[AuthService] Could not persist refreshed tokens:', error);
    }

    return newAccessToken;
  }

  /**
   * Restore the session at launch.
   *
   * 'signed-out' only when there are no tokens or the server rejected them.
   * A launch with no signal, a cold Render start or a locked keychain is
   * 'unavailable': the tokens stay put and the app offers a retry instead of
   * the login screen.
   */
  async restoreSession(): Promise<RestoredSession> {
    let accessToken: string | null;
    let refreshToken: string | null;
    try {
      await migrateTokenAccessibility();
    } catch (error) {
      logger.warn('[AuthService] Token accessibility migration failed:', error);
    }
    try {
      accessToken = await this.getAccessToken();
      refreshToken = await this.getRefreshToken();
    } catch (error) {
      return { status: 'unavailable', error };
    }

    if (!accessToken || !refreshToken) {
      return { status: 'signed-out' };
    }

    try {
      if (this.isTokenExpired(accessToken)) {
        const newAccessToken = await this.refreshAccessToken();
        if (!newAccessToken) return { status: 'signed-out' };
        accessToken = newAccessToken;
      }

      let lastError: unknown;
      for (let attempt = 0; attempt < PROFILE_ATTEMPTS; attempt++) {
        try {
          const user = await this.fetchUserProfile(accessToken);
          // A 401 on the profile may have been refreshed by the axios interceptor.
          return {
            status: 'signed-in',
            user,
            accessToken: (await this.getAccessToken()) ?? accessToken,
            refreshToken: (await this.getRefreshToken()) ?? refreshToken,
          };
        } catch (error: any) {
          if (error?.cause instanceof SessionUnavailableError) throw error.cause;
          if (error?.status === 401) {
            // The axios interceptor already refreshed (or found the refresh
            // token rejected and signed out); a 401 now means the account
            // itself is refused.
            await this.logout();
            return { status: 'signed-out' };
          }
          lastError = error;
          if (attempt < PROFILE_ATTEMPTS - 1) await sleep(PROFILE_RETRY_DELAY_MS * (attempt + 1));
        }
      }
      return { status: 'unavailable', error: lastError };
    } catch (error) {
      if (error instanceof SessionUnavailableError) return { status: 'unavailable', error };
      throw error;
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
   * Logout - clear all stored data and unregister push token
   */
  async logout(): Promise<void> {
    // Unregister push token to prevent notifications being sent to this device
    // This must be done BEFORE clearing tokens (needs auth token for API call)
    try {
      await notificationService.unregisterPushToken();
    } catch (error) {
      // Log but don't prevent logout
      logger.warn('[AuthService] Failed to unregister push token:', error);
    }

    // Tear down any in-flight OAuth WebBrowser session so the next social sign-in
    // starts from a clean slate rather than resuming the previous user's flow.
    try {
      WebBrowser.dismissAuthSession();
    } catch {
      // no-op — safe if no session is open
    }

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
          return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          return Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock';
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
        logger.error('Biometric authentication returned invalid result:', result);
        return false;
      }

      return result.success;
    } catch (error) {
      logger.error('Biometric authentication error:', error);
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
  async fetchUserProfile(token: string, timeout: number = 15000): Promise<any> {
    try {
      const response = await axios.get(
        API_ENDPOINTS.AUTH.PROFILE,
        {
          headers: getAuthHeaders(token),
          // Was 5s: a slow first response after a correct password showed
          // "Login Failed", and at launch it signed the user out.
          timeout,
        }
      );

      const profileData = response.data;
      const normalizedProfile = this.transformProfileResponse(profileData);

      if (normalizedProfile?.staff_profile) {
        logger.debug('[AuthService] Normalized profile to app user shape');
        logger.debug('[AuthService] User ID:', normalizedProfile.id);
        logger.debug('[AuthService] Employment type:', normalizedProfile.staff_profile?.employment_type);
      } else {
        logger.debug('[AuthService] Profile already in User format');
      }

      return normalizedProfile;
    } catch (error) {
      logger.error('[AuthService] Failed to fetch user profile:', error);
      // Keep the status: at launch a 401 ends the session, anything else doesn't.
      throw Object.assign(new Error('Failed to fetch user profile'), {
        status: (error as any)?.response?.status as number | undefined,
        cause: error,
      });
    }
  }

  /**
   * Helper to transform StaffProfile response to User structure
   */
  private transformProfileResponse(profileData: any): any {
    const firstSiaLicense = profileData?.siaLicenses?.[0] || profileData?.sia_licenses?.[0];
    const employmentType =
      (profileData?.employment_type &&
      typeof profileData.employment_type === 'object' &&
      !Array.isArray(profileData.employment_type))
        ? profileData.employment_type
        : (profileData?.employment_type_details &&
          typeof profileData.employment_type_details === 'object' &&
          !Array.isArray(profileData.employment_type_details))
          ? profileData.employment_type_details
          : (profileData?.employmentType &&
            typeof profileData.employmentType === 'object' &&
            !Array.isArray(profileData.employmentType))
            ? profileData.employmentType
            : null;

    if (profileData.user && profileData.user.id) {
      return {
        ...profileData.user,
        staff_profile: {
          id: profileData.id,
          phone_number: profileData.phone_number || '',
          // The admin payload of /profiles/me used to carry only the camelCase key.
          profile_image_url: profileData.profile_image_url || profileData.profileImageUrl || null,
          emergency_contact_name: profileData.emergency_contact_name,
          emergency_contact_phone: profileData.emergency_contact_phone,
          sia_license_number: firstSiaLicense?.license_number || firstSiaLicense?.licenseNumber || '',
          sia_license_expiry: firstSiaLicense?.expiry_date || firstSiaLicense?.expiryDate || '',
          sia_licenses: profileData.siaLicenses || profileData.sia_licenses || [],
          is_approved: profileData.is_approved ?? profileData.isApproved,
          security_roles: profileData.securityRoles || profileData.security_roles || [],
          employment_type: employmentType,
        }
      };
    }

    // PATCH /profiles/me for staff users returns a flat StaffProfile serializer
    // shape. Normalize it back into the User + staff_profile shape the app uses.
    if (profileData && (profileData.phone_number !== undefined || profileData.firstName !== undefined)) {
      return {
        id: profileData.user ?? profileData.id,
        username: profileData.username || '',
        email: profileData.email || '',
        first_name: profileData.firstName || profileData.first_name || '',
        last_name: profileData.lastName || profileData.last_name || '',
        role: profileData.role || 'staff',
        security_roles: profileData.securityRoles || profileData.security_roles || [],
        staff_profile: {
          id: profileData.id,
          phone_number: profileData.phone_number || profileData.phoneNumber || '',
          profile_image_url: profileData.profile_image_url || profileData.profileImageUrl || null,
          emergency_contact_name:
            profileData.emergency_contact_name || profileData.emergencyContact?.name,
          emergency_contact_phone:
            profileData.emergency_contact_phone || profileData.emergencyContact?.phoneNumber,
          sia_license_number:
            firstSiaLicense?.license_number || firstSiaLicense?.licenseNumber || '',
          sia_license_expiry:
            firstSiaLicense?.expiry_date || firstSiaLicense?.expiryDate || '',
          sia_licenses: profileData.siaLicenses || profileData.sia_licenses || [],
          is_approved: profileData.is_approved ?? profileData.isApproved,
          security_roles: profileData.securityRoles || profileData.security_roles || [],
          employment_type: employmentType,
        },
      };
    }

    return profileData;
  }

  /**
   * Upload profile photo
   * 
   * @param token - Authentication token
   * @param photoUri - Local URI of the photo to upload
   * @returns Object containing the uploaded photo URL
   */
  async uploadProfilePhoto(token: string, photoUri: string): Promise<{ url: string }> {
    try {
      logger.debug('[AuthService] Uploading profile photo:', photoUri);

      // Create form data for multipart upload
      const formData = new FormData();
      
      // Get the filename from the URI
      const filename = photoUri.split('/').pop() || 'photo.jpg';
      
      // Determine the mime type from the extension
      const ext = filename.split('.').pop()?.toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';

      // Append the photo file
      formData.append('photo', {
        uri: photoUri,
        name: filename,
        type: mimeType,
      } as any);

      const response = await axios.post(
        `${API_ENDPOINTS.PROFILE.UPLOAD_PHOTO}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000, // 30 seconds for upload
        }
      );

      logger.debug('[AuthService] Profile photo uploaded:', response.data);
      return response.data;
    } catch (error: any) {
      logger.error('[AuthService] Failed to upload profile photo:', error);
      if (error.response?.data) {
        const errorData = error.response.data;
        const message = typeof errorData === 'string'
          ? errorData
          : errorData.error || errorData.detail || 'Failed to upload photo';
        throw new Error(message);
      }
      throw new Error('Failed to upload profile photo');
    }
  }

  /**
   * Update user profile
   * 
   * @param token - Authentication token
   * @param data - Profile data to update (firstName, lastName, email, phone_number)
   * @returns Updated user profile
   */
  async updateProfile(token: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone_number?: string | null;
  }): Promise<any> {
    try {
      logger.debug('[AuthService] Updating profile with data:', data);
      
      await axios.patch(
        API_ENDPOINTS.AUTH.PROFILE,
        data,
        {
          headers: getAuthHeaders(token),
          timeout: 10000,
        }
      );

      // Fetch the canonical profile shape after save so auth state always
      // remains in the User + staff_profile structure used across the app.
      return await this.fetchUserProfile(token);
    } catch (error: any) {
      logger.error('[AuthService] Failed to update profile:', error);
      if (error.response?.data) {
        // Extract error message from response
        const errorData = error.response.data;
        const message = typeof errorData === 'string' 
          ? errorData 
          : errorData.detail || errorData.error || JSON.stringify(errorData);
        throw new Error(message);
      }
      throw new Error('Failed to update profile');
    }
  }
}

export default new AuthService();
