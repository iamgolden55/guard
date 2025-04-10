import api from './api';
import type {
  Shift,
  FireExitCheck,
  CapacityCheck,
  ToiletCheck,
  EnforcementVisit,
  Venue
} from '../types';
import { AcceptedVenueTerms } from '../types/profile';

class ShiftService {
  // Venue-related methods
  async getVenues(): Promise<Venue[]> {
    const response = await api.get<Venue[]>('/api/venues/');
    return response.data;
  }

  // Terms and conditions acceptance
  async hasAcceptedVenueTerms(venueId: number): Promise<boolean> {
    try {
      const response = await api.get<{ hasAccepted: boolean }>(`/api/venues/${venueId}/terms-acceptance`);
      return response.data.hasAccepted;
    } catch (error) {
      console.error('Error checking terms acceptance:', error);
      return false; // If there's an error, assume terms haven't been accepted
    }
  }

  async acceptVenueTerms(venueId: number): Promise<AcceptedVenueTerms> {
    const response = await api.post<AcceptedVenueTerms>(`/api/venues/${venueId}/accept-terms`, {});
    return response.data;
  }

  // Shift-related methods
  async getShifts(staffId?: number): Promise<Shift[]> {
    const url = staffId ? `/api/shifts/?staff=${staffId}` : '/api/shifts/';
    const response = await api.get<Shift[]>(url);
    return response.data;
  }

  async getShiftById(shiftId: number): Promise<Shift> {
    const response = await api.get<Shift>(`/api/shift/${shiftId}/`);
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

    const response = await api.post<Shift>('/api/shift/submit/', data);
    return response.data;
  }

  async endShift(shiftId: number, endSignature: string): Promise<Shift> {
    const response = await api.post<Shift>(`/api/shift/${shiftId}/end/`, {
      endSignature
    });
    return response.data;
  }

  async managerApproval(shiftId: number, data: {
    approved: boolean,
    managerSignature: string,
    managerNotes?: string
  }): Promise<Shift> {
    const response = await api.post<Shift>(`/api/manager/approve/${shiftId}/`, data);
    return response.data;
  }

  // Check-related methods
  async getFireExitChecks(shiftId: number): Promise<FireExitCheck[]> {
    const response = await api.get<FireExitCheck[]>(`/api/shift/${shiftId}/fire-exit-checks/`);
    return response.data;
  }

  async addFireExitCheck(shiftId: number, data: Omit<FireExitCheck, 'id' | 'shift' | 'timestamp'>): Promise<FireExitCheck> {
    const response = await api.post<FireExitCheck>(`/api/shift/${shiftId}/fire-exit-checks/`, data);
    return response.data;
  }

  async getCapacityChecks(shiftId: number): Promise<CapacityCheck[]> {
    const response = await api.get<CapacityCheck[]>(`/api/shift/${shiftId}/capacity-checks/`);
    return response.data;
  }

  async addCapacityCheck(shiftId: number, data: Omit<CapacityCheck, 'id' | 'shift' | 'timestamp'>): Promise<CapacityCheck> {
    const response = await api.post<CapacityCheck>(`/api/shift/${shiftId}/capacity-checks/`, data);
    return response.data;
  }

  async getToiletChecks(shiftId: number): Promise<ToiletCheck[]> {
    const response = await api.get<ToiletCheck[]>(`/api/shift/${shiftId}/toilet-checks/`);
    return response.data;
  }

  async addToiletCheck(shiftId: number, data: Omit<ToiletCheck, 'id' | 'shift' | 'timestamp'>): Promise<ToiletCheck> {
    const response = await api.post<ToiletCheck>(`/api/shift/${shiftId}/toilet-checks/`, data);
    return response.data;
  }

  async getEnforcementVisits(shiftId: number): Promise<EnforcementVisit[]> {
    const response = await api.get<EnforcementVisit[]>(`/api/shift/${shiftId}/enforcement-visits/`);
    return response.data;
  }

  async addEnforcementVisit(shiftId: number, data: Omit<EnforcementVisit, 'id' | 'shift' | 'timestamp'>): Promise<EnforcementVisit> {
    const response = await api.post<EnforcementVisit>(`/api/shift/${shiftId}/enforcement-visits/`, data);
    return response.data;
  }
}

export default new ShiftService();
