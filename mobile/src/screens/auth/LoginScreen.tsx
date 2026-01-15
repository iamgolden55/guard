/**
 * Login Screen - Clean Modern Design
 * Dropbox-inspired simple and professional
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

import { Logo } from '@components/Logo';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../utils/logger';
import { ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { ERROR_MESSAGES } from '../../utils/constants';
import type { AuthStackParamList } from '../../types/navigation';

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showBiometric, setShowBiometric] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const {
    login,
    loginWithBiometrics,
    checkBiometricSupport,
    biometricEnabled,
  } = useAuth();

  // Check if biometric is available on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const supported = await checkBiometricSupport();
      setShowBiometric(supported && biometricEnabled);
    };
    checkBiometric();
  }, [biometricEnabled]);

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
      // TODO: Implement Apple Sign-In with expo-apple-authentication
      // For now, show a message that this feature is coming soon
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief loading state for feedback

      Alert.alert(
        'Coming Soon',
        'Sign in with Apple will be available in a future update. Please use email and password to sign in.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error: any) {
      logger.error('Apple Sign-In error', error);
      Alert.alert('Error', 'Unable to sign in with Apple. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    try {
      // TODO: Implement Google Sign-In with expo-auth-session or @react-native-google-signin
      // For now, show a message that this feature is coming soon
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief loading state for feedback

      Alert.alert(
        'Coming Soon',
        'Continue with Google will be available in a future update. Please use email and password to sign in.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error: any) {
      logger.error('Google Sign-In error', error);
      Alert.alert('Error', 'Unable to sign in with Google. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

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
        <TouchableOpacity
          style={[styles.appleButton, isAppleLoading && styles.buttonDisabled]}
          onPress={handleAppleSignIn}
          disabled={isAppleLoading || isGoogleLoading || isLoading}
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

        <TouchableOpacity
          style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={isAppleLoading || isGoogleLoading || isLoading}
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

        {/* Sign in heading */}
        <Text style={styles.heading}>Sign in</Text>

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
              editable={!isLoading}
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
                editable={!isLoading}
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
          disabled={isLoading}
        >
          <Text style={styles.forgotPassword}>Having trouble signing in?</Text>
        </TouchableOpacity>

        {/* Sign In Button */}
        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signInButtonText}>Sign in</Text>
          )}
        </TouchableOpacity>
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
    marginBottom: 32,
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
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 32,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -0.5,
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
    marginBottom: 24,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
