"""
Django signals for the API app.
Handles automatic setup and lifecycle events for models.
"""

from django.db.models.signals import post_save, pre_save, pre_delete
from django.dispatch import receiver
from datetime import timedelta
from django.utils import timezone
from .models import SecurityCompany, Shift, OpenShiftRequest, ShiftExchange, AuditLog, ShiftStatusHistory, Notification
from .services import push_notification_service
import logging

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=SecurityCompany)
def setup_trial_period(sender, instance, **kwargs):
    """
    Automatically set up 14-day trial for new companies.

    This signal ensures every new company starts with a 14-day trial period
    where they have access to all features regardless of their selected tier.
    After the trial expires, features are restricted to their subscription tier.

    Trial Setup:
    - is_trial = True
    - trial_end_date = created_at + 14 days
    - Full feature access during trial
    - After trial: Features restricted to subscription_tier
    """
    # Only run for new companies (no pk yet)
    if not instance.pk:
        # Set trial period for new companies
        if not instance.is_trial and not instance.trial_end_date:
            instance.is_trial = True
            instance.trial_end_date = timezone.now() + timedelta(days=14)

            logger.info(
                f"Auto-enabled 14-day trial for new company: {instance.name} "
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
def record_shift_status_history(sender, instance, created, **kwargs):
    """
    Record a ShiftStatusHistory entry whenever a shift's status changes.
    Uses _previous_status set by track_shift_assignment pre_save signal.
    """
    original = getattr(instance, '_previous_status', None)
    if not created and original and original != instance.status:
        try:
            ShiftStatusHistory.objects.create(
                shift=instance,
                old_status=original,
                new_status=instance.status,
                changed_by=getattr(instance, '_changed_by', None),
                notes=getattr(instance, '_status_change_notes', '')
            )
        except Exception as e:
            logger.error(f"Failed to record shift status history for shift {instance.id}: {e}")


@receiver(post_save, sender=Shift)
def notify_shift_assignment(sender, instance, created, **kwargs):
    """
    Send push notification when a shift is assigned, removed, or reassigned.

    Triggers when:
    - New shift created with staff_user assigned → assignment notification
    - Existing shift updated with new staff_user assignment → assignment notification
    - Staff removed from shift (staff_user becomes None) → removal notification
    - Staff reassigned to different user → reassignment + assignment notifications

    Also schedules reminder notifications via Celery for new assignments.

    Drafts (is_published=False) never fire notifications — staff are only told
    about shifts after the manager publishes them.
    """
    if not instance.is_published:
        return

    previous_staff = getattr(instance, '_previous_staff_user', None)
    current_staff = instance.staff_user

    # Format date and time for notifications
    start_time = instance.start_time
    formatted_date = start_time.strftime('%B %d, %Y')  # e.g., "December 15, 2025"
    formatted_time = start_time.strftime('%I:%M %p')   # e.g., "09:00 AM"
    venue_name = instance.venue.name if instance.venue else 'Unknown Venue'

    # Case 1: Staff removed from shift (had staff, now has none)
    if previous_staff and not current_staff and not created:
        try:
            push_notification_service.send_shift_removal_notification(
                user_id=previous_staff.id,
                shift_id=instance.id,
                venue_name=venue_name,
                shift_date=formatted_date,
                shift_time=formatted_time,
                reason=None  # Could be enhanced to pass a reason if available
            )
            logger.info(
                f"Shift removal notification sent for shift {instance.id} "
                f"to previous staff user {previous_staff.id}"
            )
        except Exception as e:
            logger.exception(f"Error sending shift removal notification: {e}")

        # In-app notification
        try:
            company = instance.venue.company if instance.venue else None
            Notification.send(
                user=previous_staff,
                title='Shift Removed',
                message=f'You have been removed from your shift at {venue_name} on {formatted_date} at {formatted_time}.',
                notification_type='shift_removed',
                related_type='shift',
                related_id=str(instance.id),
                action_url=f'/shifts/{instance.id}',
                company=company,
            )
        except Exception as e:
            logger.warning(f"Could not create in-app shift removal notification: {e}")

        # Queue email notification for shift removal
        try:
            from .tasks import send_shift_removal_email_task
            send_shift_removal_email_task.delay(
                user_id=previous_staff.id,
                shift_id=instance.id,
                venue_name=venue_name,
                shift_date=formatted_date,
                shift_time=formatted_time,
                reason=None
            )
            logger.info(f"Queued shift removal email for shift {instance.id}")
        except Exception as e:
            logger.warning(f"Could not queue shift removal email: {e}")

        return  # No further processing needed

    # Case 2: Staff reassigned to different user
    if previous_staff and current_staff and previous_staff != current_staff and not created:
        try:
            # Get the new staff member's name for the reassignment notification
            new_staff_name = current_staff.get_full_name() or current_staff.username

            push_notification_service.send_shift_reassignment_notification(
                user_id=previous_staff.id,
                shift_id=instance.id,
                venue_name=venue_name,
                shift_date=formatted_date,
                shift_time=formatted_time,
                new_staff_name=new_staff_name
            )
            logger.info(
                f"Shift reassignment notification sent for shift {instance.id} "
                f"to previous staff user {previous_staff.id}"
            )
        except Exception as e:
            logger.exception(f"Error sending shift reassignment notification: {e}")

        # In-app notification for reassigned-away staff
        try:
            company = instance.venue.company if instance.venue else None
            new_staff_name = current_staff.get_full_name() or current_staff.username
            Notification.send(
                user=previous_staff,
                title='Shift Reassigned',
                message=f'Your shift at {venue_name} on {formatted_date} at {formatted_time} has been reassigned to {new_staff_name}.',
                notification_type='shift_removed',
                related_type='shift',
                related_id=str(instance.id),
                action_url=f'/shifts/{instance.id}',
                company=company,
            )
        except Exception as e:
            logger.warning(f"Could not create in-app shift reassignment notification: {e}")

        # Queue email notification for old staff being replaced
        try:
            from .tasks import send_shift_removal_email_task
            send_shift_removal_email_task.delay(
                user_id=previous_staff.id,
                shift_id=instance.id,
                venue_name=venue_name,
                shift_date=formatted_date,
                shift_time=formatted_time,
                reason=f"Shift has been reassigned to {new_staff_name}"
            )
            logger.info(f"Queued shift reassignment removal email for shift {instance.id}")
        except Exception as e:
            logger.warning(f"Could not queue shift reassignment email: {e}")

        # Continue to send assignment notification to new staff

    # Case 3: New assignment (new shift with staff, or staff added/changed)
    if not current_staff:
        return

    is_new_assignment = created or (previous_staff != current_staff)
    if not is_new_assignment:
        return

    # Only notify for scheduled shifts (not completed, cancelled, etc.)
    if instance.status not in ['scheduled', 'open', 'active']:
        return

    try:
        # Send immediate notification to new assignee
        success = push_notification_service.send_shift_assignment_notification(
            user_id=current_staff.id,
            shift_id=instance.id,
            venue_name=venue_name,
            start_time=formatted_time,
            formatted_date=formatted_date
        )

        if success:
            logger.info(
                f"Shift assignment notification sent for shift {instance.id} "
                f"to user {current_staff.id}"
            )
        else:
            logger.warning(
                f"Failed to send shift assignment notification for shift {instance.id}"
            )

        # In-app notification for new assignment
        try:
            company = instance.venue.company if instance.venue else None
            Notification.send(
                user=current_staff,
                title='Shift Assigned',
                message=f'You have been assigned a shift at {venue_name} on {formatted_date} at {formatted_time}.',
                notification_type='shift_assigned',
                related_type='shift',
                related_id=str(instance.id),
                action_url=f'/shifts/{instance.id}',
                company=company,
            )
        except Exception as e:
            logger.warning(f"Could not create in-app shift assignment notification: {e}")

        # Schedule reminder tasks via Celery
        try:
            from .tasks import schedule_shift_reminders
            schedule_shift_reminders.delay(instance.id)
            logger.info(f"Scheduled reminder tasks for shift {instance.id}")
        except Exception as e:
            logger.warning(f"Could not schedule reminder tasks: {e}")

        # Queue email notification task
        try:
            from .tasks import send_shift_assignment_email_task
            venue_address = instance.venue.address if instance.venue else None
            end_time = instance.end_time.strftime('%I:%M %p') if instance.end_time else None
            send_shift_assignment_email_task.delay(
                user_id=current_staff.id,
                shift_id=instance.id,
                venue_name=venue_name,
                venue_address=venue_address,
                start_time=formatted_time,
                end_time=end_time,
                formatted_date=formatted_date,
                hourly_rate=None  # Could be enhanced to pass pay rate if available
            )
            logger.info(f"Queued shift assignment email for shift {instance.id}")
        except Exception as e:
            logger.warning(f"Could not queue shift assignment email: {e}")

        # Multi-staff shift: Notify existing co-workers about new assignment
        if instance.shift_group:
            try:
                _notify_coworkers_of_new_assignment(instance, current_staff)
            except Exception as e:
                logger.exception(f"Error notifying co-workers: {e}")

    except Exception as e:
        logger.exception(f"Error sending shift assignment notification: {e}")


def _notify_coworkers_of_new_assignment(shift, new_staff):
    """
    Notify existing co-workers when a new staff member is assigned to a grouped shift.

    Args:
        shift: The Shift instance that was just assigned
        new_staff: The User who was just assigned to the shift
    """
    # Find other shifts in the same group
    coworker_shifts = Shift.objects.filter(
        shift_group=shift.shift_group
    ).exclude(id=shift.id).select_related('staff_user')

    new_staff_name = new_staff.get_full_name() or new_staff.username
    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'
    formatted_date = shift.start_time.strftime('%B %d, %Y')
    formatted_time = shift.start_time.strftime('%I:%M %p')

    for coworker_shift in coworker_shifts:
        if coworker_shift.staff_user:
            try:
                push_notification_service.send_coworker_assignment_notification(
                    user_id=coworker_shift.staff_user.id,
                    shift_id=shift.id,
                    coworker_name=new_staff_name,
                    venue_name=venue_name,
                    shift_date=formatted_date,
                    shift_time=formatted_time
                )
                logger.info(
                    f"Co-worker notification sent for shift {shift.id} "
                    f"to user {coworker_shift.staff_user.id} about new co-worker {new_staff.id}"
                )
            except Exception as e:
                logger.exception(
                    f"Error sending co-worker notification to user {coworker_shift.staff_user.id}: {e}"
                )


# =============================================================================
# Open Shift Notifications
# =============================================================================

@receiver(post_save, sender=Shift)
def auto_create_open_shift_request(sender, instance, created, **kwargs):
    """
    Automatically create an OpenShiftRequest when an open shift is published.

    Fires whenever a Shift is saved that meets all of:
      - status='open' and no staff assigned
      - is_published=True (drafts never broadcast — even on creation)
      - no existing OpenShiftRequest for this Shift

    The post_save signal on the resulting OpenShiftRequest queues the batched
    push-notification Celery task, so this is what makes "Publish week" actually
    notify eligible staff.
    """
    if instance.status != 'open' or instance.staff_user is not None:
        return

    if not instance.is_published:
        return

    # Idempotent — don't create a duplicate OpenShiftRequest if a publish save
    # fires more than once, or if the shift was already broadcast.
    if OpenShiftRequest.objects.filter(original_shift=instance).exists():
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
            # Queue async task for push notification
            send_exchange_status_notification.delay(
                exchange_id=instance.id,
                event_type=notification_event
            )
            logger.info(
                f"Queued exchange notification for exchange {instance.id}: "
                f"event={notification_event}"
            )

            # Queue email notification task (only for key events)
            if notification_event in ['created', 'accepted', 'approved']:
                try:
                    from .tasks import send_exchange_email_task
                    send_exchange_email_task.delay(
                        exchange_id=instance.id,
                        event_type=notification_event
                    )
                    logger.info(
                        f"Queued exchange email for exchange {instance.id}: "
                        f"event={notification_event}"
                    )
                except Exception as email_error:
                    logger.warning(f"Could not queue exchange email: {email_error}")

    except Exception as e:
        logger.exception(f"Error queuing exchange status notification: {e}")


# =============================================================================
# Shift Deletion Notifications
# =============================================================================

@receiver(pre_delete, sender=Shift)
def notify_shift_deletion(sender, instance, **kwargs):
    """
    Send push notification when a shift with assigned staff is deleted.

    Uses pre_delete signal to capture shift data before it's removed from database.
    This ensures the assigned staff member is notified when their shift is deleted.

    Drafts (is_published=False) are silent — staff were never told about the
    shift, so removing it shouldn't notify them either.
    """
    # Only notify if there's an assigned staff member
    if not instance.staff_user:
        return

    # Drafts never broadcast — deleting them is also silent.
    if not instance.is_published:
        return

    # Only notify for future/active shifts (not past completed ones)
    if instance.status in ['completed', 'cancelled', 'no_show']:
        return

    try:
        # Format date and time for notification
        start_time = instance.start_time
        formatted_date = start_time.strftime('%B %d, %Y')
        formatted_time = start_time.strftime('%I:%M %p')
        venue_name = instance.venue.name if instance.venue else 'Unknown Venue'

        # Send removal notification (shift deleted = removed from staff's schedule)
        push_notification_service.send_shift_removal_notification(
            user_id=instance.staff_user.id,
            shift_id=instance.id,
            venue_name=venue_name,
            shift_date=formatted_date,
            shift_time=formatted_time,
            reason="Shift has been cancelled"
        )

        logger.info(
            f"Shift deletion notification sent for shift {instance.id} "
            f"to user {instance.staff_user.id}"
        )

        # Queue email notification for shift deletion
        try:
            from .tasks import send_shift_removal_email_task
            send_shift_removal_email_task.delay(
                user_id=instance.staff_user.id,
                shift_id=instance.id,
                venue_name=venue_name,
                shift_date=formatted_date,
                shift_time=formatted_time,
                reason="Shift has been cancelled"
            )
            logger.info(f"Queued shift deletion email for shift {instance.id}")
        except Exception as e:
            logger.warning(f"Could not queue shift deletion email: {e}")

    except Exception as e:
        logger.exception(f"Error sending shift deletion notification: {e}")


# =============================================================================
# Time Adjustment & Invoice Auto-Update
# =============================================================================

@receiver(post_save, sender='api.TimeAdjustment')
def sync_shift_and_recalc_invoice_on_time_adjustment(sender, instance, created, **kwargs):
    """
    Sync the adjusted attendance values back onto the parent Shift so the Shift
    remains the single source of truth (Phase 1 of the attendance source-of-truth
    refactor — see docs/attendance-source-of-truth.md).

    Then, if an invoice already covers this shift, recalculate its line items so
    payment calculations stay accurate after a manager correction.
    """
    from .models import InvoiceItem

    # Only process new adjustments, not updates
    if not created:
        return

    shift = instance.shift

    # P3.1 (C4 fix): always write the adjusted values through to the Shift.
    # Previously this guarded with `not shift.check_in_time` which meant
    # corrections never reached Shift in the normal case where staff had
    # already self-checked-out. The audit trail on TimeAdjustment.original_*
    # preserves the pre-correction values, so overwriting Shift is safe.
    sync_fields = []
    if instance.adjusted_check_in_time is not None:
        shift.check_in_time = instance.adjusted_check_in_time
        sync_fields.append('check_in_time')
    if instance.adjusted_check_out_time is not None:
        shift.check_out_time = instance.adjusted_check_out_time
        sync_fields.append('check_out_time')
    if instance.adjusted_actual_hours is not None:
        shift.actual_hours_worked = instance.adjusted_actual_hours
        sync_fields.append('actual_hours_worked')
    if sync_fields:
        shift.save(update_fields=sync_fields)
        logger.info(
            f"Synced Shift {shift.id} from TimeAdjustment {instance.id}: {sync_fields}"
        )

    # A single shift can produce multiple InvoiceItems (base + OT + special tiers),
    # so look up the parent invoice via filter() and let recalculate_from_shifts
    # re-emit all per-tier rows from the new actual_hours_worked.
    try:
        invoice_item = (
            InvoiceItem.objects.select_related('invoice').filter(shift=shift).first()
        )
        if invoice_item is None:
            logger.debug(
                f"Shift {shift.id} has time adjustment but no invoice exists yet - "
                f"will be included when invoice is generated"
            )
            return

        invoice = invoice_item.invoice

        # Skip paid invoices — those are locked. Allow pending/rejected/draft so
        # the reject → adjust → re-issue cycle can update line items in place.
        if invoice.status == 'paid':
            logger.warning(
                f"Skipping invoice update for shift {shift.id} - "
                f"invoice {invoice.id} is already paid"
            )
            return

        invoice.recalculate_from_shifts()

        logger.info(
            f"Auto-updated invoice {invoice.id} after time adjustment "
            f"for shift {shift.id} by {instance.adjusted_by.username if instance.adjusted_by else 'Unknown'}"
        )

        # P3.4 (C3 fix): cascade recompute to sibling invoices containing
        # later-starting shifts in the same ISO week. Their OT split depends
        # on this shift's hours (prior_hours accumulator), so adjusting this
        # shift can shift the OT classification of later shifts. Earlier
        # shifts are unaffected (their prior_hours doesn't include this one).
        from datetime import timedelta as _td
        from .models import Invoice as _Invoice
        if shift.start_time:
            shift_date = shift.start_time.date()
            week_start = shift_date - _td(days=shift_date.weekday())
            week_end = week_start + _td(days=6)
            sibling_invoice_ids = list(
                InvoiceItem.objects
                .filter(
                    invoice__staff_user=shift.staff_user,
                    invoice__superseded_by__isnull=True,
                    shift__start_time__date__gte=week_start,
                    shift__start_time__date__lte=week_end,
                    shift__start_time__gt=shift.start_time,
                )
                .exclude(invoice_id=invoice.id)
                .values_list('invoice_id', flat=True)
                .distinct()
            )
            for sibling_id in sibling_invoice_ids:
                sibling = _Invoice.objects.filter(pk=sibling_id).first()
                if not sibling or sibling.status == 'paid':
                    continue
                sibling.recalculate_from_shifts()
                logger.info(
                    f"Cascaded recompute to sibling invoice {sibling_id} "
                    f"for staff {shift.staff_user_id} week {week_start}"
                )

    except Exception as e:
        logger.error(
            f"Error auto-updating invoice after time adjustment for shift {shift.id}: {str(e)}",
            exc_info=True
        )


# =============================================================================
# PayrollRun cached-aggregate refresh
# =============================================================================

@receiver(post_save, sender='api.Invoice')
def refresh_payrollrun_aggregates_on_invoice_save(sender, instance, **kwargs):
    """Keep `PayrollRun.gross_total` / `hours_billed` / `invoice_count` in sync
    with their child invoices.

    Without this, a manager-driven `Invoice.recalculate_from_shifts()` (e.g.
    after a time adjustment) updated invoice totals but the parent run's
    cached aggregates still reflected the pre-adjustment numbers, so the
    Payroll page's "Previous runs" rail and the run header drifted apart.

    Side-effects: a single recompute_totals() does one aggregate query per
    save, so it's cheap. Bulk paths that don't want this firing should use
    queryset.update() (which doesn't emit post_save) and call recompute_totals
    explicitly when they're done.
    """
    run = instance.payroll_run
    if run is None:
        return
    # Avoid recursion: both methods save the PayrollRun, not the invoice,
    # so this won't re-enter this signal.
    try:
        run.recompute_totals()
        # update_status_from_invoices() flips pending → approved → paid based
        # on child invoice statuses. Without this, the run pill stays stuck
        # at its initial status even after every officer is paid out.
        run.update_status_from_invoices()
    except Exception:
        logger.exception(
            f"Failed to refresh PayrollRun {run.id} aggregates after "
            f"Invoice {instance.id} save"
        )


# =============================================================================
# Shift Approval Email Notifications
# =============================================================================

@receiver(post_save, sender=Shift)
def notify_shift_approval(sender, instance, created, **kwargs):
    """
    Send email notification when a shift is approved.

    Triggers when:
    - Shift status changes to 'approved' from any other status
    """
    if created:
        return  # Don't trigger on creation

    previous_status = getattr(instance, '_previous_status', None)
    current_status = instance.status

    # Only trigger when status changes to 'approved'
    if current_status != 'approved' or previous_status == 'approved':
        return

    if not instance.staff_user:
        return

    try:
        from .tasks import send_approval_email_task

        # Format shift details
        start_time = instance.start_time
        formatted_date = start_time.strftime('%B %d, %Y')
        formatted_time = start_time.strftime('%I:%M %p')
        venue_name = instance.venue.name if instance.venue else 'Unknown Venue'

        # Calculate hours worked if available
        hours_worked = None
        if instance.actual_hours_worked:
            hours = float(instance.actual_hours_worked)
            hours_worked = f"{hours:.1f} hours"

        send_approval_email_task.delay(
            user_id=instance.staff_user.id,
            shift_id=instance.id,
            approval_type='shift_approved',
            venue_name=venue_name,
            shift_date=formatted_date,
            shift_time=formatted_time,
            hours_worked=hours_worked
        )
        logger.info(f"Queued shift approval email for shift {instance.id}")

    except Exception as e:
        logger.warning(f"Could not queue shift approval email: {e}")


@receiver(pre_save, sender=OpenShiftRequest)
def track_open_shift_request_status(sender, instance, **kwargs):
    """
    Track when an OpenShiftRequest status is changing.
    Store the previous status to detect claim approvals in post_save.
    """
    if instance.pk:
        try:
            old_request = OpenShiftRequest.objects.get(pk=instance.pk)
            instance._previous_status = old_request.status
        except OpenShiftRequest.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=OpenShiftRequest)
