import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Stack,
  TextField,
  PrimaryButton,
  DefaultButton,
  Text,
  MessageBar,
  MessageBarType,
  Label,
  Separator,
  ProgressIndicator
} from '@fluentui/react';
import MapComponent, { MapLocation, MapComponentRef } from './MapComponent.working';

export interface VenueLocationData {
  address: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  postalCode?: string;
  placeId?: string;
}

interface VenueLocationPickerProps {
  apiKey: string;
  initialLocation?: VenueLocationData;
  onLocationSelect: (location: VenueLocationData) => void;
  onCancel?: () => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
}

const VenueLocationPicker: React.FC<VenueLocationPickerProps> = ({
  apiKey,
  initialLocation,
  onLocationSelect,
  onCancel,
  disabled = false,
  required = false,
  label = 'Venue Location',
  placeholder = 'Enter venue address...'
}) => {
  const [searchAddress, setSearchAddress] = useState(initialLocation?.address || '');
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(
    initialLocation ? {
      lat: initialLocation.latitude,
      lng: initialLocation.longitude,
      address: initialLocation.formattedAddress
    } : null
  );
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  
  const mapRef = useRef<MapComponentRef>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  // Delay map initialization for Panel components
  useEffect(() => {
    console.log('VenueLocationPicker: Starting initialization delay...');
    const timer = setTimeout(() => {
      console.log('VenueLocationPicker: Map initialization delay complete, showing map');
      setIsMapReady(true);
    }, 1000); // Increased delay for Panel components
    
    return () => clearTimeout(timer);
  }, []);

  // Initialize Places API services after Google Maps loads
  useEffect(() => {
    const initializePlacesAPI = async () => {
      try {
        // Wait for Google Maps to be fully loaded
        let attempts = 0;
        const maxAttempts = 10;
        
        const waitForGoogleMaps = () => {
          if (window.google?.maps?.places?.AutocompleteService) {
            // Note: AutocompleteService is deprecated as of March 1, 2025
            // but still functional. In the future, migrate to AutocompleteSuggestion
            autocompleteService.current = new google.maps.places.AutocompleteService();
            console.log('Places API initialized successfully (using legacy AutocompleteService)');
          } else {
            attempts++;
            if (attempts < maxAttempts) {
              console.log(`Places API not ready yet, retrying... (${attempts}/${maxAttempts})`);
              setTimeout(waitForGoogleMaps, 500);
            } else {
              console.warn('Places API not available after multiple attempts - autocomplete will be disabled');
            }
          }
        };
        
        waitForGoogleMaps();
      } catch (error) {
        console.warn('Error initializing Places API (this may be due to API restrictions):', error);
      }
    };

    // Start checking after a short delay
    const timer = setTimeout(initializePlacesAPI, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Reverse geocode a location (moved before handleMapLoad)
  const reverseGeocode = useCallback(async (location: MapLocation) => {
    setIsGeocoding(true);
    setError(null);

    try {
      if (window.google?.maps?.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({
          location: { lat: location.lat, lng: location.lng }
        });

        if (response.results && response.results[0]) {
          const updatedLocation: MapLocation = {
            ...location,
            address: response.results[0].formatted_address
          };
          
          setSelectedLocation(updatedLocation);
          setSearchAddress(response.results[0].formatted_address);
        } else {
          // Fallback: just use coordinates without address
          setSelectedLocation(location);
          setSearchAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
        }
      } else {
        // Geocoder not available, just use coordinates
        setSelectedLocation(location);
        setSearchAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
      }
    } catch (error) {
      console.warn('Reverse geocoding failed (this may be due to API key restrictions):', error);
      // Fallback: use coordinates as address
      setSelectedLocation(location);
      setSearchAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Handle map load to initialize places service
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    console.log('VenueLocationPicker: Map loaded successfully');
    try {
      placesService.current = new google.maps.places.PlacesService(map);
      
      // Add initial marker if we have a location
      if (selectedLocation) {
        console.log('Adding initial marker at:', selectedLocation);
        markerRef.current = new google.maps.Marker({
          position: { lat: selectedLocation.lat, lng: selectedLocation.lng },
          map,
          draggable: true,
          title: 'Venue Location (Drag to adjust)'
        });

        // Handle marker drag
        markerRef.current.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const newLocation: MapLocation = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng()
            };
            
            // Reverse geocode the new position
            await reverseGeocode(newLocation);
          }
        });
      }
    } catch (error) {
      console.error('Error initializing places service:', error);
    }
  }, [selectedLocation, reverseGeocode]);

  // Handle address search with autocomplete
  const handleAddressSearch = useCallback(async (value: string) => {
    setSearchAddress(value);
    setError(null);

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (autocompleteService.current) {
      try {
        const request: google.maps.places.AutocompletionRequest = {
          input: value,
          types: ['establishment', 'geocode'],
          componentRestrictions: { country: 'GB' } // Restrict to UK for now
        };

        autocompleteService.current.getPlacePredictions(
          request,
          (predictions, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
              setSuggestions(predictions);
              setShowSuggestions(true);
            } else {
              console.warn('Places autocomplete failed:', status);
              if (status === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
                console.warn('Places API access denied - this may be due to API key restrictions');
              }
              setSuggestions([]);
              setShowSuggestions(false);
            }
          }
        );
      } catch (error) {
        console.warn('Autocomplete error (this may be due to API restrictions):', error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  }, []);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(async (prediction: google.maps.places.AutocompletePrediction) => {
    setSearchAddress(prediction.description);
    setShowSuggestions(false);
    setSuggestions([]);
    setIsGeocoding(true);
    setError(null);

    if (placesService.current && prediction.place_id) {
      try {
        const request: google.maps.places.PlaceDetailsRequest = {
          placeId: prediction.place_id,
          fields: ['geometry', 'formatted_address', 'name', 'place_id']
        };

        placesService.current.getDetails(request, (place, status) => {
          setIsGeocoding(false);
          
          if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const location: MapLocation = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              address: place.formatted_address || prediction.description
            };

            setSelectedLocation(location);
            updateMarker(location);
            
            // Pan map to location
            if (mapRef.current?.panTo) {
              mapRef.current.panTo(location);
              mapRef.current.setZoom(16);
            }
          } else {
            setError('Could not find location details. Please try a different address.');
          }
        });
      } catch (error) {
        setIsGeocoding(false);
        setError('Error searching for location. Please try again.');
        console.error('Places details error:', error);
      }
    }
  }, []);


  // Update marker position
  const updateMarker = useCallback((location: MapLocation) => {
    if (markerRef.current) {
      markerRef.current.setPosition({ lat: location.lat, lng: location.lng });
    } else if (mapRef.current?.map) {
      // Create new marker
      markerRef.current = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapRef.current.map,
        draggable: true,
        title: 'Venue Location (Drag to adjust)'
      });

      // Handle marker drag
      if (markerRef.current) {
        markerRef.current.addListener('dragend', async (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            const newLocation: MapLocation = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng()
            };
            
            await reverseGeocode(newLocation);
          }
        });
      }
    }
  }, [reverseGeocode]);

  // Handle map click
  const handleMapLocationSelect = useCallback(async (location: MapLocation) => {
    setSelectedLocation(location);
    updateMarker(location);
    
    // Update search field with address if available
    if (location.address) {
      setSearchAddress(location.address);
    } else {
      // Reverse geocode to get address
      await reverseGeocode(location);
    }
  }, [reverseGeocode, updateMarker]);

  // Handle form submission
  const handleConfirmLocation = useCallback(() => {
    if (!selectedLocation) {
      setError('Please select a location on the map or search for an address.');
      return;
    }

    // Parse the formatted address to extract components
    const fullAddress = selectedLocation.address || searchAddress;
    const addressParts = fullAddress.split(', ');
    
    // Try to extract city and postal code from the address
    let streetAddress = '';
    let city = '';
    let postalCode = '';
    
    console.log('VenueLocationPicker: Parsing address parts:', addressParts);
    
    if (addressParts.length > 0) {
      // First part is usually the street address
      streetAddress = addressParts[0];
      
      // Look for postal code (UK format: letters and numbers)
      const ukPostalCodeRegex = /\b[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}\b/gi;
      let postalCodeIndex = -1;
      
      // Find postal code in the address parts (can be within a part)
      for (let i = 0; i < addressParts.length; i++) {
        const part = addressParts[i].trim();
        const match = part.match(ukPostalCodeRegex);
        if (match) {
          postalCodeIndex = i;
          postalCode = match[0].toUpperCase();
          console.log('Found postal code:', postalCode, 'in part:', part);
          break;
        }
      }
      
      // If not found in parts, try the full address
      if (!postalCode) {
        const fullMatch = fullAddress.match(ukPostalCodeRegex);
        if (fullMatch) {
          postalCode = fullMatch[0].toUpperCase();
          console.log('Found postal code in full address:', postalCode);
        }
      }
      
      // Look for city - find "Bristol" or other common city names
      const cityKeywords = ['Bristol', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Sheffield', 'Newcastle'];
      let cityIndex = -1;
      
      for (let i = 0; i < addressParts.length; i++) {
        const part = addressParts[i].trim();
        if (cityKeywords.some(keyword => part.toLowerCase().includes(keyword.toLowerCase()))) {
          cityIndex = i;
          // Extract just the city name, not including postal code
          const cityMatch = cityKeywords.find(keyword => part.toLowerCase().includes(keyword.toLowerCase()));
          if (cityMatch) {
            city = cityMatch;
          } else {
            city = part;
          }
          break;
        }
      }
      
      // Fallback: if no city found with keywords, try to find it relative to postal code
      if (!city && postalCodeIndex > 0) {
        // Look for city before postal code
        for (let i = postalCodeIndex - 1; i >= 0; i--) {
          const part = addressParts[i].trim();
          // Skip "UK" and very short parts
          if (part !== 'UK' && part.length > 2 && !ukPostalCodeRegex.test(part)) {
            city = part;
            break;
          }
        }
      }
      
      // Final fallback: if still no city, use a reasonable part
      if (!city && addressParts.length > 2) {
        // Try the second-to-last part (before country)
        const candidate = addressParts[addressParts.length - 2]?.trim();
        if (candidate && candidate !== 'UK' && !ukPostalCodeRegex.test(candidate)) {
          city = candidate;
        }
      }
    }
    
    console.log('VenueLocationPicker: Parsed components:', {
      streetAddress,
      city,
      postalCode,
      fullAddress
    });

    const locationData: VenueLocationData = {
      address: streetAddress || searchAddress,
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      formattedAddress: fullAddress,
      city: city,
      postalCode: postalCode
    };

    console.log('VenueLocationPicker: Confirming location with parsed data:', locationData);
    onLocationSelect(locationData);
  }, [selectedLocation, searchAddress, onLocationSelect]);

  // Clear selection
  const handleClear = useCallback(() => {
    setSelectedLocation(null);
    setSearchAddress('');
    setError(null);
    
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
  }, []);

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      <Label required={required}>{label}</Label>
      
      {/* Address Search */}
      <Stack tokens={{ childrenGap: 8 }}>
        <TextField
          placeholder={placeholder}
          value={searchAddress}
          onChange={(_, value) => handleAddressSearch(value || '')}
          disabled={disabled || isGeocoding}
          errorMessage={error}
        />
        
        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="relative">
            <div className="absolute top-0 left-0 right-0 bg-white border border-gray-300 rounded shadow-lg z-10 max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.place_id || index}
                  className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSuggestionSelect(suggestion)}
                >
                  <div className="font-medium text-sm">{suggestion.structured_formatting.main_text}</div>
                  <div className="text-xs text-gray-600">{suggestion.structured_formatting.secondary_text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Stack>

      {isGeocoding && (
        <ProgressIndicator label="Searching for location..." />
      )}

      {/* Map */}
      <Stack tokens={{ childrenGap: 8 }}>
        <Separator>Location Map</Separator>
        <Text variant="small" className="text-gray-600">
          Search for an address above or click on the map to select a location. 
          {selectedLocation && ' Drag the marker to fine-tune the position.'}
        </Text>
        
        {/* Add a small delay before showing map to ensure Panel DOM is ready */}
        <div style={{ minHeight: '400px' }}>
          {!isMapReady ? (
            <div className="flex items-center justify-center h-96 bg-gray-100 rounded border">
              <div className="text-center">
                <div className="mb-2">🗺️</div>
                <div>Preparing map...</div>
              </div>
            </div>
          ) : (
            <div style={{ height: '400px', width: '100%' }}>
              <MapComponent
                ref={mapRef}
                apiKey={apiKey}
                center={selectedLocation || { lat: 51.4545, lng: -2.5879 }}
                zoom={selectedLocation ? 16 : 13}
                height="380px"
                onMapLoad={handleMapLoad}
                onLocationSelect={handleMapLocationSelect}
                interactive={!disabled}
              />
            </div>
          )}
        </div>
      </Stack>

      {/* Selected Location Info */}
      {selectedLocation && (
        <Stack tokens={{ childrenGap: 8 }}>
          <Separator>Selected Location</Separator>
          <div className="bg-blue-50 p-3 rounded-lg">
            <Text><strong>Address:</strong> {selectedLocation.address || searchAddress}</Text>
            <Text><strong>Coordinates:</strong> {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}</Text>
          </div>
        </Stack>
      )}

      {/* Action Buttons */}
      <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
        {selectedLocation && (
          <DefaultButton
            text="Clear"
            onClick={handleClear}
            disabled={disabled}
            iconProps={{ iconName: 'Clear' }}
          />
        )}
        
        {onCancel && (
          <DefaultButton
            text="Cancel"
            onClick={onCancel}
            disabled={disabled}
          />
        )}
        
        <PrimaryButton
          text="Confirm Location"
          onClick={handleConfirmLocation}
          disabled={disabled || !selectedLocation || isGeocoding}
          iconProps={{ iconName: 'CheckMark' }}
        />
      </Stack>
    </Stack>
  );
};

export default VenueLocationPicker;