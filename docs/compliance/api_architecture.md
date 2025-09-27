# Regional Compliance API Architecture

## Overview

This document defines the comprehensive API architecture for the SSMS Regional Compliance System, designed to handle multi-jurisdictional employment compliance across UK, US, and EU regions.

## Core Design Principles

### RESTful Architecture
- Resource-oriented URLs following `/api/compliance/*` pattern
- Proper HTTP methods and status codes
- Consistent JSON response format with envelope pattern
- HATEOAS for navigation between related compliance resources

### Regional Compliance Context
- Auto-detection of applicable regulations based on venue location and IP geolocation
- Support for multiple jurisdictions with region-specific rule sets
- Flexible compliance profile system for organization-specific requirements
- Real-time validation with pre-computation for performance

### Scalability & Performance
- Horizontal scaling support through stateless API design
- Redis caching with 85%+ hit rates for compliance calculations
- Database optimization with GIN indexes for JSON field queries
- Background processing for complex compliance metric calculations

## API Base Structure

```
/api/v1/compliance/
├── regional/                    # Regional compliance management
│   ├── detect-region/          # Auto-detect applicable region
│   ├── profiles/               # Compliance profile management
│   ├── regulations/            # Working hours regulations
│   ├── compare/                # Cross-region comparison
│   └── validate-schedule/      # Pre-validation services
├── violations/                 # Compliance violation tracking
├── metrics/                    # Aggregated compliance metrics
├── approvals/                  # Approval workflow management
└── audit/                      # Audit trail and reporting
```

## Authentication & Authorization

### JWT-based Authentication
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Role-based Access Control
- **Staff**: Read own compliance data, submit schedule requests
- **Manager**: Approve violations, manage team compliance, view reports
- **Admin**: Full system access, configure regional settings, audit access

### API Key for System Integration
```http
X-API-Key: your-system-integration-key
X-Client-ID: external-system-identifier
```

## Response Format Standards

### Success Response Envelope
```json
{
  "status": "success",
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2024-01-15T10:00:00Z",
    "api_version": "1.0",
    "response_time_ms": 45,
    "cached": true,
    "cache_ttl": 3600
  },
  "links": {
    "self": "/api/v1/compliance/violations/123",
    "related": {
      "user": "/api/v1/users/456",
      "shift": "/api/v1/shifts/789"
    }
  }
}
```

### Error Response Format
```json
{
  "status": "error",
  "error": {
    "code": "COMPLIANCE_VIOLATION",
    "message": "Schedule violates working time regulations",
    "details": "Weekly hours limit exceeded by 8.5 hours",
    "field": "total_weekly_hours",
    "violation_type": "weekly_overtime",
    "regulation_reference": "UK Working Time Regulations 1998"
  },
  "meta": {
    "timestamp": "2024-01-15T10:00:00Z",
    "api_version": "1.0",
    "request_id": "req_123456789"
  }
}
```

## Regional Compliance Endpoints

### Auto-detect Region
Automatically determine applicable compliance regulations based on venue location or IP address.

**Endpoint**: `GET /api/v1/compliance/regional/detect-region/`

**Query Parameters**:
```
?venue_id=123          # Detect from venue location
?ip_address=192.168.1.1 # Detect from IP geolocation
?force_refresh=true     # Bypass cache
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "region_code": "UK",
    "country_code": "GB",
    "regulation_id": 1,
    "confidence_score": 0.95,
    "detection_method": "venue_location",
    "applicable_regulations": {
      "working_time_directive": true,
      "sia_requirements": true,
      "opt_out_available": true
    },
    "notes": "Detected from venue postcode in England"
  }
}
```

### Apply Regional Preset
Apply region-specific compliance settings to organizational profiles.

**Endpoint**: `POST /api/v1/compliance/regional/profiles/apply-preset/`

**Request Body**:
```json
{
  "region_code": "UK",
  "profile_id": 123,
  "override_existing": false,
  "apply_sia_requirements": true,
  "custom_overrides": {
    "max_daily_hours": 12.0,
    "reason": "Emergency services exemption"
  }
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "profile_id": 123,
    "applied_settings": {
      "max_daily_hours": 11.0,
      "max_weekly_hours": 48.0,
      "min_rest_hours": 11.0,
      "sia_license_required": true,
      "working_time_opt_out": true
    },
    "warnings": [
      "SIA license expiry validation enabled",
      "Working time opt-out requires employee consent"
    ],
    "changes_summary": {
      "modified_fields": 5,
      "compliance_impact": "stricter_limits",
      "estimated_cost_impact": "+15% overtime costs"
    }
  }
}
```

### Compare Regulations
Cross-jurisdictional comparison of compliance requirements.

**Endpoint**: `GET /api/v1/compliance/regional/compare/`

