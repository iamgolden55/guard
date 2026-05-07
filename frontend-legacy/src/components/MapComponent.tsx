import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface MapComponentProps {
  apiKey: string;
  center?: MapLocation;
  zoom?: number;
  height?: string;
  width?: string;
  className?: string;
  onMapLoad?: (map: google.maps.Map) => void;
  onLocationSelect?: (location: MapLocation) => void;
  markers?: MapLocation[];
  interactive?: boolean;
  showCurrentLocation?: boolean;
}

export interface MapComponentRef {
  geocodeAddress: (address: string) => Promise<MapLocation | null>;
  map: google.maps.Map | null;
  panTo: (location: MapLocation) => void;
  setZoom: (zoomLevel: number) => void;
}

const MapComponent = forwardRef<MapComponentRef, MapComponentProps>(({
  apiKey,
  center = { lat: 51.4545, lng: -2.5879 }, // Default to Bristol, UK
  zoom = 13,
  height = '400px',
  width = '100%',
  className = '',
  onMapLoad,
  onLocationSelect,
  markers = [],
  interactive = true,
  showCurrentLocation = false
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMarkers, setCurrentMarkers] = useState<google.maps.Marker[]>([]);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setError('Google Maps API key is required');
      setIsLoading(false);
      return;
    }

    const initializeMap = async () => {
      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places', 'geometry']
        });

        const google = await loader.load();
        
        // Wait for DOM to be ready with better timing
        let retries = 0;
        const maxRetries = 50; // Further increased for Panel components
        
        while (!mapRef.current && retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
          if (retries % 10 === 0) {
            console.log(`Waiting for map container... attempt ${retries}/${maxRetries}`);
          }
        }
        
        if (!mapRef.current) {
          console.error('Map container element never became available');
          throw new Error('Map container not found after waiting');
        }
        
        console.log('Map container found, initializing map...');
        
        // Additional check that the element is actually in the DOM
        if (!document.contains(mapRef.current)) {
          console.error('Map container not attached to DOM');
          throw new Error('Map container not attached to DOM');
        }
        
        // Wait for element to be visible
        let visibilityRetries = 0;
        while (mapRef.current.offsetParent === null && visibilityRetries < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          visibilityRetries++;
          console.log(`Waiting for map container to be visible... attempt ${visibilityRetries}/20`);
        }
        
        if (mapRef.current.offsetParent === null) {
          console.warn('Map container may not be visible, but proceeding anyway');
        }

        console.log('Creating Google Maps instance...');
        const mapInstance = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          disableDefaultUI: !interactive,
          clickableIcons: interactive,
          gestureHandling: interactive ? 'auto' : 'none',
          zoomControl: interactive,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: interactive,
          rotateControl: false,
          fullscreenControl: interactive
        });
        
        console.log('Google Maps instance created successfully');

        // Initialize geocoder
        geocoderRef.current = new google.maps.Geocoder();

        // Add click listener for location selection
        if (interactive && onLocationSelect) {
          mapInstance.addListener('click', async (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              const location: MapLocation = {
                lat: event.latLng.lat(),
                lng: event.latLng.lng()
              };

              // Reverse geocode to get address (only if geocoder is available)
              if (geocoderRef.current) {
                try {
                  const response = await geocoderRef.current.geocode({
                    location: event.latLng
                  });
                  
                  if (response.results && response.results[0]) {
                    location.address = response.results[0].formatted_address;
                  }
                } catch (error) {
                  console.warn('Reverse geocoding failed (this is normal with restricted API keys):', error);
                  // Continue without address - user can still select location
                }
              }

              onLocationSelect(location);
            }
          });
        }

        // Show current location if requested
        if (showCurrentLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              
              new google.maps.Marker({
                position: currentLocation,
                map: mapInstance,
                title: 'Your Current Location',
                icon: {
                  url: 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#4285F4">
                      <circle cx="12" cy="12" r="8"/>
                      <circle cx="12" cy="12" r="3" fill="white"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(20, 20)
                }
              });
            },
            (error) => {
              console.warn('Could not get current location:', error);
            }
          );
        }

        if (isMountedRef.current) {
          setMap(mapInstance);
          onMapLoad?.(mapInstance);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error initializing Google Maps:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        if (errorMessage.includes('API key')) {
          setError('Invalid Google Maps API key. Please check your configuration.');
        } else if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          setError('Google Maps API quota exceeded. Please check your billing settings.');
        } else if (errorMessage.includes('referer') || errorMessage.includes('restricted')) {
          setError('Google Maps API key has restrictions. Please check your API key settings.');
        } else {
          setError(`Failed to load Google Maps: ${errorMessage}`);
        }
        
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initializeMap();
  }, [apiKey, center.lat, center.lng, zoom, interactive, showCurrentLocation, onMapLoad, onLocationSelect]);

  // Update markers when markers prop changes
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    currentMarkers.forEach(marker => marker.setMap(null));
    setCurrentMarkers([]);

    // Add new markers
    const newMarkers = markers.map((location, index) => {
      const marker = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map,
        title: location.address || `Location ${index + 1}`,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="#EA4335">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(25, 25)
        }
      });

      // Add info window if address is available
      if (location.address) {
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; max-width: 200px;">
                      <strong>Address:</strong><br/>
                      ${location.address}
                    </div>`
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }

      return marker;
    });

    setCurrentMarkers(newMarkers);
  }, [map, markers]);

  // Geocoding helper function
  const geocodeAddress = async (address: string): Promise<MapLocation | null> => {
    if (!geocoderRef.current) return null;

    try {
      const response = await geocoderRef.current.geocode({ address });
      
      if (response.results[0]) {
        const location = response.results[0].geometry.location;
        return {
          lat: location.lat(),
          lng: location.lng(),
          address: response.results[0].formatted_address
        };
      }
    } catch (error) {
      console.error('Geocoding failed:', error);
    }
    
    return null;
  };

  // Public methods via ref
  useImperativeHandle(ref, () => ({
    geocodeAddress,
    map,
    panTo: (location: MapLocation) => {
      if (map) {
        map.panTo({ lat: location.lat, lng: location.lng });
      }
    },
    setZoom: (zoomLevel: number) => {
      if (map) {
        map.setZoom(zoomLevel);
      }
    }
  }));

  // Render the map container and overlays as siblings to avoid DOM conflicts
  // Google Maps modifies the container's children, so React overlays must be outside
  return (
    <div
      className={`rounded-lg border ${className}`}
      style={{ height, width, position: 'relative' }}
      data-testid="map-wrapper"
    >
      {/* Map container - keep empty, Google Maps will populate it */}
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        data-testid="map-container"
      />

      {/* Loading overlay - sibling to map container, not child */}
      {isLoading && (
        <div
          className="flex items-center justify-center"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          <div className="text-center">
            <Spinner size={SpinnerSize.large} label="Loading map..." />
          </div>
        </div>
      )}

      {/* Error overlay - sibling to map container, not child */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)'
          }}
        >
          <MessageBar messageBarType={MessageBarType.error} style={{ maxWidth: '90%' }}>
            {error}
          </MessageBar>
        </div>
      )}
    </div>
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;