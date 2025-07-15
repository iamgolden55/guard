# Auto-Checkout System Setup

This directory contains scripts and configuration files for setting up the automated shift checkout system.

## Overview

The auto-checkout system automatically checks out staff members who:
1. Have completed all venue-required safety checks AND passed the grace period (default: 30 minutes after scheduled end time)
2. OR have exceeded the force timeout threshold (default: 12 hours past scheduled end time) - this bypasses venue checks for excessive overtime

## Files

- `auto_checkout_processor.sh` - Main script that runs the Django management command
- `setup_auto_checkout_cron.sh` - Automated setup script for cron jobs
- `mead-security-auto-checkout.service` - Systemd service file
- `mead-security-auto-checkout.timer` - Systemd timer file
- `README.md` - This documentation

## Setup Options

### Option 1: Cron Job (Recommended for most systems)

1. Run the automatic setup script:
   ```bash
   cd /path/to/your/project/backend/scripts
   ./setup_auto_checkout_cron.sh
   ```

2. Verify the cron job was added:
   ```bash
   crontab -l
   ```

3. The job will run every 15 minutes and process eligible shifts

### Option 2: Systemd (For Linux servers)

1. Copy the service files to systemd directory:
   ```bash
   sudo cp mead-security-auto-checkout.service /etc/systemd/system/
   sudo cp mead-security-auto-checkout.timer /etc/systemd/system/
   ```

2. Update the paths in the service file:
   ```bash
   sudo nano /etc/systemd/system/mead-security-auto-checkout.service
   # Update WorkingDirectory and ExecStart paths
   # Update User and Group as needed
   ```

3. Enable and start the timer:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable mead-security-auto-checkout.timer
   sudo systemctl start mead-security-auto-checkout.timer
   ```

4. Check timer status:
   ```bash
   sudo systemctl status mead-security-auto-checkout.timer
   sudo systemctl list-timers | grep mead-security
   ```

### Option 3: Manual Testing

Test the auto-checkout process manually:
```bash
cd /path/to/your/project/backend
python manage.py process_auto_checkouts --dry-run  # Test mode
python manage.py process_auto_checkouts             # Live execution
```

## Configuration

Auto-checkout behavior can be configured in the Django admin panel under "System Settings":

- **Auto-checkout enabled**: Enable/disable the entire system
- **Grace period**: Minutes after scheduled end time before normal auto-checkout
- **Force timeout**: Minutes after scheduled end time for force timeout (bypasses checks)

Default values:
- Grace period: 30 minutes
- Force timeout: 720 minutes (12 hours)

## Monitoring

### Logs

Logs are stored in `/path/to/your/project/backend/logs/auto_checkout.log`

Monitor in real-time:
```bash
tail -f /path/to/your/project/backend/logs/auto_checkout.log
```

### Log Levels

- **INFO**: Normal auto-checkout (venue requirements completed)
- **WARNING**: Force timeout auto-checkout (excessive overtime)
- **ERROR**: Failed auto-checkout attempts

### Example Log Entries

```
2024-01-15 14:30:01 - Starting auto-checkout processing
2024-01-15 14:30:02 - Auto-checkout performed for shift 123 - Staff: john.doe, Venue: Main Club
2024-01-15 14:30:03 - WARNING: FORCE TIMEOUT auto-checkout performed for shift 456 - Staff: jane.smith, Venue: VIP Lounge, Excessive overtime detected
2024-01-15 14:30:04 - Auto-checkout processing completed successfully
```

## Troubleshooting

### Cron Job Issues

1. Check if cron service is running:
   ```bash
   sudo systemctl status cron
   ```

2. Check cron logs:
   ```bash
   sudo journalctl -u cron
   ```

3. Test script manually:
   ```bash
   /path/to/your/project/backend/scripts/auto_checkout_processor.sh
   ```

### Permission Issues

Ensure the scripts are executable and the web server user has access:
```bash
chmod +x auto_checkout_processor.sh
chown www-data:www-data auto_checkout_processor.sh
```

### Database Connection Issues

Verify Django settings and database connectivity:
```bash
cd /path/to/your/project/backend
python manage.py check
python manage.py shell -c "from api.models import Shift; print('Database OK')"
```

## Security Notes

- The auto-checkout system logs all actions for audit purposes
- Force timeout events are logged with WARNING level for management attention
- All auto-checkout shifts still require manager approval before payment
- Digital signatures distinguish between normal and force timeout auto-checkouts

## Removal

To remove the automated system:

### Remove Cron Job
```bash
crontab -e
# Delete the line containing "auto_checkout_processor.sh"
```

### Remove Systemd Timer
```bash
sudo systemctl stop mead-security-auto-checkout.timer
sudo systemctl disable mead-security-auto-checkout.timer
sudo rm /etc/systemd/system/mead-security-auto-checkout.*
sudo systemctl daemon-reload
```