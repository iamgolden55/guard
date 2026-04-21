/**
 * Shared atoms for the dashboard + check-in redesign.
 *
 * Dark/light aware via `useRedesignTheme`. Kept minimal and style-only —
 * business logic lives in the consumer screens.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  ViewStyle,
  TextStyle,
  StyleProp,
  PressableProps,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Path } from 'react-native-svg';
import {
  useRedesignTheme,
  redesignFonts,
  RedesignTheme,
} from '../../theme/redesign';

// ─────────────────────────────────────────────────────────────
// Eyebrow — Geist Mono, uppercase, tracked
// ─────────────────────────────────────────────────────────────
interface EyebrowProps {
  children: React.ReactNode;
  color?: string;
  size?: number;
  tracking?: number;
  style?: StyleProp<TextStyle>;
}

export const Eyebrow: React.FC<EyebrowProps> = ({
  children,
  color,
  size = 10,
  tracking = 2.2,
  style,
}) => {
  const theme = useRedesignTheme();
  return (
    <Text
      allowFontScaling={false}
      style={[
        {
          fontFamily: theme.fonts.mono,
          fontSize: size,
          color: color ?? theme.colors.text.secondary,
          letterSpacing: tracking,
          textTransform: 'uppercase',
          fontWeight: '500',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

// ─────────────────────────────────────────────────────────────
// GlassCard — translucent panel with 1px hairline border
// ─────────────────────────────────────────────────────────────
interface GlassCardProps {
  children: React.ReactNode;
  pad?: number;
  style?: StyleProp<ViewStyle>;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, pad = 16, style }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={[
        {
          padding: pad,
          borderRadius: theme.radii.xxl,
          backgroundColor: theme.colors.surface.card,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// AccentDot — green online dot with optional pulse
// ─────────────────────────────────────────────────────────────
interface AccentDotProps {
  size?: number;
  color?: string;
  pulse?: boolean;
}

export const AccentDot: React.FC<AccentDotProps> = ({ size = 6, color, pulse }) => {
  const theme = useRedesignTheme();
  const dotColor = color ?? theme.colors.status.online;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, opacity]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dotColor,
        shadowColor: dotColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
        elevation: 3,
        opacity: pulse ? opacity : 1,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────
// AmbientGlow — soft radial red glow, positioned absolute
// ─────────────────────────────────────────────────────────────
interface AmbientGlowProps {
  size?: number;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

export const AmbientGlow: React.FC<AmbientGlowProps> = ({
  size = 420,
  intensity = 0.32,
  style,
}) => {
  const theme = useRedesignTheme();
  const color = theme.colors.accent;
  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient
            id="redesignAmbientGlow"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={intensity} />
            <Stop offset="35%" stopColor={color} stopOpacity={intensity * 0.5} />
            <Stop offset="65%" stopColor={color} stopOpacity={intensity * 0.15} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#redesignAmbientGlow)" />
      </Svg>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// NavBack — circular back button
// ─────────────────────────────────────────────────────────────
interface NavBackProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const NavBack: React.FC<NavBackProps> = ({ onPress, style }) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: theme.colors.surface.chip,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Svg width={10} height={16} viewBox="0 0 10 16">
        <Path
          d="M8 2 L2 8 L8 14"
          stroke={theme.colors.text.primary}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// StepPill — "Step 1 / 3 · Locate" top-right indicator
// ─────────────────────────────────────────────────────────────
interface StepPillProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const StepPill: React.FC<StepPillProps> = ({ children, style }) => {
  const theme = useRedesignTheme();
  return (
    <View
      style={[
        {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 999,
          backgroundColor: theme.colors.surface.chip,
          borderWidth: 1,
          borderColor: theme.colors.surface.hairline,
        },
        style,
      ]}
    >
      <Eyebrow size={10} tracking={1.6} color={theme.colors.text.secondary}>
        {children}
      </Eyebrow>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// PrimaryCTA — big red button with glow
// ─────────────────────────────────────────────────────────────
interface PrimaryCTAProps extends Omit<PressableProps, 'style'> {
  label: string;
  trailingArrow?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const PrimaryCTA: React.FC<PrimaryCTAProps> = ({
  label,
  trailingArrow = true,
  style,
  ...pressableProps
}) => {
  const theme = useRedesignTheme();
  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [
        styles.primaryCTA,
        {
          backgroundColor: theme.cta.bg,
          shadowColor: theme.cta.glow,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: pressed ? 0.25 : 0.45,
          shadowRadius: 22,
          elevation: 10,
          opacity: pressed ? 0.92 : 1,
        },
        style,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[styles.primaryCTALabel, { color: theme.cta.fg, fontFamily: theme.fonts.sans }]}
      >
        {label}
      </Text>
      {trailingArrow ? (
        <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginLeft: 8 }}>
          <Path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke={theme.cta.fg}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
export function redesignTextColors(theme: RedesignTheme) {
  return theme.colors.text;
}

export const redesignFontFamilies = redesignFonts;

const styles = StyleSheet.create({
  primaryCTA: {
    height: 54,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryCTALabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
