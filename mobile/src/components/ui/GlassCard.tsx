/**
 * GlassCard Component
 * Apple-inspired glassmorphism card with blur effects
 * Expo Go Compatible Version
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { glassColors, borderColors } from './styles/colors';
import { shadows, borderRadius, spacing } from './styles/shadows';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'light' | 'medium' | 'strong' | 'dark';
  intensity?: number;
  shadow?: 'none' | 'small' | 'medium' | 'large' | 'xlarge';
  radius?: 'small' | 'medium' | 'large' | 'xlarge';
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  onPress?: () => void;
  style?: ViewStyle;
  borderColor?: string;
  borderWidth?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'medium',
  intensity = 20,
  shadow = 'medium',
  radius = 'large',
  padding = 'lg',
  onPress,
  style,
  borderColor,
  borderWidth = 1,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const getBackgroundColor = () => {
    switch (variant) {
      case 'light':
        return glassColors.light;
      case 'medium':
        return glassColors.medium;
      case 'strong':
        return glassColors.strong;
      case 'dark':
        return glassColors.dark;
      default:
        return glassColors.medium;
    }
  };

  const getBorderColor = () => {
    if (borderColor) return borderColor;

    switch (variant) {
      case 'dark':
        return borderColors.dark;
      default:
        return borderColors.light;
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const cardContent = (
    <BlurView
      intensity={intensity}
      tint={variant === 'dark' ? 'dark' : 'light'}
      style={[
        styles.container,
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: borderRadius[radius],
          padding: spacing[padding],
          borderColor: getBorderColor(),
          borderWidth,
        },
        shadows[shadow],
        style,
      ]}
    >
      {children}
    </BlurView>
  );

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{ overflow: 'visible' }}
        >
          {cardContent}
        </Pressable>
      </Animated.View>
    );
  }

  return cardContent;
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
