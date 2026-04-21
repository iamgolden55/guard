/**
 * EditShiftScreenV2 — Phase 4 re-skin of the admin reschedule form.
 * Preserves load/save wiring (shiftsService.fetchShift, updateShiftThunk
 * diff-only PATCH) and pay-rate inference.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../../hooks/useRedux';
import {
  selectManageShifts,
  selectManageShiftsMutating,
  updateShiftThunk,
} from '../../../../store/slices/manageShiftsSlice';
import { shiftsService } from '../../../../services/shiftsService';
import {
  systemSettingsService,
  type SystemRates,
} from '../../../../services/systemSettingsService';
import type { Shift } from '../../../../store/slices/shiftsSlice';
import type { MainStackParamList } from '../../../../types/navigation';
import { logger } from '../../../../utils/logger';
import { useRedesignTheme } from '../../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type EditShiftRoute = RouteProp<MainStackParamList, 'EditShift'>;
type PayRateType = 'static' | 'standard' | 'custom';
type PickerField = null | 'startDate' | 'startTime' | 'endDate' | 'endTime';

const RATE_EPSILON = 0.01;
const approxEqual = (a: number, b: number) => Math.abs(a - b) < RATE_EPSILON;

const inferPayRate = (
  shift: Shift | null,
  rates: SystemRates | null,
): { type: PayRateType; custom: string } => {
  if (!shift || !rates) return { type: 'static', custom: '' };
  const rate = shift.hourly_rate ?? null;
  const special = !!shift.is_special_event;
  if (rate == null) return { type: 'static', custom: '' };
  if (special && approxEqual(rate, rates.standardRate)) {
    return { type: 'standard', custom: '' };
  }
  if (!special && approxEqual(rate, rates.staticRate)) {
    return { type: 'static', custom: '' };
  }
  return { type: 'custom', custom: rate.toFixed(2) };
};

const formatDateTime = (d: Date) =>
  d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const EditShiftScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditShiftRoute>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const dispatch = useAppDispatch();

  const { shiftId } = route.params;
  const manageShifts = useAppSelector(selectManageShifts);
  const isMutating = useAppSelector(selectManageShiftsMutating);

  const [shift, setShift] = useState<Shift | null>(
    () => manageShifts.find((s) => s.id === shiftId) ?? null,
  );
  const [systemRates, setSystemRates] = useState<SystemRates | null>(null);
  const [ratesError, setRatesError] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(!shift);
  const [startTime, setStartTime] = useState<Date>(() =>
    shift ? new Date(shift.start_time) : new Date(),
  );
  const [endTime, setEndTime] = useState<Date>(() =>
    shift ? new Date(shift.end_time) : new Date(),
  );
  const [payRateType, setPayRateType] = useState<PayRateType>('static');
  const [customAmount, setCustomAmount] = useState('');
  const [initialPayRateType, setInitialPayRateType] = useState<PayRateType>('static');
  const [initialCustomAmount, setInitialCustomAmount] = useState('');
  const [showPayRateSheet, setShowPayRateSheet] = useState(false);

  const [pickerOpen, setPickerOpen] = useState<PickerField>(null);

  const loadRates = async () => {
    setRatesLoading(true);
    setRatesError(false);
    try {
      const rates = await systemSettingsService.getSystemRates(true);
      setSystemRates(rates);
    } catch {
      setRatesError(true);
    } finally {
      setRatesLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rates = await systemSettingsService.getSystemRates();
        if (!cancelled) setSystemRates(rates);
      } catch {
        if (!cancelled) setRatesError(true);
      } finally {
        if (!cancelled) setRatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (shift) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const fetched = await shiftsService.fetchShift(shiftId);
        if (!cancelled) {
          setShift(fetched);
          setStartTime(new Date(fetched.start_time));
          setEndTime(new Date(fetched.end_time));
        }
      } catch (err) {
        logger.error('[EditShift] failed to load shift', err);
        if (!cancelled) {
          Alert.alert('Error', 'Failed to load shift.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [shift, shiftId, navigation]);

  useEffect(() => {
    if (!shift || !systemRates) return;
    const inferred = inferPayRate(shift, systemRates);
    setPayRateType(inferred.type);
    setCustomAmount(inferred.custom);
    setInitialPayRateType(inferred.type);
    setInitialCustomAmount(inferred.custom);
  }, [shift, systemRates]);

  const payRateOptions = useMemo(() => {
    const s = systemRates?.staticRate ?? 0;
    const n = systemRates?.standardRate ?? 0;
    return [
      { value: 'static' as const, label: `Static Rate (£${s.toFixed(2)}/hr)` },
      { value: 'standard' as const, label: `Standard Rate (£${n.toFixed(2)}/hr)` },
      { value: 'custom' as const, label: 'Custom Rate' },
    ];
  }, [systemRates]);

  const payRateLabel = useMemo(
    () => payRateOptions.find((o) => o.value === payRateType)?.label ?? 'Pay rate',
    [payRateOptions, payRateType],
  );

  const customAmountValid = useMemo(() => {
    if (payRateType !== 'custom') return true;
    const n = parseFloat(customAmount);
    return Number.isFinite(n) && n > 0;
  }, [payRateType, customAmount]);

  const timesChanged = useMemo(() => {
    if (!shift) return false;
    return (
      startTime.toISOString() !== new Date(shift.start_time).toISOString() ||
      endTime.toISOString() !== new Date(shift.end_time).toISOString()
    );
  }, [shift, startTime, endTime]);

  const payChanged = useMemo(() => {
    if (payRateType !== initialPayRateType) return true;
    if (payRateType === 'custom') {
      return customAmount !== initialCustomAmount;
    }
    return false;
  }, [payRateType, customAmount, initialPayRateType, initialCustomAmount]);

  const canSubmit =
    !!shift &&
    (timesChanged || payChanged) &&
    endTime > startTime &&
    customAmountValid &&
    !isMutating;

  const handleDateTimeChange =
    (which: PickerField) =>
    (event: DateTimePickerEvent, selected?: Date) => {
      if (Platform.OS === 'android') setPickerOpen(null);
      if (event.type === 'dismissed' || !selected) return;

      const base =
        which === 'startDate' || which === 'startTime' ? startTime : endTime;
      const next = new Date(base);
      if (which === 'startDate' || which === 'endDate') {
        next.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate(),
        );
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }

      if (which === 'startDate' || which === 'startTime') {
        setStartTime(next);
        if (next >= endTime) {
          const bumped = new Date(next);
          bumped.setHours(bumped.getHours() + 1);
          setEndTime(bumped);
        }
      } else {
        setEndTime(next);
      }
    };

  const derivePayFields = () => {
    if (!systemRates) return null;
    if (payRateType === 'static') {
      return { hourly_rate: systemRates.staticRate, is_special_event: false };
    }
    if (payRateType === 'standard') {
      return { hourly_rate: systemRates.standardRate, is_special_event: true };
    }
    return { hourly_rate: parseFloat(customAmount), is_special_event: false };
  };

  const handleSave = async () => {
    if (!shift) return;
    if (endTime <= startTime) {
      Alert.alert('Invalid times', 'End time must be after start time.');
      return;
    }
    if (payRateType === 'custom' && !customAmountValid) {
      Alert.alert('Invalid rate', 'Enter a positive number for the custom rate.');
      return;
    }

    const patch: {
      start_time?: string;
      end_time?: string;
      hourly_rate?: number | null;
      is_special_event?: boolean;
    } = {};

    if (timesChanged) {
      patch.start_time = startTime.toISOString();
      patch.end_time = endTime.toISOString();
    }

    if (payChanged) {
      const pay = derivePayFields();
      if (pay) {
        patch.hourly_rate = pay.hourly_rate;
        patch.is_special_event = pay.is_special_event;
      }
    }

    if (Object.keys(patch).length === 0) return;

    try {
      await dispatch(updateShiftThunk({ shiftId: shift.id, patch })).unwrap();
      Alert.alert('Shift updated', 'Changes saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert(
        'Failed to update',
        typeof err === 'string' ? err : 'Please try again.',
      );
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.canvas,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  if (!shift) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.canvas,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <Text style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
          Shift not available.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Top bar */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.surface.hairline,
        }}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.surface.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
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
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 16,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.2,
          }}
        >
          Reschedule shift
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: 120 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <GlassCard style={{ padding: 16 }}>
            <Eyebrow color={theme.colors.accent}>Currently scheduled</Eyebrow>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{
                marginTop: 6,
                fontSize: 18,
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
                marginTop: 4,
                fontSize: 12,
                color: theme.colors.text.secondary,
                lineHeight: 18,
              }}
            >
              {formatDateTime(new Date(shift.start_time))} →{' '}
              {formatDateTime(new Date(shift.end_time))}
            </Text>
          </GlassCard>

          {/* New start */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            New start
          </Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateTimeCell
              icon="calendar"
              label={startTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              onPress={() => setPickerOpen('startDate')}
            />
            <DateTimeCell
              icon="clock"
              label={startTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              onPress={() => setPickerOpen('startTime')}
            />
          </View>

          {/* New end */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            New end
          </Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateTimeCell
              icon="calendar"
              label={endTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              onPress={() => setPickerOpen('endDate')}
            />
            <DateTimeCell
              icon="clock"
              label={endTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              onPress={() => setPickerOpen('endTime')}
            />
          </View>

          <View
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: theme.radii.md,
              backgroundColor: timesChanged
                ? theme.colors.accentSoft
                : theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: timesChanged
                ? theme.colors.accentBorder
                : theme.colors.surface.hairline,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.4,
                color: timesChanged ? theme.colors.accent : theme.colors.text.tertiary,
                fontWeight: '500',
              }}
            >
              {timesChanged ? 'NEW · ' : ''}
              {formatDateTime(startTime)}
            </Text>
            <Svg width={10} height={10} viewBox="0 0 24 24">
              <Path
                d="M5 12 H19 M13 6 l6 6 l-6 6"
                stroke={timesChanged ? theme.colors.accent : theme.colors.text.tertiary}
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
                letterSpacing: 1.4,
                color: timesChanged ? theme.colors.accent : theme.colors.text.tertiary,
                fontWeight: '500',
              }}
            >
              {formatDateTime(endTime)}
            </Text>
          </View>

          {/* Pay rate */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            Pay rate
          </Eyebrow>
          {ratesError ? (
            <View
              style={{
                padding: 14,
                borderRadius: theme.radii.xl,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
                backgroundColor: theme.colors.accentSoft,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20 M12 7 v6 M12 17 h.01"
                  stroke={theme.colors.accent}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: theme.colors.text.primary,
                }}
              >
                Couldn't load pay rates.
              </Text>
              <Pressable onPress={loadRates} hitSlop={10}>
                <Text
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.8,
                    textTransform: 'uppercase',
                    color: theme.colors.accent,
                    fontWeight: '500',
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => systemRates && setShowPayRateSheet((v) => !v)}
              disabled={!systemRates}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 14,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.surface.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: systemRates ? (pressed ? 0.85 : 1) : 0.5,
              })}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M3 7 H21 V17 H3 Z M7 12 a3 3 0 1 0 6 0 a3 3 0 0 0 -6 0 M17 12 h.01"
                  stroke={theme.colors.text.secondary}
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
                  fontSize: 15,
                  color: theme.colors.text.primary,
                  fontWeight: '500',
                  letterSpacing: -0.2,
                }}
              >
                {systemRates
                  ? payRateLabel
                  : ratesLoading
                    ? 'Loading rates…'
                    : 'Pay rate unavailable'}
              </Text>
              <Svg
                width={12}
                height={7}
                viewBox="0 0 14 8"
              >
                <Path
                  d={showPayRateSheet ? 'M1 7 l6 -6 l6 6' : 'M1 1 l6 6 l6 -6'}
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          )}
          {showPayRateSheet && systemRates ? (
            <View
              style={{
                marginTop: 8,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.surface.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                overflow: 'hidden',
              }}
            >
              {payRateOptions.map((o, idx) => {
                const active = o.value === payRateType;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      setPayRateType(o.value);
                      setShowPayRateSheet(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: theme.colors.surface.hairline,
                      backgroundColor: pressed
                        ? theme.colors.surface.chip
                        : 'transparent',
                    })}
                  >
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontSize: 14,
                        color: active ? theme.colors.accent : theme.colors.text.primary,
                        fontWeight: active ? '600' : '500',
                        letterSpacing: -0.2,
                      }}
                    >
                      {o.label}
                    </Text>
                    {active ? (
                      <Svg width={14} height={14} viewBox="0 0 24 24">
                        <Path
                          d="M5 12 L10 17 L19 7"
                          stroke={theme.colors.accent}
                          strokeWidth={2.4}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {payRateType === 'custom' ? (
            <View
              style={{
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: theme.radii.xl,
                backgroundColor: theme.colors.surface.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  color: theme.colors.text.secondary,
                  fontWeight: '500',
                }}
              >
                £
              </Text>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: '500',
                  color: theme.colors.text.primary,
                }}
                placeholder="0.00"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="decimal-pad"
                value={customAmount}
                onChangeText={setCustomAmount}
              />
              <Text
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  color: theme.colors.text.tertiary,
                }}
              >
                /HR
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

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
          label={isMutating ? 'Saving…' : 'Save changes'}
          disabled={!canSubmit}
          trailingArrow={!isMutating}
          onPress={handleSave}
        />
      </View>

      {/* iOS pickers — bottom sheet modal */}
      {Platform.OS === 'ios' ? (
        <IOSPickerSheet
          visible={pickerOpen !== null}
          title={
            pickerOpen === 'startDate'
              ? 'Start date'
              : pickerOpen === 'startTime'
                ? 'Start time'
                : pickerOpen === 'endDate'
                  ? 'End date'
                  : pickerOpen === 'endTime'
                    ? 'End time'
                    : ''
          }
          value={
            pickerOpen === 'startDate' || pickerOpen === 'startTime'
              ? startTime
              : endTime
          }
          mode={
            pickerOpen === 'startTime' || pickerOpen === 'endTime' ? 'time' : 'date'
          }
          onChange={(d) => {
            if (!pickerOpen) return;
            handleDateTimeChange(pickerOpen)(
              { type: 'set' } as DateTimePickerEvent,
              d,
            );
          }}
          onDone={() => setPickerOpen(null)}
        />
      ) : null}

      {/* Android pickers — system dialog */}
      {Platform.OS === 'android' && pickerOpen === 'startDate' ? (
        <DateTimePicker
          value={startTime}
          mode="date"
          display="default"
          onChange={handleDateTimeChange('startDate')}
        />
      ) : null}
      {Platform.OS === 'android' && pickerOpen === 'startTime' ? (
        <DateTimePicker
          value={startTime}
          mode="time"
          display="default"
          onChange={handleDateTimeChange('startTime')}
        />
      ) : null}
      {Platform.OS === 'android' && pickerOpen === 'endDate' ? (
        <DateTimePicker
          value={endTime}
          mode="date"
          display="default"
          onChange={handleDateTimeChange('endDate')}
        />
      ) : null}
      {Platform.OS === 'android' && pickerOpen === 'endTime' ? (
        <DateTimePicker
          value={endTime}
          mode="time"
          display="default"
          onChange={handleDateTimeChange('endTime')}
        />
      ) : null}
    </View>
  );
};

const IOSPickerSheet: React.FC<{
  visible: boolean;
  title: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (d: Date) => void;
  onDone: () => void;
}> = ({ visible, title, value, mode, onChange, onDone }) => {
  const theme = useRedesignTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={styles.sheetOverlay} onPress={onDone}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
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
              borderBottomWidth: StyleSheet.hairlineWidth,
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
            <Pressable onPress={onDone} hitSlop={10}>
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
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              themeVariant={theme.isDark ? 'dark' : 'light'}
              accentColor={theme.colors.accent}
              onChange={(_, d) => {
                if (d) onChange(d);
              }}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const DateTimeCell: React.FC<{
  icon: 'calendar' | 'clock';
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        {icon === 'calendar' ? (
          <Path
            d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
            stroke={theme.colors.text.secondary}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <Path
            d="M12 6 v6 l4 2 M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20"
            stroke={theme.colors.text.secondary}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </Svg>
      <Text
        allowFontScaling={false}
        style={{
          flex: 1,
          fontSize: 14,
          color: theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
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

export default EditShiftScreenV2;
