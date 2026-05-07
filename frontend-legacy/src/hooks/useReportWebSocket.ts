import { useState, useEffect, useRef, useCallback } from 'react';
import { ReportJobProgress, ReportJobStatus } from '../types/reports';

export interface WebSocketMessage {
  type: 'report_progress' | 'report_complete' | 'report_failed' | 'report_cancelled' | 'job_progress' | 'job_complete' | 'job_failed' | 'job_cancelled' | 'heartbeat';
  jobId: string;
  data: ReportJobProgress | any;
  timestamp?: string;
}

export interface UseReportWebSocketOptions {
  onProgress?: (jobId: string, progress: ReportJobProgress) => void;
  onComplete?: (jobId: string, progress: ReportJobProgress) => void;
  onError?: (jobId: string, error: string) => void;
  onCancel?: (jobId: string, progress: ReportJobProgress) => void;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  token?: string;
}

export interface UseReportWebSocketReturn {
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  subscribeToJob: (jobId: string) => void;
  unsubscribeFromJob: (jobId: string) => void;
  subscribedJobs: Set<string>;
  connect: () => void;
  disconnect: () => void;
  lastMessage: WebSocketMessage | null;
  error: string | null;
}

export const useReportWebSocket = (
  wsUrl?: string,
  options: UseReportWebSocketOptions = {}
): UseReportWebSocketReturn => {
  const {
    onProgress,
    onComplete,
    onError,
    onCancel,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
    token
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [subscribedJobs, setSubscribedJobs] = useState<Set<string>>(new Set());
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const isManuallyClosedRef = useRef(false);

  // Generate WebSocket URL if not provided
  const defaultWsUrl = wsUrl || (() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    // Django backend runs on port 8000
    const port = process.env.NODE_ENV === 'production' ? window.location.port : '8000';
    const host = port ? `${hostname}:${port}` : hostname;
    return `${protocol}//${host}/ws/reports/`;
  })();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      setConnectionState('connecting');
      setError(null);
      isManuallyClosedRef.current = false;

      // WebSocket auth is handled via cookies (browser sends cookies for same-origin WS connections)
      const wsUrlWithAuth = defaultWsUrl;

      wsRef.current = new WebSocket(wsUrlWithAuth);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionState('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Re-subscribe to all jobs
        subscribedJobs.forEach(jobId => {
          wsRef.current?.send(JSON.stringify({
            type: 'subscribe',
            jobId
          }));
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          switch (message.type) {
            case 'report_progress':
            case 'job_progress':
              onProgress?.(message.jobId, message.data);
              break;

            case 'report_complete':
            case 'job_complete':
              onComplete?.(message.jobId, message.data);
              // Auto-unsubscribe from completed jobs
              setSubscribedJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(message.jobId);
                return newSet;
              });
              break;

            case 'report_failed':
            case 'job_failed':
              onError?.(message.jobId, message.data.error || 'Job failed');
              // Auto-unsubscribe from failed jobs
              setSubscribedJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(message.jobId);
                return newSet;
              });
              break;

            case 'report_cancelled':
            case 'job_cancelled':
              onCancel?.(message.jobId, message.data);
              // Auto-unsubscribe from cancelled jobs
              setSubscribedJobs(prev => {
                const newSet = new Set(prev);
                newSet.delete(message.jobId);
                return newSet;
              });
              break;

            default:
              console.warn('Unknown WebSocket message type:', message.type);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionState('disconnected');

        // Attempt to reconnect if not manually closed
        if (!isManuallyClosedRef.current && autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Maximum reconnection attempts exceeded');
          setConnectionState('error');
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setConnectionState('error');
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnectionState('error');
    }
  }, [defaultWsUrl, autoReconnect, reconnectDelay, maxReconnectAttempts, onProgress, onComplete, onError, onCancel, subscribedJobs, token]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionState('disconnected');
    setSubscribedJobs(new Set());
    reconnectAttemptsRef.current = 0;
  }, []);

  const subscribeToJob = useCallback((jobId: string) => {
    setSubscribedJobs(prev => new Set([...prev, jobId]));

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        jobId
      }));
    }
  }, []);

  const unsubscribeFromJob = useCallback((jobId: string) => {
    setSubscribedJobs(prev => {
      const newSet = new Set(prev);
      newSet.delete(jobId);
      return newSet;
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        jobId
      }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (defaultWsUrl) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [defaultWsUrl, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    connectionState,
    subscribeToJob,
    unsubscribeFromJob,
    subscribedJobs,
    connect,
    disconnect,
    lastMessage,
    error
  };
};