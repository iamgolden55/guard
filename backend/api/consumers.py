"""
WebSocket consumers for the Security Staff Management System.

Provides real-time communication for report generation progress,
job status updates, and system notifications.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from django.conf import settings

from .models import ReportJob, User

logger = logging.getLogger(__name__)


class ReportsConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for report generation progress tracking.

    Handles real-time communication for:
    - Report generation progress updates
    - Job completion notifications
    - Job failure alerts
    - Job cancellation confirmations
    - Heartbeat messages to keep connections alive
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.user_group_name = None
        self.heartbeat_task = None
        self.connection_start = None

    async def connect(self):
        """Handle WebSocket connection."""
        self.connection_start = timezone.now()

        # Check authentication
        self.user = self.scope.get('user')
        if not self.user or isinstance(self.user, AnonymousUser):
            logger.warning('Unauthenticated WebSocket connection attempt')
            await self.close(code=4001, reason='Authentication required')
            return

        # Check if user has report access permissions
        if not await self._user_has_report_access():
            logger.warning(f'User {self.user.username} attempted WebSocket connection without report permissions')
            await self.close(code=4003, reason='Insufficient permissions')
            return

        # Create user-specific group
        self.user_group_name = f'reports_user_{self.user.id}'

        # Join user group
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )

        # Accept connection
        await self.accept()

        # Start heartbeat
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'WebSocket connection established',
            'user': self.user.username,
            'timestamp': timezone.now().isoformat()
        }))

        logger.info(f'WebSocket connected: {self.user.username} ({self.channel_name})')

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Cancel heartbeat task
        if self.heartbeat_task:
            self.heartbeat_task.cancel()

        # Leave user group
        if self.user_group_name:
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

        connection_duration = None
        if self.connection_start:
            connection_duration = (timezone.now() - self.connection_start).total_seconds()

        logger.info(
            f'WebSocket disconnected: {self.user.username if self.user else "Unknown"} '
            f'({self.channel_name}) - Code: {close_code} - '
            f'Duration: {connection_duration}s'
        )

    async def receive(self, text_data):
        """Handle messages from WebSocket client."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                await self._handle_ping(data)
            elif message_type == 'subscribe_job':
                await self._handle_subscribe_job(data)
            elif message_type == 'unsubscribe_job':
                await self._handle_unsubscribe_job(data)
            elif message_type == 'cancel_job':
                await self._handle_cancel_job(data)
            elif message_type == 'get_job_status':
                await self._handle_get_job_status(data)
            else:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f'Unknown message type: {message_type}',
                    'timestamp': timezone.now().isoformat()
                }))

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format',
                'timestamp': timezone.now().isoformat()
            }))
        except Exception as e:
            logger.error(f'Error handling WebSocket message: {str(e)}')
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Internal server error',
                'timestamp': timezone.now().isoformat()
            }))

    async def _handle_ping(self, data):
        """Handle ping message from client."""
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': timezone.now().isoformat()
        }))

    async def _handle_subscribe_job(self, data):
        """Handle subscription to specific job updates."""
        job_id = data.get('job_id')
        if not job_id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'job_id is required for subscription',
                'timestamp': timezone.now().isoformat()
            }))
            return

        # Verify job access
        job = await self._get_user_job(job_id)
        if not job:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Job not found or access denied',
                'job_id': job_id,
                'timestamp': timezone.now().isoformat()
            }))
            return

        # Join job-specific group
        job_group_name = f'report_job_{job_id}'
        await self.channel_layer.group_add(
            job_group_name,
            self.channel_name
        )

        # Send current job status
        await self.send(text_data=json.dumps({
            'type': 'job_subscribed',
            'job_id': job_id,
            'status': job.status,
            'progress': job.progress,
            'message': f'Subscribed to job {job_id}',
            'timestamp': timezone.now().isoformat()
        }))

    async def _handle_unsubscribe_job(self, data):
        """Handle unsubscription from job updates."""
        job_id = data.get('job_id')
        if job_id:
            job_group_name = f'report_job_{job_id}'
            await self.channel_layer.group_discard(
                job_group_name,
                self.channel_name
            )

            await self.send(text_data=json.dumps({
                'type': 'job_unsubscribed',
                'job_id': job_id,
                'message': f'Unsubscribed from job {job_id}',
                'timestamp': timezone.now().isoformat()
            }))

    async def _handle_cancel_job(self, data):
        """Handle job cancellation request."""
        job_id = data.get('job_id')
        if not job_id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'job_id is required for cancellation',
                'timestamp': timezone.now().isoformat()
            }))
            return

        # Import here to avoid circular imports
        from .tasks import cancel_report_job

        # Queue cancellation task
        try:
            result = await database_sync_to_async(cancel_report_job.delay)(job_id, self.user.id)

            await self.send(text_data=json.dumps({
                'type': 'job_cancel_requested',
                'job_id': job_id,
                'message': 'Job cancellation requested',
                'timestamp': timezone.now().isoformat()
            }))
        except Exception as e:
            logger.error(f'Error requesting job cancellation: {str(e)}')
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Error cancelling job: {str(e)}',
                'job_id': job_id,
                'timestamp': timezone.now().isoformat()
            }))

    async def _handle_get_job_status(self, data):
        """Handle request for current job status."""
        job_id = data.get('job_id')
        if not job_id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'job_id is required',
                'timestamp': timezone.now().isoformat()
            }))
            return

        job = await self._get_user_job(job_id)
        if not job:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Job not found or access denied',
                'job_id': job_id,
                'timestamp': timezone.now().isoformat()
            }))
            return

        await self.send(text_data=json.dumps({
            'type': 'job_status',
            'job_id': job_id,
            'status': job.status,
            'progress': job.progress,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'error_message': job.error_message,
            'timestamp': timezone.now().isoformat()
        }))

    async def _heartbeat_loop(self):
        """Send periodic heartbeat messages to keep connection alive."""
        try:
            while True:
                await asyncio.sleep(settings.WEBSOCKET_HEARTBEAT_INTERVAL)
                await self.send(text_data=json.dumps({
                    'type': 'heartbeat',
                    'timestamp': timezone.now().isoformat()
                }))
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f'Error in heartbeat loop: {str(e)}')

    @database_sync_to_async
    def _user_has_report_access(self) -> bool:
        """Check if user has permission to access reports."""
        # Add your permission logic here
        # For now, allow all authenticated users
        return self.user and self.user.is_authenticated

    @database_sync_to_async
    def _get_user_job(self, job_id: str) -> Optional['ReportJob']:
        """Get job if user has access to it."""
        try:
            return ReportJob.objects.get(
                job_id=job_id,
                requested_by=self.user
            )
        except ReportJob.DoesNotExist:
            return None

    # Channel layer message handlers
    async def report_progress(self, event):
        """Handle report progress update from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'report_progress',
            'job_id': event['job_id'],
            'progress': event['progress'],
            'message': event.get('message', ''),
            'current': event.get('current', 0),
            'total': event.get('total', 100),
            'timestamp': event.get('timestamp', timezone.now().isoformat())
        }))

    async def report_complete(self, event):
        """Handle report completion from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'report_complete',
            'job_id': event['job_id'],
            'file_path': event.get('file_path'),
            'file_size': event.get('file_size'),
            'record_count': event.get('record_count'),
            'generation_time': event.get('generation_time'),
            'download_url': event.get('download_url'),
            'message': event.get('message', 'Report generation completed'),
            'timestamp': event.get('timestamp', timezone.now().isoformat())
        }))

    async def report_failed(self, event):
        """Handle report failure from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'report_failed',
            'job_id': event['job_id'],
            'error_message': event.get('error_message', 'Unknown error'),
            'retry_count': event.get('retry_count', 0),
            'max_retries': event.get('max_retries', 3),
            'message': event.get('message', 'Report generation failed'),
            'timestamp': event.get('timestamp', timezone.now().isoformat())
        }))

    async def report_cancelled(self, event):
        """Handle report cancellation from channel layer."""
        await self.send(text_data=json.dumps({
            'type': 'report_cancelled',
            'job_id': event['job_id'],
            'message': event.get('message', 'Report generation cancelled'),
            'timestamp': event.get('timestamp', timezone.now().isoformat())
        }))


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for general system notifications.

    Handles real-time notifications for:
    - System alerts
    - User-specific notifications
    - Broadcast messages
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.notification_group = None

    async def connect(self):
        """Handle WebSocket connection."""
        self.user = self.scope.get('user')
        if not self.user or isinstance(self.user, AnonymousUser):
            await self.close(code=4001, reason='Authentication required')
            return

        # Join user-specific notification group
        self.notification_group = f'notifications_user_{self.user.id}'
        await self.channel_layer.group_add(
            self.notification_group,
            self.channel_name
        )

        # Join general notifications group
        await self.channel_layer.group_add(
            'notifications_general',
            self.channel_name
        )

        await self.accept()

        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Notification channel connected',
            'timestamp': timezone.now().isoformat()
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if self.notification_group:
            await self.channel_layer.group_discard(
                self.notification_group,
                self.channel_name
            )

        await self.channel_layer.group_discard(
            'notifications_general',
            self.channel_name
        )

    async def receive(self, text_data):
        """Handle messages from client."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': timezone.now().isoformat()
                }))

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format',
                'timestamp': timezone.now().isoformat()
            }))

    # Channel layer message handlers
    async def notification(self, event):
        """Handle general notification.

        Forwards structured fields (notification_type, related_type, related_id,
        action_url, priority, notification_id) so clients can filter — the
        mobile dashboard relies on related_type='shift' + notification_type
        in {'shift_assigned', ...} to trigger a refetch.
        """
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'notification_id': event.get('notification_id'),
            'notification_type': event.get('notification_type'),
            'priority': event.get('priority'),
            'title': event.get('title', ''),
            'message': event.get('message', ''),
            'related_type': event.get('related_type', ''),
            'related_id': event.get('related_id', ''),
            'action_url': event.get('action_url', ''),
            'level': event.get('level', 'info'),
            'category': event.get('category', 'general'),
            'timestamp': event.get('timestamp', timezone.now().isoformat()),
        }))

    async def system_alert(self, event):
        """Handle system alert notification."""
        await self.send(text_data=json.dumps({
            'type': 'system_alert',
            'title': event.get('title', 'System Alert'),
            'message': event.get('message', ''),
            'severity': event.get('severity', 'warning'),
            'timestamp': event.get('timestamp', timezone.now().isoformat())
        }))

    async def capacity_event(self, event):
        """
        Forward capacity-logbook sync events to the client. These are not
        Notification rows — they're real-time signals that drive the mobile
        cadence engine: 'capacity_logged' (reschedule reminders),
        'capacity_overdue' (escalate locally), 'logbook_signed' (mark closed).
        """
        await self.send(text_data=json.dumps({
            'type': 'capacity_event',
            'event': event.get('event'),
            'shift_group': event.get('shift_group'),
            'venue_id': event.get('venue_id'),
            'shift_id': event.get('shift_id'),
            'current_count': event.get('current_count'),
            'venue_capacity': event.get('venue_capacity'),
            'is_at_capacity': event.get('is_at_capacity'),
            'performed_by': event.get('performed_by'),
            'logged_at': event.get('logged_at'),
            'next_due_at': event.get('next_due_at'),
            'expected_at': event.get('expected_at'),
            'closed_by_name': event.get('closed_by_name'),
            'override_reason': event.get('override_reason'),
            'timestamp': event.get('timestamp', timezone.now().isoformat()),
        }))


