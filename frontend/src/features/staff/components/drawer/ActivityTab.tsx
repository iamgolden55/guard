import { Icon } from "../../../../design-system/Icon";
import { Pill, type PillTone } from "../../../../design-system/primitives/Pill";
import { tokens } from "../../../../design-system/tokens";
import type { RecentShiftRecord } from "../../hooks/useStaffData";

export interface ActivityTabProps {
  shifts: RecentShiftRecord[];
  isLoading: boolean;
}

const STATUS_TONE: Record<string, PillTone> = {
  approved: "positive",
  in_progress: "info",
  pending: "warning",
  no_show: "danger",
  rejected: "danger",
  cancelled: "neutral",
  completed: "positive",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(start: string, end: string) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatStatus(status: string) {
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityTab({ shifts, isLoading }: ActivityTabProps) {
  if (isLoading) {
    return (
      <div
        style={{
          padding: "30px 0",
          textAlign: "center",
          color: tokens.color.ink500,
          fontFamily: tokens.font.body,
          fontSize: 13,
        }}
      >
        Loading recent shifts…
      </div>
    );
  }

  if (shifts.length === 0) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          background: tokens.color.ink50,
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.lg,
          color: tokens.color.ink600,
          fontFamily: tokens.font.body,
          fontSize: 13,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            margin: "0 auto 10px",
            borderRadius: 18,
            background: "white",
            display: "grid",
            placeItems: "center",
            color: tokens.color.ink500,
          }}
        >
          <Icon name="history" size={16} />
        </div>
        <div style={{ fontWeight: 600, color: tokens.color.ink800, marginBottom: 4 }}>
          No recent shifts
        </div>
        <div style={{ color: tokens.color.ink500 }}>
          This staff member has no shift history yet.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {shifts.map((s) => {
        const tone = STATUS_TONE[s.status] ?? "neutral";
        return (
          <div
            key={s.id}
            style={{
              border: `1px solid ${tokens.color.ink200}`,
              borderRadius: tokens.radius.lg,
              padding: 14,
              background: tokens.color.ink50,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontFamily: tokens.font.display,
                  fontWeight: 700,
                  fontSize: 14,
                  color: tokens.color.ink900,
                }}
              >
                {s.venue_name || "Unassigned venue"}
              </div>
              <Pill tone={tone} dot>
                {formatStatus(s.status)}
              </Pill>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                fontFamily: tokens.font.body,
                fontSize: 12.5,
              }}
            >
              <div>
                <div
                  style={{
                    color: tokens.color.ink500,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.09em",
                  }}
                >
                  Date
                </div>
                <div style={{ color: tokens.color.ink900, marginTop: 2 }}>
                  {formatDate(s.start_time)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: tokens.color.ink500,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.09em",
                  }}
                >
                  Time
                </div>
                <div style={{ color: tokens.color.ink900, marginTop: 2 }}>
                  {formatTimeRange(s.start_time, s.end_time)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 11.5,
          color: tokens.color.ink500,
          textAlign: "center",
          marginTop: 4,
        }}
      >
        Showing the {shifts.length} most recent shift{shifts.length === 1 ? "" : "s"}.
      </div>
    </div>
  );
}
