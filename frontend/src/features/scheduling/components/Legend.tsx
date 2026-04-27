// Legend — bottom-of-canvas key for the colour system.
// Ported 1:1 from project/scheduling-app.jsx Legend (lines 343-367).
import { tokens } from "../../../design-system/tokens";

export function Legend() {
  return (
    <div
      style={{
        margin: "0 24px",
        padding: "12px 16px",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 10,
        background: "white",
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: tokens.color.ink600,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Legend
      </span>
      <Swatch color="#0f766e" label="Published" />
      <Swatch color={tokens.color.warn} label="Draft (not yet visible to officers)" pattern />
      <Swatch color="white" label="Open — needs cover" dashed />
      <Swatch color="white" label="Hard block (expired SIA / leave)" border={tokens.color.danger} />
      <Swatch color="white" label="Soft warning (OT / rest / BH)" border={tokens.color.warn} />
    </div>
  );
}

interface SwatchProps {
  color: string;
  label: string;
  pattern?: boolean;
  dashed?: boolean;
  border?: string;
}

function Swatch({ color, label, pattern, dashed, border }: SwatchProps) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 22,
          height: 14,
          borderRadius: 3,
          background: color,
          backgroundImage: pattern
            ? "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 5px)"
            : undefined,
          border: dashed
            ? `1.5px dashed ${tokens.color.ink500}`
            : border
              ? `2px solid ${border}`
              : "1px solid rgba(0,0,0,0.08)",
        }}
      />
      <span style={{ color: tokens.color.ink800 }}>{label}</span>
    </div>
  );
}
