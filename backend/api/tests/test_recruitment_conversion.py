"""
Comprehensive tests for RecruitmentApplication.convert_to_user() method.

This test suite covers:
- Successful conversion with all relationships created correctly
- Error conditions and validation scenarios
- Multi-tenant security and isolation
- Transaction rollback on failures
- Data integrity verification
"""
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from unittest.mock import patch, Mock
import logging

from api.models import (
    RecruitmentApplication, SecurityCompany, UserCompanyMembership,
    EmploymentType, StaffProfile, SIALicense, SecurityQualification
)

User = get_user_model()

# Disable logging during tests to reduce noise
logging.disable(logging.CRITICAL)


class RecruitmentConversionModelTest(TransactionTestCase):
    """Test RecruitmentApplication.convert_to_user method with proper transaction handling"""

    def setUp(self):
        """Set up test data with proper multi-tenant relationships"""
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@company.com',
            password='testpass123',
            role='admin'
        )

        # Create active security company
        self.company = SecurityCompany.objects.create(
            name='Test Security Company',
            registration_number='TSC123456',
            country_code='GBR',
            business_email='business@testsecurity.com',
            business_phone='+44 20 1234 5678',
            is_active=True,
            created_by=self.admin_user
        )

        # Create admin company membership
        UserCompanyMembership.objects.create(
            user=self.admin_user,
            company=self.company,
            role='admin',
            is_owner=True,
            is_active=True,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        # Create employment type linked to company
        self.employment_type = EmploymentType.objects.create(
            name='Contract Workers',
            description='Contracted security staff',
            company=self.company,
            is_active=True
        )

        # Create approved recruitment application
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
            certifications=['first_aid', 'conflict_management']
        )

    def test_successful_conversion_creates_all_relationships(self):
        """Test that successful conversion creates user, staff profile, company membership, and all related data"""
        user = self.application.convert_to_user(self.admin_user)

        # Verify user was created correctly
        self.assertIsNotNone(user)
        self.assertEqual(user.email, 'john.doe@example.com')
        self.assertEqual(user.role, 'staff')
        self.assertTrue(user.username.startswith('john.doe'))
        self.assertEqual(user.first_name, 'John')
        self.assertEqual(user.last_name, 'Doe')

        # Verify staff profile was created with employment type
        staff_profile = StaffProfile.objects.get(user=user)
        self.assertEqual(staff_profile.employment_type, self.employment_type)
        self.assertEqual(staff_profile.phone_number, '+44 7123 456789')
        self.assertTrue(staff_profile.is_approved)
        self.assertEqual(staff_profile.date_of_birth.strftime('%Y-%m-%d'), '1990-01-01')
        self.assertEqual(staff_profile.street, '123 Test Street')
        self.assertEqual(staff_profile.postal_code, 'TE1 1ST')
        self.assertEqual(staff_profile.country, 'UK')

        # Verify company membership was created correctly
        membership = UserCompanyMembership.objects.get(user=user, company=self.company)
        self.assertEqual(membership.role, 'staff')
        self.assertFalse(membership.is_owner)
        self.assertTrue(membership.is_active)
        self.assertEqual(membership.invited_by, self.admin_user)
        self.assertEqual(membership.invitation_status, 'accepted')
        self.assertIsNotNone(membership.joined_at)

        # Verify SIA licenses were created correctly
        sia_licenses = SIALicense.objects.filter(staff_profile=staff_profile)
        self.assertEqual(sia_licenses.count(), 2)

        # Check specific license types
        license_types = [license.license_type for license in sia_licenses]
        self.assertIn('ds', license_types)  # door_supervisor mapped to 'ds'
        self.assertIn('sg', license_types)  # security_guard mapped to 'sg'

        # Check license details
        for license in sia_licenses:
            self.assertEqual(license.license_number, 'SIA123456789')
            self.assertEqual(license.expiry_date.strftime('%Y-%m-%d'), '2025-12-31')
            self.assertEqual(license.status, 'valid')

        # Verify security qualifications were created
        qualifications = SecurityQualification.objects.filter(staff_profile=staff_profile)
        self.assertEqual(qualifications.count(), 2)

        qualification_types = [qual.qualification_type for qual in qualifications]
        self.assertIn('first_aid', qualification_types)
        self.assertIn('conflict_management', qualification_types)

        # Verify application was marked as converted
        self.application.refresh_from_db()
        self.assertEqual(self.application.converted_to_user, user)

    def test_unapproved_application_conversion_fails(self):
        """Test that unapproved applications cannot be converted"""
        self.application.status = 'pending'
        self.application.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("Only approved applications can be converted", str(context.exception))

        # Verify no user was created
        self.assertFalse(User.objects.filter(email='john.doe@example.com').exists())

    def test_rejected_application_conversion_fails(self):
        """Test that rejected applications cannot be converted"""
        self.application.status = 'rejected'
        self.application.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("Only approved applications can be converted", str(context.exception))

    def test_duplicate_conversion_attempts_fail(self):
        """Test that applications cannot be converted twice"""
        # First conversion should work
        user = self.application.convert_to_user(self.admin_user)
        self.assertIsNotNone(user)

        # Second conversion should fail
        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("already been converted", str(context.exception))

    def test_duplicate_email_validation_works_correctly(self):
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

    def test_username_conflict_resolution_generates_unique_usernames(self):
        """Test that username conflicts are resolved automatically"""
        # Create users with conflicting usernames
        User.objects.create_user(
            username='john.doe',
            email='other1@example.com',
            password='testpass123'
        )
        User.objects.create_user(
            username='john.doe1',
            email='other2@example.com',
            password='testpass123'
        )

        user = self.application.convert_to_user(self.admin_user)

        # Should get alternative username
        self.assertEqual(user.username, 'john.doe2')
        self.assertEqual(user.email, 'john.doe@example.com')

    def test_single_name_handling(self):
        """Test conversion with single name (no last name)"""
        self.application.full_name = 'Madonna'
        self.application.save()

        user = self.application.convert_to_user(self.admin_user)

        self.assertEqual(user.first_name, 'Madonna')
        self.assertEqual(user.last_name, '')

    def test_inactive_company_conversion_fails_with_validation_error(self):
        """Test that conversion fails if company is inactive"""
        self.company.is_active = False
        self.company.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("no active company", str(context.exception))

    def test_missing_employment_type_fails(self):
        """Test that conversion fails if no employment type is assigned"""
        self.application.employment_type = None
        self.application.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("no employment type assigned", str(context.exception))

    def test_employment_type_validation_works_correctly(self):
        """Test validation of employment type company relationship"""
        # Create employment type without company (should not happen in practice)
        bad_employment_type = EmploymentType.objects.create(
            name='Bad Employment Type',
            description='Employment type without company',
            company=None,
            is_active=True
        )

        self.application.employment_type = bad_employment_type
        self.application.save()

        with self.assertRaises(ValueError) as context:
            self.application.convert_to_user(self.admin_user)

        self.assertIn("no active company", str(context.exception))

    def test_transaction_rollback_works_on_failures(self):
        """Test that failed conversions don't leave partial data"""
        # Mock UserCompanyMembership.objects.create to fail after user creation
        with patch('api.models.UserCompanyMembership.objects.create', side_effect=Exception("Membership creation failed")):
            with self.assertRaises(ValueError):
                self.application.convert_to_user(self.admin_user)

        # Verify no partial data was created
        self.assertFalse(User.objects.filter(email='john.doe@example.com').exists())
        self.assertFalse(StaffProfile.objects.filter(user__email='john.doe@example.com').exists())

        # Verify application was not marked as converted
        self.application.refresh_from_db()
        self.assertIsNone(self.application.converted_to_user)

    def test_transaction_rollback_on_sia_license_failure(self):
        """Test rollback when SIA license creation fails"""
        # Mock SIALicense.objects.create to fail
        with patch('api.models.SIALicense.objects.create', side_effect=Exception("SIA license creation failed")):
            with self.assertRaises(ValueError):
                self.application.convert_to_user(self.admin_user)

        # Verify no partial data exists
        self.assertFalse(User.objects.filter(email='john.doe@example.com').exists())
        self.assertFalse(StaffProfile.objects.filter(user__email='john.doe@example.com').exists())
        self.assertFalse(UserCompanyMembership.objects.filter(user__email='john.doe@example.com').exists())

    def test_conversion_without_sia_licence(self):
        """Test successful conversion when applicant doesn't have SIA licence"""
        self.application.has_sia_licence = False
        self.application.sia_licence_number = ''
        self.application.licence_types = []
        self.application.save()

        user = self.application.convert_to_user(self.admin_user)

        # Verify user and basic relationships were created
        self.assertIsNotNone(user)
        staff_profile = StaffProfile.objects.get(user=user)
        membership = UserCompanyMembership.objects.get(user=user, company=self.company)

        # Verify no SIA licenses were created
        sia_licenses = SIALicense.objects.filter(staff_profile=staff_profile)
        self.assertEqual(sia_licenses.count(), 0)

        # But qualifications should still be created
        qualifications = SecurityQualification.objects.filter(staff_profile=staff_profile)
        self.assertEqual(qualifications.count(), 2)

    def test_conversion_without_certifications(self):
        """Test conversion when applicant has no additional certifications"""
        self.application.certifications = []
        self.application.save()

        user = self.application.convert_to_user(self.admin_user)

        # Verify basic conversion worked
        self.assertIsNotNone(user)
        staff_profile = StaffProfile.objects.get(user=user)

        # Verify no qualifications were created
        qualifications = SecurityQualification.objects.filter(staff_profile=staff_profile)
        self.assertEqual(qualifications.count(), 0)

        # But SIA licenses should still be created
        sia_licenses = SIALicense.objects.filter(staff_profile=staff_profile)
        self.assertEqual(sia_licenses.count(), 2)

    def test_conversion_filters_other_certifications(self):
        """Test that 'other' certifications are filtered out"""
        self.application.certifications = ['first_aid', 'other', 'conflict_management']
        self.application.save()

        user = self.application.convert_to_user(self.admin_user)

        staff_profile = StaffProfile.objects.get(user=user)
        qualifications = SecurityQualification.objects.filter(staff_profile=staff_profile)

        # Should only create 2 qualifications (excluding 'other')
        self.assertEqual(qualifications.count(), 2)

        qualification_types = [qual.qualification_type for qual in qualifications]
        self.assertIn('first_aid', qualification_types)
        self.assertIn('conflict_management', qualification_types)
        self.assertNotIn('other', qualification_types)


