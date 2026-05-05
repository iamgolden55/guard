import api from './api';
import type { ProfileUpdateRequest, SIALicenseUpdateRequest, StaffProfile, SIALicense } from '../types';

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
          console.error('Failed to update user in localStorage:', error);
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
   * Add a new SIA license
   */
  async addSIALicense(staffProfileId: number, licenseData: any) {
    // Prepare payload with correct snake_case field names
    const payload = {
      staff_profile: staffProfileId,
      license_number: licenseData.licenseNumber,
      license_type: licenseData.licenseType,
      issue_date: licenseData.issueDate,
      expiry_date: licenseData.expiryDate,
      status: licenseData.status || 'pending',
      document_url: licenseData.document_url,
      level: licenseData.level || 'qualified',
    };
    return api.post('/api/v1/sia-licenses/', payload);
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
    const formData = new FormData();
    formData.append('profile_image', imageFile);

    const response = await api.post<{ imageUrl: string }>('/api/v1/profiles/me/image', formData);
    return response.data;
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
