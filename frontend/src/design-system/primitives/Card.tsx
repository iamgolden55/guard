// MSCard — ported 1:1 from project/design-system.jsx:102-113.
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { tokens, type ShadowName } from "../tokens";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  padding?: number;
  elevation?: ShadowName;
  interactive?: boolean;
  style?: CSSProperties;
}

export function Card({
  children,
  padding = 20,
  elevation = "xs",
  interactive,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding,
        fontFamily: tokens.font.body,
        boxShadow: tokens.shadow[elevation],
        transition: interactive
          ? `box-shadow ${tokens.motion.base}, transform ${tokens.motion.base}`
          : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
