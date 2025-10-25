/**
 * VoiceReportScreen
 * Voice recording interface for hands-free incident reporting
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Container, Heading2, Body, Caption, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { incidentService } from '../../services/incidentService';
import { locationService } from '../../services/locationService';
import { logger } from '../../utils/logger';

export const VoiceReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { shiftId } = (route.params as { shiftId?: number }) || {};

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout>();

  // Pulse animation during recording
  React.useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      logger.info('[VoiceReport] Requesting audio permissions');
      const { status } = await Audio.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow microphone access to record voice reports'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      logger.info('[VoiceReport] Starting recording');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);

      // Timer for duration
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      logger.info('[VoiceReport] Recording started');
    } catch (error) {
      logger.error('[VoiceReport] Failed to start recording', { error });
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      logger.info('[VoiceReport] Stopping recording');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      setRecordingUri(uri);
      setRecording(null);
      setIsRecording(false);

      logger.info('[VoiceReport] Recording stopped', { uri, duration });
    } catch (error) {
      logger.error('[VoiceReport] Failed to stop recording', { error });
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  const submitVoiceReport = async () => {
    if (!recordingUri) return;

    try {
      setIsSubmitting(true);
      logger.info('[VoiceReport] Submitting voice report');

      // Get current location
      const location = await locationService.getCurrentLocation();

      // Submit incident
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

      Alert.alert(
        'Success',
        'Voice report submitted successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
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

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Heading2>Voice Report</Heading2>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Recording Interface */}
        <View style={styles.recordingContainer}>
          <Animated.View
            style={[
              styles.recordButton,
              {
                transform: [{ scale: pulseAnim }],
                backgroundColor: isRecording ? colors.error : colors.primary,
              },
            ]}
          >
            <TouchableOpacity
              onPress={isRecording ? stopRecording : startRecording}
              style={styles.recordButtonInner}
            >
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={64}
                color={colors.white}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Duration */}
          {isRecording && (
            <View style={styles.durationContainer}>
              <View style={styles.recordingIndicator} />
              <Body weight="semibold" style={styles.duration}>
                {formatDuration(duration)}
              </Body>
            </View>
          )}

          {/* Instructions */}
          <View style={styles.instructions}>
            <Body style={styles.instructionText}>
              {isRecording
                ? 'Recording... Tap to stop'
                : recordingUri
                ? 'Recording complete. Review or re-record.'
                : 'Tap the microphone to start recording'}
            </Body>
          </View>
        </View>

        {/* Actions */}
        {recordingUri && !isRecording && (
          <View style={styles.actions}>
            <Button
              variant="secondary"
              title="Re-record"
              onPress={() => setRecordingUri(null)}
              style={styles.actionButton}
            />
            <Button
              variant="primary"
              title={isSubmitting ? 'Submitting...' : 'Submit Report'}
              onPress={submitVoiceReport}
              disabled={isSubmitting}
              loading={isSubmitting}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Caption style={styles.infoText}>
            Speak clearly and describe the incident in detail. Include what happened, when, where, and who was involved.
          </Caption>
        </View>
      </View>
    </Container>
  );
};


const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  recordingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordButtonInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 24,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    marginRight: spacing.sm,
  },
  duration: {
    fontSize: 18,
  },
  instructions: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  instructionText: {
    textAlign: 'center',
    color: colors.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  actionButton: {
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${colors.info}10`,
    padding: spacing.base,
    borderRadius: 12,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
});
