import React, { forwardRef } from 'react';

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
  onMapLoad?: (map: any) => void;
  onLocationSelect?: (location: MapLocation) => void;
  markers?: MapLocation[];
  interactive?: boolean;
  showCurrentLocation?: boolean;
}

export interface MapComponentRef {
  geocodeAddress: (address: string) => Promise<MapLocation | null>;
  map: any;
  panTo: (location: MapLocation) => void;
  setZoom: (zoomLevel: number) => void;
}

const SimpleMapComponent = forwardRef<MapComponentRef, MapComponentProps>(({
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
  console.log('SimpleMapComponent: Rendering with props:', { 
    apiKey: apiKey ? 'PRESENT' : 'MISSING', 
    height, 
    width,
    center,
    zoom
  });
  
  return (
    <div 
      className={`rounded-lg border ${className}`}
      style={{ 
        height, 
        width, 
        backgroundColor: '#e3f2fd',
        border: '2px solid #1976d2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '20px'
      }}
    >
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
        🗺️ Simple Map Component
      </div>
      <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
        <div>API Key: {apiKey ? 'LOADED' : 'MISSING'}</div>
        <div>Center: {center.lat.toFixed(4)}, {center.lng.toFixed(4)}</div>
        <div>Size: {width} x {height}</div>
        <div>Zoom: {zoom}</div>
        <div>Interactive: {interactive ? 'Yes' : 'No'}</div>
      </div>
      {interactive && (
        <button 
          style={{ 
            marginTop: '10px', 
            padding: '5px 10px', 
            backgroundColor: '#1976d2', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => {
            console.log('Test click - selecting center location');
            onLocationSelect?.(center);
          }}
        >
          Test Select Location
        </button>
      )}
    </div>
  );
});

SimpleMapComponent.displayName = 'SimpleMapComponent';

export default SimpleMapComponent;