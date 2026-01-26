/**
 * Microsoft Teams Color Palette
 * Professional enterprise colors inspired by Microsoft Teams
 * Supports light and dark mode
 */

// Light mode Teams colors
export const teamsColorsLight = {
  // Primary Teams Purple
  primary: '#6264A7',
  primaryDark: '#464775',
  primaryLight: '#8B8DC7',
  primaryBg: '#F5F5F8',

  // Presence Colors
  presence: {
    available: '#92C353',      // Green - Available/Active
    away: '#FFAA44',          // Yellow - Away/On Break
    busy: '#C4314B',          // Red - Busy/Do Not Disturb
    inCall: '#00BCF2',        // Blue - In a call
    offline: '#8A8886',       // Gray - Offline
    presenting: '#7719AA',    // Purple - Presenting
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F5F5F8',
    tertiary: '#E1DFDD',
    hover: '#F3F2F1',
    selected: '#EDEBE9',
  },

  // Text Colors
  text: {
    primary: '#242424',
    secondary: '#605E5C',
    tertiary: '#8A8886',
    disabled: '#C8C6C4',
    white: '#FFFFFF',
  },

  // Border Colors
  border: {
    light: '#EDEBE9',
    medium: '#E1DFDD',
    dark: '#8A8886',
  },

  // Action Colors
  actions: {
    call: '#00BCF2',          // Light blue
    video: '#6264A7',         // Teams purple
    chat: '#00BCF2',          // Light blue
    email: '#0078D4',         // Outlook blue
  },

  // Status Colors
  status: {
    success: '#92C353',
    warning: '#FFAA44',
    error: '#C4314B',
    info: '#00BCF2',
  },

  // Semantic Colors (for compatibility with existing code)
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#F5F5F8',
    100: '#F3F2F1',
    200: '#EDEBE9',
    300: '#E1DFDD',
    400: '#8A8886',
    500: '#605E5C',
  },
};

// Dark mode Teams colors
export const teamsColorsDark = {
  // Primary Teams Purple (slightly brighter for dark mode)
  primary: '#7B7FC7',
  primaryDark: '#6264A7',
  primaryLight: '#9B9DD7',
  primaryBg: '#1F1F1F',

  // Presence Colors (same, high contrast)
  presence: {
    available: '#92C353',
    away: '#FFAA44',
    busy: '#C4314B',
    inCall: '#00BCF2',
    offline: '#6B6A68',
    presenting: '#9B4BD2',
  },

  // Background Colors (dark)
  background: {
    primary: '#1F1F1F',
    secondary: '#141414',
    tertiary: '#292929',
    hover: '#2A2A2A',
    selected: '#333333',
  },

  // Text Colors (inverted)
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B0AD',
    tertiary: '#8A8886',
    disabled: '#605E5C',
    white: '#FFFFFF',
  },

  // Border Colors (dark)
  border: {
    light: '#333333',
    medium: '#444444',
    dark: '#555555',
  },

  // Action Colors (same, high contrast)
  actions: {
    call: '#00BCF2',
    video: '#7B7FC7',
    chat: '#00BCF2',
    email: '#0078D4',
  },

  // Status Colors (same, high contrast)
  status: {
    success: '#92C353',
    warning: '#FFAA44',
    error: '#C4314B',
    info: '#00BCF2',
  },

  // Semantic Colors
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    50: '#292929',
    100: '#333333',
    200: '#444444',
    300: '#555555',
    400: '#8A8886',
    500: '#B3B0AD',
  },
};

// Legacy export for backwards compatibility
export const teamsColors = teamsColorsLight;

// Helper function to get theme-aware colors
export const getTeamsColors = (isDark: boolean) => isDark ? teamsColorsDark : teamsColorsLight;

// Export for easy migration from existing colors
export const migrateToTeamsColors = {
  primary: teamsColors.primary,
  success: teamsColors.presence.available,
  warning: teamsColors.presence.away,
  error: teamsColors.presence.busy,
};
