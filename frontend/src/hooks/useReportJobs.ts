import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import reportService from '../services/reportService';
import {
  ReportJob,
  ReportJobProgress,
  ReportJobFilter,
  ReportJobListResponse,
  ReportJobSummary,
  ReportJobStatus
} from '../types/reports';

export interface UseReportJobsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  filters?: ReportJobFilter;
  pollActiveJobs?: boolean;
}

export interface UseReportJobsReturn {
  jobs: ReportJob[];
  loading: boolean;
  error: string | null;
  totalJobs: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
  refreshJobs: () => Promise<void>;
  loadMore: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  updateFilters: (filters: ReportJobFilter) => void;
}

export const useReportJobs = (options: UseReportJobsOptions = {}): UseReportJobsReturn => {
  const {
    autoRefresh = false,
    refreshInterval = 10000, // 10 seconds
    filters: initialFilters,
    pollActiveJobs = true
  } = options;

  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    totalJobs: 0,
    totalPages: 0,
    currentPage: 1,
    hasNext: false,
    hasPrevious: false
  });
  const [filters, setFilters] = useState<ReportJobFilter>(initialFilters || {});

  // Create stable filter reference to prevent infinite re-renders
  const stableFilters = useMemo(() => filters, [JSON.stringify(filters)]);

  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  const fetchJobs = useCallback(async (loadMore = false) => {
    try {
      if (!loadMore) setLoading(true);
      setError(null);

      const currentFilters = loadMore
        ? { ...stableFilters, page: (stableFilters.page || 1) + 1 }
        : { ...stableFilters, page: 1 };

      const response: ReportJobListResponse = await reportService.getReportJobs(currentFilters);

      if (loadMore) {
        setJobs(prev => {
          const prevJobs = Array.isArray(prev) ? prev : [];
          const newJobs = Array.isArray(response.jobs) ? response.jobs : [];
          return [...prevJobs, ...newJobs];
        });
      } else {
        setJobs(Array.isArray(response.jobs) ? response.jobs : []);
      }

      setPagination({
        totalJobs: response.total,
        totalPages: response.totalPages,
        currentPage: response.page,
        hasNext: response.hasNext,
        hasPrevious: response.hasPrevious
      });
    } catch (err) {
      console.error('Failed to fetch report jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch report jobs');
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  const refreshJobs = useCallback(async () => {
    await fetchJobs(false);
  }, [fetchJobs]);

  const loadMore = useCallback(async () => {
    if (pagination.hasNext && !loading) {
      await fetchJobs(true);
    }
  }, [fetchJobs, pagination.hasNext, loading]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      await reportService.cancelJob(jobId);
      // Update job status locally for immediate feedback
      setJobs(prev => {
        const prevJobs = Array.isArray(prev) ? prev : [];
        return prevJobs.map(job =>
          job.id === jobId
            ? { ...job, status: ReportJobStatus.CANCELLED, cancelledAt: new Date().toISOString() }
            : job
        );
      });
    } catch (err) {
      console.error('Failed to cancel job:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  }, []);

  const retryJob = useCallback(async (jobId: string) => {
    try {
      const updatedJob = await reportService.retryJob(jobId);
      setJobs(prev => {
        const prevJobs = Array.isArray(prev) ? prev : [];
        return prevJobs.map(job =>
          job.id === jobId ? updatedJob : job
        );
      });
    } catch (err) {
      console.error('Failed to retry job:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    }
  }, []);

  const deleteJob = useCallback(async (jobId: string) => {
    try {
      await reportService.deleteJob(jobId);
      setJobs(prev => {
        const prevJobs = Array.isArray(prev) ? prev : [];
        return prevJobs.filter(job => job && job.id !== jobId);
      });
      setPagination(prev => ({ ...prev, totalJobs: prev.totalJobs - 1 }));
    } catch (err) {
      console.error('Failed to delete job:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  }, []);

  const updateFilters = useCallback((newFilters: ReportJobFilter) => {
    setFilters(newFilters);
  }, []);

  // Poll active jobs for progress updates
  const pollJobProgress = useCallback(async () => {
    setJobs(prevJobs => {
      // Ensure prevJobs is an array before filtering
      if (!Array.isArray(prevJobs)) {
        console.warn('pollJobProgress: prevJobs is not an array:', prevJobs);
        return [];
      }

      const activeJobs = prevJobs.filter(job =>
        job && [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING, ReportJobStatus.RETRYING].includes(job.status)
      );

      if (activeJobs.length === 0) return prevJobs;

      // Start async progress polling but don't wait for it
      (async () => {
        try {
          const progressPromises = activeJobs.map(job =>
            reportService.getJobProgress(job.id).catch(() => null)
          );

          const progressResults = await Promise.all(progressPromises);

          setJobs(currentJobs => {
            // Ensure currentJobs is an array before mapping
            if (!Array.isArray(currentJobs)) {
              console.warn('pollJobProgress inner: currentJobs is not an array:', currentJobs);
              return [];
            }

            return currentJobs.map(job => {
              const progressIndex = activeJobs.findIndex(activeJob => activeJob.id === job.id);
              const progress = progressResults[progressIndex];

              if (progress) {
                return {
                  ...job,
                  status: progress.status,
                  progress: progress.progress,
                  eta: progress.eta,
                  speed: progress.speed,
                  error: progress.error
                };
              }

              return job;
            });
          });
        } catch (err) {
          console.error('Failed to poll job progress:', err);
        }
      })();

      return prevJobs; // Return current jobs unchanged for this sync call
    });
  }, []); // Remove jobs dependency to prevent infinite loop

  // Initial load and filter changes
  useEffect(() => {
    fetchJobs(false);
  }, [fetchJobs]); // Now fetchJobs has stable dependencies via stableFilters

  // Auto refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(refreshJobs, refreshInterval);
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshJobs]);

  // Poll active jobs
  useEffect(() => {
    if (pollActiveJobs) {
      pollIntervalRef.current = setInterval(pollJobProgress, 2000); // Poll every 2 seconds
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [pollActiveJobs, pollJobProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return {
    jobs,
    loading,
    error,
    totalJobs: pagination.totalJobs,
    totalPages: pagination.totalPages,
    currentPage: pagination.currentPage,
    hasNext: pagination.hasNext,
    hasPrevious: pagination.hasPrevious,
    refreshJobs,
    loadMore,
    cancelJob,
    retryJob,
    deleteJob,
    updateFilters
  };
};

export default useReportJobs;