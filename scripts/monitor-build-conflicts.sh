#!/bin/bash

# Monitor Build Conflicts Script
# This script monitors for potential conflicts between dev and production builds

set -e

echo "🔍 Monitoring RSS Reader Build Health..."
echo "============================================"

# Check if both build directories exist
echo -e "\n📁 Build Directories:"
if [ -d ".next" ]; then
    NEXT_SIZE=$(du -sh .next | cut -f1)
    NEXT_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" .next)
    echo "✅ Development (.next): $NEXT_SIZE - Last modified: $NEXT_MODIFIED"
else
    echo "❌ Development (.next): Not found"
fi


# Check PM2 status
echo -e "\n🚀 PM2 Service Status:"
# Use --no-color to avoid ANSI escape codes
pm2 list --no-color | grep -E "(rss-reader-dev)" | while read -r line; do
    # Strip any remaining ANSI codes and parse fields
    CLEAN_LINE=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')
    # Fields: empty | id | name | namespace | version | mode | pid | uptime | restarts | status | cpu | mem | user | watching | empty
    NAME=$(echo "$CLEAN_LINE" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $3); print $3}')
    STATUS=$(echo "$CLEAN_LINE" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $10); print $10}')
    RESTARTS=$(echo "$CLEAN_LINE" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $9); print $9}')
    MEMORY=$(echo "$CLEAN_LINE" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $12); print $12}')
    
    if [[ "$STATUS" == *"online"* ]]; then
        echo "✅ $NAME: Online - Restarts: $RESTARTS - Memory: $MEMORY"
    else
        echo "❌ $NAME: $STATUS - Restarts: $RESTARTS"
    fi
done

# Check webpack cache status
echo -e "\n💾 Webpack Cache Status:"
if [ -d ".next/cache" ]; then
    CACHE_SIZE=$(du -sh .next/cache 2>/dev/null | cut -f1 || echo "0")
    echo "Development cache: $CACHE_SIZE"
fi

# Check for port conflicts
echo -e "\n🔌 Port Status:"
lsof -i :3000 >/dev/null 2>&1 && echo "✅ Port 3000 (dev): In use" || echo "⚠️  Port 3000 (dev): Available"

# Check recent error logs
echo -e "\n📋 Recent Errors (last 24 hours):"
if [ -f "logs/dev-error-7.log" ]; then
    DEV_ERRORS=$(grep -c "Error:" logs/dev-error-7.log 2>/dev/null || echo "0")
    echo "Development errors: $DEV_ERRORS"
fi

# Recommendations
echo -e "\n💡 Recommendations:"
echo "============================================"

# Check restart counts
DEV_RESTARTS=$(pm2 list --no-color | grep "rss-reader-dev" | sed 's/\x1b\[[0-9;]*m//g' | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $9); print $9}' | head -1)
if [[ "$DEV_RESTARTS" -gt 10 ]] 2>/dev/null; then
    echo "⚠️  Development server has high restart count ($DEV_RESTARTS). Consider:"
    echo "   - Running: npm run clean"
    echo "   - Checking logs: pm2 logs rss-reader-dev"
fi

# Check if build directory exists
if [ -d ".next" ]; then
    echo "✅ Build directory is properly configured"
else
    echo "⚠️  Missing build directory. Run: npm run build"
fi

echo -e "\n✅ Monitoring complete!"