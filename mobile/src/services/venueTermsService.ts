/**
 * Venue Terms Service
 * Manage venue terms acceptance tracking
 */

import { logger } from '../utils/logger';
import { apiService } from './api';

interface VenueTermsAcceptance {
  venueId: number;
  acceptedAt: string;
  termsVersion?: string;
}

class VenueTermsService {
  // In-memory cache (will be replaced with WatermelonDB in production)
  private acceptedVenues: Map<number, VenueTermsAcceptance> = new Map();

  /**
   * Check if user has accepted terms for a venue
   */
  async hasAcceptedTerms(venueId: number): Promise<boolean> {
    try {
      // Check in-memory cache first (fastest)
      if (this.acceptedVenues.has(venueId)) {
        logger.info('[VenueTermsService] Terms already accepted for venue (cache):', venueId);
        return true;
      }

      // Check backend API when online
      try {
        const response = await apiService.get<{
          hasAccepted: boolean;
          venue: string;
        }>(`/api/v1/venues/${venueId}/terms_acceptance/`);

        if (response.hasAccepted) {
          // Cache the result
          this.acceptedVenues.set(venueId, {
            venueId,
            acceptedAt: new Date().toISOString(),
            termsVersion: '1.0',
          });
          logger.info('[VenueTermsService] Terms accepted for venue (from backend):', venueId);
          return true;
        }
      } catch (apiError) {
        logger.warn('[VenueTermsService] Failed to check backend, using local cache only:', apiError);
        // Continue to check local database
      }

      // TODO: Check local database (WatermelonDB) for offline support
      // const localAcceptance = await database.collections
      //   .get('venue_terms_acceptances')
      //   .query(Q.where('venue_id', venueId))
      //   .fetch();

      // if (localAcceptance.length > 0) {
      //   this.acceptedVenues.set(venueId, {
      //     venueId,
      //     acceptedAt: localAcceptance[0].acceptedAt,
      //   });
      //   return true;
      // }

      logger.info('[VenueTermsService] No terms acceptance found for venue:', venueId);
      return false;
    } catch (error) {
      logger.error('[VenueTermsService] Error checking terms acceptance:', error);
      return false;
    }
  }

  /**
   * Record venue terms acceptance
   */
  async acceptTerms(venueId: number): Promise<void> {
    try {
      const acceptance: VenueTermsAcceptance = {
        venueId,
        acceptedAt: new Date().toISOString(),
        termsVersion: '1.0', // In production, this would come from venue settings
      };

      // Save to in-memory cache first (for immediate UI updates)
      this.acceptedVenues.set(venueId, acceptance);
      logger.info('[VenueTermsService] Terms accepted for venue:', venueId);

      // Call backend API to save acceptance to database
      try {
        const response = await apiService.post<{
          message: string;
          hasAccepted: boolean;
          acceptance?: any;
        }>(`/api/v1/venues/${venueId}/accept_terms/`);

        logger.info('[VenueTermsService] Terms acceptance saved to backend:', response.message);

        // Update cache with backend response data if available
        if (response.acceptance) {
          this.acceptedVenues.set(venueId, {
            venueId,
            acceptedAt: response.acceptance.accepted_at,
            termsVersion: response.acceptance.terms_version,
          });
        }
      } catch (apiError) {
        logger.warn('[VenueTermsService] Failed to sync to backend, will retry later:', apiError);
        // Don't throw - keep the local acceptance and queue for later sync

        // TODO: Queue for background sync when online
        // await syncService.queueSync({
        //   type: 'venue_terms_acceptance',
        //   venueId,
        //   acceptedAt: acceptance.acceptedAt,
        // });
      }

      // TODO: Save to local database (WatermelonDB) for offline persistence
      // await database.write(async () => {
      //   await database.collections
      //     .get('venue_terms_acceptances')
      //     .create((record) => {
      //       record.venueId = venueId;
      //       record.acceptedAt = acceptance.acceptedAt;
      //       record.termsVersion = acceptance.termsVersion;
      //       record.syncStatus = 'pending';
      //     });
      // });

      logger.info('[VenueTermsService] Terms acceptance saved locally');
    } catch (error) {
      logger.error('[VenueTermsService] Error saving terms acceptance:', error);
      throw error;
    }
  }

  /**
   * Clear acceptance cache (for testing or logout)
   */
  clearCache(): void {
    this.acceptedVenues.clear();
    logger.info('[VenueTermsService] Acceptance cache cleared');
  }

  /**
   * Get acceptance info for a venue
   */
  getAcceptanceInfo(venueId: number): VenueTermsAcceptance | undefined {
    return this.acceptedVenues.get(venueId);
  }
}

// Export singleton instance
export const venueTermsService = new VenueTermsService();
export default venueTermsService;
