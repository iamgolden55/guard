/**
 * Glassmorphism Color Palette
 * Modern translucent colors for liquid glass UI
 * Supports both light and dark modes
 */

// Glass background colors (translucent) - Light Mode
export const glassColors = {
  light: 'rgba(255, 255, 255, 0.15)',
  medium: 'rgba(255, 255, 255, 0.25)',
  strong: 'rgba(255, 255, 255, 0.35)',
  dark: 'rgba(0, 0, 0, 0.2)',
  darkStrong: 'rgba(0, 0, 0, 0.4)',
} as const;

// Glass background colors - Dark Mode
export const glassColorsDark = {
  light: 'rgba(255, 255, 255, 0.05)',
  medium: 'rgba(255, 255, 255, 0.10)',
  strong: 'rgba(255, 255, 255, 0.15)',
  dark: 'rgba(0, 0, 0, 0.4)',
  darkStrong: 'rgba(0, 0, 0, 0.6)',
} as const;

// Helper to get glass colors based on theme
export function getGlassColors(isDark: boolean) {
  return isDark ? glassColorsDark : glassColors;
}

// Accent colors with transparency
export const accentColors = {
  primary: 'rgba(30, 58, 138, 0.9)',      // Deep Blue
  primaryLight: 'rgba(30, 58, 138, 0.6)',
  success: 'rgba(34, 197, 94, 0.9)',      // Green
  successLight: 'rgba(34, 197, 94, 0.6)',
  warning: 'rgba(251, 146, 60, 0.9)',     // Orange
  warningLight: 'rgba(251, 146, 60, 0.6)',
  danger: 'rgba(239, 68, 68, 0.9)',       // Red
  dangerLight: 'rgba(239, 68, 68, 0.6)',
  secondary: 'rgba(100, 116, 139, 0.9)',  // Gray
  secondaryLight: 'rgba(100, 116, 139, 0.6)',
  info: 'rgba(59, 130, 246, 0.9)',        // Light Blue
  infoLight: 'rgba(59, 130, 246, 0.6)',
} as const;

// Accent colors - Dark Mode (slightly adjusted opacity)
export const accentColorsDark = {
  primary: 'rgba(96, 165, 250, 0.9)',      // Lighter Blue
  primaryLight: 'rgba(96, 165, 250, 0.6)',
  success: 'rgba(34, 197, 94, 0.9)',      // Green (same)
  successLight: 'rgba(34, 197, 94, 0.5)',
  warning: 'rgba(251, 146, 60, 0.9)',     // Orange (same)
  warningLight: 'rgba(251, 146, 60, 0.5)',
  danger: 'rgba(239, 68, 68, 0.9)',       // Red (same)
  dangerLight: 'rgba(239, 68, 68, 0.5)',
  secondary: 'rgba(161, 161, 170, 0.9)',  // Lighter Gray
  secondaryLight: 'rgba(161, 161, 170, 0.5)',
  info: 'rgba(96, 165, 250, 0.9)',        // Lighter Blue
  infoLight: 'rgba(96, 165, 250, 0.5)',
} as const;

export function getAccentColors(isDark: boolean) {
  return isDark ? accentColorsDark : accentColors;
}

// Solid colors for text and borders - Light Mode
export const solidColors = {
  primary: '#1E3A8A',
  success: '#22C55E',
  warning: '#FB923C',
  danger: '#EF4444',
  secondary: '#64748B',
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as const;

// Solid colors - Dark Mode
export const solidColorsDark = {
  primary: '#60A5FA',
  success: '#22C55E',
  warning: '#FB923C',
  danger: '#EF4444',
  secondary: '#A1A1AA',
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#18181B',
    100: '#27272A',
    200: '#3F3F46',
    300: '#52525B',
    400: '#71717A',
    500: '#A1A1AA',
    600: '#D4D4D8',
    700: '#E4E4E7',
    800: '#F4F4F5',
    900: '#FAFAFA',
  },
} as const;

export function getSolidColors(isDark: boolean) {
  return isDark ? solidColorsDark : solidColors;
}

// Gradient colors for backgrounds
export const gradients = {
  primary: ['#1E3A8A', '#3B82F6'],
  success: ['#22C55E', '#4ADE80'],
  warning: ['#FB923C', '#FDBA74'],
  danger: ['#EF4444', '#F87171'],
  purple: ['#7C3AED', '#A78BFA'],
  ocean: ['#0EA5E9', '#06B6D4'],
  sunset: ['#F59E0B', '#EF4444'],
} as const;

// Gradient colors - Dark Mode (adjusted for dark backgrounds)
export const gradientsDark = {
  primary: ['#1E40AF', '#60A5FA'],
  success: ['#166534', '#4ADE80'],
  warning: ['#B45309', '#FBBF24'],
  danger: ['#991B1B', '#F87171'],
  purple: ['#5B21B6', '#A78BFA'],
  ocean: ['#0369A1', '#22D3EE'],
  sunset: ['#B45309', '#F87171'],
} as const;

export function getGradients(isDark: boolean) {
  return isDark ? gradientsDark : gradients;
}

// Border colors with transparency - Light Mode
export const borderColors = {
  light: 'rgba(255, 255, 255, 0.2)',
  medium: 'rgba(255, 255, 255, 0.3)',
  dark: 'rgba(0, 0, 0, 0.1)',
  primary: 'rgba(30, 58, 138, 0.3)',
} as const;

// Border colors - Dark Mode
export const borderColorsDark = {
  light: 'rgba(255, 255, 255, 0.1)',
  medium: 'rgba(255, 255, 255, 0.15)',
  dark: 'rgba(255, 255, 255, 0.05)',
  primary: 'rgba(96, 165, 250, 0.3)',
} as const;

export function getBorderColors(isDark: boolean) {
  return isDark ? borderColorsDark : borderColors;
}

// Text colors - Light Mode
export const textColors = {
  primary: '#1E293B',
  secondary: '#64748B',
  tertiary: '#94A3B8',
  inverse: '#FFFFFF',
  light: 'rgba(255, 255, 255, 0.9)',
  dark: 'rgba(0, 0, 0, 0.9)',
} as const;

// Text colors - Dark Mode
export const textColorsDark = {
  primary: '#FAFAFA',
  secondary: '#A1A1AA',
  tertiary: '#71717A',
  inverse: '#09090B',
  light: 'rgba(255, 255, 255, 0.9)',
  dark: 'rgba(0, 0, 0, 0.9)',
} as const;

export function getTextColors(isDark: boolean) {
  return isDark ? textColorsDark : textColors;
}

// Status indicator colors (same for both modes for visibility)
export const statusColors = {
  online: '#22C55E',
  offline: '#94A3B8',
  busy: '#EF4444',
  away: '#FB923C',
} as const;

// Status colors - Dark Mode (slightly adjusted offline)
export const statusColorsDark = {
  online: '#22C55E',
  offline: '#52525B',
  busy: '#EF4444',
  away: '#FB923C',
} as const;

export function getStatusColors(isDark: boolean) {
  return isDark ? statusColorsDark : statusColors;
}
