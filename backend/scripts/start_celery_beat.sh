#!/bin/bash
# Start Celery beat scheduler for Security Staff Management System

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Export Django settings module
export DJANGO_SETTINGS_MODULE=core.settings

# Start Celery beat scheduler
celery -A core beat \
  --loglevel=info \
  --scheduler=django_celery_beat.schedulers:DatabaseScheduler

# Note: This will use the database to store periodic task schedules
# Make sure to run migrations first: python manage.py migrate