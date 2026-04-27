import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import { tokens } from "./src/design-system/tokens";

// Tokens are sourced from src/design-system/tokens.ts. Where prototype values
// override Tailwind defaults (radius, shadow), we override rather than namespace
// — the design system IS the system; Tailwind is the delivery mechanism.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: {
          DEFAULT: tokens.color.primary,
          dark: tokens.color.primaryDark,
          soft: tokens.color.primarySoft,
          ink: tokens.color.primaryInk,
        },
        // Accent — CSS-var driven so AccentContext can swap at runtime
        accent: {
          DEFAULT: "var(--ms-accent-primary)",
          dark: "var(--ms-accent-dark)",
          soft: "var(--ms-accent-soft)",
          ink: "var(--ms-accent-ink)",
        },
        // Ink scale
        ink: {
          0: tokens.color.ink0,
          50: tokens.color.ink50,
          100: tokens.color.ink100,
          200: tokens.color.ink200,
          300: tokens.color.ink300,
          400: tokens.color.ink400,
          500: tokens.color.ink500,
          600: tokens.color.ink600,
          700: tokens.color.ink700,
          800: tokens.color.ink800,
          900: tokens.color.ink900,
        },
        // Semantic
        success: {
          DEFAULT: tokens.color.success,
          soft: tokens.color.successSoft,
          ink: tokens.color.successInk,
        },
        warn: {
          DEFAULT: tokens.color.warn,
          soft: tokens.color.warnSoft,
          ink: tokens.color.warnInk,
        },
        danger: {
          DEFAULT: tokens.color.danger,
          soft: tokens.color.dangerSoft,
          ink: tokens.color.dangerInk,
        },
        info: {
          DEFAULT: tokens.color.info,
          soft: tokens.color.infoSoft,
          ink: tokens.color.infoInk,
        },
      },
      fontFamily: {
        display: tokens.font.display.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")),
        body: tokens.font.body.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")),
        mono: tokens.font.mono.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")),
      },
      borderRadius: {
        sm: `${tokens.radius.sm}px`,
        md: `${tokens.radius.md}px`,
        lg: `${tokens.radius.lg}px`,
        xl: `${tokens.radius.xl}px`,
        pill: `${tokens.radius.pill}px`,
      },
      boxShadow: {
        xs: tokens.shadow.xs,
        sm: tokens.shadow.sm,
        md: tokens.shadow.md,
        lg: tokens.shadow.lg,
        focus: tokens.shadow.focus,
      },
      transitionTimingFunction: {
        ms: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
      zIndex: {
        base: `${tokens.z.base}`,
        sticky: `${tokens.z.sticky}`,
        overlay: `${tokens.z.overlay}`,
        modal: `${tokens.z.modal}`,
        toast: `${tokens.z.toast}`,
      },
    },
  },
  plugins: [animate],
};

export default config;
