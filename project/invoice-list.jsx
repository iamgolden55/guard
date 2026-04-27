// ============================================================
// Invoices — Left pane: filter rail + invoice list
// ============================================================

const InvStatusPill = ({ status, size = "sm" }) => {
  const c = STATUS_COLOR[status] || STATUS_COLOR.pending;
  const padY = size === "lg" ? 5 : 2;
  const padX = size === "lg" ? 10 : 7;
  const fs = size === "lg" ? 11.5 : 10.5;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: `${padY}px ${padX}px`,
      borderRadius: 999, background: c.bg,
      border: `1px solid ${c.border}`, color: c.fg,
      fontSize: fs, fontWeight: 700, letterSpacing: "0.02em",
      textTransform: "uppercase",
      fontFamily: "Inter, sans-serif",
      whiteSpace: "nowrap"
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 3, background: c.fg, opacity: .8 }} />
      {c.label}
    </span>
  );
};

// ----- Aging mini chart -----
const AgingBars = ({ buckets, totalOverdue, accent }) => {
  const max = Math.max(1, ...Object.values(buckets));
  const bars = [
    ["0-30", "0–30 d", "#f4b400"],
    ["31-60", "31–60 d", "#e8770c"],
    ["61-90", "61–90 d", "#d83b01"],
    ["90+", "90+ d", "#8a1820"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {bars.map(([k, label, color]) => {
        const v = buckets[k] || 0;
        const pct = (v / max) * 100;
        return (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "64px 1fr 70px", alignItems: "center", gap: 8, fontFamily: "Inter, sans-serif" }}>
            <span style={{ fontSize: 11, color: "#605e5c", fontWeight: 600 }}>{label}</span>
            <div style={{ height: 8, borderRadius: 4, background: "#f3f2f1", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: v > 0 ? color : "transparent",
                borderRadius: 4,
                transition: "width .35s ease"
              }} />
            </div>
            <span style={{
              fontSize: 11.5, color: v > 0 ? "#201f1e" : "#a19f9d",
              fontWeight: 700, textAlign: "right",
              fontVariantNumeric: "tabular-nums"
            }}>{v > 0 ? moneyShort(v) : "—"}</span>
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid #edebe9", marginTop: 4, paddingTop: 8, display: "flex", justifyContent: "space-between", fontFamily: "Inter, sans-serif" }}>
        <span style={{ fontSize: 11, color: "#605e5c", fontWeight: 600 }}>Total overdue</span>
        <span style={{ fontSize: 12, color: "#8a1820", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{moneyShort(totalOverdue)}</span>
      </div>
    </div>
  );
};

// ----- Status filter chips -----
const StatusFilter = ({ value, onChange, counts, accent }) => {
  const opts = [
    ["all",      "All",      counts.total,    "#605e5c"],
    ["draft",    "Drafts",   counts.draft,    "#605e5c"],
    ["sent",     "Sent",     counts.sent,     "#0b5c9b"],
    ["overdue",  "Overdue",  counts.overdue,  "#8a1820"],
    ["paid",     "Paid",     counts.paid,     "#0f5132"],
    ["rejected", "Rejected", counts.rejected, "#8a4b0a"],
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {opts.map(([id, label, count, fg]) => {
        const active = value === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 9px", borderRadius: 6,
            background: active ? accent.primary : "white",
            border: `1px solid ${active ? accent.primary : "#edebe9"}`,
            color: active ? "white" : "#323130",
            fontFamily: "Inter, sans-serif", fontSize: 12,
            fontWeight: active ? 700 : 500, cursor: "pointer",
            transition: "all .12s"
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 3,
              background: active ? "rgba(255,255,255,0.8)" : fg
            }} />
            {label}
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: active ? "rgba(255,255,255,0.85)" : "#a19f9d",
              fontVariantNumeric: "tabular-nums"
            }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
};

// ----- Invoice list row -----
const InvListRow = ({ inv, selected, onClick, accent }) => {
  const overdueDays = inv.dueDate ? -daysFromToday(inv.dueDate) : 0;
  const isOverdue = inv.status === "overdue";
  const isDraft = inv.status === "draft";
  const partyName = inv.party?.name || "—";
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      padding: "12px 14px", border: "none", cursor: "pointer",
      background: selected ? accent.soft : "white",
      borderLeft: `3px solid ${selected ? accent.primary : "transparent"}`,
      borderBottom: "1px solid #f3f2f1",
      fontFamily: "Inter, sans-serif",
      transition: "background .12s"
    }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#faf9f8"; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "white"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MSAvatar name={partyName} hue={inv.party?.hue || 0} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: "#201f1e",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: 170
            }}>{partyName}</span>
            <span style={{
              fontSize: 13, fontWeight: 700, color: "#201f1e",
              fontVariantNumeric: "tabular-nums", flexShrink: 0
            }}>{money(inv.total)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 }}>
            <span style={{
              fontSize: 11, color: "#a19f9d", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              letterSpacing: "0.02em"
            }}>{inv.id}</span>
            <span style={{ fontSize: 11, color: isOverdue ? "#8a1820" : "#605e5c", fontWeight: isOverdue ? 700 : 500 }}>
              {isDraft && "Draft · " + dateGBShort(inv.periodEnd)}
              {!isDraft && (
                isOverdue
                  ? `${overdueDays}d overdue`
                  : inv.status === "paid"
                    ? `Paid ${dateGBShort(inv.paidDate)}`
                    : `Due ${dateGBShort(inv.dueDate)}`
              )}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
        <InvStatusPill status={inv.status} />
        <span style={{ fontSize: 11, color: "#a19f9d" }}>
          {inv.totalHours}h · {inv.items.length} {inv.items.length === 1 ? "line" : "lines"}
        </span>
      </div>
    </button>
  );
};

// ----- Full left pane -----
const InvLeftPane = ({ invoices, stats, statusFilter, setStatusFilter, search, setSearch,
                      selectedId, setSelectedId, accent, ledger, agingMode }) => {
  const filtered = invoices
    .filter(i => statusFilter === "all" ? true : i.status === statusFilter)
    .filter(i => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return i.id.toLowerCase().includes(q)
          || (i.party?.name || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Drafts first, overdue second by days, then most recent
      const order = { draft: 0, overdue: 1, sent: 2, rejected: 3, paid: 4 };
      const oa = order[a.status] ?? 9;
      const ob = order[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      const da = new Date(a.issueDate || a.periodEnd);
      const db = new Date(b.issueDate || b.periodEnd);
      return db - da;
    });

  return (
    <div className="inv-left-pane" style={{
      width: 340, flexShrink: 0, borderRight: "1px solid #edebe9",
      background: "white", display: "flex", flexDirection: "column",
      height: "calc(100vh - 100px)", position: "sticky", top: 100
    }}>
      {/* Search + filter */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #edebe9" }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span style={{ position: "absolute", left: 10, top: 9, color: "#a19f9d" }}>
            <IIcon name="search" size={14} />
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${ledger === "client" ? "clients" : "officers"} or #…`}
            style={{
              width: "100%", padding: "8px 10px 8px 32px",
              borderRadius: 7, border: "1px solid #edebe9",
              background: "#faf9f8", fontFamily: "Inter, sans-serif",
              fontSize: 13, color: "#201f1e", outline: "none"
            }}
            onFocus={e => { e.target.style.background = "white"; e.target.style.borderColor = accent.primary; }}
            onBlur={e => { e.target.style.background = "#faf9f8"; e.target.style.borderColor = "#edebe9"; }}
          />
        </div>
        <StatusFilter value={statusFilter} onChange={setStatusFilter} counts={stats.counts} accent={accent} />
      </div>

      {/* Aging callout for client view */}
      {ledger === "client" && stats.counts.overdue > 0 && agingMode !== "off" && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #edebe9", background: "#fffaf7" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#8a1820" }}>
              Aging · overdue
            </span>
            <button onClick={() => setStatusFilter("overdue")} style={{
              fontSize: 11, color: "#8a1820", fontWeight: 600, background: "transparent",
              border: "none", cursor: "pointer", textDecoration: "underline", padding: 0
            }}>view</button>
          </div>
          <AgingBars buckets={stats.buckets} totalOverdue={stats.totals.overdue} accent={accent} />
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#a19f9d", fontSize: 13 }}>
            No invoices match.
          </div>
        ) : filtered.map(inv => (
          <InvListRow
            key={inv.id} inv={inv}
            selected={inv.id === selectedId}
            onClick={() => setSelectedId(inv.id)}
            accent={accent}
          />
        ))}
      </div>

      {/* Footer summary */}
      <div style={{
        borderTop: "1px solid #edebe9", padding: "12px 16px",
        background: "#faf9f8", fontFamily: "Inter, sans-serif"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#605e5c", fontWeight: 600 }}>Outstanding</span>
          <span style={{ fontSize: 13, color: "#201f1e", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {money(stats.totals.outstanding)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#605e5c", fontWeight: 600 }}>Paid (last 30d)</span>
          <span style={{ fontSize: 12, color: "#0f5132", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {money(stats.totals.paid)}
          </span>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { InvStatusPill, AgingBars, StatusFilter, InvListRow, InvLeftPane });
