/**
 * Fire Exit Check Screen
 * Form for conducting fire exit safety checks
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Heading3, Body, Card, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { logger } from '../../utils/logger';
import { locationService } from '../../services/locationService';
import { photoService } from '../../services/photoService';
import { shiftChecksService } from '../../services/shiftChecksService';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList, 'FireExitCheck'>;
type RouteProps = RouteProp<MainStackParamList, 'FireExitCheck'>;

export const FireExitCheckScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { shiftId } = route.params;

  // Form state
  const [exitName, setExitName] = useState('');
  const [isClear, setIsClear] = useState(true);
  const [isProperlyMarked, setIsProperlyMarked] = useState(true);
  const [isAccessible, setIsAccessible] = useState(true);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    logger.info('[FireExitCheck] Screen loaded', { shiftId });
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
      logger.info('[FireExitCheck] Location captured', coords);
    } catch (error) {
      logger.error('[FireExitCheck] Error getting location:', error);
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
      logger.info('[FireExitCheck] Taking photo');
      const result = await photoService.capturePhoto();

      if (result && result.uri) {
        setPhotoUri(result.uri);

        // Convert to base64 for API
        const base64 = await photoService.convertToBase64(result.uri);
        setPhotoBase64(base64);

        logger.info('[FireExitCheck] Photo captured successfully');
      }
    } catch (error) {
      logger.error('[FireExitCheck] Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    logger.info('[FireExitCheck] Photo removed');
  };

  const validateForm = (): boolean => {
    if (!exitName.trim()) {
      Alert.alert('Required Field', 'Please enter the fire exit name or location');
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
      logger.info('[FireExitCheck] Submitting check', {
        shiftId,
        exitName,
        isClear,
        isProperlyMarked,
        isAccessible,
      });

      await shiftChecksService.submitFireExitCheck({
        shift: shiftId,
        exit_name: exitName,
        is_clear: isClear,
        is_properly_marked: isProperlyMarked,
        is_accessible: isAccessible,
        photo_evidence: photoBase64 || undefined,
        location,
        notes: notes.trim() || undefined,
      });

      logger.info('[FireExitCheck] Check submitted successfully');
      Alert.alert('Success', 'Fire exit check submitted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      logger.error('[FireExitCheck] Error submitting check:', error);
      Alert.alert('Error', 'Failed to submit check. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    logger.info('[FireExitCheck] Closing screen');
    navigation.goBack();
  };

  return (
    <Container scrollable={false} safeArea style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Heading2>Fire Exit Check</Heading2>
          <Body color={colors.text.secondary}>Venue Safety Inspection</Body>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Exit Name/Location */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Body style={styles.label}>Exit Name / Location *</Body>
          <TextInput
            style={styles.input}
            placeholder="e.g., Front Exit, Emergency Exit A"
            value={exitName}
            onChangeText={setExitName}
            autoCapitalize="words"
          />
        </Card>

        {/* Status Checks */}
        <Card variant="flat" padding="lg" style={styles.formCard}>
          <Heading3 style={styles.sectionTitle}>Status Checks</Heading3>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={isClear ? colors.success : colors.gray[400]}
                style={styles.switchIcon}
              />
              <Body>Exit is clear and unobstructed</Body>
            </View>
            <Switch
              value={isClear}
              onValueChange={setIsClear}
              trackColor={{ false: colors.gray[300], true: colors.success }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={isProperlyMarked ? colors.success : colors.gray[400]}
                style={styles.switchIcon}
              />
              <Body>Exit is properly marked</Body>
            </View>
            <Switch
              value={isProperlyMarked}
              onValueChange={setIsProperlyMarked}
              trackColor={{ false: colors.gray[300], true: colors.success }}
              thumbColor={colors.white}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={isAccessible ? colors.success : colors.gray[400]}
                style={styles.switchIcon}
              />
              <Body>Exit is easily accessible</Body>
            </View>
            <Switch
              value={isAccessible}
              onValueChange={setIsAccessible}
              trackColor={{ false: colors.gray[300], true: colors.success }}
              thumbColor={colors.white}
            />
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
            style={[styles.input, styles.textArea]}
            placeholder="Any additional observations or concerns..."
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
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
  sectionTitle: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.white,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  switchLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchIcon: {
    marginRight: spacing.sm,
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
