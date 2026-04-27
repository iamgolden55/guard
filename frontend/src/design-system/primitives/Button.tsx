// MSButton — ported 1:1 from project/design-system.jsx:127-175.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { tokens } from "../tokens";
import { accents, type Accent } from "../accents";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  /** Override accent palette. Defaults to brand-red. */
  accent?: Accent;
}

const SIZES: Record<ButtonSize, { padding: string; fontSize: number; gap: number; iconSize: number }> = {
  sm: { padding: "6px 10px", fontSize: 12, gap: 6, iconSize: 14 },
  md: { padding: "9px 14px", fontSize: 13.5, gap: 8, iconSize: 16 },
  lg: { padding: "12px 18px", fontSize: 14.5, gap: 8, iconSize: 18 },
};

export function Button({
  variant = "secondary",
  size = "md",
  leading,
  trailing,
  children,
  style,
  accent = accents["brand-red"],
  ...rest
}: ButtonProps) {
  const sizing = SIZES[size];

  const variantStyles: Record<ButtonVariant, CSSProperties> = {
    primary: {
      background: accent.primary,
      color: "white",
      border: "1px solid transparent",
      boxShadow: `0 4px 10px -4px ${accent.primary}aa`,
    },
    secondary: {
      background: "white",
      color: tokens.color.ink900,
      border: `1px solid ${tokens.color.ink200}`,
      boxShadow: tokens.shadow.xs,
    },
    ghost: {
      background: "transparent",
      color: tokens.color.ink800,
      border: "1px solid transparent",
    },
    danger: {
      background: tokens.color.danger,
      color: "white",
      border: "1px solid transparent",
    },
    icon: {
      background: tokens.color.ink100,
      color: tokens.color.ink800,
      border: "1px solid transparent",
      padding: 0,
      width: size === "sm" ? 28 : size === "lg" ? 40 : 34,
      height: size === "sm" ? 28 : size === "lg" ? 40 : 34,
    },
  };

  return (
    <button
      type="button"
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: sizing.gap,
        borderRadius: tokens.radius.md,
        fontFamily: tokens.font.display,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: `background ${tokens.motion.fast}, box-shadow ${tokens.motion.fast}, transform ${tokens.motion.fast}`,
        padding: variant === "icon" ? 0 : sizing.padding,
        fontSize: sizing.fontSize,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
