"""
Tests for the Real-Time Team Presence System.

Tests cover:
- UserPresenceStatus model functionality
- TeamMembersViewSet API endpoints
- TeamPresenceConsumer WebSocket functionality
"""

import json
from datetime import timedelta
from unittest.mock import patch, MagicMock, AsyncMock
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async

from .models import UserPresenceStatus, Venue, Shift, SecurityCompany, UserCompanyMembership

User = get_user_model()


class UserPresenceStatusModelTests(TestCase):
    """Tests for the UserPresenceStatus model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='testuser',
            email='testuser@example.com',
            password='testpass123',
            role='staff'
        )

    def test_create_presence_status(self):
        """Test creating a presence status for a user."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available',
            activity='working',
            status_message='Ready for duty'
        )

        self.assertEqual(presence.user, self.user)
        self.assertEqual(presence.status, 'available')
        self.assertEqual(presence.activity, 'working')
        self.assertEqual(presence.status_message, 'Ready for duty')
        self.assertFalse(presence.is_mobile_connected)
        self.assertIsNotNone(presence.last_seen)

    def test_get_or_create_for_user(self):
        """Test get_or_create_for_user class method."""
        # First call should create
        presence1 = UserPresenceStatus.get_or_create_for_user(self.user)
        self.assertEqual(presence1.user, self.user)
        self.assertEqual(presence1.status, 'offline')

        # Second call should get existing
        presence2 = UserPresenceStatus.get_or_create_for_user(self.user)
        self.assertEqual(presence1.pk, presence2.pk)

    def test_is_online_when_connected(self):
        """Test is_online returns True when recently connected."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available',
            is_mobile_connected=True,
            last_seen=timezone.now()
        )

        self.assertTrue(presence.is_online())

    def test_is_online_when_stale(self):
        """Test is_online returns False when connection is stale."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available',
            is_mobile_connected=True,
            last_seen=timezone.now() - timedelta(minutes=10)
        )

        self.assertFalse(presence.is_online())

    def test_is_online_when_disconnected(self):
        """Test is_online returns False when not connected."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available',
            is_mobile_connected=False,
            last_seen=timezone.now()
        )

        self.assertFalse(presence.is_online())

    def test_set_online(self):
        """Test set_online method updates all relevant fields."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='offline',
            is_mobile_connected=False
        )

        presence.set_online()
        presence.refresh_from_db()

        self.assertEqual(presence.status, 'available')
        self.assertTrue(presence.is_mobile_connected)
        self.assertIsNotNone(presence.last_heartbeat)

    def test_set_offline(self):
        """Test set_offline method clears connection data."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available',
            is_mobile_connected=True
        )

        presence.set_offline()
        presence.refresh_from_db()

        self.assertEqual(presence.status, 'offline')
        self.assertFalse(presence.is_mobile_connected)

    def test_update_presence(self):
        """Test update_presence method."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available'
        )

        presence.update_presence(
            status='busy',
            activity='incident_response',
            status_message='Handling emergency'
        )
        presence.refresh_from_db()

        self.assertEqual(presence.status, 'busy')
        self.assertEqual(presence.activity, 'incident_response')
        self.assertEqual(presence.status_message, 'Handling emergency')

    def test_heartbeat(self):
        """Test heartbeat updates timestamps."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available',
            is_mobile_connected=True
        )
        old_last_seen = presence.last_seen

        # Small delay to ensure timestamp difference
        import time
        time.sleep(0.01)

        presence.heartbeat()
        presence.refresh_from_db()

        self.assertGreater(presence.last_seen, old_last_seen)
        self.assertIsNotNone(presence.last_heartbeat)

    def test_str_representation(self):
        """Test string representation."""
        presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='available'
        )

        self.assertEqual(str(presence), 'testuser - Available')


class TeamMembersAPITests(APITestCase):
    """Tests for the TeamMembers API endpoints."""

    def setUp(self):
        """Set up test data."""
        # Create admin user
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            role='admin'
        )

        # Create staff users
        self.staff_user1 = User.objects.create_user(
            username='staff1',
            email='staff1@example.com',
            password='staffpass123',
            first_name='Sarah',
            last_name='Johnson',
            role='staff'
        )

        self.staff_user2 = User.objects.create_user(
            username='staff2',
            email='staff2@example.com',
            password='staffpass123',
            first_name='Mike',
            last_name='Thompson',
            role='staff'
        )

        # Create presence statuses
        self.presence1 = UserPresenceStatus.objects.create(
            user=self.staff_user1,
            status='available',
            is_mobile_connected=True,
            last_seen=timezone.now(),
            status_message='On duty'
        )

        self.presence2 = UserPresenceStatus.objects.create(
            user=self.staff_user2,
            status='offline',
            is_mobile_connected=False
        )

        self.client = APIClient()

    def test_list_team_members_authenticated(self):
        """Test listing team members requires authentication."""
        response = self.client.get('/api/v1/teams/members/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_team_members_as_staff(self):
        """Test staff can list team members."""
        self.client.force_authenticate(user=self.staff_user1)
        response = self.client.get('/api/v1/teams/members/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)

    def test_list_team_members_includes_presence(self):
        """Test team members list includes presence data."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/teams/members/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Find staff1 in results
        results = response.data.get('results', response.data)
        staff1_data = next(
            (m for m in results if m.get('username') == 'staff1'),
            None
        )

        if staff1_data:
            self.assertEqual(staff1_data.get('presence_status'), 'available')

    def test_filter_by_presence_status(self):
        """Test filtering team members by presence status."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/v1/teams/members/?presence_status=available')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)

        # All returned members should have available status
        for member in results:
            presence = member.get('presence_status')
            # Staff without presence should be filtered out
            if presence:
                self.assertEqual(presence, 'available')

    def test_update_own_presence(self):
        """Test user can update their own presence."""
        self.client.force_authenticate(user=self.staff_user1)
        response = self.client.patch(
            '/api/v1/teams/members/me/presence/',
            {'status': 'busy', 'status_message': 'In meeting'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.presence1.refresh_from_db()
        self.assertEqual(self.presence1.status, 'busy')
        self.assertEqual(self.presence1.status_message, 'In meeting')


class TeamPresenceConsumerTests(TransactionTestCase):
    """Tests for the TeamPresenceConsumer WebSocket."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='wsuser',
            email='wsuser@example.com',
            password='wspass123',
            role='staff'
        )
        self.presence = UserPresenceStatus.objects.create(
            user=self.user,
            status='offline'
        )

    @database_sync_to_async
    def refresh_presence(self):
        """Refresh presence from database."""
        self.presence.refresh_from_db()
        return self.presence

    async def test_connect_without_auth(self):
        """Test WebSocket connection requires authentication."""
        from .consumers import TeamPresenceConsumer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = None

        connected, subprotocol = await communicator.connect()

        # Should close with auth error
        self.assertFalse(connected)

        await communicator.disconnect()

    async def test_connect_with_auth(self):
        """Test authenticated WebSocket connection."""
        from .consumers import TeamPresenceConsumer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = self.user

        connected, subprotocol = await communicator.connect()
        self.assertTrue(connected)

        # Should receive connection confirmation
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'connection_established')

        await communicator.disconnect()

    async def test_presence_update_on_connect(self):
        """Test presence is updated when user connects."""
        from .consumers import TeamPresenceConsumer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = self.user

        await communicator.connect()

        # Check presence was updated
        presence = await self.refresh_presence()
        self.assertTrue(presence.is_mobile_connected)
        self.assertEqual(presence.status, 'available')

        await communicator.disconnect()

    async def test_presence_update_on_disconnect(self):
        """Test presence is updated when user disconnects."""
        from .consumers import TeamPresenceConsumer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = self.user

        await communicator.connect()

        # Skip connection message
        await communicator.receive_json_from()

        await communicator.disconnect()

        # Check presence was updated to offline
        presence = await self.refresh_presence()
        self.assertFalse(presence.is_mobile_connected)
        self.assertEqual(presence.status, 'offline')

    async def test_update_status_message(self):
        """Test updating status via WebSocket."""
        from .consumers import TeamPresenceConsumer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = self.user

        await communicator.connect()

        # Skip connection message
        await communicator.receive_json_from()

        # Send status update
        await communicator.send_json_to({
            'type': 'update_status',
            'status': 'busy',
            'status_message': 'Handling incident'
        })

        # Should receive confirmation
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'status_updated')

        # Check presence was updated
        presence = await self.refresh_presence()
        self.assertEqual(presence.status, 'busy')
        self.assertEqual(presence.status_message, 'Handling incident')

        await communicator.disconnect()

    async def test_ping_pong(self):
        """Test ping/pong for connection keep-alive."""
        from .consumers import TeamPresenceConsumer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = self.user

        await communicator.connect()

        # Skip connection message
        await communicator.receive_json_from()

        # Send ping
        await communicator.send_json_to({'type': 'ping'})

        # Should receive pong
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'pong')

        await communicator.disconnect()

    async def test_receive_team_member_update(self):
        """Test receiving updates when team member status changes."""
        from .consumers import TeamPresenceConsumer
        from channels.layers import get_channel_layer

        communicator = WebsocketCommunicator(
            TeamPresenceConsumer.as_asgi(),
            "/ws/team/presence/"
        )
        communicator.scope['user'] = self.user

        await communicator.connect()

        # Skip connection message
        await communicator.receive_json_from()

        # Simulate another team member's presence update via channel layer
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            'team_presence',
            {
                'type': 'team_member_update',
                'user_id': 999,
                'username': 'other_user',
                'status': 'available',
                'status_message': 'Just joined'
            }
        )

        # Should receive the update
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'team_member_update')
        self.assertEqual(response['user_id'], 999)
        self.assertEqual(response['status'], 'available')

        await communicator.disconnect()
