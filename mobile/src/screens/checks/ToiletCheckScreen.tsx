/**
 * Toilet Check Screen — redesign aligned with the Capacity / dashboard V2 visual language.
 *
 * Form for conducting toilet/restroom facility checks. Functionality is unchanged
 * from the prior version — same form state, payload, and validation rules.
 *
 * Visual changes:
 *   - Warm paper canvas in light, near-black canvas in dark
 *   - Geist-style sans + mono, single red accent (no green/orange/red traffic light)
 *   - GlassCards with hairline borders, eyebrow section labels
 *   - Slim SVG iconography matching ShiftChecks / CapacityCheck
 *   - Sticky PrimaryCTA footer instead of inline button card
 */

import React, { useState, useEffect } from 'react';
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
import { shiftChecksService } from '../../services/shiftChecksService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { useRedesignTheme, RedesignTheme } from '../../theme/redesign';
import { Eyebrow, GlassCard, NavBack, PrimaryCTA, StepPill } from '../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'ToiletCheck'>;

type ConditionType = 'clean' | 'needs_cleaning' | 'requires_maintenance';

const CONDITION_OPTIONS: Array<{
  id: ConditionType;
  label: string;
  helper: string;
  icon: 'check' | 'warn' | 'wrench';
}> = [
  { id: 'clean', label: 'Clean', helper: 'No issues found', icon: 'check' },
  { id: 'needs_cleaning', label: 'Needs cleaning', helper: 'Service required', icon: 'warn' },
  { id: 'requires_maintenance', label: 'Requires maintenance', helper: 'Escalate to facilities', icon: 'wrench' },
];

const SUPPLY_OPTIONS = [
  { id: 'toilet_paper', label: 'Toilet paper' },
  { id: 'soap', label: 'Soap' },
  { id: 'paper_towels', label: 'Paper towels' },
  { id: 'hand_sanitizer', label: 'Hand sanitiser' },
];

