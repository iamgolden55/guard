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

# NOTE: migrations deliberately do NOT run here. They run as the
# preDeployCommand in render.yaml. Running them in the build means any
# database problem fails the build outright, which leaves the service with no
# running instance at all and returns 502 for every request.

echo "Build completed successfully!"
