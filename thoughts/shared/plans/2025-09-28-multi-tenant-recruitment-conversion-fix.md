# Multi-Tenant Recruitment Conversion Bug Fix Implementation Plan

## Overview

This plan addresses a critical bug in the recruitment application conversion process where approved recruitment applications fail to convert to user accounts with a 500 error after the system was converted to multi-tenant architecture. The core issue is that the `convert_to_user` method creates users and staff profiles but fails to establish the required multi-tenant relationships (`UserCompanyMembership` and employment type associations).

## Current State Analysis

### Root Cause
The `RecruitmentApplication.convert_to_user()` method at `backend/api/models.py:2902-2985` creates users and staff profiles but has two critical missing components:

1. **Missing Employment Type Assignment**: Staff profiles are created without the `employment_type` field
2. **Missing UserCompanyMembership Creation**: No company membership is established for converted users

### Impact
- Critical bug preventing recruitment workflow completion
- Approved candidates cannot be converted to system users for onboarding
- 500 errors expose internal implementation details to frontend users
- Multi-tenant access control fails for converted users

### Key Discoveries
- `UserCompanyMembership` model at `backend/api/models.py:303-424` requires unique `['user', 'company']` constraint
- Company relationship chain: `RecruitmentApplication → employment_type → EmploymentType.company → SecurityCompany`
- Middleware at `backend/api/middleware/tenant_middleware.py` requires active company memberships for access control
- Recent migrations (0028-0031) successfully added company fields but conversion process wasn't updated

## Desired End State

After this fix is complete:
- Approved recruitment applications convert successfully to user accounts
- Converted users have proper multi-tenant relationships established
- Error handling provides meaningful feedback without exposing internal details
- All created relationships maintain data integrity through proper transaction handling

### Verification
- Recruitment conversion endpoint returns 200 success responses
- Converted users can log in and access company-scoped resources
- UserCompanyMembership records exist for all converted users
- Staff profiles have correct employment type associations

## What We're NOT Doing

- Migrating existing data (no recruitment applications are currently stuck in conversion)
- Changing the overall recruitment application workflow
- Modifying the multi-tenant architecture design
- Adding new API endpoints or changing endpoint URLs
- Batch conversion of multiple applications
- Changing the company association method (keeping `employment_type.company` chain)

## Implementation Approach

This fix requires updating the core conversion method and improving error handling while maintaining transaction safety and data integrity. The approach preserves existing patterns and follows established codebase conventions.

## Phase 1: Core Conversion Method Fix

### Overview
Update the `RecruitmentApplication.convert_to_user()` method to create proper multi-tenant relationships and improve error handling.

### Changes Required

#### 1. Update RecruitmentApplication Model
**File**: `backend/api/models.py`
**Changes**: Replace the existing `convert_to_user` method (lines 2902-2985) with multi-tenant aware implementation

```python
def convert_to_user(self, admin_user):
    """Convert approved application to a User and StaffProfile with proper multi-tenant relationships"""
    # Validation checks
    if self.status != 'approved':
        raise ValueError("Only approved applications can be converted to users")

    if self.converted_to_user:
        raise ValueError("Application has already been converted to a user")

    # Get company from employment type with validation
    if not self.employment_type:
        raise ValueError("Application has no employment type assigned")

    company = self.employment_type.company
    if not company or not company.is_active:
        raise ValueError("Employment type has no active company associated")

    # Generate unique username
    base_username = self.email.split('@')[0].lower()
    username = base_username
    counter = 1

    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    # Check for email conflicts
    if User.objects.filter(email=self.email).exists():
        raise ValueError(f"A user with email {self.email} already exists")

    try:
        with transaction.atomic():
            # Create user
            user = User.objects.create_user(
                username=username,
                email=self.email,
                first_name=self.full_name.split()[0] if self.full_name else '',
                last_name=' '.join(self.full_name.split()[1:]) if len(self.full_name.split()) > 1 else '',
                role='staff'
            )

            # Create staff profile with employment type
            staff_profile = StaffProfile.objects.create(
                user=user,
                employment_type=self.employment_type,  # FIX: Added employment type
                phone_number=self.phone_number,
                date_of_birth=self.date_of_birth,
                national_insurance_number=None,  # Will be filled during onboarding
                street=self.home_address,
                city='',  # Will need to be filled later
                postal_code=self.postcode,
                country='UK',
                is_approved=True  # Pre-approved since application was approved
            )

            # FIX: Create UserCompanyMembership for multi-tenant access
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

            # Create SIA License if applicable (existing logic with fixes)
            if self.has_sia_licence and self.sia_licence_number:
                licence_type_mapping = {
                    'door_supervisor': 'ds',
                    'security_guard': 'sg',
                    'cctv': 'cctv',
                    'close_protection': 'cp',
                    'dog_handler': 'k9',
                    'vehicle_security': 'vs',
                    'key_holding': 'key'
                }

                for licence_type in self.licence_types:
                    short_licence_type = licence_type_mapping.get(licence_type, licence_type)

                    SIALicense.objects.create(
                        staff_profile=staff_profile,
                        license_number=self.sia_licence_number,
                        license_type=short_licence_type,
                        issue_date=timezone.now().date(),
                        expiry_date=self.licence_expiry_date,
                        status='valid',
                        document_url=''
                    )

            # Create qualifications (existing logic)
            for cert in self.certifications:
                if cert and cert != 'other':
                    SecurityQualification.objects.create(
                        staff_profile=staff_profile,
                        qualification_type=cert,
                        provider='Unknown',
                        certificate_number='',
                        issue_date=timezone.now().date(),
                        document_url=''
                    )

            # Link the converted user
            self.converted_to_user = user
            self.save()

            return user

    except Exception as e:
        # Transaction will automatically rollback
        logger.error(f"Failed to convert recruitment application {self.id} to user: {str(e)}", exc_info=True)
        raise ValueError(f"Failed to convert application to user: {str(e)}")
```

