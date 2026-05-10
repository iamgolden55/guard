/**
 * LogbookSignoffModal — redesigned formal signoff sheet.
 *
 * End-of-shift signature capture from the venue's duty manager that closes
 * out the capacity logbook for the shift_group. Two paths:
 *
 *   1. Manager available — name, role, signature, optional notes.
 *   2. Manager unavailable — toggle reveals an override-reason textarea
 *      instead of the signature pad. The audit trail records both.
 *
 * Visual goal: this is a signing moment. Big signature surface, clear
 * "this is going on the audit trail" framing, and a hairline-bordered
 * frame around the canvas so it reads like a paper form. Functionality
 * unchanged — same submit payload via shiftChecksService.submitLogbookSignoff.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Signature, { SignatureViewRef } from 'react-native-signature-canvas';
import Svg, { Path } from 'react-native-svg';
import { logger } from '../utils/logger';
import { shiftChecksService } from '../services/shiftChecksService';
import { useRedesignTheme } from '../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from './redesign';

interface Props {
  visible: boolean;
  shiftGroup: string;
  venueId: number;
  venueName: string;
  totalChecks: number;
  totalMissed: number;
  onClose: () => void;
  onSubmitted: () => void;
}

export const LogbookSignoffModal: React.FC<Props> = ({
  visible,
  shiftGroup,
  venueId,
  venueName,
  totalChecks,
  totalMissed,
  onClose,
  onSubmitted,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const sigRef = useRef<SignatureViewRef>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [adminUnavailable, setAdminUnavailable] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // While the duty manager has a finger on the canvas, freeze the outer
  // ScrollView — otherwise the sheet hijacks the gesture and the signature
  // smears across the page as it scrolls.
  const [isDrawing, setIsDrawing] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setName('');
      setRole('');
      setNotes('');
      setSignature(null);
      setAdminUnavailable(false);
      setOverrideReason('');
      setSubmitting(false);
      setIsDrawing(false);
    }
  }, [visible]);

  const handleSignatureCapture = (sig: string) => {
    setSignature(sig);
  };

  const handleSignatureBegin = () => {
    setIsDrawing(true);
  };

  const handleSignatureEnd = () => {
    setIsDrawing(false);
  };

  const handleClearSignature = () => {
    sigRef.current?.clearSignature();
    setSignature(null);
    setIsDrawing(false);
  };

  const handleConfirmSignature = () => {
    sigRef.current?.readSignature();
  };

  const validateAndSubmit = async () => {
    if (adminUnavailable) {
      if (!overrideReason.trim()) {
        Alert.alert('Reason required', 'Please describe why no manager is available.');
        return;
      }
      if (overrideReason.trim().length < 12) {
        Alert.alert('More detail needed', 'Please add a fuller explanation for the audit trail.');
        return;
      }
    } else {
      if (!name.trim()) {
        Alert.alert('Name required', 'Enter the duty manager’s full name.');
        return;
      }
      if (!role.trim()) {
        Alert.alert('Role required', 'Enter the duty manager’s role (e.g. Duty Manager).');
        return;
      }
      if (!signature) {
        Alert.alert('Signature required', 'Please capture the signature, then tap Confirm.');
        return;
      }
    }

    try {
      setSubmitting(true);

      await shiftChecksService.submitLogbookSignoff({
        shift_group: shiftGroup,
        venue: venueId,
        closed_by_name: adminUnavailable ? undefined : name.trim(),
        closed_by_role: adminUnavailable ? undefined : role.trim(),
        signature: adminUnavailable ? undefined : (signature || ''),
        notes: notes.trim() || undefined,
        override_reason: adminUnavailable ? overrideReason.trim() : undefined,
      });

      logger.info('[LogbookSignoff] Submitted', { shiftGroup, adminUnavailable });
      onSubmitted();
    } catch (e) {
      logger.error('[LogbookSignoff] Submit failed:', e);
      Alert.alert('Could not submit', 'Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Signature canvas web style — pen color follows the theme
  const sigWebStyle = `
    .m-signature-pad { border: none; box-shadow: none; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--body canvas { background-color: transparent; }
    .m-signature-pad--footer { display: none; }
    body, html { background-color: transparent; margin: 0; padding: 0; }
  `;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Sheet handle + close */}
          <View style={[styles.handleRow, { paddingTop: insets.top + 8 }]}>
            <View style={[styles.handle, { backgroundColor: theme.colors.surface.hairlineStrong }]} />
          </View>
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Eyebrow color={theme.colors.accent}>Audit trail · signoff</Eyebrow>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: theme.colors.surface.chip,
                  borderColor: theme.colors.surface.hairline,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Svg width={14} height={14} viewBox="0 0 16 16">
                <Path
                  d="M4 4 L12 12 M12 4 L4 12"
                  stroke={theme.colors.text.primary}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 140 + insets.bottom,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isDrawing}
          >
            {/* Title */}
            <Text
              allowFontScaling={false}
              style={[styles.heading, { color: theme.colors.text.primary, fontFamily: theme.fonts.sans }]}
            >
              Close out the logbook
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: 20,
                color: theme.colors.text.secondary,
                fontFamily: theme.fonts.sans,
              }}
            >
              The duty manager’s signature seals the capacity audit trail for{' '}
              <Text style={{ fontWeight: '500', color: theme.colors.text.primary }}>{venueName}</Text>.
              This action cannot be undone.
            </Text>

            {/* Summary strip */}
            <View
              style={[
                styles.summaryStrip,
                {
                  backgroundColor: theme.colors.surface.chip,
                  borderColor: theme.colors.surface.hairline,
                },
              ]}
            >
              <SummaryStat label="Checks logged" value={String(totalChecks)} theme={theme} />
              <View style={[styles.summaryDivider, { backgroundColor: theme.colors.surface.hairlineStrong }]} />
              <SummaryStat
                label="Missed"
                value={String(totalMissed)}
                emphasis={totalMissed > 0}
                theme={theme}
              />
            </View>

            {/* Admin available toggle */}
            <Pressable
              onPress={() => setAdminUnavailable((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: adminUnavailable }}
              accessibilityLabel="Venue manager not available — use override"
              style={({ pressed }) => [
                styles.toggleRow,
                {
                  backgroundColor: adminUnavailable ? theme.colors.accentSoft : theme.colors.surface.chip,
                  borderColor: adminUnavailable
                    ? theme.colors.accentBorder
                    : theme.colors.surface.hairline,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Eyebrow color={adminUnavailable ? theme.colors.accent : theme.colors.text.secondary}>
                  Override
                </Eyebrow>
                <Text
                  allowFontScaling={false}
                  style={{
                    marginTop: 4,
                    fontSize: 14,
                    fontWeight: '500',
                    color: theme.colors.text.primary,
                    fontFamily: theme.fonts.sans,
                  }}
                >
                  Venue manager not available
                </Text>
              </View>
              <View
                style={[
                  styles.toggleTrack,
                  {
                    backgroundColor: adminUnavailable
                      ? theme.colors.accent
                      : theme.colors.surface.hairlineStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    { transform: [{ translateX: adminUnavailable ? 18 : 0 }] },
                  ]}
                />
              </View>
            </Pressable>

            {/* Path A — manager signing */}
            {!adminUnavailable ? (
              <>
                <View style={styles.fieldRow}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow style={{ marginBottom: 8 }}>Full name</Eyebrow>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Sara Khalil"
                      placeholderTextColor={theme.colors.text.tertiary}
                      autoCapitalize="words"
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.surface.card,
                          borderColor: theme.colors.surface.hairlineStrong,
                          color: theme.colors.text.primary,
                          fontFamily: theme.fonts.sans,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={[styles.fieldRow, { marginTop: 14 }]}>
                  <View style={{ flex: 1 }}>
                    <Eyebrow style={{ marginBottom: 8 }}>Role</Eyebrow>
                    <TextInput
                      value={role}
                      onChangeText={setRole}
                      placeholder="e.g. Duty Manager"
                      placeholderTextColor={theme.colors.text.tertiary}
                      autoCapitalize="words"
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.colors.surface.card,
                          borderColor: theme.colors.surface.hairlineStrong,
                          color: theme.colors.text.primary,
                          fontFamily: theme.fonts.sans,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Signature pad */}
                <View style={{ marginTop: 22 }}>
                  <View style={styles.signatureLabelRow}>
                    <Eyebrow color={theme.colors.accent}>Signature · required</Eyebrow>
                    <Pressable
                      onPress={handleClearSignature}
                      accessibilityRole="button"
                      accessibilityLabel="Clear signature"
                      hitSlop={8}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={{
                          fontFamily: theme.fonts.mono,
                          fontSize: 10,
                          letterSpacing: 1.6,
                          textTransform: 'uppercase',
                          color: theme.colors.text.secondary,
                        }}
                      >
                        Clear
                      </Text>
                    </Pressable>
                  </View>

                  <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Top hairline + "X" mark like a paper form */}
                    <View style={styles.signatureFrame}>
                      <View style={styles.signatureCanvasWrap}>
                        <Signature
                          ref={sigRef}
                          onOK={handleSignatureCapture}
                          onBegin={handleSignatureBegin}
                          onEnd={handleSignatureEnd}
                          webStyle={sigWebStyle}
                          backgroundColor="transparent"
                          penColor={theme.colors.text.primary}
                          autoClear={false}
                          descriptionText=""
                          imageType="image/png"
                          trimWhitespace
                        />
                      </View>
                      <View
                        style={[
                          styles.signatureLine,
                          { backgroundColor: theme.colors.surface.hairlineStrong },
                        ]}
                      />
                      <View style={styles.signatureFooter}>
                        <Text
                          allowFontScaling={false}
                          style={{
                            fontFamily: theme.fonts.mono,
                            fontSize: 10,
                            letterSpacing: 1.6,
                            textTransform: 'uppercase',
                            color: theme.colors.text.tertiary,
                          }}
                        >
                          ✕ Sign above
                        </Text>
                        {signature ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: theme.colors.status.online,
                              }}
                            />
                            <Text
                              allowFontScaling={false}
                              style={{
                                fontFamily: theme.fonts.mono,
                                fontSize: 10,
                                letterSpacing: 1.6,
                                textTransform: 'uppercase',
                                color: theme.colors.status.online,
                              }}
                            >
                              Captured
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </GlassCard>

                  {!signature ? (
                    <Pressable
                      onPress={handleConfirmSignature}
                      accessibilityRole="button"
                      accessibilityLabel="Confirm signature"
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          borderColor: theme.colors.surface.hairlineStrong,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={{
                          fontFamily: theme.fonts.sans,
                          fontSize: 14,
                          fontWeight: '500',
                          color: theme.colors.text.primary,
                        }}
                      >
                        Confirm signature
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Notes */}
                <View style={{ marginTop: 22 }}>
                  <Eyebrow style={{ marginBottom: 8 }}>Notes (optional)</Eyebrow>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Anything the next shift should know"
                    placeholderTextColor={theme.colors.text.tertiary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={[
                      styles.input,
                      {
                        minHeight: 88,
                        backgroundColor: theme.colors.surface.card,
                        borderColor: theme.colors.surface.hairlineStrong,
                        color: theme.colors.text.primary,
                        fontFamily: theme.fonts.sans,
                      },
                    ]}
                  />
                </View>
              </>
            ) : (
              // Path B — override
              <>
                <View
                  style={[
                    styles.overrideBanner,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accentBorder,
                    },
                  ]}
                >
                  <Svg width={16} height={16} viewBox="0 0 16 16">
                    <Path
                      d="M8 3 L14 14 H2 Z M8 7 V10 M8 11.5 V11.5"
                      stroke={theme.colors.accent}
                      strokeWidth={1.6}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text
                    allowFontScaling={false}
                    style={{
                      flex: 1,
                      marginLeft: 10,
                      fontSize: 13,
                      lineHeight: 18,
                      color: theme.colors.text.primary,
                      fontFamily: theme.fonts.sans,
                    }}
                  >
                    You’re closing the logbook without a manager signature. Your reason will be
                    flagged for review.
                  </Text>
                </View>

                <View style={{ marginTop: 18 }}>
                  <Eyebrow style={{ marginBottom: 8 }}>Reason · required</Eyebrow>
                  <TextInput
                    value={overrideReason}
                    onChangeText={setOverrideReason}
                    placeholder="e.g. Duty manager left at 23:30, end of trading"
                    placeholderTextColor={theme.colors.text.tertiary}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    style={[
                      styles.input,
                      {
                        minHeight: 140,
                        backgroundColor: theme.colors.surface.card,
                        borderColor: theme.colors.surface.hairlineStrong,
                        color: theme.colors.text.primary,
                        fontFamily: theme.fonts.sans,
                      },
                    ]}
                  />
                </View>
              </>
            )}
          </ScrollView>

          {/* Sticky footer */}
          <View
            style={[
              styles.footer,
              {
                paddingBottom: insets.bottom + 14,
                backgroundColor: theme.colors.canvas,
                borderTopColor: theme.colors.surface.hairline,
              },
            ]}
          >
            <PrimaryCTA
              label={
                submitting
                  ? 'Submitting…'
                  : adminUnavailable
                    ? 'Submit override'
                    : 'Submit signoff'
              }
              onPress={validateAndSubmit}
              disabled={submitting}
            />
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 10,
                textAlign: 'center',
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: theme.colors.text.tertiary,
              }}
            >
              Adds an immutable entry to the audit trail
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

interface SummaryStatProps {
  label: string;
  value: string;
  emphasis?: boolean;
  theme: ReturnType<typeof useRedesignTheme>;
}

const SummaryStat: React.FC<SummaryStatProps> = ({ label, value, emphasis, theme }) => (
  <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 16 }}>
    <Eyebrow tracking={1.8}>{label}</Eyebrow>
    <Text
      allowFontScaling={false}
      style={{
        marginTop: 6,
        fontSize: 28,
        fontWeight: '300',
        letterSpacing: -0.8,
        color: emphasis ? theme.colors.accent : theme.colors.text.primary,
        fontFamily: theme.fonts.sans,
      }}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  summaryStrip: {
    marginTop: 22,
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryDivider: {
    width: 1,
  },
  toggleRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  fieldRow: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  signatureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  signatureFrame: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signatureCanvasWrap: {
    height: 200,
  },
  signatureLine: {
    height: 1,
    marginTop: 4,
  },
  signatureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  confirmBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideBanner: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
});

export default LogbookSignoffModal;
