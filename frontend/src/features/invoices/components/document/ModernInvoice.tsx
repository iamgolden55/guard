// ModernInvoice — large hero + clean blocks.
// Ported 1:1 from project/invoice-document.jsx:251-396.
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

export function ModernInvoice({ inv, accent }: { inv: InvoiceRecord; accent: Accent }) {
  const isStaff = inv.kind === "staff";
  const party = inv.party;
  const clientParty = !isStaff ? (party as import("../../data/mocks").ClientPartyDetails) : null;
  const staffParty = isStaff ? (party as import("../../data/mocks").StaffPartyDetails) : null;
  void isClientParty;

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#201f1e", position: "relative" }}>
      <StatusStamp status={inv.status} />

      <div
        style={{
          background: `linear-gradient(135deg, ${accent.soft}, white)`,
          padding: "48px 56px 32px",
          borderBottom: `4px solid ${accent.primary}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 7,
                  background: accent.primary,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
                </svg>
              </div>
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {COMPANY.name}
              </span>
            </div>
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: 36,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {money(inv.total)}
            </div>
            <div style={{ fontSize: 13, color: "#605e5c" }}>
              {inv.status === "paid"
                ? `Paid on ${dateGB(inv.paidDate ?? null)}`
                : inv.status === "draft"
                  ? "Draft · ready for review"
                  : inv.status === "overdue"
                    ? `Overdue by ${-daysFromToday(inv.dueDate)} days`
                    : `Due ${dateGB(inv.dueDate)}`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                background: "white",
                border: "1px solid #edebe9",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#605e5c",
                marginBottom: 10,
              }}
            >
              INVOICE
            </div>
            <div
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
                color: "#201f1e",
                letterSpacing: "0.04em",
              }}
            >
              {inv.id}
            </div>
            <div style={{ fontSize: 11.5, color: "#605e5c", marginTop: 4 }}>
              Issued {inv.issueDate ? dateGB(inv.issueDate) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "32px 56px 48px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <SmallLabel>From</SmallLabel>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{COMPANY.name}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              {COMPANY.address.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
          <div>
            <SmallLabel>{isStaff ? "Pay to" : "Billed to"}</SmallLabel>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{party.name}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              {clientParty?.contact && <div>Attn: {clientParty.contact}</div>}
              {clientParty?.address.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              {staffParty && (
                <>
                  <div>{staffParty.role}</div>
                  <div style={{ marginTop: 2, fontFamily: "ui-monospace, monospace" }}>
                    UTR {staffParty.utr}
                  </div>
                </>
              )}
            </div>
          </div>
          <div>
            <SmallLabel>Service period</SmallLabel>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
              {dateGBShort(inv.periodStart)} – {dateGBShort(inv.periodEnd)}
            </div>
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              <div>
                {inv.totalHours} hours · {inv.items.length} line items
              </div>
              {clientParty && <div>Terms: Net {clientParty.terms} days</div>}
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 8,
            border: "1px solid #edebe9",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#faf9f8" }}>
                <Th width={80}>Date</Th>
                <Th>Description</Th>
                <Th align="right" width={50}>
                  Hrs
                </Th>
                <Th align="right" width={70}>
                  Rate
                </Th>
                <Th align="right" width={90}>
                  Amount
                </Th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f2f1" }}>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: "#605e5c",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {dateGBShort(it.date)}
                  </td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ fontWeight: 500 }}>{it.desc}</div>
                    {it.venue && <div style={{ fontSize: 11, color: "#a19f9d" }}>{it.venue}</div>}
                  </td>
                  <td
                    style={{
                      padding: "12px 8px",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {it.hours.toFixed(1)}
                  </td>
                  <td
                    style={{
                      padding: "12px 8px",
                      textAlign: "right",
                      color: "#605e5c",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {money(it.rate)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      textAlign: "right",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {money(it.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
          }}
        >
          <div style={{ flex: 1, fontSize: 11.5, color: "#605e5c", lineHeight: 1.7 }}>
            <SmallLabel>Bank</SmallLabel>
            <div>{COMPANY.bank.name}</div>
            <div>
              Sort <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.sort}</span>{" "}
              · Acc{" "}
              <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.acc}</span>
            </div>
            <div style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.iban}</div>
            {inv.note && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: "#faf9f8",
                  borderRadius: 6,
                  color: "#323130",
                }}
              >
                {inv.note}
              </div>
            )}
          </div>
          <div
            style={{
              width: 240,
              padding: 18,
              background: "#faf9f8",
              borderRadius: 10,
              fontSize: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#605e5c" }}>Subtotal</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(inv.subtotal)}</span>
            </div>
            {inv.vat > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#605e5c" }}>VAT @ 20%</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(inv.vat)}</span>
              </div>
            )}
            <div
              style={{
                borderTop: "1px solid #edebe9",
                marginTop: 8,
                paddingTop: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: 22,
                  color: accent.primary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(inv.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#a19f9d",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Th({
  children,
  align = "left",
  width,
}: {
  children: string;
  align?: "left" | "right";
  width?: number;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: align === "right" && width === 90 ? "11px 16px" : "11px 8px",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#605e5c",
        width,
      }}
    >
      {children}
    </th>
  );
}
