# Regional Compliance API Documentation

## Overview

The Regional Compliance API provides comprehensive endpoints for managing compliance across different jurisdictions and regions. This system handles region detection, preset application, regulation comparison, schedule validation, and regional settings management.

**Base URL**: `/api/compliance/regional/`

**Authentication**: All endpoints require authentication via JWT token.

---

## Endpoints

### 1. Region Detection

**Endpoint**: `GET /api/compliance/regional/detect-region/`

**Purpose**: Auto-detect the applicable region based on venue coordinates, GPS coordinates, or IP address.

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `venue_id` | integer | No* | Venue ID for location-based detection |
| `lat` | decimal | No* | Latitude for coordinates-based detection |
| `lng` | decimal | No* | Longitude for coordinates-based detection |
| `ip_address` | string | No* | IP address for IP-based detection |

*At least one detection method must be provided

#### Response

```json
{
  "status": "success",
  "data": {
    "region_code": "UK",
    "country_code": "GB",
    "confidence_score": 0.95,
    "detection_method": "venue",
    "regulation_id": 1,
    "notes": "Detected from venue: London Office"
  }
}
```

#### Detection Methods

1. **Venue-based** (highest confidence: 0.95)
   - Uses venue coordinates and address information
   - Most accurate for established venues

2. **Coordinates-based** (high confidence: 0.9)
   - Uses GPS coordinates for geographical detection
   - Accurate within country boundaries

3. **IP-based** (medium confidence: 0.6)
   - Uses IP geolocation services
   - Less accurate, affected by VPNs and proxies

4. **Fallback** (low confidence: 0.5)
   - Defaults to UK regulations when other methods fail
   - Requires manual verification

#### Region Codes

- **UK**: United Kingdom
- **US-{STATE}**: United States with state code (e.g., `US-CA`, `US-NY`)
- **EU-{COUNTRY}**: European Union countries (e.g., `EU-FR`, `EU-DE`)

#### Example Usage

```bash
# Detect region by venue
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/compliance/regional/detect-region/?venue_id=123"

# Detect region by coordinates
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/compliance/regional/detect-region/?lat=51.5074&lng=-0.1278"

# Detect region by IP
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/compliance/regional/detect-region/?ip_address=8.8.8.8"
```

---

### 2. Apply Regional Preset

**Endpoint**: `POST /api/compliance/regional/profiles/apply-preset/`

**Purpose**: Apply regional compliance presets to a user's compliance profile.

#### Request Body

```json
{
  "region_code": "UK",
  "profile_id": 123,
  "override_existing": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `region_code` | string | Yes | Region code to apply |
| `profile_id` | integer | Yes | Compliance profile ID |
| `override_existing` | boolean | No | Override existing custom settings (default: false) |

#### Response

```json
{
  "status": "success",
  "data": {
    "success": true,
    "profile_id": 123,
    "region_code": "UK",
    "applied_settings": {
      "max_daily_hours": 12.0,
      "max_weekly_hours": 48.0,
      "min_rest_hours": 11.0,
      "sia_license_required": true,
      "opt_out_provisions": {
        "enabled": true,
        "notice_period_days": 7
      }
    },
    "warnings": [
      "Working time directive opt-out requires written agreement"
    ]
  }
}
```

#### Regional Presets

##### UK Preset
- Maximum daily hours: 12
- Maximum weekly hours: 48
- Minimum rest: 11 hours
- SIA license required: Yes
- Working time opt-out: Available
- Break requirements: 20min after 6h, 30min after 8h

##### US Preset
- Maximum daily hours: 24 (varies by state)
- Maximum weekly hours: 168
- Overtime threshold: 40 hours
- Overtime multiplier: 1.5x
- FLSA compliance: Yes
- State-specific variations applied

##### EU Preset
- Working Time Directive compliance
- Maximum weekly hours: 48
- Minimum rest: 11 hours
- Break requirements: Country-specific
- Annual leave minimums: 20 days

#### Example Usage

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"region_code": "UK", "profile_id": 123, "override_existing": true}' \
  "https://api.example.com/api/compliance/regional/profiles/apply-preset/"
```

---

### 3. Compare Regulations

**Endpoint**: `GET /api/compliance/regional/compare/`