# Utility functions for sending messages to channels
async def send_report_progress(job_id: str, user_id: int, progress_data: Dict[str, Any]):
    """Send report progress update to user's WebSocket."""
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning('Channel layer not available for progress update')
        return

    # Send to user group
    await channel_layer.group_send(
        f'reports_user_{user_id}',
        {
            'type': 'report_progress',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **progress_data
        }
    )

    # Send to job-specific group
    await channel_layer.group_send(
        f'report_job_{job_id}',
        {
            'type': 'report_progress',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **progress_data
        }
    )


async def send_report_complete(job_id: str, user_id: int, completion_data: Dict[str, Any]):
    """Send report completion notification to user's WebSocket."""
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning('Channel layer not available for completion notification')
        return

    await channel_layer.group_send(
        f'reports_user_{user_id}',
        {
            'type': 'report_complete',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **completion_data
        }
    )

    await channel_layer.group_send(
        f'report_job_{job_id}',
        {
            'type': 'report_complete',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **completion_data
        }
    )


async def send_report_failed(job_id: str, user_id: int, failure_data: Dict[str, Any]):
    """Send report failure notification to user's WebSocket."""
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning('Channel layer not available for failure notification')
        return

    await channel_layer.group_send(
        f'reports_user_{user_id}',
        {
            'type': 'report_failed',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **failure_data
        }
    )

    await channel_layer.group_send(
        f'report_job_{job_id}',
        {
            'type': 'report_failed',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **failure_data
        }
    )


