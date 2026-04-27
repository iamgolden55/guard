// CompositionCard + SiaHoldsCard + RunHistoryCard — right rail trio.
// Ported 1:1 from project/payroll-table.jsx:278-375.
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Card } from "../../../design-system/primitives/Card";
import { Pill } from "../../../design-system/primitives/Pill";
import { SectionHeader } from "../../../design-system/primitives/SectionHeader";
import { tokens } from "../../../design-system/tokens";
import {
  fmtGBPshort,
  OFFICERS,
  RUN_HISTORY,
} from "../data/mocks";

const COMPOSITION_ITEMS: { label: string; value: number; tone: string }[] = [
  { label: "Base shift hours", value: 58940, tone: tokens.color.ink900 },
  { label: "Overtime · 1.5×", value: 10820, tone: tokens.color.warn },
  { label: "Overtime · 2×", value: 3210, tone: tokens.color.dangerInk },
  { label: "Bank holiday", value: 4880, tone: "#312e81" },
  { label: "Annual leave", value: 2400, tone: tokens.color.successInk },
  { label: "Special event", value: 3960, tone: "#78350f" },
];

export function CompositionCard() {
  const { palette } = useAccent();
  const total = COMPOSITION_ITEMS.reduce((a, b) => a + b.value, 0);
  const max = Math.max(...COMPOSITION_ITEMS.map((i) => Math.abs(i.value)));
  return (
    <Card padding={20}>
      <SectionHeader title="Run composition" subtitle="Gross by InvoiceItem type" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {COMPOSITION_ITEMS.map((it) => {
          const pct = (Math.abs(it.value) / max) * 100;
          return (
            <div key={it.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: tokens.color.ink600 }}>{it.label}</span>
                <span
                  style={{
                    color: it.tone,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtGBPshort(it.value)}
                </span>
              </div>
              <div style={{ height: 4, background: tokens.color.ink100, borderRadius: 2 }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: it.tone,
                    opacity: 0.75,
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px dashed ${tokens.color.ink200}`,
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: tokens.color.ink600,
          }}
        >
          Gross total
        </span>
        <span
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 800,
            fontSize: 22,
            color: palette.primary,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.015em",
          }}
        >
          {fmtGBPshort(total)}
        </span>
      </div>
    </Card>
  );
}

export function SiaHoldsCard() {
  const flagged = OFFICERS.filter((o) => o.sia.expired || o.sia.expiresInDays <= 30);
  return (
    <Card padding={20}>
      <SectionHeader title="SIA licence holds" subtitle="Blocks new shifts · flag on payslip" />
      {flagged.length === 0 ? (
        <div style={{ fontSize: 12.5, color: tokens.color.ink500 }}>No SIA issues this run.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flagged.map((o) => {
            const exp = o.sia.expired;
            return (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: tokens.color.ink50,
                  border: `1px solid ${exp ? "#fbd0d4" : tokens.color.ink100}`,
                }}
              >
                <Avatar name={o.name} hue={o.hue} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: tokens.color.ink900,
                    }}
                  >
                    {o.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: tokens.color.ink600,
                      fontFamily: tokens.font.mono,
                    }}
                  >
                    {o.sia.level} · {o.sia.number.slice(-9)}
                  </div>
                </div>
                <Pill tone={exp ? "danger" : "warning"} dot>
                  {exp ? `Expired ${Math.abs(o.sia.expiresInDays)}d` : `${o.sia.expiresInDays}d left`}
                </Pill>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function RunHistoryCard() {
  return (
    <Card padding={20}>
      <SectionHeader
        title="Previous runs"
        right={
          <Button variant="ghost" size="sm">
            All
          </Button>
        }
      />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {RUN_HISTORY.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom:
                i === RUN_HISTORY.length - 1 ? "none" : `1px solid ${tokens.color.ink100}`,
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: tokens.color.ink900 }}>
                {r.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: tokens.color.ink500,
                  fontFamily: tokens.font.mono,
                  marginTop: 2,
                }}
              >
                {r.id} · {r.exported}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 700,
                  fontSize: 14,
                  color: tokens.color.ink900,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtGBPshort(r.gross)}
              </div>
              <Pill tone="positive" dot>
                Paid
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
