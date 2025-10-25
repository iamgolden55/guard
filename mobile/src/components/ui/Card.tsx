/**
 * Card Component
 * Clean card container with optional shadow
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, layout, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'base',
  style,
}) => {
  const getCardStyle = (): ViewStyle => {
    const variantStyles: Record<string, ViewStyle> = {
      elevated: {
        backgroundColor: colors.white,
        ...layout.shadow.base,
      },
      outlined: {
        backgroundColor: colors.white,
        borderWidth: layout.borderWidth.thin,
        borderColor: colors.border.light,
      },
      flat: {
        backgroundColor: colors.background.secondary,
      },
    };

    return {
      borderRadius: layout.borderRadius.md,
      padding: spacing[padding],
      ...variantStyles[variant],
    };
  };

  return <View style={[getCardStyle(), style]}>{children}</View>;
};
