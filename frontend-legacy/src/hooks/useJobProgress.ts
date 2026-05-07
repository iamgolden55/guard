import { useState, useEffect, useRef, useCallback } from 'react';
import reportService from '../services/reportService';
import { ReportJobProgress, ReportJobStatus, ReportJob } from '../types/reports';

export interface UseJobProgressOptions {
  onComplete?: (job: ReportJob) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  pollInterval?: number;
  autoStart?: boolean;
  enableWebSocket?: boolean;
}

export interface UseJobProgressReturn {
  progress: ReportJobProgress | null;
  isPolling: boolean;
  isWebSocketConnected: boolean;
  error: string | null;
  startPolling: (jobId: string) => void;
  stopPolling: () => void;
  cancelJob: () => Promise<void>;
  retryJob: () => Promise<void>;
}

export const useJobProgress = (
  initialJobId?: string,
  options: UseJobProgressOptions = {}
): UseJobProgressReturn => {
  const {
    onComplete,
    onError,
    onCancel,
    pollInterval = 2000,
    autoStart = true,
    enableWebSocket = true
  } = options;

  const [progress, setProgress] = useState<ReportJobProgress | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState(initialJobId);

  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const isPollingRef = useRef(false);
  const webSocketUnsubscribeRef = useRef<(() => void) | null>(null);

  const fetchProgress = useCallback(async (jobId: string) => {
    if (!jobId) return;

    try {
      const progressData = await reportService.getJobProgress(jobId);
      setProgress(progressData);
      setError(null);

      // Check if job is complete
      if (progressData.status === ReportJobStatus.COMPLETED) {
        setIsPolling(false);
        isPollingRef.current = false;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        // Try to get the full job details
        try {
          const fullJob = await reportService.getReportJob(jobId);
          onComplete?.(fullJob);
        } catch (error) {
          // Fallback to progress data as job
          onComplete?.({ id: jobId, status: progressData.status, progress: progressData } as ReportJob);
        }
      } else if (progressData.status === ReportJobStatus.FAILED) {
        setIsPolling(false);
        isPollingRef.current = false;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        const errorMessage = progressData.error || 'Job failed';
        setError(errorMessage);
        onError?.(errorMessage);
      } else if (progressData.status === ReportJobStatus.CANCELLED) {
        setIsPolling(false);
        isPollingRef.current = false;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        onCancel?.();
      }
    } catch (err) {
      console.error('Failed to fetch job progress:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch job progress';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [onComplete, onError, onCancel]);

  const startPolling = useCallback((jobId: string) => {
    if (isPollingRef.current && currentJobId === jobId) {
      return; // Already polling this job
    }

    // Stop any existing polling and WebSocket subscription
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    if (webSocketUnsubscribeRef.current) {
      webSocketUnsubscribeRef.current();
      webSocketUnsubscribeRef.current = null;
    }

    setCurrentJobId(jobId);
    setIsPolling(true);
    isPollingRef.current = true;
    setError(null);

    // Try WebSocket first if enabled
    if (enableWebSocket) {
      try {
        // Initialize WebSocket if not already done
        reportService.initializeWebSocket()
          .then(() => {
            setIsWebSocketConnected(true);

            // Subscribe to WebSocket updates
            const unsubscribe = reportService.subscribeToJobProgress(jobId, {
              onProgress: (progressData) => {
                setProgress(progressData);
                setError(null);
                // Stop polling if WebSocket is working
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current);
                  setIsPolling(false);
                }
              },
              onComplete: (job) => {
                setIsPolling(false);
                isPollingRef.current = false;
                onComplete?.(job);
              },
              onError: (errorMessage) => {
                setIsPolling(false);
                isPollingRef.current = false;
                setError(errorMessage);
                onError?.(errorMessage);
              },
              onCancel: () => {
                setIsPolling(false);
                isPollingRef.current = false;
                onCancel?.();
              }
            });

            webSocketUnsubscribeRef.current = unsubscribe;
          })
          .catch((wsError) => {
            console.error('WebSocket initialization failed, falling back to polling:', wsError);
            setIsWebSocketConnected(false);
            // Fall back to polling
            startPollingFallback(jobId);
          });
      } catch (wsError) {
        console.error('WebSocket error, falling back to polling:', wsError);
        setIsWebSocketConnected(false);
        startPollingFallback(jobId);
      }
    } else {
      // WebSocket disabled, use polling only
      startPollingFallback(jobId);
    }

    function startPollingFallback(jobId: string) {
      // Immediate fetch
      fetchProgress(jobId);

      // Start polling
      pollIntervalRef.current = setInterval(() => {
        if (isPollingRef.current) {
          fetchProgress(jobId);
        }
      }, pollInterval);
    }
  }, [currentJobId, fetchProgress, pollInterval, enableWebSocket, onComplete, onError, onCancel]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = undefined;
    }
    if (webSocketUnsubscribeRef.current) {
      webSocketUnsubscribeRef.current();
      webSocketUnsubscribeRef.current = null;
    }
    setIsPolling(false);
    setIsWebSocketConnected(false);
    isPollingRef.current = false;
  }, []);

  const cancelJob = useCallback(async () => {
    if (!currentJobId) {
      throw new Error('No job ID available for cancellation');
    }

    try {
      await reportService.cancelJob(currentJobId);
      // Update local progress state
      setProgress(prev => prev ? {
        ...prev,
        status: ReportJobStatus.CANCELLED
      } : null);
      stopPolling();
    } catch (err) {
      console.error('Failed to cancel job:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel job';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [currentJobId, stopPolling]);

  const retryJob = useCallback(async () => {
    if (!currentJobId) {
      throw new Error('No job ID available for retry');
    }

    try {
      const retriedJob = await reportService.retryJob(currentJobId);
      // Start polling the retried job
      startPolling(retriedJob.id);
    } catch (err) {
      console.error('Failed to retry job:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry job';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [currentJobId, startPolling]);

  // Auto-start polling if initialJobId is provided
  useEffect(() => {
    if (initialJobId && autoStart) {
      startPolling(initialJobId);
    }
  }, [initialJobId, autoStart, startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (webSocketUnsubscribeRef.current) {
        webSocketUnsubscribeRef.current();
      }
      isPollingRef.current = false;
    };
  }, []);

  return {
    progress,
    isPolling,
    isWebSocketConnected,
    error,
    startPolling,
    stopPolling,
    cancelJob,
    retryJob
  };
};

export default useJobProgress;