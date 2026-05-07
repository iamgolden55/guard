// ============================================================
// Invoices — Document preview (the SIGNATURE element)
// Three templates: classic / modern / minimal
// Renders on real "paper": shadow, deckle edge optional, status stamp
// ============================================================

// ---- Status stamp overlay ----
const StatusStamp = ({ status }) => {
  if (status !== "paid" && status !== "overdue" && status !== "rejected" && status !== "draft") return null;
  const stamps = {
    paid:     { label: "PAID",     sub: "Thank you", color: "#0f5132", angle: -14 },
    overdue:  { label: "OVERDUE",  sub: "Action required", color: "#8a1820", angle: -8 },
    rejected: { label: "VOIDED",   sub: "On hold", color: "#8a4b0a", angle: -10 },
    draft:    { label: "DRAFT",    sub: "Not issued", color: "#605e5c", angle: -6 },
  };
  const s = stamps[status];
  return (
    <div aria-hidden style={{
      position: "absolute", top: 110, right: 36,
      transform: `rotate(${s.angle}deg)`,
      pointerEvents: "none", userSelect: "none",
      padding: "8px 18px",
      border: `4px solid ${s.color}`,
      borderRadius: 6,
      color: s.color,
      opacity: 0.32,
      fontFamily: "Plus Jakarta Sans, sans-serif",
      textAlign: "center",
      mixBlendMode: "multiply",
      boxShadow: `inset 0 0 0 1px ${s.color}`,
    }}>
      <div style={{
        fontSize: 36, fontWeight: 900, letterSpacing: "0.08em",
        lineHeight: 1, marginBottom: 2
      }}>{s.label}</div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.18em",
        textTransform: "uppercase"
      }}>{s.sub}</div>
    </div>
  );
};

// ---- Shared helpers ----
const PaperFrame = ({ children, paperEffect, scale = 1 }) => (
  <div style={{
    position: "relative",
    background: "white",
    width: 760,
    minHeight: 1000,
    boxShadow: paperEffect
      ? "0 1px 1px rgba(32,31,30,0.04), 0 4px 8px rgba(32,31,30,0.06), 0 24px 48px -12px rgba(32,31,30,0.18), 0 48px 80px -24px rgba(32,31,30,0.12)"
      : "0 1px 2px rgba(32,31,30,0.06), 0 4px 12px rgba(32,31,30,0.08)",
    borderRadius: paperEffect ? 4 : 8,
    transform: `scale(${scale})`,
    transformOrigin: "top center",
    overflow: "hidden",
  }}>
    {paperEffect && (
      <>
        {/* Subtle paper grain */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(255,250,240,0.6), transparent 50%)," +
            "radial-gradient(ellipse at 100% 100%, rgba(245,240,235,0.5), transparent 60%)",
          mixBlendMode: "multiply",
        }} />
        {/* Top edge highlight */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.9), rgba(255,255,255,0))",
        }} />
      </>
    )}
    {children}
  </div>
);

