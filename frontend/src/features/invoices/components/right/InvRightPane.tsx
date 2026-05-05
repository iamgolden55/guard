// InvRightPane — actions, details, hours strip, breakdown, export, audit.
// Ported 1:1 from project/invoice-actions.jsx:139-256.
import type { ReactNode } from "react";
import { useAccent } from "../../../../contexts/AccentContext";
import { Avatar } from "../../../../design-system/primitives/Avatar";
import { Icon, type IconName } from "../../../../design-system/Icon";
import { tokens } from "../../../../design-system/tokens";
import {
  dateGB,
  dateGBShort,
  daysFromToday,
  money,
  type ClientPartyDetails,
  type InvoiceRecord,
  type StaffPartyDetails,
} from "../../data/mocks";
import { InvStatusPill } from "../atoms/InvStatusPill";
import { ExportBadge } from "../atoms/ExportBadge";

export type InvoiceActionId =
  | "issue"
  | "edit"
  | "delete"
  | "paid"
  | "remind"
  | "download"
  | "email"
  | "duplicate"
  | "resolve"
  | "void"
  | "export";

export interface InvRightPaneProps {
  inv: InvoiceRecord | undefined;
  onAct: (id: InvoiceActionId) => void;
}

export function InvRightPane({ inv, onAct }: InvRightPaneProps) {
  if (!inv) {
    return (
      <div
        style={{
          width: 320,
          flexShrink: 0,
          borderLeft: `1px solid ${tokens.color.ink200}`,
          background: "white",
        }}
      />
    );
  }

  const isStaff = inv.kind === "staff";
  const clientParty = !isStaff ? (inv.party as ClientPartyDetails) : null;
  const staffParty = isStaff ? (inv.party as StaffPartyDetails) : null;

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: `1px solid ${tokens.color.ink200}`,
        background: "white",
        height: "calc(100vh - 100px)",
        overflowY: "auto",
        position: "sticky",
        top: 100,
      }}
    >
      <div
        style={{
          padding: "20px 18px 18px",
          borderBottom: `1px solid ${tokens.color.ink100}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <Avatar name={inv.party.name} hue={inv.party.hue} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: tokens.color.ink900,
              }}
            >
              {inv.party.name}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: tokens.color.ink600,
                fontFamily: tokens.font.body,
              }}
            >
              {clientParty
                ? `Net ${clientParty.terms} · ${clientParty.email}`
                : staffParty?.role}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <InvStatusPill status={inv.status} size="lg" />
          <span
            style={{
              fontSize: 13,
              color: tokens.color.ink900,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              fontFamily: tokens.font.body,
            }}
          >
            {money(inv.total)}
          </span>
        </div>
        <ActionGroup inv={inv} onAct={onAct} />
      </div>

      <Section title="Details">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "8px 12px",
            fontSize: 12,
            fontFamily: tokens.font.body,
          }}
        >
          <span style={{ color: tokens.color.ink600 }}>Number</span>
          <span
            style={{
              color: tokens.color.ink900,
              fontWeight: 600,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11.5,
            }}
          >
            {inv.id}
          </span>
          <span style={{ color: tokens.color.ink600 }}>Issued</span>
          <span style={{ color: tokens.color.ink900, fontWeight: 500 }}>
            {inv.issueDate ? dateGB(inv.issueDate) : "— draft —"}
          </span>
          <span style={{ color: tokens.color.ink600 }}>Period</span>
          <span style={{ color: tokens.color.ink900, fontWeight: 500 }}>
            {dateGBShort(inv.periodStart)} – {dateGBShort(inv.periodEnd)}
          </span>
          {inv.dueDate && (
            <>
              <span style={{ color: tokens.color.ink600 }}>Due</span>
              <span
                style={{
                  color: inv.status === "overdue" ? "#8a1820" : tokens.color.ink900,
                  fontWeight: inv.status === "overdue" ? 700 : 500,
                }}
              >
                {dateGB(inv.dueDate)}
                {inv.status === "overdue" && (
                  <span style={{ marginLeft: 6, fontSize: 11 }}>
                    · {-daysFromToday(inv.dueDate)}d late
                  </span>
                )}
              </span>
            </>
          )}
          {inv.paidDate && (
            <>
              <span style={{ color: tokens.color.ink600 }}>Paid</span>
              <span style={{ color: tokens.color.successInk, fontWeight: 600 }}>
                {dateGB(inv.paidDate)}
              </span>
            </>
          )}
        </div>
      </Section>

      <Section title={`Hours · ${inv.totalHours}h across ${inv.items.length} lines`}>
        <HoursStrip inv={inv} />
      </Section>

      <Section title="Breakdown">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
            fontFamily: tokens.font.body,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: tokens.color.ink600 }}>Subtotal</span>
            <span
              style={{
                color: tokens.color.ink900,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {money(inv.subtotal)}
            </span>
          </div>
          {inv.vat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: tokens.color.ink600 }}>VAT @ 20%</span>
              <span
                style={{
                  color: tokens.color.ink900,
                  fontWeight: 500,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(inv.vat)}
              </span>
            </div>
          )}
          <TotalRow inv={inv} />
        </div>
      </Section>

      <Section
        title="Accounting export"
        right={
          <button
            type="button"
            style={{
              fontSize: 11,
              color: "var(--ms-accent-primary)",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontFamily: tokens.font.body,
            }}
            onClick={() => onAct("export")}
          >
            Re-sync
          </button>
        }
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: tokens.font.body,
            fontSize: 12,
          }}
        >
          <span style={{ color: tokens.color.ink600 }}>Xero</span>
          <ExportBadge status={inv.exportStatus} />
        </div>
      </Section>

      {inv.note && (
        <Section title="Note">
          <div
            style={{
              padding: 10,
              background: "#fffaf7",
              borderRadius: 6,
              fontSize: 12,
              color: tokens.color.ink800,
              fontStyle: "italic",
              fontFamily: tokens.font.body,
              lineHeight: 1.5,
            }}
          >
            "{inv.note}"
          </div>
        </Section>
      )}

      <Section title="Activity">
        <AuditTimeline history={inv.history} />
      </Section>
    </div>
  );
}

function TotalRow({ inv }: { inv: InvoiceRecord }) {
  const { palette } = useAccent();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        paddingTop: 6,
        marginTop: 4,
        borderTop: `1px solid ${tokens.color.ink200}`,
      }}
    >
      <span style={{ color: tokens.color.ink900, fontWeight: 700 }}>Total</span>
      <span
        style={{
          color: palette.primary,
          fontWeight: 800,
          fontSize: 14,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {money(inv.total)}
      </span>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${tokens.color.ink100}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: tokens.color.ink600,
            fontFamily: tokens.font.body,
          }}
        >
          {title}
        </span>
        {right}
      </div>
      {children}
    </div>
  );
}

interface ActionButton {
  id: InvoiceActionId;
  label: string;
  icon: IconName;
  primary?: boolean;
}

function ActionGroup({
  inv,
  onAct,
}: {
  inv: InvoiceRecord;
  onAct: (id: InvoiceActionId) => void;
}) {
  const { palette } = useAccent();
  const buttons: ActionButton[] = [];
  if (inv.status === "draft") {
    buttons.push({ id: "issue", label: "Issue & send", icon: "send", primary: true });
    buttons.push({ id: "edit", label: "Edit", icon: "edit" });
    buttons.push({ id: "delete", label: "Discard", icon: "x" });
  } else if (
    inv.status === "pending" ||
    inv.status === "sent" ||
    inv.status === "overdue"
  ) {
    buttons.push({ id: "paid", label: "Mark paid", icon: "check", primary: true });
    buttons.push({ id: "email", label: "Email payslip to officer", icon: "mail" });
    buttons.push({ id: "remind", label: "Send reminder", icon: "bell" });
    buttons.push({ id: "resolve", label: "Resolve & re-issue", icon: "edit" });
    buttons.push({ id: "duplicate", label: "Duplicate", icon: "copy" });
    buttons.push({ id: "download", label: "Download PDF", icon: "download" });
  } else if (inv.status === "paid") {
    buttons.push({ id: "email", label: "Email payslip to officer", icon: "mail", primary: true });
    buttons.push({ id: "download", label: "Download PDF", icon: "download" });
    buttons.push({ id: "duplicate", label: "Duplicate", icon: "copy" });
  } else if (inv.status === "rejected") {
    buttons.push({ id: "resolve", label: "Resolve & re-issue", icon: "edit", primary: true });
    buttons.push({ id: "void", label: "Void", icon: "x" });
    buttons.push({ id: "duplicate", label: "Duplicate", icon: "copy" });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onAct(b.id)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: b.primary ? palette.primary : "white",
            color: b.primary ? "white" : tokens.color.ink900,
            border: b.primary ? "none" : `1px solid ${tokens.color.ink200}`,
            fontFamily: tokens.font.body,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            boxShadow: b.primary ? `0 2px 4px ${palette.primary}33` : "none",
            transition: "all .12s",
          }}
        >
          <Icon name={b.icon} size={14} />
          {b.label}
        </button>
      ))}
    </div>
  );
}

function HoursStrip({ inv }: { inv: InvoiceRecord }) {
  const { palette } = useAccent();
  const byDate = new Map<string, { hours: number; amount: number }>();
  inv.items.forEach((it) => {
    const cur = byDate.get(it.date) ?? { hours: 0, amount: 0 };
    cur.hours += it.hours;
    cur.amount += it.amount;
    byDate.set(it.date, cur);
  });
  const days = [...byDate.entries()].sort();
  const maxH = Math.max(...days.map(([, v]) => v.hours), 1);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 60,
        fontFamily: tokens.font.body,
      }}
    >
      {days.map(([date, v]) => {
        const h = (v.hours / maxH) * 100;
        const dt = new Date(date);
        const dayLabel = dt.toLocaleDateString("en-GB", { weekday: "narrow" });
        return (
          <div
            key={date}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
            title={`${dateGB(date)} · ${v.hours}h · ${money(v.amount)}`}
          >
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: `${h}%`,
                  background: `linear-gradient(180deg, ${palette.primary}, ${palette.dark})`,
                  borderRadius: "3px 3px 0 0",
                  minHeight: 2,
                  transition: "height .35s",
                }}
              />
            </div>
            <span style={{ fontSize: 9.5, color: tokens.color.ink500, fontWeight: 600 }}>
              {dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AuditTimeline({ history }: { history: InvoiceRecord["history"] }) {
  const { palette } = useAccent();
  return (
    <div style={{ position: "relative", paddingLeft: 18 }}>
      <div
        style={{
          position: "absolute",
          left: 4,
          top: 6,
          bottom: 6,
          width: 1,
          background: tokens.color.ink200,
        }}
      />
      {history
        .slice()
        .reverse()
        .map((h, i) => (
          <div
            key={i}
            style={{ position: "relative", paddingBottom: 12, fontFamily: tokens.font.body }}
          >
            <div
              style={{
                position: "absolute",
                left: -18,
                top: 4,
                width: 9,
                height: 9,
                borderRadius: 5,
                background: i === 0 ? palette.primary : "white",
                border: `2px solid ${i === 0 ? palette.primary : tokens.color.ink500}`,
              }}
            />
            <div style={{ fontSize: 12, color: tokens.color.ink900, fontWeight: 500 }}>
              {h.action}
            </div>
            <div style={{ fontSize: 10.5, color: tokens.color.ink500, marginTop: 1 }}>
              {h.at} · {h.by}
            </div>
          </div>
        ))}
    </div>
  );
}
