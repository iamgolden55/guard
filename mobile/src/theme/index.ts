/**
 * Global Theme System
 * Centralized export of all theme tokens with dark mode support
 */

// Color exports
export { colors, lightColors, darkColors, getColors } from './colors';
export type { Colors, LightColors, DarkColors } from './colors';

// Typography exports
export { fonts, textStyles, fontFamilies } from './typography';
export type { TextStyles, Fonts, FontFamilies } from './typography';

// Spacing exports
export { spacing } from './spacing';
export type { Spacing } from './spacing';

// Layout exports
export { layout } from './layout';
export type { Layout } from './layout';

// Uber theme exports
export {
  uberColors,
  uberColorsLight,
  uberColorsDark,
  getUberColors,
  uberShadows,
  uberShadowsDark,
  getUberShadows,
  uberRadius,
  uberTypography,
  getUberTypography,
  uberShiftStatus,
  uberShiftStatusLight,
  uberShiftStatusDark,
  getUberShiftStatus,
  uberSpacing,
} from './uberTheme';
export type {
  UberColors,
  UberShadows,
  UberRadius,
  UberTypography,
  UberShiftStatus,
  UberSpacing,
} from './uberTheme';

// Teams theme exports
export {
  teamsColors,
  teamsColorsLight,
  teamsColorsDark,
  getTeamsColors,
} from './teamsColors';

// Complete theme object (light mode default)
import { colors, lightColors, darkColors, getColors } from './colors';
import { fonts, textStyles, fontFamilies } from './typography';
import { spacing } from './spacing';
import { layout } from './layout';

export const theme = {
  colors,
  fonts,
  textStyles,
  fontFamilies,
  spacing,
  layout,
} as const;

// Theme with dark mode helpers
export const themeUtils = {
  getColors,
  lightColors,
  darkColors,
};

export type Theme = typeof theme;
