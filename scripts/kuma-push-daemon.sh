#!/bin/bash

# Kuma Push Monitor Daemon
# Runs continuously and pushes metrics to Uptime Kuma

# Load configuration
source /Users/shayon/DevProjects/rss-news-reader/.kuma-push-urls 2>/dev/null || {
    echo "Error: Kuma URLs not configured. Run setup-kuma-push-monitors.sh first."
    exit 1
}

# Push script location
PUSH_SCRIPT="/Users/shayon/DevProjects/rss-news-reader/scripts/push-to-kuma.sh"

echo "Starting Kuma Push Monitor Daemon..."
echo "Sync URL configured: ${KUMA_SYNC_URL:0:50}..."
echo "API URL configured: ${KUMA_API_URL:0:50}..."
echo "Fetch URL configured: ${KUMA_FETCH_URL:0:50}..."
echo "DB URL configured: ${KUMA_DB_URL:0:50}..."

# Counter for timing
COUNTER=0

# Main loop
while true; do
    # Push sync status every 5 minutes
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pushing sync status..."
    $PUSH_SCRIPT sync
    
    # Every 10 minutes (counter divisible by 2)
    if [ $((COUNTER % 2)) -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pushing database health..."
        $PUSH_SCRIPT db
    fi
    
    # Every 30 minutes (counter divisible by 6)
    if [ $((COUNTER % 6)) -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pushing fetch stats..."
        $PUSH_SCRIPT fetch
    fi
    
    # Every hour (counter divisible by 12)
    if [ $((COUNTER % 12)) -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pushing API usage..."
        $PUSH_SCRIPT api
    fi
    
    # Increment counter and reset at 12 (1 hour)
    COUNTER=$((COUNTER + 1))
    if [ $COUNTER -ge 12 ]; then
        COUNTER=0
    fi
    
    # Sleep for 5 minutes
    sleep 300
done