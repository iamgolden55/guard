/**
 * ReleaseShiftModal - Modal for releasing shifts to the open pool
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { Button } from '../ui';
import exchangeService from '../../services/exchangeService';
import { Shift } from '../../store/slices/shiftsSlice';

interface ReleaseShiftModalProps {
  visible: boolean;
  shift: Shift | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReleaseShiftModal: React.FC<ReleaseShiftModalProps> = ({
  visible,
  shift,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!shift) return;

    // Client-side validation: Check if shift has already started
    const shiftStartTime = new Date(shift.start_time);
    const now = new Date();

    if (shiftStartTime <= now) {
      Alert.alert(
        'Cannot Release Shift',
        'This shift has already started and cannot be released to the pool.'
      );
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for releasing this shift');
      return;
    }

    try {
      setSubmitting(true);

      await exchangeService.releaseShift({
        shift_id: shift.id,
        request_reason: reason.trim(),
      });

      Alert.alert(
        'Success',
        'Shift released to the open pool. Other staff members can now claim it.',
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error releasing shift:', error);

      // ApiError now contains the actual error message from Django
      const errorMessage = error.message || 'Failed to release shift. Please try again.';

      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  if (!shift) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>Release to Pool</Text>
            <View style={styles.headerRight} />
          </View>

          {/* Shift Info - Enhanced with prominent date */}
          <View style={styles.shiftInfo}>
            {/* Prominent Date Badge */}
            <View style={styles.dateHighlight}>
              <Text style={styles.dateHighlightDay}>
                {new Date(shift.start_time).getDate()}
              </Text>
              <Text style={styles.dateHighlightMonth}>
                {new Date(shift.start_time).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
              <Text style={styles.dateHighlightYear}>
                {new Date(shift.start_time).getFullYear()}
              </Text>
            </View>

            <Text style={styles.shiftInfoTitle}>{shift.venue.name.toUpperCase()}</Text>
            <Text style={styles.shiftInfoText}>
              {new Date(shift.start_time).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <Text style={styles.shiftInfoTime}>
              {new Date(shift.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' - '}
              {new Date(shift.end_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              {/* Info Message */}
              <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={colors.info} />
              <Text style={styles.infoText}>
                Releasing this shift will make it available for other qualified staff members to
                claim. You will be notified when someone claims it.
              </Text>
            </View>

            {/* Reason Input */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Reason for releasing: <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="E.g., Personal emergency, schedule conflict, illness, etc."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
                autoFocus
              />
              <Text style={styles.characterCount}>{reason.length}/500</Text>
            </View>

            {/* Warning */}
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <Text style={styles.warningText}>
                This action requires manager approval. You will remain assigned to the shift until
                a manager approves someone else's claim.
              </Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={handleClose}
              style={styles.footerButton}
              disabled={submitting}
            />
            <Button
              title={submitting ? 'Releasing...' : 'Release Shift'}
              variant="primary"
              onPress={handleSubmit}
              style={styles.footerButton}
              disabled={submitting || !reason.trim()}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  shiftInfo: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
  },
  // Prominent date display
  dateHighlight: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    alignItems: 'center',
    minWidth: 100,
  },
  dateHighlightDay: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 40,
  },
  dateHighlightMonth: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    marginTop: 2,
  },
  dateHighlightYear: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  shiftInfoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  shiftInfoText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 2,
    textAlign: 'center',
  },
  shiftInfoTime: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  section: {
    marginTop: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning + '15',
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.lg,
  },
  footerButton: {
    flex: 1,
  },
});
