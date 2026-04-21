/**
 * TransferShiftModalV2 — Phase 4 re-skin of the transfer-shift flow.
 * Preserves API wiring (apiService.get eligible staff, exchangeService.createExchange)
 * and the onSuccess callback contract.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import exchangeService from '../../../services/exchangeService';
import { apiService } from '../../../services/api';
import type { Shift } from '../../../store/slices/shiftsSlice';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../redesign';

interface StaffMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface Props {
  visible: boolean;
  shift: Shift | null;
  onClose: () => void;
  onSuccess: () => void;
}

const getInitials = (first: string, last: string) =>
  `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

const hashHue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export const TransferShiftModalV2: React.FC<Props> = ({
  visible,
  shift,
  onClose,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible && shift) {
      fetchStaff();
    }
  }, [visible, shift]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<StaffMember[]>(
        `/api/v1/users/eligible-for-transfer/?shift_id=${shift!.id}`,
      );
      setStaffMembers(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Error fetching staff:', err);
      Alert.alert('Error', 'Failed to load staff members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedStaff(null);
    setReason('');
    setSearchQuery('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!shift || !selectedStaff) {
      Alert.alert('Error', 'Please select a staff member');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the transfer');
      return;
    }
    try {
      setSubmitting(true);
      await exchangeService.createExchange({
        original_shift: shift.id,
        target_user: selectedStaff.id,
        request_reason: reason.trim(),
      });
      Alert.alert(
        'Request sent',
        `Shift transfer request sent to ${selectedStaff.first_name} ${selectedStaff.last_name}.`,
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
      console.error('Error creating exchange:', err);
      Alert.alert(
        'Error',
        err.message || 'Failed to create transfer request. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return staffMembers;
    return staffMembers.filter((s) => {
      const full = `${s.first_name} ${s.last_name}`.toLowerCase();
      return (
        full.includes(q) ||
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [staffMembers, searchQuery]);

  if (!shift) return null;

  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);

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
            <Eyebrow color={theme.colors.accent}>Transfer</Eyebrow>
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
              Transfer shift
            </Text>
            <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
              Send this shift to a teammate for approval
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

            {/* Staff selector */}
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
              Select teammate
            </Eyebrow>

            {!loading && staffMembers.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairline,
                  marginBottom: 12,
                }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M11 4 a7 7 0 1 0 0 14 a7 7 0 0 0 0 -14 M20 20 l-3 -3"
                    stroke={theme.colors.text.tertiary}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: theme.colors.text.primary,
                  }}
                  placeholder="Search by name or email"
                  placeholderTextColor={theme.colors.text.tertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                    <Svg width={14} height={14} viewBox="0 0 24 24">
                      <Path
                        d="M5 5 L19 19 M19 5 L5 19"
                        stroke={theme.colors.text.tertiary}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={theme.colors.accent} />
                <Text
                  allowFontScaling={false}
                  style={{
                    marginTop: 10,
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: theme.colors.text.tertiary,
                  }}
                >
                  Loading teammates
                </Text>
              </View>
            ) : staffMembers.length === 0 ? (
              <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M8 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M16 13 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 M2 21 c 0 -4 3 -6 6 -6 s 6 2 6 6 M14 21 c 0 -3 2 -5 4 -5 s 4 2 4 5"
                    stroke={theme.colors.text.tertiary}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text
                  allowFontScaling={false}
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: theme.colors.text.secondary,
                  }}
                >
                  No teammates available
                </Text>
              </GlassCard>
            ) : filtered.length === 0 ? (
              <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text
                  allowFontScaling={false}
                  style={{ fontSize: 14, color: theme.colors.text.secondary }}
                >
                  No results for "{searchQuery}"
                </Text>
              </GlassCard>
            ) : (
              <View style={{ gap: 8 }}>
                {filtered.map((s) => {
                  const selected = selectedStaff?.id === s.id;
                  const initials = getInitials(s.first_name, s.last_name);
                  const hue = hashHue(s.first_name + s.last_name);
                  const avatarBg = `hsl(${hue}, 45%, ${theme.isDark ? 25 : 78}%)`;
                  const avatarFg = theme.isDark ? '#fff' : '#222';
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedStaff(s)}
                      style={({ pressed }) => ({
                        padding: 14,
                        borderRadius: theme.radii.xl,
                        backgroundColor: selected
                          ? theme.colors.accentSoft
                          : theme.colors.surface.card,
                        borderWidth: 1,
                        borderColor: selected
                          ? theme.colors.accentBorder
                          : theme.colors.surface.hairline,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: avatarBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          allowFontScaling={false}
                          style={{
                            fontSize: 15,
                            fontWeight: '500',
                            color: avatarFg,
                            letterSpacing: -0.3,
                          }}
                        >
                          {initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={{
                            fontSize: 15,
                            color: theme.colors.text.primary,
                            fontWeight: '500',
                            letterSpacing: -0.2,
                          }}
                        >
                          {s.first_name} {s.last_name}
                        </Text>
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={{
                            marginTop: 2,
                            fontFamily: theme.fonts.mono,
                            fontSize: 10,
                            letterSpacing: 1.2,
                            color: theme.colors.text.tertiary,
                          }}
                        >
                          {s.email}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1.5,
                          borderColor: selected
                            ? theme.colors.accent
                            : theme.colors.surface.hairline,
                          backgroundColor: selected
                            ? theme.colors.accent
                            : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selected ? (
                          <Svg width={12} height={12} viewBox="0 0 24 24">
                            <Path
                              d="M5 12 L10 17 L19 7"
                              stroke="#fff"
                              strokeWidth={2.4}
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </Svg>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Reason */}
            <Eyebrow style={{ marginLeft: 4, marginTop: 20, marginBottom: 10 }}>
              Why are you transferring?
            </Eyebrow>
            <GlassCard style={{ padding: 14 }}>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Personal emergency, schedule conflict, family matter…"
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
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

        {/* Back button */}
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
              label={submitting ? 'Sending…' : 'Send request'}
              trailingArrow={!submitting}
              disabled={submitting || !selectedStaff || !reason.trim()}
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

export default TransferShiftModalV2;
