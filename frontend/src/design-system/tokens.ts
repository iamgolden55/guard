// ============================================================
// Mead Security — Design System Tokens
// Single source of truth, ported 1:1 from project/design-system.jsx.
// Mirrored into:
//   - tailwind.config.ts (theme.extend)
//   - tokens.css (CSS variables for runtime accent swapping)
// ============================================================

export const tokens = {
  color: {
    // Brand
    primary: "#cb2431",
    primaryDark: "#991b25",
    primarySoft: "#fde7e9",
    primaryInk: "#5b0a10",

    // Ink scale (neutrals)
    ink0: "#ffffff",
    ink50: "#faf9f8",
    ink100: "#f3f2f1",
    ink200: "#edebe9",
    ink300: "#e1dfdd",
    ink400: "#c8c6c4",
    ink500: "#a19f9d",
    ink600: "#605e5c",
    ink700: "#3b3a39",
    ink800: "#323130",
    ink900: "#201f1e",

    // Semantic
    success: "#0f9d58",
    successSoft: "#e6f4ea",
    successInk: "#0f5132",
    warn: "#d97706",
    warnSoft: "#fff4e5",
    warnInk: "#7a4a00",
    danger: "#cb2431",
    dangerSoft: "#fde7e9",
    dangerInk: "#991b25",
    info: "#2563eb",
    infoSoft: "#e7f0fa",
    infoInk: "#0b3a75",
  },

  font: {
    display: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'SF Mono', 'Fira Code', Consolas, monospace",
  },

  // 4px spacing scale
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48 },

  radius: { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 },

  shadow: {
    xs: "0 1px 2px rgba(32,31,30,0.04)",
    sm: "0 2px 6px -2px rgba(32,31,30,0.08), 0 1px 2px rgba(32,31,30,0.04)",
    md: "0 10px 24px -8px rgba(32,31,30,0.14), 0 4px 8px -4px rgba(32,31,30,0.06)",
    lg: "0 24px 48px -16px rgba(32,31,30,0.22), 0 8px 16px -8px rgba(32,31,30,0.10)",
    focus: "0 0 0 3px rgba(203,36,49,0.22)",
  },

  motion: {
    fast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    base: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "320ms cubic-bezier(0.4, 0, 0.2, 1)",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  },

  z: { base: 1, sticky: 10, overlay: 50, modal: 60, toast: 70 },
} as const;

export type Tokens = typeof tokens;
export type ShadowName = keyof Tokens["shadow"];
export type RadiusName = keyof Tokens["radius"];
