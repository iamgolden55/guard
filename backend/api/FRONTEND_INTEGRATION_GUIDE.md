# Frontend Integration Guide: Regional Compliance API

## Quick Start

The Regional Compliance API is now ready for frontend integration. All endpoints are live at `/api/compliance/regional/` and require JWT authentication.

### Base Configuration

```typescript
// services/regionalComplianceService.ts
import apiClient from './index';

const REGIONAL_API_BASE = '/api/compliance/regional';

export class RegionalComplianceService {

  // Region Detection
  static async detectRegion(params: {
    venue_id?: number;
    lat?: number;
    lng?: number;
    ip_address?: string;
  }) {
    const response = await apiClient.get(`${REGIONAL_API_BASE}/detect-region/`, {
      params
    });
    return response.data;
  }

  // Apply Regional Preset
  static async applyPreset(data: {
    region_code: string;
    profile_id: number;
    override_existing?: boolean;
  }) {
    const response = await apiClient.post(`${REGIONAL_API_BASE}/profiles/apply-preset/`, data);
    return response.data;
  }

  // Compare Regulations
  static async compareRegulations(params: {
    regions: string[];
    include_sia_requirements?: boolean;
    include_break_rules?: boolean;
    include_overtime?: boolean;
  }) {
    const response = await apiClient.get(`${REGIONAL_API_BASE}/compare/`, {
      params: {
        'regions[]': params.regions,
        include_sia_requirements: params.include_sia_requirements,
        include_break_rules: params.include_break_rules,
        include_overtime: params.include_overtime
      }
    });
    return response.data;
  }

  // Validate Schedule
  static async validateSchedule(data: {
    user_id: number;
    shifts: Array<{
      start: string;
      end: string;
      role: string;
      break_minutes?: number;
    }>;
    venue_id?: number;
    validation_date?: string;
  }) {
    const response = await apiClient.post(`${REGIONAL_API_BASE}/validate-schedule/`, data);
    return response.data;
  }

  // Regional Settings
  static async getRegionalSettings(params: {
    venue_id?: number;
    staff_id?: number;
    region_code?: string;
  }) {
    const response = await apiClient.get(`${REGIONAL_API_BASE}/regional-settings/`, {
      params
    });
    return response.data;
  }

  static async createRegionalSettings(data: any) {
    const response = await apiClient.post(`${REGIONAL_API_BASE}/regional-settings/`, data);
    return response.data;
  }

  static async updateRegionalSettings(data: any) {
    const response = await apiClient.put(`${REGIONAL_API_BASE}/regional-settings/`, data);
    return response.data;
  }
}
```

## TypeScript Types

```typescript
// types/regionalCompliance.ts

export interface RegionDetectionRequest {
  venue_id?: number;
  lat?: number;
  lng?: number;
  ip_address?: string;
}

export interface RegionDetectionResponse {
  region_code: string;
  country_code: string;
  confidence_score: number;
  detection_method: 'venue' | 'coordinates' | 'ip_geolocation' | 'fallback';
  regulation_id: number;
  notes?: string;
}

export interface PresetApplicationRequest {
  region_code: string;
  profile_id: number;
  override_existing?: boolean;
}

export interface PresetApplicationResponse {
  success: boolean;
  profile_id: number;
  region_code: string;
  applied_settings: Record<string, any>;
  warnings?: string[];
}

export interface RegulationComparison {
  comparison_matrix: Record<string, {
    standard_weekly_hours: number;
    max_daily_hours: number;
    max_weekly_hours: number;
    min_rest_hours: number;
    break_duration_minutes: number;
    break_trigger_hours: number;
    overtime_threshold?: number;
    overtime_multiplier?: number;
    detailed_break_rules?: Record<string, any>;
  }>;
  key_differences: string[];
  sia_requirements?: Record<string, any>;
  opt_out_provisions?: Record<string, any>;
  generated_at: string;
}

export interface ShiftData {
  start: string;
  end: string;
  role: string;
  break_minutes?: number;
}

export interface ScheduleValidationRequest {
  user_id: number;
  shifts: ShiftData[];
  venue_id?: number;
  validation_date?: string;
}

export interface ComplianceViolation {
  type: string;
  shift_index?: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  shift_data?: ShiftData;
}

export interface ScheduleValidationResponse {
  is_compliant: boolean;
  violations: ComplianceViolation[];
  warnings: string[];
  total_hours: number;
  overtime_hours: number;
  regulation_applied: string;
}

export interface RegionalSettings {
  id?: number;
  venue_id?: number;
  staff_id?: number;
  region_code: string;
  max_daily_hours_override?: number;
  max_weekly_hours_override?: number;
  break_requirements_override?: Record<string, any>;
  security_clearance_required?: boolean;
  sia_license_required?: boolean;
  custom_rules?: Record<string, any>;
}
```

