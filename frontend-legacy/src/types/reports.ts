// Export & Reporting Types
export interface ReportJob {
  id: string;
  title: string;
  reportType: string;
  format: ExportFormat;
  status: ReportJobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  eta?: number;
  speed?: number;
  error?: string;
  userId: number;
  parameters: Record<string, any>;
  retryCount: number;
  maxRetries: number;
}

export enum ReportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying'
}

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
  PDF = 'pdf'
}

export interface ExportFormatCapability {
  format: ExportFormat;
  name: string;
  description: string;
  fileExtension: string;
  mimeType: string;
  maxRows?: number;
  supportsCharts: boolean;
  supportsImages: boolean;
  supportsMultipleSheets: boolean;
  pageOptions?: {
    orientation: 'portrait' | 'landscape';
    size: 'A4' | 'A3' | 'letter' | 'legal';
  };
  compressionOptions?: string[];
}

export interface ReportJobProgress {
  jobId: string;
  status: ReportJobStatus;
  progress: number;
  eta?: number;
  speed?: number;
  processedRows?: number;
  totalRows?: number;
  currentOperation?: string;
  error?: string;
}

export interface ReportGenerationRequest {
  reportType: string;
  format: ExportFormat;
  title: string;
  parameters: {
    dateRange?: {
      startDate: string;
      endDate: string;
    };
    filters?: Record<string, any>;
    columns?: string[];
    groupBy?: string[];
    orderBy?: string[];
  };
  formatOptions?: {
    includeCharts?: boolean;
    pageSize?: string;
    orientation?: string;
    template?: string;
  };
  schedule?: {
    recurring: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    time?: string;
  };
}

export interface ReportJobSummary {
  total: number;
  byStatus: Record<ReportJobStatus, number>;
  recentJobs: ReportJob[];
  failedJobs: ReportJob[];
  scheduledJobs: ReportJob[];
  totalDataProcessed: number;
  averageProcessingTime: number;
}

export interface BulkJobAction {
  jobIds: string[];
  action: 'cancel' | 'retry' | 'delete' | 'download';
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  reportType: string;
  defaultFormat: ExportFormat;
  defaultParameters: Record<string, any>;
  isPublic: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportJobFilter {
  status?: ReportJobStatus[];
  format?: ExportFormat[];
  reportType?: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ReportJobListResponse {
  jobs: ReportJob[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ReportMetrics {
  totalJobs: number;
  successRate: number;
  averageProcessingTime: number;
  totalDataProcessed: number;
  popularFormats: Array<{ format: ExportFormat; count: number }>;
  popularReportTypes: Array<{ type: string; count: number }>;
  processingTrends: Array<{
    date: string;
    jobsCompleted: number;
    averageTime: number;
  }>;
}