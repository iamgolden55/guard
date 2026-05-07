import { tokens } from "../design-system/tokens";

export interface SpinnerProps {
  size?: number;
  /** CSS color value. Defaults to brand red. */
  color?: string;
}

export function Spinner({ size = 28, color = tokens.color.primary }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        width: size,
        height: size,
        display: "inline-block",
        border: `2px solid ${tokens.color.ink200}`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "ms-spin 0.8s linear infinite",
      }}
    />
  );
}
