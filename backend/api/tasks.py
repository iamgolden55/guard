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