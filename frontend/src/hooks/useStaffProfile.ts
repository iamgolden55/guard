import { useState, useEffect, useCallback, useMemo } from 'react';
import { profileService } from '../services';

/**
 * Employment type information returned from the API
 */
interface EmploymentType {
  id: number;
  name: string;
  description: string;
  employment_category: 'contractor' | 'temporary' | 'permanent' | null;
  is_active: boolean;
}

/**
 * Staff profile data with employment type information
 */
interface StaffProfileData {
  id: number;
  employment_type: EmploymentType | null;
  employment_type_details: EmploymentType | null;
  // Other profile fields are available but not typed here
  [key: string]: any;
}

/**
 * Hook for accessing staff profile data with employment type detection
 *
 * Provides easy access to determine if the current user is a contractor,
 * permanent employee, or temporary staff based on their employment type.
 */
export function useStaffProfile() {
  const [staffProfile, setStaffProfile] = useState<StaffProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const profile = await profileService.getProfile();
      setStaffProfile(profile as unknown as StaffProfileData);
    } catch (err: any) {
      console.error('Error loading staff profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /**
   * Get the employment category from the staff profile
   * Returns 'contractor', 'temporary', 'permanent', or null
   */
  const employmentCategory = useMemo(() => {
    // Try employment_type_details first (newer API format), then fall back to employment_type
    const empType = staffProfile?.employment_type_details || staffProfile?.employment_type;
    return empType?.employment_category || null;
  }, [staffProfile]);

  /**
   * Check if the user is a contractor or temporary worker
   * These users should see the "My Availability" option instead of leave management
   */
  const isContractor = useMemo(() => {
    return employmentCategory === 'contractor' || employmentCategory === 'temporary';
  }, [employmentCategory]);

  /**
   * Check if the user is a permanent employee
   * These users have access to leave balance, leave requests, and leave history
   */
  const isPermanentEmployee = useMemo(() => {
    return employmentCategory === 'permanent';
  }, [employmentCategory]);

  /**
   * Get the employment type name (e.g., "Full-Time Contractor", "Permanent Staff")
   */
  const employmentTypeName = useMemo(() => {
    const empType = staffProfile?.employment_type_details || staffProfile?.employment_type;
    return empType?.name || null;
  }, [staffProfile]);

  /**
   * Refresh the profile data
   */
  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  return {
    // Raw data
    staffProfile,

    // Loading state
    isLoading,
    error,

    // Employment type helpers
    employmentCategory,
    employmentTypeName,
    isContractor,
    isPermanentEmployee,

    // Actions
    refreshProfile
  };
}

export default useStaffProfile;
