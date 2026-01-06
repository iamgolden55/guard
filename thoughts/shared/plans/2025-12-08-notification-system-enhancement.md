# Notification System Enhancement Implementation Plan

## Overview

Implement a comprehensive push notification system for shift management that includes:
1. **Immediate notification** when a shift is assigned to staff
2. **Reminder notifications** at 3 hours, 45 minutes, and 5 minutes before shift start
3. **Check-in reminder** 4 minutes after shift start time if staff hasn't checked in

## Current State Analysis

### What Exists
- **Mobile**: Local notification scheduling via `expo-notifications` with 3h and 45min reminders
- **Backend**: Device token storage (`SNSDeviceToken` model) and preferences (`NotificationPreferences` model)
- **Celery**: Configured with queues for notifications, but no notification tasks exist

### What's Missing
- Backend push notification sending service
- Shift assignment signal to trigger notifications
- Celery tasks for scheduled reminders
- 5-minute reminder
- 4-minute post-start check-in reminder

### Key Discoveries
- Shift model at `backend/api/models.py:1597-1943`
- Shift status `scheduled` indicates assigned shift
- Check-in time stored in `check_in_time` field
- Celery already has a `notifications` queue configured (`backend/core/celery_app.py:40`)
- Device tokens stored with Expo format in `SNSDeviceToken` model

## Desired End State

When a shift is assigned:
1. Staff receives immediate push notification: "You've been assigned a shift at [Venue] on [Date] at [Time]"
2. 3 hours before: "Shift Reminder - Your shift at [Venue] starts in 3 hours"
3. 45 minutes before: "Shift Starting Soon! Your shift at [Venue] starts in 45 minutes"
4. 5 minutes before: "Almost Time! Your shift at [Venue] starts in 5 minutes. Get ready!"
5. 4 minutes after start: "Check-in Reminder - Your shift at [Venue] started 4 minutes ago. Please check in now!" (only if not checked in)

### Verification
- Push notifications received on physical device
- Notifications respect user preferences (quiet hours, enabled/disabled)
- Check-in reminder only fires if `check_in_time` is null
- Celery beat scheduler running reminder checks

## What We're NOT Doing

- Real-time WebSocket notifications (separate feature)
- Email notifications
- SMS notifications
- Notification history/inbox UI
- Manager notification when staff checks in

---

## Phase 1: Backend Push Notification Service

### Overview
Create a service to send Expo push notifications to registered devices.

### Changes Required

#### 1. Add Expo Push SDK to Requirements
**File**: `backend/requirements.txt`
**Changes**: Add Expo server SDK

```txt
# Push Notifications
exponent-server-sdk==2.1.0
```

#### 2. Create Notification Service
**File**: `backend/api/services/notification_service.py` (NEW FILE)
**Changes**: Create service to send push notifications

```python
"""
Push Notification Service for sending Expo push notifications.
"""

import logging
from typing import List, Optional, Dict, Any
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from django.utils import timezone
from ..models import SNSDeviceToken, NotificationPreferences

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for sending push notifications via Expo."""

    def __init__(self):
        self.client = PushClient()

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
        # Check user preferences
        if not self._should_send_notification(user_id):
            logger.info(f"Notification blocked by user preferences for user {user_id}")
            return False

        # Get active device tokens
        tokens = self._get_active_tokens(user_id)
        if not tokens:
            logger.warning(f"No active device tokens for user {user_id}")
            return False

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
            reminder_type: 'advance' (3h), 'soon' (45min), 'imminent' (5min)
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

    def _should_send_notification(self, user_id: int) -> bool:
        """Check if user preferences allow sending notification."""
        try:
            prefs = NotificationPreferences.objects.filter(user_id=user_id).first()
            if not prefs:
                return True  # Default to sending if no preferences set

            return prefs.should_send_notification()
        except Exception:
            return True

    def _get_active_tokens(self, user_id: int) -> List[SNSDeviceToken]:
        """Get all active device tokens for a user."""
        return list(SNSDeviceToken.objects.filter(
            user_id=user_id,
            is_active=True
        ))

    def _handle_push_error(self, token: SNSDeviceToken, response) -> None:
        """Handle push notification errors and deactivate invalid tokens."""
        try:
            response.validate_response()
        except DeviceNotRegisteredError:
            logger.warning(f"Device not registered, deactivating token {token.id}")
            token.deactivate()
        except PushTicketError as e:
            logger.error(f"Push ticket error for token {token.id}: {e}")


# Singleton instance
push_notification_service = PushNotificationService()
```

