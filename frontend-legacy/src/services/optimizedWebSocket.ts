// Optimized WebSocket Service for Legal Compliance Reporting System
// SSMS-COMPLIANCE-2025 - High-performance real-time updates

import { ComplianceViolation, LiveComplianceStatus } from '../types/compliance';

interface WebSocketMessage {
  type: 'violation_detected' | 'violation_resolved' | 'status_update' | 'compliance_metrics_update' | 'alert_updated' | 'heartbeat';
  data: any;
  timestamp: string;
  id?: string;
}

interface ConnectionConfig {
  url: string;
  token: string;
  topics: string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  messageQueueSize: number;
}

interface WebSocketStats {
  connectionsCreated: number;
  messagesReceived: number;
  messagesSent: number;
  reconnectAttempts: number;
  averageLatency: number;
  lastMessageTime: Date | null;
  connectionUptime: number;
}

class OptimizedComplianceWebSocket {
  private connections: Map<string, WebSocket> = new Map();
  private messageQueues: Map<string, WebSocketMessage[]> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private connectionListeners: Map<string, Set<(message: WebSocketMessage) => void>> = new Map();
  private connectionStats: Map<string, WebSocketStats> = new Map();
  private messageBuffer: Map<string, WebSocketMessage[]> = new Map();

  private static instance: OptimizedComplianceWebSocket;
  private defaultConfig: Partial<ConnectionConfig> = {
    reconnectInterval: 5000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    messageQueueSize: 100,
  };

  private constructor() {
    // Singleton pattern for connection pooling
    this.setupGlobalEventListeners();
  }

  static getInstance(): OptimizedComplianceWebSocket {
    if (!OptimizedComplianceWebSocket.instance) {
      OptimizedComplianceWebSocket.instance = new OptimizedComplianceWebSocket();
    }
    return OptimizedComplianceWebSocket.instance;
  }

  /**
   * Create or get existing WebSocket connection
   */
  public connect(connectionId: string, config: ConnectionConfig): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      // Return existing connection if available and open
      const existingConnection = this.connections.get(connectionId);
      if (existingConnection && existingConnection.readyState === WebSocket.OPEN) {
        resolve(existingConnection);
        return;
      }

      const fullConfig = { ...this.defaultConfig, ...config };
      const wsUrl = `${fullConfig.url}?token=${fullConfig.token}&topics=${fullConfig.topics.join(',')}`;

      try {
        const ws = new WebSocket(wsUrl);

        // Initialize connection tracking
        this.initializeConnectionStats(connectionId);
        this.initializeMessageQueue(connectionId);

        ws.onopen = () => {
          console.log(`WebSocket connection opened: ${connectionId}`);
          this.connections.set(connectionId, ws);
          this.startHeartbeat(connectionId, fullConfig.heartbeatInterval!);
          this.processQueuedMessages(connectionId);
          this.updateConnectionStats(connectionId, { connectionsCreated: 1 });
          resolve(ws);
        };

        ws.onmessage = (event) => {
          this.handleMessage(connectionId, event);
        };

        ws.onclose = (event) => {
          this.handleConnectionClose(connectionId, event, fullConfig);
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for ${connectionId}:`, error);
          reject(error);
        };

        // Store connection immediately for tracking
        this.connections.set(connectionId, ws);

      } catch (error) {
        console.error(`Failed to create WebSocket connection ${connectionId}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Subscribe to messages for a specific connection
   */
  public subscribe(connectionId: string, listener: (message: WebSocketMessage) => void): () => void {
    if (!this.connectionListeners.has(connectionId)) {
      this.connectionListeners.set(connectionId, new Set());
    }

    this.connectionListeners.get(connectionId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.connectionListeners.get(connectionId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.connectionListeners.delete(connectionId);
        }
      }
    };
  }

  /**
   * Send message with queuing support for offline scenarios
   */
  public sendMessage(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);

    if (connection && connection.readyState === WebSocket.OPEN) {
      try {
        const messageWithId = {
          ...message,
          id: this.generateMessageId(),
          timestamp: new Date().toISOString(),
        };

        connection.send(JSON.stringify(messageWithId));
        this.updateConnectionStats(connectionId, { messagesSent: 1 });
        return true;
      } catch (error) {
        console.error(`Failed to send message on ${connectionId}:`, error);
        this.queueMessage(connectionId, message);
        return false;
      }
    } else {
      // Queue message for when connection is restored
      this.queueMessage(connectionId, message);
      return false;
    }
  }

