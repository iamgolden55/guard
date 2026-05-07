import api from './api';
import type { Venue, VenueRequest, VenueResponse } from '../types/venue';

// Convert backend fields to frontend format
const mapToFrontendVenue = (backendVenue: any): Venue => ({
  id: backendVenue.id,
  name: backendVenue.name,
  address: backendVenue.address,
  city: backendVenue.city,
  postal_code: backendVenue.postal_code,
  country: backendVenue.country || 'United Kingdom', // Default to UK if not specified
  is_active: backendVenue.is_active,
  capacity: backendVenue.capacity,
  contact_name: backendVenue.contact_name,
  contact_email: backendVenue.contact_email,
  contact_phone: backendVenue.contact_phone,
  description: backendVenue.description,
  terms_and_conditions: backendVenue.terms_and_conditions,
  requires_fire_safety_checks: backendVenue.requires_fire_safety_checks,
  requires_capacity_monitoring: backendVenue.requires_capacity_monitoring,
  requires_toilet_checks: backendVenue.requires_toilet_checks,
  terms_version: backendVenue.terms_version,
  latitude: backendVenue.latitude ? Number(backendVenue.latitude) : undefined,
  longitude: backendVenue.longitude ? Number(backendVenue.longitude) : undefined,
  created_at: backendVenue.created_at,
  updated_at: backendVenue.updated_at
});

// Convert frontend fields to backend format
const mapToBackendVenue = (frontendVenue: any): VenueRequest => ({
  name: frontendVenue.name,
  address: frontendVenue.address,
  city: frontendVenue.city,
  postal_code: frontendVenue.postal_code,
  country: frontendVenue.country || 'United Kingdom', // Default to UK if not specified
  is_active: frontendVenue.is_active,
  capacity: frontendVenue.capacity,
  contact_name: frontendVenue.contact_name,
  contact_email: frontendVenue.contact_email,
  contact_phone: frontendVenue.contact_phone,
  description: frontendVenue.description,
  terms_and_conditions: frontendVenue.terms_and_conditions,
  requires_fire_safety_checks: frontendVenue.requires_fire_safety_checks,
  requires_capacity_monitoring: frontendVenue.requires_capacity_monitoring,
  requires_toilet_checks: frontendVenue.requires_toilet_checks,
  terms_version: frontendVenue.terms_version,
  latitude: frontendVenue.latitude,
  longitude: frontendVenue.longitude
});

class VenueService {
  // Get all venues
  async getAllVenues(): Promise<Venue[]> {
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`Attempting to fetch venues (attempt ${retryCount + 1}/${maxRetries + 1})...`);

        // Sprint 3: Authentication via httpOnly cookies (sent automatically with api.get)
        const response = await api.get('/api/v1/venues/');
        console.log('Venue API response:', response);
        
        // Handle different response formats
        if (Array.isArray(response.data)) {
          // If response.data is already an array of venues
          console.log(`Received ${response.data.length} venues in array format`);
          return response.data.map(mapToFrontendVenue);
        } else if (response.data.venues && Array.isArray(response.data.venues)) {
          // If response.data has a venues property that is an array
          console.log(`Received ${response.data.venues.length} venues in object.venues format`);
          return response.data.venues.map(mapToFrontendVenue);
        } else if (response.data && typeof response.data === 'object') {
          // Try to handle other potential response formats
          console.log('Received unexpected response format, attempting to extract venues');
          console.log('Response data keys:', Object.keys(response.data));
          
          // Look for any array property that might contain venues
          for (const key of Object.keys(response.data)) {
            if (Array.isArray(response.data[key])) {
              console.log(`Found array in response.data.${key}, trying to use it`);
              return response.data[key].map(mapToFrontendVenue);
            }
          }
          
          // If we find a single venue object, wrap it in an array
          if (response.data.id || response.data.name) {
            console.log('Found a single venue object, converting to array');
            return [mapToFrontendVenue(response.data)];
          }
          
          console.error('Could not identify venues in the response:', response.data);
          throw new Error('Unexpected API response format');
        } else {
          console.error('Unexpected response format:', response.data);
          throw new Error('Unexpected API response format');
        }
      } catch (error: any) {
        console.error('Error fetching venues (attempt ' + (retryCount + 1) + '):', error);
        
        // If we've reached max retries, throw the error
        if (retryCount === maxRetries) {
          throw error;
        }
        
        // Check if the error is 401 (unauthorized) - no point retrying
        if (error.response && error.response.status === 401) {
          console.error('Authentication error - token invalid or expired');
          throw error;
        }
        
        // Increase retry counter
        retryCount++;
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    // This should never be reached due to the while loop and throw in the catch block
    throw new Error('Failed to fetch venues after maximum retries');
  }

  // Get a specific venue by ID
  async getVenue(id: number): Promise<Venue> {
    try {
      const response = await api.get(`/api/v1/venues/${id}/`);
      return mapToFrontendVenue(response.data);
    } catch (error) {
      console.error(`Error fetching venue with ID ${id}:`, error);
      throw error;
    }
  }

  // Create a new venue
  async createVenue(venueData: Venue): Promise<Venue> {
    try {
      const backendData = mapToBackendVenue(venueData);
      const response = await api.post<VenueResponse>('/api/v1/venues/', backendData);
      return mapToFrontendVenue(response.data.venue);
    } catch (error) {
      console.error('Error creating venue:', error);
      throw error;
    }
  }

  // Update an existing venue
  async updateVenue(id: number, venueData: Partial<Venue>): Promise<Venue> {
    try {
      const backendData = mapToBackendVenue(venueData);
      const response = await api.put<VenueResponse>(`/api/v1/venues/${id}/`, backendData);
      return mapToFrontendVenue(response.data.venue);
    } catch (error) {
      console.error(`Error updating venue with ID ${id}:`, error);
      throw error;
    }
  }

  // Update venue status (active/inactive)
  async updateVenueStatus(id: number, isActive: boolean): Promise<Venue> {
    try {
      const response = await api.patch<VenueResponse>(`/api/v1/venues/${id}/`, { is_active: isActive });
      return mapToFrontendVenue(response.data.venue);
    } catch (error) {
      console.error(`Error updating status of venue with ID ${id}:`, error);
      throw error;
    }
  }

  // Delete a venue
  async deleteVenue(id: number): Promise<void> {
    try {
      await api.delete(`/api/v1/venues/${id}/`);
    } catch (error) {
      console.error(`Error deleting venue with ID ${id}:`, error);
      throw error;
    }
  }
}

export default new VenueService(); 