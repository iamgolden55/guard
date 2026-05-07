// RunHero — headline weekly run module.
// Ported 1:1 from project/payroll-hero.jsx:16-108.
import { useEffect, useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Icon } from "../../../design-system/Icon";
import { Button } from "../../../design-system/primitives/Button";
import { Pill } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import {
  OFFICERS,
  type Officer,
  type PayrollRun,
  fmtGBPbig,
} from "../data/mocks";

export interface RunHeroProps {
  run: PayrollRun;
  officers?: Officer[];
  /** Officer IDs currently checkbox-selected in the table. When non-empty,
   * the Approve button scopes to selected pending officers only and its
   * label switches from "Approve N pending" to "Approve N selected". */
  selectedIds?: number[];
  onOpenExport: () => void;
  onGeneratePdfs: () => void;
  onRegenerate?: () => void;
  onApproveAllPending?: () => void;
  onMarkPaidAllApproved?: () => void;
  isRegenerating?: boolean;
  isDownloadingPayslips?: boolean;
  isApprovingAll?: boolean;
  isMarkingPaid?: boolean;
}

// Mirror Payroll.html's @media (max-width: 1200px) breakpoint that stacks the
// hero into one column when there isn't room for the 3-up layout.
function useNarrow(breakpoint = 1200): boolean {
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function RunHero({
  run,
  officers,
  selectedIds,
  onOpenExport,
  onGeneratePdfs,
  onRegenerate,
  onApproveAllPending,
  onMarkPaidAllApproved,
  isRegenerating,
  isDownloadingPayslips,
  isApprovingAll,
  isMarkingPaid,
}: RunHeroProps) {
  const { palette } = useAccent();
  const narrow = useNarrow();
  const list = officers ?? OFFICERS;
  const paidCount = list.filter((o) => o.status === "paid").length;
  const rejectedCount = list.filter((o) => o.status === "rejected").length;
  const pendingCount = list.filter((o) => o.status === "pending").length;
  const approvedCount = list.filter((o) => o.status === "approved").length;
  // Selection-aware counts so the buttons reflect what'll actually fire.
  // Ticking 3 officers where 1 is paid + 1 approved + 1 pending → the
  // Approve button reads "Approve 1 selected" and Mark Paid reads
  // "Mark 1 paid". Officers that don't match the action's source state
  // are silently ignored on the backend.
  const hasSelection = !!selectedIds && selectedIds.length > 0;
  const selectedPendingCount = hasSelection
    ? list.filter((o) => o.status === "pending" && selectedIds!.includes(o.id))
        .length
    : 0;
  const selectedApprovedCount = hasSelection
    ? list.filter((o) => o.status === "approved" && selectedIds!.includes(o.id))
        .length
    : 0;
  const approveButtonCount = hasSelection ? selectedPendingCount : pendingCount;
  const markPaidButtonCount = hasSelection
    ? selectedApprovedCount
    : approvedCount;
  const exportedCount = list.filter(
    (o) => o.exportStatus === "completed",
  ).length;
  // Defensive: real-API runs for an empty week may have 0/null aggregates.
  const invoices = run.invoices ?? 0;
  const lineItems = run.lineItems ?? 0;
  const hoursBilled = run.hoursBilled ?? 0;
  const grossTotal = run.grossTotal ?? 0;
  const prev = run.prevGross || 0;
  const deltaPct = prev ? ((grossTotal - prev) / prev) * 100 : 0;
  const pct = (n: number) => (invoices > 0 ? (n / invoices) * 100 : 0);

  return (
    <div
      style={{
        position: "relative",
        // Card grows with its tallest column. Hidden overflow used to clip
        // the action stack; visible + matching strip radius keeps rounded
        // corners while letting the buttons drive height.
        overflow: "visible",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 14,
        padding: 0,
        boxShadow: tokens.shadow.sm,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${palette.primary}, ${palette.dark})`,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      />

      <div
        style={{
          padding: "24px 28px",
          display: "grid",
          gridTemplateColumns: narrow
            ? "1fr"
            : "1.1fr 1.4fr minmax(220px, auto)",
          gap: narrow ? 20 : 28,
          // top-align so a tall action column (5 buttons) grows the row
          // downward instead of overflowing the card top + bottom.
          alignItems: narrow ? "stretch" : "start",
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
            {pendingCount > 0 && (
              <Pill tone="warning" dot>
                {pendingCount} pending
              </Pill>
            )}
            {approvedCount > 0 && (
              <Pill tone="info" dot>
                {approvedCount} approved
              </Pill>
            )}
            {pendingCount === 0 && approvedCount === 0 && paidCount > 0 && (
              <Pill tone="positive" dot>
                {paidCount} paid
              </Pill>
            )}
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
              Generated{" "}
              <strong style={{ color: tokens.color.ink900 }}>
                {run.processDate
                  ? new Date(run.processDate).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })
                  : "—"}
              </strong>
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
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: tokens.color.ink600,
              lineHeight: 1.5,
            }}
          >
            {invoices} invoices · {lineItems} line items ·{" "}
            {hoursBilled.toLocaleString()} hrs · processed every Monday
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
              {/* Order: paid (settled) → approved (locked) → pending (work to do) → rejected.
                  Empty trailing space means rejected/cancelled invoices that aren't
                  in any of these buckets — we leave it as the muted background. */}
              <div
                style={{
                  width: `${pct(paidCount)}%`,
                  background: tokens.color.success,
                }}
              />
              <div
                style={{
                  width: `${pct(approvedCount)}%`,
                  background: tokens.color.info,
                }}
              />
              <div
                style={{
                  width: `${pct(pendingCount)}%`,
                  background: tokens.color.warn,
                }}
              />
              <div
                style={{
                  width: `${pct(rejectedCount)}%`,
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
              <Legend
                color={tokens.color.success}
                label={`${paidCount} paid`}
              />
              {approvedCount > 0 && (
                <Legend
                  color={tokens.color.info}
                  label={`${approvedCount} approved`}
                />
              )}
              <Legend
                color={tokens.color.warn}
                label={`${pendingCount} pending`}
              />
              {rejectedCount > 0 && (
                <Legend
                  color={tokens.color.danger}
                  label={`${rejectedCount} rejected`}
                />
              )}
              <span style={{ color: tokens.color.ink500 }}>
                · {exportedCount}/{invoices} exported to Xero
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: narrow ? "1fr 1fr 1fr" : "1fr 1fr 1fr",
            gap: 20,
            borderLeft: narrow ? "none" : `1px solid ${tokens.color.ink200}`,
            borderTop: narrow ? `1px solid ${tokens.color.ink200}` : "none",
            paddingLeft: narrow ? 0 : 28,
            paddingTop: narrow ? 18 : 0,
          }}
        >
          <TotalCell
            label="Gross this run"
            value={fmtGBPbig(grossTotal)}
            sub={`${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs last week`}
            dir={deltaPct > 0 ? "up" : "down"}
            big
          />
          <TotalCell
            label="Officers billed"
            value={String(invoices)}
            sub={`${lineItems} line items`}
          />
          <TotalCell
            label="Needs attention"
            value={String(pendingCount + rejectedCount)}
            sub={`${run.timeAdjustments ?? 0} time adjustments · ${run.siaBlocks ?? 0} SIA`}
            danger={rejectedCount > 0}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: narrow ? "row" : "column",
            flexWrap: narrow ? "wrap" : "nowrap",
            gap: 8,
            minWidth: narrow ? 0 : 220,
          }}
        >
          {approveButtonCount > 0 && onApproveAllPending && (
            <Button
              variant="primary"
              accent={palette}
              size="md"
              leading={<Icon name="check" size={14} />}
              onClick={onApproveAllPending}
              disabled={isApprovingAll}
              style={narrow ? { flex: "1 1 auto" } : undefined}
              title={
                hasSelection
                  ? `Manager sign-off for the ${selectedPendingCount} ticked officer${selectedPendingCount === 1 ? "" : "s"} — flips them to Approved (no payment yet)`
                  : `Manager sign-off for all ${pendingCount} pending invoice${pendingCount === 1 ? "" : "s"} — flips them to Approved (no payment yet)`
              }
            >
              {isApprovingAll
                ? "Approving…"
                : hasSelection
                  ? `Approve ${selectedPendingCount} selected`
                  : `Approve ${pendingCount} pending`}
            </Button>
          )}
          {markPaidButtonCount > 0 && onMarkPaidAllApproved && (
            <Button
              variant="primary"
              accent={palette}
              size="md"
              leading={<Icon name="check" size={14} />}
              onClick={onMarkPaidAllApproved}
              disabled={isMarkingPaid}
              style={narrow ? { flex: "1 1 auto" } : undefined}
              title={
                hasSelection
                  ? `Settle the ${selectedApprovedCount} ticked approved officer${selectedApprovedCount === 1 ? "" : "s"} — sets paid_date to today`
                  : `Settle all ${approvedCount} approved invoice${approvedCount === 1 ? "" : "s"} — sets paid_date to today`
              }
            >
              {isMarkingPaid
                ? "Marking paid…"
                : hasSelection
                  ? `Mark ${selectedApprovedCount} selected paid`
                  : `Mark ${approvedCount} approved paid`}
            </Button>
          )}
          <Button
            variant={
              approveButtonCount > 0 || markPaidButtonCount > 0
                ? "secondary"
                : "primary"
            }
            accent={palette}
            size="md"
            leading={<Icon name="external" size={14} />}
            onClick={onOpenExport}
            style={narrow ? { flex: "1 1 auto" } : undefined}
          >
            Export run to Xero
          </Button>
          <Button
            variant="secondary"
            size="md"
            leading={<Icon name="file" size={14} />}
            onClick={onGeneratePdfs}
            disabled={isDownloadingPayslips}
            style={narrow ? { flex: "1 1 auto" } : undefined}
          >
            {isDownloadingPayslips ? "Downloading…" : "Download all payslips"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leading={<Icon name="refresh" size={14} />}
            onClick={onRegenerate}
            disabled={isRegenerating || !onRegenerate}
            style={narrow ? { flex: "1 1 auto" } : undefined}
          >
            {isRegenerating ? "Regenerating…" : "Regenerate invoices"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{ width: 8, height: 8, borderRadius: 2, background: color }}
      />
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
