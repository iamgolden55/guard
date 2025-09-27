"""
Optimized Celery Tasks with Full Performance Pipeline
====================================================

This module provides the main Celery tasks that integrate all optimization
features including the optimized report generator, advanced task management,
monitoring, and production-ready features.
"""

import os
import time
import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from celery import shared_task, current_task
from celery.exceptions import Retry, SoftTimeLimitExceeded, WorkerLostError
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.db import transaction

from .models import ReportJob, ReportTemplate, User
from .utils.optimized_report_generator import OptimizedReportGenerator
from .utils.advanced_task_manager import AdvancedTaskManager, TaskPriority, TaskMetadata
from .utils.monitoring_observability import monitoring_system
from .utils.production_ready_tasks import production_task_system
from .utils.enhanced_export_handlers import get_streaming_export_handler

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, soft_time_limit=1800, time_limit=2100)
def generate_report_optimized(self, report_job_id: str, user_id: int) -> Dict[str, Any]:
    """
    Generate a report using the fully optimized pipeline.

    This task integrates:
    - Optimized report generator with streaming and caching
    - Advanced task management with prioritization
    - Comprehensive monitoring and metrics collection
    - Production-ready error handling and recovery
    """
    task_id = self.request.id
    start_time = time.time()

    logger.info(f'Starting optimized report generation task {task_id} for job {report_job_id}')

    try:
        # Register task with production system
        production_task_system.shutdown_manager.register_task(task_id)

        # Update task progress
        current_task.update_state(
            state='PROGRESS',
            meta={'current': 5, 'total': 100, 'message': 'Loading report job', 'stage': 'initialization'}
        )

        # Get the report job with optimized query
        with transaction.atomic():
            report_job = ReportJob.objects.select_related('template', 'requested_by').get(
                job_id=report_job_id
            )

            # Validate user permissions
            if report_job.requested_by_id != user_id:
                raise ValueError("User not authorized for this report job")

            # Update job status to processing
            report_job.status = 'processing'
            report_job.started_at = timezone.now()
            report_job.save(update_fields=['status', 'started_at'])

        # Update progress
        current_task.update_state(
            state='PROGRESS',
            meta={'current': 10, 'total': 100, 'message': 'Initializing optimized generator', 'stage': 'setup'}
        )

        # Initialize optimized report generator
        generator = OptimizedReportGenerator(
            template=report_job.template,
            export_format=report_job.export_format,
            date_range_start=report_job.date_range_start,
            date_range_end=report_job.date_range_end,
            filters=report_job.filters,
            user=report_job.requested_by,
            job_id=report_job_id
        )

        # Update progress
        current_task.update_state(
            state='PROGRESS',
            meta={'current': 15, 'total': 100, 'message': 'Starting report generation', 'stage': 'generation'}
        )

        # Generate the report with full optimization
        result = generator.generate()

        # Update progress
        current_task.update_state(
            state='PROGRESS',
            meta={'current': 90, 'total': 100, 'message': 'Finalizing report', 'stage': 'finalization'}
        )

        # Update job with results
        with transaction.atomic():
            report_job.refresh_from_db()
            report_job.status = 'completed'
            report_job.completed_at = timezone.now()

            if 'file_path' in result:
                report_job.file_path = result['file_path']

                # Get file size
                if os.path.exists(result['file_path']):
                    report_job.file_size = os.path.getsize(result['file_path'])

            report_job.save(update_fields=['status', 'completed_at', 'file_path', 'file_size'])

        # Calculate total duration
        total_duration = (time.time() - start_time) * 1000

        # Record performance metrics
        monitoring_system.record_operation_performance(
            operation='report_generation',
            duration_ms=total_duration,
            rows_processed=result.get('row_count', 0),
            memory_used_mb=generator.metrics.memory_peak,
            success=True
        )

        # Send completion notification if configured
        if hasattr(settings, 'NOTIFY_REPORT_COMPLETION') and settings.NOTIFY_REPORT_COMPLETION:
            _send_completion_notification(report_job, True)

        # Complete task in production system
        production_task_system.complete_task(task_id, True)

        # Update final progress
        current_task.update_state(
            state='SUCCESS',
            meta={
                'current': 100,
                'total': 100,
                'message': 'Report generation completed',
                'stage': 'completed',
                'result': result,
                'performance_metrics': {
                    'total_duration_ms': total_duration,
                    'rows_processed': result.get('row_count', 0),
                    'memory_peak_mb': generator.metrics.memory_peak,
                    'cache_hits': generator.metrics.cache_hits,
                    'cache_misses': generator.metrics.cache_misses
                }
            }
        )

        logger.info(f'Report generation completed successfully: task={task_id}, duration={total_duration:.2f}ms')
        return result

    except SoftTimeLimitExceeded:
        # Handle soft timeout
        error_msg = "Report generation timed out (soft limit exceeded)"
        logger.error(f'Task {task_id} soft timeout: {error_msg}')

        # Record timeout metrics
        monitoring_system.record_operation_performance(
            operation='report_generation',
            duration_ms=(time.time() - start_time) * 1000,
            success=False,
            error_message=error_msg
        )

        _handle_task_error(report_job_id, error_msg, task_id)
        raise

    except WorkerLostError:
        # Handle worker shutdown
        error_msg = "Worker shutdown during report generation"
        logger.error(f'Task {task_id} worker lost: {error_msg}')

        # Save task state for recovery
        production_task_system.recovery_manager.save_task_state(task_id, {
            'report_job_id': report_job_id,
            'user_id': user_id,
            'stage': 'interrupted'
        })

        _handle_task_error(report_job_id, error_msg, task_id)
        raise

    except Exception as exc:
        # Handle all other errors with intelligent retry
        error_msg = str(exc)
        logger.error(f'Task {task_id} failed: {error_msg}\n{traceback.format_exc()}')

        # Record error metrics
        monitoring_system.record_operation_performance(
            operation='report_generation',
            duration_ms=(time.time() - start_time) * 1000,
            success=False,
            error_message=error_msg
        )

        # Determine if should retry using advanced task manager
        task_manager = AdvancedTaskManager()
        task_metadata = TaskMetadata(
            task_id=task_id,
            priority=TaskPriority.NORMAL,
            created_at=timezone.now(),
            retry_count=self.request.retries,
            user_id=user_id
        )

        should_retry = task_manager.handle_task_error(task_metadata, exc)

        if should_retry and self.request.retries < self.max_retries:
            # Calculate retry delay
            retry_delay = task_manager.retry_strategy_manager.get_retry_delay(
                task_manager.retry_strategy_manager.classify_error(exc),
                self.request.retries
            )

            logger.info(f'Retrying task {task_id} in {retry_delay} seconds (attempt {self.request.retries + 1})')

            # Update job status for retry
            with transaction.atomic():
                try:
                    report_job = ReportJob.objects.get(job_id=report_job_id)
                    report_job.error_message = f"Retrying: {error_msg}"
                    report_job.retry_count = self.request.retries + 1
                    report_job.save(update_fields=['error_message', 'retry_count'])
                except ReportJob.DoesNotExist:
                    pass

            # Retry with delay
            raise self.retry(countdown=retry_delay, exc=exc)
        else:
            # No more retries, mark as failed
            _handle_task_error(report_job_id, error_msg, task_id)
            production_task_system.complete_task(task_id, False)
            raise

    finally:
        # Always unregister task
        try:
            production_task_system.shutdown_manager.unregister_task(task_id)
        except:
            pass