#### 3. Create Services __init__.py
**File**: `backend/api/services/__init__.py` (NEW FILE)
**Changes**: Export notification service

```python
from .notification_service import push_notification_service, PushNotificationService

__all__ = ['push_notification_service', 'PushNotificationService']
```

### Success Criteria

#### Automated Verification:
- [ ] Requirements install successfully: `pip install -r requirements.txt`
- [ ] Django imports work: `python manage.py shell -c "from api.services import push_notification_service"`
- [ ] No linting errors: `flake8 backend/api/services/`

#### Manual Verification:
- [ ] Test notification sends to physical device

---

## Phase 2: Shift Assignment Signal

### Overview
Add Django signal to trigger push notification when a shift is assigned to a staff member.

### Changes Required

#### 1. Update Signals File
**File**: `backend/api/signals.py`
**Changes**: Add shift assignment signal

```python
"""
Django signals for the API app.
Handles automatic setup and lifecycle events for models.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from .models import SecurityCompany, Shift
from .services import push_notification_service
import logging

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=SecurityCompany)
def setup_trial_period(sender, instance, **kwargs):
    """
    Automatically set up 30-day trial for new companies.
    """
    if not instance.pk:
        if not instance.is_trial and not instance.trial_end_date:
            instance.is_trial = True
            instance.trial_end_date = timezone.now() + timedelta(days=30)
            logger.info(
                f"Auto-enabled 30-day trial for new company: {instance.name} "
                f"(expires: {instance.trial_end_date})"
            )


@receiver(post_save, sender=SecurityCompany)
def log_company_creation(sender, instance, created, **kwargs):
    """Log company creation for audit trail"""
    if created:
        logger.info(
            f"New company created: {instance.name} "
            f"(ID: {instance.id}, Trial: {instance.is_trial}, "
            f"Trial Ends: {instance.trial_end_date}, "
            f"Tier: {instance.subscription_tier})"
        )


@receiver(pre_save, sender=Shift)
def track_shift_assignment(sender, instance, **kwargs):
    """
    Track when a shift is being assigned to detect new assignments.
    Store the previous staff_user to compare in post_save.
    """
    if instance.pk:
        try:
            old_shift = Shift.objects.get(pk=instance.pk)
            instance._previous_staff_user = old_shift.staff_user
        except Shift.DoesNotExist:
            instance._previous_staff_user = None
    else:
        instance._previous_staff_user = None


@receiver(post_save, sender=Shift)
def notify_shift_assignment(sender, instance, created, **kwargs):
    """
    Send push notification when a shift is assigned to a staff member.

    Triggers when:
    - New shift created with staff_user assigned
    - Existing shift updated with new staff_user assignment
    """
    # Skip if no staff assigned
    if not instance.staff_user:
        return

    # Check if this is a new assignment
    previous_staff = getattr(instance, '_previous_staff_user', None)
    is_new_assignment = created or (previous_staff != instance.staff_user)

    if not is_new_assignment:
        return

    # Only notify for scheduled shifts (not completed, cancelled, etc.)
    if instance.status not in ['scheduled', 'open']:
        return

    try:
        # Format date and time for notification
        start_time = instance.start_time
        formatted_date = start_time.strftime('%B %d, %Y')  # e.g., "December 15, 2025"
        formatted_time = start_time.strftime('%I:%M %p')   # e.g., "09:00 AM"
        venue_name = instance.venue.name if instance.venue else 'Unknown Venue'

        # Send immediate notification
        success = push_notification_service.send_shift_assignment_notification(
            user_id=instance.staff_user.id,
            shift_id=instance.id,
            venue_name=venue_name,
            start_time=formatted_time,
            formatted_date=formatted_date
        )

        if success:
            logger.info(
                f"Shift assignment notification sent for shift {instance.id} "
                f"to user {instance.staff_user.id}"
            )
        else:
            logger.warning(
                f"Failed to send shift assignment notification for shift {instance.id}"
            )

        # Schedule reminder tasks
        from .tasks import schedule_shift_reminders
        schedule_shift_reminders.delay(instance.id)

    except Exception as e:
        logger.exception(f"Error sending shift assignment notification: {e}")
```

