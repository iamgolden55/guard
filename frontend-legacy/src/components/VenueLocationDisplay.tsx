import React from 'react';
import { Stack, Text, Link } from '@fluentui/react';
import LeafletMapDisplay from './LeafletMapDisplay';

export interface VenueLocationDisplayProps {
  apiKey?: string; // Kept for backward compatibility but no longer required
  venue: {
    id: number;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  height?: string;
  width?: string;
  showAddress?: boolean;
  showDirections?: boolean;
  showCheckInRadius?: boolean;
  checkInRadiusMeters?: number;
  className?: string;
}

const VenueLocationDisplay: React.FC<VenueLocationDisplayProps> = ({
  venue,
  height = '300px',
  showAddress = true,
  showDirections = true,
  showCheckInRadius = false,
  checkInRadiusMeters = 100,
  className = ''
}) => {
  // Generate directions URL
  const getDirectionsUrl = () => {
    if (!venue.latitude || !venue.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
  };

  // Check if venue has coordinates
  const hasCoordinates = venue.latitude && venue.longitude;

  // Compact mode: when both showAddress and showDirections are false, render just the map
  const isCompactMode = !showAddress && !showDirections && !showCheckInRadius;

  if (!hasCoordinates) {
    return (
      <div className={`border rounded-lg p-4 ${className}`} style={{ height, width: '100%' }}>
        <Stack tokens={{ childrenGap: 12 }} className="h-full justify-center">
          <Text variant="mediumPlus" className="text-center">📍 {venue.name}</Text>

          {showAddress && (
            <Text className="text-center text-gray-600">{venue.address}</Text>
          )}

          <Text variant="small" className="text-center text-gray-500">
            Coordinates not available for map display
          </Text>

          {showDirections && (
            <div className="text-center">
              <Link
                href={getDirectionsUrl()}
                target="_blank"
                className="text-blue-600 hover:underline"
              >
                🗺️ View on Google Maps
              </Link>
            </div>
          )}
        </Stack>
      </div>
    );
  }

  // Compact mode: render just the map without header/footer
  if (isCompactMode) {
    return (
      <LeafletMapDisplay
        latitude={venue.latitude!}
        longitude={venue.longitude!}
        height={height}
        showRadius={showCheckInRadius}
        radiusMeters={checkInRadiusMeters}
        allowInteraction={false}
        zoom={16}
        className={className}
      />
    );
  }

  // Full mode: render with header and additional info using flexbox
  return (
    <div className={`flex flex-col ${className}`} style={{ height, width: '100%' }}>
      {/* Venue Info Header */}
      <div className="flex justify-between items-center px-3 py-2 bg-white/90 shrink-0">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-gray-900">📍 {venue.name}</span>
          {showAddress && (
            <span className="text-sm text-gray-600">{venue.address}</span>
          )}
        </div>

        {showDirections && (
          <a
            href={getDirectionsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm whitespace-nowrap"
          >
            🗺️ Directions
          </a>
        )}
      </div>

      {/* Coordinates & Check-in radius info */}
      <div className="px-3 py-1 bg-white/90 text-sm shrink-0">
        {venue.latitude && venue.longitude && (
          <div className="text-gray-500">
            📍 {Number(venue.latitude).toFixed(6)}, {Number(venue.longitude).toFixed(6)}
          </div>
        )}
        {showCheckInRadius && (
          <div className="text-blue-600">
            ⚪ Check-in area: {checkInRadiusMeters}m radius
          </div>
        )}
      </div>

      {/* Map - Takes remaining space */}
      <div className="flex-1 min-h-0">
        <LeafletMapDisplay
          latitude={venue.latitude!}
          longitude={venue.longitude!}
          height="100%"
          showRadius={showCheckInRadius}
          radiusMeters={checkInRadiusMeters}
          allowInteraction={false}
          zoom={16}
          className="rounded-b-lg"
        />
      </div>
    </div>
  );
};

export default VenueLocationDisplay;
