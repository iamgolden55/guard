/**
 * IncidentFormScreenV2 — Phase 4 re-skin of the comprehensive incident form.
 * Preserves location capture, photo/video pickers + optimisation, and the
 * incidentService.submitIncident wiring. Only the presentation layer changes.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Switch,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { CameraModal } from '../../../components/camera/CameraModal';
import { VideoPlayerModal } from '../../../components/video';
import type {
  IncidentType,
  IncidentSeverity,
  Incident,
} from '../../../types/incident';
import { incidentService } from '../../../services/incidentService';
import { locationService } from '../../../services/locationService';
import { photoService } from '../../../services/photoService';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

interface RouteParams {
  shiftId?: number;
  prefilledType?: IncidentType;
  prefilledSeverity?: IncidentSeverity;
}

const INCIDENT_TYPES: Array<{ value: IncidentType; label: string; d: string }> = [
  {
    value: 'security_breach',
    label: 'Security breach',
    d: 'M12 2 L2 6 v6 c0 5 4 8 10 9 6 -1 10 -4 10 -9 V6 Z',
  },
  {
    value: 'medical_emergency',
    label: 'Medical',
    d: 'M12 4 V20 M4 12 H20',
  },
  {
    value: 'fire_alarm',
    label: 'Fire alarm',
    d: 'M12 2 C 8 6 6 10 6 14 a6 6 0 0 0 12 0 c 0 -4 -2 -8 -6 -12 Z',
  },
  {
    value: 'suspicious_activity',
    label: 'Suspicious',
    d: 'M12 5 a7 7 0 1 0 0 14 a7 7 0 0 0 0 -14 M12 9 V13 M12 16 h.01',
  },
  {
    value: 'property_damage',
    label: 'Property',
    d: 'M4 10 L12 4 L20 10 V20 H4 Z M10 20 V14 h4 V20',
  },
  {
    value: 'assault',
    label: 'Assault',
    d: 'M13 2 L11 14 h4 L9 22 l2 -10 h-4 Z',
  },
  {
    value: 'other',
    label: 'Other',
    d: 'M5 12 h.01 M12 12 h.01 M19 12 h.01',
  },
];

const SEVERITY_LEVELS: Array<{
  value: IncidentSeverity;
  label: string;
  color: string;
}> = [
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'medium', label: 'Medium', color: '#facc15' },
  { value: 'high', label: 'High', color: '#fb923c' },
  { value: 'critical', label: 'Critical', color: '#E1342C' },
];

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

export const IncidentFormScreenV2: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { shiftId, prefilledType, prefilledSeverity } =
    (route.params as RouteParams) || {};
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const [incidentType, setIncidentType] = useState<IncidentType>(
    prefilledType || 'other',
  );
  const [severity, setSeverity] = useState<IncidentSeverity>(
    prefilledSeverity || 'medium',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [personsInvolved, setPersonsInvolved] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [policeNotified, setPoliceNotified] = useState(false);
  const [ambulanceCalled, setAmbulanceCalled] = useState(false);

  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    const getLocation = async () => {
      try {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
      } catch (error) {
        logger.error('[IncidentForm] Failed to get location', { error });
      }
    };
    getLocation();
  }, []);

  const handleCameraPhoto = () => setShowCameraModal(true);

  const handlePhotoTaken = async (photoUri: string) => {
    try {
      const optimized = await photoService.optimizePhoto(photoUri);
      setPhotos((prev) => [...prev, optimized.uri]);
    } catch (error) {
      logger.error('[IncidentForm] Failed to process photo', { error });
      Alert.alert('Error', 'Failed to process photo. Please try again.');
    }
  };

  const handleGalleryPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });
      if (!result.canceled) {
        for (const asset of result.assets) {
          const optimized = await photoService.optimizePhoto(asset.uri);
          setPhotos((prev) => [...prev, optimized.uri]);
        }
      }
    } catch (error) {
      logger.error('[IncidentForm] Failed to pick photos from gallery', { error });
      Alert.alert('Error', 'Failed to select photos. Please try again.');
    }
  };

  const handleRemovePhoto = (photoUri: string) => {
    Alert.alert('Remove photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotos((prev) => prev.filter((p) => p !== photoUri));
          try {
            await photoService.deletePhoto(photoUri);
          } catch (error) {
            logger.error('[IncidentForm] Failed to delete photo', { error });
          }
        },
      },
    ]);
  };

  const handleCameraVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to record videos');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 120,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
      if (!result.canceled && result.assets[0]) {
        setVideos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      logger.error('[IncidentForm] Failed to record video', { error });
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  const handleRemoveVideo = (videoUri: string) => {
    Alert.alert('Remove video', 'Are you sure you want to remove this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setVideos((prev) => prev.filter((v) => v !== videoUri)),
      },
    ]);
  };

  const handlePlayVideo = (videoUri: string) => {
    setSelectedVideo(videoUri);
    setShowVideoPlayer(true);
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Required field', 'Please enter a title for the incident');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Required field', 'Please provide a description of what happened');
      return false;
    }
    if (!locationDescription.trim()) {
      Alert.alert('Required field', 'Please describe where the incident occurred');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      setIsSubmitting(true);
      const incident: Incident = {
        shift: shiftId,
        incident_type: incidentType,
        severity,
        title: title.trim(),
        description: description.trim(),
        location_description: locationDescription.trim(),
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        occurred_at: new Date().toISOString(),
        reported_at: new Date().toISOString(),
        photos: photos.length > 0 ? photos : undefined,
        videos: videos.length > 0 ? videos : undefined,
        witnesses: witnesses.trim()
          ? witnesses.split(',').map((w) => w.trim())
          : undefined,
        persons_involved: personsInvolved.trim()
          ? personsInvolved.split(',').map((p) => p.trim())
          : undefined,
        actions_taken: actionsTaken.trim() || undefined,
        police_notified: policeNotified,
        ambulance_called: ambulanceCalled,
      };
      await incidentService.submitIncident(incident);
      Alert.alert(
        'Incident reported',
        'Your incident report has been submitted successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      logger.error('[IncidentForm] Failed to submit incident', { error });
      Alert.alert('Error', 'Failed to submit incident report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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
            paddingBottom: 120 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Eyebrow color={theme.colors.accent}>Report · Step 2 of 2</Eyebrow>
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
            Report details
          </Text>
          <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
            Fill in what happened, where, and any evidence
          </Eyebrow>

          {/* Type */}
          <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Incident type</Eyebrow>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 8,
            }}
          >
            {INCIDENT_TYPES.map((t) => {
              const active = incidentType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setIncidentType(t.value)}
                  style={({ pressed }) => ({
                    width: '48.5%',
                    padding: 12,
                    borderRadius: theme.radii.lg,
                    backgroundColor: active
                      ? theme.colors.accentSoft
                      : theme.colors.surface.card,
                    borderWidth: 1,
                    borderColor: active
                      ? theme.colors.accentBorder
                      : theme.colors.surface.hairline,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d={t.d}
                      stroke={active ? theme.colors.accent : theme.colors.text.secondary}
                      strokeWidth={1.6}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: active ? theme.colors.accent : theme.colors.text.primary,
                      fontWeight: active ? '500' : '400',
                      letterSpacing: -0.1,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Severity */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 10 }}>
            Severity
          </Eyebrow>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.surface.card,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              overflow: 'hidden',
            }}
          >
            {SEVERITY_LEVELS.map((sev, idx) => {
              const active = severity === sev.value;
              return (
                <Pressable
                  key={sev.value}
                  onPress={() => setSeverity(sev.value)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? hexAlpha(sev.color, 0.14) : 'transparent',
                    borderLeftWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderLeftColor: theme.colors.surface.hairline,
                    flexDirection: 'row',
                    gap: 6,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: sev.color,
                    }}
                  />
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.6,
                      textTransform: 'uppercase',
                      color: active ? sev.color : theme.colors.text.secondary,
                      fontWeight: '500',
                    }}
                  >
                    {sev.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Title */}
          <FieldLabel required>Title</FieldLabel>
          <TextInputField
            value={title}
            onChangeText={setTitle}
            placeholder="Brief summary of the incident"
            maxLength={100}
            counter
          />

          {/* Description */}
          <FieldLabel required hint="Describe what happened in detail">
            Description
          </FieldLabel>
          <TextInputField
            value={description}
            onChangeText={setDescription}
            placeholder="Provide a detailed description…"
            multiline
          />

          {/* Location */}
          <FieldLabel required hint="Where did this incident occur?">
            Location
          </FieldLabel>
          <TextInputField
            value={locationDescription}
            onChangeText={setLocationDescription}
            placeholder="e.g. Main entrance, Floor 2 restroom"
          />
          {currentLocation ? (
            <View
              style={{
                marginTop: 8,
                alignSelf: 'flex-start',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: hexAlpha('#22c55e', 0.14),
                borderWidth: 1,
                borderColor: hexAlpha('#22c55e', 0.4),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2 C 8 2 5 5 5 9 c 0 5 7 13 7 13 s 7 -8 7 -13 c 0 -4 -3 -7 -7 -7 z M12 11 a2 2 0 1 0 0 -4 a2 2 0 0 0 0 4 z"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: '#22c55e',
                  fontWeight: '500',
                }}
              >
                GPS · {currentLocation.latitude.toFixed(4)},{' '}
                {currentLocation.longitude.toFixed(4)}
              </Text>
            </View>
          ) : null}

          {/* Witnesses */}
          <FieldLabel hint="Names of witnesses, comma-separated">Witnesses</FieldLabel>
          <TextInputField
            value={witnesses}
            onChangeText={setWitnesses}
            placeholder="e.g. John Smith, Jane Doe"
          />

          {/* Persons involved */}
          <FieldLabel hint="Names of people involved, comma-separated">
            Persons involved
          </FieldLabel>
          <TextInputField
            value={personsInvolved}
            onChangeText={setPersonsInvolved}
            placeholder="e.g. Suspect, victim"
          />

          {/* Actions taken */}
          <FieldLabel hint="What did you do to manage the situation?">
            Actions taken
          </FieldLabel>
          <TextInputField
            value={actionsTaken}
            onChangeText={setActionsTaken}
            placeholder="Describe actions taken…"
            multiline
          />

          {/* Evidence */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 10 }}>
            Evidence
          </Eyebrow>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <EvidenceTile
              label="Camera"
              d="M3 7 H7 L9 5 H15 L17 7 H21 V19 H3 Z M12 10 a3 3 0 1 0 0 6 a3 3 0 0 0 0 -6"
              onPress={handleCameraPhoto}
            />
            <EvidenceTile
              label="Gallery"
              d="M4 5 H20 V19 H4 Z M4 15 L9 10 L13 14 L16 11 L20 15 M15 8 a2 2 0 1 0 0 -4 a2 2 0 0 0 0 4"
              onPress={handleGalleryPhoto}
            />
            <EvidenceTile
              label="Video"
              d="M3 7 H14 V17 H3 Z M14 10 L21 7 V17 L14 14"
              onPress={handleCameraVideo}
            />
          </View>

          {photos.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>
                Photos · {photos.length}
              </Eyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {photos.map((uri, index) => (
                  <Thumbnail
                    key={uri}
                    index={index}
                    onRemove={() => handleRemovePhoto(uri)}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 12,
                      }}
                    />
                  </Thumbnail>
                ))}
              </View>
            </View>
          ) : null}

          {videos.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Eyebrow style={{ marginLeft: 4, marginBottom: 8 }}>
                Videos · {videos.length}
              </Eyebrow>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {videos.map((uri, index) => (
                  <Thumbnail
                    key={uri}
                    index={index}
                    onRemove={() => handleRemoveVideo(uri)}
                  >
                    <Pressable
                      onPress={() => handlePlayVideo(uri)}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 12,
                        backgroundColor: theme.isDark ? '#141417' : '#e9e6df',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Svg width={32} height={32} viewBox="0 0 24 24">
                        <Path
                          d="M12 2 a10 10 0 1 0 0 20 a10 10 0 0 0 0 -20 M10 8 v8 l6 -4 z"
                          fill={theme.colors.accent}
                        />
                      </Svg>
                    </Pressable>
                  </Thumbnail>
                ))}
              </View>
            </View>
          ) : null}

          {/* Emergency services */}
          <Eyebrow style={{ marginLeft: 4, marginTop: 18, marginBottom: 10 }}>
            Emergency services
          </Eyebrow>
          <View style={{ gap: 8 }}>
            <SwitchRow
              label="Police notified"
              d="M4 7 Q 4 4 7 4 h3 L 12 8 L 10 10 Q 12 14 16 16 L 18 14 L 22 16 V 19 Q 22 22 19 22 Q 10 22 4 15 Q 4 11 4 7 Z"
              value={policeNotified}
              onChange={setPoliceNotified}
            />
            <SwitchRow
              label="Ambulance called"
              d="M4 8 H16 L20 12 V16 H4 Z M8 16 a2 2 0 1 0 0 4 a2 2 0 0 0 0 -4 M17 16 a2 2 0 1 0 0 4 a2 2 0 0 0 0 -4 M10 11 h4 M12 9 v4"
              value={ambulanceCalled}
              onChange={setAmbulanceCalled}
            />
          </View>

          <Text
            allowFontScaling={false}
            style={{
              marginTop: 16,
              textAlign: 'center',
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.4,
              color: theme.colors.text.tertiary,
            }}
          >
            * REQUIRED FIELDS
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Back */}
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
          label={isSubmitting ? 'Submitting…' : 'Submit report'}
          trailingArrow={!isSubmitting}
          disabled={isSubmitting}
          onPress={handleSubmit}
        />
      </View>

      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onPhotoTaken={handlePhotoTaken}
        title="Capture evidence photo"
        tips={[
          'Capture clear evidence of the incident',
          'Include relevant surroundings',
          'Ensure good lighting',
        ]}
      />
      <VideoPlayerModal
        visible={showVideoPlayer}
        videoUri={selectedVideo}
        onClose={() => setShowVideoPlayer(false)}
      />
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────

const FieldLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}> = ({ children, required, hint }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ marginLeft: 4, marginTop: 18, marginBottom: 8 }}>
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
        {children}
        {required ? (
          <Text
            style={{
              color: theme.colors.accent,
              fontWeight: '500',
            }}
          >
            {' *'}
          </Text>
        ) : null}
      </Text>
      {hint ? (
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 4,
            fontSize: 12,
            color: theme.colors.text.tertiary,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

const TextInputField: React.FC<{
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  maxLength?: number;
  counter?: boolean;
}> = ({ value, onChangeText, placeholder, multiline, maxLength, counter }) => {
  const theme = useRedesignTheme();
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        multiline={multiline}
        numberOfLines={multiline ? 4 : undefined}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 110 : 48,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderRadius: theme.radii.xl,
          backgroundColor: theme.colors.surface.card,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
          color: theme.colors.text.primary,
          fontSize: 14,
          lineHeight: 20,
        }}
      />
      {counter && maxLength ? (
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
          {value.length}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
};

const EvidenceTile: React.FC<{
  label: string;
  d: string;
  onPress: () => void;
}> = ({ label, d, onPress }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 16,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.colors.accentSoft,
          borderWidth: 1,
          borderColor: theme.colors.accentBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d={d}
            stroke={theme.colors.accent}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: theme.colors.text.secondary,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const Thumbnail: React.FC<{
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}> = ({ index, onRemove, children }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ width: 96, height: 96, position: 'relative' }}>
      <View
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
        }}
      >
        {children}
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={10} height={10} viewBox="0 0 24 24">
          <Path
            d="M5 5 L19 19 M19 5 L5 19"
            stroke="#fff"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: 'rgba(0,0,0,0.65)',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: '500',
            fontFamily: theme.fonts.mono,
          }}
        >
          {index + 1}
        </Text>
      </View>
    </View>
  );
};

const SwitchRow: React.FC<{
  label: string;
  d: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, d, value, onChange }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        padding: 14,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.surface.card,
        borderWidth: 1,
        borderColor: theme.colors.surface.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.colors.accentSoft,
          borderWidth: 1,
          borderColor: theme.colors.accentBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d={d}
            stroke={theme.colors.accent}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: theme.colors.surface.hairline,
          true: theme.colors.accent,
        }}
        thumbColor="#ffffff"
      />
    </View>
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

export default IncidentFormScreenV2;
