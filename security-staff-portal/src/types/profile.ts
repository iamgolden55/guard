import type { User } from './auth';

export interface SIALicense {
  licenseNumber: string;
  licenseType: SIALicenseType;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expired' | 'pending';
  documentUrl?: string;
}

export enum SIALicenseType {
  DOOR_SUPERVISION = 'Door Supervision',
  SECURITY_GUARDING = 'Security Guarding',
  CCTV = 'CCTV Operation',
  CLOSE_PROTECTION = 'Close Protection',
  VEHICLE_IMMOBILIZATION = 'Vehicle Immobilization',
  KEY_HOLDING = 'Key Holding'
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  sortCode: string;
  bankName: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phoneNumber: string;
}

// Interface for tracking venue terms acceptance
export interface AcceptedVenueTerms {
  venueId: number;
  acceptedAt: string; // ISO date string
  termsVersion?: string; // Optional version identifier for the terms
}

export interface StaffProfile extends User {
  phoneNumber: string;
  address: Address;
  dateOfBirth: string;
  nationalInsuranceNumber: string;
  siaLicenses: SIALicense[];
  bankDetails: BankDetails;
  emergencyContact: EmergencyContact;
  profileImageUrl?: string;
  availableDays?: string[];
  preferredVenues?: number[];
  notes?: string;
  passwordLastChanged?: string;
  acceptedVenueTerms?: AcceptedVenueTerms[]; // Track which venue terms have been accepted
}

export interface ProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  address?: Address;
  emergencyContact?: EmergencyContact;
  bankDetails?: BankDetails;
  nationalInsuranceNumber?: string;
  password?: string;
  currentPassword?: string;
}

export interface SIALicenseUpdateRequest {
  licenseNumber: string;
  licenseType: SIALicenseType;
  issueDate: string;
  expiryDate: string;
  documentFile?: File;
}
