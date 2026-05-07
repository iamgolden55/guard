// ApplicationsView — single component, status filter passed in. Renders a
// table of recruitment applications with empty/loading/populated states.
import { format, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { RecruitmentApplication } from "../../../services/recruitmentService";

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

const STATUS_TONE: Record<RecruitmentApplication["status"], PillTone> = {
  pending: "warning",
  approved: "positive",
  rejected: "danger",
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export interface ApplicationsViewProps {
  applications: RecruitmentApplication[];
  isLoading: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onSelect: (application: RecruitmentApplication) => void;
}

export function ApplicationsView({
  applications,
  isLoading,
  emptyTitle,
  emptyHint,
  onSelect,
}: ApplicationsViewProps) {
  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty title="Loading applications…" />
      </ScrollWrap>
    );
  }

  if (applications.length === 0) {
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
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}
          >
            <thead>
              <tr>
                <th style={HEADER_STYLE}>Applicant</th>
                <th style={HEADER_STYLE}>Employment type</th>
                <th style={HEADER_STYLE}>SIA</th>
                <th style={HEADER_STYLE}>Status</th>
                <th style={HEADER_STYLE}>Applied</th>
                <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <ApplicationRow
                  key={app.id}
                  app={app}
                  onSelect={onSelect}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ScrollWrap>
  );
}

interface ApplicationRowProps {
  app: RecruitmentApplication;
  onSelect: (app: RecruitmentApplication) => void;
}

function ApplicationRow({ app, onSelect }: ApplicationRowProps) {
  const employmentLabel =
    app.employment_type_details?.name ?? "—";
  const siaLabel = app.has_sia_licence
    ? app.licence_suspended_revoked
      ? "Suspended"
      : "Holds licence"
    : "No licence";
  const siaTone: PillTone = app.has_sia_licence
    ? app.licence_suspended_revoked
      ? "danger"
      : "positive"
    : "neutral";

  return (
    <tr
      onClick={() => onSelect(app)}
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
          <Avatar name={app.full_name} size={32} />
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
              {app.full_name}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: tokens.color.ink500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {app.email}
            </div>
          </div>
        </div>
      </td>
      <td style={CELL_STYLE}>
        {employmentLabel === "—" ? (
          <span style={{ color: tokens.color.ink500 }}>—</span>
        ) : (
          <Pill tone="neutral">{employmentLabel}</Pill>
        )}
      </td>
      <td style={CELL_STYLE}>
        <Pill tone={siaTone} dot>
          {siaLabel}
        </Pill>
      </td>
      <td style={CELL_STYLE}>
        <Pill tone={STATUS_TONE[app.status]} dot>
          {app.status}
        </Pill>
      </td>
      <td style={{ ...CELL_STYLE, color: tokens.color.ink600 }}>
        {fmtDate(app.application_date ?? app.created_at)}
      </td>
      <td
        style={{ ...CELL_STYLE, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(app)}
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
        <Icon name="user-plus" size={20} />
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
