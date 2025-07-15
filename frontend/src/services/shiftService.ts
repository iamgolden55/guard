import api from './api';
import axios from 'axios';
import type {
  Shift,
  FireExitCheck,
  CapacityCheck,
  ToiletCheck,
  EnforcementVisit,
  Venue,
  ScheduledShift,
  ShiftTemplate,
  RecurringShiftPattern,
  RecurringPatternType,
  StaffProfile,
  ScheduledShiftStatus
} from '../types';
import { AcceptedVenueTerms } from '../types/profile';

// Create a separate API instance for shift-related endpoints that use /api/shifts/
const shiftApi = axios.create({
  baseURL: 'http://localhost:8000/api/shifts',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Add the same interceptors as the main api
shiftApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

shiftApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh logic here if needed
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

class ShiftService {
  // Venue-related methods
  async getVenues(): Promise<Venue[]> {
    const response = await api.get<Venue[]>('/venues/');
    return response.data;
  }

  // Terms and conditions acceptance
  async hasAcceptedVenueTerms(venueId: number): Promise<boolean> {
    try {
      const response = await api.get<{ hasAccepted: boolean }>(`/venues/${venueId}/terms_acceptance/`);
      return response.data.hasAccepted;
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      return false; // If there's an error, assume terms haven't been accepted
    }
  }

  async acceptVenueTerms(venueId: number): Promise<AcceptedVenueTerms> {
    const response = await api.post<AcceptedVenueTerms>(`/venues/${venueId}/accept_terms/`, {});
    return response.data;
  }

  // Staff profile methods
  async getStaffProfiles(): Promise<StaffProfile[]> {
    try {
      // Get users from the API instead of staff-profiles
      const response = await api.get<any[]>('/users/');
      
      // Check for empty response
      if (!response || !response.data) {
        console.warn('Empty response from users API');
        return [];
      }
      
      // Ensure data is an array
      if (!Array.isArray(response.data)) {
        console.warn('Users data is not an array:', response.data);
        return [];
      }
      
      // Map the user data to StaffProfile format
      const profiles: StaffProfile[] = response.data.map(user => ({
        id: user.id,
        userId: user.id,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email,
        phone: user.profile?.phone_number || null,
        profileImage: user.profile?.profile_image_url || null,
        qualifications: null,
        isActive: user.is_active
      }));
      
      return profiles;
    } catch (error) {
      console.error('Error fetching staff profiles:', error);
      return [];
    }
  }

  // Scheduled Shifts methods
  async getScheduledShifts(params?: {
    startDate?: string,
    endDate?: string,
    venueId?: number,
    staffId?: number,
    status?: ScheduledShiftStatus,
    isPublished?: boolean
  }): Promise<ScheduledShift[]> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      if (params.startDate) queryParams.append('start_date', params.startDate);
      if (params.endDate) queryParams.append('end_date', params.endDate);
      if (params.venueId) queryParams.append('venue', params.venueId.toString());
      if (params.staffId) queryParams.append('staff', params.staffId.toString());
      if (params.status) queryParams.append('status', params.status);
      if (params.isPublished !== undefined) queryParams.append('is_published', params.isPublished.toString());
    }
    
    const url = `/scheduled-shifts/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await api.get<ScheduledShift[]>(url);
    return response.data;
  }

  async getScheduledShiftById(shiftId: number): Promise<ScheduledShift> {
    const response = await api.get<ScheduledShift>(`/scheduled-shifts/${shiftId}/`);
    return response.data;
  }

  async createScheduledShift(data: {
    venueId: number,
    staffId?: number | null,
    startTime: string,
    endTime: string,
    notes?: string | null,
    isPublished?: boolean,
    requiresFireSafetyChecks?: boolean,
    requiresCapacityMonitoring?: boolean,
    requiresToiletChecks?: boolean,
    payRate?: number | null
  }): Promise<ScheduledShift> {
    const requestData = {
      venue: data.venueId,
      staff: data.staffId || null,
      start_time: data.startTime,
      end_time: data.endTime,
      notes: data.notes || null,
      is_published: data.isPublished !== undefined ? data.isPublished : false,
      requires_fire_safety_checks: data.requiresFireSafetyChecks !== undefined ? data.requiresFireSafetyChecks : false,
      requires_capacity_monitoring: data.requiresCapacityMonitoring !== undefined ? data.requiresCapacityMonitoring : false,
      requires_toilet_checks: data.requiresToiletChecks !== undefined ? data.requiresToiletChecks : false,
      pay_rate: data.payRate || null
    };
    
    const response = await api.post<ScheduledShift>('/scheduled-shifts/', requestData);
    return response.data;
  }

  async updateScheduledShift(shiftId: number, data: Partial<{
    venueId: number,
    staffId: number | null,
    startTime: string,
    endTime: string,
    notes: string | null,
    isPublished: boolean,
    status: ScheduledShiftStatus,
    requiresFireSafetyChecks: boolean,
    requiresCapacityMonitoring: boolean,
    requiresToiletChecks: boolean,
    payRate: number | null
  }>): Promise<ScheduledShift> {
    const requestData = {} as any;
    
    if (data.venueId !== undefined) requestData.venue = data.venueId;
    if (data.staffId !== undefined) requestData.staff = data.staffId;
    if (data.startTime !== undefined) requestData.start_time = data.startTime;
    if (data.endTime !== undefined) requestData.end_time = data.endTime;
    if (data.notes !== undefined) requestData.notes = data.notes;
    if (data.isPublished !== undefined) requestData.is_published = data.isPublished;
    if (data.status !== undefined) requestData.status = data.status;
    if (data.requiresFireSafetyChecks !== undefined) requestData.requires_fire_safety_checks = data.requiresFireSafetyChecks;
    if (data.requiresCapacityMonitoring !== undefined) requestData.requires_capacity_monitoring = data.requiresCapacityMonitoring;
    if (data.requiresToiletChecks !== undefined) requestData.requires_toilet_checks = data.requiresToiletChecks;
    if (data.payRate !== undefined) requestData.pay_rate = data.payRate;
    
    const response = await api.patch<ScheduledShift>(`/scheduled-shifts/${shiftId}/`, requestData);
    return response.data;
  }

  async deleteScheduledShift(shiftId: number): Promise<void> {
    await api.delete(`/scheduled-shifts/${shiftId}/`);
  }

  async publishScheduledShifts(shiftIds: number[]): Promise<ScheduledShift[]> {
    const response = await api.post<ScheduledShift[]>('/scheduled-shifts/publish/', { shift_ids: shiftIds });
    return response.data;
  }

  async assignStaffToShift(shiftId: number, staffId: number): Promise<ScheduledShift> {
    const response = await api.post<ScheduledShift>(`/scheduled-shifts/${shiftId}/assign/`, { staff_id: staffId });
    return response.data;
  }

  async unassignStaffFromShift(shiftId: number): Promise<ScheduledShift> {
    const response = await api.post<ScheduledShift>(`/scheduled-shifts/${shiftId}/unassign/`, {});
    return response.data;
  }

  // Recurring shift pattern methods
  async createRecurringPattern(data: {
    shiftId: number,
    patternType: RecurringPatternType,
    daysOfWeek?: number[],
    interval?: number,
    endDate?: string | null,
    endOccurrences?: number | null
  }): Promise<RecurringShiftPattern> {
    const requestData = {
      shift: data.shiftId,
      pattern_type: data.patternType,
      days_of_week: data.daysOfWeek || [],
      interval: data.interval || 1,
      end_date: data.endDate || null,
      end_occurrences: data.endOccurrences || null
    };
    
    const response = await api.post<RecurringShiftPattern>('/recurring-patterns/', requestData);
    return response.data;
  }

  async generateRecurringShifts(patternId: number): Promise<ScheduledShift[]> {
    const response = await api.post<ScheduledShift[]>(`/recurring-patterns/${patternId}/generate/`, {});
    return response.data;
  }

  // Shift templates methods
  async getShiftTemplates(): Promise<ShiftTemplate[]> {
    const response = await api.get<ShiftTemplate[]>('/shift-templates/');
    return response.data;
  }

  async createShiftTemplate(data: {
    name: string,
    description?: string | null,
    venueId: number,
    startTime: string,
    endTime: string,
    dayOfWeek?: number | null,
    requiresFireSafetyChecks?: boolean,
    requiresCapacityMonitoring?: boolean,
    requiresToiletChecks?: boolean
  }): Promise<ShiftTemplate> {
    const requestData = {
      name: data.name,
      description: data.description || null,
      venue: data.venueId,
      start_time: data.startTime,
      end_time: data.endTime,
      day_of_week: data.dayOfWeek !== undefined ? data.dayOfWeek : null,
      requires_fire_safety_checks: data.requiresFireSafetyChecks !== undefined ? data.requiresFireSafetyChecks : false,
      requires_capacity_monitoring: data.requiresCapacityMonitoring !== undefined ? data.requiresCapacityMonitoring : false,
      requires_toilet_checks: data.requiresToiletChecks !== undefined ? data.requiresToiletChecks : false
    };
    
    const response = await api.post<ShiftTemplate>('/shift-templates/', requestData);
    return response.data;
  }

  async applyShiftTemplate(templateId: number, data: {
    startDate: string,
    endDate: string,
    daysOfWeek?: number[],
    staffIds?: number[]
  }): Promise<ScheduledShift[]> {
    const requestData = {
      start_date: data.startDate,
      end_date: data.endDate,
      days_of_week: data.daysOfWeek || [],
      staff_ids: data.staffIds || []
    };
    
    const response = await api.post<ScheduledShift[]>(`/shift-templates/${templateId}/apply/`, requestData);
    return response.data;
  }

  // Bulk operations
  async createBulkShifts(data: {
    venueId: number,
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string,
    daysOfWeek: number[],
    staffIds?: number[],
    notes?: string,
    isPublished?: boolean,
    requiresFireSafetyChecks?: boolean,
    requiresCapacityMonitoring?: boolean,
    requiresToiletChecks?: boolean
  }): Promise<ScheduledShift[]> {
    const requestData = {
      venue_id: data.venueId,
      start_date: data.startDate,
      end_date: data.endDate,
      start_time: data.startTime,
      end_time: data.endTime,
      days_of_week: data.daysOfWeek,
      staff_ids: data.staffIds || [],
      notes: data.notes || '',
      is_published: data.isPublished !== undefined ? data.isPublished : false,
      requires_fire_safety_checks: data.requiresFireSafetyChecks !== undefined ? data.requiresFireSafetyChecks : false,
      requires_capacity_monitoring: data.requiresCapacityMonitoring !== undefined ? data.requiresCapacityMonitoring : false,
      requires_toilet_checks: data.requiresToiletChecks !== undefined ? data.requiresToiletChecks : false
    };
    
    const response = await api.post<ScheduledShift[]>('/scheduled-shifts/bulk/', requestData);
    return response.data;
  }

  async copyShifts(data: {
    sourceStartDate: string,
    sourceEndDate: string,
    targetStartDate: string,
    venueIds?: number[],
    includeStaffAssignments?: boolean
  }): Promise<ScheduledShift[]> {
    const requestData = {
      source_start_date: data.sourceStartDate,
      source_end_date: data.sourceEndDate,
      target_start_date: data.targetStartDate,
      venue_ids: data.venueIds || [],
      include_staff_assignments: data.includeStaffAssignments !== undefined ? data.includeStaffAssignments : true
    };
    
    const response = await api.post<ScheduledShift[]>('/scheduled-shifts/copy/', requestData);
    return response.data;
  }

  // Shift-related methods
  async getShifts(staffId?: number): Promise<Shift[]> {
    const url = staffId ? `/?staff=${staffId}` : '/';
    const response = await shiftApi.get<Shift[]>(url);
    return response.data;
  }

  async getMyShifts(): Promise<any[]> {
    try {
      console.log('getMyShifts: Making API call to /my_shifts/');
      // Use the correct shifts endpoint from the Django backend
      const response = await shiftApi.get<any>('/my_shifts/');
      
      console.log('getMyShifts: Raw API response:', response);
      console.log('getMyShifts: Response data:', response.data);
      
      // Handle different response structures
      let shifts = response.data;
      if (response.data.results) {
        shifts = response.data.results; // Paginated response
      }
      
      console.log(`getMyShifts: Success! Found ${shifts.length} shifts`);
      console.log('getMyShifts: Raw shifts data:', shifts);
      
      // Transform the backend data to match frontend interface
      const transformedShifts = shifts.map((shift: any) => {
        console.log('getMyShifts: Processing shift:', shift);
        return {
          id: shift.id,
          venue: {
            id: shift.venue_details?.id || shift.venue?.id || shift.venue,
            name: shift.venue_details?.name || shift.venue?.name || 'Unknown Venue',
            requiresFireSafetyChecks: shift.venue_details?.requires_fire_safety_checks || false,
            requiresCapacityMonitoring: shift.venue_details?.requires_capacity_monitoring || false,
            requiresToiletChecks: shift.venue_details?.requires_toilet_checks || false,
            maxCapacity: shift.venue_details?.capacity || null
          },
          startTime: shift.start_time || shift.startTime,
          endTime: shift.end_time || shift.endTime,
          status: shift.status || 'scheduled',
          managerApproved: shift.manager_approved || shift.managerApproved || false
        };
      });
      
      console.log('getMyShifts: Transformed shifts:', transformedShifts);
      return transformedShifts;
    } catch (error: any) {
      console.error('getMyShifts: Failed to fetch shifts:', error);
      console.error('getMyShifts: Error response:', error.response);
      console.error('getMyShifts: Error response data:', error.response?.data);
      throw error;
    }
  }

  async getAllShiftsForManager(): Promise<any[]> {
    try {
      // Fetch all shifts for manager/admin view with venue check summaries
      const response = await shiftApi.get<any>('/manager/all/');
      
      // Handle different response structures
      let shifts = response.data;
      if (response.data.results) {
        shifts = response.data.results; // Paginated response
      }
      
      console.log(`Manager view: Found ${shifts.length} shifts`);
      return shifts;
    } catch (error: any) {
      console.error('Failed to fetch manager shifts:', error);
      throw error;
    }
  }

  async getShiftById(shiftId: number): Promise<Shift> {
    const response = await shiftApi.get<Shift>(`/${shiftId}/`);
    return response.data;
  }

  async checkInShift(shiftId: number, data: {
    location: { latitude: number; longitude: number; accuracy: number };
    photo: string;
    signature: string;
  }): Promise<any> {
    const response = await shiftApi.post(`/${shiftId}/check_in/`, {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      photo: data.photo,
      signature: data.signature
    });
    return response.data;
  }

  async checkOutShift(shiftId: number, data: {
    location: { latitude: number; longitude: number; accuracy: number };
    photo: string;
    signature: string;
  }): Promise<any> {
    const response = await shiftApi.post(`/${shiftId}/check_out/`, {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      photo: data.photo,
      signature: data.signature
    });
    return response.data;
  }

  async startShift(data: {
    venueId: number,
    startSignature: string, // base64 data URL
    termsAccepted: boolean // Flag indicating venue terms were accepted
  }): Promise<Shift> {
    // If terms were accepted, record that first
    if (data.termsAccepted) {
      await this.acceptVenueTerms(data.venueId);
    }

    const response = await shiftApi.post<Shift>('/submit/', data);
    return response.data;
  }

  async endShift(shiftId: number, endSignature: string): Promise<Shift> {
    const response = await shiftApi.post<Shift>(`/${shiftId}/end/`, {
      endSignature
    });
    return response.data;
  }

  async managerApproval(shiftId: number, data: {
    approved: boolean,
    managerSignature: string,
    managerNotes?: string
  }): Promise<Shift> {
    const response = await shiftApi.post<Shift>(`/${shiftId}/approve/`, data);
    return response.data;
  }

  // Check-related methods
  async getFireExitChecks(shiftId: number): Promise<FireExitCheck[]> {
    const response = await api.get<FireExitCheck[]>(`/fire-exit-checks/?shift=${shiftId}`);
    return response.data;
  }

  async addFireExitCheck(shiftId: number, data: Omit<FireExitCheck, 'id' | 'shift' | 'timestamp'>): Promise<FireExitCheck> {
    const requestData = {
      shift: shiftId,
      timestamp: new Date().toISOString(),
      exit_name: data.exitName,
      is_clear: data.isPassed,
      is_properly_marked: true, // Default to true
      is_accessible: true, // Default to true
      comments: data.comments || ''
    };
    const response = await api.post<FireExitCheck>('/fire-exit-checks/', requestData);
    return response.data;
  }

  async getCapacityChecks(shiftId: number): Promise<CapacityCheck[]> {
    const response = await api.get<CapacityCheck[]>(`/capacity-checks/?shift=${shiftId}`);
    return response.data;
  }

  async addCapacityCheck(shiftId: number, data: Omit<CapacityCheck, 'id' | 'shift' | 'timestamp'>): Promise<CapacityCheck> {
    const requestData = {
      shift: shiftId,
      timestamp: new Date().toISOString(),
      current_count: data.count,
      venue_capacity: 100, // Default venue capacity, should be fetched from venue
      is_at_capacity: false, // Will be calculated by backend
      action_taken: data.comments || '',
      comments: data.comments || ''
    };
    const response = await api.post<CapacityCheck>('/capacity-checks/', requestData);
    return response.data;
  }

  async getToiletChecks(shiftId: number): Promise<ToiletCheck[]> {
    const response = await api.get<ToiletCheck[]>(`/toilet-checks/?shift=${shiftId}`);
    return response.data;
  }

  async addToiletCheck(shiftId: number, data: Omit<ToiletCheck, 'id' | 'shift' | 'timestamp'>): Promise<ToiletCheck> {
    const requestData = {
      shift: shiftId,
      timestamp: new Date().toISOString(),
      location_name: data.location,
      condition: data.condition,
      comments: data.comments || ''
    };
    const response = await api.post<ToiletCheck>('/toilet-checks/', requestData);
    return response.data;
  }

  // Get venue check requirements status for a shift
  async getVenueCheckStatus(shiftId: number): Promise<{
    fireExitCheck: { required: boolean; completed: boolean };
    capacityCheck: { required: boolean; completed: boolean };
    toiletCheck: { required: boolean; completed: boolean };
  }> {
    try {
      // Get shift details first to check venue requirements
      const shift = await this.getShiftById(shiftId);
      
      // Check what requirements the venue has
      const venue = shift.venue;
      const requiresFireChecks = venue.requiresFireSafetyChecks || false;
      const requiresCapacityChecks = venue.requiresCapacityMonitoring || false;
      const requiresToiletChecks = venue.requiresToiletChecks || false;
      
      // Check if each type of check has been completed
      const [fireChecks, capacityChecks, toiletChecks] = await Promise.all([
        requiresFireChecks ? this.getFireExitChecks(shiftId) : Promise.resolve([]),
        requiresCapacityChecks ? this.getCapacityChecks(shiftId) : Promise.resolve([]),
        requiresToiletChecks ? this.getToiletChecks(shiftId) : Promise.resolve([])
      ]);
      
      return {
        fireExitCheck: {
          required: requiresFireChecks,
          completed: fireChecks.length > 0
        },
        capacityCheck: {
          required: requiresCapacityChecks,
          completed: capacityChecks.length > 0
        },
        toiletCheck: {
          required: requiresToiletChecks,
          completed: toiletChecks.length > 0
        }
      };
    } catch (error) {
      console.error('Error fetching venue check status:', error);
      throw error;
    }
  }

  async getEnforcementVisits(shiftId: number): Promise<EnforcementVisit[]> {
    const response = await shiftApi.get<EnforcementVisit[]>(`/${shiftId}/enforcement-visits/`);
    return response.data;
  }

  async addEnforcementVisit(shiftId: number, data: Omit<EnforcementVisit, 'id' | 'shift' | 'timestamp'>): Promise<EnforcementVisit> {
    const response = await shiftApi.post<EnforcementVisit>(`/${shiftId}/enforcement-visits/`, data);
    return response.data;
  }

  // Reports API methods
  async getComplianceReports(params: {
    startDate?: string;
    endDate?: string;
    venueId?: number;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.venueId) queryParams.append('venueId', params.venueId.toString());
    
    const url = `/reports/compliance/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await shiftApi.get<any[]>(url);
    return response.data;
  }

  async getSafetyReports(params: {
    startDate?: string;
    endDate?: string;
    venueId?: number;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.venueId) queryParams.append('venueId', params.venueId.toString());
    
    const url = `/reports/safety/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await shiftApi.get<any[]>(url);
    return response.data;
  }

  async getPerformanceReports(params: {
    startDate?: string;
    endDate?: string;
    venueId?: number;
  }): Promise<any[]> {
    const queryParams = new URLSearchParams();
    
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.venueId) queryParams.append('venueId', params.venueId.toString());
    
    const url = `/reports/performance/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await shiftApi.get<any[]>(url);
    return response.data;
  }

  // Exchange-related functionality
  async getEligibleStaffForExchange(shiftId: number): Promise<StaffProfile[]> {
    try {
      // Get shift details to determine required role and timing
      const shift = await this.getShiftById(shiftId);
      
      // Get all staff profiles
      const response = await api.get<any>('/staff-profiles/');
      let staffList = response.data;
      
      // Handle paginated response
      if (response.data.results && Array.isArray(response.data.results)) {
        staffList = response.data.results;
      } else if (!Array.isArray(staffList)) {
        staffList = [];
      }
      
      // Filter out current user from exchange options
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      staffList = staffList.filter(staff => staff.user.id !== currentUser.id);
      
      // Transform and filter for eligible staff
      const transformedStaff = staffList.map(profile => ({
        id: profile.id,
        userId: profile.user.id,
        firstName: profile.user.first_name || '',
        lastName: profile.user.last_name || '',
        email: profile.user.email,
        phone: profile.phone_number || null,
        profileImage: profile.profile_image_url || null,
        qualifications: null,
        isActive: profile.user.is_active,
        isApproved: profile.is_approved || false
      }));
      
      // Filter for eligible staff (approved with valid SIA license)
      return transformedStaff.filter(staff => staff.isApproved);
    } catch (error) {
      console.error('Error fetching eligible staff for exchange:', error);
      throw error;
    }
  }

  async canReleaseShift(shiftId: number): Promise<{ canRelease: boolean; reason?: string }> {
    try {
      const shift = await this.getShiftById(shiftId);
      const now = new Date();
      const shiftStart = new Date(shift.startTime);
      
      // Check if shift has already started
      if (shiftStart <= now) {
        return {
          canRelease: false,
          reason: "Cannot release shifts that have already started"
        };
      }
      
      // Check if shift is in a valid status for release
      const releasableStatuses = ['scheduled', 'active'];
      if (!releasableStatuses.includes(shift.status)) {
        return {
          canRelease: false,
          reason: `Cannot release shifts with status: ${shift.status}`
        };
      }
      
      return { canRelease: true };
    } catch (error) {
      console.error('Error checking if shift can be released:', error);
      return {
        canRelease: false,
        reason: "Error checking shift eligibility"
      };
    }
  }

  async canExchangeShift(shiftId: number, targetUserId: number): Promise<{ canExchange: boolean; reason?: string }> {
    try {
      const shift = await this.getShiftById(shiftId);
      const now = new Date();
      const shiftStart = new Date(shift.startTime);
      
      // Check if shift has already started
      if (shiftStart <= now) {
        return {
          canExchange: false,
          reason: "Cannot exchange shifts that have already started"
        };
      }
      
      // Check if target user has conflicting shifts (simplified check)
      // In a real implementation, this would make an API call to check conflicts
      
      return { canExchange: true };
    } catch (error) {
      console.error('Error checking if shift can be exchanged:', error);
      return {
        canExchange: false,
        reason: "Error checking exchange eligibility"
      };
    }
  }
}

export default new ShiftService();
