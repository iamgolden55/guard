// ============================================================
// Accent palettes — ported 1:1 from project/design-system.jsx.
// AccentContext writes document.documentElement.dataset.accent,
// which tokens.css's [data-accent="..."] selectors apply.
// ============================================================

export const accents = {
  "brand-red": { primary: "#cb2431", dark: "#991b25", soft: "#fde7e9", ink: "#5b0a10" },
  "deep-navy": { primary: "#1e3a8a", dark: "#172554", soft: "#dbeafe", ink: "#0b1d47" },
  forest: { primary: "#15803d", dark: "#14532d", soft: "#dcfce7", ink: "#0a3d1f" },
  graphite: { primary: "#27272a", dark: "#09090b", soft: "#e4e4e7", ink: "#09090b" },
} as const;

export type AccentName = keyof typeof accents;
export type Accent = (typeof accents)[AccentName];

export const DEFAULT_ACCENT: AccentName = "brand-red";
