/**
 * Global Typography System
 * Custom fonts with Plus Jakarta Sans for headings and Inter for body
 */

import { Platform, TextStyle } from 'react-native';

// Font family definitions
export const fontFamilies = {
  // Inter - Body/UI text
  inter: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  // Plus Jakarta Sans - Headings/Display
  plusJakarta: {
    regular: 'PlusJakartaSans-Regular',
    medium: 'PlusJakartaSans-Medium',
    semiBold: 'PlusJakartaSans-SemiBold',
    bold: 'PlusJakartaSans-Bold',
  },
  // System fonts (fallback)
  system: {
    ios: 'System',
    android: 'Roboto',
    default: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  // Monospace
  mono: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
} as const;

export const fonts = {
  // Font Families (using custom fonts)
  family: {
    // Body text - Inter
    body: fontFamilies.inter.regular,
    bodyMedium: fontFamilies.inter.medium,
    bodySemiBold: fontFamilies.inter.semiBold,
    bodyBold: fontFamilies.inter.bold,
    // Headings - Plus Jakarta Sans
    heading: fontFamilies.plusJakarta.regular,
    headingMedium: fontFamilies.plusJakarta.medium,
    headingSemiBold: fontFamilies.plusJakarta.semiBold,
    headingBold: fontFamilies.plusJakarta.bold,
    // Fallback
    ios: fontFamilies.system.ios,
    android: fontFamilies.system.android,
    default: fontFamilies.system.default,
    mono: fontFamilies.mono,
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

// Pre-defined text styles using custom fonts
export const textStyles = {
  // Headings - Plus Jakarta Sans
  h1: {
    fontFamily: fontFamilies.plusJakarta.bold,
    fontSize: fonts.size['3xl'],
    fontWeight: fonts.weight.bold,
    lineHeight: fonts.size['3xl'] * fonts.lineHeight.tight,
    letterSpacing: fonts.letterSpacing.tighter,
  },
  h2: {
    fontFamily: fontFamilies.plusJakarta.bold,
    fontSize: fonts.size['2xl'],
    fontWeight: fonts.weight.bold,
    lineHeight: fonts.size['2xl'] * fonts.lineHeight.tight,
    letterSpacing: fonts.letterSpacing.tight,
  },
  h3: {
    fontFamily: fontFamilies.plusJakarta.semiBold,
    fontSize: fonts.size.xl,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.xl * fonts.lineHeight.normal,
  },
  h4: {
    fontFamily: fontFamilies.plusJakarta.semiBold,
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.lg * fonts.lineHeight.normal,
  },

  // Body Text - Inter
  body: {
    fontFamily: fontFamilies.inter.regular,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },
  bodyLarge: {
    fontFamily: fontFamilies.inter.regular,
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.lg * fonts.lineHeight.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.inter.regular,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.sm * fonts.lineHeight.normal,
  },
  bodyMedium: {
    fontFamily: fontFamilies.inter.medium,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.medium,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },

  // Labels - Inter
  label: {
    fontFamily: fontFamilies.inter.semiBold,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },
  labelSmall: {
    fontFamily: fontFamilies.inter.medium,
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.medium,
    lineHeight: fonts.size.sm * fonts.lineHeight.normal,
  },

  // Button Text - Inter
  button: {
    fontFamily: fontFamilies.inter.semiBold,
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.lg * fonts.lineHeight.tight,
  },
  buttonSmall: {
    fontFamily: fontFamilies.inter.semiBold,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.semibold,
    lineHeight: fonts.size.base * fonts.lineHeight.tight,
  },

  // Input Text - Inter
  input: {
    fontFamily: fontFamilies.inter.regular,
    fontSize: fonts.size.base,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.base * fonts.lineHeight.normal,
  },

  // Caption/Helper Text - Inter
  caption: {
    fontFamily: fontFamilies.inter.regular,
    fontSize: fonts.size.xs,
    fontWeight: fonts.weight.regular,
    lineHeight: fonts.size.xs * fonts.lineHeight.normal,
  },
} as const;

export type Fonts = typeof fonts;
export type TextStyles = typeof textStyles;
export type FontFamilies = typeof fontFamilies;
