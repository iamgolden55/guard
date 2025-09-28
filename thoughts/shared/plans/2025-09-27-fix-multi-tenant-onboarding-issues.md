# Multi-Tenant Onboarding Issues Fix Implementation Plan

## Overview

Fix critical issues in the multi-tenant onboarding flow that prevent new users from registering and completing company setup. Through comprehensive browser testing with Playwright, we identified that while user registration works perfectly, the onboarding flow has three critical issues: permission restrictions blocking progress tracking, missing company data in API calls, and missing company memberships for existing users.

## Current State Analysis

**What Works:**
- User registration: `POST /api/v1/users/` → 201 Created ✅
- Authentication: JWT token management and login ✅
- Onboarding UI: Form validation and user experience ✅

**What's Broken:**
1. **Permission Issue (403 Forbidden)**: `GET /api/v1/onboarding/progress/` blocked by `IsCompanyOwnerOrAdmin` permission
2. **Data Issue (400 Bad Request)**: `POST /api/v1/onboarding/initiate/` receives empty data instead of company information
3. **Migration Issue**: Existing users like admin2 lack `UserCompanyMembership` records from pre-conversion

### Key Discoveries:
- **Permission Classes**: `IsCompanyOwnerOrAdmin` blocks access for users without company memberships (`backend/api/views.py:97-128`)
- **Bootstrap Gap**: Only `initiate_onboarding` has relaxed permissions, but `get_progress` doesn't (`backend/api/views.py:4870-4887`)
- **Frontend Data Issue**: `initiateOnboarding()` sends empty POST request instead of company data (`frontend/src/services/onboardingService.ts:21-29`)
- **Migration Tool Available**: `migrate_existing_users.py` command exists but wasn't executed

## Desired End State

After this plan is complete:
- ✅ New users can register and complete full 5-step onboarding without errors
- ✅ Existing users can access their accounts and complete any missing onboarding steps
- ✅ Permission system allows onboarding progress tracking for users without company memberships
- ✅ Frontend sends complete company data to backend during onboarding initiation
- ✅ All users have proper `UserCompanyMembership` records for multi-tenant access

**Verification**: A new user can register at `/register`, fill out UK SIA company details, and complete all 5 onboarding steps without 403 or 400 errors.

## What We're NOT Doing

