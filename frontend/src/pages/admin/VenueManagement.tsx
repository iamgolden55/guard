import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import venueService from '../../services/venueService';
import authService from '../../services/authService';
import { Venue as ApiVenue } from '../../types/venue';
import {
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  type IColumn,
  CommandBar,
  type ICommandBarItemProps,
  SearchBox,
  Stack,
  Text,
  StackItem,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Link,
  Dialog,
  DialogType,
  TextField,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  Toggle,
  Panel,
  PanelType,
  Label,
  type IIconProps
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { VenueLocationPicker, VenueLocationDisplay } from '../../components';
import IntelligentAddressPicker from '../../components/IntelligentAddressPicker';
import type { VenueLocationData } from '../../components/VenueLocationPicker';

// Icons
const addIcon: IIconProps = { iconName: 'Add' };
const refreshIcon: IIconProps = { iconName: 'Refresh' };

// Define local interface for UI venues (using camelCase)
interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  hasFireSafetyRequirements: boolean; // maps to requires_fire_safety_checks
  requiresCapacityMonitoring: boolean;
  requiresToiletChecks: boolean;
  description: string;
  termsAndConditions: string;
}

// Convert API venue to UI venue format
const mapToUiVenue = (apiVenue: ApiVenue): Venue => ({
  id: apiVenue.id || 0,
  name: apiVenue.name,
  address: apiVenue.address,
  city: apiVenue.city,
  postalCode: apiVenue.postal_code,
  latitude: apiVenue.latitude,
  longitude: apiVenue.longitude,
  capacity: apiVenue.capacity,
  contactName: apiVenue.contact_name,
  contactEmail: apiVenue.contact_email,
  contactPhone: apiVenue.contact_phone,
  isActive: apiVenue.is_active,
  hasFireSafetyRequirements: apiVenue.requires_fire_safety_checks,
  requiresCapacityMonitoring: apiVenue.requires_capacity_monitoring,
  requiresToiletChecks: apiVenue.requires_toilet_checks,
  description: apiVenue.description,
  termsAndConditions: apiVenue.terms_and_conditions
});

// Convert UI venue to API venue format
const mapToApiVenue = (uiVenue: Venue): ApiVenue => ({
  name: uiVenue.name,
  address: uiVenue.address,
  city: uiVenue.city,
  postal_code: uiVenue.postalCode,
  latitude: uiVenue.latitude,
  longitude: uiVenue.longitude,
  country: 'United Kingdom', // Default to UK
  is_active: uiVenue.isActive,
  capacity: uiVenue.capacity,
  contact_name: uiVenue.contactName,
  contact_email: uiVenue.contactEmail,
  contact_phone: uiVenue.contactPhone,
  description: uiVenue.description,
  terms_and_conditions: uiVenue.termsAndConditions,
  requires_fire_safety_checks: uiVenue.hasFireSafetyRequirements,
  requires_capacity_monitoring: uiVenue.requiresCapacityMonitoring,
  requires_toilet_checks: uiVenue.requiresToiletChecks
});

