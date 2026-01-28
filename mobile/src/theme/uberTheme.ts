/**
 * Uber-Inspired Theme System
 * Minimalist black/white/gray color palette with dark mode support
 */

import { fontFamilies } from './typography';

// Light mode colors
export const uberColorsLight = {
  // Primary - Uber Black
  primary: '#000000',
  primaryAccent: '#2D3E50',  // Deep slate for accents
  uberBlue: '#276EF1',       // Accent blue (used sparingly)

  // Backgrounds
  background: {
    light: '#F8F8F8',        // Page background
    dark: '#121212',         // Dark mode bg
    surface: '#FFFFFF',      // Cards
    surfaceDark: '#1F1F1F',  // Dark mode cards
  },

  // Text - Gray scale
  text: {
    primary: '#111827',      // gray-900
    secondary: '#6B7280',    // gray-500
    muted: '#9CA3AF',        // gray-400
    inverse: '#FFFFFF',
  },

  // Borders
  border: {
    light: '#E5E7EB',        // gray-200
    medium: '#D1D5DB',       // gray-300
    dark: '#9CA3AF',         // gray-400
  },

  // Status colors
  success: '#22C55E',        // green-500
  successLight: '#DCFCE7',   // green-100
  error: '#EF4444',          // red-500
  errorLight: '#FEE2E2',     // red-100
  warning: '#F59E0B',        // amber-500
  info: '#3B82F6',           // blue-500

  // Disabled state
  disabled: '#E5E7EB',       // gray-200
  disabledText: '#9CA3AF',   // gray-400

  // Online status
  online: '#22C55E',
  offline: '#9CA3AF',
} as const;

// Dark mode colors
export const uberColorsDark = {
  // Primary - Uber White
  primary: '#FFFFFF',
  primaryAccent: '#94A3B8',  // Light slate for accents
  uberBlue: '#60A5FA',       // Lighter accent blue

  // Backgrounds
  background: {
    light: '#09090B',        // Page background (dark)
    dark: '#121212',         // Dark mode bg
    surface: '#18181B',      // Cards (dark)
    surfaceDark: '#1F1F1F',  // Dark mode cards
  },

  // Text - Gray scale (inverted)
  text: {
    primary: '#FAFAFA',      // Near white
    secondary: '#A1A1AA',    // zinc-400
    muted: '#71717A',        // zinc-500
    inverse: '#09090B',
  },

  // Borders (darker)
  border: {
    light: '#27272A',        // zinc-800
    medium: '#3F3F46',       // zinc-700
    dark: '#52525B',         // zinc-600
  },

  // Status colors (same for visibility)
  success: '#22C55E',
  successLight: '#14532D',   // green-900
  error: '#EF4444',
  errorLight: '#7F1D1D',     // red-900
  warning: '#F59E0B',
  info: '#60A5FA',           // lighter blue

  // Disabled state
  disabled: '#27272A',       // zinc-800
  disabledText: '#52525B',   // zinc-600

  // Online status
  online: '#22C55E',
  offline: '#52525B',
} as const;

// Default export (light mode for backwards compatibility)
export const uberColors = uberColorsLight;

// Helper function to get colors based on theme
export function getUberColors(isDark: boolean) {
  return isDark ? uberColorsDark : uberColorsLight;
}

// Uber shadows - subtle and modern
export const uberShadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  float: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
};

// Dark mode shadows (more subtle)
export const uberShadowsDark = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },
  float: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 8,
  },
};

export function getUberShadows(isDark: boolean) {
  return isDark ? uberShadowsDark : uberShadows;
}

// Uber border radius
export const uberRadius = {
  sm: 4,
  default: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
};

// Uber typography with custom fonts
export const uberTypography = {
  // Headers - Plus Jakarta Sans
  greeting: {
    fontSize: 24,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 14,
    fontFamily: fontFamilies.inter.medium,
    fontWeight: '500' as const,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700' as const,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.inter.regular,
    fontWeight: '400' as const,
  },
  time: {
    fontSize: 12,
    fontFamily: fontFamilies.mono,
    fontWeight: '500' as const,
  },
  button: {
    fontSize: 14,
    fontFamily: fontFamilies.inter.semiBold,
    fontWeight: '600' as const,
  },
  statNumber: {
    fontSize: 30,
    fontFamily: fontFamilies.plusJakarta.bold,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.inter.medium,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: fontFamilies.inter.semiBold,
    fontWeight: '600' as const,
  },
};

// Function to get typography with colors based on theme
export function getUberTypography(isDark: boolean) {
  const colors = getUberColors(isDark);
  return {
    ...uberTypography,
    greeting: { ...uberTypography.greeting, color: colors.text.primary },
    date: { ...uberTypography.date, color: colors.text.secondary },
    cardTitle: { ...uberTypography.cardTitle, color: colors.text.primary },
    cardSubtitle: { ...uberTypography.cardSubtitle, color: colors.text.secondary },
    time: { ...uberTypography.time, color: colors.text.muted },
    statNumber: { ...uberTypography.statNumber, color: colors.text.primary },
    statLabel: { ...uberTypography.statLabel, color: colors.text.secondary },
  };
}

// Shift status colors for Uber-style shifts page
export const uberShiftStatusLight = {
  pending: { bg: '#F8F8F8', text: '#9CA3AF' },
  confirmed: { bg: '#DCFCE7', text: '#22C55E' },
  scheduled: { bg: '#DCFCE7', text: '#22C55E' },
  inProgress: { bg: '#DBEAFE', text: '#3B82F6' },
  in_progress: { bg: '#DBEAFE', text: '#3B82F6' },
  completed: { bg: '#F8F8F8', text: '#111827' },
  approved: { bg: '#F8F8F8', text: '#111827' },
  cancelled: { bg: '#FEE2E2', text: '#EF4444' },
} as const;

export const uberShiftStatusDark = {
  pending: { bg: '#27272A', text: '#71717A' },
  confirmed: { bg: '#14532D', text: '#22C55E' },
  scheduled: { bg: '#14532D', text: '#22C55E' },
  inProgress: { bg: '#1E3A8A', text: '#60A5FA' },
  in_progress: { bg: '#1E3A8A', text: '#60A5FA' },
  completed: { bg: '#27272A', text: '#FAFAFA' },
  approved: { bg: '#27272A', text: '#FAFAFA' },
  cancelled: { bg: '#7F1D1D', text: '#EF4444' },
} as const;

export const uberShiftStatus = uberShiftStatusLight;

export function getUberShiftStatus(isDark: boolean) {
  return isDark ? uberShiftStatusDark : uberShiftStatusLight;
}

// Spacing system for Uber-style components
export const uberSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export type UberColors = typeof uberColorsLight;
export type UberShadows = typeof uberShadows;
export type UberRadius = typeof uberRadius;
export type UberTypography = typeof uberTypography;
export type UberShiftStatus = typeof uberShiftStatusLight;
export type UberSpacing = typeof uberSpacing;
