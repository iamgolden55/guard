/**
 * Social Authentication Service
 * Handles Apple Sign-In and Google Sign-In OAuth flows
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import axios from 'axios';
import { API_ENDPOINTS, API_BASE_URL } from '../config/api.config';

// Required for Google auth session to complete
WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  success: boolean;
  tokens?: {
    access: string;
    refresh: string;
  };
  user?: any;
  error?: string;
}

export interface AppleCredentials {
  identityToken: string;
  authorizationCode: string;
  user: string;
  email?: string | null;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  } | null;
}

export interface GoogleCredentials {
  idToken: string;
  accessToken: string;
  email?: string;
  name?: string;
  picture?: string;
}

class SocialAuthService {
  // Google OAuth client IDs - these should be configured in app.json/app.config.js
  private googleConfig = {
    // These will be loaded from expo config
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };

  /**
   * Check if Apple Sign-In is available on this device
   */
  async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }
    return await AppleAuthentication.isAvailableAsync();
  }

  /**
   * Perform Apple Sign-In
   */
  async signInWithApple(): Promise<SocialAuthResult> {
    try {
      // Check availability
      const isAvailable = await this.isAppleSignInAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Apple Sign-In is not available on this device',
        };
      }

      // Generate a secure nonce for the request
      const nonce = await this.generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      // Request Apple credentials
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        return {
          success: false,
          error: 'Apple Sign-In failed: No identity token received',
        };
      }

      // Prepare credentials to send to backend
      const appleCredentials: AppleCredentials = {
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode || '',
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
      };

      // Exchange Apple credentials for app tokens via backend
      const result = await this.exchangeAppleToken(appleCredentials, nonce);
      return result;
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return {
          success: false,
          error: 'Sign in was cancelled',
        };
      }
      console.error('[SocialAuth] Apple Sign-In error:', error);
      return {
        success: false,
        error: error.message || 'Apple Sign-In failed',
      };
    }
  }

  /**
   * Exchange Apple identity token with backend for app JWT tokens
   */
  private async exchangeAppleToken(
    credentials: AppleCredentials,
    nonce: string
  ): Promise<SocialAuthResult> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.APPLE}`,
        {
          identity_token: credentials.identityToken,
          authorization_code: credentials.authorizationCode,
          user_id: credentials.user,
          email: credentials.email,
          first_name: credentials.fullName?.givenName,
          last_name: credentials.fullName?.familyName,
          nonce: nonce,
        },
        {
          timeout: 30000,
        }
      );

      return {
        success: true,
        tokens: {
          access: response.data.access,
          refresh: response.data.refresh,
        },
        user: response.data.user,
      };
    } catch (error: any) {
      console.error('[SocialAuth] Apple token exchange error:', error);
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        'Failed to authenticate with Apple';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get Google auth request hook configuration
   * This should be called at component level using the hook
   */
  getGoogleAuthConfig() {
    return {
      expoClientId: this.googleConfig.expoClientId,
      iosClientId: this.googleConfig.iosClientId,
      androidClientId: this.googleConfig.androidClientId,
      webClientId: this.googleConfig.webClientId,
      scopes: ['profile', 'email'],
    };
  }

  /**
   * Exchange Google credentials with backend for app JWT tokens
   */
  async exchangeGoogleToken(
    idToken: string,
    accessToken: string
  ): Promise<SocialAuthResult> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.AUTH.GOOGLE}`,
        {
          id_token: idToken,
          access_token: accessToken,
        },
        {
          timeout: 30000,
        }
      );

      return {
        success: true,
        tokens: {
          access: response.data.access,
          refresh: response.data.refresh,
        },
        user: response.data.user,
      };
    } catch (error: any) {
      console.error('[SocialAuth] Google token exchange error:', error);
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        'Failed to authenticate with Google';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate a cryptographically secure nonce
   */
  private async generateNonce(length: number = 32): Promise<string> {
    const randomBytes = await Crypto.getRandomBytesAsync(length);
    return Array.from(new Uint8Array(randomBytes))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}

export default new SocialAuthService();
