// VenueDrawer — slide-over with stacked sections.
// Mount/visible state machine + 220ms enter/exit lifted from AttendanceDrawer.
import { format, parseISO } from "date-fns";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../../../design-system/primitives/Button";
import { Pill } from "../../../design-system/primitives/Pill";
import { Icon, type IconName } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { Venue } from "../../../types/venue";

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy 'at' HH:mm");
  } catch {
    return iso;
  }
}

function yesNo(value: boolean | undefined) {
  return value ? "Yes" : "No";
}

export interface VenueDrawerProps {
  open: boolean;
  venue: Venue | null;
  onClose: () => void;
  onEdit: (venue: Venue) => void;
  onToggleStatus: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
  isMutating: boolean;
}

export function VenueDrawer({
  open,
  venue,
  onClose,
  onEdit,
  onToggleStatus,
  onDelete,
  isMutating,
}: VenueDrawerProps) {
  const [mount, setMount] = useState(open);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    if (open) {
      setMount(true);
      requestAnimationFrame(() => setVis(true));
    } else {
      setVis(false);
      const t = setTimeout(() => setMount(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  if (!mount) return null;
  const v = venue;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: tokens.z.modal,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: vis ? "rgba(32,31,30,0.40)" : "rgba(32,31,30,0)",
          backdropFilter: vis ? "blur(2px)" : "none",
          transition: "background .2s",
        }}
      />
      <div
        style={{
          position: "relative",
          width: 560,
          maxWidth: "100vw",
          height: "100%",
          background: "white",
          boxShadow: "-24px 0 48px -16px rgba(32,31,30,0.22)",
          transform: vis ? "translateX(0)" : "translateX(40px)",
          opacity: vis ? 1 : 0,
          transition: "transform .25s ease, opacity .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!v ? (
          <div />
        ) : (
          <>
            <Header venue={v} onClose={onClose} />
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 24px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
                background: tokens.color.ink50,
              }}
            >
              <IdentitySection venue={v} />
              <AddressSection venue={v} />
              <LocationSection venue={v} />
              <CapacityContactSection venue={v} />
              <RequirementsSection venue={v} />
              <TermsSection venue={v} />
            </div>
            <FooterActions
              venue={v}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
              isMutating={isMutating}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function Header({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  return (
    <div
      style={{
        padding: "20px 24px 16px",
        borderBottom: `1px solid ${tokens.color.ink200}`,
        background: "white",
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: tokens.radius.lg,
          background: tokens.color.ink100,
          color: tokens.color.ink700,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="map-pin" size={22} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.display,
            fontWeight: 700,
            fontSize: 18,
            color: tokens.color.ink900,
            letterSpacing: "-0.015em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {venue.name}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: tokens.color.ink600,
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {venue.city || "—"}
          {venue.country ? ` · ${venue.country}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {venue.is_active ? (
            <Pill tone="positive" dot>
              Active
            </Pill>
          ) : (
            <Pill tone="neutral" dot>
              Inactive
            </Pill>
          )}
          {venue.latitude != null && venue.longitude != null && (
            <Pill tone="info" dot>
              GPS set
            </Pill>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: tokens.color.ink100,
          border: "none",
          color: tokens.color.ink600,
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────
const SECTION_STYLE: CSSProperties = {
  background: "white",
  border: `1px solid ${tokens.color.ink200}`,
  borderRadius: tokens.radius.lg,
  padding: 18,
};

function SectionTitle({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: tokens.color.ink100,
          color: tokens.color.ink700,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={13} />
      </span>
      <span
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 13,
          color: tokens.color.ink900,
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: tokens.color.ink500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.body,
          fontSize: 13,
          color: tokens.color.ink900,
          wordBreak: "break-word",
        }}
      >
        {value || <span style={{ color: tokens.color.ink500 }}>—</span>}
      </div>
    </div>
  );
}

function GridTwo({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px 20px",
      }}
    >
      {children}
    </div>
  );
}

function IdentitySection({ venue }: { venue: Venue }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="info" label="Identity" />
      <KV label="Name" value={venue.name} />
      {venue.description && (
        <div style={{ marginTop: 12 }}>
          <KV label="Description" value={venue.description} />
        </div>
      )}
    </div>
  );
}

function AddressSection({ venue }: { venue: Venue }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="map-pin" label="Address" />
      <KV
        label="Street"
        value={venue.address}
      />
      <div style={{ marginTop: 12 }}>
        <GridTwo>
          <KV label="City" value={venue.city} />
          <KV label="Postal code" value={venue.postal_code} />
          <KV label="Country" value={venue.country} />
        </GridTwo>
      </div>
    </div>
  );
}

function LocationSection({ venue }: { venue: Venue }) {
  const hasGps = venue.latitude != null && venue.longitude != null;
  const mapUrl = hasGps
    ? `https://www.openstreetmap.org/?mlat=${venue.latitude}&mlon=${venue.longitude}#map=17/${venue.latitude}/${venue.longitude}`
    : null;
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="map-pin" label="GPS location" />
      {hasGps ? (
        <>
          <GridTwo>
            <KV label="Latitude" value={venue.latitude?.toFixed(6)} />
            <KV label="Longitude" value={venue.longitude?.toFixed(6)} />
          </GridTwo>
          {mapUrl && (
            <div style={{ marginTop: 12 }}>
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: tokens.font.display,
                  fontSize: 12,
                  fontWeight: 600,
                  color: tokens.color.infoInk,
                  textDecoration: "none",
                  background: tokens.color.infoSoft,
                  border: `1px solid ${tokens.color.info}33`,
                  padding: "6px 10px",
                  borderRadius: tokens.radius.md,
                }}
              >
                <Icon name="external" size={12} />
                Open in OpenStreetMap
              </a>
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink500,
          }}
        >
          GPS coordinates aren't set. Add them so check-in / geofence checks
          can validate officer location.
        </div>
      )}
    </div>
  );
}

function CapacityContactSection({ venue }: { venue: Venue }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="users" label="Capacity & contact" />
      <GridTwo>
        <KV
          label="Capacity"
          value={Number.isFinite(venue.capacity) ? venue.capacity : null}
        />
        <KV label="Contact name" value={venue.contact_name} />
        <KV label="Contact email" value={venue.contact_email} />
        <KV label="Contact phone" value={venue.contact_phone} />
      </GridTwo>
    </div>
  );
}

function RequirementsSection({ venue }: { venue: Venue }) {
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="shield" label="Compliance requirements" />
      <GridTwo>
        <KV label="Fire-safety checks" value={yesNo(venue.requires_fire_safety_checks)} />
        <KV label="Capacity monitoring" value={yesNo(venue.requires_capacity_monitoring)} />
        <KV label="Toilet checks" value={yesNo(venue.requires_toilet_checks)} />
      </GridTwo>
    </div>
  );
}

function TermsSection({ venue }: { venue: Venue }) {
  if (!venue.terms_and_conditions && !venue.terms_version) return null;
  return (
    <div style={SECTION_STYLE}>
      <SectionTitle icon="file" label="Terms & conditions" />
      {venue.terms_version && (
        <div style={{ marginBottom: 12 }}>
          <KV label="Version" value={venue.terms_version} />
        </div>
      )}
      {venue.terms_and_conditions && (
        <div
          style={{
            background: tokens.color.ink50,
            border: `1px solid ${tokens.color.ink200}`,
            borderRadius: tokens.radius.md,
            padding: "10px 12px",
            fontFamily: tokens.font.body,
            fontSize: 12.5,
            color: tokens.color.ink800,
            whiteSpace: "pre-wrap",
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {venue.terms_and_conditions}
        </div>
      )}
      <div
        style={{
          marginTop: 12,
          fontFamily: tokens.font.body,
          fontSize: 11,
          color: tokens.color.ink500,
        }}
      >
        Last updated {fmtDateTime(venue.updated_at)}
      </div>
    </div>
  );
}

// ── Footer action bar ──────────────────────────────────────────────────────
interface FooterActionsProps {
  venue: Venue;
  onEdit: (v: Venue) => void;
  onToggleStatus: (v: Venue) => void;
  onDelete: (v: Venue) => void;
  isMutating: boolean;
}

function FooterActions({
  venue,
  onEdit,
  onToggleStatus,
  onDelete,
  isMutating,
}: FooterActionsProps) {
  return (
    <div
      style={{
        padding: "14px 24px",
        background: "white",
        borderTop: `1px solid ${tokens.color.ink200}`,
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <Button
        variant="ghost"
        onClick={() => onDelete(venue)}
        disabled={isMutating}
      >
        Delete
      </Button>
      <Button
        variant="secondary"
        onClick={() => onToggleStatus(venue)}
        disabled={isMutating}
      >
        {venue.is_active ? "Deactivate" : "Reactivate"}
      </Button>
      <Button
        variant="primary"
        onClick={() => onEdit(venue)}
        disabled={isMutating}
      >
        Edit
      </Button>
    </div>
  );
}
