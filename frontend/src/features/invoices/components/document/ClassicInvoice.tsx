// ClassicInvoice — formal British accountancy style.
// Ported 1:1 from project/invoice-document.jsx:83-246.
import type { Accent } from "../../../../design-system/accents";
import {
  COMPANY,
  dateGB,
  dateGBShort,
  isClientParty,
  money,
  type InvoiceRecord,
} from "../../data/mocks";
import type { ClientPartyDetails, StaffPartyDetails } from "../../data/mocks";
import { StatusStamp } from "./StatusStamp";

export function ClassicInvoice({ inv, accent }: { inv: InvoiceRecord; accent: Accent }) {
  const isStaff = inv.kind === "staff";
  const party = inv.party;
  const clientParty = !isStaff ? (party as ClientPartyDetails) : null;
  const staffParty = isStaff ? (party as StaffPartyDetails) : null;
  // isClientParty kept imported for runtime predicates if needed elsewhere
  void isClientParty;

  return (
    <div
      style={{
        padding: "56px 56px 48px",
        fontFamily: "'Inter', sans-serif",
        color: "#201f1e",
      }}
    >
      <StatusStamp status={inv.status} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 36,
        }}
      >
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${accent.primary}, ${accent.dark})`,
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg
                width="20"
                height="20"
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
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "-0.02em",
              }}
            >
              {COMPANY.name}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
            {COMPANY.address.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            <div style={{ marginTop: 4 }}>{COMPANY.email}</div>
            <div>{COMPANY.phone}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#201f1e",
              lineHeight: 1,
            }}
          >
            INVOICE
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "#605e5c",
              marginTop: 6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              letterSpacing: "0.04em",
            }}
          >
            {inv.id}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          padding: "20px 0",
          borderTop: "1px solid #201f1e",
          borderBottom: "1px solid #edebe9",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#a19f9d",
              marginBottom: 6,
            }}
          >
            {isStaff ? "Pay to" : "Billed to"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{party.name}</div>
          {clientParty ? (
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              {clientParty.contact && <div>Attn: {clientParty.contact}</div>}
              {clientParty.address.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
              <div style={{ marginTop: 4 }}>{clientParty.email}</div>
            </div>
          ) : staffParty ? (
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              <div>{staffParty.role}</div>
              <div style={{ marginTop: 4 }}>
                UTR ·{" "}
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {staffParty.utr}
                </span>
              </div>
              <div>
                BACS ·{" "}
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {staffParty.bank
                    ? `${staffParty.bank.sort} / ${staffParty.bank.account}`
                    : "(no bank details)"}
                </span>
              </div>
            </div>
          ) : null}
        </div>
        <div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Invoice date", inv.issueDate ? dateGB(inv.issueDate) : "— draft —"],
                ["Service period", `${dateGBShort(inv.periodStart)} – ${dateGB(inv.periodEnd)}`],
                ["Payment due", inv.dueDate ? dateGB(inv.dueDate) : "—"],
                inv.status === "paid" ? ["Paid on", dateGB(inv.paidDate ?? null)] : null,
                clientParty ? ["Terms", `Net ${clientParty.terms}`] : null,
                clientParty ? ["VAT no.", COMPANY.vat] : null,
              ]
                .filter((row): row is [string, string] => row !== null)
                .map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "4px 0", color: "#605e5c", width: "45%" }}>{k}</td>
                    <td
                      style={{
                        padding: "4px 0",
                        color: "#201f1e",
                        fontWeight: 600,
                        textAlign: "right",
                      }}
                    >
                      {v}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #201f1e" }}>
            {(["Date", "Description", "Hrs", "Rate", "Amount"] as const).map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i === 2 || i === 3 || i === 4 ? "right" : "left",
                  padding: "10px 0",
                  fontWeight: 700,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#605e5c",
                  width: i === 0 ? 80 : i === 2 ? 60 : i === 3 ? 70 : i === 4 ? 90 : undefined,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f2f1" }}>
              <td
                style={{
                  padding: "10px 0",
                  color: "#605e5c",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {dateGBShort(it.date)}
              </td>
              <td style={{ padding: "10px 8px 10px 0" }}>
                <div style={{ fontWeight: 500, color: "#201f1e" }}>{it.desc}</div>
                {it.venue && (
                  <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{it.venue}</div>
                )}
              </td>
              <td
                style={{
                  padding: "10px 0",
                  textAlign: "right",
                  color: "#201f1e",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {it.hours.toFixed(1)}
              </td>
              <td
                style={{
                  padding: "10px 0",
                  textAlign: "right",
                  color: "#201f1e",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(it.rate)}
              </td>
              <td
                style={{
                  padding: "10px 0",
                  textAlign: "right",
                  color: "#201f1e",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 600,
                }}
              >
                {money(it.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <table style={{ width: 280, fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 0", color: "#605e5c" }}>Subtotal</td>
              <td
                style={{
                  padding: "6px 0",
                  textAlign: "right",
                  color: "#201f1e",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(inv.subtotal)}
              </td>
            </tr>
            {inv.vat > 0 && (
              <tr>
                <td style={{ padding: "6px 0", color: "#605e5c" }}>VAT @ 20%</td>
                <td
                  style={{
                    padding: "6px 0",
                    textAlign: "right",
                    color: "#201f1e",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {money(inv.vat)}
                </td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #201f1e" }}>
              <td
                style={{
                  padding: "10px 0",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Total due
              </td>
              <td
                style={{
                  padding: "10px 0",
                  textAlign: "right",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 800,
                  fontSize: 18,
                  color: accent.primary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {money(inv.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        style={{
          borderTop: "1px solid #edebe9",
          paddingTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          fontSize: 10.5,
          color: "#a19f9d",
          lineHeight: 1.7,
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              color: "#605e5c",
              marginBottom: 2,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Pay {isStaff ? "into" : "to"}
          </div>
          {isStaff ? (
            staffParty?.bank ? (
              <>
                <div>{staffParty.bank.name}</div>
                <div>
                  Sort: <span style={{ fontFamily: "ui-monospace, monospace" }}>{staffParty.bank.sort}</span>{" "}
                  · Acc: <span style={{ fontFamily: "ui-monospace, monospace" }}>{staffParty.bank.account}</span>
                </div>
              </>
            ) : (
              <div style={{ fontStyle: "italic", color: "#a19f9d" }}>Bank details not on file</div>
            )
          ) : (
            <>
              <div>{COMPANY.bank.name}</div>
              <div>
                Sort: <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.sort}</span>{" "}
                · Acc: <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.acc}</span>
              </div>
              <div style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.iban}</div>
            </>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Co. registered in England · {COMPANY.reg}</div>
          <div>VAT · {COMPANY.vat}</div>
          {inv.note && <div style={{ marginTop: 6, fontStyle: "italic" }}>"{inv.note}"</div>}
        </div>
      </div>
    </div>
  );
}
