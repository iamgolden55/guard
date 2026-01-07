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

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Build completed successfully!"
