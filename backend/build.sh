#!/usr/bin/env bash
# Build script for Render deployment
# This script is executed during the build phase

set -o errexit  # Exit on error

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Creating logs directory..."
mkdir -p logs

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Wait for Postgres before migrating.
#
# Resuming a suspended Render service fires an immediate rebuild while the
# database is still waking up. Migrating straight away used to hit
# "connection refused" and, under `set -o errexit`, abort the entire build --
# which produces no instance at all and 502s every request until someone
# redeploys by hand. That is exactly what took the API down on 2026-08-25.
#
# Render's preDeployCommand would be the tidier home for migrations, but the
# API does not apply it for this service (the CLI accepts the flag and
# silently drops it), and leaving migrations out of the build entirely means
# they never run. So they live here, behind a readiness wait: a sleeping
# database is retried, while a genuine migration failure still fails the build.
echo "Waiting for the database to accept connections..."
python - <<'PY'
import os
import sys
import time

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from django.db.utils import OperationalError

DEADLINE = time.time() + 180
ATTEMPT = 0

while True:
    ATTEMPT += 1
    try:
        connection.ensure_connection()
        break
    except OperationalError as exc:
        connection.close()
        if time.time() >= DEADLINE:
            sys.exit(f"Database unreachable after 180s ({ATTEMPT} attempts): {exc}")
        print(f"  attempt {ATTEMPT}: database not ready, retrying in 5s...", flush=True)
        time.sleep(5)

print(f"Database ready after {ATTEMPT} attempt(s).", flush=True)
PY

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Build completed successfully!"
