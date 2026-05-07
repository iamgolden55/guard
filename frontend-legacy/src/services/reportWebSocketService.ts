// Enhanced WebSocket Service for Report Progress Tracking
// Optimized for real-time report generation updates with fallback to polling

import { ReportJobProgress, ReportJobStatus, ReportJob } from '../types/reports';

interface ReportWebSocketMessage {
  type: 'report_progress' | 'report_complete' | 'report_failed' | 'report_cancelled' | 'heartbeat';
  jobId: string;
  data: ReportJobProgress | ReportJob | { error: string };
  timestamp: string;
}

interface ConnectionOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  fallbackToPolling?: boolean;
  pollingInterval?: number;
}

interface ConnectionCallbacks {
  onProgress?: (jobId: string, progress: ReportJobProgress) => void;
  onComplete?: (jobId: string, job: ReportJob) => void;
  onError?: (jobId: string, error: string) => void;
  onCancel?: (jobId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

class ReportWebSocketService {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private token: string | null = null;
  private isConnected = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  // Subscriptions and callbacks
  private subscribedJobs = new Set<string>();
  private callbacks: ConnectionCallbacks = {};

  // Reconnection handling
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Fallback polling
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private reportService: any; // Will be injected

  // Options
  private options: Required<ConnectionOptions> = {
    autoReconnect: true,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    fallbackToPolling: true,
    pollingInterval: 5000
  };

  constructor(options?: Partial<ConnectionOptions>) {
    this.options = { ...this.options, ...options };

    // Generate WebSocket URL for Django backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    // Django backend runs on port 8000
    const port = process.env.NODE_ENV === 'production' ? window.location.port : '8000';
    const host = port ? `${hostname}:${port}` : hostname;
    this.wsUrl = `${protocol}//${host}/ws/reports/`;

    // Handle page visibility and network changes
    this.setupEventListeners();
  }

  // Initialize with authentication token and report service
  public initialize(token: string, reportService: any): void {
    this.token = token;
    this.reportService = reportService;
  }

  // Set callback handlers
  public setCallbacks(callbacks: ConnectionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Connect to WebSocket
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      if (!this.token) {
        reject(new Error('WebSocket service not initialized with auth token'));
        return;
      }

      try {
        this.connectionState = 'connecting';
        this.callbacks.onConnectionChange?.(false);

        const url = `${this.wsUrl}?token=${this.token}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('Report WebSocket connected');
          this.isConnected = true;
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;

          // Re-subscribe to all jobs
          this.subscribedJobs.forEach(jobId => {
            this.sendSubscribeMessage(jobId);
          });

          // Start heartbeat
          this.startHeartbeat();

          this.callbacks.onConnectionChange?.(true);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };

        this.ws.onerror = (error) => {
          console.error('Report WebSocket error:', error);
          this.connectionState = 'error';
          this.callbacks.onConnectionChange?.(false);
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        this.connectionState = 'error';
        this.callbacks.onConnectionChange?.(false);
        reject(error);
      }
    });
  }

  // Disconnect WebSocket
  public disconnect(): void {
    this.isConnected = false;
    this.connectionState = 'disconnected';

    // Clear all intervals and timeouts
    this.stopHeartbeat();
    this.clearReconnectTimeout();
    this.stopAllPolling();

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.callbacks.onConnectionChange?.(false);
  }

  // Subscribe to job progress updates
  public subscribeToJob(jobId: string): void {
    this.subscribedJobs.add(jobId);

    if (this.isConnected && this.ws) {
      this.sendSubscribeMessage(jobId);
    }

    // Start polling fallback if WebSocket not available
    if (!this.isConnected && this.options.fallbackToPolling) {
      this.startPollingForJob(jobId);
    }
  }

  // Unsubscribe from job updates
  public unsubscribeFromJob(jobId: string): void {
    this.subscribedJobs.delete(jobId);

    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        jobId: jobId
      }));
    }

    // Stop polling for this job
    this.stopPollingForJob(jobId);
  }

  // Get connection status
  public getConnectionState(): { connected: boolean; state: string } {
    return {
      connected: this.isConnected,
      state: this.connectionState
    };
  }

  // Get subscribed jobs
  public getSubscribedJobs(): Set<string> {
    return new Set(this.subscribedJobs);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: ReportWebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case 'report_progress':
          if (this.subscribedJobs.has(message.jobId)) {
            this.callbacks.onProgress?.(message.jobId, message.data as ReportJobProgress);

            // Stop polling for this job since we got real-time update
            this.stopPollingForJob(message.jobId);
          }
          break;

        case 'report_complete':
          if (this.subscribedJobs.has(message.jobId)) {
            this.callbacks.onComplete?.(message.jobId, message.data as ReportJob);
            this.unsubscribeFromJob(message.jobId); // Auto-unsubscribe on completion
          }
          break;

        case 'report_failed':
          if (this.subscribedJobs.has(message.jobId)) {
            const error = (message.data as any).error || 'Report generation failed';
            this.callbacks.onError?.(message.jobId, error);
            this.unsubscribeFromJob(message.jobId);
          }
          break;

        case 'report_cancelled':
          if (this.subscribedJobs.has(message.jobId)) {
            this.callbacks.onCancel?.(message.jobId);
            this.unsubscribeFromJob(message.jobId);
          }
          break;

        case 'heartbeat':
          // Acknowledge heartbeat
          this.ws?.send(JSON.stringify({ type: 'heartbeat_ack' }));
          break;

        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('Report WebSocket closed:', event.code, event.reason);
    this.isConnected = false;
    this.connectionState = 'disconnected';
    this.stopHeartbeat();
    this.callbacks.onConnectionChange?.(false);

    // Start fallback polling for subscribed jobs
    if (this.options.fallbackToPolling) {
      this.subscribedJobs.forEach(jobId => {
        this.startPollingForJob(jobId);
      });
    }

    // Attempt reconnection if enabled
    if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.attemptReconnect();
        } else {
          console.error('Max reconnection attempts reached');
          this.connectionState = 'error';
        }
      });
    }, delay);
  }

  private sendSubscribeMessage(jobId: string): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        jobId: jobId
      }));
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // Fallback polling methods
  private startPollingForJob(jobId: string): void {
    if (!this.reportService || this.pollingIntervals.has(jobId)) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const progress = await this.reportService.getJobProgress(jobId);

        // Check if job is still active
        const activeStatuses = [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING];

        if (activeStatuses.includes(progress.status)) {
          this.callbacks.onProgress?.(jobId, progress);
        } else {
          // Job completed, get full job details
          const job = await this.reportService.getReportJob(jobId);

          switch (progress.status) {
            case ReportJobStatus.COMPLETED:
              this.callbacks.onComplete?.(jobId, job);
              break;
            case ReportJobStatus.FAILED:
              this.callbacks.onError?.(jobId, progress.error || 'Report generation failed');
              break;
            case ReportJobStatus.CANCELLED:
              this.callbacks.onCancel?.(jobId);
              break;
          }

          // Stop polling for completed job
          this.stopPollingForJob(jobId);
          this.unsubscribeFromJob(jobId);
        }
      } catch (error) {
        console.error(`Polling failed for job ${jobId}:`, error);
        // Don't stop polling on errors, the job might still be active
      }
    }, this.options.pollingInterval);

    this.pollingIntervals.set(jobId, pollInterval);
  }

  private stopPollingForJob(jobId: string): void {
    const interval = this.pollingIntervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(jobId);
    }
  }

  private stopAllPolling(): void {
    this.pollingIntervals.forEach((interval, jobId) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
  }

  private setupEventListeners(): void {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page hidden, reduce activity
        this.stopHeartbeat();
      } else if (this.isConnected) {
        // Page visible, resume heartbeat
        this.startHeartbeat();
      }
    });

    // Handle network status changes
    window.addEventListener('online', () => {
      console.log('Network online, attempting WebSocket reconnection');
      if (!this.isConnected) {
        this.connect().catch(console.error);
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network offline, WebSocket will use fallback polling');
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }
}

// Create singleton instance
export const reportWebSocketService = new ReportWebSocketService({
  autoReconnect: true,
  reconnectDelay: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  fallbackToPolling: true,
  pollingInterval: 5000
});

export default reportWebSocketService;