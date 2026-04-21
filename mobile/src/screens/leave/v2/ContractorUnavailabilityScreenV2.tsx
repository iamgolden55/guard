/**
 * ContractorUnavailabilityScreenV2 — Re-skinned availability manager matching
 * the Phase 4 design. Preserves service calls (fetch, create, update, delete)
 * and navigation.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainStackParamList } from '../../../types/navigation';
import contractorUnavailabilityService, {
  ContractorUnavailability,
  CreateUnavailabilityRequest,
} from '../../../services/contractorUnavailabilityService';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const formatDateISO = (date: Date) => date.toISOString().split('T')[0];
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
const calculateDays = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
};

export const ContractorUnavailabilityScreenV2: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const [periods, setPeriods] = useState<ContractorUnavailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ContractorUnavailability | null>(null);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await contractorUnavailabilityService.getUpcomingUnavailability();
      setPeriods(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load unavailability periods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetForm = () => {
    setStartDate(new Date());
    setEndDate(new Date());
    setReason('');
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (startDate > endDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateUnavailabilityRequest = {
        start_date: formatDateISO(startDate),
        end_date: formatDateISO(endDate),
        reason: reason.trim() || undefined,
      };
      if (editing) {
        await contractorUnavailabilityService.updateUnavailability(editing.id, payload);
        Alert.alert('Success', 'Unavailability period updated');
      } else {
        await contractorUnavailabilityService.createUnavailability(payload);
        Alert.alert('Success', 'Unavailability period added');
      }
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to save unavailability.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (period: ContractorUnavailability) => {
    setEditing(period);
    setStartDate(new Date(period.start_date));
    setEndDate(new Date(period.end_date));
    setReason(period.reason || '');
    setShowForm(true);
  };

  const handleDelete = (period: ContractorUnavailability) =>
    Alert.alert(
      'Delete unavailability',
      `Delete ${formatDate(period.start_date)} – ${formatDate(period.end_date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await contractorUnavailabilityService.deleteUnavailability(period.id);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete period');
            }
          },
        },
      ],
    );

  if (loading) {
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
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

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
            paddingBottom: 40 + insets.bottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text
            allowFontScaling={false}
            style={{
              fontSize: 28,
              color: theme.colors.text.primary,
              fontWeight: '400',
              letterSpacing: -0.8,
            }}
          >
            Availability
          </Text>
          <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
            Mark dates when you're not available for shifts
          </Eyebrow>

          {/* Add form or add button */}
          {showForm ? (
            <GlassCard style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Eyebrow color={theme.colors.accent}>
                  {editing ? 'Edit unavailability' : 'Add unavailability'}
                </Eyebrow>
                <Pressable
                  onPress={resetForm}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: theme.colors.surface.chip,
                    borderWidth: 1,
                    borderColor: theme.colors.surface.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Svg width={10} height={10} viewBox="0 0 24 24">
                    <Path
                      d="M5 5L19 19M19 5L5 19"
                      stroke={theme.colors.text.primary}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </Pressable>
              </View>

              {/* Dates */}
              <View style={{ marginTop: 14, gap: 10 }}>
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

              {startDate <= endDate ? (
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
                    {calculateDays(startDate, endDate)} day
                    {calculateDays(startDate, endDate) !== 1 ? 's' : ''} unavailable
                  </Text>
                </View>
              ) : null}

              {/* Reason */}
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 14,
                  marginBottom: 6,
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.text.secondary,
                }}
              >
                Reason (optional)
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Personal commitment, vacation"
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                maxLength={200}
                numberOfLines={3}
                textAlignVertical="top"
                style={{
                  minHeight: 80,
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
                  marginTop: 4,
                  textAlign: 'right',
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.4,
                  color: theme.colors.text.tertiary,
                }}
              >
                {reason.length}/200
              </Text>

              {/* Info banner */}
              <View
                style={{
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: 10,
                  borderRadius: theme.radii.md,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairline,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: theme.colors.accentSoft,
                    borderWidth: 1,
                    borderColor: theme.colors.accentBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: theme.colors.accent, fontSize: 11, fontWeight: '700' }}>i</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.text.secondary, lineHeight: 18 }}>
                  Marking yourself unavailable will prevent you from being assigned shifts in this period.
                </Text>
              </View>

              <View style={{ marginTop: 16 }}>
                <PrimaryCTA
                  label={submitting ? 'Saving…' : editing ? 'Update' : 'Add unavailability'}
                  disabled={submitting}
                  onPress={handleSubmit}
                  trailingArrow={false}
                />
              </View>
            </GlassCard>
          ) : (
            <Pressable
              onPress={() => setShowForm(true)}
              style={({ pressed }) => ({
                padding: 14,
                borderRadius: theme.radii.xl,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
                opacity: pressed ? 0.85 : 1,
                marginBottom: 18,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: theme.colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
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
                  Add unavailability period
                </Text>
              </View>
            </Pressable>
          )}

          {/* Existing periods */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>
            Upcoming unavailability · {periods.length}
          </Eyebrow>

          {periods.length > 0 ? (
            periods.map((period) => {
              const days = calculateDays(new Date(period.start_date), new Date(period.end_date));
              const isPast = new Date(period.end_date) < new Date();
              return (
                <GlassCard
                  key={period.id}
                  style={{ marginBottom: 10, opacity: isPast ? 0.6 : 1 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
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
                          d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                          stroke={isPast ? theme.colors.text.tertiary : theme.colors.accent}
                          strokeWidth={1.6}
                          fill="none"
                          strokeLinecap="round"
                        />
                      </Svg>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={{
                          fontSize: 14,
                          color: theme.colors.text.primary,
                          fontWeight: '500',
                          letterSpacing: -0.2,
                        }}
                      >
                        {formatDate(period.start_date)} – {formatDate(period.end_date)}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={{
                          marginTop: 2,
                          fontFamily: theme.fonts.mono,
                          fontSize: 9,
                          letterSpacing: 1.6,
                          textTransform: 'uppercase',
                          color: theme.colors.text.tertiary,
                        }}
                      >
                        {days} day{days !== 1 ? 's' : ''}
                        {isPast ? ' · past' : ''}
                      </Text>
                    </View>
                  </View>
                  {period.reason ? (
                    <Text
                      allowFontScaling={false}
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        color: theme.colors.text.secondary,
                        lineHeight: 20,
                      }}
                    >
                      {period.reason}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <ActionPill label="Edit" onPress={() => handleEdit(period)} />
                    <ActionPill label="Delete" danger onPress={() => handleDelete(period)} />
                  </View>
                </GlassCard>
              );
            })
          ) : (
            <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: theme.colors.surface.chip,
                  borderWidth: 1,
                  borderColor: theme.colors.surface.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M4 5 H20 V19 H4 Z M4 10 H20 M8 3 V7 M16 3 V7"
                    stroke={theme.colors.text.tertiary}
                    strokeWidth={1.5}
                    fill="none"
                    strokeLinecap="round"
                  />
                </Svg>
              </View>
              <Text
                allowFontScaling={false}
                style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}
              >
                No unavailability set
              </Text>
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 4,
                  textAlign: 'center',
                  fontSize: 12,
                  color: theme.colors.text.secondary,
                  lineHeight: 18,
                }}
              >
                You haven't marked any upcoming dates. Tap the button above to add one.
              </Text>
            </GlassCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Back button */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={[
          styles.closeBtn,
          {
            top: insets.top + 12,
            backgroundColor: theme.colors.surface.chip,
            borderColor: theme.colors.surface.hairline,
          },
        ]}
      >
        <Svg width={10} height={16} viewBox="0 0 10 16">
          <Path d="M8 2 L2 8 L8 14" stroke={theme.colors.text.primary} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      {/* iOS pickers */}
      {Platform.OS === 'ios' && (
        <>
          <IOSPickerModal
            visible={showStartPicker}
            title="Start date"
            value={startDate}
            minimumDate={new Date()}
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
      )}

      {/* Android pickers */}
      {Platform.OS === 'android' && showStartPicker ? (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
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
        {value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </Text>
    </Pressable>
  );
};

const ActionPill: React.FC<{ label: string; danger?: boolean; onPress: () => void }> = ({
  label,
  danger,
  onPress,
}) => {
  const theme = useRedesignTheme();
  const color = danger ? theme.colors.accent : theme.colors.text.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 10,
        borderRadius: theme.radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface.chip,
        borderWidth: 1,
        borderColor: danger ? theme.colors.accentBorder : theme.colors.surface.hairline,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color,
          fontWeight: '500',
        }}
      >
        {label}
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
  closeBtn: {
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

export default ContractorUnavailabilityScreenV2;
