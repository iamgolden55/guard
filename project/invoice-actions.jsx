// ============================================================
// Invoices — Right pane: actions, line breakdown, audit, export
// ============================================================

const Section = ({ title, right, children }) => (
  <div style={{ padding: "16px 18px", borderBottom: "1px solid #f3f2f1" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", fontFamily: "Inter, sans-serif" }}>{title}</span>
      {right}
    </div>
    {children}
  </div>
);

// ----- Action buttons grouped by status -----
const ActionGroup = ({ inv, accent, onAct }) => {
  const buttons = [];
  if (inv.status === "draft") {
    buttons.push({ id: "issue",  label: "Issue & send", icon: "send",     primary: true });
    buttons.push({ id: "edit",   label: "Edit",         icon: "edit" });
    buttons.push({ id: "delete", label: "Discard",      icon: "x" });
  } else if (inv.status === "sent" || inv.status === "overdue") {
    buttons.push({ id: "paid",     label: "Mark paid",  icon: "check",  primary: true });
    buttons.push({ id: "remind",   label: "Send reminder", icon: "mail" });
    buttons.push({ id: "download", label: "Download PDF", icon: "download" });
  } else if (inv.status === "paid") {
    buttons.push({ id: "download", label: "Download PDF", icon: "download", primary: true });
    buttons.push({ id: "duplicate",label: "Duplicate",   icon: "copy" });
  } else if (inv.status === "rejected") {
    buttons.push({ id: "resolve", label: "Resolve & re-issue", icon: "edit", primary: true });
    buttons.push({ id: "void",    label: "Void", icon: "x" });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
      {buttons.map(b => (
        <button key={b.id} onClick={() => onAct(b.id)} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 12px", borderRadius: 8,
          background: b.primary ? accent.primary : "white",
          color: b.primary ? "white" : "#201f1e",
          border: b.primary ? "none" : "1px solid #edebe9",
          fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13,
          cursor: "pointer",
          boxShadow: b.primary ? `0 2px 4px ${accent.primary}33` : "none",
          transition: "all .12s",
        }}>
          <IIcon name={b.icon} size={14} />
          {b.label}
        </button>
      ))}
    </div>
  );
};

