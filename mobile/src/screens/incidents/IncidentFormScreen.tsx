/**
 * IncidentFormScreen
 * Comprehensive form for creating new incident reports
 * Uber-inspired design with full-width layout
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
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraModal } from '../../components/camera/CameraModal';
import { VideoPlayerModal } from '../../components/video';
import { getUberColors, getUberShadows, uberSpacing, uberRadius } from '../../theme/uberTheme';
import { useTheme } from '../../hooks/useTheme';
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
  const { isDark } = useTheme();
  const uberColors = getUberColors(isDark);
  const uberShadows = getUberShadows(isDark);

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

  const incidentTypes: { value: IncidentType; label: string; icon: string }[] = [
    { value: 'security_breach', label: 'Security Breach', icon: 'shield-outline' },
    { value: 'medical_emergency', label: 'Medical Emergency', icon: 'medical-outline' },
    { value: 'fire_alarm', label: 'Fire Alarm', icon: 'flame-outline' },
    { value: 'suspicious_activity', label: 'Suspicious Activity', icon: 'eye-outline' },
    { value: 'property_damage', label: 'Property Damage', icon: 'hammer-outline' },
    { value: 'assault', label: 'Assault', icon: 'alert-circle-outline' },
    { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
  ];

  const severityLevels: { value: IncidentSeverity; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: '#22C55E' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#F97316' },
    { value: 'critical', label: 'Critical', color: '#EF4444' },
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: uberColors.background.light }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: uberColors.background.surface, borderBottomColor: uberColors.border.light }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={uberColors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: uberColors.text.primary }]}>Report Incident</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: uberColors.background.light }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Incident Type Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Incident Type</Text>
          <View style={styles.typeGrid}>
            {incidentTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeButton,
                  { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light },
                  uberShadows.soft,
                  incidentType === type.value && {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderColor: uberColors.primary,
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setIncidentType(type.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={type.icon as any}
                  size={20}
                  color={incidentType === type.value ? uberColors.primary : uberColors.text.secondary}
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: uberColors.text.primary },
                    incidentType === type.value && { fontWeight: '600' },
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity Selection - Horizontal Segmented Control */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Severity</Text>
          <View style={[styles.severityRow, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }, uberShadows.soft]}>
            {severityLevels.map((sev, index) => (
              <TouchableOpacity
                key={sev.value}
                style={[
                  styles.severityButton,
                  index !== severityLevels.length - 1 && { borderRightWidth: 1, borderRightColor: uberColors.border.light },
                  severity === sev.value && { backgroundColor: `${sev.color}15` },
                ]}
                onPress={() => setSeverity(sev.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                <Text
                  style={[
                    styles.severityText,
                    { color: severity === sev.value ? sev.color : uberColors.text.secondary },
                    severity === sev.value && { fontWeight: '600' },
                  ]}
                >
                  {sev.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: uberColors.background.surface,
                borderColor: uberColors.border.light,
                color: uberColors.text.primary
              },
              uberShadows.soft
            ]}
            placeholder="Brief summary of incident"
            placeholderTextColor={uberColors.text.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Text style={[styles.charCount, { color: uberColors.text.muted }]}>
            {title.length}/100
          </Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Description <Text style={styles.required}>*</Text></Text>
          <Text style={[styles.fieldHint, { color: uberColors.text.secondary }]}>
            Describe what happened in detail
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: uberColors.background.surface,
                borderColor: uberColors.border.light,
                color: uberColors.text.primary
              },
              uberShadows.soft
            ]}
            placeholder="Provide detailed description of the incident..."
            placeholderTextColor={uberColors.text.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Location Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Location <Text style={styles.required}>*</Text></Text>
          <Text style={[styles.fieldHint, { color: uberColors.text.secondary }]}>
            Where did this incident occur?
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: uberColors.background.surface,
                borderColor: uberColors.border.light,
                color: uberColors.text.primary
              },
              uberShadows.soft
            ]}
            placeholder="e.g., Main entrance, Floor 2 restroom"
            placeholderTextColor={uberColors.text.muted}
            value={locationDescription}
            onChangeText={setLocationDescription}
          />
          {currentLocation && (
            <View style={[styles.locationBadge, { backgroundColor: `${uberColors.success}15` }]}>
              <Ionicons name="location" size={14} color={uberColors.success} />
              <Text style={[styles.locationNote, { color: uberColors.success }]}>
                GPS captured ({currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)})
              </Text>
            </View>
          )}
        </View>

        {/* Witnesses */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Witnesses</Text>
          <Text style={[styles.fieldHint, { color: uberColors.text.secondary }]}>
            Names of witnesses (comma-separated)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: uberColors.background.surface,
                borderColor: uberColors.border.light,
                color: uberColors.text.primary
              },
              uberShadows.soft
            ]}
            placeholder="e.g., John Smith, Jane Doe"
            placeholderTextColor={uberColors.text.muted}
            value={witnesses}
            onChangeText={setWitnesses}
          />
        </View>

        {/* Persons Involved */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Persons Involved</Text>
          <Text style={[styles.fieldHint, { color: uberColors.text.secondary }]}>
            Names of people involved (comma-separated)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: uberColors.background.surface,
                borderColor: uberColors.border.light,
                color: uberColors.text.primary
              },
              uberShadows.soft
            ]}
            placeholder="e.g., Suspect name, Victim name"
            placeholderTextColor={uberColors.text.muted}
            value={personsInvolved}
            onChangeText={setPersonsInvolved}
          />
        </View>

        {/* Actions Taken */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Actions Taken</Text>
          <Text style={[styles.fieldHint, { color: uberColors.text.secondary }]}>
            What actions did you take?
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: uberColors.background.surface,
                borderColor: uberColors.border.light,
                color: uberColors.text.primary
              },
              uberShadows.soft
            ]}
            placeholder="Describe actions taken to resolve or manage the situation..."
            placeholderTextColor={uberColors.text.muted}
            value={actionsTaken}
            onChangeText={setActionsTaken}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Evidence (Photos & Videos) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Evidence</Text>
          <Text style={[styles.fieldHint, { color: uberColors.text.secondary }]}>
            Add photos or videos to support your report
          </Text>

          {/* Photo Controls */}
          <View style={styles.evidenceButtons}>
            <TouchableOpacity
              style={[styles.evidenceButton, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }, uberShadows.soft]}
              onPress={handleCameraPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={uberColors.primary} />
              <Text style={[styles.evidenceButtonText, { color: uberColors.text.secondary }]}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.evidenceButton, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }, uberShadows.soft]}
              onPress={handleGalleryPhoto}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={24} color={uberColors.primary} />
              <Text style={[styles.evidenceButtonText, { color: uberColors.text.secondary }]}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.evidenceButton, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }, uberShadows.soft]}
              onPress={handleCameraVideo}
              activeOpacity={0.7}
            >
              <Ionicons name="videocam" size={24} color={uberColors.primary} />
              <Text style={[styles.evidenceButtonText, { color: uberColors.text.secondary }]}>Video</Text>
            </TouchableOpacity>
          </View>

          {/* Photo Thumbnails */}
          {photos.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Text style={[styles.thumbnailLabel, { color: uberColors.text.secondary }]}>
                Photos ({photos.length})
              </Text>
              <View style={styles.thumbnailGrid}>
                {photos.map((photoUri, index) => (
                  <View key={photoUri} style={styles.thumbnailWrapper}>
                    <Image source={{ uri: photoUri }} style={[styles.thumbnail, { backgroundColor: uberColors.border.light }]} />
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: uberColors.background.surface }]}
                      onPress={() => handleRemovePhoto(photoUri)}
                    >
                      <Ionicons name="close-circle" size={24} color={uberColors.error} />
                    </TouchableOpacity>
                    <View style={styles.thumbnailNumberBadge}>
                      <Text style={styles.thumbnailNumber}>{index + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Video Thumbnails */}
          {videos.length > 0 && (
            <View style={styles.thumbnailContainer}>
              <Text style={[styles.thumbnailLabel, { color: uberColors.text.secondary }]}>
                Videos ({videos.length})
              </Text>
              <View style={styles.thumbnailGrid}>
                {videos.map((videoUri, index) => (
                  <View key={videoUri} style={styles.thumbnailWrapper}>
                    <TouchableOpacity
                      style={[styles.videoThumbnail, { backgroundColor: isDark ? '#27272A' : '#374151' }]}
                      onPress={() => handlePlayVideo(videoUri)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="play-circle" size={48} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: uberColors.background.surface }]}
                      onPress={() => handleRemoveVideo(videoUri)}
                    >
                      <Ionicons name="close-circle" size={24} color={uberColors.error} />
                    </TouchableOpacity>
                    <View style={styles.thumbnailNumberBadge}>
                      <Text style={styles.thumbnailNumber}>{index + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Emergency Services */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: uberColors.text.primary }]}>Emergency Services</Text>

          <View style={[styles.switchRow, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }, uberShadows.soft]}>
            <View style={styles.switchLabel}>
              <View style={[styles.switchIcon, { backgroundColor: `${uberColors.error}15` }]}>
                <Ionicons name="call" size={18} color={uberColors.error} />
              </View>
              <Text style={[styles.switchText, { color: uberColors.text.primary }]}>Police Notified</Text>
            </View>
            <Switch
              value={policeNotified}
              onValueChange={setPoliceNotified}
              trackColor={{ false: uberColors.border.medium, true: uberColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.switchRow, { backgroundColor: uberColors.background.surface, borderColor: uberColors.border.light }, uberShadows.soft]}>
            <View style={styles.switchLabel}>
              <View style={[styles.switchIcon, { backgroundColor: `${uberColors.error}15` }]}>
                <Ionicons name="medical" size={18} color={uberColors.error} />
              </View>
              <Text style={[styles.switchText, { color: uberColors.text.primary }]}>Ambulance Called</Text>
            </View>
            <Switch
              value={ambulanceCalled}
              onValueChange={setAmbulanceCalled}
              trackColor={{ false: uberColors.border.medium, true: uberColors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: uberColors.primary },
              isSubmitting && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <Text style={[styles.submitButtonText, { color: uberColors.text.inverse }]}>
                Submitting...
              </Text>
            ) : (
              <Text style={[styles.submitButtonText, { color: uberColors.text.inverse }]}>
                Submit Incident Report
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.submitNote, { color: uberColors.text.muted }]}>
            * Required fields
          </Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: uberSpacing.lg,
    paddingVertical: uberSpacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: uberSpacing.xs,
    marginLeft: -uberSpacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: uberSpacing.lg,
    paddingHorizontal: uberSpacing.lg,
    paddingBottom: uberSpacing['3xl'],
  },
  section: {
    marginBottom: uberSpacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: uberSpacing.sm,
  },
  required: {
    color: '#EF4444',
  },
  fieldHint: {
    fontSize: 14,
    marginBottom: uberSpacing.sm,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uberSpacing.sm,
  },
  typeButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.md,
    borderRadius: uberRadius.lg,
    borderWidth: 1,
    gap: uberSpacing.sm,
  },
  typeButtonText: {
    fontSize: 14,
    flex: 1,
  },
  severityRow: {
    flexDirection: 'row',
    borderRadius: uberRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  severityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: uberSpacing.md,
    gap: uberSpacing.xs,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: uberRadius.lg,
    paddingHorizontal: uberSpacing.base,
    paddingVertical: uberSpacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    paddingTop: uberSpacing.md,
  },
  charCount: {
    textAlign: 'right',
    marginTop: uberSpacing.xs,
    fontSize: 12,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.xs,
    marginTop: uberSpacing.sm,
    paddingVertical: uberSpacing.xs,
    paddingHorizontal: uberSpacing.sm,
    borderRadius: uberRadius.default,
    alignSelf: 'flex-start',
  },
  locationNote: {
    fontSize: 12,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.base,
    borderRadius: uberRadius.lg,
    borderWidth: 1,
    marginBottom: uberSpacing.sm,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: uberSpacing.sm,
  },
  switchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    fontSize: 15,
    fontWeight: '500',
  },
  submitSection: {
    marginTop: uberSpacing.lg,
    paddingBottom: uberSpacing.xl,
  },
  submitButton: {
    paddingVertical: uberSpacing.base,
    borderRadius: uberRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitNote: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: uberSpacing.sm,
  },
  evidenceButtons: {
    flexDirection: 'row',
    gap: uberSpacing.sm,
    marginBottom: uberSpacing.md,
  },
  evidenceButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: uberSpacing.md,
    paddingHorizontal: uberSpacing.xs,
    borderRadius: uberRadius.lg,
    borderWidth: 1,
    gap: uberSpacing.xs,
  },
  evidenceButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  thumbnailContainer: {
    marginTop: uberSpacing.md,
  },
  thumbnailLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: uberSpacing.sm,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: uberSpacing.sm,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: uberRadius.md,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: uberRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnailNumberBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#000000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thumbnailNumber: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
