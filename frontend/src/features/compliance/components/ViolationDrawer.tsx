// ViolationDrawer — right-slide overlay matching ApplicationDrawer.
// Stacked sections (NOT sub-tabs): Staff, Detected, Threshold breach,
// Description, Resolution history.
import { format, parseISO } from "date-fns";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { ComplianceViolation } from "../../../types/compliance";

const SEVERITY_TONE: Record<string, PillTone> = {
  info: "info",
  warning: "warning",
  minor: "info",
  major: "warning",
  critical: "danger",
};

const STATUS_TONE: Record<string, PillTone> = {
  open: "warning",
  investigating: "info",
  resolved: "positive",
  dismissed: "neutral",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy 'at' HH:mm");
  } catch {
    return iso;
  }
}

export interface ViolationDrawerProps {
  open: boolean;
  violation: ComplianceViolation | null;
  onClose: () => void;
  onResolveClick: (violation: ComplianceViolation) => void;
  isMutating: boolean;
}

export function ViolationDrawer({
  open,
  violation,
  onClose,
  onResolveClick,
  isMutating,
}: ViolationDrawerProps) {
  const [mount, setMount] = useState(open);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    if (open) {
      setMount(true);
      requestAnimationFrame(() => setVis(true));
    } else {
      setVis(false);
      const t = setTimeout(() => setMount(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!mount) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: tokens.z.modal,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: vis ? "rgba(32,31,30,0.40)" : "rgba(32,31,30,0)",
          backdropFilter: vis ? "blur(2px)" : "none",
          transition: "background .2s",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 560,
          maxWidth: "100vw",
          height: "100%",
          background: "white",
          boxShadow: "-24px 0 48px -16px rgba(32,31,30,0.22)",
          transform: vis ? "translateX(0)" : "translateX(40px)",
          opacity: vis ? 1 : 0,
          transition: "transform .25s ease, opacity .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!violation ? (
          <div />
        ) : (
          <>
            <Header v={violation} onClose={onClose} />
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                background: tokens.color.ink50,
              }}
            >
              <StaffSection v={violation} />
              <DetectedSection v={violation} />
              <ThresholdSection v={violation} />
              <DescriptionSection v={violation} />
              <ResolutionSection v={violation} />
            </div>
            <FooterActions
              v={violation}
              onResolveClick={onResolveClick}
              isMutating={isMutating}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Header({
  v,
  onClose,
}: {
  v: ComplianceViolation;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        padding: "20px 24px 16px",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background:
            v.severity === "critical"
              ? tokens.color.dangerSoft
              : tokens.color.warnSoft,
          color:
            v.severity === "critical"
              ? tokens.color.dangerInk
              : tokens.color.warnInk,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="warning" size={24} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 18,
            color: tokens.color.ink900,
            letterSpacing: "-0.015em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {v.violation_type_display ?? v.violation_type}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 2,
          }}
        >
          Violation #{v.id} · detected {fmtDate(v.created_at)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Pill tone={SEVERITY_TONE[v.severity] ?? "info"} dot>
            {v.severity_display ?? v.severity}
          </Pill>
          <Pill tone={STATUS_TONE[v.resolution_status] ?? "neutral"} dot>
            {v.resolution_status_display ?? v.resolution_status}
          </Pill>
          {v.exception_granted && <Pill tone="info">Exception granted</Pill>}
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
          color: tokens.color.ink600,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

const SECTION_STYLE: CSSProperties = {
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.lg,
  padding: 18,
};

function SectionTitle({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: tokens.color.ink100,
          color: tokens.color.ink700,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={13} />
      </span>
      <span
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 13,
          color: tokens.color.ink900,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.ink900,
          wordBreak: "break-word",
        }}
      >
        {value || <span style={{ color: tokens.color.ink500 }}>—</span>}
      </div>
    </div>
  );
}

function GridTwo({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px 20px",
      }}
    >
      {children}
    </div>
  );
}

function StaffSection({ v }: { v: ComplianceViolation }) {
  const name = v.user_data?.full_name || `User #${v.user}`;
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="user" label="Staff" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Avatar name={name} size={40} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 14,
              color: tokens.color.ink900,
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 12, color: tokens.color.ink500 }}>
            {v.user_data?.email || `User #${v.user}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetectedSection({ v }: { v: ComplianceViolation }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="clock" label="Detected" />
      <GridTwo>
        <KV label="Period start" value={fmtDateTime(v.period_start)} />
        <KV label="Period end" value={fmtDateTime(v.period_end)} />
        <KV label="Detected at" value={fmtDateTime(v.created_at)} />
        <KV label="Duration" value={`${v.duration_hours ?? "—"}h`} />
        {v.shift_data && (
          <>
            <KV label="Shift" value={`#${v.shift_data.id} · ${v.shift_data.venue_name}`} />
            <KV
              label="Shift time"
              value={`${fmtDateTime(v.shift_data.start_time)} → ${fmtDateTime(v.shift_data.end_time)}`}
            />
          </>
        )}
      </GridTwo>
    </div>
  );
}

function ThresholdSection({ v }: { v: ComplianceViolation }) {
  const calc = v.calculated_values ?? {};
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="warning" label="Threshold breach" />
      <GridTwo>
        <KV
          label="Total"
          value={
            calc.total_hours != null ? `${calc.total_hours}h` : v.threshold_exceeded
          }
        />
        <KV label="Limit" value={calc.limit != null ? `${calc.limit}h` : "—"} />
        <KV
          label="Exceeded by"
          value={calc.exceeded_by != null ? `${calc.exceeded_by}h` : "—"}
        />
        <KV label="Score impact" value={`${v.compliance_score_impact ?? 0}`} />
      </GridTwo>
    </div>
  );
}

function DescriptionSection({ v }: { v: ComplianceViolation }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="file" label="Description" />
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          lineHeight: 1.55,
          color: tokens.color.ink800,
          whiteSpace: "pre-wrap",
        }}
      >
        {v.description || (
          <span style={{ color: tokens.color.ink500 }}>
            No description provided.
          </span>
        )}
      </div>
    </div>
  );
}

function ResolutionSection({ v }: { v: ComplianceViolation }) {
  if (!v.is_resolved) {
    return (
      <div style={SECTION_STYLE}>
        <SectionTitle icon="history" label="Resolution" />
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          Open — resolve via the action below.
        </div>
      </div>
    );
  }
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="history" label="Resolution" />
      <GridTwo>
        <KV label="Resolved by" value={v.resolved_by_name} />
        <KV label="Resolved at" value={fmtDateTime(v.resolved_at)} />
      </GridTwo>
      {v.resolution_notes && (
        <div style={{ marginTop: 12 }}>
          <KV label="Notes" value={v.resolution_notes} />
        </div>
      )}
      {v.exception_granted && v.exception_reason && (
        <div style={{ marginTop: 12 }}>
          <KV label="Exception reason" value={v.exception_reason} />
        </div>
      )}
    </div>
  );
}

function FooterActions({
  v,
  onResolveClick,
  isMutating,
}: {
  v: ComplianceViolation;
  onResolveClick: (v: ComplianceViolation) => void;
  isMutating: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 24px",
        background: "white",
        borderTop: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
      }}
    >
      {v.is_resolved ? (
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          Resolved {fmtDate(v.resolved_at)} by {v.resolved_by_name || "—"}.
        </span>
      ) : (
        <Button
          variant="primary"
          onClick={() => onResolveClick(v)}
          disabled={isMutating}
        >
          {isMutating ? "Working…" : "Resolve violation"}
        </Button>
      )}
    </div>
  );
}
