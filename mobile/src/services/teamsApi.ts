/**
 * Teams API Service
 *
 * API service for team presence and team member management.
 * Handles REST API calls to the backend team endpoints.
 */

import { apiService } from './api';
import { logger } from '../utils/logger';

// Types
export type PresenceStatus =
  | 'available'
  | 'busy'
  | 'away'
  | 'in_call'
  | 'presenting'
  | 'offline'
  | 'do_not_disturb';

export type ActivityStatus =
  | 'working'
  | 'on_break'
  | 'patrolling'
  | 'incident_response'
  | 'shift_handover'
  | 'meeting'
  | 'training'
  | 'custom';

export interface TeamMember {
  id: number;
  username: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  phone?: string;
  email?: string;
  presenceStatus: PresenceStatus;
  presence_status?: PresenceStatus;
  activity?: ActivityStatus;
  statusMessage?: string;
  status_message?: string;
  currentVenue?: string;
  current_venue?: string;
  isOnline?: boolean;
  is_online?: boolean;
  lastSeen?: string;
  last_seen?: string;
}

export interface TeamMembersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TeamMember[];
  stats: {
    total_members: number;
    online_count: number;
    on_shift_count: number;
  };
}

export interface UserPresenceStatus {
  id: number;
  status: PresenceStatus;
  activity: ActivityStatus;
  statusMessage: string;
  status_message?: string;
  isMobileConnected: boolean;
  is_mobile_connected?: boolean;
  lastSeen: string;
  last_seen?: string;
  currentVenue?: {
    id: number;
    name: string;
  } | null;
  currentShift?: {
    id: number;
    start_time: string;
    end_time: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface UpdatePresenceRequest {
  status?: PresenceStatus;
  activity?: ActivityStatus;
  statusMessage?: string;
  status_message?: string;
}

export interface TeamMembersQueryParams {
  presence_status?: PresenceStatus | 'online';
  role?: string;
  venue?: number;
  company?: string;
  search?: string;
  page?: number;
}

/**
 * Teams API Service Class
 */
class TeamsApiService {
  private readonly baseEndpoint = '/api/v1/teams/members';

  /**
   * Get list of team members with presence data
   */
  async getTeamMembers(params?: TeamMembersQueryParams): Promise<TeamMembersResponse> {
    try {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.presence_status) queryParams.set('presence_status', params.presence_status);
        if (params.role) queryParams.set('role', params.role);
        if (params.venue) queryParams.set('venue', params.venue.toString());
        if (params.company) queryParams.set('company', params.company);
        if (params.search) queryParams.set('search', params.search);
        if (params.page) queryParams.set('page', params.page.toString());
      }

      const queryString = queryParams.toString();
      const endpoint = queryString ? `${this.baseEndpoint}/?${queryString}` : `${this.baseEndpoint}/`;

      logger.info('Fetching team members', { endpoint });
      const response = await apiService.get<TeamMembersResponse>(endpoint);

      return response;
    } catch (error) {
      logger.error('Failed to fetch team members', { error });
      throw error;
    }
  }

  /**
   * Get a specific team member by ID
   */
  async getTeamMember(memberId: number): Promise<TeamMember> {
    try {
      const response = await apiService.get<TeamMember>(`${this.baseEndpoint}/${memberId}/`);
      return response;
    } catch (error) {
      logger.error('Failed to fetch team member', { memberId, error });
      throw error;
    }
  }

  /**
   * Get online team members only
   */
  async getOnlineMembers(): Promise<TeamMember[]> {
    try {
      logger.info('Fetching online team members');
      const response = await apiService.get<TeamMember[] | TeamMembersResponse>(
        `${this.baseEndpoint}/online/`
      );

      // Handle both array and paginated response
      if (Array.isArray(response)) {
        return response;
      }
      return response.results || [];
    } catch (error) {
      logger.error('Failed to fetch online members', { error });
      throw error;
    }
  }

  /**
   * Get team members currently on shift
   */
  async getOnShiftMembers(): Promise<TeamMember[]> {
    try {
      logger.info('Fetching on-shift team members');
      const response = await apiService.get<TeamMember[] | TeamMembersResponse>(
        `${this.baseEndpoint}/on-shift/`
      );

      // Handle both array and paginated response
      if (Array.isArray(response)) {
        return response;
      }
      return response.results || [];
    } catch (error) {
      logger.error('Failed to fetch on-shift members', { error });
      throw error;
    }
  }

  /**
   * Get current user's presence status
   */
  async getMyPresence(): Promise<UserPresenceStatus> {
    try {
      logger.info('Fetching my presence status');
      const response = await apiService.get<UserPresenceStatus>(`${this.baseEndpoint}/me/presence/`);
      return response;
    } catch (error) {
      logger.error('Failed to fetch my presence', { error });
      throw error;
    }
  }

  /**
   * Update current user's presence status
   */
  async updateMyPresence(data: UpdatePresenceRequest): Promise<UserPresenceStatus> {
    try {
      logger.info('Updating my presence status', { data });
      const response = await apiService.patch<UserPresenceStatus>(
        `${this.baseEndpoint}/me/presence/`,
        data
      );
      return response;
    } catch (error) {
      logger.error('Failed to update my presence', { error });
      throw error;
    }
  }

  /**
   * Set user status to available
   */
  async setAvailable(statusMessage?: string): Promise<UserPresenceStatus> {
    return this.updateMyPresence({
      status: 'available',
      statusMessage,
    });
  }

  /**
   * Set user status to busy
   */
  async setBusy(statusMessage?: string): Promise<UserPresenceStatus> {
    return this.updateMyPresence({
      status: 'busy',
      statusMessage: statusMessage || 'Busy',
    });
  }

  /**
   * Set user status to away
   */
  async setAway(statusMessage?: string): Promise<UserPresenceStatus> {
    return this.updateMyPresence({
      status: 'away',
      statusMessage: statusMessage || 'Away',
    });
  }

  /**
   * Set user status to do not disturb
   */
  async setDoNotDisturb(statusMessage?: string): Promise<UserPresenceStatus> {
    return this.updateMyPresence({
      status: 'do_not_disturb',
      statusMessage: statusMessage || 'Do not disturb',
    });
  }

  /**
   * Update activity status
   */
  async updateActivity(activity: ActivityStatus, statusMessage?: string): Promise<UserPresenceStatus> {
    return this.updateMyPresence({
      activity,
      statusMessage,
    });
  }

  /**
   * Normalize team member data to camelCase
   */
  normalizeTeamMember(member: TeamMember): TeamMember {
    return {
      ...member,
      presenceStatus: member.presenceStatus || member.presence_status || 'offline',
      statusMessage: member.statusMessage || member.status_message || '',
      currentVenue: member.currentVenue || member.current_venue || undefined,
      isOnline: member.isOnline ?? member.is_online ?? false,
      lastSeen: member.lastSeen || member.last_seen || undefined,
    };
  }

  /**
   * Normalize array of team members
   */
  normalizeTeamMembers(members: TeamMember[]): TeamMember[] {
    return members.map((member) => this.normalizeTeamMember(member));
  }
}

// Export singleton instance
export const teamsApi = new TeamsApiService();
export default teamsApi;
