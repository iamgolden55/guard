/**
 * Theme Context
 * Provides system-aware dark/light mode theming
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme, ColorSchemeName } from 'react-native';
import { StatusBarStyle } from 'expo-status-bar';

// Light mode colors
export const lightColors = {
  // Primary Colors
  primary: '#0061FF',
  primaryDark: '#0052E0',
  primaryLight: '#3385FF',

  // Backgrounds
  background: {
    primary: '#FFFFFF',
    secondary: '#F9F9F9',
    tertiary: '#F5F5F5',
    surface: '#FFFFFF',
  },

  // Text Colors
  text: {
    primary: '#000000',
    secondary: '#525252',
    tertiary: '#737373',
    placeholder: '#999999',
    inverse: '#FFFFFF',
  },

  // Gray Scale
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

  // Borders
  border: {
    light: '#E5E5E5',
    medium: '#D4D4D4',
    dark: '#A3A3A3',
  },

  // Semantic Colors
  success: '#22C55E',
  successLight: '#DCFCE7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Social Login
  apple: '#000000',
  google: '#4285F4',
  googleBorder: '#DDDDDD',

  // Status Colors
  online: '#22C55E',
  offline: '#9CA3AF',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  separator: 'rgba(60, 60, 67, 0.29)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  card: '#FFFFFF',
} as const;

// Dark mode colors
export const darkColors = {
  // Primary Colors (same, high contrast)
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',

  // Backgrounds
  background: {
    primary: '#09090B',
    secondary: '#18181B',
    tertiary: '#27272A',
    surface: '#18181B',
  },

  // Text Colors
  text: {
    primary: '#FAFAFA',
    secondary: '#A1A1AA',
    tertiary: '#71717A',
    placeholder: '#52525B',
    inverse: '#09090B',
  },

  // Gray Scale (inverted)
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

  // Borders
  border: {
    light: '#27272A',
    medium: '#3F3F46',
    dark: '#52525B',
  },

  // Semantic Colors (same for visibility)
  success: '#22C55E',
  successLight: '#14532D',
  error: '#EF4444',
  errorLight: '#7F1D1D',
  warning: '#F59E0B',
  warningLight: '#78350F',
  info: '#3B82F6',
  infoLight: '#1E3A8A',

  // Social Login
  apple: '#FFFFFF',
  google: '#4285F4',
  googleBorder: '#3F3F46',

  // Status Colors
  online: '#22C55E',
  offline: '#52525B',

  // Misc
  white: '#FFFFFF',
  black: '#000000',
  separator: 'rgba(255, 255, 255, 0.15)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  card: '#18181B',
} as const;

export type ThemeColors = typeof lightColors;

interface ThemeContextValue {
  isDark: boolean;
  colorScheme: ColorSchemeName;
  colors: ThemeColors;
  statusBarStyle: StatusBarStyle;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const value = useMemo<ThemeContextValue>(() => ({
    isDark,
    colorScheme,
    colors: isDark ? darkColors : lightColors,
    statusBarStyle: isDark ? 'light' : 'dark',
  }), [isDark, colorScheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Helper to get colors outside of React components
export function getThemeColors(isDark: boolean): ThemeColors {
  return isDark ? darkColors : lightColors;
}
