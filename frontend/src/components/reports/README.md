# Export & Reporting React Components

A comprehensive React frontend for the async export and reporting system. This system provides enterprise-scale report generation with real-time progress tracking, multiple export formats, and background processing capabilities.

## 🚀 Features

- **Async Report Generation**: Background processing with Celery integration
- **Real-time Progress Tracking**: Live updates via polling or WebSocket
- **Multiple Export Formats**: CSV, Excel, PDF, JSON with format-specific options
- **Job Management**: Cancel, retry, delete, and bulk operations
- **Performance Monitoring**: Metrics, success rates, and processing analytics
- **Mobile Responsive**: Optimized for all screen sizes
- **Enterprise Ready**: Supports 500+ concurrent users

## 📦 Components

### ReportDashboard
Main dashboard component providing overview of all reports and jobs.

```tsx
import { ReportDashboard } from '../components/reports';

<ReportDashboard
  onCreateReport={() => setShowForm(true)}
  showCreateButton={true}
/>
```

**Features:**
- Overview of all user's reports
- Real-time status updates
- Quick actions (download, cancel, regenerate)
- Performance metrics and usage stats
- Search and filtering

### AsyncProgressTracker
Real-time progress tracking component for active report jobs.

```tsx
import { AsyncProgressTracker } from '../components/reports';

<AsyncProgressTracker
  jobId="job-123"
  title="Staff Report"
  compact={false}
  showCancel={true}
  onComplete={(jobId) => console.log('Completed:', jobId)}
/>
```

**Features:**
- Live progress bars with percentage completion
- ETA estimation and speed indicators
- Cancel and retry functionality
- Error handling with detailed messages
- Compact mode for inline display

### ExportFormatSelector
Format selection component with capability preview and options.

```tsx
import { ExportFormatSelector } from '../components/reports';

<ExportFormatSelector
  selectedFormat={ExportFormat.CSV}
  onFormatChange={setFormat}
  formatOptions={options}
  onFormatOptionsChange={setOptions}
  showAdvancedOptions={true}
/>
```

**Features:**
- Visual format selection with icons
- Format capabilities and limitations display
- Format-specific options (page size, orientation, etc.)
- Template compatibility indicators

### ReportJobMonitor
Background job monitoring and management component.

```tsx
import { ReportJobMonitor } from '../components/reports';

<ReportJobMonitor
  showTitle={true}
  showBulkActions={true}
  showMetrics={true}
  maxHeight="600px"
/>
```

**Features:**
- Job history with filtering and search
- Bulk job management (cancel multiple, retry failed)
- Performance metrics per job
- Real-time status updates

### ReportGenerationForm
Comprehensive form for creating new reports with all options.

```tsx
import { ReportGenerationForm } from '../components/reports';

<ReportGenerationForm
  onReportGenerated={(jobId) => console.log('Generated:', jobId)}
  onCancel={() => setShowForm(false)}
  initialValues={defaultValues}
/>
```

**Features:**
- Complete form with validation
- Date range selection
- Advanced filtering options
- Export format configuration
- Scheduling options

## 🎣 Hooks

### useReportJobs
React hook for managing report jobs with real-time updates.

```tsx
import { useReportJobs } from '../hooks/useReportJobs';

const {
  jobs,
  loading,
  error,
  refreshJobs,
  cancelJob,
  retryJob,
  deleteJob
} = useReportJobs({
  autoRefresh: true,
  refreshInterval: 10000,
  pollActiveJobs: true
});
```

**Options:**
- `autoRefresh`: Enable automatic refresh
- `refreshInterval`: Refresh interval in milliseconds
- `filters`: Initial filters to apply
- `pollActiveJobs`: Poll active jobs for progress

### useJobProgress
Hook for tracking individual job progress with real-time updates.

```tsx
import { useJobProgress } from '../hooks/useJobProgress';

const {
  progress,
  isPolling,
  error,
  cancelJob,
  retryJob
} = useJobProgress('job-123', {
  onComplete: (progress) => console.log('Complete!'),
  onError: (error) => console.error(error)
});
```

**Features:**
- Smart polling with automatic stop on completion
- Progress data with ETA and speed
- Cancel and retry functionality
- Comprehensive error handling

### useReportWebSocket
WebSocket hook for real-time updates (alternative to polling).

```tsx
import { useReportWebSocket } from '../hooks/useReportWebSocket';

const {
  isConnected,
  subscribeToJob,
  unsubscribeFromJob
} = useReportWebSocket('ws://localhost:8000/ws/reports/', {
  onProgress: (jobId, progress) => updateJob(jobId, progress),
  autoReconnect: true
});
```

**Features:**
- Real-time WebSocket updates
- Automatic reconnection with backoff
- Job subscription management
- Connection state monitoring

## 🔧 Setup & Integration

### 1. Install Dependencies

```bash
npm install @fluentui/react-components @fluentui/react-icons formik yup
```

