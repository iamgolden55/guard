/**
 * VoiceReportScreenV2 — Phase 4 re-skin of the hands-free voice-note report.
 * Preserves Audio.Recording wiring, location capture and incidentService.submitIncident.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { incidentService } from '../../../services/incidentService';
import { locationService } from '../../../services/locationService';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA } from '../../../components/redesign';

export const VoiceReportScreenV2: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { shiftId } = (route.params as { shiftId?: number }) || {};
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.18,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0);
    }
  }, [isRecording, pulseAnim, glowAnim]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to record voice reports',
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      logger.error('[VoiceReport] Failed to start recording', { error });
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setIsRecording(false);
    } catch (error) {
      logger.error('[VoiceReport] Failed to stop recording', { error });
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const submitVoiceReport = async () => {
    if (!recordingUri) return;
    try {
      setIsSubmitting(true);
      const location = await locationService.getCurrentLocation();
      await incidentService.submitIncident({
        shift: shiftId,
        incident_type: 'other',
        severity: 'medium',
        title: 'Voice Report',
        description: 'Incident reported via voice recording',
        location_description: 'Location captured automatically',
        latitude: location.latitude,
        longitude: location.longitude,
        occurred_at: new Date().toISOString(),
        reported_at: new Date().toISOString(),
        voice_note: recordingUri,
      });
      Alert.alert('Success', 'Voice report submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      logger.error('[VoiceReport] Failed to submit', { error });
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const instruction = isRecording
    ? 'Recording · Tap to stop'
    : recordingUri
      ? 'Recording complete · Review or re-record'
      : 'Tap the microphone to start';

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.7],
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      {/* Content */}
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 64,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <Eyebrow color={theme.colors.accent}>Voice note</Eyebrow>
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
          Voice report
        </Text>
        <Eyebrow style={{ marginTop: 6, marginBottom: 18 }}>
          Hands-free when things are urgent
        </Eyebrow>

        {/* Mic */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{ alignItems: 'center', justifyContent: 'center', height: 280 }}
          >
            {/* Ambient glow */}
            {isRecording ? (
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  backgroundColor: theme.colors.accent,
                  opacity: glowOpacity,
                  transform: [{ scale: pulseAnim }],
                }}
              />
            ) : null}

            <Animated.View
              style={{
                transform: [{ scale: pulseAnim }],
              }}
            >
              <Pressable
                onPress={isRecording ? stopRecording : startRecording}
                style={({ pressed }) => ({
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: isRecording
                    ? theme.colors.accent
                    : theme.colors.surface.card,
                  borderWidth: 1,
                  borderColor: isRecording
                    ? theme.colors.accentBorder
                    : theme.colors.surface.hairline,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.9 : 1,
                  shadowColor: theme.colors.accent,
                  shadowOpacity: isRecording ? 0.5 : 0,
                  shadowRadius: 30,
                  shadowOffset: { width: 0, height: 10 },
                })}
              >
                <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                  {isRecording ? (
                    <Path
                      d="M7 7 H17 V17 H7 Z"
                      fill="#ffffff"
                      stroke="#ffffff"
                      strokeWidth={1}
                      strokeLinejoin="round"
                    />
                  ) : (
                    <Path
                      d="M9 3 h6 a3 3 0 0 1 3 3 v8 a3 3 0 0 1 -3 3 h-6 a3 3 0 0 1 -3 -3 v-8 a3 3 0 0 1 3 -3 z M5 12 a7 7 0 0 0 14 0 M12 19 v3"
                      stroke={theme.colors.accent}
                      strokeWidth={1.8}
                      fill="none"
                      strokeLinecap="round"
                    />
                  )}
                </Svg>
              </Pressable>
            </Animated.View>
          </View>

          {/* Duration */}
          {isRecording ? (
            <View
              style={{
                marginTop: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accentBorder,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.colors.accent,
                }}
              />
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 13,
                  letterSpacing: 1.4,
                  color: theme.colors.accent,
                  fontWeight: '500',
                }}
              >
                {formatDuration(duration)}
              </Text>
            </View>
          ) : recordingUri ? (
            <View
              style={{
                marginTop: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: 'rgba(34,197,94,0.14)',
                borderWidth: 1,
                borderColor: 'rgba(34,197,94,0.4)',
              }}
            >
              <Svg width={12} height={12} viewBox="0 0 24 24">
                <Path
                  d="M5 12 L10 17 L19 7"
                  stroke="#22c55e"
                  strokeWidth={2.4}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: '#22c55e',
                  fontWeight: '500',
                }}
              >
                {formatDuration(duration)} recorded
              </Text>
            </View>
          ) : null}

          <Text
            allowFontScaling={false}
            style={{
              marginTop: 18,
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: theme.colors.text.tertiary,
              textAlign: 'center',
            }}
          >
            {instruction}
          </Text>
        </View>

        {/* Info */}
        <GlassCard
          style={{
            padding: 12,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: theme.colors.text.secondary,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              i
            </Text>
          </View>
          <Text
            allowFontScaling={false}
            style={{
              flex: 1,
              fontSize: 12,
              color: theme.colors.text.secondary,
              lineHeight: 18,
            }}
          >
            Speak clearly. Describe what happened, when, where, and who was
            involved. Location is captured automatically.
          </Text>
        </GlassCard>

        {/* Actions */}
        {recordingUri && !isRecording ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => {
                setRecordingUri(null);
                setDuration(0);
              }}
              disabled={isSubmitting}
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
                }}
              >
                Re-record
              </Text>
            </Pressable>
            <View style={{ flex: 1.4 }}>
              <PrimaryCTA
                label={isSubmitting ? 'Submitting…' : 'Submit report'}
                trailingArrow={!isSubmitting}
                disabled={isSubmitting}
                onPress={submitVoiceReport}
              />
            </View>
          </View>
        ) : null}
      </View>

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

export default VoiceReportScreenV2;
