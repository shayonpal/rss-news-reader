#!/bin/bash

# RSS Reader Complete Startup Sequence
# This script starts PM2 services and verifies they're healthy

cd /Users/shayon/DevProjects/rss-news-reader

echo "🚀 Starting RSS Reader services..."

# 1. Start PM2 if not running
if ! pm2 pid > /dev/null 2>&1; then
    echo "Starting PM2 daemon..."
    pm2 resurrect
fi

# 2. Wait a bit for PM2 to stabilize
sleep 5

# 3. Start all services (if not already running)
echo "Starting RSS Reader services via PM2..."
pm2 start ecosystem.config.js

# 4. Wait for services to initialize
echo "Waiting for services to initialize..."
sleep 10

# 5. Run health check
echo ""
echo "Running startup health check..."
/Users/shayon/DevProjects/rss-news-reader/scripts/startup-health-check.sh --start-monitor

# Exit with health check status
exit $?