# Frontend Component Specifications
## Legal Compliance Reporting System - SSMS-COMPLIANCE-2025
## Handoff Document for React Component Architect

### Overview

This document provides comprehensive specifications for implementing React components for the Legal Compliance Reporting System. All backend APIs are complete and tested, requiring only frontend component implementation to complete the compliance system.

**Handoff Status**: Ready for Implementation
**Backend APIs**: ✅ Complete and Tested
**Documentation**: ✅ Complete
**Required Implementation**: React Components with TypeScript, Fluent UI, and React Query

### Project Context

The Legal Compliance Reporting System is a comprehensive workforce compliance tracking solution that monitors working hours, break times, overtime violations, and generates detailed compliance reports. The system supports real-time violation detection, automated reporting, and multi-role access control.

### Technology Stack

#### Frontend Requirements
- **Framework**: React 18+ with TypeScript
- **UI Library**: Microsoft Fluent UI v9
- **State Management**: React Query (TanStack Query) + React Context
- **Styling**: Tailwind CSS with Fluent UI components
- **Forms**: Formik + Yup validation
- **Charts**: Chart.js with react-chartjs-2
- **Date/Time**: date-fns for date manipulation
- **Real-time**: WebSocket client for live updates

#### Integration Points
- **Authentication**: JWT Bearer tokens (already implemented)
- **API Client**: Axios-based service layer (existing pattern)
- **PWA Features**: Service Worker, offline storage, push notifications
- **Mobile**: Responsive design, touch-optimized interfaces

### Component Architecture

```
src/
├── components/
│   └── compliance/
│       ├── settings/
│       │   ├── ComplianceSettings.tsx
│       │   ├── RegulationsList.tsx
│       │   ├── ProfileManager.tsx
│       │   └── SettingsForm.tsx
│       ├── monitoring/
│       │   ├── RealTimeMonitor.tsx
│       │   ├── ViolationAlerts.tsx
│       │   ├── ComplianceGauge.tsx
│       │   └── LiveStatusBoard.tsx
│       ├── reporting/
│       │   ├── ReportBuilder.tsx
│       │   ├── ReportStatus.tsx
│       │   ├── ExportManager.tsx
│       │   └── ReportTemplates.tsx
│       ├── violations/
│       │   ├── ViolationsList.tsx
│       │   ├── ViolationDetail.tsx
│       │   ├── ViolationForm.tsx
│       │   └── ResolutionTracker.tsx
│       ├── dashboard/
│       │   ├── ComplianceDashboard.tsx
│       │   ├── MetricsGrid.tsx
│       │   ├── TrendCharts.tsx
│       │   └── AlertsPanel.tsx
│       └── shared/
│           ├── DateRangePicker.tsx
│           ├── VenueSelector.tsx
│           ├── StaffSelector.tsx
│           └── ComplianceStatusBadge.tsx
├── services/
│   └── compliance/
│       ├── complianceService.ts
│       ├── reportingService.ts
│       ├── violationsService.ts
│       └── websocketService.ts
├── hooks/
│   └── compliance/
│       ├── useComplianceData.ts
│       ├── useRealTimeUpdates.ts
│       ├── useReportGeneration.ts
│       └── useViolationManagement.ts
├── types/
│   └── compliance/
│       ├── compliance.ts
│       ├── reporting.ts
│       └── violations.ts
└── pages/
    └── compliance/
        ├── ComplianceOverview.tsx
        ├── ComplianceSettings.tsx
        ├── ReportsManager.tsx
        └── ViolationsManager.tsx
```

### Core Component Specifications

#### 1. Compliance Dashboard Component

**File**: `src/components/compliance/dashboard/ComplianceDashboard.tsx`

```typescript
interface ComplianceDashboardProps {
  userId?: number;
  venueId?: number;
  timeRange?: DateRange;
  autoRefresh?: boolean;
}

interface ComplianceMetrics {
  overall_compliance_rate: number;
  total_violations: number;
  critical_violations: number;
  resolved_violations: number;
  average_resolution_time_hours: number;
  compliance_trend: Array<{
    date: string;
    compliance_rate: number;
    violation_count: number;
  }>;
  violation_breakdown: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
}
```

**Key Features:**
- Real-time compliance metrics display
- Interactive charts showing trends and breakdowns
- Role-based data filtering (Staff/Manager/Admin views)
- Automatic refresh every 30 seconds
- Export dashboard data functionality
- Responsive grid layout with Fluent UI components

