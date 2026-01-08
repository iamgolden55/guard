import api from './api';
import type { ProfileUpdateRequest, SIALicenseUpdateRequest, StaffProfile, SIALicense } from '../types';

// Demo mode flag - ensure this is true for testing
const DEMO_MODE = false;

// Mock data for demo profile
const DEMO_PROFILE: StaffProfile = {
  id: 3,
  username: 'staff',
  email: 'staff@example.com',
  firstName: 'John',
  lastName: 'Smith',
  role: 'staff' as any,
  isActive: true,
  phoneNumber: '+44 7700 900123',
  dateOfBirth: '1985-06-15',
  nationalInsuranceNumber: 'AB123456C',
  address: {
    street: '123 Security Road',
    city: 'London',
    postalCode: 'SW1A 1AA',
    country: 'United Kingdom'
  },
  siaLicenses: [
    {
      licenseNumber: '1234567890',
      licenseType: 'Door Supervision' as any,
      issueDate: '2022-01-01',
      expiryDate: '2025-01-01',
      status: 'valid',
      documentUrl: 'https://via.placeholder.com/300x200?text=SIA+License'
    }
  ],
  bankDetails: {
    accountName: 'John Smith',
    accountNumber: '12345678',
    sortCode: '12-34-56',
    bankName: 'Example Bank'
  },
  emergencyContact: {
    name: 'Jane Smith',
    relationship: 'Spouse',
    phoneNumber: '+44 7700 900456'
  },
  profileImageUrl: 'https://via.placeholder.com/150',
  availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  preferredVenues: [1, 2, 3],
  notes: 'Experienced in high-volume venues'
};

class ProfileService {
  /**
   * Get the current user's profile
   */
  async getProfile(): Promise<StaffProfile> {
    if (DEMO_MODE) {
      // In demo mode, return the mock profile
      console.log('Demo mode: Returning mock profile data');

      // Get the current logged in user from localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const currentUser = JSON.parse(userStr);
          // Merge the currentUser with the demo profile
          return {
            ...DEMO_PROFILE,
            id: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            role: currentUser.role
          };
        } catch (error) {
          console.error('Failed to parse user data:', error);
        }
      }

      return DEMO_PROFILE;
    }

    const response = await api.get<StaffProfile>('/api/v1/profiles/me');
    console.log('[PROFILE SERVICE] API Response:', response.data);
    console.log('[PROFILE SERVICE] Phone Number:', response.data.phoneNumber);
    console.log('[PROFILE SERVICE] Address:', response.data.address);
    console.log('[PROFILE SERVICE] Emergency Contact:', response.data.emergencyContact);
    return response.data;
  }

  /**
   * Update the current user's profile
   */
  async updateProfile(data: ProfileUpdateRequest): Promise<StaffProfile> {
    if (DEMO_MODE) {
      console.log('Demo mode: Profile update request', data);

      // In demo mode, simulate an API update
      const updatedProfile = { ...DEMO_PROFILE };

      // Update the profile with the new data
      if (data.firstName) updatedProfile.firstName = data.firstName;
      if (data.lastName) updatedProfile.lastName = data.lastName;
      if (data.email) updatedProfile.email = data.email;
      if (data.phoneNumber) updatedProfile.phoneNumber = data.phoneNumber;
      if (data.address) updatedProfile.address = data.address;
      if (data.emergencyContact) updatedProfile.emergencyContact = data.emergencyContact;
      if (data.bankDetails) updatedProfile.bankDetails = data.bankDetails;
      if (data.nationalInsuranceNumber) updatedProfile.nationalInsuranceNumber = data.nationalInsuranceNumber;
      if (data.dateOfBirth) updatedProfile.dateOfBirth = data.dateOfBirth;

      // Update the user in localStorage for consistency
      if (data.firstName || data.lastName || data.email) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const currentUser = JSON.parse(userStr);
            const updatedUser = {
              ...currentUser,
              firstName: data.firstName || currentUser.firstName,
              lastName: data.lastName || currentUser.lastName,
              email: data.email || currentUser.email
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch (error) {
            console.error('Failed to update user in localStorage:', error);
          }
        }
      }

      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return updatedProfile;
    }

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

          // Trigger auth context refresh to update header immediately
          // Note: This creates a circular dependency, so we'll use a different approach
          console.log('User data updated in localStorage:', updatedUser);
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
    if (DEMO_MODE) {
      console.log('Demo mode: Password change request');
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }

    await api.post('/api/v1/accounts/change-password/', {
      current_password: currentPassword,
      new_password: newPassword
    });
  }

  /**
   * Get user's SIA licenses
   */
  async getSIALicenses(): Promise<SIALicense[]> {
    if (DEMO_MODE) {
      console.log('Demo mode: Returning mock SIA licenses');
      return DEMO_PROFILE.siaLicenses;
    }

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
    console.log('addSIALicense payload:', payload);
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
   * Update an existing SIA license by ID (PATCH)
   */
  async patchSIALicense(licenseId: number, data: Record<string, any>): Promise<any> {
    return api.patch(`/api/v1/sia-licenses/${licenseId}/`, data);
  }

  /**
   * Update an existing SIA license
   */
  async updateSIALicense(licenseId: string, licenseData: SIALicenseUpdateRequest): Promise<SIALicense> {
    if (DEMO_MODE) {
      console.log('Demo mode: Updating SIA license', licenseId, licenseData);

      // Create an updated license with the provided data
      const updatedLicense: SIALicense = {
        licenseNumber: licenseData.licenseNumber,
        licenseType: licenseData.licenseType,
        issueDate: licenseData.issueDate,
        expiryDate: licenseData.expiryDate,
        status: 'valid',
        documentUrl: 'https://via.placeholder.com/300x200?text=Updated+SIA+License'
      };

      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return updatedLicense;
    }

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
    if (DEMO_MODE) {
      console.log('Demo mode: Deleting SIA license', licenseId);
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }

    await api.delete(`/api/v1/profiles/me/sia-licenses/${licenseId}`);
  }

  /**
   * Upload a profile image
   */
  async uploadProfileImage(imageFile: File): Promise<{ imageUrl: string }> {
    if (DEMO_MODE) {
      console.log('Demo mode: Uploading profile image');
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { imageUrl: 'https://via.placeholder.com/150?text=New+Profile' };
    }

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
