// KpiGrid + KpiCard — ported from project/dashboard.jsx:370-401.
import { useAccent } from "../../../contexts/AccentContext";
import { DeltaBadge } from "../../../design-system/charts/DeltaBadge";
import { Sparkline } from "../../../design-system/charts/Sparkline";
import { tokens } from "../../../design-system/tokens";
import type { DashboardKpi } from "../hooks/useDashboardData";

export interface KpiGridProps {
  kpis: DashboardKpi[];
  showSparklines?: boolean;
  gap?: number;
}

export function KpiGrid({
  kpis,
  showSparklines = true,
  gap = 18,
}: KpiGridProps) {
  const { palette } = useAccent();
  return (
    <div
      style={{ display: "grid", gap, gridTemplateColumns: "repeat(4, 1fr)" }}
    >
      {kpis.map((k) => (
        <KpiCard
          key={k.label}
          label={k.label}
          value={k.value}
          delta={k.delta}
          deltaDir={k.deltaDir ?? "neutral"}
          sparkData={k.sparkData}
          accentColor={palette.primary}
          showSpark={showSparklines}
        />
      ))}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaDir: "up" | "down" | "neutral";
  sparkData?: number[];
  accentColor: string;
  showSpark: boolean;
}

function KpiCard({
  label,
  value,
  delta,
  deltaDir,
  sparkData,
  accentColor,
  showSpark,
}: KpiCardProps) {
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
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            fontWeight: 500,
            fontFamily: tokens.font.body,
          }}
        >
          {label}
        </div>
        {delta && <DeltaBadge direction={deltaDir}>{delta}</DeltaBadge>}
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "-0.03em",
          color: tokens.color.ink900,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {showSpark && sparkData && (
        <div style={{ marginTop: 12 }}>
          <Sparkline data={sparkData} color={accentColor} w={200} h={36} />
        </div>
      )}
    </div>
  );
}