**API Integration:**
```typescript
// Hook usage example
const { data: metrics, isLoading, error } = useComplianceMetrics({
  venueId,
  timeRange,
  refreshInterval: 30000
});
```

**Required Subcomponents:**
- `MetricsGrid`: KPI cards with trend indicators
- `TrendCharts`: Line charts for compliance trends
- `AlertsPanel`: Real-time violation alerts
- `ViolationBreakdown`: Pie chart of violation types

#### 2. Real-Time Monitoring Component

**File**: `src/components/compliance/monitoring/RealTimeMonitor.tsx`

```typescript
interface RealTimeMonitorProps {
  venues?: number[];
  alertThreshold?: number;
  onViolationDetected?: (violation: ComplianceViolation) => void;
}

interface LiveComplianceStatus {
  venue_id: number;
  venue_name: string;
  active_shifts: number;
  current_violations: number;
  compliance_status: 'compliant' | 'warning' | 'violation';
  last_check: string;
  next_check: string;
}
```

**Key Features:**
- WebSocket connection for live updates
- Visual status indicators for each venue
- Violation alerts with severity levels
- Automatic violation detection notifications
- Drill-down capability to view detailed violations
- Sound alerts for critical violations (configurable)

**WebSocket Integration:**
```typescript
// WebSocket hook usage
const { connectionStatus, violations, isConnected } = useWebSocketCompliance({
  onViolationReceived: handleNewViolation,
  onStatusUpdate: handleStatusChange
});
```

#### 3. Report Builder Component

**File**: `src/components/compliance/reporting/ReportBuilder.tsx`

```typescript
interface ReportBuilderProps {
  onReportGenerated?: (jobId: string) => void;
  availableTemplates?: ReportTemplate[];
  defaultParameters?: Record<string, any>;
}

interface ReportTemplate {
  id: number;
  name: string;
  template_type: string;
  description: string;
  parameters: Record<string, ParameterDefinition>;
  estimated_generation_time: number;
}

interface ParameterDefinition {
  type: 'date_range' | 'select' | 'multi_select' | 'number' | 'text';
  label: string;
  description?: string;
  required: boolean;
  options?: Array<{ value: any; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}
```

**Key Features:**
- Dynamic form generation based on template parameters
- Parameter validation with real-time feedback
- Report preview functionality
- Multiple export format selection
- Progress tracking for report generation
- Template favorites and recent reports

**Form Validation:**
```typescript
const validationSchema = Yup.object().shape({
  template_id: Yup.number().required('Template is required'),
  date_range: Yup.array()
    .of(Yup.date())
    .length(2)
    .required('Date range is required'),
  export_format: Yup.string().oneOf(['pdf', 'excel', 'csv', 'json']).required()
});
```

#### 4. Violations Management Component

**File**: `src/components/compliance/violations/ViolationsList.tsx`

```typescript
interface ViolationsListProps {
  filters?: ViolationFilters;
  onViolationSelect?: (violation: ComplianceViolation) => void;
  allowResolution?: boolean;
  showBulkActions?: boolean;
}

interface ComplianceViolation {
  id: number;
  violation_type: 'working_time' | 'break_time' | 'overtime' | 'rest_period';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  description: string;
  detected_at: string;
  shift: {
    id: number;
    start_time: string;
    end_time: string;
    staff_name: string;
    venue_name: string;
  };
  resolution?: ViolationResolution;
  created_at: string;
  updated_at: string;
}

interface ViolationResolution {
  id: number;
  resolution_type: 'corrected' | 'approved_exception' | 'system_error' | 'policy_change';
  notes: string;
  resolved_by: string;
  resolved_at: string;
  requires_approval: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected';
}
```

**Key Features:**
- Sortable and filterable violations table
- Bulk resolution actions for managers/admins
- Violation detail modal with resolution tracking
- Status change notifications
- Export filtered violations to CSV/Excel
- Quick action buttons for common resolutions

**Filtering Capabilities:**
- Date range filtering
- Violation type and severity
- Status filtering
- Venue and staff filtering
- Text search in descriptions

#### 5. Compliance Settings Component

**File**: `src/components/compliance/settings/ComplianceSettings.tsx`

