// MSText style objects — ported 1:1 from project/design-system.jsx:91-99.
// Used by primitives for consistent typography. Spread into style={{ ...textStyles.h3 }}.
import { tokens } from "../tokens";
import type { CSSProperties } from "react";

export const textStyles = {
  h1: {
    fontFamily: tokens.font.display,
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: "-0.025em",
    lineHeight: 1.15,
    color: tokens.color.ink900,
  },
  h2: {
    fontFamily: tokens.font.display,
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    color: tokens.color.ink900,
  },
  h3: {
    fontFamily: tokens.font.display,
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "-0.015em",
    lineHeight: 1.3,
    color: tokens.color.ink900,
  },
  body: {
    fontFamily: tokens.font.body,
    fontWeight: 400,
    fontSize: 13.5,
    lineHeight: 1.5,
    color: tokens.color.ink800,
  },
  label: {
    fontFamily: tokens.font.body,
    fontWeight: 600,
    fontSize: 12,
    color: tokens.color.ink700,
  },
  mute: {
    fontFamily: tokens.font.body,
    fontWeight: 400,
    fontSize: 12,
    color: tokens.color.ink500,
  },
  over: {
    fontFamily: tokens.font.body,
    fontWeight: 700,
    fontSize: 10.5,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    color: tokens.color.ink500,
  },
} as const satisfies Record<string, CSSProperties>;

export type TextStyleName = keyof typeof textStyles;
