"""
Celery tasks for the Security Staff Management System.

This module contains all async tasks for report generation, file processing,
and system maintenance operations.
"""

import os
import traceback
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Union
from pathlib import Path
from asgiref.sync import async_to_sync

from celery import shared_task, current_task
from celery.exceptions import Retry
from django.conf import settings
from django.core.mail import send_mail
from django.core.files.storage import default_storage
from django.utils import timezone
from django.db import transaction
from django.template.loader import render_to_string
from channels.layers import get_channel_layer

from .models import ReportJob, ReportTemplate, User
from .utils.report_generator import ReportGenerator
from .utils.export_handlers import get_export_handler

logger = logging.getLogger(__name__)


class TaskProgressTracker:
    """Utility class for tracking task progress with WebSocket notifications."""

    def __init__(self, task_id: str, report_job_id: str = None, user_id: int = None, total_steps: int = 100):
        self.task_id = task_id
        self.report_job_id = report_job_id
        self.user_id = user_id
        self.total_steps = total_steps
        self.current_step = 0
        self.channel_layer = get_channel_layer()

    def update_progress(self, step: int, message: str = ""):
        """Update task progress and send WebSocket notifications."""
        self.current_step = step
        progress_percent = int((step / self.total_steps) * 100)

        # Update Celery task state
        if current_task:
            current_task.update_state(
                state='PROGRESS',
                meta={
                    'current': step,
                    'total': self.total_steps,
                    'percent': progress_percent,
                    'message': message
                }
            )

        # Update ReportJob progress in database
        if self.report_job_id:
            try:
                from .models import ReportJob
                ReportJob.objects.filter(job_id=self.report_job_id).update(
                    progress=progress_percent
                )
            except Exception as e:
                logger.warning(f'Failed to update ReportJob progress: {str(e)}')

        # Send WebSocket notification
        if self.channel_layer and self.report_job_id and self.user_id:
            try:
                async_to_sync(self._send_progress_notification)(
                    progress_percent, step, message
                )
            except Exception as e:
                logger.warning(f'Failed to send WebSocket progress notification: {str(e)}')

        logger.info(f'Task {self.task_id} progress: {progress_percent}% - {message}')

    async def _send_progress_notification(self, progress_percent: int, current_step: int, message: str):
        """Send progress notification via WebSocket."""
        # Send to user-specific group
        await self.channel_layer.group_send(
            f'reports_user_{self.user_id}',
            {
                'type': 'report_progress',
                'job_id': self.report_job_id,
                'progress': progress_percent,
                'current': current_step,
                'total': self.total_steps,
                'message': message,
                'timestamp': timezone.now().isoformat()
            }
        )

        # Send to job-specific group
        await self.channel_layer.group_send(
            f'report_job_{self.report_job_id}',
            {
                'type': 'report_progress',
                'job_id': self.report_job_id,
                'progress': progress_percent,
                'current': current_step,
                'total': self.total_steps,
                'message': message,
                'timestamp': timezone.now().isoformat()
            }
        )


@shared_task(bind=True, max_retries=3)
def generate_report_async(self, report_job_id: str, user_id: int) -> Dict[str, Any]:
    """
    Generate a report asynchronously.

    Args:
        report_job_id: UUID of the ReportJob instance
        user_id: ID of the user requesting the report

    Returns:
        Dict with generation results and file information
    """
    task_id = self.request.id
    logger.info(f'Starting report generation task {task_id} for job {report_job_id}')

    progress_tracker = TaskProgressTracker(task_id, report_job_id, user_id, 100)

    try:
        # Get the report job
        progress_tracker.update_progress(5, "Loading report job")
        report_job = ReportJob.objects.select_related('template', 'requested_by').get(
            job_id=report_job_id
        )

        # Validate user permissions
        if report_job.requested_by_id != user_id:
            raise ValueError("User not authorized for this report job")

        # Update job status to processing
        progress_tracker.update_progress(10, "Initializing report generation")
        with transaction.atomic():
            report_job.status = 'processing'
            report_job.started_at = timezone.now()
            report_job.save(update_fields=['status', 'started_at'])

        # Initialize report generator
        progress_tracker.update_progress(15, "Setting up report generator")
        generator = ReportGenerator(
            template=report_job.template,
            date_range_start=report_job.date_range_start,
            date_range_end=report_job.date_range_end,
            filters=report_job.filters,
            user=report_job.requested_by
        )

        # Generate report data
        progress_tracker.update_progress(20, "Gathering report data")
        report_data = generator.generate_data()

        # Update progress during data processing
        progress_tracker.update_progress(50, f"Processing {len(report_data)} records")

        # Get export handler
        progress_tracker.update_progress(60, f"Preparing {report_job.export_format.upper()} export")
        export_handler = get_export_handler(report_job.export_format)

        # Generate file
        progress_tracker.update_progress(70, "Generating file")
        file_result = export_handler.export(
            data=report_data,
            template=report_job.template,
            metadata={
                'job_id': str(report_job.job_id),
                'generated_at': timezone.now().isoformat(),
                'generated_by': report_job.requested_by.get_full_name() or report_job.requested_by.username,
                'date_range': f"{report_job.date_range_start} to {report_job.date_range_end}",
                'filters': report_job.filters,
                'record_count': len(report_data)
            }
        )

        # Save file to storage
        progress_tracker.update_progress(80, "Saving file to storage")
        file_path = _save_report_file(file_result, report_job)

        # Update job with completion details
        progress_tracker.update_progress(90, "Finalizing report job")
        with transaction.atomic():
            report_job.status = 'completed'
            report_job.completed_at = timezone.now()
            report_job.file_path = file_path
            report_job.file_size = file_result.get('file_size', 0)
            report_job.save(update_fields=[
                'status', 'completed_at', 'file_path', 'file_size'
            ])

        # Send notification email if configured
        progress_tracker.update_progress(95, "Sending completion notification")
        if _should_send_notification(report_job.requested_by):
            send_report_notification.delay(
                report_job_id=str(report_job.job_id),
                notification_type='completed'
            )

        progress_tracker.update_progress(100, "Report generation completed")

        # Send WebSocket completion notification
        if progress_tracker.channel_layer:
            try:
                async_to_sync(_send_completion_notification)(
                    str(report_job.job_id), user_id, {
                        'file_path': file_path,
                        'file_size': report_job.file_size,
                        'record_count': len(report_data),
                        'generation_time': (report_job.completed_at - report_job.started_at).total_seconds(),
                        'download_url': _get_download_url(report_job)
                    }
                )
            except Exception as e:
                logger.warning(f'Failed to send WebSocket completion notification: {str(e)}')

        return {
            'status': 'completed',
            'job_id': str(report_job.job_id),
            'file_path': file_path,
            'file_size': report_job.file_size,
            'record_count': len(report_data),
            'generation_time': (report_job.completed_at - report_job.started_at).total_seconds()
        }

    except Exception as exc:
        # Handle task failure
        logger.error(f'Report generation failed for job {report_job_id}: {str(exc)}')
        logger.error(traceback.format_exc())

        try:
            # Update job status to failed
            with transaction.atomic():
                report_job = ReportJob.objects.get(job_id=report_job_id)
                report_job.status = 'failed'
                report_job.error_message = str(exc)
                report_job.retry_count += 1
                report_job.save(update_fields=['status', 'error_message', 'retry_count'])

            # Send failure notification
            if _should_send_notification(report_job.requested_by):
                send_report_notification.delay(
                    report_job_id=report_job_id,
                    notification_type='failed',
                    error_message=str(exc)
                )

            # Send WebSocket failure notification
            channel_layer = get_channel_layer()
            if channel_layer:
                try:
                    async_to_sync(_send_failure_notification)(
                        report_job_id, user_id, {
                            'error_message': str(exc),
                            'retry_count': report_job.retry_count,
                            'max_retries': self.max_retries
                        }
                    )
                except Exception as ws_exc:
                    logger.warning(f'Failed to send WebSocket failure notification: {str(ws_exc)}')

            # Retry if we haven't exceeded max retries
            if self.request.retries < self.max_retries:
                # Exponential backoff: 60s, 120s, 240s
                countdown = 60 * (2 ** self.request.retries)
                logger.info(f'Retrying report generation in {countdown} seconds')
                raise self.retry(countdown=countdown, exc=exc)

        except Exception as update_exc:
            logger.error(f'Failed to update job status: {str(update_exc)}')

        # Re-raise the original exception
        raise exc


