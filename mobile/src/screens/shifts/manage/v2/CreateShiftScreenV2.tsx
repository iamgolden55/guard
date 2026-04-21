/**
 * CreateShiftScreenV2 — Phase 4 re-skin of the admin create-shift form.
 * Preserves dispatch wiring (createShiftThunk / createMultiStaffShiftsThunk),
 * system rates loader and staff/venue picker modals. Only the presentation
 * layer changes.
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
import { useNavigation } from '@react-navigation/native';
// @ts-expect-error pre-existing node16 module resolution issue with @react-navigation/native-stack
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../../hooks/useRedux';
import {
  createShiftThunk,
  createMultiStaffShiftsThunk,
  selectManageShiftsMutating,
} from '../../../../store/slices/manageShiftsSlice';
import {
  systemSettingsService,
  type SystemRates,
} from '../../../../services/systemSettingsService';
import type { MainStackParamList } from '../../../../types/navigation';
import { useRedesignTheme } from '../../../../theme/redesign';
import { Eyebrow, PrimaryCTA } from '../../../../components/redesign';
import {
  StaffPickerModal,
  type StaffPickerMember,
} from '../components/StaffPickerModal';
import {
  VenuePickerModal,
  type VenuePickerOption,
} from '../components/VenuePickerModal';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type PayRateType = 'static' | 'standard' | 'custom';
type PickerField = null | 'startDate' | 'startTime' | 'endDate' | 'endTime';

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

export const CreateShiftScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const dispatch = useAppDispatch();

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

  const roleLabel = useMemo(
    () => SECURITY_ROLES.find((r) => r.value === securityRole)?.label ?? securityRole,
    [securityRole],
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
    [payRateOptions, payRateType],
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
          bumped.setHours(bumped.getHours() + 8);
          setEndTime(bumped);
        }
      } else {
        setEndTime(next);
      }
    };

  const derivePayFields = () => {
    if (!systemRates)
      return { hourly_rate: null as number | null, is_special_event: false };
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
          }),
        ).unwrap();
        Alert.alert(
          'Shift created',
          `Assigned to ${staff[0].first_name} ${staff[0].last_name}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
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
          }),
        ).unwrap();
        Alert.alert(
          'Shifts created',
          result.message || `Assigned to ${staff.length} staff members.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Failed to create shift',
        typeof err === 'string' ? err : 'Please try again.',
      );
    }
  };

  const ctaLabel = staff.length > 1 ? `Create ${staff.length} shifts` : 'Create shift';

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
          Create shift
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
          {/* Staff */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>Staff</Eyebrow>
          <FieldRow
            onPress={() => setShowStaffPicker(true)}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M8 11 a4 4 0 1 0 0 -8 a4 4 0 0 0 0 8 M16 13 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6 M2 21 c 0 -4 3 -6 6 -6 s 6 2 6 6 M14 21 c 0 -3 2 -5 4 -5 s 4 2 4 5"
                  stroke={theme.colors.text.secondary}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            label={staffLabel}
            placeholder={staff.length === 0}
            trailing="chevronRight"
          />

          {/* Venue */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            Venue
          </Eyebrow>
          <FieldRow
            onPress={() => setShowVenuePicker(true)}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2 C 8 2 5 5 5 9 c 0 5 7 13 7 13 s 7 -8 7 -13 c 0 -4 -3 -7 -7 -7 z M12 11 a2 2 0 1 0 0 -4 a2 2 0 0 0 0 4 z"
                  stroke={theme.colors.text.secondary}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            label={venue ? venue.name : 'Choose venue'}
            placeholder={!venue}
            trailing="chevronRight"
          />

          {/* Start */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            Start
          </Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateTimeCell
              flex
              icon="calendar"
              label={startTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              onPress={() => setPickerOpen('startDate')}
            />
            <DateTimeCell
              flex
              icon="clock"
              label={startTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              onPress={() => setPickerOpen('startTime')}
            />
          </View>

          {/* End */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            End
          </Eyebrow>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateTimeCell
              flex
              icon="calendar"
              label={endTime.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              onPress={() => setPickerOpen('endDate')}
            />
            <DateTimeCell
              flex
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
                color: theme.colors.text.tertiary,
              }}
            >
              {formatDateTime(startTime)}
            </Text>
            <Svg width={10} height={10} viewBox="0 0 24 24">
              <Path
                d="M5 12 H19 M13 6 l6 6 l-6 6"
                stroke={theme.colors.text.tertiary}
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
                color: theme.colors.text.tertiary,
              }}
            >
              {formatDateTime(endTime)}
            </Text>
          </View>

          {/* Role */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            Required role
          </Eyebrow>
          <FieldRow
            onPress={() => setShowRoleSheet((v) => !v)}
            icon={
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2 L2 6 v6 c0 5 4 8 10 9 6 -1 10 -4 10 -9 V6 Z"
                  stroke={theme.colors.text.secondary}
                  strokeWidth={1.6}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            label={roleLabel}
            trailing={showRoleSheet ? 'chevronUp' : 'chevronDown'}
          />
          {showRoleSheet ? (
            <OptionSheet
              options={SECURITY_ROLES.map((r) => ({ value: r.value, label: r.label }))}
              selected={securityRole}
              onSelect={(v) => {
                setSecurityRole(v);
                setShowRoleSheet(false);
              }}
            />
          ) : null}

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
            <FieldRow
              onPress={() => systemRates && setShowPayRateSheet((v) => !v)}
              disabled={!systemRates}
              icon={
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
              }
              label={
                systemRates
                  ? payRateLabel
                  : ratesLoading
                    ? 'Loading rates…'
                    : 'Pay rate unavailable'
              }
              trailing={showPayRateSheet ? 'chevronUp' : 'chevronDown'}
            />
          )}
          {showPayRateSheet && systemRates ? (
            <OptionSheet
              options={payRateOptions.map((o) => ({ value: o.value, label: o.label }))}
              selected={payRateType}
              onSelect={(v) => {
                setPayRateType(v as PayRateType);
                setShowPayRateSheet(false);
              }}
            />
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

          {/* Notes */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
            Notes (optional)
          </Eyebrow>
          <TextInput
            style={{
              minHeight: 90,
              padding: 14,
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.surface.card,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              color: theme.colors.text.primary,
              fontSize: 14,
              textAlignVertical: 'top',
            }}
            placeholder="Any briefing notes for the staff member"
            placeholderTextColor={theme.colors.text.tertiary}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
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
          label={isMutating ? 'Creating…' : ctaLabel}
          disabled={!canSubmit}
          trailingArrow={!isMutating}
          onPress={handleSubmit}
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
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────

const FieldRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  placeholder?: boolean;
  disabled?: boolean;
  trailing?: 'chevronRight' | 'chevronDown' | 'chevronUp' | 'none';
  onPress: () => void;
}> = ({ icon, label, placeholder, disabled, trailing = 'chevronRight', onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
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
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {icon}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 15,
          color: placeholder ? theme.colors.text.tertiary : theme.colors.text.primary,
          fontWeight: '500',
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
      {trailing === 'chevronRight' ? (
        <Svg width={7} height={12} viewBox="0 0 8 14">
          <Path
            d="M1 1 l6 6 l-6 6"
            stroke={theme.colors.text.tertiary}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      ) : trailing === 'chevronDown' ? (
        <Svg width={12} height={7} viewBox="0 0 14 8">
          <Path
            d="M1 1 l6 6 l6 -6"
            stroke={theme.colors.text.tertiary}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      ) : trailing === 'chevronUp' ? (
        <Svg width={12} height={7} viewBox="0 0 14 8">
          <Path
            d="M1 7 l6 -6 l6 6"
            stroke={theme.colors.text.tertiary}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
};

const DateTimeCell: React.FC<{
  flex?: boolean;
  icon: 'calendar' | 'clock';
  label: string;
  onPress: () => void;
}> = ({ flex, icon, label, onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
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

const OptionSheet: React.FC<{
  options: Array<{ value: string; label: string }>;
  selected: string;
  onSelect: (v: string) => void;
}> = ({ options, selected, onSelect }) => {
  const theme = useRedesignTheme();
  return (
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
      {options.map((o, idx) => {
        const active = o.value === selected;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.surface.hairline,
              backgroundColor: pressed ? theme.colors.surface.chip : 'transparent',
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

export default CreateShiftScreenV2;
