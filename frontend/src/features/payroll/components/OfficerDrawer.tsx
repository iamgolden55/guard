// OfficerDrawer — slide-over with breakdown + SIA + adjustments.
// Ported 1:1 from project/payroll-drawer-modal.jsx:8-203.
import { useEffect } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  EXPORT_META,
  fmtGBP,
  ITEMS_BY_OFFICER,
  siaTone,
  STATUS_META,
  type Officer,
} from "../data/mocks";

interface BreakdownRow {
  label: string;
  detail: string;
  value: number;
  hl?: string;
}

export interface OfficerDrawerProps {
  officer: Officer | null;
  onClose: () => void;
}

export function OfficerDrawer({ officer, onClose }: OfficerDrawerProps) {
  const { palette } = useAccent();

  useEffect(() => {
    if (!officer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [officer, onClose]);

  if (!officer) return null;

  const o = officer;
  const bundle = ITEMS_BY_OFFICER[o.id] ?? { items: [], adjustments: [] };
  const meta = STATUS_META[o.status];
  const expMeta = o.exportStatus ? EXPORT_META[o.exportStatus] : null;
  const siaWarn = siaTone(o.sia);

  const breakdown: BreakdownRow[] = [
    {
      label: "Base hours",
      detail: `${o.baseHrs.toFixed(1)}h @ ${fmtGBP(o.rate)}/h`,
      value: o.baseHrs * o.rate,
    },
    ...(o.ot1Hrs > 0
      ? [
          {
            label: "Overtime tier 1 (1.5×)",
            detail: `${o.ot1Hrs.toFixed(1)}h @ ${fmtGBP(o.rate * 1.5)}/h`,
            value: o.ot1Hrs * o.rate * 1.5,
            hl: tokens.color.warn,
          },
        ]
      : []),
    ...(o.ot2Hrs > 0
      ? [
          {
            label: "Overtime tier 2 (2×)",
            detail: `${o.ot2Hrs.toFixed(1)}h @ ${fmtGBP(o.rate * 2)}/h`,
            value: o.ot2Hrs * o.rate * 2,
            hl: tokens.color.dangerInk,
          },
        ]
      : []),
    ...(o.bhDays > 0
      ? [
          {
            label: "Bank holiday",
            detail: `${o.bhDays}d × ${fmtGBP(o.bhRate)}/day`,
            value: o.bhDays * o.bhRate,
            hl: "#312e81",
          },
        ]
      : []),
    ...(o.alDays > 0
      ? [
          {
            label: "Annual leave",
            detail: `${o.alDays}d × ${fmtGBP(o.alRate)}/day`,
            value: o.alDays * o.alRate,
            hl: tokens.color.successInk,
          },
        ]
      : []),
    ...(o.special > 0
      ? [
          {
            label: "Special event uplift",
            detail: `${o.special}h special-rate top-up`,
            value: o.special * 10,
            hl: "#78350f",
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(32,31,30,0.44)",
          backdropFilter: "blur(3px)",
          zIndex: tokens.z.modal - 1,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(560px, 94vw)",
          background: "white",
          zIndex: tokens.z.modal,
          boxShadow: "-12px 0 48px -16px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Avatar name={o.name} hue={o.hue} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 18,
                color: tokens.color.ink900,
                letterSpacing: "-0.015em",
              }}
            >
              {o.name}
            </div>
            <div style={{ fontSize: 12.5, color: tokens.color.ink600, marginTop: 2 }}>
              {o.role} · {o.venue}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <Pill tone={meta.tone} dot>
                {meta.label}
              </Pill>
              {expMeta && (
                <Pill tone={expMeta.tone} dot>
                  {expMeta.label}
                </Pill>
              )}
              {siaWarn && (
                <Pill tone={siaWarn.tone} dot>
                  {siaWarn.label} · {siaWarn.tip}
                </Pill>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: tokens.color.ink100,
              border: "none",
              color: tokens.color.ink600,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div
            style={{
              padding: "18px 20px",
              background: palette.soft,
              border: `1px solid ${palette.primary}22`,
              borderRadius: 12,
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: palette.primary,
                  marginBottom: 2,
                }}
              >
                Invoice total · Week 17
              </div>
              <div style={{ fontSize: 11.5, color: tokens.color.ink600 }}>
                INV-{o.id.toString().padStart(4, "0")}-W17 ·{" "}
                {o.baseHrs + o.ot1Hrs + o.ot2Hrs}h billable + {o.bhDays + o.alDays}d
              </div>
            </div>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 800,
                fontSize: 28,
                color: palette.dark,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {fmtGBP(o.gross)}
            </div>
          </div>

          <SectionLabel>Earnings breakdown</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {breakdown.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "10px 0",
                  borderBottom: `1px solid ${tokens.color.ink100}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: r.hl || tokens.color.ink900,
                    }}
                  >
                    {r.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: tokens.color.ink600, marginTop: 2 }}>
                    {r.detail}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: tokens.color.ink900,
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: tokens.font.display,
                  }}
                >
                  {fmtGBP(r.value)}
                </div>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                padding: "12px 0 0",
                marginTop: 2,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: tokens.color.ink900 }}>
                Gross payable
              </span>
              <span
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 800,
                  fontSize: 18,
                  color: tokens.color.ink900,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtGBP(o.gross)}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              background: "#fafafa",
              border: `1px dashed ${tokens.color.ink200}`,
              borderRadius: 8,
              marginTop: 22,
              marginBottom: 22,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Icon name="info" size={14} />
            <div style={{ fontSize: 11.5, color: tokens.color.ink600, lineHeight: 1.5 }}>
              Gross figure only. PAYE / NI withholding is handled by the connected accounting
              provider (Xero, QuickBooks, Sage) after export — not on this platform.
            </div>
          </div>

          <SectionLabel>SIA licence</SectionLabel>
          <div
            style={{
              padding: "12px 14px",
              border: `1px solid ${o.sia.expired ? "#fbd0d4" : tokens.color.ink200}`,
              borderRadius: 10,
              background: o.sia.expired ? "#fef2f4" : "white",
              marginBottom: 22,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: tokens.color.ink600 }}>
                  Licence · {o.sia.level}
                </div>
                <div
                  style={{
                    fontFamily: tokens.font.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: tokens.color.ink900,
                    marginTop: 2,
                  }}
                >
                  {o.sia.number}
                </div>
              </div>
              <Pill
                tone={o.sia.expired ? "danger" : o.sia.expiresInDays <= 30 ? "warning" : "positive"}
                dot
              >
                {o.sia.expired
                  ? `Expired ${Math.abs(o.sia.expiresInDays)}d ago`
                  : `${o.sia.expiresInDays}d remaining`}
              </Pill>
            </div>
            {o.sia.expired && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: tokens.color.dangerInk }}>
                Officer cannot claim new shifts until licence is renewed. Payslip flagged for
                review.
              </div>
            )}
          </div>

          {bundle.adjustments.length > 0 && (
            <>
              <SectionLabel>Time adjustments this week</SectionLabel>
              <div
                style={{
                  border: `1px solid ${tokens.color.ink200}`,
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 22,
                }}
              >
                {bundle.adjustments.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 14px",
                      borderBottom:
                        i === bundle.adjustments.length - 1
                          ? "none"
                          : `1px solid ${tokens.color.ink100}`,
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                        {a.date}
                      </strong>
                      <span style={{ color: tokens.color.ink600 }}>{a.shift}</span>
                      <Pill tone="warning" dot>
                        {a.delta}
                      </Pill>
                    </div>
                    <div
                      style={{
                        fontFamily: tokens.font.mono,
                        fontSize: 11.5,
                        color: tokens.color.ink600,
                      }}
                    >
                      {a.before} →{" "}
                      <span style={{ color: tokens.color.ink900, fontWeight: 600 }}>{a.after}</span>
                    </div>
                    <div style={{ fontSize: 11, color: tokens.color.ink500, marginTop: 4 }}>
                      by {a.by} · {a.on}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {o.rejectReason && (
            <div
              style={{
                padding: "12px 14px",
                border: "1px solid #fbd0d4",
                background: "#fef2f4",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: tokens.color.dangerInk,
                  marginBottom: 4,
                }}
              >
                Rejection reason
              </div>
              <div style={{ fontSize: 12.5, color: tokens.color.ink900, lineHeight: 1.5 }}>
                {o.rejectReason}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            gap: 8,
            background: "white",
          }}
        >
          <Button variant="ghost" size="md" leading={<Icon name="edit" size={14} />}>
            Adjust hours
          </Button>
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="md" leading={<Icon name="file" size={14} />}>
            Payslip PDF
          </Button>
          <Button
            variant="primary"
            accent={palette}
            size="md"
            leading={<Icon name="external" size={14} />}
          >
            Export invoice
          </Button>
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: tokens.color.ink600,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