class RecruitmentConversionMultiTenantTest(TransactionTestCase):
    """Test multi-tenant isolation and security for recruitment conversion"""

    def setUp(self):
        """Set up multi-tenant test scenario"""
        # Create first company and admin
        self.admin_user1 = User.objects.create_user(
            username='admin1',
            email='admin1@company1.com',
            password='testpass123',
            role='admin'
        )

        self.company1 = SecurityCompany.objects.create(
            name='Company One Security',
            registration_number='COS123456',
            country_code='GBR',
            business_email='business@company1.com',
            business_phone='+44 20 1111 1111',
            is_active=True,
            created_by=self.admin_user1
        )

        UserCompanyMembership.objects.create(
            user=self.admin_user1,
            company=self.company1,
            role='admin',
            is_owner=True,
            is_active=True,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        self.employment_type1 = EmploymentType.objects.create(
            name='Full Time Staff',
            description='Full time security staff',
            company=self.company1,
            is_active=True
        )

        # Create second company and admin
        self.admin_user2 = User.objects.create_user(
            username='admin2',
            email='admin2@company2.com',
            password='testpass123',
            role='admin'
        )

        self.company2 = SecurityCompany.objects.create(
            name='Company Two Security',
            registration_number='CTS789012',
            country_code='GBR',
            business_email='business@company2.com',
            business_phone='+44 20 2222 2222',
            is_active=True,
            created_by=self.admin_user2
        )

        UserCompanyMembership.objects.create(
            user=self.admin_user2,
            company=self.company2,
            role='admin',
            is_owner=True,
            is_active=True,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        self.employment_type2 = EmploymentType.objects.create(
            name='Contract Workers',
            description='Contract security workers',
            company=self.company2,
            is_active=True
        )

    def test_converted_users_isolated_by_company(self):
        """Test that converted users are properly isolated by company"""
        # Create applications for both companies
        app1 = RecruitmentApplication.objects.create(
            full_name='Alice Smith',
            email='alice@example.com',
            date_of_birth='1991-05-15',
            phone_number='+44 7111 111111',
            home_address='111 First Street',
            postcode='F1R 5T1',
            employment_type=self.employment_type1,
            status='approved'
        )

        app2 = RecruitmentApplication.objects.create(
            full_name='Bob Jones',
            email='bob@example.com',
            date_of_birth='1992-06-20',
            phone_number='+44 7222 222222',
            home_address='222 Second Street',
            postcode='S2C 0ND',
            employment_type=self.employment_type2,
            status='approved'
        )

        # Convert both applications
        user1 = app1.convert_to_user(self.admin_user1)
        user2 = app2.convert_to_user(self.admin_user2)

        # Verify users are in correct companies
        membership1 = UserCompanyMembership.objects.get(user=user1)
        membership2 = UserCompanyMembership.objects.get(user=user2)

        self.assertEqual(membership1.company, self.company1)
        self.assertEqual(membership2.company, self.company2)

        # Verify users have correct employment types
        profile1 = StaffProfile.objects.get(user=user1)
        profile2 = StaffProfile.objects.get(user=user2)

        self.assertEqual(profile1.employment_type, self.employment_type1)
        self.assertEqual(profile2.employment_type, self.employment_type2)

    def test_cross_company_conversion_data_integrity(self):
        """Test data integrity when converting users across different companies"""
        app = RecruitmentApplication.objects.create(
            full_name='Charlie Wilson',
            email='charlie@example.com',
            date_of_birth='1993-07-25',
            phone_number='+44 7333 333333',
            home_address='333 Third Street',
            postcode='T3R D33',
            employment_type=self.employment_type1,
            status='approved'
        )

        user = app.convert_to_user(self.admin_user1)

        # Verify user is only in company1, not company2
        memberships = UserCompanyMembership.objects.filter(user=user)
        self.assertEqual(memberships.count(), 1)
        self.assertEqual(memberships.first().company, self.company1)

        # Verify no cross-company contamination
        company2_memberships = UserCompanyMembership.objects.filter(company=self.company2)
        self.assertNotIn(user, [m.user for m in company2_memberships])


class RecruitmentConversionEdgeCaseTest(TransactionTestCase):
    """Test edge cases and error conditions in recruitment conversion"""

    def setUp(self):
        """Set up test data for edge case testing"""
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
            is_active=True,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        self.employment_type = EmploymentType.objects.create(
            name='Test Workers',
            description='Test employment type',
            company=self.company,
            is_active=True
        )

    def test_empty_email_username_generation(self):
        """Test username generation with edge case emails"""
        # Test with email that has no username part before @
        app = RecruitmentApplication.objects.create(
            full_name='Test User',
            email='@example.com',  # Invalid email but test the logic
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Test Street',
            postcode='TE1 1ST',
            employment_type=self.employment_type,
            status='approved'
        )

        with self.assertRaises(ValueError):
            # This should fail due to email validation before reaching username generation
            app.convert_to_user(self.admin_user)

    def test_very_long_username_conflict_resolution(self):
        """Test username conflict resolution with long email addresses"""
        # Create many users with similar usernames to test conflict resolution
        base_email = 'very.long.email.address.for.testing.username.conflicts@example.com'

        app = RecruitmentApplication.objects.create(
            full_name='Test User',
            email=base_email,
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Test Street',
            postcode='TE1 1ST',
            employment_type=self.employment_type,
            status='approved'
        )

        # Create conflicting usernames
        base_username = 'very.long.email.address.for.testing.username.conflicts'
        for i in range(5):
            username = f"{base_username}{i}" if i > 0 else base_username
            User.objects.create_user(
                username=username,
                email=f'other{i}@example.com',
                password='testpass123'
            )

        user = app.convert_to_user(self.admin_user)
        self.assertEqual(user.username, f"{base_username}5")

    def test_missing_license_type_mapping(self):
        """Test handling of unknown license types"""
        app = RecruitmentApplication.objects.create(
            full_name='Test User',
            email='test@example.com',
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Test Street',
            postcode='TE1 1ST',
            employment_type=self.employment_type,
            status='approved',
            has_sia_licence=True,
            sia_licence_number='SIA123456789',
            licence_types=['unknown_license_type'],  # Not in mapping
            licence_expiry_date='2025-12-31'
        )

        user = app.convert_to_user(self.admin_user)

        # Should still create the license with the original type
        staff_profile = StaffProfile.objects.get(user=user)
        sia_licenses = SIALicense.objects.filter(staff_profile=staff_profile)
        self.assertEqual(sia_licenses.count(), 1)
        self.assertEqual(sia_licenses.first().license_type, 'unknown_license_type')

    def test_empty_certifications_handling(self):
        """Test handling of empty or None certifications"""
        app = RecruitmentApplication.objects.create(
            full_name='Test User',
            email='test@example.com',
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Test Street',
            postcode='TE1 1ST',
            employment_type=self.employment_type,
            status='approved',
            certifications=['', None, 'first_aid', '']  # Mix of empty and valid
        )

        user = app.convert_to_user(self.admin_user)

        # Should only create qualifications for non-empty certifications
        staff_profile = StaffProfile.objects.get(user=user)
        qualifications = SecurityQualification.objects.filter(staff_profile=staff_profile)
        self.assertEqual(qualifications.count(), 1)
        self.assertEqual(qualifications.first().qualification_type, 'first_aid')

    def tearDown(self):
        """Clean up test data"""
        # Re-enable logging after tests
        logging.disable(logging.NOTSET)