## React Components Examples

### 1. Region Detection Component

```tsx
// components/compliance/RegionDetection.tsx
import React, { useState } from 'react';
import { RegionalComplianceService } from '../../services/regionalComplianceService';
import { RegionDetectionResponse } from '../../types/regionalCompliance';

interface RegionDetectionProps {
  venueId?: number;
  onRegionDetected: (region: RegionDetectionResponse) => void;
}

export const RegionDetection: React.FC<RegionDetectionProps> = ({
  venueId,
  onRegionDetected
}) => {
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState<RegionDetectionResponse | null>(null);

  const detectRegion = async () => {
    setLoading(true);
    try {
      const response = await RegionalComplianceService.detectRegion({
        venue_id: venueId
      });

      setRegion(response.data);
      onRegionDetected(response.data);
    } catch (error) {
      console.error('Region detection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Region Detection</h3>

      {!region ? (
        <button
          onClick={detectRegion}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Detecting...' : 'Detect Region'}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Region:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {region.region_code}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-medium">Confidence:</span>
            <span className={`font-semibold ${getConfidenceColor(region.confidence_score)}`}>
              {(region.confidence_score * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-medium">Method:</span>
            <span className="text-gray-600">{region.detection_method}</span>
          </div>

          {region.notes && (
            <div className="text-sm text-gray-500 mt-2">
              {region.notes}
            </div>
          )}

          <button
            onClick={detectRegion}
            className="mt-2 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Re-detect
          </button>
        </div>
      )}
    </div>
  );
};
```

### 2. Preset Application Component

```tsx
// components/compliance/PresetApplication.tsx
import React, { useState } from 'react';
import { RegionalComplianceService } from '../../services/regionalComplianceService';
import { PresetApplicationResponse } from '../../types/regionalCompliance';

interface PresetApplicationProps {
  profileId: number;
  regionCode: string;
  onPresetApplied: (result: PresetApplicationResponse) => void;
}

export const PresetApplication: React.FC<PresetApplicationProps> = ({
  profileId,
  regionCode,
  onPresetApplied
}) => {
  const [loading, setLoading] = useState(false);
  const [overrideExisting, setOverrideExisting] = useState(false);
  const [result, setResult] = useState<PresetApplicationResponse | null>(null);

  const applyPreset = async () => {
    setLoading(true);
    try {
      const response = await RegionalComplianceService.applyPreset({
        region_code: regionCode,
        profile_id: profileId,
        override_existing: overrideExisting
      });

      setResult(response.data);
      onPresetApplied(response.data);
    } catch (error) {
      console.error('Preset application failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">
        Apply {regionCode} Regional Preset
      </h3>

      {!result ? (
        <div className="space-y-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={overrideExisting}
              onChange={(e) => setOverrideExisting(e.target.checked)}
              className="rounded"
            />
            <span>Override existing custom settings</span>
          </label>

          <button
            onClick={applyPreset}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Applying...' : 'Apply Preset'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {result.success ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-medium">
                ✓ Preset applied successfully
              </p>
            </div>
          ) : (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 font-medium">
                ✗ Preset application failed
              </p>
            </div>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 font-medium mb-2">Warnings:</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-sm text-gray-600">
            <p><strong>Applied Settings:</strong></p>
            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
              {JSON.stringify(result.applied_settings, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3. Schedule Validation Component

```tsx
// components/compliance/ScheduleValidation.tsx
import React, { useState } from 'react';
import { RegionalComplianceService } from '../../services/regionalComplianceService';
import { ScheduleValidationResponse, ShiftData } from '../../types/regionalCompliance';