@shared_task(bind=True)
def cancel_report_job(self, report_job_id: str, user_id: int) -> Dict[str, Any]:
    """
    Cancel a pending or processing report job.

    Args:
        report_job_id: UUID of the ReportJob instance
        user_id: ID of the user requesting cancellation

    Returns:
        Dict with cancellation results
    """
    logger.info(f'Cancelling report job {report_job_id}')

    try:
        with transaction.atomic():
            report_job = ReportJob.objects.select_for_update().get(
                job_id=report_job_id,
                requested_by_id=user_id
            )

            if report_job.status in ['completed', 'failed', 'cancelled']:
                return {
                    'success': False,
                    'message': f'Cannot cancel job with status: {report_job.status}'
                }

            report_job.status = 'cancelled'
            report_job.completed_at = timezone.now()
            report_job.save(update_fields=['status', 'completed_at'])

        # Send WebSocket cancellation notification
        channel_layer = get_channel_layer()
        if channel_layer:
            try:
                async_to_sync(_send_cancellation_notification)(
                    str(report_job.job_id), user_id
                )
            except Exception as e:
                logger.warning(f'Failed to send WebSocket cancellation notification: {str(e)}')

        # Clean up any temporary files
        if report_job.file_path and os.path.exists(report_job.file_path):
            try:
                os.remove(report_job.file_path)
            except OSError:
                pass

        return {
            'success': True,
            'job_id': str(report_job.job_id),
            'message': 'Report job cancelled successfully'
        }

    except ReportJob.DoesNotExist:
        return {
            'success': False,
            'message': 'Report job not found or not accessible'
        }
    except Exception as exc:
        logger.error(f'Error cancelling report job {report_job_id}: {str(exc)}')
        return {
            'success': False,
            'message': f'Error cancelling job: {str(exc)}'
        }


@shared_task
def send_report_notification(
    report_job_id: str,
    notification_type: str,
    error_message: str = None
) -> bool:
    """
    Send email notification about report status.

    Args:
        report_job_id: UUID of the ReportJob instance
        notification_type: Type of notification ('completed' or 'failed')
        error_message: Error message for failed notifications

    Returns:
        True if notification sent successfully
    """
    try:
        report_job = ReportJob.objects.select_related('requested_by', 'template').get(
            job_id=report_job_id
        )

        user = report_job.requested_by

        if notification_type == 'completed':
            subject = f'Report Ready: {report_job.template.name}'
            template_name = 'emails/report_completed.html'
            context = {
                'user': user,
                'report_job': report_job,
                'download_url': _get_download_url(report_job),
                'expiry_date': timezone.now() + timedelta(days=settings.REPORT_FILE_RETENTION_DAYS)
            }
        else:  # failed
            subject = f'Report Failed: {report_job.template.name}'
            template_name = 'emails/report_failed.html'
            context = {
                'user': user,
                'report_job': report_job,
                'error_message': error_message or 'Unknown error occurred'
            }

        html_message = render_to_string(template_name, context)

        send_mail(
            subject=subject,
            message='',  # Plain text version (optional)
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False
        )

        logger.info(f'Notification sent to {user.email} for report {report_job_id}')
        return True

    except Exception as exc:
        logger.error(f'Failed to send notification for report {report_job_id}: {str(exc)}')
        return False


@shared_task
def cleanup_old_report_files() -> Dict[str, int]:
    """
    Clean up old report files based on retention policy.

    Returns:
        Dict with cleanup statistics
    """
    logger.info('Starting cleanup of old report files')

    cutoff_date = timezone.now() - timedelta(days=settings.REPORT_FILE_RETENTION_DAYS)

    # Get old completed/failed jobs
    old_jobs = ReportJob.objects.filter(
        status__in=['completed', 'failed'],
        completed_at__lt=cutoff_date
    ).exclude(file_path='')

    deleted_files = 0
    deleted_jobs = 0
    errors = 0

    for job in old_jobs:
        try:
            # Delete file from storage
            if job.file_path and default_storage.exists(job.file_path):
                default_storage.delete(job.file_path)
                deleted_files += 1

            # Clear file path from job record (keep job for history)
            job.file_path = ''
            job.save(update_fields=['file_path'])
            deleted_jobs += 1

        except Exception as exc:
            logger.error(f'Error cleaning up job {job.job_id}: {str(exc)}')
            errors += 1

    result = {
        'deleted_files': deleted_files,
        'cleared_job_paths': deleted_jobs,
        'errors': errors,
        'cutoff_date': cutoff_date.isoformat()
    }

    logger.info(f'Cleanup completed: {result}')
    return result