def notify_claim_approved(sender, instance, created, **kwargs):
    """
    Send email notification when an open shift claim is approved.

    Triggers when:
    - OpenShiftRequest status changes to 'approved'
    - And there is a claimed_by user
    """
    if created:
        return

    previous_status = getattr(instance, '_previous_status', None)
    current_status = instance.status

    # Only trigger when status changes to 'approved'
    if current_status != 'approved' or previous_status == 'approved':
        return

    if not instance.claimed_by:
        return

    try:
        from .tasks import send_approval_email_task

        shift = instance.original_shift
        start_time = shift.start_time
        formatted_date = start_time.strftime('%B %d, %Y')
        formatted_time = shift.start_time.strftime('%I:%M %p')
        venue_name = shift.venue.name if shift.venue else 'Unknown Venue'
        venue_address = shift.venue.address if shift.venue else None

        send_approval_email_task.delay(
            user_id=instance.claimed_by.id,
            shift_id=shift.id,
            approval_type='claim_approved',
            venue_name=venue_name,
            shift_date=formatted_date,
            shift_time=formatted_time,
            venue_address=venue_address
        )
        logger.info(f"Queued claim approval email for OpenShiftRequest {instance.id}")

    except Exception as e:
        logger.warning(f"Could not queue claim approval email: {e}")


