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
  type Officer,
  type PayrollCycle,
  type PayrollHistoryRun,
} from "../data/mocks";
import {
  useRunComposition,
  useRunHistory,
  useRunSiaHolds,
} from "../hooks/usePayrollData";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "1";

const COMPOSITION_FALLBACK: { label: string; value: number; tone: string }[] = [
  { label: "Base shift hours", value: 58940, tone: tokens.color.ink900 },
  { label: "Overtime · 1.5×", value: 10820, tone: tokens.color.warn },
  { label: "Overtime · 2×", value: 3210, tone: tokens.color.dangerInk },
  { label: "Bank holiday", value: 4880, tone: "#312e81" },
  { label: "Annual leave", value: 2400, tone: tokens.color.successInk },
  { label: "Special event", value: 3960, tone: "#78350f" },
];

const COMPOSITION_LABELS: { key: string; label: string; tone: string }[] = [
  { key: "shift", label: "Base shift hours", tone: tokens.color.ink900 },
  { key: "overtime_1", label: "Overtime · 1.5×", tone: tokens.color.warn },
  { key: "overtime_2", label: "Overtime · 2×", tone: tokens.color.dangerInk },
  { key: "bank_holiday", label: "Bank holiday", tone: "#312e81" },
  { key: "annual_leave", label: "Annual leave", tone: tokens.color.successInk },
  { key: "special", label: "Special event", tone: "#78350f" },
];

export interface CompositionCardProps {
  runCode?: string | null;
}

export function CompositionCard({ runCode }: CompositionCardProps = {}) {
  const { palette } = useAccent();
  const compositionQuery = useRunComposition(USE_MOCKS ? null : runCode);
  const items = USE_MOCKS || !compositionQuery.data
    ? COMPOSITION_FALLBACK
    : COMPOSITION_LABELS.map((m) => ({
        label: m.label,
        value: Number(compositionQuery.data?.[m.key] ?? 0),
        tone: m.tone,
      }));
  const total = items.reduce((a, b) => a + b.value, 0) || 0;
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <Card padding={20}>
      <SectionHeader title="Run composition" subtitle="Gross by InvoiceItem type" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it) => {
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

export interface SiaHoldsCardProps {
  runCode?: string | null;
}

export function SiaHoldsCard({ runCode }: SiaHoldsCardProps = {}) {
  const siaQuery = useRunSiaHolds(USE_MOCKS ? null : runCode);
  const sourceList: Officer[] = USE_MOCKS ? OFFICERS : (siaQuery.data ?? []);
  const flagged = sourceList.filter((o) => o.sia.expired || o.sia.expiresInDays <= 30);
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

export interface RunHistoryCardProps {
  /** Currently active run code — highlights the matching row. */
  activeRunCode?: string | null;
  /** Click handler — receives the clicked row's run code. */
  onSelect?: (runCode: string) => void;
  /** Pay cycle to load history for ('weekly' | 'monthly'). */
  cycle?: PayrollCycle;
}

export function RunHistoryCard({ activeRunCode, onSelect, cycle = "weekly" }: RunHistoryCardProps = {}) {
  const historyQuery = useRunHistory(cycle);
  // P6 (M6 fix): no mock fallback when real API returns empty. An empty list
  // is a valid state — show "No previous runs" instead of test data.
  const list: PayrollHistoryRun[] = USE_MOCKS ? RUN_HISTORY : (historyQuery.data ?? []);
  return (
    <Card padding={20}>
      <SectionHeader title="Previous runs" />
      {list.length === 0 ? (
        <div
          style={{
            fontSize: 12,
            color: tokens.color.ink500,
            padding: "12px 0",
          }}
        >
          No previous runs yet.
        </div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map((r, i) => (
          <button
            type="button"
            key={r.id}
            onClick={() => onSelect?.(r.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom:
                i === list.length - 1 ? "none" : `1px solid ${tokens.color.ink100}`,
              background: r.id === activeRunCode ? tokens.color.ink50 : "transparent",
              border: "none",
              borderLeft: r.id === activeRunCode ? `3px solid ${tokens.color.ink900}` : "3px solid transparent",
              paddingLeft: 8,
              cursor: onSelect ? "pointer" : "default",
              fontFamily: "inherit",
              textAlign: "left",
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
              <Pill
                tone={
                  r.status === "paid"
                    ? "positive"
                    : r.status === "rejected"
                      ? "danger"
                      : "warning"
                }
                dot
              >
                {r.status === "paid"
                  ? "Paid"
                  : r.status === "rejected"
                    ? "Rejected"
                    : "Pending"}
              </Pill>
            </div>
          </button>
        ))}
      </div>
      )}
    </Card>
  );
}
