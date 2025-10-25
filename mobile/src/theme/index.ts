/**
 * Global Theme System
 * Centralized export of all theme tokens
 */

export { colors } from './colors';
export { fonts, textStyles } from './typography';
export { spacing } from './spacing';
export { layout } from './layout';

export type { Colors } from './colors';
export type { TextStyles } from './typography';
export type { Spacing } from './spacing';
export type { Layout } from './layout';

// Complete theme object
import { colors } from './colors';
import { fonts, textStyles } from './typography';
import { spacing } from './spacing';
import { layout } from './layout';

export const theme = {
  colors,
  fonts,
  textStyles,
  spacing,
  layout,
} as const;

export type Theme = typeof theme;