### Success Criteria

#### Automated Verification:
- [ ] Django check passes: `python manage.py check`
- [ ] Signal registered: `python manage.py shell -c "from api.signals import notify_shift_assignment; print('OK')"`

#### Manual Verification:
- [ ] Create shift via API, verify notification received
- [ ] Assign existing shift to user, verify notification received
- [ ] Reassign shift to different user, verify new user gets notification

---

## Phase 3: Celery Tasks for Scheduled Reminders

### Overview
Create Celery tasks to send reminder notifications at scheduled times.

### Changes Required

#### 1. Update Celery Configuration
**File**: `backend/core/celery_app.py`
**Changes**: Add beat schedule for reminder checks

```python
# Add to beat_schedule (around line 68):
    beat_schedule={
        'cleanup-old-reports': {
            'task': 'api.tasks.cleanup_old_report_files',
            'schedule': 24.0 * 60 * 60,
            'options': {'queue': 'cleanup'}
        },
        'cleanup-expired-report-jobs': {
            'task': 'api.tasks.cleanup_expired_report_jobs',
            'schedule': 6.0 * 60 * 60,
            'options': {'queue': 'cleanup'}
        },
        # Shift reminder checks - run every minute
        'check-shift-reminders': {
            'task': 'api.tasks.check_shift_reminders',
            'schedule': 60.0,  # Every minute
            'options': {'queue': 'notifications'}
        },
        # Check-in reminders - run every minute
        'check-missed-checkins': {
            'task': 'api.tasks.check_missed_checkins',
            'schedule': 60.0,  # Every minute
            'options': {'queue': 'notifications'}
        },
    },
```

#### 2. Add Notification Tasks
**File**: `backend/api/tasks.py`
**Changes**: Add notification-related Celery tasks (append to existing file)

