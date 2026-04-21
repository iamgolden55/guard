/**
 * LaunchScreenV2 — "Breathing horizon"
 *
 * A calm, organic launch signature: red horizon rises from below, wordmark
 * draws in, tagline fades. ~2.2s total. Dark canvas, red accent.
 *
 * Standalone — not wired into navigation yet. Intended as the splash shown
 * while `checkAuthStatus()` resolves in AppNavigator. Call `onFinish` after
 * the reveal to hand off to the next screen.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  redesignColors,
  redesignFonts,
  redesignShadows,
  redesignText,
} from '../../theme/redesign';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  onFinish?: () => void;
  /** Auto-call onFinish after this many ms. 0 (default) disables — user must tap the CTA. */
  autoFinishAfterMs?: number;
  /** Label for the primary tap-through button. */
  ctaLabel?: string;
  /** Hide the CTA entirely (e.g. when using this as a pure splash overlay). */
  hideCta?: boolean;
}

export const LaunchScreenV2: React.FC<Props> = ({
  onFinish,
  autoFinishAfterMs = 0,
  ctaLabel = 'Get started',
  hideCta = false,
}) => {
  // Horizon glow: slide up from bottom then breathe
  const horizonY = useRef(new Animated.Value(1)).current; // 1 = off-screen
  const horizonOpacity = useRef(new Animated.Value(0)).current;
  const horizonBreathe = useRef(new Animated.Value(1)).current;

  // Thin horizon line
  const lineOpacity = useRef(new Animated.Value(0)).current;

  // Wordmark ("Mead" / "Security") — fade-up + slide-up
  const wordmarkY = useRef(new Animated.Value(30)).current;
  const wordmark1Opacity = useRef(new Animated.Value(0)).current;
  const wordmark2Opacity = useRef(new Animated.Value(0)).current;

  // Tagline — spread letters + fade in
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  // Version footer
  const footerOpacity = useRef(new Animated.Value(0)).current;

  // CTA — fades in after the rest of the sequence so it feels earned
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaY = useRef(new Animated.Value(16)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;

  // Exit transition: whole screen fades + eases up slightly so it feels like
  // we're lifting away. Next screen underneath reveals smoothly.
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const exitLift = useRef(new Animated.Value(0)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const [isExiting, setIsExiting] = useState(false);

  // Exit: fade + lift. onFinish fires once the fade completes so the next
  // screen appears under an already-transparent splash.
  const handleFinish = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    Animated.parallel([
      Animated.timing(exitOpacity, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitLift, {
        toValue: -16,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exitScale, {
        toValue: 1.02,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish?.();
    });
  }, [isExiting, exitOpacity, exitLift, exitScale, onFinish]);

  useEffect(() => {
    Animated.parallel([
      // horizon rises
      Animated.timing(horizonY, {
        toValue: 0,
        duration: 2200,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(horizonOpacity, {
        toValue: 0.85,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      // thin line fades in with slight delay
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(lineOpacity, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
      // wordmark rises + draws in
      Animated.sequence([
        Animated.delay(800),
        Animated.parallel([
          Animated.timing(wordmarkY, {
            toValue: 0,
            duration: 1400,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(wordmark1Opacity, {
              toValue: 1,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(wordmark2Opacity, {
              toValue: 0.55,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      // tagline fades after wordmark
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(taglineOpacity, {
          toValue: 0.7,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
      // footer at the end
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(footerOpacity, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // CTA — comes in last
      Animated.sequence([
        Animated.delay(hideCta ? 0 : 1800),
        Animated.parallel([
          Animated.timing(ctaOpacity, {
            toValue: hideCta ? 0 : 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.spring(ctaY, {
            toValue: 0,
            tension: 60,
            friction: 9,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      // Breathing loop after main sequence settles
      Animated.loop(
        Animated.sequence([
          Animated.timing(horizonBreathe, {
            toValue: 1.08,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(horizonBreathe, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    if (autoFinishAfterMs > 0 && onFinish) {
      const t = setTimeout(() => handleFinish(), autoFinishAfterMs);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [
    horizonY,
    horizonOpacity,
    horizonBreathe,
    lineOpacity,
    wordmarkY,
    wordmark1Opacity,
    wordmark2Opacity,
    taglineOpacity,
    footerOpacity,
    ctaOpacity,
    ctaY,
    onFinish,
    autoFinishAfterMs,
    hideCta,
    handleFinish,
  ]);

  const handlePressIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.97,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  // Horizon glow translates up from below the screen (1 -> 0)
  const horizonTranslate = horizonY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_H * 0.5],
  });

  return (
    <Animated.View
      style={[
        styles.root,
        {
          opacity: exitOpacity,
          transform: [
            { translateY: exitLift },
            { scale: exitScale },
          ],
        },
      ]}
    >
      <StatusBar style="light" />

      {/* Radial-style glow — big soft ellipse anchored below, rising up */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.horizonWrap,
          {
            opacity: horizonOpacity,
            transform: [
              { translateY: horizonTranslate },
              { scale: horizonBreathe },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={[
            redesignColors.accent,
            'rgba(225,52,44,0.5)',
            'rgba(225,52,44,0.15)',
            'rgba(225,52,44,0)',
          ]}
          locations={[0, 0.22, 0.45, 0.7]}
          style={styles.horizonGlow}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      {/* Thin horizon hairline */}
      <Animated.View
        pointerEvents="none"
        style={[styles.horizonLineWrap, { opacity: lineOpacity }]}
      >
        <LinearGradient
          colors={['transparent', redesignColors.accent, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.horizonLine}
        />
      </Animated.View>

      {/* Wordmark */}
      <Animated.View
        style={[
          styles.wordmarkWrap,
          { transform: [{ translateY: wordmarkY }] },
        ]}
      >
        <Animated.Text
          style={[styles.wordmark, { opacity: wordmark1Opacity }]}
        >
          Mead
        </Animated.Text>
        <Animated.Text
          style={[styles.wordmark, { opacity: wordmark2Opacity }]}
        >
          Security
        </Animated.Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text
        style={[styles.tagline, { opacity: taglineOpacity }]}
        allowFontScaling={false}
      >
        SECURE · PRESENT · PAID
      </Animated.Text>

      {/* CTA — user taps to continue */}
      {!hideCta && (
        <Animated.View
          style={[
            styles.ctaWrap,
            {
              opacity: ctaOpacity,
              transform: [{ translateY: ctaY }, { scale: ctaScale }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleFinish}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={isExiting}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={redesignColors.text.primary}
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Footer */}
      <Animated.Text
        style={[styles.footer, { opacity: footerOpacity }]}
        allowFontScaling={false}
      >
        v2.0 · MEAD SECURITY
      </Animated.Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: redesignColors.canvas,
    overflow: 'hidden',
  },
  horizonWrap: {
    position: 'absolute',
    left: SCREEN_W / 2 - SCREEN_W * 1.1,
    bottom: -SCREEN_H * 0.35,
    width: SCREEN_W * 2.2,
    height: SCREEN_W * 2.2,
    borderRadius: SCREEN_W * 1.1,
  },
  horizonGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: SCREEN_W * 1.1,
  },
  horizonLineWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '38%',
    height: 1,
  },
  horizonLine: {
    flex: 1,
    height: 1,
  },
  wordmarkWrap: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: redesignFonts.sans,
    fontWeight: '300',
    fontSize: 56,
    color: redesignColors.text.primary,
    letterSpacing: -2.2,
    lineHeight: 58,
  },
  tagline: {
    position: 'absolute',
    top: '53%',
    left: 0,
    right: 0,
    textAlign: 'center',
    ...redesignText.meta,
    letterSpacing: 3.2,
    color: 'rgba(255,255,255,0.65)',
  },
  ctaWrap: {
    position: 'absolute',
    bottom: 96,
    left: 28,
    right: 28,
  },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: redesignColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...redesignShadows.primaryGlow,
  },
  ctaText: {
    ...redesignText.button,
    fontSize: 17,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    textAlign: 'center',
    ...redesignText.meta,
    letterSpacing: 2.4,
    fontSize: 10,
  },
});

export default LaunchScreenV2;
