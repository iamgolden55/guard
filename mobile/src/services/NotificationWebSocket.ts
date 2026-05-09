import * as SecureStore from 'expo-secure-store';
import { AppState, AppStateStatus } from 'react-native';

import { API_CONFIG } from '../utils/constants';
import { logger } from '../utils/logger';

export interface NotificationSocketMessage {
  type: 'notification';
  title: string;
  message: string;
  timestamp: string;
  level?: string;
  category?: string;
  notification_id?: string;
  notification_type?: string;
  priority?: string;
  related_type?: string;
  related_id?: string;
  action_url?: string;
}

interface ConnectedMessage {
  type: 'connected';
  message: string;
  timestamp: string;
}

interface ErrorMessage {
  type: 'error';
  message: string;
  timestamp: string;
}

interface PongMessage {
  type: 'pong';
  timestamp: string;
}

export type CapacityEventName =
  | 'capacity_logged'
  | 'capacity_overdue'
  | 'logbook_signed';

export interface CapacityEventMessage {
  type: 'capacity_event';
  event: CapacityEventName;
  shift_group: string;
  venue_id?: number | null;
  shift_id?: number | null;
  current_count?: number | null;
  venue_capacity?: number | null;
  is_at_capacity?: boolean | null;
  performed_by?: {
    id: number | null;
    first_name: string;
    last_name: string;
  } | null;
  logged_at?: string | null;
  next_due_at?: string | null;
  expected_at?: string | null;
  closed_by_name?: string | null;
  override_reason?: string | null;
  timestamp: string;
}

type SocketMessage =
  | NotificationSocketMessage
  | CapacityEventMessage
  | ConnectedMessage
  | ErrorMessage
  | PongMessage;

export type NotificationListener = (message: NotificationSocketMessage) => void;
export type CapacityEventListener = (message: CapacityEventMessage) => void;
export type ConnectionStateListener = (connected: boolean) => void;
export type ErrorListener = (error: Error) => void;

class NotificationWebSocketService {
  private static instance: NotificationWebSocketService;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isBackgrounded = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly initialReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private readonly heartbeatIntervalMs = 30000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

  private notificationListeners = new Set<NotificationListener>();
  private capacityEventListeners = new Set<CapacityEventListener>();
  private connectionStateListeners = new Set<ConnectionStateListener>();
  private errorListeners = new Set<ErrorListener>();

  private constructor() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this),
    );
  }

  static getInstance(): NotificationWebSocketService {
    if (!NotificationWebSocketService.instance) {
      NotificationWebSocketService.instance = new NotificationWebSocketService();
    }
    return NotificationWebSocketService.instance;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async connect(): Promise<void> {
    if (!this.hasAnyListeners()) {
      logger.debug('[NotificationWebSocket] Skipping connect with no listeners');
      return;
    }

    if (this.isBackgrounded || this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        logger.warn('[NotificationWebSocket] No access token available');
        this.isConnecting = false;
        return;
      }

      const wsUrl = `${API_CONFIG.WS_URL}/notifications/?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      logger.error('[NotificationWebSocket] Failed to connect', { error });
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.cancelReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.notifyConnectionStateListeners(false);
  }

  addNotificationListener(listener: NotificationListener): () => void {
    this.notificationListeners.add(listener);
    void this.connect();

    return () => {
      this.notificationListeners.delete(listener);
      if (!this.hasAnyListeners()) {
        this.disconnect();
      }
    };
  }

  addCapacityEventListener(listener: CapacityEventListener): () => void {
    this.capacityEventListeners.add(listener);
    void this.connect();

    return () => {
      this.capacityEventListeners.delete(listener);
      if (!this.hasAnyListeners()) {
        this.disconnect();
      }
    };
  }

  addConnectionStateListener(listener: ConnectionStateListener): () => void {
    this.connectionStateListeners.add(listener);
    listener(this.isConnected);
    return () => this.connectionStateListeners.delete(listener);
  }

  addErrorListener(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private hasAnyListeners(): boolean {
    return this.notificationListeners.size > 0 || this.capacityEventListeners.size > 0;
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active') {
      this.isBackgrounded = false;
      this.reconnectAttempts = 0;
      if (this.hasAnyListeners() && !this.isConnected && !this.isConnecting) {
        void this.connect();
      }
      return;
    }

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      this.isBackgrounded = true;
      this.disconnectForBackground();
    }
  }

  private disconnectForBackground(): void {
    this.cancelReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      this.isConnected = false;
      this.isConnecting = false;

      try {
        ws.close(1000, 'App backgrounded');
      } catch (error) {
        logger.debug('[NotificationWebSocket] Close during background failed', { error });
      }
    }

    this.notifyConnectionStateListeners(false);
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) {
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.notifyConnectionStateListeners(true);
    };

    this.ws.onclose = (event) => {
      if (this.isBackgrounded) {
        return;
      }

      this.isConnected = false;
      this.isConnecting = false;
      this.stopHeartbeat();
      this.notifyConnectionStateListeners(false);

      logger.info('[NotificationWebSocket] Disconnected', {
        code: event.code,
        reason: event.reason,
      });

      if (this.hasAnyListeners()) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      if (this.isBackgrounded) {
        return;
      }

      this.notifyErrorListeners(new Error('Notification WebSocket connection error'));
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: SocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'connected':
          logger.info('[NotificationWebSocket] Connected');
          break;
        case 'notification':
          this.notifyNotificationListeners(message);
          break;
        case 'capacity_event':
          this.notifyCapacityEventListeners(message);
          break;
        case 'pong':
          logger.debug('[NotificationWebSocket] Pong received');
          break;
        case 'error':
          this.notifyErrorListeners(new Error(message.message));
          break;
        default:
          logger.warn('[NotificationWebSocket] Unknown message type', {
            type: (message as { type?: string }).type,
          });
      }
    } catch (error) {
      logger.error('[NotificationWebSocket] Failed to parse message', { data, error });
    }
  }

  private send(message: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('[NotificationWebSocket] Failed to send message', { error });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' });
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isBackgrounded || !this.hasAnyListeners()) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.notifyErrorListeners(new Error('Max notification reconnect attempts reached'));
      return;
    }

    const baseDelay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    const delay = baseDelay + Math.random() * 1000;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts += 1;
      void this.connect();
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private notifyNotificationListeners(message: NotificationSocketMessage): void {
    this.notificationListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        logger.error('[NotificationWebSocket] Notification listener failed', { error });
      }
    });
  }

  private notifyCapacityEventListeners(message: CapacityEventMessage): void {
    this.capacityEventListeners.forEach((listener) => {
      try {
        listener(message);
      } catch (error) {
        logger.error('[NotificationWebSocket] Capacity event listener failed', { error });
      }
    });
  }

  private notifyConnectionStateListeners(connected: boolean): void {
    this.connectionStateListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (error) {
        logger.error('[NotificationWebSocket] Connection listener failed', { error });
      }
    });
  }

  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (listenerError) {
        logger.error('[NotificationWebSocket] Error listener failed', {
          error: listenerError,
        });
      }
    });
  }
}

export const notificationWebSocket = NotificationWebSocketService.getInstance();
export default notificationWebSocket;
