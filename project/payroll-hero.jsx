// ============================================================
// Payroll — Hero, Export strip, Filter bar
// ============================================================

const fmtGBP = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtGBPshort = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const fmtGBPbig = (n) => {
  const rounded = Math.round(n);
  if (rounded >= 1000) return "£" + rounded.toLocaleString("en-GB");
  return fmtGBP(n);
};

// ============================================================
// RUN HERO — the headline module (pending weekly run)
// ============================================================
const RunHero = ({ run, accent, onOpenExport, onGeneratePdfs }) => {
  const paidCount = OFFICERS.filter(o => o.status === "paid").length;
  const rejectedCount = OFFICERS.filter(o => o.status === "rejected").length;
  const pendingCount = OFFICERS.filter(o => o.status === "pending").length;
  const exportedCount = OFFICERS.filter(o => o.exportStatus === "completed").length;
  const deltaPct = ((run.grossTotal - run.prevGross) / run.prevGross) * 100;

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: "white", border: "1px solid #edebe9", borderRadius: 14, padding: 0,
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accent.primary}, ${accent.dark})` }} />

      <div className="run-hero-grid" style={{
        padding: "24px 28px", display: "grid",
        gridTemplateColumns: "1.1fr 1.4fr minmax(220px, auto)", gap: 28, alignItems: "center"
      }}>
        {/* Left: identity */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <MSPill tone="warning" dot>{run.invoices - paidCount - rejectedCount} pending</MSPill>
            <span style={{ fontSize: 12, color: "#605e5c", fontFamily: "SF Mono, monospace" }}>{run.id}</span>
            <span style={{ fontSize: 11, color: "#a19f9d" }}>·</span>
            <span style={{ fontSize: 12, color: "#605e5c" }}>Generated <strong style={{ color: "#201f1e" }}>Mon 27 Apr</strong></span>
          </div>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "#201f1e", lineHeight: 1.1 }}>
            {run.label}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#605e5c", lineHeight: 1.5 }}>
            {run.invoices} invoices · {run.lineItems} line items · {run.hoursBilled.toLocaleString()} hrs · processed every Monday
          </div>

          {/* run composition bar */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#f3f2f1" }}>
              <div style={{ width: `${(paidCount / run.invoices) * 100}%`, background: "#0f9d58" }} title={`${paidCount} paid`} />
              <div style={{ width: `${(pendingCount / run.invoices) * 100}%`, background: "#d97706" }} title={`${pendingCount} pending`} />
              <div style={{ width: `${(rejectedCount / run.invoices) * 100}%`, background: "#cb2431" }} title={`${rejectedCount} rejected`} />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11.5, color: "#605e5c", flexWrap: "wrap" }}>
              <Legend color="#0f9d58" label={`${paidCount} paid`} />
              <Legend color="#d97706" label={`${pendingCount} pending`} />
              {rejectedCount > 0 && <Legend color="#cb2431" label={`${rejectedCount} rejected`} />}
              <span style={{ color: "#a19f9d" }}>· {exportedCount}/{run.invoices} exported to Xero</span>
            </div>
          </div>
        </div>

        {/* Middle: totals */}
        <div className="run-hero-totals" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, borderLeft: "1px solid #edebe9", paddingLeft: 28 }}>
          <TotalCell label="Gross this run"   value={fmtGBPbig(run.grossTotal)}  sub={`${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs last week`} dir={deltaPct > 0 ? "up" : "down"} big />
          <TotalCell label="Officers billed"  value={run.invoices}                sub={`${run.lineItems} line items`} />
          <TotalCell label="Needs attention"  value={pendingCount + rejectedCount} sub={`${run.timeAdjustments} time adjustments · ${run.siaBlocks} SIA`} danger={rejectedCount > 0} />
        </div>

        {/* Right: actions */}
        <div className="run-hero-actions" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
          <MSButton variant="primary" accent={accent} size="lg" leading={<PIcon name="external" size={15} />} onClick={onOpenExport}>
            Export run to Xero
          </MSButton>
          <MSButton variant="secondary" size="md" leading={<PIcon name="file" size={14} />} onClick={onGeneratePdfs}>Download all payslips</MSButton>
          <MSButton variant="ghost" size="sm" leading={<PIcon name="refresh" size={14} />}>Regenerate invoices</MSButton>
        </div>
      </div>
    </div>
  );
};

const Legend = ({ color, label }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
    <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
    {label}
  </span>
);

const TotalCell = ({ label, value, sub, dir, danger, big }) => (
  <div>
    <div style={{ fontSize: 11.5, color: "#605e5c", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    <div style={{
      fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800,
      fontSize: big ? 30 : 26, letterSpacing: "-0.025em", color: danger ? "#cb2431" : "#201f1e",
      fontVariantNumeric: "tabular-nums", lineHeight: 1
    }}>{value}</div>
    {sub && (
      <div style={{ marginTop: 6, fontSize: 11.5, color: dir === "up" ? "#0f5132" : dir === "down" ? "#991b25" : "#a19f9d", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {dir === "up" && <PIcon name="arrow-up" size={10} />}
        {dir === "down" && <PIcon name="arrow-down" size={10} />}
        {sub}
      </div>
    )}
  </div>
);

// ============================================================
// EXPORT STATUS STRIP — replaces the fictional "pay-run timeline"
// Two independent state machines rendered compactly.
// ============================================================
const ExportStrip = ({ accent, run, onOpenExport }) => {
  const defaultProvider = PROVIDERS.find(p => p.default);
  const connected = PROVIDERS.filter(p => p.connected);

  return (
    <div style={{
      background: "white", border: "1px solid #edebe9", borderRadius: 14,
      padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 20, alignItems: "center"
    }}>
      {/* Invoice status summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: "#fff4e5", color: "#d97706",
          display: "grid", placeItems: "center"
        }}>
          <PIcon name="clock" size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 2 }}>Payment status</div>
          <div style={{ fontSize: 13.5, color: "#201f1e", lineHeight: 1.35 }}>
            <strong>Pending</strong> — weekly run processed Mon 27 Apr · marked paid once cleared by accounts
          </div>
        </div>
      </div>

      {/* Export status */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: "1px solid #edebe9", paddingLeft: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: defaultProvider.color + "22", color: defaultProvider.color,
          display: "grid", placeItems: "center", fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 13
        }}>
          {defaultProvider.name[0]}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 2 }}>Export to {defaultProvider.name}</div>
          <div style={{ fontSize: 13.5, color: "#201f1e", lineHeight: 1.35 }}>
            Not yet exported · <span style={{ color: "#605e5c" }}>{connected.length} connector{connected.length === 1 ? "" : "s"} connected</span>
          </div>
        </div>
      </div>

      <MSButton variant="secondary" size="md" leading={<PIcon name="external" size={13} />} onClick={onOpenExport}>Export options</MSButton>
    </div>
  );
};

// ============================================================
// FILTER BAR
// ============================================================
const FilterBar = ({ filter, setFilter, search, setSearch, accent, counts, selected, onBulkExport }) => {
  const chips = [
    { id: "all",      label: "All",      count: counts.all },
    { id: "pending",  label: "Pending",  count: counts.pending },
    { id: "paid",     label: "Paid",     count: counts.paid },
    { id: "rejected", label: "Rejected", count: counts.rejected },
    { id: "flagged",  label: "Needs attention", count: counts.flagged },
  ];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      background: "white", border: "1px solid #edebe9", borderRadius: 14, flexWrap: "wrap"
    }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {chips.map(c => {
          const active = filter === c.id;
          return (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "6px 12px", borderRadius: 999,
              background: active ? accent.primary : "#f3f2f1",
              color: active ? "white" : "#323130",
              border: "none", cursor: "pointer",
              fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 600
            }}>
              {c.label}
              <span style={{
                fontSize: 11, fontFamily: "SF Mono, monospace",
                background: active ? "rgba(255,255,255,0.22)" : "white",
                color: active ? "white" : "#605e5c",
                padding: "0 6px", borderRadius: 8, minWidth: 20, textAlign: "center"
              }}>{c.count}</span>
            </button>
          );
        })}
      </div>
      <div style={{ width: 1, height: 24, background: "#edebe9" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#605e5c", flex: 1, minWidth: 220 }}>
        <PIcon name="search" size={14} />
        <input placeholder="Filter by officer, venue, role…" value={search} onChange={e => setSearch(e.target.value)} style={{
          border: "none", outline: "none", background: "transparent", fontSize: 13,
          fontFamily: "Inter, sans-serif", flex: 1, color: "#323130"
        }}/>
      </div>
      <MSButton variant="secondary" size="sm" leading={<PIcon name="filter" size={13} />}>Venue</MSButton>
      <MSButton variant="secondary" size="sm" leading={<PIcon name="calendar" size={13} />}>Week 17</MSButton>
      {selected > 0 && (
        <>
          <div style={{ width: 1, height: 24, background: "#edebe9" }} />
          <div style={{ fontSize: 12.5, color: "#201f1e", fontWeight: 600 }}>{selected} selected</div>
          <MSButton variant="primary" accent={accent} size="sm" leading={<PIcon name="external" size={13} />} onClick={onBulkExport}>Export</MSButton>
          <MSButton variant="secondary" size="sm" leading={<PIcon name="file" size={13} />}>Payslip PDFs</MSButton>
        </>
      )}
    </div>
  );
};

Object.assign(window, { RunHero, ExportStrip, FilterBar, fmtGBP, fmtGBPshort, fmtGBPbig });