  /**
   * Close specific connection
   */
  public closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.close(1000, 'Client initiated closure');
      this.cleanup(connectionId);
    }
  }

  /**
   * Close all connections
   */
  public closeAllConnections(): void {
    for (const [connectionId] of this.connections) {
      this.closeConnection(connectionId);
    }
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(connectionId: string): WebSocketStats | null {
    return this.connectionStats.get(connectionId) || null;
  }

  /**
   * Get all connection statistics
   */
  public getAllStats(): Map<string, WebSocketStats> {
    return new Map(this.connectionStats);
  }

  /**
   * Get buffered messages for connection
   */
  public getBufferedMessages(connectionId: string): WebSocketMessage[] {
    return this.messageBuffer.get(connectionId) || [];
  }

  /**
   * Clear message buffer
   */
  public clearMessageBuffer(connectionId: string): void {
    this.messageBuffer.delete(connectionId);
  }

  private handleMessage(connectionId: string, event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Update statistics
      this.updateConnectionStats(connectionId, {
        messagesReceived: 1,
        lastMessageTime: new Date()
      });

      // Handle heartbeat responses
      if (message.type === 'heartbeat') {
        this.handleHeartbeat(connectionId, message);
        return;
      }

      // Buffer message for potential replay
      this.bufferMessage(connectionId, message);

      // Notify all listeners
      const listeners = this.connectionListeners.get(connectionId);
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error(`Error in message listener for ${connectionId}:`, error);
          }
        });
      }

    } catch (error) {
      console.error(`Failed to parse WebSocket message for ${connectionId}:`, error);
    }
  }

  private handleConnectionClose(connectionId: string, event: CloseEvent, config: ConnectionConfig): void {
    console.log(`WebSocket connection closed: ${connectionId}`, event.code, event.reason);

    this.stopHeartbeat(connectionId);

    // Attempt reconnection if not a normal closure
    if (event.code !== 1000 && event.code !== 1001) {
      this.attemptReconnection(connectionId, config);
    } else {
      this.cleanup(connectionId);
    }
  }

  private attemptReconnection(connectionId: string, config: ConnectionConfig): void {
    const stats = this.connectionStats.get(connectionId);
    if (!stats || stats.reconnectAttempts >= config.maxReconnectAttempts!) {
      console.log(`Max reconnection attempts reached for ${connectionId}`);
      this.cleanup(connectionId);
      return;
    }

    this.updateConnectionStats(connectionId, { reconnectAttempts: 1 });

    const backoffDelay = Math.min(
      config.reconnectInterval! * Math.pow(2, stats.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`Attempting to reconnect ${connectionId} in ${backoffDelay}ms (attempt ${stats.reconnectAttempts + 1})`);

    const timeout = setTimeout(() => {
      this.connect(connectionId, config).catch(error => {
        console.error(`Reconnection failed for ${connectionId}:`, error);
        this.attemptReconnection(connectionId, config);
      });
    }, backoffDelay);

    this.reconnectTimeouts.set(connectionId, timeout);
  }

  private startHeartbeat(connectionId: string, interval: number): void {
    const heartbeatInterval = setInterval(() => {
      this.sendMessage(connectionId, {
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      });
    }, interval);

    this.heartbeatIntervals.set(connectionId, heartbeatInterval);
  }

  private stopHeartbeat(connectionId: string): void {
    const interval = this.heartbeatIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(connectionId);
    }
  }

  private handleHeartbeat(connectionId: string, message: WebSocketMessage): void {
    // Calculate latency if we have the original timestamp
    if (message.data?.originalTimestamp) {
      const latency = Date.now() - new Date(message.data.originalTimestamp).getTime();
      this.updateConnectionStats(connectionId, { averageLatency: latency });
    }
  }

  private queueMessage(connectionId: string, message: any): void {
    if (!this.messageQueues.has(connectionId)) {
      this.messageQueues.set(connectionId, []);
    }

    const queue = this.messageQueues.get(connectionId)!;
    const config = this.defaultConfig;

    // Remove oldest messages if queue is full
    while (queue.length >= config.messageQueueSize!) {
      queue.shift();
    }

    queue.push({
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date().toISOString()
    });
  }

  private processQueuedMessages(connectionId: string): void {
    const queue = this.messageQueues.get(connectionId);
    if (!queue) return;

    while (queue.length > 0) {
      const message = queue.shift()!;
      if (!this.sendMessage(connectionId, message)) {
        // If sending fails, put message back at front of queue
        queue.unshift(message);
        break;
      }
    }
  }

  private bufferMessage(connectionId: string, message: WebSocketMessage): void {
    if (!this.messageBuffer.has(connectionId)) {
      this.messageBuffer.set(connectionId, []);
    }

    const buffer = this.messageBuffer.get(connectionId)!;

    // Keep only last 50 messages
    while (buffer.length >= 50) {
      buffer.shift();
    }

    buffer.push(message);
  }

  private initializeConnectionStats(connectionId: string): void {
    this.connectionStats.set(connectionId, {
      connectionsCreated: 0,
      messagesReceived: 0,
      messagesSent: 0,
      reconnectAttempts: 0,
      averageLatency: 0,
      lastMessageTime: null,
      connectionUptime: Date.now(),
    });
  }

  private initializeMessageQueue(connectionId: string): void {
    if (!this.messageQueues.has(connectionId)) {
      this.messageQueues.set(connectionId, []);
    }
  }

  private updateConnectionStats(connectionId: string, updates: Partial<WebSocketStats>): void {
    const stats = this.connectionStats.get(connectionId);
    if (!stats) return;

    if (updates.connectionsCreated) {
      stats.connectionsCreated += updates.connectionsCreated;
    }
    if (updates.messagesReceived) {
      stats.messagesReceived += updates.messagesReceived;
    }
    if (updates.messagesSent) {
      stats.messagesSent += updates.messagesSent;
    }
    if (updates.reconnectAttempts) {
      stats.reconnectAttempts += updates.reconnectAttempts;
    }
    if (updates.averageLatency !== undefined) {
      // Simple moving average
      stats.averageLatency = (stats.averageLatency + updates.averageLatency) / 2;
    }
    if (updates.lastMessageTime) {
      stats.lastMessageTime = updates.lastMessageTime;
    }
  }

  private cleanup(connectionId: string): void {
    // Close connection
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.close();
      this.connections.delete(connectionId);
    }

    // Clear timeouts
    const reconnectTimeout = this.reconnectTimeouts.get(connectionId);
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      this.reconnectTimeouts.delete(connectionId);
    }

    // Stop heartbeat
    this.stopHeartbeat(connectionId);

    // Clear listeners
    this.connectionListeners.delete(connectionId);

    // Clear queues and buffers
    this.messageQueues.delete(connectionId);
    this.messageBuffer.delete(connectionId);

    console.log(`Cleaned up WebSocket connection: ${connectionId}`);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalEventListeners(): void {
    // Handle page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          // Page is hidden, reduce activity
          this.pauseHeartbeats();
        } else {
          // Page is visible, resume activity
          this.resumeHeartbeats();
        }
      });
    }

    // Handle network status changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network back online, attempting to reconnect all WebSocket connections');
        this.reconnectAllConnections();
      });

      window.addEventListener('offline', () => {
        console.log('Network offline, WebSocket connections will be queued');
      });
    }
  }

  private pauseHeartbeats(): void {
    for (const [connectionId] of this.heartbeatIntervals) {
      this.stopHeartbeat(connectionId);
    }
  }

  private resumeHeartbeats(): void {
    for (const [connectionId] of this.connections) {
      this.startHeartbeat(connectionId, this.defaultConfig.heartbeatInterval!);
    }
  }

  private reconnectAllConnections(): void {
    // This would require storing original configs, simplified for now
    console.log('Reconnecting all connections...');
    for (const [connectionId, connection] of this.connections) {
      if (connection.readyState !== WebSocket.OPEN) {
        // Trigger reconnection logic
        connection.close();
      }
    }
  }
}

// Export singleton instance
export const optimizedWebSocket = OptimizedComplianceWebSocket.getInstance();

// Convenience functions for compliance system
export class ComplianceWebSocketManager {
  private wsManager = optimizedWebSocket;
  private connectionId = 'compliance-main';

  async connect(token: string, topics: string[] = ['violations', 'alerts', 'metrics']) {
    const baseUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';
    const wsUrl = `${baseUrl}/ws/compliance/`;

    return this.wsManager.connect(this.connectionId, {
      url: wsUrl,
      token,
      topics,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      messageQueueSize: 100,
    });
  }

  subscribe(callback: (message: WebSocketMessage) => void) {
    return this.wsManager.subscribe(this.connectionId, callback);
  }

  sendMessage(message: any) {
    return this.wsManager.sendMessage(this.connectionId, message);
  }

  getStats() {
    return this.wsManager.getConnectionStats(this.connectionId);
  }

  disconnect() {
    this.wsManager.closeConnection(this.connectionId);
  }
}

export default OptimizedComplianceWebSocket;