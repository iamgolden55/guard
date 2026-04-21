/**
 * CheckInFlowV2
 *
 * Visual re-skin of CheckInFlowScreen in the redesigned language.
 * Business logic (state machine, location/photo/signature, offline sync)
 * is preserved 1:1 — only the UI chrome changes.
 *
 * Design step mapping:
 *   - location_check   → V2 Locate (radar + assignment card)
 *   - venue_terms      → V2 Terms  (re-skinned)
 *   - camera           → existing CameraView (full-screen camera UI)
 *   - photo_preview    → V2 Confirm (summary + consent + "Clock on")
 *   - signature        → existing SignatureCanvas (full-screen signature)
 *   - processing       → V2 Processing
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Line, Path, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useRedesignTheme } from '../../../theme/redesign';
import {
  Eyebrow,
  GlassCard,
  AccentDot,
  AmbientGlow,
  NavBack,
  StepPill,
  PrimaryCTA,
} from '../../../components/redesign';
import { CameraView } from '../../../components/camera';
import { SignatureCanvas } from '../../../components/signature';
import { locationService, type LocationCoordinates } from '../../../services/locationService';
import { photoService } from '../../../services/photoService';
import { syncService } from '../../../services/syncService';
import { database } from '../../../services/database';
import { venueService } from '../../../services/venueService';
import { logger } from '../../../utils/logger';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { ApiError, ApiTimeoutError, NetworkError } from '../../../services/api';
import { ERROR_MESSAGES } from '../../../utils/constants';
import type { MainStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

type FlowStep =
  | 'location_check'
  | 'venue_terms'
  | 'camera'
  | 'photo_preview'
  | 'signature'
  | 'processing';

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
      shiftRole?: string;
      shiftStart?: string;
      shiftEnd?: string;
    };
  };
}

export const CheckInFlowV2: React.FC<CheckInFlowScreenProps> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { isOnline } = useNetworkStatus();
  const {
    shiftId,
    venueId,
    venueName,
    venueLatitude,
    venueLongitude,
    requiresTerms,
    venueTerms,
    shiftRole = 'Door supervisor',
    shiftStart,
    shiftEnd,
  } = route.params;

  const [currentStep, setCurrentStep] = useState<FlowStep>('location_check');
  const [isVerifying, setIsVerifying] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [locationDistance, setLocationDistance] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [optimizedPhotoUri, setOptimizedPhotoUri] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [loadedVenueTerms, setLoadedVenueTerms] = useState<string | null>(null);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);

  // ── Step 1: Locate ──
  const handleLocationCheck = async () => {
    setIsVerifying(true);
    try {
      const result = await locationService.verifyLocation(
        { latitude: venueLatitude, longitude: venueLongitude },
        100,
      );

      if (!result || typeof result.success === 'undefined') {
        Alert.alert('Location Error', 'Unable to verify your location. Please try again.', [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', onPress: handleLocationCheck },
        ]);
        return;
      }

      if (result.success && result.currentLocation) {
        setLocation(result.currentLocation);
        setLocationDistance(result.distance ?? null);
        setLocationVerified(true);
      } else {
        Alert.alert('Location Verification Failed', result.error || 'You must be at the venue to check in', [
          { text: 'Cancel', onPress: () => navigation.goBack() },
          { text: 'Try Again', onPress: handleLocationCheck },
        ]);
      }
    } catch (error: any) {
      logger.error('[CheckInFlowV2] Location verification error', { error });
      if (error instanceof ApiTimeoutError) {
        Alert.alert('Timeout', ERROR_MESSAGES.TIMEOUT_ERROR);
      } else if (error instanceof NetworkError) {
        Alert.alert('Network Error', ERROR_MESSAGES.NETWORK_ERROR);
      } else if (error instanceof ApiError) {
        Alert.alert('Server Error', error.statusText);
      } else {
        Alert.alert('Error', 'Failed to verify location. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-trigger location verification when screen mounts
  useEffect(() => {
    if (currentStep === 'location_check' && !locationVerified && !isVerifying) {
      handleLocationCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const advanceFromLocate = async () => {
    if (requiresTerms) {
      await loadVenueTerms();
      setCurrentStep('venue_terms');
    } else {
      setCurrentStep('camera');
    }
  };

  const loadVenueTerms = async () => {
    try {
      setIsLoadingTerms(true);
      const terms = await venueService.getVenueTerms(venueId);
      setLoadedVenueTerms(terms || venueTerms || null);
    } catch (error) {
      logger.error('[CheckInFlowV2] Failed to load venue terms', { error });
      setLoadedVenueTerms(venueTerms || null);
    } finally {
      setIsLoadingTerms(false);
    }
  };

  // ── Step 2: Terms ──
  const handleTermsAccept = () => setCurrentStep('camera');

  // ── Step 3: Photo ──
  const handlePhotoCapture = (uri: string) => {
    setPhotoUri(uri);
    setCurrentStep('photo_preview');
  };

  const handlePhotoConfirm = async () => {
    if (!photoUri) return;
    try {
      setIsOptimizing(true);
      const optimized = await photoService.optimizePhoto(photoUri);
      setOptimizedPhotoUri(optimized.uri);
      setCurrentStep('signature');
    } catch (error) {
      logger.error('[CheckInFlowV2] Photo optimization error', { error });
      Alert.alert('Error', 'Failed to process photo. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handlePhotoRetake = () => {
    setPhotoUri(null);
    setCurrentStep('camera');
  };

  // ── Step 4: Signature → processing ──
  const handleSignatureCapture = async (signatureData: string) => {
    setCurrentStep('processing');
    await processCheckIn(signatureData);
  };

  const processCheckIn = async (signatureData: string) => {
    try {
      if (!location || !optimizedPhotoUri) throw new Error('Missing required data');

      const removedCount = await database.removeSyncQueueItemsForShift(shiftId, ['check_in']);
      if (removedCount > 0) {
        logger.info('[CheckInFlowV2] Cleared stale check_in entries from sync queue', { removedCount });
      }

      await database.updateShift(shiftId, {
        status: 'in_progress',
        actual_start_time: new Date().toISOString(),
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        check_in_photo: optimizedPhotoUri,
        check_in_signature: signatureData,
        sync_status: 'pending',
      });

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
        priority: 1,
      });

      if (isOnline) syncService.startSync();

      Alert.alert(
        'Check-In Successful',
        isOnline
          ? 'You have successfully checked in to your shift.'
          : 'You have successfully checked in. Data will sync when online.',
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Tabs' } as never],
              }),
          },
        ],
      );
    } catch (error) {
      logger.error('[CheckInFlowV2] Process check-in error', { error });
      Alert.alert('Check-In Failed', 'Failed to complete check-in. Please try again.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  // ── Render the current step ──
  switch (currentStep) {
    case 'location_check':
      return (
        <LocateStep
          venueName={venueName}
          shiftRole={shiftRole}
          shiftStart={shiftStart}
          shiftEnd={shiftEnd}
          isVerifying={isVerifying}
          locationVerified={locationVerified}
          locationDistance={locationDistance}
          onContinue={advanceFromLocate}
          onBack={() => navigation.goBack()}
          onRetry={handleLocationCheck}
        />
      );

    case 'venue_terms':
      return (
        <TermsStep
          terms={loadedVenueTerms}
          isLoading={isLoadingTerms}
          onAccept={handleTermsAccept}
          onBack={() => setCurrentStep('location_check')}
        />
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
      return (
        <ConfirmStep
          photoUri={photoUri}
          venueName={venueName}
          shiftRole={shiftRole}
          shiftStart={shiftStart}
          shiftEnd={shiftEnd}
          locationDistance={locationDistance}
          isOptimizing={isOptimizing}
          onConfirm={handlePhotoConfirm}
          onRetake={handlePhotoRetake}
          onBack={() => setCurrentStep('camera')}
        />
      );

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
      return <ProcessingStep />;

    default:
      return null;
  }
};

// ═════════════════════════════════════════════════════════════
// Step 1 — Locate
// ═════════════════════════════════════════════════════════════
interface LocateStepProps {
  venueName: string;
  shiftRole: string;
  shiftStart?: string;
  shiftEnd?: string;
  isVerifying: boolean;
  locationVerified: boolean;
  locationDistance: number | null;
  onContinue: () => void;
  onBack: () => void;
  onRetry: () => void;
}

const LocateStep: React.FC<LocateStepProps> = ({
  venueName,
  shiftRole,
  shiftStart,
  shiftEnd,
  isVerifying,
  locationVerified,
  locationDistance,
  onContinue,
  onBack,
}) => {
  const theme = useRedesignTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[stepStyles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Ambient glow behind radar */}
      <View pointerEvents="none" style={stepStyles.centerAmbient}>
        <AmbientGlow size={520} intensity={0.3} />
      </View>

      <View style={[stepStyles.topBar, { paddingTop: 12 }]}>
        <NavBack onPress={onBack} />
        <StepPill>Step 1 / 3 · Locate</StepPill>
      </View>

      {/* Radar */}
      <View style={stepStyles.radarWrap}>
        <Radar active={isVerifying || locationVerified} accent={theme.colors.accent} isDark={theme.isDark} />
      </View>

      {/* Copy */}
      <View style={stepStyles.locateCopy}>
        <Eyebrow color={locationVerified ? theme.colors.accent : theme.colors.text.secondary}>
          {locationVerified ? 'Location verified' : isVerifying ? 'Locating…' : 'Tap continue to start'}
        </Eyebrow>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 26,
            fontWeight: '400',
            color: theme.colors.text.primary,
            letterSpacing: -0.8,
            lineHeight: 32,
            marginTop: 10,
            textAlign: 'center',
            fontFamily: theme.fonts.sans,
          }}
        >
          {locationVerified
            ? `You're inside the\n${venueName} perimeter.`
            : `Confirming you're at\n${venueName}.`}
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            fontSize: 12,
            color: theme.colors.text.secondary,
            marginTop: 10,
            fontFamily: theme.fonts.mono,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {locationDistance != null
            ? `${Math.round(locationDistance)}m from post · Geofence 100m`
            : 'GPS · Geofence 100m'}
        </Text>
      </View>

      {/* Assignment card */}
      <View style={[stepStyles.locateCard, { bottom: 148 + insets.bottom }]}>
        <GlassCard pad={16}>
          <View style={stepStyles.rowBetween}>
            <Eyebrow color={theme.colors.text.secondary}>Today's post</Eyebrow>
            <Eyebrow color={theme.colors.text.secondary}>{formatTimeRange(shiftStart, shiftEnd)}</Eyebrow>
          </View>
          <View style={stepStyles.assignmentRow}>
            <AssignmentCol label="Venue" value={venueName} />
            <AssignmentCol label="Role" value={shiftRole} />
            <AssignmentCol label="Support" value="Ops desk" />
          </View>
        </GlassCard>
      </View>

      {/* CTA */}
      <View style={[stepStyles.ctaWrap, { bottom: 40 + insets.bottom }]}>
        <PrimaryCTA
          label={locationVerified ? 'Continue' : isVerifying ? 'Locating…' : 'Verify location'}
          disabled={isVerifying || !locationVerified}
          onPress={onContinue}
        />
      </View>
    </View>
  );
};

