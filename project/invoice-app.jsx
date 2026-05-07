// ============================================================
// Invoices — Main app (3-pane workspace + tweaks + My-invoices)
// ============================================================

const InvoicesApp = () => {
  // Persisted tweaks
  const [tw, setTw] = invS(INV_TWEAKS);
  const setT = (patch) => {
    const next = { ...tw, ...patch };
    setTw(next);
    window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: patch }, "*");
  };

  // Edit mode availability
  const [editOpen, setEditOpen] = invS(false);
  invE(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setEditOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setEditOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const accent = MS_ACCENTS[tw.accent] || MS_ACCENTS["brand-red"];
  const ledger = tw.ledger || "client";
  const [tab, setTab] = invS(tw.tab || "outbox");
  invE(() => setT({ tab }), [tab]);

  const invoices = ledger === "client" ? CLIENT_INVOICES : STAFF_INVOICES;
  const stats    = ledger === "client" ? CLIENT_STATS    : STAFF_STATS;

  const [statusFilter, setStatusFilter] = invS("all");
  const [search, setSearch] = invS("");
  const [selectedId, setSelectedId] = invS(invoices[0]?.id);
  invE(() => {
    if (!invoices.find(i => i.id === selectedId)) setSelectedId(invoices[0]?.id);
  }, [ledger]);

  const selected = invoices.find(i => i.id === selectedId);

  const [statementOpen, setStatementOpen] = invS(false);
  const [actionToast, setActionToast] = invS(null);
  const onAct = (id) => {
    const labels = {
      issue: "Invoice issued & sent",
      paid: "Marked paid",
      remind: "Reminder sent",
      download: "PDF downloaded",
      duplicate: "Duplicated to draft",
      resolve: "Re-issued",
      void: "Voided",
      delete: "Draft discarded",
      edit: "Editor opened",
      export: "Re-syncing to Xero…",
    };
    setActionToast(labels[id] || id);
    setTimeout(() => setActionToast(null), 2200);
  };

  // Layout
  const sbCollapsed = tw.sidebarCollapsed;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#faf9f8" }}>
      <ISidebar collapsed={sbCollapsed} onToggle={() => setT({ sidebarCollapsed: !sbCollapsed })} accent={accent} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <ITopbar
          accent={accent}
          tab={tab} setTab={setTab}
          ledger={ledger} setLedger={(l) => setT({ ledger: l })}
          stats={stats}
          onNew={() => onAct("issue")}
          onStatement={() => setStatementOpen(true)}
        />

        {tab === "outbox" && (
          <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
            <InvLeftPane
              invoices={invoices} stats={stats}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              search={search} setSearch={setSearch}
              selectedId={selectedId} setSelectedId={setSelectedId}
              accent={accent} ledger={ledger}
              agingMode={tw.agingMode}
            />

            <main style={{
              flex: 1, minWidth: 0, padding: "32px 24px 64px",
              background: tw.paperEffect
                ? "radial-gradient(ellipse at top, #f1eee8 0%, #e8e5df 100%)"
                : "#faf9f8",
              display: "flex", justifyContent: "center", overflowX: "auto",
              transition: "background .3s",
            }}>
              <div className="inv-doc-stage" style={{
                width: 760,
                transform: "scale(0.92)", transformOrigin: "top center",
                marginBottom: -80
              }}>
                <InvoiceDocument
                  inv={selected}
                  template={tw.template}
                  accent={accent}
                  paperEffect={tw.paperEffect}
                />
              </div>
            </main>

            <InvRightPane inv={selected} accent={accent} onAct={onAct} />
          </div>
        )}

        {tab === "my" && <MyInvoicesView accent={accent} />}
        {tab === "archive" && <ArchiveView accent={accent} />}

        {/* Statement composer */}
        <StatementComposer
          open={statementOpen} onClose={() => setStatementOpen(false)}
          accent={accent}
          clients={CLIENTS}
          invoices={CLIENT_INVOICES.filter(i => i.status !== "draft")}
        />

        {/* Action toast */}
        {actionToast && (
          <div style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
            padding: "12px 20px", borderRadius: 999,
            background: "#201f1e", color: "white",
            fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600,
            boxShadow: "0 12px 32px -8px rgba(32,31,30,0.4)",
            display: "inline-flex", alignItems: "center", gap: 10,
            zIndex: 100,
            animation: "toastIn .2s ease-out"
          }}>
            <IIcon name="check" size={14} />
            {actionToast}
          </div>
        )}

        {/* Tweaks */}
        {editOpen && (
          <TweaksPanel title="Tweaks" onClose={() => {
            setEditOpen(false);
            window.parent?.postMessage({ type: "__edit_mode_dismissed" }, "*");
          }}>
            <TweakSection title="Document">
              <TweakRadio label="Template" value={tw.template} onChange={v => setT({ template: v })}
                options={[
                  ["modern", "Modern"],
                  ["classic", "Classic"],
                  ["minimal", "Minimal"],
                ]} />
              <TweakToggle label="Paper texture & shadow" value={tw.paperEffect} onChange={v => setT({ paperEffect: v })} />
              <TweakToggle label="Status stamp overlay" value={tw.showStamp} onChange={v => setT({ showStamp: v })} />
            </TweakSection>

            <TweakSection title="Ledger">
              <TweakRadio label="Show" value={tw.ledger} onChange={v => setT({ ledger: v })}
                options={[["client", "Client invoices"], ["staff", "Staff invoices"]]} />
            </TweakSection>

            <TweakSection title="Layout">
              <TweakRadio label="Aging callout" value={tw.agingMode} onChange={v => setT({ agingMode: v })}
                options={[["bars", "Show bars"], ["off", "Hide"]]} />
              <TweakRadio label="Accent" value={tw.accent} onChange={v => setT({ accent: v })}
                options={[
                  ["brand-red", "Mead red"],
                  ["deep-navy", "Navy"],
                  ["forest", "Forest"],
                ]} />
            </TweakSection>
          </TweaksPanel>
        )}
      </div>
    </div>
  );
};