```typescript
interface ComplianceSettingsProps {
  initialSettings?: ComplianceSettings;
  onSettingsChange?: (settings: ComplianceSettings) => void;
  readOnly?: boolean;
}

interface ComplianceSettings {
  id: number;
  venue?: number;
  staff_member?: number;
  max_daily_hours: number;
  max_weekly_hours: number;
  min_break_duration_minutes: number;
  max_consecutive_hours: number;
  min_rest_period_hours: number;
  overtime_threshold_daily: number;
  overtime_threshold_weekly: number;
  break_frequency_hours: number;
  allow_overtime: boolean;
  require_break_acknowledgment: boolean;
  auto_clock_out: boolean;
  notification_preferences: {
    email_alerts: boolean;
    sms_alerts: boolean;
    in_app_notifications: boolean;
    violation_threshold: 'immediate' | 'daily' | 'weekly';
  };
  is_active: boolean;
}
```

**Key Features:**
- Tabbed interface for different setting categories
- Form validation with business rule checks
- Settings inheritance visualization (Global → Venue → Staff)
- Bulk settings application for multiple venues/staff
- Settings change history and audit trail
- Import/Export settings functionality

**Validation Rules:**
- Max daily hours: 4-16 hours
- Max weekly hours: 20-80 hours
- Break duration: 15-120 minutes
- Overtime thresholds must be less than max hours

### API Service Integration

#### Compliance Service
**File**: `src/services/compliance/complianceService.ts`

```typescript
export class ComplianceService {
  private static baseURL = '/api/v1/compliance';

  static async getMetrics(params: MetricsParams): Promise<ComplianceMetrics> {
    const response = await apiClient.get(`${this.baseURL}/metrics/`, { params });
    return response.data;
  }

  static async performRealTimeCheck(shiftId: number): Promise<RealTimeCheckResult> {
    const response = await apiClient.post(`${this.baseURL}/check/`, { shift_id: shiftId });
    return response.data;
  }

  static async getSettings(venueId?: number, staffId?: number): Promise<ComplianceSettings> {
    const params = { venue_id: venueId, staff_id: staffId };
    const response = await apiClient.get(`${this.baseURL}/settings/`, { params });
    return response.data;
  }

  static async updateSettings(settings: Partial<ComplianceSettings>): Promise<ComplianceSettings> {
    const response = await apiClient.put(`${this.baseURL}/settings/${settings.id}/`, settings);
    return response.data;
  }

  static async getViolations(filters: ViolationFilters): Promise<PaginatedResponse<ComplianceViolation>> {
    const response = await apiClient.get(`${this.baseURL}/violations/`, { params: filters });
    return response.data;
  }

  static async resolveViolation(violationId: number, resolution: ViolationResolution): Promise<ComplianceViolation> {
    const response = await apiClient.post(`${this.baseURL}/violations/${violationId}/resolve/`, resolution);
    return response.data;
  }

  static async bulkResolveViolations(violationIds: number[], resolution: BulkResolution): Promise<BulkResolutionResult> {
    const response = await apiClient.post(`${this.baseURL}/violations/bulk-resolve/`, {
      violation_ids: violationIds,
      ...resolution
    });
    return response.data;
  }
}
```

#### Reporting Service
**File**: `src/services/compliance/reportingService.ts`

```typescript
export class ReportingService {
  private static baseURL = '/api/v1/reports';

  static async getTemplates(): Promise<ReportTemplate[]> {
    const response = await apiClient.get(`${this.baseURL}/templates/`);
    return response.data.results;
  }

  static async generateReport(config: ReportGenerationConfig): Promise<ReportJob> {
    const response = await apiClient.post(`${this.baseURL}/jobs/`, config);
    return response.data;
  }

  static async getReportStatus(jobId: string): Promise<ReportJob> {
    const response = await apiClient.get(`${this.baseURL}/jobs/${jobId}/`);
    return response.data;
  }

  static async downloadReport(jobId: string): Promise<ReportDownload> {
    const response = await apiClient.get(`${this.baseURL}/jobs/${jobId}/download/`);
    return response.data;
  }

  static async previewReport(templateId: number, parameters: Record<string, any>): Promise<ReportPreview> {
    const response = await apiClient.post(`${this.baseURL}/templates/${templateId}/preview/`, {
      parameters
    });
    return response.data;
  }

  static async getJobHistory(params: JobHistoryParams): Promise<PaginatedResponse<ReportJob>> {
    const response = await apiClient.get(`${this.baseURL}/jobs/`, { params });
    return response.data;
  }
}
```

### Custom Hooks Implementation

