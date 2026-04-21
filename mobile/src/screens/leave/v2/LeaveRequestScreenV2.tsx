/**
 * LeaveRequestScreenV2 — Phase 4 re-skin of the permanent-employee leave
 * request form. Preserves Redux wiring (fetchMyBalances / fetchLeaveTypes /
 * createLeaveRequest), validation and the contractor redirect gate.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import type { LeaveType } from '../../../types/leave.types';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import {
  fetchMyBalances,
  fetchLeaveTypes,
  createLeaveRequest,
  selectLeaveBalances,
  selectLeaveTypes,
  clearMessages,
} from '../../../store/slices/leaveSlice';
import { leaveService } from '../../../services/leaveService';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const LEAVE_ICON_MAP: Record<string, string> = {
  ANNUAL: 'M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7',
  SICK: 'M12 4 v16 M4 12 h16',
  PERSONAL: 'M12 12 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M4 20 c 0 -4 4 -6 8 -6 s 8 2 8 6',
  MATERNITY: 'M12 4 a4 4 0 1 0 0 8 a4 4 0 0 0 0 -8 M8 14 c 2 2 6 2 8 0 L18 20 H6 Z',
  PATERNITY: 'M12 4 a4 4 0 1 0 0 8 a4 4 0 0 0 0 -8 M8 14 c 2 2 6 2 8 0 L18 20 H6 Z',
  BEREAVEMENT: 'M6 3 V21 M6 4 H18 L16 10 L18 16 H6',
};

const formatDays = (n: number) => n.toFixed(n % 1 === 0 ? 0 : 1);
const hexAlpha = (hex: string, alpha: number): string => {
  const raw = (hex || '').replace('#', '');
  if (raw.length !== 3 && raw.length !== 6) return `rgba(225,52,44,${alpha})`;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(225,52,44,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

export const LeaveRequestScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const dispatch = useAppDispatch();

  const user = useAppSelector((state) => state.auth.user);
  const employmentCategory = user?.staff_profile?.employment_type?.employment_category;
  const isContractor =
    employmentCategory === 'contractor' || employmentCategory === 'temporary';

  useEffect(() => {
    if (isContractor) {
      Alert.alert(
        'Access Restricted',
        'Leave requests are only available for permanent employees. As a contractor, please use the Availability feature to manage your schedule.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    }
  }, [isContractor, navigation]);

  const balances = useAppSelector(selectLeaveBalances);
  const leaveTypes = useAppSelector(selectLeaveTypes);
  const loading = useAppSelector((state) => state.leave.requestsLoading);
  const successMessage = useAppSelector((state) => state.leave.successMessage);

  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [workingDays, setWorkingDays] = useState(0);

  useEffect(() => {
    dispatch(fetchMyBalances());
    dispatch(fetchLeaveTypes());
  }, [dispatch]);

  useEffect(() => {
    if (successMessage) {
      Alert.alert('Success', successMessage, [
        {
          text: 'OK',
          onPress: () => {
            dispatch(clearMessages());
            navigation.goBack();
          },
        },
      ]);
    }
  }, [successMessage, dispatch, navigation]);

  useEffect(() => {
    if (startDate && endDate) {
      const days = leaveService.calculateWorkingDays(
        leaveService.formatDateForAPI(startDate),
        leaveService.formatDateForAPI(endDate),
      );
      setWorkingDays(days);
    }
  }, [startDate, endDate]);

  const availableBalance = useMemo(() => {
    if (!selectedLeaveTypeId) return null;
    const balance = balances.find((b) => b.leave_type.id === selectedLeaveTypeId);
    return balance?.available_balance ?? 0;
  }, [selectedLeaveTypeId, balances]);

  const submitRequest = useCallback(async () => {
    await dispatch(
      createLeaveRequest({
        leave_type_id: selectedLeaveTypeId!,
        start_date: leaveService.formatDateForAPI(startDate),
        end_date: leaveService.formatDateForAPI(endDate),
        reason: reason.trim(),
      }),
    );
  }, [dispatch, selectedLeaveTypeId, startDate, endDate, reason]);

  const handleSubmit = async () => {
    if (!selectedLeaveTypeId) {
      Alert.alert('Error', 'Please select a leave type');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for your leave');
      return;
    }
    if (workingDays <= 0) {
      Alert.alert('Error', 'Please select valid dates');
      return;
    }
    if (availableBalance !== null && workingDays > availableBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You only have ${availableBalance.toFixed(1)} days available. You're requesting ${workingDays} days.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Anyway', onPress: submitRequest },
        ],
      );
      return;
    }
    submitRequest();
  };

  const canSubmit =
    !loading && selectedLeaveTypeId !== null && reason.trim().length > 0 && workingDays > 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 56,
            paddingHorizontal: 20,
            paddingBottom: 120 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Eyebrow color={theme.colors.accent}>New request</Eyebrow>
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
            Request leave
          </Text>
          <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
            Pick a type, choose dates, add a reason
          </Eyebrow>

          {/* Leave type selector */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Leave type</Eyebrow>
          {leaveTypes && leaveTypes.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 18 }}>
              {leaveTypes.map((lt) => {
                const balance = balances.find((b) => b.leave_type.id === lt.id);
                const isSelected = selectedLeaveTypeId === lt.id;
                return (
                  <LeaveTypeRow
                    key={lt.id}
                    leaveType={lt}
                    available={balance?.available_balance}
                    selected={isSelected}
                    onPress={() => setSelectedLeaveTypeId(lt.id)}
                  />
                );
              })}
            </View>
          ) : (
            <GlassCard
              style={{
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 10,
                marginBottom: 18,
              }}
            >
              <ActivityIndicator color={theme.colors.accent} size="small" />
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
                Loading leave types
              </Text>
            </GlassCard>
          )}

          {/* Dates */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Dates</Eyebrow>
          <GlassCard style={{ padding: 16, marginBottom: 18 }}>
            <View style={{ gap: 10 }}>
              <DateRow
                label="Start"
                value={startDate}
                onPress={() => setShowStartPicker(true)}
              />
              <DateRow
                label="End"
                value={endDate}
                onPress={() => setShowEndPicker(true)}
              />
            </View>

            {workingDays > 0 ? (
              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.accentSoft,
                  borderWidth: 1,
                  borderColor: theme.colors.accentBorder,
                }}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 6 v6 l4 2 M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20"
                    stroke={theme.colors.accent}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: theme.colors.accent,
                    fontWeight: '500',
                  }}
                >
                  {workingDays} working day{workingDays !== 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}

            {selectedLeaveTypeId && availableBalance !== null ? (
              <View
                style={{
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 10,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor:
                    workingDays > availableBalance
                      ? theme.colors.accentBorder
                      : theme.colors.surface.hairline,
                }}
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
                  Available balance
                </Text>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 15,
                    color:
                      workingDays > availableBalance
                        ? theme.colors.accent
                        : theme.colors.text.primary,
                    fontWeight: '500',
                  }}
                >
                  {formatDays(availableBalance)} days
                </Text>
              </View>
            ) : null}
          </GlassCard>

          {/* Reason */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Reason</Eyebrow>
          <GlassCard style={{ padding: 16, marginBottom: 18 }}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Family holiday"
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              maxLength={200}
              numberOfLines={4}
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
              {reason.length}/200
            </Text>
          </GlassCard>

          {/* Info banner */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              padding: 12,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>
                i
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                color: theme.colors.text.secondary,
                lineHeight: 18,
              }}
            >
              Requests are reviewed by your manager. You'll be notified when the status
              changes.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Back button */}
      <Pressable
        onPress={() => navigation.goBack()}
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

      {/* Footer CTA */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: insets.bottom + 16,
        }}
      >
        <PrimaryCTA
          label={loading ? 'Submitting…' : 'Submit request'}
          trailingArrow={!loading}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />
      </View>

      {/* iOS pickers */}
      {Platform.OS === 'ios' ? (
        <>
          <IOSPickerModal
            visible={showStartPicker}
            title="Start date"
            value={startDate}
            onChange={(d) => {
              setStartDate(d);
              if (d > endDate) setEndDate(d);
            }}
            onDone={() => setShowStartPicker(false)}
          />
          <IOSPickerModal
            visible={showEndPicker}
            title="End date"
            value={endDate}
            minimumDate={startDate}
            onChange={(d) => setEndDate(d)}
            onDone={() => setShowEndPicker(false)}
          />
        </>
      ) : null}

      {/* Android pickers */}
      {Platform.OS === 'android' && showStartPicker ? (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShowStartPicker(false);
            if (d) {
              setStartDate(d);
              if (d > endDate) setEndDate(d);
            }
          }}
        />
      ) : null}
      {Platform.OS === 'android' && showEndPicker ? (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          minimumDate={startDate}
          onChange={(_, d) => {
            setShowEndPicker(false);
            if (d) setEndDate(d);
          }}
        />
      ) : null}
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────

