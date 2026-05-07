import { Pill, type PillTone } from "../../../design-system/primitives/Pill";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { Venue } from "../../../types/venue";

export interface VenuesCardsViewProps {
  venues: Venue[];
  isLoading: boolean;
  emptyTitle: string;
  emptyHint?: string;
  onSelect: (venue: Venue) => void;
}

export function VenuesCardsView({
  venues,
  isLoading,
  emptyTitle,
  emptyHint,
  onSelect,
}: VenuesCardsViewProps) {
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}
      >
        {venues.map((v) => (
          <VenueCard key={v.id} venue={v} onSelect={onSelect} />
        ))}
      </div>
    </ScrollWrap>
  );
}

function VenueCard({
  venue,
  onSelect,
}: {
  venue: Venue;
  onSelect: (v: Venue) => void;
}) {
  const statusTone: PillTone = venue.is_active ? "positive" : "neutral";
  const statusLabel = venue.is_active ? "Active" : "Inactive";
  const reqs = [
    { active: venue.requires_fire_safety_checks, label: "Fire" },
    { active: venue.requires_capacity_monitoring, label: "Capacity" },
    { active: venue.requires_toilet_checks, label: "Toilet" },
  ].filter((r) => r.active);
  const hasGps = venue.latitude != null && venue.longitude != null;

  return (
    <button
      type="button"
      onClick={() => onSelect(venue)}
      style={{
        background: "white",
        border: `1px solid ${tokens.color.ink200}`,
        borderRadius: tokens.radius.lg,
        padding: 16,
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: tokens.shadow.xs,
        transition: `transform ${tokens.motion.fast}, box-shadow ${tokens.motion.fast}, border-color ${tokens.motion.fast}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = tokens.shadow.sm;
        e.currentTarget.style.borderColor = tokens.color.ink300;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = tokens.shadow.xs;
        e.currentTarget.style.borderColor = tokens.color.ink200;
      }}
    >
      {/* Header: icon tile + title block + status pill */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: tokens.radius.md,
            background: tokens.color.ink100,
            color: tokens.color.ink700,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="map-pin" size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: tokens.font.display,
              fontWeight: 700,
              fontSize: 15,
              color: tokens.color.ink900,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {venue.name}
          </div>
          <div
            style={{
              fontFamily: tokens.font.body,
              fontSize: 12,
              color: tokens.color.ink600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 2,
            }}
          >
            {venue.city || "—"}
            {venue.country ? ` · ${venue.country}` : ""}
          </div>
        </div>
        <Pill tone={statusTone} dot>
          {statusLabel}
        </Pill>
      </div>

      {/* Address */}
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 12.5,
          color: tokens.color.ink700,
          padding: "8px 10px",
          background: tokens.color.ink50,
          borderRadius: tokens.radius.md,
          minHeight: 36,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name="map-pin" size={12} />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {venue.address || "Address not set"}
        </span>
      </div>

      {/* Stats row: capacity + GPS pill */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontFamily: tokens.font.body,
          fontSize: 12,
          color: tokens.color.ink600,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="users" size={12} />
          <span>
            <strong style={{ color: tokens.color.ink900, fontVariantNumeric: "tabular-nums" }}>
              {Number.isFinite(venue.capacity) ? venue.capacity : "—"}
            </strong>{" "}
            capacity
          </span>
        </span>
        {hasGps ? (
          <Pill tone="info" dot>
            GPS set
          </Pill>
        ) : (
          <span style={{ fontSize: 11, color: tokens.color.ink500 }}>
            No GPS
          </span>
        )}
      </div>

      {/* Requirements */}
      {reqs.length > 0 ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {reqs.map((r) => (
            <span
              key={r.label}
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
      ) : (
        <div style={{ fontSize: 11, color: tokens.color.ink500 }}>
          No compliance checks required
        </div>
      )}
    </button>
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
