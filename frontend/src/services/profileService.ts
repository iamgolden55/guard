import api from './api';
import type { ProfileUpdateRequest, SIALicenseUpdateRequest, StaffProfile, SIALicense } from '../types';
import { logger } from '../lib/logger';

/** A licence card can be up to 10 MB; the default 15s timeout is too short on a slow connection. */
const DOCUMENT_TIMEOUT_MS = 60_000;

export interface NewSIALicense {
  licenseNumber: string;
  licenseType: string;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  level?: string;
  /** JPEG, PNG or PDF of the physical card. */
  file?: File | null;
}

class ProfileService {
  /**
   * Get the current user's profile
   */
  async getProfile(): Promise<StaffProfile> {
    const response = await api.get<StaffProfile>('/api/v1/profiles/me');
    return response.data;
  }

  /**
   * Update the current user's profile
   */
  async updateProfile(data: ProfileUpdateRequest): Promise<StaffProfile> {
    const response = await api.patch<StaffProfile>('/api/v1/profiles/me', data);

    // Update localStorage to keep auth context in sync
    if (data.firstName || data.lastName || data.email) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const currentUser = JSON.parse(userStr);
          const updatedUser = {
            ...currentUser,
            firstName: data.firstName || currentUser.firstName,
            lastName: data.lastName || currentUser.lastName,
            email: data.email || currentUser.email,
            // Also update snake_case versions for compatibility
            first_name: data.firstName || currentUser.first_name,
            last_name: data.lastName || currentUser.last_name,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (error) {
          logger.error('Failed to update user in localStorage:', error);
        }
      }
    }

