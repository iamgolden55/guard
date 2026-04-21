/**
 * RegisterScreenV2 — dark premium redesign
 *
 * Preserves all existing logic from RegisterScreen.tsx:
 *   - Apple Sign-Up via socialAuthService
 *   - POST to API_ENDPOINTS.AUTH.REGISTER for email sign-up
 *   - Same validation rules (name/email/password length/match)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';

import { useAppDispatch } from '../../../hooks/useRedux';
import { setCredentials } from '../../../store/slices/authSlice';
import { logger } from '../../../utils/logger';
import { API_ENDPOINTS, API_BASE_URL } from '../../../config/api.config';
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

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

// Reusable dark field
interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoComplete?: any;
  returnKeyType?: 'next' | 'go' | 'done';
  onSubmitEditing?: () => void;
  trailing?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
}

const Field: React.FC<FieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  editable = true,
  keyboardType,
  autoCapitalize,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  trailing,
  inputRef,
}) => {
  const [focused, setFocused] = useState(false);
  const localRef = useRef<TextInput>(null);
  const effectiveRef = inputRef ?? localRef;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={fieldStyles.label} allowFontScaling={false}>
        {label}
      </Text>
      <Pressable
        onPress={() => effectiveRef.current?.focus()}
        style={[
          fieldStyles.field,
          focused && fieldStyles.fieldFocus,
          trailing ? { flexDirection: 'row', alignItems: 'center' } : null,
        ]}
      >
        <TextInput
          ref={effectiveRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={redesignColors.text.tertiary}
          style={[fieldStyles.input, trailing ? { flex: 1 } : null]}
          secureTextEntry={secureTextEntry}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailing}
      </Pressable>
    </View>
  );
};

export const RegisterScreenV2: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsAppleAvailable(await socialAuthService.isAppleSignInAvailable());
      } catch {
        setIsAppleAvailable(false);
      }
    })();
  }, []);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // Lightweight strength meter — 0..4
  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const handleRegister = async () => {
    if (!firstName.trim()) return Alert.alert('Error', 'Please enter your first name.');
    if (!lastName.trim()) return Alert.alert('Error', 'Please enter your last name.');
    if (!email.trim()) return Alert.alert('Error', 'Please enter your email address.');
    if (!validateEmail(email))
      return Alert.alert('Error', 'Please enter a valid email address.');
    if (!password) return Alert.alert('Error', 'Please enter a password.');
    if (password.length < 8)
      return Alert.alert('Error', 'Password must be at least 8 characters long.');
    if (password !== confirmPassword)
      return Alert.alert('Error', 'Passwords do not match.');

    setIsLoading(true);
    try {
      await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REGISTER}`, {
        username: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      Alert.alert(
        'Account Created',
        'Your account has been created successfully. Please sign in to continue.',
        [{ text: 'Sign In', onPress: () => navigation.navigate('Login') }],
      );
    } catch (error: any) {
      logger.error('Registration failed', error);
      if (error.response?.data?.email) {
        Alert.alert(
          'Registration Failed',
          'An account with this email already exists.',
        );
      } else if (error.response?.data?.password) {
        Alert.alert(
          'Registration Failed',
          error.response.data.password[0] || 'Invalid password.',
        );
      } else if (error.response?.data?.detail) {
        Alert.alert('Registration Failed', error.response.data.detail);
      } else {
        Alert.alert(
          'Registration Failed',
          'Unable to create account. Please try again.',
        );
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
        await authService.storeTokens(result.tokens);
        const profile = await authService.fetchUserProfile(
          result.tokens.access,
        );
        dispatch(
          setCredentials({
            user: profile,
            accessToken: result.tokens.access,
            refreshToken: result.tokens.refresh,
          }),
        );
        notificationService.registerPushToken().catch(() => {});
        logger.logAuth('apple_signup', profile?.id);
      } else if (result.error !== 'Sign in was cancelled') {
        Alert.alert(
          'Sign Up Failed',
          result.error || 'Unable to sign up with Apple',
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to sign up with Apple.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const anyLoading = isLoading || isAppleLoading;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.ambient}>
        <LinearGradient
          colors={['rgba(225,52,44,0.16)', 'rgba(225,52,44,0)']}
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

          {/* Step chip */}
          <View style={styles.stepChip}>
            <Text style={styles.stepText} allowFontScaling={false}>
              STEP 1 / 2
            </Text>
          </View>

          <Text style={[styles.eyebrow, { marginTop: 32 }]} allowFontScaling={false}>
            CREATE ACCOUNT
          </Text>
          <Text style={styles.title}>
            Let's get you on{'\n'}the roster.
          </Text>

          {Platform.OS === 'ios' && isAppleAvailable && (
            <TouchableOpacity
              style={[styles.appleBtn, anyLoading && { opacity: 0.7 }]}
              onPress={handleAppleSignUp}
              disabled={anyLoading}
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
                  <Text style={styles.appleBtnText}>Sign up with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {Platform.OS === 'ios' && isAppleAvailable && (
            <View style={styles.divider}>
              <View style={styles.hairline} />
              <Text style={styles.dividerText} allowFontScaling={false}>
                OR
              </Text>
              <View style={styles.hairline} />
            </View>
          )}

          <Field
            label="FIRST NAME"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Alex"
            autoCapitalize="words"
            autoComplete="given-name"
            editable={!anyLoading}
            returnKeyType="next"
            onSubmitEditing={() => lastNameRef.current?.focus()}
          />
          <Field
            label="LAST NAME"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Morgan"
            autoCapitalize="words"
            autoComplete="family-name"
            editable={!anyLoading}
            returnKeyType="next"
            inputRef={lastNameRef}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Field
            label="WORK EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="name@meadsecurity.co.uk"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!anyLoading}
            returnKeyType="next"
            inputRef={emailRef}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            label="PASSWORD"
            value={password}
            onChangeText={setPassword}
            placeholder="Min 8 characters"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!anyLoading}
            returnKeyType="next"
            inputRef={passwordRef}
            onSubmitEditing={() => confirmRef.current?.focus()}
            trailing={
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
            }
          />

          {/* Strength meter */}
          <View style={styles.strengthRow}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={[
                  styles.strengthBar,
                  {
                    backgroundColor:
                      i < strength
                        ? redesignColors.accent
                        : 'rgba(255,255,255,0.08)',
                  },
                ]}
              />
            ))}
          </View>

          <Field
            label="CONFIRM PASSWORD"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat password"
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!anyLoading}
            returnKeyType="go"
            inputRef={confirmRef}
            onSubmitEditing={handleRegister}
            trailing={
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirm ? 'eye' : 'eye-off'}
                  size={18}
                  color={redesignColors.text.secondary}
                />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={[styles.cta, anyLoading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={anyLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.ctaText}>Continue</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={redesignColors.text.primary}
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            disabled={anyLoading}
            style={{ alignItems: 'center', marginTop: 18 }}
          >
            <Text style={styles.signInPrompt}>
              Already have an account?{' '}
              <Text style={styles.signInLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const fieldStyles = StyleSheet.create({
  label: {
    fontFamily: redesignFonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: redesignColors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  field: {
    height: 50,
    borderRadius: 12,
    backgroundColor: redesignColors.surface.card,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairlineStrong,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  fieldFocus: {
    borderWidth: 1.5,
    borderColor: redesignColors.accent,
  },
  input: {
    fontFamily: redesignFonts.sans,
    fontSize: 15,
    color: redesignColors.text.primary,
    padding: 0,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: redesignColors.canvas },
  ambient: {
    position: 'absolute',
    top: -150,
    left: -100,
    right: -100,
    height: 380,
  },
  scroll: {
    paddingTop: Platform.OS === 'ios' ? 68 : 52,
    paddingHorizontal: 28,
    paddingBottom: 60,
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
  stepChip: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 66 : 46,
    right: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: redesignColors.surface.chip,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairline,
  },
  stepText: {
    fontFamily: redesignFonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: redesignColors.text.secondary,
  },
  eyebrow: {
    ...redesignText.eyebrow,
    marginBottom: 12,
  },
  title: {
    ...redesignText.title,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 12,
  },
  appleBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  appleBtnText: {
    ...redesignText.button,
    color: '#000',
    fontSize: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
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
  strengthRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  cta: {
    height: 54,
    borderRadius: 14,
    backgroundColor: redesignColors.accent,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...redesignShadows.primaryGlow,
  },
  ctaText: {
    ...redesignText.button,
    fontSize: 16,
  },
  signInPrompt: {
    ...redesignText.body,
    fontSize: 13,
    color: redesignColors.text.secondary,
  },
  signInLink: {
    color: redesignColors.accent,
    fontWeight: '500',
  },
});

export default RegisterScreenV2;
