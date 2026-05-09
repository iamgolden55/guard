// CapacityLogbookDrawer — slide-over with the chronological timeline
// (capacity checks + missed slots) for a single shift_group, plus a
// "Download PDF" action that hits the audit-PDF endpoint.

import { useEffect, useState } from "react";
import { Pill } from "../../../design-system/primitives/Pill";
import { Button } from "../../../design-system/primitives/Button";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  capacityLogbookService,
  type CapacityCheck,
  type CapacityCheckSlotMiss,
  type CapacityLogbookSignoff,
  type CapacityLogbookTimeline,
} from "../../../services/capacityLogbookService";

export interface CapacityLogbookDrawerProps {
  log: CapacityLogbookSignoff | null;
  onClose: () => void;
  onToast?: (message: string) => void;
}

type TimelineEntry =
  | { kind: "check"; at: string; data: CapacityCheck }
  | { kind: "miss"; at: string; data: CapacityCheckSlotMiss };

function buildTimeline(t: CapacityLogbookTimeline | null): TimelineEntry[] {
  if (!t) return [];
  const entries: TimelineEntry[] = [
    ...t.checks.map<TimelineEntry>((c) => ({ kind: "check", at: c.timestamp, data: c })),
    ...t.misses.map<TimelineEntry>((m) => ({ kind: "miss", at: m.expected_at, data: m })),
  ];
  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function performerName(check: CapacityCheck): string {
  const p = check.performed_by_details;
  if (!p) return "Staff";
  return `${p.first_name} ${p.last_name}`.trim() || "Staff";
}

export function CapacityLogbookDrawer({ log, onClose, onToast }: CapacityLogbookDrawerProps) {
  const [timeline, setTimeline] = useState<CapacityLogbookTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch the bundled timeline whenever a different log is selected.
  useEffect(() => {
    if (!log) {
      setTimeline(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    capacityLogbookService
      .getTimeline(log.shift_group)
      .then((t) => {
        if (cancelled) return;
        setTimeline(t);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load timeline.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [log?.id, log?.shift_group]);

  // Esc-to-close
  useEffect(() => {
    if (!log) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [log, onClose]);

  if (!log) return null;

  const entries = buildTimeline(timeline);
  const signoffShown = timeline?.signoff ?? log;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const filename = await capacityLogbookService.downloadPdf(log);
      onToast?.(`Downloaded ${filename}`);
    } catch (e: unknown) {
      onToast?.(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(32,31,30,0.44)",
          backdropFilter: "blur(3px)",
          zIndex: tokens.z.modal - 1,
        }}
      />
      {/* Panel */}
      <aside
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(620px, 96vw)",
          background: "white",
          zIndex: tokens.z.modal,
          boxShadow: "-12px 0 48px -16px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          fontFamily: tokens.font.body,
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: "20px 24px 16px",
            borderBottom: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tokens.color.ink500,
                marginBottom: 4,
              }}
            >
              Capacity logbook
            </div>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 20,
                color: tokens.color.ink900,
                letterSpacing: "-0.015em",
              }}
            >
              {log.venue_name}
            </div>
            <div style={{ fontSize: 12.5, color: tokens.color.ink600, marginTop: 4 }}>
              {formatDate(log.signed_at || log.created_at)} · capacity {log.venue_capacity}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {log.is_override ? (
                <Pill tone="warning" dot>
                  Override
                </Pill>
              ) : (
                <Pill tone="positive" dot>
                  Signed
                </Pill>
              )}
              <Pill tone="neutral">
                {log.total_checks} check{log.total_checks === 1 ? "" : "s"}
              </Pill>
              {log.total_missed > 0 && (
                <Pill tone="danger">
                  {log.total_missed} missed
                </Pill>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: tokens.color.ink100,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        {/* Body — scrolls */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Signoff card */}
          <section
            style={{
              padding: "16px 24px",
              borderBottom: `1px solid ${tokens.color.ink100}`,
            }}
          >
            <SectionHeading>Signoff</SectionHeading>
            {signoffShown.is_override ? (
              <div
                style={{
                  background: tokens.color.warnSoft,
                  border: `1px solid ${tokens.color.warn}`,
                  padding: 14,
                  borderRadius: tokens.radius.md,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: tokens.color.warnInk,
                    marginBottom: 6,
                  }}
                >
                  Closed via override
                </div>
                <div style={{ fontSize: 14, color: tokens.color.ink900 }}>
                  {signoffShown.override_reason || "(no reason captured)"}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: signoffShown.signature ? "auto 1fr" : "1fr",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {signoffShown.signature && (
                  <img
                    src={signoffShown.signature}
                    alt={`${signoffShown.closed_by_name} signature`}
                    style={{
                      width: 180,
                      height: 70,
                      objectFit: "contain",
                      background: tokens.color.ink50,
                      border: `1px solid ${tokens.color.ink200}`,
                      borderRadius: tokens.radius.md,
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: tokens.color.ink900 }}>
                    {signoffShown.closed_by_name || "—"}
                  </div>
                  {signoffShown.closed_by_role && (
                    <div style={{ fontSize: 12.5, color: tokens.color.ink600, marginTop: 2 }}>
                      {signoffShown.closed_by_role}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: tokens.color.ink500, marginTop: 8 }}>
                    Signed {formatTime(signoffShown.signed_at || signoffShown.created_at)} on{" "}
                    {formatDate(signoffShown.signed_at || signoffShown.created_at)}
                  </div>
                  {signoffShown.notes && (
                    <div style={{ fontSize: 13, color: tokens.color.ink700, marginTop: 8 }}>
                      {signoffShown.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Timeline */}
          <section style={{ padding: "16px 24px" }}>
            <SectionHeading>Timeline</SectionHeading>
            {isLoading ? (
              <div style={{ color: tokens.color.ink500, fontSize: 13, padding: 8 }}>
                Loading timeline…
              </div>
            ) : error ? (
              <div style={{ color: tokens.color.dangerInk, fontSize: 13, padding: 8 }}>
                {error}
              </div>
            ) : entries.length === 0 ? (
              <div style={{ color: tokens.color.ink500, fontSize: 13, padding: 8 }}>
                No checks were logged for this shift.
              </div>
            ) : (
              <ol
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {entries.map((entry, idx) => (
                  <TimelineRow key={`${entry.kind}-${entry.data.id}-${idx}`} entry={entry} />
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 24px",
            borderTop: `1px solid ${tokens.color.ink200}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            background: tokens.color.ink50,
          }}
        >
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={handleDownload}
            disabled={downloading}
            leading={<Icon name="download" size={16} />}
          >
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </footer>
      </aside>
    </>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: tokens.color.ink500,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "miss") {
    const m = entry.data;
    return (
      <li
        style={{
          display: "flex",
          gap: 12,
          padding: 12,
          background: tokens.color.dangerSoft,
          border: `1px solid ${tokens.color.danger}`,
          borderRadius: tokens.radius.md,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: tokens.color.dangerInk,
          }}
        >
          <Icon name="alert" size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: tokens.color.dangerInk }}>
            Missed slot · {formatTime(m.expected_at)}
          </div>
          {m.acknowledged ? (
            <div style={{ fontSize: 13, color: tokens.color.ink700, marginTop: 4 }}>
              Reason: {m.acknowledgement_reason}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 4 }}>
              Not acknowledged
            </div>
          )}
        </div>
      </li>
    );
  }

  const c = entry.data;
  const atCapacity = c.is_at_capacity;
  return (
    <li
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        background: atCapacity ? tokens.color.warnSoft : "white",
        border: `1px solid ${atCapacity ? tokens.color.warn : tokens.color.ink200}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          background: tokens.color.ink50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 11,
          color: tokens.color.ink700,
        }}
      >
        {formatTime(c.timestamp)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: atCapacity ? tokens.color.warnInk : tokens.color.ink900,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {c.current_count} / {c.venue_capacity}
          </span>
          {atCapacity && <Pill tone="warning">At capacity</Pill>}
          <span style={{ fontSize: 12.5, color: tokens.color.ink600 }}>
            by {performerName(c)}
          </span>
        </div>
        {c.action_taken && (
          <div style={{ fontSize: 13, color: tokens.color.ink700, marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>Action: </span>
            {c.action_taken}
          </div>
        )}
        {c.notes && (
          <div style={{ fontSize: 12.5, color: tokens.color.ink600, marginTop: 4 }}>
            {c.notes}
          </div>
        )}
      </div>
    </li>
  );
}
