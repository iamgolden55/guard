import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
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
  console.log('MapComponent: Rendering...');
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

  // Load Google Maps script dynamically with caching
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setError('Google Maps API key is required');
      setIsLoading(false);
      return;
    }

    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      console.log('MapComponent: Google Maps already loaded from cache');
      setGoogleMapsLoaded(true);
      setIsLoading(false);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('MapComponent: Google Maps script already loading, waiting...');
      
      // Wait for existing script to load
      const checkGoogleMaps = () => {
        if (window.google?.maps) {
          console.log('MapComponent: Google Maps loaded from existing script');
          setGoogleMapsLoaded(true);
          setIsLoading(false);
        } else {
          setTimeout(checkGoogleMaps, 100);
        }
      };
      checkGoogleMaps();
      return;
    }

    console.log('MapComponent: Loading Google Maps script...');
    
    // Create script tag with caching optimization
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=initGoogleMaps&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps-script', 'true'); // Mark for identification

    // Global callback function
    (window as any).initGoogleMaps = () => {
      console.log('MapComponent: Google Maps script loaded successfully');
      setGoogleMapsLoaded(true);
      setIsLoading(false);
      delete (window as any).initGoogleMaps;
    };

    script.onerror = () => {
      console.error('MapComponent: Failed to load Google Maps script');
      setError('Failed to load Google Maps. Please check your internet connection.');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount to allow caching
      if ((window as any).initGoogleMaps) {
        delete (window as any).initGoogleMaps;
      }
    };
  }, [apiKey]);

  // Initialize map when Google Maps is loaded and container is available
  useEffect(() => {
    console.log('MapComponent: Checking initialization conditions...', {
      googleMapsLoaded,
      hasContainer: !!mapContainerRef.current,
      hasMap: !!map
    });

    if (!googleMapsLoaded) {
      console.log('MapComponent: Waiting for Google Maps to load...');
      return;
    }

    if (!mapContainerRef.current) {
      console.log('MapComponent: Waiting for container to be available...');
      return;
    }

    if (map) {
      console.log('MapComponent: Map already exists, skipping initialization');
      return;
    }

    console.log('MapComponent: All conditions met, initializing map...');

    try {
      const mapInstance = new google.maps.Map(mapContainerRef.current, {
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

      console.log('MapComponent: Map created successfully');

      // Add click listener
      if (interactive && onLocationSelect) {
        mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const location: MapLocation = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng()
            };
            
            console.log('MapComponent: Location selected:', location);
            onLocationSelect(location);
          }
        });
      }

      setMap(mapInstance);
      onMapLoad?.(mapInstance);
      setIsLoading(false);
      console.log('MapComponent: Initialization complete');
    } catch (err) {
      console.error('MapComponent: Error creating map:', err);
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  }, [googleMapsLoaded, center, zoom, interactive, onMapLoad, onLocationSelect, map]);

  // Public methods via ref
  useImperativeHandle(ref, () => ({
    geocodeAddress: async (address: string): Promise<MapLocation | null> => {
      if (!window.google?.maps?.Geocoder) return null;
      
      try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ address });
        
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
    },
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

  console.log('MapComponent: Render state:', { isLoading, error: !!error, googleMapsLoaded, hasMap: !!map });

  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center border rounded-lg ${className}`}
        style={{ height, width, backgroundColor: '#f5f5f5' }}
      >
        <div className="text-center">
          <Spinner size={SpinnerSize.medium} />
          <div style={{ marginTop: '10px', fontSize: '14px' }}>Loading map...</div>
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
    <div style={{ position: 'relative', height, width }}>
      <div 
        ref={(el) => {
          mapContainerRef.current = el;
        }}
        className={`rounded-lg border ${className}`}
        style={{ 
          height: '100%', 
          width: '100%',
          minHeight: '300px'
        }}
      />
      {!map && googleMapsLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          🗺️ Preparing map...
        </div>
      )}
    </div>
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;