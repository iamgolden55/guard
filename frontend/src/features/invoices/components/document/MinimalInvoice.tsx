// MinimalInvoice — typographic, almost editorial.
// Ported 1:1 from project/invoice-document.jsx:401-506.
import type { Accent } from "../../../../design-system/accents";
import {
  COMPANY,
  dateGB,
  dateGBShort,
  daysFromToday,
  isClientParty,
  money,
  type InvoiceRecord,
} from "../../data/mocks";
import { StatusStamp } from "./StatusStamp";

export function MinimalInvoice({ inv, accent }: { inv: InvoiceRecord; accent: Accent }) {
  const isStaff = inv.kind === "staff";
  const party = inv.party;
  const clientParty = !isStaff ? (party as import("../../data/mocks").ClientPartyDetails) : null;
  const staffParty = isStaff ? (party as import("../../data/mocks").StaffPartyDetails) : null;
  void isClientParty;

  return (
    <div
      style={{
        padding: "72px 64px 56px",
        fontFamily: "'Inter', sans-serif",
        color: "#201f1e",
        position: "relative",
      }}
    >
      <StatusStamp status={inv.status} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 56,
          fontSize: 11,
          color: "#a19f9d",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>{COMPANY.name}</span>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {inv.id}
        </span>
      </div>

      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: 84,
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          marginBottom: 8,
          color: "#201f1e",
        }}
      >
        {money(inv.total)}
      </div>
      <div style={{ fontSize: 14, color: "#605e5c", marginBottom: 56 }}>
        {isStaff ? "owed to" : "due from"}{" "}
        <span style={{ color: "#201f1e", fontWeight: 600 }}>{party.name}</span>
        {" · "}
        {inv.status === "paid"
          ? `paid ${dateGB(inv.paidDate ?? null)}`
          : inv.status === "draft"
            ? "draft, not yet issued"
            : inv.status === "overdue"
              ? `overdue ${-daysFromToday(inv.dueDate)} days`
              : `due ${dateGB(inv.dueDate)}`}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
          padding: "16px 0",
          borderTop: "1px solid #201f1e",
          borderBottom: "1px solid #edebe9",
          marginBottom: 32,
        }}
      >
        {(
          [
            ["Period", `${dateGBShort(inv.periodStart)} – ${dateGBShort(inv.periodEnd)}`],
            ["Issued", inv.issueDate ? dateGB(inv.issueDate) : "—"],
            ["Hours", `${inv.totalHours.toFixed(1)} h`],
            [
              isStaff ? "Pay" : "Terms",
              isStaff ? "BACS" : clientParty ? `Net ${clientParty.terms}` : "—",
            ],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#a19f9d",
                marginBottom: 4,
              }}
            >
              {k}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 32 }}>
        {inv.items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 60px 90px",
              alignItems: "baseline",
              gap: 16,
              padding: "14px 0",
              borderBottom: "1px solid #f3f2f1",
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: "#a19f9d",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {dateGBShort(it.date)}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.desc}</div>
              {it.venue && (
                <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{it.venue}</div>
              )}
            </div>
            <span
              style={{
                fontSize: 11.5,
                color: "#605e5c",
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {it.hours.toFixed(1)}h
            </span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {money(it.amount)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 48 }}>
        <div style={{ width: 280 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              fontSize: 12,
              color: "#605e5c",
            }}
          >
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: "#201f1e" }}>
              {money(inv.subtotal)}
            </span>
          </div>
          {inv.vat > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                fontSize: 12,
                color: "#605e5c",
              }}
            >
              <span>VAT @ 20%</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#201f1e" }}>
                {money(inv.vat)}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "12px 0 0",
              marginTop: 6,
              borderTop: "2px solid #201f1e",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: accent.primary,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {money(inv.total)}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 10.5,
          color: "#a19f9d",
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #edebe9",
          paddingTop: 14,
        }}
      >
        <span>
          {isStaff ? (
            staffParty?.bank ? (
              <>
                {staffParty.bank.name} · Sort{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{staffParty.bank.sort}</span>{" "}
                · Acc{" "}
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{staffParty.bank.account}</span>
              </>
            ) : (
              <span style={{ fontStyle: "italic", color: "#a19f9d" }}>Bank details not on file</span>
            )
          ) : (
            <>
              {COMPANY.bank.name} · Sort{" "}
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.sort}</span>{" "}
              · Acc{" "}
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.acc}</span>
            </>
          )}
        </span>
        <span>VAT {COMPANY.vat}</span>
      </div>
    </div>
  );
}