@shared_task
def cleanup_expired_report_jobs() -> Dict[str, int]:
    """
    Clean up very old report job records.

    Returns:
        Dict with cleanup statistics
    """
    logger.info('Starting cleanup of expired report jobs')

    # Keep job records for 30 days after file retention period
    cutoff_date = timezone.now() - timedelta(
        days=settings.REPORT_FILE_RETENTION_DAYS + 30
    )

    # Delete old job records
    deleted_count = ReportJob.objects.filter(
        status__in=['completed', 'failed', 'cancelled'],
        completed_at__lt=cutoff_date
    ).delete()[0]

    result = {
        'deleted_jobs': deleted_count,
        'cutoff_date': cutoff_date.isoformat()
    }

    logger.info(f'Job cleanup completed: {result}')
    return result


@shared_task
def generate_scheduled_report(template_id: int, user_id: int, filters: Dict[str, Any] = None) -> str:
    """
    Generate a scheduled report.

    Args:
        template_id: ID of the ReportTemplate
        user_id: ID of the user for the scheduled report
        filters: Optional filters to apply

    Returns:
        Job ID of the created report job
    """
    try:
        template = ReportTemplate.objects.get(id=template_id)
        user = User.objects.get(id=user_id)

        # Create report job
        report_job = ReportJob.objects.create(
            template=template,
            requested_by=user,
            export_format='pdf',  # Default for scheduled reports
            date_range_start=timezone.now() - timedelta(days=30),  # Last 30 days
            date_range_end=timezone.now(),
            filters=filters or {}
        )

        # Queue async generation
        generate_report_async.delay(str(report_job.job_id), user_id)

        logger.info(f'Scheduled report queued: {report_job.job_id}')
        return str(report_job.job_id)

    except Exception as exc:
        logger.error(f'Error creating scheduled report: {str(exc)}')
        raise


# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def _save_report_file(file_result: Dict[str, Any], report_job: ReportJob) -> str:
    """Save generated report file to storage."""
    filename = f"report_{report_job.job_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{file_result['extension']}"

    # Ensure reports directory exists
    os.makedirs(settings.REPORT_STORAGE_PATH, exist_ok=True)

    file_path = os.path.join(settings.REPORT_STORAGE_PATH, filename)

    # Write file content
    with open(file_path, 'wb') as f:
        f.write(file_result['content'])

    return file_path


def _should_send_notification(user: User) -> bool:
    """Check if user should receive email notifications."""
    # Add logic to check user preferences
    return hasattr(user, 'email') and user.email and user.is_active


def _get_download_url(report_job: ReportJob) -> str:
    """Generate download URL for completed report."""
    return f"/api/v1/reports/jobs/{report_job.job_id}/download/"


# ==========================================
# MONITORING AND HEALTH CHECK TASKS
# ==========================================

@shared_task
def health_check() -> Dict[str, Any]:
    """
    Health check task for monitoring Celery worker status.

    Returns:
        Dict with health check results
    """
    return {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'worker_id': current_task.request.hostname if current_task else 'unknown',
        'task_id': current_task.request.id if current_task else None
    }


@shared_task
def system_maintenance() -> Dict[str, Any]:
    """
    Periodic system maintenance task.

    Returns:
        Dict with maintenance results
    """
    results = {}

    # Clean up temporary files
    temp_path = settings.REPORT_TEMP_PATH
    if os.path.exists(temp_path):
        temp_files_cleaned = 0
        for filename in os.listdir(temp_path):
            file_path = os.path.join(temp_path, filename)
            if os.path.isfile(file_path):
                # Delete files older than 1 hour
                if os.path.getctime(file_path) < (timezone.now() - timedelta(hours=1)).timestamp():
                    try:
                        os.remove(file_path)
                        temp_files_cleaned += 1
                    except OSError:
                        pass
        results['temp_files_cleaned'] = temp_files_cleaned

    # Additional maintenance tasks can be added here

    logger.info(f'System maintenance completed: {results}')
    return results


# ==========================================
# SHIFT NOTIFICATION TASKS
# ==========================================

@shared_task(bind=True, queue='notifications')
def schedule_shift_reminders(self, shift_id: int) -> Dict[str, Any]:
    """
    Schedule reminder notifications for a shift.
    Called when a shift is assigned.

    Schedules:
    - 3 hours before: Advance reminder
    - 45 minutes before: Soon reminder
    - 5 minutes before: Imminent reminder
    - 4 minutes after start: Check-in reminder (if not checked in)
    """
    from .models import Shift

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
        ('advance', timedelta(hours=-3)),       # 3 hours before
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
def send_shift_reminder(self, shift_id: int, reminder_type: str) -> Dict[str, Any]:
    """
    Send a shift reminder notification.

    Args:
        shift_id: The shift to remind about
        reminder_type: 'advance' (3h), 'soon' (45min), 'imminent' (5min)
    """
    from .models import Shift
    from .services import push_notification_service
    from django.core.cache import cache

    # DEDUPLICATION: Check if we already sent this reminder
    cache_key = f"shift_reminder_sent_{shift_id}_{reminder_type}"
    if cache.get(cache_key):
        logger.info(f"Skipping duplicate {reminder_type} reminder for shift {shift_id}")
        return {'status': 'skipped', 'message': 'Reminder already sent (deduplicated)'}

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

    # DEDUPLICATION: Mark this reminder as sent (expires after 24 hours)
    if success:
        cache.set(cache_key, True, timeout=86400)  # 24 hours
        logger.info(f"Sent {reminder_type} reminder for shift {shift_id}, marked in cache")

    return {
        'status': 'success' if success else 'failed',
        'shift_id': shift_id,
        'reminder_type': reminder_type
    }


@shared_task(bind=True, queue='notifications')
def send_checkin_reminder(self, shift_id: int) -> Dict[str, Any]:
    """
    Send a check-in reminder if staff hasn't checked in after shift start.
    Sent 4 minutes after shift start time.
    """
    from .models import Shift
    from .services import push_notification_service
    from django.core.cache import cache

    # DEDUPLICATION: Check if we already sent this check-in reminder
    cache_key = f"shift_checkin_reminder_sent_{shift_id}"
    if cache.get(cache_key):
        logger.info(f"Skipping duplicate check-in reminder for shift {shift_id}")
        return {'status': 'skipped', 'message': 'Check-in reminder already sent (deduplicated)'}

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

    # DEDUPLICATION: Mark this check-in reminder as sent (expires after 12 hours)
    if success:
        cache.set(cache_key, True, timeout=43200)  # 12 hours
        logger.info(f"Sent check-in reminder for shift {shift_id}, marked in cache")

    return {
        'status': 'success' if success else 'failed',
        'shift_id': shift_id,
        'minutes_late': minutes_late
    }


