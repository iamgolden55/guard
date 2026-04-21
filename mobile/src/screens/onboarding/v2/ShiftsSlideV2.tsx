/**
 * Slide 02 — Shifts (V2)
 * Stacked shift cards — the active one highlighted with the red accent.
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
import { LinearGradient } from 'expo-linear-gradient';
import { redesignColors, redesignFonts, redesignText } from '../../../theme/redesign';
import { BreathingGlow, HeroWrap, OnboardText } from './shared';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_W * 1.1;

interface ShiftCardProps {
  sub: string;
  status: string;
  venue: string;
  time: string;
  accent?: boolean;
  delay: number;
}

const ShiftCard: React.FC<ShiftCardProps> = ({
  sub,
  status,
  venue,
  time,
  accent,
  delay,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [opacity, translateY, delay]);

  const content = (
    <>
      <View style={styles.cardHeader}>
        <Text style={styles.cardMeta} allowFontScaling={false}>
          {sub.toUpperCase()}
        </Text>
        <Text
          style={[
            styles.cardMeta,
            { color: accent ? redesignColors.accent : redesignColors.text.tertiary },
          ]}
          allowFontScaling={false}
        >
          {status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.cardVenue}>{venue}</Text>
      <Text style={styles.cardTime}>{time}</Text>
    </>
  );

  if (accent) {
    return (
      <Animated.View
        style={[
          styles.cardAccent,
          { opacity, transform: [{ translateY }] },
        ]}
      >
        <LinearGradient
          colors={['rgba(225,52,44,0.22)', 'rgba(225,52,44,0.08)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {content}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[styles.card, { opacity, transform: [{ translateY }] }]}
    >
      {content}
    </Animated.View>
  );
};

export const ShiftsSlideV2: React.FC = () => {
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatY]);

  const translate = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  return (
    <View style={styles.root}>
      <HeroWrap>
        <View style={{ height: HERO_HEIGHT }}>
          <BreathingGlow size={640} top="15%" intensity={0.55} />

          <Animated.View
            style={[styles.stack, { transform: [{ translateY: translate }] }]}
          >
            <ShiftCard
              sub="Now"
              status="Live · 2h 14m"
              venue="Camden HQ"
              time="12:00 — 20:00 · Door supervisor"
              accent
              delay={100}
            />
            <ShiftCard
              sub="Tonight"
              status="Scheduled"
              venue="The Roundhouse"
              time="21:00 — 03:00 · Crowd control"
              delay={250}
            />
            <ShiftCard
              sub="This week"
              status="Open shift"
              venue="Shoreditch Mkt."
              time="Sat · 14:00 — 22:00"
              delay={400}
            />
          </Animated.View>
        </View>
      </HeroWrap>

      <OnboardText
        eyebrow="02 · SHIFTS"
        title="Your rota, decluttered."
        body="See what's next, swap shifts in a tap, and check in with GPS — no paperwork, no phone calls."
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: HERO_HEIGHT * 0.22,
    gap: 12,
  },
  card: {
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: redesignColors.surface.card,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairline,
  },
  cardAccent: {
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: redesignColors.accentBorder,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  cardMeta: {
    ...redesignText.meta,
    fontSize: 10,
    color: redesignColors.text.secondary,
  },
  cardVenue: {
    fontFamily: redesignFonts.sans,
    fontSize: 17,
    fontWeight: '500',
    color: redesignColors.text.primary,
    letterSpacing: -0.4,
  },
  cardTime: {
    fontFamily: redesignFonts.sans,
    fontSize: 13,
    color: redesignColors.text.secondary,
    marginTop: 2,
  },
});

export default ShiftsSlideV2;
