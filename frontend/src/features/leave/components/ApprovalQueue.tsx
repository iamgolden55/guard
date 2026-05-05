import { format, parseISO } from "date-fns";
import { useState } from "react";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { PendingLeaveRequest } from "../../../types/leave";

const URGENCY_TONE: Record<"low" | "medium" | "high", PillTone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

const URGENCY_LABEL: Record<"low" | "medium" | "high", string> = {
  low: "Plenty of time",
  medium: "Within a week",
  high: "Starts soon",
};

function fmtDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM");
  } catch {
    return iso;
  }
}

function fullName(user: { first_name: string; last_name: string; username: string }) {
  return `${user.first_name} ${user.last_name}`.trim() || user.username;
}

export interface ApprovalQueueProps {
  requests: PendingLeaveRequest[];
  onApprove: (request: PendingLeaveRequest) => Promise<void>;
  onReject: (request: PendingLeaveRequest, reason: string) => Promise<void>;
  processingId: number | null;
  isLoading: boolean;
}

export function ApprovalQueue({
  requests,
  onApprove,
  onReject,
  processingId,
  isLoading,
}: ApprovalQueueProps) {
  if (isLoading) {
    return <Empty message="Loading approval queue…" />;
  }
  if (requests.length === 0) {
    return (
      <Empty
        message="You're all caught up"
        hint="No leave requests are waiting for your review."
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {requests.map((req) => (
        <ApprovalCard
          key={req.id}
          request={req}
          onApprove={onApprove}
          onReject={onReject}
          isProcessing={processingId === req.id}
        />
      ))}
    </div>
  );
}

interface ApprovalCardProps {
  request: PendingLeaveRequest;
  onApprove: (request: PendingLeaveRequest) => Promise<void>;
  onReject: (request: PendingLeaveRequest, reason: string) => Promise<void>;
  isProcessing: boolean;
}

function ApprovalCard({
  request,
  onApprove,
  onReject,
  isProcessing,
}: ApprovalCardProps) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const name = fullName(request.user);
  const tone = URGENCY_TONE[request.urgency_level];
  const label = URGENCY_LABEL[request.urgency_level];

  const handleReject = async () => {
    if (!reason.trim()) return;
    await onReject(request, reason.trim());
    setRejecting(false);
    setReason("");
  };

  return (
    <div
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Avatar name={name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 700,
                fontSize: 14.5,
                color: tokens.color.ink900,
              }}
            >
              {name}
            </span>
            <Pill tone={tone} dot>
              {label}
            </Pill>
            <span
              style={{
                fontSize: 11.5,
                color: tokens.color.ink500,
                fontFamily: tokens.font.body,
              }}
            >
              {request.days_until_start <= 0
                ? "Started already"
                : `in ${request.days_until_start} day${request.days_until_start === 1 ? "" : "s"}`}
            </span>
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12.5,
              color: tokens.color.ink600,
              marginTop: 4,
            }}
          >
            {request.leave_type.name} · {fmtDate(request.start_date)} –{" "}
            {fmtDate(request.end_date)} · {request.days_requested} days
          </div>
        </div>
      </div>

      {request.reason && (
        <div
          style={{
            background: tokens.color.ink50,
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            padding: "10px 12px",
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink800,
            marginBottom: 12,
          }}
        >
          <Icon name="info" size={12} /> {request.reason}
        </div>
      )}

      {rejecting ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being rejected? (required)"
            rows={2}
            style={{
              width: "100%",
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: tokens.radius.md,
              padding: "10px 12px",
              fontFamily: tokens.font.body,
              fontSize: 13,
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              disabled={!reason.trim() || isProcessing}
            >
              {isProcessing ? "Rejecting…" : "Reject request"}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRejecting(true)}
            disabled={isProcessing}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void onApprove(request)}
            disabled={isProcessing}
          >
            {isProcessing ? "Approving…" : "Approve"}
          </Button>
        </div>
      )}
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
        <Icon name="check" size={20} />
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
