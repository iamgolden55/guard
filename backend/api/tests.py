from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import User, StaffProfile
import json

class AuthenticationRedirectionTests(TestCase):
    """Test suite for authentication and role-based redirection"""
    
    def setUp(self):
        """Set up test data - create users with different roles"""
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@example.com',
            password='adminpassword123'
        )
        self.admin_user.role = 'admin'
        self.admin_user.save()
        
        # Create manager user
        self.manager_user = User.objects.create_user(
            username='manager_test',
            email='manager@example.com',
            password='managerpassword123'
        )
        self.manager_user.role = 'manager'
        self.manager_user.save()
        
        # Create staff user
        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@example.com',
            password='staffpassword123'
        )
        self.staff_user.role = 'staff'
        self.staff_user.security_roles = ['ds', 'sg']  # Door Supervisor and Security Guard
        self.staff_user.save()
        
        # Setup API client
        self.client = APIClient()
        self.login_url = reverse('login')

    def test_admin_login_response(self):
        """Test admin login returns correct role in response"""
        login_data = {
            'username': 'admin_test',
            'password': 'adminpassword123'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = json.loads(response.content)
        self.assertEqual(response_data['user']['role'], 'admin')
        self.assertIn('tokens', response_data)
        self.assertIn('access', response_data['tokens'])
        
    def test_manager_login_response(self):
        """Test manager login returns correct role in response"""
        login_data = {
            'username': 'manager_test',
            'password': 'managerpassword123'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = json.loads(response.content)
        self.assertEqual(response_data['user']['role'], 'manager')
        self.assertIn('tokens', response_data)
        self.assertIn('access', response_data['tokens'])
        
    def test_staff_login_response(self):
        """Test staff login returns correct role in response"""
        login_data = {
            'username': 'staff_test',
            'password': 'staffpassword123'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response_data = json.loads(response.content)
        self.assertEqual(response_data['user']['role'], 'staff')
        self.assertIn('tokens', response_data)
        self.assertIn('access', response_data['tokens'])
        
    def test_invalid_login_credentials(self):
        """Test login with invalid credentials"""
        login_data = {
            'username': 'admin_test',
            'password': 'wrongpassword'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_login_credentials(self):
        """Test login with missing credentials"""
        # Missing password
        login_data = {
            'username': 'admin_test'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Missing username
        login_data = {
            'password': 'adminpassword123'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class RoleBasedAccessTests(TestCase):
    """Test suite for role-based access controls"""
    
    def setUp(self):
        """Set up test data - create users with different roles and authenticate them"""
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@example.com',
            password='adminpassword123'
        )
        self.admin_user.role = 'admin'
        self.admin_user.save()
        
        # Create manager user
        self.manager_user = User.objects.create_user(
            username='manager_test',
            email='manager@example.com',
            password='managerpassword123'
        )
        self.manager_user.role = 'manager'
        self.manager_user.save()
        
        # Create staff user
        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@example.com',
            password='staffpassword123'
        )
        self.staff_user.role = 'staff'
        self.staff_user.security_roles = ['ds', 'sg']  # Door Supervisor and Security Guard
        self.staff_user.save()
        
        # Setup API clients
        self.admin_client = APIClient()
        self.manager_client = APIClient()
        self.staff_client = APIClient()
        self.anonymous_client = APIClient()
        
        # Authenticate clients
        self.admin_client.force_authenticate(user=self.admin_user)
        self.manager_client.force_authenticate(user=self.manager_user)
        self.staff_client.force_authenticate(user=self.staff_user)
    
    def test_user_list_access(self):
        """Test role-based access to user list"""
        url = reverse('user-list')
        
        # Admin should have access
        admin_response = self.admin_client.get(url)
        self.assertEqual(admin_response.status_code, status.HTTP_200_OK)
        # Admin should see all users
        admin_data = json.loads(admin_response.content)
        self.assertEqual(len(admin_data), 3)  # All 3 test users
        
        # Manager should have access to users
        manager_response = self.manager_client.get(url)
        self.assertEqual(manager_response.status_code, status.HTTP_200_OK)
        # Manager should see all users
        manager_data = json.loads(manager_response.content)
        self.assertEqual(len(manager_data), 3)  # All 3 test users
        
        # Staff should only see themselves
        staff_response = self.staff_client.get(url)
        self.assertEqual(staff_response.status_code, status.HTTP_200_OK)
        staff_data = json.loads(staff_response.content)
        self.assertEqual(len(staff_data), 1)  # Only their own user
        
        # Anonymous should not have access
        anonymous_response = self.anonymous_client.get(url)
        self.assertEqual(anonymous_response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_permission_persistence(self):
        """Test that user permissions persist across requests"""
        # Get profile data multiple times to verify permissions persist
        url = reverse('user-detail', args=[self.staff_user.id])
        
        # First request
        response1 = self.staff_client.get(url)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Second request
        response2 = self.staff_client.get(url)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        
    def test_permission_revocation_on_logout(self):
        """Test that permissions are properly revoked on logout"""
        # First, verify authenticated access
        url = reverse('user-detail', args=[self.staff_user.id])
        response1 = self.staff_client.get(url)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Log out
        self.staff_client.logout()
        
        # Verify access is now denied
        response2 = self.staff_client.get(url)
        self.assertEqual(response2.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_unauthorized_access_attempts(self):
        """Test that unauthorized access attempts are properly rejected"""
        # Staff trying to access another user's details
        other_user_url = reverse('user-detail', args=[self.manager_user.id])
        staff_response = self.staff_client.get(other_user_url)
        self.assertEqual(staff_response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Manager trying to access admin resources (assuming normal managers don't have admin panel access)
        # This would depend on your specific admin endpoints

class UserProfileUpdateTests(TestCase):
    """Test suite for user profile updates"""
    
    def setUp(self):
        """Set up test data - create users and profiles"""
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@example.com',
            password='adminpassword123'
        )
        self.admin_user.role = 'admin'
        self.admin_user.save()
        
        # Create staff user with profile
        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@example.com',
            password='staffpassword123'
        )
        self.staff_user.role = 'staff'
        self.staff_user.save()
        
        # Create staff profile
        self.staff_profile = StaffProfile.objects.create(
            user=self.staff_user,
            phone_number='1234567890',
            date_of_birth='1990-01-01',
            national_insurance_number='AB123456C',
            street='123 Test Street',
            city='Test City',
            postal_code='TE1 1ST',
            country='United Kingdom',
            notes='Test notes'
        )
        
        # Setup API clients
        self.admin_client = APIClient()
        self.staff_client = APIClient()
        
        # Authenticate clients
        self.admin_client.force_authenticate(user=self.admin_user)
        self.staff_client.force_authenticate(user=self.staff_user)
    
    def test_get_own_profile(self):
        """Test that a user can get their own profile"""
        url = reverse('staffprofile-detail', args=[self.staff_profile.id])
        response = self.staff_client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone_number'], '1234567890')
        self.assertEqual(response.data['user'], self.staff_user.id)
    
    def test_update_own_profile(self):
        """Test that a user can update their own profile"""
        url = reverse('staffprofile-detail', args=[self.staff_profile.id])
        update_data = {
            'phone_number': '9876543210',
            'street': '456 New Street',
            'city': 'New City',
            'postal_code': 'NE2 2ST',
            'notes': 'Updated notes'
        }
        
        response = self.staff_client.patch(url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone_number'], '9876543210')
        self.assertEqual(response.data['street'], '456 New Street')
        self.assertEqual(response.data['city'], 'New City')
        
        # Verify changes in database
        profile = StaffProfile.objects.get(id=self.staff_profile.id)
        self.assertEqual(profile.phone_number, '9876543210')
        self.assertEqual(profile.street, '456 New Street')
    
    def test_update_immutable_fields(self):
        """Test that immutable fields like national_insurance_number cannot be changed"""
        url = reverse('staffprofile-detail', args=[self.staff_profile.id])
        update_data = {
            'phone_number': '9876543210',
            'national_insurance_number': 'XY987654Z' # This should not change
        }
        
        response = self.staff_client.patch(url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone_number'], '9876543210')
        self.assertEqual(response.data['national_insurance_number'], 'AB123456C')  # Original value
        
        # Verify database
        profile = StaffProfile.objects.get(id=self.staff_profile.id)
        self.assertEqual(profile.national_insurance_number, 'AB123456C')  # Unchanged
    
    def test_admin_can_update_any_profile(self):
        """Test that an admin can update any user's profile"""
        url = reverse('staffprofile-detail', args=[self.staff_profile.id])
        update_data = {
            'phone_number': '5555555555',
            'notes': 'Admin updated notes'
        }
        
        response = self.admin_client.patch(url, update_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['phone_number'], '5555555555')
        self.assertEqual(response.data['notes'], 'Admin updated notes')
        
        # Verify database
        profile = StaffProfile.objects.get(id=self.staff_profile.id)
        self.assertEqual(profile.phone_number, '5555555555')
    
    def test_profile_updates_dont_affect_other_users(self):
        """Test that updates to one profile don't affect other users"""
        # Create another staff user with profile
        other_user = User.objects.create_user(
            username='other_staff',
            email='other@example.com',
            password='password123'
        )
        other_user.role = 'staff'
        other_user.save()
        
        other_profile = StaffProfile.objects.create(
            user=other_user,
            phone_number='1111111111',
            date_of_birth='1992-02-02',
            national_insurance_number='CD987654D',
            street='789 Other Street',
            city='Other City',
            postal_code='OT3 3ST',
            country='United Kingdom'
        )
        
        # Update first staff profile
        url = reverse('staffprofile-detail', args=[self.staff_profile.id])
        update_data = {
            'phone_number': '9999999999',
            'city': 'Updated City'
        }
        response = self.staff_client.patch(url, update_data, format='json')
        
        # Verify other profile is unchanged
        other_profile_url = reverse('staffprofile-detail', args=[other_profile.id])
        other_response = self.admin_client.get(other_profile_url)
        
        self.assertEqual(other_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.data['phone_number'], '1111111111')  # Unchanged
        self.assertEqual(other_response.data['city'], 'Other City')  # Unchanged
