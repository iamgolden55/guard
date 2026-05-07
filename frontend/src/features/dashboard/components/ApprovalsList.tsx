// ApprovalsList — ported 1:1 from project/dashboard.jsx:548-601.
import { useAccent } from "../../../contexts/AccentContext";
import { Icon } from "../../../design-system/Icon";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { tokens } from "../../../design-system/tokens";
import type { DashboardApproval } from "../data/mocks";

const URGENCY_TONE: Record<DashboardApproval["urgency"], PillTone> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

export interface ApprovalsListProps {
  items: DashboardApproval[];
  /** Total open approvals across all sources (KPI value). The list itself
   * is capped to a top-N for visibility — show this as the headline count. */
  totalCount?: number;
  onResolve: (id: string, action: "approve" | "deny") => void;
  /** Click handler for the Inbox button. */
  onInbox?: () => void;
}

export function ApprovalsList({
  items,
  totalCount,
  onResolve,
  onInbox,
}: ApprovalsListProps) {
  const { palette } = useAccent();
  const headlineCount = totalCount ?? items.length;
  const hasMore = totalCount !== undefined && totalCount > items.length;

  return (
    <div
      style={{
        background: "white",
        borderRadius: tokens.radius.lg,
        border: `1px solid ${tokens.color.ink200}`,
        padding: 20,
        fontFamily: tokens.font.body,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: tokens.color.ink900,
            }}
          >
            Approvals{" "}
            <span style={{ color: tokens.color.ink500, fontWeight: 500 }}>
              · {headlineCount}
            </span>
          </h3>
          <div
            style={{ fontSize: 12.5, color: tokens.color.ink500, marginTop: 2 }}
          >
            {hasMore
              ? `Showing top ${items.length} · awaiting your review`
              : "Awaiting your review"}
          </div>
        </div>
        <button
          type="button"
          onClick={onInbox}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            color: palette.primary,
            fontFamily: tokens.font.body,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: onInbox ? "pointer" : "default",
            padding: 0,
          }}
        >
          Inbox <Icon name="chevron-right" size={12} />
        </button>
      </div>

      {items.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 0",
            color: tokens.color.ink500,
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
          All clear
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((a) => (
          <div
            key={a.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              padding: 12,
              borderRadius: 10,
              background: tokens.color.ink50,
              border: `1px solid ${tokens.color.ink100}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <Pill tone={URGENCY_TONE[a.urgency]}>{a.type}</Pill>
                <span style={{ fontSize: 11.5, color: tokens.color.ink500 }}>
                  {a.venue}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: tokens.color.ink900,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {a.who}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: tokens.color.ink600,
                  marginTop: 2,
                }}
              >
                {a.when}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => onResolve(a.id, "deny")}
                title="Decline"
                aria-label={`Decline ${a.type}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: `1px solid ${tokens.color.ink200}`,
                  background: "white",
                  color: tokens.color.ink600,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="x" size={14} />
              </button>
              <button
                type="button"
                onClick={() => onResolve(a.id, "approve")}
                title="Approve"
                aria-label={`Approve ${a.type}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "none",
                  background: palette.primary,
                  color: "white",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon name="check" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
