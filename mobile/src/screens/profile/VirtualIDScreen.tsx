/**
 * VirtualIDScreen - Wise-Inspired Minimal Design
 * Clean, product-focused digital ID card
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Text,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Body, Caption, Button } from '@components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, getColors } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logger } from '../../utils/logger';
import * as Brightness from 'expo-brightness';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = CARD_WIDTH / 1.586; // Credit card ratio

export const VirtualIDScreen: React.FC = () => {
  const navigation = useNavigation();
  const user = useSelector((state: RootState) => state.auth.user);
  const profile = user?.staff_profile;
  const { isDark } = useTheme();
  const themeColors = getColors(isDark);

  const [isFlipped, setIsFlipped] = useState(false);
  const [brightness, setBrightness] = useState<number>(1);
  const flipAnim = useRef(new Animated.Value(0)).current;

  // Flip animation
  useEffect(() => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 180 : 0,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [isFlipped]);

  // Brightness boost for QR
  useEffect(() => {
    if (isFlipped) {
      const increaseBrightness = async () => {
        try {
          const { status } = await Brightness.requestPermissionsAsync();
          if (status === 'granted') {
            const current = await Brightness.getBrightnessAsync();
            setBrightness(current);
            await Brightness.setBrightnessAsync(1);
            logger.info('[VirtualID] Brightness increased for QR scanning');
          }
        } catch (error) {
          logger.error('[VirtualID] Failed to adjust brightness', { error });
        }
      };
      increaseBrightness();
    } else {
      Brightness.setBrightnessAsync(brightness).catch(() => {});
    }
  }, [isFlipped]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={themeColors.error} />
          <Body style={[styles.errorText, { color: themeColors.text.primary }]}>Unable to load ID information</Body>
        </View>
      </SafeAreaView>
    );
  }

  // Generate QR code data
  const qrData = JSON.stringify({
    id: user.id,
    name: `${user.first_name || 'Security'} ${user.last_name || 'Staff'}`,
    license: profile?.sia_license_number,
    expiry: profile?.sia_license_expiry,
    verified: true,
    timestamp: new Date().toISOString(),
  });

  // Calculate license status
  const isLicenseValid = profile?.sia_license_expiry
    ? new Date(profile.sia_license_expiry) > new Date()
    : false;

  // Interpolate rotation values
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
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      {/* Close Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeButton, { backgroundColor: isDark ? themeColors.background.tertiary : '#F5F5F5' }]}>
        <Ionicons name="close" size={28} color={themeColors.text.primary} />
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* ID Card Display with Flip Animation */}
        <View style={styles.cardWrapper}>
          <View style={styles.cardContainer}>
            {/* Front Card */}
            <Animated.View
              style={[
                styles.cardFace,
                {
                  transform: [{ rotateY: frontRotate }],
                  opacity: frontOpacity,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setIsFlipped(!isFlipped)}
                activeOpacity={0.95}
              >
                <LinearGradient
                  colors={['#84FAB0', '#8FD3F4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.card}
                >
                  {/* Watermark Text */}
                  <Text style={styles.watermarkText}>SECURE</Text>

                  {/* Chip Icon */}
                  <View style={styles.chipIcon}>
                    <View style={styles.chipInner}>
                      <View style={styles.chipLine} />
                      <View style={styles.chipLine} />
                    </View>
                  </View>

                  {/* User Info */}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {(user.first_name || 'SECURITY').toUpperCase()} {(user.last_name || 'STAFF').toUpperCase()}
                    </Text>
                    <Text style={styles.cardDetail}>
                      {profile?.sia_license_number || 'No License'}
                    </Text>
                  </View>

                  {/* Logo */}
                  <View style={styles.logoContainer}>
                    <Ionicons name="shield-checkmark" size={32} color="rgba(255,255,255,0.95)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Back Card (QR Code) */}
            <Animated.View
              style={[
                styles.cardFace,
                styles.cardBack,
                {
                  transform: [{ rotateY: backRotate }],
                  opacity: backOpacity,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setIsFlipped(!isFlipped)}
                activeOpacity={0.95}
              >
                <View style={styles.qrCard}>
                  <View style={styles.qrWrapper}>
                    <QRCode value={qrData} size={CARD_WIDTH * 0.7} />
                  </View>
                  <Caption style={styles.qrHint}>Scan to verify ID</Caption>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* Heading */}
        <Text style={[styles.mainHeading, { color: themeColors.text.primary }]}>
          YOUR DIGITAL{'\n'}ID CARD
        </Text>

        {/* Subtitle */}
        <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
          Tap the card above to reveal your QR code for instant verification at any venue.
        </Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: isDark ? 'rgba(0,102,255,0.15)' : '#F0F4FF' }]}>
              <Ionicons name="flash" size={22} color="#0066FF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Instant Verification</Text>
              <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                Use at any venue for quick and secure check-in
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: isDark ? 'rgba(0,102,255,0.15)' : '#F0F4FF' }]}>
              <Ionicons name="qr-code" size={22} color="#0066FF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Tap to reveal QR code</Text>
              <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                Quick scanning for security checkpoints
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: isDark ? 'rgba(0,102,255,0.15)' : '#F0F4FF' }]}>
              <Ionicons name="shield-checkmark" size={22} color="#0066FF" />
            </View>
            <View style={styles.featureContent}>
              <Text style={[styles.featureTitle, { color: themeColors.text.primary }]}>Works offline</Text>
              <Text style={[styles.featureDescription, { color: themeColors.text.secondary }]}>
                No internet connection required to display your ID
              </Text>
            </View>
          </View>
        </View>

        {/* License Status Card */}
        {profile?.sia_license_number && (
          <View style={[styles.statusCard, { backgroundColor: isDark ? themeColors.background.secondary : '#FAFAFA' }]}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: themeColors.text.primary }]}>SIA License</Text>
              <View style={[styles.statusBadge, isLicenseValid ? styles.statusActive : styles.statusInactive]}>
                <Ionicons
                  name={isLicenseValid ? 'checkmark-circle' : 'alert-circle'}
                  size={14}
                  color={isLicenseValid ? '#00B67A' : '#D13438'}
                />
                <Text style={[styles.statusBadgeText, isLicenseValid ? styles.statusActiveText : styles.statusInactiveText]}>
                  {isLicenseValid ? 'Active' : 'Expired'}
                </Text>
              </View>
            </View>
            {profile.sia_license_expiry && (
              <Text style={[styles.statusExpiry, { color: themeColors.text.secondary }]}>
                Expires: {new Date(profile.sia_license_expiry).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
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
    paddingTop: 100,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  // Card Display
  cardWrapper: {
    marginBottom: spacing.xl,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    padding: spacing.lg,
    justifyContent: 'space-between',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  watermarkText: {
    position: 'absolute',
    top: '35%',
    left: '-10%',
    fontSize: 120,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: 4,
    transform: [{ rotate: '-15deg' }],
  },
  chipIcon: {
    width: 48,
    height: 38,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 6,
  },
  chipInner: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    gap: 4,
    padding: 4,
  },
  chipLine: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 1,
  },
  cardInfo: {
    gap: 4,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.98)',
    letterSpacing: 1.2,
  },
  cardDetail: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  logoContainer: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
  },
  // QR Card
  qrCard: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    gap: spacing.base,
  },
  qrWrapper: {
    padding: spacing.base,
    backgroundColor: colors.white,
  },
  qrHint: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  // Heading
  mainHeading: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.base,
    lineHeight: 48,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
    paddingHorizontal: spacing.base,
  },
  // Features
  featuresContainer: {
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
    backgroundColor: '#F0F4FF',
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
  // Status Card
  statusCard: {
    width: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: spacing.base,
    gap: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(0,182,122,0.12)',
  },
  statusInactive: {
    backgroundColor: 'rgba(209,52,56,0.12)',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusActiveText: {
    color: '#00B67A',
  },
  statusInactiveText: {
    color: '#D13438',
  },
  statusExpiry: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});
