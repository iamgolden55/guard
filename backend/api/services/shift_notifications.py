"""
Shared shift-assignment notification fan-out.

Two code paths need to tell an officer "you're on this shift": the Shift
post_save signal (when staff_user changes) and the batch publish endpoint (when
a draft goes live). Keeping the fan-out in one place stops them drifting apart
— which they already did twice. The publish endpoint grew a past-shift guard
and an in-app notification but never sent the email, while ShiftViewSet
.perform_create emailed on *every* create with no is_published check, so
officers were told about draft shifts their manager hadn't published yet.

Callers decide *whether* an assignment happened. This module decides *what*
gets sent, and owns the guards that must hold for every caller.
"""

import logging

from django.utils import timezone

from .notification_service import push_notification_service

logger = logging.getLogger(__name__)

# Statuses where "you have been assigned a shift" is a truthful thing to say.
# Completed / cancelled / rejected shifts are history, not assignments.
NOTIFIABLE_STATUSES = ('scheduled', 'open', 'active')


def notify_shift_assigned(shift, company=None):
    """
    Notify a shift's assigned officer: push + in-app + email + reminders.

    Args:
        shift: the Shift instance the officer is assigned to
        company: owning SecurityCompany; derived from the venue when omitted

    Returns:
        bool: True if the officer was notified, False if the send was skipped.
        Individual channels failing (dead Celery broker, push token expired)
        does not make this return False — they are logged and swallowed so a
        notification problem can never fail the caller's request.
    """
    from ..models import Notification

    staff = shift.staff_user
    if not staff:
        return False

    # Drafts belong to the manager's scheduling workflow and stay invisible to
    # staff until "Publish" is clicked, so they must stay silent too.
    if not shift.is_published:
        logger.debug(f"Skipping assignment notification for draft shift {shift.id}")
        return False

    # A "you've been assigned" alert for a shift that already started is
    # misleading — edits to worked shifts are admin cleanup, not assignments.
    if shift.start_time and shift.start_time <= timezone.now():
        logger.debug(
            f"Skipping assignment notification for past shift {shift.id} "
            f"(start_time={shift.start_time})"
        )
        return False

    if shift.status not in NOTIFIABLE_STATUSES:
        logger.debug(
            f"Skipping assignment notification for shift {shift.id} "
            f"with status {shift.status}"
        )
        return False

    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'
    formatted_date = shift.start_time.strftime('%B %d, %Y')   # "December 15, 2025"
    formatted_time = shift.start_time.strftime('%I:%M %p')    # "09:00 AM"
    if company is None:
        company = shift.venue.company if shift.venue else None

    # Push notification
    try:
        success = push_notification_service.send_shift_assignment_notification(
            user_id=staff.id,
            shift_id=shift.id,
            venue_name=venue_name,
            start_time=formatted_time,
            formatted_date=formatted_date,
        )
        if success:
            logger.info(
                f"Shift assignment notification sent for shift {shift.id} "
                f"to user {staff.id}"
            )
        else:
            logger.warning(
                f"Failed to send shift assignment notification for shift {shift.id}"
            )
    except Exception as e:
        logger.exception(f"Error sending shift assignment push for shift {shift.id}: {e}")

    # In-app notification
    try:
        Notification.send(
            user=staff,
            title='Shift Assigned',
            message=(
                f'You have been assigned a shift at {venue_name} '
                f'on {formatted_date} at {formatted_time}.'
            ),
            notification_type='shift_assigned',
            related_type='shift',
            related_id=str(shift.id),
            action_url=f'/shifts/{shift.id}',
            company=company,
        )
    except Exception as e:
        logger.warning(f"Could not create in-app shift assignment notification: {e}")

    # Reminder tasks via Celery
    try:
        from ..tasks import schedule_shift_reminders
        schedule_shift_reminders.delay(shift.id)
        logger.info(f"Scheduled reminder tasks for shift {shift.id}")
    except Exception as e:
        logger.warning(f"Could not schedule reminder tasks: {e}")

    # Email via Celery
    try:
        from ..tasks import send_shift_assignment_email_task
        venue_address = shift.venue.address if shift.venue else None
        end_time = shift.end_time.strftime('%I:%M %p') if shift.end_time else None
        send_shift_assignment_email_task.delay(
            user_id=staff.id,
            shift_id=shift.id,
            venue_name=venue_name,
            venue_address=venue_address,
            start_time=formatted_time,
            end_time=end_time,
            formatted_date=formatted_date,
            hourly_rate=str(shift.hourly_rate) if shift.hourly_rate else None,
        )
        logger.info(f"Queued shift assignment email for shift {shift.id}")
    except Exception as e:
        logger.warning(f"Could not queue shift assignment email: {e}")

    # Multi-staff shift: let existing co-workers know who joined them
    if shift.shift_group:
        try:
            notify_coworkers_of_new_assignment(shift, staff)
        except Exception as e:
            logger.exception(f"Error notifying co-workers: {e}")

    return True


def notify_coworkers_of_new_assignment(shift, new_staff):
    """
    Notify existing co-workers when a new staff member joins a grouped shift.

    Args:
        shift: the Shift instance that was just assigned
        new_staff: the User who was just assigned to the shift
    """
    from ..models import Shift

    coworker_shifts = Shift.objects.filter(
        shift_group=shift.shift_group
    ).exclude(id=shift.id).select_related('staff_user')

    new_staff_name = new_staff.get_full_name() or new_staff.username
    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'
    formatted_date = shift.start_time.strftime('%B %d, %Y')
    formatted_time = shift.start_time.strftime('%I:%M %p')

    for coworker_shift in coworker_shifts:
        if not coworker_shift.staff_user:
            continue
        try:
            push_notification_service.send_coworker_assignment_notification(
                user_id=coworker_shift.staff_user.id,
                shift_id=shift.id,
                coworker_name=new_staff_name,
                venue_name=venue_name,
                shift_date=formatted_date,
                shift_time=formatted_time,
            )
            logger.info(
                f"Co-worker notification sent for shift {shift.id} "
                f"to user {coworker_shift.staff_user.id} about new co-worker {new_staff.id}"
            )
        except Exception as e:
            logger.exception(
                f"Error sending co-worker notification to user "
                f"{coworker_shift.staff_user.id}: {e}"
            )
