/**
 * Global Color Palette
 * Dropbox-inspired clean and professional colors
 */

export const colors = {
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

export type Colors = typeof colors;
