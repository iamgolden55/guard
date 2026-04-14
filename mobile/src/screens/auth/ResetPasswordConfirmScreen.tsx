/**
 * ResetPasswordConfirmScreen
 * Screen for setting a new password with a reset token
 * This can be accessed via deep link from the email
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Body, Caption, Button } from '@components/ui';
import { colors, spacing, layout } from '../../theme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { logger } from '../../utils/logger';
import { apiService } from '../../services/api';

type ResetPasswordConfirmRouteParams = {
  token: string;
};

export const ResetPasswordConfirmScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: ResetPasswordConfirmRouteParams }, 'params'>>();

  const token = route.params?.token;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    label: string;
    color: string;
  }>({ score: 0, label: 'Weak', color: colors.danger });

  // Validate token on mount
  useEffect(() => {
    validateToken();
  }, [token]);

  // Calculate password strength
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength({ score: 0, label: 'Weak', color: colors.danger });
      return;
    }

    let score = 0;

    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[a-z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword)) score++;

    let label = 'Weak';
    let color = colors.danger;

    if (score >= 5) {
      label = 'Very Strong';
      color = colors.success;
    } else if (score >= 4) {
      label = 'Strong';
      color = colors.success;
    } else if (score === 3) {
      label = 'Fair';
      color = colors.warning;
    } else if (score === 2) {
      label = 'Weak';
      color = colors.warning;
    }

    setPasswordStrength({ score, label, color });
  }, [newPassword]);

  const validateToken = async () => {
    if (!token) {
      Alert.alert('Invalid Link', 'No reset token provided. Please check your email link.');
      setIsValidating(false);
      return;
    }

    try {
      logger.info('[ResetPassword] Validating token');
      const response = await apiService.get<{ valid: boolean; email?: string; message?: string }>(
        `/api/v1/password-reset/validate/${token}/`
      );

      if (response.valid) {
        setIsValidToken(true);
        setEmail(response.email || '');
        logger.info('[ResetPassword] Token validated successfully');
      } else {
        setIsValidToken(false);
        Alert.alert('Invalid Token', response.message || 'This reset link is invalid or has expired.');
      }
    } catch (error: any) {
      logger.error('[ResetPassword] Token validation failed', { error });
      setIsValidToken(false);
      Alert.alert(
        'Invalid Link',
        error.response?.data?.message || 'This reset link is invalid or has expired. Please request a new one.'
      );
    } finally {
      setIsValidating(false);
    }
  };

  const validatePassword = (): boolean => {
    if (!newPassword.trim()) {
      Alert.alert('Required Field', 'Please enter a new password');
      return false;
    }

    if (newPassword.length < 8) {
      Alert.alert('Invalid Password', 'Password must be at least 8 characters long');
      return false;
    }

    if (!/[A-Z]/.test(newPassword)) {
      Alert.alert('Invalid Password', 'Password must contain at least one uppercase letter');
      return false;
    }

    if (!/[a-z]/.test(newPassword)) {
      Alert.alert('Invalid Password', 'Password must contain at least one lowercase letter');
      return false;
    }

    if (!/\d/.test(newPassword)) {
      Alert.alert('Invalid Password', 'Password must contain at least one number');
      return false;
    }

    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword)) {
      Alert.alert('Invalid Password', 'Password must contain at least one special character');
      return false;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validatePassword()) {
      return;
    }

    try {
      setIsSubmitting(true);
      logger.info('[ResetPassword] Submitting password reset');

      await apiService.post('/api/v1/password-reset/confirm/', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      logger.info('[ResetPassword] Password reset successful');

      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please log in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to login
              navigation.navigate('Login' as never);
            },
          },
        ]
      );
    } catch (error: any) {
      logger.error('[ResetPassword] Failed to reset password', { error });

      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.new_password?.[0] ||
        error.response?.data?.confirm_password?.[0] ||
        'Failed to reset password. Please try again.';

      Alert.alert('Reset Failed', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while validating token
  if (isValidating) {
    return (
      <Container>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Body style={styles.loadingText}>Validating reset link...</Body>
        </View>
      </Container>
    );
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <Container>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.errorIcon}>
              <Ionicons name="close-circle" size={80} color={colors.danger} />
            </View>

            <Heading2 style={styles.title}>Invalid Reset Link</Heading2>
            <Body color={colors.text.secondary} style={styles.description}>
              This password reset link is invalid or has expired. Please request a new one.
            </Body>

            <Button
              title="Request New Link"
              variant="primary"
              onPress={() => navigation.navigate('ForgotPassword' as never)}
              style={styles.submitButton}
            />

            <TouchableOpacity onPress={() => navigation.navigate('Login' as never)} style={styles.backLink}>
              <Body color={colors.primary}>← Back to Login</Body>
            </TouchableOpacity>
          </View>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="key-outline" size={64} color={colors.primary} />
            </View>

            {/* Title and Description */}
            <Heading2 style={styles.title}>Set New Password</Heading2>
            {email && (
              <Caption color={colors.text.secondary} style={styles.emailText}>
                for {email}
              </Caption>
            )}
            <Body color={colors.text.secondary} style={styles.description}>
              Please enter a strong password to secure your account.
            </Body>

            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={colors.text.tertiary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <View
                        key={level}
                        style={[styles.strengthSegment, { backgroundColor: level <= passwordStrength.score ? passwordStrength.color : colors.border.light }]}
                      />
                    ))}
                  </View>
                  <Caption color={passwordStrength.color} style={styles.strengthLabel}>
                    {passwordStrength.label}
                  </Caption>
                </View>
              )}

              {/* Password Requirements */}
              <View style={styles.requirementsBox}>
                <Caption style={styles.requirementTitle}>Password must contain:</Caption>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={newPassword.length >= 8 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={newPassword.length >= 8 ? colors.success : colors.text.tertiary}
                  />
                  <Caption style={styles.requirementText}>At least 8 characters</Caption>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/[A-Z]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={/[A-Z]/.test(newPassword) ? colors.success : colors.text.tertiary}
                  />
                  <Caption style={styles.requirementText}>One uppercase letter</Caption>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/[a-z]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={/[a-z]/.test(newPassword) ? colors.success : colors.text.tertiary}
                  />
                  <Caption style={styles.requirementText}>One lowercase letter</Caption>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/\d/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={/\d/.test(newPassword) ? colors.success : colors.text.tertiary}
                  />
                  <Caption style={styles.requirementText}>One number</Caption>
                </View>
                <View style={styles.requirementRow}>
                  <Ionicons
                    name={/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword) ? colors.success : colors.text.tertiary}
                  />
                  <Caption style={styles.requirementText}>One special character</Caption>
                </View>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.text.secondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.text.tertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!isSubmitting}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <View style={styles.matchIndicator}>
                  <Ionicons
                    name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={newPassword === confirmPassword ? colors.success : colors.danger}
                  />
                  <Caption color={newPassword === confirmPassword ? colors.success : colors.danger} style={styles.matchText}>
                    {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </Caption>
                </View>
              )}
            </View>

            {/* Submit Button */}
            <Button
              title={isSubmitting ? 'Resetting Password...' : 'Reset Password'}
              variant="primary"
              onPress={handleSubmit}
              disabled={isSubmitting || passwordStrength.score < 4}
              loading={isSubmitting}
              style={styles.submitButton}
            />

            {/* Back to Login Link */}
            <TouchableOpacity onPress={() => navigation.navigate('Login' as never)} style={styles.backLink}>
              <Body color={colors.primary}>← Back to Login</Body>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.base,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorIcon: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontSize: 26,
  },
  emailText: {
    textAlign: 'center',
    marginBottom: spacing.base,
    fontSize: 14,
  },
  description: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: layout.borderRadius.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    padding: spacing.base,
    fontSize: 16,
    color: colors.text.primary,
  },
  strengthContainer: {
    marginTop: spacing.sm,
  },
  strengthBar: {
    flexDirection: 'row',
    height: 4,
    gap: 4,
    marginBottom: spacing.xs,
  },
  strengthSegment: {
    flex: 1,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  requirementsBox: {
    marginTop: spacing.base,
    padding: spacing.base,
    backgroundColor: `${colors.primary}05`,
    borderRadius: layout.borderRadius.md,
  },
  requirementTitle: {
    fontWeight: '600',
    marginBottom: spacing.xs,
    color: colors.text.primary,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  requirementText: {
    marginLeft: spacing.xs,
    fontSize: 12,
    color: colors.text.secondary,
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  matchText: {
    marginLeft: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    marginBottom: spacing.base,
  },
  backLink: {
    alignItems: 'center',
    padding: spacing.sm,
  },
});