### Success Criteria

#### Automated Verification:
- [ ] Migration applies cleanly: `cd backend && python manage.py migrate`
- [ ] Unit tests pass: `cd backend && python manage.py test api.tests.test_recruitment_conversion`
- [ ] Type checking passes: `cd frontend && npm run typecheck`
- [ ] Linting passes: `cd backend && flake8 api/models.py`
- [ ] Integration tests pass: `cd backend && python manage.py test api.tests.test_integration`

#### Manual Verification:
- [ ] Recruitment conversion works end-to-end via admin interface
- [ ] Converted users can log in successfully
- [ ] Converted users see company-scoped data correctly
- [ ] UserCompanyMembership records exist for converted users
- [ ] Staff profiles have correct employment type associations

---

## Phase 2: Enhanced Error Handling

### Overview
Improve API endpoint error handling to provide meaningful feedback while protecting internal implementation details.

### Changes Required

#### 1. Update Recruitment ViewSet
**File**: `backend/api/views.py`
**Changes**: Enhance the `convert_to_user` action method (lines 2742-2755)

```python
@action(detail=True, methods=['post'], url_path='convert-to-user')
def convert_to_user(self, request, pk=None):
    """Convert approved application to user account with enhanced error handling"""
    application = self.get_object()

    try:
        user = application.convert_to_user(request.user)

        # Log successful conversion
        logger.info(f"Successfully converted recruitment application {pk} to user {user.id} by {request.user.username}")

        return Response({
            'message': 'Application converted to user account successfully',
            'user': UserSerializer(user).data,
            'application': RecruitmentApplicationSerializer(application).data
        })

    except ValueError as e:
        # Business logic errors - safe to expose
        logger.warning(f"Conversion validation failed for application {pk}: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

    except IntegrityError as e:
        # Database constraint violations
        logger.error(f"Database integrity error converting application {pk}: {str(e)}", exc_info=True)
        return Response({
            'error': 'Data conflict during conversion. Please check for duplicate users.'
        }, status=status.HTTP_409_CONFLICT)

    except Exception as e:
        # Unexpected errors - log details but return generic message
        logger.error(f"Unexpected error converting application {pk} to user: {str(e)}", exc_info=True)
        return Response({
            'error': 'Internal error during conversion. Please try again or contact support.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### Success Criteria

#### Automated Verification:
- [ ] API tests pass: `cd backend && python manage.py test api.tests.test_recruitment_api`
- [ ] Error response formats match expected schemas
- [ ] Logging statements execute without errors

#### Manual Verification:
- [ ] 400 errors provide helpful validation messages
- [ ] 500 errors don't expose internal details
- [ ] All error scenarios log appropriate details for debugging

---

## Phase 3: Comprehensive Testing

### Overview
Add comprehensive test coverage for the conversion process including multi-tenant scenarios, error conditions, and data integrity.

### Changes Required

#### 1. Model Method Tests
**File**: `backend/api/tests/test_recruitment_conversion.py` (new file)
**Changes**: Add comprehensive test coverage

```python
from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from api.models import (
    RecruitmentApplication, SecurityCompany, UserCompanyMembership,
    EmploymentType, StaffProfile, SIALicense
)
from django.utils import timezone


