/**
 * Register Screen - Account Creation
 * Matches the clean modern design of the Login Screen
 */

import React, { useState, useRef } from 'react';
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
import axios from 'axios';

import { Logo } from '@components/Logo';
import { logger } from '../../utils/logger';
import { API_ENDPOINTS } from '../../config/api.config';
import type { AuthStackParamList } from '../../types/navigation';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export const RegisterScreen = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

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
      await axios.post(API_ENDPOINTS.AUTH.REGISTER, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        password_confirm: confirmPassword,
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
      // TODO: Implement Apple Sign-In with expo-apple-authentication
      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert(
        'Coming Soon',
        'Sign up with Apple will be available in a future update. Please create an account with email and password.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error: any) {
      logger.error('Apple Sign-Up error', error);
      Alert.alert('Error', 'Unable to sign up with Apple. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);

    try {
      // TODO: Implement Google Sign-In with expo-auth-session
      await new Promise(resolve => setTimeout(resolve, 500));

      Alert.alert(
        'Coming Soon',
        'Sign up with Google will be available in a future update. Please create an account with email and password.',
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error: any) {
      logger.error('Google Sign-Up error', error);
      Alert.alert('Error', 'Unable to sign up with Google. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
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

        {/* Social Sign Up Buttons */}
        <TouchableOpacity
          style={[styles.appleButton, isAppleLoading && styles.buttonDisabled]}
          onPress={handleAppleSignUp}
          disabled={isAnyLoading}
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

        <TouchableOpacity
          style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignUp}
          disabled={isAnyLoading}
          activeOpacity={0.8}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#4285F4" size="small" />
          ) : (
            <>
              <AntDesign name="google" size={20} color="#4285F4" style={styles.buttonIcon} />
              <Text style={styles.googleButtonText}>Sign up with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Create Account heading */}
        <Text style={styles.heading}>Create an account</Text>

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
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: -0.5,
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