- Redesigning the multi-tenant architecture (it's sound)
- Changing the 5-step onboarding flow structure
- Modifying authentication or JWT token management
- Touching the database schema or model relationships
- Changing the permission inheritance hierarchy

## Implementation Approach

Fix the three critical issues in order of dependency: permissions first (blocks testing), data flow second (blocks completion), then migration (affects existing users). Each phase includes both automated testing and manual verification to ensure the fixes work end-to-end.

## Phase 1: Fix Onboarding Permission Restrictions

### Overview
Allow authenticated users to access onboarding progress without requiring company membership, while maintaining security for other operations.

### Changes Required:

#### 1. Backend Permission Configuration
**File**: `backend/api/views.py`
**Changes**: Extend the permission override in `OnboardingViewSet.get_permissions()` to include `get_progress`

```python
def get_permissions(self):
    """
    Override permissions for specific actions.
    initiate_onboarding and get_progress only require IsAuthenticated since they handle
    users who don't have company memberships yet.
    All other actions require IsCompanyOwnerOrAdmin.
    """
    if self.action in ['initiate_onboarding', 'get_progress']:
        permission_classes = [IsAuthenticated]
    else:
        permission_classes = [IsAuthenticated, IsCompanyOwnerOrAdmin]
    return [permission() for permission in permission_classes]
```

### Success Criteria:

#### Automated Verification:
- [ ] Backend server starts without errors: `cd backend && python manage.py runserver`
- [ ] API endpoint returns 200 for authenticated users: `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/onboarding/progress/`
- [ ] Tests pass: `cd backend && python manage.py test api.tests.test_onboarding_permissions`

#### Manual Verification:
- [ ] New registered user can access `/onboarding/step/1` without 403 errors
- [ ] Browser console shows successful API call to `/api/v1/onboarding/progress/`
- [ ] No localStorage fallback warnings in browser console

---

## Phase 2: Fix Frontend Data Submission

### Overview
Update the frontend to send complete company information to the backend during onboarding initiation, matching the expected API format.

### Changes Required:

#### 1. Onboarding Service Data Flow
**File**: `frontend/src/services/onboardingService.ts`
**Changes**: Update `initiateOnboarding` method to accept and send company data

```typescript
async initiateOnboarding(companyData: CompanyInitiationData): Promise<{ sessionId: string; progress: OnboardingProgress }> {
  try {
    const response = await api.post(`${this.baseUrl}/initiate/`, {
      company: {
        name: companyData.name,
        registration_number: companyData.registrationNumber,
        country_code: this.mapCountryNameToCode(companyData.country),
        city: companyData.city,
        postal_code: companyData.postalCode,
        address_line_1: companyData.streetAddress,
        billing_email: companyData.email,
        primary_contact_name: `${companyData.firstName} ${companyData.lastName}`,
        primary_contact_email: companyData.email,
        primary_contact_phone: companyData.phoneNumber,
        industry_type: companyData.industry,
        business_type: companyData.businessType,
        founded_year: companyData.foundedYear,
        website_url: companyData.websiteUrl,
        description: companyData.description
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to initiate onboarding:', error);
    throw new Error('Failed to start onboarding process');
  }
}
```

#### 2. Type Definitions
**File**: `frontend/src/types/onboarding.ts`
**Changes**: Add interface for company initiation data

```typescript
export interface CompanyInitiationData {
  name: string;
  registrationNumber: string;
  country: string;
  city: string;
  postalCode: string;
  streetAddress: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  position: string;
  industry: string;
  businessType: string;
  foundedYear: number;
  websiteUrl?: string;
  description?: string;
}
```

#### 3. Onboarding Wizard Integration
**File**: `frontend/src/components/onboarding/OnboardingWizard.tsx`
**Changes**: Update form submission to collect and send complete company data

```typescript
const handleNext = async () => {
  if (currentStep === 1) {
    // Collect all form data for company creation
    const companyData: CompanyInitiationData = {
      name: formData.companyName,
      registrationNumber: formData.registrationNumber,
      country: formData.country,
      city: formData.city,
      postalCode: formData.postalCode,
      streetAddress: formData.streetAddress,
      email: formData.primaryContactEmail,
      firstName: formData.primaryContactFirstName,
      lastName: formData.primaryContactLastName,
      phoneNumber: formData.primaryContactPhone,
      position: formData.primaryContactPosition,
      industry: formData.industry,
      businessType: formData.businessType,
      foundedYear: formData.foundedYear,
      websiteUrl: formData.websiteUrl,
      description: formData.description
    };

    try {
      const response = await onboardingService.initiateOnboarding(companyData);
      // Continue with existing flow
    } catch (error) {
      // Handle validation errors properly
    }
  }
  // Existing step navigation logic
};
```

#### 4. Country Code Mapping Utility
**File**: `frontend/src/utils/countryMapping.ts`
**Changes**: Create utility to map country names to ISO codes

```typescript
export const mapCountryNameToCode = (countryName: string): string => {
  const countryMap: Record<string, string> = {
    'United Kingdom': 'GBR',
    'United States': 'USA',
    'Germany': 'DEU',
    'France': 'FRA',
    'Spain': 'ESP',
    'Italy': 'ITA',
    'Netherlands': 'NLD',
    'Belgium': 'BEL',
    'Ireland': 'IRL',
    'Switzerland': 'CHE',
    'Austria': 'AUT',
    'Portugal': 'PRT',
    'Denmark': 'DNK',
    'Sweden': 'SWE',
    'Norway': 'NOR',
    'Finland': 'FIN'
  };

  return countryMap[countryName] || 'GBR'; // Default to UK
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `cd frontend && npm run typecheck`
- [ ] Frontend builds successfully: `cd frontend && npm run build`
- [ ] Linting passes: `cd frontend && npm run lint`
- [ ] No console errors during build process

#### Manual Verification:
- [ ] Company creation form submits successfully with filled data
- [ ] No 400 Bad Request errors when submitting Step 1
- [ ] Browser network tab shows complete company data in POST request
- [ ] Backend creates SecurityCompany and UserCompanyMembership records
- [ ] User advances to Step 2 of onboarding successfully

---

## Phase 3: Migrate Existing Users

### Overview
Run the existing migration command to create UserCompanyMembership records for users who existed before the multi-tenant conversion.

### Changes Required:

#### 1. Database Migration Execution
**Command**: Run the existing migration command
**Location**: `backend/api/management/commands/migrate_existing_users.py`

```bash
cd backend
python manage.py migrate_existing_users --company-name="Mead Security" --dry-run
# Review results, then run for real:
python manage.py migrate_existing_users --company-name="Mead Security"
```

#### 2. Verify Migration Results
**Command**: Check that existing users now have company memberships

```bash
cd backend
python manage.py shell
>>> from api.models import User, UserCompanyMembership
>>> admin2 = User.objects.get(username='admin2')
>>> admin2.company_memberships.all()  # Should show company membership
>>> print(f"Admin2 companies: {admin2.company_memberships.count()}")
```

### Success Criteria:

#### Automated Verification:
- [ ] Migration command runs without errors: `python manage.py migrate_existing_users --dry-run`
- [ ] Database integrity checks pass: `python manage.py check`
- [ ] All existing users have company memberships: Django ORM queries confirm relationships

#### Manual Verification:
- [ ] Admin2 can log in at `/login` without onboarding redirects
- [ ] Admin2 has access to admin dashboard at `/admin/staff`
- [ ] Existing users can access their role-appropriate features
- [ ] No loss of existing data or functionality

---

## Testing Strategy

### Unit Tests:
- **Permission Tests**: Verify `get_progress` endpoint accessible with `IsAuthenticated` only
- **Serializer Tests**: Validate company data serialization with all required fields
- **Service Tests**: Test `initiateOnboarding` with complete company data structure

### Integration Tests:
- **End-to-End Registration**: Complete flow from registration through onboarding completion
- **API Tests**: Verify all onboarding endpoints work with proper data
- **Permission Tests**: Confirm company-scoped access works after membership creation

### Manual Testing Steps:
1. **New User Flow**: Register → Fill UK SIA company form → Complete all 5 onboarding steps
2. **Existing User Flow**: Login as admin2 → Verify dashboard access → Check all admin features
3. **Edge Cases**: Invalid company data → Proper validation errors displayed
4. **Cross-Browser**: Test registration flow in Chrome, Firefox, Safari
5. **Mobile Responsive**: Verify onboarding works on mobile devices

## Performance Considerations

- **Database Queries**: Migration command uses bulk operations to minimize database impact
- **API Response Time**: Company creation should complete within 3 seconds
- **Frontend Validation**: Client-side validation prevents unnecessary API calls
- **Caching**: Company data cached in browser to prevent re-entry on page refresh

## Migration Notes

### Data Handling:
- **Existing Users**: Migration preserves all existing user data and permissions
- **Company Creation**: Default company created for users without explicit company association
- **Role Assignment**: Existing admin users become owners of the default company
- **Backup**: Migration command includes rollback capability if issues occur

### Rollback Plan:
```bash
# If migration causes issues, rollback is available
cd backend
python manage.py shell
>>> from api.models import UserCompanyMembership, SecurityCompany
>>> # Remove company memberships created by migration
>>> UserCompanyMembership.objects.filter(company__name="Mead Security").delete()
>>> SecurityCompany.objects.filter(name="Mead Security").delete()
```

## References

- Original research: `thoughts/shared/research/2025-09-27-multi-tenant-onboarding-flow.md`
- Authentication fixes: `docs/verified_docs/onboarding_fix.md`
- Permission classes: `backend/api/views.py:67-128`
- Onboarding viewset: `backend/api/views.py:4870-5180`
- Frontend service: `frontend/src/services/onboardingService.ts:21-29`
- Migration command: `backend/api/management/commands/migrate_existing_users.py`