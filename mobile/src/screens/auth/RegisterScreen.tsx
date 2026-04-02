/**
 * Register Screen - Account Creation
 * Matches the clean modern design of the Login Screen
 * With Apple Sign-In support
 */

import React, { useState, useRef, useEffect } from 'react';
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
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import { Logo } from '@components/Logo';
import { useAppDispatch } from '../../hooks/useRedux';
import { setCredentials } from '../../store/slices/authSlice';
import { logger } from '../../utils/logger';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api.config';
import type { AuthStackParamList } from '../../types/navigation';
import socialAuthService from '../../services/socialAuthService';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

// Google Sign-In is not configured yet
const isGoogleConfigured = false;

export const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const dispatch = useAppDispatch();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  // Check if Apple Sign-In is available on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const appleAvailable = await socialAuthService.isAppleSignInAvailable();
      setIsAppleAvailable(appleAvailable);
    };
    checkAvailability();
  }, []);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleRegister = async () => {
    // Validation
    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name.');
      return;
    }

    if (!lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter a password.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // Call registration API
      await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REGISTER}`, {
        username: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
      });

      Alert.alert(
        'Account Created',
        'Your account has been created successfully. Please sign in to continue.',
        [
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      logger.error('Registration failed', error);

      if (error.response?.data?.email) {
        Alert.alert('Registration Failed', 'An account with this email already exists.');
      } else if (error.response?.data?.password) {
        Alert.alert('Registration Failed', error.response.data.password[0] || 'Invalid password.');
      } else if (error.response?.data?.detail) {
        Alert.alert('Registration Failed', error.response.data.detail);
      } else {
        Alert.alert('Registration Failed', 'Unable to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
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
          console.log('[RegisterScreen] Push token registration failed (non-critical):', error);
        });

        logger.logAuth('apple_signup', userProfile?.id);
        // Navigation will happen automatically via Redux state change
      } else {
        if (result.error !== 'Sign in was cancelled') {
          Alert.alert('Sign Up Failed', result.error || 'Unable to sign up with Apple');
        }
      }
    } catch (error: any) {
      logger.error('Apple Sign-Up error', error);
      Alert.alert('Error', 'Unable to sign up with Apple. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const isAnyLoading = isLoading || isAppleLoading;

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

        {/* Social Sign Up Buttons */}
        {/* Apple Sign-Up - Only show on iOS when available */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.appleButton, isAppleLoading && styles.buttonDisabled]}
            onPress={handleAppleSignUp}
            disabled={isAnyLoading || !isAppleAvailable}
            activeOpacity={0.8}
          >
            {isAppleLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <FontAwesome name="apple" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.appleButtonText}>Sign up with Apple</Text>
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

        {/* Create Account heading */}
        <Text style={styles.heading}>Create with email</Text>

        {/* First Name Input */}
        <TouchableWithoutFeedback onPress={() => firstNameInputRef.current?.focus()}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>First Name:</Text>
            <TextInput
              ref={firstNameInputRef}
              style={styles.input}
              placeholder="Enter first name"
              placeholderTextColor="#999"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              editable={!isAnyLoading}
              returnKeyType="next"
              onSubmitEditing={() => lastNameInputRef.current?.focus()}
            />
          </View>
        </TouchableWithoutFeedback>

        {/* Last Name Input */}
        <TouchableWithoutFeedback onPress={() => lastNameInputRef.current?.focus()}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Last Name:</Text>
            <TextInput
              ref={lastNameInputRef}
              style={styles.input}
              placeholder="Enter last name"
              placeholderTextColor="#999"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
              editable={!isAnyLoading}
              returnKeyType="next"
              onSubmitEditing={() => emailInputRef.current?.focus()}
            />
          </View>
        </TouchableWithoutFeedback>

        {/* Email Input */}
        <TouchableWithoutFeedback onPress={() => emailInputRef.current?.focus()}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Email:</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="Enter email address"
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
            <Text style={styles.label}>Password:</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordInputRef}
                style={styles.passwordInput}
                placeholder="Create password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isAnyLoading}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
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

        {/* Confirm Password Input */}
        <TouchableWithoutFeedback onPress={() => confirmPasswordInputRef.current?.focus()}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Confirm:</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={confirmPasswordInputRef}
                style={styles.passwordInput}
                placeholder="Confirm password"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isAnyLoading}
                returnKeyType="go"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye' : 'eye-off'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>

        {/* Password Requirements */}
        <Text style={styles.passwordHint}>Password must be at least 8 characters</Text>

        {/* Create Account Button */}
        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isAnyLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create account</Text>
          )}
        </TouchableOpacity>

        {/* Already have an account */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          disabled={isAnyLoading}
          style={styles.signInLink}
        >
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInTextBold}>Sign in</Text>
          </Text>
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
    marginBottom: 32,
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
    paddingVertical: 14,
    marginBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    width: 100,
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
  passwordHint: {
    color: '#999999',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  createButton: {
    backgroundColor: '#0061FF',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 58,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 24,
  },
  signInText: {
    color: '#666666',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  signInTextBold: {
    color: '#0061FF',
    fontWeight: '600',
  },
});
