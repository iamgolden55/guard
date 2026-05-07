import api from './api';
import type { EmploymentType } from './employmentTypeService';

export interface RecruitmentApplication {
  id: number;
  // Personal Details
  full_name: string;
  date_of_birth: string;
  email: string;
  phone_number: string;
  home_address: string;
  postcode: string;
  
  // SIA Licence Details
  has_sia_licence: boolean;
  sia_licence_number?: string;
  licence_types: string[];
  licence_expiry_date?: string;
  licence_suspended_revoked: boolean;
  licence_suspension_details?: string;
  
  // Employment Preferences
  employment_type: number;
  employment_type_details?: EmploymentType;
  hours_per_week: number;
  availability_days: boolean;
  availability_nights: boolean;
  availability_weekends: boolean;
  availability_holidays: boolean;
  willing_to_travel: boolean;
  has_transport: boolean;
  has_commitments: boolean;
  commitments_details?: string;
  
  // Experience and Skills
  has_security_experience: boolean;
  security_experience_details?: string;
  certifications: string[];
  other_certification_details?: string;
  
  // Additional Information
  eligible_to_work_uk: boolean;
  has_criminal_convictions: boolean;
  criminal_convictions_details?: string;
  
  // Application Details
  status: 'pending' | 'approved' | 'rejected';
  digital_signature: string;
  application_date: string;
  
  // Admin fields
  reviewed_by?: number;
  reviewed_by_details?: any;
  admin_notes?: string;
  reviewed_at?: string;
  
  // Conversion
  converted_to_user?: number;
  converted_user_details?: any;
  
  created_at: string;
  updated_at: string;
}

export interface RecruitmentApplicationRequest {
  // Personal Details
  full_name: string;
  date_of_birth: string;
  email: string;
  phone_number: string;
  home_address: string;
  postcode: string;
  
  // SIA Licence Details
  has_sia_licence: boolean;
  sia_licence_number?: string;
  licence_types: string[];
  licence_expiry_date?: string;
  licence_suspended_revoked: boolean;
  licence_suspension_details?: string;
  
  // Employment Preferences
  employment_type: number;
  hours_per_week: number;
  availability_days: boolean;
  availability_nights: boolean;
  availability_weekends: boolean;
  availability_holidays: boolean;
  willing_to_travel: boolean;
  has_transport: boolean;
  has_commitments: boolean;
  commitments_details?: string;
  
  // Experience and Skills
  has_security_experience: boolean;
  security_experience_details?: string;
  certifications: string[];
  other_certification_details?: string;
  
  // Additional Information
  eligible_to_work_uk: boolean;
  has_criminal_convictions: boolean;
  criminal_convictions_details?: string;
  
  // Application Details
  digital_signature: string;
}

export interface RecruitmentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  converted: number;
  by_employment_type: Record<string, number>;
}

export interface ApplicationFilters {
  status?: string;
  employment_type?: number;
  start_date?: string;
  end_date?: string;
}

export const recruitmentService = {
  // Admin endpoints
  async getApplications(filters?: ApplicationFilters): Promise<RecruitmentApplication[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.employment_type) params.append('employment_type', filters.employment_type.toString());
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const response = await api.get(`/api/v1/recruitment-applications/?${params.toString()}`);
    // Handle paginated response
    return Array.isArray(response.data) ? response.data : (response.data?.results || []);
  },

  async getApplication(id: number): Promise<RecruitmentApplication> {
    const response = await api.get(`/api/v1/recruitment-applications/${id}/`);
    return response.data;
  },

  async approveApplication(id: number, notes?: string): Promise<RecruitmentApplication> {
    const response = await api.post(`/api/v1/recruitment-applications/${id}/approve/`, { notes });
    return response.data.application;
  },

  async rejectApplication(id: number, notes: string): Promise<RecruitmentApplication> {
    const response = await api.post(`/api/v1/recruitment-applications/${id}/reject/`, { notes });
    return response.data.application;
  },

  async convertToUser(id: number): Promise<{ user: any; application: RecruitmentApplication }> {
    const response = await api.post(`/api/v1/recruitment-applications/${id}/convert-to-user/`);
    return response.data;
  },

  async getStats(): Promise<RecruitmentStats> {
    const response = await api.get('/api/v1/recruitment-applications/stats/');
    return response.data;
  },

  // Public endpoint
  async submitApplication(data: RecruitmentApplicationRequest): Promise<{
    message: string;
    application_id: number;
    email: string;
  }> {
    const response = await api.post('/api/v1/recruitment-apply/', data);
    return response.data;
  },

  // Company-specific public endpoints
  async getCompanyEmploymentTypes(companySlug: string): Promise<EmploymentType[]> {
    const response = await api.get(`/api/v1/company-recruitment/employment-types/${companySlug}/`);
    return response.data?.employment_types || [];
  },

  async getCompanyInfo(companySlug: string): Promise<{
    name: string;
    description?: string;
    logo?: string;
    contact_email?: string;
  }> {
    const response = await api.get(`/api/v1/company-recruitment/info/${companySlug}/`);
    return response.data?.company || {};
  },

  async submitCompanyApplication(companySlug: string, data: RecruitmentApplicationRequest): Promise<{
    message: string;
    application_id: number;
    email: string;
  }> {
    const response = await api.post(`/api/v1/company-recruitment/apply/${companySlug}/`, data);
    return response.data;
  }
};