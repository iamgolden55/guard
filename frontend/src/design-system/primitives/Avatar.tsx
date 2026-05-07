// MSAvatar — ported 1:1 from project/design-system.jsx:200-212.
import { tokens } from "../tokens";

export interface AvatarProps {
  name?: string | null;
  /**
   * Hue 0-360. When omitted, a stable hue is derived from the `name` so each
   * person renders in a consistent unique-ish colour across reloads.
   */
  hue?: number;
  size?: number;
}

// djb2-style hash → modulo 360. Stable per input string.
function hueFromName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  // Force positive int (>>> 0), then map to hue range.
  return (hash >>> 0) % 360;
}

export function Avatar({ name, hue, size = 36 }: AvatarProps) {
  const safeName = (name ?? "").trim();
  const resolvedHue = hue ?? (safeName ? hueFromName(safeName.toLowerCase()) : 356);
  const initials = (safeName || "?")
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .slice(0, 2)
    .join("");

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: `linear-gradient(135deg, oklch(68% 0.14 ${resolvedHue}), oklch(52% 0.17 ${resolvedHue}))`,
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
