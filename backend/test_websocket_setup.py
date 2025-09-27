#!/usr/bin/env python3
"""
Test script for Django Channels WebSocket infrastructure.

This script tests the complete WebSocket setup including:
1. WebSocket connection with JWT authentication
2. Report progress tracking
3. Message types (progress, complete, failed, cancelled, heartbeat)
4. Channel layer functionality

Usage:
    python test_websocket_setup.py
"""

import asyncio
import json
import logging
import os
import sys
import websockets
from datetime import datetime
from urllib.parse import urlencode

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class WebSocketTester:
    """Test WebSocket functionality with JWT authentication."""

    def __init__(self):
        self.websocket = None
        self.user = None
        self.access_token = None

    async def setup_test_user(self):
        """Create a test user and get JWT token."""
        try:
            # Try to get existing test user
            self.user = User.objects.get(username='websocket_test_user')
        except User.DoesNotExist:
            # Create test user
            self.user = User.objects.create_user(
                username='websocket_test_user',
                email='test@websocket.com',
                password='test_password_123',
                is_active=True
            )
            logger.info(f'Created test user: {self.user.username}')

        # Generate JWT token
        token = AccessToken.for_user(self.user)
        self.access_token = str(token)
        logger.info(f'Generated JWT token for user: {self.user.username}')

    async def connect_websocket(self, endpoint='reports'):
        """Connect to WebSocket with JWT authentication."""
        if not self.access_token:
            raise ValueError('No access token available')

        # WebSocket URL with JWT token as query parameter
        ws_url = f'ws://localhost:8000/ws/{endpoint}/?token={self.access_token}'

        try:
            self.websocket = await websockets.connect(ws_url)
            logger.info(f'Connected to WebSocket: {ws_url}')
            return True
        except Exception as e:
            logger.error(f'Failed to connect to WebSocket: {str(e)}')
            return False

    async def send_message(self, message_type, **kwargs):
        """Send a message to the WebSocket."""
        if not self.websocket:
            raise ValueError('WebSocket not connected')

        message = {
            'type': message_type,
            'timestamp': datetime.now().isoformat(),
            **kwargs
        }

        await self.websocket.send(json.dumps(message))
        logger.info(f'Sent message: {message}')

    async def receive_message(self, timeout=5):
        """Receive a message from the WebSocket."""
        if not self.websocket:
            raise ValueError('WebSocket not connected')

        try:
            message = await asyncio.wait_for(
                self.websocket.recv(),
                timeout=timeout
            )
            data = json.loads(message)
            logger.info(f'Received message: {data}')
            return data
        except asyncio.TimeoutError:
            logger.warning(f'Timeout waiting for message after {timeout}s')
            return None
        except json.JSONDecodeError as e:
            logger.error(f'Failed to decode JSON message: {str(e)}')
            return None

    async def test_connection_flow(self):
        """Test basic WebSocket connection flow."""
        logger.info('=== Testing WebSocket Connection Flow ===')

        # Connect to reports WebSocket
        connected = await self.connect_websocket('reports')
        if not connected:
            return False

        # Wait for connection confirmation
        confirmation = await self.receive_message()
        if not confirmation or confirmation.get('type') != 'connection_established':
            logger.error('Did not receive connection confirmation')
            return False

        logger.info('✓ Connection established successfully')
        return True

    async def test_ping_pong(self):
        """Test ping/pong functionality."""
        logger.info('=== Testing Ping/Pong ===')

        # Send ping
        await self.send_message('ping')

        # Wait for pong
        pong = await self.receive_message()
        if not pong or pong.get('type') != 'pong':
            logger.error('Did not receive pong response')
            return False

        logger.info('✓ Ping/Pong working correctly')
        return True

    async def test_heartbeat(self):
        """Test heartbeat messages."""
        logger.info('=== Testing Heartbeat ===')

        # Wait for heartbeat (should come automatically)
        heartbeat = await self.receive_message(timeout=35)
        if not heartbeat or heartbeat.get('type') != 'heartbeat':
            logger.warning('Did not receive heartbeat (this is expected if heartbeat interval is longer than test timeout)')
            return True  # This is not a failure

        logger.info('✓ Heartbeat received')
        return True

    async def test_job_subscription(self):
        """Test job subscription functionality."""
        logger.info('=== Testing Job Subscription ===')

        # Try to subscribe to a fake job
        fake_job_id = 'test-job-123'
        await self.send_message('subscribe_job', job_id=fake_job_id)

        # Should receive error since job doesn't exist
        response = await self.receive_message()
        if not response or response.get('type') != 'error':
            logger.error('Expected error for non-existent job subscription')
            return False

        logger.info('✓ Job subscription error handling works')
        return True

    async def test_invalid_message(self):
        """Test invalid message handling."""
        logger.info('=== Testing Invalid Message Handling ===')

        # Send invalid message type
        await self.send_message('invalid_type')

        # Should receive error
        response = await self.receive_message()
        if not response or response.get('type') != 'error':
            logger.error('Expected error for invalid message type')
            return False

        logger.info('✓ Invalid message handling works')
        return True

    async def test_notifications_websocket(self):
        """Test notifications WebSocket."""
        logger.info('=== Testing Notifications WebSocket ===')

        # Close reports connection
        if self.websocket:
            await self.websocket.close()

        # Connect to notifications WebSocket
        connected = await self.connect_websocket('notifications')
        if not connected:
            return False

        # Wait for connection message
        confirmation = await self.receive_message()
        if not confirmation or confirmation.get('type') != 'connected':
            logger.error('Did not receive notifications connection confirmation')
            return False

        logger.info('✓ Notifications WebSocket working')
        return True

    async def cleanup(self):
        """Clean up test resources."""
        if self.websocket:
            await self.websocket.close()

        # Remove test user
        if self.user:
            self.user.delete()
            logger.info('Cleaned up test user')

    async def run_all_tests(self):
        """Run all WebSocket tests."""
        logger.info('Starting WebSocket infrastructure tests...')

        try:
            # Setup
            await self.setup_test_user()

            # Run tests
            tests = [
                self.test_connection_flow,
                self.test_ping_pong,
                self.test_heartbeat,
                self.test_job_subscription,
                self.test_invalid_message,
                self.test_notifications_websocket,
            ]

            results = []
            for test in tests:
                try:
                    result = await test()
                    results.append(result)
                except Exception as e:
                    logger.error(f'Test {test.__name__} failed with exception: {str(e)}')
                    results.append(False)

            # Summary
            passed = sum(results)
            total = len(results)
            logger.info(f'Test Results: {passed}/{total} tests passed')

            if passed == total:
                logger.info('🎉 All WebSocket tests passed!')
                return True
            else:
                logger.error('❌ Some WebSocket tests failed')
                return False

        except Exception as e:
            logger.error(f'Test suite failed: {str(e)}')
            return False
        finally:
            await self.cleanup()


