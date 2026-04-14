/**
 * CreateShiftScreen - admin/manager form to assign a new shift.
 * 1 staff → POST /api/v1/shifts/ via createShiftThunk.
 * 2+ staff → POST /api/v1/shifts/create_multi_staff/ via createMultiStaffShiftsThunk.
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { useTheme } from '../../../hooks/useTheme';
import {
  createShiftThunk,
  createMultiStaffShiftsThunk,
  selectManageShiftsMutating,
} from '../../../store/slices/manageShiftsSlice';
import { systemSettingsService, type SystemRates } from '../../../services/systemSettingsService';
import type { MainStackParamList } from '../../../types/navigation';
import { getUberColors, uberRadius, uberSpacing } from '../../../theme/uberTheme';
import { StaffPickerModal, type StaffPickerMember } from './components/StaffPickerModal';
import { VenuePickerModal, type VenuePickerOption } from './components/VenuePickerModal';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type PayRateType = 'static' | 'standard' | 'custom';

const SECURITY_ROLES: Array<{ value: string; label: string }> = [
  { value: 'sg', label: 'Security Guard' },
  { value: 'ds', label: 'Door Supervisor' },
  { value: 'cctv', label: 'CCTV Operator' },
  { value: 'cp', label: 'Close Protection' },
  { value: 'steward', label: 'Steward' },
  { value: 'k9', label: 'Dog Handler' },
  { value: 'static', label: 'Static Guard' },
  { value: 'mobile', label: 'Mobile Patrol' },
  { value: 'event', label: 'Event Security' },
];

const nextHour = () => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

const formatDateTime = (d: Date) =>
  d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const CreateShiftScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const colors = getUberColors(isDark);

  const isMutating = useAppSelector(selectManageShiftsMutating);

  const [staff, setStaff] = useState<StaffPickerMember[]>([]);
  const [venue, setVenue] = useState<VenuePickerOption | null>(null);
  const [startTime, setStartTime] = useState<Date>(nextHour());
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = nextHour();
    d.setHours(d.getHours() + 8);
    return d;
  });
  const [securityRole, setSecurityRole] = useState<string>('sg');
  const [notes, setNotes] = useState('');

  const [systemRates, setSystemRates] = useState<SystemRates | null>(null);
  const [ratesError, setRatesError] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [payRateType, setPayRateType] = useState<PayRateType>('static');
  const [customAmount, setCustomAmount] = useState('');

  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [showPayRateSheet, setShowPayRateSheet] = useState(false);

  const [pickerOpen, setPickerOpen] = useState<null | 'startDate' | 'startTime' | 'endDate' | 'endTime'>(
    null
  );

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

  const roleLabel = useMemo(
    () => SECURITY_ROLES.find((r) => r.value === securityRole)?.label ?? securityRole,
    [securityRole]
  );

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

  const staffLabel = useMemo(() => {
    if (staff.length === 0) return 'Choose staff members';
    if (staff.length === 1) return `${staff[0].first_name} ${staff[0].last_name}`;
    return `${staff.length} staff selected`;
  }, [staff]);

  const customAmountValid = useMemo(() => {
    if (payRateType !== 'custom') return true;
    const n = parseFloat(customAmount);
    return Number.isFinite(n) && n > 0;
  }, [payRateType, customAmount]);

  const canSubmit =
    staff.length > 0 &&
    !!venue &&
    endTime > startTime &&
    !!systemRates &&
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
        bumped.setHours(bumped.getHours() + 8);
        setEndTime(bumped);
      }
    } else {
      setEndTime(next);
    }
  };

  const derivePayFields = () => {
    if (!systemRates) return { hourly_rate: null as number | null, is_special_event: false };
    if (payRateType === 'static') {
      return { hourly_rate: systemRates.staticRate, is_special_event: false };
    }
    if (payRateType === 'standard') {
      return { hourly_rate: systemRates.standardRate, is_special_event: true };
    }
    return { hourly_rate: parseFloat(customAmount), is_special_event: false };
  };

  const handleSubmit = async () => {
    if (staff.length === 0 || !venue) return;
    if (endTime <= startTime) {
      Alert.alert('Invalid times', 'End time must be after start time.');
      return;
    }
    if (payRateType === 'custom' && !customAmountValid) {
      Alert.alert('Invalid rate', 'Enter a positive number for the custom rate.');
      return;
    }

    const { hourly_rate, is_special_event } = derivePayFields();
    const trimmedNotes = notes.trim() || undefined;

    try {
      if (staff.length === 1) {
        await dispatch(
          createShiftThunk({
            staff_user: staff[0].id,
            venue: venue.id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            required_security_role: securityRole,
            notes: trimmedNotes,
            hourly_rate,
            is_special_event,
            status: 'scheduled',
            is_published: true,
          })
        ).unwrap();
        Alert.alert(
          'Shift created',
          `Assigned to ${staff[0].first_name} ${staff[0].last_name}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        const result = await dispatch(
          createMultiStaffShiftsThunk({
            staff_users: staff.map((s) => s.id),
            venue: venue.id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            required_security_role: securityRole,
            notes: trimmedNotes,
            hourly_rate,
            is_special_event,
            status: 'scheduled',
          })
        ).unwrap();
        Alert.alert(
          'Shifts created',
          result.message || `Assigned to ${staff.length} staff members.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      Alert.alert('Failed to create shift', typeof err === 'string' ? err : 'Please try again.');
    }
  };

  const fieldStyle = [
    styles.field,
    { backgroundColor: colors.background.surface, borderColor: colors.border.light },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background.light }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Staff */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Staff</Text>
        <TouchableOpacity
          style={fieldStyle}
          onPress={() => setShowStaffPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={18} color={colors.text.muted} />
          <Text
            style={[
              styles.fieldText,
              { color: staff.length > 0 ? colors.text.primary : colors.text.muted },
            ]}
          >
            {staffLabel}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </TouchableOpacity>

        {/* Venue */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Venue</Text>
        <TouchableOpacity
          style={fieldStyle}
          onPress={() => setShowVenuePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={18} color={colors.text.muted} />
          <Text
            style={[
              styles.fieldText,
              { color: venue ? colors.text.primary : colors.text.muted },
            ]}
          >
            {venue ? venue.name : 'Choose venue'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </TouchableOpacity>

        {/* Start time */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Start</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[fieldStyle, styles.flex1]}
            onPress={() => setPickerOpen('startDate')}
            activeOpacity={0.7}
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
            activeOpacity={0.7}
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

        {/* End time */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>End</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[fieldStyle, styles.flex1]}
            onPress={() => setPickerOpen('endDate')}
            activeOpacity={0.7}
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
            activeOpacity={0.7}
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
          {formatDateTime(startTime)} → {formatDateTime(endTime)}
        </Text>

        {/* Security role */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Required role</Text>
        <TouchableOpacity
          style={fieldStyle}
          onPress={() => setShowRoleSheet((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-outline" size={18} color={colors.text.muted} />
          <Text style={[styles.fieldText, { color: colors.text.primary }]}>{roleLabel}</Text>
          <Ionicons
            name={showRoleSheet ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.text.muted}
          />
        </TouchableOpacity>
        {showRoleSheet && (
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.background.surface, borderColor: colors.border.light },
            ]}
          >
            {SECURITY_ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.sheetRow}
                onPress={() => {
                  setSecurityRole(r.value);
                  setShowRoleSheet(false);
                }}
              >
                <Text
                  style={{
                    color: r.value === securityRole ? colors.primary : colors.text.primary,
                    fontWeight: r.value === securityRole ? '700' : '500',
                  }}
                >
                  {r.label}
                </Text>
                {r.value === securityRole && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pay rate */}
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

        {/* Notes */}
        <Text style={[styles.label, { color: colors.text.secondary }]}>Notes (optional)</Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: colors.background.surface,
              borderColor: colors.border.light,
              color: colors.text.primary,
            },
          ]}
          placeholder="Any briefing notes for the staff member"
          placeholderTextColor={colors.text.muted}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: canSubmit ? colors.primary : colors.background.surface,
              opacity: canSubmit ? 1 : 0.6,
            },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {isMutating ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={[styles.submitText, { color: colors.text.inverse }]}>
              {staff.length > 1 ? `Create ${staff.length} shifts` : 'Create shift'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Date/Time pickers */}
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

      <StaffPickerModal
        visible={showStaffPicker}
        onClose={() => setShowStaffPicker(false)}
        onApply={setStaff}
        initialSelectedIds={staff.map((s) => s.id)}
      />
      <VenuePickerModal
        visible={showVenuePicker}
        onClose={() => setShowVenuePicker(false)}
        onSelect={setVenue}
        selectedId={venue?.id}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: uberSpacing.base,
    paddingBottom: uberSpacing['2xl'],
  },
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
  hint: { fontSize: 12, marginTop: uberSpacing.xs },
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
  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: uberRadius.md,
    padding: uberSpacing.md,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: uberSpacing.xl,
    borderRadius: uberRadius.full,
    paddingVertical: uberSpacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '700' },
  iosDoneBar: {
    alignItems: 'flex-end',
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.sm,
    borderTopWidth: 0,
  },
});
