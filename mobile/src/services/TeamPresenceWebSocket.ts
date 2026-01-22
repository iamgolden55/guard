/**
 * Team Presence WebSocket Service
 *
 * Singleton service that manages WebSocket connection for real-time team presence updates.
 * Provides auto-reconnect logic, heartbeat management, and event-driven updates.
 */

import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { AppState, AppStateStatus } from 'react-native';
import { logger } from '../utils/logger';
import type { PresenceStatus, ActivityStatus, TeamMember } from './teamsApi';

// Types
export interface TeamMemberUpdate {
  type: 'team_member_update';
  event: 'online' | 'offline' | 'status_change';
  user_id: number;
  username: string;
  name: string;
  status: PresenceStatus;
  activity?: ActivityStatus;
  status_message?: string;
  current_venue?: string;
  last_seen?: string;
  timestamp: string;
}

export interface ConnectionEstablished {
  type: 'connection_established';
  message: string;
  user_id: number;
  username: string;
  status: PresenceStatus;
  timestamp: string;
}

export interface StatusUpdated {
  type: 'status_updated';
  status: PresenceStatus;
  activity?: ActivityStatus;
  status_message?: string;
  timestamp: string;
}

export interface TeamMembersResponse {
  type: 'team_members';
  members: TeamMember[];
  timestamp: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat' | 'heartbeat_ack';
  timestamp: string;
}

export interface PongMessage {
  type: 'pong';
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  timestamp: string;
}

export type WebSocketMessage =
  | TeamMemberUpdate
  | ConnectionEstablished
  | StatusUpdated
  | TeamMembersResponse
  | HeartbeatMessage
  | PongMessage
  | ErrorMessage;

// Event listener types
export type TeamMemberUpdateListener = (update: TeamMemberUpdate) => void;
export type ConnectionStateListener = (connected: boolean) => void;
export type ErrorListener = (error: Error) => void;

// WebSocket base URL - derive from API base URL
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl ?? 'http://localhost:8000';
const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

/**
 * Team Presence WebSocket Manager
 */
class TeamPresenceWebSocketService {
  private static instance: TeamPresenceWebSocketService;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isBackgrounded = false; // Track if app is in background
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly initialReconnectDelay = 1000; // 1 second
  private readonly maxReconnectDelay = 30000; // 30 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs = 30000; // 30 seconds
  private appStateSubscription: any = null;

  // Event listeners
  private teamMemberUpdateListeners: Set<TeamMemberUpdateListener> = new Set();
  private connectionStateListeners: Set<ConnectionStateListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();

  private constructor() {
    // Private constructor for singleton
    this.setupAppStateListener();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TeamPresenceWebSocketService {
    if (!TeamPresenceWebSocketService.instance) {
      TeamPresenceWebSocketService.instance = new TeamPresenceWebSocketService();
    }
    return TeamPresenceWebSocketService.instance;
  }

  /**
   * Set up app state listener to handle background/foreground transitions
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange.bind(this));
  }

  /**
   * Handle app state changes (background/foreground)
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      // App came to foreground - reconnect if needed
      logger.info('App came to foreground, checking WebSocket connection');
      this.isBackgrounded = false;
      if (!this.isConnected && !this.isConnecting) {
        this.reconnectAttempts = 0; // Reset attempts when coming back to foreground
        this.connect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background - gracefully disconnect to prevent OS-forced closure errors
      logger.info('App went to background, disconnecting WebSocket gracefully');
      this.isBackgrounded = true;
      this.disconnectForBackground();
    }
  }

  /**
   * Gracefully disconnect when app goes to background
   * This prevents the OS from forcibly closing the connection and causing errors
   */
  private disconnectForBackground(): void {
    this.cancelReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      // Prevent the onclose handler from scheduling reconnect while backgrounded
      const ws = this.ws;
      this.ws = null;
      this.isConnected = false;
      this.isConnecting = false;

      // Close with normal closure code
      try {
        ws.close(1000, 'App backgrounded');
      } catch (error) {
        // Ignore close errors during background transition
        logger.debug('WebSocket close error during background transition (expected)', { error });
      }
    }

    this.notifyConnectionStateListeners(false);
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isBackgrounded) {
      logger.debug('Not connecting WebSocket while app is backgrounded');
      return;
    }

    if (this.isConnecting || this.isConnected) {
      logger.debug('WebSocket already connecting or connected');
      return;
    }

    this.isConnecting = true;

    try {
      const token = await SecureStore.getItemAsync('accessToken');

      if (!token) {
        logger.warn('No access token available for WebSocket connection');
        this.isConnecting = false;
        return;
      }

      const wsUrl = `${WS_BASE_URL}/ws/team/presence/?token=${encodeURIComponent(token)}`;
      logger.info('Connecting to Team Presence WebSocket', { url: wsUrl.replace(token, '***') });

      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      logger.error('Failed to initiate WebSocket connection', { error });
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      logger.info('Team Presence WebSocket connected');
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.notifyConnectionStateListeners(true);
    };

