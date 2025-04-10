import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
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

// Icons
const addIcon: IIconProps = { iconName: 'Add' };
const refreshIcon: IIconProps = { iconName: 'Refresh' };

interface Venue {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  capacity: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  hasFireSafetyRequirements: boolean;
  requiresCapacityMonitoring: boolean;
  requiresToiletChecks: boolean;
  description: string; // Added description field
  termsAndConditions: string; // Added terms and conditions field
}

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

  // Load venues from API - using useCallback to avoid dependency issues in useEffect
  const loadVenues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In a real application, this would use the actual API
      // const response = await venueService.getAllVenues();
      // setVenues(response);

      // For demo purposes, we'll use mock data
      const mockVenues: Venue[] = [
        {
          id: 1,
          name: 'The Grand Hall',
          address: '123 Main Street',
          city: 'London',
          postalCode: 'SW1A 1AA',
          capacity: 500,
          contactName: 'John Smith',
          contactEmail: 'john.smith@thegrandhall.com',
          contactPhone: '+44 20 1234 5678',
          isActive: true,
          hasFireSafetyRequirements: true,
          requiresCapacityMonitoring: true,
          requiresToiletChecks: true,
          description: 'Historic venue in central London with grand architecture and modern facilities.',
          termsAndConditions: 'The security staff must adhere to the venue\'s fire safety protocols. Regular headcounts must be performed. Staff must wear venue-approved uniforms.'
        },
        {
          id: 2,
          name: 'City Nightclub',
          address: '45 Club Avenue',
          city: 'Manchester',
          postalCode: 'M1 1BB',
          capacity: 250,
          contactName: 'Sarah Johnson',
          contactEmail: 'sarah@citynightclub.com',
          contactPhone: '+44 161 9876 5432',
          isActive: true,
          hasFireSafetyRequirements: true,
          requiresCapacityMonitoring: true,
          requiresToiletChecks: true,
          description: 'Popular nightclub in Manchester with three dance floors and VIP areas.',
          termsAndConditions: 'Security staff must check IDs at entry. Zero tolerance for drugs policy must be enforced. Staff must be trained in conflict resolution.'
        },
        {
          id: 3,
          name: 'The Old Theatre',
          address: '78 Cultural Street',
          city: 'Edinburgh',
          postalCode: 'EH1 2CD',
          capacity: 350,
          contactName: 'Robert Wilson',
          contactEmail: 'bookings@oldtheatre.com',
          contactPhone: '+44 131 5551 2345',
          isActive: false,
          hasFireSafetyRequirements: true,
          requiresCapacityMonitoring: false,
          requiresToiletChecks: true,
          description: 'Historic theatre venue with period features and state-of-the-art lighting.',
          termsAndConditions: 'Staff must be familiar with the venue\'s evacuation procedures. No food or drinks allowed in the main auditorium. Staff must assist with accessibility requirements.'
        },
        {
          id: 4,
          name: 'Riverside Event Space',
          address: '12 Dock Road',
          city: 'Liverpool',
          postalCode: 'L1 3DE',
          capacity: 400,
          contactName: 'Emma Thompson',
          contactEmail: 'events@riverside.co.uk',
          contactPhone: '+44 151 4567 8901',
          isActive: true,
          hasFireSafetyRequirements: true,
          requiresCapacityMonitoring: true,
          requiresToiletChecks: false,
          description: 'Modern riverside venue with outdoor areas and panoramic views.',
          termsAndConditions: 'Security staff must monitor the waterfront areas. Outdoor patrols required every 30 minutes. Staff must be trained in water safety procedures.'
        },
        {
          id: 5,
          name: 'The Sports Arena',
          address: '90 Olympic Way',
          city: 'Birmingham',
          postalCode: 'B5 6EF',
          capacity: 1000,
          contactName: 'David Brown',
          contactEmail: 'bookings@sportsarena.com',
          contactPhone: '+44 121 2345 6789',
          isActive: true,
          hasFireSafetyRequirements: true,
          requiresCapacityMonitoring: true,
          requiresToiletChecks: true,
          description: 'Large multi-purpose sports venue with indoor and outdoor facilities.',
          termsAndConditions: 'Security staff must be familiar with emergency medical procedures. Segregation of rival fans may be required. Staff must enforce the venue\'s code of conduct.'
        }
      ];

      setVenues(mockVenues);
      setFilteredVenues(mockVenues);
    } catch (error) {
      console.error('Failed to load venues:', error);
      setError('Failed to load venues. Please try again later.');
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
    setShowEditVenuePanel(true);
  }, []);

  const handleToggleStatus = useCallback((venue: Venue) => {
    // In a real application, this would call the API
    // await venueService.updateVenueStatus(venue.id, !venue.isActive);

    // For demo purposes, we'll just update the local state
    const updatedVenues = venues.map(v =>
      v.id === venue.id ? { ...v, isActive: !v.isActive } : v
    );
    setVenues(updatedVenues);
    setFilteredVenues(updatedVenues);
  }, [venues]);

  const handleDeleteVenue = useCallback((venue: Venue) => {
    setSelectedVenue(venue);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteVenue = useCallback(async () => {
    if (!selectedVenue) return;

    try {
      // In a real application, this would call the API
      // await venueService.deleteVenue(selectedVenue.id);

      // For demo purposes, we'll just update the local state
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

      // In a real application, this would call the API
      // const newVenue = await venueService.createVenue({...formData, capacity});

      // For demo purposes, we'll just update the local state
      const newVenue: Venue = {
        id: Math.max(...venues.map(v => v.id)) + 1,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
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

      const updatedVenues = [...venues, newVenue];
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

      // In a real application, this would call the API
      // await venueService.updateVenue(selectedVenue.id, {...formData, capacity});

      // For demo purposes, we'll just update the local state
      const updatedVenues = venues.map(v =>
        v.id === selectedVenue.id
          ? {
              ...v,
              name: formData.name,
              address: formData.address,
              city: formData.city,
              postalCode: formData.postalCode,
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
            }
          : v
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
    loadVenues();
    return false; // Return false to prevent default behavior
  }, [loadVenues]);

  const handleFormInputChange = useCallback((field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        onDismiss={() => setShowAddVenuePanel(false)}
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
              onClick={() => setShowAddVenuePanel(false)}
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
