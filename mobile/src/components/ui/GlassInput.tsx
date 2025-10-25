/**
 * GlassInput Component
 * Text input with glassmorphism, floating labels, and focus animations
 * Expo Go Compatible Version
 */

import React, { useState } from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps, ViewStyle, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { glassColors, borderColors, textColors, accentColors } from './styles/colors';
import { shadows, borderRadius, spacing } from './styles/shadows';

interface GlassInputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  variant?: 'light' | 'medium' | 'dark';
  containerStyle?: ViewStyle;
}

export const GlassInput: React.FC<GlassInputProps> = ({
  label,
  error,
  icon,
  iconPosition = 'left',
  variant = 'medium',
  containerStyle,
  value,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const labelPosition = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  // Trigger shake animation when error appears
  React.useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(labelPosition, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!value) {
      Animated.timing(labelPosition, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    onBlur?.(e);
  };

  const getBorderColor = () => {
    if (error) return accentColors.danger;
    if (isFocused) return accentColors.primary;
    return variant === 'dark' ? borderColors.dark : borderColors.light;
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'light':
        return glassColors.light;
      case 'medium':
        return glassColors.medium;
      case 'dark':
        return glassColors.dark;
      default:
        return glassColors.medium;
    }
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }, containerStyle]}>
      {label && (
        <Animated.Text
          style={[
            styles.label,
            {
              color: error ? accentColors.danger : isFocused ? accentColors.primary : textColors.secondary,
              transform: [
                {
                  translateY: labelPosition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -28],
                  }),
                },
                {
                  scale: labelPosition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.85],
                  }),
                },
              ],
            },
          ]}
        >
          {label}
        </Animated.Text>
      )}

      <BlurView
        intensity={20}
        tint={variant === 'dark' ? 'dark' : 'light'}
        style={[
          styles.inputContainer,
          {
            backgroundColor: getBackgroundColor(),
            borderRadius: borderRadius.medium,
            borderWidth: 2,
            borderColor: getBorderColor(),
          },
          shadows.small,
        ]}
      >
        <View style={styles.innerContainer}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}

          <TextInput
            style={[
              styles.input,
              {
                color: textColors.primary,
                paddingLeft: icon && iconPosition === 'left' ? spacing.xs : spacing.md,
                paddingRight: icon && iconPosition === 'right' ? spacing.xs : spacing.md,
              },
            ]}
            placeholderTextColor={textColors.tertiary}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...textInputProps}
          />

          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      </BlurView>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  label: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.lg,
    fontSize: 16,
    fontWeight: '500',
    zIndex: 10,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.xs,
  },
  inputContainer: {
    overflow: 'hidden',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 56,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  errorText: {
    color: accentColors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
});