async def send_report_cancelled(job_id: str, user_id: int, cancellation_data: Dict[str, Any] = None):
    """Send report cancellation notification to user's WebSocket."""
    from channels.layers import get_channel_layer

    channel_layer = get_channel_layer()
    if not channel_layer:
        logger.warning('Channel layer not available for cancellation notification')
        return

    data = cancellation_data or {}

    await channel_layer.group_send(
        f'reports_user_{user_id}',
        {
            'type': 'report_cancelled',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **data
        }
    )

    await channel_layer.group_send(
        f'report_job_{job_id}',
        {
            'type': 'report_cancelled',
            'job_id': job_id,
            'timestamp': timezone.now().isoformat(),
            **data
        }
    )


def broadcast_capacity_event(shift_group: str, event: str, payload: Dict[str, Any]) -> None:
    """
    Sync-callable helper to fan out a capacity-logbook event to every staff
    member in a shift_group. Each user receives the event on their existing
    'notifications_user_{id}' group via the NotificationConsumer.capacity_event
    handler — no separate group subscription is needed on the mobile client.

    Safe to call from synchronous contexts (DRF perform_create, Celery tasks).
    """
    if not shift_group:
        return
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        # Local import avoids circular-import risk when loaded from views/tasks
        from .models import Shift

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        recipient_ids = list(
            Shift.objects.filter(shift_group=shift_group, staff_user__isnull=False)
            .values_list('staff_user_id', flat=True)
            .distinct()
        )
        if not recipient_ids:
            return

        message = {
            'type': 'capacity_event',
            'event': event,
            'shift_group': shift_group,
            'timestamp': timezone.now().isoformat(),
            **payload,
        }
        for user_id in recipient_ids:
            async_to_sync(channel_layer.group_send)(
                f'notifications_user_{user_id}',
                message,
            )
    except Exception as e:
        logger.warning(f"Failed to broadcast capacity event '{event}' for {shift_group}: {e}")