@shared_task(bind=True, max_retries=2)
def generate_batch_reports(self, batch_job_ids: list, user_id: int) -> Dict[str, Any]:
    """
    Generate multiple reports in a batch for efficiency.

    This task processes multiple reports together to optimize resource usage
    and reduce overhead from repeated initialization.
    """
    task_id = self.request.id
    start_time = time.time()

    logger.info(f'Starting batch report generation task {task_id} for {len(batch_job_ids)} jobs')

    results = {
        'batch_id': task_id,
        'total_jobs': len(batch_job_ids),
        'completed_jobs': 0,
        'failed_jobs': 0,
        'results': {}
    }

    try:
        production_task_system.shutdown_manager.register_task(task_id)

        for i, job_id in enumerate(batch_job_ids):
            # Check for shutdown signal
            if production_task_system.shutdown_manager.check_shutdown_signal():
                logger.warning(f"Batch task {task_id} interrupted by shutdown")
                break

            # Update progress
            progress = int((i / len(batch_job_ids)) * 100)
            current_task.update_state(
                state='PROGRESS',
                meta={
                    'current': progress,
                    'total': 100,
                    'message': f'Processing job {i+1}/{len(batch_job_ids)}',
                    'batch_progress': {
                        'completed': results['completed_jobs'],
                        'failed': results['failed_jobs'],
                        'current_job': job_id
                    }
                }
            )

            try:
                # Process individual job
                job_result = generate_report_optimized.delay(job_id, user_id).get(timeout=1800)
                results['results'][job_id] = {
                    'status': 'success',
                    'result': job_result
                }
                results['completed_jobs'] += 1

            except Exception as e:
                logger.error(f"Batch job {job_id} failed: {str(e)}")
                results['results'][job_id] = {
                    'status': 'failed',
                    'error': str(e)
                }
                results['failed_jobs'] += 1

        # Record batch metrics
        total_duration = (time.time() - start_time) * 1000
        monitoring_system.record_operation_performance(
            operation='batch_report_generation',
            duration_ms=total_duration,
            rows_processed=results['completed_jobs'],
            success=results['failed_jobs'] == 0
        )

        logger.info(f'Batch report generation completed: {results["completed_jobs"]} success, {results["failed_jobs"]} failed')
        return results

    except Exception as e:
        logger.error(f'Batch report generation failed: {str(e)}')
        results['error'] = str(e)

        # Record error
        monitoring_system.record_operation_performance(
            operation='batch_report_generation',
            duration_ms=(time.time() - start_time) * 1000,
            success=False,
            error_message=str(e)
        )

        raise
    finally:
        production_task_system.shutdown_manager.unregister_task(task_id)


