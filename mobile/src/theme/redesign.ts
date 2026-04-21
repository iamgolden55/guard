/**
 * Redesign Theme Tokens — Launch & Onboarding + Dashboard & Check-in redesign
 *
 * Derived from the design handoffs:
 *   - Dark: near-black canvas (#0b0b0e), red accent (#E1342C)
 *   - Light: warm paper canvas (#f6f5f1), ink text (#0b0b0e), red accent retained
 *   - Geist / Geist Mono typography — falls back to System/SF Mono
 *
 * Kept self-contained so the existing light theme in src/theme/index.ts is untouched.
 *
 * `redesignColors` remains the dark palette (back-compat for onboarding V2).
 * `useRedesignTheme()` picks light/dark based on the OS color scheme.
 */

import { Platform, useColorScheme } from 'react-native';

// ─────────────────────────────────────────────────────────────
// Dark palette (default — matches onboarding V2)
// ─────────────────────────────────────────────────────────────
export const redesignColors = {
  canvas: '#0b0b0e',
  canvasElevated: '#141417',
  accent: '#E1342C',
  accentSoft: 'rgba(225,52,44,0.18)',
  accentBorder: 'rgba(225,52,44,0.40)',
  accentGlow: 'rgba(225,52,44,0.45)',

  text: {
    primary: '#ffffff',
    secondary: 'rgba(255,255,255,0.55)',
    tertiary: 'rgba(255,255,255,0.35)',
    quaternary: 'rgba(255,255,255,0.22)',
  },

  surface: {
    hairline: 'rgba(255,255,255,0.08)',
    hairlineStrong: 'rgba(255,255,255,0.14)',
    card: 'rgba(255,255,255,0.04)',
    chip: 'rgba(255,255,255,0.06)',
    overlay: 'rgba(255,255,255,0.10)',
  },

  status: {
    online: '#4ade80',
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Light palette (warm paper canvas)
// ─────────────────────────────────────────────────────────────
export const redesignColorsLight = {
  canvas: '#f6f5f1',
  canvasElevated: '#ffffff',
  accent: '#E1342C',
  accentSoft: 'rgba(225,52,44,0.14)',
  accentBorder: 'rgba(225,52,44,0.40)',
  accentGlow: 'rgba(225,52,44,0.35)',

  text: {
    primary: '#0b0b0e',
    secondary: 'rgba(11,11,14,0.60)',
    tertiary: 'rgba(11,11,14,0.40)',
    quaternary: 'rgba(11,11,14,0.22)',
  },

  surface: {
    hairline: 'rgba(11,11,14,0.08)',
    hairlineStrong: 'rgba(11,11,14,0.14)',
    card: 'rgba(11,11,14,0.03)',
    chip: 'rgba(11,11,14,0.05)',
    overlay: 'rgba(11,11,14,0.08)',
  },

  status: {
    online: '#16a34a',
  },
} as const;

export type RedesignPalette = typeof redesignColors;

// ─────────────────────────────────────────────────────────────
// Radii / spacing / fonts — shared between themes
// ─────────────────────────────────────────────────────────────
export const redesignRadii = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  card: 22,
  pill: 999,
} as const;

export const redesignSpacing = {
  gutter: 28,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const redesignFonts = {
  sans: Platform.select({ ios: 'System', android: 'Roboto', default: 'System' }) as string,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
} as const;

// ─────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────
// The original `redesignText` is kept pointing at the dark palette so
// onboarding V2 stays unchanged. The helper below produces theme-aware
// variants for the dashboard/check-in screens.
export const redesignText = {
  display: {
    fontFamily: redesignFonts.sans,
    fontSize: 36,
    fontWeight: '400' as const,
    letterSpacing: -1.0,
    lineHeight: 40,
    color: redesignColors.text.primary,
  },
  title: {
    fontFamily: redesignFonts.sans,
    fontSize: 32,
    fontWeight: '400' as const,
    letterSpacing: -0.8,
    lineHeight: 38,
    color: redesignColors.text.primary,
  },
  heading: {
    fontFamily: redesignFonts.sans,
    fontSize: 26,
    fontWeight: '400' as const,
    letterSpacing: -0.6,
    lineHeight: 32,
    color: redesignColors.text.primary,
  },
  body: {
    fontFamily: redesignFonts.sans,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: redesignColors.text.secondary,
  },
  bodyLarge: {
    fontFamily: redesignFonts.sans,
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    color: redesignColors.text.primary,
  },
  eyebrow: {
    fontFamily: redesignFonts.mono,
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 2.2,
    textTransform: 'uppercase' as const,
    color: redesignColors.accent,
  },
  meta: {
    fontFamily: redesignFonts.mono,
    fontSize: 10,
    fontWeight: '400' as const,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: redesignColors.text.secondary,
  },
  button: {
    fontFamily: redesignFonts.sans,
    fontSize: 16,
    fontWeight: '500' as const,
    letterSpacing: -0.2,
    color: redesignColors.text.primary,
  },
} as const;

export const redesignShadows = {
  primaryGlow: {
    shadowColor: redesignColors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 12,
  },
  deviceDrop: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.35,
    shadowRadius: 48,
    elevation: 18,
  },
} as const;

// ─────────────────────────────────────────────────────────────
// Theme-aware hook
// ─────────────────────────────────────────────────────────────
export interface RedesignTheme {
  isDark: boolean;
  colors: RedesignPalette;
  radii: typeof redesignRadii;
  spacing: typeof redesignSpacing;
  fonts: typeof redesignFonts;
  shadows: typeof redesignShadows;
  /** Pre-composed white/ink overlay used by buttons; light theme gets dark ink. */
  cta: {
    bg: string;
    fg: string;
    glow: string;
  };
  /** Keyline ("hairline") row divider. */
  divider: string;
  /** Shift-card header gradient stops (top → bottom). */
  shiftCardGradient: [string, string];
  /** Border color for the live-shift card. */
  shiftCardBorder: string;
}

function buildTheme(isDark: boolean): RedesignTheme {
  const colors = (isDark ? redesignColors : redesignColorsLight) as RedesignPalette;
  return {
    isDark,
    colors,
    radii: redesignRadii,
    spacing: redesignSpacing,
    fonts: redesignFonts,
    shadows: redesignShadows,
    cta: {
      bg: colors.accent,
      fg: '#ffffff',
      glow: colors.accentGlow,
    },
    divider: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(11,11,14,0.06)',
    shiftCardGradient: isDark
      ? ['#3a1614', '#181317']
      : ['#fddfdc', '#fbf5f4'],
    shiftCardBorder: colors.accentBorder,
  };
}

export function useRedesignTheme(): RedesignTheme {
  const scheme = useColorScheme();
  return buildTheme(scheme !== 'light');
}

export function getRedesignTheme(isDark: boolean): RedesignTheme {
  return buildTheme(isDark);
}
