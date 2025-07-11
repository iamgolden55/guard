import React, { useMemo } from 'react';
import { Stack, Text, Link } from '@fluentui/react';
import MapComponent, { MapLocation } from './MapComponent';

export interface VenueLocationDisplayProps {
  apiKey: string;
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
  apiKey,
  venue,
  height = '300px',
  width = '100%',
  showAddress = true,
  showDirections = true,
  showCheckInRadius = false,
  checkInRadiusMeters = 100,
  className = ''
}) => {
  // Create map markers
  const markers = useMemo((): MapLocation[] => {
    if (!venue.latitude || !venue.longitude) {
      return [];
    }

    return [{
      lat: venue.latitude,
      lng: venue.longitude,
      address: venue.address
    }];
  }, [venue.latitude, venue.longitude, venue.address]);

  // Map center
  const center = useMemo((): MapLocation => {
    if (venue.latitude && venue.longitude) {
      return {
        lat: venue.latitude,
        lng: venue.longitude
      };
    }
    
    // Default to Bristol, UK if no coordinates
    return { lat: 51.4545, lng: -2.5879 };
  }, [venue.latitude, venue.longitude]);

  // Handle map load to add check-in radius circle
  const handleMapLoad = (map: google.maps.Map) => {
    if (showCheckInRadius && venue.latitude && venue.longitude) {
      // Add circle to show check-in radius
      const circle = new google.maps.Circle({
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#4285F4',
        fillOpacity: 0.15,
        map,
        center: { lat: venue.latitude, lng: venue.longitude },
        radius: checkInRadiusMeters
      });

      // Add info window for radius
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px;">
                    <strong>Check-in Area</strong><br/>
                    Staff must be within ${checkInRadiusMeters}m to check in
                  </div>`,
        position: { lat: venue.latitude, lng: venue.longitude }
      });

      // Show info window when circle is clicked
      circle.addListener('click', () => {
        infoWindow.open(map);
      });
    }
  };

  // Generate directions URL
  const getDirectionsUrl = () => {
    if (!venue.latitude || !venue.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`;
    }
    
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
  };

  // Check if venue has coordinates
  const hasCoordinates = venue.latitude && venue.longitude;

  if (!hasCoordinates) {
    return (
      <div className={`border rounded-lg p-4 ${className}`} style={{ height, width }}>
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

  return (
    <Stack tokens={{ childrenGap: 12 }} className={className}>
      {/* Venue Info Header */}
      <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="mediumPlus">📍 {venue.name}</Text>
          {showAddress && (
            <Text variant="small" className="text-gray-600">{venue.address}</Text>
          )}
        </Stack>
        
        {showDirections && (
          <Link 
            href={getDirectionsUrl()} 
            target="_blank"
            className="text-blue-600 hover:underline text-sm"
          >
            🗺️ Directions
          </Link>
        )}
      </Stack>

      {/* Map */}
      <MapComponent
        apiKey={apiKey}
        center={center}
        zoom={16}
        height={height}
        width={width}
        markers={markers}
        interactive={false}
        onMapLoad={handleMapLoad}
        className="border-0"
      />

      {/* Additional Info */}
      {(showCheckInRadius || venue.latitude) && (
        <Stack tokens={{ childrenGap: 4 }}>
          {venue.latitude && venue.longitude && (
            <Text variant="small" className="text-gray-500">
              📍 {Number(venue.latitude).toFixed(6)}, {Number(venue.longitude).toFixed(6)}
            </Text>
          )}
          
          {showCheckInRadius && (
            <Text variant="small" className="text-blue-600">
              ⚪ Check-in area: {checkInRadiusMeters}m radius
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
};

export default VenueLocationDisplay;