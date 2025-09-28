---
date: 2025-09-28T16:16:40+0000
researcher: Claude Code
git_commit: 62ab32eb5beb79ea1117d0eca19e52f1674a2c94
branch: main
repository: remix2
topic: "Multi-tenant recruitment application conversion 500 error"
tags: [research, codebase, recruitment, multi-tenant, bug-analysis, onboarding]
status: complete
last_updated: 2025-09-28
last_updated_by: Claude Code
---

# Research: Multi-tenant Recruitment Application Conversion 500 Error

**Date**: 2025-09-28T16:16:40+0000
**Researcher**: Claude Code
**Git Commit**: 62ab32eb5beb79ea1117d0eca19e52f1674a2c94
**Branch**: main
**Repository**: remix2

## Research Question

User reported that after converting the system to multi-tenant architecture, the recruitment application conversion process is failing with a 500 error. The recruitment flow works fine (applications are submitted and approved), but when converting approved applications to user accounts, the system crashes with the error:

```
:8000/api/v1/recruitment-applications/7/convert-to-user/:1  Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

Previously, before multi-tenant conversion, the conversion worked correctly and would create user accounts with login credentials for staff onboarding.

## Summary

**Root Cause**: The recruitment application `convert_to_user` method creates users and staff profiles but fails to establish the required multi-tenant relationships (`UserCompanyMembership` and employment type associations) that were introduced during the multi-tenant architecture conversion.

**Impact**: Critical bug preventing recruitment workflow completion - approved candidates cannot be converted to system users for onboarding.

**Fix Required**: Update the `RecruitmentApplication.convert_to_user()` method to create proper multi-tenant relationships and improve error handling.

## Detailed Findings

### Component 1: Convert-to-User Endpoint Implementation

**Location**: `backend/api/views.py:2742-2755`

```python
@action(detail=True, methods=['post'], url_path='convert-to-user')
def convert_to_user(self, request, pk=None):
    """Convert approved application to user account"""
    application = self.get_object()

    try:
        user = application.convert_to_user(request.user)
        return Response({
            'message': 'Application converted to user account successfully',
            'user': UserSerializer(user).data,
            'application': RecruitmentApplicationSerializer(application).data
        })
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
```

**Issues Found**:
- Only catches `ValueError` exceptions
- Any other exception results in unhandled 500 error
- No logging for debugging conversion failures

### Component 2: RecruitmentApplication Model Convert Method

**Location**: `backend/api/models.py:2902-2985`

**Critical Missing Elements**:

1. **Missing Employment Type Assignment**:
```python
# Current (broken) code:
staff_profile = StaffProfile.objects.create(
    user=user,
    phone_number=self.phone_number,
    # ❌ employment_type=self.employment_type is MISSING
)

# Required fix:
staff_profile = StaffProfile.objects.create(
    user=user,
    employment_type=self.employment_type,  # ✅ Required for company relationship
    phone_number=self.phone_number,
    # ... other fields
)
```

2. **Missing UserCompanyMembership Creation**:
```python
# ❌ MISSING: Company membership creation
UserCompanyMembership.objects.create(
    user=user,
    company=self.employment_type.company,
    role='staff',
    is_active=True,
    joined_at=timezone.now()
)
```

### Component 3: Multi-Tenant Architecture Requirements

**Company Context Chain**:
- `RecruitmentApplication` → `employment_type` → `EmploymentType.company` → `SecurityCompany`
- `User` → `UserCompanyMembership` → `SecurityCompany`
- `StaffProfile` → `employment_type` → `EmploymentType.company` → `SecurityCompany`

**Migration Timeline**:
- **0028** (Sept 25): Core multi-tenant models introduced
- **0029** (Sept 27): Added company fields to `EmploymentType` and `SystemSettings`
- **0030-0031** (Sept 28): Added company slug support for recruitment URLs

### Component 4: Permission and Filtering System

**Company-Based Access Control**: `backend/api/views.py:97-128`
```python
class IsCompanyOwnerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        memberships = user.company_memberships.filter(
            is_active=True,
            role__in=['owner', 'admin']
        )
        return memberships.exists()  # ❌ Fails for users without memberships
```

**TenantMiddleware Company Context**: Determines company context via:
1. HTTP header `X-Company-ID`
2. URL parameter `company_id`
3. JSON body `company_id`
4. User's primary company (requires `UserCompanyMembership`)

## Code References

- `backend/api/models.py:2902-2985` - `RecruitmentApplication.convert_to_user()` method implementation
- `backend/api/views.py:2742-2755` - Convert-to-user endpoint in `RecruitmentApplicationViewSet`
- `frontend/src/pages/admin/RecruitmentManagement.tsx:182-197` - Frontend conversion handler
- `frontend/src/services/recruitmentService.ts:154-157` - Frontend API service call
- `backend/api/models.py:97-128` - `IsCompanyOwnerOrAdmin` permission class
- `backend/api/migrations/0029_add_company_fields_to_settings_and_employment_types.py` - Company field additions
- `backend/api/migrations/0030_add_company_slug_field.py` - Company slug implementation
- `backend/api/migrations/0031_populate_company_slugs.py` - Company slug population

## Architecture Insights

### Multi-Tenant Data Isolation Pattern
The system uses a "shared database, shared schema" multi-tenancy pattern where:
- All tenants share the same database and tables
- Data isolation achieved through `company` foreign key filtering
- Row-level security enforced via `UserCompanyMembership` relationships
- Company context determined by middleware and passed through request lifecycle

### Permission Layer Architecture
```
Request → TenantMiddleware → Permission Classes → ViewSet → Model Methods
     ↓         ↓                ↓                ↓          ↓
   Company   Company        Check User       Filter by   Business
   Context   Resolution     Membership       Company     Logic