```python
# Add these imports at the top of the file
from datetime import timedelta
from django.db.models import Q

# Add these tasks after existing tasks

@shared_task(bind=True, queue='notifications')
def schedule_shift_reminders(self, shift_id: int) -> dict:
    """
    Schedule reminder notifications for a shift.
    Called when a shift is assigned.
    """
    from .models import Shift, ShiftReminderSchedule

    try:
        shift = Shift.objects.select_related('venue', 'staff_user').get(pk=shift_id)
    except Shift.DoesNotExist:
        return {'status': 'error', 'message': f'Shift {shift_id} not found'}

    if not shift.staff_user:
        return {'status': 'skipped', 'message': 'No staff assigned'}

    now = timezone.now()
    start_time = shift.start_time

    # Define reminder times (negative = before, positive = after)
    reminder_offsets = [
        ('advance', timedelta(hours=-3)),      # 3 hours before
        ('soon', timedelta(minutes=-45)),       # 45 minutes before
        ('imminent', timedelta(minutes=-5)),    # 5 minutes before
        ('checkin', timedelta(minutes=4)),      # 4 minutes after (if not checked in)
    ]

    scheduled_count = 0
    for reminder_type, offset in reminder_offsets:
        trigger_time = start_time + offset

        # Skip if trigger time has already passed
        if trigger_time <= now:
            continue

        # Calculate delay in seconds
        delay_seconds = (trigger_time - now).total_seconds()

        # Schedule the reminder task
        if reminder_type == 'checkin':
            send_checkin_reminder.apply_async(
                args=[shift_id],
                countdown=delay_seconds,
                queue='notifications'
            )
        else:
            send_shift_reminder.apply_async(
                args=[shift_id, reminder_type],
                countdown=delay_seconds,
                queue='notifications'
            )

        scheduled_count += 1
        logger.info(
            f"Scheduled {reminder_type} reminder for shift {shift_id} "
            f"at {trigger_time} (in {delay_seconds:.0f} seconds)"
        )

    return {
        'status': 'success',
        'shift_id': shift_id,
        'reminders_scheduled': scheduled_count
    }


@shared_task(bind=True, queue='notifications')
def send_shift_reminder(self, shift_id: int, reminder_type: str) -> dict:
    """
    Send a shift reminder notification.

    Args:
        shift_id: The shift to remind about
        reminder_type: 'advance' (3h), 'soon' (45min), 'imminent' (5min)
    """
    from .models import Shift
    from .services import push_notification_service

    try:
        shift = Shift.objects.select_related('venue', 'staff_user').get(pk=shift_id)
    except Shift.DoesNotExist:
        return {'status': 'error', 'message': f'Shift {shift_id} not found'}

    # Skip if shift is no longer scheduled or already started
    if shift.status not in ['scheduled', 'active']:
        return {'status': 'skipped', 'message': f'Shift status is {shift.status}'}

    if not shift.staff_user:
        return {'status': 'skipped', 'message': 'No staff assigned'}

    # Skip if already checked in
    if shift.check_in_time:
        return {'status': 'skipped', 'message': 'Already checked in'}

    # Calculate time until shift
    now = timezone.now()
    time_diff = shift.start_time - now

    if time_diff.total_seconds() < 0:
        return {'status': 'skipped', 'message': 'Shift already started'}

    # Format time until
    hours = int(time_diff.total_seconds() // 3600)
    minutes = int((time_diff.total_seconds() % 3600) // 60)

    if hours > 0:
        time_until = f"{hours} hour{'s' if hours != 1 else ''}"
    else:
        time_until = f"{minutes} minute{'s' if minutes != 1 else ''}"

    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'

    success = push_notification_service.send_shift_reminder(
        user_id=shift.staff_user.id,
        shift_id=shift.id,
        venue_name=venue_name,
        reminder_type=reminder_type,
        time_until=time_until
    )

    return {
        'status': 'success' if success else 'failed',
        'shift_id': shift_id,
        'reminder_type': reminder_type
    }


@shared_task(bind=True, queue='notifications')
def send_checkin_reminder(self, shift_id: int) -> dict:
    """
    Send a check-in reminder if staff hasn't checked in after shift start.
    Sent 4 minutes after shift start time.
    """
    from .models import Shift
    from .services import push_notification_service

    try:
        shift = Shift.objects.select_related('venue', 'staff_user').get(pk=shift_id)
    except Shift.DoesNotExist:
        return {'status': 'error', 'message': f'Shift {shift_id} not found'}

    # Skip if already checked in
    if shift.check_in_time:
        return {'status': 'skipped', 'message': 'Already checked in'}

    # Skip if shift cancelled or completed
    if shift.status in ['cancelled', 'completed', 'approved', 'rejected']:
        return {'status': 'skipped', 'message': f'Shift status is {shift.status}'}

    if not shift.staff_user:
        return {'status': 'skipped', 'message': 'No staff assigned'}

    # Calculate how late they are
    now = timezone.now()
    if shift.start_time > now:
        return {'status': 'skipped', 'message': 'Shift not started yet'}

    minutes_late = int((now - shift.start_time).total_seconds() // 60)
    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'

    success = push_notification_service.send_checkin_reminder(
        user_id=shift.staff_user.id,
        shift_id=shift.id,
        venue_name=venue_name,
        minutes_late=minutes_late
    )

    return {
        'status': 'success' if success else 'failed',
        'shift_id': shift_id,
        'minutes_late': minutes_late
    }


@shared_task(bind=True, queue='notifications')
def check_shift_reminders(self) -> dict:
    """
    Periodic task to check for upcoming shifts and send reminders.
    Runs every minute via Celery beat.

    This is a backup mechanism - primary reminders are scheduled when shift is assigned.
    """
    from .models import Shift
    from .services import push_notification_service

    now = timezone.now()
    sent_count = 0

    # Define reminder windows (check within 1 minute of each reminder time)
    reminder_windows = [
        ('advance', timedelta(hours=3), timedelta(hours=3, minutes=-1)),
        ('soon', timedelta(minutes=45), timedelta(minutes=44)),
        ('imminent', timedelta(minutes=5), timedelta(minutes=4)),
    ]

    for reminder_type, time_before_max, time_before_min in reminder_windows:
        window_start = now + time_before_min
        window_end = now + time_before_max

        shifts = Shift.objects.filter(
            status__in=['scheduled', 'active'],
            staff_user__isnull=False,
            check_in_time__isnull=True,  # Not checked in yet
            start_time__gte=window_start,
            start_time__lt=window_end
        ).select_related('venue', 'staff_user')

        for shift in shifts:
            time_diff = shift.start_time - now
            hours = int(time_diff.total_seconds() // 3600)
            minutes = int((time_diff.total_seconds() % 3600) // 60)

            if hours > 0:
                time_until = f"{hours} hour{'s' if hours != 1 else ''}"
            else:
                time_until = f"{minutes} minute{'s' if minutes != 1 else ''}"

            venue_name = shift.venue.name if shift.venue else 'Unknown Venue'

            success = push_notification_service.send_shift_reminder(
                user_id=shift.staff_user.id,
                shift_id=shift.id,
                venue_name=venue_name,
                reminder_type=reminder_type,
                time_until=time_until
            )

            if success:
                sent_count += 1

    return {'status': 'success', 'reminders_sent': sent_count}


@shared_task(bind=True, queue='notifications')
def check_missed_checkins(self) -> dict:
    """
    Periodic task to check for shifts where staff hasn't checked in.
    Sends reminder 4 minutes after shift start time.
    Runs every minute via Celery beat.
    """
    from .models import Shift
    from .services import push_notification_service

    now = timezone.now()

    # Find shifts that started 4-5 minutes ago without check-in
    window_start = now - timedelta(minutes=5)
    window_end = now - timedelta(minutes=4)

    shifts = Shift.objects.filter(
        status__in=['scheduled', 'active', 'in_progress'],
        staff_user__isnull=False,
        check_in_time__isnull=True,  # Not checked in
        start_time__gte=window_start,
        start_time__lt=window_end
    ).select_related('venue', 'staff_user')

    sent_count = 0
    for shift in shifts:
        minutes_late = int((now - shift.start_time).total_seconds() // 60)
        venue_name = shift.venue.name if shift.venue else 'Unknown Venue'

        success = push_notification_service.send_checkin_reminder(
            user_id=shift.staff_user.id,
            shift_id=shift.id,
            venue_name=venue_name,
            minutes_late=minutes_late
        )

        if success:
            sent_count += 1

    return {'status': 'success', 'checkin_reminders_sent': sent_count}
```

