/**
 * ShiftDetailsScreen - Wise-Inspired Minimal Design
 * Clean, product-focused shift details with hero map
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Image,
  Text,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Container, Button } from '@components/ui';
import { CameraModal } from '@components/camera';
import { SignatureModal } from '@components/signature';
import { VenueTermsModal } from '@components/terms';
import { TransferShiftModal, ReleaseShiftModal } from '@components/modals';
import { TransferDetailsCard } from '../../components/shift';
import { colors, getColors, spacing } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { Shift, checkInShift, checkOutShift } from '../../store/slices/shiftsSlice';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { useAuth } from '../../hooks/useAuth';
import {
  approveShiftThunk,
  cancelShiftThunk,
  selectManageShiftsMutating,
} from '../../store/slices/manageShiftsSlice';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../types/navigation';
import { locationService } from '../../services/locationService';
import { venueTermsService } from '../../services/venueTermsService';
import { apiService, ApiError, ApiTimeoutError, NetworkError } from '../../services/api';
import { API_ENDPOINTS } from '../../config/api.config';
import { syncService } from '../../services/syncService';
import { database } from '../../services/database';
import { logger } from '../../utils/logger';
import { ERROR_MESSAGES } from '../../utils/constants';
import { shiftsService } from '../../services/shiftsService';
import exchangeService from '../../services/exchangeService';

const { width } = Dimensions.get('window');
const MAP_WIDTH = width * 0.9;
const MAP_HEIGHT = MAP_WIDTH / 1.5;

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface ShiftDetailsScreenProps {
  route: {
    params: {
      shift?: Shift;      // Full shift object (from in-app navigation)
      shiftId?: number;   // Just shift ID (from notifications or deep links)
    };
  };
}

export const ShiftDetailsScreen: React.FC<ShiftDetailsScreenProps> = ({
  route,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const isAdminMutating = useAppSelector(selectManageShiftsMutating);

  // Handle both cases: full shift object OR just ID
  const [shift, setShift] = useState<Shift | null>(route.params.shift || null);
  const [isLoadingShift, setIsLoadingShift] = useState(!route.params.shift && !!route.params.shiftId);
  const [distanceToVenue, setDistanceToVenue] = useState<number | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [venuePhoto, setVenuePhoto] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Check-out state (separate from check-in)
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Transfer and Release modals state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  // Refresh shift data from backend every time the screen gains focus.
  // Uses the single-shift endpoint (/shifts/{id}/) which the backend scopes
  // by role: staff see their own, managers/admins see their company's — so
  // this works for both staff check-in flows and admin management.
  useFocusEffect(
    useCallback(() => {
      const shiftId = route.params.shiftId || route.params.shift?.id;
      if (!shiftId) return;

      let cancelled = false;

      const fetchShiftData = async () => {
        if (!shift) setIsLoadingShift(true);

        try {
          console.log('[ShiftDetails] Refreshing shift data for ID:', shiftId);
          const fetchedShift = await shiftsService.fetchShift(shiftId);
          if (cancelled) return;
          console.log('[ShiftDetails] ✅ Shift data loaded, status:', fetchedShift.status);
          setShift(fetchedShift);
        } catch (error) {
          console.error('[ShiftDetails] ❌ Error fetching shift:', error);
          if (!cancelled && !shift) {
            Alert.alert('Error', 'Failed to load shift details');
            navigation.goBack();
          }
        } finally {
          if (!cancelled) setIsLoadingShift(false);
        }
      };

      fetchShiftData();

      return () => {
        cancelled = true;
      };
    }, [route.params.shiftId, route.params.shift?.id])
  );

  // Calculate distance to venue with real-time updates
  useEffect(() => {
    if (!shift || !shift.venue.latitude || !shift.venue.longitude) {
      return;
    }

    let locationSubscription: any = null;
    let isMounted = true;

    const startTracking = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!isMounted) return;

      const venueCoords = {
        latitude: typeof shift.venue.latitude === 'string'
          ? parseFloat(shift.venue.latitude)
          : shift.venue.latitude,
        longitude: typeof shift.venue.longitude === 'string'
          ? parseFloat(shift.venue.longitude)
          : shift.venue.longitude,
      };

      try {
        const currentLocation = await locationService.getCurrentLocation();
        if (currentLocation && isMounted) {
          const distance = locationService.calculateDistance(currentLocation, venueCoords);
          setDistanceToVenue(distance);
        }

        if (isMounted) {
          locationSubscription = await locationService.watchLocation((newLocation) => {
            if (isMounted) {
              const distance = locationService.calculateDistance(newLocation, venueCoords);
              setDistanceToVenue(distance);
              console.log('[ShiftDetails] Distance updated:', distance, 'meters');
            }
          });
        }
      } catch (error) {
        console.log('[ShiftDetails] Error tracking location:', error);
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
        console.log('[ShiftDetails] Stopped tracking location');
      }
    };
  }, [shift]); // Use shift instead of accessing nested properties

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Check if shift has already started
  const hasShiftStarted = () => {
    if (!shift) return false;
    const startTime = new Date(shift.start_time);
    const now = new Date();
    return startTime <= now;
  };

  // Check if shift can be transferred or released (before it starts)
  const canTransferOrRelease = () => {
    if (!shift) return false;

    // Can't transfer if already pending or recently transferred
    if (shift.pending_exchange || shift.pending_release || shift.approved_transfer) {
      return false;
    }

    return shift.status === 'scheduled' && !hasShiftStarted();
  };

  // Check if shift is eligible for check-in (comprehensive time validation)
  const canCheckIn = () => {
    if (!shift) return false;
    const now = new Date();
    const startTime = new Date(shift.start_time);
    const endTime = new Date(shift.end_time);

    // Don't show button if shift has ended (allow check-in up to shift end time)
    if (endTime < now) return false;

    // Allow check-in starting 15 minutes before shift and anytime during shift
    // Staff can check in late - their actual check-in time is recorded for timesheet/pay calculation
    const fifteenMinutesBefore = new Date(startTime.getTime() - 15 * 60 * 1000);
    return now >= fifteenMinutesBefore && now <= endTime;
  };

  // Calculate shift duration
  const calculateDuration = () => {
    if (!shift) return '0h';
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${diffHours}h ${diffMinutes > 0 ? `${diffMinutes}m` : ''}`;
  };

  // Get status info
  const getStatusInfo = () => {
    if (!shift) {
      return {
        color: colors.gray[600],
        bgColor: colors.gray[100],
        text: 'LOADING',
        icon: 'time' as const,
      };
    }
    switch (shift.status) {
      case 'in_progress':
        return {
          color: colors.success,
          bgColor: `${colors.success}15`,
          text: 'ACTIVE',
          icon: 'checkmark-circle' as const,
        };
      case 'no_show':
        return {
          color: colors.error,
          bgColor: `${colors.error}15`,
          text: 'NO SHOW',
          icon: 'close-circle' as const,
        };
      case 'completed':
      case 'approved':
        return {
          color: colors.gray[600],
          bgColor: colors.gray[100],
          text: 'COMPLETED',
          icon: 'checkmark-done-circle' as const,
        };
      case 'cancelled':
        return {
          color: colors.error,
          bgColor: `${colors.error}15`,
          text: 'CANCELLED',
          icon: 'close-circle' as const,
        };
      default:
        return {
          color: colors.primary,
          bgColor: `${colors.primary}15`,
          text: 'SCHEDULED',
          icon: 'time' as const,
        };
    }
  };

  // Generate static map image URL using Mapbox
  const getStaticMapUrl = () => {
    if (!shift) return '';
    let { latitude, longitude } = shift.venue;

    console.log('[ShiftDetails] Venue coordinates (raw):', { latitude, longitude });

    if (typeof latitude === 'string') {
      latitude = parseFloat(latitude);
    }
    if (typeof longitude === 'string') {
      longitude = parseFloat(longitude);
    }

    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.warn('[ShiftDetails] Missing or invalid venue coordinates:', { latitude, longitude });
      return '';
    }

    console.log('[ShiftDetails] Parsed coordinates:', { latitude, longitude });

    const zoom = 17;
    const width = 600;
    const height = 400;

    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s-l+0074D9(${longitude},${latitude})/${longitude},${latitude},${zoom},0/${width}x${height}@2x?access_token=${mapboxToken}`;

    console.log('[ShiftDetails] Generated map URL:', url);

    return url;
  };

  // Open venue in native maps app
  const openInMaps = () => {
    const { latitude, longitude, name } = shift.venue;
    const label = encodeURIComponent(name);

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch((err) => {
        Alert.alert('Error', 'Could not open maps application');
        console.error('Error opening maps:', err);
      });
    }
  };

  // Handle check-in
  const handleCheckIn = () => {
    if (distanceToVenue && distanceToVenue > 100) {
      Alert.alert(
        'Too Far From Venue',
        `You are ${distanceToVenue}m away from the venue. You must be within 100m to check in.\n\nPlease move closer to the venue and try again.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Start Shift',
      'Ready to check in? You will need to:\n\n• Take a photo of the venue entrance\n• Sign the check-in form',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => {
            logger.info('[ShiftDetails] Starting check-in flow');
            setShowCameraModal(true);
          },
        },
      ]
    );
  };

  // Handle photo taken from camera
  const handlePhotoTaken = (photoUri: string) => {
    if (isCheckingOut) {
      handleCheckOutPhotoTaken(photoUri);
    } else {
      logger.info('[ShiftDetails] Photo captured:', photoUri);
      setVenuePhoto(photoUri);
      setShowCameraModal(false);

      Alert.alert(
        'Photo Captured!',
        'Great! Next you\'ll need to add your digital signature.',
        [
          {
            text: 'Continue',
            onPress: () => {
              logger.info('[ShiftDetails] Opening signature modal');
              setShowSignatureModal(true);
            },
          },
        ]
      );
    }
  };

  // Handle signature confirmed
  const handleSignatureConfirmed = async (signatureData: string) => {
    if (isCheckingOut) {
      handleCheckOutSignatureConfirmed(signatureData);
    } else {
      logger.info('[ShiftDetails] Signature captured');
      setSignature(signatureData);
      setShowSignatureModal(false);

      const hasAccepted = await venueTermsService.hasAcceptedTerms(shift.venue.id);

      if (hasAccepted) {
        logger.info('[ShiftDetails] Terms already accepted, completing check-in');
        handleCompleteCheckIn();
      } else {
        logger.info('[ShiftDetails] First time at venue, showing terms modal');
        Alert.alert(
          'Signature Captured!',
          'Perfect! Now let\'s review and accept the venue terms.',
          [
            {
              text: 'Continue',
              onPress: () => {
                setShowTermsModal(true);
              },
            },
          ]
        );
      }
    }
  };

  // Handle terms accepted
  const handleTermsAccepted = async () => {
    logger.info('[ShiftDetails] Venue terms accepted');
    setShowTermsModal(false);
    await venueTermsService.acceptTerms(shift.venue.id);
    handleCompleteCheckIn();
  };

  // Complete check-in
  const handleCompleteCheckIn = async () => {
    try {
      logger.info('[ShiftDetails] Completing check-in', {
        photo: venuePhoto,
        signature: signature ? 'captured' : 'missing',
        venueId: shift.venue.id,
      });

      const currentLocation = await locationService.getCurrentLocation();

      if (!currentLocation) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        return;
      }

      try {
        // Clear any stale check_in entries from sync queue to prevent duplicate retries
        // This fixes the bug where old queued check_in entries would be retried and fail
        const removedCount = await database.removeSyncQueueItemsForShift(shift.id, ['check_in']);
        if (removedCount > 0) {
          logger.info('[ShiftDetails] Cleared stale check_in entries from sync queue', { removedCount });
        }

        // Use dedicated check-in endpoint (POST) for idempotency protection
        // The dedicated endpoint rejects duplicate check-ins, preventing the bug
        // where checkout would trigger a new check-in time
        const checkInPayload = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          photo: venuePhoto || null,
          signature: signature || null,
        };

        logger.info('[ShiftDetails] Sending check-in data to dedicated endpoint...');

        const response = await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_IN(shift.id), checkInPayload);

        logger.info('[ShiftDetails] Check-in data saved to backend successfully', { response });

        dispatch(checkInShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: venuePhoto || undefined,
          signature: signature || undefined,
          syncStatus: 'synced',
          checkInTime: response?.shift?.check_in_time,  // Use server timestamp from response.shift
        }));

        logger.info('[ShiftDetails] Redux state updated');

        Alert.alert(
          'Check-In Complete!',
          'You have successfully checked in to your shift. Stay safe!',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } catch (apiError: any) {
        logger.error('[ShiftDetails] Failed to sync check-in to backend:', apiError);

        let errorMessage = 'Your check-in was saved but will sync to the server when you have internet connection.';
        let errorTitle = 'Check-In Saved Locally';

        if (apiError instanceof ApiTimeoutError) {
          errorTitle = 'Timeout';
          errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR + '\nYour check-in was saved locally and will sync when connection improves.';
        } else if (apiError instanceof NetworkError) {
          errorTitle = 'Offline';
          errorMessage = ERROR_MESSAGES.NETWORK_ERROR + '\nYour check-in was saved locally and will sync when you\'re back online.';
        } else if (apiError instanceof ApiError) {
          // Show the actual server error message for better debugging
          // Note: ApiError stores response data in .response, not .data
          const serverMessage = apiError.response?.detail || apiError.response?.error || apiError.statusText || 'Unknown error';

          // Check if it's a "already checked in" error - don't save locally in that case
          if (serverMessage.toLowerCase().includes('already checked in')) {
            errorTitle = 'Already Checked In';
            errorMessage = 'You are already checked in to this shift. Please refresh and try checking out instead.';
            // Don't dispatch checkInShift here - shift is already checked in on server
            Alert.alert(errorTitle, errorMessage, [{ text: 'OK', onPress: () => navigation.goBack() }]);
            return;
          }

          errorTitle = 'Server Error';
          errorMessage = `Server error: ${serverMessage}\nYour check-in was saved locally and will retry automatically.`;
        }

        dispatch(checkInShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: venuePhoto || undefined,
          signature: signature || undefined,
          syncStatus: 'pending',
        }));

        logger.warn('[ShiftDetails] Check-in saved locally, will sync when online');

        Alert.alert(
          errorTitle,
          errorMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error) {
      logger.error('[ShiftDetails] Error completing check-in:', error);
      Alert.alert('Error', 'Failed to complete check-in. Please try again.');
    }
  };

  // Handle check-out
  const handleCheckOut = () => {
    Alert.alert(
      'End Shift',
      'Ready to check out? You will need to:\n\n• Take a final venue photo\n• Sign the check-out form',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take Photo',
          onPress: () => {
            logger.info('[ShiftDetails] Starting check-out flow');
            setIsCheckingOut(true);
            setShowCameraModal(true);
          },
        },
      ]
    );
  };

  // Handle check-out photo taken
  const handleCheckOutPhotoTaken = (photoUri: string) => {
    logger.info('[ShiftDetails] Check-out photo captured:', photoUri);
    setCheckOutPhoto(photoUri);
    setShowCameraModal(false);

    Alert.alert(
      'Photo Captured!',
      'Great! Now add your check-out signature.',
      [
        {
          text: 'Continue',
          onPress: () => {
            logger.info('[ShiftDetails] Opening check-out signature modal');
            setShowSignatureModal(true);
          },
        },
      ]
    );
  };

  // Handle check-out signature confirmed
  const handleCheckOutSignatureConfirmed = async (signatureData: string) => {
    logger.info('[ShiftDetails] Check-out signature captured');
    setShowSignatureModal(false);
    handleCompleteCheckOut(signatureData);
  };

  // Complete check-out
  const handleCompleteCheckOut = async (signatureData: string) => {
    try {
      logger.info('[ShiftDetails] Completing check-out', {
        photo: checkOutPhoto,
        signature: signatureData ? 'captured' : 'missing',
        shiftId: shift.id,
      });

      const currentLocation = await locationService.getCurrentLocation();

      if (!currentLocation) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        setIsCheckingOut(false);
        return;
      }

      try {
        // Clear any stale check_in or check_out entries from sync queue to prevent duplicate retries
        // This fixes the bug where old queued check_in entries would be retried when trying to check out
        const removedCount = await database.removeSyncQueueItemsForShift(shift.id, ['check_in', 'check_out']);
        if (removedCount > 0) {
          logger.info('[ShiftDetails] Cleared stale sync queue entries before check-out', { removedCount });
        }

        // Use dedicated POST endpoint for checkout (not generic PATCH)
        const checkOutPayload = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          photo: checkOutPhoto || null,
          signature: signatureData || null,
        };

        logger.info('[ShiftDetails] Sending check-out data to dedicated endpoint...');

        await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_OUT(shift.id), checkOutPayload);

        logger.info('[ShiftDetails] Check-out data saved to backend successfully');

        dispatch(checkOutShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: checkOutPhoto || undefined,
          signature: signatureData || undefined,
          syncStatus: 'synced',
        }));

        logger.info('[ShiftDetails] Redux state updated - shift completed');

        Alert.alert(
          'Shift Completed!',
          'You have successfully checked out. Great work today!',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      } catch (apiError: any) {
        logger.error('[ShiftDetails] Failed to sync check-out to backend:', apiError);

        let errorMessage = 'Your check-out was saved but will sync to the server when you have internet connection.';
        let errorTitle = 'Check-Out Saved Locally';

        if (apiError instanceof ApiTimeoutError) {
          errorTitle = 'Timeout';
          errorMessage = ERROR_MESSAGES.TIMEOUT_ERROR + '\nYour check-out was saved locally and will sync when connection improves.';
        } else if (apiError instanceof NetworkError) {
          errorTitle = 'Offline';
          errorMessage = ERROR_MESSAGES.NETWORK_ERROR + '\nYour check-out was saved locally and will sync when you\'re back online.';
        } else if (apiError instanceof ApiError) {
          // Note: ApiError stores response data in .response, not .data
          const serverMessage = apiError.response?.detail || apiError.response?.error || apiError.statusText || 'Unknown error';

          // Check if it's a "already checked out" error - don't save locally in that case
          if (serverMessage.toLowerCase().includes('already checked out')) {
            errorTitle = 'Already Checked Out';
            errorMessage = 'This shift has already been checked out.';
            Alert.alert(errorTitle, errorMessage, [{ text: 'OK', onPress: () => navigation.goBack() }]);
            setIsCheckingOut(false);
            return;
          }

          errorTitle = 'Server Error';
          errorMessage = `Server error: ${serverMessage}\nYour check-out was saved locally and will retry automatically.`;
        }

        // Update Redux state with pending sync status
        dispatch(checkOutShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: checkOutPhoto || undefined,
          signature: signatureData || undefined,
          syncStatus: 'pending',
        }));

        // Add to sync queue for automatic retry when online
        const syncPayload = {
          shift_id: shift.id,
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          photo: checkOutPhoto || null,
          signature: signatureData || null,
        };

        await syncService.addToQueue({
          type: 'check_out',
          entityType: 'shifts',
          entityId: shift.id.toString(),
          payload: syncPayload,
          priority: 1, // High priority for checkout
        });

        logger.warn('[ShiftDetails] Check-out added to sync queue, will retry when online');

        Alert.alert(
          errorTitle,
          errorMessage,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error) {
      logger.error('[ShiftDetails] Error completing check-out:', error);
      Alert.alert('Error', 'Failed to complete check-out. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Handle cancel transfer
  const handleCancelTransfer = async () => {
    const exchangeId = shift?.pending_exchange?.id || shift?.pending_release?.id;
    if (!exchangeId) return;

    Alert.alert(
      'Cancel Transfer',
      'Are you sure you want to cancel this transfer request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              if (shift.pending_exchange) {
                await exchangeService.cancelExchange(exchangeId);
              } else if (shift.pending_release) {
                await exchangeService.cancelOpenShiftRequest(exchangeId);
              }

              // Refresh shift data
              Alert.alert('Cancelled', 'Transfer request cancelled successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              logger.error('[ShiftDetails] Error cancelling transfer:', error);
              Alert.alert('Error', 'Failed to cancel transfer request');
            }
          },
        },
      ]
    );
  };

  // Show loading state while fetching shift data
  if (isLoadingShift || !shift) {
    return (
      <Container style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeButton, { backgroundColor: themeColors.background.secondary }]}>
          <Ionicons name="close" size={28} color={themeColors.text.primary} />
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>Loading shift details...</Text>
        </View>
      </Container>
    );
  }

  // Now that we know shift is not null, we can safely call getStatusInfo
  const statusInfo = getStatusInfo();

  return (
    <Container style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      {/* Close Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeButton, { backgroundColor: themeColors.background.secondary }]}>
        <Ionicons name="close" size={28} color={themeColors.text.primary} />
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>

        {/* Hero Map Display */}
        <View style={styles.mapWrapper}>
          {(shift.venue.latitude && shift.venue.longitude && getStaticMapUrl()) ? (
            <TouchableOpacity onPress={openInMaps} activeOpacity={0.9}>
              <Image
                source={{ uri: getStaticMapUrl() }}
                style={styles.map}
                resizeMode="cover"
                onError={(error) => {
                  console.log('[ShiftDetails] Map image failed to load:', error);
                }}
                onLoad={() => {
                  console.log('[ShiftDetails] Map image loaded successfully');
                }}
              />
              {/* Distance Overlay */}
              {distanceToVenue !== null && (
                <View style={styles.distanceOverlay}>
                  <View style={[styles.distanceBadge, distanceToVenue <= 100 && styles.distanceBadgeNear]}>
                    <Ionicons
                      name={distanceToVenue <= 100 ? "checkmark-circle" : "location"}
                      size={16}
                      color={distanceToVenue <= 100 ? colors.success : colors.white}
                    />
                    <Text style={styles.distanceText}>
                      {distanceToVenue}m away
                    </Text>
                    {distanceToVenue <= 100 && (
                      <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              {/* Open in Maps Hint */}
              <View style={styles.mapsHint}>
                <Ionicons name="navigate" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.mapsHintText}>Tap to open in Maps</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.map, styles.mapPlaceholder, { backgroundColor: themeColors.background.secondary }]}>
              <Ionicons name="location-outline" size={64} color={themeColors.text.tertiary} />
              <Text style={[styles.mapPlaceholderText, { color: themeColors.text.tertiary }]}>Map unavailable</Text>
            </View>
          )}
        </View>

        {/* Bold Venue Heading */}
        <Text style={[styles.mainHeading, { color: themeColors.text.primary }]}>{shift.venue.name.toUpperCase()}</Text>

        {/* Address Subtitle */}
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>{shift.venue.address}</Text>

        {/* Date & Time Info */}
        <Text style={[styles.dateText, { color: themeColors.text.primary }]}>{formatDate(shift.start_time)}</Text>
        <Text style={[styles.timeText, { color: themeColors.text.secondary }]}>
          {formatTime(shift.start_time)} - {formatTime(shift.end_time)} · {calculateDuration()}
        </Text>

        {/* Schedule Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: isDark ? '#1a2744' : '#F0F4FF' }]}>
              <Ionicons name="calendar" size={22} color="#0066FF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Shift Date</Text>
              <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                {formatDate(shift.start_time)}
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: isDark ? '#1a2744' : '#F0F4FF' }]}>
              <Ionicons name="time" size={22} color="#0066FF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Working Hours</Text>
              <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: isDark ? '#1a2744' : '#F0F4FF' }]}>
              <MaterialCommunityIcons name="clock-time-four-outline" size={22} color="#0066FF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Duration</Text>
              <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                {calculateDuration()} total shift time
              </Text>
            </View>
          </View>
        </View>

        {/* Transfer Details Card */}
        {(shift.pending_exchange || shift.pending_release) && (
          <TransferDetailsCard
            exchange={shift.pending_exchange}
            release={shift.pending_release}
            onCancel={handleCancelTransfer}
          />
        )}

        {/* Team Section - Multi-staff Shifts */}
        {shift.coworkers && shift.coworkers.length > 0 && (
          <>
            <Text style={[styles.sectionHeading, { color: themeColors.text.secondary }]}>Your Team</Text>
            <View style={styles.teamContainer}>
              {shift.coworkers.map((coworker) => {
                // Determine co-worker status
                let statusColor = colors.gray[400];
                let statusText = 'Scheduled';
                let statusIcon: keyof typeof Ionicons.glyphMap = 'time-outline';

                if (coworker.check_out_time) {
                  statusColor = colors.gray[600];
                  statusText = 'Completed';
                  statusIcon = 'checkmark-done-circle';
                } else if (coworker.check_in_time) {
                  statusColor = colors.success;
                  statusText = 'Checked In';
                  statusIcon = 'checkmark-circle';
                }

                return (
                  <View key={coworker.id} style={[styles.teamMemberCard, { backgroundColor: themeColors.background.secondary }]}>
                    {/* Avatar */}
                    <View style={styles.teamMemberAvatar}>
                      {coworker.profile_photo ? (
                        <Image
                          source={{ uri: coworker.profile_photo }}
                          style={styles.teamMemberImage}
                        />
                      ) : (
                        <View style={[styles.teamMemberInitials, { backgroundColor: isDark ? '#1a2744' : '#E8F0FF' }]}>
                          <Text style={styles.teamMemberInitialsText}>
                            {coworker.first_name?.charAt(0)}
                            {coworker.last_name?.charAt(0)}
                          </Text>
                        </View>
                      )}
                      {/* Status indicator dot */}
                      <View style={[styles.statusDot, { backgroundColor: statusColor, borderColor: themeColors.background.secondary }]} />
                    </View>

                    {/* Name and Status */}
                    <View style={styles.teamMemberInfo}>
                      <Text style={[styles.teamMemberName, { color: themeColors.text.primary }]}>
                        {coworker.first_name} {coworker.last_name}
                      </Text>
                      <View style={styles.teamMemberStatus}>
                        <Ionicons name={statusIcon} size={14} color={statusColor} />
                        <Text style={[styles.teamMemberStatusText, { color: statusColor }]}>
                          {statusText}
                          {coworker.check_in_time && !coworker.check_out_time && (
                            <Text> · {new Date(coworker.check_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
                          )}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Required Checks Section */}
        {(shift.venue.requires_fire_exit_check ||
        shift.venue.requires_capacity_check ||
        shift.venue.requires_id_scan) && (
          <>
            <Text style={[styles.sectionHeading, { color: themeColors.text.secondary }]}>Required Venue Checks</Text>
            <View style={styles.checksContainer}>
              {shift.venue.requires_fire_exit_check && (
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconCircle, { backgroundColor: isDark ? '#1a2744' : '#F0F4FF' }]}>
                    <Ionicons name="flame-outline" size={22} color="#0066FF" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Fire Exit Check</Text>
                    <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                      Verify all fire exits are accessible
                    </Text>
                  </View>
                </View>
              )}

              {shift.venue.requires_capacity_check && (
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconCircle, { backgroundColor: isDark ? '#1a2744' : '#F0F4FF' }]}>
                    <Ionicons name="people-outline" size={22} color="#0066FF" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Capacity Check</Text>
                    <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                      Monitor and report venue capacity
                    </Text>
                  </View>
                </View>
              )}

              {shift.venue.requires_id_scan && (
                <View style={styles.featureItem}>
                  <View style={[styles.featureIconCircle, { backgroundColor: isDark ? '#1a2744' : '#F0F4FF' }]}>
                    <Ionicons name="card-outline" size={22} color="#0066FF" />
                  </View>
                  <View style={styles.featureContent}>
                    <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>ID Scanning</Text>
                    <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                      Scan and verify guest identification
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* Sync Status */}
        {shift.sync_status !== 'synced' && (
          <View style={[styles.syncCard, { backgroundColor: themeColors.background.secondary }]}>
            <View style={[styles.syncIconCircle, shift.sync_status === 'failed' && styles.syncIconError]}>
              <Ionicons
                name={shift.sync_status === 'failed' ? 'alert-circle-outline' : 'cloud-upload-outline'}
                size={22}
                color={shift.sync_status === 'failed' ? colors.error : colors.warning}
              />
            </View>
            <View style={styles.syncContent}>
              <Text style={[styles.syncTitle, { color: themeColors.text.primary }]}>
                {shift.sync_status === 'failed' ? 'Sync Failed' : 'Pending Sync'}
              </Text>
              <Text style={[styles.syncDescription, { color: themeColors.text.secondary }]}>
                {shift.sync_status === 'failed'
                  ? 'Will retry automatically when online'
                  : 'Waiting for internet connection'}
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Spacing for Action Buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons - Fixed at Bottom */}
      <View style={[styles.footer, { backgroundColor: themeColors.background.primary, borderTopColor: themeColors.border.light }]}>
        {/* Admin/Manager action row — appears for managers/admins on actionable shifts */}
        {isManager && (shift.status === 'pending_approval' || shift.status === 'scheduled' || shift.status === 'open') && (
          <View style={styles.secondaryActionsRow}>
            {shift.status === 'pending_approval' && (
              <>
                <TouchableOpacity
                  disabled={isAdminMutating}
                  style={[
                    styles.secondaryActionButton,
                    { backgroundColor: themeColors.background.secondary, opacity: isAdminMutating ? 0.6 : 1 },
                  ]}
                  onPress={() => {
                    const managerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Manager';
                    const signature = `Approved by ${managerName} at ${new Date().toISOString()}`;
                    Alert.alert(
                      'Approve shift',
                      `Your name and the current time will be recorded as the approval attestation.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Approve',
                          onPress: async () => {
                            try {
                              await dispatch(approveShiftThunk({
                                shiftId: shift.id,
                                approved: true,
                                managerSignature: signature,
                              })).unwrap();
                              Alert.alert('Shift approved', '', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                              ]);
                            } catch (err: any) {
                              Alert.alert('Failed to approve', typeof err === 'string' ? err : 'Please try again.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                  <Text style={[styles.secondaryActionText, { color: colors.success }]}>Approve</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isAdminMutating}
                  style={[
                    styles.secondaryActionButton,
                    styles.dangerAction,
                    { backgroundColor: themeColors.background.secondary, opacity: isAdminMutating ? 0.6 : 1 },
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Reject shift',
                      'This marks the shift as rejected. Staff will be notified.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Reject',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await dispatch(approveShiftThunk({
                                shiftId: shift.id,
                                approved: false,
                              })).unwrap();
                              Alert.alert('Shift rejected', '', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                              ]);
                            } catch (err: any) {
                              Alert.alert('Failed to reject', typeof err === 'string' ? err : 'Please try again.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  <Text style={[styles.secondaryActionText, styles.dangerActionText]}>Reject</Text>
                </TouchableOpacity>
              </>
            )}

            {(shift.status === 'scheduled' || shift.status === 'open') && (
              <>
                <TouchableOpacity
                  disabled={isAdminMutating}
                  style={[
                    styles.secondaryActionButton,
                    { backgroundColor: themeColors.background.secondary, opacity: isAdminMutating ? 0.6 : 1 },
                  ]}
                  onPress={() => navigation.navigate('EditShift', { shiftId: shift.id })}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={styles.secondaryActionText}>Reschedule</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={isAdminMutating}
                  style={[
                    styles.secondaryActionButton,
                    styles.dangerAction,
                    { backgroundColor: themeColors.background.secondary, opacity: isAdminMutating ? 0.6 : 1 },
                  ]}
                  onPress={() => {
                    Alert.alert(
                      'Cancel shift',
                      'This removes the shift from the assigned staff member\'s schedule.',
                      [
                        { text: 'Keep shift', style: 'cancel' },
                        {
                          text: 'Cancel shift',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await dispatch(cancelShiftThunk(shift.id)).unwrap();
                              Alert.alert('Shift cancelled', '', [
                                { text: 'OK', onPress: () => navigation.goBack() },
                              ]);
                            } catch (err: any) {
                              Alert.alert('Failed to cancel', typeof err === 'string' ? err : 'Please try again.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  <Text style={[styles.secondaryActionText, styles.dangerActionText]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Check-In Button - Only show when within check-in window */}
        {shift.status === 'scheduled' && canCheckIn() && (
          <Button
            title="Check In to Shift"
            variant="primary"
            size="large"
            onPress={handleCheckIn}
            style={styles.actionButton}
            icon={<MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.white} />}
          />
        )}

        {/* Transfer/Release/Cancel Actions - Show for all scheduled shifts that haven't started */}
        {canTransferOrRelease() && (
          <>
            {/* Secondary Actions Row */}
            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={[styles.secondaryActionButton, { backgroundColor: themeColors.background.secondary }]}
                onPress={() => setShowTransferModal(true)}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.secondaryActionText}>
                  Transfer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionButton, { backgroundColor: themeColors.background.secondary }]}
                onPress={() => setShowReleaseModal(true)}
              >
                <MaterialCommunityIcons
                  name="hand-extended-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.secondaryActionText}>
                  Release
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryActionButton, styles.dangerAction, { backgroundColor: themeColors.background.secondary }]}
                onPress={() => {
                  Alert.alert(
                    'Cancel Shift',
                    'Are you sure you want to cancel this shift?',
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Yes, Cancel',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await shiftsService.cancelShift(shift.id);
                            Alert.alert('Success', 'Shift has been cancelled. Your manager will be notified.', [
                              {
                                text: 'OK',
                                onPress: () => navigation.goBack(),
                              },
                            ]);
                          } catch (error: any) {
                            logger.error('[ShiftDetails] Error cancelling shift:', error);
                            Alert.alert(
                              'Error',
                              error?.message || 'Failed to cancel shift. Please try again.'
                            );
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <Text style={[styles.secondaryActionText, styles.dangerActionText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {shift.status === 'in_progress' && (
          <Button
            title="End Shift"
            variant="primary"
            size="large"
            onPress={handleCheckOut}
            style={styles.actionButton}
            icon={<Ionicons name="log-out-outline" size={20} color={colors.white} />}
          />
        )}

        {(shift.status === 'completed' || shift.status === 'cancelled' || shift.status === 'approved' || shift.status === 'no_show') && (
          <Button
            title="Close"
            variant="secondary"
            size="large"
            onPress={() => navigation.goBack()}
            style={styles.actionButton}
          />
        )}
      </View>

      {/* Modals */}
      <CameraModal
        visible={showCameraModal}
        onClose={() => {
          setShowCameraModal(false);
          // Don't reset isCheckingOut here - it's reset after checkout completes
          // Resetting here causes the signature flow to route to check-in instead of check-out
        }}
        onPhotoTaken={handlePhotoTaken}
        title={isCheckingOut ? 'Check-Out Venue Photo' : 'Venue Entrance Photo'}
        tips={
          isCheckingOut
            ? [
                'Capture final view of venue',
                'Show venue is secure',
                'Ensure good lighting',
              ]
            : [
                'Show the venue entrance clearly',
                'Include any venue signage',
                'Ensure good lighting',
              ]
        }
      />

      <SignatureModal
        visible={showSignatureModal}
        onClose={() => {
          setShowSignatureModal(false);
        }}
        onSignatureConfirmed={handleSignatureConfirmed}
        title={isCheckingOut ? 'Check-Out Signature' : 'Check-In Signature'}
        showVenueConfirmation={true}
        showSIAConfirmation={!isCheckingOut}
        showSafetyConfirmation={!isCheckingOut}
      />

      <VenueTermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={handleTermsAccepted}
        venueName={shift.venue.name}
        venueRequirements={{
          requires_fire_exit_check: shift.venue.requires_fire_exit_check,
          requires_capacity_check: shift.venue.requires_capacity_check,
          requires_id_scan: shift.venue.requires_id_scan,
        }}
      />

      {/* Transfer and Release Modals */}
      <TransferShiftModal
        visible={showTransferModal}
        shift={shift}
        onClose={() => setShowTransferModal(false)}
        onSuccess={async () => {
          // Refresh shift data to show the pending transfer badge
          try {
            logger.info('[ShiftDetails] Transfer created - refreshing shift data');
            const response = await shiftsService.fetchShifts({ page: 1, pageSize: 100 });
            const updatedShift = response.results.find(s => s.id === shift.id);
            if (updatedShift) {
              logger.info('[ShiftDetails] Shift refreshed with transfer data', {
                hasPendingExchange: !!updatedShift.pending_exchange,
                hasPendingRelease: !!updatedShift.pending_release,
              });
              setShift(updatedShift);
            }
          } catch (error) {
            logger.error('[ShiftDetails] Error refreshing shift after transfer:', error);
          }
        }}
      />

      <ReleaseShiftModal
        visible={showReleaseModal}
        shift={shift}
        onClose={() => setShowReleaseModal(false)}
        onSuccess={async () => {
          // Refresh shift data to show the released to pool badge
          try {
            logger.info('[ShiftDetails] Release created - refreshing shift data');
            const response = await shiftsService.fetchShifts({ page: 1, pageSize: 100 });
            const updatedShift = response.results.find(s => s.id === shift.id);
            if (updatedShift) {
              logger.info('[ShiftDetails] Shift refreshed with release data', {
                hasPendingRelease: !!updatedShift.pending_release,
              });
              setShift(updatedShift);
            }
          } catch (error) {
            logger.error('[ShiftDetails] Error refreshing shift after release:', error);
          }
        }}
      />
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    // backgroundColor applied via inline style for dark mode
  },
  closeButton: {
    position: 'absolute',
    top: 5,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    // backgroundColor applied via inline style for dark mode
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Hero Map
  mapWrapper: {
    marginBottom: spacing.xl,
  },
  map: {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    // backgroundColor applied via inline style for dark mode
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.text.tertiary,
  },
  distanceOverlay: {
    position: 'absolute',
    top: spacing.base,
    left: spacing.base,
    right: spacing.base,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  distanceBadgeNear: {
    backgroundColor: 'rgba(0,182,122,0.95)',
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  mapsHint: {
    position: 'absolute',
    bottom: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
  },
  mapsHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  // Headings
  mainHeading: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.base,
    lineHeight: 48,
    letterSpacing: -1,
    paddingHorizontal: spacing.base,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.base,
    lineHeight: 24,
    paddingHorizontal: spacing.base,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  // Features
  featuresContainer: {
    width: '100%',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  checksContainer: {
    width: '100%',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.base,
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // backgroundColor applied via inline style for dark mode
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
    paddingTop: 4,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  // Section Heading
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  // Sync Card
  syncCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    // backgroundColor applied via inline style for dark mode
    borderRadius: 12,
    padding: spacing.base,
    gap: spacing.base,
  },
  syncIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,152,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncIconError: {
    backgroundColor: 'rgba(239,83,80,0.12)',
  },
  syncContent: {
    flex: 1,
    paddingTop: 4,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  syncDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  // Footer
  footer: {
    padding: spacing.sm,
    // backgroundColor and borderTopColor applied via inline style for dark mode
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    minHeight: 56,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    // backgroundColor applied via inline style for dark mode
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '30', // 30% opacity
    gap: 4,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 2,
  },
  dangerAction: {
    borderColor: colors.error + '30',
  },
  secondaryActionButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.gray[100],
    borderColor: colors.gray[300],
  },
  secondaryActionTextDisabled: {
    color: colors.gray[400],
  },
  dangerActionText: {
    color: colors.error,
  },
  // Team Section Styles
  teamContainer: {
    width: '100%',
    gap: spacing.base,
    marginBottom: spacing.xl,
  },
  teamMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor applied via inline style for dark mode
    borderRadius: 12,
    padding: spacing.base,
    gap: spacing.base,
  },
  teamMemberAvatar: {
    position: 'relative',
  },
  teamMemberImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  teamMemberInitials: {
    width: 48,
    height: 48,
    borderRadius: 24,
    // backgroundColor applied via inline style for dark mode
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberInitialsText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    // borderColor applied via inline style for dark mode
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  teamMemberStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  teamMemberStatusText: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
});