const VenueManagement: React.FC = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [showAddVenuePanel, setShowAddVenuePanel] = useState(false);
  const [showEditVenuePanel, setShowEditVenuePanel] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [useIntelligentPicker, setUseIntelligentPicker] = useState(true);
  
  // Google Maps API key from environment variables
  const [googleMapsApiKey] = useState(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
    console.log('Google Maps API Key loaded:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT_FOUND');
    return apiKey;
  });
  const [selectedLocation, setSelectedLocation] = useState<VenueLocationData | null>(null);

  // Form state for new/edit venue
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    capacity: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    isActive: true,
    hasFireSafetyRequirements: true,
    requiresCapacityMonitoring: true,
    requiresToiletChecks: true,
    description: '', // Added description field
    termsAndConditions: '' // Added terms and conditions field
  });

  // Add state for auth issues
  const [hasAuthIssue, setHasAuthIssue] = useState(false);

  // Set up columns for the DetailsList
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Name',
      fieldName: 'name',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
    },
    {
      key: 'address',
      name: 'Address',
      fieldName: 'address',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: Venue) => <Text>{`${item.address}, ${item.city}, ${item.postalCode}`}</Text>,
    },
    {
      key: 'capacity',
      name: 'Capacity',
      fieldName: 'capacity',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
    },
    {
      key: 'contact',
      name: 'Contact',
      fieldName: 'contactName',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: Venue) => (
        <div>
          <div>{item.contactName}</div>
          <div className="text-xs text-gray-500">{item.contactEmail}</div>
        </div>
      ),
    },
    {
      key: 'description',
      name: 'Description',
      fieldName: 'description',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: Venue) => (
        <div>
          {item.description ?
            item.description.length > 50 ?
              `${item.description.substring(0, 50)}...` : item.description
            : 'No description'}
        </div>
      ),
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'isActive',
      minWidth: 80,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: Venue) => (
        <div
          style={{
            backgroundColor: item.isActive ? '#10B981' : '#9CA3AF',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'inline-block',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}
        >
          {item.isActive ? 'Active' : 'Inactive'}
        </div>
      ),
    },
    {
      key: 'requirements',
      name: 'Checks Required',
      minWidth: 120,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: Venue) => (
        <div className="text-xs">
          {item.hasFireSafetyRequirements && <div>• Fire safety</div>}
          {item.requiresCapacityMonitoring && <div>• Capacity</div>}
          {item.requiresToiletChecks && <div>• Toilets</div>}
        </div>
      ),
    },
    {
      key: 'location',
      name: 'Location',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: Venue) => (
        <div style={{ height: '120px', width: '200px' }}>
          {item.latitude && item.longitude && googleMapsApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' ? (
            <VenueLocationDisplay
              apiKey={googleMapsApiKey}
              venue={{
                id: item.id,
                name: item.name,
                address: `${item.address}, ${item.city}, ${item.postalCode}`,
                latitude: item.latitude,
                longitude: item.longitude
              }}
              height="120px"
              width="200px"
              showAddress={false}
              showDirections={false}
              className="border rounded"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded border text-xs text-gray-500">
              {googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' 
                ? '🔑 Map API key needed' 
                : '📍 No coordinates set'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: Venue) => (
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <Link onClick={() => handleEditVenue(item)}>
            Edit
          </Link>
          <Link onClick={() => handleToggleStatus(item)}>
            {item.isActive ? 'Deactivate' : 'Activate'}
          </Link>
          <Link onClick={() => handleDeleteVenue(item)}>
            Delete
          </Link>
        </Stack>
      ),
    },
  ];

  // Function to handle authentication issues
  const handleLogout = useCallback(async () => {
    console.log('Manual logout triggered');
    // Sprint 3: Use authService for cookie-based authentication
    try {
      await authService.logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      window.location.href = '/login';
    }
  }, []);

  // Load venues from API - using useCallback to avoid dependency issues in useEffect
  const loadVenues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHasAuthIssue(false);

    try {
      console.log('Attempting to fetch venues...');

      // Sprint 3: Cookie-based authentication - no need to check localStorage token
      // Use the venue service to fetch venues
      const apiVenues = await venueService.getAllVenues();
      console.log('API response received:', apiVenues);

      if (!apiVenues || apiVenues.length === 0) {
        console.log('No venues returned from API');
        // This is not an error - just an empty state
        setVenues([]);
        setFilteredVenues([]);
      } else {
        const uiVenues = apiVenues.map(mapToUiVenue);
        console.log('Mapped venues to UI format:', uiVenues);
        setVenues(uiVenues);
        setFilteredVenues(uiVenues);
      }
    } catch (error: any) {
      console.error('Error fetching venues:', error);
      
      // More detailed error reporting
      if (error.response) {
        // Server responded with an error status
        console.error('Server error:', error.response.status, error.response.data);
        
        if (error.response.status === 401) {
          // Sprint 3: Authentication error - cookie may be expired
          console.error('Authentication error. Session may be expired.');

          setError('Your session has expired. Please log in again.');
          setHasAuthIssue(true);
        } else {
          setError(`Server error (${error.response.status}): ${error.response.data?.message || 'Failed to load venues'}`);
        }
      } else if (error.request) {
        // Request was made but no response received - network error
        console.error('Network error, no response received:', error.request);
        setError('Network error. Please check your connection and try again.');
      } else {
        // Something else happened while setting up the request
        console.error('Error setting up request:', error.message);
        setError(`Unexpected error: ${error.message}`);
        
        // If the error message suggests auth issues
        if (error.message.includes('Authentication') || error.message.includes('token')) {
          setHasAuthIssue(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler functions
  const handleEditVenue = useCallback((venue: Venue) => {
    setSelectedVenue(venue);
    setFormData({
      name: venue.name,
      address: venue.address,
      city: venue.city,
      postalCode: venue.postalCode,
      capacity: venue.capacity.toString(),
      contactName: venue.contactName,
      contactEmail: venue.contactEmail,
      contactPhone: venue.contactPhone,
      isActive: venue.isActive,
      hasFireSafetyRequirements: venue.hasFireSafetyRequirements,
      requiresCapacityMonitoring: venue.requiresCapacityMonitoring,
      requiresToiletChecks: venue.requiresToiletChecks,
      description: venue.description,
      termsAndConditions: venue.termsAndConditions
    });
    
    // Set location data if available
    if (venue.latitude && venue.longitude) {
      setSelectedLocation({
        address: `${venue.address}, ${venue.city}, ${venue.postalCode}`,
        latitude: venue.latitude,
        longitude: venue.longitude,
        formattedAddress: `${venue.address}, ${venue.city}, ${venue.postalCode}`,
        city: venue.city,
        postalCode: venue.postalCode
      });
    } else {
      setSelectedLocation(null);
    }
    
    setShowEditVenuePanel(true);
  }, []);

  const handleToggleStatus = useCallback(async (venue: Venue) => {
    try {
      // Call the API to update venue status
      await venueService.updateVenueStatus(venue.id, !venue.isActive);
      
      // Update local state
      const updatedVenues = venues.map(v =>
        v.id === venue.id ? { ...v, isActive: !v.isActive } : v
      );
      
      setVenues(updatedVenues);
      setFilteredVenues(updatedVenues);
    } catch (error) {
      console.error('Failed to update venue status:', error);
      setError('Failed to update venue status. Please try again.');
    }
  }, [venues]);

  const handleDeleteVenue = useCallback((venue: Venue) => {
    setSelectedVenue(venue);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteVenue = useCallback(async () => {
    if (!selectedVenue) return;

    try {
      // Call the API to delete the venue
      await venueService.deleteVenue(selectedVenue.id);
      
      // Update local state
      const updatedVenues = venues.filter(v => v.id !== selectedVenue.id);
      setVenues(updatedVenues);
      setFilteredVenues(updatedVenues);
      setShowDeleteDialog(false);
      setSelectedVenue(null);
    } catch (error) {
      console.error('Failed to delete venue:', error);
      setError('Failed to delete venue. Please try again.');
    }
  }, [selectedVenue, venues]);

  const handleAddVenue = useCallback(() => {
    setFormData({
      name: '',
      address: '',
      city: '',
      postalCode: '',
      capacity: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      isActive: true,
      hasFireSafetyRequirements: true,
      requiresCapacityMonitoring: true,
      requiresToiletChecks: true,
      description: '',
      termsAndConditions: ''
    });
    setSelectedLocation(null);
    setShowAddVenuePanel(true);
  }, []);

  const handleSubmitNewVenue = useCallback(async () => {
    try {
      // Validate capacity is a number
      const capacity = Number.parseInt(formData.capacity);
      if (Number.isNaN(capacity)) {
        setError('Capacity must be a valid number');
        return;
      }

      // Create venue object from form data
      const newApiVenue: ApiVenue = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        country: 'United Kingdom', // Default to UK
        is_active: formData.isActive,
        capacity: capacity,
        contact_name: formData.contactName,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone,
        description: formData.description,
        terms_and_conditions: formData.termsAndConditions,
        requires_fire_safety_checks: formData.hasFireSafetyRequirements,
        requires_capacity_monitoring: formData.requiresCapacityMonitoring,
        requires_toilet_checks: formData.requiresToiletChecks
      };

      // Call API to create venue
      const createdVenue = await venueService.createVenue(newApiVenue);
      
      // Map to UI format and update state
      const newUiVenue = mapToUiVenue(createdVenue);
      const updatedVenues = [...venues, newUiVenue];
      setVenues(updatedVenues);
      setFilteredVenues(updatedVenues);
      setShowAddVenuePanel(false);
    } catch (error) {
      console.error('Failed to add venue:', error);
      setError('Failed to add venue. Please try again.');
    }
  }, [formData, venues]);

  const handleUpdateVenue = useCallback(async () => {
    if (!selectedVenue) return;

    try {
      // Validate capacity is a number
      const capacity = Number.parseInt(formData.capacity);
      if (Number.isNaN(capacity)) {
        setError('Capacity must be a valid number');
        return;
      }

      // Create venue object from form data
      const updatedApiVenue: ApiVenue = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        country: 'United Kingdom', // Default to UK
        is_active: formData.isActive,
        capacity: capacity,
        contact_name: formData.contactName,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone,
        description: formData.description,
        terms_and_conditions: formData.termsAndConditions,
        requires_fire_safety_checks: formData.hasFireSafetyRequirements,
        requires_capacity_monitoring: formData.requiresCapacityMonitoring,
        requires_toilet_checks: formData.requiresToiletChecks
      };

      console.log('VenueManagement: Updating venue with coordinates:', {
        selectedLocation: selectedLocation,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude
      });

      // Call API to update venue
      await venueService.updateVenue(selectedVenue.id, updatedApiVenue);
      
      // Update local state
      const updatedUiVenue = {
        ...selectedVenue,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        capacity: capacity,
        contactName: formData.contactName,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        isActive: formData.isActive,
        hasFireSafetyRequirements: formData.hasFireSafetyRequirements,
        requiresCapacityMonitoring: formData.requiresCapacityMonitoring,
        requiresToiletChecks: formData.requiresToiletChecks,
        description: formData.description,
        termsAndConditions: formData.termsAndConditions
      };
      
      const updatedVenues = venues.map(v => 
        v.id === selectedVenue.id ? updatedUiVenue : v
      );
      
      setVenues(updatedVenues);
      setFilteredVenues(updatedVenues);
      setShowEditVenuePanel(false);
      setSelectedVenue(null);
    } catch (error) {
      console.error('Failed to update venue:', error);
      setError('Failed to update venue. Please try again.');
    }
  }, [selectedVenue, formData, venues]);

  const handleRefresh = useCallback(() => {
    console.log('Manual refresh triggered');
    loadVenues();
  }, [loadVenues]);

  const handleFormInputChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handler for location selection
  const handleLocationSelect = useCallback((location: VenueLocationData) => {
    console.log('VenueManagement: handleLocationSelect called with:', location);
    setSelectedLocation(location);
    
    // Always update address fields when location is confirmed
    if (location.address) {
      // Use the dedicated city and postalCode fields from location data if available
      // Otherwise fall back to parsing the formatted address
      let city = location.city || '';
      let postalCode = location.postalCode || '';
      
      // Fallback to parsing formattedAddress if city/postalCode not provided
      if (!city || !postalCode) {
        const addressParts = location.formattedAddress.split(', ');
        if (!postalCode) {
          postalCode = addressParts[addressParts.length - 1] || '';
        }
        if (!city) {
          city = addressParts[addressParts.length - 2] || '';
        }
      }
      
      console.log('VenueManagement: Updating form data with:', {
        address: location.address,
        city: city,
        postalCode: postalCode
      });
      
      setFormData(prev => ({
        ...prev,
        address: location.address,
        city: city,
        postalCode: postalCode
      }));
    }
  }, []);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'addVenue',
      text: 'Add Venue',
      iconProps: addIcon,
      onClick: handleAddVenue,
    },
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: refreshIcon,
      onClick: handleRefresh,
    },
  ];

  // Apply search filter when searchText changes
  useEffect(() => {
    if (!searchText) {
      setFilteredVenues(venues);
      return;
    }

    const lowerCaseSearch = searchText.toLowerCase();
    const filtered = venues.filter(venue =>
      venue.name.toLowerCase().includes(lowerCaseSearch) ||
      venue.city.toLowerCase().includes(lowerCaseSearch) ||
      venue.contactName.toLowerCase().includes(lowerCaseSearch)
    );

    setFilteredVenues(filtered);
  }, [searchText, venues]);

  // Load venues when component mounts
  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  // Validate form
  const isFormValid = () => {
    return (
      formData.name.trim() !== '' &&
      formData.address.trim() !== '' &&
      formData.city.trim() !== '' &&
      formData.postalCode.trim() !== '' &&
      formData.capacity.trim() !== '' &&
      !Number.isNaN(Number.parseInt(formData.capacity)) &&
      formData.contactName.trim() !== '' &&
      formData.contactEmail.trim() !== '' &&
      formData.contactPhone.trim() !== '' &&
      formData.termsAndConditions.trim() !== '' // Make terms and conditions required
    );
  };

  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 20 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Venue Management</Text>
        </Stack>

        <CommandBar items={commandBarItems} />

        <SearchBox
          placeholder="Search by name, city, or contact person"
          onChange={(_, newValue) => setSearchText(newValue || '')}
          onClear={() => setSearchText('')}
          value={searchText}
        />

        {/* Show auth error message with logout button if needed */}
        {hasAuthIssue && (
          <MessageBar
            messageBarType={MessageBarType.severeWarning}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            actions={
              <div>
                <DefaultButton onClick={handleLogout}>Log Out & Sign In Again</DefaultButton>
              </div>
            }
          >
            Authentication issue detected. Please sign out and sign back in to resolve this problem.
          </MessageBar>
        )}

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setError(null)}
          >
            {error}
          </MessageBar>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size={SpinnerSize.large} label="Loading venues..." />
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Text variant="large">No venues found</Text>
            <Text>Adjust your search criteria or add a new venue.</Text>
          </div>
        ) : (
          <DetailsList
            items={filteredVenues}
            columns={columns}
            layoutMode={DetailsListLayoutMode.justified}
            selectionMode={SelectionMode.none}
          />
        )}
      </Stack>

      {/* Add Venue Panel */}
      <Panel
        isOpen={showAddVenuePanel}
        onDismiss={() => {
          setShowAddVenuePanel(false);
          setSelectedLocation(null);
        }}
        headerText="Add New Venue"
        closeButtonAriaLabel="Close"
        type={PanelType.medium}
      >
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
          <Label>Venue Information</Label>
          <TextField
            label="Venue Name"
            required
            value={formData.name}
            onChange={(_, newValue) => handleFormInputChange('name', newValue || '')}
          />
          <TextField
            label="Address"
            required
            value={formData.address}
            onChange={(_, newValue) => handleFormInputChange('address', newValue || '')}
          />
          <TextField
            label="City"
            required
            value={formData.city}
            onChange={(_, newValue) => handleFormInputChange('city', newValue || '')}
          />
          <TextField
            label="Postal Code"
            required
            value={formData.postalCode}
            onChange={(_, newValue) => handleFormInputChange('postalCode', newValue || '')}
          />
          <TextField
            label="Maximum Capacity"
            required
            type="number"
            value={formData.capacity}
            onChange={(_, newValue) => handleFormInputChange('capacity', newValue || '')}
          />
          <TextField
            label="Venue Description"
            multiline
            rows={3}
            value={formData.description}
            onChange={(_, newValue) => handleFormInputChange('description', newValue || '')}
            placeholder="Describe the venue, its features, and any special considerations"
          />
          <TextField
            label="Terms and Conditions"
            required
            multiline
            rows={5}
            value={formData.termsAndConditions}
            onChange={(_, newValue) => handleFormInputChange('termsAndConditions', newValue || '')}
            placeholder="Enter the terms and conditions staff must agree to when accepting shifts at this venue"
          />

          {/* Location Picker */}
          <Label style={{ marginTop: 20 }}>Venue Location</Label>
          <Toggle
            label="Use Intelligent Address Finder"
            checked={useIntelligentPicker}
            onChange={(_, checked) => setUseIntelligentPicker(checked || false)}
            onText="Smart Search"
            offText="Basic Search"
            style={{ marginBottom: 10 }}
          />
          {googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <Text variant="small">🔑 Google Maps API key required for location features</Text>
              <br />
              <Text variant="small">Configure your API key to enable location selection and verification.</Text>
            </div>
          ) : useIntelligentPicker ? (
            <IntelligentAddressPicker
              key={`add-venue-intelligent-${showAddVenuePanel}`}
              apiKey={googleMapsApiKey}
              onLocationSelect={handleLocationSelect}
              initialLocation={selectedLocation}
              label="Find specific venue address"
              placeholder="Enter postcode (e.g., BS34 7HH) or full address with house number..."
            />
          ) : (
            <VenueLocationPicker
              key={`add-venue-basic-${showAddVenuePanel}`}
              apiKey={googleMapsApiKey}
              onLocationSelect={handleLocationSelect}
              initialLocation={selectedLocation}
              label="Set venue location on map"
              placeholder="Search for venue address..."
            />
          )}

          <Label style={{ marginTop: 20 }}>Contact Information</Label>
          <TextField
            label="Contact Name"
            required
            value={formData.contactName}
            onChange={(_, newValue) => handleFormInputChange('contactName', newValue || '')}
          />
          <TextField
            label="Contact Email"
            required
            type="email"
            value={formData.contactEmail}
            onChange={(_, newValue) => handleFormInputChange('contactEmail', newValue || '')}
          />
          <TextField
            label="Contact Phone"
            required
            value={formData.contactPhone}
            onChange={(_, newValue) => handleFormInputChange('contactPhone', newValue || '')}
          />

          <Label style={{ marginTop: 20 }}>Settings</Label>
          <Toggle
            label="Active Venue"
            checked={formData.isActive}
            onChange={(_, checked) => handleFormInputChange('isActive', checked || false)}
            onText="Yes"
            offText="No"
          />
          <Toggle
            label="Requires Fire Safety Checks"
            checked={formData.hasFireSafetyRequirements}
            onChange={(_, checked) => handleFormInputChange('hasFireSafetyRequirements', checked || false)}
            onText="Yes"
            offText="No"
          />
          <Toggle
            label="Requires Capacity Monitoring"
            checked={formData.requiresCapacityMonitoring}
            onChange={(_, checked) => handleFormInputChange('requiresCapacityMonitoring', checked || false)}
            onText="Yes"
            offText="No"
          />
          <Toggle
            label="Requires Toilet Checks"
            checked={formData.requiresToiletChecks}
            onChange={(_, checked) => handleFormInputChange('requiresToiletChecks', checked || false)}
            onText="Yes"
            offText="No"
          />

          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" style={{ marginTop: 20 }}>
            <DefaultButton
              text="Cancel"
              onClick={() => {
                setShowAddVenuePanel(false);
                setSelectedLocation(null);
              }}
            />
            <PrimaryButton
              text="Add Venue"
              onClick={handleSubmitNewVenue}
              disabled={!isFormValid()}
            />
          </Stack>
        </Stack>
      </Panel>

      {/* Edit Venue Panel */}
      <Panel
        isOpen={showEditVenuePanel}
        onDismiss={() => {
          setShowEditVenuePanel(false);
          setSelectedVenue(null);
          setSelectedLocation(null);
        }}
        headerText="Edit Venue"
        closeButtonAriaLabel="Close"
        type={PanelType.medium}
      >
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: '20px 0' }}>
          <Label>Venue Information</Label>
          <TextField
            label="Venue Name"
            required
            value={formData.name}
            onChange={(_, newValue) => handleFormInputChange('name', newValue || '')}
          />
          <TextField
            label="Address"
            required
            value={formData.address}
            onChange={(_, newValue) => handleFormInputChange('address', newValue || '')}
          />
          <TextField
            label="City"
            required
            value={formData.city}
            onChange={(_, newValue) => handleFormInputChange('city', newValue || '')}
          />
          <TextField
            label="Postal Code"
            required
            value={formData.postalCode}
            onChange={(_, newValue) => handleFormInputChange('postalCode', newValue || '')}
          />
          <TextField
            label="Maximum Capacity"
            required
            type="number"
            value={formData.capacity}
            onChange={(_, newValue) => handleFormInputChange('capacity', newValue || '')}
          />
          <TextField
            label="Venue Description"
            multiline
            rows={3}
            value={formData.description}
            onChange={(_, newValue) => handleFormInputChange('description', newValue || '')}
            placeholder="Describe the venue, its features, and any special considerations"
          />
          <TextField
            label="Terms and Conditions"
            required
            multiline
            rows={5}
            value={formData.termsAndConditions}
            onChange={(_, newValue) => handleFormInputChange('termsAndConditions', newValue || '')}
            placeholder="Enter the terms and conditions staff must agree to when accepting shifts at this venue"
          />

          {/* Location Picker */}
          <Label style={{ marginTop: 20 }}>Venue Location</Label>
          <Toggle
            label="Use Intelligent Address Finder"
            checked={useIntelligentPicker}
            onChange={(_, checked) => setUseIntelligentPicker(checked || false)}
            onText="Smart Search"
            offText="Basic Search"
            style={{ marginBottom: 10 }}
          />
          {googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <Text variant="small">🔑 Google Maps API key required for location features</Text>
              <br />
              <Text variant="small">Configure your API key to enable location selection and verification.</Text>
            </div>
          ) : useIntelligentPicker ? (
            <IntelligentAddressPicker
              key={`edit-venue-intelligent-${showEditVenuePanel}-${selectedVenue?.id}`}
              apiKey={googleMapsApiKey}
              onLocationSelect={handleLocationSelect}
              initialLocation={selectedLocation}
              label="Update venue address"
              placeholder="Enter postcode (e.g., BS34 7HH) or full address with house number..."
            />
          ) : (
            <VenueLocationPicker
              key={`edit-venue-basic-${showEditVenuePanel}-${selectedVenue?.id}`}
              apiKey={googleMapsApiKey}
              onLocationSelect={handleLocationSelect}
              initialLocation={selectedLocation}
              label="Update venue location on map"
              placeholder="Search for venue address..."
            />
          )}

          <Label style={{ marginTop: 20 }}>Contact Information</Label>
          <TextField
            label="Contact Name"
            required
            value={formData.contactName}
            onChange={(_, newValue) => handleFormInputChange('contactName', newValue || '')}
          />
          <TextField
            label="Contact Email"
            required
            type="email"
            value={formData.contactEmail}
            onChange={(_, newValue) => handleFormInputChange('contactEmail', newValue || '')}
          />
          <TextField
            label="Contact Phone"
            required
            value={formData.contactPhone}
            onChange={(_, newValue) => handleFormInputChange('contactPhone', newValue || '')}
          />

          <Label style={{ marginTop: 20 }}>Settings</Label>
          <Toggle
            label="Active Venue"
            checked={formData.isActive}
            onChange={(_, checked) => handleFormInputChange('isActive', checked || false)}
            onText="Yes"
            offText="No"
          />
          <Toggle
            label="Requires Fire Safety Checks"
            checked={formData.hasFireSafetyRequirements}
            onChange={(_, checked) => handleFormInputChange('hasFireSafetyRequirements', checked || false)}
            onText="Yes"
            offText="No"
          />
          <Toggle
            label="Requires Capacity Monitoring"
            checked={formData.requiresCapacityMonitoring}
            onChange={(_, checked) => handleFormInputChange('requiresCapacityMonitoring', checked || false)}
            onText="Yes"
            offText="No"
          />
          <Toggle
            label="Requires Toilet Checks"
            checked={formData.requiresToiletChecks}
            onChange={(_, checked) => handleFormInputChange('requiresToiletChecks', checked || false)}
            onText="Yes"
            offText="No"
          />

          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="end" style={{ marginTop: 20 }}>
            <DefaultButton
              text="Cancel"
              onClick={() => {
                setShowEditVenuePanel(false);
                setSelectedVenue(null);
                setSelectedLocation(null);
              }}
            />
            <PrimaryButton
              text="Update Venue"
              onClick={handleUpdateVenue}
              disabled={!isFormValid()}
            />
          </Stack>
        </Stack>
      </Panel>

      {/* Delete Confirmation Dialog */}
      <Dialog
        hidden={!showDeleteDialog}
        onDismiss={() => setShowDeleteDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Confirm Deletion',
          subText: selectedVenue ?
            `Are you sure you want to delete ${selectedVenue.name}? This action cannot be undone.` :
            'Are you sure you want to delete this venue? This action cannot be undone.'
        }}
      >
        <DialogFooter>
          <PrimaryButton
            text="Delete"
            onClick={confirmDeleteVenue}
          />
          <DefaultButton
            text="Cancel"
            onClick={() => setShowDeleteDialog(false)}
          />
        </DialogFooter>
      </Dialog>
    </MainLayout>
  );
};

export default VenueManagement;
