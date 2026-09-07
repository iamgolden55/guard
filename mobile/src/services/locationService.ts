/**
 * Location Service
 * GPS location verification for shift check-in/out
 */

import * as Location from 'expo-location';
import { logger } from '../utils/logger';

/**
 * How long to wait for a GPS fix before giving the officer an actionable
 * error. `getCurrentPositionAsync` has no timeout of its own.
 */
const LOCATION_TIMEOUT_MS = 15000;

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres, as reported by the device. */
  accuracy?: number;
  /**
   * Android's mock-location flag. Never a reason to block on its own — the
   * flag is set by developer-options tooling as well as by spoofing apps —
   * but it belongs in the attendance record so an anomaly is visible.
   */
  mocked?: boolean;
}

export interface LocationVerificationResult {
  success: boolean;
  distance?: number; // Distance in meters
  currentLocation?: LocationCoordinates;
  error?: string;
}

class LocationService {
  /**
   * Request location permissions from user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        logger.warn('[LocationService] Permission denied');
        return false;
      }

      logger.info('[LocationService] Permission granted');
      return true;
    } catch (error) {
      logger.error('[LocationService] Permission request error:', error);
      return false;
    }
  }

  /**
   * Get current device location
   */
  async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      logger.info('[LocationService] Getting current location...');

      // `timeInterval` and `distanceInterval` are watchPositionAsync options
      // and were inert here. What this call did lack was a deadline: a device
      // that cannot get a fix left the check-in flow hanging indefinitely,
      // with the officer standing at the door watching a spinner.
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_resolve, reject) =>
          setTimeout(
            () => reject(new Error('LOCATION_TIMEOUT')),
            LOCATION_TIMEOUT_MS,
          ),
        ),
      ]);

      const coords: LocationCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        // Both were previously dropped here. They are the only signals that
        // separate a real fix from a fabricated one, and the server now
        // records and flags them.
        accuracy: location.coords.accuracy ?? undefined,
        mocked: (location as { mocked?: boolean }).mocked ?? undefined,
      };

      logger.debug('[LocationService] Current location:', coords);
      return coords;
    } catch (error) {
      if (error instanceof Error && error.message === 'LOCATION_TIMEOUT') {
        logger.error('[LocationService] Timed out waiting for a GPS fix');
        throw new Error(
          "Couldn't get your location. Move somewhere with a clearer view of " +
          'the sky and try again, or ask your manager to record your attendance.',
        );
      }
      logger.error('[LocationService] Get location error:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(
    point1: LocationCoordinates,
    point2: LocationCoordinates
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.latitude * Math.PI) / 180;
    const φ2 = (point2.latitude * Math.PI) / 180;
    const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in meters

    return Math.round(distance);
  }

  /**
   * Verify if user is at venue location
   * @param venueLocation - Target venue coordinates
   * @param maxDistance - Maximum allowed distance in meters (default: 100m)
   */
  async verifyLocation(
    venueLocation: LocationCoordinates,
    maxDistance: number = 100
  ): Promise<LocationVerificationResult> {
    try {
      // Get current location
      const currentLocation = await this.getCurrentLocation();

      if (!currentLocation) {
        return {
          success: false,
          error: 'Unable to get your current location. Please ensure location services are enabled.',
        };
      }

      // Calculate distance
      const distance = this.calculateDistance(currentLocation, venueLocation);

      logger.info('[LocationService] Distance to venue:', distance, 'meters');

      // Check if within range
      if (distance <= maxDistance) {
        return {
          success: true,
          distance,
          currentLocation,
        };
      } else {
        return {
          success: false,
          distance,
          currentLocation,
          error: `You are ${distance}m away from the venue. You must be within ${maxDistance}m to check in.`,
        };
      }
    } catch (error: any) {
      logger.error('[LocationService] Verification error:', error);
      return {
        success: false,
        error: error.message || 'Location verification failed',
      };
    }
  }

  /**
   * Watch location changes (for real-time tracking during shift)
   * @param callback - Called when location changes
   * @returns Subscription object to remove listener
   */
  async watchLocation(
    callback: (location: LocationCoordinates) => void
  ): Promise<Location.LocationSubscription | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Update every 10 seconds
          distanceInterval: 5, // Update every 5 meters (more responsive for live tracking)
        },
        (location) => {
          const coords: LocationCoordinates = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          callback(coords);
        }
      );

      logger.info('[LocationService] Started watching location');
      return subscription;
    } catch (error) {
      logger.error('[LocationService] Watch location error:', error);
      return null;
    }
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(coords: LocationCoordinates): string {
    return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
  }

  /**
   * Get address from coordinates (reverse geocoding)
   */
  async getAddressFromCoordinates(
    coords: LocationCoordinates
  ): Promise<string | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync(coords);

      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        const parts = [
          address.street,
          address.city,
          address.region,
          address.postalCode,
        ].filter(Boolean);

        return parts.join(', ');
      }

      return null;
    } catch (error) {
      logger.error('[LocationService] Reverse geocode error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;
