import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import venueService from '../../services/venueService';
import authService from '../../services/authService';
import { Venue as ApiVenue } from '../../types/venue';
import { VenueLocationPicker, VenueLocationDisplay, LeafletVenuesMap } from '../../components';
import IntelligentAddressPicker from '../../components/IntelligentAddressPicker';
import type { VenueLocationData } from '../../components/VenueLocationPicker';
import {
  Header,
  Container,
  CloudscapeTable,
  StatusIndicator,
  EmptyState,
  ConfirmationModal,
  SpaceBetween,
  ColumnLayout,
  FormSection,
  KeyValuePairs,
} from '../../components/cloudscape';
import Flashbar, { useFlashbar } from '../../components/cloudscape/Flashbar';
import type { ColumnDefinition } from '../../components/cloudscape/CloudscapeTable';

// ============================================================================
// Types & Interfaces
// ============================================================================

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
  hasFireSafetyRequirements: boolean;
  requiresCapacityMonitoring: boolean;
  requiresToiletChecks: boolean;
  description: string;
  termsAndConditions: string;
}

type ViewMode = 'table' | 'cards' | 'map';

// ============================================================================
// Data Mapping Functions
// ============================================================================

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

// ============================================================================
// Icon Components
// ============================================================================

const Icons = {
  MapPin: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Power: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0a9 9 0 01-12.728 0m12.728 0L12 12m-6.364 6.364a9 9 0 010-12.728m0 12.728L12 12m0-9v9" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Fire: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Toilet: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Phone: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Mail: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
};

// ============================================================================
// Requirement Badges Component
// ============================================================================