const AssignmentCol: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useRedesignTheme();
  return (
    <View style={{ flex: 1 }}>
      <Eyebrow size={10} tracking={1.4} color={theme.colors.text.tertiary}>
        {label}
      </Eyebrow>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: '500',
          color: theme.colors.text.primary,
          letterSpacing: -0.15,
          fontFamily: theme.fonts.sans,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Animated radar
// ─────────────────────────────────────────────────────────────
interface RadarProps {
  active: boolean;
  accent: string;
  isDark: boolean;
}

const Radar: React.FC<RadarProps> = ({ active, accent, isDark }) => {
  const sweep = useRef(new Animated.Value(0)).current;
  const ping1 = useRef(new Animated.Value(0)).current;
  const ping2 = useRef(new Animated.Value(0)).current;
  const ping3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const loops: Animated.CompositeAnimation[] = [];

    loops.push(
      Animated.loop(
        Animated.timing(sweep, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );

    [ping1, ping2, ping3].forEach((v, i) => {
      loops.push(
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 1000),
            Animated.timing(v, {
              toValue: 1,
              duration: 3000,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(v, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ),
      );
    });

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, sweep, ping1, ping2, ping3]);

  const rotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const ringStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(11,11,14,0.08)';
  const crossStroke = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(11,11,14,0.04)';

  const ping = (v: Animated.Value) => ({
    transform: [
      {
        scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.2] }),
      },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
  });

  return (
    <View style={{ width: 260, height: 260 }}>
      {/* Static rings */}
      <Svg width={260} height={260} viewBox="0 0 260 260" style={{ position: 'absolute' }}>
        <Circle cx="130" cy="130" r="120" stroke={ringStroke} strokeWidth="1" fill="none" />
        <Circle cx="130" cy="130" r="84" stroke={ringStroke} strokeWidth="1" fill="none" />
        <Circle cx="130" cy="130" r="48" stroke={ringStroke} strokeWidth="1" fill="none" />
        <Line x1="130" y1="10" x2="130" y2="250" stroke={crossStroke} />
        <Line x1="10" y1="130" x2="250" y2="130" stroke={crossStroke} />
      </Svg>

      {/* Pings */}
      {[ping1, ping2, ping3].map((v, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 10,
              top: 10,
              width: 240,
              height: 240,
              borderRadius: 120,
              borderWidth: 1,
              borderColor: accent,
            },
            ping(v),
          ]}
        />
      ))}

      {/* Sweep */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0 as any,
          width: 260,
          height: 260,
          transform: [{ rotate }],
        }}
      >
        <Svg width={260} height={260} viewBox="0 0 260 260">
          <Defs>
            <SvgLinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={accent} stopOpacity="0" />
              <Stop offset="100%" stopColor={accent} stopOpacity="0.45" />
            </SvgLinearGradient>
          </Defs>
          <Path d="M130 130 L130 10 A 120 120 0 0 1 250 130 Z" fill="url(#sweep)" />
        </Svg>
      </Animated.View>

      {/* Center pin */}
      <View
        style={{
          position: 'absolute',
          left: 116,
          top: 116,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: accent,
          borderWidth: 3,
          borderColor: isDark ? '#0b0b0e' : '#f6f5f1',
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 16,
          elevation: 10,
        }}
      />

      {/* Nearby dot */}
      <View
        style={{
          position: 'absolute',
          left: 194,
          top: 96,
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(11,11,14,0.5)',
        }}
      />
    </View>
  );
};

