/**
 * Tests for Teams API Service
 */

import { teamsApi, PresenceStatus, ActivityStatus, TeamMember } from '../teamsApi';

// Mock the apiService
jest.mock('../api', () => ({
  apiService: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

import { apiService } from '../api';

describe('TeamsApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeamMembers', () => {
    it('should fetch team members successfully', async () => {
      const mockResponse = {
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 1,
            username: 'testuser1',
            name: 'Test User 1',
            role: 'staff',
            presenceStatus: 'available',
          },
          {
            id: 2,
            username: 'testuser2',
            name: 'Test User 2',
            role: 'manager',
            presenceStatus: 'busy',
          },
        ],
        stats: {
          total_members: 2,
          online_count: 1,
          on_shift_count: 1,
        },
      };

      (apiService.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await teamsApi.getTeamMembers();

      expect(apiService.get).toHaveBeenCalledWith('/api/v1/teams/members/');
      expect(result).toEqual(mockResponse);
    });

    it('should apply query parameters', async () => {
      const mockResponse = { results: [], stats: {} };
      (apiService.get as jest.Mock).mockResolvedValue(mockResponse);

      await teamsApi.getTeamMembers({
        presence_status: 'available',
        role: 'staff',
      });

      expect(apiService.get).toHaveBeenCalledWith(
        expect.stringContaining('presence_status=available')
      );
      expect(apiService.get).toHaveBeenCalledWith(
        expect.stringContaining('role=staff')
      );
    });
  });

  describe('getOnlineMembers', () => {
    it('should fetch online members successfully', async () => {
      const mockMembers = [
        { id: 1, username: 'user1', presenceStatus: 'available' },
      ];

      (apiService.get as jest.Mock).mockResolvedValue(mockMembers);

      const result = await teamsApi.getOnlineMembers();

      expect(apiService.get).toHaveBeenCalledWith('/api/v1/teams/members/online/');
      expect(result).toEqual(mockMembers);
    });

    it('should handle paginated response', async () => {
      const mockResponse = {
        results: [{ id: 1, username: 'user1' }],
        count: 1,
      };

      (apiService.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await teamsApi.getOnlineMembers();

      expect(result).toEqual(mockResponse.results);
    });
  });

  describe('getMyPresence', () => {
    it('should fetch current user presence', async () => {
      const mockPresence = {
        id: 1,
        status: 'available',
        activity: 'working',
        statusMessage: 'Ready for duty',
        isMobileConnected: true,
        lastSeen: '2024-01-15T10:00:00Z',
      };

      (apiService.get as jest.Mock).mockResolvedValue(mockPresence);

      const result = await teamsApi.getMyPresence();

      expect(apiService.get).toHaveBeenCalledWith('/api/v1/teams/members/me/presence/');
      expect(result).toEqual(mockPresence);
    });
  });

  describe('updateMyPresence', () => {
    it('should update presence status', async () => {
      const mockResponse = {
        id: 1,
        status: 'busy',
        activity: 'incident_response',
        statusMessage: 'Handling emergency',
      };

      (apiService.patch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await teamsApi.updateMyPresence({
        status: 'busy',
        activity: 'incident_response',
        statusMessage: 'Handling emergency',
      });

      expect(apiService.patch).toHaveBeenCalledWith(
        '/api/v1/teams/members/me/presence/',
        {
          status: 'busy',
          activity: 'incident_response',
          statusMessage: 'Handling emergency',
        }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('convenience methods', () => {
    it('setAvailable should call updateMyPresence with available status', async () => {
      const mockResponse = { status: 'available' };
      (apiService.patch as jest.Mock).mockResolvedValue(mockResponse);

      await teamsApi.setAvailable('On duty');

      expect(apiService.patch).toHaveBeenCalledWith(
        '/api/v1/teams/members/me/presence/',
        expect.objectContaining({
          status: 'available',
          statusMessage: 'On duty',
        })
      );
    });

    it('setBusy should call updateMyPresence with busy status', async () => {
      const mockResponse = { status: 'busy' };
      (apiService.patch as jest.Mock).mockResolvedValue(mockResponse);

      await teamsApi.setBusy();

      expect(apiService.patch).toHaveBeenCalledWith(
        '/api/v1/teams/members/me/presence/',
        expect.objectContaining({
          status: 'busy',
        })
      );
    });

    it('setAway should call updateMyPresence with away status', async () => {
      const mockResponse = { status: 'away' };
      (apiService.patch as jest.Mock).mockResolvedValue(mockResponse);

      await teamsApi.setAway('On break');

      expect(apiService.patch).toHaveBeenCalledWith(
        '/api/v1/teams/members/me/presence/',
        expect.objectContaining({
          status: 'away',
          statusMessage: 'On break',
        })
      );
    });
  });

  describe('normalizeTeamMember', () => {
    it('should normalize snake_case to camelCase', () => {
      const apiMember: TeamMember = {
        id: 1,
        username: 'testuser',
        name: 'Test User',
        role: 'staff',
        presence_status: 'available',
        status_message: 'Ready',
        current_venue: 'Main Entrance',
        is_online: true,
        last_seen: '2024-01-15T10:00:00Z',
      } as any;

      const normalized = teamsApi.normalizeTeamMember(apiMember);

      expect(normalized.presenceStatus).toBe('available');
      expect(normalized.statusMessage).toBe('Ready');
      expect(normalized.currentVenue).toBe('Main Entrance');
      expect(normalized.isOnline).toBe(true);
      expect(normalized.lastSeen).toBe('2024-01-15T10:00:00Z');
    });

    it('should prefer camelCase values if present', () => {
      const apiMember: TeamMember = {
        id: 1,
        username: 'testuser',
        name: 'Test User',
        role: 'staff',
        presenceStatus: 'busy',
        presence_status: 'available',
      } as any;

      const normalized = teamsApi.normalizeTeamMember(apiMember);

      // Should prefer presenceStatus (camelCase)
      expect(normalized.presenceStatus).toBe('busy');
    });

    it('should default to offline if no presence status', () => {
      const apiMember: TeamMember = {
        id: 1,
        username: 'testuser',
        name: 'Test User',
        role: 'staff',
      } as any;

      const normalized = teamsApi.normalizeTeamMember(apiMember);

      expect(normalized.presenceStatus).toBe('offline');
    });
  });
});