@shared_task(bind=True)
def cleanup_expired_reports(self) -> Dict[str, Any]:
    """
    Clean up expired report files and job records.

    This maintenance task runs periodically to:
    - Remove expired report files from storage
    - Clean up old job records
    - Optimize database performance
    """
    task_id = self.request.id
    start_time = time.time()

    logger.info(f'Starting report cleanup task {task_id}')

    cleanup_stats = {
        'expired_files_deleted': 0,
        'expired_jobs_deleted': 0,
        'storage_freed_mb': 0,
        'errors': []
    }

    try:
        # Find expired report jobs
        cutoff_time = timezone.now()
        expired_jobs = ReportJob.objects.filter(
            expires_at__lt=cutoff_time,
            status__in=['completed', 'failed']
        )

        total_expired = expired_jobs.count()
        processed = 0

        for job in expired_jobs:
            try:
                # Delete associated file if exists
                if job.file_path and os.path.exists(job.file_path):
                    file_size_mb = os.path.getsize(job.file_path) / (1024 * 1024)
                    os.unlink(job.file_path)
                    cleanup_stats['expired_files_deleted'] += 1
                    cleanup_stats['storage_freed_mb'] += file_size_mb

                # Delete job record
                job.delete()
                cleanup_stats['expired_jobs_deleted'] += 1

                processed += 1

                # Update progress occasionally
                if processed % 100 == 0:
                    progress = int((processed / total_expired) * 100)
                    current_task.update_state(
                        state='PROGRESS',
                        meta={
                            'current': progress,
                            'total': 100,
                            'message': f'Cleaned up {processed}/{total_expired} expired reports'
                        }
                    )

            except Exception as e:
                error_msg = f"Failed to cleanup job {job.id}: {str(e)}"
                logger.error(error_msg)
                cleanup_stats['errors'].append(error_msg)

        # Record cleanup metrics
        total_duration = (time.time() - start_time) * 1000
        monitoring_system.record_operation_performance(
            operation='report_cleanup',
            duration_ms=total_duration,
            rows_processed=cleanup_stats['expired_jobs_deleted'],
            success=len(cleanup_stats['errors']) == 0
        )

        logger.info(f'Report cleanup completed: {cleanup_stats}')
        return cleanup_stats

    except Exception as e:
        logger.error(f'Report cleanup task failed: {str(e)}')
        cleanup_stats['errors'].append(str(e))

        # Record error
        monitoring_system.record_operation_performance(
            operation='report_cleanup',
            duration_ms=(time.time() - start_time) * 1000,
            success=False,
            error_message=str(e)
        )

        raise