@shared_task(bind=True, max_retries=3, queue='notifications')
def send_open_shift_notifications(self, open_shift_request_id: int) -> Dict[str, Any]:
    """
    Send notifications to qualified users about open shifts.

    Implements intelligent batching: Multiple shifts published within 30 seconds
    are aggregated and sent as a single batch notification per qualified user.

    Args:
        open_shift_request_id: ID of the OpenShiftRequest instance

    Returns:
        Dict with notification results and stats
    """
    from .models import OpenShiftRequest, User
    from .services import push_notification_service
    from django.core.cache import cache

    try:
        # Get the open shift request
        open_shift_request = OpenShiftRequest.objects.select_related(
            'original_shift',
            'original_shift__venue'
        ).get(pk=open_shift_request_id, status='open')

    except OpenShiftRequest.DoesNotExist:
        logger.warning(f"OpenShiftRequest {open_shift_request_id} not found or no longer open")
        return {'status': 'skipped', 'reason': 'shift_not_found'}

    # Get or create batching cache entry
    # Cache key includes current minute for batching shifts in same time window
    cache_key = f"pending_open_shift_notifications_{timezone.now().strftime('%Y%m%d%H%M')}"
    pending_shifts = cache.get(cache_key, [])

    # Add current shift to pending batch
    pending_shifts.append({
        'request_id': open_shift_request.id,
        'shift_id': open_shift_request.original_shift.id,
        'venue_name': open_shift_request.original_shift.venue.name if open_shift_request.original_shift.venue else 'Unknown',
        'start_time': open_shift_request.original_shift.start_time.isoformat(),
        'required_role': open_shift_request.original_shift.required_security_role or 'Any',
    })

    # Store back with 2-minute expiry (covers batching window + processing time)
    cache.set(cache_key, pending_shifts, timeout=120)

    # Deduplicate: If another task is processing this batch, skip
    processing_key = f"{cache_key}_processing"
    if not cache.add(processing_key, True, timeout=60):
        logger.info(f"Another task is already processing this batch")
        return {'status': 'skipped', 'reason': 'already_processing'}

    try:
        # Find all qualified users across all pending shifts in this batch
        qualified_users_map = {}  # {user_id: [shift_data, ...]}

        # Get company from shift venue (multi-tenant filtering)
        company = open_shift_request.original_shift.venue.company
        if not company:
            logger.warning(f"OpenShiftRequest {open_shift_request_id} has no company - skipping")
            return {'status': 'skipped', 'reason': 'no_company'}

        # Get all active staff users with approved profiles IN THE SAME COMPANY
        staff_users = User.objects.filter(
            company_memberships__company=company,
            company_memberships__is_active=True,
            role__in=['staff', 'manager'],
            is_active=True,
            profile__is_approved=True,
            profile__isnull=False
        ).select_related('profile').distinct()

        logger.info(f"Processing {len(pending_shifts)} pending open shifts for {staff_users.count()} staff users in company {company.name}")

        # Check qualification for each shift
        for shift_data in pending_shifts:
            try:
                # Get the OpenShiftRequest to check qualification
                shift_request = OpenShiftRequest.objects.get(
                    pk=shift_data['request_id'],
                    status='open'
                )

                # Check each user's qualification using the model's method
                for user in staff_users:
                    try:
                        # Get available shifts for this user
                        available_shifts = OpenShiftRequest.get_available_shifts(user)

                        # Check if this shift is available for the user
                        if shift_request in available_shifts:
                            if user.id not in qualified_users_map:
                                qualified_users_map[user.id] = []
                            qualified_users_map[user.id].append(shift_data)

                    except Exception as e:
                        logger.warning(f"Error checking qualification for user {user.id}: {e}")
                        continue

            except OpenShiftRequest.DoesNotExist:
                logger.warning(f"OpenShiftRequest {shift_data['request_id']} no longer exists")
                continue

        # Send notifications to qualified users
        notifications_sent = 0
        notifications_failed = 0

        for user_id, user_shifts in qualified_users_map.items():
            try:
                # Determine if single or batch notification
                shift_count = len(user_shifts)

                if shift_count == 1:
                    # Single shift notification
                    shift = user_shifts[0]
                    success = push_notification_service.send_notification(
                        user_id=user_id,
                        title="🆕 New Open Shift Available",
                        body=f"A shift at {shift['venue_name']} is now available to claim",
                        data={
                            'type': 'available_shift',
                            'notification_type': 'available_shift',  # For preference checking
                            'shiftId': shift['shift_id'],
                            'screen': 'ShiftDetails',
                            'batch': False,
                        },
                        priority='high',
                        channel_id='shift-reminders'
                    )
                else:
                    # Batch notification
                    success = push_notification_service.send_notification(
                        user_id=user_id,
                        title="🆕 New Open Shifts Available",
                        body=f"{shift_count} shifts are now available to claim",
                        data={
                            'type': 'available_shifts_batch',
                            'notification_type': 'available_shift',  # For preference checking
                            'shiftIds': [s['shift_id'] for s in user_shifts],
                            'screen': 'AvailableShifts',  # Navigate to list view for batch
                            'batch': True,
                            'count': shift_count,
                        },
                        priority='high',
                        channel_id='shift-reminders'
                    )

                if success:
                    notifications_sent += 1
                    logger.info(f"Sent open shift notification to user {user_id} ({shift_count} shift{'s' if shift_count != 1 else ''})")
                else:
                    notifications_failed += 1

                # Queue email notification for this user
                try:
                    # Prepare shifts data for email
                    email_shifts_data = [
                        {
                            'shift_id': s['shift_id'],
                            'venue_name': s['venue_name'],
                            'date': s['start_time'].split('T')[0] if 'T' in s.get('start_time', '') else s.get('start_time', ''),
                            'time': s.get('start_time', '').split('T')[1][:5] if 'T' in s.get('start_time', '') else '',
                            'required_role': s.get('required_role'),
                        }
                        for s in user_shifts
                    ]
                    send_open_shift_email_batch.delay(
                        user_id=user_id,
                        shifts_data=email_shifts_data
                    )
                except Exception as email_error:
                    logger.warning(f"Could not queue open shift email for user {user_id}: {email_error}")

            except Exception as e:
                logger.exception(f"Error sending notification to user {user_id}: {e}")
                notifications_failed += 1

        # Clear the cache entries
        cache.delete(cache_key)
        cache.delete(processing_key)

        return {
            'status': 'success',
            'batch_size': len(pending_shifts),
            'qualified_users': len(qualified_users_map),
            'notifications_sent': notifications_sent,
            'notifications_failed': notifications_failed,
        }

    except Exception as e:
        logger.exception(f"Error in send_open_shift_notifications: {e}")
        # Ensure processing lock is released
        cache.delete(processing_key)
        return {
            'status': 'error',
            'error': str(e)
        }