class RecruitmentConversionModelTest(TransactionTestCase):
    """Test RecruitmentApplication.convert_to_user method"""

    def setUp(self):
        """Set up test data"""
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@company.com',
            password='testpass123',
            role='admin'
        )

        self.company = SecurityCompany.objects.create(
            name='Test Security Company',
            registration_number='TSC123456',
            country_code='GBR',
            business_email='business@testsecurity.com',
            business_phone='+44 20 1234 5678',
            is_active=True,
            created_by=self.admin_user
        )

        # Create admin membership
        UserCompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company,
            role='admin',
            is_owner=True,
            is_active=True
        )

        self.employment_type = EmploymentType.objects.create(
            name='Contract Workers',
            description='Contracted security staff',
            company=self.company,
            is_active=True
        )

        self.application = RecruitmentApplication.objects.create(
            full_name='John Doe',
            email='john.doe@example.com',
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Test Street',
            postcode='TE1 1ST',
            employment_type=self.employment_type,
            status='approved',
            has_sia_licence=True,
            sia_licence_number='SIA123456789',
            licence_types=['door_supervisor', 'security_guard'],
            licence_expiry_date='2025-12-31',
            certifications=['first_aid', 'conflict_resolution']
        )

    def test_successful_conversion_creates_all_relationships(self):
        """Test that successful conversion creates user, staff profile, and company membership"""
        user = self.application.convert_to_user(self.admin_user)

        # Check user was created correctly
        self.assertIsNotNone(user)
        self.assertEqual(user.email, 'john.doe@example.com')
        self.assertEqual(user.role, 'staff')
        self.assertTrue(user.username.startswith('john.doe'))

        # Check staff profile was created with employment type
        staff_profile = StaffProfile.objects.get(user=user)
        self.assertEqual(staff_profile.employment_type, self.employment_type)
        self.assertEqual(staff_profile.phone_number, '+44 7123 456789')
        self.assertTrue(staff_profile.is_approved)

        # Check company membership was created
        membership = UserCompanyMembership.objects.get(user=user, company=self.company)
        self.assertEqual(membership.role, 'staff')
        self.assertFalse(membership.is_owner)
        self.assertTrue(membership.is_active)
        self.assertEqual(membership.invited_by, self.admin_user)

        # Check SIA licenses were created
        sia_licenses = SIALicense.objects.filter(staff_profile=staff_profile)
        self.assertEqual(sia_licenses.count(), 2)

        # Check application was marked as converted
        self.application.refresh_from_db()
        self.assertEqual(self.application.converted_to_user, user)

    def test_unapproved_application_conversion_fails(self):
        """Test that unapproved applications cannot be converted"""
        self.application.status = 'pending'
        self.application.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("Only approved applications can be converted", str(context.exception))

    def test_duplicate_conversion_fails(self):
        """Test that applications cannot be converted twice"""
        # First conversion should work
        user = self.application.convert_to_user(self.admin_user)
        self.assertIsNotNone(user)

        # Second conversion should fail
        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("already been converted", str(context.exception))

    def test_duplicate_email_conversion_fails(self):
        """Test that conversion fails if email already exists"""
        # Create existing user with same email
        User.objects.create_user(
            username='existing',
            email='john.doe@example.com',
            password='testpass123'
        )

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("already exists", str(context.exception))

    def test_username_conflict_resolution(self):
        """Test that username conflicts are resolved automatically"""
        # Create user with conflicting username
        User.objects.create_user(
            username='john.doe',
            email='other@example.com',
            password='testpass123'
        )

        user = self.application.convert_to_user(self.admin_user)

        # Should get alternative username
        self.assertNotEqual(user.username, 'john.doe')
        self.assertTrue(user.username.startswith('john.doe'))

    def test_inactive_company_conversion_fails(self):
        """Test that conversion fails if company is inactive"""
        self.company.is_active = False
        self.company.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("no active company", str(context.exception))

    def test_conversion_transaction_rollback(self):
        """Test that failed conversions don't leave partial data"""
        from unittest.mock import patch

        # Mock UserCompanyMembership.objects.create to fail
        with patch('api.models.UserCompanyMembership.objects.create', side_effect=Exception("Membership creation failed")):
            with self.assertRaises(ValueError):
                self.application.convert_to_user(self.admin_user)

        # Verify no partial data was created
        self.assertFalse(User.objects.filter(email='john.doe@example.com').exists())
        self.assertFalse(StaffProfile.objects.filter(user__email='john.doe@example.com').exists())
        self.application.refresh_from_db()
        self.assertIsNone(self.application.converted_to_user)