**Purpose**: Compare working hours regulations across multiple regions.

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regions[]` | array | Yes | List of region codes to compare (2-10 regions) |
| `include_sia_requirements` | boolean | No | Include SIA licensing comparison (default: true) |
| `include_break_rules` | boolean | No | Include break requirements (default: true) |
| `include_overtime` | boolean | No | Include overtime calculations (default: true) |

#### Response

```json
{
  "status": "success",
  "data": {
    "comparison_matrix": {
      "UK": {
        "standard_weekly_hours": 48.0,
        "max_daily_hours": 12.0,
        "max_weekly_hours": 48.0,
        "min_rest_hours": 11.0,
        "break_duration_minutes": 20,
        "break_trigger_hours": 6.0,
        "detailed_break_rules": {
          "6_hours": {"duration_minutes": 20, "paid": false},
          "8_hours": {"duration_minutes": 30, "paid": false}
        }
      },
      "US": {
        "standard_weekly_hours": 40.0,
        "max_daily_hours": 24.0,
        "max_weekly_hours": 168.0,
        "min_rest_hours": 8.0,
        "overtime_threshold": 40.0,
        "overtime_multiplier": 1.5
      }
    },
    "key_differences": [
      "Standard weekly hours vary significantly: 40-48 hours",
      "Maximum daily hours differ: 12-24 hours",
      "Overtime regulations not consistent across all regions"
    ],
    "sia_requirements": {
      "UK": {
        "sia_license_required": true,
        "license_types": ["door_supervisor", "security_guard", "cctv_operator"]
      }
    },
    "opt_out_provisions": {
      "UK": {
        "enabled": true,
        "notice_period_days": 7,
        "written_agreement_required": true
      }
    },
    "generated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Example Usage

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/compliance/regional/compare/?regions[]=UK&regions[]=US&regions[]=EU-FR&include_sia_requirements=true"
```

---

### 4. Schedule Validation

**Endpoint**: `POST /api/compliance/regional/validate-schedule/`

**Purpose**: Pre-validate shift schedules against regional compliance rules.

#### Request Body

```json
{
  "user_id": 123,
  "shifts": [
    {
      "start": "2024-01-15T09:00:00Z",
      "end": "2024-01-15T17:00:00Z",
      "role": "security_guard",
      "break_minutes": 30
    },
    {
      "start": "2024-01-16T09:00:00Z",
      "end": "2024-01-16T17:00:00Z",
      "role": "security_guard",
      "break_minutes": 30
    }
  ],
  "venue_id": 456,
  "validation_date": "2024-01-15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | integer | Yes | Staff member ID |
| `shifts` | array | Yes | List of shift objects |
| `venue_id` | integer | No | Venue for location-based rules |
| `validation_date` | date | No | Date to validate against (default: today) |

#### Shift Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start` | datetime | Yes | Shift start time (ISO 8601) |
| `end` | datetime | Yes | Shift end time (ISO 8601) |
| `role` | string | Yes | Job role/position |
| `break_minutes` | integer | No | Scheduled break time in minutes |

#### Response

```json
{
  "status": "success",
  "data": {
    "is_compliant": false,
    "violations": [
      {
        "type": "max_daily_hours_exceeded",
        "shift_index": 0,
        "message": "Shift 1 duration (14.0h) exceeds daily limit (12.0h)",
        "severity": "high",
        "shift_data": {...}
      },
      {
        "type": "insufficient_break",
        "shift_index": 0,
        "message": "Shift 1 requires 30 minute break",
        "severity": "medium",
        "shift_data": {...}
      }
    ],
    "warnings": [
      "Schedule includes 8.0 hours of overtime"
    ],
    "total_hours": 56.0,
    "overtime_hours": 8.0,
    "regulation_applied": "United Kingdom (GB)"
  }
}
```

#### Validation Rules

##### Daily Limits
- Maximum daily hours check
- Minimum rest period between shifts
- Break requirements based on shift length

##### Weekly Limits
- Maximum weekly hours
- Overtime calculation and warnings
- Consecutive days worked

##### Regional Specific
- **UK**: SIA license validation, working time opt-out
- **US**: FLSA overtime rules, state-specific limits
- **EU**: Working Time Directive compliance

#### Violation Types

| Type | Severity | Description |
|------|----------|-------------|
| `max_daily_hours_exceeded` | High | Shift exceeds daily hour limit |
| `max_weekly_hours_exceeded` | High | Total hours exceed weekly limit |
| `insufficient_break` | Medium | Break time below required minimum |
| `insufficient_rest` | High | Rest period between shifts too short |
| `sia_license_required` | Critical | Valid SIA license required (UK) |
| `invalid_shift_data` | High | Malformed or missing shift data |

#### Example Usage

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123, "shifts": [...], "venue_id": 456}' \
  "https://api.example.com/api/compliance/regional/validate-schedule/"
```

---

### 5. Regional Settings Management

**Endpoint**: `GET|POST|PUT /api/compliance/regional/regional-settings/`

**Purpose**: Manage venue-specific and staff-specific regional compliance overrides.

#### GET - Retrieve Settings

**Parameters:**
- `venue_id` (optional): Venue ID for venue-level settings
- `staff_id` (optional): Staff ID for individual overrides
- `region_code` (optional): Region code filter

#### POST - Create Settings

**Request Body:**
```json
{
  "venue_id": 123,
  "region_code": "UK",
  "max_daily_hours_override": 10.0,
  "max_weekly_hours_override": 45.0,
  "break_requirements_override": {
    "6_hours": {"duration_minutes": 25, "paid": true}
  },
  "sia_license_required": true,
  "custom_rules": {
    "special_event_rules": {
      "max_consecutive_days": 10
    }
  }
}
```

#### PUT - Update Settings

**Request Body:** Same as POST

#### Response

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "venue_id": 123,
    "region_code": "UK",
    "effective_settings": {
      "max_daily_hours": 10.0,
      "max_weekly_hours": 45.0,
      "sia_license_required": true,
      "break_requirements": {
        "6_hours": {"duration_minutes": 25, "paid": true},
        "8_hours": {"duration_minutes": 30, "paid": false}
      }
    },
    "inheritance_chain": [
      "Global",
      "Regional",
      "Venue",
      "Staff"
    ],
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Settings Inheritance

The system supports four levels of settings inheritance:

1. **Global**: System-wide defaults
2. **Regional**: Country/region-specific rules
3. **Venue**: Venue-specific overrides
4. **Staff**: Individual staff overrides

Each level can override settings from higher levels, with staff-level settings having the highest priority.

---

## Error Handling

### Standard Error Response

```json
{
  "status": "error",
  "message": "Brief error description",
  "errors": {
    "field_name": ["Detailed error message"]
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

### Common Error Scenarios

#### Region Detection
- **400**: No detection method provided
- **500**: Geocoding service unavailable

#### Preset Application
- **400**: Invalid region code or profile ID
- **404**: Profile not found
- **500**: Regulation not found for region

#### Schedule Validation
- **400**: Invalid shift data structure
- **404**: User not found
- **500**: Missing compliance profile

#### Settings Management
- **400**: Invalid settings data
- **403**: Insufficient permissions to modify settings
- **404**: Settings record not found

---

## Rate Limiting

All endpoints are subject to rate limiting:
- **Authenticated users**: 1000 requests per hour
- **Region detection**: 100 requests per hour (due to external service costs)
- **Schedule validation**: 200 requests per hour (computation intensive)

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642694400
```

---

## Caching

The API implements intelligent caching to improve performance:

### Cache Keys and TTL

| Data Type | Cache Duration | Notes |
|-----------|----------------|-------|
| Region detection (IP-based) | 1 hour | IP geolocation results |
| Working hours regulations | 5 minutes | Regulation data |
| Venue coordinates | 24 hours | Venue location data |
| Bulk regulation comparisons | 15 minutes | Comparison matrices |

### Cache Headers

Responses include cache-related headers:
```
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: Mon, 15 Jan 2024 10:30:00 GMT
```

---

## Security Considerations

### Authentication
- JWT tokens required for all endpoints
- Token expiration: 1 hour (refresh tokens: 7 days)
- Role-based access control enforced

### Data Privacy
- IP addresses are hashed for geolocation caching
- Sensitive compliance data encrypted at rest
- GDPR compliance for EU operations

### Input Validation
- All input parameters validated against schemas
- SQL injection protection via parameterized queries
- XSS prevention through output encoding

---

## Integration Examples

### Frontend Integration

```javascript
// Region detection
const detectRegion = async (venueId) => {
  const response = await fetch(`/api/compliance/regional/detect-region/?venue_id=${venueId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Apply regional preset
const applyPreset = async (regionCode, profileId) => {
  const response = await fetch('/api/compliance/regional/profiles/apply-preset/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      region_code: regionCode,
      profile_id: profileId,
      override_existing: true
    })
  });
  return response.json();
};

// Validate schedule
const validateSchedule = async (userId, shifts) => {
  const response = await fetch('/api/compliance/regional/validate-schedule/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      shifts: shifts
    })
  });
  return response.json();
};
```

### Backend Integration

```python
import requests

class ComplianceClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {'Authorization': f'Bearer {token}'}

    def detect_region(self, venue_id=None, lat=None, lng=None, ip_address=None):
        params = {}
        if venue_id:
            params['venue_id'] = venue_id
        if lat and lng:
            params['lat'] = lat
            params['lng'] = lng
        if ip_address:
            params['ip_address'] = ip_address

        response = requests.get(
            f'{self.base_url}/api/compliance/regional/detect-region/',
            params=params,
            headers=self.headers
        )
        return response.json()

    def validate_schedule(self, user_id, shifts, venue_id=None):
        data = {
            'user_id': user_id,
            'shifts': shifts
        }
        if venue_id:
            data['venue_id'] = venue_id

        response = requests.post(
            f'{self.base_url}/api/compliance/regional/validate-schedule/',
            json=data,
            headers=self.headers
        )
        return response.json()
```

---

## Performance Optimization

### Database Optimization
- GIN indexes on JSON fields for fast queries
- Optimized QuerySets with select_related and prefetch_related
- Database connection pooling

### Response Optimization
- Gzip compression enabled
- JSON response minification
- Pagination for large datasets

### Monitoring
- API response time monitoring
- Error rate tracking
- Cache hit ratio metrics

---

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release of Regional Compliance API
- Region detection with multiple methods
- Regional preset application
- Multi-region regulation comparison
- Schedule validation with regional rules
- Regional settings management with inheritance

### Planned Features
- Advanced IP geolocation integration
- Machine learning-based compliance predictions
- Webhook notifications for compliance violations
- Bulk schedule validation endpoints
- Mobile-optimized endpoints

---

For technical support or feature requests, please contact the API development team.