**Query Parameters**:
```
?regions[]=UK&regions[]=US-CA&regions[]=EU-DE
?include_sia_requirements=true
?include_break_rules=true
?include_overtime=true
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "comparison_matrix": {
      "UK": {
        "max_daily_hours": 11.0,
        "max_weekly_hours": 48.0,
        "overtime_threshold": 40.0,
        "sia_required": true
      },
      "US-CA": {
        "max_daily_hours": 12.0,
        "max_weekly_hours": 40.0,
        "overtime_threshold": 8.0,
        "sia_required": false
      }
    },
    "key_differences": [
      {
        "field": "overtime_threshold",
        "values": {"UK": 40.0, "US-CA": 8.0},
        "impact": "US-CA triggers overtime much earlier"
      }
    ],
    "recommendations": [
      "Consider separate shift templates for each region",
      "Implement region-specific approval workflows"
    ]
  }
}
```

### Schedule Pre-validation
Validate shift schedules against compliance rules before assignment.

**Endpoint**: `POST /api/v1/compliance/regional/validate-schedule/`

**Request Body**:
```json
{
  "user_id": 123,
  "proposed_shifts": [
    {
      "venue_id": 456,
      "start_time": "2024-01-15T09:00:00Z",
      "end_time": "2024-01-15T21:00:00Z",
      "shift_type": "security_guard"
    }
  ],
  "validation_options": {
    "check_weekly_limits": true,
    "check_rest_periods": true,
    "include_warnings": true,
    "region_override": "UK"
  }
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "validation_result": "warning",
    "is_compliant": true,
    "violations": [],
    "warnings": [
      {
        "type": "approaching_weekly_limit",
        "message": "This shift will bring weekly hours to 46/48 allowed",
        "severity": "info",
        "recommendation": "Monitor remaining weekly capacity"
      }
    ],
    "compliance_summary": {
      "weekly_hours_after": 46.0,
      "weekly_limit": 48.0,
      "daily_hours": 12.0,
      "rest_period_compliant": true,
      "sia_license_valid": true
    },
    "alternative_suggestions": [
      {
        "modification": "reduce_shift_by_hours",
        "hours": 2.0,
        "reason": "Stay within weekly limit comfort zone"
      }
    ]
  }
}
```

## Compliance Violation Management

### List Violations
**Endpoint**: `GET /api/v1/compliance/violations/`

**Query Parameters**:
```
?user_id=123
?severity=major
?status=open
?period_start=2024-01-01
?period_end=2024-01-31
?page=1
?limit=20
?sort=-created_at
```

### Create Violation
**Endpoint**: `POST /api/v1/compliance/violations/`

### Resolve Violation
**Endpoint**: `PATCH /api/v1/compliance/violations/{id}/resolve/`

**Request Body**:
```json
{
  "resolution_status": "approved_exception",
  "resolution_notes": "Emergency shift approved by site manager",
  "exception_reason": "Critical incident response",
  "financial_impact": 150.00
}
```

## WebSocket Events for Real-time Updates

### Connection
```javascript
ws://localhost:8000/ws/compliance/
```

### Event Types

#### Compliance Status Change
```json
{
  "type": "compliance_status_change",
  "data": {
    "user_id": 123,
    "previous_status": "compliant",
    "new_status": "warning",
    "trigger": "new_shift_scheduled",
    "violation_type": "approaching_weekly_limit",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### Regulation Update
```json
{
  "type": "regulation_update",
  "data": {
    "region_code": "UK",
    "regulation_id": 1,
    "changes": ["max_daily_hours", "break_requirements"],
    "effective_date": "2024-02-01T00:00:00Z",
    "impact_assessment": {
      "affected_users": 150,
      "requires_revalidation": true
    }
  }
}
```

## Caching Strategy

### Cache Layers
1. **Redis L1 Cache**: Hot compliance data (TTL: 1 hour)
2. **Database Query Cache**: Complex aggregations (TTL: 30 minutes)
3. **CDN Edge Cache**: Static regulation content (TTL: 24 hours)

### Cache Keys
```
compliance:region:UK:regulations
compliance:user:123:weekly_hours:2024-W03
compliance:violations:unresolved:venue:456
compliance:comparison:UK,US-CA,EU-DE
```

### Cache Invalidation
- Automatic invalidation on compliance profile changes
- Event-driven invalidation for regulation updates
- Background refresh for frequently accessed data

## Rate Limiting

### Limits by User Role
- **Staff**: 1000 requests/hour, 100 requests/minute
- **Manager**: 5000 requests/hour, 500 requests/minute  
- **Admin**: 10000 requests/hour, 1000 requests/minute
- **System Integration**: 50000 requests/hour, 5000 requests/minute

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642089600
X-RateLimit-Retry-After: 3600
```

