import api from './api';
import { reportWebSocketClient } from './reportWebSocketClient';
import {
  ReportJob,
  ReportJobProgress,
  ReportGenerationRequest,
  ReportJobSummary,
  BulkJobAction,
  ReportTemplate,
  ReportJobFilter,
  ReportJobListResponse,
  ExportFormatCapability,
  ReportMetrics
} from '../types/reports';

class ReportService {
  private isWebSocketInitialized = false;

  // Initialize WebSocket connection for real-time updates
  async initializeWebSocket(): Promise<void> {
    if (this.isWebSocketInitialized) {
      return;
    }

    // Sprint 3: WebSocket authentication needs to be updated for cookie-based auth
    // For now, WebSocket will use polling fallback
    try {
      await reportWebSocketClient.connect();
      this.isWebSocketInitialized = true;
      console.log('Report WebSocket initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebSocket, will use polling fallback:', error);
    }
  }

  // Subscribe to job progress updates via WebSocket
  subscribeToJobProgress(jobId: string, callbacks: {
    onProgress?: (progress: ReportJobProgress) => void;
    onComplete?: (job: ReportJob) => void;
    onError?: (error: string) => void;
    onCancel?: () => void;
  }): () => void {
    // Set up WebSocket callbacks
    reportWebSocketClient.setCallbacks({
      onProgress: callbacks.onProgress ? (id: string, progress: ReportJobProgress) => {
        if (id === jobId) callbacks.onProgress!(progress);
      } : undefined,
      onComplete: callbacks.onComplete ? (id: string, job: ReportJob) => {
        if (id === jobId) callbacks.onComplete!(job);
      } : undefined,
      onError: callbacks.onError ? (id: string, error: string) => {
        if (id === jobId) callbacks.onError!(error);
      } : undefined,
      onCancel: callbacks.onCancel ? (id: string) => {
        if (id === jobId) callbacks.onCancel!();
      } : undefined,
    });

    // Subscribe to the job
    reportWebSocketClient.subscribeToJob(jobId);

    // Return unsubscribe function
    return () => {
      reportWebSocketClient.unsubscribeFromJob(jobId);
    };
  }