@shared_task(bind=True, queue='notifications')
def check_shift_reminders(self) -> Dict[str, Any]:
    """
    Periodic task to check for upcoming shifts and send reminders.
    Runs every minute via Celery beat.

    This is a backup mechanism - primary reminders are scheduled when shift is assigned.
    Uses cache-based deduplication to prevent duplicate notifications.
    """
    from .models import Shift
    from .services import push_notification_service
    from django.core.cache import cache

    now = timezone.now()
    sent_count = 0
    skipped_count = 0

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
            # DEDUPLICATION: Check if we already sent this reminder
            cache_key = f"shift_reminder_sent_{shift.id}_{reminder_type}"
            if cache.get(cache_key):
                logger.debug(f"Skipping duplicate {reminder_type} reminder for shift {shift.id} (periodic check)")
                skipped_count += 1
                continue

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
                # DEDUPLICATION: Mark this reminder as sent (expires after 24 hours)
                cache.set(cache_key, True, timeout=86400)  # 24 hours
                sent_count += 1
                logger.info(f"Sent {reminder_type} reminder for shift {shift.id} via periodic check")

    return {'status': 'success', 'reminders_sent': sent_count, 'duplicates_skipped': skipped_count}


@shared_task(bind=True, queue='notifications')
def check_missed_checkins(self) -> Dict[str, Any]:
    """
    Periodic task to check for shifts where staff hasn't checked in.
    Sends reminder 4 minutes after shift start time.
    Runs every minute via Celery beat.
    Uses cache-based deduplication to prevent duplicate notifications.
    """
    from .models import Shift
    from .services import push_notification_service
    from django.core.cache import cache

    now = timezone.now()
    skipped_count = 0

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
        # DEDUPLICATION: Check if we already sent this check-in reminder
        cache_key = f"shift_checkin_reminder_sent_{shift.id}"
        if cache.get(cache_key):
            logger.debug(f"Skipping duplicate check-in reminder for shift {shift.id} (periodic check)")
            skipped_count += 1
            continue

        minutes_late = int((now - shift.start_time).total_seconds() // 60)
        venue_name = shift.venue.name if shift.venue else 'Unknown Venue'

        success = push_notification_service.send_checkin_reminder(
            user_id=shift.staff_user.id,
            shift_id=shift.id,
            venue_name=venue_name,
            minutes_late=minutes_late
        )

        if success:
            # DEDUPLICATION: Mark this check-in reminder as sent (expires after 12 hours)
            cache.set(cache_key, True, timeout=43200)  # 12 hours
            sent_count += 1
            logger.info(f"Sent check-in reminder for shift {shift.id} via periodic check")

    return {'status': 'success', 'checkin_reminders_sent': sent_count, 'duplicates_skipped': skipped_count}


# ==========================================
# SHIFT EXCHANGE NOTIFICATION TASKS
# ==========================================

@shared_task(bind=True, queue='notifications')
def send_exchange_status_notification(self, exchange_id: int, event_type: str) -> Dict[str, Any]:
    """
    Send push notification for shift exchange status changes.

    Args:
        exchange_id: ID of the ShiftExchange instance
        event_type: Type of event ('created', 'accepted', 'approved', 'rejected', 'cancelled')

    Returns:
        Dict with notification results
    """
    from .models import ShiftExchange
    from .services import push_notification_service

    try:
        exchange = ShiftExchange.objects.select_related(
            'original_shift',
            'original_shift__venue',
            'requesting_user',
            'target_user'
        ).get(pk=exchange_id)
    except ShiftExchange.DoesNotExist:
        logger.warning(f"ShiftExchange {exchange_id} not found")
        return {'status': 'error', 'message': f'Exchange {exchange_id} not found'}

    # Get shift details for notification
    shift = exchange.original_shift
    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'
    start_time = shift.start_time.strftime('%B %d at %I:%M %p') if shift.start_time else 'Unknown time'

    # Determine recipient(s) and message based on event type
    notifications_sent = 0
    notifications_failed = 0

    if event_type == 'created':
        # Notify target user of new request
        requester_name = exchange.requesting_user.first_name or exchange.requesting_user.username
        success = push_notification_service.send_notification(
            user_id=exchange.target_user.id,
            title="🔄 Shift Transfer Request",
            body=f"{requester_name} wants to transfer a shift to you ({venue_name}, {start_time})",
            data={
                'type': 'exchange_request',
                'notification_type': 'exchange_request',
                'exchangeId': exchange.id,
                'shiftId': shift.id,
                'screen': 'ShiftExchanges',
            },
            priority='high',
            channel_id='shift-reminders'
        )
        if success:
            notifications_sent += 1
        else:
            notifications_failed += 1

    elif event_type == 'accepted':
        # Notify requesting user that target accepted
        target_name = exchange.target_user.first_name or exchange.target_user.username
        success = push_notification_service.send_notification(
            user_id=exchange.requesting_user.id,
            title="✅ Transfer Accepted",
            body=f"{target_name} accepted your shift transfer ({venue_name})",
            data={
                'type': 'exchange_accepted',
                'notification_type': 'exchange_update',
                'exchangeId': exchange.id,
                'shiftId': shift.id,
                'screen': 'ShiftExchanges',
            },
            priority='high',
            channel_id='shift-reminders'
        )
        if success:
            notifications_sent += 1
        else:
            notifications_failed += 1

    elif event_type == 'approved':
        # Notify both users of approval
        for user_id in [exchange.requesting_user.id, exchange.target_user.id]:
            success = push_notification_service.send_notification(
                user_id=user_id,
                title="🎉 Transfer Approved",
                body=f"Your shift transfer has been approved ({venue_name}, {start_time})",
                data={
                    'type': 'exchange_approved',
                    'notification_type': 'exchange_update',
                    'exchangeId': exchange.id,
                    'shiftId': shift.id,
                    'screen': 'Shifts',
                },
                priority='high',
                channel_id='shift-reminders'
            )
            if success:
                notifications_sent += 1
            else:
                notifications_failed += 1

    elif event_type == 'rejected':
        # Notify requesting user of rejection
        success = push_notification_service.send_notification(
            user_id=exchange.requesting_user.id,
            title="❌ Transfer Rejected",
            body=f"Your shift transfer request was rejected ({venue_name})",
            data={
                'type': 'exchange_rejected',
                'notification_type': 'exchange_update',
                'exchangeId': exchange.id,
                'shiftId': shift.id,
                'screen': 'ShiftExchanges',
            },
            priority='default',
            channel_id='shift-reminders'
        )
        if success:
            notifications_sent += 1
        else:
            notifications_failed += 1

    elif event_type == 'cancelled':
        # Notify target user of cancellation
        requester_name = exchange.requesting_user.first_name or exchange.requesting_user.username
        success = push_notification_service.send_notification(
            user_id=exchange.target_user.id,
            title="🚫 Transfer Cancelled",
            body=f"{requester_name} cancelled the shift transfer request ({venue_name})",
            data={
                'type': 'exchange_cancelled',
                'notification_type': 'exchange_update',
                'exchangeId': exchange.id,
                'shiftId': shift.id,
                'screen': 'ShiftExchanges',
            },
            priority='default',
            channel_id='shift-reminders'
        )
        if success:
            notifications_sent += 1
        else:
            notifications_failed += 1

    else:
        logger.warning(f"Unknown exchange event type: {event_type}")
        return {'status': 'error', 'message': f'Unknown event type: {event_type}'}

    logger.info(
        f"Exchange notification for {event_type}: "
        f"exchange={exchange_id}, sent={notifications_sent}, failed={notifications_failed}"
    )

    return {
        'status': 'success',
        'exchange_id': exchange_id,
        'event_type': event_type,
        'notifications_sent': notifications_sent,
        'notifications_failed': notifications_failed,
    }


# ==========================================
# STAFF ONBOARDING EMAIL
# ==========================================

@shared_task(bind=True, max_retries=3, queue='notifications')
def send_staff_welcome_email(
    self,
    user_id: int,
    company_name: str,
    token_uuid: str,
    admin_ip: str
) -> Dict[str, Any]:
    """
    Send welcome email to newly converted staff member with password setup link.

    This task is triggered when a recruitment application is converted to a user account.
    The email contains login credentials and a secure link to set up their password.

    Args:
        user_id: ID of the newly created user
        company_name: Name of the employing company
        token_uuid: UUID string of the PasswordResetToken for password setup
        admin_ip: IP address of admin who triggered conversion (for audit)

    Returns:
        Dict with send status and details
    """
    from django.utils.html import strip_tags

    try:
        user = User.objects.get(pk=user_id)

        # Build password setup URL using existing password reset frontend route
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        setup_url = f"{frontend_url}/reset-password/confirm/{token_uuid}"

        # Prepare email context
        context = {
            'user': user,
            'company_name': company_name,
            'setup_url': setup_url,
            'expiry_hours': 24
        }

        # Render email template
        html_message = render_to_string('staff_welcome_email.html', context)
        plain_message = strip_tags(html_message)

        # Send email from HR address
        hr_email = getattr(settings, 'HR_FROM_EMAIL', settings.DEFAULT_FROM_EMAIL)
        send_mail(
            subject=f'Welcome to {company_name} - Set Up Your Account',
            message=plain_message,
            from_email=hr_email,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False
        )

        logger.info(
            f"Staff welcome email sent: user_id={user_id}, email={user.email}, "
            f"company={company_name}, admin_ip={admin_ip}"
        )

        return {
            'status': 'sent',
            'user_id': user_id,
            'email': user.email,
            'company': company_name
        }

    except User.DoesNotExist:
        logger.error(f"Cannot send welcome email: User {user_id} not found")
        return {'status': 'failed', 'error': 'User not found'}

    except Exception as exc:
        logger.error(f"Failed to send welcome email to user {user_id}: {str(exc)}")

        # Retry with exponential backoff: 60s, 120s, 240s
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            logger.info(f"Retrying welcome email in {countdown} seconds (attempt {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(countdown=countdown, exc=exc)

        return {'status': 'failed', 'error': str(exc)}


# ==========================================
# EMAIL NOTIFICATION TASKS
# ==========================================

@shared_task(bind=True, max_retries=3, queue='notifications')
def send_shift_assignment_email_task(
    self,
    user_id: int,
    shift_id: int,
    venue_name: str,
    venue_address: Optional[str],
    start_time: str,
    end_time: str,
    formatted_date: str,
    hourly_rate: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send email notification when a shift is assigned.

    Args:
        user_id: ID of the user to notify
        shift_id: ID of the assigned shift
        venue_name: Name of the venue
        venue_address: Address of the venue
        start_time: Formatted start time
        end_time: Formatted end time
        formatted_date: Formatted date string
        hourly_rate: Pay rate per hour (optional)

    Returns:
        Dict with send status
    """
    from .services import email_notification_service

    try:
        success = email_notification_service.send_shift_assignment_email(
            user_id=user_id,
            shift_id=shift_id,
            venue_name=venue_name,
            venue_address=venue_address,
            start_time=start_time,
            end_time=end_time,
            formatted_date=formatted_date,
            hourly_rate=hourly_rate
        )

        if success:
            logger.info(f"Shift assignment email sent: user={user_id}, shift={shift_id}")
            return {'status': 'sent', 'user_id': user_id, 'shift_id': shift_id}
        else:
            logger.warning(f"Shift assignment email not sent (preferences): user={user_id}")
            return {'status': 'skipped', 'reason': 'preferences'}

    except Exception as exc:
        logger.error(f"Failed to send shift assignment email: {str(exc)}")

        # Retry with exponential backoff: 60s, 120s, 240s
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            logger.info(f"Retrying email in {countdown} seconds (attempt {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(countdown=countdown, exc=exc)

        return {'status': 'failed', 'error': str(exc)}


@shared_task(bind=True, max_retries=3, queue='notifications')
def send_shift_removal_email_task(
    self,
    user_id: int,
    shift_id: int,
    venue_name: str,
    shift_date: str,
    shift_time: str,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send email notification when a user is removed from a shift.

    Args:
        user_id: ID of the user to notify
        shift_id: ID of the shift
        venue_name: Name of the venue
        shift_date: Formatted date string
        shift_time: Formatted time string
        reason: Optional reason for removal

    Returns:
        Dict with send status
    """
    from .services import email_notification_service

    try:
        success = email_notification_service.send_shift_removal_email(
            user_id=user_id,
            shift_id=shift_id,
            venue_name=venue_name,
            shift_date=shift_date,
            shift_time=shift_time,
            reason=reason
        )

        if success:
            logger.info(f"Shift removal email sent: user={user_id}, shift={shift_id}")
            return {'status': 'sent', 'user_id': user_id, 'shift_id': shift_id}
        else:
            logger.warning(f"Shift removal email not sent (preferences): user={user_id}")
            return {'status': 'skipped', 'reason': 'preferences'}

    except Exception as exc:
        logger.error(f"Failed to send shift removal email: {str(exc)}")

        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(countdown=countdown, exc=exc)

        return {'status': 'failed', 'error': str(exc)}


@shared_task(bind=True, max_retries=3, queue='notifications')
def send_exchange_email_task(
    self,
    exchange_id: int,
    event_type: str
) -> Dict[str, Any]:
    """
    Send email notification for shift exchange events.

    Args:
        exchange_id: ID of the ShiftExchange instance
        event_type: Type of event ('created', 'accepted', 'approved')

    Returns:
        Dict with send status
    """
    from .models import ShiftExchange
    from .services import email_notification_service

    try:
        exchange = ShiftExchange.objects.select_related(
            'original_shift',
            'original_shift__venue',
            'requesting_user',
            'target_user'
        ).get(pk=exchange_id)
    except ShiftExchange.DoesNotExist:
        logger.warning(f"ShiftExchange {exchange_id} not found for email")
        return {'status': 'error', 'reason': 'exchange_not_found'}

    shift = exchange.original_shift
    venue_name = shift.venue.name if shift.venue else 'Unknown Venue'
    shift_date = shift.start_time.strftime('%B %d, %Y')
    shift_time = shift.start_time.strftime('%I:%M %p')

    try:
        notifications_sent = 0

        if event_type == 'created':
            # Notify target user of new request
            requester_name = exchange.requesting_user.get_full_name() or exchange.requesting_user.username
            success = email_notification_service.send_exchange_request_email(
                user_id=exchange.target_user.id,
                requester_name=requester_name,
                shift_venue=venue_name,
                shift_date=shift_date,
                shift_time=shift_time,
                exchange_id=exchange.id
            )
            if success:
                notifications_sent += 1

        elif event_type == 'accepted':
            # Notify requesting user that target accepted
            target_name = exchange.target_user.get_full_name() or exchange.target_user.username
            success = email_notification_service.send_exchange_accepted_email(
                user_id=exchange.requesting_user.id,
                target_name=target_name,
                shift_venue=venue_name,
                shift_date=shift_date,
                exchange_id=exchange.id
            )
            if success:
                notifications_sent += 1

        elif event_type == 'approved':
            # Notify both users of approval
            # Requesting user (giving away shift)
            success1 = email_notification_service.send_exchange_approved_email(
                user_id=exchange.requesting_user.id,
                shift_venue=venue_name,
                shift_date=shift_date,
                shift_time=shift_time,
                exchange_id=exchange.id,
                is_receiving=False,
                shift_id=shift.id
            )
            # Target user (receiving shift)
            success2 = email_notification_service.send_exchange_approved_email(
                user_id=exchange.target_user.id,
                shift_venue=venue_name,
                shift_date=shift_date,
                shift_time=shift_time,
                exchange_id=exchange.id,
                is_receiving=True,
                shift_id=shift.id
            )
            notifications_sent = (1 if success1 else 0) + (1 if success2 else 0)

        logger.info(
            f"Exchange email task completed: exchange={exchange_id}, "
            f"event={event_type}, sent={notifications_sent}"
        )
        return {
            'status': 'success',
            'exchange_id': exchange_id,
            'event_type': event_type,
            'notifications_sent': notifications_sent
        }

    except Exception as exc:
        logger.error(f"Failed to send exchange email: {str(exc)}")

        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(countdown=countdown, exc=exc)

        return {'status': 'failed', 'error': str(exc)}


@shared_task(bind=True, max_retries=3, queue='notifications')
def send_open_shift_email_batch(
    self,
    user_id: int,
    shifts_data: list
) -> Dict[str, Any]:
    """
    Send batch email notification for open shifts.

    Args:
        user_id: ID of the user to notify
        shifts_data: List of shift data dictionaries

    Returns:
        Dict with send status
    """
    from .services import email_notification_service

    try:
        batch = len(shifts_data) > 1
        success = email_notification_service.send_open_shift_notification_email(
            user_id=user_id,
            shifts=shifts_data,
            batch=batch
        )

        if success:
            logger.info(f"Open shift email sent: user={user_id}, shifts={len(shifts_data)}")
            return {'status': 'sent', 'user_id': user_id, 'shift_count': len(shifts_data)}
        else:
            return {'status': 'skipped', 'reason': 'preferences'}

    except Exception as exc:
        logger.error(f"Failed to send open shift email: {str(exc)}")

        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(countdown=countdown, exc=exc)

        return {'status': 'failed', 'error': str(exc)}


@shared_task(bind=True, max_retries=3, queue='notifications')
def send_approval_email_task(
    self,
    user_id: int,
    shift_id: int,
    approval_type: str,
    venue_name: str,
    shift_date: str,
    shift_time: str,
    venue_address: Optional[str] = None,
    hours_worked: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send email notification for shift or claim approval.

    Args:
        user_id: ID of the user to notify
        shift_id: ID of the shift
        approval_type: 'shift_approved' or 'claim_approved'
        venue_name: Name of the venue
        shift_date: Formatted date string
        shift_time: Formatted time string
        venue_address: Address of the venue (for claim approvals)
        hours_worked: Formatted hours worked (for shift approvals)

    Returns:
        Dict with send status
    """
    from .services import email_notification_service

    try:
        if approval_type == 'shift_approved':
            success = email_notification_service.send_shift_approved_email(
                user_id=user_id,
                shift_id=shift_id,
                venue_name=venue_name,
                shift_date=shift_date,
                shift_time=shift_time,
                hours_worked=hours_worked
            )
        elif approval_type == 'claim_approved':
            success = email_notification_service.send_claim_approved_email(
                user_id=user_id,
                shift_id=shift_id,
                venue_name=venue_name,
                venue_address=venue_address,
                shift_date=shift_date,
                shift_time=shift_time
            )
        else:
            logger.warning(f"Unknown approval type: {approval_type}")
            return {'status': 'error', 'reason': 'unknown_approval_type'}

        if success:
            logger.info(f"Approval email sent: user={user_id}, type={approval_type}, shift={shift_id}")
            return {'status': 'sent', 'user_id': user_id, 'approval_type': approval_type}
        else:
            return {'status': 'skipped', 'reason': 'preferences'}

    except Exception as exc:
        logger.error(f"Failed to send approval email: {str(exc)}")

        # Retry with exponential backoff
        if self.request.retries < self.max_retries:
            countdown = 60 * (2 ** self.request.retries)
            raise self.retry(countdown=countdown, exc=exc)

        return {'status': 'failed', 'error': str(exc)}


# ==========================================
# WEBSOCKET NOTIFICATION FUNCTIONS
# ==========================================

async def _send_completion_notification(job_id: str, user_id: int, completion_data: Dict[str, Any]):
    """Send report completion notification via WebSocket."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    notification = {
        'type': 'report_complete',
        'job_id': job_id,
        'timestamp': timezone.now().isoformat(),
        **completion_data
    }

    # Send to user group
    await channel_layer.group_send(f'reports_user_{user_id}', notification)
    # Send to job-specific group
    await channel_layer.group_send(f'report_job_{job_id}', notification)


async def _send_failure_notification(job_id: str, user_id: int, failure_data: Dict[str, Any]):
    """Send report failure notification via WebSocket."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    notification = {
        'type': 'report_failed',
        'job_id': job_id,
        'timestamp': timezone.now().isoformat(),
        **failure_data
    }

    # Send to user group
    await channel_layer.group_send(f'reports_user_{user_id}', notification)
    # Send to job-specific group
    await channel_layer.group_send(f'report_job_{job_id}', notification)


async def _send_cancellation_notification(job_id: str, user_id: int):
    """Send report cancellation notification via WebSocket."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    notification = {
        'type': 'report_cancelled',
        'job_id': job_id,
        'message': 'Report generation was cancelled',
        'timestamp': timezone.now().isoformat()
    }

    # Send to user group
    await channel_layer.group_send(f'reports_user_{user_id}', notification)
    # Send to job-specific group
    await channel_layer.group_send(f'report_job_{job_id}', notification)


# =============================================================================
# SIA License Auto-Expiry Task
# =============================================================================

@shared_task
def update_expired_sia_licenses():
    """Auto-expire SIA licenses past their expiry date. Run daily via Celery Beat."""
    from api.models import SIALicense

    expired = SIALicense.objects.filter(
        status='valid',
        expiry_date__lt=timezone.now().date()
    )
    count = expired.update(status='expired')
    logger.info(f"Auto-expired {count} SIA licenses")
    return count


# =============================================================================
# Attendance Exception Detection Task
# =============================================================================

@shared_task
def detect_attendance_exceptions():
    """
    Detect attendance exceptions. Run every 15 minutes via Celery Beat.

    1. No-shows: Shifts past start_time + 30min with no check-in -> mark as no_show
    2. Late check-ins: Shifts where check-in was >5 min after start -> create LatenessRecord
    3. Overdue shifts: In-progress shifts past end_time + 60min grace -> log for manager review
    """
    from api.models import Shift, LatenessRecord

    now = timezone.now()
    results = {'no_shows': 0, 'late_records': 0, 'overdue_flagged': 0}

    # 1. Auto-detect no-shows: scheduled/active shifts 30+ min past start with no check-in
    no_show_threshold = now - timedelta(minutes=30)
    no_show_shifts = Shift.objects.filter(
        status__in=['scheduled', 'active'],
        start_time__lte=no_show_threshold,
        check_in_time__isnull=True,
        staff_user__isnull=False,
    )
    for shift in no_show_shifts:
        shift.status = 'no_show'
        shift.notes = (shift.notes or '') + (
            '\n[Auto] No-show detected: no check-in 30 minutes after shift start.'
        )
        shift.save(update_fields=['status', 'notes', 'updated_at'])
        results['no_shows'] += 1

    # 2. Auto-create LatenessRecord for late check-ins (>5 min late, no existing record)
    late_threshold_minutes = 5
    late_shifts = Shift.objects.filter(
        status='in_progress',
        check_in_time__isnull=False,
        staff_user__isnull=False,
    ).exclude(
        id__in=LatenessRecord.objects.values_list('shift_id', flat=True)
    )
    for shift in late_shifts:
        if shift.check_in_time and shift.start_time:
            minutes_late = (shift.check_in_time - shift.start_time).total_seconds() / 60
            if minutes_late > late_threshold_minutes:
                LatenessRecord.objects.create(
                    shift=shift,
                    staff_user=shift.staff_user,
                    minutes_late=int(minutes_late),
                    reason='Auto-detected late check-in',
                )
                results['late_records'] += 1

    # 3. Overdue shifts: in-progress past end_time + 60min grace period
    overdue_threshold = now - timedelta(minutes=60)
    overdue_shifts = Shift.objects.filter(
        status='in_progress',
        end_time__isnull=False,
        end_time__lte=overdue_threshold,
        check_out_time__isnull=True,
    )
    for shift in overdue_shifts:
        overdue_minutes = int((now - shift.end_time).total_seconds() / 60)
        logger.warning(
            f"Overdue shift detected: Shift {shift.id} for user "
            f"{shift.staff_user_id} at venue {shift.venue_id} is "
            f"{overdue_minutes} minutes past end time."
        )
        results['overdue_flagged'] += 1

    logger.info(f"Attendance exceptions detected: {results}")
    return results


# =============================================================================
# MONTHLY LEAVE ACCRUAL TASK
# =============================================================================

@shared_task
def process_monthly_leave_accruals():
    """Process monthly leave accruals for all active employees. Runs 1st of each month."""
    from leave_management.services import LeaveAccrualService
    service = LeaveAccrualService()
    result = service.process_monthly_accruals()
    logger.info(f"Monthly leave accruals processed: {result}")


# =============================================================================
# ACCOUNT DELETION HARD-DELETE TASK
# =============================================================================

@shared_task
def hard_delete_expired_accounts():
    """
    Permanently anonymize accounts that were scheduled for deletion more than 30 days ago.
    Deletes PII (StaffProfile cascades to bank details, SIA licenses, emergency contacts, etc.)
    and anonymizes the User record to preserve business record FK references (shifts, invoices).
    Runs daily at 2 AM.
    """
    cutoff = timezone.now() - timedelta(days=30)
    users_to_delete = User.objects.filter(
        is_active=False,
        deletion_scheduled_at__isnull=False,
        deletion_scheduled_at__lte=cutoff,
    )

    deleted_count = 0
    for user in users_to_delete:
        try:
            with transaction.atomic():
                user_id = user.id
                logger.info(f"Hard-deleting account for user_id={user_id}")

                # Delete StaffProfile (cascades to emergency contacts, bank details,
                # SIA licenses, qualifications, availability, preferred venues)
                if hasattr(user, 'profile') and user.profile:
                    user.profile.delete()

                # Anonymize user record (preserve row for FK references in shifts/invoices)
                user.username = f"deleted_user_{user_id}"
                user.first_name = "Deleted"
                user.last_name = "User"
                user.email = f"deleted_{user_id}@removed.local"
                user.set_unusable_password()
                user.deletion_scheduled_at = None  # Mark as completed
                user.save()

                deleted_count += 1
        except Exception as e:
            logger.error(f"Failed to hard-delete user_id={user.id}: {e}")

    logger.info(f"Hard-delete task completed: {deleted_count} accounts anonymized")
    return result