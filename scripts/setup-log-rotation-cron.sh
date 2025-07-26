#!/bin/bash

# setup-log-rotation-cron.sh - Set up daily log rotation cron job

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_ROTATION_SCRIPT="$SCRIPT_DIR/rotate-health-logs.sh"
CRON_LOG_DIR="/Users/shayon/DevProjects/rss-news-reader/logs/cron"

echo "=== Setting up Health Log Rotation Cron Job ==="
echo ""

# Check if rotation script exists
if [ ! -f "$LOG_ROTATION_SCRIPT" ]; then
    echo "ERROR: Log rotation script not found: $LOG_ROTATION_SCRIPT"
    exit 1
fi

# Create cron log directory if it doesn't exist
mkdir -p "$CRON_LOG_DIR"

# Define the cron job
# Run daily at 3:00 AM
CRON_JOB="0 3 * * * $LOG_ROTATION_SCRIPT >> $CRON_LOG_DIR/log-rotation.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "rotate-health-logs.sh"; then
    echo "Log rotation cron job already exists:"
    crontab -l | grep "rotate-health-logs.sh"
    echo ""
    echo "To update, remove the existing job first with:"
    echo "crontab -l | grep -v 'rotate-health-logs.sh' | crontab -"
    exit 0
fi

# Add cron job
echo "Adding cron job..."
echo ""
echo "Cron schedule: Daily at 3:00 AM"
echo "Command: $LOG_ROTATION_SCRIPT"
echo ""

# Add to crontab
(crontab -l 2>/dev/null || echo ""; echo "$CRON_JOB") | crontab -

echo "Cron job added successfully!"
echo ""
echo "Current crontab:"
crontab -l | grep "rotate-health-logs.sh" || echo "No rotation job found (this is unexpected)"

echo ""
echo "To test the rotation script manually, run:"
echo "  $LOG_ROTATION_SCRIPT"
echo ""
echo "To view rotation logs, run:"
echo "  tail -f $CRON_LOG_DIR/log-rotation.log"
echo ""
echo "To remove the cron job, run:"
echo "  crontab -l | grep -v 'rotate-health-logs.sh' | crontab -"

exit 0