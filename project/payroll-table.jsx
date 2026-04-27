// ============================================================
// Payroll — Officers table + right-rail widgets
// Columns: officer · base+OT · BH/AL · gross · status · export · flags
// Expanded row: InvoiceItems + ShiftTimeAdjustment audit
// ============================================================

const siaTone = (sia) => {
  if (sia.expired) return { tone: "danger", label: "SIA expired", tip: `${Math.abs(sia.expiresInDays)}d ago` };
  if (sia.expiresInDays <= 30) return { tone: "warning", label: "SIA expiring", tip: `${sia.expiresInDays}d` };
  return null;
};

const OfficerRow = ({ o, accent, expanded, onToggle, onSelect, selected, onOpenDetail, density }) => {
  const meta = STATUS_META[o.status];
  const expMeta = o.exportStatus ? EXPORT_META[o.exportStatus] : null;
  const rowPad = density === "compact" ? "10px 16px" : density === "spacious" ? "18px 16px" : "14px 16px";
  const bundle = ITEMS_BY_OFFICER[o.id];
  const otHrs = o.ot1Hrs + o.ot2Hrs;
  const siaWarn = siaTone(o.sia);

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 2fr 1fr 0.9fr 0.9fr 1fr 1.1fr 40px",
        alignItems: "center", gap: 12, padding: rowPad,
        borderBottom: expanded ? "none" : "1px solid #f3f2f1",
        background: selected ? accent.soft : "white",
        transition: "background .15s", cursor: "pointer"
      }}
        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#faf9f8"; }}
        onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "white"; }}
      >
        <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onSelect(o.id); }}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: accent.primary, width: 16, height: 16, cursor: "pointer" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }} onClick={() => onOpenDetail(o)}>
          <MSAvatar name={o.name} hue={o.hue} size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#201f1e", letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
              {siaWarn && (
                <span title={`SIA ${siaWarn.tip}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", padding: "1px 5px", borderRadius: 4,
                  background: siaWarn.tone === "danger" ? "#fde7e9" : "#fff4e5",
                  color: siaWarn.tone === "danger" ? "#991b25" : "#7a4a00",
                }}>
                  <PIcon name={siaWarn.tone === "danger" ? "shield-x" : "shield"} size={10} />
                  {siaWarn.tip}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "#a19f9d", marginTop: 1 }}>{o.role} · {o.venue}</div>
          </div>
        </div>

        {/* Base + OT */}
        <div style={{ fontSize: 13, color: "#323130", fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 600 }}>{o.baseHrs.toFixed(1)}h</span>
          <span style={{ color: "#a19f9d", fontSize: 11, marginLeft: 4 }}>@ {fmtGBP(o.rate)}</span>
          {otHrs > 0 && (
            <div style={{ fontSize: 11, color: "#7a4a00", fontWeight: 600, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {o.ot1Hrs > 0 && <span>+{o.ot1Hrs}h OT1.5×</span>}
              {o.ot2Hrs > 0 && <span style={{ color: "#991b25" }}>+{o.ot2Hrs}h OT2×</span>}
            </div>
          )}
        </div>

        {/* Bank holiday */}
        <div style={{ fontSize: 13, color: "#323130", fontVariantNumeric: "tabular-nums" }}>
          {o.bhDays > 0 ? `${o.bhDays}d` : <span style={{ color: "#c8c6c4" }}>—</span>}
        </div>

        {/* Annual leave */}
        <div style={{ fontSize: 13, color: "#323130", fontVariantNumeric: "tabular-nums" }}>
          {o.alDays > 0 ? `${o.alDays}d` : <span style={{ color: "#c8c6c4" }}>—</span>}
        </div>

        {/* Gross */}
        <div>
          <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontSize: 15, fontWeight: 700, color: "#201f1e", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
            {fmtGBP(o.gross)}
          </div>
          {o.adjustments > 0 && (
            <div style={{ fontSize: 10.5, color: "#605e5c", marginTop: 2, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <PIcon name="edit" size={9} />
              {o.adjustments} adjustment{o.adjustments === 1 ? "" : "s"}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <MSPill tone={meta.tone} dot>{meta.label}</MSPill>
          {o.rejectReason && (
            <div style={{ fontSize: 10.5, color: "#991b25", marginTop: 4, maxWidth: 180, lineHeight: 1.25 }}>
              {o.rejectReason}
            </div>
          )}
        </div>

        {/* Export */}
        <div>
          {expMeta ? (
            <MSPill tone={expMeta.tone} dot>{expMeta.label}</MSPill>
          ) : (
            <span style={{ fontSize: 11.5, color: "#a19f9d" }}>Not exported</span>
          )}
          <div style={{ fontSize: 10.5, color: "#a19f9d", marginTop: 3 }}>
            {o.exportStatus ? "Xero" : "Ready to send"}
          </div>
        </div>

        <button onClick={(e) => { e.stopPropagation(); onToggle(o.id); }} style={{
          width: 32, height: 32, borderRadius: 8, background: expanded ? accent.soft : "transparent",
          border: "none", color: expanded ? accent.primary : "#605e5c",
          cursor: "pointer", display: "grid", placeItems: "center"
        }}>
          <PIcon name="chevron-down" size={16} />
        </button>
      </div>

      {expanded && bundle && (
        <div style={{ padding: "0 16px 18px 64px", background: "#faf9f8", borderBottom: "1px solid #f3f2f1" }}>
          {/* InvoiceItems */}
          <div style={{ background: "white", border: "1px solid #edebe9", borderRadius: 10, overflow: "hidden", marginTop: 4 }}>
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid #f3f2f1", background: "#faf9f8",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#605e5c" }}>
                Invoice line items · {bundle.items.length}
              </span>
              <span style={{ fontSize: 11, color: "#a19f9d", fontFamily: "SF Mono, monospace" }}>
                INV-{o.id.toString().padStart(4, "0")}-W17
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr 1.6fr 70px 90px 90px",
              fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
              color: "#a19f9d", padding: "10px 14px", borderBottom: "1px solid #f3f2f1"
            }}>
              <span>Date</span><span>Type</span><span>Detail</span><span>Hrs</span><span>Rate</span><span style={{ textAlign: "right" }}>Amount</span>
            </div>
            {bundle.items.map((it, i) => {
              const tm = ITEM_TYPE_META[it.type];
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 1.6fr 70px 90px 90px",
                  fontSize: 12.5, padding: "10px 14px",
                  borderBottom: i === bundle.items.length - 1 ? "none" : "1px solid #f3f2f1",
                  color: "#323130", alignItems: "center"
                }}>
                  <span style={{ fontFamily: "SF Mono, monospace", color: "#605e5c" }}>{it.date}</span>
                  <span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em",
                      padding: "2px 6px", borderRadius: 4,
                      background: tm.bg, color: tm.fg
                    }}>{tm.label}</span>
                  </span>
                  <span style={{ color: "#323130" }}>
                    <span style={{ color: "#605e5c" }}>{it.venue} · </span>{it.detail}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {it.hrs != null ? `${it.hrs.toFixed(1)}h` : <span style={{ color: "#c8c6c4" }}>—</span>}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "#605e5c" }}>
                    {it.rate != null ? `${fmtGBP(it.rate)}/h` : <span style={{ color: "#c8c6c4" }}>daily</span>}
                  </span>
                  <span style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtGBP(it.amount)}</span>
                </div>
              );
            })}
          </div>

          {/* ShiftTimeAdjustment audit */}
          {bundle.adjustments.length > 0 && (
            <div style={{ marginTop: 10, background: "white", border: "1px solid #edebe9", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #f3f2f1", background: "#faf9f8", display: "flex", alignItems: "center", gap: 8 }}>
                <PIcon name="history" size={12} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#605e5c" }}>
                  Time adjustments · {bundle.adjustments.length}
                </span>
              </div>
              {bundle.adjustments.map((a, i) => (
                <div key={i} style={{ padding: "10px 14px", fontSize: 12, borderBottom: i === bundle.adjustments.length - 1 ? "none" : "1px solid #f3f2f1", color: "#323130" }}>
                  <div>
                    <strong style={{ fontFamily: "SF Mono, monospace" }}>{a.date}</strong> · {a.shift}
                    <span style={{ marginLeft: 8, fontFamily: "SF Mono, monospace", color: "#605e5c" }}>
                      {a.before} → <span style={{ color: "#201f1e", fontWeight: 600 }}>{a.after}</span>
                    </span>
                    <span style={{ marginLeft: 8, color: "#d97706", fontWeight: 600 }}>{a.delta}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 2 }}>
                    by {a.by} · {a.on}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <MSButton variant="ghost" size="sm" leading={<PIcon name="edit" size={12} />}>Adjust hours</MSButton>
            <MSButton variant="secondary" size="sm" leading={<PIcon name="file" size={12} />}>Payslip PDF</MSButton>
            {o.status === "pending" && (
              <MSButton variant="secondary" size="sm" leading={<PIcon name="x" size={12} />}>Reject invoice</MSButton>
            )}
            <MSButton variant="primary" accent={accent} size="sm" leading={<PIcon name="external" size={12} />}>Export to Xero</MSButton>
          </div>
        </div>
      )}
    </>
  );
};

const OfficersTable = ({ officers, accent, selectedIds, setSelectedIds, onOpenDetail, density }) => {
  const [expandedId, setExpandedId] = useState(4); // expanded by default to showcase
  const allSelected = officers.length > 0 && officers.every(o => selectedIds.includes(o.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(officers.map(o => o.id));
  };
  const toggleOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="officers-table" style={{ background: "white", border: "1px solid #edebe9", borderRadius: 14, overflow: "hidden" }}>
      <div className="officers-scroll" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 1040 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "32px 2fr 1fr 0.9fr 0.9fr 1fr 1.1fr 40px",
            gap: 12, padding: "14px 16px", background: "#faf9f8",
            borderBottom: "1px solid #edebe9",
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#605e5c"
          }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              style={{ accentColor: accent.primary, width: 16, height: 16, cursor: "pointer" }} />
            <span>Officer</span>
            <span>Base + OT</span>
            <span>Bank hol.</span>
            <span>Annual lv.</span>
            <span>Gross</span>
            <span>Invoice · Export</span>
            <span></span>
          </div>
          {officers.map(o => (
            <OfficerRow key={o.id} o={o} accent={accent}
              expanded={expandedId === o.id}
              onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
              selected={selectedIds.includes(o.id)}
              onSelect={toggleOne}
              onOpenDetail={onOpenDetail}
              density={density}
            />
          ))}
          {officers.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "#a19f9d" }}>
              No officers match your filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// RIGHT-RAIL WIDGETS
// ============================================================
const CompositionCard = ({ accent }) => {
  // Aggregate InvoiceItem types across the run (derived, illustrative)
  const items = [
    { label: "Base shift hours",   value: 58940, tone: "#201f1e" },
    { label: "Overtime · 1.5×",    value: 10820, tone: "#d97706" },
    { label: "Overtime · 2×",      value: 3210,  tone: "#991b25" },
    { label: "Bank holiday",       value: 4880,  tone: "#312e81" },
    { label: "Annual leave",       value: 2400,  tone: "#0f5132" },
    { label: "Special event",      value: 3960,  tone: "#78350f" },
  ];
  const total = items.reduce((a, b) => a + b.value, 0);
  const max = Math.max(...items.map(i => Math.abs(i.value)));
  return (
    <MSCard padding={20}>
      <MSSectionHeader title="Run composition" subtitle="Gross by InvoiceItem type" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map(it => {
          const pct = (Math.abs(it.value) / max) * 100;
          return (
            <div key={it.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12.5 }}>
                <span style={{ color: "#605e5c" }}>{it.label}</span>
                <span style={{ color: it.tone, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmtGBPshort(it.value)}</span>
              </div>
              <div style={{ height: 4, background: "#f3f2f1", borderRadius: 2 }}>
                <div style={{ width: pct + "%", height: "100%", background: it.tone, opacity: 0.75, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 16,
        paddingTop: 14, borderTop: "1px dashed #edebe9", alignItems: "baseline"
      }}>
        <span style={{ ...MSText.over, color: "#605e5c" }}>Gross total</span>
        <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 22, color: accent.primary, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em" }}>{fmtGBPshort(total)}</span>
      </div>
    </MSCard>
  );
};

const SiaHoldsCard = ({ accent }) => {
  const flagged = OFFICERS.filter(o => o.sia.expired || o.sia.expiresInDays <= 30);
  return (
    <MSCard padding={20}>
      <MSSectionHeader title="SIA licence holds" subtitle="Blocks new shifts · flag on payslip" />
      {flagged.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#a19f9d" }}>No SIA issues this run.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {flagged.map(o => {
            const exp = o.sia.expired;
            return (
              <div key={o.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8, background: "#faf9f8",
                border: `1px solid ${exp ? "#fbd0d4" : "#f3f2f1"}`
              }}>
                <MSAvatar name={o.name} hue={o.hue} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#201f1e" }}>{o.name}</div>
                  <div style={{ fontSize: 11, color: "#605e5c", fontFamily: "SF Mono, monospace" }}>{o.sia.level} · {o.sia.number.slice(-9)}</div>
                </div>
                <MSPill tone={exp ? "danger" : "warning"} dot>
                  {exp ? `Expired ${Math.abs(o.sia.expiresInDays)}d` : `${o.sia.expiresInDays}d left`}
                </MSPill>
              </div>
            );
          })}
        </div>
      )}
    </MSCard>
  );
};

const RunHistoryCard = ({ accent }) => (
  <MSCard padding={20}>
    <MSSectionHeader title="Previous runs" right={<MSButton variant="ghost" size="sm">All</MSButton>} />
    <div style={{ display: "flex", flexDirection: "column" }}>
      {RUN_HISTORY.map((r, i) => (
        <div key={r.id} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 0", borderBottom: i === RUN_HISTORY.length - 1 ? "none" : "1px solid #f3f2f1"
        }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#201f1e" }}>{r.label}</div>
            <div style={{ fontSize: 11, color: "#a19f9d", fontFamily: "SF Mono, monospace", marginTop: 2 }}>{r.id} · {r.exported}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 14, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>{fmtGBPshort(r.gross)}</div>
            <MSPill tone="positive" dot>Paid</MSPill>
          </div>
        </div>
      ))}
    </div>
  </MSCard>
);

Object.assign(window, { OfficersTable, CompositionCard, SiaHoldsCard, RunHistoryCard });
