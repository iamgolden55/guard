/**
 * Leave Management Service
 * Handles all leave-related API calls
 */

import { apiService } from './api';
import type {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestFormData,
  LeaveRequestFilterOptions,
  LeavePaginatedResponse,
  LeaveCalendarEvent,
  LeaveStatistics,
} from '../types/leave.types';
import { logger } from '../utils/logger';

const BASE_URL = '/api/v1/leave';

class LeaveService {
  /**
   * Leave Types
   */
  async getLeaveTypes(): Promise<LeaveType[]> {
    try {
      logger.info('[LeaveService] Fetching leave types');
      const response = await apiService.get<{ results: LeaveType[] }>(`${BASE_URL}/types/`);
      logger.info('[LeaveService] ✅ Leave types fetched:', response.results?.length);
      return response.results || [];
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching leave types:', error);
      throw error;
    }
  }

  async getLeaveType(id: number): Promise<LeaveType> {
    try {
      logger.info('[LeaveService] Fetching leave type:', id);
      const response = await apiService.get<LeaveType>(`${BASE_URL}/types/${id}/`);
      logger.info('[LeaveService] ✅ Leave type fetched');
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching leave type:', error);
      throw error;
    }
  }

  /**
   * Leave Balances
   */
  async getMyBalances(): Promise<LeaveBalance[]> {
    try {
      logger.info('[LeaveService] Fetching my leave balances');
      const response = await apiService.get<{ balances: LeaveBalance[] }>(`${BASE_URL}/balances/my_balances/`);
      logger.info('[LeaveService] ✅ Leave balances fetched:', response.balances?.length);
      return response.balances || [];
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching leave balances:', error);
      throw error;
    }
  }

  async getBalance(id: number): Promise<LeaveBalance> {
    try {
      logger.info('[LeaveService] Fetching leave balance:', id);
      const response = await apiService.get<LeaveBalance>(`${BASE_URL}/balances/${id}/`);
      logger.info('[LeaveService] ✅ Leave balance fetched');
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching leave balance:', error);
      throw error;
    }
  }

  /**
   * Leave Requests
   */
  async createLeaveRequest(data: LeaveRequestFormData): Promise<LeaveRequest> {
    try {
      logger.info('[LeaveService] Creating leave request:', {
        leave_type_id: data.leave_type_id,
        start_date: data.start_date,
        end_date: data.end_date,
      });

      const response = await apiService.post<LeaveRequest>(`${BASE_URL}/requests/`, data);
      logger.info('[LeaveService] ✅ Leave request created:', response.id);
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error creating leave request:', error);
      throw error;
    }
  }

  async getMyLeaveRequests(filters?: LeaveRequestFilterOptions): Promise<LeavePaginatedResponse<LeaveRequest>> {
    try {
      logger.info('[LeaveService] Fetching my leave requests', filters);

      const params = new URLSearchParams();

      if (filters?.status && filters.status !== 'ALL') {
        params.append('status', filters.status);
      }
      if (filters?.year) {
        params.append('year', filters.year.toString());
      }
      if (filters?.leave_type_id) {
        params.append('leave_type_id', filters.leave_type_id.toString());
      }
      if (filters?.page) {
        params.append('page', filters.page.toString());
      }
      if (filters?.page_size) {
        params.append('page_size', filters.page_size.toString());
      }

      const queryString = params.toString();
      const url = queryString ? `${BASE_URL}/requests/my_requests/?${queryString}` : `${BASE_URL}/requests/my_requests/`;

      const response = await apiService.get<LeavePaginatedResponse<LeaveRequest>>(url);
      logger.info('[LeaveService] ✅ Leave requests fetched:', response.results.length);
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching leave requests:', error);
      throw error;
    }
  }

  async getLeaveRequest(id: number): Promise<LeaveRequest> {
    try {
      logger.info('[LeaveService] Fetching leave request:', id);
      const response = await apiService.get<LeaveRequest>(`${BASE_URL}/requests/${id}/`);
      logger.info('[LeaveService] ✅ Leave request fetched');
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching leave request:', error);
      throw error;
    }
  }

  async updateLeaveRequest(id: number, data: Partial<LeaveRequestFormData>): Promise<LeaveRequest> {
    try {
      logger.info('[LeaveService] Updating leave request:', id);
      const response = await apiService.patch<LeaveRequest>(`${BASE_URL}/requests/${id}/`, data);
      logger.info('[LeaveService] ✅ Leave request updated');
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error updating leave request:', error);
      throw error;
    }
  }

  async cancelLeaveRequest(id: number): Promise<void> {
    try {
      logger.info('[LeaveService] Cancelling leave request:', id);
      await apiService.post(`${BASE_URL}/requests/${id}/cancel/`);
      logger.info('[LeaveService] ✅ Leave request cancelled');
    } catch (error) {
      logger.error('[LeaveService] ❌ Error cancelling leave request:', error);
      throw error;
    }
  }

  async deleteLeaveRequest(id: number): Promise<void> {
    try {
      logger.info('[LeaveService] Deleting leave request:', id);
      await apiService.delete(`${BASE_URL}/requests/${id}/`);
      logger.info('[LeaveService] ✅ Leave request deleted');
    } catch (error) {
      logger.error('[LeaveService] ❌ Error deleting leave request:', error);
      throw error;
    }
  }

  /**
   * Leave Calendar
   */
  async getLeaveCalendar(month?: string): Promise<LeaveCalendarEvent[]> {
    try {
      logger.info('[LeaveService] Fetching leave calendar', month);

      const params = month ? `?month=${month}` : '';
      const response = await apiService.get<LeaveCalendarEvent[]>(`${BASE_URL}/calendar/${params}`);

      logger.info('[LeaveService] ✅ Calendar events fetched:', response.length);
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching calendar:', error);
      throw error;
    }
  }

  /**
   * Leave Statistics
   */
  async getLeaveStatistics(year?: number): Promise<LeaveStatistics> {
    try {
      logger.info('[LeaveService] Fetching leave statistics', year);

      const params = year ? `?year=${year}` : '';
      const response = await apiService.get<LeaveStatistics>(`${BASE_URL}/requests/statistics/${params}`);

      logger.info('[LeaveService] ✅ Statistics fetched');
      return response;
    } catch (error) {
      logger.error('[LeaveService] ❌ Error fetching statistics:', error);
      throw error;
    }
  }

  /**
   * Utility Methods
   */
  calculateWorkingDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;

    // Iterate through each day
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      // Count Monday (1) to Friday (5)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }

  isWeekend(date: string): boolean {
    const dayOfWeek = new Date(date).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const leaveService = new LeaveService();
