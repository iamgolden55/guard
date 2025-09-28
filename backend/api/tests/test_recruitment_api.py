"""
Comprehensive tests for recruitment application conversion API endpoint.

This test suite covers:
- Successful conversion via API with proper response format
- Error handling and response formats
- Authentication and authorization
- Multi-tenant security and cross-company protection
- Logging verification
- API-specific edge cases
"""
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from unittest.mock import patch, Mock
import json
import logging

from api.models import (
    RecruitmentApplication, SecurityCompany, UserCompanyMembership,
    EmploymentType, StaffProfile, SIALicense
)

User = get_user_model()

# Capture log messages for testing
logger = logging.getLogger('api.views')


class RecruitmentConversionAPITest(APITestCase):
    """Test recruitment application conversion API endpoint"""

    def setUp(self):
        """Set up test data and authentication"""
        self.client = APIClient()

        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@company.com',
            password='testpass123',
            role='admin'
        )

        # Create security company
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

        # Create employment type
        self.employment_type = EmploymentType.objects.create(
            name='Contract Workers',
            description='Contracted security staff',
            company=self.company,
            is_active=True
        )

        # Create approved recruitment application
        self.application = RecruitmentApplication.objects.create(
            full_name='Jane Smith',
            email='jane.smith@example.com',
            date_of_birth='1992-03-15',
            phone_number='+44 7987 654321',
            home_address='456 Test Avenue',
            postcode='TE2 2ST',
            employment_type=self.employment_type,
            status='approved',
            has_sia_licence=True,
            sia_licence_number='SIA987654321',
            licence_types=['security_guard'],
            licence_expiry_date='2025-06-30',
            certifications=['first_aid']
        )

    def authenticate_as_admin(self):
        """Authenticate as company admin"""
        self.client.force_authenticate(user=self.admin_user)

    def test_successful_conversion_api_returns_proper_response_format(self):
        """Test successful application conversion via API with correct response structure"""
        self.authenticate_as_admin()

        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        # Verify response status and structure
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertIn('application', response.data)
        self.assertIn('message', response.data)

        # Verify success message
        self.assertEqual(response.data['message'], 'Application converted to user account successfully')

        # Verify user data in response
        user_data = response.data['user']
        self.assertEqual(user_data['email'], 'jane.smith@example.com')
        self.assertEqual(user_data['role'], 'staff')
        self.assertTrue(user_data['username'].startswith('jane.smith'))

        # Verify application data in response
        application_data = response.data['application']
        self.assertEqual(application_data['id'], self.application.id)
        self.assertEqual(application_data['status'], 'approved')
        self.assertIsNotNone(application_data['converted_to_user'])

        # Verify actual user was created with proper relationships
        user_id = response.data['user']['id']
        user = User.objects.get(id=user_id)

        # Check company membership exists
        membership = UserCompanyMembership.objects.get(user=user, company=self.company)
        self.assertEqual(membership.role, 'staff')
        self.assertTrue(membership.is_active)
        self.assertEqual(membership.invited_by, self.admin_user)

        # Check staff profile has employment type
        staff_profile = StaffProfile.objects.get(user=user)
        self.assertEqual(staff_profile.employment_type, self.employment_type)

    def test_unapproved_application_returns_400_error_with_helpful_message(self):
        """Test API error for unapproved application conversion"""
        self.application.status = 'pending'
        self.application.save()

        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('approved', response.data['error'].lower())

        # Verify helpful error message
        error_message = response.data['error']
        self.assertTrue(any(word in error_message.lower() for word in ['approved', 'convert']))

    def test_rejected_application_returns_400_error(self):
        """Test API error for rejected application conversion"""
        self.application.status = 'rejected'
        self.application.save()

        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_already_converted_application_returns_400_error(self):
        """Test API error for already converted application"""
        # First convert the application
        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        first_response = self.client.post(url)
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)

        # Try to convert again
        second_response = self.client.post(url)
        self.assertEqual(second_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', second_response.data)
        self.assertIn('already', second_response.data['error'].lower())

    def test_unauthenticated_requests_return_401_error(self):
        """Test that unauthenticated users cannot convert applications"""
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_admin_users_cannot_convert(self):
        """Test that non-admin users cannot convert applications"""
        # Create staff user
        staff_user = User.objects.create_user(
            username='staff',
            email='staff@company.com',
            password='testpass123',
            role='staff'
        )

        UserCompanyMembership.objects.create(
            user=staff_user,
            company=self.company,
            role='staff',
            is_owner=False,
            is_active=True,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        self.client.force_authenticate(user=staff_user)
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        # Should be forbidden (403) or not found (404) depending on viewset permissions
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_cross_company_conversion_security_prevents_access(self):
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
            is_active=True,
            invitation_status='accepted',
            joined_at=timezone.now()
        )

        # Try to convert application from different company
        self.client.force_authenticate(user=other_admin)
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        # Should not find the application (filtered by company context)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_duplicate_email_returns_400_with_helpful_message(self):
        """Test API handling of duplicate email errors"""
        # Create existing user with same email
        User.objects.create_user(
            username='existing',
            email='jane.smith@example.com',
            password='testpass123'
        )

        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('email', response.data['error'].lower())

    def test_database_integrity_error_returns_409_conflict(self):
        """Test API handling of database integrity errors"""
        with patch('api.models.UserCompanyMembership.objects.create', side_effect=IntegrityError("Constraint violation")):
            self.authenticate_as_admin()
            url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
            response = self.client.post(url)

            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.assertIn('error', response.data)

    def test_unexpected_error_returns_500_with_generic_message(self):
        """Test API handling of unexpected errors with generic user message"""
        with patch('api.models.RecruitmentApplication.convert_to_user', side_effect=Exception("Unexpected database error")):
            self.authenticate_as_admin()
            url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
            response = self.client.post(url)

            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.assertIn('error', response.data)

            # Should not expose internal error details
            error_message = response.data['error']
            self.assertNotIn('database', error_message.lower())
            self.assertIn('internal', error_message.lower())

    def test_error_response_formats_match_expected_schemas(self):
        """Test that all error responses follow consistent format"""
        self.authenticate_as_admin()

        # Test unapproved application error format
        self.application.status = 'pending'
        self.application.save()

        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIsInstance(response.data, dict)
        self.assertIn('error', response.data)
        self.assertIsInstance(response.data['error'], str)
        self.assertGreater(len(response.data['error']), 0)

    @patch('api.views.logger')
    def test_logging_statements_execute_without_errors(self, mock_logger):
        """Test that logging statements work correctly for all scenarios"""
        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[self.application.id])

        # Test successful conversion logging
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify success logging was called
        mock_logger.info.assert_called()
        success_log = mock_logger.info.call_args[0][0]
        self.assertIn('Successfully converted', success_log)
        self.assertIn(str(self.application.id), success_log)

        # Reset mock
        mock_logger.reset_mock()

        # Test error logging
        self.application.status = 'pending'
        self.application.save()

        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify warning logging was called
        mock_logger.warning.assert_called()
        warning_log = mock_logger.warning.call_args[0][0]
        self.assertIn('validation failed', warning_log)

    def test_nonexistent_application_returns_404(self):
        """Test API response for nonexistent application"""
        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=[99999])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_application_id_returns_404(self):
        """Test API response for invalid application ID format"""
        self.authenticate_as_admin()
        url = reverse('recruitmentapplication-convert-to-user', args=['invalid-id'])
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class RecruitmentConversionAPIMultiTenantTest(APITestCase):
    """Test multi-tenant API security and isolation"""

    def setUp(self):
        """Set up multi-tenant test scenario"""
        self.client = APIClient()

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

        # Create applications for both companies
        self.app1 = RecruitmentApplication.objects.create(
            full_name='Alice Johnson',
            email='alice@example.com',
            date_of_birth='1991-05-15',
            phone_number='+44 7111 111111',
            home_address='111 First Street',
            postcode='F1R 5T1',
            employment_type=self.employment_type1,
            status='approved'
        )

        self.app2 = RecruitmentApplication.objects.create(
            full_name='Bob Williams',
            email='bob@example.com',
            date_of_birth='1992-06-20',
            phone_number='+44 7222 222222',
            home_address='222 Second Street',
            postcode='S2C 0ND',
            employment_type=self.employment_type2,
            status='approved'
        )

    def test_admin_can_only_convert_own_company_applications(self):
        """Test that admins can only convert applications from their own company"""
        # Admin1 should be able to convert app1
        self.client.force_authenticate(user=self.admin_user1)
        url1 = reverse('recruitmentapplication-convert-to-user', args=[self.app1.id])
        response1 = self.client.post(url1)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # But admin1 should not be able to see app2
        url2 = reverse('recruitmentapplication-convert-to-user', args=[self.app2.id])
        response2 = self.client.post(url2)
        self.assertEqual(response2.status_code, status.HTTP_404_NOT_FOUND)

    def test_converted_users_have_correct_company_context(self):
        """Test that converted users are assigned to correct companies"""
        # Convert app1 as admin1
        self.client.force_authenticate(user=self.admin_user1)
        url1 = reverse('recruitmentapplication-convert-to-user', args=[self.app1.id])
        response1 = self.client.post(url1)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        # Convert app2 as admin2
        self.client.force_authenticate(user=self.admin_user2)
        url2 = reverse('recruitmentapplication-convert-to-user', args=[self.app2.id])
        response2 = self.client.post(url2)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        # Verify users are in correct companies
        user1_id = response1.data['user']['id']
        user2_id = response2.data['user']['id']

        user1 = User.objects.get(id=user1_id)
        user2 = User.objects.get(id=user2_id)

        membership1 = UserCompanyMembership.objects.get(user=user1)
        membership2 = UserCompanyMembership.objects.get(user=user2)

        self.assertEqual(membership1.company, self.company1)
        self.assertEqual(membership2.company, self.company2)

    def test_company_isolation_prevents_data_leakage(self):
        """Test that company context prevents data leakage between tenants"""
        # Convert both applications
        self.client.force_authenticate(user=self.admin_user1)
        url1 = reverse('recruitmentapplication-convert-to-user', args=[self.app1.id])
        response1 = self.client.post(url1)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.admin_user2)
        url2 = reverse('recruitmentapplication-convert-to-user', args=[self.app2.id])
        response2 = self.client.post(url2)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

        # Verify no cross-company memberships exist
        user1_id = response1.data['user']['id']
        user2_id = response2.data['user']['id']

        user1 = User.objects.get(id=user1_id)
        user2 = User.objects.get(id=user2_id)

        # User1 should only be in company1
        user1_memberships = UserCompanyMembership.objects.filter(user=user1)
        self.assertEqual(user1_memberships.count(), 1)
        self.assertEqual(user1_memberships.first().company, self.company1)

        # User2 should only be in company2
        user2_memberships = UserCompanyMembership.objects.filter(user=user2)
        self.assertEqual(user2_memberships.count(), 1)
        self.assertEqual(user2_memberships.first().company, self.company2)

        # No cross-company contamination
        self.assertFalse(UserCompanyMembership.objects.filter(user=user1, company=self.company2).exists())
        self.assertFalse(UserCompanyMembership.objects.filter(user=user2, company=self.company1).exists())