# =============================================================================
# Audit Logging Signals
# =============================================================================

@receiver(post_save, sender='api.User')
def audit_user_creation(sender, instance, created, **kwargs):
    """Log user creation events to the audit trail."""
    if not created:
        return
    try:
        company = None
        membership = instance.company_memberships.filter(is_active=True).select_related('company').first()
        if membership:
            company = membership.company
        AuditLog.objects.create(
            user=instance,
            company=company,
            action='create',
            resource_type='User',
            resource_id=str(instance.id),
            details={
                'username': instance.username,
                'email': instance.email,
                'role': getattr(instance, 'role', ''),
            },
        )
    except Exception as e:
        logger.warning(f"Failed to create audit log for user creation: {e}")


@receiver(pre_save, sender='api.User')
def audit_user_role_change(sender, instance, **kwargs):
    """Log user role changes to the audit trail."""
    if not instance.pk:
        return
    try:
        from .models import User
        old_user = User.objects.get(pk=instance.pk)
        old_role = getattr(old_user, 'role', None)
        new_role = getattr(instance, 'role', None)
        if old_role and new_role and old_role != new_role:
            company = None
            membership = instance.company_memberships.filter(is_active=True).select_related('company').first()
            if membership:
                company = membership.company
            AuditLog.objects.create(
                user=instance,
                company=company,
                action='role_change',
                resource_type='User',
                resource_id=str(instance.id),
                details={
                    'old_role': old_role,
                    'new_role': new_role,
                    'username': instance.username,
                },
            )
    except sender.DoesNotExist:
        pass
    except Exception as e:
        logger.warning(f"Failed to create audit log for role change: {e}")


