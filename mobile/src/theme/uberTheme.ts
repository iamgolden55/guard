/**
 * Uber-Inspired Theme System
 * Minimalist black/white/gray color palette for modern dashboard
 */

export const uberColors = {
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

// Uber typography (Plus Jakarta Sans feel with system fonts)
export const uberTypography = {
  // Headers
  greeting: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: uberColors.text.primary,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: uberColors.text.secondary,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: uberColors.text.primary,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: uberColors.text.secondary,
  },
  time: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: uberColors.text.muted,
    fontFamily: 'monospace',
  },
  button: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: uberColors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: uberColors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
};

// Shift status colors for Uber-style shifts page
export const uberShiftStatus = {
  pending: { bg: '#F8F8F8', text: '#9CA3AF' },
  confirmed: { bg: '#DCFCE7', text: '#22C55E' },
  scheduled: { bg: '#DCFCE7', text: '#22C55E' },
  inProgress: { bg: '#DBEAFE', text: '#3B82F6' },
  in_progress: { bg: '#DBEAFE', text: '#3B82F6' },
  completed: { bg: '#F8F8F8', text: '#111827' },
  approved: { bg: '#F8F8F8', text: '#111827' },
  cancelled: { bg: '#FEE2E2', text: '#EF4444' },
} as const;

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

export type UberColors = typeof uberColors;
export type UberShadows = typeof uberShadows;
export type UberRadius = typeof uberRadius;
export type UberTypography = typeof uberTypography;
export type UberShiftStatus = typeof uberShiftStatus;
export type UberSpacing = typeof uberSpacing;
