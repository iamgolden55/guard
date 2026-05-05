// Directory table — renders rows for whichever tab is active. Active tab
// shows StaffUser rows; Pending tab shows PendingStaffProfile rows. Both
// shapes are normalized into a small `StaffRow` view-model so the table
// component stays simple.
import type { CSSProperties } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { SIALicenseRecord } from "../hooks/useStaffData";

export interface StaffRow {
  id: number; // user id (active) or staff_profile id (pending)
  staffProfileId?: number; // populated for active rows when known; for pending = id
  fullName: string;
  email: string;
  employmentType: string | null;
  payFrequency: "weekly" | "monthly";
  joined: string | null;
  isPending: boolean;
}

export interface StaffTableProps {
  rows: StaffRow[];
  licensesByStaffProfile?: Map<number, SIALicenseRecord[]>;
  onRowClick: (row: StaffRow) => void;
  onApprove?: (row: StaffRow) => void;
  approvingId?: number | null;
  isLoading?: boolean;
}

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

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function siaPillFor(licenses: SIALicenseRecord[] | undefined): {
  tone: PillTone;
  label: string;
} {
  if (!licenses || licenses.length === 0) return { tone: "neutral", label: "None" };
  const now = new Date();
  const ninety = new Date();
  ninety.setDate(now.getDate() + 90);
  let hasExpired = false;
  let hasExpiringSoon = false;
  for (const lic of licenses) {
    const exp = new Date(lic.expiry_date);
    if (Number.isNaN(exp.getTime())) continue;
    if (exp < now) hasExpired = true;
    else if (exp < ninety) hasExpiringSoon = true;
  }
  if (hasExpired) return { tone: "danger", label: "Expired" };
  if (hasExpiringSoon) return { tone: "warning", label: "Expiring" };
  return { tone: "positive", label: "Valid" };
}

export function StaffTable({
  rows,
  licensesByStaffProfile,
  onRowClick,
  onApprove,
  approvingId,
  isLoading,
}: StaffTableProps) {
  if (isLoading) {
    return (
      <div
        style={{
          padding: "60px 20px",
          textAlign: "center",
          background: "white",
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.lg,
          color: tokens.color.ink500,
          fontFamily: tokens.font.body,
          fontSize: 13,
        }}
      >
        Loading staff…
      </div>
    );
  }

  if (rows.length === 0) {
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
          <Icon name="users" size={20} />
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
          No staff to show
        </div>
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          Adjust your filters or invite a new staff member.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
        overflow: "hidden",
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={HEADER_STYLE}>Officer</th>
              <th style={HEADER_STYLE}>Employment</th>
              <th style={HEADER_STYLE}>SIA</th>
              <th style={HEADER_STYLE}>Status</th>
              <th style={HEADER_STYLE}>Joined</th>
              <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sia = siaPillFor(
                row.staffProfileId != null
                  ? licensesByStaffProfile?.get(row.staffProfileId)
                  : undefined,
              );
              const isApproving = approvingId === row.id;
              return (
                <tr
                  key={`${row.isPending ? "p" : "a"}-${row.id}`}
                  onClick={() => onRowClick(row)}
                  style={{ cursor: "pointer", transition: `background ${tokens.motion.fast}` }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tokens.color.ink50;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td style={CELL_STYLE}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={row.fullName} size={32} />
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
                          {row.fullName}
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
                          {row.email || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={CELL_STYLE}>
                    {row.employmentType ? (
                      <Pill tone="neutral">{row.employmentType}</Pill>
                    ) : (
                      <span style={{ color: tokens.color.ink500 }}>—</span>
                    )}
                  </td>
                  <td style={CELL_STYLE}>
                    {row.isPending ? (
                      <span style={{ color: tokens.color.ink500 }}>—</span>
                    ) : (
                      <Pill tone={sia.tone} dot>
                        {sia.label}
                      </Pill>
                    )}
                  </td>
                  <td style={CELL_STYLE}>
                    {row.isPending ? (
                      <Pill tone="warning" dot>
                        Pending
                      </Pill>
                    ) : (
                      <Pill tone="positive" dot>
                        Active
                      </Pill>
                    )}
                  </td>
                  <td style={{ ...CELL_STYLE, color: tokens.color.ink600 }}>
                    {formatDate(row.joined)}
                  </td>
                  <td
                    style={{ ...CELL_STYLE, textAlign: "right" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      style={{
                        display: "inline-flex",
                        gap: 6,
                        justifyContent: "flex-end",
                      }}
                    >
                      {row.isPending && onApprove && (
                        <button
                          type="button"
                          onClick={() => onApprove(row)}
                          disabled={isApproving}
                          style={{
                            background: tokens.color.success,
                            color: "white",
                            border: "none",
                            borderRadius: tokens.radius.md,
                            padding: "6px 12px",
                            fontFamily: tokens.font.display,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: isApproving ? "wait" : "pointer",
                            opacity: isApproving ? 0.7 : 1,
                          }}
                        >
                          {isApproving ? "Approving…" : "Approve"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
