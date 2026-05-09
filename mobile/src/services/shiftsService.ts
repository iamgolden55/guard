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
        capacity: shift.venue_details.capacity,
        capacity_check_interval_minutes: shift.venue_details.capacity_check_interval_minutes,
        capacity_warning_threshold_pct: shift.venue_details.capacity_warning_threshold_pct,
      },
      start_time: shift.start_time,
      end_time: shift.end_time,
      status: shift.status,
      check_in_time: shift.check_in_time,
      check_out_time: shift.check_out_time,
      notes: shift.notes,
      hourly_rate:
        shift.hourly_rate == null
          ? null
          : typeof shift.hourly_rate === 'number'
          ? shift.hourly_rate
          : parseFloat(shift.hourly_rate),
      is_special_event: !!shift.is_special_event,
      sync_status: 'synced',
      // Multi-staff shift fields
      shift_group: shift.shift_group || null,
      coworkers: shift.coworkers || [],
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

      // Use my_shifts endpoint to only fetch the current user's shifts
      // This is critical for admin/manager users who should only see their
      // own shifts in the mobile app, not all company shifts
      const response = await apiService.get<PaginatedResponse<any>>(
        `/api/v1/shifts/my_shifts/?${queryParams.toString()}`
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

      // NOTE: Local notification scheduling disabled to prevent duplicates.
      // Backend push notifications handle all shift reminders via Celery tasks.
      // See: thoughts/shared/research/2025-01-25-duplicate-shift-notifications.md
      // await this.scheduleNotificationsForShifts(shifts);

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
   * Fetch all company shifts for managers/admins with pagination + optional status filter.
   * Hits GET /api/v1/shifts/manager/all/ — which enforces manager/admin role server-side.
   */
  async getAllCompanyShifts(
    params: PaginationParams & { status?: string } = {}
  ): Promise<PaginatedResponse<Shift>> {
    try {
      const { page = 1, pageSize = 20, status } = params;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
      });
      if (status) {
        queryParams.set('status', status);
      }

      const response = await apiService.get<any>(
        `/api/v1/shifts/manager/all/?${queryParams.toString()}`
      );

      // manager/all may return a raw array or a paginated envelope. The
      // envelope uses {count, total_pages, current_page, page_size, results}
      // (no next/previous URLs), so synthesize `next` from the page math so
      // the existing reducer's `hasMore: response.next !== null` logic works.
      if (Array.isArray(response)) {
        return {
          count: response.length,
          next: null,
          previous: null,
          results: response.map((shift: any) => this.transformShift(shift)),
        };
      }

      if (!response || !Array.isArray(response.results)) {
        console.error('[ShiftsService] Invalid manager/all response:', response);
        return { count: 0, next: null, previous: null, results: [] };
      }

      const currentPage = Number(response.current_page ?? page);
      const totalPages = Number(response.total_pages ?? 1);
      const hasMore = Number.isFinite(currentPage) && Number.isFinite(totalPages)
        ? currentPage < totalPages
        : false;

      return {
        count: Number(response.count ?? response.results.length),
        next: hasMore ? 'more' : null,
        previous: currentPage > 1 ? 'prev' : null,
        results: response.results.map((shift: any) => this.transformShift(shift)),
      };
    } catch (error) {
      console.error('[ShiftsService] Error fetching company shifts:', error);
      throw error;
    }
  }

  /**
   * Create a new shift (admin/manager only).
   * POST /api/v1/shifts/  — backend scopes venue to the caller's company
   * and emails the assigned staff user automatically.
   */
  async createShift(payload: {
    staff_user: number;
    venue: number;
    start_time: string;
    end_time: string;
    required_security_role?: string;
    notes?: string;
    hourly_rate?: number;
    status?: string;
    is_published?: boolean;
  }): Promise<Shift> {
    try {
      const response = await apiService.post<any>('/api/v1/shifts/', payload);
      return this.transformShift(response);
    } catch (error) {
      console.error('[ShiftsService] Error creating shift:', error);
      throw error;
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
   * Create multiple shifts sharing one venue/time with different staff (admin/manager).
   * POST /api/v1/shifts/create_multi_staff/ — backend returns all created shifts and the
   * generated shift_group UUID so they can be grouped visually.
   */
  async createMultiStaffShifts(payload: {
    venue: number;
    staff_users: number[];
    start_time: string;
    end_time: string;
    required_security_role?: string;
    notes?: string;
    hourly_rate?: number | null;
    is_special_event?: boolean;
    status?: string;
  }): Promise<{ message: string; shifts: Shift[]; shift_group: string }> {
    try {
      const response = await apiService.post<any>(
        '/api/v1/shifts/create_multi_staff/',
        payload
      );
      const shifts = Array.isArray(response?.shifts)
        ? response.shifts.map((s: any) => this.transformShift(s))
        : [];
      return {
        message: response?.message ?? '',
        shifts,
        shift_group: response?.shift_group ?? '',
      };
    } catch (error) {
      console.error('[ShiftsService] Error creating multi-staff shifts:', error);
      throw error;
    }
  }

  /**
   * Approve (or reject) a shift as a manager/admin.
   * POST /api/v1/shifts/{id}/approve/ — backend requires `managerSignature`
   * (text is accepted) when `approved` is true.
   */
  async approveShift(
    shiftId: number,
    payload: { approved: boolean; managerSignature?: string; managerNotes?: string }
  ): Promise<Shift> {
    try {
      const response = await apiService.post<any>(
        `/api/v1/shifts/${shiftId}/approve/`,
        payload
      );
      return this.transformShift(response);
    } catch (error) {
      console.error('[ShiftsService] Error approving shift:', error);
      throw error;
    }
  }

  /**
   * Patch a shift (admin/manager reschedule or note update).
   * PATCH /api/v1/shifts/{id}/
   */
  async updateShift(
    shiftId: number,
    patch: {
      start_time?: string;
      end_time?: string;
      notes?: string;
      hourly_rate?: number | null;
      is_special_event?: boolean;
    }
  ): Promise<Shift> {
    try {
      const response = await apiService.patch<any>(`/api/v1/shifts/${shiftId}/`, patch);
      return this.transformShift(response);
    } catch (error) {
      console.error('[ShiftsService] Error updating shift:', error);
      throw error;
    }
  }

  /**
   * Cancel a shift
   */
  async cancelShift(shiftId: number): Promise<Shift> {
    try {
      const response = await apiService.post<any>(
        `/api/v1/shifts/${shiftId}/cancel/`
      );

      // Cancel notifications since shift is cancelled
      await notificationService.cancelShiftReminders(shiftId);

      return this.transformShift(response);
    } catch (error) {
      console.error('[ShiftsService] Error canceling shift:', error);
      throw error;
    }
  }
}

export const shiftsService = new ShiftsService();
