/**
 * Glassmorphism Color Palette
 * Modern translucent colors for liquid glass UI
 */

// Glass background colors (translucent)
export const glassColors = {
  light: 'rgba(255, 255, 255, 0.15)',
  medium: 'rgba(255, 255, 255, 0.25)',
  strong: 'rgba(255, 255, 255, 0.35)',
  dark: 'rgba(0, 0, 0, 0.2)',
  darkStrong: 'rgba(0, 0, 0, 0.4)',
} as const;

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

// Solid colors for text and borders
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

// Border colors with transparency
export const borderColors = {
  light: 'rgba(255, 255, 255, 0.2)',
  medium: 'rgba(255, 255, 255, 0.3)',
  dark: 'rgba(0, 0, 0, 0.1)',
  primary: 'rgba(30, 58, 138, 0.3)',
} as const;

// Text colors
export const textColors = {
  primary: '#1E293B',
  secondary: '#64748B',
  tertiary: '#94A3B8',
  inverse: '#FFFFFF',
  light: 'rgba(255, 255, 255, 0.9)',
  dark: 'rgba(0, 0, 0, 0.9)',
} as const;

// Status indicator colors
export const statusColors = {
  online: '#22C55E',
  offline: '#94A3B8',
  busy: '#EF4444',
  away: '#FB923C',
} as const;
