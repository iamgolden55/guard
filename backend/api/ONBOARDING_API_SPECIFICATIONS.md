# Onboarding API Specifications

This document outlines the detailed API specifications for the Security Firm Onboarding System that will be implemented once the backend models are ready.

## Authentication & Permissions

All onboarding endpoints require JWT authentication. Company-specific permissions will be enforced:

- `IsAuthenticated` - Basic authentication required
- `IsCompanyOwner` - User must be the owner of the company being onboarded
- `IsCompanyMember` - User must be a member of the company

## Base URL Structure

All onboarding endpoints will be under `/api/v1/onboarding/` and `/api/v1/companies/`

## API Endpoints

### 1. POST /api/v1/onboarding/initiate/

**Purpose**: Start the onboarding process for a new security company

**Authentication**: JWT Required
**Permissions**: IsAuthenticated
**Method**: POST

**Request Body**:
```json
{
  "company_name": "Secure Solutions Ltd",
  "registration_number": "SC123456",
  "owner_email": "admin@securesolutions.com",
  "country_code": "GB"
}
```

**Response** (201 Created):
```json
{
  "onboarding_id": "uuid-here",
  "company_id": "uuid-here",
  "current_step": 1,
  "total_steps": 5,
  "completed_steps": [],
  "next_action": "complete_company_info",
  "estimated_time_remaining": 8,
  "company_data": {
    "name": "Secure Solutions Ltd",
    "registration_number": "SC123456",
    "country_code": "GB",
    "created_at": "2025-01-25T00:00:00Z"
  }
}
```

### 2. GET /api/v1/onboarding/progress/

**Purpose**: Get current onboarding progress for user's company

**Authentication**: JWT Required
**Permissions**: IsAuthenticated, IsCompanyOwner
**Method**: GET

**Response** (200 OK):
```json
{
  "onboarding_id": "uuid-here",
  "company_id": "uuid-here",
  "current_step": 3,
  "total_steps": 5,
  "completed_steps": ["company_info", "regional_setup"],
  "next_action": "configure_staff_operations",
  "estimated_time_remaining": 3,
  "step_details": {
    "company_info": {
      "completed": true,
      "completed_at": "2025-01-25T01:00:00Z"
    },
    "regional_setup": {
      "completed": true,
      "completed_at": "2025-01-25T01:15:00Z"
    },
    "staff_configuration": {
      "completed": false,
      "required_fields": ["expected_staff_size", "operation_hours", "shift_patterns"]
    },
    "integrations": {
      "completed": false,
      "optional": true
    },
    "finalization": {
      "completed": false
    }
  }
}
```

### 3. PUT /api/v1/onboarding/company-info/

**Purpose**: Update company information step

**Authentication**: JWT Required
**Permissions**: IsAuthenticated, IsCompanyOwner
**Method**: PUT

**Request Body**:
```json
{
  "company_name": "Secure Solutions Ltd",
  "registration_number": "SC123456",
  "industry": "Security Services",
  "address": {
    "street": "123 Security Street",
    "city": "London",
    "postcode": "SW1A 1AA",
    "country": "GB"
  },
  "phone": "+44 20 1234 5678",
  "website": "https://securesolutions.com",
  "company_size": "medium",
  "established_year": 2020,
  "specializations": ["door_supervision", "event_security", "retail_security"]
}
```

**Response** (200 OK):
```json
{
  "message": "Company information updated successfully",
  "current_step": 2,
  "next_action": "configure_regional_compliance",
  "company_data": {
    "id": "uuid-here",
    "name": "Secure Solutions Ltd",
    "registration_number": "SC123456",
    "industry": "Security Services",
    "address": { /* address object */ },
    "phone": "+44 20 1234 5678",
    "website": "https://securesolutions.com",
    "specializations": ["door_supervision", "event_security", "retail_security"],
    "updated_at": "2025-01-25T01:00:00Z"
  }
}
```

### 4. PUT /api/v1/onboarding/regional-setup/

**Purpose**: Configure regional compliance settings

**Authentication**: JWT Required
**Permissions**: IsAuthenticated, IsCompanyOwner
**Method**: PUT

