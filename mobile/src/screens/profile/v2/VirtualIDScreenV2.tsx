/**
 * VirtualIDScreenV2 — Branded Mead Security digital ID.
 *
 * Replicates the physical ID card: dark textured background, red "M" logo
 * in a bordered box, "MEAD SECURITY LIMITED" wordmark, diagonal red/green
 * accent stripes, user photo on the right, First + Last name, ID No and Exp.
 *
 * Preserves the original behavior: tap card to flip to QR, brightness boost
 * while QR is visible.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop, ClipPath } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import * as Brightness from 'expo-brightness';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';

import { RootState } from '../../../store';
import { logger } from '../../../utils/logger';
import { useRedesignTheme } from '../../../theme/redesign';
import { Eyebrow, GlassCard } from '../../../components/redesign';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 380);
const CARD_HEIGHT = Math.round(CARD_WIDTH / 1.586); // ISO/IEC 7810 ID-1 ratio
const CARD_RADIUS = 18;

const CARD_BG = '#0E0F10';
const CARD_BG_DEEP = '#050607';
const ACCENT_RED = '#E1342C';
const ACCENT_GREEN = '#0E6B33';

const formatExpiry = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
};

// ─────────────────────────────────────────────────────────────
// Mead "M" logo — uses the official LOGOM.png brand asset
// ─────────────────────────────────────────────────────────────
const MeadLogo: React.FC<{ size?: number }> = ({ size = 58 }) => (
  <Image
    source={require('../../../../assets/images/LOGOM.png')}
    style={{ width: size, height: size }}
    resizeMode="contain"
  />
);

// ─────────────────────────────────────────────────────────────
// Diagonal corner stripes (red + green)
// ─────────────────────────────────────────────────────────────
const CornerStripes: React.FC<{ corner: 'topRight' | 'bottomLeft' }> = ({ corner }) => {
  const isTopRight = corner === 'topRight';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: isTopRight ? 0 : undefined,
        right: isTopRight ? 0 : undefined,
        bottom: isTopRight ? undefined : 0,
        left: isTopRight ? undefined : 0,
        width: CARD_WIDTH * 0.55,
        height: CARD_HEIGHT * 0.55,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="cardClip">
            <Rect x={0} y={0} width={100} height={100} />
          </ClipPath>
        </Defs>
        {isTopRight ? (
          <>
            <Path d="M100 0 L60 0 L100 40 Z" fill={ACCENT_RED} opacity={0.95} />
            <Path d="M100 20 L78 0 L100 0 Z" fill={ACCENT_GREEN} opacity={0.95} />
            <Path d="M100 50 L70 0 L75 0 L100 45 Z" fill={ACCENT_GREEN} opacity={0.7} />
          </>
        ) : (
          <>
            <Path d="M0 100 L0 60 L40 100 Z" fill={ACCENT_RED} opacity={0.95} />
            <Path d="M0 80 L22 100 L0 100 Z" fill={ACCENT_GREEN} opacity={0.95} />
            <Path d="M0 50 L30 100 L25 100 L0 55 Z" fill={ACCENT_GREEN} opacity={0.7} />
          </>
        )}
      </Svg>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Mid accent line (thin red+green diagonal slash behind the text)
// ─────────────────────────────────────────────────────────────
const MidAccent: React.FC = () => (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute',
      top: CARD_HEIGHT * 0.42,
      left: 0,
      right: 0,
      height: 2,
      flexDirection: 'row',
    }}
  >
    <View style={{ flex: 1, height: 1.5, backgroundColor: ACCENT_RED, opacity: 0.9 }} />
    <View style={{ width: 40, height: 1.5, backgroundColor: ACCENT_GREEN, opacity: 0.9 }} />
  </View>
);

// ─────────────────────────────────────────────────────────────
// Texture (subtle noise-style dots via repeated rects in SVG)
// ─────────────────────────────────────────────────────────────
const CardTexture: React.FC = () => (
  <Svg
    width={CARD_WIDTH}
    height={CARD_HEIGHT}
    viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`}
    style={{ position: 'absolute', top: 0, left: 0 }}
    pointerEvents="none"
  >
    <Defs>
      <SvgLinearGradient id="cardBgFade" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={CARD_BG} stopOpacity={1} />
        <Stop offset="1" stopColor={CARD_BG_DEEP} stopOpacity={1} />
      </SvgLinearGradient>
    </Defs>
    <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill="url(#cardBgFade)" />
  </Svg>
);

// ─────────────────────────────────────────────────────────────
// Front face of card
// ─────────────────────────────────────────────────────────────
const FrontCard: React.FC<{
  firstName: string;
  lastName: string;
  idNumber?: string;
  expiry?: string;
  photo?: string | null;
}> = ({ firstName, lastName, idNumber, expiry, photo }) => {
  const initials = `${(firstName || '?').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase();

  return (
    <View style={[styles.cardBase, { backgroundColor: CARD_BG }]}>
      <CardTexture />

      {/* Decorative diagonal stripes */}
      <CornerStripes corner="topRight" />
      <CornerStripes corner="bottomLeft" />
      <MidAccent />

      {/* Header: logo + wordmark */}
      <View style={styles.headerRow}>
        <MeadLogo size={58} />
        <View style={{ marginLeft: 10, justifyContent: 'center' }}>
          <Text allowFontScaling={false} style={styles.wordmark}>MEAD</Text>
          <Text allowFontScaling={false} style={styles.wordmarkThin}>SECURITY</Text>
          <Text allowFontScaling={false} style={styles.wordmarkThin}>LIMITED</Text>
        </View>
      </View>

      {/* Photo on the right */}
      <View style={styles.photoBox}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photoImage} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text allowFontScaling={false} style={styles.photoInitials}>
              {initials || '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Name + ID/Exp labels */}
      <View style={styles.bottomStack}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={styles.nameText}
        >
          {firstName || 'First'} {lastName || 'Last'}
        </Text>
        <Text allowFontScaling={false} style={styles.metaLine}>
          <Text style={styles.metaLabel}>ID No: </Text>
          <Text style={styles.metaValue}>{idNumber || '—'}</Text>
        </Text>
        <Text allowFontScaling={false} style={styles.metaLine}>
          <Text style={styles.metaLabel}>Exp: </Text>
          <Text style={styles.metaValue}>{formatExpiry(expiry)}</Text>
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Back face (QR)
// ─────────────────────────────────────────────────────────────
const BackCard: React.FC<{ qrValue: string }> = ({ qrValue }) => {
  const qrSize = Math.min(CARD_HEIGHT * 0.78, CARD_WIDTH * 0.55);
  return (
    <View style={[styles.cardBase, { backgroundColor: CARD_BG }]}>
      <CardTexture />
      <CornerStripes corner="topRight" />
      <CornerStripes corner="bottomLeft" />

      <View style={styles.qrInner}>
        <View style={styles.qrFrame}>
          <QRCode
            value={qrValue}
            size={qrSize}
            backgroundColor="#ffffff"
            color="#0b0b0e"
          />
        </View>
        <Text allowFontScaling={false} style={styles.qrHint}>
          Scan to verify
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────
export const VirtualIDScreenV2: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useRedesignTheme();
  const user = useSelector((state: RootState) => state.auth.user);
  const profile: any = user?.staff_profile;

  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const prevBrightnessRef = useRef<number | null>(null);

  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [flipped, flipAnim]);

  useEffect(() => {
    if (!flipped) return;

    let cancelled = false;
    (async () => {
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted' && !cancelled) {
          prevBrightnessRef.current = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1);
        }
      } catch (error) {
        logger.error('[VirtualIDV2] brightness', error);
      }
    })();

    // Cleanup runs on flip-back AND on unmount (e.g. user navigates away
    // while the QR is showing) so the screen never exits at max brightness.
    return () => {
      cancelled = true;
      if (prevBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(prevBrightnessRef.current).catch(() => {});
        prevBrightnessRef.current = null;
      }
    };
  }, [flipped]);

  if (!user) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.canvas,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <Text style={{ color: theme.colors.text.primary, fontSize: 14 }}>
          Unable to load ID information
        </Text>
      </View>
    );
  }

  const firstName = user.first_name || 'Security';
  const lastName = user.last_name || 'Staff';
  const idNumber: string | undefined = profile?.sia_license_number;
  const expiry: string | undefined = profile?.sia_license_expiry;
  const photo: string | null | undefined = profile?.profile_image_url;
  const isLicenseValid = expiry ? new Date(expiry) > new Date() : false;

  const qrData = JSON.stringify({
    id: user.id,
    name: `${firstName} ${lastName}`,
    license: idNumber,
    expiry,
    verified: true,
    timestamp: new Date().toISOString(),
  });

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 90.1, 180],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 90.1, 180],
    outputRange: [0, 0, 1, 1],
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.canvas }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 72,
          paddingHorizontal: 20,
          paddingBottom: 40 + insets.bottom,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Card with flip */}
        <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT, marginBottom: 26 }}>
          <Animated.View
            style={[
              styles.cardFace,
              { opacity: frontOpacity, transform: [{ perspective: 1000 }, { rotateY: frontRotate }] },
            ]}
          >
            <Pressable onPress={() => setFlipped((f) => !f)} hitSlop={4}>
              <FrontCard
                firstName={firstName}
                lastName={lastName}
                idNumber={idNumber}
                expiry={expiry}
                photo={photo}
              />
            </Pressable>
          </Animated.View>
          <Animated.View
            style={[
              styles.cardFace,
              { opacity: backOpacity, transform: [{ perspective: 1000 }, { rotateY: backRotate }] },
            ]}
          >
            <Pressable onPress={() => setFlipped((f) => !f)} hitSlop={4}>
              <BackCard qrValue={qrData} />
            </Pressable>
          </Animated.View>
        </View>

        <Text
          allowFontScaling={false}
          style={{
            fontSize: 22,
            color: theme.colors.text.primary,
            fontWeight: '500',
            letterSpacing: -0.4,
            textAlign: 'center',
          }}
        >
          Your digital ID
        </Text>
        <Eyebrow style={{ marginTop: 6, marginBottom: 22, textAlign: 'center' }}>
          Tap card to reveal QR for verification
        </Eyebrow>

        {/* Feature list */}
        <GlassCard pad={0} style={{ width: '100%' }}>
          <FeatureRow
            first
            label="Instant verification"
            sub="Use at any venue for quick check-in"
          />
          <FeatureRow
            label="Works offline"
            sub="No internet connection required"
          />
          <FeatureRow
            label="Tap to reveal QR"
            sub="Brightness boosts automatically for scanning"
          />
        </GlassCard>

        {/* Licence status */}
        {idNumber ? (
          <GlassCard style={{ width: '100%', marginTop: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Eyebrow>SIA licence</Eyebrow>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 15,
                    color: theme.colors.text.primary,
                    fontWeight: '500',
                    letterSpacing: -0.2,
                  }}
                >
                  {idNumber}
                </Text>
              </View>
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
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: isLicenseValid ? '#4ade80' : theme.colors.accent,
                  }}
                />
                <Text
                  allowFontScaling={false}
                  style={{
                    fontFamily: theme.fonts.mono,
                    fontSize: 9,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: isLicenseValid ? '#4ade80' : theme.colors.accent,
                    fontWeight: '500',
                  }}
                >
                  {isLicenseValid ? 'Active' : 'Expired'}
                </Text>
              </View>
            </View>
            {expiry ? (
              <View
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.surface.hairline,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>Expires</Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.primary, fontWeight: '500' }}>
                  {new Date(expiry).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            ) : null}
          </GlassCard>
        ) : null}
      </ScrollView>

      {/* Close button */}
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

      {/* Top eyebrow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 16,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: theme.fonts.mono,
            fontSize: 10,
            letterSpacing: 2.2,
            textTransform: 'uppercase',
            color: theme.colors.text.secondary,
            fontWeight: '500',
          }}
        >
          Virtual ID
        </Text>
      </View>
    </View>
  );
};

const FeatureRow: React.FC<{ label: string; sub: string; first?: boolean }> = ({
  label,
  sub,
  first,
}) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={{
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
  cardFace: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backfaceVisibility: 'hidden',
  },
  cardBase: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 16,
  },
  headerRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordmark: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    lineHeight: 24,
  },
  wordmarkThin: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    lineHeight: 12,
  },
  photoBox: {
    position: 'absolute',
    top: CARD_HEIGHT * 0.2,
    right: CARD_WIDTH * 0.06,
    width: CARD_WIDTH * 0.34,
    height: CARD_HEIGHT * 0.62,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#8a8a8a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8a8a8a',
  },
  photoInitials: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 46,
    fontWeight: '300',
    letterSpacing: -1,
  },
  bottomStack: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: CARD_WIDTH * 0.42,
  },
  nameText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  metaValue: {
    color: '#ffffff',
    fontWeight: '400',
  },
  qrInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  qrFrame: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  qrHint: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Menlo',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

export default VirtualIDScreenV2;