### 2. Add to Your Router

```tsx
import { ReportsPage } from '../pages/reports/ReportsPage';

// In your router configuration
<Route path="/reports" element={<ReportsPage />} />
```

### 3. Update API Configuration

Ensure your API service is configured to handle the report endpoints:

```typescript
// In your api service
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
```

### 4. Import Components

```tsx
import {
  ReportDashboard,
  AsyncProgressTracker,
  ExportFormatSelector,
  ReportJobMonitor,
  ReportGenerationForm
} from '../components/reports';
```

## 🎨 Styling & Theming

Components use Fluent UI design system with responsive design:

- **Cards**: Clean, elevated design with consistent spacing
- **Progress Bars**: Smooth animations with color-coded status
- **Tables**: Sortable, filterable with bulk actions
- **Forms**: Validated inputs with clear error states
- **Mobile**: Fully responsive with touch-friendly controls

## 📊 API Integration

The system integrates with these backend endpoints:

- `GET /api/v1/reports/jobs/` - List user's report jobs
- `POST /api/v1/reports/jobs/generate_report/` - Generate new report
- `GET /api/v1/reports/jobs/{id}/progress/` - Get job progress
- `DELETE /api/v1/reports/jobs/{id}/cancel/` - Cancel job
- `POST /api/v1/reports/jobs/{id}/retry/` - Retry failed job
- `GET /api/v1/exports/formats/` - Get format capabilities

## 🔄 Real-time Updates

Choose between polling and WebSocket for real-time updates:

### Polling (Default)
- Simple HTTP-based updates
- Works with any backend
- Configurable intervals
- Automatic smart polling

### WebSocket (Optional)
- True real-time updates
- Lower server load
- Instant notifications
- Auto-reconnection

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Components    │    │     Hooks       │    │    Services     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ ReportDashboard │    │ useReportJobs   │    │ reportService   │
│ ProgressTracker │ -> │ useJobProgress  │ -> │ API calls       │
│ FormatSelector  │    │ useWebSocket    │    │ File downloads  │
│ JobMonitor      │    │                 │    │ Error handling  │
│ GenerationForm  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🧪 Testing

Components include comprehensive error boundaries and loading states:

```tsx
// Error Boundary
if (error) {
  return <MessageBar type={MessageBarType.Error}>{error}</MessageBar>;
}

// Loading States
if (loading) {
  return <Spinner size="large" label="Loading reports..." />;
}

// Empty States
if (jobs.length === 0) {
  return <EmptyState message="No reports found" />;
}
```

## 🚀 Performance

- **Virtualization**: Large job lists are virtualized
- **Memoization**: Components use React.memo for optimization
- **Debounced Search**: Search inputs are debounced
- **Smart Polling**: Automatic stop when no active jobs
- **Code Splitting**: Components are lazy-loaded

## 🔒 Security

- **Authentication**: All API calls use JWT tokens
- **Permissions**: Role-based access control
- **Input Validation**: Comprehensive form validation
- **XSS Protection**: Safe content rendering
- **CSRF Protection**: API includes CSRF tokens

## 📱 Mobile Support

All components are fully responsive:

- **Touch-friendly**: Large touch targets
- **Swipe Actions**: Swipe-to-action on mobile
- **Compact Mode**: Space-efficient layouts
- **Responsive Tables**: Horizontal scroll with sticky headers
- **Modal Forms**: Full-screen forms on mobile

## 🎯 Best Practices

1. **Error Handling**: Always handle API errors gracefully
2. **Loading States**: Show loading indicators for async operations
3. **Validation**: Validate all form inputs before submission
4. **Accessibility**: Use semantic HTML and ARIA labels
5. **Performance**: Minimize re-renders with proper dependencies
6. **User Feedback**: Provide clear feedback for all actions

## 📚 Examples

### Basic Report Dashboard

```tsx
import React from 'react';
import { ReportDashboard } from '../components/reports';

const MyReportsPage = () => {
  return (
    <div style={{ padding: '20px' }}>
      <ReportDashboard />
    </div>
  );
};
```

### Custom Progress Tracking

```tsx
import React from 'react';
import { AsyncProgressTracker } from '../components/reports';

const MyProgressPage = () => {
  const handleComplete = (jobId: string) => {
    console.log('Report completed:', jobId);
    // Redirect to download page
  };

  return (
    <AsyncProgressTracker
      jobId="my-job-id"
      title="Monthly Staff Report"
      showCancel={true}
      onComplete={handleComplete}
    />
  );
};
```

### Advanced Job Monitoring

```tsx
import React, { useState } from 'react';
import { ReportJobMonitor } from '../components/reports';

const AdminMonitorPage = () => {
  return (
    <ReportJobMonitor
      showTitle={true}
      showBulkActions={true}
      showMetrics={true}
      maxHeight="80vh"
    />
  );
};
```

This comprehensive system provides a complete solution for async report generation with excellent user experience and enterprise-scale performance.