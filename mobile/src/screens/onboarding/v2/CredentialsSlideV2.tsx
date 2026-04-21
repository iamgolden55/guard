/**
 * Slide 03 — Credentials (V2)
 * Virtual SIA ID card — replaces the old shield/padlock metaphor.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { redesignColors, redesignFonts } from '../../../theme/redesign';
import { BreathingGlow, HeroWrap, OnboardText } from './shared';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_W * 1.1;

export const CredentialsSlideV2: React.FC = () => {
  const tiltY = useRef(new Animated.Value(0)).current;
  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(tiltY, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(tiltY, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(scanY, {
        toValue: 1,
        duration: 3000,
        easing: Easing.bezier(0.65, 0, 0.35, 1),
        useNativeDriver: true,
      }),
    ).start();
  }, [tiltY, scanY]);

  const float = tiltY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -6],
  });
  const scan = scanY.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 340],
  });

  return (
    <View style={styles.root}>
      <HeroWrap>
        <View style={{ height: HERO_HEIGHT }}>
          <BreathingGlow size={600} top="15%" intensity={0.6} />

          <Animated.View
            style={[
              styles.card,
              { transform: [{ rotate: '-6deg' }, { translateY: float }] },
            ]}
          >
            <LinearGradient
              colors={['#18181b', '#0f0f11']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Scanning sweep */}
            <Animated.View
              style={[styles.sweep, { transform: [{ translateY: scan }] }]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(225,52,44,0.35)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {/* Header meta */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardMetaTiny} allowFontScaling={false}>
                SIA · LICENSED
              </Text>
              <View style={styles.checkBadge}>
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={redesignColors.accent}
                />
              </View>
            </View>

            {/* Photo placeholder */}
            <View style={styles.photo} />

            <Text style={styles.name}>Alex Morgan</Text>
            <Text style={styles.licence}>DS · CP · 1842 9001</Text>

            <View style={styles.cardFooter}>
              <Text style={styles.cardMetaTiny} allowFontScaling={false}>
                EXP · 04 · 28
              </Text>
              <Text style={styles.cardMetaTiny} allowFontScaling={false}>
                VERIFIED LIVE
              </Text>
            </View>
          </Animated.View>
        </View>
      </HeroWrap>

      <OnboardText
        eyebrow="03 · CREDENTIALS"
        title="Your licence, always with you."
        body="Virtual SIA ID, verified live against the register. No more photocopies, no expired badges — present it in two taps."
      />
    </View>
  );
};

const CARD_W = 250;
const CARD_H = 320;

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    position: 'absolute',
    left: SCREEN_W / 2 - CARD_W / 2,
    top: HERO_HEIGHT * 0.22,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairline,
    padding: 20,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 60,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardMetaTiny: {
    fontFamily: redesignFonts.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: redesignColors.text.tertiary,
  },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(225,52,44,0.18)',
    borderWidth: 1,
    borderColor: redesignColors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: 90,
    height: 108,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 14,
  },
  name: {
    fontFamily: redesignFonts.sans,
    fontSize: 19,
    fontWeight: '500',
    color: redesignColors.text.primary,
    letterSpacing: -0.4,
  },
  licence: {
    fontFamily: redesignFonts.mono,
    fontSize: 12,
    color: redesignColors.text.secondary,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  cardFooter: {
    position: 'absolute',
    bottom: 14,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default CredentialsSlideV2;
