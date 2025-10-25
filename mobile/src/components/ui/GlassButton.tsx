/**
 * GlassButton Component
 * Interactive button with glassmorphism and haptic feedback
 * Expo Go Compatible Version
 */

import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator, Animated, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { glassColors, accentColors, textColors } from './styles/colors';
import { shadows, borderRadius, spacing } from './styles/shadows';

interface GlassButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
  hapticFeedback = true,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const getButtonColors = () => {
    switch (variant) {
      case 'primary':
        return {
          background: accentColors.primary,
          text: textColors.inverse,
          blur: 'light' as const,
        };
      case 'success':
        return {
          background: accentColors.success,
          text: textColors.inverse,
          blur: 'light' as const,
        };
      case 'warning':
        return {
          background: accentColors.warning,
          text: textColors.inverse,
          blur: 'light' as const,
        };
      case 'danger':
        return {
          background: accentColors.danger,
          text: textColors.inverse,
          blur: 'light' as const,
        };
      case 'secondary':
        return {
          background: glassColors.medium,
          text: textColors.primary,
          blur: 'light' as const,
        };
      case 'ghost':
        return {
          background: 'transparent',
          text: accentColors.primary,
          blur: 'light' as const,
        };
      default:
        return {
          background: accentColors.primary,
          text: textColors.inverse,
          blur: 'light' as const,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          fontSize: 14,
          height: 40,
        };
      case 'md':
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          fontSize: 16,
          height: 48,
        };
      case 'lg':
        return {
          paddingVertical: spacing.lg,
          paddingHorizontal: spacing['2xl'],
          fontSize: 18,
          height: 56,
        };
      default:
        return {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          fontSize: 16,
          height: 48,
        };
    }
  };

  const colors = getButtonColors();
  const sizeStyles = getSizeStyles();

  const handlePressIn = () => {
    if (!disabled && !loading) {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
      if (hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      onPress();
      if (hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] },
        fullWidth && { width: '100%' },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
      >
        <BlurView
          intensity={variant === 'ghost' ? 0 : 20}
          tint={colors.blur}
          style={[
            styles.button,
            {
              backgroundColor: colors.background,
              paddingVertical: sizeStyles.paddingVertical,
              paddingHorizontal: sizeStyles.paddingHorizontal,
              height: sizeStyles.height,
              borderRadius: borderRadius.large,
              opacity: disabled ? 0.5 : 1,
            },
            variant !== 'ghost' && shadows.medium,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Animated.View style={styles.content}>
              {icon && iconPosition === 'left' && (
                <Animated.View style={styles.iconLeft}>{icon}</Animated.View>
              )}
              <Text
                style={[
                  styles.text,
                  {
                    color: colors.text,
                    fontSize: sizeStyles.fontSize,
                  },
                  textStyle,
                ]}
              >
                {children}
              </Text>
              {icon && iconPosition === 'right' && (
                <Animated.View style={styles.iconRight}>{icon}</Animated.View>
              )}
            </Animated.View>
          )}
        </BlurView>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});
