import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// NOTE: This config is intentionally minimal in Phase 0.
// Phase 1 (Foundation) wires MS_TOKENS into theme.extend (colors, spacing,
// borderRadius, boxShadow, fontFamily, transitionTimingFunction, zIndex)
// and adds CSS-var-driven accent colors.
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [animate],
};

export default config;