```

#### 2. API Endpoint Tests
**File**: `backend/api/tests/test_recruitment_api.py` (new file)
**Changes**: Add API-level testing for conversion endpoint

```python
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth.models import User
from api.models import RecruitmentApplication, SecurityCompany, UserCompanyMembership, EmploymentType


class RecruitmentConversionAPITest(APITestCase):
    """Test recruitment application conversion API endpoint"""

    def setUp(self):
        """Set up test data and authentication"""
        self.client = APIClient()

        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@company.com',
            password='testpass123',
            role='admin'
        )

        self.company = SecurityCompany.objects.create(
            name='Test Security Company',
            registration_number='TSC123456',
            country_code='GBR',
            business_email='business@testsecurity.com',
            business_phone='+44 20 1234 5678',
            is_active=True,
            created_by=self.admin_user
        )

        UserCompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company,
            role='admin',
            is_owner=True,
            is_active=True
        )

        self.employment_type = EmploymentType.objects.create(
            name='Contract Workers',
            description='Contracted security staff',
            company=self.company,
            is_active=True
        )

        self.application = RecruitmentApplication.objects.create(
            full_name='Jane Smith',
            email='jane.smith@example.com',
            date_of_birth='1992-03-15',
            phone_number='+44 7987 654321',
            home_address='456 Test Avenue',
            postcode='TE2 2ST',
            employment_type=self.employment_type,
            status='approved'
        )

    def authenticate_as_admin(self):
        """Authenticate as company admin"""
        self.client.force_authenticate(user=self.admin_user)

    def test_successful_conversion_api(self):
        """Test successful application conversion via API"""
        self.authenticate_as_admin()

        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('application', response.data)
        self.assertIn('message', response.data)

        # Verify user was created with proper relationships
        user_id = response.data['user']['id']
        user = User.objects.get(id=user_id)

        # Check company membership exists
        membership = UserCompanyMembership.objects.get(user=user, company=self.company)
        self.assertEqual(membership.role, 'staff')
        self.assertTrue(membership.is_active)

    def test_unapproved_application_conversion_error(self):
        """Test API error for unapproved application conversion"""
        self.application.status = 'pending'
        self.application.save()

        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('approved', response.data['error'])

    def test_unauthenticated_conversion_fails(self):
        """Test that unauthenticated users cannot convert applications"""
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_company_conversion_security(self):
        """Test that users cannot convert applications from other companies"""
        # Create another company and admin
        other_company = SecurityCompany.objects.create(
            name='Other Security Company',
            registration_number='OSC789012',
            country_code='GBR',
            business_email='business@othersecurity.com',
            business_phone='+44 20 9876 5432',
            is_active=True,
            created_by=self.admin_user
        )

        other_admin = User.objects.create_user(
            username='other_admin',
            email='admin@othersecurity.com',
            password='testpass123',
            role='admin'
        )

        UserCompanyMembership.objects.create(
            user=other_admin,
            company=other_company,
            role='admin',
            is_owner=True,
            is_active=True
        )

        # Try to convert application from different company
        self.client.force_authenticate(user=other_admin)
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        # Should not find the application (filtered by company)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
```

### Success Criteria

#### Automated Verification:
- [ ] All unit tests pass: `cd backend && python manage.py test api.tests.test_recruitment_conversion`
- [ ] All API tests pass: `cd backend && python manage.py test api.tests.test_recruitment_api`
- [ ] Test coverage exceeds 90% for conversion methods: `cd backend && coverage run --source='.' manage.py test && coverage report`
- [ ] Integration tests pass: `cd backend && python manage.py test api.tests.test_integration`

#### Manual Verification:
- [ ] Tests cover all error conditions identified in the research
- [ ] Transaction rollback tests verify data integrity
- [ ] Multi-tenant security tests prevent cross-company access
- [ ] Performance is acceptable with realistic test data

---

## Phase 4: Migration Considerations and Documentation

### Overview
Ensure no existing data needs migration and document the fix for future reference.

### Changes Required

#### 1. Data Migration Verification
**File**: `backend/api/management/commands/verify_recruitment_data.py` (new file)
**Changes**: Create verification command to check for any existing conversion issues

```python
from django.core.management.base import BaseCommand
from api.models import RecruitmentApplication, User, UserCompanyMembership


