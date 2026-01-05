"""
Push Notification Service for sending Expo push notifications.

This service handles all push notification sending to mobile devices
registered with Expo push notification tokens.
"""

import logging
from typing import List, Optional, Dict, Any
from django.utils import timezone

logger = logging.getLogger(__name__)

# Try to import Expo SDK, but gracefully handle if not installed
try:
    from exponent_server_sdk import (
        DeviceNotRegisteredError,
        PushClient,
        PushMessage,
        PushServerError,
        PushTicketError,
    )
    EXPO_SDK_AVAILABLE = True
except ImportError:
    EXPO_SDK_AVAILABLE = False
    logger.warning("exponent_server_sdk not installed. Push notifications will be logged only.")


class PushNotificationService:
    """Service for sending push notifications via Expo."""

    def __init__(self):
        if EXPO_SDK_AVAILABLE:
            # Set 10-second timeout to prevent hanging on Expo server issues
            self.client = PushClient(timeout=10.0)
        else:
            self.client = None

    def send_notification(
        self,
        user_id: int,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: str = 'high',
        channel_id: str = 'shift-reminders'
    ) -> bool:
        """
        Send push notification to all active devices for a user.

        Args:
            user_id: The user to send notification to
            title: Notification title
            body: Notification body text
            data: Additional data payload
            priority: 'high' or 'default'
            channel_id: Android notification channel

        Returns:
            bool: True if at least one notification sent successfully
        """
        # Import here to avoid circular imports
        from ..models import SNSDeviceToken, NotificationPreferences

        # Extract notification type from data payload for preference checking
        notification_type = data.get('notification_type') if data else None

        # Check user preferences with notification type
        if not self._should_send_notification(user_id, notification_type):
            logger.info(f"Notification blocked by user preferences for user {user_id}, type={notification_type}")
            return False

        # Get active device tokens
        tokens = self._get_active_tokens(user_id)
        if not tokens:
            logger.warning(f"No active device tokens for user {user_id}")
            return False

        # If SDK not available, just log the notification
        if not EXPO_SDK_AVAILABLE or not self.client:
            logger.info(
                f"[MOCK] Push notification to user {user_id}: "
                f"title='{title}', body='{body}', data={data}"
            )
            return True

        # Build messages
        messages = []
        for token in tokens:
            messages.append(PushMessage(
                to=token.token,
                title=title,
                body=body,
                data=data or {},
                priority=priority,
                channel_id=channel_id,
                sound='default',
            ))

        # Send notifications
        success = False
        try:
            responses = self.client.publish_multiple(messages)

            for i, response in enumerate(responses):
                if response.is_success():
                    success = True
                    tokens[i].update_last_used()
                    logger.info(f"Push notification sent to user {user_id}, token {tokens[i].id}")
                else:
                    self._handle_push_error(tokens[i], response)

        except PushServerError as e:
            logger.error(f"Push server error: {e}")
        except Exception as e:
            logger.exception(f"Error sending push notification: {e}")

        return success

    def send_shift_assignment_notification(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        start_time: str,
        formatted_date: str
    ) -> bool:
        """Send notification when a shift is assigned to a user."""
        return self.send_notification(
            user_id=user_id,
            title="📅 New Shift Assigned",
            body=f"You've been assigned a shift at {venue_name} on {formatted_date} at {start_time}",
            data={
                'type': 'shift_assigned',
                'shiftId': shift_id,
                'screen': 'ShiftDetails',
            },
            priority='high',
            channel_id='shift-reminders'
        )

    def send_shift_reminder(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        reminder_type: str,
        time_until: str
    ) -> bool:
        """
        Send shift reminder notification.

        Args:
            user_id: User to notify
            shift_id: The shift ID
            venue_name: Name of the venue
            reminder_type: 'advance' (3h), 'soon' (45min), 'imminent' (5min)
            time_until: Formatted time string (e.g., "3 hours", "45 minutes")
        """
        titles = {
            'advance': '📅 Shift Reminder',
            'soon': '⏰ Shift Starting Soon!',
            'imminent': '🚨 Almost Time!',
        }

        bodies = {
            'advance': f"Your shift at {venue_name} starts in {time_until}",
            'soon': f"Your shift at {venue_name} starts in {time_until}. Get ready!",
            'imminent': f"Your shift at {venue_name} starts in {time_until}. Head to the venue now!",
        }

        return self.send_notification(
            user_id=user_id,
            title=titles.get(reminder_type, titles['advance']),
            body=bodies.get(reminder_type, bodies['advance']),
            data={
                'type': f'{reminder_type}_reminder',
                'shiftId': shift_id,
                'screen': 'ShiftDetails',
            },
            priority='high' if reminder_type in ['soon', 'imminent'] else 'default',
            channel_id='shift-reminders'
        )

    def send_checkin_reminder(
        self,
        user_id: int,
        shift_id: int,
        venue_name: str,
        minutes_late: int
    ) -> bool:
        """Send reminder to check in after shift start time."""
        return self.send_notification(
            user_id=user_id,
            title="⚠️ Check-in Reminder",
            body=f"Your shift at {venue_name} started {minutes_late} minutes ago. Please check in now!",
            data={
                'type': 'checkin_reminder',
                'shiftId': shift_id,
                'screen': 'ShiftDetails',
            },
            priority='high',
            channel_id='shift-reminders'
        )

    def send_shift_cancellation_to_manager(
        self,
        manager_user_id: int,
        shift_id: int,
        staff_name: str,
        venue_name: str,
        shift_date: str,
        shift_time: str,
        published_to_pool: bool = False
    ) -> bool:
        """
        Send notification to manager when staff cancels their shift.

        Args:
            manager_user_id: Manager to notify
            shift_id: The cancelled shift ID
            staff_name: Name of staff who cancelled
            venue_name: Venue of the shift
            shift_date: Formatted date of the shift
            shift_time: Formatted time of the shift
            published_to_pool: Whether the shift was published to open pool
        """
        pool_message = " Shift published to open pool." if published_to_pool else " Please reassign this shift."

        return self.send_notification(
            user_id=manager_user_id,
            title="⚠️ Shift Cancelled by Staff",
            body=f"{staff_name} cancelled their shift at {venue_name} on {shift_date} at {shift_time}.{pool_message}",
            data={
                'type': 'shift_cancelled',
                'notification_type': 'shift_cancelled',
                'shiftId': shift_id,
                'screen': 'ShiftScheduling',
            },
            priority='high',
            channel_id='shift-reminders'
        )

    def _should_send_notification(self, user_id: int, notification_type: Optional[str] = None) -> bool:
        """
        Check if user preferences allow sending notification.

        Args:
            user_id: The user to check preferences for
            notification_type: Optional notification type for type-specific preference checking
                             (e.g., 'available_shift', 'shift_reminder', 'exchange_request')

        Returns:
            bool: True if notification should be sent, False if blocked by preferences
        """
        from ..models import NotificationPreferences

        try:
            prefs = NotificationPreferences.objects.filter(user_id=user_id).first()
            if not prefs:
                return True  # Default to sending if no preferences set

            # If notification_type provided, use model's type-specific preference checking
            if notification_type:
                return prefs.should_send_notification(notification_type)

            # Fallback to basic check (for backward compatibility)
            return prefs.should_send_notification()
        except Exception as e:
            logger.warning(f"Error checking notification preferences: {e}")
            return True

    def _get_active_tokens(self, user_id: int) -> List:
        """Get all active device tokens for a user."""
        from ..models import SNSDeviceToken

        return list(SNSDeviceToken.objects.filter(
            user_id=user_id,
            is_active=True
        ))

    def _handle_push_error(self, token, response) -> None:
        """Handle push notification errors and deactivate invalid tokens."""
        if not EXPO_SDK_AVAILABLE:
            return

        try:
            response.validate_response()
        except DeviceNotRegisteredError:
            logger.warning(f"Device not registered, deactivating token {token.id}")
            token.deactivate()
        except PushTicketError as e:
            logger.error(f"Push ticket error for token {token.id}: {e}")


# Singleton instance
push_notification_service = PushNotificationService()
