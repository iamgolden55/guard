import { tokens } from "../../../../design-system/tokens";
import { moneyShort } from "../../data/mocks";

export interface AgingBarsProps {
  buckets: { "0-30": number; "31-60": number; "61-90": number; "90+": number };
  totalOverdue: number;
}

const BARS: [keyof AgingBarsProps["buckets"], string, string][] = [
  ["0-30", "0–30 d", "#f4b400"],
  ["31-60", "31–60 d", "#e8770c"],
  ["61-90", "61–90 d", "#d83b01"],
  ["90+", "90+ d", "#8a1820"],
];

export function AgingBars({ buckets, totalOverdue }: AgingBarsProps) {
  const max = Math.max(1, ...Object.values(buckets));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {BARS.map(([k, label, color]) => {
        const v = buckets[k] || 0;
        const pct = (v / max) * 100;
        return (
          <div
            key={k}
            style={{
              display: "grid",
              gridTemplateColumns: "64px 1fr 70px",
              alignItems: "center",
              gap: 8,
              fontFamily: tokens.font.body,
            }}
          >
            <span style={{ fontSize: 11, color: tokens.color.ink600, fontWeight: 600 }}>{label}</span>
            <div style={{ height: 8, borderRadius: 4, background: tokens.color.ink100, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: v > 0 ? color : "transparent",
                  borderRadius: 4,
                  transition: "width .35s ease",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11.5,
                color: v > 0 ? tokens.color.ink900 : tokens.color.ink500,
                fontWeight: 700,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {v > 0 ? moneyShort(v) : "—"}
            </span>
          </div>
        );
      })}
      <div
        style={{
          borderTop: `1px solid ${tokens.color.ink200}`,
          marginTop: 4,
          paddingTop: 8,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: tokens.font.body,
        }}
      >
        <span style={{ fontSize: 11, color: tokens.color.ink600, fontWeight: 600 }}>Total overdue</span>
        <span
          style={{
            fontSize: 12,
            color: "#8a1820",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {moneyShort(totalOverdue)}
        </span>
      </div>
    </div>
  );
}
