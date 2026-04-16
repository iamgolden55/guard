"""
Celery configuration for the Security Staff Management System.

This module sets up the Celery application for handling asynchronous tasks,
particularly for report generation and export processing.
"""

import os
from celery import Celery
from django.conf import settings
from kombu import Queue

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# Create the Celery application
app = Celery('security_management')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Configure Celery settings
app.conf.update(
    # Task routing
    task_routes={
        'api.tasks.generate_report_async': {'queue': 'reports'},
        'api.tasks.cleanup_old_report_files': {'queue': 'cleanup'},
        'api.tasks.send_report_notification': {'queue': 'notifications'},
    },

    # Queue definitions
    task_queues=(
        Queue('celery', routing_key='celery'),
        Queue('reports', routing_key='reports'),
        Queue('cleanup', routing_key='cleanup'),
        Queue('notifications', routing_key='notifications'),
    ),

    # Worker settings
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,

    # Task result settings
    result_expires=3600,  # 1 hour
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes

    # Retry settings
    task_default_retry_delay=60,  # seconds
    task_max_retries=3,

    # Security settings
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],

    # Timezone
    timezone=settings.TIME_ZONE,
    enable_utc=True,

    # Beat schedule for periodic tasks
    beat_schedule={
        'cleanup-old-reports': {
            'task': 'api.tasks.cleanup_old_report_files',
            'schedule': 24.0 * 60 * 60,  # Run daily
            'options': {'queue': 'cleanup'}
        },
        'cleanup-expired-report-jobs': {
            'task': 'api.tasks.cleanup_expired_report_jobs',
            'schedule': 6.0 * 60 * 60,  # Run every 6 hours
            'options': {'queue': 'cleanup'}
        },
        'process-auto-checkouts': {
            'task': 'api.tasks.process_auto_checkouts',
            'schedule': 15.0 * 60,  # Run every 15 minutes
        },
        # NOTE: Periodic shift notification tasks disabled to prevent duplicates.
        # Primary scheduled tasks (schedule_shift_reminders) handle all reminders.
        # These backup tasks were causing duplicate notifications with -1 minute offset.
        # See: thoughts/shared/research/2025-01-25-duplicate-shift-notifications.md
        # 'check-shift-reminders': {
        #     'task': 'api.tasks.check_shift_reminders',
        #     'schedule': 60.0,  # Every minute
        #     'options': {'queue': 'notifications'}
        # },
        # 'check-missed-checkins': {
        #     'task': 'api.tasks.check_missed_checkins',
        #     'schedule': 60.0,  # Every minute
        #     'options': {'queue': 'notifications'}
        # },
    },
)


@app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery configuration."""
    print(f'Request: {self.request!r}')
    return 'Debug task completed successfully'


# Celery signal handlers for enhanced logging
from celery.signals import (
    task_prerun, task_postrun, task_failure, task_retry,
    worker_ready, worker_shutdown
)
import logging

logger = logging.getLogger(__name__)


@task_prerun.connect
def task_prerun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None, **kwds):
    """Log task start."""
    logger.info(f'Task {task.name} [{task_id}] starting with args={args}, kwargs={kwargs}')


@task_postrun.connect
def task_postrun_handler(sender=None, task_id=None, task=None, args=None, kwargs=None,
                        retval=None, state=None, **kwds):
    """Log task completion."""
    logger.info(f'Task {task.name} [{task_id}] completed with state={state}')


@task_failure.connect
def task_failure_handler(sender=None, task_id=None, exception=None, traceback=None,
                        einfo=None, **kwds):
    """Log task failures."""
    logger.error(f'Task {sender.name} [{task_id}] failed: {exception}',
                extra={'traceback': traceback})


@task_retry.connect
def task_retry_handler(sender=None, task_id=None, reason=None, einfo=None, **kwds):
    """Log task retries."""
    logger.warning(f'Task {sender.name} [{task_id}] retrying: {reason}')


@worker_ready.connect
def worker_ready_handler(sender=None, **kwargs):
    """Log when worker is ready."""
    logger.info(f'Celery worker {sender.hostname} is ready')


@worker_shutdown.connect
def worker_shutdown_handler(sender=None, **kwargs):
    """Log when worker shuts down."""
    logger.info(f'Celery worker {sender.hostname} shutting down')


# Additional configuration for development/production environments
if settings.DEBUG:
    # Development settings
    app.conf.task_always_eager = False
    app.conf.task_eager_propagates = True
    app.conf.task_store_eager_result = True