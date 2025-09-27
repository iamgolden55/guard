"""
Tests for the multi-tenant onboarding models.
"""
import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from .models import (
    SecurityCompany,
    UserCompanyMembership,
    CompanyOnboarding,
    CompanyIntegration,
    Venue
)

User = get_user_model()


class SecurityCompanyModelTest(TestCase):
    """Test SecurityCompany model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testowner',
            email='owner@example.com',
            password='testpass123'
        )

    def test_create_security_company(self):
        """Test creating a security company"""
        company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678',
            created_by=self.user
        )

        self.assertEqual(company.name, 'Test Security Ltd')
        self.assertEqual(company.registration_number, 'TS123456')
        self.assertEqual(company.country_code, 'GBR')
        self.assertEqual(company.subscription_tier, 'starter')
        self.assertTrue(company.is_active)
        self.assertFalse(company.is_trial)

    def test_security_company_str_representation(self):
        """Test string representation of SecurityCompany"""
        company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678',
            subscription_tier='professional'
        )

        expected_str = 'Test Security Ltd (Professional)'
        self.assertEqual(str(company), expected_str)

    def test_security_company_capacity_checks(self):
        """Test capacity checking methods"""
        company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678',
            staff_capacity=5,
            venue_capacity=3
        )

        # Initially no staff or venues
        self.assertTrue(company.can_add_staff())
        self.assertTrue(company.can_add_venue())
        self.assertEqual(company.get_current_staff_count(), 0)
        self.assertEqual(company.get_current_venue_count(), 0)

    def test_security_company_subscription_status(self):
        """Test subscription status checking"""
        # Active subscription
        company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678'
        )
        self.assertEqual(company.get_subscription_status(), 'active')

        # Trial active
        company.is_trial = True
        company.trial_end_date = timezone.now() + timedelta(days=7)
        self.assertEqual(company.get_subscription_status(), 'trial_active')

        # Trial expired
        company.trial_end_date = timezone.now() - timedelta(days=1)
        self.assertEqual(company.get_subscription_status(), 'trial_expired')

    def test_feature_enabled_check(self):
        """Test feature enabled checking"""
        company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678',
            features_enabled={
                'advanced_reporting': True,
                'api_access': False
            }
        )

        self.assertTrue(company.is_feature_enabled('advanced_reporting'))
        self.assertFalse(company.is_feature_enabled('api_access'))
        self.assertFalse(company.is_feature_enabled('non_existent_feature'))


class UserCompanyMembershipModelTest(TestCase):
    """Test UserCompanyMembership model functionality"""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='testpass123'
        )
        self.staff_user = User.objects.create_user(
            username='staff',
            email='staff@example.com',
            password='testpass123'
        )
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678'
        )

    def test_create_user_company_membership(self):
        """Test creating a user company membership"""
        membership = UserCompanyMembership.objects.create(
            user=self.staff_user,
            company=self.company,
            role='staff'
        )

        self.assertEqual(membership.user, self.staff_user)
        self.assertEqual(membership.company, self.company)
        self.assertEqual(membership.role, 'staff')
        self.assertTrue(membership.is_active)
        self.assertFalse(membership.is_owner)

    def test_owner_membership(self):
        """Test creating owner membership"""
        membership = UserCompanyMembership.objects.create(
            user=self.owner,
            company=self.company,
            role='owner',
            is_owner=True
        )

        self.assertTrue(membership.is_owner)
        self.assertEqual(membership.role, 'owner')

    def test_membership_permissions(self):
        """Test membership permissions"""
        membership = UserCompanyMembership.objects.create(
            user=self.staff_user,
            company=self.company,
            role='manager',
            permissions={
                'manage_shifts': True,
                'view_reports': False
            }
        )

        self.assertTrue(membership.has_permission('manage_shifts'))
        self.assertFalse(membership.has_permission('view_reports'))
        self.assertFalse(membership.has_permission('non_existent_permission'))

    def test_invitation_validity(self):
        """Test invitation validity checking"""
        # Valid invitation
        membership = UserCompanyMembership.objects.create(
            user=self.staff_user,
            company=self.company,
            invitation_status='pending',
            invitation_expires_at=timezone.now() + timedelta(days=7)
        )
        self.assertTrue(membership.is_invitation_valid())

        # Expired invitation
        membership.invitation_expires_at = timezone.now() - timedelta(days=1)
        self.assertFalse(membership.is_invitation_valid())

        # Already accepted
        membership.invitation_status = 'accepted'
        self.assertFalse(membership.is_invitation_valid())

    def test_unique_user_company_constraint(self):
        """Test that a user can only have one membership per company"""
        UserCompanyMembership.objects.create(
            user=self.staff_user,
            company=self.company,
            role='staff'
        )

        # Should raise IntegrityError for duplicate
        with self.assertRaises(Exception):
            UserCompanyMembership.objects.create(
                user=self.staff_user,
                company=self.company,
                role='manager'
            )


class CompanyOnboardingModelTest(TestCase):
    """Test CompanyOnboarding model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678'
        )

    def test_create_company_onboarding(self):
        """Test creating company onboarding"""
        onboarding = CompanyOnboarding.objects.create(
            company=self.company
        )

        self.assertEqual(onboarding.company, self.company)
        self.assertEqual(onboarding.current_step, 1)
        self.assertEqual(onboarding.total_steps, 5)
        self.assertFalse(onboarding.is_completed)
        self.assertEqual(onboarding.progress_percentage, 0)

    def test_onboarding_step_progression(self):
        """Test step completion and progression"""
        onboarding = CompanyOnboarding.objects.create(
            company=self.company
        )

        # Complete first step
        onboarding.mark_step_completed(1)
        self.assertTrue(onboarding.company_info_completed)
        self.assertEqual(onboarding.current_step, 2)
        self.assertEqual(onboarding.progress_percentage, 20)

        # Complete all steps
        for step in range(2, 6):
            onboarding.mark_step_completed(step)

        self.assertTrue(onboarding.is_completed)
        self.assertEqual(onboarding.progress_percentage, 100)
        self.assertIsNotNone(onboarding.completed_at)

    def test_next_step_logic(self):
        """Test get_next_step logic"""
        onboarding = CompanyOnboarding.objects.create(
            company=self.company
        )

        self.assertEqual(onboarding.get_next_step(), 1)

        onboarding.mark_step_completed(1)
        self.assertEqual(onboarding.get_next_step(), 2)

        onboarding.mark_step_completed(2)
        onboarding.mark_step_completed(3)
        onboarding.mark_step_completed(4)
        self.assertEqual(onboarding.get_next_step(), 5)

        onboarding.mark_step_completed(5)
        self.assertIsNone(onboarding.get_next_step())

    def test_session_activity_update(self):
        """Test session activity tracking"""
        onboarding = CompanyOnboarding.objects.create(
            company=self.company
        )

        session_id = 'test_session_123'
        onboarding.update_session_activity(session_id)

        self.assertEqual(onboarding.session_id, session_id)
        self.assertIsNotNone(onboarding.last_step_accessed)


