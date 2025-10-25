/**
 * User Type Definitions
 */

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  profile: StaffProfile;
}

export type UserRole = 'staff' | 'manager' | 'admin';

export interface StaffProfile {
  id: number;
  user: number;
  phone_number: string;
  date_of_birth: string;
  address: string;
  city: string;
  postcode: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  ni_number: string;
  bank_account_number: string;
  bank_sort_code: string;
  profile_photo?: string;
  sia_licenses: SIALicense[];
  qualifications: Qualification[];
}

export interface SIALicense {
  id: number;
  license_number: string;
  license_type: string;
  issue_date: string;
  expiry_date: string;
  is_valid: boolean;
}

export interface Qualification {
  id: number;
  name: string;
  issuing_organization: string;
  issue_date: string;
  expiry_date?: string;
  certificate_url?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RefreshTokenRequest {
  refresh: string;
}

export interface RefreshTokenResponse {
  access: string;
}
