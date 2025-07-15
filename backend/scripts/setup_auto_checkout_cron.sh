#!/bin/bash

# Script to set up cron job for auto-checkout processing
# Run this script to automatically configure the cron job

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AUTO_CHECKOUT_SCRIPT="$SCRIPT_DIR/auto_checkout_processor.sh"

echo "Setting up auto-checkout cron job..."

# Check if script exists
if [ ! -f "$AUTO_CHECKOUT_SCRIPT" ]; then
    echo "ERROR: Auto-checkout script not found at $AUTO_CHECKOUT_SCRIPT"
    exit 1
fi

# Make sure the script is executable
chmod +x "$AUTO_CHECKOUT_SCRIPT"

# Backup existing crontab
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# Add new cron job (runs every 15 minutes)
CRON_JOB="*/15 * * * * $AUTO_CHECKOUT_SCRIPT"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto_checkout_processor.sh"; then
    echo "Auto-checkout cron job already exists. Updating..."
    # Remove old job and add new one
    (crontab -l 2>/dev/null | grep -v "auto_checkout_processor.sh"; echo "$CRON_JOB") | crontab -
else
    echo "Adding new auto-checkout cron job..."
    # Add new job to existing crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
fi

echo "Auto-checkout cron job set up successfully!"
echo "The job will run every 15 minutes: $CRON_JOB"
echo ""
echo "To verify the cron job was added, run: crontab -l"
echo "To remove the cron job, run: crontab -e and delete the line"
echo ""
echo "Logs will be stored in: $PROJECT_DIR/logs/auto_checkout.log"