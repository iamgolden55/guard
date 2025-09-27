# Frontend Integration Patterns for Regional Compliance

## Overview

This document provides comprehensive integration patterns for React components to consume the Regional Compliance API. These patterns ensure consistent data handling, real-time updates, error management, and optimal performance.

## Core React Hooks for Compliance

### useComplianceValidation Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { ComplianceStatus, Violation, ValidationResult } from '../types/compliance';
import { complianceService } from '../services/complianceService';

interface UseComplianceValidationOptions {
  userId: number;
  enableRealTime?: boolean;
  validationRules?: string[];
}

interface ComplianceValidationState {
  status: ComplianceStatus;
  violations: Violation[];
  warnings: Warning[];
  isLoading: boolean;
  lastValidated: Date | null;
  error: string | null;
}

export const useComplianceValidation = (options: UseComplianceValidationOptions) => {
  const [state, setState] = useState<ComplianceValidationState>({
    status: 'unknown',
    violations: [],
    warnings: [],
    isLoading: false,
    lastValidated: null,
    error: null
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!options.enableRealTime) return;

    const ws = new WebSocket(`${WS_BASE_URL}/compliance/`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'compliance_status_change' && data.data.user_id === options.userId) {
        setState(prev => ({
          ...prev,
          status: data.data.new_status,
          lastValidated: new Date(data.data.timestamp)
        }));
      }
      
      if (data.type === 'violation_detected' && data.data.user_id === options.userId) {
        setState(prev => ({
          ...prev,
          violations: [...prev.violations, data.data.violation]
        }));
      }
    };

    ws.onerror = (error) => {
      setState(prev => ({
        ...prev,
        error: 'Real-time connection failed'
      }));
    };

    return () => ws.close();
  }, [options.userId, options.enableRealTime]);

  // Validate schedule against compliance rules
  const validateSchedule = useCallback(async (proposedShifts: ProposedShift[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await complianceService.validateSchedule({
        user_id: options.userId,
        proposed_shifts: proposedShifts,
        validation_options: {
          check_weekly_limits: true,
          check_rest_periods: true,
          include_warnings: true
        }
      });

      setState(prev => ({
        ...prev,
        status: result.validation_result,
        violations: result.violations,
        warnings: result.warnings,
        isLoading: false,
        lastValidated: new Date()
      }));

      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false
      }));
      throw error;
    }
  }, [options.userId]);

  // Get current compliance status
  const refreshStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const violations = await complianceService.getViolations({
        user_id: options.userId,
        status: 'open'
      });

      const status = violations.length > 0 ? 'violation' : 'compliant';
      
      setState(prev => ({
        ...prev,
        status,
        violations: violations,
        isLoading: false,
        lastValidated: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        isLoading: false
      }));
    }
  }, [options.userId]);

  return {
    ...state,
    validateSchedule,
    refreshStatus
  };
};
```

### useRegionalCompliance Hook

```typescript
import { useState, useEffect } from 'react';
import { RegionDetectionResult, ComplianceRegulation } from '../types/compliance';

interface UseRegionalComplianceOptions {
  venueId?: number;
  autoDetect?: boolean;
}

