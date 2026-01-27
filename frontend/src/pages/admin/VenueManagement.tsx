import type React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import venueService from '../../services/venueService';
import authService from '../../services/authService';
import { Venue as ApiVenue } from '../../types/venue';
import { MainLayout } from '../../layouts';
import { VenueLocationPicker, VenueLocationDisplay, LeafletVenuesMap } from '../../components';
import IntelligentAddressPicker from '../../components/IntelligentAddressPicker';
import type { VenueLocationData } from '../../components/VenueLocationPicker';

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

type ViewMode = 'grid' | 'list' | 'map';

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
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Search: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Grid: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  List: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  Map: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
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
  MoreVertical: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ============================================================================
// Venue Stats Bar Component
// ============================================================================

interface VenueStatsProps {
  venues: Venue[];
  onFilterClick: (filter: string) => void;
  activeFilter: string | null;
}

const VenueStatsBar: React.FC<VenueStatsProps> = ({ venues, onFilterClick, activeFilter }) => {
  const stats = useMemo(() => {
    const total = venues.length;
    const active = venues.filter(v => v.isActive).length;
    const inactive = total - active;
    const gpsVerified = venues.filter(v => v.latitude && v.longitude).length;
    return { total, active, inactive, gpsVerified };
  }, [venues]);

  const statItems = [
    { key: 'total', label: 'Total', value: stats.total, color: 'gray' },
    { key: 'active', label: 'Active', value: stats.active, color: 'emerald' },
    { key: 'inactive', label: 'Inactive', value: stats.inactive, color: 'gray' },
    { key: 'gps', label: 'GPS ✓', value: stats.gpsVerified, color: 'sky' },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {statItems.map(item => (
        <button
          key={item.key}
          onClick={() => onFilterClick(activeFilter === item.key ? '' : item.key)}
          className={`
            flex flex-col items-center min-w-[80px] px-4 py-3 rounded-xl border-2 transition-all duration-200
            ${activeFilter === item.key
              ? 'border-red-300 bg-red-50 shadow-md'
              : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
            }
          `}
        >
          <span className="text-2xl font-bold text-gray-900 tracking-tight">{item.value}</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// View Toggle Component
// ============================================================================

interface ViewToggleProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ activeView, onViewChange }) => {
  const views: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
    { key: 'grid', label: 'Grid', icon: <Icons.Grid /> },
    { key: 'list', label: 'List', icon: <Icons.List /> },
    { key: 'map', label: 'Map', icon: <Icons.Map /> },
  ];

  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-1">
      {views.map(view => (
        <button
          key={view.key}
          onClick={() => onViewChange(view.key)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${activeView === view.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }
          `}
        >
          {view.icon}
          <span className="hidden sm:inline">{view.label}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Requirement Badge Component
// ============================================================================

interface RequirementBadgeProps {
  type: 'fire' | 'capacity' | 'toilet';
  active: boolean;
}

const RequirementBadge: React.FC<RequirementBadgeProps> = ({ type, active }) => {
  if (!active) return null;

  const config = {
    fire: { icon: <Icons.Fire />, label: 'Fire', bgColor: 'bg-orange-500' },
    capacity: { icon: <Icons.Chart />, label: 'Capacity', bgColor: 'bg-sky-500' },
    toilet: { icon: <Icons.Toilet />, label: 'Toilet', bgColor: 'bg-violet-500' },
  };

  const { icon, label, bgColor } = config[type];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-white text-xs font-semibold ${bgColor}`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
};

// ============================================================================
// Venue Card Component
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
    <div className="group bg-white rounded-2xl border-2 border-gray-200 shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-red-300 hover:-translate-y-1">
      {/* Map Preview */}
      <div className="h-40 bg-gray-100 relative">
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
            className="rounded-t-2xl"
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
        {/* Title & Status */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight truncate">{venue.name}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              venue.isActive
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${venue.isActive ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
              {venue.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
          <Icons.MapPin />
          <span className="truncate">{venue.address}, {venue.city}</span>
        </div>

        {/* Capacity */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Icons.Users />
          <span>Capacity: <strong className="text-gray-900">{venue.capacity}</strong></span>
        </div>

        {/* Requirement Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <RequirementBadge type="fire" active={venue.hasFireSafetyRequirements} />
          <RequirementBadge type="capacity" active={venue.requiresCapacityMonitoring} />
          <RequirementBadge type="toilet" active={venue.requiresToiletChecks} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => onEdit(venue)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            <Icons.Edit />
            Edit
          </button>
          <button
            onClick={() => onView(venue)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <Icons.Eye />
            View
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 border-2 border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Icons.MoreVertical />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 bottom-full mb-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => { onToggleStatus(venue); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icons.Power />
                    {venue.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { onDelete(venue); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
// Venue List Row Component
// ============================================================================

interface VenueListRowProps {
  venue: Venue;
  onEdit: (venue: Venue) => void;
  onView: (venue: Venue) => void;
  onToggleStatus: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
}

const VenueListRow: React.FC<VenueListRowProps> = ({
  venue,
  onEdit,
  onView,
  onToggleStatus,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      <td className="px-4 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-semibold text-gray-900">{venue.name}</div>
          <div className="text-xs text-gray-500">{venue.address}, {venue.city}</div>
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className="text-sm font-medium text-gray-900">{venue.capacity}</span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          venue.isActive ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
        }`}>
          {venue.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1">
          <RequirementBadge type="fire" active={venue.hasFireSafetyRequirements} />
          <RequirementBadge type="capacity" active={venue.requiresCapacityMonitoring} />
          <RequirementBadge type="toilet" active={venue.requiresToiletChecks} />
        </div>
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 text-sm ${venue.latitude && venue.longitude ? 'text-emerald-600' : 'text-gray-400'}`}>
          {venue.latitude && venue.longitude ? <Icons.CheckCircle /> : <Icons.XCircle />}
          {venue.latitude && venue.longitude ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="px-4 py-4 whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(venue)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit"
          >
            <Icons.Edit />
          </button>
          <button
            onClick={() => onView(venue)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="View"
          >
            <Icons.Eye />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icons.MoreVertical />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => { onToggleStatus(venue); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icons.Power />
                    {venue.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { onDelete(venue); setShowMenu(false); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Icons.Trash />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Icons.ArrowLeft />
              <span className="font-medium">Back to Venues</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(venue)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                <Icons.Edit />
                Edit
              </button>
              <button
                onClick={() => onDelete(venue)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-red-200 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors"
              >
                <Icons.Trash />
                Delete
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Map Section */}
              <div>
                <div className="h-[300px] bg-gray-100 rounded-2xl overflow-hidden">
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

                {/* Required Checks */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Required Checks</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-orange-100 rounded-lg text-orange-600"><Icons.Fire /></span>
                        <span className="font-medium text-gray-900">Fire Safety</span>
                      </div>
                      <span className={`font-semibold ${venue.hasFireSafetyRequirements ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {venue.hasFireSafetyRequirements ? '✓ Required' : '✗ Not Required'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-sky-100 rounded-lg text-sky-600"><Icons.Chart /></span>
                        <span className="font-medium text-gray-900">Capacity Monitoring</span>
                      </div>
                      <span className={`font-semibold ${venue.requiresCapacityMonitoring ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {venue.requiresCapacityMonitoring ? '✓ Required' : '✗ Not Required'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-violet-100 rounded-lg text-violet-600"><Icons.Toilet /></span>
                        <span className="font-medium text-gray-900">Toilet Checks</span>
                      </div>
                      <span className={`font-semibold ${venue.requiresToiletChecks ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {venue.requiresToiletChecks ? '✓ Required' : '✗ Not Required'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details Section */}
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{venue.name}</h1>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider mt-2 ${
                      venue.isActive ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${venue.isActive ? 'bg-white' : 'bg-gray-500'}`} />
                      {venue.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-start gap-3 text-gray-600">
                      <Icons.MapPin />
                      <div>
                        <p className="font-medium text-gray-900">{venue.address}</p>
                        <p>{venue.city}, {venue.postalCode}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-gray-600">
                    <Icons.Users />
                    <span>Maximum Capacity: <strong className="text-gray-900">{venue.capacity}</strong></span>
                  </div>

                  {venue.latitude && venue.longitude && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <Icons.MapPin />
                      <span>Check-in Radius: <strong className="text-gray-900">50m</strong></span>
                    </div>
                  )}
                </div>

                {/* Contact Section */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Contact</h3>
                  <div className="space-y-3">
                    <p className="font-semibold text-gray-900">{venue.contactName}</p>
                    <div className="flex items-center gap-3 text-gray-600">
                      <Icons.Mail />
                      <a href={`mailto:${venue.contactEmail}`} className="hover:text-red-600 transition-colors">
                        {venue.contactEmail}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <Icons.Phone />
                      <a href={`tel:${venue.contactPhone}`} className="hover:text-red-600 transition-colors">
                        {venue.contactPhone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {venue.description && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Description</h3>
                    <p className="text-gray-600">{venue.description}</p>
                  </div>
                )}

                {/* Terms & Conditions */}
                {venue.termsAndConditions && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Terms & Conditions</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{venue.termsAndConditions}</p>
                  </div>
                )}
              </div>
            </div>
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

  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-xl w-full">
        <div className="h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {mode === 'add' ? 'Add New Venue' : 'Edit Venue'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icons.X />
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Venue Details Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Venue Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="Enter venue name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Capacity *</label>
                    <input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => handleInputChange('capacity', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="Enter capacity"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all resize-none"
                      placeholder="Describe the venue..."
                    />
                  </div>
                </div>
              </div>

              {/* Location Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Location</h3>

                {/* Address Picker Toggle */}
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Use Intelligent Address Finder</span>
                  <button
                    type="button"
                    onClick={() => setUseIntelligentPicker(!useIntelligentPicker)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${useIntelligentPicker ? 'bg-red-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${useIntelligentPicker ? 'translate-x-6' : ''}`} />
                  </button>
                </div>

                {googleMapsApiKey === 'YOUR_GOOGLE_MAPS_API_KEY' ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">Google Maps API key required for location features. Configure your API key to enable location selection.</p>
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

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="Street address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) => handleInputChange('postalCode', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="Post code"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => handleInputChange('contactName', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email *</label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone *</label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      placeholder="+44 123 456 7890"
                    />
                  </div>
                </div>
              </div>

              {/* Requirements Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Requirements</h3>
                <div className="space-y-3">
                  {[
                    { key: 'isActive', label: 'Active Venue', desc: 'Venue is available for shift scheduling' },
                    { key: 'hasFireSafetyRequirements', label: 'Fire Safety Checks', desc: 'Require fire safety checks during shifts' },
                    { key: 'requiresCapacityMonitoring', label: 'Capacity Monitoring', desc: 'Track venue capacity during events' },
                    { key: 'requiresToiletChecks', label: 'Toilet Checks', desc: 'Require regular toilet inspections' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInputChange(item.key, !formData[item.key as keyof typeof formData])}
                        className={`relative w-12 h-6 rounded-full transition-colors ${formData[item.key as keyof typeof formData] ? 'bg-red-600' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData[item.key as keyof typeof formData] ? 'translate-x-6' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms & Conditions Section */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Terms & Conditions *</h3>
                <textarea
                  value={formData.termsAndConditions}
                  onChange={(e) => handleInputChange('termsAndConditions', e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all resize-none"
                  placeholder="Enter terms and conditions staff must agree to when accepting shifts at this venue..."
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isFormValid()}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${
                isFormValid()
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {mode === 'add' ? 'Add Venue' : 'Update Venue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteConfirmModalProps {
  venue: Venue | null;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ venue, onClose, onConfirm }) => {
  if (!venue) return null;

  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.Trash />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{venue.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Delete Venue
              </button>
            </div>
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
  const [error, setError] = useState<string | null>(null);
  const [hasAuthIssue, setHasAuthIssue] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statsFilter, setStatsFilter] = useState<string | null>(null);

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
    setError(null);
    setHasAuthIssue(false);

    try {
      const apiVenues = await venueService.getAllVenues();
      const uiVenues = (apiVenues || []).map(mapToUiVenue);
      setVenues(uiVenues);
      setFilteredVenues(uiVenues);
    } catch (error: any) {
      console.error('Error fetching venues:', error);
      if (error.response?.status === 401) {
        setError('Your session has expired. Please log in again.');
        setHasAuthIssue(true);
      } else {
        setError(error.response?.data?.message || 'Failed to load venues');
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
  }, [searchText, statsFilter, venues]);

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
    } catch (error) {
      console.error('Failed to update venue status:', error);
      setError('Failed to update venue status. Please try again.');
    }
  };

  const confirmDelete = async () => {
    if (!selectedVenue) return;
    try {
      await venueService.deleteVenue(selectedVenue.id);
      setVenues(venues.filter(v => v.id !== selectedVenue.id));
      setShowDeleteModal(false);
      setSelectedVenue(null);
    } catch (error) {
      console.error('Failed to delete venue:', error);
      setError('Failed to delete venue. Please try again.');
    }
  };

  const handleSubmitVenue = async (formData: any, selectedLocation: VenueLocationData | null) => {
    try {
      const capacity = Number.parseInt(formData.capacity);
      if (Number.isNaN(capacity)) {
        setError('Capacity must be a valid number');
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
      } else {
        const created = await venueService.createVenue(apiVenue);
        setVenues([...venues, mapToUiVenue(created)]);
        setShowAddPanel(false);
      }
      setSelectedVenue(null);
    } catch (error) {
      console.error('Failed to save venue:', error);
      setError('Failed to save venue. Please try again.');
    }
  };

  return (
    <MainLayout>
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Icons.MapPin />
              Venue Management
            </h1>
            <p className="text-gray-500 mt-1">Manage your locations and venue settings</p>
          </div>
          <button
            onClick={handleAddVenue}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg font-semibold shadow-md hover:bg-red-700 transition-colors"
          >
            <Icons.Plus />
            Add Venue
          </button>
        </div>

        {/* Search & Stats */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Icons.Search />
            </span>
            <input
              type="text"
              placeholder="Search venues..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full h-12 pl-12 pr-4 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
            />
          </div>
          <VenueStatsBar
            venues={venues}
            onFilterClick={setStatsFilter}
            activeFilter={statsFilter}
          />
        </div>

        {/* View Toggle & Refresh */}
        <div className="flex items-center justify-between">
          <ViewToggle activeView={viewMode} onViewChange={setViewMode} />
          <button
            onClick={loadVenues}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icons.Refresh />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Auth Error Message */}
        {hasAuthIssue && (
          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800">Authentication issue detected. Please sign out and sign back in.</p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Log Out
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && !hasAuthIssue && (
          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-600 hover:text-red-800"
            >
              <Icons.X />
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-gray-600 font-medium">Loading venues...</p>
          </div>
        ) : filteredVenues.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16 bg-gray-50 rounded-2xl">
            <Icons.MapPin />
            <h3 className="text-lg font-semibold text-gray-900 mt-4">No venues found</h3>
            <p className="text-gray-500 mt-2">Adjust your search criteria or add a new venue.</p>
            <button
              onClick={handleAddVenue}
              className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              <Icons.Plus />
              Add Venue
            </button>
          </div>
        ) : (
          /* Content */
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVenues.map(venue => (
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
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Venue</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Capacity</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Requirements</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">GPS</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredVenues.map(venue => (
                      <VenueListRow
                        key={venue.id}
                        venue={venue}
                        onEdit={handleEditVenue}
                        onView={handleViewVenue}
                        onToggleStatus={handleToggleStatus}
                        onDelete={handleDeleteVenue}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Map View */}
            {viewMode === 'map' && (
              <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
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
              </div>
            )}
          </>
        )}
      </div>

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

      {showDeleteModal && (
        <DeleteConfirmModal
          venue={selectedVenue}
          onClose={() => { setShowDeleteModal(false); setSelectedVenue(null); }}
          onConfirm={confirmDelete}
        />
      )}
    </MainLayout>
  );
};

export default VenueManagement;