@shared_task(bind=True)
def system_health_check(self) -> Dict[str, Any]:
    """
    Perform comprehensive system health check.

    This task runs periodically to:
    - Check all system components
    - Generate health reports
    - Trigger alerts if issues are detected
    """
    task_id = self.request.id
    start_time = time.time()

    logger.info(f'Starting system health check task {task_id}')

    try:
        # Run comprehensive health checks
        health_status = monitoring_system.run_health_checks()

        # Check for alert conditions
        monitoring_system.check_alerts()

        # Record health check metrics
        total_duration = (time.time() - start_time) * 1000
        monitoring_system.record_operation_performance(
            operation='system_health_check',
            duration_ms=total_duration,
            success=health_status['healthy']
        )

        logger.info(f'System health check completed: {"HEALTHY" if health_status["healthy"] else "UNHEALTHY"}')
        return health_status

    except Exception as e:
        logger.error(f'System health check failed: {str(e)}')

        # Record error
        monitoring_system.record_operation_performance(
            operation='system_health_check',
            duration_ms=(time.time() - start_time) * 1000,
            success=False,
            error_message=str(e)
        )

        raise


def _handle_task_error(report_job_id: str, error_message: str, task_id: str):
    """Handle task error by updating job status and sending notifications"""
    try:
        with transaction.atomic():
            report_job = ReportJob.objects.get(job_id=report_job_id)
            report_job.mark_as_failed(error_message)

            # Send error notification if configured
            if hasattr(settings, 'NOTIFY_REPORT_ERRORS') and settings.NOTIFY_REPORT_ERRORS:
                _send_completion_notification(report_job, False, error_message)

    except ReportJob.DoesNotExist:
        logger.error(f"Could not find ReportJob with ID {report_job_id} to mark as failed")
    except Exception as e:
        logger.error(f"Error handling task error: {str(e)}")


def _send_completion_notification(report_job: ReportJob, success: bool, error_message: str = None):
    """Send email notification about report completion"""
    try:
        if not report_job.requested_by.email:
            return

        subject = f"Report {'Completed' if success else 'Failed'}: {report_job.template.name}"

        if success:
            message = f"""
Your report "{report_job.template.name}" has been generated successfully.

Report Details:
- Format: {report_job.export_format.upper()}
- Generated: {report_job.completed_at.strftime('%Y-%m-%d %H:%M:%S') if report_job.completed_at else 'N/A'}
- File Size: {report_job.file_size_mb} MB
- Download Count: {report_job.download_count}

You can download your report from the Reports dashboard.

This is an automated notification from the Security Staff Management System.
            """
        else:
            message = f"""
Your report "{report_job.template.name}" could not be generated.

Error Details:
- Job ID: {report_job.job_id}
- Error: {error_message or report_job.error_message}
- Retry Count: {report_job.retry_count}

Please try generating the report again or contact support if the issue persists.

This is an automated notification from the Security Staff Management System.
            """

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[report_job.requested_by.email],
            fail_silently=True  # Don't fail the task if email fails
        )

        logger.info(f"Notification email sent to {report_job.requested_by.email}")

    except Exception as e:
        logger.error(f"Failed to send notification email: {str(e)}")


# Periodic tasks (would be configured in Celery beat schedule)
@shared_task(name='periodic_cleanup')
def periodic_cleanup():
    """Periodic cleanup task"""
    return cleanup_expired_reports.delay().get()


@shared_task(name='periodic_health_check')
def periodic_health_check():
    """Periodic health check task"""
    return system_health_check.delay().get()


@shared_task(name='periodic_queue_optimization')
def periodic_queue_optimization():
    """Periodic queue optimization"""
    try:
        production_task_system.queue_optimizer.optimize_queues()
        return {"status": "success", "message": "Queue optimization completed"}
    except Exception as e:
        logger.error(f"Periodic queue optimization failed: {str(e)}")
        return {"status": "error", "message": str(e)}