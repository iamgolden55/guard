// OfficersTable + OfficerRow — payroll grid with expandable rows.
// Ported 1:1 from project/payroll-table.jsx:1-273.
import { useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  EXPORT_META,
  fmtGBP,
  ITEM_TYPE_META,
  ITEMS_BY_OFFICER,
  siaTone,
  STATUS_META,
  type Officer,
} from "../data/mocks";
import { useOfficerBundle } from "../hooks/usePayrollData";
import { usePayrollMutations } from "../hooks/usePayrollMutations";
import billingService from "../../../services/billingService";
import { RejectInvoiceModal } from "../../invoices/components/RejectInvoiceModal";
import { AdjustHoursModal } from "./AdjustHoursModal";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "1";

/** Render API ISO dates as 'Mon 21 Jan' to match the mock format. Mock dates
 * already use that string format, so they pass through unchanged. */
function fmtRowDate(s: string): string {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export type Density = "compact" | "comfortable" | "spacious";

const GRID = "32px 2fr 1fr 0.9fr 0.9fr 1fr 1.1fr 40px";

export interface OfficersTableProps {
  officers: Officer[];
  selectedIds: number[];
  setSelectedIds: (ids: number[]) => void;
  onOpenDetail: (officer: Officer) => void;
  density?: Density;
  /** Active payroll-run code — needed to fetch each row's expanded line items. */
  runCode?: string | null;
}

export function OfficersTable({
  officers,
  selectedIds,
  setSelectedIds,
  onOpenDetail,
  density = "comfortable",
  runCode,
}: OfficersTableProps) {
  const { palette } = useAccent();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const allSelected = officers.length > 0 && officers.every((o) => selectedIds.includes(o.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(officers.map((o) => o.id));
  };
  const toggleOne = (id: number) => {
    setSelectedIds(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1040 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "14px 16px",
              background: tokens.color.ink50,
              borderBottom: `1px solid ${tokens.color.ink200}`,
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tokens.color.ink600,
            }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{
                accentColor: palette.primary,
                width: 16,
                height: 16,
                cursor: "pointer",
              }}
            />
            <span>Officer</span>
            <span>Base + OT</span>
            <span>Bank hol.</span>
            <span>Annual lv.</span>
            <span>Gross</span>
            <span>Invoice · Export</span>
            <span></span>
          </div>
          {officers.map((o) => (
            <OfficerRow
              key={o.id}
              o={o}
              expanded={expandedId === o.id}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              selected={selectedIds.includes(o.id)}
              onSelect={toggleOne}
              onOpenDetail={onOpenDetail}
              density={density}
              runCode={runCode}
            />
          ))}
          {officers.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: tokens.color.ink500 }}>
              No officers match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface OfficerRowProps {
  o: Officer;
  expanded: boolean;
  onToggle: (id: number) => void;
  selected: boolean;
  onSelect: (id: number) => void;
  onOpenDetail: (officer: Officer) => void;
  density: Density;
  runCode?: string | null;
}

function OfficerRow({
  o,
  expanded,
  onToggle,
  selected,
  onSelect,
  onOpenDetail,
  density,
  runCode,
}: OfficerRowProps) {
  const { palette } = useAccent();
  const meta = STATUS_META[o.status];
  const expMeta = o.exportStatus ? EXPORT_META[o.exportStatus] : null;
  const rowPad =
    density === "compact" ? "10px 16px" : density === "spacious" ? "18px 16px" : "14px 16px";
  // Real-API path: fetch line items + adjustments for this officer's invoice
  // when the row is expanded. Mock fallback only applies when VITE_USE_MOCKS=1.
  const bundleQuery = useOfficerBundle(
    USE_MOCKS ? null : (expanded ? runCode : null),
    expanded ? o.id : null,
  );
  const bundle = USE_MOCKS ? ITEMS_BY_OFFICER[o.id] : bundleQuery.data;

  const mutations = usePayrollMutations(runCode);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const otHrs = o.ot1Hrs + o.ot2Hrs;
  const siaWarn = siaTone(o.sia);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GRID,
          alignItems: "center",
          gap: 12,
          padding: rowPad,
          borderBottom: expanded ? "none" : `1px solid ${tokens.color.ink100}`,
          background: selected ? palette.soft : "white",
          transition: "background .15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = tokens.color.ink50;
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = "white";
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(o.id);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ accentColor: palette.primary, width: 16, height: 16, cursor: "pointer" }}
        />

        <div
          style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
          onClick={() => onOpenDetail(o)}
        >
          <Avatar name={o.name} hue={o.hue} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: tokens.color.ink900,
                  letterSpacing: "-0.005em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {o.name}
              </span>
              {siaWarn && (
                <span
                  title={`SIA ${siaWarn.tip}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: siaWarn.tone === "danger" ? tokens.color.dangerSoft : tokens.color.warnSoft,
                    color: siaWarn.tone === "danger" ? tokens.color.dangerInk : tokens.color.warnInk,
                  }}
                >
                  <Icon name={siaWarn.tone === "danger" ? "shield-x" : "shield"} size={10} />
                  {siaWarn.tip}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: tokens.color.ink500, marginTop: 1 }}>
              {o.role} · {o.venue}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color: tokens.color.ink800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ fontWeight: 600 }}>{o.baseHrs.toFixed(1)}h</span>
          <span style={{ color: tokens.color.ink500, fontSize: 11, marginLeft: 4 }}>
            @ {fmtGBP(o.rate)}
          </span>
          {otHrs > 0 && (
            <div
              style={{
                fontSize: 11,
                color: tokens.color.warnInk,
                fontWeight: 600,
                marginTop: 2,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {o.ot1Hrs > 0 && <span>+{o.ot1Hrs}h OT1.5×</span>}
              {o.ot2Hrs > 0 && <span style={{ color: tokens.color.dangerInk }}>+{o.ot2Hrs}h OT2×</span>}
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 13,
            color: tokens.color.ink800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {o.bhDays > 0 ? (
            `${o.bhDays}d`
          ) : (
            <span style={{ color: tokens.color.ink400 }}>—</span>
          )}
        </div>

        <div
          style={{
            fontSize: 13,
            color: tokens.color.ink800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {o.alDays > 0 ? (
            `${o.alDays}d`
          ) : (
            <span style={{ color: tokens.color.ink400 }}>—</span>
          )}
        </div>

        <div>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontSize: 15,
              fontWeight: 700,
              color: tokens.color.ink900,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
            }}
          >
            {fmtGBP(o.gross)}
          </div>
          {o.adjustments > 0 && (
            <div
              style={{
                fontSize: 10.5,
                color: tokens.color.ink600,
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Icon name="edit" size={9} />
              {o.adjustments} adjustment{o.adjustments === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div>
          <Pill tone={meta.tone} dot>
            {meta.label}
          </Pill>
          {o.rejectReason && (
            <div
              style={{
                fontSize: 10.5,
                color: tokens.color.dangerInk,
                marginTop: 4,
                maxWidth: 180,
                lineHeight: 1.25,
              }}
            >
              {o.rejectReason}
            </div>
          )}
        </div>

        <div>
          {expMeta ? (
            <Pill tone={expMeta.tone} dot>
              {expMeta.label}
            </Pill>
          ) : (
            <span style={{ fontSize: 11.5, color: tokens.color.ink500 }}>Not exported</span>
          )}
          <div style={{ fontSize: 10.5, color: tokens.color.ink500, marginTop: 3 }}>
            {o.exportStatus ? "Xero" : "Ready to send"}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(o.id);
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: expanded ? palette.soft : "transparent",
            border: "none",
            color: expanded ? palette.primary : tokens.color.ink600,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="chevron-down" size={16} />
        </button>
      </div>

      {expanded && bundle && (
        <div
          style={{
            padding: "0 16px 18px 64px",
            background: tokens.color.ink50,
            borderBottom: `1px solid ${tokens.color.ink100}`,
          }}
        >
          <div
            style={{
              background: "white",
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: 10,
              overflow: "hidden",
              marginTop: 4,
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${tokens.color.ink100}`,
                background: tokens.color.ink50,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: tokens.color.ink600,
                }}
              >
                Invoice line items · {bundle.items.length}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: tokens.color.ink500,
                  fontFamily: tokens.font.mono,
                }}
              >
                {o.invoiceId ?? `INV-${o.id.toString().padStart(4, "0")}`}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 1.6fr 70px 90px 90px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: tokens.color.ink500,
                padding: "10px 14px",
                borderBottom: `1px solid ${tokens.color.ink100}`,
              }}
            >
              <span>Date</span>
              <span>Type</span>
              <span>Detail</span>
              <span>Hrs</span>
              <span>Rate</span>
              <span style={{ textAlign: "right" }}>Amount</span>
            </div>
            {bundle.items.map((it, i) => {
              const tm = ITEM_TYPE_META[it.type];
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 1.6fr 70px 90px 90px",
                    fontSize: 12.5,
                    padding: "10px 14px",
                    borderBottom:
                      i === bundle.items.length - 1
                        ? "none"
                        : `1px solid ${tokens.color.ink100}`,
                    color: tokens.color.ink800,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontFamily: tokens.font.mono, color: tokens.color.ink600 }}>
                    {fmtRowDate(it.date)}
                  </span>
                  <span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: tm.bg,
                        color: tm.fg,
                      }}
                    >
                      {tm.label}
                    </span>
                  </span>
                  <span style={{ color: tokens.color.ink800 }}>
                    <span style={{ color: tokens.color.ink600 }}>{it.venue} · </span>
                    {it.detail}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {it.hrs != null ? `${it.hrs.toFixed(1)}h` : <span style={{ color: tokens.color.ink400 }}>—</span>}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: tokens.color.ink600 }}>
                    {it.rate != null ? `${fmtGBP(it.rate)}/h` : <span style={{ color: tokens.color.ink400 }}>daily</span>}
                  </span>
                  <span
                    style={{
                      textAlign: "right",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtGBP(it.amount)}
                  </span>
                </div>
              );
            })}
          </div>

          {bundle.adjustments.length > 0 && (
            <div
              style={{
                marginTop: 10,
                background: "white",
                border: `1px solid ${tokens.color.ink200}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${tokens.color.ink100}`,
                  background: tokens.color.ink50,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon name="history" size={12} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: tokens.color.ink600,
                  }}
                >
                  Time adjustments · {bundle.adjustments.length}
                </span>
              </div>
              {bundle.adjustments.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    fontSize: 12,
                    borderBottom:
                      i === bundle.adjustments.length - 1
                        ? "none"
                        : `1px solid ${tokens.color.ink100}`,
                    color: tokens.color.ink800,
                  }}
                >
                  <div>
                    <strong style={{ fontFamily: tokens.font.mono }}>{fmtRowDate(a.date)}</strong> · {a.shift}
                    <span
                      style={{
                        marginLeft: 8,
                        fontFamily: tokens.font.mono,
                        color: tokens.color.ink600,
                      }}
                    >
                      {a.before} →{" "}
                      <span style={{ color: tokens.color.ink900, fontWeight: 600 }}>{a.after}</span>
                    </span>
                    <span
                      style={{
                        marginLeft: 8,
                        color: tokens.color.warn,
                        fontWeight: 600,
                      }}
                    >
                      {a.delta}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: tokens.color.ink500, marginTop: 2 }}>
                    by {a.by} · {a.on}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              leading={<Icon name="edit" size={12} />}
              onClick={() => setAdjustOpen(true)}
              disabled={USE_MOCKS}
            >
              Adjust hours
            </Button>
            {/* P6 (M1 partial): wire Payslip PDF and Export to Xero buttons. */}
            <Button
              variant="secondary"
              size="sm"
              leading={<Icon name="file" size={12} />}
              onClick={() => {
                if (o.invoiceId) billingService.downloadPdf(o.invoiceId);
              }}
              disabled={USE_MOCKS || !o.invoiceId}
            >
              Payslip PDF
            </Button>
            {o.status === "pending" && (
              <Button
                variant="secondary"
                size="sm"
                leading={<Icon name="x" size={12} />}
                onClick={() => setRejectOpen(true)}
                disabled={USE_MOCKS}
              >
                Reject invoice
              </Button>
            )}
            <Button
              variant="primary"
              accent={palette}
              size="sm"
              leading={<Icon name="external" size={12} />}
              onClick={() => {
                if (o.invoiceId) billingService.exportToXero(o.invoiceId);
              }}
              disabled={USE_MOCKS || !o.invoiceId}
            >
              Export to Xero
            </Button>
          </div>
        </div>
      )}

      <RejectInvoiceModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={async (reason) => {
          await mutations.rejectOfficer.mutateAsync({ officerId: o.id, reason });
        }}
        title="Reject officer invoice"
        description={`Reject ${o.name}'s pay for this week. Add a reason — they'll see it on the payslip.`}
        subject={o.name}
      />

      <AdjustHoursModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        items={bundle?.items ?? []}
        onSubmit={async (payload) => {
          await mutations.adjustTime.mutateAsync(payload);
        }}
      />
    </>
  );
}