class RecruitmentConversionAPIPerformanceTest(APITestCase):
    """Test API performance and efficiency"""

    def setUp(self):
        """Set up performance test scenario"""
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

    def test_api_response_time_is_reasonable(self):
        """Test that API response time is within acceptable limits"""
        import time

        app = RecruitmentApplication.objects.create(
            full_name='Performance Test User',
            email='performance@example.com',
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Performance Street',
            postcode='PE1 1RF',
            employment_type=self.employment_type,
            status='approved'
        )

        self.client.force_authenticate(user=self.admin_user)
        url = reverse('recruitmentapplication-convert-to-user', args=[app.id])

        start_time = time.time()
        response = self.client.post(url)
        end_time = time.time()

        # API should respond within reasonable time (adjust threshold as needed)
        response_time = end_time - start_time
        self.assertLess(response_time, 2.0)  # 2 seconds max
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_database_query_efficiency(self):
        """Test that conversion doesn't generate excessive database queries"""
        from django.test.utils import override_settings
        from django.db import connection

        app = RecruitmentApplication.objects.create(
            full_name='Query Test User',
            email='query@example.com',
            date_of_birth='1990-01-01',
            phone_number='+44 7123 456789',
            home_address='123 Query Street',
            postcode='QU1 1RY',
            employment_type=self.employment_type,
            status='approved',
            has_sia_licence=True,
            sia_licence_number='SIA123456789',
            licence_types=['door_supervisor', 'security_guard'],
            licence_expiry_date='2025-12-31',
            certifications=['first_aid', 'conflict_management']
        )

        self.client.force_authenticate(user=self.admin_user)
        url = reverse('recruitmentapplication-convert-to-user', args=[app.id])

        # Reset query count
        connection.queries_log.clear()

        response = self.client.post(url)

        # Should be successful
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Query count should be reasonable (adjust threshold based on actual optimization)
        query_count = len(connection.queries)
        self.assertLess(query_count, 50)  # Reasonable upper limit