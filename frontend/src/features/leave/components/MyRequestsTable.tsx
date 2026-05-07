import { format, parseISO } from "date-fns";
import type { CSSProperties } from "react";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import {
  type LeaveRequest,
  LeaveRequestStatus,
} from "../../../types/leave";

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

const STATUS_TONE: Record<LeaveRequestStatus, PillTone> = {
  [LeaveRequestStatus.PENDING]: "warning",
  [LeaveRequestStatus.APPROVED]: "positive",
  [LeaveRequestStatus.REJECTED]: "danger",
  [LeaveRequestStatus.CANCELLED]: "neutral",
  [LeaveRequestStatus.WITHDRAWN]: "neutral",
};

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

export interface MyRequestsTableProps {
  requests: LeaveRequest[];
  onCancel: (request: LeaveRequest) => void;
  cancellingId: number | null;
  isLoading: boolean;
}

export function MyRequestsTable({
  requests,
  onCancel,
  cancellingId,
  isLoading,
}: MyRequestsTableProps) {
  if (isLoading) {
    return <Empty message="Loading your leave requests…" />;
  }
  if (requests.length === 0) {
    return (
      <Empty
        message="You haven't requested any leave yet."
        hint="Use Request leave to submit your first request."
      />
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
              <th style={HEADER_STYLE}>Type</th>
              <th style={HEADER_STYLE}>Dates</th>
              <th style={HEADER_STYLE}>Days</th>
              <th style={HEADER_STYLE}>Status</th>
              <th style={HEADER_STYLE}>Submitted</th>
              <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const status = req.status;
              const tone = STATUS_TONE[status] ?? "neutral";
              const canCancel =
                status === LeaveRequestStatus.PENDING ||
                status === LeaveRequestStatus.APPROVED;
              const isCancelling = cancellingId === req.id;
              return (
                <tr key={req.id}>
                  <td style={CELL_STYLE}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 600,
                        color: tokens.color.ink900,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: req.leave_type.color_code || tokens.color.ink400,
                        }}
                      />
                      {req.leave_type.name}
                    </span>
                  </td>
                  <td style={CELL_STYLE}>
                    {fmtDate(req.start_date)} – {fmtDate(req.end_date)}
                  </td>
                  <td style={{ ...CELL_STYLE, fontVariantNumeric: "tabular-nums" }}>
                    {req.days_requested}
                  </td>
                  <td style={CELL_STYLE}>
                    <Pill tone={tone} dot>
                      {status}
                    </Pill>
                  </td>
                  <td style={{ ...CELL_STYLE, color: tokens.color.ink600 }}>
                    {fmtDate(req.created_at)}
                  </td>
                  <td style={{ ...CELL_STYLE, textAlign: "right" }}>
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={() => onCancel(req)}
                        disabled={isCancelling}
                        style={{
                          background: "white",
                          color: tokens.color.dangerInk,
                          border: `1px solid ${tokens.color.danger}33`,
                          borderRadius: tokens.radius.md,
                          padding: "6px 12px",
                          fontFamily: tokens.font.display,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: isCancelling ? "wait" : "pointer",
                          opacity: isCancelling ? 0.7 : 1,
                        }}
                      >
                        {isCancelling ? "Cancelling…" : "Cancel"}
                      </button>
                    ) : (
                      <span style={{ color: tokens.color.ink400 }}>—</span>
                    )}
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

function Empty({ message, hint }: { message: string; hint?: string }) {
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
        <Icon name="sun" size={20} />
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
        {message}
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