**Request Body**:
```json
{
  "country_code": "GB",
  "compliance_profile": "uk_sia_standard",
  "regulatory_requirements": {
    "sia_licensing": true,
    "working_time_directive": true,
    "opt_out_available": true,
    "night_work_restrictions": true
  },
  "required_licenses": ["sia_door_supervisor", "sia_security_guard"],
  "local_regulations": {
    "scotland": {
      "additional_requirements": ["fire_safety_awareness"]
    }
  },
  "working_patterns": {
    "max_weekly_hours": 48,
    "max_daily_hours": 12,
    "min_rest_between_shifts": 11,
    "night_shift_definition": "22:00-06:00"
  }
}
```

**Response** (200 OK):
```json
{
  "message": "Regional compliance configured successfully",
  "current_step": 3,
  "next_action": "configure_staff_operations",
  "compliance_profile": {
    "id": "uuid-here",
    "name": "UK SIA Standard",
    "country_code": "GB",
    "regulatory_framework": "UK Working Time Directive + SIA Requirements",
    "configured_at": "2025-01-25T01:15:00Z"
  }
}
```

### 5. PUT /api/v1/onboarding/staff-configuration/

**Purpose**: Configure staff size and operations

**Authentication**: JWT Required
**Permissions**: IsAuthenticated, IsCompanyOwner
**Method**: PUT

**Request Body**:
```json
{
  "expected_staff_size": 25,
  "current_staff_count": 12,
  "operation_hours": {
    "monday": {"start": "08:00", "end": "22:00"},
    "tuesday": {"start": "08:00", "end": "22:00"},
    "wednesday": {"start": "08:00", "end": "22:00"},
    "thursday": {"start": "08:00", "end": "22:00"},
    "friday": {"start": "08:00", "end": "02:00"},
    "saturday": {"start": "10:00", "end": "02:00"},
    "sunday": {"start": "12:00", "end": "20:00"}
  },
  "shift_patterns": ["day_shift", "evening_shift", "night_shift"],
  "staff_roles": ["door_supervisor", "security_guard", "cctv_operator"],
  "venues_managed": 8,
  "average_shifts_per_week": 150
}
```

**Response** (200 OK):
```json
{
  "message": "Staff configuration updated successfully",
  "current_step": 4,
  "next_action": "setup_integrations",
  "staff_configuration": {
    "expected_staff_size": 25,
    "subscription_tier": "professional",
    "recommended_features": ["shift_scheduling", "compliance_monitoring", "payroll_integration"],
    "configured_at": "2025-01-25T01:30:00Z"
  }
}
```

### 6. PUT /api/v1/onboarding/integrations/

**Purpose**: Setup third-party integrations (optional step)

**Authentication**: JWT Required
**Permissions**: IsAuthenticated, IsCompanyOwner
**Method**: PUT

**Request Body**:
```json
{
  "deputy_integration": {
    "enabled": true,
    "api_key": "deputy-api-key-here",
    "endpoint": "https://api.deputy.com",
    "sync_employees": true,
    "sync_timesheets": true
  },
  "payroll_integration": {
    "provider": "sage",
    "enabled": true,
    "configuration": {
      "api_key": "sage-api-key",
      "company_id": "sage-company-id"
    }
  },
  "notification_settings": {
    "email_alerts": true,
    "sms_alerts": false,
    "webhook_url": "https://securesolutions.com/webhooks/shifts"
  }
}
```

**Response** (200 OK):
```json
{
  "message": "Integrations configured successfully",
  "current_step": 5,
  "next_action": "complete_onboarding",
  "integrations": {
    "deputy": {
      "status": "configured",
      "test_connection": "success",
      "last_sync": null
    },
    "payroll": {
      "status": "configured",
      "provider": "sage",
      "test_connection": "success"
    }
  }
}
```

### 7. POST /api/v1/onboarding/complete/

**Purpose**: Complete the onboarding process

**Authentication**: JWT Required
**Permissions**: IsAuthenticated, IsCompanyOwner
**Method**: POST

**Request Body**:
```json
{
  "terms_accepted": true,
  "privacy_policy_accepted": true,
  "data_processing_consent": true
}
```

**Response** (200 OK):
```json
{
  "message": "Onboarding completed successfully",
  "company": {
    "id": "uuid-here",
    "name": "Secure Solutions Ltd",
    "status": "active",
    "subscription_tier": "professional",
    "onboarded_at": "2025-01-25T02:00:00Z"
  },
  "user_context": {
    "role": "company_owner",
    "permissions": ["manage_staff", "manage_shifts", "view_reports", "manage_integrations"],
    "company_access": ["uuid-here"]
  },
  "next_steps": [
    "Add your first staff members",
    "Create venue locations",
    "Set up shift templates",
    "Configure payroll settings"
  ]
}
```

