/**
 * LoginScreenV2 — dark premium redesign
 *
 * Business logic is identical to LoginScreen.tsx:
 *   - Apple Sign-In via socialAuthService
 *   - Google OAuth via expo-auth-session
 *   - Email/password via useAuth.login
 *   - Biometric via useAuth.loginWithBiometrics
 *
 * Only the visual/structural layout is new.
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
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AntDesign, FontAwesome, Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { Prompt } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../../hooks/useAuth';
import { useAppDispatch } from '../../../hooks/useRedux';
import { setCredentials } from '../../../store/slices/authSlice';
import { logger } from '../../../utils/logger';
import {
  ApiError,
  ApiTimeoutError,
  NetworkError,
} from '../../../services/api';
import { ERROR_MESSAGES } from '../../../utils/constants';
import type { AuthStackParamList } from '../../../types/navigation';
import socialAuthService from '../../../services/socialAuthService';
import authService from '../../../services/authService';
import notificationService from '../../../services/notificationService';

import {
  redesignColors,
  redesignFonts,
  redesignShadows,
  redesignText,
} from '../../../theme/redesign';

WebBrowser.maybeCompleteAuthSession();

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

const googleConfig = Constants.expoConfig?.extra?.google || {};
const isGoogleConfigured = Boolean(
  googleConfig.iosClientId ||
    googleConfig.androidClientId ||
    googleConfig.expoClientId,
);

export const LoginScreenV2: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(
    null,
  );

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const {
    login,
    loginWithBiometrics,
    checkBiometricSupport,
    biometricEnabled,
  } = useAuth();

  const PLACEHOLDER_CLIENT_ID =
    '000000000000-placeholder.apps.googleusercontent.com';
  const [googleRequest, googleResponse, googlePromptAsync] =
    Google.useAuthRequest({
      expoClientId: googleConfig.expoClientId || PLACEHOLDER_CLIENT_ID,
      iosClientId: googleConfig.iosClientId || PLACEHOLDER_CLIENT_ID,
      androidClientId: googleConfig.androidClientId || PLACEHOLDER_CLIENT_ID,
      webClientId: googleConfig.webClientId || PLACEHOLDER_CLIENT_ID,
      scopes: ['profile', 'email'],
      // Force Google account chooser so a previously signed-in Google session
      // cannot silently re-authenticate the wrong user after logout.
      prompt: Prompt.SelectAccount,
    });

  // Entry animation
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(rise, {
        toValue: 0,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  // Check availability
  useEffect(() => {
    (async () => {
      try {
        const bio = await checkBiometricSupport();
        setShowBiometric(bio && biometricEnabled);
      } catch (e) {
        setShowBiometric(false);
      }
      try {
        setIsAppleAvailable(await socialAuthService.isAppleSignInAvailable());
      } catch (e) {
        setIsAppleAvailable(false);
      }
    })();
  }, [biometricEnabled]);

  // Google auth response
  useEffect(() => {
    (async () => {
      if (googleResponse?.type === 'success') {
        setIsGoogleLoading(true);
        try {
          const { authentication } = googleResponse;
          if (authentication?.idToken && authentication?.accessToken) {
            const result = await socialAuthService.exchangeGoogleToken(
              authentication.idToken,
              authentication.accessToken,
            );
            if (result.success && result.tokens) {
              await authService.storeTokens(result.tokens);
              const userProfile = await authService.fetchUserProfile(
                result.tokens.access,
              );
              dispatch(
                setCredentials({
                  user: userProfile,
                  accessToken: result.tokens.access,
                  refreshToken: result.tokens.refresh,
                }),
              );
              notificationService.registerPushToken().catch(() => {});
              logger.logAuth('google', userProfile?.id);
            } else {
              Alert.alert(
                'Sign In Failed',
                result.error || 'Unable to sign in with Google',
              );
            }
          }
        } catch (e: any) {
          logger.error('Google Sign-In error', e);
          Alert.alert('Error', 'Unable to complete Google sign in.');
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (googleResponse?.type === 'error') {
        Alert.alert('Error', 'Google sign in failed. Please try again.');
      }
    })();
  }, [googleResponse]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email/username and password.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await login({ username: email.trim(), password });
      if (!result || typeof result.success === 'undefined') {
        Alert.alert('Error', 'Login failed. Please try again.');
        return;
      }
      if (result.success) {
        logger.logAuth('login', result.user?.id);
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch (error: any) {
      if (error instanceof ApiTimeoutError) {
        Alert.alert('Timeout', ERROR_MESSAGES.TIMEOUT_ERROR);
      } else if (error instanceof NetworkError) {
        Alert.alert('Network Error', ERROR_MESSAGES.NETWORK_ERROR);
      } else if (error instanceof ApiError) {
        Alert.alert(
          'Login Failed',
          error.statusCode === 401
            ? ERROR_MESSAGES.AUTH_FAILED
            : error.statusText,
        );
      } else {
        Alert.alert('Error', 'An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometric = async () => {
    setIsLoading(true);
    try {
      const result = await loginWithBiometrics();
      if (!result?.success) {
        Alert.alert(
          'Authentication Failed',
          result?.error || 'Please try again',
        );
      } else {
        logger.logAuth('biometric', result.user?.id);
      }
    } catch (e) {
      Alert.alert('Error', 'Biometric authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApple = async () => {
    setIsAppleLoading(true);
    try {
      const result = await socialAuthService.signInWithApple();
      if (result.success && result.tokens) {
        await authService.storeTokens(result.tokens);
        const userProfile = await authService.fetchUserProfile(
          result.tokens.access,
        );
        dispatch(
          setCredentials({
            user: userProfile,
            accessToken: result.tokens.access,
            refreshToken: result.tokens.refresh,
          }),
        );
        notificationService.registerPushToken().catch(() => {});
        logger.logAuth('apple', userProfile?.id);
      } else if (result.error !== 'Sign in was cancelled') {
        Alert.alert(
          'Sign In Failed',
          result.error || 'Unable to sign in with Apple',
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to sign in with Apple.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!googleRequest) {
      Alert.alert(
        'Configuration Required',
        'Google Sign-In is not configured.',
      );
      return;
    }
    setIsGoogleLoading(true);
    try {
      await googlePromptAsync();
    } catch {
      Alert.alert('Error', 'Unable to start Google sign in.');
      setIsGoogleLoading(false);
    }
  };

  const anyLoading = isLoading || isAppleLoading || isGoogleLoading;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.ambient}>
        <LinearGradient
          colors={['rgba(225,52,44,0.22)', 'rgba(225,52,44,0)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.back}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={redesignColors.text.primary}
            />
          </TouchableOpacity>

          <Animated.View
            style={[{ opacity: fade, transform: [{ translateY: rise }] }]}
          >
            <Text style={styles.eyebrow} allowFontScaling={false}>
              SIGN IN
            </Text>
            <Text style={styles.title}>Welcome back.</Text>
            <Text style={styles.subtitle}>
              Use your Mead Security account.
            </Text>

            {/* Email */}
            <Text style={styles.label} allowFontScaling={false}>
              EMAIL OR USERNAME
            </Text>
            <Pressable
              onPress={() => emailRef.current?.focus()}
              style={[
                styles.field,
                focusedField === 'email' && styles.fieldFocus,
              ]}
            >
              <TextInput
                ref={emailRef}
                value={email}
                onChangeText={setEmail}
                placeholder="name@meadsecurity.co.uk"
                placeholderTextColor={redesignColors.text.tertiary}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!anyLoading}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </Pressable>

            {/* Password */}
            <View style={styles.labelRow}>
              <Text style={styles.label} allowFontScaling={false}>
                PASSWORD
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={anyLoading}
              >
                <Text style={styles.forgot}>Forgot?</Text>
              </TouchableOpacity>
            </View>
            <Pressable
              onPress={() => passwordRef.current?.focus()}
              style={[
                styles.field,
                focusedField === 'password' && styles.fieldFocus,
                { flexDirection: 'row', alignItems: 'center' },
              ]}
            >
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={redesignColors.text.tertiary}
                style={[styles.input, { flex: 1 }]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!anyLoading}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye' : 'eye-off'}
                  size={18}
                  color={redesignColors.text.secondary}
                />
              </TouchableOpacity>
            </Pressable>

            {/* Primary CTA */}
            <TouchableOpacity
              style={[styles.cta, anyLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={anyLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Biometric hint */}
            {showBiometric && (
              <TouchableOpacity
                style={styles.biometricRow}
                onPress={handleBiometric}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="finger-print"
                  size={18}
                  color={redesignColors.text.secondary}
                />
                <Text style={styles.biometricHint}>
                  Or use{' '}
                  <Text style={{ color: redesignColors.accent, fontWeight: '500' }}>
                    Face ID / Touch ID
                  </Text>
                </Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.hairline} />
              <Text style={styles.dividerText} allowFontScaling={false}>
                OR
              </Text>
              <View style={styles.hairline} />
            </View>

            {/* Apple */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.appleBtn, anyLoading && { opacity: 0.7 }]}
                onPress={handleApple}
                disabled={anyLoading || !isAppleAvailable}
                activeOpacity={0.85}
              >
                {isAppleLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <FontAwesome
                      name="apple"
                      size={18}
                      color="#000"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.appleBtnText}>Sign in with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Google */}
            {isGoogleConfigured && (
              <TouchableOpacity
                style={[styles.googleBtn, anyLoading && { opacity: 0.7 }]}
                onPress={handleGoogle}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color={redesignColors.text.primary} />
                ) : (
                  <>
                    <AntDesign
                      name="google"
                      size={18}
                      color={redesignColors.text.primary}
                      style={{ marginRight: 10 }}
                    />
                    <Text style={styles.googleBtnText}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: redesignColors.canvas,
  },
  ambient: {
    position: 'absolute',
    top: -150,
    left: -100,
    right: -100,
    height: 450,
  },
  scroll: {
    paddingTop: Platform.OS === 'ios' ? 72 : 56,
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  back: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: redesignColors.surface.chip,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  eyebrow: {
    ...redesignText.eyebrow,
    marginTop: 40,
    marginBottom: 12,
  },
  title: {
    ...redesignText.title,
    fontSize: 34,
    letterSpacing: -1.0,
    marginBottom: 8,
  },
  subtitle: {
    ...redesignText.body,
    marginBottom: 36,
  },
  label: {
    ...redesignText.meta,
    fontSize: 10,
    marginBottom: 8,
    color: redesignColors.text.secondary,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  forgot: {
    fontSize: 12,
    color: redesignColors.accent,
    fontWeight: '500',
    fontFamily: redesignFonts.sans,
  },
  field: {
    height: 54,
    borderRadius: 14,
    backgroundColor: redesignColors.surface.card,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairlineStrong,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  fieldFocus: {
    borderWidth: 1.5,
    borderColor: redesignColors.accent,
    shadowColor: redesignColors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  input: {
    fontFamily: redesignFonts.sans,
    fontSize: 16,
    color: redesignColors.text.primary,
    padding: 0,
  },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: redesignColors.accent,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...redesignShadows.primaryGlow,
  },
  ctaText: {
    ...redesignText.button,
    fontSize: 16,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  biometricHint: {
    ...redesignText.body,
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  hairline: {
    flex: 1,
    height: 1,
    backgroundColor: redesignColors.surface.hairlineStrong,
  },
  dividerText: {
    fontFamily: redesignFonts.mono,
    fontSize: 10,
    letterSpacing: 2.4,
    color: redesignColors.text.tertiary,
  },
  appleBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  appleBtnText: {
    ...redesignText.button,
    color: '#000',
    fontSize: 16,
  },
  googleBtn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: redesignColors.surface.chip,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairlineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    ...redesignText.button,
    fontSize: 16,
  },
});

export default LoginScreenV2;
