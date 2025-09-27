# Celery Async Processing Implementation - Phase 2

## Overview

This document outlines the complete Celery infrastructure implementation for the Security Staff Management System's Export & Reporting Architecture Phase 2. The system provides robust asynchronous report generation with progress tracking, error handling, and automatic retries.

## Architecture Components

### 1. Celery Application (`core/celery_app.py`)

**Features:**
- Auto-discovery of tasks from all Django apps
- Queue-based task routing (reports, cleanup, notifications)
- Comprehensive signal handlers for logging
- Security-focused configuration with JSON serialization
- Automatic periodic task scheduling

**Key Configurations:**
- Task time limits: 30 minutes hard, 25 minutes soft
- Automatic retries: 3 attempts with exponential backoff
- Worker settings: Prefetch multiplier 1, max 1000 tasks per child
- Result expiration: 1 hour

### 2. Django Integration (`core/__init__.py` & `settings.py`)

**Settings Enhancements:**
- Redis broker and result backend configuration
- Database fallback for result backend
- Optional Redis cache with local memory fallback
- Email configuration for notifications
- Report-specific settings (retention, batch size, concurrent jobs)

**New INSTALLED_APPS:**
- `django_celery_beat`: Database-driven periodic task scheduling
- `django_celery_results`: Database storage for task results

### 3. Comprehensive Task Suite (`api/tasks.py`)

#### Core Tasks

**`generate_report_async`**
- Async report generation with progress tracking
- Comprehensive error handling and retries
- Integration with existing ReportGenerator and export handlers
- Automatic file storage and cleanup
- Email notifications on completion/failure

**`cancel_report_job`**
- Safe cancellation of pending/processing jobs
- Cleanup of temporary files
- Database status updates

**`send_report_notification`**
- Email notifications for report status changes
- Templated HTML emails
- User preference checking

#### Maintenance Tasks

**`cleanup_old_report_files`**
- Automatic cleanup based on retention policy
- File storage management
- Comprehensive logging and statistics

**`cleanup_expired_report_jobs`**
- Database cleanup of old job records
- Configurable retention periods

**`system_maintenance`**
- Periodic cleanup of temporary files
- Extensible framework for additional maintenance tasks

#### Monitoring Tasks

**`health_check`**
- Worker health monitoring
- Status reporting for monitoring systems

## Queue Architecture

### Queue Types
- **`celery`**: Default queue for general tasks
- **`reports`**: Dedicated queue for report generation
- **`cleanup`**: Maintenance and cleanup tasks
- **`notifications`**: Email and notification tasks

### Benefits
- Prioritization of different task types
- Horizontal scaling by queue type
- Resource isolation for compute-heavy reports

## Progress Tracking System

### TaskProgressTracker Utility
- Real-time progress updates during task execution
- Percentage-based progress reporting
- Custom status messages
- Integration with Celery's state update mechanism

### Progress States
- **PENDING**: Task queued but not started
- **PROGRESS**: Task running with percentage completion
- **SUCCESS**: Task completed successfully
- **FAILURE**: Task failed with error details
- **RETRY**: Task being retried after failure

## Error Handling & Resilience

### Multi-Level Error Handling
1. **Task Level**: Try-catch blocks with detailed logging
2. **Database Level**: Atomic transactions for consistency
3. **Retry Level**: Exponential backoff for transient failures
4. **Notification Level**: User alerts for failures

### Retry Strategy
- Maximum 3 retry attempts
- Exponential backoff: 60s, 120s, 240s
- Automatic failure notifications after max retries

## File Management

### Storage Strategy
- Organized file structure in `MEDIA_ROOT/reports/`
- Temporary file handling in `reports/temp/`
- Automatic cleanup based on retention policy
- File size tracking and optimization

### Security Features
- Secure file paths with UUID prefixes
- Access control through user permissions
- Automatic cleanup of abandoned files

## Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements_celery.txt
```

### 2. Configure Environment
```bash
cp .env.celery.example .env
# Edit .env with your configuration
```

### 3. Run Migrations
```bash
python manage.py migrate
```

### 4. Start Services
```bash
# Terminal 1: Start Redis
redis-server

# Terminal 2: Start Celery Worker
./scripts/start_celery_worker.sh

# Terminal 3: Start Celery Beat (optional)
./scripts/start_celery_beat.sh
```

### 5. Verify Installation
```bash
python test_celery_setup.py
```

## Production Deployment

### Required Services
- **Redis**: Message broker and result backend
- **PostgreSQL**: Database for Django and result storage
- **Celery Workers**: Background task execution
- **Celery Beat**: Periodic task scheduling

### Monitoring
- Use Flower for task monitoring: `pip install flower && celery -A core flower`
- Health check endpoint: `/api/v1/health/celery/`
- Task metrics in Django admin via django-celery-results

### Scaling
- Horizontal scaling by adding more worker processes
- Queue-specific scaling for different workloads
- Redis clustering for high availability

## Integration with Existing System

### ReportJob Model Integration
The system seamlessly integrates with the existing `ReportJob` model:
- Status tracking: `pending` → `processing` → `completed`/`failed`
- Progress updates stored in task result backend
- File path and size tracking
- Error message storage for debugging

### API Endpoints
Tasks integrate with existing API endpoints:
- `POST /api/v1/reports/generate/` - Trigger async generation
- `GET /api/v1/reports/jobs/{id}/status/` - Check progress
- `DELETE /api/v1/reports/jobs/{id}/` - Cancel job

### Performance Benefits
- Non-blocking report generation
- Concurrent processing of multiple reports
- Efficient resource utilization
- Improved user experience with progress tracking

## Configuration Options

### Environment Variables
```bash
# Core Celery Settings
REDIS_URL=redis://localhost:6379/0
CELERY_USE_DB_BACKEND=False

# Report Settings
REPORT_FILE_RETENTION_DAYS=7
REPORT_MAX_CONCURRENT_JOBS=3
REPORT_BATCH_SIZE=1000

# Email Settings
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
DEFAULT_FROM_EMAIL=noreply@security-management.com
```

### Runtime Configuration
- Task routing can be modified in `celery_app.py`
- Queue priorities configurable per deployment
- Worker concurrency adjustable based on hardware

## Testing

### Automated Tests
- Full test suite in `test_celery_setup.py`
- Import validation for all components
- Configuration verification
- Health check validation

### Manual Testing
```bash
# Test health check
python manage.py shell -c "from api.tasks import health_check; print(health_check())"

# Test async task
python manage.py shell -c "from api.tasks import generate_report_async; generate_report_async.delay('test-job-id', 1)"
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure all dependencies installed via requirements_celery.txt
2. **Redis Connection**: Check Redis server running on correct port
3. **Task Discovery**: Verify apps listed in INSTALLED_APPS
4. **File Permissions**: Ensure write access to MEDIA_ROOT/reports/

### Debug Mode
Set `CELERY_TASK_ALWAYS_EAGER=True` in development for synchronous execution.

### Logging
All task execution logged with detailed context:
- Task start/completion times
- Progress updates
- Error details with stack traces
- Performance metrics

## Security Considerations

### Data Protection
- JSON serialization prevents code injection
- User permission validation in all tasks
- Secure file path generation
- Automatic cleanup of sensitive files

### Access Control
- Tasks validate user permissions before execution
- File access restricted by user roles
- Email notifications only to authorized users

## Future Enhancements

### Planned Features
- Task priority queues for urgent reports
- Distributed file storage integration
- Advanced retry strategies
- Real-time WebSocket progress updates
- Scheduled report templates

### Monitoring Improvements
- Prometheus metrics integration
- Custom dashboard for task analytics
- Performance trend analysis
- Resource usage optimization

---

This implementation provides a robust, scalable foundation for asynchronous report processing that integrates seamlessly with the existing Django application while providing comprehensive monitoring, error handling, and user experience enhancements.