/**
 * UberActionButton - Primary and secondary action buttons
 * Features press animation with spring effect
 */

import React from 'react';
import { Text, StyleSheet, Pressable, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { uberColors, uberRadius, uberShadows, uberSpacing } from '../../../../theme/uberTheme';

interface UberActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const UberActionButton: React.FC<UberActionButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  icon,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: uberColors.background.surface,
          borderWidth: 1,
          borderColor: uberColors.border.light,
        };
      case 'destructive':
        return {
          backgroundColor: uberColors.errorLight,
          borderWidth: 1,
          borderColor: uberColors.error,
        };
      default: // primary
        return {
          backgroundColor: uberColors.primary,
        };
    }
  };

  const getTextStyles = (): TextStyle => {
    switch (variant) {
      case 'secondary':
        return {
          color: uberColors.text.primary,
        };
      case 'destructive':
        return {
          color: uberColors.error,
        };
      default: // primary
        return {
          color: uberColors.text.inverse,
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: uberSpacing.sm,
          paddingHorizontal: uberSpacing.md,
        };
      case 'large':
        return {
          paddingVertical: uberSpacing.base,
          paddingHorizontal: uberSpacing.xl,
        };
      default: // medium
        return {
          paddingVertical: uberSpacing.md,
          paddingHorizontal: uberSpacing.lg,
        };
    }
  };

  const getTextSizeStyles = (): TextStyle => {
    switch (size) {
      case 'small':
        return { fontSize: 13 };
      case 'large':
        return { fontSize: 16 };
      default:
        return { fontSize: 14 };
    }
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        variant === 'primary' && uberShadows.soft,
        animatedStyle,
      ]}
      disabled={disabled}
    >
      {icon && <>{icon}</>}
      <Text
        style={[
          styles.text,
          getTextStyles(),
          getTextSizeStyles(),
          disabled && styles.disabledText,
          icon && styles.textWithIcon,
        ]}
      >
        {title}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: uberRadius.full,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    backgroundColor: uberColors.disabled,
    borderColor: uberColors.disabled,
  },
  text: {
    fontWeight: '600',
  },
  textWithIcon: {
    marginLeft: uberSpacing.sm,
  },
  disabledText: {
    color: uberColors.disabledText,
  },
});
