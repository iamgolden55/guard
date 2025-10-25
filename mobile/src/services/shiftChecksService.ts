/**
 * Shift Checks Service
 * Handles API calls for venue safety checks (Fire Exit, Capacity, Toilet)
 */

import { apiService } from './api';

// Check Types
export interface BaseCheck {
  id: number;
  shift: number;
  timestamp: string;
  photo_evidence?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

export interface FireExitCheck extends BaseCheck {
  exit_name: string;
  is_clear: boolean;
  is_properly_marked: boolean;
  is_accessible: boolean;
}

export interface CapacityCheck extends BaseCheck {
  current_count: number;
  venue_capacity: number;
  is_at_capacity: boolean;
  action_taken?: string;
}

export interface ToiletCheck extends BaseCheck {
  location_name: string;
  condition: 'clean' | 'needs_cleaning' | 'requires_maintenance';
  needs_attention: boolean;
  is_out_of_order: boolean;
  supplies_needed: string[];
}

class ShiftChecksService {
  /**
   * Submit Fire Exit Check
   */
  async submitFireExitCheck(data: {
    shift: number;
    exit_name: string;
    is_clear: boolean;
    is_properly_marked: boolean;
    is_accessible: boolean;
    photo_evidence?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    notes?: string;
  }): Promise<FireExitCheck> {
    try {
      // Transform camelCase to snake_case for backend
      const payload: any = {
        shift: data.shift,
        exit_name: data.exit_name.trim(),
        is_clear: data.is_clear,
        is_properly_marked: data.is_properly_marked,
        is_accessible: data.is_accessible,
        timestamp: new Date().toISOString(),
      };

      // Only add optional fields if they exist
      if (data.photo_evidence) {
        payload.photo_evidence = data.photo_evidence;
      }

      if (data.location) {
        // Location is stored as JSONField in backend - send as object
        payload.location = {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        };
      }

      if (data.notes && data.notes.trim()) {
        payload.notes = data.notes.trim();
      }

      console.log('[ShiftChecksService] Submitting fire exit check payload:', {
        ...payload,
        photo_evidence: payload.photo_evidence ? `${payload.photo_evidence.length} chars` : 'none',
      });

      const response = await apiService.post<FireExitCheck>(
        '/api/v1/fire-exit-checks/',
        payload
      );

      return response;
    } catch (error) {
      console.error('[ShiftChecksService] Error submitting fire exit check:', error);
      throw error;
    }
  }

  /**
   * Submit Capacity Check
   */
  async submitCapacityCheck(data: {
    shift: number;
    current_count: number;
    venue_capacity: number;
    is_at_capacity: boolean;
    action_taken?: string;
    photo_evidence?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    notes?: string;
  }): Promise<CapacityCheck> {
    try {
      const payload: any = {
        shift: data.shift,
        current_count: data.current_count,
        venue_capacity: data.venue_capacity,
        is_at_capacity: data.is_at_capacity,
        timestamp: new Date().toISOString(),
      };

      // Only add optional fields if they exist
      if (data.action_taken && data.action_taken.trim()) {
        payload.action_taken = data.action_taken.trim();
      }

      if (data.photo_evidence) {
        payload.photo_evidence = data.photo_evidence;
      }

      if (data.location) {
        payload.location = {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        };
      }

      if (data.notes && data.notes.trim()) {
        payload.notes = data.notes.trim();
      }

      console.log('[ShiftChecksService] Submitting capacity check payload:', {
        ...payload,
        photo_evidence: payload.photo_evidence ? `${payload.photo_evidence.length} chars` : 'none',
      });

      const response = await apiService.post<CapacityCheck>(
        '/api/v1/capacity-checks/',
        payload
      );

      return response;
    } catch (error) {
      console.error('[ShiftChecksService] Error submitting capacity check:', error);
      throw error;
    }
  }

  /**
   * Submit Toilet Check
   */
  async submitToiletCheck(data: {
    shift: number;
    location_name: string;
    condition: 'clean' | 'needs_cleaning' | 'requires_maintenance';
    needs_attention: boolean;
    is_out_of_order: boolean;
    supplies_needed: string[];
    photo_evidence?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    notes?: string;
  }): Promise<ToiletCheck> {
    try {
      const payload: any = {
        shift: data.shift,
        location_name: data.location_name.trim(),
        condition: data.condition,
        needs_attention: data.needs_attention,
        is_out_of_order: data.is_out_of_order,
        supplies_needed: data.supplies_needed,
        timestamp: new Date().toISOString(),
      };

      // Only add optional fields if they exist
      if (data.photo_evidence) {
        payload.photo_evidence = data.photo_evidence;
      }

      if (data.location) {
        payload.location = {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        };
      }

      if (data.notes && data.notes.trim()) {
        payload.notes = data.notes.trim();
      }

      console.log('[ShiftChecksService] Submitting toilet check payload:', {
        ...payload,
        photo_evidence: payload.photo_evidence ? `${payload.photo_evidence.length} chars` : 'none',
      });

      const response = await apiService.post<ToiletCheck>(
        '/api/v1/toilet-checks/',
        payload
      );

      return response;
    } catch (error) {
      console.error('[ShiftChecksService] Error submitting toilet check:', error);
      throw error;
    }
  }

  /**
   * Get checks for a specific shift
   */
  async getShiftChecks(shiftId: number): Promise<{
    fireExitChecks: FireExitCheck[];
    capacityChecks: CapacityCheck[];
    toiletChecks: ToiletCheck[];
  }> {
    try {
      // Fetch all check types in parallel
      const [fireExitChecks, capacityChecks, toiletChecks] = await Promise.all([
        apiService.get<{ results: FireExitCheck[] }>(
          `/api/v1/fire-exit-checks/?shift=${shiftId}`
        ),
        apiService.get<{ results: CapacityCheck[] }>(
          `/api/v1/capacity-checks/?shift=${shiftId}`
        ),
        apiService.get<{ results: ToiletCheck[] }>(
          `/api/v1/toilet-checks/?shift=${shiftId}`
        ),
      ]);

      return {
        fireExitChecks: fireExitChecks.results || [],
        capacityChecks: capacityChecks.results || [],
        toiletChecks: toiletChecks.results || [],
      };
    } catch (error) {
      console.error('[ShiftChecksService] Error fetching shift checks:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const shiftChecksService = new ShiftChecksService();
