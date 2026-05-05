// ExceptionsView — triage queue with filter chips + grouped cards.
// Ported 1:1 from project/attendance-tabs.jsx:23-150.
import { useState } from "react";
import { useAccent } from "../../../contexts/AccentContext";
import { Avatar } from "../../../design-system/primitives/Avatar";
import { Button } from "../../../design-system/primitives/Button";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import { fmtRange2, type AttendanceShift } from "../data/mocks";
import { useAttendance } from "../AttendanceContext";

interface ExceptionType {
  id: string;
  label: string;
  color: string;
  icon: IconName;
  test: (s: AttendanceShift) => boolean;
}

const EXCEPTION_TYPES: ExceptionType[] = [
  { id: "no_show", label: "No-shows", color: tokens.color.danger, icon: "alert", test: (s) => s.status === "no_show" },
  { id: "missing_out", label: "Missing checkout", color: tokens.color.danger, icon: "clock", test: (s) => s.status === "missing_out" },
  { id: "geofence", label: "Geofence", color: "#6d28d9", icon: "map-pin", test: (s) => !!s.geofence_fail },
  { id: "early_out", label: "Early checkout", color: tokens.color.warn, icon: "x", test: (s) => s.status === "early_out" },
  { id: "late", label: "Late check-in", color: tokens.color.warn, icon: "clock", test: (s) => (s.late_min ?? 0) >= 10 && s.status !== "no_show" },
];

export interface ExceptionsViewProps {
  onSelect: (shift: AttendanceShift) => void;
}