export const ToiletCheckScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  // Form state
  const [locationName, setLocationName] = useState('');
  const [condition, setCondition] = useState<ConditionType>('clean');
  const [isOutOfOrder, setIsOutOfOrder] = useState(false);
  const [suppliesNeeded, setSuppliesNeeded] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logger.info('[ToiletCheck] Screen loaded', { shiftId });
    loadLocation();
  }, [shiftId]);

  const loadLocation = async () => {
    try {
      setLoading(true);
      const coords = await locationService.getCurrentLocation();
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      logger.info('[ToiletCheck] Location captured', coords);
    } catch (error) {
      logger.error('[ToiletCheck] Error getting location:', error);
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
      logger.error('[ToiletCheck] Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
  };

  const toggleSupply = (supplyId: string) => {
    setSuppliesNeeded((prev) =>
      prev.includes(supplyId)
        ? prev.filter((s) => s !== supplyId)
        : [...prev, supplyId]
    );
  };

  const needsAttention =
    condition !== 'clean' || isOutOfOrder || suppliesNeeded.length > 0;

  const validateForm = (): boolean => {
    if (!locationName.trim()) {
      Alert.alert('Required Field', 'Please enter the restroom location');
      return false;
    }
    if (!location) {
      Alert.alert('Location Required', 'Unable to get your location. Please try again.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      logger.info('[ToiletCheck] Submitting check', {
        shiftId,
        locationName,
        condition,
        needsAttention,
      });

      await shiftChecksService.submitToiletCheck({
        shift: shiftId,
        location_name: locationName,
        condition,
        needs_attention: needsAttention,
        is_out_of_order: isOutOfOrder,
        supplies_needed: suppliesNeeded,
        photo_evidence: photoBase64 || undefined,
        location,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Success', 'Toilet check submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      logger.error('[ToiletCheck] Error submitting check:', error);
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
            <StepPill>Toilet check</StepPill>
          </View>

          {/* Title */}
          <View style={{ marginTop: 16 }}>
            <Eyebrow color={theme.colors.accent}>Restroom inspection</Eyebrow>
            <Text
              allowFontScaling={false}
              style={[
                styles.heading,
                { color: theme.colors.text.primary, fontFamily: theme.fonts.sans },
              ]}
            >
              Log restroom condition
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                marginTop: 6,
                fontSize: 13,
                color: theme.colors.text.secondary,
                fontFamily: theme.fonts.sans,
              }}
            >
              Where it is, what shape it is in, and what it needs.
            </Text>
          </View>

          {/* Restroom location */}
          <Section title="Restroom location" required theme={theme}>
            <TextInput
              value={locationName}
              onChangeText={setLocationName}
              placeholder="e.g. Ground floor male, Level 2 female"
              placeholderTextColor={theme.colors.text.tertiary}
              autoCapitalize="words"
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.surface.hairlineStrong,
                  color: theme.colors.text.primary,
                  fontFamily: theme.fonts.sans,
                },
              ]}
            />
          </Section>

          {/* Condition */}
          <Section title="Condition" required theme={theme}>
            <View style={{ gap: 10 }}>
              {CONDITION_OPTIONS.map((opt) => {
                const selected = condition === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setCondition(opt.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.label}
                    style={({ pressed }) => [
                      styles.optionRow,
                      {
                        backgroundColor: selected
                          ? theme.colors.accentSoft
                          : theme.colors.canvasElevated,
                        borderColor: selected
                          ? theme.colors.accentBorder
                          : theme.colors.surface.hairlineStrong,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionIcon,
                        {
                          backgroundColor: selected
                            ? theme.colors.canvas
                            : theme.colors.surface.chip,
                          borderColor: selected
                            ? theme.colors.accentBorder
                            : theme.colors.surface.hairlineStrong,
                        },
                      ]}
                    >
                      <ConditionIcon
                        kind={opt.icon}
                        color={selected ? theme.colors.accent : theme.colors.text.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        allowFontScaling={false}
                        style={{
                          fontFamily: theme.fonts.sans,
                          fontSize: 15,
                          fontWeight: '500',
                          letterSpacing: -0.2,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {opt.label}
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={{
                          marginTop: 2,
                          fontSize: 12,
                          color: theme.colors.text.secondary,
                          fontFamily: theme.fonts.sans,
                        }}
                      >
                        {opt.helper}
                      </Text>
                    </View>
                    {selected ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: theme.colors.accent,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Svg width={10} height={10} viewBox="0 0 16 16">
                          <Path
                            d="M3 8 L7 12 L13 4"
                            stroke="#fff"
                            strokeWidth={2}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1,
                          borderColor: theme.colors.surface.hairlineStrong,
                        }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Out of order toggle */}
          <Pressable
            onPress={() => setIsOutOfOrder((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: isOutOfOrder }}
            accessibilityLabel="Restroom is out of order"
            style={({ pressed }) => [
              styles.toggleRow,
              {
                backgroundColor: isOutOfOrder
                  ? theme.colors.accentSoft
                  : theme.colors.surface.chip,
                borderColor: isOutOfOrder
                  ? theme.colors.accentBorder
                  : theme.colors.surface.hairline,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Eyebrow
                color={isOutOfOrder ? theme.colors.accent : theme.colors.text.secondary}
              >
                Status
              </Eyebrow>
              <Text
                allowFontScaling={false}
                style={{
                  marginTop: 4,
                  fontSize: 14,
                  fontWeight: '500',
                  color: theme.colors.text.primary,
                  fontFamily: theme.fonts.sans,
                }}
              >
                Restroom is out of order
              </Text>
            </View>
            <View
              style={[
                styles.toggleTrack,
                {
                  backgroundColor: isOutOfOrder
                    ? theme.colors.accent
                    : theme.colors.surface.hairlineStrong,
                },
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  { transform: [{ translateX: isOutOfOrder ? 18 : 0 }] },
                ]}
              />
            </View>
          </Pressable>

          {/* Supplies */}
          <Section title="Supplies needed" theme={theme}>
            <View style={styles.chipsWrap}>
              {SUPPLY_OPTIONS.map((s) => {
                const selected = suppliesNeeded.includes(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggleSupply(s.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={s.label}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: selected
                          ? theme.colors.accent
                          : theme.colors.canvasElevated,
                        borderColor: selected
                          ? theme.colors.accent
                          : theme.colors.surface.hairlineStrong,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    {selected ? (
                      <Svg width={10} height={10} viewBox="0 0 16 16" style={{ marginRight: 6 }}>
                        <Path
                          d="M3 8 L7 12 L13 4"
                          stroke="#fff"
                          strokeWidth={2}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    ) : null}
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontFamily: theme.fonts.sans,
                        fontSize: 13,
                        fontWeight: '500',
                        color: selected ? '#fff' : theme.colors.text.primary,
                      }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Photo */}
          <Section title="Photo evidence (optional)" theme={theme}>
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
          </Section>

          {/* Notes */}
          <Section title="Notes (optional)" theme={theme}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything the next shift should know"
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: theme.colors.canvasElevated,
                  borderColor: theme.colors.surface.hairlineStrong,
                  color: theme.colors.text.primary,
                  fontFamily: theme.fonts.sans,
                },
              ]}
            />
          </Section>

          {/* Location chip */}
          <View
            style={[
              styles.locationChip,
              {
                borderColor: theme.colors.surface.hairline,
                marginTop: 18,
              },
            ]}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: location
                  ? theme.colors.status.online
                  : theme.colors.text.tertiary,
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
              {location
                ? `Location captured · ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                : loading
                  ? 'Locating…'
                  : 'Location pending'}
            </Text>
          </View>
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
            disabled={submitting || loading || !location}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Section wrapper — eyebrow label above a GlassCard
// ─────────────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  required?: boolean;
  theme: RedesignTheme;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, required, theme, children }) => (
  <View style={{ marginTop: 22 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginLeft: 4 }}>
      <Eyebrow>{title}</Eyebrow>
      {required ? (
        <Text
          allowFontScaling={false}
          style={{
            marginLeft: 6,
            fontFamily: theme.fonts.mono,
            fontSize: 11,
            letterSpacing: 1.6,
            color: theme.colors.accent,
          }}
        >
          *
        </Text>
      ) : null}
    </View>
    <GlassCard style={{ padding: 16 }}>{children}</GlassCard>
  </View>
);

// ─────────────────────────────────────────────────────────────
// Slim line-art icons for condition options
// ─────────────────────────────────────────────────────────────
const ConditionIcon: React.FC<{ kind: 'check' | 'warn' | 'wrench'; color: string }> = ({
  kind,
  color,
}) => {
  if (kind === 'check') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          d="M5 12 L10 17 L19 7"
          stroke={color}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (kind === 'warn') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Path
          d="M12 3 L21 20 H3 Z M12 10 V14 M12 16.5 V16.5"
          stroke={color}
          strokeWidth={1.6}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  // wrench
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M14 6 a4 4 0 0 1 4 4 a4 4 0 0 1 -1 2.6 L21 17 L17 21 L12.6 17 a4 4 0 0 1 -2.6 1 a4 4 0 0 1 -4 -4 a4 4 0 0 1 4 -4 c .5 0 1 .1 1.4 .3 L8 7 L11 4 L14 6 z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
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
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  toggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
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

export default ToiletCheckScreen;
