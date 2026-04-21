/**
 * ForgotPasswordScreenV2 — dark premium redesign
 *
 * Business logic preserved from ForgotPasswordScreen.tsx:
 *   - POST /api/v1/password-reset/request/
 *   - On error still show success (do not leak whether email exists)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { apiService } from '../../../services/api';
import { logger } from '../../../utils/logger';
import {
  redesignColors,
  redesignFonts,
  redesignShadows,
  redesignText,
} from '../../../theme/redesign';

export const ForgotPasswordScreenV2: React.FC = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Required Field', 'Please enter your email address');
      return;
    }
    if (!validateEmail(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    try {
      setIsSubmitting(true);
      logger.info('[ForgotPassword] Sending password reset request', {
        email: trimmed,
      });
      await apiService.post('/api/v1/password-reset/request/', {
        email: trimmed,
      });
      setEmailSent(true);
    } catch (e) {
      logger.error('[ForgotPassword] Failed to send reset email', { error: e });
      // Intentionally show success on error (don't reveal if email exists)
      setEmailSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View pointerEvents="none" style={styles.ambient}>
        <LinearGradient
          colors={['rgba(225,52,44,0.18)', 'rgba(225,52,44,0)']}
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

          {emailSent ? (
            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark" size={28} color={redesignColors.accent} />
              </View>
              <Text style={styles.eyebrow} allowFontScaling={false}>
                CHECK YOUR INBOX
              </Text>
              <Text style={[styles.title, { textAlign: 'center' }]}>
                Link on the way.
              </Text>
              <Text style={[styles.subtitle, { textAlign: 'center' }]}>
                If an account exists for {email}, we've emailed reset
                instructions. It may take a minute to arrive — check spam too.
              </Text>

              <TouchableOpacity
                style={[styles.cta, { marginTop: 28, width: '100%' }]}
                onPress={() => navigation.goBack()}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaText}>Back to sign in</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEmailSent(false);
                  setEmail('');
                }}
                style={{ marginTop: 18 }}
              >
                <Text style={styles.altLink}>Send again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.eyebrow, { marginTop: 40 }]} allowFontScaling={false}>
                RECOVER
              </Text>
              <Text style={styles.title}>Trouble signing in?</Text>
              <Text style={styles.subtitle}>
                We'll email you a secure one-time link. No password needed if
                you'd rather skip it.
              </Text>

              <Text style={styles.label} allowFontScaling={false}>
                EMAIL ADDRESS
              </Text>
              <View style={[styles.field, focused && styles.fieldFocus]}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@meadsecurity.co.uk"
                  placeholderTextColor={redesignColors.text.tertiary}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </View>

              <TouchableOpacity
                style={[styles.cta, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Send magic link</Text>
                )}
              </TouchableOpacity>

              {/* Help list */}
              <Text
                style={[styles.label, { marginTop: 32, marginBottom: 14 }]}
                allowFontScaling={false}
              >
                STILL STUCK?
              </Text>

              {[
                {
                  icon: 'people-outline' as const,
                  title: 'Contact your supervisor',
                  body: 'They can reset your account directly',
                },
                {
                  icon: 'mail-outline' as const,
                  title: 'Email ops@meadsecurity.co.uk',
                  body: 'Response within 2 hours, 24/7',
                },
              ].map((item, i) => (
                <View key={i} style={styles.helpRow}>
                  <View style={styles.helpIcon}>
                    <Ionicons
                      name={item.icon}
                      size={16}
                      color={redesignColors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.helpTitle}>{item.title}</Text>
                    <Text style={styles.helpBody}>{item.body}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={redesignColors.text.tertiary}
                  />
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

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
    marginBottom: 12,
  },
  title: {
    ...redesignText.title,
    fontSize: 34,
    letterSpacing: -1.0,
    marginBottom: 10,
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
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(225,52,44,0.18)',
    borderWidth: 1,
    borderColor: redesignColors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: redesignColors.surface.hairline,
  },
  helpIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(225,52,44,0.12)',
    borderWidth: 1,
    borderColor: redesignColors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontFamily: redesignFonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: redesignColors.text.primary,
  },
  helpBody: {
    ...redesignText.body,
    fontSize: 12,
    marginTop: 2,
  },
  altLink: {
    color: redesignColors.accent,
    fontSize: 14,
    fontWeight: '500',
    fontFamily: redesignFonts.sans,
  },
});

export default ForgotPasswordScreenV2;
