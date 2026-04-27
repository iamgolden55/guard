import api from './api';
import {
  OnboardingWizardData,
  OnboardingProgress,
  SecurityCompany,
  CompanyContextResponse,
  RegionalComplianceConfig,
  OnboardingResponse,
  ValidationError,
  CompanyInitiationData,
  CompanyInfoData
} from '../types';
import { mapCountryNameToCode } from '../utils/countryMapping';

/**
 * Service for managing onboarding API calls
 */
class OnboardingService {
  private readonly baseUrl = '/api/v1/onboarding';

  /**
   * Initialize a new onboarding session with company data
   */
  /**
   * Map frontend industry values to backend industry values
   */
  private mapIndustryType(frontendIndustry: string): string {
    const industryMapping: Record<string, string> = {
      'Security Services': 'corporate',
      'Event Security': 'events',
      'Corporate Security': 'corporate',
      'Retail Security': 'retail',
      'Hospitality Security': 'hospitality',
      'Construction Security': 'construction',
      'Transport Security': 'transport',
      'Healthcare Security': 'healthcare',
      'Education Security': 'education',
      'Other': 'mixed'
    };

    return industryMapping[frontendIndustry] || 'corporate';
  }

  async initiateOnboarding(companyData: CompanyInfoData): Promise<{ sessionId: string; progress: OnboardingProgress; onboarding?: any }> {
    try {
      // Convert frontend company data to API format
      const payload: CompanyInitiationData = {
        company: {
          // Required fields
          name: companyData.companyName,
          registration_number: companyData.registrationNumber,
          country_code: mapCountryNameToCode(companyData.address?.country || ''),
          city: companyData.address?.city || '',
          postal_code: companyData.address?.postalCode || '',
          address_line_1: companyData.address?.street || '',
          billing_email: companyData.primaryContact?.email || '',
          primary_contact_name: `${companyData.primaryContact?.firstName || ''} ${companyData.primaryContact?.lastName || ''}`.trim(),
          primary_contact_email: companyData.primaryContact?.email || '',
          primary_contact_phone: companyData.primaryContact?.phone || '',
          industry_type: this.mapIndustryType(companyData.industry || 'Security Services'),
          business_type: companyData.businessType || 'private_limited',
          founded_year: companyData.foundedYear || new Date().getFullYear(),

          // Optional fields with defaults
          trading_name: companyData.companyName, // Use company name as default
          website_url: companyData.websiteUrl || '',
          description: companyData.description || '',
          state_province: companyData.address?.state || '',
          subscription_tier: 'professional',
          company_size: 'medium'
        }
      };

      const response = await api.post(`${this.baseUrl}/initiate/`, payload);
      return response.data;
    } catch (error: any) {
      console.error('Failed to initiate onboarding:', error);

      // Extract specific error message from backend
      if (error.response?.data?.message) {
        // If there are specific field errors, show them
        if (error.response.data.errors) {
          const fieldErrors = Object.entries(error.response.data.errors)
            .map(([field, messages]: [string, any]) => {
              const errorMessages = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${errorMessages.join(', ')}`;
            })
            .join('; ');
          throw new Error(`${error.response.data.message}: ${fieldErrors}`);
        } else {
          throw new Error(error.response.data.message);
        }
      }

      throw new Error('Failed to start onboarding process');
    }
  }

  /**
   * Get current onboarding progress
   */
  async getOnboardingProgress(sessionId?: string): Promise<OnboardingProgress> {
    try {
      const params = sessionId ? { session_id: sessionId } : {};
      const response = await api.get(`${this.baseUrl}/progress/`, { params });

      // Backend returns { status: "success", onboarding: { ... } }
      // We need to extract the onboarding data and map snake_case to camelCase
      if (response.data && response.data.onboarding) {
        const backendData = response.data.onboarding;

        // Map backend snake_case to frontend camelCase
        return {
          currentStep: backendData.current_step,
          completedSteps: this.mapCompletedSteps(backendData),
          totalSteps: backendData.total_steps || 5,
          isCompleted: backendData.is_completed,
          startedAt: backendData.created_at,
          lastUpdatedAt: backendData.updated_at,
          estimatedCompletion: backendData.estimated_time_remaining
            ? new Date(Date.now() + backendData.estimated_time_remaining * 60000).toISOString()
            : new Date().toISOString()
        };
      }

      // Fallback to direct response data if structure is different
      return response.data;
    } catch (error) {
      console.error('Failed to get onboarding progress:', error);
      throw new Error('Failed to retrieve onboarding progress');
    }
  }

  /**
   * Map backend completion flags to completed steps array
   */
  private mapCompletedSteps(backendData: any): number[] {
    const completedSteps: number[] = [];

    if (backendData.company_info_completed) completedSteps.push(1);
    if (backendData.regional_setup_completed) completedSteps.push(2);
    if (backendData.staff_setup_completed) completedSteps.push(3);
    if (backendData.integrations_completed) completedSteps.push(4);
    if (backendData.finalization_completed) completedSteps.push(5);

    return completedSteps;
  }

  /**
   * Save company information (Step 1)
   */
  async saveCompanyInfo(data: OnboardingWizardData['companyInfo'], sessionId?: string): Promise<OnboardingResponse> {
    try {
      const payload = {
        ...data,
        session_id: sessionId
      };
      const response = await api.put(`${this.baseUrl}/company-info/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to save company info:', error);
      throw new Error('Failed to save company information');
    }
  }

  /**
   * Save regional compliance setup (Step 2)
   */
  async saveRegionalSetup(data: OnboardingWizardData['regionalCompliance'], sessionId?: string): Promise<OnboardingResponse> {
    try {
      // Map frontend data structure to backend format
      const payload = {
        operating_regions: data.operatingRegions,
        primary_jurisdiction: data.operatingRegions.includes(data.primaryRegion)
          ? data.primaryRegion
          : data.operatingRegions[0], // Use first region if primaryRegion not in operatingRegions
        regulatory_requirements: {
          workingHoursRegulation: data.complianceProfile.workingHoursRegulation,
          overtimeRules: data.complianceProfile.overtimeRules,
          breakRequirements: data.complianceProfile.breakRequirements,
          holidayEntitlements: data.complianceProfile.holidayEntitlements,
          leaveRequirements: data.complianceProfile.leaveRequirements,
          healthSafetyStandards: data.complianceProfile.healthSafetyStandards?.join(', ') || '',
          dataProtectionLevel: data.dataProtectionLevel
        },
        compliance_certifications: data.specialRequirements || [],
        standard_working_hours: {
          default: "09:00-17:00", // Default working hours
          ...this.parseWorkingHours(data.complianceProfile.workingHoursRegulation)
        },
        overtime_policies: {
          rules: data.complianceProfile.overtimeRules,
          rate: "1.5x", // Default overtime rate
          maxHours: 48 // Default max hours per week
        },
        break_requirements: {
          requirements: data.complianceProfile.breakRequirements,
          lunch: "30min",
          breaks: "15min every 4h"
        },
        session_id: sessionId
      };

      const response = await api.put(`${this.baseUrl}/regional-setup/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to save regional setup:', error);
      throw new Error('Failed to save regional compliance settings');
    }
  }

  /**
   * Helper method to parse working hours regulation into structured format
   */
  private parseWorkingHours(regulation: string): Record<string, string> {
    // This could be enhanced to parse different regulations
    // For now, return default structure
    return {
      monday: "09:00-17:00",
      tuesday: "09:00-17:00",
      wednesday: "09:00-17:00",
      thursday: "09:00-17:00",
      friday: "09:00-17:00"
    };
  }

  /**
   * Save staff operations configuration (Step 3)
   */
  async saveStaffConfiguration(data: OnboardingWizardData['staffOperations'], sessionId?: string): Promise<OnboardingResponse> {
    try {
      // Transform frontend data to backend format
      const payload = {
        // Required fields
        expected_staff_count: this.getExpectedStaffCount(data.staffSize),
        staff_categories: this.getStaffCategories(),
        venue_types: this.getVenueTypes(),

        // Shift management
        shift_patterns: {
          maxConcurrentShifts: data.operationalCapacity?.maxConcurrentShifts || 5,
          peakHoursCapacity: data.operationalCapacity?.peakHoursCapacity || 10,
          emergencyStaffing: data.operationalCapacity?.emergencyStaffing || 3,
          specialEventCapacity: data.operationalCapacity?.specialEventCapacity || 15
        },
        shift_approval_required: true,
        allow_shift_swapping: true,
        gps_tracking_required: true,

        // Payment configuration
        default_pay_rates: {
          staff: 12.50,
          supervisor: 15.00,
          manager: 18.00
        },
        payment_frequency: 'weekly',

        // Qualification requirements
        required_licenses: ['SIA License'],
        required_certifications: [],

        // Growth projections for reference
        growth_projections: {
          sixMonths: data.expectedGrowth?.sixMonths || 0,
          oneYear: data.expectedGrowth?.oneYear || 0,
          twoYears: data.expectedGrowth?.twoYears || 0
        },

        session_id: sessionId
      };

      const response = await api.put(`${this.baseUrl}/staff-config/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to save staff configuration:', error);
      throw new Error('Failed to save staff operations settings');
    }
  }

  /**
   * Map staff size to expected count
   */
  private getExpectedStaffCount(staffSize?: string): number {
    switch (staffSize) {
      case '1-10':
      case 'small':
        return 5;
      case '11-50':
      case 'medium':
        return 25;
      case '51-200':
      case 'large':
        return 100;
      case '200+':
      case 'enterprise':
        return 300;
      default:
        return 10;
    }
  }

  /**
   * Get default staff categories for security companies
   */
  private getStaffCategories(): string[] {
    return [
      'Security Officer',
      'Supervisor',
      'Manager',
      'Door Supervisor',
      'CCTV Operator',
      'Mobile Patrol',
      'Event Security'
    ];
  }

  /**
   * Get default venue types for security companies
   */
  private getVenueTypes(): string[] {
    return [
      'Corporate Offices',
      'Retail Stores',
      'Restaurants/Bars',
      'Events/Concerts',
      'Construction Sites',
      'Residential Buildings',
      'Healthcare Facilities',
      'Educational Institutions'
    ];
  }

  /**
   * Save integrations setup (Step 4)
   */
  async saveIntegrationsSetup(data: OnboardingWizardData['integrationsSetup'], sessionId?: string): Promise<OnboardingResponse> {
    try {
      const payload = {
        ...data,
        session_id: sessionId
      };
      const response = await api.put(`${this.baseUrl}/integrations/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to save integrations setup:', error);
      throw new Error('Failed to save integrations configuration');
    }
  }

  /**
   * Save account finalization (Step 5)
   */
  async saveAccountFinalization(data: OnboardingWizardData['accountFinalization'], sessionId?: string): Promise<OnboardingResponse> {
    try {
      const payload = {
        ...data,
        session_id: sessionId
      };
      const response = await api.put(`${this.baseUrl}/account-setup/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to save account finalization:', error);
      throw new Error('Failed to save account settings');
    }
  }

  /**
   * Complete the entire onboarding process
   */
  async completeOnboarding(data: OnboardingWizardData, sessionId?: string): Promise<{
    success: boolean;
    company: SecurityCompany;
    message: string;
  }> {
    try {
      const payload = {
        ...data,
        session_id: sessionId
      };
      const response = await api.post(`${this.baseUrl}/complete/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw new Error('Failed to complete onboarding process');
    }
  }

  /**
   * Validate a specific onboarding step (API version)
   */
  async validateStepAPI(step: string, data: any, sessionId?: string): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  }> {
    try {
      const payload = {
        step,
        data,
        session_id: sessionId
      };
      const response = await api.post(`${this.baseUrl}/validate-step/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to validate step:', error);
      throw new Error('Failed to validate step data');
    }
  }

  /**
   * Get regional compliance configuration for a country
   */
  async getRegionalCompliance(countryCode: string): Promise<RegionalComplianceConfig> {
    try {
      const response = await api.get(`${this.baseUrl}/regional-compliance/${countryCode}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to get regional compliance:', error);
      throw new Error('Failed to retrieve compliance configuration');
    }
  }

  /**
   * Test integration connection
   */
  async testIntegrationConnection(integrationId: string, credentials: Record<string, string>): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const payload = {
        integration_id: integrationId,
        credentials
      };
      const response = await api.post(`${this.baseUrl}/test-integration/`, payload);
      return response.data;
    } catch (error) {
      console.error('Failed to test integration:', error);
      throw new Error('Failed to test integration connection');
    }
  }

  /**
   * Upload company logo
   */
  async uploadCompanyLogo(file: File, sessionId?: string): Promise<{ logoUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('logo', file);
      if (sessionId) {
        formData.append('session_id', sessionId);
      }

      const response = await api.post(`${this.baseUrl}/upload-logo/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to upload logo:', error);
      throw new Error('Failed to upload company logo');
    }
  }

  /**
   * Save onboarding progress (for form persistence)
   */
  async saveProgress(data: Partial<OnboardingWizardData>, currentStep: number, sessionId: string): Promise<void> {
    try {
      const payload = {
        data,
        current_step: currentStep,
        session_id: sessionId,
        timestamp: new Date().toISOString()
      };
      await api.post(`${this.baseUrl}/save-progress/`, payload);
    } catch (error) {
      console.error('Failed to save progress:', error);
      // Don't throw error for progress saving failures
    }
  }

  /**
   * Load saved onboarding progress
   */
  async loadProgress(sessionId: string): Promise<{
    data: Partial<OnboardingWizardData>;
    currentStep: number;
    lastSaved: string;
  } | null> {
    try {
      const response = await api.get(`${this.baseUrl}/load-progress/${sessionId}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to load progress:', error);
      return null;
    }
  }

  /**
   * Delete saved onboarding progress (API version)
   */
  async clearProgressAPI(sessionId: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/clear-progress/${sessionId}/`);
    } catch (error) {
      console.error('Failed to clear progress:', error);
      // Don't throw error for cleanup failures
    }
  }

  /**
   * Get available countries for onboarding
   */
  async getAvailableCountries(): Promise<Array<{
    code: string;
    name: string;
    flag: string;
    hasCompliance: boolean;
  }>> {
    try {
      const response = await api.get(`${this.baseUrl}/countries/`);
      return response.data;
    } catch (error) {
      console.error('Failed to get available countries:', error);
      throw new Error('Failed to retrieve available countries');
    }
  }

  /**
   * Get onboarding statistics (for progress estimation)
   */
  async getOnboardingStats(): Promise<{
    averageCompletionTime: number; // minutes
    completionRate: number; // percentage
    commonDropOffPoints: string[];
    averageTimePerStep: Record<string, number>;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/`);
      return response.data;
    } catch (error) {
      console.error('Failed to get onboarding stats:', error);
      // Return defaults if stats unavailable
      return {
        averageCompletionTime: 15,
        completionRate: 85,
        commonDropOffPoints: [],
        averageTimePerStep: {
          companyInfo: 3,
          regionalCompliance: 2,
          staffOperations: 4,
          integrationsSetup: 5,
          accountFinalization: 3
        }
      };
    }
  }

  /**
   * Send onboarding completion notification
   */
  async sendCompletionNotification(companyId: string, adminEmail: string): Promise<void> {
    try {
      const payload = {
        company_id: companyId,
        admin_email: adminEmail
      };
      await api.post(`${this.baseUrl}/notify-completion/`, payload);
    } catch (error) {
      console.error('Failed to send completion notification:', error);
      // Don't throw error for notification failures
    }
  }

  // Local storage management for offline support
  private readonly STORAGE_KEYS = {
    PROGRESS: 'onboarding_progress',
    WIZARD_DATA: 'onboarding_wizard_data'
  };

  /**
   * Get onboarding progress from localStorage
   */
  getProgress(): { currentStep: number; completedSteps: number[]; companyId?: string; isCompleted?: boolean } | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.PROGRESS);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get progress from localStorage:', error);
      return null;
    }
  }

  /**
   * Update onboarding progress in localStorage
   */
  updateProgress(currentStep: number, completedSteps: number[], companyId?: string, isCompleted?: boolean): void {
    try {
      const progress = {
        currentStep,
        completedSteps,
        companyId,
        isCompleted,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to update progress in localStorage:', error);
    }
  }

  /**
   * Get wizard data from localStorage
   */
  getWizardData(): Partial<OnboardingWizardData> | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.WIZARD_DATA);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get wizard data from localStorage:', error);
      return null;
    }
  }

  /**
   * Save wizard data to localStorage
   */
  saveWizardData(data: Partial<OnboardingWizardData>): void {
    try {
      const existing = this.getWizardData() || {};
      const updated = { ...existing, ...data };
      localStorage.setItem(this.STORAGE_KEYS.WIZARD_DATA, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save wizard data to localStorage:', error);
    }
  }

  /**
   * Clear all onboarding data from localStorage
   */
  clearProgress(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEYS.PROGRESS);
      localStorage.removeItem(this.STORAGE_KEYS.WIZARD_DATA);
    } catch (error) {
      console.error('Failed to clear progress from localStorage:', error);
    }
  }

  /**
   * Validate step data locally (basic validation)
   */
  validateStep(data: any, step: number): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (step) {
      case 1: // Company Info
        if (!data?.companyName) {
          errors.push({ field: 'companyName', message: 'Company name is required', code: 'required' });
        }
        if (!data?.primaryContact?.email) {
          errors.push({ field: 'primaryContact.email', message: 'Primary contact email is required', code: 'required' });
        }
        break;
      case 2: // Regional Compliance
        if (!data?.primaryRegion) {
          errors.push({ field: 'primaryRegion', message: 'Primary region is required', code: 'required' });
        }
        break;
      case 3: // Staff Operations
        if (!data?.staffSize) {
          errors.push({ field: 'staffSize', message: 'Staff size is required', code: 'required' });
        }
        break;
      case 4: // Integrations Setup
        // Optional step - no required fields
        break;
      case 5: // Account Finalization
        if (!data?.adminUsers?.length) {
          errors.push({ field: 'adminUsers', message: 'At least one admin user is required', code: 'required' });
        }
        break;
    }

    return errors;
  }

  /**
   * Get available regions for compliance setup
   */
  async getAvailableRegions(): Promise<{ id: string; name: string; countryCode: string }[]> {
    try {
      // For now, return a hardcoded list of common UK regions
      // This could be extended to fetch from an API endpoint
      return [
        { id: 'uk', name: 'United Kingdom', countryCode: 'GB' },
        { id: 'england', name: 'England', countryCode: 'GB' },
        { id: 'scotland', name: 'Scotland', countryCode: 'GB' },
        { id: 'wales', name: 'Wales', countryCode: 'GB' },
        { id: 'northern-ireland', name: 'Northern Ireland', countryCode: 'GB' },
        { id: 'london', name: 'Greater London', countryCode: 'GB' },
        { id: 'manchester', name: 'Greater Manchester', countryCode: 'GB' },
        { id: 'birmingham', name: 'West Midlands', countryCode: 'GB' },
        { id: 'glasgow', name: 'Glasgow', countryCode: 'GB' },
        { id: 'edinburgh', name: 'Edinburgh', countryCode: 'GB' }
      ];
    } catch (error) {
      console.error('Failed to get available regions:', error);
      // Return default UK regions as fallback
      return [
        { id: 'uk', name: 'United Kingdom', countryCode: 'GB' },
        { id: 'england', name: 'England', countryCode: 'GB' }
      ];
    }
  }

  // Legacy function aliases for compatibility
  async submitCompanyInfo(data: any): Promise<OnboardingResponse> {
    return this.saveCompanyInfo(data);
  }

  async submitRegionalCompliance(data: any): Promise<OnboardingResponse> {
    return this.saveRegionalSetup(data);
  }

  async submitStaffOperations(data: any): Promise<OnboardingResponse> {
    return this.saveStaffConfiguration(data);
  }

  async submitIntegrationsSetup(data: any): Promise<OnboardingResponse> {
    return this.saveIntegrationsSetup(data);
  }

  async finalizeOnboarding(data: any): Promise<OnboardingResponse> {
    return this.saveAccountFinalization(data);
  }
}

export default new OnboardingService();