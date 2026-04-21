/**
 * Shared onboarding V2 primitives: text block, breathing glow, SafeWrap.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import {
  redesignText,
  redesignSpacing,
} from '../../../theme/redesign';

// ─────────────────────────────────────────────────────────────
// Text block: eyebrow · title · body (matches OnboardText in design)
// ─────────────────────────────────────────────────────────────
interface OnboardTextProps {
  eyebrow: string;
  title: string;
  body: string;
  delay?: number;
}

export const OnboardText: React.FC<OnboardTextProps> = ({
  eyebrow,
  title,
  body,
  delay = 300,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          tension: 50,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [opacity, translateY, delay]);

  return (
    <Animated.View
      style={[styles.textWrap, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.eyebrow} allowFontScaling={false}>
        {eyebrow}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// BreathingGlow — soft red radial behind the hero.
// Uses SVG's RadialGradient for true circular fade (expo-linear-gradient
// can only do linear gradients, which produced a hard-edged rectangle).
// ─────────────────────────────────────────────────────────────
interface GlowProps {
  size?: number;
  top?: number | `${number}%`;
  /** Peak intensity at the center (0..1). Controls red strength. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

export const BreathingGlow: React.FC<GlowProps> = ({
  size = 560,
  top = '18%',
  intensity = 0.65,
  style,
}) => {
  const breathe = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.08,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [breathe]);

  const glowStyle: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    left: '50%',
    marginLeft: -(size / 2),
    top,
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[glowStyle, { transform: [{ scale: breathe }] }, style]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient
            id="breathingGlow"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor="#E1342C" stopOpacity={intensity} />
            <Stop
              offset="35%"
              stopColor="#E1342C"
              stopOpacity={intensity * 0.55}
            />
            <Stop
              offset="65%"
              stopColor="#E1342C"
              stopOpacity={intensity * 0.15}
            />
            <Stop offset="100%" stopColor="#E1342C" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#breathingGlow)" />
      </Svg>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// HeroWrap — 460-ish tall hero section above the text block
// ─────────────────────────────────────────────────────────────
export const HeroWrap: React.FC<React.PropsWithChildren> = ({ children }) => (
  <View style={styles.hero}>{children}</View>
);

const styles = StyleSheet.create({
  textWrap: {
    paddingHorizontal: redesignSpacing.gutter,
  },
  eyebrow: {
    ...redesignText.eyebrow,
    marginBottom: 14,
  },
  title: {
    ...redesignText.display,
    marginBottom: 14,
  },
  body: {
    ...redesignText.body,
    maxWidth: 320,
  },
  hero: {
    position: 'relative',
    // No overflow:'hidden' — the glow should fade naturally into the text
    // area instead of being clipped at a hard rectangle edge.
    width: '100%',
  },
});
