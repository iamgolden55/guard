/**
 * EditShiftScreen - admin/manager reschedule form.
 * Loads the target shift, lets the user edit start/end time + pay rate,
 * saves via updateShiftThunk (diff-only PATCH).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { useTheme } from '../../../hooks/useTheme';
import {
  selectManageShifts,
  selectManageShiftsMutating,
  updateShiftThunk,
} from '../../../store/slices/manageShiftsSlice';
import { shiftsService } from '../../../services/shiftsService';
import {
  systemSettingsService,
  type SystemRates,
} from '../../../services/systemSettingsService';
import type { Shift } from '../../../store/slices/shiftsSlice';
import type { MainStackParamList } from '../../../types/navigation';
import { getUberColors, uberRadius, uberSpacing } from '../../../theme/uberTheme';
import { logger } from '../../../utils/logger';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type EditShiftRoute = RouteProp<MainStackParamList, 'EditShift'>;
type PayRateType = 'static' | 'standard' | 'custom';

const RATE_EPSILON = 0.01;
const approxEqual = (a: number, b: number) => Math.abs(a - b) < RATE_EPSILON;

const inferPayRate = (
  shift: Shift | null,
  rates: SystemRates | null
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

export const EditShiftScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditShiftRoute>();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const colors = getUberColors(isDark);

  const { shiftId } = route.params;
  const manageShifts = useAppSelector(selectManageShifts);
  const isMutating = useAppSelector(selectManageShiftsMutating);

  const [shift, setShift] = useState<Shift | null>(
    () => manageShifts.find((s) => s.id === shiftId) ?? null
  );
  const [systemRates, setSystemRates] = useState<SystemRates | null>(null);
  const [ratesError, setRatesError] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(!shift);
  const [startTime, setStartTime] = useState<Date>(() =>
    shift ? new Date(shift.start_time) : new Date()
  );
  const [endTime, setEndTime] = useState<Date>(() =>
    shift ? new Date(shift.end_time) : new Date()
  );
  const [payRateType, setPayRateType] = useState<PayRateType>('static');
  const [customAmount, setCustomAmount] = useState('');
  const [initialPayRateType, setInitialPayRateType] = useState<PayRateType>('static');
  const [initialCustomAmount, setInitialCustomAmount] = useState('');
  const [showPayRateSheet, setShowPayRateSheet] = useState(false);

  const [pickerOpen, setPickerOpen] = useState<
    null | 'startDate' | 'startTime' | 'endDate' | 'endTime'
  >(null);

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

  // Load system rates.
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

  // Load the shift if not in manageShifts state.
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

  // Initialize pay-rate selection once both shift and rates are available.
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
    [payRateOptions, payRateType]
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

  const handleDateTimeChange = (which: typeof pickerOpen) => (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (Platform.OS === 'android') setPickerOpen(null);
    if (event.type === 'dismissed' || !selected) return;

    const base = which === 'startDate' || which === 'startTime' ? startTime : endTime;
    const next = new Date(base);
    if (which === 'startDate' || which === 'endDate') {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
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
      Alert.alert('Failed to update', typeof err === 'string' ? err : 'Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background.light }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!shift) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background.light }]}>
        <Text style={{ color: colors.text.secondary }}>Shift not available.</Text>
      </View>
    );
  }

  const fieldStyle = [
    styles.field,
    { backgroundColor: colors.background.surface, borderColor: colors.border.light },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background.light }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.background.surface, borderColor: colors.border.light },
          ]}
        >
          <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>
            {shift.venue.name}
          </Text>
          <Text style={[styles.summaryMeta, { color: colors.text.secondary }]}>
            Currently scheduled: {formatDateTime(new Date(shift.start_time))} →{' '}
            {formatDateTime(new Date(shift.end_time))}
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.text.secondary }]}>New start</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[fieldStyle, styles.flex1]}
            onPress={() => setPickerOpen('startDate')}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.text.muted} />
            <Text style={[styles.fieldText, { color: colors.text.primary }]}>
              {startTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fieldStyle, styles.flex1]}
            onPress={() => setPickerOpen('startTime')}
          >
            <Ionicons name="time-outline" size={18} color={colors.text.muted} />
            <Text style={[styles.fieldText, { color: colors.text.primary }]}>
              {startTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.text.secondary }]}>New end</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[fieldStyle, styles.flex1]}
            onPress={() => setPickerOpen('endDate')}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.text.muted} />
            <Text style={[styles.fieldText, { color: colors.text.primary }]}>
              {endTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fieldStyle, styles.flex1]}
            onPress={() => setPickerOpen('endTime')}
          >
            <Ionicons name="time-outline" size={18} color={colors.text.muted} />
            <Text style={[styles.fieldText, { color: colors.text.primary }]}>
              {endTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: colors.text.muted }]}>
          New: {formatDateTime(startTime)} → {formatDateTime(endTime)}
        </Text>

        <Text style={[styles.label, { color: colors.text.secondary }]}>Pay rate</Text>
        {ratesError ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.background.surface, borderColor: colors.error },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.text.primary }]}>
              Couldn't load pay rates.
            </Text>
            <TouchableOpacity onPress={loadRates} hitSlop={10}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={fieldStyle}
            onPress={() => setShowPayRateSheet((v) => !v)}
            activeOpacity={0.7}
            disabled={!systemRates}
          >
            <Ionicons name="cash-outline" size={18} color={colors.text.muted} />
            <Text style={[styles.fieldText, { color: colors.text.primary }]}>
              {systemRates ? payRateLabel : ratesLoading ? 'Loading rates…' : 'Pay rate unavailable'}
            </Text>
            <Ionicons
              name={showPayRateSheet ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.text.muted}
            />
          </TouchableOpacity>
        )}
        {showPayRateSheet && systemRates && (
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background.surface, borderColor: colors.border.light },
            ]}
          >
            {payRateOptions.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={styles.sheetRow}
                onPress={() => {
                  setPayRateType(o.value);
                  setShowPayRateSheet(false);
                }}
              >
                <Text
                  style={{
                    color: o.value === payRateType ? colors.primary : colors.text.primary,
                    fontWeight: o.value === payRateType ? '700' : '500',
                  }}
                >
                  {o.label}
                </Text>
                {o.value === payRateType && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        {payRateType === 'custom' && (
          <View
            style={[
              styles.customRateWrap,
              { backgroundColor: colors.background.surface, borderColor: colors.border.light },
            ]}
          >
            <Text style={[styles.currencyPrefix, { color: colors.text.muted }]}>£</Text>
            <TextInput
              style={[styles.customRateInput, { color: colors.text.primary }]}
              placeholder="0.00"
              placeholderTextColor={colors.text.muted}
              keyboardType="decimal-pad"
              value={customAmount}
              onChangeText={setCustomAmount}
            />
            <Text style={[styles.currencySuffix, { color: colors.text.muted }]}>/hr</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveBtn,
            {
              backgroundColor: canSubmit ? colors.primary : colors.background.surface,
              opacity: canSubmit ? 1 : 0.6,
            },
          ]}
          onPress={handleSave}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {isMutating ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={[styles.saveText, { color: colors.text.inverse }]}>Save changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {pickerOpen === 'startDate' && (
        <DateTimePicker
          value={startTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateTimeChange('startDate')}
        />
      )}
      {pickerOpen === 'startTime' && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateTimeChange('startTime')}
        />
      )}
      {pickerOpen === 'endDate' && (
        <DateTimePicker
          value={endTime}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateTimeChange('endDate')}
        />
      )}
      {pickerOpen === 'endTime' && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateTimeChange('endTime')}
        />
      )}
      {Platform.OS === 'ios' && pickerOpen && (
        <TouchableOpacity
          style={[styles.iosDoneBar, { backgroundColor: colors.background.surface }]}
          onPress={() => setPickerOpen(null)}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Done</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: uberSpacing.base, paddingBottom: uberSpacing['2xl'] },
  summaryCard: {
    borderWidth: 1,
    borderRadius: uberRadius.md,
    padding: uberSpacing.md,
    marginBottom: uberSpacing.md,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryMeta: { fontSize: 12, marginTop: uberSpacing.xs },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: uberSpacing.md,
    marginBottom: uberSpacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.sm,
    paddingHorizontal: uberSpacing.md,
    paddingVertical: uberSpacing.md,
    borderRadius: uberRadius.md,
    borderWidth: 1,
  },
  fieldText: { flex: 1, fontSize: 15, fontWeight: '500' },
  row: { flexDirection: 'row', gap: uberSpacing.sm },
  flex1: { flex: 1 },
  hint: { fontSize: 12, marginTop: uberSpacing.sm },
  sheet: {
    marginTop: uberSpacing.xs,
    borderRadius: uberRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.md,
    paddingVertical: uberSpacing.md,
  },
  customRateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: uberSpacing.xs,
    paddingHorizontal: uberSpacing.md,
    paddingVertical: Platform.OS === 'ios' ? uberSpacing.md : uberSpacing.sm,
    borderRadius: uberRadius.md,
    borderWidth: 1,
    gap: uberSpacing.sm,
  },
  currencyPrefix: { fontSize: 15, fontWeight: '600' },
  currencySuffix: { fontSize: 13 },
  customRateInput: { flex: 1, fontSize: 15, fontWeight: '500' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.sm,
    paddingHorizontal: uberSpacing.md,
    paddingVertical: uberSpacing.md,
    borderRadius: uberRadius.md,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 14 },
  retryText: { fontSize: 14, fontWeight: '700' },
  saveBtn: {
    marginTop: uberSpacing.xl,
    borderRadius: uberRadius.full,
    paddingVertical: uberSpacing.md,
    alignItems: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '700' },
  iosDoneBar: {
    alignItems: 'flex-end',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.sm,
  },
});
