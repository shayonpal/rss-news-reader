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

if [ -d ".next-prod" ]; then
    NEXT_PROD_SIZE=$(du -sh .next-prod | cut -f1)
    NEXT_PROD_MODIFIED=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" .next-prod)
    echo "✅ Production (.next-prod): $NEXT_PROD_SIZE - Last modified: $NEXT_PROD_MODIFIED"
else
    echo "❌ Production (.next-prod): Not found"
fi

# Check PM2 status
echo -e "\n🚀 PM2 Service Status:"
pm2 list | grep -E "(rss-reader-dev|rss-reader-prod)" | while read -r line; do
    NAME=$(echo "$line" | awk '{print $2}')
    STATUS=$(echo "$line" | awk '{print $9}')
    RESTARTS=$(echo "$line" | awk '{print $8}')
    MEMORY=$(echo "$line" | awk '{print $11}')
    
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
if [ -d ".next-prod/cache" ]; then
    CACHE_SIZE=$(du -sh .next-prod/cache 2>/dev/null | cut -f1 || echo "0")
    echo "Production cache: $CACHE_SIZE"
fi

# Check for port conflicts
echo -e "\n🔌 Port Status:"
lsof -i :3000 >/dev/null 2>&1 && echo "✅ Port 3000 (dev): In use" || echo "⚠️  Port 3000 (dev): Available"
lsof -i :3147 >/dev/null 2>&1 && echo "✅ Port 3147 (prod): In use" || echo "⚠️  Port 3147 (prod): Available"

# Check recent error logs
echo -e "\n📋 Recent Errors (last 24 hours):"
if [ -f "logs/prod-error-15.log" ]; then
    PROD_ERRORS=$(grep -c "Error:" logs/prod-error-15.log 2>/dev/null || echo "0")
    echo "Production errors: $PROD_ERRORS"
fi
if [ -f "logs/dev-error-7.log" ]; then
    DEV_ERRORS=$(grep -c "Error:" logs/dev-error-7.log 2>/dev/null || echo "0")
    echo "Development errors: $DEV_ERRORS"
fi

# Recommendations
echo -e "\n💡 Recommendations:"
echo "============================================"

# Check restart counts
DEV_RESTARTS=$(pm2 list | grep "rss-reader-dev" | awk '{print $8}' | head -1)
PROD_RESTARTS=$(pm2 list | grep "rss-reader-prod" | awk '{print $8}' | head -1)

if [[ "$DEV_RESTARTS" -gt 10 ]] 2>/dev/null; then
    echo "⚠️  Development server has high restart count ($DEV_RESTARTS). Consider:"
    echo "   - Running: npm run clean:dev"
    echo "   - Checking logs: pm2 logs rss-reader-dev"
fi

if [[ "$PROD_RESTARTS" -gt 10 ]] 2>/dev/null; then
    echo "⚠️  Production server has high restart count ($PROD_RESTARTS). Consider:"
    echo "   - Rebuilding: npm run build:prod"
    echo "   - Checking logs: pm2 logs rss-reader-prod"
fi

# Check if both directories exist and might conflict
if [ -d ".next" ] && [ -d ".next-prod" ]; then
    echo "✅ Separate build directories are properly configured"
else
    echo "⚠️  Missing build directories. Run appropriate build commands."
fi

echo -e "\n✅ Monitoring complete!"