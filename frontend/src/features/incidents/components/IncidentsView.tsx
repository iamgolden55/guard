// IncidentsView — single-component table reused for All / Open / Resolved.
// Filtering happens in IncidentsPage; this just renders rows.
import { format, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type {
  IncidentReport,
  IncidentSeverity,
} from "../../../services/incidentService";

const HEADER_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontWeight: 700,
  fontSize: 10.5,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: tokens.color.ink500,
  textAlign: "left",
  padding: "10px 14px",
  background: tokens.color.ink50,
  borderBottom: `1px solid ${tokens.color.ink200}`,
  whiteSpace: "nowrap",
};

const CELL_STYLE: CSSProperties = {
  fontFamily: tokens.font.body,
  fontSize: 13,
  color: tokens.color.ink800,
  padding: "12px 14px",
  borderBottom: `1px solid ${tokens.color.ink100}`,
  verticalAlign: "middle",
};

const SEVERITY_TONE: Record<IncidentSeverity, PillTone> = {
  low: "info",
  medium: "warning",
  high: "warning",
  critical: "danger",
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM, HH:mm");
  } catch {
    return iso;
  }
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export interface IncidentsViewProps {
  incidents: IncidentReport[];
  isLoading: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onSelect: (incident: IncidentReport) => void;
}

export function IncidentsView({
  incidents,
  isLoading,
  emptyTitle,
  emptyHint,
  onSelect,
}: IncidentsViewProps) {
  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty title="Loading incidents…" />
      </ScrollWrap>
    );
  }

  if (incidents.length === 0) {
    return (
      <ScrollWrap>
        <Empty title={emptyTitle} hint={emptyHint} />
      </ScrollWrap>
    );
  }

  return (
    <ScrollWrap>
      <div
        style={{
          background: "white",
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.lg,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}
          >
            <thead>
              <tr>
                <th style={HEADER_STYLE}>When</th>
                <th style={HEADER_STYLE}>Venue</th>
                <th style={HEADER_STYLE}>Reporter</th>
                <th style={HEADER_STYLE}>Severity</th>
                <th style={HEADER_STYLE}>Description</th>
                <th style={HEADER_STYLE}>Status</th>
                <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((row) => (
                <IncidentRow key={row.id} row={row} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ScrollWrap>
  );
}

function IncidentRow({
  row,
  onSelect,
}: {
  row: IncidentReport;
  onSelect: (i: IncidentReport) => void;
}) {
  return (
    <tr
      onClick={() => onSelect(row)}
      style={{
        cursor: "pointer",
        transition: `background ${tokens.motion.fast}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.color.ink50;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td style={{ ...CELL_STYLE, color: tokens.color.ink700, whiteSpace: "nowrap" }}>
        {fmtDateTime(row.incident_time)}
      </td>
      <td style={CELL_STYLE}>
        {row.venue_name ? (
          <span style={{ fontWeight: 600, color: tokens.color.ink900 }}>
            {row.venue_name}
          </span>
        ) : (
          <span style={{ color: tokens.color.ink500 }}>—</span>
        )}
      </td>
      <td style={CELL_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={row.reported_by_name || "?"} size={28} />
          <span style={{ color: tokens.color.ink900 }}>
            {row.reported_by_name || "—"}
          </span>
        </div>
      </td>
      <td style={CELL_STYLE}>
        <Pill tone={SEVERITY_TONE[row.severity]} dot>
          {row.severity}
        </Pill>
      </td>
      <td style={{ ...CELL_STYLE, maxWidth: 320 }}>
        <span style={{ color: tokens.color.ink700 }}>
          {truncate(row.description || "—", 80)}
        </span>
      </td>
      <td style={CELL_STYLE}>
        {row.resolved ? (
          <Pill tone="positive" dot>
            Resolved
          </Pill>
        ) : (
          <Pill tone="warning" dot>
            Open
          </Pill>
        )}
      </td>
      <td
        style={{ ...CELL_STYLE, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(row)}
          style={{
            background: "white",
            color: tokens.color.ink700,
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            padding: "6px 12px",
            fontFamily: tokens.font.display,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          View
        </button>
      </td>
    </tr>
  );
}

function ScrollWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 24,
        background: tokens.color.ink50,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "60px 20px",
        textAlign: "center",
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          margin: "0 auto 12px",
          borderRadius: 22,
          background: tokens.color.ink100,
          display: "grid",
          placeItems: "center",
          color: tokens.color.ink500,
        }}
      >
        <Icon name="alert" size={20} />
      </div>
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 14,
          color: tokens.color.ink800,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
