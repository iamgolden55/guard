/**
 * Button Component
 * Dropbox-inspired button with multiple variants
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, textStyles, layout, spacing } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'social-apple' | 'social-google';
export type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  fullWidth = true,
  icon,
  style,
  textStyle,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: layout.borderRadius.base,
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      small: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.base,
      },
      medium: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      },
      large: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
      },
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: colors.primary,
      },
      secondary: {
        backgroundColor: colors.gray[100],
      },
      outline: {
        backgroundColor: colors.white,
        borderWidth: layout.borderWidth.thin,
        borderColor: colors.border.light,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      'social-apple': {
        backgroundColor: colors.apple,
      },
      'social-google': {
        backgroundColor: colors.white,
        borderWidth: layout.borderWidth.thin,
        borderColor: colors.googleBorder,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
      ...(disabled && { opacity: 0.5 }),
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = size === 'small' ? textStyles.buttonSmall : textStyles.button;

    const variantTextStyles: Record<ButtonVariant, TextStyle> = {
      primary: {
        color: colors.text.inverse,
      },
      secondary: {
        color: colors.text.primary,
      },
      outline: {
        color: colors.text.primary,
      },
      ghost: {
        color: colors.primary,
      },
      'social-apple': {
        color: colors.text.inverse,
      },
      'social-google': {
        color: colors.text.primary,
      },
    };

    return {
      ...baseStyle,
      ...variantTextStyles[variant],
    };
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'social-apple' ? colors.white : colors.black}
          size="small"
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    marginRight: spacing.sm,
  },
});
