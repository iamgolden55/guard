/**
 * Global Typography System
 * Platform-specific fonts with consistent sizing
 */

import { Platform, TextStyle } from 'react-native';

export const fonts = {
  // Font Families
  family: {
    ios: 'System',
    android: 'Roboto',
    default: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // Font Weights
  weight: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semibold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
  },

  // Font Sizes
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 36,
  },

  // Line Heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
  },
} as const;

// Pre-defined text styles
export const textStyles = {
  // Headings
  h1: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size['3xl'],
    fontWeight: fonts.weight.bold,
    lineHeight: fonts.size['3xl'] * fonts.lineHeight.tight,
    letterSpacing: fonts.letterSpacing.tighter,
  },
  h2: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size['2xl'],
    fontWeight: fonts.weight.bold,
    lineHeight: fonts.size['2xl'] * fonts.lineHeight.tight,
    letterSpacing: fonts.letterSpacing.tight,
  },
  h3: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.xl,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.xl * fonts.lineHeight.normal,
  },
  h4: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.lg * fonts.lineHeight.normal,
  },

  // Body Text
  body: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },
  bodyLarge: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.lg * fonts.lineHeight.normal,
  },
  bodySmall: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.sm * fonts.lineHeight.normal,
  },

  // Labels
  label: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },
  labelSmall: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.medium,
    lineHeight: fonts.size.sm * fonts.lineHeight.normal,
  },

  // Button Text
  button: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.lg * fonts.lineHeight.tight,
  },
  buttonSmall: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.base * fonts.lineHeight.tight,
  },

  // Input Text
  input: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },

  // Caption/Helper Text
  caption: {
    fontFamily: fonts.family.default,
    fontSize: fonts.size.xs,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.xs * fonts.lineHeight.normal,
  },
} as const;

export type TextStyles = typeof textStyles;
