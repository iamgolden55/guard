// ============================================================
// Payroll — Right drawer (officer detail) + Export modal
// ============================================================

// ============================================================
// OFFICER DRAWER — slide-over with grounded fields only
// ============================================================
const OfficerDrawer = ({ officer, onClose, accent }) => {
  useEffect(() => {
    if (!officer) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [officer, onClose]);

  if (!officer) return null;
  const o = officer;
  const bundle = ITEMS_BY_OFFICER[o.id] || { items: [], adjustments: [] };
  const meta = STATUS_META[o.status];
  const expMeta = o.exportStatus ? EXPORT_META[o.exportStatus] : null;
  const siaWarn = siaTone(o.sia);

  // Grounded breakdown (only fields from the real model)
  const breakdown = [
    { label: "Base hours",    detail: `${o.baseHrs.toFixed(1)}h @ ${fmtGBP(o.rate)}/h`,           value: o.baseHrs * o.rate },
    o.ot1Hrs > 0 && { label: "Overtime tier 1 (1.5×)", detail: `${o.ot1Hrs.toFixed(1)}h @ ${fmtGBP(o.rate * 1.5)}/h`, value: o.ot1Hrs * o.rate * 1.5, hl: "#d97706" },
    o.ot2Hrs > 0 && { label: "Overtime tier 2 (2×)",   detail: `${o.ot2Hrs.toFixed(1)}h @ ${fmtGBP(o.rate * 2)}/h`,   value: o.ot2Hrs * o.rate * 2,   hl: "#991b25" },
    o.bhDays > 0 && { label: "Bank holiday",  detail: `${o.bhDays}d × ${fmtGBP(o.bhRate)}/day`,     value: o.bhDays * o.bhRate, hl: "#312e81" },
    o.alDays > 0 && { label: "Annual leave",  detail: `${o.alDays}d × ${fmtGBP(o.alRate)}/day`,     value: o.alDays * o.alRate, hl: "#0f5132" },
    o.special > 0 && { label: "Special event uplift", detail: `${o.special}h special-rate top-up`,  value: o.special * 10,      hl: "#78350f" },
  ].filter(Boolean);

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(32,31,30,0.44)",
        backdropFilter: "blur(3px)", zIndex: 90, animation: "msFadeIn .2s ease"
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(560px, 94vw)",
        background: "white", zIndex: 100, boxShadow: "-12px 0 48px -16px rgba(0,0,0,0.2)",
        display: "flex", flexDirection: "column", animation: "msSlideIn .28s cubic-bezier(.4,0,.2,1)"
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #edebe9", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <MSAvatar name={o.name} hue={o.hue} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 700, fontSize: 18, color: "#201f1e", letterSpacing: "-0.015em" }}>
              {o.name}
            </div>
            <div style={{ fontSize: 12.5, color: "#605e5c", marginTop: 2 }}>
              {o.role} · {o.venue}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <MSPill tone={meta.tone} dot>{meta.label}</MSPill>
              {expMeta && <MSPill tone={expMeta.tone} dot>{expMeta.label}</MSPill>}
              {siaWarn && <MSPill tone={siaWarn.tone} dot>{siaWarn.label} · {siaWarn.tip}</MSPill>}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, background: "#f3f2f1",
            border: "none", color: "#605e5c", cursor: "pointer", display: "grid", placeItems: "center"
          }}>
            <PIcon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Gross summary */}
          <div style={{
            padding: "18px 20px", background: accent.soft, border: `1px solid ${accent.primary}22`,
            borderRadius: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "baseline"
          }}>
            <div>
              <div style={{ ...MSText.over, color: accent.primary, marginBottom: 2 }}>Invoice total · Week 17</div>
              <div style={{ fontSize: 11.5, color: "#605e5c" }}>
                INV-{o.id.toString().padStart(4, "0")}-W17 · {o.baseHrs + o.ot1Hrs + o.ot2Hrs}h billable + {o.bhDays + o.alDays}d
              </div>
            </div>
            <div style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 28, color: accent.dark, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {fmtGBP(o.gross)}
            </div>
          </div>

          {/* Earnings breakdown */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 10 }}>Earnings breakdown</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {breakdown.map((r, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  padding: "10px 0", borderBottom: "1px solid #f3f2f1"
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: r.hl || "#201f1e" }}>{r.label}</div>
                    <div style={{ fontSize: 11.5, color: "#605e5c", marginTop: 2 }}>{r.detail}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#201f1e", fontVariantNumeric: "tabular-nums", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
                    {fmtGBP(r.value)}
                  </div>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "12px 0 0", marginTop: 2
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#201f1e" }}>Gross payable</span>
                <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 18, color: "#201f1e", fontVariantNumeric: "tabular-nums" }}>
                  {fmtGBP(o.gross)}
                </span>
              </div>
            </div>
          </div>

          {/* Tax note — grounded disclaimer */}
          <div style={{
            padding: "10px 12px", background: "#fafafa", border: "1px dashed #edebe9",
            borderRadius: 8, marginBottom: 22, display: "flex", gap: 10, alignItems: "flex-start"
          }}>
            <PIcon name="info" size={14} />
            <div style={{ fontSize: 11.5, color: "#605e5c", lineHeight: 1.5 }}>
              Gross figure only. PAYE / NI withholding is handled by the connected accounting provider (Xero, QuickBooks, Sage) after export — not on this platform.
            </div>
          </div>

          {/* SIA licence */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 10 }}>SIA licence</div>
            <div style={{
              padding: "12px 14px", border: `1px solid ${o.sia.expired ? "#fbd0d4" : "#edebe9"}`,
              borderRadius: 10, background: o.sia.expired ? "#fef2f4" : "white"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#605e5c" }}>Licence · {o.sia.level}</div>
                  <div style={{ fontFamily: "SF Mono, monospace", fontSize: 13, fontWeight: 600, color: "#201f1e", marginTop: 2 }}>{o.sia.number}</div>
                </div>
                <MSPill tone={o.sia.expired ? "danger" : o.sia.expiresInDays <= 30 ? "warning" : "positive"} dot>
                  {o.sia.expired ? `Expired ${Math.abs(o.sia.expiresInDays)}d ago` : `${o.sia.expiresInDays}d remaining`}
                </MSPill>
              </div>
              {o.sia.expired && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#991b25" }}>
                  Officer cannot claim new shifts until licence is renewed. Payslip flagged for review.
                </div>
              )}
            </div>
          </div>

          {/* Time adjustments */}
          {bundle.adjustments.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 10 }}>Time adjustments this week</div>
              <div style={{ border: "1px solid #edebe9", borderRadius: 10, overflow: "hidden" }}>
                {bundle.adjustments.map((a, i) => (
                  <div key={i} style={{
                    padding: "12px 14px",
                    borderBottom: i === bundle.adjustments.length - 1 ? "none" : "1px solid #f3f2f1",
                    fontSize: 12
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <strong style={{ fontFamily: "SF Mono, monospace", fontSize: 12 }}>{a.date}</strong>
                      <span style={{ color: "#605e5c" }}>{a.shift}</span>
                      <MSPill tone="warning" dot>{a.delta}</MSPill>
                    </div>
                    <div style={{ fontFamily: "SF Mono, monospace", fontSize: 11.5, color: "#605e5c" }}>
                      {a.before} → <span style={{ color: "#201f1e", fontWeight: 600 }}>{a.after}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#a19f9d", marginTop: 4 }}>
                      by {a.by} · {a.on}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {o.rejectReason && (
            <div style={{
              padding: "12px 14px", border: "1px solid #fbd0d4", background: "#fef2f4",
              borderRadius: 10, marginBottom: 22
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#991b25", marginBottom: 4 }}>
                Rejection reason
              </div>
              <div style={{ fontSize: 12.5, color: "#201f1e", lineHeight: 1.5 }}>{o.rejectReason}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #edebe9", display: "flex", gap: 8, background: "white" }}>
          <MSButton variant="ghost" size="md" leading={<PIcon name="edit" size={14} />}>Adjust hours</MSButton>
          <div style={{ flex: 1 }} />
          <MSButton variant="secondary" size="md" leading={<PIcon name="file" size={14} />}>Payslip PDF</MSButton>
          <MSButton variant="primary" accent={accent} size="md" leading={<PIcon name="external" size={14} />}>Export invoice</MSButton>
        </div>
      </div>
    </>
  );
};

// ============================================================
// EXPORT MODAL — send invoices to connected provider (Xero/QB/Sage/…)
// Replaces the fictional "BACS run" modal
// ============================================================
const ExportRunModal = ({ open, onClose, accent, selectedCount = null }) => {
  const [providerId, setProviderId] = useState("xero");
  const [scope, setScope]   = useState("all_pending"); // all_pending | selected | rejected_excluded
  const [step, setStep]     = useState("config"); // config | processing | complete

  useEffect(() => {
    if (!open) return;
    setStep("config");
  }, [open]);

  useEffect(() => {
    if (step !== "processing") return;
    const t = setTimeout(() => setStep("complete"), 1800);
    return () => clearTimeout(t);
  }, [step]);

  const provider = PROVIDERS.find(p => p.id === providerId);

  const scopedOfficers = useMemo(() => {
    if (scope === "selected" && selectedCount) return OFFICERS.slice(0, selectedCount);
    if (scope === "rejected_excluded") return OFFICERS.filter(o => o.status !== "rejected");
    return OFFICERS.filter(o => o.status === "pending");
  }, [scope, selectedCount]);

  const scopedGross = scopedOfficers.reduce((a, o) => a + o.gross, 0);

  const footer =
    step === "config" ? (
      <>
        <MSButton variant="ghost" onClick={onClose}>Cancel</MSButton>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: "#605e5c", marginRight: 10, alignSelf: "center" }}>
          {scopedOfficers.length} invoices · <strong style={{ color: "#201f1e" }}>{fmtGBP(scopedGross)}</strong>
        </div>
        <MSButton
          variant="primary" accent={accent}
          disabled={!provider.connected}
          leading={<PIcon name="external" size={14} />}
          onClick={() => setStep("processing")}
        >
          Export to {provider.name}
        </MSButton>
      </>
    ) : step === "complete" ? (
      <>
        <MSButton variant="secondary" leading={<PIcon name="external" size={14} />}>Open in {provider.name}</MSButton>
        <div style={{ flex: 1 }} />
        <MSButton variant="primary" accent={accent} onClick={onClose}>Done</MSButton>
      </>
    ) : <div style={{ flex: 1 }} />;

  return (
    <MSModal
      open={open}
      onClose={step === "processing" ? () => {} : onClose}
      title={step === "complete" ? `Exported to ${provider.name}` : "Export payroll run"}
      subtitle={step === "complete" ? `${scopedOfficers.length} invoices queued for ${provider.name}` : "Send this week's invoices to your accounting provider"}
      size="md"
      accent={accent}
      footer={footer}
    >
      {step === "config" && (
        <div>
          {/* Provider picker */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 10 }}>Destination</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PROVIDERS.map(p => {
                const active = providerId === p.id;
                return (
                  <button key={p.id}
                    disabled={!p.connected}
                    onClick={() => setProviderId(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      border: `1.5px solid ${active ? accent.primary : "#edebe9"}`,
                      borderRadius: 10, background: active ? accent.soft : p.connected ? "white" : "#faf9f8",
                      cursor: p.connected ? "pointer" : "not-allowed", opacity: p.connected ? 1 : 0.55,
                      textAlign: "left", fontFamily: "Inter, sans-serif"
                    }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: p.color + "22", color: p.color, display: "grid", placeItems: "center",
                      fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 12
                    }}>{p.name[0]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color: "#a19f9d" }}>
                        {p.connected ? (p.default ? "Default · connected" : "Connected") : "Not connected"}
                      </div>
                    </div>
                    {active && <PIcon name="check" size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ ...MSText.over, color: "#605e5c", marginBottom: 10 }}>What to export</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { id: "all_pending",        label: "All pending invoices",       sub: "Default · everything not yet exported" },
                selectedCount && { id: "selected", label: `Selected only (${selectedCount})`, sub: "Use current table selection" },
                { id: "rejected_excluded",  label: "All except rejected",        sub: "Include paid + pending, skip rejected lines" },
              ].filter(Boolean).map(o => {
                const active = scope === o.id;
                return (
                  <button key={o.id} onClick={() => setScope(o.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    border: `1.5px solid ${active ? accent.primary : "#edebe9"}`, borderRadius: 10,
                    background: active ? accent.soft : "white",
                    cursor: "pointer", textAlign: "left", fontFamily: "Inter, sans-serif"
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: `1.5px solid ${active ? accent.primary : "#c8c6c4"}`,
                      background: active ? accent.primary : "white",
                      display: "grid", placeItems: "center", flexShrink: 0
                    }}>
                      {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#201f1e" }}>{o.label}</div>
                      <div style={{ fontSize: 11.5, color: "#605e5c", marginTop: 1 }}>{o.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div style={{
            padding: "12px 14px", background: "#faf9f8",
            borderRadius: 10, border: "1px solid #edebe9"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: "#605e5c" }}>Invoices</span>
              <span style={{ fontWeight: 600, color: "#201f1e" }}>{scopedOfficers.length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
              <span style={{ color: "#605e5c" }}>Period</span>
              <span style={{ fontWeight: 600, color: "#201f1e" }}>Mon 20 Apr – Sun 26 Apr 2026</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: "#605e5c" }}>Gross total</span>
              <span style={{ fontWeight: 700, color: accent.dark, fontFamily: "Plus Jakarta Sans, sans-serif", fontVariantNumeric: "tabular-nums" }}>{fmtGBP(scopedGross)}</span>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 11.5, color: "#605e5c", lineHeight: 1.55, display: "flex", gap: 8 }}>
            <PIcon name="info" size={14} />
            <span>
              Mead Security does not run payments directly. Tax, NI and the actual bank transfer are handled inside {provider.name} after export. Export status updates independently of invoice status.
            </span>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", margin: "0 auto 20px",
            background: provider.color + "22", color: provider.color,
            display: "grid", placeItems: "center", position: "relative"
          }}>
            <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", inset: 0, animation: "msSpin 1.2s linear infinite" }}>
              <circle cx="28" cy="28" r="25" fill="none" stroke={provider.color} strokeWidth="2.5" strokeDasharray="30 120" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 800, fontSize: 18 }}>{provider.name[0]}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#201f1e" }}>Exporting to {provider.name}…</div>
          <div style={{ fontSize: 12.5, color: "#605e5c", marginTop: 6 }}>{scopedOfficers.length} invoices · {fmtGBP(scopedGross)}</div>
        </div>
      )}

      {step === "complete" && (
        <div style={{ padding: "20px 0" }}>
          <div style={{
            padding: "14px 16px", background: "#e6f4ea", border: "1px solid #c0d9c4",
            borderRadius: 10, display: "flex", alignItems: "center", gap: 12, marginBottom: 16
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0f9d58", color: "white", display: "grid", placeItems: "center" }}>
              <PIcon name="check" size={18} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0f5132" }}>Queued in {provider.name}</div>
              <div style={{ fontSize: 11.5, color: "#0f5132", opacity: 0.85, marginTop: 2 }}>
                {scopedOfficers.length} invoices · {fmtGBP(scopedGross)} · export job #EXP-2026-0417
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "#605e5c", lineHeight: 1.55 }}>
            Invoices are now visible in {provider.name} as draft bills. Payment status on this page will update to <strong style={{ color: "#0f5132" }}>Paid</strong> once each bill is marked paid in {provider.name} and the webhook syncs back.
          </div>
        </div>
      )}
    </MSModal>
  );
};

Object.assign(window, { OfficerDrawer, ExportRunModal });
