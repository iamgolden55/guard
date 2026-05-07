import type { CSSProperties } from "react";
import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { Venue } from "../../../types/venue";

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

export interface VenuesViewProps {
  venues: Venue[];
  isLoading: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onSelect: (venue: Venue) => void;
}

export function VenuesView({
  venues,
  isLoading,
  emptyTitle,
  emptyHint,
  onSelect,
}: VenuesViewProps) {
  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty title="Loading venues…" />
      </ScrollWrap>
    );
  }
  if (venues.length === 0) {
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
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr>
                <th style={HEADER_STYLE}>Venue</th>
                <th style={HEADER_STYLE}>City</th>
                <th style={HEADER_STYLE}>Capacity</th>
                <th style={HEADER_STYLE}>Requirements</th>
                <th style={HEADER_STYLE}>Status</th>
                <th style={{ ...HEADER_STYLE, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <VenueRow key={v.id} venue={v} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ScrollWrap>
  );
}

function VenueRow({
  venue,
  onSelect,
}: {
  venue: Venue;
  onSelect: (v: Venue) => void;
}) {
  const statusTone: PillTone = venue.is_active ? "positive" : "neutral";
  const statusLabel = venue.is_active ? "Active" : "Inactive";

  return (
    <tr
      onClick={() => onSelect(venue)}
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
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: tokens.radius.md,
              background: tokens.color.ink100,
              color: tokens.color.ink700,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon name="map-pin" size={14} />
          </span>
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
              {venue.name}
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
              {venue.address || "—"}
            </div>
          </div>
        </div>
      </td>
      <td style={CELL_STYLE}>
        {venue.city || <span style={{ color: tokens.color.ink500 }}>—</span>}
      </td>
      <td style={{ ...CELL_STYLE, fontVariantNumeric: "tabular-nums" }}>
        {Number.isFinite(venue.capacity) ? venue.capacity : "—"}
      </td>
      <td style={CELL_STYLE}>
        <RequirementBadges venue={venue} />
      </td>
      <td style={CELL_STYLE}>
        <Pill tone={statusTone} dot>
          {statusLabel}
        </Pill>
      </td>
      <td
        style={{ ...CELL_STYLE, textAlign: "right" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(venue)}
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

function RequirementBadges({ venue }: { venue: Venue }) {
  const reqs = [
    { active: venue.requires_fire_safety_checks, label: "Fire", title: "Fire-safety checks required" },
    { active: venue.requires_capacity_monitoring, label: "Capacity", title: "Capacity monitoring required" },
    { active: venue.requires_toilet_checks, label: "Toilet", title: "Toilet checks required" },
  ];
  const enabled = reqs.filter((r) => r.active);
  if (enabled.length === 0) {
    return <span style={{ color: tokens.color.ink500 }}>None</span>;
  }
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {enabled.map((r) => (
        <span
          key={r.label}
          title={r.title}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: tokens.color.ink100,
            color: tokens.color.ink800,
            fontFamily: tokens.font.body,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: tokens.radius.pill,
          }}
        >
          {r.label}
        </span>
      ))}
    </div>
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
        <Icon name="map-pin" size={20} />
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
