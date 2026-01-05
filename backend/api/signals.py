"""
Django signals for the API app.
Handles automatic setup and lifecycle events for models.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from .models import SecurityCompany, Shift, OpenShiftRequest, ShiftExchange
from .services import push_notification_service
import logging

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=SecurityCompany)
def setup_trial_period(sender, instance, **kwargs):
    """
    Automatically set up 30-day trial for new companies.

    This signal ensures every new company starts with a 30-day trial period
    where they have access to all features regardless of their selected tier.
    After the trial expires, features are restricted to their subscription tier.

    Trial Setup:
    - is_trial = True
    - trial_end_date = created_at + 30 days
    - Full feature access during trial
    - After trial: Features restricted to subscription_tier
    """
    # Only run for new companies (no pk yet)
    if not instance.pk:
        # Set trial period for new companies
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


# =============================================================================
# Shift Assignment Notifications
# =============================================================================

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
            instance._previous_status = old_shift.status
        except Shift.DoesNotExist:
            instance._previous_staff_user = None
            instance._previous_status = None
    else:
        instance._previous_staff_user = None
        instance._previous_status = None


@receiver(post_save, sender=Shift)
def notify_shift_assignment(sender, instance, created, **kwargs):
    """
    Send push notification when a shift is assigned to a staff member.

    Triggers when:
    - New shift created with staff_user assigned
    - Existing shift updated with new staff_user assignment

    Also schedules reminder notifications via Celery.
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
    if instance.status not in ['scheduled', 'open', 'active']:
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

        # Schedule reminder tasks via Celery
        try:
            from .tasks import schedule_shift_reminders
            schedule_shift_reminders.delay(instance.id)
            logger.info(f"Scheduled reminder tasks for shift {instance.id}")
        except Exception as e:
            logger.warning(f"Could not schedule reminder tasks: {e}")

    except Exception as e:
        logger.exception(f"Error sending shift assignment notification: {e}")


# =============================================================================
# Open Shift Notifications
# =============================================================================

@receiver(post_save, sender=Shift)
def auto_create_open_shift_request(sender, instance, created, **kwargs):
    """
    Automatically create an OpenShiftRequest when admin creates an open shift.

    This handles the workflow where admin creates a shift with status='open'
    and no staff assigned, making it available for staff to claim.
    """
    # Only process newly created open shifts with no staff assigned
    if not created:
        return

    if instance.status != 'open' or instance.staff_user is not None:
        return

    try:
        # Create OpenShiftRequest for this admin-created open shift
        # Use a system user or the creating manager as requesting_user
        # For now, we'll use the first admin/manager in the company
        from .models import User

        company = instance.venue.company if instance.venue else None
        if not company:
            logger.warning(f"Cannot create OpenShiftRequest for shift {instance.id} - no company")
            return

        # Find an admin or manager in the company to be the "requesting_user"
        system_user = User.objects.filter(
            company_memberships__company=company,
            company_memberships__is_active=True,
            role__in=['admin', 'manager']
        ).first()

        if not system_user:
            logger.warning(f"No admin/manager found in company {company.name} to create OpenShiftRequest")
            return

        # Create the OpenShiftRequest
        OpenShiftRequest.objects.create(
            original_shift=instance,
            requesting_user=system_user,
            request_reason="System-generated: Shift created as open by admin",
            status='open'
        )

        logger.info(
            f"Auto-created OpenShiftRequest for admin-created open shift {instance.id} "
            f"at {instance.venue.name}"
        )

    except Exception as e:
        logger.exception(f"Error auto-creating OpenShiftRequest for shift {instance.id}: {e}")


@receiver(post_save, sender=OpenShiftRequest)
def notify_qualified_users_of_open_shift(sender, instance, created, **kwargs):
    """
    Notify qualified users when an open shift is published.

    Triggers when:
    - New OpenShiftRequest created with status='open'
    - Queues a Celery task for batched notification processing

    The task is queued with a configurable delay (default: 5 seconds) to allow
    natural batching of multiple shifts published around the same time.
    Set OPEN_SHIFT_NOTIFICATION_DELAY in settings.py to adjust (30 for production).
    """
    # Only process newly created open shifts
    if not created or instance.status != 'open':
        return

    try:
        # Import Celery task (avoid circular imports)
        from .tasks import send_open_shift_notifications
        from django.conf import settings

        # Get batching delay from settings (default: 5 seconds for faster testing)
        # Set OPEN_SHIFT_NOTIFICATION_DELAY=30 in production for better batching
        batching_delay = getattr(settings, 'OPEN_SHIFT_NOTIFICATION_DELAY', 5)

        # Queue task with delay to allow batching
        # Multiple shifts created within the delay window will be batched together
        send_open_shift_notifications.apply_async(
            args=[instance.id],
            countdown=batching_delay,
            queue='notifications'
        )

        logger.info(
            f"Queued open shift notification task for shift {instance.original_shift.id} "
            f"(OpenShiftRequest ID: {instance.id})"
        )

    except Exception as e:
        logger.exception(f"Error queuing open shift notification: {e}")


# =============================================================================
# Shift Exchange Notifications
# =============================================================================

@receiver(pre_save, sender=ShiftExchange)
def track_exchange_status(sender, instance, **kwargs):
    """
    Track the previous status of a ShiftExchange to detect status changes.
    Store the previous status to compare in post_save.
    """
    if instance.pk:
        try:
            old_exchange = ShiftExchange.objects.get(pk=instance.pk)
            instance._previous_status = old_exchange.status
        except ShiftExchange.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=ShiftExchange)
def notify_exchange_status_change(sender, instance, created, **kwargs):
    """
    Send push notifications when a shift exchange status changes.

    Notification triggers:
    - Created (pending) → Notify target user of new request
    - accepted_by_target → Notify requesting user that target accepted
    - approved → Notify both users of approval
    - rejected → Notify requesting user of rejection
    - cancelled → Notify target user of cancellation

    Uses Celery task for async processing to not block the request.
    """
    try:
        from .tasks import send_exchange_status_notification

        previous_status = getattr(instance, '_previous_status', None)
        current_status = instance.status

        # Determine what type of notification to send
        notification_event = None

        if created and current_status == 'pending':
            notification_event = 'created'
        elif previous_status != current_status:
            if current_status == 'accepted_by_target':
                notification_event = 'accepted'
            elif current_status == 'approved':
                notification_event = 'approved'
            elif current_status == 'rejected':
                notification_event = 'rejected'
            elif current_status == 'cancelled':
                notification_event = 'cancelled'

        if notification_event:
            # Queue async task for notification
            send_exchange_status_notification.delay(
                exchange_id=instance.id,
                event_type=notification_event
            )
            logger.info(
                f"Queued exchange notification for exchange {instance.id}: "
                f"event={notification_event}"
            )

    except Exception as e:
        logger.exception(f"Error queuing exchange status notification: {e}")
