import api from './api';
import {
  SecurityCompany,
  UserCompanyMembership,
  CompanyContextResponse,
  CompanyRole,
  CompanyPermission,
  SubscriptionDetails,
  CompanyLimits
} from '../types';

/**
 * Service for managing company-related API calls in multi-tenant environment
 */
class CompanyService {
  private readonly baseUrl = '/api/v1/companies';

  /**
   * Get current company context (company + user role + permissions + limits)
   * Returns null if the user doesn't have a company (e.g., during onboarding)
   */
  async getCurrentCompanyContext(): Promise<CompanyContextResponse | null> {
    try {
      const response = await api.get(`${this.baseUrl}/current/`);
      // If the API returns null company and membership, return null
      if (response.data.company === null && response.data.membership === null) {
        return null;
      }
      return response.data;
    } catch (error) {
      console.error('Failed to get current company context:', error);
      // Return null instead of throwing for users without companies
      return null;
    }
  }

  /**
   * Get all companies the current user has access to
   */
  async getUserCompanies(): Promise<{
    companies: SecurityCompany[];
    memberships: UserCompanyMembership[];
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to get user companies:', error);
      throw new Error('Failed to retrieve user companies');
    }
  }

  /**
   * Switch to a different company context
   */
  async switchCompany(companyId: string): Promise<CompanyContextResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/switch/`, {
        company_id: companyId
      });
      return response.data;
    } catch (error) {
      console.error('Failed to switch company:', error);
      throw new Error('Failed to switch company context');
    }
  }

  /**
   * Get company by ID
   */
  async getCompanyById(companyId: string): Promise<SecurityCompany> {
    try {
      const response = await api.get(`${this.baseUrl}/${companyId}/`);
      return response.data;
    } catch (error) {
      console.error('Failed to get company by ID:', error);
      throw new Error('Failed to retrieve company details');
    }
  }

  /**
   * Update company information
   */
  async updateCompany(companyId: string, updates: Partial<SecurityCompany>): Promise<SecurityCompany> {
    try {
      const response = await api.patch(`${this.baseUrl}/${companyId}/`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update company:', error);
      throw new Error('Failed to update company information');
    }
  }

  /**
   * Get company subscription details
   */
  async getSubscriptionDetails(companyId?: string): Promise<SubscriptionDetails> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/subscription/`
        : `${this.baseUrl}/current/subscription/`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get subscription details:', error);
      throw new Error('Failed to retrieve subscription information');
    }
  }

  /**
   * Get company resource limits and usage
   */
  async getCompanyLimits(companyId?: string): Promise<CompanyLimits> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/limits/`
        : `${this.baseUrl}/current/limits/`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get company limits:', error);
      throw new Error('Failed to retrieve company limits');
    }
  }

  /**
   * Get company members
   */
  async getCompanyMembers(companyId?: string): Promise<UserCompanyMembership[]> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/members/`
        : `${this.baseUrl}/current/members/`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get company members:', error);
      throw new Error('Failed to retrieve company members');
    }
  }

  /**
   * Invite user to company
   */
  async inviteUser(companyId: string, email: string, role: CompanyRole, permissions: CompanyPermission[]): Promise<{
    success: boolean;
    invitationId: string;
    message: string;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/${companyId}/invite/`, {
        email,
        role,
        permissions
      });
      return response.data;
    } catch (error) {
      console.error('Failed to invite user:', error);
      throw new Error('Failed to send user invitation');
    }
  }

  /**
   * Update user role and permissions
   */
  async updateUserRole(companyId: string, userId: number, role: CompanyRole, permissions: CompanyPermission[]): Promise<UserCompanyMembership> {
    try {
      const response = await api.patch(`${this.baseUrl}/${companyId}/members/${userId}/`, {
        role,
        permissions
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update user role:', error);
      throw new Error('Failed to update user permissions');
    }
  }

  /**
   * Remove user from company
   */
  async removeUser(companyId: string, userId: number): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${companyId}/members/${userId}/`);
    } catch (error) {
      console.error('Failed to remove user:', error);
      throw new Error('Failed to remove user from company');
    }
  }

  /**
   * Accept company invitation
   */
  async acceptInvitation(invitationToken: string): Promise<{
    success: boolean;
    company: SecurityCompany;
    membership: UserCompanyMembership;
  }> {
    try {
      const response = await api.post('/api/v1/invitations/accept/', {
        token: invitationToken
      });
      return response.data;
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      throw new Error('Failed to accept company invitation');
    }
  }

  /**
   * Leave company (only if not owner)
   */
  async leaveCompany(companyId: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${companyId}/leave/`);
    } catch (error) {
      console.error('Failed to leave company:', error);
      throw new Error('Failed to leave company');
    }
  }

  /**
   * Transfer company ownership
   */
  async transferOwnership(companyId: string, newOwnerId: number): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/${companyId}/transfer-ownership/`, {
        new_owner_id: newOwnerId
      });
    } catch (error) {
      console.error('Failed to transfer ownership:', error);
      throw new Error('Failed to transfer company ownership');
    }
  }

  /**
   * Delete company (owner only)
   */
  async deleteCompany(companyId: string, confirmationText: string): Promise<void> {
    try {
      await api.delete(`${this.baseUrl}/${companyId}/`, {
        data: { confirmation: confirmationText }
      });
    } catch (error) {
      console.error('Failed to delete company:', error);
      throw new Error('Failed to delete company');
    }
  }

  /**
   * Get company activity log
   */
  async getActivityLog(companyId?: string, page: number = 1, limit: number = 50): Promise<{
    activities: Array<{
      id: string;
      action: string;
      user: string;
      timestamp: string;
      details: Record<string, any>;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/activity/`
        : `${this.baseUrl}/current/activity/`;
      const response = await api.get(url, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get activity log:', error);
      throw new Error('Failed to retrieve activity log');
    }
  }

  /**
   * Update company settings
   */
  async updateSettings(companyId: string, settings: {
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    language?: string;
    notifications?: Record<string, boolean>;
  }): Promise<void> {
    try {
      await api.patch(`${this.baseUrl}/${companyId}/settings/`, settings);
    } catch (error) {
      console.error('Failed to update company settings:', error);
      throw new Error('Failed to update company settings');
    }
  }

  /**
   * Get company settings
   */
  async getSettings(companyId?: string): Promise<{
    timezone: string;
    dateFormat: string;
    currency: string;
    language: string;
    notifications: Record<string, boolean>;
  }> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/settings/`
        : `${this.baseUrl}/current/settings/`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get company settings:', error);
      throw new Error('Failed to retrieve company settings');
    }
  }

  /**
   * Check if resource limit would be exceeded
   */
  async checkResourceLimit(resource: string, quantity: number = 1, companyId?: string): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    remaining: number;
  }> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/check-limit/`
        : `${this.baseUrl}/current/check-limit/`;
      const response = await api.post(url, {
        resource,
        quantity
      });
      return response.data;
    } catch (error) {
      console.error('Failed to check resource limit:', error);
      throw new Error('Failed to check resource availability');
    }
  }

  /**
   * Get company dashboard data
   */
  async getDashboardData(companyId?: string): Promise<{
    stats: {
      totalStaff: number;
      activeShifts: number;
      totalVenues: number;
      monthlyRevenue: number;
    };
    recentActivity: Array<{
      type: string;
      message: string;
      timestamp: string;
    }>;
    alerts: Array<{
      level: 'info' | 'warning' | 'error';
      message: string;
      action?: string;
    }>;
  }> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/dashboard/`
        : `${this.baseUrl}/current/dashboard/`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      throw new Error('Failed to retrieve dashboard information');
    }
  }

  /**
   * Upload company logo
   */
  async uploadLogo(companyId: string, file: File): Promise<{ logoUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await api.post(`${this.baseUrl}/${companyId}/upload-logo/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to upload company logo:', error);
      throw new Error('Failed to upload company logo');
    }
  }

  /**
   * Search companies (for system admins)
   */
  async searchCompanies(query: string, page: number = 1, limit: number = 20): Promise<{
    companies: SecurityCompany[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/search/`, {
        params: { q: query, page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search companies:', error);
      throw new Error('Failed to search companies');
    }
  }

  /**
   * Get company compliance report
   */
  async getComplianceReport(companyId?: string): Promise<{
    score: number;
    issues: Array<{
      level: 'low' | 'medium' | 'high';
      category: string;
      description: string;
      recommendation: string;
    }>;
    lastUpdated: string;
  }> {
    try {
      const url = companyId
        ? `${this.baseUrl}/${companyId}/compliance/`
        : `${this.baseUrl}/current/compliance/`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get compliance report:', error);
      throw new Error('Failed to retrieve compliance information');
    }
  }
}

export default new CompanyService();