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
  ProgressIndicator,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  CommandBar,
  ICommandBarItemProps,
  Toggle,
  Spinner,
  SpinnerSize,
  Icon,
  mergeStyles
} from '@fluentui/react';
import MapComponent, { MapLocation, MapComponentRef } from './MapComponent.working';
import addressResolutionService, { AddressOption, AddressResolutionResult } from '../services/addressResolutionService';
import { VenueLocationData } from './VenueLocationPicker';
import { AddressValidator, AddressFallbackService } from '../utils/addressValidation';

interface IntelligentAddressPickerProps {
  apiKey: string;
  initialLocation?: VenueLocationData;
  onLocationSelect: (location: VenueLocationData) => void;
  onCancel?: () => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
}

const addressItemClass = mergeStyles({
  padding: '12px',
  borderBottom: '1px solid #e1e1e1',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  ':hover': {
    backgroundColor: '#f3f2f1'
  },
  ':last-child': {
    borderBottom: 'none'
  }
});

const selectedAddressClass = mergeStyles({
  backgroundColor: '#deecf9',
  ':hover': {
    backgroundColor: '#c7e0f4'
  }
});

const IntelligentAddressPicker: React.FC<IntelligentAddressPickerProps> = ({
  apiKey,
  initialLocation,
  onLocationSelect,
  onCancel,
  disabled = false,
  required = false,
  label = 'Venue Location',
  placeholder = 'Enter postcode or address (e.g., BS34 7HH, 829 Filton Avenue)...'
}) => {
  const [searchQuery, setSearchQuery] = useState(initialLocation?.formattedAddress || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AddressResolutionResult | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<AddressOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [validationInfo, setValidationInfo] = useState<string | null>(null);
  const [searchGuidance, setSearchGuidance] = useState<{title: string; message: string; tips: string[]} | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'initializing' | 'ready' | 'limited'>('initializing');
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(
    initialLocation ? {
      lat: initialLocation.latitude,
      lng: initialLocation.longitude,
      address: initialLocation.formattedAddress
    } : null
  );

  const mapRef = useRef<MapComponentRef>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize map after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Check if address resolution services are ready
  useEffect(() => {
    const checkServices = () => {
      if (window.google?.maps?.places?.PlacesService) {
        setServiceStatus('ready');
        console.log('IntelligentAddressPicker: Google Places service ready');
      } else if (window.google?.maps?.Geocoder) {
        // Google Maps loaded but Places not available
        setServiceStatus('limited');
        console.warn('IntelligentAddressPicker: Running in limited mode - Places API not available');
      } else {
        // Still waiting for Google Maps
        setTimeout(checkServices, 500);
      }
    };

    // Start checking after a short delay to allow Google Maps to load
    const timer = setTimeout(checkServices, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Handle search with debouncing
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const results = await addressResolutionService.resolveAddress(query);
      
      // Validate and rank results
      if (results.totalResults > 0) {
        const allAddresses = [
          ...results.exactMatches,
          ...results.postcodeExpansions,
          ...results.suggestedAlternatives
        ];
        
        const rankedAddresses = AddressValidator.rankAddressesByQuality(allAddresses);
        
        // Update results with ranked addresses
        results.exactMatches = rankedAddresses.filter(addr => 
          results.exactMatches.some(exact => exact.placeId === addr.placeId)
        );
        results.postcodeExpansions = rankedAddresses.filter(addr => 
          results.postcodeExpansions.some(postcode => postcode.placeId === addr.placeId)
        );
        results.suggestedAlternatives = rankedAddresses.filter(addr => 
          results.suggestedAlternatives.some(alt => alt.placeId === addr.placeId)
        );
      }
      
      setSearchResults(results);
      
      if (results.totalResults === 0) {
        // Try fallback resolution
        const fallbackResults = await AddressFallbackService.attemptFallbackResolution(query);
        if (fallbackResults.length > 0) {
          setSearchResults({
            ...results,
            suggestedAlternatives: fallbackResults,
            totalResults: fallbackResults.length
          });
          setError('No exact matches found. Here are some suggestions to try:');
        } else {
          const guidance = AddressFallbackService.getSearchGuidance(query);
          setSearchGuidance(guidance);
          setError(guidance.message);
        }
      } else {
        setSearchGuidance(null);
      }
    } catch (error: any) {
      console.error('Address resolution failed:', error);
      const guidance = AddressFallbackService.getSearchGuidance(query);
      setSearchGuidance(guidance);
      setError(error.message || 'Failed to search for addresses. Please try again.');
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 500);
  }, [handleSearch]);

  // Handle address selection
  const handleAddressSelect = useCallback((address: AddressOption) => {
    setSelectedAddress(address);
    setError(null);
    
    // Validate the selected address
    const validation = AddressValidator.validateAddress(address);
    const validationSummary = AddressValidator.getValidationSummary(validation);
    setValidationInfo(validationSummary);
    
    // Show warnings if needed
    if (validation.issues.length > 0) {
      const warnings = validation.issues
        .filter(issue => issue.severity === 'warning')
        .map(issue => issue.message);
      if (warnings.length > 0) {
        setError(`⚠️ ${warnings.join(' ')}`);
      }
    }
    
    const location: MapLocation = {
      lat: address.latitude,
      lng: address.longitude,
      address: address.formattedAddress
    };
    
    setSelectedLocation(location);
    updateMarker(location);
    
    // Center map on selected location
    if (mapRef.current?.panTo) {
      mapRef.current.panTo(location);
      mapRef.current.setZoom(18);
    }
  }, []);

  // Update marker on map
  const updateMarker = useCallback((location: MapLocation) => {
    if (markerRef.current) {
      markerRef.current.setPosition({ lat: location.lat, lng: location.lng });
    } else if (mapRef.current?.map) {
      markerRef.current = new google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: mapRef.current.map,
        draggable: true,
        title: 'Selected Address'
      });

      markerRef.current.addListener('dragend', (event: google.maps.MapMouseEvent) => {
        if (event.latLng && selectedAddress) {
          const newLocation: MapLocation = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
            address: selectedAddress.formattedAddress
          };
          setSelectedLocation(newLocation);
        }
      });
    }
  }, [selectedAddress]);

  // Handle map load
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    console.log('IntelligentAddressPicker: Map loaded');
    
    if (selectedLocation) {
      updateMarker(selectedLocation);
    }
  }, [selectedLocation, updateMarker]);

  // Handle confirmation
  const handleConfirmSelection = useCallback(() => {
    if (!selectedAddress || !selectedLocation) {
      setError('Please select an address from the search results.');
      return;
    }

    const locationData = addressResolutionService.convertToVenueLocationData({
      ...selectedAddress,
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng
    });

    onLocationSelect(locationData);
  }, [selectedAddress, selectedLocation, onLocationSelect]);

  // Render address option
  const renderAddressOption = (address: AddressOption, section: string) => {
    const isSelected = selectedAddress?.placeId === address.placeId;
    const confidence = Math.round(address.confidence * 100);
    
    return (
      <div
        key={`${section}-${address.placeId}`}
        className={`${addressItemClass} ${isSelected ? selectedAddressClass : ''}`}
        onClick={() => handleAddressSelect(address)}
      >
        <Stack tokens={{ childrenGap: 4 }}>
          <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
            <Text variant="medium" style={{ fontWeight: isSelected ? 600 : 400 }}>
              {address.streetNumber && address.streetName 
                ? `${address.streetNumber} ${address.streetName}`
                : address.formattedAddress
              }
            </Text>
            <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
              {address.buildingType && (
                <Icon 
                  iconName={address.buildingType === 'commercial' ? 'WorkItem' : 'Home'} 
                  style={{ fontSize: 12, color: '#666' }}
                />
              )}
              <div style={{ 
                fontSize: '10px', 
                padding: '2px 6px', 
                backgroundColor: confidence >= 80 ? '#d4edda' : confidence >= 60 ? '#fff3cd' : '#f8d7da',
                color: confidence >= 80 ? '#155724' : confidence >= 60 ? '#856404' : '#721c24',
                borderRadius: '10px',
                fontWeight: 600
              }}>
                {confidence}%
              </div>
            </Stack>
          </Stack>
          
          <Text variant="small" style={{ color: '#666' }}>
            {address.city}, {address.postalCode}
          </Text>
          
          {address.streetNumber && (
            <Text variant="xSmall" style={{ color: '#888' }}>
              House/Building Number: {address.streetNumber}
            </Text>
          )}
          
          <Text variant="xSmall" style={{ color: '#888', textTransform: 'capitalize' }}>
            Source: {address.source.replace('_', ' ')} • Type: {address.buildingType || 'Unknown'}
          </Text>
        </Stack>
      </div>
    );
  };

  // Command bar for actions
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'advancedSearch',
      text: showAdvancedSearch ? 'Hide Advanced' : 'Show Advanced',
      iconProps: { iconName: 'Settings' },
      onClick: () => setShowAdvancedSearch(!showAdvancedSearch)
    },
    {
      key: 'refresh',
      text: 'Search Again',
      iconProps: { iconName: 'Refresh' },
      onClick: () => handleSearch(searchQuery),
      disabled: searchQuery.length < 3 || isSearching
    }
  ];

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      <Label required={required}>{label}</Label>

      {/* Service Status Warning */}
      {serviceStatus === 'limited' && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          isMultiline={true}
        >
          <strong>Limited Search Mode:</strong> Google Places API is not fully available.
          Venue name searches may not work correctly. Try searching with a UK postcode instead
          (e.g., "BS34 7HH") for best results.
        </MessageBar>
      )}

      {serviceStatus === 'initializing' && (
        <MessageBar messageBarType={MessageBarType.info}>
          Initializing address search services...
        </MessageBar>
      )}

      {/* Search Input */}
      <TextField
        placeholder={placeholder}
        value={searchQuery}
        onChange={(_, value) => handleSearchInputChange(value || '')}
        disabled={disabled}
        errorMessage={error}
        description="Enter a postcode (e.g., BS34 7HH) or specific address to find exact building locations"
      />

      {isSearching && (
        <ProgressIndicator label="Searching for addresses..." />
      )}

      {/* Command Bar */}
      {searchResults && searchResults.totalResults > 0 && (
        <CommandBar items={commandBarItems} />
      )}

      {/* Search Guidance */}
      {searchGuidance && (
        <MessageBar
          messageBarType={MessageBarType.info}
          isMultiline={true}
        >
          <div>
            <Text variant="medium" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              {searchGuidance.title}
            </Text>
            <Text variant="small" style={{ display: 'block', marginBottom: '8px' }}>
              {searchGuidance.message}
            </Text>
            <ul style={{ margin: '0', paddingLeft: '16px' }}>
              {searchGuidance.tips.map((tip, index) => (
                <li key={index} style={{ marginBottom: '4px' }}>
                  <Text variant="small">{tip}</Text>
                </li>
              ))}
            </ul>
          </div>
        </MessageBar>
      )}

      {/* Advanced Search Options */}
      {showAdvancedSearch && (
        <Stack tokens={{ childrenGap: 12 }} style={{ 
          padding: '12px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          border: '1px solid #e1e1e1'
        }}>
          <Text variant="mediumPlus" style={{ fontWeight: 600 }}>Advanced Search Options</Text>
          <Text variant="small" style={{ color: '#666' }}>
            • For postcodes: Enter just the postcode (e.g., "BS34 7HH") to see all addresses in that area<br/>
            • For specific addresses: Include house number (e.g., "829 Filton Avenue BS34 7HH")<br/>
            • For buildings: Include building name (e.g., "Tesco BS34 7HH")<br/>
            • Use complete UK postcode format for best results<br/>
            • Search results are automatically ranked by accuracy and completeness
          </Text>
        </Stack>
      )}

      {/* Search Results */}
      {searchResults && searchResults.totalResults > 0 && (
        <Stack tokens={{ childrenGap: 16 }}>
          <Separator>Search Results ({searchResults.totalResults} found)</Separator>
          
          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid #e1e1e1', 
            borderRadius: '4px' 
          }}>
            {/* Exact Matches */}
            {searchResults.exactMatches.length > 0 && (
              <Stack tokens={{ childrenGap: 0 }}>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#e8f5e8', 
                  borderBottom: '1px solid #d4edda',
                  fontWeight: 600,
                  fontSize: '14px'
                }}>
                  <Icon iconName="CheckMark" style={{ marginRight: '6px', color: '#28a745' }} />
                  Exact Matches ({searchResults.exactMatches.length})
                </div>
                {searchResults.exactMatches.map(address => renderAddressOption(address, 'exact'))}
              </Stack>
            )}

            {/* Postcode Expansions */}
            {searchResults.postcodeExpansions.length > 0 && (
              <Stack tokens={{ childrenGap: 0 }}>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: searchResults.postcodeExpansions[0]?.source === 'address_validation' ? '#e8f5e8' : '#e3f2fd', 
                  borderBottom: searchResults.postcodeExpansions[0]?.source === 'address_validation' ? '1px solid #d4edda' : '1px solid #bbdefb',
                  fontWeight: 600,
                  fontSize: '14px'
                }}>
                  <Icon iconName={searchResults.postcodeExpansions[0]?.source === 'address_validation' ? 'Shield' : 'MapLayers'} 
                        style={{ marginRight: '6px', color: searchResults.postcodeExpansions[0]?.source === 'address_validation' ? '#28a745' : '#1976d2' }} />
                  {searchResults.postcodeExpansions[0]?.source === 'address_validation' ? 'Official UK Addresses' : 'Addresses in'} {searchResults.postcodeArea?.postcode} ({searchResults.postcodeExpansions.length})
                  {searchResults.postcodeExpansions[0]?.source === 'address_validation' && (
                    <div style={{ fontSize: '11px', fontWeight: 400, color: '#155724', marginTop: '2px' }}>
                      Royal Mail PAF Data - Property-level accuracy
                    </div>
                  )}
                </div>
                {searchResults.postcodeExpansions.slice(0, 50).map(address => renderAddressOption(address, 'postcode'))}
                {searchResults.postcodeExpansions.length > 50 && (
                  <div style={{ padding: '12px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                    ... and {searchResults.postcodeExpansions.length - 50} more addresses (scroll to see all)
                  </div>
                )}
              </Stack>
            )}

            {/* Alternative Suggestions */}
            {searchResults.suggestedAlternatives.length > 0 && (
              <Stack tokens={{ childrenGap: 0 }}>
                <div style={{ 
                  padding: '8px 12px', 
                  backgroundColor: '#fff3cd', 
                  borderBottom: '1px solid #ffeaa7',
                  fontWeight: 600,
                  fontSize: '14px'
                }}>
                  <Icon iconName="Lightbulb" style={{ marginRight: '6px', color: '#856404' }} />
                  Similar Addresses ({searchResults.suggestedAlternatives.length})
                </div>
                {searchResults.suggestedAlternatives.slice(0, 10).map(address => renderAddressOption(address, 'alternative'))}
              </Stack>
            )}
          </div>
        </Stack>
      )}

      {/* Selected Address Info */}
      {selectedAddress && (
        <Stack tokens={{ childrenGap: 8 }}>
          <Separator>Selected Address</Separator>
          
          {/* Validation Status */}
          {validationInfo && (
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: validationInfo.includes('✅') ? '#e8f5e8' :
                               validationInfo.includes('⚠️') ? '#fff3cd' : '#f8d7da',
              borderRadius: '4px',
              border: '1px solid ' + (validationInfo.includes('✅') ? '#d4edda' :
                                    validationInfo.includes('⚠️') ? '#ffeaa7' : '#f5c6cb'),
              marginBottom: '8px'
            }}>
              <Text variant="small" style={{ fontWeight: 600 }}>
                {validationInfo}
              </Text>
            </div>
          )}
          
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '4px',
            border: '1px solid #b3d9ff'
          }}>
            <Stack tokens={{ childrenGap: 6 }}>
              <Text style={{ fontWeight: 600 }}>
                {selectedAddress.streetNumber && selectedAddress.streetName 
                  ? `${selectedAddress.streetNumber} ${selectedAddress.streetName}`
                  : selectedAddress.formattedAddress
                }
              </Text>
              <Text variant="small">
                {selectedAddress.city}, {selectedAddress.postalCode}, {selectedAddress.country}
              </Text>
              <Text variant="xSmall" style={{ color: '#666' }}>
                Coordinates: {selectedAddress.latitude.toFixed(6)}, {selectedAddress.longitude.toFixed(6)}
              </Text>
              <Text variant="xSmall" style={{ color: '#666' }}>
                Source: {selectedAddress.source.replace('_', ' ')} • Confidence: {Math.round(selectedAddress.confidence * 100)}%
              </Text>
              {selectedLocation && (selectedLocation.lat !== selectedAddress.latitude || selectedLocation.lng !== selectedAddress.longitude) && (
                <Text variant="xSmall" style={{ color: '#d63384' }}>
                  Location adjusted by dragging marker: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                </Text>
              )}
            </Stack>
          </div>
        </Stack>
      )}

      {/* Map */}
      {selectedAddress && (
        <Stack tokens={{ childrenGap: 8 }}>
          <Separator>Location Verification</Separator>
          <Text variant="small" style={{ color: '#666' }}>
            Verify the location on the map. You can drag the marker to fine-tune the position.
          </Text>
          
          <div style={{ minHeight: '300px' }}>
            {!isMapReady ? (
              <div className="flex items-center justify-center h-64 bg-gray-100 rounded border">
                <div className="text-center">
                  <Spinner size={SpinnerSize.medium} />
                  <div style={{ marginTop: '8px' }}>Loading map...</div>
                </div>
              </div>
            ) : (
              <div style={{ height: '300px', width: '100%' }}>
                <MapComponent
                  ref={mapRef}
                  apiKey={apiKey}
                  center={selectedLocation || { lat: selectedAddress.latitude, lng: selectedAddress.longitude }}
                  zoom={18}
                  height="280px"
                  onMapLoad={handleMapLoad}
                  interactive={!disabled}
                />
              </div>
            )}
          </div>
        </Stack>
      )}

      {/* Action Buttons */}
      <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }}>
        {selectedAddress && (
          <DefaultButton
            text="Clear Selection"
            onClick={() => {
              setSelectedAddress(null);
              setSelectedLocation(null);
              setSearchResults(null);
              if (markerRef.current) {
                markerRef.current.setMap(null);
                markerRef.current = null;
              }
            }}
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
          text="Confirm Address"
          onClick={handleConfirmSelection}
          disabled={disabled || !selectedAddress || isSearching}
          iconProps={{ iconName: 'CheckMark' }}
        />
      </Stack>

      {/* Help Text */}
      <div style={{ 
        padding: '8px 12px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        borderLeft: '4px solid #007acc'
      }}>
        <Text variant="xSmall" style={{ color: '#666' }}>
          <strong>💡 Tips:</strong> Enter a UK postcode (e.g., "BS10 6SH") to see all specific addresses including house numbers like "31 Marlwood Drive", "41 Marlwood Drive". 
          This system uses Royal Mail PAF data for property-level accuracy, ensuring staff can check-in at the exact location.
        </Text>
      </div>
    </Stack>
  );
};

export default IntelligentAddressPicker;