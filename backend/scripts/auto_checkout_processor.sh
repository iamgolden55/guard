#!/bin/bash

# Auto-checkout processor script
# This script runs the Django management command to process automatic checkouts
# It should be scheduled to run every 15-30 minutes via cron

# Set script directory and Django project path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/auto_checkout.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log_with_timestamp() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Start processing
log_with_timestamp "Starting auto-checkout processing"

# Change to project directory
cd "$PROJECT_DIR"

# Activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    log_with_timestamp "Activated virtual environment"
elif [ -f "../venv/bin/activate" ]; then
    source ../venv/bin/activate
    log_with_timestamp "Activated virtual environment from parent directory"
fi

# Run the Django management command
python manage.py process_auto_checkouts >> "$LOG_FILE" 2>&1

# Check exit status
if [ $? -eq 0 ]; then
    log_with_timestamp "Auto-checkout processing completed successfully"
else
    log_with_timestamp "ERROR: Auto-checkout processing failed"
fi

log_with_timestamp "Auto-checkout processing finished"