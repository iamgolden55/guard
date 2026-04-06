/**
 * ForgotPasswordScreen
 * Password reset request form
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Body, Caption, Button } from '@components/ui';
import { colors, spacing, layout } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import { logger } from '../../utils/logger';
import { api } from '../../services/api';

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Required Field', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    try {
      setIsSubmitting(true);
      logger.info('[ForgotPassword] Sending password reset request', { email: email.trim() });

      // Call backend password reset endpoint
      await api.post('/api/v1/password-reset/request/', { email: email.trim() });

      setEmailSent(true);
      logger.info('[ForgotPassword] Password reset email sent successfully');
    } catch (error: any) {
      logger.error('[ForgotPassword] Failed to send reset email', { error });

      // Even if it fails, show success message for security (don't reveal if email exists)
      setEmailSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.goBack();
  };

  if (emailSent) {
    return (
      <Container>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.content}>
            {/* Success Icon */}
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color={colors.success} />
            </View>

            {/* Success Message */}
            <Heading2 style={styles.title}>Check Your Email</Heading2>
            <Body color={colors.text.secondary} style={styles.description}>
              If an account exists for {email}, we've sent password reset instructions to that
              email address.
            </Body>

            <Caption color={colors.text.tertiary} style={styles.hint}>
              Didn't receive the email? Check your spam folder or try again in a few minutes.
            </Caption>

            {/* Back to Login Button */}
            <Button
              variant="primary"
              onPress={handleBackToLogin}
              style={styles.submitButton}
            >
              Back to Login
            </Button>

            {/* Resend Link */}
            <TouchableOpacity
              onPress={() => {
                setEmailSent(false);
                setEmail('');
              }}
              style={styles.resendButton}
            >
              <Body color={colors.primary}>Send Again</Body>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Container>
    );
  }

  return (
    <Container>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color={colors.primary} />
          </View>

          {/* Title and Description */}
          <Heading2 style={styles.title}>Forgot Password?</Heading2>
          <Body color={colors.text.secondary} style={styles.description}>
            Enter your email address and we'll send you instructions to reset your password.
          </Body>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color={colors.text.secondary} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={colors.text.tertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isSubmitting}
              />
            </View>
          </View>

          {/* Submit Button */}
          <Button
            variant="primary"
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={styles.submitButton}
          >
            {isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
          </Button>

          {/* Help Text */}
          <View style={styles.helpBox}>
            <Ionicons name="information-circle-outline" size={18} color={colors.info} />
            <Caption style={styles.helpText}>
              For security reasons, we don't disclose whether an email exists in our system.
            </Caption>
          </View>

          {/* Back to Login Link */}
          <TouchableOpacity onPress={handleBackToLogin} style={styles.backLink}>
            <Body color={colors.primary}>← Back to Login</Body>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.base,
    fontSize: 26,
  },
  description: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  hint: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontSize: 12,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: spacing.xl,
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
  submitButton: {
    marginBottom: spacing.base,
  },
  helpBox: {
    flexDirection: 'row',
    padding: spacing.base,
    backgroundColor: `${colors.info}10`,
    borderRadius: layout.borderRadius.md,
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  helpText: {
    marginLeft: spacing.sm,
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  backLink: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  resendButton: {
    alignItems: 'center',
    padding: spacing.base,
  },
});
