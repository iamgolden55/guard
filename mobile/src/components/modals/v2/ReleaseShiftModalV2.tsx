/**
 * ReleaseShiftModalV2 — Phase 4 re-skin of the release-to-pool flow.
 * Preserves exchangeService.releaseShift wiring and the onSuccess callback.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import exchangeService from '../../../services/exchangeService';
import type { Shift } from '../../../store/slices/shiftsSlice';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../redesign';

interface Props {
  visible: boolean;
  shift: Shift | null;
  onClose: () => void;
  onSuccess: () => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const ReleaseShiftModalV2: React.FC<Props> = ({
  visible,
  shift,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!shift) return;

    const now = new Date();
    const shiftStart = new Date(shift.start_time);
    if (shiftStart <= now) {
      Alert.alert(
        'Cannot Release Shift',
        'This shift has already started and cannot be released to the pool.',
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
        'Released to pool',
        'Other staff members can now claim this shift. You will remain assigned until a manager approves.',
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
              onSuccess();
            },
          },
        ],
      );
    } catch (err: any) {
      console.error('Error releasing shift:', err);
      Alert.alert(
        'Error',
        err.message || 'Failed to release shift. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!shift) return null;

  const start = new Date(shift.start_time);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: insets.top + 56,
              paddingHorizontal: 20,
              paddingBottom: 140 + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Eyebrow color={theme.colors.accent}>Release</Eyebrow>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 10,
                fontSize: 28,
                color: theme.colors.text.primary,
                fontWeight: '400',
                letterSpacing: -0.8,
              }}
            >
              Release to pool
            </Text>
            <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
              Make this shift available for other qualified staff
            </Eyebrow>

            {/* Hero card */}
            <GlassCard style={{ padding: 16, marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 56,
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: theme.colors.accentSoft,
                    borderWidth: 1,
                    borderColor: theme.colors.accentBorder,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 9,
                      letterSpacing: 1.6,
                      color: theme.colors.accent,
                      fontWeight: '500',
                    }}
                  >
                    {start.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 2,
                      fontSize: 22,
                      color: theme.colors.text.primary,
                      fontWeight: '400',
                      letterSpacing: -0.6,
                    }}
                  >
                    {start.getDate()}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 1,
                      fontFamily: theme.fonts.mono,
                      fontSize: 9,
                      letterSpacing: 1.6,
                      color: theme.colors.text.tertiary,
                    }}
                  >
                    {start
                      .toLocaleDateString('en-GB', { month: 'short' })
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{
                      fontSize: 17,
                      color: theme.colors.text.primary,
                      fontWeight: '500',
                      letterSpacing: -0.3,
                    }}
                  >
                    {shift.venue.name}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 3,
                      fontSize: 12,
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {start.toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 4,
                      fontFamily: theme.fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.6,
                      color: theme.colors.text.tertiary,
                    }}
                  >
                    {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Info banner */}
            <View
              style={{
                padding: 14,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.surface.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20 M12 8 v5 M12 16 h.01"
                    stroke={theme.colors.text.secondary}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: theme.colors.text.secondary,
                  lineHeight: 19,
                }}
              >
                Qualified staff will see this shift in the open pool. You'll be
                notified when someone claims it.
              </Text>
            </View>

            {/* Warning banner */}
            <View
              style={{
                padding: 14,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: theme.colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3 L2 21 H22 Z M12 9 V14 M12 17 h.01"
                    stroke="#fff"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: theme.colors.accent,
                  lineHeight: 19,
                  fontWeight: '500',
                }}
              >
                Manager approval required. You remain assigned to the shift
                until a manager approves someone else's claim.
              </Text>
            </View>

            {/* Reason */}
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
              Why are you releasing?
            </Eyebrow>
            <GlassCard style={{ padding: 14 }}>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Personal emergency, schedule conflict, illness…"
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                autoFocus
                style={{
                  minHeight: 90,
                  padding: 12,
                  borderRadius: theme.radii.lg,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairline,
                  color: theme.colors.text.primary,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              />
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 6,
                  textAlign: 'right',
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.4,
                  color: theme.colors.text.tertiary,
                }}
              >
                {reason.length}/500
              </Text>
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Back */}
        <Pressable
          onPress={handleClose}
          disabled={submitting}
          style={({ pressed }) => [
            styles.navBtn,
            {
              top: insets.top + 12,
              backgroundColor: theme.colors.surface.chip,
              borderColor: theme.colors.surface.hairline,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Svg width={10} height={16} viewBox="0 0 10 16">
            <Path
              d="M8 2 L2 8 L8 14"
              stroke={theme.colors.text.primary}
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>

        {/* Footer */}
        <View
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            bottom: insets.bottom + 16,
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleClose}
            disabled={submitting}
            style={({ pressed }) => ({
              flex: 1,
              height: 54,
              borderRadius: 27,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 14,
                color: theme.colors.text.primary,
                fontWeight: '500',
                letterSpacing: -0.1,
              }}
            >
              Cancel
            </Text>
          </Pressable>
          <View style={{ flex: 1.4 }}>
            <PrimaryCTA
              label={submitting ? 'Releasing…' : 'Release shift'}
              trailingArrow={!submitting}
              disabled={submitting || !reason.trim()}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navBtn: {
    position: 'absolute',
    left: 20,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReleaseShiftModalV2;
