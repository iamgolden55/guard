#!/bin/bash

# Start Django Channels WebSocket Server
# This script starts the ASGI server for Django Channels WebSocket support

set -e

echo "Starting Django Channels WebSocket Server..."

# Check if Redis is running
if ! command -v redis-cli &> /dev/null; then
    echo "Warning: Redis CLI not found. Make sure Redis is running for WebSocket support."
else
    if ! redis-cli ping &> /dev/null; then
        echo "Warning: Redis server not responding. WebSocket functionality may not work properly."
    else
        echo "✓ Redis server is running"
    fi
fi

# Set environment variables
export DJANGO_SETTINGS_MODULE=core.settings

# Check if virtual environment is activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "Warning: No virtual environment detected. Make sure dependencies are installed."
fi

# Check if Channels is installed
if ! python -c "import channels" &> /dev/null; then
    echo "Error: Django Channels not installed. Run: pip install -r requirements.txt"
    exit 1
fi

echo "✓ Django Channels is available"

# Run database migrations to ensure WebSocket models are up to date
echo "Running database migrations..."
python manage.py migrate --noinput

# Start the ASGI server
echo "Starting ASGI server on port 8000..."
echo "WebSocket endpoints will be available at:"
echo "  - ws://localhost:8000/ws/reports/"
echo "  - ws://localhost:8000/ws/notifications/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Use daphne as the ASGI server (comes with channels)
exec daphne -b 0.0.0.0 -p 8000 core.asgi:application

# Alternative: Use uvicorn (install with: pip install uvicorn[standard])
# exec uvicorn core.asgi:application --host 0.0.0.0 --port 8000 --reload