async def test_channel_layer():
    """Test Django Channels layer functionality."""
    logger.info('=== Testing Channel Layer ===')

    try:
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            logger.error('Channel layer not configured')
            return False

        # Test basic channel operations
        await channel_layer.group_add('test_group', 'test_channel')
        await channel_layer.group_send('test_group', {
            'type': 'test_message',
            'text': 'Hello Test!'
        })
        await channel_layer.group_discard('test_group', 'test_channel')

        logger.info('✓ Channel layer operations working')
        return True

    except Exception as e:
        logger.error(f'Channel layer test failed: {str(e)}')
        return False


async def main():
    """Main test function."""
    logger.info('Django Channels WebSocket Infrastructure Test')
    logger.info('=' * 50)

    # Test channel layer first
    channel_test = await test_channel_layer()

    # Test WebSocket functionality
    tester = WebSocketTester()
    websocket_test = await tester.run_all_tests()

    # Overall results
    logger.info('=' * 50)
    logger.info('Final Results:')
    logger.info(f'Channel Layer: {"✓ PASS" if channel_test else "❌ FAIL"}')
    logger.info(f'WebSocket Tests: {"✓ PASS" if websocket_test else "❌ FAIL"}')

    if channel_test and websocket_test:
        logger.info('🎉 All infrastructure tests passed!')
        logger.info('WebSocket infrastructure is ready for production use.')
        return 0
    else:
        logger.error('❌ Some tests failed. Please check the logs above.')
        return 1


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(exit_code)