// ═════════════════════════════════════════════════════════════
// Step 2 — Terms (re-skinned)
// ═════════════════════════════════════════════════════════════
interface TermsStepProps {
  terms: string | null;
  isLoading: boolean;
  onAccept: () => void;
  onBack: () => void;
}

const TermsStep: React.FC<TermsStepProps> = ({ terms, isLoading, onAccept, onBack }) => {
  const theme = useRedesignTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[stepStyles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View style={[stepStyles.topBar, { paddingTop: 12 }]}>
        <NavBack onPress={onBack} />
        <StepPill>Venue terms</StepPill>
      </View>

      <View style={{ paddingHorizontal: 28, paddingTop: 48 }}>
        <Eyebrow color={theme.colors.accent}>Venue policy</Eyebrow>
        <Text
          allowFontScaling={false}
          style={{
            marginTop: 12,
            fontSize: 28,
            fontWeight: '400',
            letterSpacing: -0.7,
            color: theme.colors.text.primary,
            fontFamily: theme.fonts.sans,
          }}
        >
          Review before continuing.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: 24 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard pad={18}>
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : (
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 14,
                lineHeight: 22,
                color: theme.colors.text.secondary,
                fontFamily: theme.fonts.sans,
              }}
            >
              {terms ?? 'No specific terms provided for this venue. Tap Continue to proceed.'}
            </Text>
          )}
        </GlassCard>
      </ScrollView>

      <View style={[stepStyles.ctaWrap, { bottom: 40 + insets.bottom }]}>
        <PrimaryCTA label={terms ? 'Accept & continue' : 'Continue'} onPress={onAccept} disabled={isLoading} />
      </View>
    </View>
  );
};

