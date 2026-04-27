// MSInput — ported 1:1 from project/design-system.jsx:310-326.
// Ref-forwarded so react-hook-form can register it.
import { forwardRef, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { tokens } from "../tokens";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Style applied to the wrapper, not the inner <input>. */
  wrapperStyle?: CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, trailing, wrapperStyle, style, ...rest },
  ref,
) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.md,
        padding: "8px 12px",
        transition: `border-color ${tokens.motion.fast}, box-shadow ${tokens.motion.fast}`,
        ...wrapperStyle,
      }}
    >
      {leading}
      <input
        ref={ref}
        {...rest}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 13.5,
          fontFamily: tokens.font.body,
          flex: 1,
          color: tokens.color.ink900,
          ...style,
        }}
      />
      {trailing}
    </div>
  );
});
