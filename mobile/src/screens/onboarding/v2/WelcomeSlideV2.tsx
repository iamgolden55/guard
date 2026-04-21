/**
 * Slide 01 — Welcome (V2)
 * Floating greeting card + shift chip peeking out of a soft breathing glow.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { redesignColors, redesignFonts, redesignText } from '../../../theme/redesign';
import { BreathingGlow, HeroWrap, OnboardText } from './shared';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_W * 1.1;

function useFloat(direction = 1, delay = 0, amplitude = 6) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, {
          toValue: 1,
          duration: 3000,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y, delay]);
  return y.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -amplitude * direction],
  });
}

export const WelcomeSlideV2: React.FC = () => {
  const cardAY = useFloat(1, 0, 6);
  const cardBY = useFloat(1, 1000, 8);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <View style={styles.root}>
      <HeroWrap>
        <View style={{ height: HERO_HEIGHT }}>
          <BreathingGlow size={620} top="10%" intensity={0.7} />

          {/* Greeting card (top-left, floating) */}
          <Animated.View
            style={[
              styles.greetingCard,
              { opacity: fade, transform: [{ translateY: cardAY }] },
            ]}
          >
            <Text style={styles.metaLabel} allowFontScaling={false}>
              TODAY · 9:41
            </Text>
            <Text style={styles.greeting}>Good morning, Alex.</Text>
            <Text style={styles.subtle}>Next shift in 2h 14m.</Text>
          </Animated.View>

          {/* Check-in chip (right, floating) */}
          <Animated.View
            style={[
              styles.chip,
              { opacity: fade, transform: [{ translateY: cardBY }] },
            ]}
          >
            <View style={styles.dot} />
            <View>
              <Text style={styles.chipLabel} allowFontScaling={false}>
                CHECK IN
              </Text>
              <Text style={styles.chipValue}>Camden HQ · 12:00</Text>
            </View>
          </Animated.View>
        </View>
      </HeroWrap>

      <OnboardText
        eyebrow="01 · WELCOME"
        title="Welcome to Mead Security."
        body="One place for your shifts, team, and paperwork. Built for the way security teams actually operate — offline-first, quiet, and out of your way."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  greetingCard: {
    position: 'absolute',
    left: 24,
    top: HERO_HEIGHT * 0.34,
    width: 220,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: redesignColors.surface.chip,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairline,
  },
  metaLabel: {
    ...redesignText.meta,
    fontSize: 10,
    marginBottom: 6,
    color: redesignColors.text.secondary,
  },
  greeting: {
    fontFamily: redesignFonts.sans,
    fontSize: 18,
    color: redesignColors.text.primary,
    letterSpacing: -0.4,
    fontWeight: '400',
  },
  subtle: {
    fontFamily: redesignFonts.sans,
    fontSize: 13,
    color: redesignColors.text.secondary,
    marginTop: 4,
  },
  chip: {
    position: 'absolute',
    right: 24,
    top: HERO_HEIGHT * 0.57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: redesignColors.surface.overlay,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairlineStrong,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: redesignColors.accent,
  },
  chipLabel: {
    ...redesignText.meta,
    fontSize: 10,
    color: redesignColors.text.secondary,
  },
  chipValue: {
    fontFamily: redesignFonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: redesignColors.text.primary,
  },
});

export default WelcomeSlideV2;
