import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
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
  center = { lat: 51.4545, lng: -2.5879 },
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
  console.log('MapComponent: Starting render with props:', { 
    apiKey: apiKey ? 'PRESENT' : 'MISSING', 
    height, 
    width 
  });

  const containerRef = useRef<HTMLDivElement>(null);
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
  const initializeMap = useCallback(async () => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setError('Google Maps API key is required');
      setIsLoading(false);
      return;
    }

    if (!containerRef.current) {
      setError('Map container not available');
      setIsLoading(false);
      return;
    }

    try {
      console.log('MapComponent: Loading Google Maps API...');
      
      const loader = new Loader({
        apiKey,
        version: 'weekly',
        libraries: ['places', 'geometry']
      });

      const google = await loader.load();
      console.log('MapComponent: Google Maps API loaded successfully');

      if (!isMountedRef.current || !containerRef.current) {
        console.log('MapComponent: Component unmounted during loading');
        return;
      }

      console.log('MapComponent: Creating map instance...');
      const mapInstance = new google.maps.Map(containerRef.current, {
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

      console.log('MapComponent: Map instance created successfully');

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

            // Try to reverse geocode, but don't fail if it doesn't work
            if (geocoderRef.current) {
              try {
                const response = await geocoderRef.current.geocode({
                  location: event.latLng
                });
                
                if (response.results && response.results[0]) {
                  location.address = response.results[0].formatted_address;
                }
              } catch (error) {
                console.warn('Reverse geocoding failed:', error);
                // Continue without address
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
        console.log('MapComponent: Initialization complete');
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
  }, [apiKey, center.lat, center.lng, zoom, interactive, showCurrentLocation, onMapLoad, onLocationSelect]);

  // Initialize map when component mounts and container is available
  useEffect(() => {
    const checkAndInitialize = () => {
      if (containerRef.current) {
        console.log('MapComponent: Container found, initializing...');
        initializeMap();
      } else {
        console.log('MapComponent: Container not ready, retrying...');
        // Retry with longer delay
        setTimeout(checkAndInitialize, 200);
      }
    };

    // Start checking after initial delay
    const timer = setTimeout(checkAndInitialize, 100);
    return () => clearTimeout(timer);
  }, [initializeMap]);

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
  const geocodeAddress = useCallback(async (address: string): Promise<MapLocation | null> => {
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
  }, []);

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

  console.log('MapComponent: Rendering UI, state:', { isLoading, error: !!error });

  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center border rounded-lg ${className}`}
        style={{ height, width }}
      >
        <div className="text-center">
          <Spinner size={SpinnerSize.large} label="Loading map..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ height, width }}>
        <MessageBar messageBarType={MessageBarType.error}>
          {error}
        </MessageBar>
      </div>
    );
  }

  return (
    <div 
      ref={(el) => {
        console.log('MapComponent: Setting container ref to:', el);
        containerRef.current = el;
      }}
      className={`rounded-lg border ${className}`}
      style={{ height, width, minHeight: height }}
    >
      {/* Add a visual indicator while Google Maps loads */}
      {!map && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          textAlign: 'center',
          padding: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '4px'
        }}>
          🗺️ Initializing map...
        </div>
      )}
    </div>
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;