### 8. GET /api/v1/companies/current/

**Purpose**: Get current user's company context

**Authentication**: JWT Required
**Permissions**: IsAuthenticated
**Method**: GET

**Response** (200 OK):
```json
{
  "company": {
    "id": "uuid-here",
    "name": "Secure Solutions Ltd",
    "registration_number": "SC123456",
    "country_code": "GB",
    "status": "active",
    "subscription_tier": "professional",
    "created_at": "2025-01-25T00:00:00Z"
  },
  "user_role": "company_owner",
  "permissions": [
    "manage_staff",
    "manage_shifts",
    "view_reports",
    "manage_integrations",
    "manage_billing"
  ],
  "subscription": {
    "tier": "professional",
    "billing_cycle": "monthly",
    "next_billing_date": "2025-02-25T00:00:00Z",
    "features": [
      "unlimited_staff",
      "compliance_monitoring",
      "advanced_reporting",
      "api_access"
    ]
  },
  "limits": {
    "staff_count": 25,
    "max_staff": 100,
    "venues_count": 8,
    "max_venues": 50,
    "api_calls_per_hour": 1000
  }
}
```

## Error Responses

All endpoints will return consistent error responses:

### 400 Bad Request
```json
{
  "error": "validation_failed",
  "message": "Request data validation failed",
  "details": {
    "company_name": ["This field is required"],
    "registration_number": ["Registration number already exists"]
  }
}
```

### 401 Unauthorized
```json
{
  "error": "authentication_required",
  "message": "Valid authentication credentials required"
}
```

### 403 Forbidden
```json
{
  "error": "permission_denied",
  "message": "You do not have permission to perform this action",
  "required_permission": "company_owner"
}
```

### 404 Not Found
```json
{
  "error": "not_found",
  "message": "Onboarding session not found or has expired"
}
```

### 409 Conflict
```json
{
  "error": "conflict",
  "message": "Company with this registration number already exists"
}
```

## Serializers to Implement

### SecurityCompanySerializer
- Fields: id, name, registration_number, country_code, compliance_profile, staff_capacity, subscription_tier
- Validation: Unique registration_number, valid country_code, positive staff_capacity

### OnboardingProgressSerializer
- Fields: currentStep, totalSteps, completedSteps, companyData, nextAction, estimatedTimeRemaining
- Read-only serializer for progress tracking

### CompanyInfoSerializer
- Fields: name, registration_number, industry, address, phone, website, company_size, established_year, specializations
- Validation: Required fields, format validation, business registration checks

### RegionalSetupSerializer
- Fields: country_code, compliance_profile, regulatory_requirements, required_licenses, local_regulations, working_patterns
- Validation: Valid country_code, compliance profile exists, required licenses for region

### StaffConfigSerializer
- Fields: expected_staff_size, current_staff_count, operation_hours, shift_patterns, staff_roles, venues_managed
- Validation: Positive staff size, valid operation hours, valid shift patterns

### IntegrationsSerializer
- Fields: deputy_integration, payroll_integration, notification_settings
- Validation: Valid API keys, test connections, proper configuration format

## Multi-Tenant Considerations

1. **Company Context Middleware**: Automatically add company context to all requests
2. **Data Isolation**: Ensure all queries are scoped to the user's company
3. **Permission Classes**: Custom permission classes for company ownership and membership
4. **URL Patterns**: Company-scoped URLs where appropriate
5. **Caching Strategy**: Company-specific caching keys

## Integration with Existing System

1. **User Model Extension**: Add company relationship to existing User model
2. **Existing Endpoints**: Update all existing ViewSets to filter by company
3. **Migration Strategy**: Provide migration path for existing single-tenant data
4. **Backward Compatibility**: Ensure existing functionality continues to work

## Testing Strategy

1. **Unit Tests**: Test each endpoint individually
2. **Integration Tests**: Test complete onboarding flow
3. **Permission Tests**: Verify company-level access controls
4. **Edge Cases**: Test incomplete onboarding, invalid data, etc.
5. **Performance Tests**: Verify response times under load

This specification will be implemented once the required models are available from django-backend-expert.