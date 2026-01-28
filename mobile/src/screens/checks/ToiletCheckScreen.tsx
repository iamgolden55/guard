/**
 * Toilet Check Screen
 * Form for conducting toilet/restroom facility checks
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
import { shiftChecksService } from '../../services/shiftChecksService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;
type RouteProps = RouteProp<MainStackParamList, 'ToiletCheck'>;

type ConditionType = 'clean' | 'needs_cleaning' | 'requires_maintenance';

export const ToiletCheckScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;
  const { isDark } = useTheme();
  const colors = getColors(isDark);

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

  // Supply options
  const supplyOptions = [
    { id: 'toilet_paper', label: 'Toilet Paper' },
    { id: 'soap', label: 'Soap' },
    { id: 'paper_towels', label: 'Paper Towels' },
    { id: 'hand_sanitizer', label: 'Hand Sanitizer' },
  ];

  useEffect(() => {
    logger.info('[ToiletCheck] Screen loaded', { shiftId });
    loadLocation();
  }, [shiftId]);

  const loadLocation = async () => {
    try {
      setLoading(true);
      const coords = await locationService.getCurrentLocation();
      setLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
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
      logger.info('[ToiletCheck] Taking photo');
      const result = await photoService.capturePhoto();

      if (result && result.uri) {
        setPhotoUri(result.uri);

        // Convert to base64 for API
        const base64 = await photoService.convertToBase64(result.uri);
        setPhotoBase64(base64);

        logger.info('[ToiletCheck] Photo captured successfully');
      }
    } catch (error) {
      logger.error('[ToiletCheck] Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    logger.info('[ToiletCheck] Photo removed');
  };

  const toggleSupply = (supplyId: string) => {
    setSuppliesNeeded((prev) =>
      prev.includes(supplyId)
        ? prev.filter((s) => s !== supplyId)
        : [...prev, supplyId]
    );
  };

  const needsAttention = condition !== 'clean' || isOutOfOrder || suppliesNeeded.length > 0;

  const getConditionColor = (conditionType: ConditionType) => {
    if (condition === conditionType) {
      switch (conditionType) {
        case 'clean':
          return colors.success;
        case 'needs_cleaning':
          return colors.warning;
        case 'requires_maintenance':
          return colors.error;
      }
    }
    return colors.gray[300];
  };

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
    if (!validateForm()) {
      return;
    }

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

      logger.info('[ToiletCheck] Check submitted successfully');
      Alert.alert('Success', 'Toilet check submitted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      logger.error('[ToiletCheck] Error submitting check:', error);
      Alert.alert('Error', 'Failed to submit check. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    logger.info('[ToiletCheck] Closing screen');
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
          <Heading2>Toilet Check</Heading2>
          <Body color={colors.text.secondary}>Restroom Facility Inspection</Body>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Location Name */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Restroom Location *</Body>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background.primary, color: colors.text.primary }]}
            placeholder="e.g., Ground Floor Male, Level 2 Female"
            placeholderTextColor={colors.text.tertiary}
            value={locationName}
            onChangeText={setLocationName}
            autoCapitalize="words"
          />
        </Card>

        {/* Condition */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Condition *</Body>
          <View style={styles.conditionButtons}>
            <TouchableOpacity
              style={[
                styles.conditionButton,
                { borderColor: getConditionColor('clean'), backgroundColor: colors.background.primary },
                condition === 'clean' && { backgroundColor: colors.success + '10' },
              ]}
              onPress={() => setCondition('clean')}
            >
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={getConditionColor('clean')}
              />
              <Body style={[styles.conditionText, condition === 'clean' && { fontWeight: '600' }]}>
                Clean
              </Body>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.conditionButton,
                { borderColor: getConditionColor('needs_cleaning'), backgroundColor: colors.background.primary },
                condition === 'needs_cleaning' && { backgroundColor: colors.warning + '10' },
              ]}
              onPress={() => setCondition('needs_cleaning')}
            >
              <Ionicons
                name="warning"
                size={24}
                color={getConditionColor('needs_cleaning')}
              />
              <Body
                style={[
                  styles.conditionText,
                  condition === 'needs_cleaning' && { fontWeight: '600' },
                ]}
              >
                Needs Cleaning
              </Body>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.conditionButton,
                { borderColor: getConditionColor('requires_maintenance'), backgroundColor: colors.background.primary },
                condition === 'requires_maintenance' && { backgroundColor: colors.error + '10' },
              ]}
              onPress={() => setCondition('requires_maintenance')}
            >
              <Ionicons
                name="construct"
                size={24}
                color={getConditionColor('requires_maintenance')}
              />
              <Body
                style={[
                  styles.conditionText,
                  condition === 'requires_maintenance' && { fontWeight: '600' },
                ]}
              >
                Requires Maintenance
              </Body>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Out of Order */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsOutOfOrder(!isOutOfOrder)}
          >
            <View style={styles.checkbox}>
              {isOutOfOrder && (
                <Ionicons name="checkmark" size={20} color={colors.white} />
              )}
            </View>
            <Body style={styles.checkboxLabel}>Restroom is out of order</Body>
          </TouchableOpacity>
        </Card>

        {/* Supplies Needed */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Supplies Needed</Body>
          <View style={styles.suppliesGrid}>
            {supplyOptions.map((supply) => (
              <TouchableOpacity
                key={supply.id}
                style={[
                  styles.supplyChip,
                  { backgroundColor: colors.background.primary },
                  suppliesNeeded.includes(supply.id) && styles.supplyChipActive,
                ]}
                onPress={() => toggleSupply(supply.id)}
              >
                <Body
                  style={[
                    styles.supplyChipText,
                    suppliesNeeded.includes(supply.id) && styles.supplyChipTextActive,
                  ]}
                >
                  {supply.label}
                </Body>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

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
    height: 100,
    paddingTop: spacing.md,
  },
  conditionButtons: {
    gap: spacing.sm,
  },
  conditionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderRadius: 8,
  },
  conditionText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    marginLeft: spacing.md,
    flex: 1,
  },
  suppliesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  supplyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: 20,
  },
  supplyChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  supplyChipText: {
    fontSize: 14,
  },
  supplyChipTextActive: {
    color: colors.white,
    fontWeight: '600',
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
