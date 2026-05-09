/**
 * Capacity Check Screen
 * Form for conducting venue capacity monitoring checks
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Heading3, Body, Card, Button } from '@components/ui';
import { colors, getColors, spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { logger } from '../../utils/logger';
import { locationService } from '../../services/locationService';
import { photoService } from '../../services/photoService';
import { shiftChecksService, type CapacityCheck as CapacityCheckRecord } from '../../services/shiftChecksService';
import { useAppSelector } from '../../hooks/useRedux';
import { selectActiveShift } from '../../store/slices/shiftsSlice';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'CapacityCheck'>;

export const CapacityCheckScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const activeShift = useAppSelector(selectActiveShift);

  // Real venue capacity from the active shift; fall back only if missing.
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

  useEffect(() => {
    logger.info('[CapacityCheck] Screen loaded', { shiftId });
    loadLocation();
    loadLastCheck();
  }, [shiftId]);

  const loadLastCheck = async () => {
    try {
      const shiftGroup = activeShift?.shift_group;
      if (!shiftGroup) {
        // Single-staff shift: filter by shift id instead.
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
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
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
      logger.info('[CapacityCheck] Taking photo');
      const result = await photoService.capturePhoto();

      if (result && result.uri) {
        setPhotoUri(result.uri);

        // Convert to base64 for API
        const base64 = await photoService.convertToBase64(result.uri);
        setPhotoBase64(base64);

        logger.info('[CapacityCheck] Photo captured successfully');
      }
    } catch (error) {
      logger.error('[CapacityCheck] Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    logger.info('[CapacityCheck] Photo removed');
  };

  const isAtCapacity = () => {
    const count = parseInt(currentCount, 10);
    return !isNaN(count) && count >= venueCapacity;
  };

  const getCapacityPercentage = () => {
    const count = parseInt(currentCount, 10);
    if (isNaN(count)) return 0;
    return Math.min((count / venueCapacity) * 100, 100);
  };

  const getCapacityColor = () => {
    const percentage = getCapacityPercentage();
    if (percentage >= 100) return colors.error;
    if (percentage >= warningThresholdPct) return colors.warning;
    return colors.success;
  };

  const getLastCheckSummary = (): string | null => {
    if (!lastCheck) return null;
    const minutesAgo = Math.max(
      0,
      Math.floor((Date.now() - new Date(lastCheck.timestamp).getTime()) / 60000),
    );
    const performer = lastCheck.performed_by_details;
    const who = performer
      ? `${performer.first_name} ${performer.last_name?.charAt(0) || ''}.`.trim()
      : 'a teammate';
    if (minutesAgo === 0) {
      return `Just logged: ${lastCheck.current_count} by ${who}`;
    }
    return `Last logged ${minutesAgo} min ago: ${lastCheck.current_count} by ${who}`;
  };

  const validateForm = (): boolean => {
    if (!currentCount.trim()) {
      Alert.alert('Required Field', 'Please enter the current capacity count');
      return false;
    }

    const count = parseInt(currentCount, 10);
    if (isNaN(count) || count < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number');
      return false;
    }

    if (isAtCapacity() && !actionTaken.trim()) {
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
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      const count = parseInt(currentCount, 10);

      logger.info('[CapacityCheck] Submitting check', {
        shiftId,
        currentCount: count,
        isAtCapacity: isAtCapacity(),
      });

      await shiftChecksService.submitCapacityCheck({
        shift: shiftId,
        current_count: count,
        venue_capacity: venueCapacity,
        is_at_capacity: isAtCapacity(),
        action_taken: actionTaken.trim() || undefined,
        photo_evidence: photoBase64 || undefined,
        location,
        notes: notes.trim() || undefined,
      });

      logger.info('[CapacityCheck] Check submitted successfully');
      Alert.alert('Success', 'Capacity check submitted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      logger.error('[CapacityCheck] Error submitting check:', error);
      Alert.alert('Error', 'Failed to submit check. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    logger.info('[CapacityCheck] Closing screen');
    navigation.goBack();
  };

  return (
    <Container scrollable={false} safeArea style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.primary, borderBottomColor: colors.border.light }]}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Heading2>Capacity Check</Heading2>
          <Body color={colors.text.secondary}>Venue Capacity Monitoring</Body>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Venue Capacity Info */}
        <Card variant="flat" padding="lg" style={styles.infoCard}>
          <View style={styles.capacityInfo}>
            <Ionicons name="business" size={24} color={colors.primary} />
            <Body style={styles.capacityText}>
              Maximum Venue Capacity: <Body style={styles.capacityNumber}>{venueCapacity}</Body>
            </Body>
          </View>
          {getLastCheckSummary() && (
            <View style={styles.lastCheckRow}>
              <Ionicons name="time-outline" size={16} color={colors.text.secondary} />
              <Body color={colors.text.secondary} style={styles.lastCheckText}>
                {getLastCheckSummary()}
              </Body>
            </View>
          )}
        </Card>

        {/* Current Count */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Current Capacity Count *</Body>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
            placeholder="Enter number of people"
            placeholderTextColor={colors.text.tertiary}
            value={currentCount}
            onChangeText={setCurrentCount}
            keyboardType="number-pad"
          />

          {/* Capacity Indicator */}
          {currentCount && !isNaN(parseInt(currentCount, 10)) && (
            <View style={styles.capacityIndicator}>
              <View style={styles.capacityBarBackground}>
                <View
                  style={[
                    styles.capacityBarFill,
                    {
                      width: `${getCapacityPercentage()}%`,
                      backgroundColor: getCapacityColor(),
                    },
                  ]}
                />
              </View>
              <View style={styles.capacityStats}>
                <Body color={getCapacityColor()} style={styles.capacityPercent}>
                  {getCapacityPercentage().toFixed(0)}% Full
                </Body>
                <Body color={colors.text.secondary}>
                  {currentCount} / {venueCapacity}
                </Body>
              </View>
            </View>
          )}
        </Card>

        {/* At Capacity Alert */}
        {isAtCapacity() && (
          <Card variant="flat" padding="lg" style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={24} color={colors.error} />
              <Heading3 style={styles.warningTitle}>Venue At Capacity</Heading3>
            </View>
            <Body color={colors.text.secondary}>
              The venue has reached or exceeded its maximum capacity. Describe the action taken
              below.
            </Body>
          </Card>
        )}

        {/* Action Taken (required if at capacity) */}
        {isAtCapacity() && (
          <Card variant="flat" padding="lg" style={styles.formCard}>
            <Body style={styles.label}>Action Taken *</Body>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
              placeholder="Describe the action taken (e.g., stopped entry, notified supervisor)"
              placeholderTextColor={colors.text.tertiary}
              value={actionTaken}
              onChangeText={setActionTaken}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Card>
        )}

        {/* Photo Evidence */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Photo Evidence (Optional)</Body>
          {photoUri ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photoUri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={handleRemovePhoto}
              >
                <Ionicons name="close-circle" size={32} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
              <Ionicons name="camera" size={32} color={colors.primary} />
              <Body color={colors.primary} style={styles.photoButtonText}>
                Take Photo
              </Body>
            </TouchableOpacity>
          )}
        </Card>

        {/* Notes */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Additional Notes (Optional)</Body>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
            placeholder="Any additional observations..."
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>

        {/* Location Status */}
        {location && (
          <Card variant="flat" padding="md" style={styles.locationCard}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={colors.success} />
              <Body color={colors.text.secondary} style={styles.locationText}>
                Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Body>
            </View>
          </Card>
        )}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={submitting ? 'Submitting...' : 'Submit Check'}
            onPress={handleSubmit}
            disabled={submitting || loading || !location}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: spacing.sm,
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.primary + '10',
    marginBottom: spacing.md,
  },
  capacityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  capacityNumber: {
    fontWeight: '700',
    fontSize: 18,
    color: colors.primary,
  },
  lastCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  lastCheckText: {
    marginLeft: spacing.xs,
    fontSize: 13,
  },
  formCard: {
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    marginBottom: spacing.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  textArea: {
    height: 80,
    paddingTop: spacing.md,
  },
  capacityIndicator: {
    marginTop: spacing.md,
  },
  capacityBarBackground: {
    height: 12,
    backgroundColor: colors.gray[200],
    borderRadius: 6,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  capacityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  capacityPercent: {
    fontWeight: '700',
  },
  warningCard: {
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: spacing.md,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  warningTitle: {
    marginLeft: spacing.md,
    color: colors.error,
  },
  photoButton: {
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: spacing.xl * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[50],
  },
  photoButtonText: {
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  photoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
  },
  locationCard: {
    backgroundColor: colors.success + '08',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '20',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    marginLeft: spacing.xs,
    fontSize: 12,
  },
  submitContainer: {
    marginBottom: spacing.xl,
  },
});