### Success Criteria

#### Automated Verification:
- [ ] Celery worker starts: `celery -A core worker -Q notifications -l info`
- [ ] Celery beat starts: `celery -A core beat -l info`
- [ ] Tasks registered: `celery -A core inspect registered`

#### Manual Verification:
- [ ] Schedule a shift 5 minutes in future, verify 5-min reminder fires
- [ ] Don't check in, verify 4-min post-start reminder fires
- [ ] Check in before start, verify no post-start reminder

---

## Phase 4: Mobile App Updates

### Overview
Update mobile notification constants to include 5-minute reminder and sync with backend.

### Changes Required

#### 1. Update Notification Constants
**File**: `mobile/src/utils/constants.ts`
**Changes**: Add 5-minute reminder configuration

```typescript
// Replace NOTIFICATION_CONFIG (lines 104-119)
export const NOTIFICATION_CONFIG = {
  // Shift reminder timing
  ADVANCE_REMINDER_HOURS: 3,      // Advance reminder (3 hours before shift)
  SOON_REMINDER_MINUTES: 45,      // Soon reminder (45 minutes before shift)
  IMMINENT_REMINDER_MINUTES: 5,   // Imminent reminder (5 minutes before shift)
  CHECKIN_REMINDER_MINUTES: 4,    // Check-in reminder (4 minutes after shift start)

  // Legacy alias for backwards compatibility
  FINAL_REMINDER_MINUTES: 45,

  // Exchange expiration
  EXCHANGE_EXPIRY_MINUTES: 30,

  // Notification channels (Android)
  CHANNELS: {
    SHIFT_REMINDERS: 'shift-reminders',
    INCIDENT_ALERTS: 'incident-alerts',
    SYNC_STATUS: 'sync-status',
  },
};
```

