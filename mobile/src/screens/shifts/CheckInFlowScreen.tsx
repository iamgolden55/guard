/**
 * CheckInFlowScreen
 * Multi-step check-in flow with location verification, photo, and signature
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Heading2, Body, Button } from '@components/ui';
import { colors, spacing } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { CameraView, PhotoPreview } from '../../components/camera';
import { SignatureCanvas } from '../../components/signature';
import { locationService, LocationCoordinates } from '../../services/locationService';
import { photoService } from '../../services/photoService';
import { syncService } from '../../services/syncService';
import { database } from '../../services/database';
import { venueService } from '../../services/venueService';
import { logger } from '../../utils/logger';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { ERROR_MESSAGES } from '../../utils/constants';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface CheckInFlowScreenProps {
  route: {
    params: {
      shiftId: number;
      venueId: number;
      venueName: string;
      venueLatitude: number;
      venueLongitude: number;
      requiresTerms?: boolean;
      venueTerms?: string;
    };
  };
}

type FlowStep =
  | 'location_check'
  | 'venue_terms'
  | 'camera'
  | 'photo_preview'
  | 'signature'
  | 'processing';

export const CheckInFlowScreen: React.FC<CheckInFlowScreenProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { isOnline } = useNetworkStatus();
  const { shiftId, venueId, venueName, venueLatitude, venueLongitude, requiresTerms, venueTerms } =
    route.params;

  const [currentStep, setCurrentStep] = useState<FlowStep>('location_check');
  const [isVerifying, setIsVerifying] = useState(false);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [optimizedPhotoUri, setOptimizedPhotoUri] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [loadedVenueTerms, setLoadedVenueTerms] = useState<string | null>(null);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);

  // Step 1: Verify location
  const handleLocationCheck = async () => {
    setIsVerifying(true);
    logger.info('[CheckInFlow] Starting location verification');

    try {
      const result = await locationService.verifyLocation(
        {
          latitude: venueLatitude,
          longitude: venueLongitude,
        },
        100 // 100 meters
      );

      // Check if result exists and has required properties
      if (!result || typeof result.success === 'undefined') {
        logger.error('[CheckInFlow] Location verification returned invalid result', result);
        Alert.alert(
          'Location Error',
          'Unable to verify your location. Please try again.',
          [
            { text: 'Cancel', onPress: () => navigation.goBack() },
            { text: 'Try Again', onPress: handleLocationCheck },
          ]
        );
        return;
      }

      if (result.success && result.currentLocation) {
        logger.info('[CheckInFlow] Location verified successfully');
        setLocation(result.currentLocation);

        // Move to next step
        if (requiresTerms) {
          // Load venue terms dynamically
          await loadVenueTerms();
          setCurrentStep('venue_terms');
        } else {
          setCurrentStep('camera');
        }
      } else {
        Alert.alert(
          'Location Verification Failed',
          result.error || 'You must be at the venue to check in',
          [
            { text: 'Cancel', onPress: () => navigation.goBack() },
            { text: 'Try Again', onPress: handleLocationCheck },
          ]
        );
      }
    } catch (error: any) {
      logger.error('[CheckInFlow] Location verification error', { error });

      if (error instanceof ApiTimeoutError) {
        Alert.alert('Timeout', ERROR_MESSAGES.TIMEOUT_ERROR, [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', onPress: handleLocationCheck },
        ]);
      } else if (error instanceof NetworkError) {
        Alert.alert('Network Error', ERROR_MESSAGES.NETWORK_ERROR, [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', onPress: handleLocationCheck },
        ]);
      } else if (error instanceof ApiError) {
        Alert.alert('Server Error', error.statusText, [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', onPress: handleLocationCheck },
        ]);
      } else {
        Alert.alert('Error', 'Failed to verify location. Please try again.', [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', onPress: handleLocationCheck },
        ]);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Load venue terms dynamically
  const loadVenueTerms = async () => {
    try {
      setIsLoadingTerms(true);
      logger.info('[CheckInFlow] Loading venue terms', { venueId });

      const terms = await venueService.getVenueTerms(venueId);
      
      if (terms) {
        setLoadedVenueTerms(terms);
        logger.info('[CheckInFlow] Venue terms loaded successfully');
      } else {
        // Use provided terms or show message
        setLoadedVenueTerms(venueTerms || null);
        logger.warn('[CheckInFlow] No terms found, using fallback');
      }
    } catch (error) {
      logger.error('[CheckInFlow] Failed to load venue terms', { error });
      // Use provided terms as fallback
      setLoadedVenueTerms(venueTerms || null);
    } finally {
      setIsLoadingTerms(false);
    }
  };

  // Step 2: Accept venue terms (if required)
  const handleTermsAccept = () => {
    logger.info('[CheckInFlow] Venue terms accepted');
    setCurrentStep('camera');
  };

  // Step 3: Capture photo
  const handlePhotoCapture = async (uri: string) => {
    logger.info('[CheckInFlow] Photo captured', { uri });
    setPhotoUri(uri);
    setCurrentStep('photo_preview');
  };

  // Step 4: Confirm photo
  const handlePhotoConfirm = async () => {
    if (!photoUri) return;

    try {
      logger.info('[CheckInFlow] Optimizing photo...');
      const optimized = await photoService.optimizePhoto(photoUri);
      setOptimizedPhotoUri(optimized.uri);

      logger.info('[CheckInFlow] Photo optimized', {
        size: `${(optimized.size / 1024 / 1024).toFixed(2)} MB`
      });
      setCurrentStep('signature');
    } catch (error) {
      logger.error('[CheckInFlow] Photo optimization error', { error });
      Alert.alert('Error', 'Failed to process photo. Please try again.');
    }
  };

  // Photo retake
  const handlePhotoRetake = () => {
    setPhotoUri(null);
    setCurrentStep('camera');
  };

  // Step 5: Capture signature
  const handleSignatureCapture = async (signatureData: string) => {
    logger.info('[CheckInFlow] Signature captured');
    setSignature(signatureData);
    setCurrentStep('processing');

    // Process check-in
    await processCheckIn(signatureData);
  };

  // Process check-in with offline support
  const processCheckIn = async (signatureData: string) => {
    try {
      if (!location || !optimizedPhotoUri) {
        throw new Error('Missing required data');
      }

      logger.info('[CheckInFlow] Processing check-in...');

      // 0. Clear any stale check_in entries from sync queue to prevent duplicate retries
      const removedCount = await database.removeSyncQueueItemsForShift(shiftId, ['check_in']);
      if (removedCount > 0) {
        logger.info('[CheckInFlow] Cleared stale check_in entries from sync queue', { removedCount });
      }

      // 1. Update shift in local database
      await database.updateShift(shiftId, {
        status: 'in_progress',
        actual_start_time: new Date().toISOString(),
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        check_in_photo: optimizedPhotoUri,
        check_in_signature: signatureData,
        sync_status: 'pending',
      });

      logger.info('[CheckInFlow] Shift updated in local database');

      // 2. Add to sync queue
      await syncService.addToQueue({
        type: 'check_in',
        entityType: 'shifts',
        entityId: shiftId.toString(),
        payload: {
          shift_id: shiftId,
          check_in_time: new Date().toISOString(),
          latitude: location.latitude,
          longitude: location.longitude,
          photo: optimizedPhotoUri,
          signature: signatureData,
        },
        priority: 1, // High priority
      });

      logger.info('[CheckInFlow] Added to sync queue');

      // 3. Trigger sync if online
      if (isOnline) {
        syncService.startSync();
      }

      // 4. Show success and navigate back
      Alert.alert(
        'Check-In Successful',
        isOnline
          ? 'You have successfully checked in to your shift.'
          : 'You have successfully checked in. Data will sync when online.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Tabs' }],
              });
            },
          },
        ]
      );
    } catch (error: any) {
      logger.error('[CheckInFlow] Process check-in error', { error });
      Alert.alert(
        'Check-In Failed',
        'Failed to complete check-in. Please try again.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case 'location_check':
        return (
          <Container>
            <View style={styles.stepContainer}>
              <Ionicons name="location" size={64} color={colors.primary} />
              <Heading2 style={styles.stepTitle}>Location Verification</Heading2>
              <Body color={colors.text.secondary} style={styles.stepText}>
                We need to verify you are at {venueName}
              </Body>
              <Button
                variant="primary"
                size="large"
                onPress={handleLocationCheck}
                disabled={isVerifying}
                style={styles.button}
              >
                {isVerifying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  'Verify Location'
                )}
              </Button>
              <Button
                variant="secondary"
                size="large"
                onPress={() => navigation.goBack()}
                style={styles.button}
              >
                Cancel
              </Button>
            </View>
          </Container>
        );

      case 'venue_terms':
        return (
          <Container>
            <View style={styles.stepContainer}>
              <Ionicons name="document-text" size={64} color={colors.primary} />
              <Heading2 style={styles.stepTitle}>Venue Terms</Heading2>
              {isLoadingTerms ? (
                <>
                  <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                  <Body color={colors.text.secondary} style={styles.stepText}>
                    Loading venue terms...
                  </Body>
                </>
              ) : (
                <>
                  <Body color={colors.text.secondary} style={styles.stepText}>
                    {loadedVenueTerms
                      ? 'Please review and accept the venue terms before continuing'
                      : 'Venue terms will be displayed for review'}
                  </Body>
                  <Button
                    variant="primary"
                    size="large"
                    onPress={handleTermsAccept}
                    disabled={isLoadingTerms}
                    style={styles.button}
                  >
                    {loadedVenueTerms ? 'Review Terms' : 'Continue Without Terms'}
                  </Button>
                </>
              )}
            </View>
          </Container>
        );

      case 'camera':
        return (
          <CameraView
            purpose="check-in"
            onCapture={handlePhotoCapture}
            onClose={() => navigation.goBack()}
          />
        );

      case 'photo_preview':
        return photoUri ? (
          <PhotoPreview
            photoUri={photoUri}
            onConfirm={handlePhotoConfirm}
            onRetake={handlePhotoRetake}
          />
        ) : null;

      case 'signature':
        return (
          <SignatureCanvas
            title="Check-In Signature"
            subtitle="Sign to confirm check-in"
            onConfirm={handleSignatureCapture}
            onClose={() => navigation.goBack()}
          />
        );

      case 'processing':
        return (
          <Container>
            <View style={styles.stepContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Heading2 style={styles.stepTitle}>Processing Check-In</Heading2>
              <Body color={colors.text.secondary} style={styles.stepText}>
                Please wait while we complete your check-in...
              </Body>
            </View>
          </Container>
        );

      default:
        return null;
    }
  };

  return <View style={styles.container}>{renderStep()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  stepTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepText: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  button: {
    width: '100%',
    marginTop: spacing.md,
  },
});
