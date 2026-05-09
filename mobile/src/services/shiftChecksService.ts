/**
 * Shift Checks Service
 * Handles API calls for venue safety checks (Fire Exit, Capacity, Toilet)
 */

import { apiService } from './api';

/**
 * Details of the staff member who performed a check
 * Used for attribution in multi-staff shifts
 */
export interface PerformedByDetails {
  id: number;
  first_name: string;
  last_name: string;
}

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
  // Multi-staff shift support
  shift_group?: string | null;
  performed_by?: number | null;
  performed_by_details?: PerformedByDetails | null;
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

export interface CapacityCheckSlotMiss {
  id: number;
  shift_group: string;
  venue: number;
  expected_at: string;
  detected_at: string;
  acknowledged: boolean;
  acknowledged_by?: number | null;
  acknowledged_by_details?: PerformedByDetails | null;
  acknowledged_at?: string | null;
  acknowledgement_reason: string;
}

export interface CapacityLogbookSignoff {
  id: number;
  shift_group: string;
  venue: number;
  closed_by_name: string;
  closed_by_role: string;
  signature: string;
  signed_at?: string | null;
  override_reason: string;
  closed_by_staff?: number | null;
  closed_by_staff_details?: PerformedByDetails | null;
  notes: string;
  total_checks: number;
  total_missed: number;
  created_at: string;
}

export interface CapacityLogbookView {
  shift_group: string;
  venue_id: number;
  venue_capacity: number;
  interval_minutes: number;
  warning_threshold_pct: number;
  next_due_at: string | null;
  last_check: CapacityCheck | null;
  checks: CapacityCheck[];
  misses: CapacityCheckSlotMiss[];
  signoff: CapacityLogbookSignoff | null;
}

/**
 * Toilet Check Interface
 *
 * Note: The 'condition' field uses mobile-friendly values in the UI:
 * - 'clean' (maps to 'excellent' in backend)
 * - 'needs_cleaning' (maps to 'fair' in backend)
 * - 'requires_maintenance' (maps to 'critical' in backend)
 *
 * The submitToiletCheck method handles the mapping automatically.
 * Backend accepts: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
 *
 * Also note: supplies_needed is an array in the mobile app but gets converted
 * to a comma-separated string when sending to the backend.
 */
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
      // Map mobile condition values to backend's expected values
      const conditionMap: Record<string, string> = {
        'clean': 'excellent',
        'needs_cleaning': 'fair',
        'requires_maintenance': 'critical'
      };

      const payload: any = {
        shift: data.shift,
        location_name: data.location_name.trim(),
        condition: conditionMap[data.condition] || 'good', // Map to backend values
        needs_attention: data.needs_attention,
        is_out_of_order: data.is_out_of_order,
        // Convert supplies array to comma-separated string for backend
        supplies_needed: data.supplies_needed.length > 0
          ? data.supplies_needed.join(', ')
          : '',
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
      const [fireExitChecks, capacityChecks, toiletChecksResponse] = await Promise.all([
        apiService.get<{ results: FireExitCheck[] }>(
          `/api/v1/fire-exit-checks/?shift=${shiftId}`
        ),
        apiService.get<{ results: CapacityCheck[] }>(
          `/api/v1/capacity-checks/?shift=${shiftId}`
        ),
        apiService.get<{ results: any[] }>(
          `/api/v1/toilet-checks/?shift=${shiftId}`
        ),
      ]);

      // Map backend condition values back to mobile-friendly values
      const reverseConditionMap: Record<string, 'clean' | 'needs_cleaning' | 'requires_maintenance'> = {
        'excellent': 'clean',
        'good': 'clean',
        'fair': 'needs_cleaning',
        'poor': 'needs_cleaning',
        'critical': 'requires_maintenance'
      };

      // Transform toilet checks to match mobile interface
      const toiletChecks: ToiletCheck[] = (toiletChecksResponse.results || []).map((check: any) => ({
        ...check,
        condition: reverseConditionMap[check.condition] || 'clean',
        // Convert supplies_needed string back to array
        supplies_needed: check.supplies_needed
          ? check.supplies_needed.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
      }));

      return {
        fireExitChecks: fireExitChecks.results || [],
        capacityChecks: capacityChecks.results || [],
        toiletChecks,
      };
    } catch (error) {
      console.error('[ShiftChecksService] Error fetching shift checks:', error);
      throw error;
    }
  }

  /**
   * Get all capacity checks for a shift_group, ordered newest-first.
   * Used by the LogbookScreen to render the chronological audit trail.
   */
  async getCapacityChecksForGroup(shiftGroup: string): Promise<CapacityCheck[]> {
    const response = await apiService.get<{ results: CapacityCheck[] }>(
      `/api/v1/capacity-checks/?shift_group=${encodeURIComponent(shiftGroup)}`
    );
    return response.results || [];
  }

  /**
   * Get the latest capacity check for a shift_group (or null).
   * Used by CapacityCheckScreen to show "last logged X min ago by Y".
   */
  async getLatestCapacityCheck(shiftGroup: string): Promise<CapacityCheck | null> {
    const checks = await this.getCapacityChecksForGroup(shiftGroup);
    return checks[0] || null;
  }

  /**
   * Get missed-slot records for a shift_group.
   */
  async getCapacityMisses(shiftGroup: string): Promise<CapacityCheckSlotMiss[]> {
    const response = await apiService.get<{ results: CapacityCheckSlotMiss[] }>(
      `/api/v1/capacity-check-misses/?shift_group=${encodeURIComponent(shiftGroup)}`
    );
    return response.results || [];
  }

  /**
   * Acknowledge a missed slot with a reason.
   */
  async acknowledgeMiss(missId: number, reason: string): Promise<CapacityCheckSlotMiss> {
    return await apiService.post<CapacityCheckSlotMiss>(
      `/api/v1/capacity-check-misses/${missId}/acknowledge/`,
      { acknowledgement_reason: reason }
    );
  }

  /**
   * Get the logbook signoff record for a shift_group, if it exists.
   */
  async getLogbookSignoff(shiftGroup: string): Promise<CapacityLogbookSignoff | null> {
    const response = await apiService.get<{ results: CapacityLogbookSignoff[] }>(
      `/api/v1/capacity-logbooks/?shift_group=${encodeURIComponent(shiftGroup)}`
    );
    return (response.results && response.results[0]) || null;
  }

  /**
   * Submit the end-of-shift logbook signoff.
   *
   * Either signature+name path OR override path:
   *  - { shift_group, venue, closed_by_name, closed_by_role, signature, notes? }
   *  - { shift_group, venue, override_reason, notes? }
   */
  async submitLogbookSignoff(payload: {
    shift_group: string;
    venue: number;
    closed_by_name?: string;
    closed_by_role?: string;
    signature?: string;
    override_reason?: string;
    notes?: string;
  }): Promise<CapacityLogbookSignoff> {
    return await apiService.post<CapacityLogbookSignoff>(
      `/api/v1/capacity-logbooks/`,
      payload
    );
  }
}

// Export singleton instance
export const shiftChecksService = new ShiftChecksService();
