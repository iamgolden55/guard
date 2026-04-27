// RunHero — headline weekly run module.
// Ported 1:1 from project/payroll-hero.jsx:16-108.
import { useAccent } from "../../../contexts/AccentContext";
import { Button } from "../../../design-system/primitives/Button";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  fmtGBPbig,
  OFFICERS,
  type PayrollRun,
} from "../data/mocks";

export interface RunHeroProps {
  run: PayrollRun;
  onOpenExport: () => void;
  onGeneratePdfs: () => void;
}

export function RunHero({ run, onOpenExport, onGeneratePdfs }: RunHeroProps) {
  const { palette } = useAccent();
  const paidCount = OFFICERS.filter((o) => o.status === "paid").length;
  const rejectedCount = OFFICERS.filter((o) => o.status === "rejected").length;
  const pendingCount = OFFICERS.filter((o) => o.status === "pending").length;
  const exportedCount = OFFICERS.filter((o) => o.exportStatus === "completed").length;
  const deltaPct = ((run.grossTotal - run.prevGross) / run.prevGross) * 100;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 14,
        padding: 0,
      }}
    >
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${palette.primary}, ${palette.dark})`,
        }}
      />

      <div
        style={{
          padding: "24px 28px",
          display: "grid",
          gridTemplateColumns: "1.1fr 1.4fr minmax(220px, auto)",
          gap: 28,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <Pill tone="warning" dot>
              {run.invoices - paidCount - rejectedCount} pending
            </Pill>
            <span
              style={{
                fontSize: 12,
                color: tokens.color.ink600,
                fontFamily: tokens.font.mono,
              }}
            >
              {run.id}
            </span>
            <span style={{ fontSize: 11, color: tokens.color.ink500 }}>·</span>
            <span style={{ fontSize: 12, color: tokens.color.ink600 }}>
              Generated <strong style={{ color: tokens.color.ink900 }}>Mon 27 Apr</strong>
            </span>
          </div>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: tokens.color.ink900,
              lineHeight: 1.1,
            }}
          >
            {run.label}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: tokens.color.ink600, lineHeight: 1.5 }}>
            {run.invoices} invoices · {run.lineItems} line items · {run.hoursBilled.toLocaleString()}{" "}
            hrs · processed every Monday
          </div>

          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "flex",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
                background: tokens.color.ink100,
              }}
            >
              <div
                style={{
                  width: `${(paidCount / run.invoices) * 100}%`,
                  background: tokens.color.success,
                }}
              />
              <div
                style={{
                  width: `${(pendingCount / run.invoices) * 100}%`,
                  background: tokens.color.warn,
                }}
              />
              <div
                style={{
                  width: `${(rejectedCount / run.invoices) * 100}%`,
                  background: tokens.color.danger,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 8,
                fontSize: 11.5,
                color: tokens.color.ink600,
                flexWrap: "wrap",
              }}
            >
              <Legend color={tokens.color.success} label={`${paidCount} paid`} />
              <Legend color={tokens.color.warn} label={`${pendingCount} pending`} />
              {rejectedCount > 0 && (
                <Legend color={tokens.color.danger} label={`${rejectedCount} rejected`} />
              )}
              <span style={{ color: tokens.color.ink500 }}>
                · {exportedCount}/{run.invoices} exported to Xero
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
            borderLeft: `1px solid ${tokens.color.ink200}`,
            paddingLeft: 28,
          }}
        >
          <TotalCell
            label="Gross this run"
            value={fmtGBPbig(run.grossTotal)}
            sub={`${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs last week`}
            dir={deltaPct > 0 ? "up" : "down"}
            big
          />
          <TotalCell
            label="Officers billed"
            value={String(run.invoices)}
            sub={`${run.lineItems} line items`}
          />
          <TotalCell
            label="Needs attention"
            value={String(pendingCount + rejectedCount)}
            sub={`${run.timeAdjustments} time adjustments · ${run.siaBlocks} SIA`}
            danger={rejectedCount > 0}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 220,
          }}
        >
          <Button
            variant="primary"
            accent={palette}
            size="lg"
            leading={<Icon name="external" size={15} />}
            onClick={onOpenExport}
          >
            Export run to Xero
          </Button>
          <Button
            variant="secondary"
            size="md"
            leading={<Icon name="file" size={14} />}
            onClick={onGeneratePdfs}
          >
            Download all payslips
          </Button>
          <Button variant="ghost" size="sm" leading={<Icon name="refresh" size={14} />}>
            Regenerate invoices
          </Button>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function TotalCell({
  label,
  value,
  sub,
  dir,
  danger,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  dir?: "up" | "down";
  danger?: boolean;
  big?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11.5,
          color: tokens.color.ink600,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 800,
          fontSize: big ? 30 : 26,
          letterSpacing: "-0.025em",
          color: danger ? tokens.color.danger : tokens.color.ink900,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            color:
              dir === "up"
                ? tokens.color.successInk
                : dir === "down"
                  ? tokens.color.dangerInk
                  : tokens.color.ink500,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {dir === "up" && <Icon name="arrow-up" size={10} />}
          {dir === "down" && <Icon name="arrow-down" size={10} />}
          {sub}
        </div>
      )}
    </div>
  );
}
