"""
Comprehensive API tests for the onboarding system.
Tests all endpoints, data validation, and quality assurance.
"""
import json
import uuid
from decimal import Decimal
from datetime import datetime, timedelta

from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    SecurityCompany,
    UserCompanyMembership,
    CompanyOnboarding,
    CompanyIntegration,
    Venue
)

User = get_user_model()


class OnboardingAPITestCase(APITestCase):
    """Base test case for onboarding API tests"""

    def setUp(self):
        """Set up test data and authentication"""
        self.client = APIClient()

        # Create test users
        self.owner_user = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='testpass123',
            first_name='John',
            last_name='Owner'
        )

        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@example.com',
            password='testpass123',
            first_name='Jane',
            last_name='Staff'
        )

        # Create JWT tokens for authentication
        self.owner_token = RefreshToken.for_user(self.owner_user)
        self.staff_token = RefreshToken.for_user(self.staff_user)

        # Valid test data for onboarding steps
        self.valid_company_data = {
            'company': {
                'name': 'Test Security Ltd',
                'trading_name': 'Test Security',
                'registration_number': 'TS123456',
                'tax_id': 'GB123456789',
                'country_code': 'GBR',
                'state_province': 'England',
                'city': 'London',
                'postal_code': 'SW1A 1AA',
                'address_line_1': '123 Test Street',
                'address_line_2': 'Suite 100',
                'industry_type': 'corporate',
                'company_size': 'medium',
                'primary_contact_name': 'John Owner',
                'primary_contact_email': 'owner@example.com',
                'primary_contact_phone': '+44 20 1234 5678',
                'billing_email': 'billing@example.com',
                'timezone': 'Europe/London',
                'currency': 'GBP',
                'date_format': 'DD/MM/YYYY'
            }
        }

        self.valid_regional_setup = {
            'operating_regions': ['London', 'Birmingham', 'Manchester'],
            'primary_jurisdiction': 'England',
            'regulatory_requirements': {
                'london': {'sia_license_required': True, 'min_training_hours': 40},
                'birmingham': {'sia_license_required': True, 'min_training_hours': 35}
            },
            'compliance_certifications': ['SIA Door Supervisor', 'First Aid'],
            'standard_working_hours': {
                'monday': {'start': '09:00', 'end': '17:00'},
                'tuesday': {'start': '09:00', 'end': '17:00'},
                'weekend_premium': 1.5
            },
            'overtime_policies': {
                'rate_multiplier': 1.5,
                'threshold_hours': 40,
                'max_overtime_per_week': 12
            },
            'break_requirements': {
                'lunch_break_minutes': 30,
                'short_break_minutes': 15,
                'break_frequency_hours': 4
            },
            'public_holidays': ['2024-12-25', '2024-01-01', '2024-04-01'],
            'minimum_leave_entitlement': 28
        }

        self.valid_staff_config = {
            'expected_staff_count': 25,
            'staff_categories': ['Security Officer', 'Supervisor', 'Manager'],
            'shift_patterns': {
                'day_shift': {'start': '08:00', 'end': '16:00', 'duration': 8},
                'night_shift': {'start': '22:00', 'end': '06:00', 'duration': 8},
                'rotating': True
            },
            'shift_approval_required': True,
            'allow_shift_swapping': True,
            'venue_types': ['Corporate Office', 'Retail Store', 'Event Venue'],
            'gps_tracking_required': True,
            'default_pay_rates': {
                'security_officer': {'hourly_rate': 12.50, 'currency': 'GBP'},
                'supervisor': {'hourly_rate': 15.00, 'currency': 'GBP'},
                'manager': {'hourly_rate': 20.00, 'currency': 'GBP'}
            },
            'payment_frequency': 'weekly'
        }

        self.valid_integrations = {
            'deputy_enabled': True,
            'deputy_api_key': 'test_deputy_api_key_123',
            'deputy_endpoint': 'https://test.au.deputy.com',
            'payroll_system': 'xero',
            'payroll_credentials': {
                'client_id': 'test_xero_client_id',
                'client_secret': 'test_xero_secret',
                'callback_url': 'https://app.example.com/xero/callback'
            },
            'accounting_system': 'quickbooks',
            'accounting_credentials': {
                'app_token': 'test_qb_token',
                'consumer_key': 'test_qb_consumer_key'
            },
            'communication_platform': 'slack',
            'communication_credentials': {
                'webhook_url': 'https://hooks.slack.com/test'
            }
        }

    def authenticate_as_owner(self):
        """Authenticate as company owner"""
        self.client.force_authenticate(user=self.owner_user)

    def authenticate_as_staff(self):
        """Authenticate as staff member"""
        self.client.force_authenticate(user=self.staff_user)