#### useComplianceData Hook
**File**: `src/hooks/compliance/useComplianceData.ts`

```typescript
export function useComplianceData(params: ComplianceDataParams) {
  return useQuery(
    ['compliance-data', params],
    () => ComplianceService.getMetrics(params),
    {
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      refetchInterval: params.autoRefresh ? 30000 : false,
      select: (data) => ({
        ...data,
        complianceRate: Math.round(data.overall_compliance_rate * 100) / 100,
        criticalPercentage: data.total_violations > 0
          ? Math.round((data.critical_violations / data.total_violations) * 100)
          : 0
      })
    }
  );
}

export function useComplianceSettings(venueId?: number, staffId?: number) {
  const queryKey = ['compliance-settings', venueId, staffId];

  const query = useQuery(
    queryKey,
    () => ComplianceService.getSettings(venueId, staffId),
    {
      staleTime: 300000, // 5 minutes
      enabled: !!(venueId || staffId)
    }
  );

  const updateMutation = useMutation(
    ComplianceService.updateSettings,
    {
      onSuccess: (data) => {
        queryClient.setQueryData(queryKey, data);
        queryClient.invalidateQueries(['compliance-data']);
      }
    }
  );

  return {
    ...query,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isLoading
  };
}
```

#### useRealTimeUpdates Hook
**File**: `src/hooks/compliance/useRealTimeUpdates.ts`

```typescript
interface UseRealTimeUpdatesOptions {
  onViolationReceived?: (violation: ComplianceViolation) => void;
  onStatusUpdate?: (status: LiveComplianceStatus) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useRealTimeUpdates(options: UseRealTimeUpdatesOptions = {}) {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [latestViolations, setLatestViolations] = useState<ComplianceViolation[]>([]);
  const [statusUpdates, setStatusUpdates] = useState<Record<number, LiveComplianceStatus>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');

    const token = authService.getToken();
    const wsUrl = `${process.env.REACT_APP_WS_URL}/compliance/?token=${token}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setConnectionStatus('connected');
      options.onConnectionChange?.(true);
    };

    wsRef.current.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'violation_detected':
          const violation = message.data as ComplianceViolation;
          setLatestViolations(prev => [violation, ...prev.slice(0, 9)]); // Keep last 10
          options.onViolationReceived?.(violation);
          break;

        case 'status_update':
          const status = message.data as LiveComplianceStatus;
          setStatusUpdates(prev => ({
            ...prev,
            [status.venue_id]: status
          }));
          options.onStatusUpdate?.(status);
          break;

        case 'compliance_metrics_update':
          // Invalidate compliance metrics query to trigger refetch
          queryClient.invalidateQueries(['compliance-data']);
          break;
      }
    };

    wsRef.current.onclose = () => {
      setConnectionStatus('disconnected');
      options.onConnectionChange?.(false);

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 5000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

  }, [options]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    latestViolations,
    statusUpdates,
    reconnect: connect
  };
}
```

### State Management Strategy

#### Compliance Context Provider
**File**: `src/contexts/ComplianceContext.tsx`

```typescript
interface ComplianceContextType {
  selectedVenues: number[];
  selectedDateRange: DateRange;
  complianceFilters: ComplianceFilters;
  setSelectedVenues: (venues: number[]) => void;
  setSelectedDateRange: (range: DateRange) => void;
  updateFilters: (filters: Partial<ComplianceFilters>) => void;
  clearFilters: () => void;
}

const ComplianceContext = createContext<ComplianceContextType | null>(null);

export const ComplianceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedVenues, setSelectedVenues] = useState<number[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>([
    startOfMonth(new Date()),
    endOfMonth(new Date())
  ]);
  const [complianceFilters, setComplianceFilters] = useState<ComplianceFilters>({});

  const updateFilters = useCallback((newFilters: Partial<ComplianceFilters>) => {
    setComplianceFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setComplianceFilters({});
    setSelectedVenues([]);
    setSelectedDateRange([startOfMonth(new Date()), endOfMonth(new Date())]);
  }, []);

  const value: ComplianceContextType = {
    selectedVenues,
    selectedDateRange,
    complianceFilters,
    setSelectedVenues,
    setSelectedDateRange,
    updateFilters,
    clearFilters
  };

  return (
    <ComplianceContext.Provider value={value}>
      {children}
    </ComplianceContext.Provider>
  );
};

