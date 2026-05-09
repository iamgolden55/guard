/**
 * Capacity Check Screen — redesign aligned with the dashboard/check-in V2 visual language.
 *
 * Form for conducting venue capacity monitoring checks.
 *
 * Single-step focus: the count is the hero (huge typed display), the
 * capacity bar sits directly under it, and notes/photo fold away under
 * a "More options" disclosure. When the entered count meets/exceeds the
 * venue capacity, a warning banner + "Action taken" textarea appear.
 *
 * Functionality is unchanged — same submit payload, same validation rules.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { logger } from '../../utils/logger';
import { locationService } from '../../services/locationService';
import { photoService } from '../../services/photoService';
import { shiftChecksService, type CapacityCheck as CapacityCheckRecord } from '../../services/shiftChecksService';
import { useAppSelector } from '../../hooks/useRedux';
import { selectActiveShift } from '../../store/slices/shiftsSlice';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useRedesignTheme } from '../../theme/redesign';
import { Eyebrow, GlassCard, NavBack, PrimaryCTA, StepPill } from '../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'CapacityCheck'>;

export const CapacityCheckScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const activeShift = useAppSelector(selectActiveShift);

  const venueCapacity = activeShift?.venue.capacity ?? 0;
  const warningThresholdPct = activeShift?.venue.capacity_warning_threshold_pct ?? 80;

  // Form state
  const [currentCount, setCurrentCount] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastCheck, setLastCheck] = useState<CapacityCheckRecord | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const countInputRef = useRef<TextInput>(null);

  useEffect(() => {
    logger.info('[CapacityCheck] Screen loaded', { shiftId });
    loadLocation();
    loadLastCheck();
  }, [shiftId]);

  const loadLastCheck = async () => {
    try {
      const shiftGroup = activeShift?.shift_group;
      if (!shiftGroup) {
        const checks = await shiftChecksService.getShiftChecks(shiftId);
        setLastCheck(checks.capacityChecks[0] || null);
        return;
      }
      const latest = await shiftChecksService.getLatestCapacityCheck(shiftGroup);
      setLastCheck(latest);
    } catch (error) {
      logger.warn('[CapacityCheck] Could not load last check (non-fatal):', error);
    }
  };

  const loadLocation = async () => {
    try {
      setLoading(true);
      const coords = await locationService.getCurrentLocation();
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      logger.info('[CapacityCheck] Location captured', coords);
    } catch (error) {
      logger.error('[CapacityCheck] Error getting location:', error);
      Alert.alert(
        'Location Required',
        'Unable to get your location. Please enable location services and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await photoService.capturePhoto();
      if (result && result.uri) {
        setPhotoUri(result.uri);
        const base64 = await photoService.convertToBase64(result.uri);
        setPhotoBase64(base64);
      }
    } catch (error) {
      logger.error('[CapacityCheck] Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
  };

  const parsedCount = useMemo(() => {
    const n = parseInt(currentCount, 10);
    return isNaN(n) ? null : n;
  }, [currentCount]);

  const isAtCapacity = parsedCount !== null && parsedCount >= venueCapacity;

  const capacityPct = useMemo(() => {
    if (parsedCount === null || venueCapacity <= 0) return 0;
    return Math.min((parsedCount / venueCapacity) * 100, 100);
  }, [parsedCount, venueCapacity]);

  const capacityColor = useMemo(() => {
    if (capacityPct >= 100) return theme.colors.accent;
    if (capacityPct >= warningThresholdPct) return '#f59e0b';
    return theme.isDark ? '#4ade80' : '#16a34a';
  }, [capacityPct, warningThresholdPct, theme]);

  const lastCheckSummary = useMemo((): string | null => {
    if (!lastCheck) return null;
    const minutesAgo = Math.max(
      0,
      Math.floor((Date.now() - new Date(lastCheck.timestamp).getTime()) / 60000),
    );
    const performer = lastCheck.performed_by_details;
    const who = performer
      ? `${performer.first_name} ${performer.last_name?.charAt(0) || ''}.`.trim()
      : 'a teammate';
    if (minutesAgo === 0) return `Just logged · ${lastCheck.current_count} by ${who}`;
    return `${minutesAgo} min ago · ${lastCheck.current_count} by ${who}`;
  }, [lastCheck]);

  const validateForm = (): boolean => {
    if (!currentCount.trim()) {
      Alert.alert('Required Field', 'Please enter the current capacity count');
      return false;
    }
    if (parsedCount === null || parsedCount < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number');
      return false;
    }
    if (isAtCapacity && !actionTaken.trim()) {
      Alert.alert(
        'Action Required',
        'Venue is at capacity. Please describe the action taken.'
      );
      return false;
    }
    if (!location) {
      Alert.alert('Location Required', 'Unable to get your location. Please try again.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || parsedCount === null) return;

    try {
      setSubmitting(true);
      logger.info('[CapacityCheck] Submitting check', {
        shiftId,
        currentCount: parsedCount,
        isAtCapacity,
      });

      await shiftChecksService.submitCapacityCheck({
        shift: shiftId,
        current_count: parsedCount,
        venue_capacity: venueCapacity,
        is_at_capacity: isAtCapacity,
        action_taken: actionTaken.trim() || undefined,
        photo_evidence: photoBase64 || undefined,
        location: location!,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Capacity check submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      logger.error('[CapacityCheck] Error submitting check:', error);
      Alert.alert('Error', 'Failed to submit check. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 140 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <NavBack onPress={() => navigation.goBack()} />
            <View style={{ flex: 1 }} />
            <StepPill>Capacity check</StepPill>
          </View>

          {/* Title */}
          <View style={{ marginTop: 16 }}>
            <Eyebrow color={theme.colors.accent}>
              Venue capacity · {venueCapacity}
            </Eyebrow>
            <Text
              allowFontScaling={false}
              style={[styles.heading, { color: theme.colors.text.primary, fontFamily: theme.fonts.sans }]}
            >
              How many people are inside?
            </Text>
            {lastCheckSummary ? (
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 6,
                  fontFamily: theme.fonts.mono,
                  fontSize: 11,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.text.tertiary,
                }}
              >
                {lastCheckSummary}
              </Text>
            ) : null}
          </View>

          {/* Hero count input */}
          <Pressable onPress={() => countInputRef.current?.focus()}>
            <GlassCard style={{ marginTop: 22, padding: 22 }}>
              <View style={styles.countRow}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 96,
                    fontFamily: theme.fonts.sans,
                    fontWeight: '300',
                    letterSpacing: -4,
                    lineHeight: 100,
                    color: parsedCount === null ? theme.colors.text.quaternary : capacityColor,
                  }}
                >
                  {parsedCount === null ? '0' : parsedCount}
                </Text>
                <View style={{ marginLeft: 12, paddingBottom: 18 }}>
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontSize: 28,
                      fontFamily: theme.fonts.sans,
                      fontWeight: '300',
                      color: theme.colors.text.tertiary,
                      letterSpacing: -0.6,
                    }}
                  >
                    / {venueCapacity}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      marginTop: 4,
                      fontFamily: theme.fonts.mono,
                      fontSize: 11,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {capacityPct.toFixed(0)}% full
                  </Text>
                </View>
              </View>

              {/* Capacity bar */}
              <View
                style={[
                  styles.bar,
                  { backgroundColor: theme.colors.surface.chip, borderColor: theme.colors.surface.hairline },
                ]}
              >
                <View
                  style={{
                    width: `${capacityPct}%`,
                    height: '100%',
                    backgroundColor: capacityColor,
                    borderRadius: 4,
                  }}
                />
              </View>

              {/* Hidden TextInput acts as the keypad — large hit area via Pressable above.
                  No returnKeyType / inputAccessoryViewID: number-pad has no return key,
                  and setting one makes iOS float a "Done" accessory pill above the field. */}
              <TextInput
                ref={countInputRef}
                value={currentCount}
                onChangeText={(t) => setCurrentCount(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder=""
                accessibilityLabel="Current capacity count"
                style={styles.hiddenInput}
                maxLength={6}
              />
            </GlassCard>
          </Pressable>

          {/* At capacity warning + action input */}
          {isAtCapacity ? (
            <View style={{ marginTop: 18 }}>
              <GlassCard
                style={{
                  padding: 16,
                  backgroundColor: theme.colors.accentSoft,
                  borderColor: theme.colors.accentBorder,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: theme.colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg width={12} height={12} viewBox="0 0 16 16">
                      <Path
                        d="M8 3 L14 14 H2 Z M8 7 V10 M8 11.5 V11.5"
                        stroke="#fff"
                        strokeWidth={1.6}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Eyebrow color={theme.colors.accent}>At capacity</Eyebrow>
                    <Text
                      allowFontScaling={false}
                      style={{
                        marginTop: 4,
                        fontSize: 13,
                        color: theme.colors.text.primary,
                        fontFamily: theme.fonts.sans,
                        lineHeight: 18,
                      }}
                    >
                      The venue has reached its maximum. Describe the action taken below.
                    </Text>
                  </View>
                </View>

                <Eyebrow style={{ marginTop: 14, marginBottom: 8 }}>Action taken *</Eyebrow>
                <TextInput
                  value={actionTaken}
                  onChangeText={setActionTaken}
                  placeholder="e.g. Stopped entry, notified supervisor"
                  placeholderTextColor={theme.colors.text.tertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.input,
                    {
                      minHeight: 80,
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.surface.hairlineStrong,
                      color: theme.colors.text.primary,
                      fontFamily: theme.fonts.sans,
                    },
                  ]}
                />
              </GlassCard>
            </View>
          ) : null}

          {/* More options disclosure */}
          <Pressable
            onPress={() => setMoreOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={moreOpen ? 'Hide notes and photo' : 'Show notes and photo'}
            style={({ pressed }) => [
              styles.disclosureBtn,
              {
                backgroundColor: theme.colors.surface.chip,
                borderColor: theme.colors.surface.hairline,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Eyebrow tracking={1.8}>
              {moreOpen ? 'Hide options' : 'Add notes or photo'}
            </Eyebrow>
            <Svg width={10} height={10} viewBox="0 0 16 16" style={{ marginLeft: 8 }}>
              <Path
                d={moreOpen ? 'M3 10 L8 5 L13 10' : 'M3 6 L8 11 L13 6'}
                stroke={theme.colors.text.secondary}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

          {moreOpen ? (
            <View style={{ marginTop: 14, gap: 14 }}>
              {/* Notes */}
              <GlassCard style={{ padding: 16 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Notes</Eyebrow>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any observations…"
                  placeholderTextColor={theme.colors.text.tertiary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  style={[
                    styles.input,
                    {
                      minHeight: 80,
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.surface.hairlineStrong,
                      color: theme.colors.text.primary,
                      fontFamily: theme.fonts.sans,
                    },
                  ]}
                />
              </GlassCard>

              {/* Photo */}
              <GlassCard style={{ padding: 16 }}>
                <Eyebrow style={{ marginBottom: 10 }}>Photo evidence</Eyebrow>
                {photoUri ? (
                  <View style={styles.photoContainer}>
                    <Image source={{ uri: photoUri }} style={styles.photo} />
                    <Pressable
                      style={styles.removePhotoBtn}
                      onPress={handleRemovePhoto}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      hitSlop={8}
                    >
                      <Svg width={14} height={14} viewBox="0 0 16 16">
                        <Path
                          d="M4 4 L12 12 M12 4 L4 12"
                          stroke="#fff"
                          strokeWidth={1.6}
                          strokeLinecap="round"
                        />
                      </Svg>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleTakePhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                    style={({ pressed }) => [
                      styles.photoBtn,
                      {
                        borderColor: theme.colors.surface.hairlineStrong,
                        backgroundColor: theme.colors.surface.chip,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Svg width={20} height={20} viewBox="0 0 24 24">
                      <Path
                        d="M4 7 h4 l2 -2 h4 l2 2 h4 v12 H4 Z"
                        stroke={theme.colors.text.secondary}
                        strokeWidth={1.5}
                        fill="none"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M12 11 a3 3 0 1 0 0 6 a3 3 0 0 0 0 -6"
                        stroke={theme.colors.text.secondary}
                        strokeWidth={1.5}
                        fill="none"
                      />
                    </Svg>
                    <Text
                      allowFontScaling={false}
                      style={{
                        marginLeft: 10,
                        fontSize: 14,
                        color: theme.colors.text.primary,
                        fontFamily: theme.fonts.sans,
                        fontWeight: '500',
                      }}
                    >
                      Take photo
                    </Text>
                  </Pressable>
                )}
              </GlassCard>
            </View>
          ) : null}

          {/* Location chip */}
          {location ? (
            <View style={[styles.locationChip, { borderColor: theme.colors.surface.hairline }]}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.status.online,
                }}
              />
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.text.tertiary,
                  marginLeft: 8,
                }}
              >
                Location captured · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            </View>
          ) : (
            <View style={[styles.locationChip, { borderColor: theme.colors.surface.hairline }]}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.colors.text.tertiary,
                }}
              />
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: theme.colors.text.tertiary,
                  marginLeft: 8,
                }}
              >
                {loading ? 'Locating…' : 'Location pending'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 14,
              backgroundColor: theme.colors.canvas,
              borderTopColor: theme.colors.surface.hairline,
            },
          ]}
        >
          <PrimaryCTA
            label={submitting ? 'Submitting…' : 'Submit check'}
            onPress={handleSubmit}
            disabled={submitting || loading || !location || parsedCount === null}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heading: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: '400',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bar: {
    marginTop: 14,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  disclosureBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  photoBtn: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationChip: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
});

export default CapacityCheckScreen;