#### 2. Update Notification Service
**File**: `mobile/src/services/notificationService.ts`
**Changes**: Add 5-minute reminder scheduling

Update the `scheduleShiftReminder` method to schedule three reminders instead of two:

```typescript
// In scheduleShiftReminder method, update the scheduling logic (around line 276-340)

// Calculate trigger times
const advanceReminderTime = new Date(
  shiftStartTime.getTime() - NOTIFICATION_CONFIG.ADVANCE_REMINDER_HOURS * 60 * 60 * 1000
);
const soonReminderTime = new Date(
  shiftStartTime.getTime() - NOTIFICATION_CONFIG.SOON_REMINDER_MINUTES * 60 * 1000
);
const imminentReminderTime = new Date(
  shiftStartTime.getTime() - NOTIFICATION_CONFIG.IMMINENT_REMINDER_MINUTES * 60 * 1000
);

// Schedule advance reminder (3 hours before)
if (advanceReminderTime > now) {
  const advanceId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📅 Shift Reminder',
      body: `Your shift at ${shift.venue.name} starts in ${NOTIFICATION_CONFIG.ADVANCE_REMINDER_HOURS} hours`,
      data: {
        shiftId: shift.id,
        type: 'advance_reminder',
        screen: 'ShiftDetails',
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
      date: advanceReminderTime,
    },
  });
  notificationIds.push(advanceId);
  scheduledNotifications.push({
    notificationId: advanceId,
    shiftId: shift.id,
    type: 'advance',
    scheduledTime: advanceReminderTime.toISOString(),
  });
}

// Schedule soon reminder (45 minutes before)
if (soonReminderTime > now) {
  const soonId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Shift Starting Soon!',
      body: `Your shift at ${shift.venue.name} starts in ${NOTIFICATION_CONFIG.SOON_REMINDER_MINUTES} minutes. Get ready!`,
      data: {
        shiftId: shift.id,
        type: 'soon_reminder',
        screen: 'ShiftDetails',
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
      date: soonReminderTime,
    },
  });
  notificationIds.push(soonId);
  scheduledNotifications.push({
    notificationId: soonId,
    shiftId: shift.id,
    type: 'soon',
    scheduledTime: soonReminderTime.toISOString(),
  });
}

// Schedule imminent reminder (5 minutes before)
if (imminentReminderTime > now) {
  const imminentId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 Almost Time!',
      body: `Your shift at ${shift.venue.name} starts in ${NOTIFICATION_CONFIG.IMMINENT_REMINDER_MINUTES} minutes. Head to the venue now!`,
      data: {
        shiftId: shift.id,
        type: 'imminent_reminder',
        screen: 'ShiftDetails',
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: {
      channelId: NOTIFICATION_CONFIG.CHANNELS.SHIFT_REMINDERS,
      date: imminentReminderTime,
    },
  });
  notificationIds.push(imminentId);
  scheduledNotifications.push({
    notificationId: imminentId,
    shiftId: shift.id,
    type: 'imminent',
    scheduledTime: imminentReminderTime.toISOString(),
  });
}
```