@receiver(pre_save, sender='api.Invoice')
def audit_invoice_status_change(sender, instance, **kwargs):
    """Log invoice status changes to the audit trail."""
    if not instance.pk:
        return
    try:
        from .models import Invoice
        old_invoice = Invoice.objects.get(pk=instance.pk)
        old_status = old_invoice.status
        new_status = instance.status
        if old_status != new_status:
            # P4 (H4 fix): resolve company via the staff user's active
            # membership. Invoice has no `company` field so the previous
            # `instance.company` always evaluated to None and broke
            # multi-tenant audit filtering.
            company = None
            if instance.staff_user_id:
                try:
                    membership = (
                        instance.staff_user.company_memberships
                        .filter(is_active=True)
                        .select_related('company')
                        .first()
                    )
                    if membership:
                        company = membership.company
                except Exception:
                    pass
            AuditLog.objects.create(
                user=instance.staff_user if hasattr(instance, 'staff_user') else None,
                company=company,
                action='status_change',
                resource_type='Invoice',
                resource_id=str(instance.id),
                details={
                    'old_status': old_status,
                    'new_status': new_status,
                    'invoice_number': getattr(instance, 'invoice_number', ''),
                },
            )
    except sender.DoesNotExist:
        pass
    except Exception as e:
        logger.warning(f"Failed to create audit log for invoice status change: {e}")