  // Get all report jobs for current user
  async getReportJobs(filters?: ReportJobFilter): Promise<ReportJobListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status?.length) params.append('status', filters.status.join(','));
      if (filters.format?.length) params.append('export_format', filters.format.join(','));
      if (filters.reportType?.length) params.append('report_type', filters.reportType.join(','));
      if (filters.dateRange) {
        params.append('start_date', filters.dateRange.startDate);
        params.append('end_date', filters.dateRange.endDate);
      }
      if (filters.search) params.append('search', filters.search);
      if (filters.sortBy) params.append('sort_by', filters.sortBy);
      if (filters.sortOrder) params.append('sort_order', filters.sortOrder);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
    }

    const response = await api.get<ReportJobListResponse>(`/api/v1/reports/jobs/?${params.toString()}`);
    return response.data;
  }

  // Get specific report job
  async getReportJob(jobId: string): Promise<ReportJob> {
    const response = await api.get<ReportJob>(`/api/v1/reports/jobs/${jobId}/`);
    return response.data;
  }

  // Get job progress in real-time
  async getJobProgress(jobId: string): Promise<ReportJobProgress> {
    const response = await api.get<ReportJobProgress>(`/api/v1/reports/jobs/${jobId}/progress/`);
    return response.data;
  }

  // Generate a new report (async) with automatic WebSocket subscription
  async generateReport(request: ReportGenerationRequest): Promise<ReportJob> {
    const response = await api.post<ReportJob>('/api/v1/reports/jobs/generate_report/', request);
    const job = response.data;

    // Initialize WebSocket if not already done
    await this.initializeWebSocket();

    // Auto-subscribe to this job for real-time updates
    if (this.isWebSocketInitialized) {
      reportWebSocketClient.subscribeToJob(job.id);
    }

    return job;
  }

  // Cancel a running job
  async cancelJob(jobId: string): Promise<void> {
    await api.delete(`/api/v1/reports/jobs/${jobId}/cancel/`);
  }

  // Retry a failed job
  async retryJob(jobId: string): Promise<ReportJob> {
    const response = await api.post<ReportJob>(`/api/v1/reports/jobs/${jobId}/retry/`);
    return response.data;
  }

  // Delete a completed job
  async deleteJob(jobId: string): Promise<void> {
    await api.delete(`/api/v1/reports/jobs/${jobId}/`);
  }

  // Bulk job operations
  async bulkJobAction(action: BulkJobAction): Promise<{ success: string[]; failed: string[] }> {
    const response = await api.post<{ success: string[]; failed: string[] }>('/api/v1/reports/jobs/bulk_action/', action);
    return response.data;
  }

  // Get job summary/dashboard data
  async getJobSummary(): Promise<ReportJobSummary> {
    const response = await api.get<ReportJobSummary>('/api/v1/reports/jobs/summary/');
    return response.data;
  }

  // Get export format capabilities
  async getExportFormats(): Promise<ExportFormatCapability[]> {
    const response = await api.get<ExportFormatCapability[]>('/api/v1/exports/formats/');
    return response.data;
  }

  // Get report templates
  async getReportTemplates(): Promise<ReportTemplate[]> {
    const response = await api.get<ReportTemplate[]>('/api/v1/reports/templates/');
    return response.data;
  }

  // Create report template
  async createReportTemplate(template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<ReportTemplate> {
    const response = await api.post<ReportTemplate>('/api/v1/reports/templates/', template);
    return response.data;
  }

  // Download completed report
  async downloadReport(jobId: string): Promise<Blob> {
    const response = await api.get(`/api/v1/reports/jobs/${jobId}/download/`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Get report metrics for analytics
  async getReportMetrics(period?: '7d' | '30d' | '90d'): Promise<ReportMetrics> {
    const params = period ? `?period=${period}` : '';
    const response = await api.get<ReportMetrics>(`/api/v1/reports/metrics/${params}`);
    return response.data;
  }

  // Get available report types
  async getReportTypes(): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      console.log('ReportService: Making API call to /api/v1/reports/types/');
      const response = await api.get<Array<{ id: string; name: string; description: string }>>('/api/v1/reports/types/');

      console.log('ReportService: Raw API response:', {
        status: response.status,
        headers: response.headers,
        data: response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data)
      });

      // The API service returns response.data, but we need to handle various response formats
      if (!response.data) {
        console.error('ReportService: API returned null/undefined data');
        throw new Error('No data received from report types API');
      }

      return response.data;
    } catch (error: any) {
      console.error('ReportService: Error fetching report types:', error);

      // Log detailed error information
      if (error.response) {
        console.error('ReportService: API error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('ReportService: No response received:', error.request);
      } else {
        console.error('ReportService: Request setup error:', error.message);
      }

      // Re-throw with more context
      throw new Error(`Failed to fetch report types: ${error.message || 'Unknown error'}`);
    }
  }

  // Poll job progress (utility method)
  async pollJobProgress(jobId: string, onProgress: (progress: ReportJobProgress) => void, intervalMs = 2000): Promise<void> {
    const pollInterval = setInterval(async () => {
      try {
        const progress = await this.getJobProgress(jobId);
        onProgress(progress);

        // Stop polling if job is complete, failed, or cancelled
        if (['completed', 'failed', 'cancelled'].includes(progress.status)) {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling job progress:', error);
        clearInterval(pollInterval);
      }
    }, intervalMs);
  }

  // Get file size in human readable format
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Calculate processing speed
  formatProcessingSpeed(rowsPerSecond: number): string {
    if (rowsPerSecond < 1000) {
      return `${rowsPerSecond.toFixed(0)} rows/sec`;
    } else if (rowsPerSecond < 1000000) {
      return `${(rowsPerSecond / 1000).toFixed(1)}K rows/sec`;
    } else {
      return `${(rowsPerSecond / 1000000).toFixed(1)}M rows/sec`;
    }
  }

  // Format ETA
  formatETA(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
}

export default new ReportService();