    return response.data;
  }

  /**
   * Change the user's password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/api/v1/accounts/change-password/', {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  /**
   * Get user's SIA licenses
   */
  async getSIALicenses(): Promise<SIALicense[]> {
    const response = await api.get<SIALicense[]>('/api/v1/profiles/me/sia-licenses');
    return response.data;
  }

  /**
   * Add a new SIA licence, optionally with a photo or PDF of the card.
   *
   * With a card this is one multipart request, so the licence and its document
   * are saved together or not at all — a separate upload that failed after the
   * licence was created left a record the operator could not re-submit without
   * tripping the duplicate-number check. `status` and `document_url` are not
   * sent: the server sets both.
   */
  async addSIALicense(staffProfileId: number, licenseData: NewSIALicense): Promise<unknown> {
    const fields = {
      staff_profile: String(staffProfileId),
      license_number: licenseData.licenseNumber,
      license_type: licenseData.licenseType,
      issue_date: licenseData.issueDate,
      expiry_date: licenseData.expiryDate,
      level: licenseData.level || 'qualified',
    };

    if (licenseData.file) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }
      formData.append('file', licenseData.file);
      const response = await api.post('/api/v1/sia-licenses/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: DOCUMENT_TIMEOUT_MS,
      });
      return response.data;
    }

    const response = await api.post('/api/v1/sia-licenses/', {
      ...fields,
      staff_profile: staffProfileId,
    });
    return response.data;
  }

  /**
   * Attach or replace the card on an existing licence.
   */
  async uploadSIALicenseDocument(licenseId: number, file: File): Promise<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(
      `/api/v1/sia-licenses/${licenseId}/document/`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: DOCUMENT_TIMEOUT_MS,
      },
    );
    return response.data;
  }

  /**
   * Fetch a licence card as a blob.
   *
   * An identity document behind authentication: a plain `<img src>` or link
   * would carry no Bearer header, and Safari drops the cross-site refresh
   * cookie, so it has to come through this client.
   */
  async fetchSIALicenseDocument(licenseId: number): Promise<Blob> {
    try {
      const response = await api.get<Blob>(
        `/api/v1/sia-licenses/${licenseId}/document/`,
        { responseType: 'blob', timeout: DOCUMENT_TIMEOUT_MS },
      );
      return response.data;
    } catch (err) {
      // With responseType 'blob' the error body is a Blob as well, which would
      // hide the server's {detail, code} from extractApiError.
      const response = (err as { response?: { data?: unknown } }).response;
      if (response?.data instanceof Blob && response.data.type.includes('json')) {
        try {
          response.data = JSON.parse(await response.data.text());
        } catch {
          // Not JSON after all; callers fall back to their own message.
        }
      }
      throw err;
    }
  }

  /**
   * Verify a licence. The server derives the resulting status: a licence whose
   * expiry date has passed comes back `expired`, not `valid`.
   */
  async approveSIALicense(licenseId: number): Promise<unknown> {
    const response = await api.post(`/api/v1/sia-licenses/${licenseId}/approve/`);
    return response.data;
  }

  /**
   * Get SIA licenses for a specific staff profile
   */
  async getSIALicensesByProfile(staffProfileId: number): Promise<any[]> {
    const response = await api.get(`/api/v1/sia-licenses/?staff_profile=${staffProfileId}`);
    return response.data.results || response.data;
  }

  /**
   * Get a staff profile by id (admin/manager only). Returns the full StaffProfileSerializer payload.
   */
  async getStaffProfileById(staffProfileId: number): Promise<any> {
    const response = await api.get(`/api/v1/staff-profiles/${staffProfileId}/`);
    return response.data;
  }

  /**
   * Patch a staff profile by id (admin/manager only). Used to edit addresses,
   * employment type, etc. on behalf of another staff member.
   */
  async patchStaffProfile(
    staffProfileId: number,
    data: Record<string, unknown>,
  ): Promise<any> {
    const response = await api.patch(
      `/api/v1/staff-profiles/${staffProfileId}/`,
      data,
    );
    return response.data;
  }

  /**
   * Delete an SIA licence by id via the admin endpoint (vs the per-self
   * /profiles/me/sia-licenses/ path used by deleteSIALicense).
   */
  async deleteSIALicenseById(licenseId: number): Promise<void> {
    await api.delete(`/api/v1/sia-licenses/${licenseId}/`);
  }

  /**
   * Update an existing SIA license by ID (PATCH)
   */
  async patchSIALicense(licenseId: number, data: Record<string, any>): Promise<any> {
    return api.patch(`/api/v1/sia-licenses/${licenseId}/`, data);
  }

  /**
   * Update an existing SIA license
   */
  async updateSIALicense(licenseId: string, licenseData: SIALicenseUpdateRequest): Promise<SIALicense> {
    // In a real implementation, we'd use FormData to handle file uploads
    const formData = new FormData();
    formData.append('licenseNumber', licenseData.licenseNumber);
    formData.append('licenseType', licenseData.licenseType);
    formData.append('issueDate', licenseData.issueDate);
    formData.append('expiryDate', licenseData.expiryDate);

    if (licenseData.documentFile) {
      formData.append('document', licenseData.documentFile);
    }

    const response = await api.patch<SIALicense>(`/api/v1/profiles/me/sia-licenses/${licenseId}`, formData);
    return response.data;
  }

  /**
   * Delete an SIA license
   */
  async deleteSIALicense(licenseId: string): Promise<void> {
    await api.delete(`/api/v1/profiles/me/sia-licenses/${licenseId}`);
  }

  /**
   * Upload a profile image
   */
  async uploadProfileImage(imageFile: File): Promise<{ imageUrl: string }> {
    // Four things were wrong here and the photo never left the browser:
    // `/profiles/me/image` is not a route, the field is `photo`, the default
    // JSON content type makes axios stringify the FormData and drop the file,
    // and the response key is `url`.
    const formData = new FormData();
    formData.append('photo', imageFile);

    const response = await api.post<{ url: string; profile_image_url: string }>(
      '/api/v1/staff/profile/upload-photo/',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60_000,
      },
    );
    return { imageUrl: response.data.url ?? response.data.profile_image_url };
  }

  /**
   * Get all staff profiles pending approval
   */
  async getPendingStaffProfiles() {
    const response = await api.get('/api/v1/staff-profiles/?is_approved=false');
    return response.data;
  }

  /**
   * Approve a staff profile by ID
   */
  async approveStaffProfile(profileId: number) {
    const response = await api.patch(`/api/v1/staff-profiles/${profileId}/approve/`);
    return response.data;
  }
}

export default new ProfileService();
