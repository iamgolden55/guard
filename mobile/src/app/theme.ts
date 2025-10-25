/**
 * Liquid Glass UI Theme Configuration
 *
 * Implements Apple's Liquid Glass design language with frosted glass effects,
 * blur backgrounds, and smooth animations.
 */

import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '@utils/constants';

export const theme = {
  // Colors
  colors: {
    ...COLORS,

    // Glass effect colors
    glass: {
      light: 'rgba(255, 255, 255, 0.1)',
      medium: 'rgba(255, 255, 255, 0.15)',
      dark: 'rgba(0, 0, 0, 0.1)',
    },

    // Backdrop blur colors
    backdrop: {
      light: 'rgba(255, 255, 255, 0.8)',
      dark: 'rgba(0, 0, 0, 0.8)',
    },
  },

  // Typography
  typography: {
    ...TYPOGRAPHY,

    // Text variants
    variants: {
      h1: {
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        fontSize: TYPOGRAPHY.fontSize.xxxl,
        lineHeight: TYPOGRAPHY.fontSize.xxxl * TYPOGRAPHY.lineHeight.tight,
        fontWeight: '700' as const,
      },
      h2: {
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        fontSize: TYPOGRAPHY.fontSize.xxl,
        lineHeight: TYPOGRAPHY.fontSize.xxl * TYPOGRAPHY.lineHeight.tight,
        fontWeight: '700' as const,
      },
      h3: {
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        fontSize: TYPOGRAPHY.fontSize.xl,
        lineHeight: TYPOGRAPHY.fontSize.xl * TYPOGRAPHY.lineHeight.normal,
        fontWeight: '600' as const,
      },
      body: {
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        fontSize: TYPOGRAPHY.fontSize.base,
        lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
        fontWeight: '400' as const,
      },
      bodyBold: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.base,
        lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.normal,
        fontWeight: '600' as const,
      },
      caption: {
        fontFamily: TYPOGRAPHY.fontFamily.regular,
        fontSize: TYPOGRAPHY.fontSize.sm,
        lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
        fontWeight: '400' as const,
      },
      button: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.fontSize.base,
        lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.tight,
        fontWeight: '600' as const,
      },
    },
  },

  // Spacing
  spacing: SPACING,

  // Border Radius
  borderRadius: BORDER_RADIUS,

  // Shadows
  shadows: SHADOWS,

  // Glass Card Styles
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.md,
  },

  // Glass Button Styles
  glassButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.9)', // iOS Blue with transparency
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 48, // Accessibility minimum
    ...SHADOWS.sm,
  },

  // Glass Input Styles
  glassInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48, // Accessibility minimum
    fontSize: TYPOGRAPHY.fontSize.base,
  },

  // Animation Durations
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
  },

  // Transitions
  transitions: {
    // Spring animation config
    spring: {
      damping: 15,
      stiffness: 100,
    },

    // Timing animation config
    timing: {
      duration: 300,
      easing: 'ease-out' as const,
    },
  },

  // Modern iOS Gradients (2025)
  gradients: {
    // iOS 18 inspired blue gradient
    primary: ['#0A84FF', '#0051D5', '#003D99'],
    // Alternative dark gradient
    dark: ['#1C1C1E', '#2C2C2E', '#3A3A3C'],
    // Success gradient
    success: ['#30D158', '#28A745', '#1E8637'],
    // Premium gradient
    premium: ['#5E5CE6', '#007AFF', '#00C7BE'],
  },

  // Enhanced Glass Effects
  glassEffects: {
    // Strong blur for modern iOS feel
    input: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.25)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
    },
    // Premium card effect
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
    },
    // Biometric button
    biometric: {
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
  },
};

// Type definitions
export type Theme = typeof theme;
export type ThemeColors = typeof theme.colors;
export type ThemeTypography = typeof theme.typography;
export type ThemeSpacing = typeof theme.spacing;

// Export default
export default theme;