class OnboardingInitiationTest(OnboardingAPITestCase):
    """Test onboarding initiation endpoint"""

    def test_initiate_onboarding_success(self):
        """Test successful onboarding initiation"""
        self.authenticate_as_owner()

        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('onboarding', response.data)

        # Verify company was created
        self.assertTrue(SecurityCompany.objects.filter(name='Test Security Ltd').exists())

        # Verify user membership was created
        company = SecurityCompany.objects.get(name='Test Security Ltd')
        membership = UserCompanyMembership.objects.get(user=self.owner_user, company=company)
        self.assertTrue(membership.is_owner)
        self.assertEqual(membership.role, 'owner')

        # Verify onboarding record was created
        self.assertTrue(hasattr(company, 'onboarding'))
        onboarding = company.onboarding
        self.assertEqual(onboarding.current_step, 1)
        self.assertFalse(onboarding.is_completed)

    def test_initiate_onboarding_invalid_company_data(self):
        """Test initiation with invalid company data"""
        self.authenticate_as_owner()

        # Missing required fields
        invalid_data = {'company': {'name': 'Test Company'}}  # Missing required fields

        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, invalid_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('errors', response.data)

    def test_initiate_onboarding_unauthenticated(self):
        """Test initiation without authentication"""
        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_continue_existing_onboarding(self):
        """Test continuing with existing incomplete onboarding"""
        self.authenticate_as_owner()

        # Create existing company and onboarding
        company = SecurityCompany.objects.create(
            name='Existing Company',
            registration_number='EX123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Existing Street',
            billing_email='billing@existing.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        CompanyOnboarding.objects.create(company=company)

        # Try to initiate new onboarding
        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'existing_onboarding_found')
        self.assertIn('onboarding', response.data)


