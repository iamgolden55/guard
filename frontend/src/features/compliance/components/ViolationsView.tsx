// ViolationsView — table of compliance violations with row-click to drawer.
import { format, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { ComplianceViolation } from "../../../types/compliance";

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

export interface ViolationsViewProps {
  violations: ComplianceViolation[];
  isLoading: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onSelect: (violation: ComplianceViolation) => void;
}

export function ViolationsView({
  violations,
  isLoading,
  emptyTitle,
  emptyHint,
  onSelect,
}: ViolationsViewProps) {
  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty title="Loading violations…" />
      </ScrollWrap>
    );
  }

  if (violations.length === 0) {
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
                <th style={HEADER_STYLE}>Staff</th>
                <th style={HEADER_STYLE}>Type</th>
                <th style={HEADER_STYLE}>Severity</th>
                <th style={HEADER_STYLE}>Period</th>
                <th style={HEADER_STYLE}>Status</th>
                <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <ViolationRow key={v.id} v={v} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ScrollWrap>
  );
}

function ViolationRow({
  v,
  onSelect,
}: {
  v: ComplianceViolation;
  onSelect: (v: ComplianceViolation) => void;
}) {
  const name = v.user_data?.full_name || `User #${v.user}`;
  const email = v.user_data?.email ?? "";

  return (
    <tr
      onClick={() => onSelect(v)}
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
      <td style={CELL_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={name} size={32} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: tokens.color.ink900,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </div>
            {email && (
              <div
                style={{
                  fontSize: 11.5,
                  color: tokens.color.ink500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {email}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={CELL_STYLE}>
        {v.violation_type_display ?? v.violation_type}
      </td>
      <td style={CELL_STYLE}>
        <Pill tone={SEVERITY_TONE[v.severity] ?? "info"} dot>
          {v.severity_display ?? v.severity}
        </Pill>
      </td>
      <td style={{ ...CELL_STYLE, color: tokens.color.ink600, whiteSpace: "nowrap" }}>
        {fmtDate(v.period_start)} – {fmtDate(v.period_end)}
      </td>
      <td style={CELL_STYLE}>
        <Pill tone={STATUS_TONE[v.resolution_status] ?? "neutral"} dot>
          {v.resolution_status_display ?? v.resolution_status}
        </Pill>
      </td>
      <td
        style={{ ...CELL_STYLE, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(v)}
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
          Review
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
        <Icon name="shield" size={20} />
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
