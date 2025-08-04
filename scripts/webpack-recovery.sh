#!/bin/bash

# Webpack Recovery Script
# One-command recovery tool for webpack corruption issues

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🔧 Starting webpack recovery process..."
echo "================================================"

# Step 1: Stop the dev server
echo ""
echo "1️⃣  Stopping rss-reader-dev service..."
if pm2 describe rss-reader-dev > /dev/null 2>&1; then
    pm2 stop rss-reader-dev
    echo "✓ Service stopped"
else
    echo "ℹ️  Service not running"
fi

# Step 2: Clean webpack artifacts
echo ""
echo "2️⃣  Cleaning webpack artifacts..."
if [ -d ".next" ]; then
    rm -rf .next
    echo "✓ Removed .next directory"
else
    echo "ℹ️  No .next directory found"
fi

if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "✓ Removed node_modules/.cache"
else
    echo "ℹ️  No node_modules/.cache found"
fi

# Step 3: Restart the dev server
echo ""
echo "3️⃣  Restarting rss-reader-dev service..."
pm2 start ecosystem.config.js --only rss-reader-dev
echo "✓ Service restarted"

# Step 4: Wait for service to stabilize
echo ""
echo "4️⃣  Waiting for service to stabilize..."
sleep 10

# Step 5: Health check
echo ""
echo "5️⃣  Running health check..."
HEALTH_URL="http://localhost:3000/reader/api/health/app"
MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
        echo "✅ Health check passed!"
        echo ""
        echo "🎉 Webpack recovery completed successfully!"
        echo "================================================"
        exit 0
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Health check failed, retrying in 5 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
            sleep 5
        fi
    fi
done

# If we get here, health check failed
echo ""
echo "❌ Health check failed after $MAX_RETRIES attempts"
echo "Please check the PM2 logs for more details:"
echo "  pm2 logs rss-reader-dev --lines 50"
echo "================================================"
exit 1