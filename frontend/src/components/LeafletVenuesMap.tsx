import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Create a custom SVG marker icon
const createCustomIcon = (isActive: boolean = true) => {
  const color = isActive ? '#EF4444' : '#9CA3AF';
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <path fill="${color}" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.38 8.5 15.5 8.5 15.5s8.5-9.12 8.5-15.5C20.5 3.81 16.69 0 12 0z"/>
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

// Component to fit map bounds to all markers
const FitBounds: React.FC<{ venues: VenueMarker[] }> = ({ venues }) => {
  const map = useMap();

  useEffect(() => {
    if (venues.length === 0) return;

    const validVenues = venues.filter(v => v.latitude && v.longitude);
    if (validVenues.length === 0) return;

    if (validVenues.length === 1) {
      map.setView([validVenues[0].latitude!, validVenues[0].longitude!], 15);
    } else {
      const bounds = L.latLngBounds(
        validVenues.map(v => [v.latitude!, v.longitude!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, venues]);

  return null;
};

export interface VenueMarker {
  id: number;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  capacity?: number;
}

export interface LeafletVenuesMapProps {
  venues: VenueMarker[];
  height?: string;
  onVenueClick?: (venue: VenueMarker) => void;
  className?: string;
}

export const LeafletVenuesMap: React.FC<LeafletVenuesMapProps> = ({
  venues,
  height = '600px',
  onVenueClick,
  className = '',
}) => {
  // Filter venues with valid coordinates
  const validVenues = venues.filter(v => v.latitude && v.longitude);

  // Default center (Bristol, UK) if no venues
  const defaultCenter: [number, number] = [51.4545, -2.5879];
  const center = validVenues.length > 0
    ? [validVenues[0].latitude!, validVenues[0].longitude!] as [number, number]
    : defaultCenter;

  if (validVenues.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="font-medium">No venues with GPS coordinates</p>
          <p className="text-sm mt-1">Add coordinates to venues to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .leaflet-custom-marker {
          background: transparent;
          border: none;
        }
        .leaflet-container {
          font-family: inherit;
        }
        .venue-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
        }
        .venue-popup .leaflet-popup-content {
          margin: 0;
          min-width: 200px;
        }
      `}</style>

      <MapContainer
        center={center}
        zoom={13}
        style={{ height, width: '100%' }}
        scrollWheelZoom={true}
        className={`rounded-lg ${className}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds venues={validVenues} />

        {validVenues.map((venue) => (
          <Marker
            key={venue.id}
            position={[venue.latitude!, venue.longitude!]}
            icon={createCustomIcon(venue.isActive)}
            eventHandlers={{
              click: () => onVenueClick?.(venue),
            }}
          >
            <Popup className="venue-popup">
              <div className="p-3">
                <h3 className="font-bold text-gray-900 text-base">{venue.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{venue.address}</p>
                {venue.capacity && (
                  <p className="text-sm text-gray-500 mt-1">Capacity: {venue.capacity}</p>
                )}
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    venue.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {venue.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {onVenueClick && (
                  <button
                    onClick={() => onVenueClick(venue)}
                    className="mt-3 w-full px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    View Details
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
};

export default LeafletVenuesMap;
