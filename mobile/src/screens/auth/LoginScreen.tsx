/**
 * Login Screen - Clean Modern Design
 * Dropbox-inspired simple and professional
 * With Apple Sign-In and Google Sign-In support
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { Prompt } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { Logo } from '@components/Logo';
import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch } from '../../hooks/useRedux';
import { setCredentials } from '../../store/slices/authSlice';
import { logger } from '../../utils/logger';
import { ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { ERROR_MESSAGES } from '../../utils/constants';
import type { AuthStackParamList } from '../../types/navigation';
import socialAuthService from '../../services/socialAuthService';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';

// Required for Google auth to complete properly
WebBrowser.maybeCompleteAuthSession();

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// Get Google OAuth client IDs from expo config
const googleConfig = Constants.expoConfig?.extra?.google || {};

// Check if Google Sign-In is properly configured
const isGoogleConfigured = Boolean(
  googleConfig.iosClientId || googleConfig.androidClientId || googleConfig.expoClientId
);

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const {
    login,
    loginWithBiometrics,
    checkBiometricSupport,
    biometricEnabled,
  } = useAuth();

  // Google Auth Session hook
  // IMPORTANT: useAuthRequest throws on mount if iosClientId is undefined on iOS.
  // Pass a placeholder when not configured so the hook doesn't crash the screen.
  // The Google button is hidden via `isGoogleConfigured` so the placeholder is never used.
  const PLACEHOLDER_CLIENT_ID = '000000000000-placeholder.apps.googleusercontent.com';
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    expoClientId: googleConfig.expoClientId || PLACEHOLDER_CLIENT_ID,
    iosClientId: googleConfig.iosClientId || PLACEHOLDER_CLIENT_ID,
    androidClientId: googleConfig.androidClientId || PLACEHOLDER_CLIENT_ID,
    webClientId: googleConfig.webClientId || PLACEHOLDER_CLIENT_ID,
    scopes: ['profile', 'email'],
    // Force Google account chooser so a previously signed-in Google session
    // cannot silently re-authenticate the wrong user after logout.
    prompt: Prompt.SelectAccount,
  });

  // Check if biometric and Apple Sign-In are available on mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const biometricSupported = await checkBiometricSupport();
        setShowBiometric(biometricSupported && biometricEnabled);
      } catch (error) {
        console.warn('[LoginScreen] Biometric check failed:', error);
        setShowBiometric(false);
      }

      try {
        const appleAvailable = await socialAuthService.isAppleSignInAvailable();
        setIsAppleAvailable(appleAvailable);
      } catch (error) {
        console.warn('[LoginScreen] Apple Sign-In availability check failed:', error);
        setIsAppleAvailable(false);
      }
    };
    checkAvailability();
  }, [biometricEnabled]);

  // Handle Google auth response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.type === 'success') {
        setIsGoogleLoading(true);
        try {
          const { authentication } = googleResponse;
          if (authentication?.idToken && authentication?.accessToken) {
            const result = await socialAuthService.exchangeGoogleToken(
              authentication.idToken,
              authentication.accessToken
            );
            if (result.success && result.tokens) {
              await authService.storeTokens(result.tokens);
              const userProfile = await authService.fetchUserProfile(result.tokens.access);

              // Update Redux state to trigger navigation
              dispatch(
                setCredentials({
                  user: userProfile,
                  accessToken: result.tokens.access,
                  refreshToken: result.tokens.refresh,
                })
              );

              // Register push notification token (non-blocking)
              notificationService.registerPushToken().catch((error) => {
                console.log('[LoginScreen] Push token registration failed (non-critical):', error);
              });

              logger.logAuth('google', userProfile?.id);
            } else {
              Alert.alert('Sign In Failed', result.error || 'Unable to sign in with Google');
            }
          }
        } catch (error: any) {
          logger.error('Google Sign-In error', error);
          Alert.alert('Error', 'Unable to complete Google sign in. Please try again.');
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (googleResponse?.type === 'error') {
        Alert.alert('Error', 'Google sign in failed. Please try again.');
      }
    };
    handleGoogleResponse();
  }, [googleResponse]);

  const handleLogin = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email/username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login({
        username: email.trim(),
        password,
      });

      // Defensive check - ensure result exists
      if (!result || typeof result.success === 'undefined') {
        Alert.alert('Error', 'Login failed. Please try again.');
        logger.error('Login returned invalid result', result);
        return;
      }

      if (result.success) {
        logger.logAuth('login', result.user?.id);
        // Navigation will happen automatically via Redux state change
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch (error: any) {
      logger.error('Login failed', error);

      if (error instanceof ApiTimeoutError) {
        Alert.alert('Timeout', ERROR_MESSAGES.TIMEOUT_ERROR);
      } else if (error instanceof NetworkError) {
        Alert.alert('Network Error', ERROR_MESSAGES.NETWORK_ERROR);
      } else if (error instanceof ApiError) {
        Alert.alert(
          'Login Failed',
          error.statusCode === 401
            ? ERROR_MESSAGES.AUTH_FAILED
            : error.statusText
        );
      } else {
        Alert.alert('Error', 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);

    try {
      const result = await loginWithBiometrics();

      // Defensive check - ensure result exists
      if (!result || typeof result.success === 'undefined') {
        Alert.alert('Error', 'Biometric authentication failed. Please try again.');
        logger.error('Biometric login returned invalid result', result);
        return;
      }

      if (result.success) {
        logger.logAuth('biometric', result.user?.id);
        // Navigation will happen automatically via Redux state change
      } else {
        Alert.alert('Authentication Failed', result.error || 'Please try again');
      }
    } catch (error: any) {
      logger.error('Biometric authentication failed', error);
      Alert.alert('Error', 'Biometric authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);

    try {
      const result = await socialAuthService.signInWithApple();

      if (result.success && result.tokens) {
        // Store tokens
        await authService.storeTokens(result.tokens);

        // Fetch user profile to complete auth
        const userProfile = await authService.fetchUserProfile(result.tokens.access);

        // Update Redux state - THIS triggers automatic navigation
        dispatch(
          setCredentials({
            user: userProfile,
            accessToken: result.tokens.access,
            refreshToken: result.tokens.refresh,
          })
        );

        // Register push notification token (non-blocking)
        notificationService.registerPushToken().catch((error) => {
          console.log('[LoginScreen] Push token registration failed (non-critical):', error);
        });

        logger.logAuth('apple', userProfile?.id);
        // Navigation will happen automatically via Redux state change
      } else {
        if (result.error !== 'Sign in was cancelled') {
          Alert.alert('Sign In Failed', result.error || 'Unable to sign in with Apple');
        }
      }
    } catch (error: any) {
      logger.error('Apple Sign-In error', error);
      Alert.alert('Error', 'Unable to sign in with Apple. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleRequest) {
      Alert.alert(
        'Configuration Required',
        'Google Sign-In is not configured. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsGoogleLoading(true);
    try {
      await googlePromptAsync();
      // Response will be handled by the useEffect above
    } catch (error: any) {
      logger.error('Google Sign-In prompt error', error);
      Alert.alert('Error', 'Unable to start Google sign in. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const isAnyLoading = isLoading || isAppleLoading || isGoogleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Logo />
        </View>

        {/* Social Login Buttons */}
        {/* Apple Sign-In - Only show on iOS when available */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.appleButton, isAppleLoading && styles.buttonDisabled]}
            onPress={handleAppleSignIn}
            disabled={isAnyLoading || !isAppleAvailable}
            activeOpacity={0.8}
          >
            {isAppleLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <FontAwesome name="apple" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Google Sign-In - Only show when properly configured */}
        {isGoogleConfigured && (
          <TouchableOpacity
            style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={isAnyLoading}
            activeOpacity={0.8}
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#4285F4" size="small" />
            ) : (
              <>
                <AntDesign name="google" size={20} color="#4285F4" style={styles.buttonIcon} />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Sign in heading */}
        <Text style={styles.heading}>Sign in with email</Text>

        {/* Email or Username Input */}
        <TouchableWithoutFeedback onPress={() => emailInputRef.current?.focus()}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Email or Username:</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="Enter email or username"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isAnyLoading}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </View>
        </TouchableWithoutFeedback>

        {/* Password Input */}
        <TouchableWithoutFeedback onPress={() => passwordInputRef.current?.focus()}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Password: </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordInputRef}
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isAnyLoading}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Forgot Password Link */}
        <TouchableOpacity
          onPress={handleForgotPassword}
          disabled={isAnyLoading}
        >
          <Text style={styles.forgotPassword}>Having trouble signing in?</Text>
        </TouchableOpacity>

        {/* Sign In Button */}
        <TouchableOpacity
          style={[styles.signInButton, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isAnyLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signInButtonText}>Sign in</Text>
          )}
        </TouchableOpacity>

        {/* Biometric Login */}
        {showBiometric && (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricLogin}
            disabled={isAnyLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="finger-print" size={24} color="#0061FF" />
            <Text style={styles.biometricText}>Use Face ID / Touch ID</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 54,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: 54,
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#999999',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 16,
    marginBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    width: 120,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  passwordContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  forgotPassword: {
    color: '#0061FF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  signInButton: {
    backgroundColor: '#0061FF',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 58,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 24,
  },
  biometricText: {
    color: '#0061FF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
