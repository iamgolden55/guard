#!/bin/bash
# Start Celery worker for Security Staff Management System

# Navigate to backend directory
cd "$(dirname "$0")/.."

# Export Django settings module
export DJANGO_SETTINGS_MODULE=core.settings

# Start Celery worker with proper configuration
celery -A core worker \
  --loglevel=info \
  --concurrency=4 \
  --queues=celery,reports,cleanup,notifications \
  --prefetch-multiplier=1 \
  --max-tasks-per-child=1000 \
  --without-gossip \
  --without-mingle \
  --without-heartbeat

# Alternative configuration for development (single worker)
# celery -A core worker --loglevel=debug --concurrency=1