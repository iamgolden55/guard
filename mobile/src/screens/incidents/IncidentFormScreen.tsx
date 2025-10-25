/**
 * IncidentFormScreen
 * Comprehensive form for creating new incident reports
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Container, Heading2, Heading3, Body, Caption, Button } from '@components/ui';
import { CameraModal } from '../../components/camera/CameraModal';
import { VideoPlayerModal } from '../../components/video';
import { colors, spacing, layout } from '../../theme';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { IncidentType, IncidentSeverity, Incident } from '../../types/incident';
import { incidentService } from '../../services/incidentService';
import { locationService } from '../../services/locationService';
import { photoService } from '../../services/photoService';
import { logger } from '../../utils/logger';

interface RouteParams {
  shiftId?: number;
  prefilledType?: IncidentType;
  prefilledSeverity?: IncidentSeverity;
}

export const IncidentFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { shiftId, prefilledType, prefilledSeverity } = (route.params as RouteParams) || {};

  // Form state
  const [incidentType, setIncidentType] = useState<IncidentType>(prefilledType || 'other');
  const [severity, setSeverity] = useState<IncidentSeverity>(prefilledSeverity || 'medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [personsInvolved, setPersonsInvolved] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [policeNotified, setPoliceNotified] = useState(false);
  const [ambulanceCalled, setAmbulanceCalled] = useState(false);

  // Evidence state
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get current location on mount
  useEffect(() => {
    const getLocation = async () => {
      try {
        const location = await locationService.getCurrentLocation();
        setCurrentLocation(location);
        logger.info('[IncidentForm] Location captured', location);
      } catch (error) {
        logger.error('[IncidentForm] Failed to get location', { error });
      }
    };
    getLocation();
  }, []);

  const incidentTypes: { value: IncidentType; label: string }[] = [
    { value: 'security_breach', label: 'Security Breach' },
    { value: 'medical_emergency', label: 'Medical Emergency' },
    { value: 'fire_alarm', label: 'Fire Alarm' },
    { value: 'suspicious_activity', label: 'Suspicious Activity' },
    { value: 'property_damage', label: 'Property Damage' },
    { value: 'assault', label: 'Assault' },
    { value: 'other', label: 'Other' },
  ];

  const severityLevels: { value: IncidentSeverity; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: colors.success },
    { value: 'medium', label: 'Medium', color: colors.info },
    { value: 'high', label: 'High', color: colors.warning },
    { value: 'critical', label: 'Critical', color: colors.error },
  ];

  // Photo capture handlers
  const handleCameraPhoto = () => {
    setShowCameraModal(true);
  };

  const handlePhotoTaken = async (photoUri: string) => {
    try {
      logger.info('[IncidentForm] Photo captured, optimizing...', { photoUri });
      const optimized = await photoService.optimizePhoto(photoUri);
      setPhotos([...photos, optimized.uri]);
      logger.info('[IncidentForm] Photo added to incident', { count: photos.length + 1 });
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
        logger.info('[IncidentForm] Photos added from gallery', { count: result.assets.length });
      }
    } catch (error) {
      logger.error('[IncidentForm] Failed to pick photos from gallery', { error });
      Alert.alert('Error', 'Failed to select photos. Please try again.');
    }
  };

  const handleRemovePhoto = (photoUri: string) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotos(photos.filter((p) => p !== photoUri));
          try {
            await photoService.deletePhoto(photoUri);
            logger.info('[IncidentForm] Photo removed', { photoUri });
          } catch (error) {
            logger.error('[IncidentForm] Failed to delete photo', { error });
          }
        },
      },
    ]);
  };

  // Video capture handlers
  const handleCameraVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow camera access to record videos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 120, // 2 minutes max
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });

      if (!result.canceled && result.assets[0]) {
        setVideos([...videos, result.assets[0].uri]);
        logger.info('[IncidentForm] Video recorded', { uri: result.assets[0].uri });
      }
    } catch (error) {
      logger.error('[IncidentForm] Failed to record video', { error });
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  const handleGalleryVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        setVideos([...videos, result.assets[0].uri]);
        logger.info('[IncidentForm] Video selected from gallery', { uri: result.assets[0].uri });
      }
    } catch (error) {
      logger.error('[IncidentForm] Failed to pick video from gallery', { error });
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
  };

  const handlePlayVideo = (videoUri: string) => {
    logger.info('[IncidentForm] Playing video', { videoUri });
    setSelectedVideo(videoUri);
    setShowVideoPlayer(true);
  };

  const handleRemoveVideo = (videoUri: string) => {
    Alert.alert('Remove Video', 'Are you sure you want to remove this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setVideos(videos.filter((v) => v !== videoUri));
          logger.info('[IncidentForm] Video removed', { videoUri });
        },
      },
    ]);
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for the incident');
      return false;
    }

    if (!description.trim()) {
      Alert.alert('Required Field', 'Please provide a description of what happened');
      return false;
    }

    if (!locationDescription.trim()) {
      Alert.alert('Required Field', 'Please describe where the incident occurred');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      logger.info('[IncidentForm] Submitting incident', { type: incidentType, severity });

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
        witnesses: witnesses.trim() ? witnesses.split(',').map((w) => w.trim()) : undefined,
        persons_involved: personsInvolved.trim()
          ? personsInvolved.split(',').map((p) => p.trim())
          : undefined,
        actions_taken: actionsTaken.trim() || undefined,
        police_notified: policeNotified,
        ambulance_called: ambulanceCalled,
      };

      await incidentService.submitIncident(incident);

      Alert.alert(
        'Incident Reported',
        'Your incident report has been submitted successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      logger.error('[IncidentForm] Failed to submit incident', { error });
      Alert.alert('Error', 'Failed to submit incident report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityColor = (sev: IncidentSeverity) => {
    return severityLevels.find((s) => s.value === sev)?.color || colors.text.secondary;
  };

  return (
    <Container style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Heading2>Report Incident</Heading2>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Incident Type Selection */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Incident Type *</Heading3>
          <View style={styles.typeGrid}>
            {incidentTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeButton,
                  incidentType === type.value && styles.typeButtonSelected,
                ]}
                onPress={() => setIncidentType(type.value)}
              >
                <Body
                  style={[
                    styles.typeButtonText,
                    incidentType === type.value && styles.typeButtonTextSelected,
                  ]}
                >
                  {type.label}
                </Body>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity Selection */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Severity *</Heading3>
          <View style={styles.severityRow}>
            {severityLevels.map((sev) => (
              <TouchableOpacity
                key={sev.value}
                style={[
                  styles.severityButton,
                  { borderColor: sev.color },
                  severity === sev.value && {
                    backgroundColor: `${sev.color}20`,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setSeverity(sev.value)}
              >
                <View
                  style={[
                    styles.severityIndicator,
                    {
                      backgroundColor:
                        severity === sev.value ? sev.color : colors.border.light,
                    },
                  ]}
                />
                <Body
                  style={[
                    styles.severityText,
                    severity === sev.value && { color: sev.color, fontWeight: '600' },
                  ]}
                >
                  {sev.label}
                </Body>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Title *</Heading3>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of incident"
            placeholderTextColor={colors.text.tertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Caption color={colors.text.tertiary} style={styles.charCount}>
            {title.length}/100
          </Caption>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Description *</Heading3>
          <Caption color={colors.text.secondary} style={styles.fieldHint}>
            Describe what happened in detail
          </Caption>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide detailed description of the incident..."
            placeholderTextColor={colors.text.tertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Location Description */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Location *</Heading3>
          <Caption color={colors.text.secondary} style={styles.fieldHint}>
            Where did this incident occur?
          </Caption>
          <TextInput
            style={styles.input}
            placeholder="e.g., Main entrance, Floor 2 restroom"
            placeholderTextColor={colors.text.tertiary}
            value={locationDescription}
            onChangeText={setLocationDescription}
          />
          {currentLocation && (
            <Caption color={colors.success} style={styles.locationNote}>
              ✓ GPS coordinates captured ({currentLocation.latitude.toFixed(4)},{' '}
              {currentLocation.longitude.toFixed(4)})
            </Caption>
          )}
        </View>

        {/* Witnesses */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Witnesses</Heading3>
          <Caption color={colors.text.secondary} style={styles.fieldHint}>
            Names of witnesses (comma-separated)
          </Caption>
          <TextInput
            style={styles.input}
            placeholder="e.g., John Smith, Jane Doe"
            placeholderTextColor={colors.text.tertiary}
            value={witnesses}
            onChangeText={setWitnesses}
          />
        </View>

        {/* Persons Involved */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Persons Involved</Heading3>
          <Caption color={colors.text.secondary} style={styles.fieldHint}>
            Names of people involved (comma-separated)
          </Caption>
          <TextInput
            style={styles.input}
            placeholder="e.g., Suspect name, Victim name"
            placeholderTextColor={colors.text.tertiary}
            value={personsInvolved}
            onChangeText={setPersonsInvolved}
          />
        </View>

        {/* Actions Taken */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Actions Taken</Heading3>
          <Caption color={colors.text.secondary} style={styles.fieldHint}>
            What actions did you take?
          </Caption>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe actions taken to resolve or manage the situation..."
            placeholderTextColor={colors.text.tertiary}
            value={actionsTaken}
            onChangeText={setActionsTaken}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Evidence (Photos & Videos) */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Evidence</Heading3>
          <Caption color={colors.text.secondary} style={styles.fieldHint}>
            Add photos or videos to support your report
          </Caption>

          {/* Photo Controls */}
          <View style={styles.evidenceButtons}>
            <TouchableOpacity
              style={styles.evidenceButton}
              onPress={handleCameraPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Body style={styles.evidenceButtonText}>Take Photo</Body>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.evidenceButton}
              onPress={handleGalleryPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={24} color={colors.primary} />
              <Body style={styles.evidenceButtonText}>From Gallery</Body>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.evidenceButton}
              onPress={handleCameraVideo}
              activeOpacity={0.7}
            >
              <Ionicons name="videocam" size={24} color={colors.primary} />
              <Body style={styles.evidenceButtonText}>Record Video</Body>
            </TouchableOpacity>
          </View>

          {/* Photo Thumbnails */}
          {photos.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Caption color={colors.text.secondary} style={styles.thumbnailLabel}>
                Photos ({photos.length})
              </Caption>
              <View style={styles.thumbnailGrid}>
                {photos.map((photoUri, index) => (
                  <View key={photoUri} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: photoUri }} style={styles.thumbnail} />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemovePhoto(photoUri)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                    <Caption style={styles.thumbnailNumber}>{index + 1}</Caption>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Video Thumbnails */}
          {videos.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Caption color={colors.text.secondary} style={styles.thumbnailLabel}>
                Videos ({videos.length})
              </Caption>
              <View style={styles.thumbnailGrid}>
                {videos.map((videoUri, index) => (
                  <View key={videoUri} style={styles.thumbnailWrapper}>
                    <TouchableOpacity
                      style={styles.videoThumbnail}
                      onPress={() => handlePlayVideo(videoUri)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play-circle" size={48} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveVideo(videoUri)}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                    <Caption style={styles.thumbnailNumber}>{index + 1}</Caption>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Emergency Services */}
        <View style={styles.section}>
          <Heading3 style={styles.sectionTitle}>Emergency Services</Heading3>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons name="call" size={20} color={colors.error} />
              <Body style={styles.switchText}>Police Notified</Body>
            </View>
            <Switch
              value={policeNotified}
              onValueChange={setPoliceNotified}
              trackColor={{ false: colors.gray[300], true: colors.primary }}
              thumbColor={policeNotified ? colors.white : colors.gray[100]}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons name="medical" size={20} color={colors.error} />
              <Body style={styles.switchText}>Ambulance Called</Body>
            </View>
            <Switch
              value={ambulanceCalled}
              onValueChange={setAmbulanceCalled}
              trackColor={{ false: colors.gray[300], true: colors.primary }}
              thumbColor={ambulanceCalled ? colors.white : colors.gray[100]}
            />
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <Button
            variant="primary"
            title={isSubmitting ? 'Submitting...' : 'Submit Incident Report'}
            onPress={handleSubmit}
            disabled={isSubmitting}
            loading={isSubmitting}
            style={styles.submitButton}
          />

          <Caption color={colors.text.secondary} style={styles.submitNote}>
            * Required fields
          </Caption>
        </View>
      </ScrollView>

      {/* Camera Modal */}
      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onPhotoTaken={handlePhotoTaken}
        title="Capture Evidence Photo"
        tips={[
          'Capture clear evidence of the incident',
          'Include relevant surroundings',
          'Ensure good lighting',
        ]}
      />

      {/* Video Player Modal */}
      <VideoPlayerModal
        visible={showVideoPlayer}
        videoUri={selectedVideo}
        onClose={() => setShowVideoPlayer(false)}
      />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    fontSize: 16,
  },
  fieldHint: {
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignContent: 'flex-start',
  },
  typeButton: {
    width: '48.5%',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  typeButtonSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: `${colors.primary}20`,
  },
  typeButtonText: {
    fontSize: 14,
    textAlign: 'center',
  },
  typeButtonTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  severityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  severityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    backgroundColor: colors.white,
  },
  severityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.xs,
  },
  severityText: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: layout.borderRadius.md,
    padding: spacing.base,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 120,
    paddingTop: spacing.base,
  },
  charCount: {
    textAlign: 'right',
    marginTop: spacing.xs,
    fontSize: 12,
  },
  locationNote: {
    marginTop: spacing.xs,
    fontSize: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.background.secondary,
    borderRadius: layout.borderRadius.md,
    marginBottom: spacing.sm,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchText: {
    fontSize: 15,
    fontWeight: '500',
  },
  submitSection: {
    marginTop: spacing.lg,
  },
  submitButton: {
    marginBottom: spacing.sm,
  },
  submitNote: {
    textAlign: 'center',
    fontSize: 12,
  },
  evidenceButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  evidenceButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xs,
    borderRadius: layout.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  evidenceButtonText: {
    fontSize: 12,
    textAlign: 'center',
    color: colors.text.secondary,
  },
  thumbnailContainer: {
    marginTop: spacing.md,
  },
  thumbnailLabel: {
    marginBottom: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.gray[200],
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: layout.borderRadius.md,
    backgroundColor: colors.gray[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  thumbnailNumber: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.black,
    color: colors.white,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
  },
});