class CompanyIntegrationModelTest(TestCase):
    """Test CompanyIntegration model functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678'
        )

    def test_create_company_integration(self):
        """Test creating company integration"""
        integration = CompanyIntegration.objects.create(
            company=self.company,
            integration_type='deputy',
            name='Deputy Integration',
            configured_by=self.user
        )

        self.assertEqual(integration.company, self.company)
        self.assertEqual(integration.integration_type, 'deputy')
        self.assertEqual(integration.status, 'inactive')
        self.assertTrue(integration.is_enabled)
        self.assertEqual(integration.health_status, 'unknown')

    def test_integration_connection_test(self):
        """Test integration connection testing"""
        integration = CompanyIntegration.objects.create(
            company=self.company,
            integration_type='deputy',
            name='Deputy Integration',
            configured_by=self.user
        )

        result = integration.test_connection()
        self.assertTrue(result)
        self.assertEqual(integration.health_status, 'healthy')
        self.assertIsNotNone(integration.last_health_check)

    def test_integration_sync(self):
        """Test integration synchronization"""
        integration = CompanyIntegration.objects.create(
            company=self.company,
            integration_type='deputy',
            name='Deputy Integration',
            configured_by=self.user
        )

        result = integration.perform_sync()
        self.assertTrue(result)
        self.assertIsNotNone(integration.last_sync_at)

    def test_unique_integration_constraint(self):
        """Test unique constraint on company, type, and name"""
        CompanyIntegration.objects.create(
            company=self.company,
            integration_type='deputy',
            name='Deputy Integration',
            configured_by=self.user
        )

        # Should raise IntegrityError for duplicate
        with self.assertRaises(Exception):
            CompanyIntegration.objects.create(
                company=self.company,
                integration_type='deputy',
                name='Deputy Integration',
                configured_by=self.user
            )


class VenueCompanyRelationshipTest(TestCase):
    """Test Venue model company relationship"""

    def setUp(self):
        self.company = SecurityCompany.objects.create(
            name='Test Security Ltd',
            registration_number='TS123456',
            country_code='GBR',
            city='London',
            postal_code='SW1A 1AA',
            address_line_1='123 Test Street',
            billing_email='billing@testsecurity.com',
            primary_contact_name='John Doe',
            primary_contact_email='john@testsecurity.com',
            primary_contact_phone='+44 20 1234 5678'
        )

    def test_venue_company_relationship(self):
        """Test venue belongs to company"""
        venue = Venue.objects.create(
            company=self.company,
            name='Test Venue',
            address='123 Venue Street',
            city='London',
            postal_code='W1A 0AX',
            country='United Kingdom',
            capacity=500,
            contact_name='Jane Smith',
            contact_phone='+44 20 8765 4321',
            contact_email='jane@venue.com',
            description='Test venue description',
            terms_and_conditions='Test terms and conditions'
        )

        self.assertEqual(venue.company, self.company)
        self.assertIn(venue, self.company.venues.all())

    def test_venue_company_count(self):
        """Test company venue count"""
        # Create multiple venues
        for i in range(3):
            Venue.objects.create(
                company=self.company,
                name=f'Test Venue {i}',
                address=f'{i} Venue Street',
                city='London',
                postal_code='W1A 0AX',
                country='United Kingdom',
                capacity=500,
                contact_name='Jane Smith',
                contact_phone='+44 20 8765 4321',
                contact_email=f'jane{i}@venue.com',
                description='Test venue description',
                terms_and_conditions='Test terms and conditions'
            )

        self.assertEqual(self.company.get_current_venue_count(), 3)

        # Test venue capacity check
        self.company.venue_capacity = 2
        self.assertFalse(self.company.can_add_venue())