// ============================================================
// TEMPLATE 1 — CLASSIC (formal British accountancy style)
// ============================================================
const ClassicInvoice = ({ inv, accent }) => {
  const isStaff = inv.kind === "staff";
  return (
    <div style={{
      padding: "56px 56px 48px",
      fontFamily: "Inter, sans-serif",
      color: "#201f1e",
    }}>
      <StatusStamp status={inv.status} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            marginBottom: 14
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `linear-gradient(135deg, ${accent.primary}, ${accent.dark})`,
              display: "grid", placeItems: "center"
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/>
              </svg>
            </div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
              {COMPANY.name}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
            {COMPANY.address.map((l,i) => <div key={i}>{l}</div>)}
            <div style={{ marginTop: 4 }}>{COMPANY.email}</div>
            <div>{COMPANY.phone}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "Plus Jakarta Sans, sans-serif",
            fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em",
            color: "#201f1e", lineHeight: 1
          }}>INVOICE</div>
          <div style={{ fontSize: 11.5, color: "#605e5c", marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: "0.04em" }}>
            {inv.id}
          </div>
        </div>
      </div>

      {/* Bill to + meta */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24,
        padding: "20px 0", borderTop: "1px solid #201f1e", borderBottom: "1px solid #edebe9", marginBottom: 24
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a19f9d", marginBottom: 6 }}>
            {isStaff ? "Pay to" : "Billed to"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{inv.party.name}</div>
          {!isStaff && (
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              {inv.party.contact && <div>Attn: {inv.party.contact}</div>}
              {inv.party.address?.map((l,i) => <div key={i}>{l}</div>)}
              <div style={{ marginTop: 4 }}>{inv.party.email}</div>
            </div>
          )}
          {isStaff && (
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              <div>{inv.party.role}</div>
              <div style={{ marginTop: 4 }}>UTR · <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{inv.party.utr}</span></div>
              <div>BACS · <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{inv.party.bank}</span></div>
            </div>
          )}
        </div>
        <div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Invoice date", inv.issueDate ? dateGB(inv.issueDate) : "— draft —"],
                ["Service period", `${dateGBShort(inv.periodStart)} – ${dateGB(inv.periodEnd)}`],
                ["Payment due", inv.dueDate ? dateGB(inv.dueDate) : "—"],
                inv.status === "paid" ? ["Paid on", dateGB(inv.paidDate)] : null,
                !isStaff ? ["Terms", `Net ${inv.party.terms}`] : null,
                !isStaff ? ["VAT no.", COMPANY.vat] : null,
              ].filter(Boolean).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: "4px 0", color: "#605e5c", width: "45%" }}>{k}</td>
                  <td style={{ padding: "4px 0", color: "#201f1e", fontWeight: 600, textAlign: "right" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #201f1e" }}>
            <th style={{ textAlign: "left", padding: "10px 0", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#605e5c", width: 80 }}>Date</th>
            <th style={{ textAlign: "left", padding: "10px 0", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#605e5c" }}>Description</th>
            <th style={{ textAlign: "right", padding: "10px 0", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#605e5c", width: 60 }}>Hrs</th>
            <th style={{ textAlign: "right", padding: "10px 0", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#605e5c", width: 70 }}>Rate</th>
            <th style={{ textAlign: "right", padding: "10px 0", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#605e5c", width: 90 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f2f1" }}>
              <td style={{ padding: "10px 0", color: "#605e5c", fontVariantNumeric: "tabular-nums" }}>{dateGBShort(it.date)}</td>
              <td style={{ padding: "10px 8px 10px 0" }}>
                <div style={{ fontWeight: 500, color: "#201f1e" }}>{it.desc}</div>
                {it.venue && <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{it.venue}</div>}
              </td>
              <td style={{ padding: "10px 0", textAlign: "right", color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{it.hours.toFixed(1)}</td>
              <td style={{ padding: "10px 0", textAlign: "right", color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{money(it.rate)}</td>
              <td style={{ padding: "10px 0", textAlign: "right", color: "#201f1e", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{money(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
        <table style={{ width: 280, fontSize: 12, borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 0", color: "#605e5c" }}>Subtotal</td>
              <td style={{ padding: "6px 0", textAlign: "right", color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{money(inv.subtotal)}</td>
            </tr>
            {inv.vat > 0 && (
              <tr>
                <td style={{ padding: "6px 0", color: "#605e5c" }}>VAT @ 20%</td>
                <td style={{ padding: "6px 0", textAlign: "right", color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{money(inv.vat)}</td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #201f1e" }}>
              <td style={{ padding: "10px 0", fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14 }}>Total due</td>
              <td style={{ padding: "10px 0", textAlign: "right", fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 18, color: accent.primary, fontVariantNumeric: "tabular-nums" }}>{money(inv.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #edebe9", paddingTop: 16,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
        fontSize: 10.5, color: "#a19f9d", lineHeight: 1.7
      }}>
        <div>
          <div style={{ fontWeight: 700, color: "#605e5c", marginBottom: 2, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>Payment</div>
          <div>{COMPANY.bank.name}</div>
          <div>Sort: <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.sort}</span> · Acc: <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.acc}</span></div>
          <div style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.iban}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Co. registered in England · {COMPANY.reg}</div>
          <div>VAT · {COMPANY.vat}</div>
          {inv.note && <div style={{ marginTop: 6, fontStyle: "italic" }}>“{inv.note}”</div>}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TEMPLATE 2 — MODERN (large hero + clean blocks)
// ============================================================
const ModernInvoice = ({ inv, accent }) => {
  const isStaff = inv.kind === "staff";
  return (
    <div style={{
      fontFamily: "Inter, sans-serif",
      color: "#201f1e", position: "relative"
    }}>
      <StatusStamp status={inv.status} />

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${accent.soft}, white)`,
        padding: "48px 56px 32px",
        borderBottom: `4px solid ${accent.primary}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 7,
                background: accent.primary,
                display: "grid", placeItems: "center"
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z"/>
                </svg>
              </div>
              <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 16 }}>{COMPANY.name}</span>
            </div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 36, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>
              {money(inv.total)}
            </div>
            <div style={{ fontSize: 13, color: "#605e5c" }}>
              {inv.status === "paid"
                ? `Paid on ${dateGB(inv.paidDate)}`
                : inv.status === "draft"
                  ? `Draft · ready for review`
                  : inv.status === "overdue"
                    ? `Overdue by ${-daysFromToday(inv.dueDate)} days`
                    : `Due ${dateGB(inv.dueDate)}`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              display: "inline-block",
              padding: "6px 12px", borderRadius: 999,
              background: "white", border: "1px solid #edebe9",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              color: "#605e5c", marginBottom: 10
            }}>INVOICE</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, color: "#201f1e", letterSpacing: "0.04em" }}>{inv.id}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", marginTop: 4 }}>
              Issued {inv.issueDate ? dateGB(inv.issueDate) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "32px 56px 48px" }}>
        {/* Parties */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a19f9d", marginBottom: 8 }}>From</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{COMPANY.name}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              {COMPANY.address.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a19f9d", marginBottom: 8 }}>{isStaff ? "Pay to" : "Billed to"}</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{inv.party.name}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              {!isStaff && inv.party.contact && <div>Attn: {inv.party.contact}</div>}
              {!isStaff && inv.party.address?.map((l, i) => <div key={i}>{l}</div>)}
              {isStaff && <><div>{inv.party.role}</div><div style={{ marginTop: 2, fontFamily: "ui-monospace, monospace" }}>UTR {inv.party.utr}</div></>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a19f9d", marginBottom: 8 }}>Service period</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{dateGBShort(inv.periodStart)} – {dateGBShort(inv.periodEnd)}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.6 }}>
              <div>{inv.totalHours} hours · {inv.items.length} line items</div>
              {!isStaff && <div>Terms: Net {inv.party.terms} days</div>}
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ borderRadius: 8, border: "1px solid #edebe9", overflow: "hidden", marginBottom: 24 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#faf9f8" }}>
                <th style={{ textAlign: "left", padding: "11px 16px", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", width: 80 }}>Date</th>
                <th style={{ textAlign: "left", padding: "11px 8px", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c" }}>Description</th>
                <th style={{ textAlign: "right", padding: "11px 8px", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", width: 50 }}>Hrs</th>
                <th style={{ textAlign: "right", padding: "11px 8px", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", width: 70 }}>Rate</th>
                <th style={{ textAlign: "right", padding: "11px 16px", fontWeight: 700, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", width: 90 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f2f1" }}>
                  <td style={{ padding: "12px 16px", color: "#605e5c", fontVariantNumeric: "tabular-nums" }}>{dateGBShort(it.date)}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ fontWeight: 500 }}>{it.desc}</div>
                    {it.venue && <div style={{ fontSize: 11, color: "#a19f9d" }}>{it.venue}</div>}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.hours.toFixed(1)}</td>
                  <td style={{ padding: "12px 8px", textAlign: "right", color: "#605e5c", fontVariantNumeric: "tabular-nums" }}>{money(it.rate)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
          <div style={{ flex: 1, fontSize: 11.5, color: "#605e5c", lineHeight: 1.7 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a19f9d", marginBottom: 8 }}>Bank</div>
            <div>{COMPANY.bank.name}</div>
            <div>Sort <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.sort}</span> · Acc <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.acc}</span></div>
            <div style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.iban}</div>
            {inv.note && <div style={{ marginTop: 10, padding: 10, background: "#faf9f8", borderRadius: 6, color: "#323130" }}>{inv.note}</div>}
          </div>
          <div style={{ width: 240, padding: 18, background: "#faf9f8", borderRadius: 10, fontSize: 12 }}>
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
            <div style={{ borderTop: "1px solid #edebe9", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 13 }}>Total</span>
              <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 22, color: accent.primary, fontVariantNumeric: "tabular-nums" }}>{money(inv.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// TEMPLATE 3 — MINIMAL (typographic, almost editorial)
// ============================================================
const MinimalInvoice = ({ inv, accent }) => {
  const isStaff = inv.kind === "staff";
  return (
    <div style={{
      padding: "72px 64px 56px",
      fontFamily: "Inter, sans-serif",
      color: "#201f1e", position: "relative"
    }}>
      <StatusStamp status={inv.status} />

      {/* Tiny header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 56, fontSize: 11, color: "#a19f9d", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        <span>{COMPANY.name}</span>
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{inv.id}</span>
      </div>

      {/* Massive total */}
      <div style={{
        fontFamily: "Plus Jakarta Sans, sans-serif",
        fontWeight: 800, fontSize: 84, letterSpacing: "-0.04em",
        lineHeight: 0.95, marginBottom: 8, color: "#201f1e"
      }}>{money(inv.total)}</div>
      <div style={{ fontSize: 14, color: "#605e5c", marginBottom: 56 }}>
        {isStaff ? "owed to" : "due from"}{" "}
        <span style={{ color: "#201f1e", fontWeight: 600 }}>{inv.party.name}</span>
        {" · "}
        {inv.status === "paid"
          ? `paid ${dateGB(inv.paidDate)}`
          : inv.status === "draft"
            ? "draft, not yet issued"
            : inv.status === "overdue"
              ? `overdue ${-daysFromToday(inv.dueDate)} days`
              : `due ${dateGB(inv.dueDate)}`}
      </div>

      {/* Meta strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0, padding: "16px 0",
        borderTop: "1px solid #201f1e", borderBottom: "1px solid #edebe9",
        marginBottom: 32
      }}>
        {[
          ["Period", `${dateGBShort(inv.periodStart)} – ${dateGBShort(inv.periodEnd)}`],
          ["Issued", inv.issueDate ? dateGB(inv.issueDate) : "—"],
          ["Hours", `${inv.totalHours.toFixed(1)} h`],
          [isStaff ? "Pay" : "Terms", isStaff ? "BACS" : `Net ${inv.party.terms}`],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a19f9d", marginBottom: 4 }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Items as simple list */}
      <div style={{ marginBottom: 32 }}>
        {inv.items.map((it, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "70px 1fr 60px 90px",
            alignItems: "baseline", gap: 16,
            padding: "14px 0", borderBottom: "1px solid #f3f2f1"
          }}>
            <span style={{ fontSize: 11.5, color: "#a19f9d", fontVariantNumeric: "tabular-nums" }}>{dateGBShort(it.date)}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.desc}</div>
              {it.venue && <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 1 }}>{it.venue}</div>}
            </div>
            <span style={{ fontSize: 11.5, color: "#605e5c", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{it.hours.toFixed(1)}h</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(it.amount)}</span>
          </div>
        ))}
      </div>

      {/* Totals (right-aligned, no chrome) */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 48 }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "#605e5c" }}>
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: "#201f1e" }}>{money(inv.subtotal)}</span>
          </div>
          {inv.vat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 12, color: "#605e5c" }}>
              <span>VAT @ 20%</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#201f1e" }}>{money(inv.vat)}</span>
            </div>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            padding: "12px 0 0", marginTop: 6, borderTop: "2px solid #201f1e",
            fontFamily: "Plus Jakarta Sans, sans-serif"
          }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: accent.primary, fontVariantNumeric: "tabular-nums" }}>{money(inv.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 10.5, color: "#a19f9d", display: "flex", justifyContent: "space-between", borderTop: "1px solid #edebe9", paddingTop: 14 }}>
        <span>{COMPANY.bank.name} · Sort <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.sort}</span> · Acc <span style={{ fontFamily: "ui-monospace, monospace" }}>{COMPANY.bank.acc}</span></span>
        <span>VAT {COMPANY.vat}</span>
      </div>
    </div>
  );
};

// ============================================================
// Wrapper — selects template, scales to fit container
// ============================================================
const InvoiceDocument = ({ inv, template, accent, paperEffect, scale = 1 }) => {
  if (!inv) {
    return (
      <div style={{
        display: "grid", placeItems: "center", height: 400,
        color: "#a19f9d", fontFamily: "Inter, sans-serif", fontSize: 14
      }}>Select an invoice from the list</div>
    );
  }
  const T = template === "classic" ? ClassicInvoice
        :  template === "minimal" ? MinimalInvoice
        :  ModernInvoice;
  return (
    <PaperFrame paperEffect={paperEffect} scale={scale}>
      <T inv={inv} accent={accent} />
    </PaperFrame>
  );
};

Object.assign(window, { InvoiceDocument, ClassicInvoice, ModernInvoice, MinimalInvoice, StatusStamp, PaperFrame });