```

### Recruitment Flow Company Association
```
CompanySlug → SecurityCompany → EmploymentType → RecruitmentApplication
     ↓              ↓              ↓                    ↓
  URL Routing   Company Context  Job Posting        Application
   Resolution    Validation      Company-Specific    Submission
```

## Historical Context (from thoughts/)

Based on git history and migration files, the multi-tenant conversion was a recent major architectural change that:

1. **Successfully migrated** core models and relationships
2. **Added proper company isolation** for venues, employment types, and settings
3. **Implemented company-scoped APIs** with slug-based routing
4. **Failed to update** the recruitment conversion process to work with new architecture

## Related Research

This issue is related to ongoing multi-tenant implementation work and may connect to:
- User onboarding flow modifications
- Company setup and migration processes
- Permission system enhancements
- API endpoint company-scoping work

## Open Questions

1. **Migration Status**: Have existing users been migrated to the multi-tenant system via the `migrate_existing_users` command?

2. **Company Assignment Logic**: Should recruitment applications have direct company relationships, or continue using the indirect `employment_type.company` relationship?

3. **Error Handling Strategy**: What level of error detail should be exposed to frontend vs. logged for debugging?

4. **Batch Operations**: Are there other user creation workflows that need similar multi-tenant fixes?

## Recommended Immediate Fix

### 1. Update RecruitmentApplication.convert_to_user() Method

```python
def convert_to_user(self, admin_user):
    """Convert approved application to a User and StaffProfile"""
    if self.status != 'approved':
        raise ValueError("Only approved applications can be converted to users")

    if self.converted_to_user:
        raise ValueError("Application has already been converted to a user")

    # Get company from employment type
    company = self.employment_type.company
    if not company or not company.is_active:
        raise ValueError("Employment type has no active company associated")

    # Generate username and validate uniqueness
    base_username = self.email.split('@')[0].lower()
    username = base_username
    counter = 1

    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    try:
        # Create user
        user = User.objects.create_user(
            username=username,
            email=self.email,
            first_name=self.full_name.split()[0],
            last_name=' '.join(self.full_name.split()[1:]) if len(self.full_name.split()) > 1 else '',
            role='staff'
        )

        # ✅ FIX: Create staff profile with employment type
        staff_profile = StaffProfile.objects.create(
            user=user,
            employment_type=self.employment_type,  # ✅ Added this line
            phone_number=self.phone_number,
            home_address=self.home_address,
            postcode=self.postcode,
            date_of_birth=self.date_of_birth,
            eligible_to_work_uk=self.eligible_to_work_uk,
            has_criminal_convictions=self.has_criminal_convictions,
            criminal_convictions_details=self.criminal_convictions_details,
            has_security_experience=self.has_security_experience,
            security_experience_details=self.security_experience_details,
            willing_to_travel=self.willing_to_travel,
            has_transport=self.has_transport,
            has_commitments=self.has_commitments,
            commitments_details=self.commitments_details,
            availability_days=self.availability_days,
            availability_nights=self.availability_nights,
            availability_weekends=self.availability_weekends,
            availability_holidays=self.availability_holidays,
            hours_per_week=self.hours_per_week,
            ni_number='',  # Will be filled during onboarding
            bank_account_name='',  # Will be filled during onboarding
            bank_account_number='',  # Will be filled during onboarding
            bank_sort_code='',  # Will be filled during onboarding
            created_by=admin_user
        )

        # ✅ FIX: Create UserCompanyMembership
        UserCompanyMembership.objects.create(
            user=user,
            company=company,
            role='staff',
            is_owner=False,
            is_active=True,
            invited_by=admin_user,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        # Create SIA license if applicable
        if self.has_sia_licence and self.sia_licence_number:
            SIALicense.objects.create(
                staff_profile=staff_profile,
                license_number=self.sia_licence_number,
                license_types=self.licence_types,
                expiry_date=self.licence_expiry_date,
                is_suspended_revoked=self.licence_suspended_revoked,
                suspension_details=self.licence_suspension_details if self.licence_suspended_revoked else None,
                created_by=admin_user
            )

        # Create security qualifications from certifications
        for cert in self.certifications:
            if cert and cert != 'other':  # Skip empty or 'other' certifications
                SecurityQualification.objects.create(
                    staff_profile=staff_profile,
                    qualification_type=cert,
                    details=self.other_certification_details if cert == 'other' else None,
                    created_by=admin_user
                )

        # Link the converted user
        self.converted_to_user = user
        self.save()

        return user

    except Exception as e:
        # Clean up on failure
        if 'user' in locals():
            user.delete()
        raise ValueError(f"Failed to convert application to user: {str(e)}")
```

### 2. Improve Endpoint Error Handling

```python
@action(detail=True, methods=['post'], url_path='convert-to-user')
def convert_to_user(self, request, pk=None):
    """Convert approved application to user account"""
    application = self.get_object()

    try:
        user = application.convert_to_user(request.user)
        return Response({
            'message': 'Application converted to user account successfully',
            'user': UserSerializer(user).data,
            'application': RecruitmentApplicationSerializer(application).data
        })
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error converting application {pk} to user: {str(e)}", exc_info=True)
        return Response(
            {'error': 'Internal error during conversion. Please try again or contact support.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

This fix addresses the core issue by ensuring new users have proper multi-tenant relationships established during the conversion process.