## Error Codes Reference

### Compliance-Specific Error Codes
- `COMP_001`: Weekly hours limit exceeded
- `COMP_002`: Daily hours limit exceeded  
- `COMP_003`: Insufficient rest period
- `COMP_004`: SIA license expired or missing
- `COMP_005`: Regulation not found for region
- `COMP_006`: Invalid compliance profile configuration
- `COMP_007`: Shift validation failed
- `COMP_008`: Violation resolution not permitted
- `COMP_009`: Regional preset application failed
- `COMP_010`: Cross-region conflict detected

### HTTP Status Code Mapping
- `200 OK`: Successful compliance check
- `201 Created`: Violation record created
- `400 Bad Request`: Invalid compliance data
- `403 Forbidden`: Insufficient permissions for compliance action
- `409 Conflict`: Compliance rule conflict
- `422 Unprocessable Entity`: Validation failed
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Compliance calculation error

## Performance Targets

### Response Time SLAs
- **Cached Compliance Data**: <100ms (95th percentile)
- **Real-time Validation**: <500ms (95th percentile)
- **Complex Comparisons**: <2000ms (95th percentile)
- **Report Generation**: <5000ms (95th percentile)

### Availability Targets
- **API Uptime**: 99.9% (8.76 hours downtime/year)
- **Cache Hit Rate**: >85% for compliance queries
- **Database Query Time**: <50ms average

## Security Architecture

### Data Encryption
- **At Rest**: AES-256 encryption for sensitive compliance data
- **In Transit**: TLS 1.3 for all API communications
- **PII Protection**: Field-level encryption for personal identifiers

### GDPR Compliance
- **Data Minimization**: Store only required compliance fields
- **Right to be Forgotten**: Compliance data anonymization
- **Data Portability**: Export compliance history in standard format
- **Consent Management**: Track opt-out consents and preferences

### Audit Requirements
- **Complete Audit Trail**: All compliance decisions logged
- **Regulatory Inspection**: Immutable compliance records
- **Data Lineage**: Track data sources for compliance calculations
- **Change History**: Version control for regulation updates

## Integration Patterns

### Frontend React Integration
```typescript
// Compliance hook for real-time validation
const useComplianceValidation = (userId: number) => {
  const [status, setStatus] = useState<ComplianceStatus>('compliant');
  const [violations, setViolations] = useState<Violation[]>([]);
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/compliance/`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'compliance_status_change' && data.data.user_id === userId) {
        setStatus(data.data.new_status);
      }
    };
    return () => ws.close();
  }, [userId]);
  
  return { status, violations };
};
```

### Backend Service Integration
```python
# Compliance validation service
class ComplianceValidationService:
    def validate_shift_schedule(self, user_id, shifts, region_code=None):
        """Validate shift schedule against compliance rules"""
        # Auto-detect region if not provided
        if not region_code:
            region_code = self.detect_region(user_id)
        
        # Get applicable regulations
        regulation = self.get_regulation(region_code)
        
        # Validate against rules
        violations = []
        for shift in shifts:
            violations.extend(self.validate_shift(shift, regulation))
        
        return ComplianceValidationResult(
            is_compliant=len(violations) == 0,
            violations=violations,
            region_code=region_code
        )
```

## Future Extensibility

### Microservice Decomposition
- **Compliance Engine**: Core validation logic
- **Region Service**: Geographic detection and regulation management  
- **Notification Service**: Real-time compliance alerts
- **Analytics Service**: Compliance reporting and metrics

### API Versioning Strategy
- **URL Versioning**: `/api/v2/compliance/`
- **Header Versioning**: `Accept: application/vnd.ssms.v2+json`
- **Backward Compatibility**: Support N-1 API versions
- **Deprecation Process**: 6-month notice for breaking changes

### Machine Learning Integration
- **Predictive Compliance**: ML models for violation prediction
- **Anomaly Detection**: Identify unusual compliance patterns
- **Optimization Suggestions**: AI-powered schedule optimization
- **Risk Scoring**: Predictive compliance risk assessment

## Monitoring & Observability

### Key Metrics
- **Compliance Validation Rate**: Validations per minute
- **Violation Detection Rate**: New violations per hour
- **Resolution Time**: Average time to resolve violations
- **Regional Coverage**: Active regions and regulation coverage
- **Cache Performance**: Hit rates and response times

### Alerting
- **High Violation Rate**: >10% of shifts generating violations
- **Regulation Update**: New regulations requiring system updates
- **Performance Degradation**: Response times >SLA targets
- **Security Events**: Unauthorized compliance data access

This architecture provides a robust, scalable foundation for multi-jurisdictional compliance management while maintaining performance, security, and extensibility requirements.