// ----- Per-day breakdown chart (visual hours) -----
const HoursStrip = ({ inv, accent }) => {
  // Group items by date
  const byDate = {};
  inv.items.forEach(it => {
    if (!byDate[it.date]) byDate[it.date] = { hours: 0, amount: 0 };
    byDate[it.date].hours += it.hours;
    byDate[it.date].amount += it.amount;
  });
  const days = Object.entries(byDate).sort();
  const maxH = Math.max(...days.map(([_, v]) => v.hours), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, fontFamily: "Inter, sans-serif" }}>
      {days.map(([date, v]) => {
        const h = (v.hours / maxH) * 100;
        const dt = new Date(date);
        const dayLabel = dt.toLocaleDateString("en-GB", { weekday: "narrow" });
        return (
          <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${dateGB(date)} · ${v.hours}h · ${money(v.amount)}`}>
            <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
              <div style={{
                width: "100%", height: `${h}%`,
                background: `linear-gradient(180deg, ${accent.primary}, ${accent.dark})`,
                borderRadius: "3px 3px 0 0", minHeight: 2,
                transition: "height .35s"
              }} />
            </div>
            <span style={{ fontSize: 9.5, color: "#a19f9d", fontWeight: 600 }}>{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
};

// ----- Audit / history timeline -----
const AuditTimeline = ({ history, accent }) => (
  <div style={{ position: "relative", paddingLeft: 18 }}>
    <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 1, background: "#edebe9" }} />
    {history.slice().reverse().map((h, i) => (
      <div key={i} style={{ position: "relative", paddingBottom: 12, fontFamily: "Inter, sans-serif" }}>
        <div style={{
          position: "absolute", left: -18, top: 4,
          width: 9, height: 9, borderRadius: 5,
          background: i === 0 ? accent.primary : "white",
          border: `2px solid ${i === 0 ? accent.primary : "#a19f9d"}`,
        }} />
        <div style={{ fontSize: 12, color: "#201f1e", fontWeight: 500 }}>{h.action}</div>
        <div style={{ fontSize: 10.5, color: "#a19f9d", marginTop: 1 }}>
          {h.at} · {h.by}
        </div>
      </div>
    ))}
  </div>
);

// ----- Export status badge -----
const ExportBadge = ({ status }) => {
  if (!status) return <span style={{ fontSize: 11.5, color: "#a19f9d", fontFamily: "Inter, sans-serif" }}>Not exported</span>;
  const map = {
    pending:    { color: "#7a5500", bg: "#fff8e1", label: "Pending" },
    processing: { color: "#0b5c9b", bg: "#e7f1fb", label: "Processing" },
    completed:  { color: "#0f5132", bg: "#e6f4ea", label: "Synced to Xero" },
    failed:     { color: "#8a1820", bg: "#fde7e9", label: "Failed" },
  };
  const c = map[status] || map.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 999,
      background: c.bg, color: c.color,
      fontSize: 11, fontWeight: 700,
      fontFamily: "Inter, sans-serif"
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 3, background: c.color }} />
      {c.label}
    </span>
  );
};

// ============================================================
// Right pane container
// ============================================================
const InvRightPane = ({ inv, accent, onAct }) => {
  if (!inv) {
    return (
      <div className="inv-right-pane" style={{
        width: 320, flexShrink: 0,
        borderLeft: "1px solid #edebe9", background: "white",
      }} />
    );
  }
  return (
    <div className="inv-right-pane" style={{
      width: 320, flexShrink: 0,
      borderLeft: "1px solid #edebe9", background: "white",
      height: "calc(100vh - 100px)", overflowY: "auto",
      position: "sticky", top: 100,
    }}>
      {/* Header card */}
      <div style={{ padding: "20px 18px 18px", borderBottom: "1px solid #f3f2f1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <MSAvatar name={inv.party.name} hue={inv.party.hue} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              color: "#201f1e"
            }}>{inv.party.name}</div>
            <div style={{ fontSize: 11.5, color: "#605e5c", fontFamily: "Inter, sans-serif" }}>
              {inv.kind === "client" ? `Net ${inv.party.terms} · ${inv.party.email}` : inv.party.role}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <InvStatusPill status={inv.status} size="lg" />
          <span style={{ fontSize: 13, color: "#201f1e", fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: "Inter, sans-serif" }}>{money(inv.total)}</span>
        </div>
        <ActionGroup inv={inv} accent={accent} onAct={onAct} />
      </div>

      {/* Details */}
      <Section title="Details">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 12px", fontSize: 12, fontFamily: "Inter, sans-serif" }}>
          <span style={{ color: "#605e5c" }}>Number</span>
          <span style={{ color: "#201f1e", fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5 }}>{inv.id}</span>
          <span style={{ color: "#605e5c" }}>Issued</span>
          <span style={{ color: "#201f1e", fontWeight: 500 }}>{inv.issueDate ? dateGB(inv.issueDate) : "— draft —"}</span>
          <span style={{ color: "#605e5c" }}>Period</span>
          <span style={{ color: "#201f1e", fontWeight: 500 }}>{dateGBShort(inv.periodStart)} – {dateGBShort(inv.periodEnd)}</span>
          {inv.dueDate && <>
            <span style={{ color: "#605e5c" }}>Due</span>
            <span style={{ color: inv.status === "overdue" ? "#8a1820" : "#201f1e", fontWeight: inv.status === "overdue" ? 700 : 500 }}>
              {dateGB(inv.dueDate)}
              {inv.status === "overdue" && <span style={{ marginLeft: 6, fontSize: 11 }}>· {-daysFromToday(inv.dueDate)}d late</span>}
            </span>
          </>}
          {inv.paidDate && <>
            <span style={{ color: "#605e5c" }}>Paid</span>
            <span style={{ color: "#0f5132", fontWeight: 600 }}>{dateGB(inv.paidDate)}</span>
          </>}
        </div>
      </Section>

      {/* Hours by day */}
      <Section title={`Hours · ${inv.totalHours}h across ${inv.items.length} lines`}>
        <HoursStrip inv={inv} accent={accent} />
      </Section>

      {/* Totals breakdown */}
      <Section title="Breakdown">
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontFamily: "Inter, sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#605e5c" }}>Subtotal</span>
            <span style={{ color: "#201f1e", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{money(inv.subtotal)}</span>
          </div>
          {inv.vat > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#605e5c" }}>VAT @ 20%</span>
              <span style={{ color: "#201f1e", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{money(inv.vat)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTop: "1px solid #edebe9" }}>
            <span style={{ color: "#201f1e", fontWeight: 700 }}>Total</span>
            <span style={{ color: accent.primary, fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{money(inv.total)}</span>
          </div>
        </div>
      </Section>

      {/* Export */}
      <Section
        title="Accounting export"
        right={<button style={{
          fontSize: 11, color: accent.primary, fontWeight: 600, background: "transparent",
          border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif"
        }} onClick={() => onAct("export")}>Re-sync</button>}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Inter, sans-serif", fontSize: 12 }}>
          <span style={{ color: "#605e5c" }}>Xero</span>
          <ExportBadge status={inv.exportStatus} />
        </div>
      </Section>

      {/* Notes */}
      {inv.note && (
        <Section title="Note">
          <div style={{
            padding: 10, background: "#fffaf7", borderRadius: 6,
            fontSize: 12, color: "#323130", fontStyle: "italic",
            fontFamily: "Inter, sans-serif", lineHeight: 1.5
          }}>“{inv.note}”</div>
        </Section>
      )}

      {/* Audit trail */}
      <Section title="Activity">
        <AuditTimeline history={inv.history} accent={accent} />
      </Section>
    </div>
  );
};

// ============================================================
// STATEMENT COMPOSER (multi-invoice client statement)
// ============================================================
const StatementComposer = ({ open, onClose, accent, clients, invoices }) => {
  const [clientId, setClientId] = invS(clients[0]?.id || "");
  const [includeIds, setIncludeIds] = invS([]);

  invE(() => {
    if (open && clientId) {
      // pre-select all unpaid for this client
      const sel = invoices
        .filter(i => i.clientId === clientId && i.status !== "paid" && i.status !== "draft")
        .map(i => i.id);
      setIncludeIds(sel);
    }
  }, [open, clientId]);

  const c = cFind(clientId);
  const list = invoices.filter(i => i.clientId === clientId && i.status !== "draft");
  const selectedInv = list.filter(i => includeIds.includes(i.id));
  const total = selectedInv.reduce((s, i) => s + i.total, 0);
  const overdue = selectedInv.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0);

  const toggle = (id) => setIncludeIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  return (
    <MSModal open={open} onClose={onClose} title="Send statement"
      description="Email a consolidated statement of selected invoices to a client."
      size="lg"
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderTop: "1px solid #edebe9" }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "#605e5c" }}>
            {selectedInv.length} invoices · <span style={{ color: "#201f1e", fontWeight: 700 }}>{money(total)}</span>
            {overdue > 0 && <span style={{ marginLeft: 8, color: "#8a1820", fontWeight: 600 }}>({money(overdue)} overdue)</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <MSButton variant="secondary" onClick={onClose}>Cancel</MSButton>
            <MSButton variant="primary" accent={accent} leading={<IIcon name="send" size={14} />} onClick={onClose}>
              Send to {c?.contact?.split(" ")[0] || "client"}
            </MSButton>
          </div>
        </div>
      }>
      <div style={{ padding: 24 }}>
        {/* Client picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>Client</label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid #edebe9", background: "white",
            fontFamily: "Inter, sans-serif", fontSize: 13, color: "#201f1e",
          }}>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {c && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: "#605e5c", fontFamily: "Inter, sans-serif" }}>
              To: {c.email} · Net {c.terms} terms
            </div>
          )}
        </div>

        {/* Invoice picker */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", fontFamily: "Inter, sans-serif" }}>Include invoices</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setIncludeIds(list.map(i => i.id))} style={{ fontSize: 11, color: accent.primary, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Select all</button>
              <button onClick={() => setIncludeIds([])} style={{ fontSize: 11, color: "#605e5c", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Clear</button>
            </div>
          </div>
          <div style={{ border: "1px solid #edebe9", borderRadius: 8, maxHeight: 240, overflowY: "auto" }}>
            {list.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#a19f9d", fontSize: 12, fontFamily: "Inter, sans-serif" }}>No invoices for this client.</div>
            )}
            {list.map(i => {
              const sel = includeIds.includes(i.id);
              return (
                <label key={i.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderBottom: "1px solid #f3f2f1",
                  cursor: "pointer", background: sel ? accent.soft : "white",
                  fontFamily: "Inter, sans-serif"
                }}>
                  <input type="checkbox" checked={sel} onChange={() => toggle(i.id)}
                    style={{ accentColor: accent.primary, width: 14, height: 14 }} />
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: "#605e5c", width: 130 }}>{i.id}</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#201f1e" }}>
                    {dateGBShort(i.periodStart)} – {dateGBShort(i.periodEnd)}
                  </span>
                  <InvStatusPill status={i.status} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#201f1e", fontVariantNumeric: "tabular-nums", width: 80, textAlign: "right" }}>{money(i.total)}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Email body preview */}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#605e5c", marginBottom: 6, fontFamily: "Inter, sans-serif" }}>Email body</label>
          <textarea defaultValue={`Hi ${c?.contact?.split(" ")[0] || ""},\n\nPlease find attached a statement of your account, summarising ${selectedInv.length} invoices totalling ${money(total)}${overdue > 0 ? ` (${money(overdue)} overdue)` : ""}.\n\nThe statement and individual invoice PDFs are attached. Please don't hesitate to get in touch if you have any queries.\n\nKind regards,\nMaya Chen\nMead Security Ltd`}
            style={{
              width: "100%", minHeight: 140, padding: 12, borderRadius: 8,
              border: "1px solid #edebe9", background: "#faf9f8",
              fontFamily: "Inter, sans-serif", fontSize: 12.5,
              color: "#201f1e", lineHeight: 1.55, resize: "vertical", outline: "none"
            }} />
        </div>
      </div>
    </MSModal>
  );
};

Object.assign(window, { InvRightPane, StatementComposer, ActionGroup, HoursStrip, AuditTimeline, ExportBadge });