const LeaveTypeRow: React.FC<{
  leaveType: LeaveType;
  available: number | undefined;
  selected: boolean;
  onPress: () => void;
}> = ({ leaveType, available, selected, onPress }) => {
  const theme = useRedesignTheme();
  const color = leaveType.color_code || theme.colors.accent;
  const iconPath = LEAVE_ICON_MAP[leaveType.code] || LEAVE_ICON_MAP.ANNUAL;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 14,
        borderRadius: theme.radii.xl,
        backgroundColor: selected
          ? hexAlpha(color, 0.1)
          : theme.colors.surface.card,
        borderWidth: 1,
        borderColor: selected
          ? hexAlpha(color, 0.45)
          : theme.colors.surface.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: hexAlpha(color, 0.14),
          borderWidth: 1,
          borderColor: hexAlpha(color, 0.4),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d={iconPath}
            stroke={color}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
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
          {leaveType.name}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 2,
            fontFamily: theme.fonts.mono,
            fontSize: 9,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: theme.colors.text.tertiary,
          }}
        >
          {available !== undefined ? `${formatDays(available)} days left` : leaveType.code}
        </Text>
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: selected ? color : theme.colors.surface.hairline,
          backgroundColor: selected ? color : 'transparent',
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
};

const DateRow: React.FC<{ label: string; value: Date; onPress: () => void }> = ({
  label,
  value,
  onPress,
}) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.surface.chip,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
            stroke={theme.colors.text.secondary}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
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
          {label}
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}
      >
        {value.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </Text>
    </Pressable>
  );
};

const IOSPickerModal: React.FC<{
  visible: boolean;
  title: string;
  value: Date;
  minimumDate?: Date;
  onChange: (d: Date) => void;
  onDone: () => void;
}> = ({ visible, title, value, minimumDate, onChange, onDone }) => {
  const theme = useRedesignTheme();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: theme.isDark ? '#141417' : '#ffffff',
              borderColor: theme.colors.surface.hairline,
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.surface.hairline,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: theme.colors.text.secondary,
              }}
            >
              {title}
            </Text>
            <Pressable onPress={onDone} hitSlop={8}>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: theme.colors.accent,
                  fontWeight: '500',
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
          <View style={{ paddingVertical: 8 }}>
            <DateTimePicker
              value={value}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              themeVariant={theme.isDark ? 'dark' : 'light'}
              accentColor={theme.colors.accent}
              onChange={(_, d) => {
                if (d) onChange(d);
              }}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});

export default LeaveRequestScreenV2;
