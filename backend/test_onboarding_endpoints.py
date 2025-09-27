#!/usr/bin/env python3
"""
Test script for the onboarding API endpoints.
Validates that all 8 required endpoints are implemented and accessible.
"""

import os
import sys
import django
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from api.models import SecurityCompany, CompanyOnboarding, UserCompanyMembership

User = get_user_model()


class OnboardingEndpointTest(TestCase):
    """
    Test all 8 onboarding API endpoints for functionality and security.
    """
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        
        # Create test user
        self.user = User.objects.create_user(
            username='testowner',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create test company
        self.company = SecurityCompany.objects.create(
            name='Test Security Company',
            registration_number='TSC123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            industry_type='mixed',
            company_size='small',
            billing_email='billing@test.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@test.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.user
        )
        
        # Create user membership as owner
        self.membership = UserCompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role='owner',
            is_owner=True,
            is_active=True
        )
        
        # Create onboarding record
        self.onboarding = CompanyOnboarding.objects.create(
            company=self.company
        )
        
        # Authenticate the client
        self.client.force_authenticate(user=self.user)
    
    def test_endpoint_1_initiate_onboarding(self):
        """Test POST /api/v1/onboarding/initiate/"""
        url = '/api/v1/onboarding/initiate/'
        data = {
            'company': {
                'name': 'New Test Company',
                'registration_number': 'NTC789012',
                'country_code': 'GBR',
                'city': 'Manchester',
                'postal_code': 'M1 1AA',
                'address_line_1': '456 New Street',
                'industry_type': 'events',
                'company_size': 'medium',
                'billing_email': 'billing@newtest.com',
                'primary_contact_name': 'Jane Smith',
                'primary_contact_email': 'jane@newtest.com',
                'primary_contact_phone': '+44 161 123 4567'
            }
        }
        
        # Test with existing company - should return existing onboarding
        response = self.client.post(url, data, format='json')
        self.assertIn(response.status_code, [200, 201])
        self.assertIn('onboarding', response.data)
        print("✓ Endpoint 1: POST /api/v1/onboarding/initiate/ - Working")
    
    def test_endpoint_2_get_progress(self):
        """Test GET /api/v1/onboarding/progress/"""
        url = '/api/v1/onboarding/progress/'
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('onboarding', response.data)
        self.assertEqual(response.data['status'], 'success')
        print("✓ Endpoint 2: GET /api/v1/onboarding/progress/ - Working")
    
    def test_endpoint_3_save_company_info(self):
        """Test PUT /api/v1/onboarding/company-info/"""
        url = '/api/v1/onboarding/company-info/'
        data = {
            'name': 'Updated Test Security Company',
            'trading_name': 'Test Security',
            'registration_number': 'TSC123456',
            'tax_id': 'GB123456789',
            'country_code': 'GBR',
            'state_province': 'England',
            'city': 'London',
            'postal_code': 'SW1A 1AA',
            'address_line_1': '123 Test Street',
            'address_line_2': 'Suite 100',
            'industry_type': 'mixed',
            'company_size': 'small',
            'primary_contact_name': 'John Doe',
            'primary_contact_email': 'john@test.com',
            'primary_contact_phone': '+44 20 1234 5678',
            'billing_email': 'billing@test.com',
            'timezone': 'Europe/London',
            'currency': 'GBP',
            'date_format': 'DD/MM/YYYY'
        }
        
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        print("✓ Endpoint 3: PUT /api/v1/onboarding/company-info/ - Working")
    
    def test_endpoint_4_save_regional_setup(self):
        """Test PUT /api/v1/onboarding/regional-setup/"""
        url = '/api/v1/onboarding/regional-setup/'
        data = {
            'operating_regions': ['England', 'Scotland', 'Wales'],
            'primary_jurisdiction': 'England',
            'regulatory_requirements': {
                'England': ['SIA_LICENSE', 'HEALTH_SAFETY'],
                'Scotland': ['SIA_LICENSE'],
                'Wales': ['SIA_LICENSE']
            },
            'compliance_certifications': ['ISO_9001', 'BS_7858'],
            'standard_working_hours': {
                'max_daily_hours': 12,
                'max_weekly_hours': 48,
                'rest_between_shifts': 11
            },
            'overtime_policies': {
                'overtime_rate': 1.5,
                'max_overtime_hours': 12
            },
            'break_requirements': {
                'min_break_duration': 30,
                'break_frequency': 6
            },
            'public_holidays': ['2024-01-01', '2024-12-25'],
            'minimum_leave_entitlement': 28
        }
        
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        print("✓ Endpoint 4: PUT /api/v1/onboarding/regional-setup/ - Working")
    
    def test_endpoint_5_save_staff_config(self):
        """Test PUT /api/v1/onboarding/staff-config/"""
        url = '/api/v1/onboarding/staff-config/'
        data = {
            'expected_staff_count': 25,
            'staff_categories': ['Door Supervisor', 'Security Guard', 'CCTV Operator'],
            'shift_patterns': {
                'standard': {'start': '09:00', 'end': '17:00'},
                'night': {'start': '22:00', 'end': '06:00'}
            },
            'shift_approval_required': True,
            'allow_shift_swapping': True,
            'venue_types': ['Event', 'Retail', 'Corporate'],
            'gps_tracking_required': True,
            'default_pay_rates': {
                'door_supervisor': 12.50,
                'security_guard': 11.00,
                'cctv_operator': 13.00
            },
            'payment_frequency': 'weekly',
            'required_licenses': ['SIA_DS', 'SIA_SG'],
            'required_certifications': ['First Aid', 'Conflict Management']
        }
        
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        print("✓ Endpoint 5: PUT /api/v1/onboarding/staff-config/ - Working")
    
    def test_endpoint_6_save_integrations(self):
        """Test PUT /api/v1/onboarding/integrations/"""
        url = '/api/v1/onboarding/integrations/'
        data = {
            'deputy_enabled': True,
            'deputy_api_key': 'test_api_key_123',
            'deputy_endpoint': 'https://api.deputy.com',
            'payroll_system': 'xero',
            'payroll_credentials': {'client_id': 'test_client', 'client_secret': 'test_secret'},
            'accounting_system': 'quickbooks',
            'accounting_credentials': {'api_key': 'test_accounting_key'},
            'communication_platform': 'slack',
            'communication_credentials': {'webhook_url': 'https://hooks.slack.com/test'},
            'email_notifications_enabled': True,
            'sms_notifications_enabled': False,
            'push_notifications_enabled': True
        }
        
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        print("✓ Endpoint 6: PUT /api/v1/onboarding/integrations/ - Working")
    
    def test_endpoint_7_complete_onboarding(self):
        """Test POST /api/v1/onboarding/complete/"""
        # First, mark all steps as completed
        self.onboarding.company_info_completed = True
        self.onboarding.regional_setup_completed = True
        self.onboarding.staff_setup_completed = True
        self.onboarding.integrations_completed = True
        self.onboarding.save()
        
        url = '/api/v1/onboarding/complete/'
        
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('company', response.data)
        print("✓ Endpoint 7: POST /api/v1/onboarding/complete/ - Working")
    
    def test_endpoint_8_get_current_company(self):
        """Test GET /api/v1/companies/current/"""
        url = '/api/v1/companies/current/'
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('company', response.data)
        self.assertIn('membership', response.data)
        print("✓ Endpoint 8: GET /api/v1/companies/current/ - Working")
    
    def test_security_unauthenticated_access(self):
        """Test that unauthenticated users cannot access onboarding endpoints"""
        self.client.logout()
        
        endpoints = [
            '/api/v1/onboarding/initiate/',
            '/api/v1/onboarding/progress/',
            '/api/v1/onboarding/company-info/',
            '/api/v1/onboarding/regional-setup/',
            '/api/v1/onboarding/staff-config/',
            '/api/v1/onboarding/integrations/',
            '/api/v1/onboarding/complete/',
            '/api/v1/companies/current/',
        ]
        
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        print("✓ Security: All endpoints properly protected from unauthenticated access")
    
    def run_all_tests(self):
        """Run all endpoint tests"""
        print("=" * 60)
        print("TESTING SECURITY FIRM ONBOARDING API ENDPOINTS")
        print("=" * 60)
        
        try:
            self.setUp()
            
            # Test all endpoints
            self.test_endpoint_1_initiate_onboarding()
            self.test_endpoint_2_get_progress()
            self.test_endpoint_3_save_company_info()
            self.test_endpoint_4_save_regional_setup()
            self.test_endpoint_5_save_staff_config()
            self.test_endpoint_6_save_integrations()
            self.test_endpoint_7_complete_onboarding()
            self.test_endpoint_8_get_current_company()
            self.test_security_unauthenticated_access()
            
            print("\n" + "=" * 60)
            print("✅ ALL TESTS PASSED!")
            print("🚀 Security Firm Onboarding System API is ready for production!")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n❌ TEST FAILED: {str(e)}")
            print("=" * 60)
            raise


def main():
    """Main function to run the tests"""
    test = OnboardingEndpointTest()
    test.run_all_tests()


if __name__ == '__main__':
    main()