class Command(BaseCommand):
    help = 'Verify recruitment application conversion data integrity'

    def handle(self, *args, **options):
        """Check for any data inconsistencies from the conversion bug"""

        # Check for converted applications without company memberships
        orphaned_conversions = RecruitmentApplication.objects.filter(
            converted_to_user__isnull=False
        ).exclude(
            converted_to_user__company_memberships__isnull=False
        )

        if orphaned_conversions.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Found {orphaned_conversions.count()} converted users without company memberships"
                )
            )
            for app in orphaned_conversions:
                self.stdout.write(f"  - Application {app.id}: {app.converted_to_user.email}")
        else:
            self.stdout.write(
                self.style.SUCCESS("No orphaned conversions found")
            )

        # Check for users without employment types
        users_without_employment = User.objects.filter(
            role='staff',
            profile__employment_type__isnull=True
        )

        if users_without_employment.exists():
            self.stdout.write(
                self.style.WARNING(
                    f"Found {users_without_employment.count()} staff users without employment types"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS("All staff users have employment types")
            )

        self.stdout.write(
            self.style.SUCCESS("Data verification complete")
        )
```

#### 2. Update Documentation
**File**: `docs/recruitment_conversion_fix.md` (new file)
**Changes**: Document the fix and prevention measures

```markdown
# Recruitment Conversion Multi-Tenant Fix

## Problem Summary
After converting the system to multi-tenant architecture, recruitment application conversion was failing because the `convert_to_user` method wasn't creating required multi-tenant relationships.

## Solution Implemented
1. Updated `RecruitmentApplication.convert_to_user()` to create `UserCompanyMembership` records
2. Added employment type assignment to staff profiles during conversion
3. Enhanced error handling with proper logging and user-friendly messages
4. Added comprehensive test coverage for multi-tenant scenarios

## Prevention Measures
- Always test user creation workflows after architecture changes
- Include multi-tenant relationship verification in CI/CD pipeline
- Monitor conversion success rates in production
- Regular data integrity checks via management commands

## Related Files
- `backend/api/models.py` - Core conversion method
- `backend/api/views.py` - API endpoint error handling
- `backend/api/tests/test_recruitment_conversion.py` - Test coverage
- `backend/api/management/commands/verify_recruitment_data.py` - Data verification

## Testing
Run the full test suite to verify the fix:
```bash
cd backend
python manage.py test api.tests.test_recruitment_conversion
python manage.py test api.tests.test_recruitment_api
python manage.py verify_recruitment_data
```
```

### Success Criteria

#### Automated Verification:
- [ ] Data verification command runs without errors: `cd backend && python manage.py verify_recruitment_data`
- [ ] No orphaned conversion data found
- [ ] Documentation is clear and actionable

#### Manual Verification:
- [ ] Fix is properly documented for future reference
- [ ] Prevention measures are established
- [ ] Team understands the root cause and solution

---

## Testing Strategy

### Unit Tests
- Model method functionality with proper multi-tenant context
- Error conditions and validation edge cases
- Username and email conflict resolution
- Transaction rollback scenarios

### Integration Tests
- End-to-end conversion workflow via API
- Multi-tenant security and access control
- Company context validation
- Error response formats and logging

### Manual Testing Steps
1. **Happy Path Testing**:
   - Create recruitment application via frontend
   - Approve application as admin
   - Convert to user via admin interface
   - Verify user can log in and access company data

2. **Error Condition Testing**:
   - Try to convert unapproved application
   - Try to convert already converted application
   - Try conversion with duplicate email
   - Verify meaningful error messages

3. **Multi-Tenant Security Testing**:
   - Create applications in different companies
   - Verify cross-company conversion prevention
   - Test company context isolation

4. **Data Integrity Testing**:
   - Verify all relationships are created correctly
   - Test transaction rollback on errors
   - Confirm no orphaned data after failures

## Performance Considerations

The fix adds minimal overhead:
- One additional database insert (`UserCompanyMembership`)
- Transaction wrapper for atomicity
- Enhanced validation checks

All changes maintain the existing O(1) complexity for single conversions.

## Migration Notes

No database migrations required - the fix only updates application logic. Existing data remains intact and functional.

**Migration Verification**: Run `python manage.py verify_recruitment_data` to confirm no existing data issues.

## References

- Original research document: `thoughts/shared/research/2025-09-28-multi-tenant-recruitment-conversion-bug.md`
- UserCompanyMembership model: `backend/api/models.py:303-424`
- Multi-tenant middleware: `backend/api/middleware/tenant_middleware.py`
- Recent migrations: `backend/api/migrations/0028-0031_*.py`