#### 3. Update ScheduledNotification Type
**File**: `mobile/src/services/notificationService.ts`
**Changes**: Update type to include new reminder types

```typescript
// Update interface (around line 29-34)
interface ScheduledNotification {
  notificationId: string;
  shiftId: number;
  type: 'advance' | 'soon' | 'imminent' | 'final';  // Added 'soon' and 'imminent'
  scheduledTime: string;
}
```

### Success Criteria

#### Automated Verification:
- [ ] TypeScript compiles: `cd mobile && npx tsc --noEmit`
- [ ] App builds: `cd mobile && npx expo prebuild --clean`

#### Manual Verification:
- [ ] Schedule shift 6 minutes in future
- [ ] Verify 5-minute reminder notification fires
- [ ] Verify notification content is correct
- [ ] Tap notification opens shift details

---

## Phase 5: Testing & Verification

### Overview
End-to-end testing of the complete notification flow.

### Test Scenarios

#### 1. New Shift Assignment
1. Register device token via mobile app
2. Create shift via API/admin and assign to user
3. Verify immediate "New Shift Assigned" notification received
4. Verify reminders scheduled in Celery

#### 2. Reminder Sequence
1. Create shift starting in 10 minutes
2. Verify 5-minute reminder fires at correct time
3. Don't check in
4. Verify 4-minute post-start check-in reminder fires

#### 3. Early Check-In
1. Create shift starting in 10 minutes
2. Check in at 5 minutes before start
3. Verify no further reminders fire (including post-start)

#### 4. Notification Preferences
1. Disable shift reminders in preferences
2. Assign shift
3. Verify no notifications received

### Verification Commands

```bash
# Backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations (if any new models)
python manage.py migrate

# Start Celery worker
celery -A core worker -Q notifications -l info

# Start Celery beat (separate terminal)
celery -A core beat -l info

# Test notification service
python manage.py shell
>>> from api.services import push_notification_service
>>> # Test with valid user_id and token
>>> push_notification_service.send_notification(1, "Test", "Test body")

# Mobile
cd mobile

# Install dependencies
npm install

# Run on device
npx expo run:ios  # or npx expo run:android
```

### Success Criteria

#### Automated Verification:
- [ ] All backend tests pass: `cd backend && pytest`
- [ ] Mobile TypeScript compiles: `cd mobile && npx tsc --noEmit`
- [ ] Celery tasks registered and running

#### Manual Verification:
- [ ] Immediate notification on shift assignment
- [ ] 3-hour reminder fires correctly
- [ ] 45-minute reminder fires correctly
- [ ] 5-minute reminder fires correctly
- [ ] 4-minute post-start check-in reminder fires if not checked in
- [ ] No check-in reminder if already checked in
- [ ] Deep linking works on notification tap

---

## Implementation Order

1. **Phase 1**: Backend Push Notification Service (foundation)
2. **Phase 2**: Shift Assignment Signal (immediate notifications)
3. **Phase 3**: Celery Tasks (scheduled reminders)
4. **Phase 4**: Mobile App Updates (5-minute reminder locally)
5. **Phase 5**: Testing & Verification

---

## References

- Shift model: `backend/api/models.py:1597-1943`
- Existing signals: `backend/api/signals.py`
- Celery config: `backend/core/celery_app.py`
- Notification service (mobile): `mobile/src/services/notificationService.ts`
- Notification constants: `mobile/src/utils/constants.ts:104-119`
- Device token model: `backend/api/models.py:4866-4940`
- Notification preferences: `backend/api/models.py:4945-5115`