export function ExceptionsView({ onSelect }: ExceptionsViewProps) {
  const [filter, setFilter] = useState<string>("all");
  const { shifts, matchesSearch } = useAttendance();
  const visibleShifts = shifts.filter(matchesSearch);

  const buckets = EXCEPTION_TYPES.map((t) => ({
    ...t,
    items: visibleShifts.filter(t.test),
  }));
  const total = buckets.reduce((n, b) => n + b.items.length, 0);
  const visible = filter === "all" ? buckets : buckets.filter((b) => b.id === filter);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: tokens.color.ink50,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "16px 24px",
          background: "white",
          borderBottom: `1px solid ${tokens.color.ink200}`,
          overflowX: "auto",
        }}
      >
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={total}
          color={tokens.color.ink600}
        />
        {buckets.map((b) => (
          <FilterChip
            key={b.id}
            active={filter === b.id}
            onClick={() => setFilter(b.id)}
            label={b.label}
            count={b.items.length}
            color={b.color}
          />
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" leading={<Icon name="check" size={13} />}>
          Bulk approve
        </Button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {visible.map(
          (b) =>
            b.items.length > 0 && (
              <div key={b.id} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: b.color,
                      color: "white",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name={b.icon} size={15} />
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: tokens.font.display,
                        fontWeight: 700,
                        fontSize: 16,
                        color: tokens.color.ink900,
                      }}
                    >
                      {b.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: tokens.color.ink500 }}>
                      {b.items.length} requires action
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                    gap: 12,
                  }}
                >
                  {b.items.map((s) => (
                    <ExceptionCard
                      key={s.id}
                      s={s}
                      color={b.color}
                      onSelect={() => onSelect(s)}
                    />
                  ))}
                </div>
              </div>
            ),
        )}
        {total === 0 && (
          <div style={{ padding: 80, textAlign: "center", color: tokens.color.ink500 }}>
            <div style={{ fontSize: 56 }}>✓</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: tokens.color.ink900,
                marginTop: 12,
              }}
            >
              All clear
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              No open exceptions across {visibleShifts.length} shifts today.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        cursor: "pointer",
        background: active ? color : "white",
        border: `1px solid ${active ? color : tokens.color.ink200}`,
        color: active ? "white" : tokens.color.ink800,
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: tokens.font.body,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: "1px 7px",
          borderRadius: 999,
          background: active ? "rgba(255,255,255,0.25)" : tokens.color.ink100,
          color: active ? "white" : tokens.color.ink600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function ExceptionCard({
  s,
  color,
  onSelect,
}: {
  s: AttendanceShift;
  color: string;
  onSelect: () => void;
}) {
  const { palette } = useAccent();
  const { officerById, venueById, nowHour, approveShift, isApproving } = useAttendance();
  const [actionError, setActionError] = useState<string | null>(null);
  const o = officerById(s.oid);
  const v = venueById(s.vid);
  if (!v) return null;

  const sinceMin =
    s.status === "no_show"
      ? Math.round((nowHour - s.sch_start) * 60)
      : s.status === "missing_out"
        ? Math.round((nowHour - s.sch_end) * 60)
        : null;

  return (
    <div
      onClick={onSelect}
      style={{
        background: "white",
        borderRadius: 10,
        border: `1px solid ${tokens.color.ink200}`,
        borderLeft: `4px solid ${color}`,
        padding: 14,
        cursor: "pointer",
        transition: "box-shadow .15s, transform .08s",
        boxShadow: tokens.shadow.xs,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 8px 20px -8px rgba(32,31,30,0.18)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = tokens.shadow.xs;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {o ? (
          <Avatar name={o.name} hue={o.hue} size={36} />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: tokens.color.ink100,
              display: "grid",
              placeItems: "center",
              color: tokens.color.ink600,
            }}
          >
            <Icon name="user-plus" size={16} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: tokens.color.ink900 }}>
            {o?.name || "Unassigned"}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: tokens.color.ink500,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icon name="map-pin" size={11} /> {v.name} · {fmtRange2(s.sch_start, s.sch_end)}
          </div>
        </div>
        {sinceMin != null && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                fontFamily: tokens.font.display,
                fontWeight: 800,
                fontSize: 17,
                color,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "-0.02em",
              }}
            >
              {sinceMin >= 60
                ? `${Math.floor(sinceMin / 60)}h ${sinceMin % 60}m`
                : `${sinceMin}m`}
            </div>
            <div
              style={{
                fontSize: 9.5,
                color: tokens.color.ink500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {s.status === "no_show" ? "past start" : "past end"}
            </div>
          </div>
        )}
      </div>

      {s.note && (
        <div
          style={{
            fontSize: 12,
            color: tokens.color.ink600,
            lineHeight: 1.5,
            padding: "8px 10px",
            background: tokens.color.ink50,
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          {s.note}
        </div>
      )}

      {s.geofence_fail && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            padding: "6px 10px",
            background: "#f5f3ff",
            borderRadius: 6,
            fontSize: 11.5,
            color: "#5b21b6",
            fontWeight: 600,
          }}
        >
          <Icon name="map-pin" size={12} /> {s.dist_m}m from venue boundary
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <Button
          variant="secondary"
          size="sm"
          leading={<Icon name="bell" size={12} />}
          style={{ flex: 1 }}
          disabled={!o?.phone}
          title={o?.phone ?? "No phone on file"}
          onClick={(e) => {
            e.stopPropagation();
            if (o?.phone) {
              window.location.href = `tel:${o.phone.replace(/\s+/g, "")}`;
            }
          }}
        >
          Call
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leading={<Icon name="edit" size={12} />}
          style={{ flex: 1 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          Adjust
        </Button>
        <Button
          variant="primary"
          size="sm"
          accent={palette}
          leading={<Icon name="check" size={12} />}
          style={{ flex: 1 }}
          disabled={isApproving || s.status === "approved" || s.act_end == null}
          title={
            s.status === "approved"
              ? "Already approved"
              : s.act_end == null
                ? "Waiting for check-out — open the shift to Mark Present + record end time"
                : undefined
          }
          onClick={async (e) => {
            e.stopPropagation();
            setActionError(null);
            try {
              await approveShift({
                shiftId: Number(s.id),
                approved: true,
                managerNotes: "Resolved from Exceptions queue",
              });
            } catch (err: unknown) {
              const ex = err as { response?: { data?: { detail?: string; error?: string } }; message?: string };
              setActionError(
                ex?.response?.data?.detail ||
                  ex?.response?.data?.error ||
                  ex?.message ||
                  "Failed to resolve shift",
              );
            }
          }}
        >
          {isApproving
            ? "Saving…"
            : s.act_end == null
              ? "Awaiting check-out"
              : "Resolve"}
        </Button>
      </div>
      {actionError && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: tokens.color.dangerSoft,
            color: tokens.color.dangerInk,
            borderRadius: 6,
            fontSize: 11.5,
          }}
        >
          {actionError}
        </div>
      )}
    </div>
  );
}
