"""
Tests for notification API endpoints, specifically device token management.
"""
from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import SNSDeviceToken

User = get_user_model()


class SNSDeviceTokenViewSetTests(APITestCase):
    """Test cases for /api/v1/notifications/devices/ endpoints"""

    def setUp(self):
        """Set up test data for all test methods"""
        # Create test users
        self.user1 = User.objects.create_user(
            username='testuser1',
            email='user1@test.com',
            password='testpass123',
            role='staff',
            first_name='Test',
            last_name='User1'
        )
        self.user2 = User.objects.create_user(
            username='testuser2',
            email='user2@test.com',
            password='testpass123',
            role='staff',
            first_name='Test',
            last_name='User2'
        )

        # Create device tokens
        self.token1 = SNSDeviceToken.objects.create(
            user=self.user1,
            token='ExponentPushToken[test-token-user1-device1]',
            platform='ios',
            device_id='device-1',
            is_active=True
        )
        self.token2 = SNSDeviceToken.objects.create(
            user=self.user1,
            token='ExponentPushToken[test-token-user1-device2]',
            platform='android',
            device_id='device-2',
            is_active=True
        )
        self.token3 = SNSDeviceToken.objects.create(
            user=self.user2,
            token='ExponentPushToken[test-token-user2-device1]',
            platform='ios',
            device_id='device-3',
            is_active=True
        )

    def test_deactivate_by_token_success(self):
        """Test successful deactivation of a device token by its value"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            '/api/v1/notifications/devices/deactivate_by_token/',
            {'token': 'ExponentPushToken[test-token-user1-device1]'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'Device token deactivated')

        # Verify token is actually deactivated
        self.token1.refresh_from_db()
        self.assertFalse(self.token1.is_active)

    def test_deactivate_by_token_missing_token_value(self):
        """Test deactivation fails when token value is not provided"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            '/api/v1/notifications/devices/deactivate_by_token/',
            {}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Token value is required')

    def test_deactivate_by_token_not_found(self):
        """Test deactivation when token doesn't exist for user"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            '/api/v1/notifications/devices/deactivate_by_token/',
            {'token': 'ExponentPushToken[nonexistent-token]'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'No matching token found for user')

    def test_deactivate_by_token_security_cannot_deactivate_other_user_token(self):
        """Test that a user cannot deactivate another user's token"""
        self.client.force_authenticate(user=self.user1)

        # Try to deactivate user2's token
        response = self.client.post(
            '/api/v1/notifications/devices/deactivate_by_token/',
            {'token': 'ExponentPushToken[test-token-user2-device1]'}
        )

        # Should return "not found" rather than deactivating
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'No matching token found for user')

        # Verify user2's token is still active
        self.token3.refresh_from_db()
        self.assertTrue(self.token3.is_active)

    def test_deactivate_by_token_requires_authentication(self):
        """Test that authentication is required to deactivate tokens"""
        # No authentication
        response = self.client.post(
            '/api/v1/notifications/devices/deactivate_by_token/',
            {'token': 'ExponentPushToken[test-token-user1-device1]'}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_register_new_token(self):
        """Test registering a new device token"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            '/api/v1/notifications/devices/',
            {
                'token': 'ExponentPushToken[brand-new-token]',
                'platform': 'ios',
                'device_id': 'new-device-id'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify token was created
        self.assertTrue(
            SNSDeviceToken.objects.filter(
                token='ExponentPushToken[brand-new-token]',
                user=self.user1
            ).exists()
        )

    def test_token_reassignment_on_new_user_login(self):
        """Test that token gets reassigned when a different user registers the same token"""
        # First, user1 has token1
        self.assertEqual(self.token1.user, self.user1)

        # Now user2 logs in on the same device and registers the same token
        self.client.force_authenticate(user=self.user2)

        response = self.client.post(
            '/api/v1/notifications/devices/',
            {
                'token': 'ExponentPushToken[test-token-user1-device1]',
                'platform': 'ios',
                'device_id': 'device-1'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify token is now assigned to user2
        self.token1.refresh_from_db()
        self.assertEqual(self.token1.user, self.user2)
        self.assertTrue(self.token1.is_active)

    def test_list_user_tokens(self):
        """Test listing a user's registered tokens"""
        self.client.force_authenticate(user=self.user1)

        response = self.client.get('/api/v1/notifications/devices/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # API returns paginated response with 'count' and 'results'
        results = response.data.get('results', response.data)
        count = response.data.get('count', len(results))

        # User1 has 2 tokens
        self.assertEqual(count, 2)
        self.assertEqual(len(results), 2)

        # Verify only user1's tokens are returned
        token_values = [t['token'] for t in results]
        self.assertIn('ExponentPushToken[test-token-user1-device1]', token_values)
        self.assertIn('ExponentPushToken[test-token-user1-device2]', token_values)
        self.assertNotIn('ExponentPushToken[test-token-user2-device1]', token_values)