// ═════════════════════════════════════════════════════════════
// Step 3 — Confirm (formerly photo_preview)
// ═════════════════════════════════════════════════════════════
interface ConfirmStepProps {
  photoUri: string | null;
  venueName: string;
  shiftRole: string;
  shiftStart?: string;
  shiftEnd?: string;
  locationDistance: number | null;
  isOptimizing: boolean;
  onConfirm: () => void;
  onRetake: () => void;
  onBack: () => void;
}

const ConfirmStep: React.FC<ConfirmStepProps> = ({
  photoUri,
  venueName,
  shiftRole,
  shiftStart,
  shiftEnd,
  locationDistance,
  isOptimizing,
  onConfirm,
  onRetake,
  onBack,
}) => {
  const theme = useRedesignTheme();
  const insets = useSafeAreaInsets();

  const rows: Array<[string, string]> = [
    ['Venue', venueName],
    ['Shift', formatTimeRange(shiftStart, shiftEnd) || 'Today'],
    ['Role', shiftRole],
    ['Location', locationDistance != null ? `${Math.round(locationDistance)}m from post` : 'Verified'],
    ['Time now', formatClockNow()],
  ];

  return (
    <View style={[stepStyles.root, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      {/* Ambient glow */}
      <View pointerEvents="none" style={stepStyles.centerAmbient}>
        <AmbientGlow size={360} intensity={0.28} />
      </View>

      <View style={[stepStyles.topBar, { paddingTop: 12 }]}>
        <NavBack onPress={onBack} />
        <StepPill>Step 3 / 3 · Confirm</StepPill>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 220 + insets.bottom, paddingTop: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 28 }}>
          <Eyebrow color={theme.colors.accent}>Ready to start</Eyebrow>
          <Text
            allowFontScaling={false}
            style={{
              marginTop: 12,
              fontSize: 30,
              fontWeight: '400',
              letterSpacing: -0.7,
              lineHeight: 36,
              color: theme.colors.text.primary,
              fontFamily: theme.fonts.sans,
            }}
          >
            Review before you{'\n'}clock on.
          </Text>
        </View>

        <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
          <GlassCard pad={0} style={{ overflow: 'hidden' }}>
            {/* Photo strip */}
            <View style={confirmStyles.photoStrip}>
              <PhotoThumbnail uri={photoUri} isDark={theme.isDark} accent={theme.colors.accent} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 17,
                    fontWeight: '500',
                    letterSpacing: -0.3,
                    color: theme.colors.text.primary,
                    fontFamily: theme.fonts.sans,
                  }}
                >
                  You
                </Text>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 12,
                    color: theme.colors.text.secondary,
                    marginTop: 2,
                    fontFamily: theme.fonts.mono,
                    letterSpacing: 0.8,
                  }}
                >
                  Check-in photo · just now
                </Text>
                <View
                  style={[
                    confirmStyles.passBadge,
                    {
                      backgroundColor: theme.colors.accentSoft,
                      borderColor: theme.colors.accentBorder,
                    },
                  ]}
                >
                  <AccentDot size={5} />
                  <Text
                    allowFontScaling={false}
                    style={{
                      fontFamily: theme.fonts.mono,
                      fontSize: 9,
                      color: theme.colors.text.primary,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                      marginLeft: 6,
                    }}
                  >
                    All checks passed
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onRetake}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Eyebrow size={10} tracking={1.6} color={theme.colors.text.secondary}>
                  Retake
                </Eyebrow>
              </Pressable>
            </View>

            <View style={{ height: 1, backgroundColor: theme.divider }} />

            {rows.map((row, i) => (
              <View
                key={row[0]}
                style={[
                  confirmStyles.row,
                  i < rows.length - 1 ? { borderBottomColor: theme.divider, borderBottomWidth: 1 } : null,
                ]}
              >
                <Eyebrow size={10} tracking={1.8} color={theme.colors.text.tertiary}>
                  {row[0]}
                </Eyebrow>
                <Text
                  allowFontScaling={false}
                  style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: theme.colors.text.primary,
                    letterSpacing: -0.15,
                    fontFamily: theme.fonts.sans,
                    flexShrink: 1,
                    textAlign: 'right',
                    marginLeft: 12,
                  }}
                  numberOfLines={1}
                >
                  {row[1]}
                </Text>
              </View>
            ))}
          </GlassCard>
        </View>

        <View style={confirmStyles.consentRow}>
          <View
            style={[
              confirmStyles.consentBox,
              { backgroundColor: theme.colors.accent },
            ]}
          >
            <Svg width={10} height={10} viewBox="0 0 12 12">
              <Path
                d="M2 6 L5 9 L10 3"
                stroke="#fff"
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text
            allowFontScaling={false}
            style={{
              flex: 1,
              marginLeft: 10,
              fontSize: 12,
              color: theme.colors.text.secondary,
              lineHeight: 18,
              fontFamily: theme.fonts.sans,
            }}
          >
            I confirm I'm fit for duty, in uniform and at the assigned post. Time starts when I tap Clock on.
          </Text>
        </View>
      </ScrollView>

      <View style={[stepStyles.ctaWrap, { bottom: 40 + insets.bottom }]}>
        <PrimaryCTA
          label={isOptimizing ? 'Preparing…' : 'Clock on · Start shift'}
          disabled={isOptimizing}
          onPress={onConfirm}
        />
      </View>
    </View>
  );
};

