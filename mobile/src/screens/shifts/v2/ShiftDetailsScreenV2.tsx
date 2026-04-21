/**
 * ShiftDetailsScreenV2 — Shift details re-skinned to match the Phase 4 design.
 *
 * Preserves every handler from the original ShiftDetailsScreen:
 *   - focus-refresh of shift data via shiftsService.fetchShift
 *   - real-time distance tracking via locationService
 *   - check-in / check-out flow (camera → signature → terms → backend sync)
 *   - transfer / release modals + cancel-transfer action
 *   - admin approve / reject / reschedule / cancel
 * Only the presentation layer changes: dark canvas / light paper, Geist Mono
 * eyebrows, glass cards, date cube, red primary CTAs.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CameraModal } from '@components/camera';
import { SignatureModal } from '@components/signature';
import { VenueTermsModal } from '@components/terms';
import { TransferShiftModal, ReleaseShiftModal } from '@components/modals';
import type { MainStackParamList } from '../../../types/navigation';
import { Shift, checkInShift, checkOutShift } from '../../../store/slices/shiftsSlice';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { useAuth } from '../../../hooks/useAuth';
import {
  approveShiftThunk,
  cancelShiftThunk,
  selectManageShiftsMutating,
} from '../../../store/slices/manageShiftsSlice';
import { locationService } from '../../../services/locationService';
import { venueTermsService } from '../../../services/venueTermsService';
import { apiService, ApiError, ApiTimeoutError, NetworkError } from '../../../services/api';
import { API_ENDPOINTS } from '../../../config/api.config';
import { syncService } from '../../../services/syncService';
import { database } from '../../../services/database';
import { logger } from '../../../utils/logger';
import { ERROR_MESSAGES } from '../../../utils/constants';
import { shiftsService } from '../../../services/shiftsService';
import exchangeService from '../../../services/exchangeService';

import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard, PrimaryCTA, AccentDot } from '../../../components/redesign';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 40;
const MAP_HEIGHT = Math.round(MAP_WIDTH / 1.6);

const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_ABBR = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

const formatClockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

const formatDuration = (start: string, end: string) => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const formatShiftDateLine = (iso: string) => {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
};

type StatusKey = 'scheduled' | 'in_progress' | 'completed' | 'approved' | 'cancelled' | 'pending_approval' | 'no_show' | 'loading';

const getStatusLabel = (s: StatusKey) => {
  switch (s) {
    case 'in_progress': return 'Live';
    case 'scheduled': return 'Scheduled';
    case 'completed': return 'Completed';
    case 'approved': return 'Approved';
    case 'cancelled': return 'Cancelled';
    case 'pending_approval': return 'Pending';
    case 'no_show': return 'No show';
    default: return 'Loading';
  }
};

interface ShiftDetailsScreenV2Props {
  route: { params: { shift?: Shift; shiftId?: number } };
}

export const ShiftDetailsScreenV2: React.FC<ShiftDetailsScreenV2Props> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const isAdminMutating = useAppSelector(selectManageShiftsMutating);

  const [shift, setShift] = useState<Shift | null>(route.params.shift || null);
  const [isLoadingShift, setIsLoadingShift] = useState(!route.params.shift && !!route.params.shiftId);
  const [distanceToVenue, setDistanceToVenue] = useState<number | null>(null);

  const [showCameraModal, setShowCameraModal] = useState(false);
  const [venuePhoto, setVenuePhoto] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  // Refresh shift on focus
  useFocusEffect(
    useCallback(() => {
      const shiftId = route.params.shiftId || route.params.shift?.id;
      if (!shiftId) return;
      let cancelled = false;
      (async () => {
        if (!shift) setIsLoadingShift(true);
        try {
          const fetched = await shiftsService.fetchShift(shiftId);
          if (!cancelled) setShift(fetched);
        } catch (error) {
          logger.error('[ShiftDetailsV2] fetch', error);
          if (!cancelled && !shift) {
            Alert.alert('Error', 'Failed to load shift details');
            navigation.goBack();
          }
        } finally {
          if (!cancelled) setIsLoadingShift(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [route.params.shiftId, route.params.shift?.id])
  );

  // Live distance tracking
  useEffect(() => {
    if (!shift || !shift.venue.latitude || !shift.venue.longitude) return;
    let isMounted = true;
    let sub: any = null;
    (async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (!isMounted) return;
      const venueCoords = {
        latitude: typeof shift.venue.latitude === 'string' ? parseFloat(shift.venue.latitude) : shift.venue.latitude,
        longitude: typeof shift.venue.longitude === 'string' ? parseFloat(shift.venue.longitude) : shift.venue.longitude,
      };
      try {
        const cur = await locationService.getCurrentLocation();
        if (cur && isMounted) {
          setDistanceToVenue(locationService.calculateDistance(cur, venueCoords));
        }
        if (isMounted) {
          sub = await locationService.watchLocation((loc) => {
            if (isMounted) setDistanceToVenue(locationService.calculateDistance(loc, venueCoords));
          });
        }
      } catch (e) {
        logger.warn('[ShiftDetailsV2] distance track', e);
      }
    })();
    return () => {
      isMounted = false;
      if (sub?.remove) sub.remove();
    };
  }, [shift]);

  const hasShiftStarted = () => {
    if (!shift) return false;
    return new Date(shift.start_time) <= new Date();
  };

  const canTransferOrRelease = () => {
    if (!shift) return false;
    if (shift.pending_exchange || shift.pending_release || shift.approved_transfer) return false;
    return shift.status === 'scheduled' && !hasShiftStarted();
  };

  const canCheckIn = () => {
    if (!shift) return false;
    const now = new Date();
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    if (end < now) return false;
    const fifteen = new Date(start.getTime() - 15 * 60 * 1000);
    return now >= fifteen && now <= end;
  };

  const getStaticMapUrl = () => {
    if (!shift) return '';
    let lat: any = shift.venue.latitude;
    let lng: any = shift.venue.longitude;
    if (typeof lat === 'string') lat = parseFloat(lat);
    if (typeof lng === 'string') lng = parseFloat(lng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return '';
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
    // Dark/light mapbox style to match theme
    const style = theme.isDark ? 'dark-v11' : 'light-v11';
    return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/pin-s+E1342C(${lng},${lat})/${lng},${lat},16,0/${MAP_WIDTH}x${MAP_HEIGHT}@2x?access_token=${token}`;
  };

  const openInMaps = () => {
    if (!shift) return;
    const { latitude, longitude, name } = shift.venue;
    const label = encodeURIComponent(name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });
    if (url) {
      Linking.openURL(url).catch(() =>
        Alert.alert('Error', 'Could not open maps application'),
      );
    }
  };

  // ─── Check-in flow ──────────────────────────────────────────
  const handleCheckIn = () => {
    if (distanceToVenue && distanceToVenue > 100) {
      Alert.alert(
        'Too far from venue',
        `You are ${distanceToVenue}m away from the venue. You must be within 100m to check in.`,
      );
      return;
    }
    Alert.alert(
      'Start shift',
      'Ready to check in? You will:\n\n• Take a photo of the venue entrance\n• Sign the check-in form',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take photo', onPress: () => setShowCameraModal(true) },
      ],
    );
  };

  const handlePhotoTaken = (photoUri: string) => {
    if (isCheckingOut) {
      handleCheckOutPhotoTaken(photoUri);
    } else {
      setVenuePhoto(photoUri);
      setShowCameraModal(false);
      Alert.alert('Photo captured', 'Next you\'ll add your signature.', [
        { text: 'Continue', onPress: () => setShowSignatureModal(true) },
      ]);
    }
  };

  const handleSignatureConfirmed = async (signatureData: string) => {
    if (isCheckingOut) {
      handleCheckOutSignatureConfirmed(signatureData);
      return;
    }
    setSignature(signatureData);
    setShowSignatureModal(false);
    if (!shift) return;
    const hasAccepted = await venueTermsService.hasAcceptedTerms(shift.venue.id);
    if (hasAccepted) {
      handleCompleteCheckIn();
    } else {
      Alert.alert('Signature captured', 'Now review and accept the venue terms.', [
        { text: 'Continue', onPress: () => setShowTermsModal(true) },
      ]);
    }
  };

  const handleTermsAccepted = async () => {
    if (!shift) return;
    setShowTermsModal(false);
    await venueTermsService.acceptTerms(shift.venue.id);
    handleCompleteCheckIn();
  };

  const handleCompleteCheckIn = async () => {
    if (!shift) return;
    try {
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        return;
      }
      try {
        const removed = await database.removeSyncQueueItemsForShift(shift.id, ['check_in']);
        if (removed > 0) logger.info('[ShiftDetailsV2] cleared stale check_in queue', { removed });
        const checkInPayload = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          photo: venuePhoto || null,
          signature: signature || null,
        };
        const response = await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_IN(shift.id), checkInPayload);
        dispatch(checkInShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: venuePhoto || undefined,
          signature: signature || undefined,
          syncStatus: 'synced',
          checkInTime: response?.shift?.check_in_time,
        }));
        Alert.alert('Check-in complete', 'Stay safe!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (apiError: any) {
        let title = 'Check-in saved locally';
        let msg = 'Your check-in was saved but will sync when you have internet.';
        if (apiError instanceof ApiTimeoutError) {
          title = 'Timeout';
          msg = ERROR_MESSAGES.TIMEOUT_ERROR + '\nSaved locally; will sync when connection improves.';
        } else if (apiError instanceof NetworkError) {
          title = 'Offline';
          msg = ERROR_MESSAGES.NETWORK_ERROR + '\nSaved locally; will sync when back online.';
        } else if (apiError instanceof ApiError) {
          const serverMessage = apiError.response?.detail || apiError.response?.error || apiError.statusText || 'Unknown error';
          if (serverMessage.toLowerCase().includes('already checked in')) {
            Alert.alert('Already checked in', 'Refresh and try checking out instead.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            return;
          }
          title = 'Server error';
          msg = `Server error: ${serverMessage}\nSaved locally and will retry.`;
        }
        dispatch(checkInShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: venuePhoto || undefined,
          signature: signature || undefined,
          syncStatus: 'pending',
        }));
        Alert.alert(title, msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      logger.error('[ShiftDetailsV2] check-in', e);
      Alert.alert('Error', 'Failed to complete check-in. Please try again.');
    }
  };

  // ─── Check-out flow ─────────────────────────────────────────
  const handleCheckOut = () => {
    Alert.alert(
      'End shift',
      'Ready to check out? You will:\n\n• Take a final venue photo\n• Sign the check-out form',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Take photo',
          onPress: () => {
            setIsCheckingOut(true);
            setShowCameraModal(true);
          },
        },
      ],
    );
  };

  const handleCheckOutPhotoTaken = (photoUri: string) => {
    setCheckOutPhoto(photoUri);
    setShowCameraModal(false);
    Alert.alert('Photo captured', 'Now add your check-out signature.', [
      { text: 'Continue', onPress: () => setShowSignatureModal(true) },
    ]);
  };

  const handleCheckOutSignatureConfirmed = async (signatureData: string) => {
    setShowSignatureModal(false);
    handleCompleteCheckOut(signatureData);
  };

  const handleCompleteCheckOut = async (signatureData: string) => {
    if (!shift) return;
    try {
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        setIsCheckingOut(false);
        return;
      }
      try {
        const removed = await database.removeSyncQueueItemsForShift(shift.id, ['check_in', 'check_out']);
        if (removed > 0) logger.info('[ShiftDetailsV2] cleared stale queue before checkout', { removed });
        const checkOutPayload = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          photo: checkOutPhoto || null,
          signature: signatureData || null,
        };
        await apiService.post(API_ENDPOINTS.SHIFTS.CHECK_OUT(shift.id), checkOutPayload);
        dispatch(checkOutShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: checkOutPhoto || undefined,
          signature: signatureData || undefined,
          syncStatus: 'synced',
        }));
        Alert.alert('Shift completed', 'Great work today!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } catch (apiError: any) {
        let title = 'Check-out saved locally';
        let msg = 'Your check-out was saved but will sync when you have internet.';
        if (apiError instanceof ApiTimeoutError) {
          title = 'Timeout';
          msg = ERROR_MESSAGES.TIMEOUT_ERROR + '\nSaved locally; will sync when connection improves.';
        } else if (apiError instanceof NetworkError) {
          title = 'Offline';
          msg = ERROR_MESSAGES.NETWORK_ERROR + '\nSaved locally; will sync when back online.';
        } else if (apiError instanceof ApiError) {
          const serverMessage = apiError.response?.detail || apiError.response?.error || apiError.statusText || 'Unknown error';
          if (serverMessage.toLowerCase().includes('already checked out')) {
            Alert.alert('Already checked out', 'This shift has already been checked out.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            setIsCheckingOut(false);
            return;
          }
          title = 'Server error';
          msg = `Server error: ${serverMessage}\nSaved locally; will retry.`;
        }
        dispatch(checkOutShift({
          shiftId: shift.id,
          location: currentLocation,
          photo: checkOutPhoto || undefined,
          signature: signatureData || undefined,
          syncStatus: 'pending',
        }));
        await syncService.addToQueue({
          type: 'check_out',
          entityType: 'shifts',
          entityId: shift.id.toString(),
          payload: {
            shift_id: shift.id,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            photo: checkOutPhoto || null,
            signature: signatureData || null,
          },
          priority: 1,
        });
        Alert.alert(title, msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      logger.error('[ShiftDetailsV2] check-out', e);
      Alert.alert('Error', 'Failed to complete check-out. Please try again.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCancelTransfer = async () => {
    const exchangeId = shift?.pending_exchange?.id || shift?.pending_release?.id;
    if (!exchangeId || !shift) return;
    Alert.alert('Cancel transfer', 'Cancel this transfer request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            if (shift.pending_exchange) {
              await exchangeService.cancelExchange(exchangeId);
            } else if (shift.pending_release) {
              await exchangeService.cancelOpenShiftRequest(exchangeId);
            }
            Alert.alert('Cancelled', 'Transfer cancelled.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } catch (e) {
            logger.error('[ShiftDetailsV2] cancel transfer', e);
            Alert.alert('Error', 'Failed to cancel transfer request');
          }
        },
      },
    ]);
  };

  // ─── Loading state ──────────────────────────────────────────
  if (isLoadingShift || !shift) {
    return (
      <View style={[styles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[
            styles.closeBtn,
            {
              top: insets.top + 12,
              backgroundColor: theme.colors.surface.chip,
              borderColor: theme.colors.surface.hairline,
            },
          ]}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24">
            <Path d="M5 5L19 19M19 5L5 19" stroke={theme.colors.text.primary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={{ marginTop: 14, color: theme.colors.text.secondary, fontSize: 14 }}>
            Loading shift details…
          </Text>
        </View>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────
  const start = new Date(shift.start_time);
  const dayAbbr = DAY_ABBR[start.getDay()];
  const monthAbbr = MONTH_ABBR[start.getMonth()];
  const dateNum = start.getDate();

  const statusKey = (shift.status as StatusKey) || 'loading';
  const statusLabel = getStatusLabel(statusKey);
  const isLive = shift.status === 'in_progress';
  const isDone = shift.status === 'completed' || shift.status === 'approved' || shift.status === 'cancelled' || shift.status === 'no_show';
  const statusColor = isLive
    ? theme.colors.accent
    : isDone
      ? theme.colors.text.tertiary
      : theme.colors.text.secondary;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: 200, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Map hero */}
        <Pressable onPress={openInMaps} style={{ marginBottom: 18 }}>
          {getStaticMapUrl() ? (
            <Image
              source={{ uri: getStaticMapUrl() }}
              style={{
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                borderRadius: theme.radii.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: MAP_WIDTH,
                height: MAP_HEIGHT,
                borderRadius: theme.radii.card,
                backgroundColor: theme.colors.surface.card,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 22 C 5 14 3 10 3 7 a 9 9 0 0 1 18 0 c 0 3 -2 7 -9 15 Z M12 10 a 2 2 0 1 0 0 -4 a 2 2 0 0 0 0 4 Z"
                  stroke={theme.colors.text.tertiary}
                  strokeWidth={1.4}
                  fill="none"
                />
              </Svg>
              <Text style={{ marginTop: 10, color: theme.colors.text.tertiary, fontSize: 12 }}>
                Map unavailable
              </Text>
            </View>
          )}
          {/* Distance chip */}
          {distanceToVenue !== null ? (
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: distanceToVenue <= 100
                  ? 'rgba(74,222,128,0.9)'
                  : theme.isDark ? 'rgba(11,11,14,0.72)' : 'rgba(255,255,255,0.82)',
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
              }}
            >
              <AccentDot size={6} color={distanceToVenue <= 100 ? '#0b0b0e' : theme.colors.accent} />
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.6,
                  textTransform: 'uppercase',
                  color: distanceToVenue <= 100 ? '#0b0b0e' : theme.colors.text.primary,
                  fontWeight: '500',
                }}
              >
                {distanceToVenue <= 100 ? `On site · ${distanceToVenue}m` : `${distanceToVenue}m away`}
              </Text>
            </View>
          ) : null}
          {/* Tap-to-open hint */}
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: theme.isDark ? 'rgba(11,11,14,0.72)' : 'rgba(255,255,255,0.82)',
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
            }}
          >
            <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <Path d="M3 11 L21 3 L13 21 L11 13 Z" stroke={theme.colors.text.primary} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
            </Svg>
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: theme.colors.text.primary,
                fontWeight: '500',
              }}
            >
              Open in maps
            </Text>
          </View>
        </Pressable>

        {/* Status pill + Eyebrow */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: isLive ? theme.colors.accentSoft : theme.colors.surface.chip,
              borderWidth: 1,
              borderColor: isLive ? theme.colors.accentBorder : theme.colors.surface.hairline,
            }}
          >
            {isLive ? <AccentDot size={6} pulse /> : null}
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: theme.fonts.mono,
                fontSize: 9,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: statusColor,
                fontWeight: '500',
              }}
            >
              {statusLabel}
            </Text>
          </View>
          {shift.sync_status !== 'synced' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: theme.colors.surface.chip,
                borderWidth: 1,
                borderColor: theme.colors.surface.hairline,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: theme.fonts.mono,
                  fontSize: 9,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: theme.colors.text.secondary,
                }}
              >
                {shift.sync_status === 'failed' ? 'Sync failed' : 'Pending sync'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Venue heading */}
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 32,
            fontWeight: '400',
            letterSpacing: -0.8,
            color: theme.colors.text.primary,
            lineHeight: 36,
          }}
        >
          {shift.venue.name}
        </Text>
        {shift.venue.address ? (
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 6,
              fontSize: 14,
              color: theme.colors.text.secondary,
              lineHeight: 20,
            }}
          >
            {shift.venue.address}
          </Text>
        ) : null}

        {/* Date card */}
        <View style={{ marginTop: 18, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <View
            style={{
              width: 56,
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.surface.card,
              borderWidth: 1,
              borderColor: theme.colors.surface.hairline,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text
              allowFontScaling={false}
              style={{ fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.text.secondary, letterSpacing: 1.8 }}
            >
              {dayAbbr}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 22, color: theme.colors.text.primary, fontWeight: '400', letterSpacing: -0.6, marginTop: 1 }}
            >
              {dateNum}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.text.tertiary, letterSpacing: 1.6, marginTop: 1 }}
            >
              {monthAbbr}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}
            >
              {formatShiftDateLine(shift.start_time)}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ marginTop: 4, fontSize: 13, color: theme.colors.text.secondary }}
            >
              {formatClockTime(shift.start_time)} — {formatClockTime(shift.end_time)} · {formatDuration(shift.start_time, shift.end_time)}
            </Text>
          </View>
        </View>

        {/* Role card */}
        {shift.required_security_role ? (
          <GlassCard style={{ marginTop: 14 }}>
            <Eyebrow>Role</Eyebrow>
            <Text
              allowFontScaling={false}
              style={{ marginTop: 6, fontSize: 16, color: theme.colors.text.primary, fontWeight: '500' }}
            >
              {shift.required_security_role}
            </Text>
            {shift.hourly_rate != null ? (
              <Text
                allowFontScaling={false}
                style={{ marginTop: 4, fontSize: 13, color: theme.colors.text.secondary }}
              >
                £{Number(shift.hourly_rate).toFixed(2)} / hour
              </Text>
            ) : null}
          </GlassCard>
        ) : null}

        {/* Transfer/Release status */}
        {shift.pending_exchange || shift.pending_release ? (
          <TransferBannerV2 shift={shift} onCancel={handleCancelTransfer} />
        ) : null}

        {/* Team (multi-staff) */}
        {shift.coworkers && shift.coworkers.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Your team</Eyebrow>
            <GlassCard pad={0}>
              {shift.coworkers.map((c, idx) => {
                const statusColor = c.check_out_time
                  ? theme.colors.text.tertiary
                  : c.check_in_time
                    ? theme.colors.accent
                    : theme.colors.text.tertiary;
                const statusText = c.check_out_time
                  ? 'Completed'
                  : c.check_in_time
                    ? 'Checked in'
                    : 'Scheduled';
                return (
                  <View
                    key={c.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 14,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: theme.colors.surface.hairline,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: theme.colors.surface.chip,
                        borderWidth: 1,
                        borderColor: theme.colors.surface.hairline,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: theme.colors.text.primary, fontSize: 13, fontWeight: '500' }}>
                        {(c.first_name?.charAt(0) ?? '') + (c.last_name?.charAt(0) ?? '')}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}>
                        {c.first_name} {c.last_name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                        <Text
                          allowFontScaling={false}
                          style={{
                            fontFamily: theme.fonts.mono,
                            fontSize: 9,
                            color: statusColor,
                            letterSpacing: 1.6,
                            textTransform: 'uppercase',
                          }}
                        >
                          {statusText}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </View>
        ) : null}

        {/* Venue checks */}
        {shift.venue.requires_fire_exit_check || shift.venue.requires_capacity_check || shift.venue.requires_id_scan ? (
          <View style={{ marginTop: 18 }}>
            <Eyebrow style={{ marginLeft: 4, marginBottom: 10 }}>Venue checks</Eyebrow>
            <GlassCard pad={0}>
              {shift.venue.requires_fire_exit_check ? (
                <CheckRow label="Fire exit check" sub="Verify all fire exits are accessible" first />
              ) : null}
              {shift.venue.requires_capacity_check ? (
                <CheckRow
                  label="Capacity check"
                  sub="Monitor and report venue capacity"
                  first={!shift.venue.requires_fire_exit_check}
                />
              ) : null}
              {shift.venue.requires_id_scan ? (
                <CheckRow
                  label="ID scanning"
                  sub="Scan and verify guest identification"
                  first={!shift.venue.requires_fire_exit_check && !shift.venue.requires_capacity_check}
                />
              ) : null}
            </GlassCard>
          </View>
        ) : null}
      </ScrollView>

      {/* Close button (floats top-left) */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={[
          styles.closeBtn,
          {
            top: insets.top + 12,
            backgroundColor: theme.colors.surface.chip,
            borderColor: theme.colors.surface.hairline,
          },
        ]}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M5 5L19 19M19 5L5 19" stroke={theme.colors.text.primary} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Pressable>

      {/* Footer with actions */}
      <LinearGradient
        colors={[
          theme.isDark ? 'rgba(11,11,14,0)' : 'rgba(246,245,241,0)',
          theme.colors.canvas,
          theme.colors.canvas,
        ]}
        locations={[0, 0.35, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingTop: 30,
          paddingBottom: Math.max(18, insets.bottom + 10),
        }}
        pointerEvents="box-none"
      >
        {/* Admin secondary actions */}
        {isManager && (shift.status === 'pending_approval' || shift.status === 'scheduled' || (shift.status as any) === 'open') ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {shift.status === 'pending_approval' ? (
              <>
                <SecondaryAction
                  label="Approve"
                  disabled={isAdminMutating}
                  onPress={() => {
                    const managerName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Manager';
                    const sig = `Approved by ${managerName} at ${new Date().toISOString()}`;
                    Alert.alert('Approve shift', 'Your name and the current time will be recorded.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Approve',
                        onPress: async () => {
                          try {
                            await dispatch(approveShiftThunk({ shiftId: shift.id, approved: true, managerSignature: sig })).unwrap();
                            Alert.alert('Shift approved', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                          } catch (err: any) {
                            Alert.alert('Failed to approve', typeof err === 'string' ? err : 'Please try again.');
                          }
                        },
                      },
                    ]);
                  }}
                />
                <SecondaryAction
                  label="Reject"
                  danger
                  disabled={isAdminMutating}
                  onPress={() => {
                    Alert.alert('Reject shift', 'Staff will be notified.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reject',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await dispatch(approveShiftThunk({ shiftId: shift.id, approved: false })).unwrap();
                            Alert.alert('Shift rejected', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                          } catch (err: any) {
                            Alert.alert('Failed to reject', typeof err === 'string' ? err : 'Please try again.');
                          }
                        },
                      },
                    ]);
                  }}
                />
              </>
            ) : (
              <>
                <SecondaryAction
                  label="Reschedule"
                  disabled={isAdminMutating}
                  onPress={() => navigation.navigate('EditShift', { shiftId: shift.id })}
                />
                <SecondaryAction
                  label="Cancel"
                  danger
                  disabled={isAdminMutating}
                  onPress={() => {
                    Alert.alert('Cancel shift', 'This removes the shift from the assigned staff member\'s schedule.', [
                      { text: 'Keep shift', style: 'cancel' },
                      {
                        text: 'Cancel shift',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await dispatch(cancelShiftThunk(shift.id)).unwrap();
                            Alert.alert('Shift cancelled', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                          } catch (err: any) {
                            Alert.alert('Failed to cancel', typeof err === 'string' ? err : 'Please try again.');
                          }
                        },
                      },
                    ]);
                  }}
                />
              </>
            )}
          </View>
        ) : null}

        {/* Staff transfer/release row */}
        {canTransferOrRelease() ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <SecondaryAction label="Transfer" onPress={() => setShowTransferModal(true)} />
            <SecondaryAction label="Release" onPress={() => setShowReleaseModal(true)} />
            <SecondaryAction
              label="Cancel"
              danger
              onPress={() =>
                Alert.alert('Cancel shift', 'Are you sure you want to cancel this shift?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes, cancel',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await shiftsService.cancelShift(shift.id);
                        Alert.alert('Cancelled', 'Your manager will be notified.', [
                          { text: 'OK', onPress: () => navigation.goBack() },
                        ]);
                      } catch (error: any) {
                        Alert.alert('Error', error?.message || 'Failed to cancel shift.');
                      }
                    },
                  },
                ])
              }
            />
          </View>
        ) : null}

        {/* Primary CTA */}
        {shift.status === 'scheduled' && canCheckIn() ? (
          <PrimaryCTA label="Check in · Start shift" onPress={handleCheckIn} />
        ) : shift.status === 'in_progress' ? (
          <PrimaryCTA label="End shift · Check out" onPress={handleCheckOut} />
        ) : isDone ? (
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.secondaryCTA,
              {
                backgroundColor: theme.colors.surface.chip,
                borderColor: theme.colors.surface.hairline,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={{
                color: theme.colors.text.primary,
                fontSize: 15,
                fontWeight: '500',
                letterSpacing: -0.2,
              }}
            >
              Close
            </Text>
          </Pressable>
        ) : null}
      </LinearGradient>

      {/* Modals */}
      <CameraModal
        visible={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onPhotoTaken={handlePhotoTaken}
        title={isCheckingOut ? 'Check-out venue photo' : 'Venue entrance photo'}
        tips={
          isCheckingOut
            ? ['Capture final view of venue', 'Show venue is secure', 'Ensure good lighting']
            : ['Show the venue entrance clearly', 'Include any venue signage', 'Ensure good lighting']
        }
      />
      <SignatureModal
        visible={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSignatureConfirmed={handleSignatureConfirmed}
        title={isCheckingOut ? 'Check-out signature' : 'Check-in signature'}
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
      <TransferShiftModal
        visible={showTransferModal}
        shift={shift}
        onClose={() => setShowTransferModal(false)}
        onSuccess={async () => {
          try {
            const resp = await shiftsService.fetchShifts({ page: 1, pageSize: 100 });
            const updated = resp.results.find((s) => s.id === shift.id);
            if (updated) setShift(updated);
          } catch (e) {
            logger.error('[ShiftDetailsV2] refresh after transfer', e);
          }
        }}
      />
      <ReleaseShiftModal
        visible={showReleaseModal}
        shift={shift}
        onClose={() => setShowReleaseModal(false)}
        onSuccess={async () => {
          try {
            const resp = await shiftsService.fetchShifts({ page: 1, pageSize: 100 });
            const updated = resp.results.find((s) => s.id === shift.id);
            if (updated) setShift(updated);
          } catch (e) {
            logger.error('[ShiftDetailsV2] refresh after release', e);
          }
        }}
      />
    </View>
  );
};

// ─── Subcomponents ───────────────────────────────────────────
const CheckRow: React.FC<{ label: string; sub: string; first?: boolean }> = ({ label, sub, first }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.surface.hairline,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: theme.colors.accentSoft,
          borderWidth: 1,
          borderColor: theme.colors.accentBorder,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12l5 5 9-11" stroke={theme.colors.accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500', letterSpacing: -0.2 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 2 }}>
          {sub}
        </Text>
      </View>
    </View>
  );
};

