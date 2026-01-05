/**
 * Shifts Service
 * Handles fetching and managing shifts from the backend API
 */

import { apiService } from './api';
import { Shift } from '../store/slices/shiftsSlice';
import notificationService from './notificationService';

/**
 * Paginated response from the backend
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

class ShiftsService {
  /**
   * Transform backend shift data to frontend Shift interface
   */
  private transformShift(shift: any): Shift {
    return {
      id: shift.id,
      venue: {
        id: shift.venue_details.id,
        name: shift.venue_details.name,
        address: shift.venue_details.address,
        latitude: parseFloat(shift.venue_details.latitude),
        longitude: parseFloat(shift.venue_details.longitude),
        venue_terms: shift.venue_details.venue_terms,
        requires_fire_exit_check: shift.venue_details.requires_fire_safety_checks,
        requires_capacity_check: shift.venue_details.requires_capacity_monitoring,
        requires_id_scan: shift.venue_details.requires_id_scan || false,
      },
      start_time: shift.start_time,
      end_time: shift.end_time,
      status: shift.status,
      check_in_time: shift.check_in_time,
      check_out_time: shift.check_out_time,
      sync_status: 'synced',
      // Transfer status fields
      pending_exchange: shift.pending_exchange,
      pending_release: shift.pending_release,
      approved_transfer: shift.approved_transfer,
    };
  }

  /**
   * Fetch shifts with pagination support
   */
  async fetchShifts(params: PaginationParams = {}): Promise<PaginatedResponse<Shift>> {
    try {
      const { page = 1, pageSize = 20 } = params;

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });

      const response = await apiService.get<PaginatedResponse<any>>(
        `/api/v1/shifts/?${queryParams.toString()}`
      );

      // Check if response is valid
      if (!response || !response.results) {
        console.error('[ShiftsService] Invalid response format:', response);
        return {
          count: 0,
          next: null,
          previous: null,
          results: [],
        };
      }

      // Transform the backend response to match frontend Shift interface
      const shifts = response.results.map((shift: any) => this.transformShift(shift));

      // Schedule notifications for upcoming shifts
      await this.scheduleNotificationsForShifts(shifts);

      return {
        count: response.count,
        next: response.next,
        previous: response.previous,
        results: shifts,
      };
    } catch (error) {
      console.error('[ShiftsService] Error fetching shifts:', error);
      throw error;
    }
  }

  /**
   * Schedule notifications for upcoming shifts
   * Called after fetching shifts to ensure reminders are set
   */
  private async scheduleNotificationsForShifts(shifts: Shift[]): Promise<void> {
    try {
      // Check if we have notification permissions
      const hasPermission = await notificationService.hasPermissions();
      if (!hasPermission) {
        console.log('[ShiftsService] Skipping notification scheduling - no permissions');
        return;
      }

      // Schedule notifications for all upcoming scheduled shifts
      for (const shift of shifts) {
        if (shift.status === 'scheduled') {
          await notificationService.scheduleShiftReminder(shift);
        }
      }

      console.log(`[ShiftsService] Scheduled notifications for ${shifts.filter(s => s.status === 'scheduled').length} shifts`);
    } catch (error) {
      console.error('[ShiftsService] Error scheduling notifications:', error);
      // Don't throw - notification scheduling shouldn't break shift fetching
    }
  }

  /**
   * Fetch all shifts (legacy method for backward compatibility)
   * @deprecated Use fetchShifts with pagination instead
   */
  async fetchAllShifts(): Promise<Shift[]> {
    const response = await this.fetchShifts({ page: 1, pageSize: 100 });
    return response.results;
  }

  /**
   * Fetch a specific shift by ID (camelCase format)
   */
  async fetchShift(shiftId: number): Promise<Shift> {
    try {
      const response = await apiService.get<any>(`/api/v1/shifts/${shiftId}/`);
      return this.transformShift(response);
    } catch (error) {
      console.error('[ShiftsService] Error fetching shift:', error);
      throw error;
    }
  }

  /**
   * Check in to a shift
   */
  async checkIn(shiftId: number, data: {
    check_in_time: string;
    latitude: number;
    longitude: number;
    photo?: string;
    signature?: string;
  }): Promise<Shift> {
    try {
      const response = await apiService.post<Shift>(
        `/api/v1/shifts/${shiftId}/check-in/`,
        data
      );

      // Cancel notifications since shift has started
      await notificationService.cancelShiftReminders(shiftId);

      return response;
    } catch (error) {
      console.error('[ShiftsService] Error checking in:', error);
      throw error;
    }
  }

  /**
   * Check out from a shift
   */
  async checkOut(shiftId: number, data: {
    check_out_time: string;
    latitude: number;
    longitude: number;
    photo?: string;
    signature?: string;
  }): Promise<Shift> {
    try {
      const response = await apiService.post<Shift>(
        `/api/v1/shifts/${shiftId}/check-out/`,
        data
      );

      // Cancel notifications since shift has ended
      await notificationService.cancelShiftReminders(shiftId);

      return response;
    } catch (error) {
      console.error('[ShiftsService] Error checking out:', error);
      throw error;
    }
  }

  /**
   * Cancel a shift
   */
  async cancelShift(shiftId: number): Promise<Shift> {
    try {
      const response = await apiService.post<Shift>(
        `/api/v1/shifts/${shiftId}/cancel/`
      );

      // Cancel notifications since shift is cancelled
      await notificationService.cancelShiftReminders(shiftId);

      return response;
    } catch (error) {
      console.error('[ShiftsService] Error canceling shift:', error);
      throw error;
    }
  }
}

export const shiftsService = new ShiftsService();
