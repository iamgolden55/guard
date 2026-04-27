// MSAvatar — ported 1:1 from project/design-system.jsx:200-212.
import { tokens } from "../tokens";

export interface AvatarProps {
  name?: string | null;
  /** Hue 0-360. Defaults to brand red hue. */
  hue?: number;
  size?: number;
}

export function Avatar({ name, hue = 356, size = 36 }: AvatarProps) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0] ?? "")
    .slice(0, 2)
    .join("");

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `linear-gradient(135deg, oklch(68% 0.14 ${hue}), oklch(52% 0.17 ${hue}))`,
        color: "white",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: tokens.font.display,
        fontWeight: 700,
        fontSize: size * 0.38,
        letterSpacing: "-0.01em",
        flexShrink: 0,
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)",
      }}
    >
      {initials}
    </div>
  );
}