class OnboardingProgressTest(OnboardingAPITestCase):
    """Test onboarding progress endpoint"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

        # Create company and onboarding
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@test.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        self.onboarding = CompanyOnboarding.objects.create(company=self.company)

    def test_get_progress_success(self):
        """Test getting onboarding progress successfully"""
        url = reverse('onboarding-get-progress')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('onboarding', response.data)

        onboarding_data = response.data['onboarding']
        self.assertEqual(onboarding_data['current_step'], 1)
        self.assertEqual(onboarding_data['progress_percentage'], 0)
        self.assertFalse(onboarding_data['is_completed'])

    def test_get_progress_no_company(self):
        """Test getting progress when user has no company"""
        # Create user without company membership
        no_company_user = User.objects.create_user(
            username='nocompany',
            email='nocompany@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=no_company_user)

        url = reverse('onboarding-get-progress')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['status'], 'error')


class OnboardingCompanyInfoTest(OnboardingAPITestCase):
    """Test company information step endpoint"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

        # Create company and onboarding
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@test.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        self.onboarding = CompanyOnboarding.objects.create(company=self.company)

    def test_save_company_info_success(self):
        """Test successfully saving company information"""
        company_info = self.valid_company_data['company']

        url = reverse('onboarding-save-company-info')
        response = self.client.put(url, company_info, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify company was updated
        self.company.refresh_from_db()
        self.assertEqual(self.company.trading_name, 'Test Security')
        self.assertEqual(self.company.tax_id, 'GB123456789')
        self.assertEqual(self.company.timezone, 'Europe/London')

        # Verify onboarding progress
        self.onboarding.refresh_from_db()
        self.assertTrue(self.onboarding.company_info_completed)
        self.assertEqual(self.onboarding.current_step, 2)

    def test_save_company_info_validation_errors(self):
        """Test company info validation"""
        invalid_data = {
            'name': '',  # Required field empty
            'registration_number': '123',  # Too short
            'primary_contact_email': 'invalid-email',  # Invalid email format
            'country_code': 'INVALID',  # Invalid country code
        }

        url = reverse('onboarding-save-company-info')
        response = self.client.put(url, invalid_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('errors', response.data)

    def test_save_company_info_email_validation(self):
        """Test email format validation"""
        company_info = self.valid_company_data['company'].copy()
        company_info['primary_contact_email'] = 'not-an-email'
        company_info['billing_email'] = 'also-not-an-email'

        url = reverse('onboarding-save-company-info')
        response = self.client.put(url, company_info, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', response.data)

    def test_save_company_info_phone_validation(self):
        """Test phone number format validation"""
        company_info = self.valid_company_data['company'].copy()
        company_info['primary_contact_phone'] = '123'  # Too short

        url = reverse('onboarding-save-company-info')
        response = self.client.put(url, company_info, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('errors', response.data)


class OnboardingRegionalSetupTest(OnboardingAPITestCase):
    """Test regional setup step endpoint"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

        # Create company and onboarding
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@test.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        self.onboarding = CompanyOnboarding.objects.create(company=self.company)
        # Mark first step as completed
        self.onboarding.mark_step_completed(1)

    def test_save_regional_setup_success(self):
        """Test successfully saving regional setup"""
        url = reverse('onboarding-save-regional-setup')
        response = self.client.put(url, self.valid_regional_setup, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify onboarding progress
        self.onboarding.refresh_from_db()
        self.assertTrue(self.onboarding.regional_setup_completed)
        self.assertEqual(self.onboarding.current_step, 3)

        # Verify data was saved
        step_data = self.onboarding.step_data.get('regional_setup', {})
        self.assertEqual(step_data['primary_jurisdiction'], 'England')
        self.assertIn('London', step_data['operating_regions'])

    def test_save_regional_setup_validation(self):
        """Test regional setup data validation"""
        invalid_data = {
            'operating_regions': [],  # Empty list when required
            'primary_jurisdiction': '',  # Empty required field
            'minimum_leave_entitlement': -5,  # Invalid negative value
        }

        url = reverse('onboarding-save-regional-setup')
        response = self.client.put(url, invalid_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')


class OnboardingStaffConfigTest(OnboardingAPITestCase):
    """Test staff configuration step endpoint"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

        # Create company and onboarding
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@test.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        self.onboarding = CompanyOnboarding.objects.create(company=self.company)
        # Mark previous steps as completed
        self.onboarding.mark_step_completed(1)
        self.onboarding.mark_step_completed(2)

    def test_save_staff_config_success(self):
        """Test successfully saving staff configuration"""
        url = reverse('onboarding-save-staff-config')
        response = self.client.put(url, self.valid_staff_config, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify onboarding progress
        self.onboarding.refresh_from_db()
        self.assertTrue(self.onboarding.staff_setup_completed)
        self.assertEqual(self.onboarding.current_step, 4)

        # Verify company capacity was updated
        self.company.refresh_from_db()
        self.assertEqual(self.company.staff_capacity, 25)

    def test_save_staff_config_validation(self):
        """Test staff configuration validation"""
        invalid_data = {
            'expected_staff_count': 0,  # Invalid: must be at least 1
            'staff_categories': [],  # Empty when should have categories
            'payment_frequency': 'invalid',  # Invalid choice
        }

        url = reverse('onboarding-save-staff-config')
        response = self.client.put(url, invalid_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')

    def test_save_staff_config_pay_rates_validation(self):
        """Test pay rates validation"""
        staff_config = self.valid_staff_config.copy()
        staff_config['default_pay_rates'] = {
            'security_officer': {'hourly_rate': -5.00}  # Invalid negative rate
        }

        url = reverse('onboarding-save-staff-config')
        response = self.client.put(url, staff_config, format='json')

        # Should still succeed but with warnings or data cleaning
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class OnboardingIntegrationsTest(OnboardingAPITestCase):
    """Test integrations configuration step endpoint"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

        # Create company and onboarding
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@test.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        self.onboarding = CompanyOnboarding.objects.create(company=self.company)
        # Mark previous steps as completed
        for step in range(1, 4):
            self.onboarding.mark_step_completed(step)

    def test_save_integrations_success(self):
        """Test successfully saving integrations configuration"""
        url = reverse('onboarding-save-integrations')
        response = self.client.put(url, self.valid_integrations, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify onboarding progress
        self.onboarding.refresh_from_db()
        self.assertTrue(self.onboarding.integrations_completed)
        self.assertEqual(self.onboarding.current_step, 5)

        # Verify integration records were created
        deputy_integration = CompanyIntegration.objects.filter(
            company=self.company,
            integration_type='deputy'
        ).first()
        self.assertIsNotNone(deputy_integration)
        self.assertEqual(deputy_integration.status, 'configuring')

    def test_save_integrations_no_integrations(self):
        """Test saving with no integrations enabled"""
        minimal_integrations = {
            'deputy_enabled': False,
            'payroll_system': 'none',
            'accounting_system': 'none',
            'communication_platform': 'none'
        }

        url = reverse('onboarding-save-integrations')
        response = self.client.put(url, minimal_integrations, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify no integration records were created
        integrations_count = CompanyIntegration.objects.filter(company=self.company).count()
        self.assertEqual(integrations_count, 0)

    def test_save_integrations_validation(self):
        """Test integrations validation"""
        invalid_data = {
            'deputy_enabled': True,
            'deputy_api_key': '',  # Required when deputy_enabled is True
            'deputy_endpoint': 'not-a-url',  # Invalid URL format
            'payroll_system': 'invalid_choice',  # Invalid choice
        }

        url = reverse('onboarding-save-integrations')
        response = self.client.put(url, invalid_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')


class OnboardingCompletionTest(OnboardingAPITestCase):
    """Test onboarding completion endpoint"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

        # Create company and onboarding
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@test.com',
            primary_contact_name='John Owner',
            primary_contact_email='owner@example.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.owner_user,
            subscription_tier='professional'
        )

        UserCompanyMembership.objects.create(
            user=self.owner_user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )

        self.onboarding = CompanyOnboarding.objects.create(company=self.company)

    def test_complete_onboarding_success(self):
        """Test successfully completing onboarding"""
        # Mark all steps as completed
        for step in range(1, 5):
            self.onboarding.mark_step_completed(step)

        url = reverse('onboarding-complete-onboarding')
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify onboarding is completed
        self.onboarding.refresh_from_db()
        self.assertTrue(self.onboarding.is_completed)
        self.assertIsNotNone(self.onboarding.completed_at)
        self.assertEqual(self.onboarding.completed_by, self.owner_user)

        # Verify company is active
        self.company.refresh_from_db()
        self.assertTrue(self.company.is_active)

        # Verify features are enabled based on subscription
        features = self.company.features_enabled
        self.assertTrue(features.get('shift_management'))
        self.assertTrue(features.get('advanced_reporting'))  # Professional tier
        self.assertTrue(features.get('compliance_tracking'))  # Professional tier

    def test_complete_onboarding_incomplete_steps(self):
        """Test completion with incomplete steps"""
        # Only complete first 3 steps
        for step in range(1, 4):
            self.onboarding.mark_step_completed(step)

        url = reverse('onboarding-complete-onboarding')
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn('not all onboarding steps', response.data['message'].lower())

    def test_complete_onboarding_starter_tier_features(self):
        """Test feature enablement for starter tier"""
        # Set company to starter tier
        self.company.subscription_tier = 'starter'
        self.company.save()

        # Mark all steps as completed
        for step in range(1, 5):
            self.onboarding.mark_step_completed(step)

        url = reverse('onboarding-complete-onboarding')
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify only basic features are enabled
        self.company.refresh_from_db()
        features = self.company.features_enabled
        self.assertTrue(features.get('shift_management'))
        self.assertTrue(features.get('basic_reporting'))
        self.assertFalse(features.get('advanced_reporting', False))
        self.assertFalse(features.get('api_access', False))


class OnboardingDataQualityTest(OnboardingAPITestCase):
    """Test data quality and validation across the onboarding process"""

    def setUp(self):
        super().setUp()
        self.authenticate_as_owner()

    def test_registration_number_formats(self):
        """Test various registration number formats"""
        test_cases = [
            ('12345678', True),  # Valid UK format
            ('GB123456789', True),  # Valid with prefix
            ('123', False),  # Too short
            ('', False),  # Empty
            ('ABCDEF123456789012345', False),  # Too long
        ]

        for reg_number, should_be_valid in test_cases:
            with self.subTest(reg_number=reg_number):
                company_data = self.valid_company_data.copy()
                company_data['company']['registration_number'] = reg_number

                url = reverse('onboarding-initiate-onboarding')
                response = self.client.post(url, company_data, format='json')

                if should_be_valid:
                    self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])
                else:
                    self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_validation_comprehensive(self):
        """Test comprehensive email validation"""
        email_test_cases = [
            ('user@example.com', True),
            ('user.name@example.com', True),
            ('user+tag@example.co.uk', True),
            ('invalid-email', False),
            ('user@', False),
            ('@example.com', False),
            ('user@.com', False),
            ('', False),
        ]

        for email, should_be_valid in email_test_cases:
            with self.subTest(email=email):
                company_data = self.valid_company_data.copy()
                company_data['company']['primary_contact_email'] = email

                url = reverse('onboarding-initiate-onboarding')
                response = self.client.post(url, company_data, format='json')

                if should_be_valid:
                    self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])
                else:
                    self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_currency_validation(self):
        """Test currency code validation"""
        valid_currencies = ['GBP', 'USD', 'EUR', 'AUD', 'CAD']
        invalid_currencies = ['INVALID', 'GB', 'DOLLAR', '']

        for currency in valid_currencies:
            with self.subTest(currency=currency):
                company_data = self.valid_company_data.copy()
                company_data['company']['currency'] = currency

                url = reverse('onboarding-initiate-onboarding')
                response = self.client.post(url, company_data, format='json')

                self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_200_OK])

    def test_staff_count_validation(self):
        """Test staff count validation"""
        # Create base setup
        self.test_initiate_onboarding_success()

        staff_count_tests = [
            (1, True),  # Minimum valid
            (100, True),  # Normal
            (1000, True),  # Large but valid
            (0, False),  # Invalid: too low
            (-5, False),  # Invalid: negative
        ]

        for count, should_be_valid in staff_count_tests:
            with self.subTest(count=count):
                staff_config = self.valid_staff_config.copy()
                staff_config['expected_staff_count'] = count

                url = reverse('onboarding-save-staff-config')
                response = self.client.put(url, staff_config, format='json')

                if should_be_valid:
                    self.assertEqual(response.status_code, status.HTTP_200_OK)
                else:
                    self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_json_field_validation(self):
        """Test JSON field data quality"""
        # Test invalid JSON structures
        invalid_json_cases = [
            'not_json_string',
            123,  # Number instead of dict
            [],   # List instead of dict
            None,
        ]

        # Create base setup
        self.test_initiate_onboarding_success()

        for invalid_json in invalid_json_cases:
            with self.subTest(json_data=invalid_json):
                regional_setup = self.valid_regional_setup.copy()
                regional_setup['regulatory_requirements'] = invalid_json

                url = reverse('onboarding-save-regional-setup')
                response = self.client.put(url, regional_setup, format='json')

                # Should handle gracefully - either accept with defaults or reject
                self.assertIn(response.status_code, [
                    status.HTTP_200_OK,
                    status.HTTP_400_BAD_REQUEST
                ])