// ============================================================
// MY INVOICES (staff read-only view)
// ============================================================
const MyInvoicesView = ({ accent }) => {
  // Pretend the logged-in officer is Siobhan (s4)
  const me = sFind("s4");
  const myInvoices = STAFF_INVOICES.filter(i => i.staffId === "s4");
  const [selectedId, setSelectedId] = invS(myInvoices[0]?.id);
  const selected = myInvoices.find(i => i.id === selectedId);

  const ytdPaid = myInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const upcoming = myInvoices.filter(i => i.status === "sent" || i.status === "pending").reduce((s, i) => s + i.total, 0);

  return (
    <div style={{ flex: 1, padding: "24px 24px 64px", background: "#faf9f8" }}>
      {/* Personal hero */}
      <div style={{
        background: "white", borderRadius: 14, border: "1px solid #edebe9",
        padding: 24, marginBottom: 20, display: "flex", alignItems: "center", gap: 20,
        boxShadow: "0 1px 2px rgba(32,31,30,0.04)"
      }}>
        <MSAvatar name={me.name} hue={me.hue} size={64} />
        <div style={{ flex: 1, fontFamily: "Inter, sans-serif" }}>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: "#201f1e" }}>{me.name}</div>
          <div style={{ fontSize: 13, color: "#605e5c", marginTop: 2 }}>{me.role} · UTR {me.utr}</div>
        </div>
        <div style={{ display: "flex", gap: 32, fontFamily: "Inter, sans-serif" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#a19f9d" }}>Upcoming</div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 22, color: accent.primary, fontVariantNumeric: "tabular-nums" }}>{money(upcoming)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#a19f9d" }}>Paid YTD</div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 22, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{money(ytdPaid)}</div>
          </div>
        </div>
      </div>

      {/* List + preview */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20 }}>
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #edebe9", overflow: "hidden", height: "fit-content", boxShadow: "0 1px 2px rgba(32,31,30,0.04)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #edebe9" }}>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14 }}>Pay statements</div>
            <div style={{ fontSize: 11.5, color: "#a19f9d", fontFamily: "Inter, sans-serif" }}>{myInvoices.length} weeks</div>
          </div>
          {myInvoices.map(inv => (
            <button key={inv.id} onClick={() => setSelectedId(inv.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "12px 16px", border: "none", cursor: "pointer",
              background: selectedId === inv.id ? accent.soft : "white",
              borderLeft: `3px solid ${selectedId === inv.id ? accent.primary : "transparent"}`,
              borderBottom: "1px solid #f3f2f1", fontFamily: "Inter, sans-serif"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>
                  Week of {dateGBShort(inv.periodStart)}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{money(inv.total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                <InvStatusPill status={inv.status} />
                <span style={{ fontSize: 11, color: "#a19f9d" }}>{inv.totalHours}h</span>
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          {selected && (
            <div style={{ width: 760, transform: "scale(0.95)", transformOrigin: "top center", marginBottom: -60 }}>
              <InvoiceDocument inv={selected} template="modern" accent={accent} paperEffect={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ARCHIVE (paid history, simple table)
// ============================================================
const ArchiveView = ({ accent }) => {
  const all = [...CLIENT_INVOICES, ...STAFF_INVOICES].filter(i => i.status === "paid")
    .sort((a, b) => new Date(b.paidDate) - new Date(a.paidDate));
  return (
    <div style={{ flex: 1, padding: 24, background: "#faf9f8" }}>
      <div style={{ background: "white", borderRadius: 14, border: "1px solid #edebe9", overflow: "hidden", boxShadow: "0 1px 2px rgba(32,31,30,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#faf9f8" }}>
              {["Number", "Party", "Period", "Paid on", "Hours", "Total", ""].map(h => (
                <th key={h} style={{
                  textAlign: h === "Hours" || h === "Total" ? "right" : "left",
                  padding: "12px 16px", fontSize: 10.5, fontWeight: 700,
                  letterSpacing: "0.09em", textTransform: "uppercase",
                  color: "#605e5c", borderBottom: "1px solid #edebe9"
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map(inv => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f3f2f1" }}>
                <td style={{ padding: "14px 16px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: "#605e5c" }}>{inv.id}</td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <MSAvatar name={inv.party.name} hue={inv.party.hue} size={26} />
                    <div>
                      <div style={{ fontWeight: 600, color: "#201f1e" }}>{inv.party.name}</div>
                      <div style={{ fontSize: 11, color: "#a19f9d" }}>{inv.kind === "client" ? "Client" : "Officer"}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", color: "#605e5c" }}>{dateGBShort(inv.periodStart)} – {dateGBShort(inv.periodEnd)}</td>
                <td style={{ padding: "14px 16px", color: "#0f5132", fontWeight: 600 }}>{dateGB(inv.paidDate)}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: "#605e5c", fontVariantNumeric: "tabular-nums" }}>{inv.totalHours}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{money(inv.total)}</td>
                <td style={{ padding: "14px 16px", textAlign: "right" }}>
                  <button style={{
                    background: "transparent", border: "1px solid #edebe9", borderRadius: 6,
                    padding: "5px 10px", fontSize: 12, color: "#323130",
                    cursor: "pointer", fontFamily: "Inter, sans-serif", fontWeight: 600
                  }}>
                    <IIcon name="download" size={12} /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================
// MOUNT
// ============================================================
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<InvoicesApp />);
