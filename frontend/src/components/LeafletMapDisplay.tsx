import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons not showing in bundlers
// Create a custom SVG marker icon
const createCustomIcon = () => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="#EF4444" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.38 8.5 15.5 8.5 15.5s8.5-9.12 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
      <circle fill="#fff" cx="12" cy="8.5" r="3.5"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'leaflet-custom-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Component to set map bounds/view
const MapController: React.FC<{ latitude: number; longitude: number; zoom: number }> = ({
  latitude,
  longitude,
  zoom
}) => {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [map, latitude, longitude, zoom]);

  return null;
};

export interface LeafletMapDisplayProps {
  latitude: number;
  longitude: number;
  height?: string;
  showRadius?: boolean;
  radiusMeters?: number;
  allowInteraction?: boolean;
  zoom?: number;
  className?: string;
}

export const LeafletMapDisplay: React.FC<LeafletMapDisplayProps> = ({
  latitude,
  longitude,
  height = '200px',
  showRadius = false,
  radiusMeters = 100,
  allowInteraction = false,
  zoom = 16,
  className = '',
}) => {
  const customIcon = createCustomIcon();

  return (
    <>
      {/* Custom styles for the marker */}
      <style>{`
        .leaflet-custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>

      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ height, width: '100%' }}
        dragging={allowInteraction}
        touchZoom={allowInteraction}
        doubleClickZoom={allowInteraction}
        scrollWheelZoom={false}
        zoomControl={allowInteraction}
        attributionControl={true}
        className={`rounded-lg ${className}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController latitude={latitude} longitude={longitude} zoom={zoom} />

        <Marker position={[latitude, longitude]} icon={customIcon} />

        {showRadius && (
          <Circle
            center={[latitude, longitude]}
            radius={radiusMeters}
            pathOptions={{
              color: '#3B82F6',
              fillColor: '#3B82F6',
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </>
  );
};

export default LeafletMapDisplay;
