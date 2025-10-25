/**
 * Venue Service
 * Handles venue data fetching and caching
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { logger } from '../utils/logger';

export interface VenueDetails {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  terms_and_conditions?: string;
  safety_protocols?: string;
  emergency_contacts?: Array<{
    name: string;
    role: string;
    phone: string;
  }>;
  required_checks?: string[];
  capacity_limit?: number;
  venue_type?: string;
  check_in_radius?: number;
}

class VenueService {
  private readonly CACHE_KEY_PREFIX = '@venue_';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Fetch venue details from API with caching
   */
  async getVenueDetails(venueId: number, forceRefresh = false): Promise<VenueDetails> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${venueId}`;

      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await this.getCachedVenue(cacheKey);
        if (cached) {
          logger.info('[VenueService] Returning cached venue details', { venueId });
          return cached;
        }
      }

      // Fetch from API
      logger.info('[VenueService] Fetching venue details from API', { venueId });
      const response = await api.get<VenueDetails>(`/venues/${venueId}/`);

      // Cache the result
      await this.cacheVenue(cacheKey, response.data);

      return response.data;
    } catch (error) {
      logger.error('[VenueService] Failed to fetch venue details', { venueId, error });
      
      // Try to return cached data even if expired as fallback
      const cacheKey = `${this.CACHE_KEY_PREFIX}${venueId}`;
      const cached = await this.getCachedVenue(cacheKey, true);
      
      if (cached) {
        logger.warn('[VenueService] Returning expired cached data as fallback', { venueId });
        return cached;
      }

      throw error;
    }
  }

  /**
   * Get venue terms specifically
   */
  async getVenueTerms(venueId: number): Promise<string | null> {
    try {
      const venue = await this.getVenueDetails(venueId);
      return venue.terms_and_conditions || null;
    } catch (error) {
      logger.error('[VenueService] Failed to get venue terms', { venueId, error });
      return null;
    }
  }

  /**
   * Get venue safety protocols
   */
  async getVenueSafetyProtocols(venueId: number): Promise<string | null> {
    try {
      const venue = await this.getVenueDetails(venueId);
      return venue.safety_protocols || null;
    } catch (error) {
      logger.error('[VenueService] Failed to get safety protocols', { venueId, error });
      return null;
    }
  }

  /**
   * Get venue emergency contacts
   */
  async getVenueEmergencyContacts(
    venueId: number
  ): Promise<VenueDetails['emergency_contacts']> {
    try {
      const venue = await this.getVenueDetails(venueId);
      return venue.emergency_contacts || [];
    } catch (error) {
      logger.error('[VenueService] Failed to get emergency contacts', { venueId, error });
      return [];
    }
  }

  /**
   * Cache venue data
   */
  private async cacheVenue(key: string, venue: VenueDetails): Promise<void> {
    try {
      const cacheData = {
        venue,
        timestamp: Date.now(),
      };

      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      logger.debug('[VenueService] Cached venue data', { venueId: venue.id });
    } catch (error) {
      logger.error('[VenueService] Failed to cache venue', { error });
    }
  }

  /**
   * Get cached venue data if not expired
   */
  private async getCachedVenue(
    key: string,
    ignoreExpiry = false
  ): Promise<VenueDetails | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const { venue, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Check if cache is expired
      if (!ignoreExpiry && age > this.CACHE_DURATION) {
        logger.debug('[VenueService] Cache expired', { age, venueId: venue.id });
        return null;
      }

      return venue;
    } catch (error) {
      logger.error('[VenueService] Failed to read cache', { error });
      return null;
    }
  }

  /**
   * Clear cached venue data
   */
  async clearVenueCache(venueId: number): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_KEY_PREFIX}${venueId}`;
      await AsyncStorage.removeItem(cacheKey);
      logger.info('[VenueService] Cleared venue cache', { venueId });
    } catch (error) {
      logger.error('[VenueService] Failed to clear cache', { venueId, error });
    }
  }

  /**
   * Clear all venue caches
   */
  async clearAllVenueCaches(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const venueKeys = keys.filter((key) => key.startsWith(this.CACHE_KEY_PREFIX));

      await AsyncStorage.multiRemove(venueKeys);
      logger.info('[VenueService] Cleared all venue caches', { count: venueKeys.length });
    } catch (error) {
      logger.error('[VenueService] Failed to clear all caches', { error });
    }
  }

  /**
   * Prefetch venue data for offline use
   */
  async prefetchVenue(venueId: number): Promise<void> {
    try {
      logger.info('[VenueService] Prefetching venue for offline use', { venueId });
      await this.getVenueDetails(venueId, true);
    } catch (error) {
      logger.error('[VenueService] Failed to prefetch venue', { venueId, error });
    }
  }

  /**
   * Batch prefetch venues
   */
  async prefetchVenues(venueIds: number[]): Promise<void> {
    logger.info('[VenueService] Batch prefetching venues', { count: venueIds.length });

    const promises = venueIds.map((id) => this.prefetchVenue(id));
    await Promise.allSettled(promises);

    logger.info('[VenueService] Batch prefetch completed');
  }
}

// Export singleton instance
export const venueService = new VenueService();
export default venueService;
