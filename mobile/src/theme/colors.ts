/**
 * Global Color Palette
 * Light and Dark mode color definitions
 */

// Light mode colors (default)
export const lightColors = {
  // Primary Colors
  primary: '#0061FF', // Dropbox blue
  primaryDark: '#0052E0',
  primaryLight: '#3385FF',

  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F9F9F9',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Social Login Colors
  apple: '#000000',
  google: '#4285F4',
  googleBorder: '#DDDDDD',

  // Semantic Colors
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#525252',
    tertiary: '#737373',
    placeholder: '#999999',
    inverse: '#FFFFFF',
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F9F9F9',
    tertiary: '#F5F5F5',
  },

  // Border Colors
  border: {
    light: '#E5E5E5',
    medium: '#D4D4D4',
    dark: '#A3A3A3',
  },
} as const;

// Dark mode colors
export const darkColors = {
  // Primary Colors
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',

  // Neutral Colors
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

  // Social Login Colors
  apple: '#FFFFFF',
  google: '#4285F4',
  googleBorder: '#3F3F46',

  // Semantic Colors (same for visibility)
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Text Colors
  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    tertiary: '#71717A',
    placeholder: '#52525B',
    inverse: '#09090B',
  },

  // Background Colors
  background: {
    primary: '#09090B',
    secondary: '#18181B',
    tertiary: '#27272A',
  },

  // Border Colors
  border: {
    light: '#27272A',
    medium: '#3F3F46',
    dark: '#52525B',
  },
} as const;

// Default export (light colors for backwards compatibility)
export const colors = lightColors;

// Helper to get colors based on theme
export function getColors(isDark: boolean) {
  return isDark ? darkColors : lightColors;
}

export type Colors = typeof lightColors;
export type LightColors = typeof lightColors;
export type DarkColors = typeof darkColors;