class OnboardingPermissionTest(OnboardingAPITestCase):
    """Test permission and security aspects of onboarding"""

    def test_staff_user_cannot_initiate_onboarding(self):
        """Test that staff users cannot initiate onboarding"""
        self.authenticate_as_staff()

        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_company_access_denied(self):
        """Test that users cannot access other companies' onboarding"""
        # Create first company with owner
        self.authenticate_as_owner()
        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Create second user and try to access first company's onboarding
        other_user = User.objects.create_user(
            username='other',
            email='other@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=other_user)

        url = reverse('onboarding-get-progress')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_sensitive_data_handling(self):
        """Test that sensitive data is properly handled"""
        self.authenticate_as_owner()

        # Create company first
        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Save integrations with sensitive data
        url = reverse('onboarding-save-integrations')
        response = self.client.put(url, self.valid_integrations, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify sensitive data is not exposed in API responses
        url = reverse('onboarding-get-progress')
        response = self.client.get(url)

        # API response should not contain raw credentials
        response_str = json.dumps(response.data)
        self.assertNotIn('test_deputy_api_key_123', response_str)
        self.assertNotIn('test_xero_secret', response_str)


class OnboardingIntegrationFlowTest(TransactionTestCase):
    """Test complete onboarding flow integration"""

    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='flowtest',
            email='flowtest@example.com',
            password='testpass123',
            first_name='Flow',
            last_name='Test'
        )
        self.client.force_authenticate(user=self.user)

        # Same valid data from OnboardingAPITestCase
        self.valid_company_data = {
            'company': {
                'name': 'Flow Test Security Ltd',
                'registration_number': 'FT123456',
                'country_code': 'GBR',
                'city': 'London',
                'postal_code': 'SW1A 1AA',
                'address_line_1': '123 Flow Test Street',
                'industry_type': 'corporate',
                'company_size': 'medium',
                'primary_contact_name': 'Flow Test',
                'primary_contact_email': 'flowtest@example.com',
                'primary_contact_phone': '+44 20 1234 5678',
                'billing_email': 'billing@flowtest.com'
            }
        }

    def test_complete_onboarding_flow(self):
        """Test the complete onboarding flow from start to finish"""

        # Step 1: Initiate onboarding
        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        company_id = response.data['onboarding']['company']
        company = SecurityCompany.objects.get(id=company_id)

        # Step 2: Save company info
        company_info = {
            'trading_name': 'Flow Test Security',
            'tax_id': 'GB987654321',
            'timezone': 'Europe/London',
            'currency': 'GBP'
        }
        url = reverse('onboarding-save-company-info')
        response = self.client.put(url, company_info, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Step 3: Save regional setup
        regional_setup = {
            'operating_regions': ['London', 'Manchester'],
            'primary_jurisdiction': 'England',
            'minimum_leave_entitlement': 28,
            'regulatory_requirements': {},
            'standard_working_hours': {},
            'overtime_policies': {},
            'break_requirements': {}
        }
        url = reverse('onboarding-save-regional-setup')
        response = self.client.put(url, regional_setup, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Step 4: Save staff config
        staff_config = {
            'expected_staff_count': 15,
            'staff_categories': ['Security Officer', 'Supervisor'],
            'shift_patterns': {},
            'default_pay_rates': {},
            'payment_frequency': 'weekly'
        }
        url = reverse('onboarding-save-staff-config')
        response = self.client.put(url, staff_config, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Step 5: Save integrations (minimal)
        integrations = {
            'deputy_enabled': False,
            'payroll_system': 'none',
            'accounting_system': 'none'
        }
        url = reverse('onboarding-save-integrations')
        response = self.client.put(url, integrations, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Step 6: Complete onboarding
        url = reverse('onboarding-complete-onboarding')
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify final state
        company.refresh_from_db()
        onboarding = company.onboarding

        self.assertTrue(company.is_active)
        self.assertTrue(onboarding.is_completed)
        self.assertEqual(onboarding.current_step, 5)
        self.assertEqual(onboarding.progress_percentage, 100)
        self.assertIsNotNone(onboarding.completed_at)

        # Verify step data persistence
        self.assertIn('company_info', onboarding.step_data)
        self.assertIn('regional_setup', onboarding.step_data)
        self.assertIn('staff_config', onboarding.step_data)
        self.assertIn('integrations', onboarding.step_data)

        # Verify features are enabled
        features = company.features_enabled
        self.assertTrue(features.get('shift_management'))
        self.assertTrue(features.get('staff_tracking'))
        self.assertTrue(features.get('basic_reporting'))

    def test_data_persistence_across_steps(self):
        """Test that data persists correctly across onboarding steps"""

        # Initiate and complete first step
        url = reverse('onboarding-initiate-onboarding')
        response = self.client.post(url, self.valid_company_data, format='json')

        # Get progress and verify data
        url = reverse('onboarding-get-progress')
        response = self.client.get(url)

        initial_step_data = response.data['onboarding']['step_data']

        # Complete another step
        regional_setup = {
            'operating_regions': ['Test Region'],
            'primary_jurisdiction': 'Test Jurisdiction',
            'minimum_leave_entitlement': 25,
            'regulatory_requirements': {'test': 'data'},
            'standard_working_hours': {},
            'overtime_policies': {},
            'break_requirements': {}
        }
        url = reverse('onboarding-save-regional-setup')
        response = self.client.put(url, regional_setup, format='json')

        # Verify both old and new data persist
        url = reverse('onboarding-get-progress')
        response = self.client.get(url)

        final_step_data = response.data['onboarding']['step_data']

        # Original data should still be there
        if 'company_info' in initial_step_data:
            self.assertIn('company_info', final_step_data)

        # New data should be added
        self.assertIn('regional_setup', final_step_data)
        self.assertEqual(
            final_step_data['regional_setup']['primary_jurisdiction'],
            'Test Jurisdiction'
        )