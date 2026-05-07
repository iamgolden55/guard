// VenuesMapView — Leaflet map with one marker per venue (when GPS is set).
// Uses OpenStreetMap tiles (no API key required). Auto-fits bounds to all
// visible venues; popups show name + address + a "View details" button that
// opens the drawer.
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { useAccent } from "../../../contexts/AccentContext";
import { Icon } from "../../../design-system/Icon";
import { tokens } from "../../../design-system/tokens";
import type { Venue } from "../../../types/venue";

// Build a custom DivIcon so we don't depend on Leaflet's default marker
// images (which require a separate asset import dance under Vite).
function buildPinIcon(color: string, isInactive: boolean): L.DivIcon {
  const fill = isInactive ? tokens.color.ink400 : color;
  const html = `
    <div style="
      width: 28px;
      height: 36px;
      transform: translate(-50%, -100%);
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
    ">
      <svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14 0C6.27 0 0 6.27 0 14c0 9.86 12.5 21.05 13.04 21.52a1.5 1.5 0 0 0 1.92 0C15.5 35.05 28 23.86 28 14 28 6.27 21.73 0 14 0z"
          fill="${fill}"
        />
        <circle cx="14" cy="14" r="5" fill="white" />
      </svg>
    </div>
  `;
  return L.divIcon({
    className: "venue-pin",
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

interface VenueWithCoords extends Venue {
  latitude: number;
  longitude: number;
}

function hasCoords(v: Venue): v is VenueWithCoords {
  return (
    typeof v.latitude === "number" &&
    Number.isFinite(v.latitude) &&
    typeof v.longitude === "number" &&
    Number.isFinite(v.longitude)
  );
}

export interface VenuesMapViewProps {
  venues: Venue[];
  isLoading: boolean;
  onSelect: (venue: Venue) => void;
}

export function VenuesMapView({
  venues,
  isLoading,
  onSelect,
}: VenuesMapViewProps) {
  const { palette } = useAccent();
  const mapped = useMemo(() => venues.filter(hasCoords), [venues]);
  const missingCount = venues.length - mapped.length;

  if (isLoading) {
    return (
      <ScrollWrap>
        <Empty
          icon="map-pin"
          title="Loading venues…"
        />
      </ScrollWrap>
    );
  }

  if (mapped.length === 0) {
    return (
      <ScrollWrap>
        <Empty
          icon="map-pin"
          title={
            venues.length === 0
              ? "No venues to map"
              : "No venues have GPS coordinates yet"
          }
          hint={
            venues.length === 0
              ? "Add a venue with latitude and longitude to see it here."
              : "Edit a venue and add latitude / longitude to plot it on the map."
          }
        />
      </ScrollWrap>
    );
  }

  // Sensible default centre — first mapped venue. FitBounds component below
  // overrides this on mount.
  const center: [number, number] = [
    mapped[0].latitude,
    mapped[0].longitude,
  ];

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        padding: 24,
        background: tokens.color.ink50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          background: "white",
          border: `1px solid ${tokens.color.ink200}`,
          borderRadius: tokens.radius.lg,
          overflow: "hidden",
        }}
      >
        <MapContainer
          center={center}
          zoom={6}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds venues={mapped} />
          {mapped.map((v) => (
            <Marker
              key={v.id}
              position={[v.latitude, v.longitude]}
              icon={buildPinIcon(palette.primary, !v.is_active)}
            >
              <Popup>
                <VenuePopupContent venue={v} onSelect={onSelect} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {missingCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              padding: "8px 12px",
              borderRadius: tokens.radius.md,
              background: tokens.color.warnSoft,
              border: `1px solid ${tokens.color.warn}40`,
              color: tokens.color.warnInk,
              fontFamily: tokens.font.body,
              fontSize: 12,
              fontWeight: 600,
              boxShadow: tokens.shadow.sm,
              zIndex: 500,
            }}
          >
            {missingCount} {missingCount === 1 ? "venue" : "venues"} missing GPS
            coordinates
          </div>
        )}
      </div>
    </div>
  );
}

function FitBounds({ venues }: { venues: VenueWithCoords[] }) {
  const map = useMap();
  const lastSig = useRef<string>("");

  useEffect(() => {
    const sig = venues
      .map((v) => `${v.id}:${v.latitude}:${v.longitude}`)
      .join("|");
    if (sig === lastSig.current) return;
    lastSig.current = sig;

    if (venues.length === 0) return;
    if (venues.length === 1) {
      map.setView([venues[0].latitude, venues[0].longitude], 14);
      return;
    }
    const bounds = L.latLngBounds(
      venues.map((v) => [v.latitude, v.longitude]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [venues, map]);

  return null;
}

function VenuePopupContent({
  venue,
  onSelect,
}: {
  venue: VenueWithCoords;
  onSelect: (v: Venue) => void;
}) {
  return (
    <div
      style={{
        minWidth: 200,
        fontFamily: tokens.font.body,
        color: tokens.color.ink900,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.display,
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 4,
        }}
      >
        {venue.name}
      </div>
      <div
        style={{
          fontSize: 12,
          color: tokens.color.ink600,
          marginBottom: 6,
        }}
      >
        {venue.address}
      </div>
      <div
        style={{
          fontSize: 11,
          color: tokens.color.ink500,
          marginBottom: 10,
        }}
      >
        {venue.city}
        {venue.postal_code ? `, ${venue.postal_code}` : ""}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 999,
            background: venue.is_active
              ? tokens.color.successSoft
              : tokens.color.ink100,
            color: venue.is_active
              ? tokens.color.successInk
              : tokens.color.ink600,
          }}
        >
          {venue.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onSelect(venue)}
        style={{
          width: "100%",
          background: tokens.color.ink900,
          color: "white",
          border: "none",
          padding: "8px 12px",
          borderRadius: tokens.radius.md,
          fontFamily: tokens.font.display,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        View details →
      </button>
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

function Empty({
  icon,
  title,
  hint,
}: {
  icon: "map-pin";
  title: string;
  hint?: string;
}) {
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
        <Icon name={icon} size={20} />
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