// Photo thumbnail (image if available, placeholder silhouette otherwise)
const PhotoThumbnail: React.FC<{ uri: string | null; isDark: boolean; accent: string }> = ({
  uri,
  isDark,
  accent,
}) => {
  const silhouetteFill = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(11,11,14,0.15)';

  return (
    <View
      style={{
        width: 72,
        height: 90,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(11,11,14,0.08)',
        overflow: 'hidden',
        backgroundColor: isDark ? '#1f1f22' : '#e8e7e2',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <View style={{ position: 'absolute', inset: 0 as any, width: 72, height: 90 }}>
          {/* eslint-disable-next-line @typescript-eslint/no-var-requires */}
          {React.createElement(require('react-native').Image, {
            source: { uri },
            style: { width: 72, height: 90, resizeMode: 'cover' },
          })}
        </View>
      ) : (
        <Svg width={44} height={56} viewBox="0 0 44 56">
          <Circle cx="22" cy="18" r="11" fill={silhouetteFill} />
          <Path d="M2 56 Q 2 32 22 32 Q 42 32 42 56 Z" fill={silhouetteFill} />
        </Svg>
      )}
      {/* Verified badge bottom-right */}
      <View
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: accent,
          borderWidth: 2,
          borderColor: isDark ? '#141417' : '#f6f5f1',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={8} height={8} viewBox="0 0 10 10">
          <Path
            d="M2 5 L4 7 L8 3"
            stroke="#fff"
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
};

// ═════════════════════════════════════════════════════════════
// Step — Processing
// ═════════════════════════════════════════════════════════════
const ProcessingStep: React.FC = () => {
  const theme = useRedesignTheme();
  const insets = useSafeAreaInsets();

  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View
      style={[
        stepStyles.root,
        {
          backgroundColor: theme.colors.canvas,
          paddingTop: insets.top,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View pointerEvents="none" style={stepStyles.centerAmbient}>
        <AmbientGlow size={420} intensity={0.32} />
      </View>

      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={48} height={48} viewBox="0 0 48 48">
          <Circle
            cx="24"
            cy="24"
            r="20"
            stroke={theme.colors.surface.hairlineStrong}
            strokeWidth="2"
            fill="none"
          />
          <Path
            d="M24 4 A 20 20 0 0 1 44 24"
            stroke={theme.colors.accent}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Eyebrow color={theme.colors.accent} style={{ marginTop: 24 }}>
        Clocking on
      </Eyebrow>
      <Text
        allowFontScaling={false}
        style={{
          marginTop: 12,
          fontSize: 22,
          fontWeight: '400',
          letterSpacing: -0.4,
          color: theme.colors.text.primary,
          fontFamily: theme.fonts.sans,
          textAlign: 'center',
        }}
      >
        Finalising your check-in…
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatTimeRange(start?: string | null, end?: string | null): string {
  const fmt = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  if (!start && !end) return '';
  return `${fmt(start)} — ${fmt(end)}`;
}

function formatClockNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Shared step styles
// ─────────────────────────────────────────────────────────────
const stepStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerAmbient: {
    position: 'absolute',
    left: '50%',
    top: '28%',
    marginLeft: -260,
    marginTop: -260,
    opacity: 0.85,
  },
  topBar: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radarWrap: {
    alignItems: 'center',
    marginTop: 60,
  },
  locateCopy: {
    marginTop: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  locateCard: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  ctaWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  assignmentRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 12,
  },
});

const confirmStyles = StyleSheet.create({
  photoStrip: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    alignItems: 'center',
  },
  passBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consentRow: {
    marginTop: 24,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  consentBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});

export default CheckInFlowV2;
