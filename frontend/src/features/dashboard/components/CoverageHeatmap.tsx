// CoverageHeatmap — wraps the design-system Heatmap with the
// dashboard's section header. Ported from project/dashboard.jsx:421-487.
import { useAccent } from "../../../contexts/AccentContext";
import { Heatmap } from "../../../design-system/charts/Heatmap";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";

export interface CoverageHeatmapProps {
  data: number[][];
}

export function CoverageHeatmap({ data }: CoverageHeatmapProps) {
  const { palette } = useAccent();
  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding: 20,
        fontFamily: tokens.font.body,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: tokens.color.ink900,
            }}
          >
            Coverage by day × hour
          </h3>
          <div style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 2 }}>
            Last 7 days · staffed vs required
          </div>
        </div>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: palette.primary,
            fontFamily: tokens.font.body,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Expand <Icon name="chevron-right" size={12} />
        </button>
      </div>
      <Heatmap data={data} accentHex={palette.primary} />
    </div>
  );
}