const RequirementBadges: React.FC<{ venue: Venue }> = ({ venue }) => {
  const badges: { active: boolean; label: string; color: string }[] = [
    { active: venue.hasFireSafetyRequirements, label: 'Fire', color: 'bg-orange-100 text-orange-700' },
    { active: venue.requiresCapacityMonitoring, label: 'Capacity', color: 'bg-sky-100 text-sky-700' },
    { active: venue.requiresToiletChecks, label: 'Toilet', color: 'bg-violet-100 text-violet-700' },
  ];

  const activeBadges = badges.filter(b => b.active);
  if (activeBadges.length === 0) return <span className="text-sm text-gray-400">None</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {activeBadges.map(b => (
        <span key={b.label} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${b.color}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
};

// ============================================================================
// Venue Detail Modal Component
// ============================================================================

interface VenueDetailModalProps {
  venue: Venue;
  googleMapsApiKey: string;
  onClose: () => void;
  onEdit: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
}

const VenueDetailModal: React.FC<VenueDetailModalProps> = ({
  venue,
  googleMapsApiKey,
  onClose,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Icons.ArrowLeft />
              <span className="font-medium">Back to venues</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(venue)}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              >
                Edit venue
              </button>
              <button
                onClick={() => onDelete(venue)}
                className="px-4 h-9 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
              >
                Delete venue
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <SpaceBetween size="l">
              {/* Title and status */}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{venue.name}</h1>
                  <StatusIndicator type={venue.isActive ? 'success' : 'stopped'}>
                    {venue.isActive ? 'Active' : 'Inactive'}
                  </StatusIndicator>
                </div>
                <p className="text-sm text-gray-500">{venue.address}, {venue.city}, {venue.postalCode}</p>
              </div>

              <ColumnLayout columns={2}>
                {/* Map section */}
                <Container header="Location">
                  <div className="h-[280px] bg-gray-100 rounded-lg overflow-hidden -mx-5 -mb-5">
                    {venue.latitude && venue.longitude && googleMapsApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' ? (
                      <VenueLocationDisplay
                        apiKey={googleMapsApiKey}
                        venue={{
                          id: venue.id,
                          name: venue.name,
                          address: `${venue.address}, ${venue.city}, ${venue.postalCode}`,
                          latitude: venue.latitude,
                          longitude: venue.longitude
                        }}
                        height="100%"
                        width="100%"
                        showAddress={false}
                        showDirections={true}
                        showCheckInRadius={true}
                        checkInRadiusMeters={50}
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                        <Icons.MapPin />
                        <span className="text-sm mt-2">No map available</span>
                      </div>
                    )}
                  </div>
                </Container>

                {/* Details section */}
                <SpaceBetween size="l">
                  <Container header="Details">
                    <KeyValuePairs
                      columns={2}
                      items={[
                        { label: 'Capacity', value: String(venue.capacity) },
                        { label: 'GPS coordinates', value: venue.latitude && venue.longitude ? `${venue.latitude.toFixed(5)}, ${venue.longitude.toFixed(5)}` : 'Not set' },
                        { label: 'Check-in radius', value: venue.latitude && venue.longitude ? '50m' : 'N/A' },
                      ]}
                    />
                  </Container>

                  <Container header="Contact information">
                    <KeyValuePairs
                      columns={2}
                      items={[
                        { label: 'Name', value: venue.contactName },
                        { label: 'Email', value: <a href={`mailto:${venue.contactEmail}`} className="text-red-600 hover:underline">{venue.contactEmail}</a> },
                        { label: 'Phone', value: <a href={`tel:${venue.contactPhone}`} className="text-red-600 hover:underline">{venue.contactPhone}</a> },
                      ]}
                    />
                  </Container>
                </SpaceBetween>
              </ColumnLayout>

              {/* Required checks */}
              <Container header="Required checks">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-orange-100 rounded-lg text-orange-600"><Icons.Fire /></span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Fire safety</p>
                      <StatusIndicator type={venue.hasFireSafetyRequirements ? 'success' : 'stopped'}>
                        {venue.hasFireSafetyRequirements ? 'Required' : 'Not required'}
                      </StatusIndicator>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-sky-100 rounded-lg text-sky-600"><Icons.Chart /></span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Capacity monitoring</p>
                      <StatusIndicator type={venue.requiresCapacityMonitoring ? 'success' : 'stopped'}>
                        {venue.requiresCapacityMonitoring ? 'Required' : 'Not required'}
                      </StatusIndicator>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-violet-100 rounded-lg text-violet-600"><Icons.Toilet /></span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Toilet checks</p>
                      <StatusIndicator type={venue.requiresToiletChecks ? 'success' : 'stopped'}>
                        {venue.requiresToiletChecks ? 'Required' : 'Not required'}
                      </StatusIndicator>
                    </div>
                  </div>
                </div>
              </Container>

              {/* Description */}
              {venue.description && (
                <Container header="Description">
                  <p className="text-sm text-gray-700">{venue.description}</p>
                </Container>
              )}

              {/* Terms & Conditions */}
              {venue.termsAndConditions && (
                <Container header="Terms and conditions">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{venue.termsAndConditions}</p>
                </Container>
              )}
            </SpaceBetween>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Venue Form Slide-Over Component
// ============================================================================

interface VenueFormSlideOverProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  venue: Venue | null;
  googleMapsApiKey: string;
  onClose: () => void;
  onSubmit: (formData: any, selectedLocation: VenueLocationData | null) => void;
}

const VenueFormSlideOver: React.FC<VenueFormSlideOverProps> = ({
  isOpen,
  mode,
  venue,
  googleMapsApiKey,
  onClose,
  onSubmit,
}) => {
  const [useIntelligentPicker, setUseIntelligentPicker] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<VenueLocationData | null>(null);
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
    description: '',
    termsAndConditions: ''
  });

  // Initialize form data when venue changes
  useEffect(() => {
    if (mode === 'edit' && venue) {
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
        description: venue.description || '',
        termsAndConditions: venue.termsAndConditions || ''
      });

      if (venue.latitude && venue.longitude) {
        setSelectedLocation({
          address: venue.address,
          latitude: venue.latitude,
          longitude: venue.longitude,
          formattedAddress: `${venue.address}, ${venue.city}, ${venue.postalCode}`,
          city: venue.city,
          postalCode: venue.postalCode
        });
      } else {
        setSelectedLocation(null);
      }
    } else {
      // Reset form for add mode
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
    }
  }, [mode, venue]);

  const handleLocationSelect = useCallback((location: VenueLocationData) => {
    setSelectedLocation(location);
    if (location.address) {
      setFormData(prev => ({
        ...prev,
        address: location.address,
        city: location.city || '',
        postalCode: location.postalCode || ''
      }));
    }
  }, []);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
      formData.termsAndConditions.trim() !== ''
    );
  };

  const handleSubmit = () => {
    if (isFormValid()) {
      onSubmit(formData, selectedLocation);
    }
  };

  if (!isOpen) return null;

  const inputClass = "w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-xl w-full">
        <div className="h-full bg-white shadow-xl flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'add' ? 'Create venue' : 'Edit venue'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icons.X />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <SpaceBetween size="xl">
              {/* Venue Details */}
              <FormSection header="Venue details">
                <div>
                  <label className={labelClass}>Venue name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={inputClass}
                    placeholder="Enter venue name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Maximum capacity *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => handleInputChange('capacity', e.target.value)}
                    className={inputClass}
                    placeholder="Enter capacity"
                  />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder="Describe the venue..."
                  />
                </div>
              </FormSection>

              {/* Location */}
              <FormSection header="Location">
                {/* Address Picker Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Use intelligent address finder</span>
                  <button
                    type="button"
                    onClick={() => setUseIntelligentPicker(!useIntelligentPicker)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${useIntelligentPicker ? 'bg-red-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useIntelligentPicker ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">Google Maps API key required for location features. Configure your API key to enable location selection.</p>
                  </div>
                ) : useIntelligentPicker ? (
                  <IntelligentAddressPicker
                    key={`form-intelligent-${isOpen}-${venue?.id}`}
                    apiKey={googleMapsApiKey}
                    onLocationSelect={handleLocationSelect}
                    initialLocation={selectedLocation}
                    label="Find specific venue address"
                    placeholder="Enter postcode (e.g., BS34 7HH) or full address..."
                  />
                ) : (
                  <VenueLocationPicker
                    key={`form-basic-${isOpen}-${venue?.id}`}
                    apiKey={googleMapsApiKey}
                    onLocationSelect={handleLocationSelect}
                    initialLocation={selectedLocation}
                    label="Set venue location on map"
                    placeholder="Search for venue address..."
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelClass}>Address *</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className={inputClass}
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>City *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className={inputClass}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Postal code *</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      className={inputClass}
                      placeholder="Post code"
                    />
                  </div>
                </div>
              </FormSection>

              {/* Contact */}
              <FormSection header="Contact information">
                <div>
                  <label className={labelClass}>Contact name *</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange('contactName', e.target.value)}
                    className={inputClass}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <label className={labelClass}>Contact email *</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                    className={inputClass}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Contact phone *</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                    className={inputClass}
                    placeholder="+44 123 456 7890"
                  />
                </div>
              </FormSection>

              {/* Requirements */}
              <FormSection header="Requirements">
                {[
                  { key: 'isActive', label: 'Active venue', desc: 'Venue is available for shift scheduling' },
                  { key: 'hasFireSafetyRequirements', label: 'Fire safety checks', desc: 'Require fire safety checks during shifts' },
                  { key: 'requiresCapacityMonitoring', label: 'Capacity monitoring', desc: 'Track venue capacity during events' },
                  { key: 'requiresToiletChecks', label: 'Toilet checks', desc: 'Require regular toilet inspections' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInputChange(item.key, !formData[item.key as keyof typeof formData])}
                      className={`relative w-11 h-6 rounded-full transition-colors ${formData[item.key as keyof typeof formData] ? 'bg-red-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData[item.key as keyof typeof formData] ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                ))}
              </FormSection>

              {/* Terms & Conditions */}
              <FormSection header="Terms and conditions *">
                <textarea
                  value={formData.termsAndConditions}
                  onChange={(e) => handleInputChange('termsAndConditions', e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="Enter terms and conditions staff must agree to when accepting shifts at this venue..."
                />
              </FormSection>
            </SpaceBetween>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mode === 'add' ? 'Create venue' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Venue Card Component (for card view)
// ============================================================================

interface VenueCardProps {
  venue: Venue;
  googleMapsApiKey: string;
  onEdit: (venue: Venue) => void;
  onView: (venue: Venue) => void;
  onToggleStatus: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
}

const VenueCard: React.FC<VenueCardProps> = ({
  venue,
  googleMapsApiKey,
  onEdit,
  onView,
  onToggleStatus,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-[0_1px_2px_0_rgba(0,7,22,0.05)] overflow-hidden transition-shadow hover:shadow-md">
      {/* Map Preview */}
      <div className="h-36 bg-gray-100 relative">
        {venue.latitude && venue.longitude && googleMapsApiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' ? (
          <VenueLocationDisplay
            apiKey={googleMapsApiKey}
            venue={{
              id: venue.id,
              name: venue.name,
              address: `${venue.address}, ${venue.city}, ${venue.postalCode}`,
              latitude: venue.latitude,
              longitude: venue.longitude
            }}
            height="100%"
            width="100%"
            showAddress={false}
            showDirections={false}
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
            <Icons.MapPin />
            <span className="text-xs mt-2">
              {googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' ? 'Map API key needed' : 'No coordinates set'}
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{venue.name}</h3>
            <p className="text-xs text-gray-500 truncate mt-0.5">{venue.address}, {venue.city}</p>
          </div>
          <StatusIndicator type={venue.isActive ? 'success' : 'stopped'}>
            {venue.isActive ? 'Active' : 'Inactive'}
          </StatusIndicator>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <Icons.Users />
            Capacity: {venue.capacity}
          </span>
        </div>

        <div className="mb-3">
          <RequirementBadges venue={venue} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => onEdit(venue)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Icons.Edit />
            Edit
          </button>
          <button
            onClick={() => onView(venue)}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Icons.Eye />
            View
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center justify-center w-8 h-8 text-gray-400 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 bottom-full mb-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => { onToggleStatus(venue); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icons.Power />
                    {venue.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { onDelete(venue); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Icons.Trash />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main VenueManagement Component
// ============================================================================

const VenueManagement: React.FC = () => {
  // State
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAuthIssue, setHasAuthIssue] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statsFilter, setStatsFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Flashbar
  const { items: flashItems, addFlash, removeFlash } = useFlashbar();

  // Modal/Panel states
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  // Google Maps API key
  const [googleMapsApiKey] = useState(() => {
    return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';
  });

  // Load venues
  const loadVenues = useCallback(async () => {
    setIsLoading(true);
    setHasAuthIssue(false);

    try {
      const apiVenues = await venueService.getAllVenues();
      const uiVenues = (apiVenues || []).map(mapToUiVenue);
      setVenues(uiVenues);
      setFilteredVenues(uiVenues);
    } catch (error: any) {
      console.error('Error fetching venues:', error);
      if (error.response?.status === 401) {
        addFlash({
          type: 'error',
          header: 'Session expired',
          content: 'Your session has expired. Please log in again.',
          action: (
            <button
              onClick={handleLogout}
              className="px-3 h-8 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Log out
            </button>
          ),
          dismissible: false,
        });
        setHasAuthIssue(true);
      } else {
        addFlash({
          type: 'error',
          header: 'Failed to load venues',
          content: error.response?.data?.message || 'An error occurred while loading venues. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    window.location.href = '/login';
  }, []);

  // Filter venues based on search and stats filter
  useEffect(() => {
    let filtered = venues;

    // Apply search filter
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(lowerSearch) ||
        v.city.toLowerCase().includes(lowerSearch) ||
        v.contactName.toLowerCase().includes(lowerSearch)
      );
    }

    // Apply stats filter
    if (statsFilter) {
      switch (statsFilter) {
        case 'active':
          filtered = filtered.filter(v => v.isActive);
          break;
        case 'inactive':
          filtered = filtered.filter(v => !v.isActive);
          break;
        case 'gps':
          filtered = filtered.filter(v => v.latitude && v.longitude);
          break;
      }
    }

    setFilteredVenues(filtered);
    setCurrentPage(1);
  }, [searchText, statsFilter, venues]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredVenues.length / ITEMS_PER_PAGE);
  const paginatedVenues = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVenues.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredVenues, currentPage, ITEMS_PER_PAGE]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load venues on mount
  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  // Handlers
  const handleAddVenue = () => {
    setSelectedVenue(null);
    setShowAddPanel(true);
  };

  const handleEditVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowEditPanel(true);
    setShowDetailModal(false);
  };

  const handleViewVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowDetailModal(true);
  };

  const handleDeleteVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowDeleteModal(true);
    setShowDetailModal(false);
  };

  const handleToggleStatus = async (venue: Venue) => {
    try {
      await venueService.updateVenueStatus(venue.id, !venue.isActive);
      const updatedVenues = venues.map(v =>
        v.id === venue.id ? { ...v, isActive: !v.isActive } : v
      );
      setVenues(updatedVenues);
      addFlash({
        type: 'success',
        content: `${venue.name} has been ${venue.isActive ? 'deactivated' : 'activated'}.`,
      });
    } catch (error) {
      console.error('Failed to update venue status:', error);
      addFlash({
        type: 'error',
        content: 'Failed to update venue status. Please try again.',
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedVenue) return;
    try {
      await venueService.deleteVenue(selectedVenue.id);
      setVenues(venues.filter(v => v.id !== selectedVenue.id));
      setShowDeleteModal(false);
      setSelectedVenue(null);
      addFlash({
        type: 'success',
        content: `${selectedVenue.name} has been deleted.`,
      });
    } catch (error) {
      console.error('Failed to delete venue:', error);
      addFlash({
        type: 'error',
        content: 'Failed to delete venue. Please try again.',
      });
    }
  };

  const handleSubmitVenue = async (formData: any, selectedLocation: VenueLocationData | null) => {
    try {
      const capacity = Number.parseInt(formData.capacity);
      if (Number.isNaN(capacity)) {
        addFlash({ type: 'error', content: 'Capacity must be a valid number.' });
        return;
      }

      const apiVenue: ApiVenue = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        latitude: selectedLocation?.latitude,
        longitude: selectedLocation?.longitude,
        country: 'United Kingdom',
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

      if (showEditPanel && selectedVenue) {
        await venueService.updateVenue(selectedVenue.id, apiVenue);
        const updatedVenue = {
          ...selectedVenue,
          ...formData,
          capacity,
          latitude: selectedLocation?.latitude,
          longitude: selectedLocation?.longitude,
        };
        setVenues(venues.map(v => v.id === selectedVenue.id ? updatedVenue : v));
        setShowEditPanel(false);
        addFlash({ type: 'success', content: `${formData.name} has been updated.` });
      } else {
        const created = await venueService.createVenue(apiVenue);
        setVenues([...venues, mapToUiVenue(created)]);
        setShowAddPanel(false);
        addFlash({ type: 'success', content: `${formData.name} has been created.` });
      }
      setSelectedVenue(null);
    } catch (error) {
      console.error('Failed to save venue:', error);
      addFlash({ type: 'error', content: 'Failed to save venue. Please try again.' });
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = venues.length;
    const active = venues.filter(v => v.isActive).length;
    const inactive = total - active;
    const gpsVerified = venues.filter(v => v.latitude && v.longitude).length;
    return { total, active, inactive, gpsVerified };
  }, [venues]);

  // Table column definitions
  const columnDefinitions: ColumnDefinition<Venue>[] = useMemo(() => [
    {
      id: 'name',
      header: 'Venue',
      sortingField: 'name',
      cell: (venue) => (
        <div>
          <button
            onClick={() => handleViewVenue(venue)}
            className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline"
          >
            {venue.name}
          </button>
          <p className="text-xs text-gray-500 mt-0.5">{venue.address}, {venue.city}</p>
        </div>
      ),
    },
    {
      id: 'capacity',
      header: 'Capacity',
      sortingField: 'capacity',
      width: 100,
      cell: (venue) => <span className="text-sm">{venue.capacity}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortingField: 'isActive',
      width: 120,
      cell: (venue) => (
        <StatusIndicator type={venue.isActive ? 'success' : 'stopped'}>
          {venue.isActive ? 'Active' : 'Inactive'}
        </StatusIndicator>
      ),
    },
    {
      id: 'requirements',
      header: 'Requirements',
      width: 200,
      cell: (venue) => <RequirementBadges venue={venue} />,
    },
    {
      id: 'gps',
      header: 'GPS',
      width: 80,
      cell: (venue) => (
        <StatusIndicator type={venue.latitude && venue.longitude ? 'success' : 'stopped'}>
          {venue.latitude && venue.longitude ? 'Yes' : 'No'}
        </StatusIndicator>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 140,
      cell: (venue) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleEditVenue(venue)}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit venue"
          >
            <Icons.Edit />
          </button>
          <button
            onClick={() => handleViewVenue(venue)}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="View venue"
          >
            <Icons.Eye />
          </button>
          <button
            onClick={() => handleToggleStatus(venue)}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title={venue.isActive ? 'Deactivate venue' : 'Activate venue'}
          >
            <Icons.Power />
          </button>
          <button
            onClick={() => handleDeleteVenue(venue)}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete venue"
          >
            <Icons.Trash />
          </button>
        </div>
      ),
    },
  ], []);

  // View mode tabs
  const viewTabs: { key: ViewMode; label: string }[] = [
    { key: 'table', label: 'Table' },
    { key: 'cards', label: 'Cards' },
    { key: 'map', label: 'Map' },
  ];

  // Pagination component
  const PaginationBar = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-1 py-2">
        <span className="text-sm text-gray-500">
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredVenues.length)} of {filteredVenues.length} venues
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 h-8 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                page === currentPage
                  ? 'bg-red-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 h-8 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>

      <SpaceBetween size="l">
        {/* Page header */}
        <Header
          variant="h1"
          counter={String(filteredVenues.length)}
          description="Manage your venue locations and settings"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={loadVenues}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Icons.Refresh />
                  Refresh
                </span>
              </button>
              <button
                onClick={handleAddVenue}
                className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Icons.Plus />
                  Create venue
                </span>
              </button>
            </div>
          }
        >
          Venues
        </Header>

        {/* Flashbar */}
        <Flashbar items={flashItems} onDismiss={removeFlash} />

        {/* Stats row */}
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'total', label: 'Total venues', value: stats.total },
            { key: 'active', label: 'Active', value: stats.active },
            { key: 'inactive', label: 'Inactive', value: stats.inactive },
            { key: 'gps', label: 'GPS verified', value: stats.gpsVerified },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setStatsFilter(statsFilter === item.key ? '' : item.key)}
              className={`flex flex-col items-center min-w-[90px] px-4 py-2.5 rounded-xl border transition-all ${
                statsFilter === item.key
                  ? 'border-red-300 bg-red-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <span className="text-xl font-semibold text-gray-900">{item.value}</span>
              <span className="text-xs text-gray-500">{item.label}</span>
            </button>
          ))}
        </div>

        {/* View toggle and search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* View toggle */}
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
            {viewTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setViewMode(tab.key); setCurrentPage(1); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-80">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons.Search />
            </span>
            <input
              type="text"
              placeholder="Search venues..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Table view */}
        {viewMode === 'table' && (
          <CloudscapeTable<Venue>
            items={paginatedVenues}
            columnDefinitions={columnDefinitions}
            loading={isLoading}
            loadingText="Loading venues"
            trackBy="id"
            stripedRows
            stickyHeader
            empty={
              <EmptyState
                title="No venues found"
                description={searchText || statsFilter ? 'Adjust your search or filter criteria.' : 'Get started by creating your first venue.'}
                variant={searchText || statsFilter ? 'no-match' : 'empty'}
                action={
                  !searchText && !statsFilter ? (
                    <button
                      onClick={handleAddVenue}
                      className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                    >
                      Create venue
                    </button>
                  ) : undefined
                }
              />
            }
            pagination={<PaginationBar />}
          />
        )}

        {/* Cards view */}
        {viewMode === 'cards' && (
          <>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <svg className="animate-spin h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="mt-3 text-sm text-gray-500">Loading venues...</p>
              </div>
            ) : filteredVenues.length === 0 ? (
              <Container>
                <EmptyState
                  title="No venues found"
                  description={searchText || statsFilter ? 'Adjust your search or filter criteria.' : 'Get started by creating your first venue.'}
                  variant={searchText || statsFilter ? 'no-match' : 'empty'}
                  action={
                    !searchText && !statsFilter ? (
                      <button
                        onClick={handleAddVenue}
                        className="px-4 h-9 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Create venue
                      </button>
                    ) : undefined
                  }
                />
              </Container>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedVenues.map(venue => (
                    <VenueCard
                      key={venue.id}
                      venue={venue}
                      googleMapsApiKey={googleMapsApiKey}
                      onEdit={handleEditVenue}
                      onView={handleViewVenue}
                      onToggleStatus={handleToggleStatus}
                      onDelete={handleDeleteVenue}
                    />
                  ))}
                </div>
                <PaginationBar />
              </>
            )}
          </>
        )}

        {/* Map view */}
        {viewMode === 'map' && (
          <Container
            header={
              <Header variant="h2">
                Map view
              </Header>
            }
            disablePadding
          >
            <LeafletVenuesMap
              venues={filteredVenues.map(v => ({
                id: v.id,
                name: v.name,
                address: `${v.address}, ${v.city}`,
                latitude: v.latitude,
                longitude: v.longitude,
                isActive: v.isActive,
                capacity: v.capacity,
              }))}
              height="600px"
              onVenueClick={(venue) => {
                const fullVenue = filteredVenues.find(v => v.id === venue.id);
                if (fullVenue) handleViewVenue(fullVenue);
              }}
            />
          </Container>
        )}
      </SpaceBetween>

      {/* Modals & Slide-overs */}
      <VenueFormSlideOver
        isOpen={showAddPanel}
        mode="add"
        venue={null}
        googleMapsApiKey={googleMapsApiKey}
        onClose={() => setShowAddPanel(false)}
        onSubmit={handleSubmitVenue}
      />

      <VenueFormSlideOver
        isOpen={showEditPanel}
        mode="edit"
        venue={selectedVenue}
        googleMapsApiKey={googleMapsApiKey}
        onClose={() => { setShowEditPanel(false); setSelectedVenue(null); }}
        onSubmit={handleSubmitVenue}
      />

      {showDetailModal && selectedVenue && (
        <VenueDetailModal
          venue={selectedVenue}
          googleMapsApiKey={googleMapsApiKey}
          onClose={() => { setShowDetailModal(false); setSelectedVenue(null); }}
          onEdit={handleEditVenue}
          onDelete={handleDeleteVenue}
        />
      )}

      <ConfirmationModal
        visible={showDeleteModal}
        header="Delete venue"
        variant="destructive"
        confirmLabel="Delete venue"
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteModal(false); setSelectedVenue(null); }}
      >
        <p>
          Are you sure you want to delete <strong>{selectedVenue?.name}</strong>? This action cannot be undone.
        </p>
      </ConfirmationModal>
    </>
  );
};

export default VenueManagement;
