# Research: Onboarding Process and Admin2 Account Issues

**Date**: 2025-01-26 01:30:20 BST
**Researcher**: Claude Code
**Repository**: remix2

## Research Question
Full report on how the onboarding process works after user registration, investigation of issues with existing company accounts (specifically the admin2 account), and analysis of multi-tenant conversion impact on existing accounts.

## Summary
The system has a comprehensive 5-step onboarding process for multi-tenant functionality, but **existing accounts like admin2 are blocked due to missing UserCompanyMembership records** after the multi-tenant conversion. The onboarding system expects all users to be associated with a company, but existing users were not migrated to this new structure.

## Detailed Findings

### Onboarding Process Architecture

**Frontend Components (`frontend/src/components/onboarding/`)**
- **OnboardingWizard.tsx**: Main 5-step wizard with sophisticated state management
- **Step Components**: CompanyInfoStep, RegionalComplianceStep, StaffOperationsStep, IntegrationsSetupStep, AccountFinalizationStep
- **OnboardingGuard.tsx**: Route protection that redirects incomplete users to onboarding
- **Progress tracking**: Real-time progress with localStorage persistence

**Backend API (`backend/api/views.py:4870+`)**
- **8 REST endpoints**: `/api/v1/onboarding/*` covering all wizard steps
- **Models**: SecurityCompany, CompanyOnboarding, CompanyIntegration, UserCompanyMembership
- **Permission system**: Custom IsCompanyOwnerOrAdmin with multi-tenant data isolation

### Multi-Tenant Architecture Impact

**Core Issue: Missing Migration Strategy**
- System converted to multi-tenant but existing users lack `UserCompanyMembership` records
- `TenantMiddleware` sets `request.current_company = None` for existing users
- Onboarding API endpoints fail without company context
- Creates impossible loop: users need company to complete onboarding, but need onboarding to get company

**Files Affected:**
- `backend/api/middleware/tenant_middleware.py`: Enforces company context
- `backend/api/migrations/0028_create_security_company.py`: Created multi-tenant models without user migration
- `backend/api/models.py`: SecurityCompany and UserCompanyMembership models

### Admin2 Account Specific Issues

**Current State:**
- Admin2 exists in User table but has no UserCompanyMembership record
- Cannot access main application due to OnboardingGuard protection
- Gets stuck in onboarding first step because company creation requires existing company context (circular dependency)
- Authentication works but tenant middleware blocks further access

**Expected Behavior:**
- Existing admin accounts should be automatically associated with a default company
- Should bypass onboarding or be guided through a simplified migration flow
- Should retain access to existing data (venues, shifts, staff)

### Onboarding Flow Documentation

**5-Step Process:**
1. **Company Info**: Basic company registration and details
2. **Regional Compliance**: Auto-configuration based on location
3. **Staff Operations**: Capacity planning and operational setup
4. **Integrations**: Deputy, accounting, and payroll system connections
5. **Account Finalization**: Admin users, security, and billing

**First Step Failure Points:**
- Network connectivity during API calls
- Missing required fields (company name, registration number)
- Backend validation failures
- Company context not available (existing user issue)
- Data transformation errors between frontend/backend models

**Route Protection Logic:**
```
Login → AuthContext checks onboarding_completed →
If incomplete: OnboardingGuard redirects to /onboarding/step-X →
If complete: Access main dashboard
```

## Code References

- `frontend/src/components/OnboardingGuard.tsx` - Route protection logic
- `backend/api/models.py:26-120` - Multi-tenant company models
- `backend/api/views.py:4870+` - Onboarding API endpoints
- `backend/api/middleware/tenant_middleware.py` - Company context enforcement
- `frontend/src/components/onboarding/OnboardingWizard.tsx` - Main wizard component
- `backend/api/migrations/0028_create_security_company.py` - Multi-tenant migration

## Architecture Documentation

**Multi-Tenant Design:**
- UUID-based company identification
- Middleware-enforced data isolation
- User-company relationships with role-based permissions
- Complete separation of company data (venues, shifts, staff)

**Onboarding Integration:**
- Seamless integration with existing authentication system
- Progressive loading with lazy component imports
- LocalStorage persistence for incomplete sessions
- Real-time validation with comprehensive error handling

## Root Cause Analysis

The conversion to multi-tenant architecture created a **critical gap**: existing users were not migrated to the new company-based structure. The system now requires:

1. Every user must have UserCompanyMembership record(s)
2. All API calls require company context via middleware
3. Onboarding process expects company association

But existing users like admin2 have:
- Valid User account ✓
- No UserCompanyMembership record ✗
- No company context ✗
- Cannot complete onboarding ✗

## Immediate Solution Required

**Migration Command Needed:**
```bash
# Create default company for existing users
python manage.py migrate_existing_users
```

This should:
1. Create a default "Mead Security" company
2. Add admin2 as company owner with full permissions
3. Migrate existing data (venues, shifts) to the company
4. Mark onboarding as completed for existing users

## Impact Assessment

**Affected Users:** All existing users (not just admin2)
**Business Impact:** Complete application access blocked for existing accounts
**Data Impact:** No data loss, but data is inaccessible without company context
**Urgency:** Critical - blocks all existing user access

## Testing Validation

After implementing migration:
1. Admin2 should login successfully
2. Should bypass onboarding (marked as completed)
3. Should access main dashboard with existing data
4. Should see all previously created venues, shifts, staff
5. New users should still go through full onboarding process

## Follow-up Recommendations

1. **Implement user migration strategy** for all existing accounts
2. **Add diagnostic tools** to identify affected users
3. **Create rollback procedures** for migration safety
4. **Update documentation** to include migration steps for deployments
5. **Add monitoring** to detect similar issues in future conversions