    this.ws.onclose = (event) => {
      // Don't log or reconnect if we intentionally disconnected for background
      if (this.isBackgrounded) {
        logger.debug('WebSocket closed while backgrounded (expected)', { code: event.code });
        return;
      }

      logger.info('Team Presence WebSocket disconnected', { code: event.code, reason: event.reason });
      this.isConnected = false;
      this.isConnecting = false;
      this.stopHeartbeat();
      this.notifyConnectionStateListeners(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      // Don't show error toast if we're backgrounded - this is expected behavior
      if (this.isBackgrounded) {
        logger.debug('WebSocket error while backgrounded (expected)');
        return;
      }

      // Log as warning instead of error to avoid LogBox toast for connection issues
      logger.warn('Team Presence WebSocket connection issue', { error });
      this.notifyErrorListeners(new Error('WebSocket connection error'));
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      logger.debug('Received WebSocket message', { type: message.type });

      switch (message.type) {
        case 'connection_established':
          logger.info('WebSocket connection established', {
            userId: (message as ConnectionEstablished).user_id,
          });
          break;

        case 'team_member_update':
          this.notifyTeamMemberUpdateListeners(message as TeamMemberUpdate);
          break;

        case 'status_updated':
          logger.info('Status updated', { status: (message as StatusUpdated).status });
          break;

        case 'team_members':
          logger.info('Received team members list', {
            count: (message as TeamMembersResponse).members.length,
          });
          break;

        case 'heartbeat':
          // Server heartbeat - respond with heartbeat ack
          this.sendHeartbeat();
          break;

        case 'heartbeat_ack':
        case 'pong':
          // Heartbeat acknowledged or pong received
          logger.debug('Heartbeat/pong received');
          break;

        case 'error':
          logger.warn('WebSocket error message', { message: (message as ErrorMessage).message });
          this.notifyErrorListeners(new Error((message as ErrorMessage).message));
          break;

        default:
          logger.warn('Unknown WebSocket message type', { type: (message as any).type });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', { data, error });
    }
  }

  /**
   * Send a message through the WebSocket
   */
  private send(message: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message - WebSocket not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send WebSocket message', { error });
    }
  }

  /**
   * Update current user's presence status
   */
  updateStatus(status: PresenceStatus, activity?: ActivityStatus, statusMessage?: string): void {
    this.send({
      type: 'update_status',
      status,
      activity,
      status_message: statusMessage,
    });
  }

  /**
   * Request current team members list
   */
  requestTeamMembers(): void {
    this.send({
      type: 'get_team_members',
    });
  }

  /**
   * Send ping message
   */
  sendPing(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Send heartbeat message
   */
  private sendHeartbeat(): void {
    this.send({ type: 'heartbeat' });
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendHeartbeat();
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    // Don't reconnect while backgrounded - will reconnect when app comes to foreground
    if (this.isBackgrounded) {
      logger.debug('Skipping reconnect while app is backgrounded');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('Max reconnect attempts reached');
      this.notifyErrorListeners(new Error('Max reconnect attempts reached'));
      return;
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;

    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${Math.round(delay)}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Cancel scheduled reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    logger.info('Disconnecting Team Presence WebSocket');

    this.cancelReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.notifyConnectionStateListeners(false);
  }

  /**
   * Clean up and destroy the service
   */
  destroy(): void {
    this.disconnect();

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.teamMemberUpdateListeners.clear();
    this.connectionStateListeners.clear();
    this.errorListeners.clear();
  }

  // Event listener management

  /**
   * Add listener for team member updates
   */
  addTeamMemberUpdateListener(listener: TeamMemberUpdateListener): () => void {
    this.teamMemberUpdateListeners.add(listener);
    return () => this.teamMemberUpdateListeners.delete(listener);
  }

  /**
   * Add listener for connection state changes
   */
  addConnectionStateListener(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.add(listener);
    // Immediately notify of current state
    listener(this.isConnected);
    return () => this.connectionStateListeners.delete(listener);
  }

  /**
   * Add listener for errors
   */
  addErrorListener(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Notify all team member update listeners
   */
  private notifyTeamMemberUpdateListeners(update: TeamMemberUpdate): void {
    this.teamMemberUpdateListeners.forEach((listener) => {
      try {
        listener(update);
      } catch (error) {
        logger.error('Error in team member update listener', { error });
      }
    });
  }

  /**
   * Notify all connection state listeners
   */
  private notifyConnectionStateListeners(connected: boolean): void {
    this.connectionStateListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (error) {
        logger.error('Error in connection state listener', { error });
      }
    });
  }

  /**
   * Notify all error listeners
   */
  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        logger.error('Error in error listener', { err });
      }
    });
  }

  // Getters

  /**
   * Check if WebSocket is currently connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Check if WebSocket is currently connecting
   */
  get connecting(): boolean {
    return this.isConnecting;
  }
}

// Export singleton instance
export const teamPresenceWebSocket = TeamPresenceWebSocketService.getInstance();
export default teamPresenceWebSocket;
