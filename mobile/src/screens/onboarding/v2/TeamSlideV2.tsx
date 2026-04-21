/**
 * Slide 04 — Team (V2)
 * Avatar cluster + you-in-the-centre with a pinging ring.
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
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { redesignColors, redesignFonts, redesignText } from '../../../theme/redesign';
import { BreathingGlow, HeroWrap, OnboardText } from './shared';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_W * 1.1;

interface AvProps {
  letter: string;
  color: string;
  delay: number;
}

const Avatar: React.FC<AvProps> = ({ letter, color, delay }) => {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(t);
  }, [scale, delay]);

  return (
    <Animated.View
      style={[
        styles.avatar,
        { backgroundColor: color, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.avatarLetter}>{letter}</Text>
    </Animated.View>
  );
};

export const TeamSlideV2: React.FC = () => {
  const ping = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(ping, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ).start();
  }, [ping]);

  const pingScale = ping.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 2.2],
  });
  const pingOpacity = ping.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 0],
  });

  return (
    <View style={styles.root}>
      <HeroWrap>
        <View style={{ height: HERO_HEIGHT }}>
          <BreathingGlow size={580} top="18%" intensity={0.5} />

          {/* Connecting lines */}
          <Svg
            width={SCREEN_W}
            height={HERO_HEIGHT}
            style={StyleSheet.absoluteFill}
            viewBox={`0 0 ${SCREEN_W} ${HERO_HEIGHT}`}
          >
            <Path
              d={`M80 ${HERO_HEIGHT * 0.33} Q ${SCREEN_W / 2} ${HERO_HEIGHT * 0.2} ${SCREEN_W - 80} ${HERO_HEIGHT * 0.37}`}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="none"
            />
            <Path
              d={`M100 ${HERO_HEIGHT * 0.68} Q ${SCREEN_W / 2} ${HERO_HEIGHT * 0.56} ${SCREEN_W - 100} ${HERO_HEIGHT * 0.66}`}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="none"
            />
          </Svg>

          <View style={{ position: 'absolute', left: 40, top: HERO_HEIGHT * 0.30 }}>
            <Avatar letter="J" color="#3f3f46" delay={200} />
          </View>
          <View style={{ position: 'absolute', right: 40, top: HERO_HEIGHT * 0.34 }}>
            <Avatar letter="M" color="#27272a" delay={350} />
          </View>
          <View style={{ position: 'absolute', left: 52, top: HERO_HEIGHT * 0.64 }}>
            <Avatar letter="S" color="#3f3f46" delay={500} />
          </View>
          <View style={{ position: 'absolute', right: 60, top: HERO_HEIGHT * 0.62 }}>
            <Avatar letter="R" color="#27272a" delay={650} />
          </View>

          {/* You (centre) */}
          <View style={styles.you}>
            <Animated.View
              style={[
                styles.ping,
                { transform: [{ scale: pingScale }], opacity: pingOpacity },
              ]}
            />
            <LinearGradient
              colors={['#E1342C', '#8a1e19']}
              style={styles.youInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.youLetter}>A</Text>
            </LinearGradient>
          </View>

          {/* Presence chip */}
          <View style={styles.presenceWrap} pointerEvents="none">
            <View style={styles.presence}>
              <View style={styles.presenceDot} />
              <Text style={styles.presenceText} allowFontScaling={false}>
                4 TEAMMATES ONLINE
              </Text>
            </View>
          </View>
        </View>
      </HeroWrap>

      <OnboardText
        eyebrow="04 · TEAM"
        title="Your team, in one room."
        body="See who's on shift, share incidents, celebrate the wins. Presence, chat, and handover notes built in."
      />
    </View>
  );
};

const AV_SIZE = 52;
const YOU_SIZE = 68;

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatar: {
    width: AV_SIZE,
    height: AV_SIZE,
    borderRadius: AV_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: redesignColors.surface.hairline,
  },
  avatarLetter: {
    fontFamily: redesignFonts.sans,
    color: redesignColors.text.primary,
    fontSize: 18,
    fontWeight: '500',
  },
  you: {
    position: 'absolute',
    left: SCREEN_W / 2 - YOU_SIZE / 2,
    top: HERO_HEIGHT * 0.49,
    width: YOU_SIZE,
    height: YOU_SIZE,
  },
  ping: {
    position: 'absolute',
    width: YOU_SIZE,
    height: YOU_SIZE,
    borderRadius: YOU_SIZE / 2,
    borderWidth: 2,
    borderColor: redesignColors.accent,
  },
  youInner: {
    width: YOU_SIZE,
    height: YOU_SIZE,
    borderRadius: YOU_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: redesignColors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  youLetter: {
    fontFamily: redesignFonts.sans,
    fontSize: 24,
    fontWeight: '500',
    color: redesignColors.text.primary,
  },
  presenceWrap: {
    position: 'absolute',
    top: HERO_HEIGHT * 0.82,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  presence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: redesignColors.surface.chip,
    borderWidth: 1,
    borderColor: redesignColors.surface.hairlineStrong,
  },
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: redesignColors.status.online,
  },
  presenceText: {
    ...redesignText.meta,
    fontSize: 10,
    color: redesignColors.text.secondary,
    letterSpacing: 1.4,
  },
});

export default TeamSlideV2;