const SecondaryAction: React.FC<{
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}> = ({ label, danger, disabled, onPress }) => {
  const theme = useRedesignTheme();
  const color = danger ? theme.colors.accent : theme.colors.text.primary;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        borderRadius: theme.radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface.chip,
        borderWidth: 1,
        borderColor: danger ? theme.colors.accentBorder : theme.colors.surface.hairline,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const TransferBannerV2: React.FC<{ shift: Shift; onCancel: () => void }> = ({ shift, onCancel }) => {
  const theme = useRedesignTheme();
  const ex = shift.pending_exchange;
  const rel = shift.pending_release;
  const title = ex ? 'Transfer pending' : rel ? 'Released to pool' : 'Transfer';
  const target = ex?.target_user ? `${ex.target_user.first_name} ${ex.target_user.last_name}` : null;
  const createdAt = (ex?.created_at || rel?.created_at) ? new Date(ex?.created_at || rel!.created_at) : null;
  return (
    <View style={{ marginTop: 14 }}>
      <GlassCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <AccentDot size={7} pulse />
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: theme.colors.accent,
            }}
          >
            {title}
          </Text>
        </View>
        {target ? (
          <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}>
            To {target}
          </Text>
        ) : null}
        {createdAt ? (
          <Text style={{ fontSize: 12, color: theme.colors.text.secondary, marginTop: 4 }}>
            Requested {createdAt.toLocaleDateString()} · Tap cancel below if no longer needed
          </Text>
        ) : null}
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => ({
            marginTop: 12,
            paddingVertical: 10,
            borderRadius: theme.radii.lg,
            alignItems: 'center',
            backgroundColor: theme.colors.surface.chip,
            borderWidth: 1,
            borderColor: theme.colors.accentBorder,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 10,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: theme.colors.accent,
              fontWeight: '500',
            }}
          >
            Cancel transfer
          </Text>
        </Pressable>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  closeBtn: {
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
  secondaryCTA: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ShiftDetailsScreenV2;