export const useRegionalCompliance = (options: UseRegionalComplianceOptions = {}) => {
  const [region, setRegion] = useState<RegionDetectionResult | null>(null);
  const [regulation, setRegulation] = useState<ComplianceRegulation | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect region based on venue or IP
  useEffect(() => {
    if (!options.autoDetect) return;

    const detectRegion = async () => {
      setIsDetecting(true);
      setError(null);

      try {
        const params = options.venueId 
          ? { venue_id: options.venueId }
          : {}; // Will use IP detection

        const result = await complianceService.detectRegion(params);
        setRegion(result);

        if (result.regulation_id) {
          const reg = await complianceService.getRegulation(result.regulation_id);
          setRegulation(reg);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsDetecting(false);
      }
    };

    detectRegion();
  }, [options.venueId, options.autoDetect]);

  const changeRegion = async (regionCode: string) => {
    setIsDetecting(true);
    try {
      const regulation = await complianceService.getRegulationByCode(regionCode);
      setRegulation(regulation);
      setRegion({
        region_code: regionCode,
        country_code: regionCode.split('-')[0],
        regulation_id: regulation.id,
        confidence_score: 1.0,
        detection_method: 'manual',
        notes: 'Manually selected region'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDetecting(false);
    }
  };

  return {
    region,
    regulation,
    isDetecting,
    error,
    changeRegion
  };
};
```

## Component Patterns

### ComplianceStatusIndicator Component

```typescript
import React from 'react';
import { Badge, Tooltip } from '@fluentui/react-components';
import { Warning24Regular, Checkmark24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { useComplianceValidation } from '../hooks/useComplianceValidation';

interface ComplianceStatusIndicatorProps {
  userId: number;
  compact?: boolean;
  showDetails?: boolean;
}

export const ComplianceStatusIndicator: React.FC<ComplianceStatusIndicatorProps> = ({
  userId,
  compact = false,
  showDetails = true
}) => {
  const { status, violations, warnings, isLoading, lastValidated } = useComplianceValidation({
    userId,
    enableRealTime: true
  });

  const getStatusColor = (status: ComplianceStatus) => {
    switch (status) {
      case 'compliant': return 'success';
      case 'warning': return 'warning';
      case 'violation': return 'danger';
      default: return 'subtle';
    }
  };

  const getStatusIcon = (status: ComplianceStatus) => {
    switch (status) {
      case 'compliant': return <Checkmark24Regular />;
      case 'warning': return <Warning24Regular />;
      case 'violation': return <Dismiss24Regular />;
      default: return null;
    }
  };

  const formatStatusText = (status: ComplianceStatus) => {
    switch (status) {
      case 'compliant': return 'Compliant';
      case 'warning': return `Warning (${warnings.length})`;
      case 'violation': return `Violations (${violations.length})`;
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return <Badge appearance="outline">Checking...</Badge>;
  }

  const statusBadge = (
    <Badge 
      appearance="filled" 
      color={getStatusColor(status)}
      icon={getStatusIcon(status)}
      size={compact ? "small" : "medium"}
    >
      {formatStatusText(status)}
    </Badge>
  );

  if (!showDetails) {
    return statusBadge;
  }

  const tooltipContent = (
    <div className="compliance-tooltip">
      <div><strong>Status:</strong> {formatStatusText(status)}</div>
      {violations.length > 0 && (
        <div><strong>Active Violations:</strong> {violations.length}</div>
      )}
      {warnings.length > 0 && (
        <div><strong>Warnings:</strong> {warnings.length}</div>
      )}
      {lastValidated && (
        <div><strong>Last Checked:</strong> {lastValidated.toLocaleString()}</div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} relationship="description">
      {statusBadge}
    </Tooltip>
  );
};
```

### ScheduleValidationForm Component

```typescript
import React, { useState } from 'react';
import { 
  Field, 
  Button, 
  Spinner, 
  MessageBar, 
  MessageBarType 
} from '@fluentui/react-components';
import { useComplianceValidation } from '../hooks/useComplianceValidation';
import { useRegionalCompliance } from '../hooks/useRegionalCompliance';
import { ShiftInput } from './ShiftInput';

interface ScheduleValidationFormProps {
  userId: number;
  venueId?: number;
  onValidationComplete?: (result: ValidationResult) => void;
}

export const ScheduleValidationForm: React.FC<ScheduleValidationFormProps> = ({
  userId,
  venueId,
  onValidationComplete
}) => {
  const [proposedShifts, setProposedShifts] = useState<ProposedShift[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  
  const { validateSchedule, isLoading, error } = useComplianceValidation({ userId });
  const { region, regulation } = useRegionalCompliance({ 
    venueId, 
    autoDetect: true 
  });

  const handleValidate = async () => {
    try {
      const result = await validateSchedule(proposedShifts);
      setValidationResult(result);
      onValidationComplete?.(result);
    } catch (err) {
      // Error handled by hook
    }
  };

  const addShift = () => {
    setProposedShifts(prev => [...prev, {
      venue_id: venueId || 0,
      start_time: '',
      end_time: '',
      shift_type: 'security_guard'
    }]);
  };

  const removeShift = (index: number) => {
    setProposedShifts(prev => prev.filter((_, i) => i !== index));
  };

  const updateShift = (index: number, shift: ProposedShift) => {
    setProposedShifts(prev => prev.map((s, i) => i === index ? shift : s));
  };

  return (
    <div className="schedule-validation-form">
      {region && (
        <MessageBar intent="info">
          <strong>Region:</strong> {region.region_code} | 
          <strong>Max Daily Hours:</strong> {regulation?.max_daily_hours} | 
          <strong>Max Weekly Hours:</strong> {regulation?.max_weekly_hours}
        </MessageBar>
      )}

      <div className="shifts-section">
        <h3>Proposed Shifts</h3>
        {proposedShifts.map((shift, index) => (
          <ShiftInput
            key={index}
            shift={shift}
            onChange={(updatedShift) => updateShift(index, updatedShift)}
            onRemove={() => removeShift(index)}
          />
        ))}
        
        <Button appearance="secondary" onClick={addShift}>
          Add Shift
        </Button>
      </div>

      <div className="validation-actions">
        <Button 
          appearance="primary" 
          onClick={handleValidate}
          disabled={proposedShifts.length === 0 || isLoading}
        >
          {isLoading ? <Spinner size="tiny" /> : 'Validate Schedule'}
        </Button>
      </div>

      {error && (
        <MessageBar intent="error">
          <strong>Validation Error:</strong> {error}
        </MessageBar>
      )}

      {validationResult && (
        <div className="validation-results">
          <MessageBar 
            intent={validationResult.is_compliant ? "success" : "warning"}
          >
            <strong>Result:</strong> {validationResult.validation_result.toUpperCase()}
          </MessageBar>

          {validationResult.violations.length > 0 && (
            <div className="violations">
              <h4>Violations</h4>
              {validationResult.violations.map((violation, index) => (
                <MessageBar key={index} intent="error">
                  <strong>{violation.type}:</strong> {violation.message}
                  {violation.regulation_reference && (
                    <div><em>Reference: {violation.regulation_reference}</em></div>
                  )}
                </MessageBar>
              ))}
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div className="warnings">
              <h4>Warnings</h4>
              {validationResult.warnings.map((warning, index) => (
                <MessageBar key={index} intent="warning">
                  <strong>{warning.type}:</strong> {warning.message}
                  {warning.recommendation && (
                    <div><em>Recommendation: {warning.recommendation}</em></div>
                  )}
                </MessageBar>
              ))}
            </div>
          )}

          {validationResult.alternative_suggestions?.length > 0 && (
            <div className="suggestions">
              <h4>Optimization Suggestions</h4>
              {validationResult.alternative_suggestions.map((suggestion, index) => (
                <MessageBar key={index} intent="info">
                  <strong>{suggestion.modification}:</strong> {suggestion.reason}
                  {suggestion.hours && <span> ({suggestion.hours} hours)</span>}
                </MessageBar>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### RegionalComplianceSelector Component

```typescript
import React, { useState } from 'react';
import { 
  Dropdown, 
  Option, 
  Button, 
  MessageBar, 
  ProgressBar 
} from '@fluentui/react-components';
import { useRegionalCompliance } from '../hooks/useRegionalCompliance';

interface RegionalComplianceSelectorProps {
  profileId: number;
  onRegionChanged?: (region: string) => void;
}

const AVAILABLE_REGIONS = [
  { key: 'UK', text: 'United Kingdom', flag: '🇬🇧' },
  { key: 'US-DEFAULT', text: 'United States (Federal)', flag: '🇺🇸' },
  { key: 'US-CA', text: 'California, USA', flag: '🇺🇸' },
  { key: 'US-NY', text: 'New York, USA', flag: '🇺🇸' },
  { key: 'EU-FR', text: 'France', flag: '🇫🇷' },
  { key: 'EU-DE', text: 'Germany', flag: '🇩🇪' },
  { key: 'EU-ES', text: 'Spain', flag: '🇪🇸' },
];

export const RegionalComplianceSelector: React.FC<RegionalComplianceSelectorProps> = ({
  profileId,
  onRegionChanged
}) => {
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<any>(null);
  
  const { region, regulation, changeRegion } = useRegionalCompliance();

  const handleRegionSelect = (regionCode: string) => {
    setSelectedRegion(regionCode);
    changeRegion(regionCode);
    onRegionChanged?.(regionCode);
  };

  const applyPreset = async () => {
    if (!selectedRegion) return;
    
    setIsApplying(true);
    try {
      const result = await complianceService.applyPreset({
        region_code: selectedRegion,
        profile_id: profileId,
        override_existing: false,
        apply_sia_requirements: selectedRegion === 'UK'
      });
      
      setApplyResult(result);
    } catch (error) {
      setApplyResult({ error: error.message });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="regional-compliance-selector">
      <Field label="Select Compliance Region">
        <Dropdown
          placeholder="Choose your region..."
          onOptionSelect={(_, data) => handleRegionSelect(data.optionValue as string)}
          value={selectedRegion}
        >
          {AVAILABLE_REGIONS.map(region => (
            <Option key={region.key} value={region.key}>
              {region.flag} {region.text}
            </Option>
          ))}
        </Dropdown>
      </Field>

      {regulation && (
        <div className="regulation-preview">
          <h4>Compliance Rules Preview</h4>
          <div className="rules-grid">
            <div><strong>Max Daily Hours:</strong> {regulation.max_daily_hours}</div>
            <div><strong>Max Weekly Hours:</strong> {regulation.max_weekly_hours}</div>
            <div><strong>Min Rest Hours:</strong> {regulation.min_rest_between_shifts_hours}</div>
            <div><strong>Overtime Threshold:</strong> {regulation.overtime_threshold_hours || 'N/A'}</div>
            {selectedRegion === 'UK' && (
              <div><strong>SIA License Required:</strong> Yes</div>
            )}
          </div>
        </div>
      )}

      <Button 
        appearance="primary" 
        onClick={applyPreset}
        disabled={!selectedRegion || isApplying}
      >
        {isApplying ? 'Applying...' : 'Apply Regional Preset'}
      </Button>

      {isApplying && <ProgressBar />}

      {applyResult && (
        <div className="apply-results">
          {applyResult.error ? (
            <MessageBar intent="error">
              <strong>Error:</strong> {applyResult.error}
            </MessageBar>
          ) : (
            <>
              <MessageBar intent="success">
                Preset applied successfully! {applyResult.changes_summary?.modified_fields} fields updated.
              </MessageBar>
              
              {applyResult.warnings?.length > 0 && (
                <div className="warnings">
                  <h4>Important Notes:</h4>
                  {applyResult.warnings.map((warning: string, index: number) => (
                    <MessageBar key={index} intent="warning">
                      {warning}
                    </MessageBar>
                  ))}
                </div>
              )}
              
              {applyResult.changes_summary?.estimated_cost_impact && (
                <MessageBar intent="info">
                  <strong>Cost Impact:</strong> {applyResult.changes_summary.estimated_cost_impact}
                </MessageBar>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
```

## Service Layer Integration

### ComplianceService Class

```typescript
import axios, { AxiosInstance } from 'axios';
import { 
  RegionDetectionResult, 
  ValidationResult, 
  ComplianceViolation,
  PresetApplicationRequest,
  PresetApplicationResult 
} from '../types/compliance';

class ComplianceService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api/v1/compliance',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth interceptor
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add error handling interceptor
    this.api.interceptors.response.use(
      (response) => response.data.data, // Return just the data portion
      (error) => {
        if (error.response?.data?.error) {
          throw new Error(error.response.data.error.message);
        }
        throw error;
      }
    );
  }

  // Region detection
  async detectRegion(params: { venue_id?: number; ip_address?: string } = {}): Promise<RegionDetectionResult> {
    return this.api.get('/regional/detect-region/', { params });
  }

  // Apply regional preset
  async applyPreset(request: PresetApplicationRequest): Promise<PresetApplicationResult> {
    return this.api.post('/regional/profiles/apply-preset/', request);
  }

  // Compare regulations
  async compareRegulations(regions: string[], options: {
    include_sia_requirements?: boolean;
    include_break_rules?: boolean;
    include_overtime?: boolean;
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    regions.forEach(region => params.append('regions[]', region));
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.api.get(`/regional/compare/?${params}`);
  }

  // Schedule validation
  async validateSchedule(request: {
    user_id: number;
    proposed_shifts: any[];
    validation_options?: any;
  }): Promise<ValidationResult> {
    return this.api.post('/regional/validate-schedule/', request);
  }

  // Violations management
  async getViolations(params: {
    user_id?: number;
    severity?: string;
    status?: string;
    period_start?: string;
    period_end?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ComplianceViolation[]> {
    const response = await this.api.get('/violations/', { params });
    return response.violations;
  }

  async resolveViolation(violationId: number, resolution: {
    resolution_status: string;
    resolution_notes: string;
    exception_reason?: string;
    financial_impact?: number;
  }): Promise<ComplianceViolation> {
    return this.api.patch(`/violations/${violationId}/resolve/`, resolution);
  }

  // Metrics
  async getComplianceMetrics(params: {
    user_id?: number;
    venue_id?: number;
    period_type?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<any> {
    return this.api.get('/metrics/summary/', { params });
  }

  // Cache management
  async invalidateCache(cacheKeys?: string[]): Promise<void> {
    return this.api.post('/cache/invalidate/', { cache_keys: cacheKeys });
  }
}

export const complianceService = new ComplianceService();
```

## Real-time WebSocket Integration

### WebSocket Service

```typescript
class ComplianceWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Set<Function>> = new Map();

  connect(userId: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${WS_BASE_URL}/compliance/?user_id=${userId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Compliance WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('Compliance WebSocket disconnected');
      this.handleReconnect(userId);
    };

    this.ws.onerror = (error) => {
      console.error('Compliance WebSocket error:', error);
    };
  }

  private handleMessage(data: any) {
    const { type } = data;
    const handlers = this.eventHandlers.get(type);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data.data);
        } catch (error) {
          console.error(`Error in WebSocket handler for ${type}:`, error);
        }
      });
    }
  }

  private handleReconnect(userId: number) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(userId);
      }, delay);
    }
  }

  subscribe(eventType: string, handler: Function) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
  }
}

export const complianceWebSocket = new ComplianceWebSocketService();
```

## Error Handling Patterns

### ComplianceErrorBoundary Component

```typescript
import React, { Component, ReactNode } from 'react';
import { MessageBar, Button } from '@fluentui/react-components';

interface ComplianceErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

interface ComplianceErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

export class ComplianceErrorBoundary extends Component<
  ComplianceErrorBoundaryProps, 
  ComplianceErrorBoundaryState
> {
  constructor(props: ComplianceErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ComplianceErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    this.props.onError?.(error, errorInfo);
    
    // Log compliance-specific error details
    console.error('Compliance component error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="compliance-error-boundary">
          <MessageBar intent="error">
            <div>
              <strong>Compliance System Error</strong>
              <p>An error occurred while loading compliance information.</p>
              {this.state.error && (
                <details>
                  <summary>Error Details</summary>
                  <pre>{this.state.error.message}</pre>
                </details>
              )}
            </div>
          </MessageBar>
          
          <div style={{ marginTop: '16px' }}>
            <Button appearance="primary" onClick={this.handleRetry}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Performance Optimization Patterns

### Compliance Data Caching Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { complianceService } from '../services/complianceService';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ComplianceCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

const complianceCache = new ComplianceCache();

export const useComplianceCache = <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (useCache = true) => {
    // Check cache first
    if (useCache) {
      const cached = complianceCache.get<T>(key);
      if (cached) {
        setData(cached);
        return cached;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      complianceCache.set(key, result, ttl);
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, ttl]);

  const invalidate = useCallback(() => {
    complianceCache.invalidate(key);
    setData(null);
  }, [key]);

  const refresh = useCallback(() => {
    return fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refresh,
    invalidate
  };
};
```

## Testing Patterns

### Compliance Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useComplianceValidation } from '../hooks/useComplianceValidation';
import { complianceService } from '../services/complianceService';

// Mock the service
jest.mock('../services/complianceService');
const mockComplianceService = complianceService as jest.Mocked<typeof complianceService>;

describe('useComplianceValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate schedule and update state', async () => {
    const mockValidationResult = {
      validation_result: 'warning',
      is_compliant: true,
      violations: [],
      warnings: [
        {
          type: 'approaching_weekly_limit',
          message: 'This shift will bring weekly hours to 46/48 allowed',
          severity: 'info',
          recommendation: 'Monitor remaining weekly capacity'
        }
      ]
    };

    mockComplianceService.validateSchedule.mockResolvedValue(mockValidationResult);

    const { result } = renderHook(() => 
      useComplianceValidation({ userId: 123 })
    );

    const proposedShifts = [
      {
        venue_id: 456,
        start_time: '2024-01-15T09:00:00Z',
        end_time: '2024-01-15T21:00:00Z',
        shift_type: 'security_guard'
      }
    ];

    await act(async () => {
      await result.current.validateSchedule(proposedShifts);
    });

    expect(result.current.status).toBe('warning');
    expect(result.current.warnings).toHaveLength(1);
    expect(result.current.violations).toHaveLength(0);
    expect(mockComplianceService.validateSchedule).toHaveBeenCalledWith({
      user_id: 123,
      proposed_shifts: proposedShifts,
      validation_options: {
        check_weekly_limits: true,
        check_rest_periods: true,
        include_warnings: true
      }
    });
  });

  it('should handle validation errors', async () => {
    const errorMessage = 'Validation service unavailable';
    mockComplianceService.validateSchedule.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => 
      useComplianceValidation({ userId: 123 })
    );

    await act(async () => {
      try {
        await result.current.validateSchedule([]);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.isLoading).toBe(false);
  });
});
```

## Type Definitions

```typescript
// types/compliance.ts
export type ComplianceStatus = 'compliant' | 'warning' | 'violation' | 'unknown';

export interface RegionDetectionResult {
  region_code: string;
  country_code: string;
  regulation_id: number | null;
  confidence_score: number;
  detection_method: 'venue_location' | 'ip_geolocation' | 'user_preference' | 'fallback';
  applicable_regulations?: {
    working_time_directive: boolean;
    sia_requirements: boolean;
    opt_out_available: boolean;
  };
  notes?: string;
}

export interface ComplianceRegulation {
  id: number;
  country_code: string;
  max_daily_hours: number;
  max_weekly_hours: number;
  min_rest_between_shifts_hours: number;
  overtime_threshold_hours?: number;
  overtime_multiplier?: number;
  break_requirements?: object;
  security_sector_overrides?: object;
  opt_out_provisions?: object;
}

export interface Violation {
  type: string;
  severity: 'info' | 'warning' | 'minor' | 'major' | 'critical';
  message: string;
  threshold_exceeded?: number;
  regulation_reference?: string;
}

export interface Warning {
  type: string;
  message: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  recommendation?: string;
}

export interface ValidationResult {
  validation_result: 'compliant' | 'warning' | 'violation';
  is_compliant: boolean;
  violations: Violation[];
  warnings: Warning[];
  compliance_summary: {
    weekly_hours_after: number;
    weekly_limit: number;
    daily_hours: number;
    rest_period_compliant: boolean;
    sia_license_valid: boolean;
  };
  alternative_suggestions?: Array<{
    modification: string;
    hours?: number;
    reason: string;
  }>;
}

export interface ProposedShift {
  venue_id: number;
  start_time: string;
  end_time: string;
  shift_type: 'security_guard' | 'door_supervisor' | 'cctv_operator' | 'event_security' | 'mobile_patrol';
}

export interface ComplianceViolation {
  id: number;
  user_id: number;
  violation_type: string;
  severity: string;
  period_start: string;
  period_end: string;
  description: string;
  resolution_status: string;
  created_at: string;
  updated_at: string;
}
```

This comprehensive integration documentation provides React developers with all the patterns and components needed to build robust compliance features that integrate seamlessly with the Regional Compliance API.