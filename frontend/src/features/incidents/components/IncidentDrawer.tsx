// IncidentDrawer — right-slide overlay with stacked sections (NOT sub-tabs).
// Matches ApplicationDrawer pattern. Includes a "Mobile-only fields not yet
// exposed" notice — staff create incidents from mobile with photos/GPS/etc.
// stored in the model, but `IncidentReportSerializer` doesn't expose them
// yet. This makes the gap visible to admins until Phase 8F extends the API.
import { format, parseISO } from "date-fns";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type {
  IncidentReport,
  IncidentSeverity,
} from "../../../services/incidentService";

const SEVERITY_TONE: Record<IncidentSeverity, PillTone> = {
  low: "info",
  medium: "warning",
  high: "warning",
  critical: "danger",
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

export interface IncidentDrawerProps {
  open: boolean;
  incident: IncidentReport | null;
  onClose: () => void;
  onResolveClick: (incident: IncidentReport) => void;
  isMutating: boolean;
}

export function IncidentDrawer({
  open,
  incident,
  onClose,
  onResolveClick,
  isMutating,
}: IncidentDrawerProps) {
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
        {!incident ? (
          <div />
        ) : (
          <>
            <Header incident={incident} onClose={onClose} />
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
              <ReporterSection incident={incident} />
              <VenueSection incident={incident} />
              <DescriptionSection incident={incident} />
              <ActionsTakenSection incident={incident} />
              <FollowUpSection incident={incident} />
              <ResolutionSection incident={incident} />
              <MobileGapNotice />
            </div>
            <FooterActions
              incident={incident}
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
  incident,
  onClose,
}: {
  incident: IncidentReport;
  onClose: () => void;
}) {
  const subtitle = incident.venue_name
    ? `${incident.venue_name} · ${fmtDateTime(incident.incident_time)}`
    : fmtDateTime(incident.incident_time);

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
            incident.severity === "critical"
              ? tokens.color.dangerSoft
              : incident.severity === "high" || incident.severity === "medium"
                ? tokens.color.warnSoft
                : tokens.color.infoSoft,
          color:
            incident.severity === "critical"
              ? tokens.color.dangerInk
              : incident.severity === "high" || incident.severity === "medium"
                ? tokens.color.warnInk
                : tokens.color.infoInk,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="alert" size={24} />
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
          Incident #{incident.id}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtitle}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <Pill tone={SEVERITY_TONE[incident.severity]} dot>
            {incident.severity}
          </Pill>
          {incident.resolved ? (
            <Pill tone="positive" dot>
              Resolved
            </Pill>
          ) : (
            <Pill tone="warning" dot>
              Open
            </Pill>
          )}
          {incident.requires_followup && (
            <Pill tone="info">Follow-up required</Pill>
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

function ReporterSection({ incident }: { incident: IncidentReport }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="user" label="Reporter" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <Avatar name={incident.reported_by_name || "?"} size={40} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 14,
              color: tokens.color.ink900,
            }}
          >
            {incident.reported_by_name || "Unknown"}
          </div>
          <div style={{ fontSize: 12, color: tokens.color.ink500 }}>
            User #{incident.reported_by}
          </div>
        </div>
      </div>
      <GridTwo>
        <KV label="Reported" value={fmtDateTime(incident.created_at)} />
        <KV label="Incident time" value={fmtDateTime(incident.incident_time)} />
      </GridTwo>
    </div>
  );
}

function VenueSection({ incident }: { incident: IncidentReport }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="building" label="Venue & shift" />
      <GridTwo>
        <KV label="Venue" value={incident.venue_name} />
        <KV
          label="Shift"
          value={incident.shift ? `Shift #${incident.shift}` : ""}
        />
      </GridTwo>
    </div>
  );
}

function DescriptionSection({ incident }: { incident: IncidentReport }) {
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
          background: tokens.color.ink50,
          border: `1px solid ${tokens.color.ink100}`,
          borderRadius: tokens.radius.md,
          padding: 14,
          minHeight: 60,
        }}
      >
        {incident.description || (
          <span style={{ color: tokens.color.ink500 }}>No description provided.</span>
        )}
      </div>
    </div>
  );
}

function ActionsTakenSection({ incident }: { incident: IncidentReport }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="check" label="Actions taken" />
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          lineHeight: 1.55,
          color: tokens.color.ink800,
          whiteSpace: "pre-wrap",
        }}
      >
        {incident.actions_taken || (
          <span style={{ color: tokens.color.ink500 }}>Not recorded.</span>
        )}
      </div>
    </div>
  );
}

function FollowUpSection({ incident }: { incident: IncidentReport }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="flag" label="Follow-up" />
      <GridTwo>
        <KV
          label="Required"
          value={
            incident.requires_followup ? (
              <Pill tone="warning" dot>
                Yes
              </Pill>
            ) : (
              "No"
            )
          }
        />
        <KV label="Status" value={incident.resolved ? "Closed" : "Pending"} />
      </GridTwo>
      {incident.followup_notes && (
        <div style={{ marginTop: 12 }}>
          <KV label="Notes" value={incident.followup_notes} />
        </div>
      )}
    </div>
  );
}

function ResolutionSection({ incident }: { incident: IncidentReport }) {
  if (!incident.resolved) {
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
          Open — awaiting manager review.
        </div>
      </div>
    );
  }
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="history" label="Resolution" />
      <GridTwo>
        <KV label="Resolved by" value={incident.resolved_by_name} />
        <KV label="Resolved at" value={fmtDateTime(incident.resolved_at)} />
      </GridTwo>
    </div>
  );
}

function MobileGapNotice() {
  return (
    <div
      style={{
        background: tokens.color.ink100,
        border: `1px dashed ${tokens.color.ink300}`,
        borderRadius: tokens.radius.lg,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Icon name="info" size={14} />
        <span
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 12,
            color: tokens.color.ink800,
            letterSpacing: "-0.005em",
          }}
        >
          Mobile-only fields not yet exposed
        </span>
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 11.5,
          color: tokens.color.ink600,
          lineHeight: 1.55,
        }}
      >
        Photos, GPS coordinates, voice notes, witness statements, and
        police/ambulance fields are captured by the mobile app but not yet in
        the admin API response. Backend follow-up: extend{" "}
        <code
          style={{
            fontFamily: tokens.font.mono,
            fontSize: 11,
            color: tokens.color.ink800,
          }}
        >
          IncidentReportSerializer
        </code>
        .
      </div>
    </div>
  );
}

interface FooterActionsProps {
  incident: IncidentReport;
  onResolveClick: (incident: IncidentReport) => void;
  isMutating: boolean;
}

function FooterActions({
  incident,
  onResolveClick,
  isMutating,
}: FooterActionsProps) {
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
      {incident.resolved ? (
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          Resolved {fmtDate(incident.resolved_at)} by{" "}
          {incident.resolved_by_name || "—"}.
        </span>
      ) : (
        <Button
          variant="primary"
          onClick={() => onResolveClick(incident)}
          disabled={isMutating}
        >
          {isMutating ? "Working…" : "Mark resolved"}
        </Button>
      )}
    </div>
  );
}
