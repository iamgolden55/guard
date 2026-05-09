/**
 * LogbookSignoffModal
 *
 * End-of-shift signoff for the digital capacity-check logbook.
 *
 * The signer is the venue's own duty manager — an external person, not a
 * Guard user. Captures their typed name, role, and signature. If the duty
 * manager isn't available, staff can fall back to an override path (a
 * captured reason replaces the signature for the audit trail).
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { Ionicons } from '@expo/vector-icons';
import { Body, BodySmall, Button } from '@components/ui';
import { colors, getColors, spacing, layout } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { logger } from '../utils/logger';
import { shiftChecksService } from '../services/shiftChecksService';

interface LogbookSignoffModalProps {
  visible: boolean;
  shiftGroup: string;
  venueId: number;
  venueName: string;
  totalChecks: number;
  totalMissed: number;
  onClose: () => void;
  onSubmitted: () => void;
}

export const LogbookSignoffModal: React.FC<LogbookSignoffModalProps> = ({
  visible,
  shiftGroup,
  venueId,
  venueName,
  totalChecks,
  totalMissed,
  onClose,
  onSubmitted,
}) => {
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);

  // Form state
  const [name, setName] = useState('');
  const [role, setRole] = useState('Duty Manager');
  const [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Override path
  const [useOverride, setUseOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const signatureRef = useRef<any>(null);

  const signatureStyle = useMemo(
    () => `
      .signature-pad { width: 100%; height: 100%; background-color: ${isDark ? '#1f2937' : 'white'}; }
      .signature-pad-body { border: 2px solid ${themeColors.border.light}; border-radius: 8px; }
    `,
    [isDark, themeColors.border.light],
  );

  const resetState = () => {
    setName('');
    setRole('Duty Manager');
    setNotes('');
    setSignature(null);
    setHasDrawn(false);
    setIsDrawing(false);
    setUseOverride(false);
    setOverrideReason('');
    setSubmitting(false);
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleClose = () => {
    if (submitting) return;
    if ((hasDrawn && signature) || name || overrideReason) {
      Alert.alert(
        'Discard signoff?',
        'Your input will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              resetState();
              onClose();
            },
          },
        ],
      );
    } else {
      onClose();
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) signatureRef.current.clearSignature();
    setSignature(null);
    setHasDrawn(false);
  };

  const handleSubmit = async () => {
    if (useOverride) {
      const trimmedReason = overrideReason.trim();
      if (!trimmedReason) {
        Alert.alert('Reason required', 'Please describe why the venue admin could not sign.');
        return;
      }
      try {
        setSubmitting(true);
        await shiftChecksService.submitLogbookSignoff({
          shift_group: shiftGroup,
          venue: venueId,
          override_reason: trimmedReason,
          notes: notes.trim() || undefined,
        });
        logger.info('[LogbookSignoff] Submitted via override');
        resetState();
        onSubmitted();
      } catch (e: any) {
        logger.error('[LogbookSignoff] Override submission failed:', e);
        Alert.alert('Error', e?.message || 'Could not submit signoff. Please try again.');
        setSubmitting(false);
      }
      return;
    }

    // Signature path
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter the venue admin’s name.');
      return;
    }
    if (!hasDrawn || !signature) {
      Alert.alert('Signature required', 'Please ask the venue admin to sign before submitting.');
      return;
    }
    try {
      setSubmitting(true);
      await shiftChecksService.submitLogbookSignoff({
        shift_group: shiftGroup,
        venue: venueId,
        closed_by_name: trimmedName,
        closed_by_role: trimmedRole,
        signature,
        notes: notes.trim() || undefined,
      });
      logger.info('[LogbookSignoff] Submitted with signature');
      resetState();
      onSubmitted();
    } catch (e: any) {
      logger.error('[LogbookSignoff] Submission failed:', e);
      Alert.alert('Error', e?.message || 'Could not submit signoff. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.background.primary, borderBottomColor: themeColors.border.light }]}>
          <TouchableOpacity onPress={handleClose} style={styles.iconButton}>
            <Ionicons name="close" size={28} color={themeColors.text.primary} />
          </TouchableOpacity>
          <Body style={[styles.headerTitle, { color: themeColors.text.primary }]}>
            Sign off logbook
          </Body>
          <View style={styles.iconButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDrawing}
        >
          {/* Summary */}
          <View style={[styles.summary, { backgroundColor: themeColors.background.secondary }]}>
            <Body style={[styles.summaryTitle, { color: themeColors.text.primary }]}>
              {venueName}
            </Body>
            <BodySmall color={themeColors.text.secondary}>
              {totalChecks} check{totalChecks === 1 ? '' : 's'} logged · {totalMissed} missed
            </BodySmall>
          </View>

          {!useOverride ? (
            <>
              {/* Signer details */}
              <Body style={[styles.label, { color: themeColors.text.primary }]}>
                Venue admin name *
              </Body>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.background.primary, color: themeColors.text.primary, borderColor: themeColors.border.light }]}
                placeholder="e.g. Jane Smith"
                placeholderTextColor={themeColors.text.tertiary}
                value={name}
                onChangeText={setName}
                editable={!submitting}
              />

              <Body style={[styles.label, { color: themeColors.text.primary }]}>
                Role
              </Body>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.background.primary, color: themeColors.text.primary, borderColor: themeColors.border.light }]}
                placeholder="e.g. Duty Manager"
                placeholderTextColor={themeColors.text.tertiary}
                value={role}
                onChangeText={setRole}
                editable={!submitting}
              />

              {/* Signature */}
              <Body style={[styles.label, { color: themeColors.text.primary }]}>
                Signature *
              </Body>
              <BodySmall color={themeColors.text.secondary} style={styles.helper}>
                Hand the device to the venue admin to sign.
              </BodySmall>
              <View
                style={[
                  styles.canvasContainer,
                  { backgroundColor: isDark ? '#1f2937' : colors.white, borderColor: themeColors.border.light },
                ]}
              >
                <SignatureCanvas
                  ref={signatureRef}
                  onOK={(data: string) => setSignature(data)}
                  onBegin={() => {
                    setHasDrawn(true);
                    setIsDrawing(true);
                  }}
                  onEnd={() => {
                    setIsDrawing(false);
                    if (signatureRef.current) signatureRef.current.readSignature();
                  }}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Done"
                  webStyle={signatureStyle}
                  autoClear={false}
                  backgroundColor="rgba(255,255,255,0)"
                  penColor={isDark ? '#ffffff' : colors.text.primary}
                  minWidth={2}
                  maxWidth={4}
                />
              </View>
              <TouchableOpacity
                onPress={handleClearSignature}
                style={styles.clearButton}
                disabled={!hasDrawn || submitting}
              >
                <Ionicons
                  name="refresh"
                  size={18}
                  color={hasDrawn ? colors.primary : colors.gray[400]}
                />
                <BodySmall
                  style={[
                    styles.clearButtonText,
                    { color: hasDrawn ? colors.primary : colors.gray[400] },
                  ]}
                >
                  Clear signature
                </BodySmall>
              </TouchableOpacity>

              {/* Optional notes */}
              <Body style={[styles.label, { color: themeColors.text.primary }]}>
                Closing notes (optional)
              </Body>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: themeColors.background.primary, color: themeColors.text.primary, borderColor: themeColors.border.light }]}
                placeholder="Any closing remarks for the audit trail"
                placeholderTextColor={themeColors.text.tertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!submitting}
              />

              {/* Override toggle */}
              <TouchableOpacity
                onPress={() => setUseOverride(true)}
                style={styles.overrideToggle}
                disabled={submitting}
              >
                <Ionicons name="warning-outline" size={18} color={themeColors.warning} />
                <BodySmall color={themeColors.warning} style={styles.overrideToggleText}>
                  Venue admin not available?
                </BodySmall>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Override path */}
              <View style={[styles.overrideBanner, { backgroundColor: themeColors.warning + '15', borderColor: themeColors.warning }]}>
                <Ionicons name="alert-circle" size={20} color={themeColors.warning} />
                <BodySmall color={themeColors.text.primary} style={styles.overrideBannerText}>
                  No signature will be captured. Your reason will be recorded in the audit trail.
                </BodySmall>
              </View>

              <Body style={[styles.label, { color: themeColors.text.primary }]}>
                Reason *
              </Body>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: themeColors.background.primary, color: themeColors.text.primary, borderColor: themeColors.border.light }]}
                placeholder="e.g. Duty manager left at 02:30, no on-site replacement"
                placeholderTextColor={themeColors.text.tertiary}
                value={overrideReason}
                onChangeText={setOverrideReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!submitting}
              />

              <TouchableOpacity
                onPress={() => {
                  setUseOverride(false);
                  setOverrideReason('');
                }}
                style={styles.overrideToggle}
                disabled={submitting}
              >
                <Ionicons name="arrow-back" size={18} color={themeColors.primary} />
                <BodySmall color={themeColors.primary} style={styles.overrideToggleText}>
                  Back to signature
                </BodySmall>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: themeColors.background.primary, borderTopColor: themeColors.border.light }]}>
          <Button
            variant="primary"
            size="large"
            onPress={handleSubmit}
            disabled={submitting}
            fullWidth
            title={submitting ? 'Submitting…' : useOverride ? 'Submit override' : 'Submit signoff'}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing['3xl'] : spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '600', fontSize: 18 },
  content: { flex: 1 },
  contentContainer: { padding: spacing.xl },
  summary: {
    padding: spacing.md,
    borderRadius: layout.borderRadius.md,
    marginBottom: spacing.lg,
  },
  summaryTitle: { fontWeight: '700', marginBottom: 2 },
  label: { fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  helper: { marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
  },
  textArea: { minHeight: 90, paddingTop: spacing.md },
  canvasContainer: {
    height: 220,
    width: '100%',
    borderWidth: 2,
    borderRadius: layout.borderRadius.md,
    overflow: 'hidden',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  clearButtonText: { marginLeft: spacing.xs, fontWeight: '500' },
  overrideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  overrideToggleText: { marginLeft: spacing.xs, fontWeight: '600' },
  overrideBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: layout.borderRadius.md,
    marginBottom: spacing.md,
  },
  overrideBannerText: { flex: 1, marginLeft: spacing.sm },
  footer: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.xl,
    borderTopWidth: 1,
  },
});