export const useComplianceContext = () => {
  const context = useContext(ComplianceContext);
  if (!context) {
    throw new Error('useComplianceContext must be used within ComplianceProvider');
  }
  return context;
};
```

### UI Component Guidelines

#### Design System Integration

**Color Palette for Compliance Status:**
```typescript
export const complianceColors = {
  compliant: {
    primary: '#10B981', // Green-500
    background: '#D1FAE5', // Green-100
    border: '#86EFAC' // Green-300
  },
  warning: {
    primary: '#F59E0B', // Amber-500
    background: '#FEF3C7', // Amber-100
    border: '#FCD34D' // Amber-300
  },
  violation: {
    primary: '#EF4444', // Red-500
    background: '#FEE2E2', // Red-100
    border: '#FCA5A5' // Red-300
  },
  critical: {
    primary: '#DC2626', // Red-600
    background: '#FECACA', // Red-200
    border: '#F87171' // Red-400
  }
};

export const severityColors = {
  low: complianceColors.compliant,
  medium: complianceColors.warning,
  high: complianceColors.violation,
  critical: complianceColors.critical
};
```

**Fluent UI Component Usage:**
```typescript
// Status Badge Component
export const ComplianceStatusBadge: React.FC<{ status: ComplianceStatus; size?: 'small' | 'medium' | 'large' }> = ({ status, size = 'medium' }) => {
  const colorConfig = complianceColors[status];

  return (
    <Badge
      appearance="filled"
      size={size}
      style={{
        backgroundColor: colorConfig.primary,
        color: 'white'
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
};

// Data Grid with Fluent UI
export const ViolationsDataGrid: React.FC<ViolationsGridProps> = ({ violations, onSelectionChange }) => {
  const columns: TableColumnDefinition<ComplianceViolation>[] = [
    createTableColumn<ComplianceViolation>({
      columnId: "type",
      renderHeaderCell: () => "Type",
      renderCell: (item) => (
        <TableCell>
          <Badge appearance="outline">{item.violation_type.replace('_', ' ')}</Badge>
        </TableCell>
      ),
    }),
    createTableColumn<ComplianceViolation>({
      columnId: "severity",
      renderHeaderCell: () => "Severity",
      renderCell: (item) => (
        <TableCell>
          <ComplianceStatusBadge status={item.severity} size="small" />
        </TableCell>
      ),
    }),
    // ... more columns
  ];

  return (
    <DataGrid
      items={violations}
      columns={columns}
      selectionMode="multiselect"
      onSelectionChange={onSelectionChange}
      sortable
    />
  );
};
```

### Testing Requirements

#### Component Testing Strategy
```typescript
// ViolationsList.test.tsx
describe('ViolationsList Component', () => {
  const mockViolations: ComplianceViolation[] = [
    {
      id: 1,
      violation_type: 'working_time',
      severity: 'high',
      status: 'active',
      description: 'Exceeded maximum daily working hours',
      detected_at: '2024-01-15T14:30:00Z',
      shift: {
        id: 123,
        start_time: '2024-01-15T08:00:00Z',
        end_time: '2024-01-15T20:00:00Z',
        staff_name: 'John Doe',
        venue_name: 'Main Office'
      },
      created_at: '2024-01-15T14:30:00Z',
      updated_at: '2024-01-15T14:30:00Z'
    }
  ];

  it('renders violations list correctly', async () => {
    render(
      <QueryClient>
        <ViolationsList violations={mockViolations} />
      </QueryClient>
    );

    expect(screen.getByText('working_time')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('handles violation resolution', async () => {
    const mockOnResolve = jest.fn();

    render(
      <QueryClient>
        <ViolationsList
          violations={mockViolations}
          onViolationResolve={mockOnResolve}
          allowResolution={true}
        />
      </QueryClient>
    );

    const resolveButton = screen.getByRole('button', { name: /resolve/i });
    fireEvent.click(resolveButton);

    expect(mockOnResolve).toHaveBeenCalledWith(1);
  });

  it('filters violations correctly', async () => {
    const { rerender } = render(
      <QueryClient>
        <ViolationsList violations={mockViolations} />
      </QueryClient>
    );

    expect(screen.getByText('working_time')).toBeInTheDocument();

    // Apply filter that excludes the violation
    rerender(
      <QueryClient>
        <ViolationsList
          violations={mockViolations}
          filters={{ severity: ['low'] }}
        />
      </QueryClient>
    );

    expect(screen.queryByText('working_time')).not.toBeInTheDocument();
  });
});
```

#### Integration Testing
```typescript
// ComplianceDashboard.integration.test.tsx
describe('Compliance Dashboard Integration', () => {
  it('loads and displays compliance data', async () => {
    // Mock API responses
    server.use(
      rest.get('/api/v1/compliance/metrics/', (req, res, ctx) => {
        return res(ctx.json({
          overall_compliance_rate: 95.5,
          total_violations: 12,
          critical_violations: 2,
          resolved_violations: 8
        }));
      })
    );

    render(
      <QueryClient>
        <ComplianceProvider>
          <ComplianceDashboard venueId={1} />
        </ComplianceProvider>
      </QueryClient>
    );

    await waitFor(() => {
      expect(screen.getByText('95.5%')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
    });
  });

  it('handles real-time updates via WebSocket', async () => {
    const mockWebSocket = new MockWebSocket();

    render(
      <QueryClient>
        <ComplianceProvider>
          <RealTimeMonitor />
        </ComplianceProvider>
      </QueryClient>
    );

    // Simulate WebSocket message
    mockWebSocket.sendMessage({
      type: 'violation_detected',
      data: {
        id: 999,
        violation_type: 'overtime',
        severity: 'critical',
        description: 'Critical overtime violation detected'
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Critical overtime violation detected')).toBeInTheDocument();
    });
  });
});
```

### Performance Requirements

#### Optimization Guidelines

1. **Data Loading Performance:**
   - Initial dashboard load: <2 seconds
   - Real-time updates: <500ms latency
   - Large data sets (1000+ violations): Virtual scrolling
   - Chart rendering: Lazy loading with skeleton states

2. **Memory Management:**
   - Implement proper cleanup in useEffect hooks
   - Use React.memo for expensive components
   - Virtualize large lists and tables
   - Limit WebSocket message buffer size

3. **Caching Strategy:**
   - API responses cached for 30 seconds to 5 minutes
   - User preferences cached locally
   - Report templates cached for 1 hour
   - Violation data cached for 1 minute

```typescript
// Performance optimization example
const ViolationsList = React.memo<ViolationsListProps>(({ violations, filters, onSelectionChange }) => {
  const filteredViolations = useMemo(() => {
    if (!filters) return violations;

    return violations.filter(violation => {
      if (filters.severity && !filters.severity.includes(violation.severity)) {
        return false;
      }
      if (filters.type && !filters.type.includes(violation.violation_type)) {
        return false;
      }
      return true;
    });
  }, [violations, filters]);

  const handleSelectionChange = useCallback((selectedItems: ComplianceViolation[]) => {
    onSelectionChange?.(selectedItems);
  }, [onSelectionChange]);

  return (
    <FixedSizeList
      height={600}
      itemCount={filteredViolations.length}
      itemSize={80}
      itemData={filteredViolations}
    >
      {ViolationListItem}
    </FixedSizeList>
  );
});
```

### Accessibility Requirements

#### WCAG 2.1 AA Compliance
```typescript
// Accessible component example
export const ComplianceAlert: React.FC<ComplianceAlertProps> = ({ violation, onDismiss }) => {
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-labelledby="alert-title"
      className="compliance-alert"
    >
      <h3 id="alert-title">
        {violation.severity.charAt(0).toUpperCase() + violation.severity.slice(1)} Violation Detected
      </h3>

      <p aria-describedby="alert-description">
        {violation.description}
      </p>

      <Button
        onClick={onDismiss}
        aria-label={`Dismiss ${violation.severity} violation alert`}
      >
        Dismiss
      </Button>
    </div>
  );
};
```

#### Keyboard Navigation
- All interactive elements accessible via keyboard
- Logical tab order throughout compliance interfaces
- Escape key closes modals and dropdowns
- Arrow keys navigate through data grids
- Space/Enter activates buttons and selects items

### Mobile Responsiveness

#### Responsive Breakpoints
```typescript
const breakpoints = {
  mobile: '(max-width: 768px)',
  tablet: '(max-width: 1024px)',
  desktop: '(min-width: 1025px)'
};

// Responsive hook
export const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia(breakpoints.mobile);
    const tabletQuery = window.matchMedia(breakpoints.tablet);

    const updateQueries = () => {
      setIsMobile(mobileQuery.matches);
      setIsTablet(tabletQuery.matches && !mobileQuery.matches);
    };

    updateQueries();

    mobileQuery.addListener(updateQueries);
    tabletQuery.addListener(updateQueries);

    return () => {
      mobileQuery.removeListener(updateQueries);
      tabletQuery.removeListener(updateQueries);
    };
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
};
```

#### Mobile-Specific Features
- Touch-optimized violation resolution
- Swipe gestures for navigation
- Bottom sheet modals for mobile
- Optimized chart interactions
- Pull-to-refresh functionality

### Error Handling Strategy

#### Error Boundary Implementation
```typescript
// ComplianceErrorBoundary.tsx
interface ComplianceErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ComplianceErrorBoundary extends Component<
  PropsWithChildren<{}>,
  ComplianceErrorBoundaryState
> {
  constructor(props: PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ComplianceErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Compliance component error:', error, errorInfo);

    // Report to error tracking service
    errorTrackingService.reportError(error, {
      component: 'ComplianceSystem',
      errorInfo,
      userContext: {
        userId: getCurrentUser()?.id,
        timestamp: new Date().toISOString()
      }
    });

    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="compliance-error-fallback">
          <h2>Something went wrong with the compliance system</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
          <Button onClick={() => window.location.reload()}>
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### API Error Handling
```typescript
// Error handling in React Query
export const useComplianceDataWithErrorHandling = (params: ComplianceDataParams) => {
  return useQuery(
    ['compliance-data', params],
    () => ComplianceService.getMetrics(params),
    {
      retry: (failureCount, error: AxiosError) => {
        // Don't retry on 4xx errors
        if (error.response?.status && error.response.status >= 400 && error.response.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      onError: (error: AxiosError) => {
        if (error.response?.status === 403) {
          notification.notify({
            title: 'Access Denied',
            body: 'You do not have permission to view compliance data',
            intent: 'warning'
          });
        } else if (error.response?.status >= 500) {
          notification.notify({
            title: 'Server Error',
            body: 'Unable to load compliance data. Please try again later.',
            intent: 'error'
          });
        }
      }
    }
  );
};
```

### Implementation Priority

#### Phase 1: Core Components (Week 1-2)
1. **ComplianceDashboard** - Primary user interface
2. **ComplianceSettings** - Configuration interface
3. **ViolationsList** - Violation management
4. **Basic API integration and error handling**

#### Phase 2: Real-time Features (Week 3-4)
1. **RealTimeMonitor** - Live violation tracking
2. **WebSocket integration**
3. **Push notifications**
4. **Alert system**

#### Phase 3: Reporting & Advanced Features (Week 5-6)
1. **ReportBuilder** - Report generation interface
2. **ExportManager** - File export functionality
3. **Advanced filtering and search**
4. **Performance optimizations**

#### Phase 4: Polish & Testing (Week 7-8)
1. **Comprehensive testing suite**
2. **Accessibility improvements**
3. **Mobile optimization**
4. **Documentation and code cleanup**

### Deployment Checklist

#### Pre-deployment Validation
- [ ] All components pass TypeScript compilation
- [ ] Unit tests achieve >90% coverage
- [ ] Integration tests pass
- [ ] Accessibility audit passed
- [ ] Performance benchmarks met
- [ ] Cross-browser compatibility verified
- [ ] Mobile responsiveness tested

#### Production Considerations
- [ ] Environment variables configured
- [ ] API endpoints verified
- [ ] Error tracking service integrated
- [ ] Performance monitoring enabled
- [ ] WebSocket connections tested under load
- [ ] Caching strategy implemented

### Support Resources

#### Documentation Links
- **API Documentation**: `/docs/FRONTEND_API_INTEGRATION.md`
- **Architecture Decisions**: `/docs/compliance/ARCHITECTURAL_DECISIONS.md`
- **WebSocket Integration**: `/docs/compliance/WEBSOCKET_ARCHITECTURE.md`
- **Mobile PWA Guide**: `/docs/compliance/MOBILE_INTEGRATION.md`

#### Development Support
- **Backend APIs**: Fully implemented and tested
- **Database Schema**: Optimized and indexed
- **Real-time Infrastructure**: WebSocket endpoints ready
- **Export System**: Report generation service operational

#### Contact for Technical Questions
- **API Issues**: Backend development team
- **Real-time Features**: WebSocket implementation team
- **Performance Concerns**: Database optimization team
- **Security Questions**: Compliance and security team

This comprehensive specification provides everything needed to implement a production-ready compliance management system. All backend services are operational and ready for frontend integration.