interface ScheduleValidationProps {
  userId: number;
  shifts: ShiftData[];
  venueId?: number;
}

export const ScheduleValidation: React.FC<ScheduleValidationProps> = ({
  userId,
  shifts,
  venueId
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleValidationResponse | null>(null);

  const validateSchedule = async () => {
    setLoading(true);
    try {
      const response = await RegionalComplianceService.validateSchedule({
        user_id: userId,
        shifts,
        venue_id: venueId
      });

      setResult(response.data);
    } catch (error) {
      console.error('Schedule validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-800 bg-red-50 border-red-200';
      case 'high': return 'text-orange-800 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-800 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-800 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Schedule Validation</h3>

      <button
        onClick={validateSchedule}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Validating...' : 'Validate Schedule'}
      </button>

      {result && (
        <div className="space-y-4">
          {/* Compliance Status */}
          <div className={`p-3 rounded border ${
            result.is_compliant
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <p className="font-medium">
              {result.is_compliant ? '✓ Schedule is compliant' : '✗ Schedule has violations'}
            </p>
          </div>

          {/* Hours Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Hours:</span>
              <span className="ml-2">{result.total_hours}</span>
            </div>
            <div>
              <span className="font-medium">Overtime Hours:</span>
              <span className="ml-2">{result.overtime_hours}</span>
            </div>
          </div>

          {/* Violations */}
          {result.violations.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Violations:</h4>
              <div className="space-y-2">
                {result.violations.map((violation, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border text-sm ${getSeverityColor(violation.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{violation.type}</span>
                      <span className="text-xs uppercase">{violation.severity}</span>
                    </div>
                    <p className="mt-1">{violation.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Warnings:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Validated against: {result.regulation_applied}
          </div>
        </div>
      )}
    </div>
  );
};
```

### 4. Regulation Comparison Component

```tsx
// components/compliance/RegulationComparison.tsx
import React, { useState } from 'react';
import { RegionalComplianceService } from '../../services/regionalComplianceService';
import { RegulationComparison } from '../../types/regionalCompliance';

interface RegulationComparisonProps {
  initialRegions?: string[];
}

export const RegulationComparison: React.FC<RegulationComparisonProps> = ({
  initialRegions = ['UK', 'US']
}) => {
  const [regions, setRegions] = useState<string[]>(initialRegions);
  const [newRegion, setNewRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<RegulationComparison | null>(null);

  const addRegion = () => {
    if (newRegion && !regions.includes(newRegion)) {
      setRegions([...regions, newRegion]);
      setNewRegion('');
    }
  };

  const removeRegion = (regionToRemove: string) => {
    setRegions(regions.filter(r => r !== regionToRemove));
  };

  const compareRegulations = async () => {
    if (regions.length < 2) return;

    setLoading(true);
    try {
      const response = await RegionalComplianceService.compareRegulations({
        regions,
        include_sia_requirements: true,
        include_break_rules: true,
        include_overtime: true
      });

      setComparison(response.data);
    } catch (error) {
      console.error('Regulation comparison failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Regulation Comparison</h3>

      {/* Region Selection */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-2">
          {regions.map(region => (
            <span
              key={region}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center"
            >
              {region}
              <button
                onClick={() => removeRegion(region)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newRegion}
            onChange={(e) => setNewRegion(e.target.value)}
            placeholder="Add region (e.g., EU-FR, US-CA)"
            className="px-3 py-1 border rounded text-sm"
          />
          <button
            onClick={addRegion}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
          >
            Add
          </button>
        </div>
      </div>

      <button
        onClick={compareRegulations}
        disabled={loading || regions.length < 2}
        className="mb-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? 'Comparing...' : 'Compare Regulations'}
      </button>

      {comparison && (
        <div className="space-y-4">
          {/* Key Differences */}
          {comparison.key_differences.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Key Differences:</h4>
              <ul className="text-sm space-y-1">
                {comparison.key_differences.map((diff, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparison Matrix */}
          <div>
            <h4 className="font-medium mb-2">Comparison Matrix:</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-2 py-1 text-left">Region</th>
                    <th className="border border-gray-300 px-2 py-1">Weekly Hours</th>
                    <th className="border border-gray-300 px-2 py-1">Daily Max</th>
                    <th className="border border-gray-300 px-2 py-1">Rest Hours</th>
                    <th className="border border-gray-300 px-2 py-1">Break (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(comparison.comparison_matrix).map(([region, data]) => (
                    <tr key={region}>
                      <td className="border border-gray-300 px-2 py-1 font-medium">{region}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {data.standard_weekly_hours}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {data.max_daily_hours}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {data.min_rest_hours}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-center">
                        {data.break_duration_minutes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Generated: {new Date(comparison.generated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
```

## Integration Checklist

### ✅ Phase 1: Basic Integration
- [ ] Add RegionalComplianceService to your services
- [ ] Create TypeScript types for all API responses
- [ ] Implement region detection in venue setup
- [ ] Add preset application to compliance profiles

### ✅ Phase 2: Advanced Features
- [ ] Build regulation comparison dashboard
- [ ] Integrate schedule validation in shift planning
- [ ] Add regional settings management for admins
- [ ] Implement error handling and user feedback

### ✅ Phase 3: Polish & Optimization
- [ ] Add loading states and progress indicators
- [ ] Implement client-side caching for frequent requests
- [ ] Add comprehensive error messages and recovery
- [ ] Optimize for mobile devices

## Error Handling

```typescript
// utils/errorHandling.ts
export const handleComplianceError = (error: any) => {
  if (error.response?.status === 400) {
    // Validation errors
    return {
      type: 'validation',
      message: 'Please check your input and try again',
      details: error.response.data.errors
    };
  } else if (error.response?.status === 500) {
    // Server errors
    return {
      type: 'server',
      message: 'Server error - please try again later',
      details: error.response.data.message
    };
  } else {
    // Network errors
    return {
      type: 'network',
      message: 'Network error - please check your connection',
      details: null
    };
  }
};
```

## Testing Examples

```typescript
// __tests__/regionalCompliance.test.ts
import { RegionalComplianceService } from '../services/regionalComplianceService';

describe('Regional Compliance Service', () => {
  it('should detect region from venue', async () => {
    const response = await RegionalComplianceService.detectRegion({
      venue_id: 123
    });

    expect(response.data.region_code).toBeTruthy();
    expect(response.data.confidence_score).toBeGreaterThan(0);
  });

  it('should validate schedule correctly', async () => {
    const shifts = [
      {
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T17:00:00Z',
        role: 'security_guard',
        break_minutes: 30
      }
    ];

    const response = await RegionalComplianceService.validateSchedule({
      user_id: 123,
      shifts
    });

    expect(response.data.is_compliant).toBeDefined();
    expect(response.data.violations).toBeInstanceOf(Array);
  });
});
```

## Performance Tips

1. **Cache regulation data** client-side for 5 minutes
2. **Debounce schedule validation** during real-time editing
3. **Use lazy loading** for comparison matrices
4. **Implement progressive disclosure** for detailed settings
5. **Batch API calls** when possible for better performance

The Regional Compliance API is production-ready and fully documented. All endpoints are optimized for performance and include comprehensive error handling. The frontend integration should be straightforward using the provided examples and TypeScript types.