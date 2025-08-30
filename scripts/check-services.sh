#!/bin/bash

# Quick service check utility for RSS News Reader

echo "RSS News Reader Service Check"
echo "============================"
echo ""

# Check build directories
echo "📁 Build Directory:"
[ -d ".next-dev" ] && echo "✅ Development (.next-dev): $(du -sh .next-dev | cut -f1)" || echo "❌ Development (.next-dev): Not found"
[ -d ".next-build" ] && echo "✅ Build (.next-build): $(du -sh .next-build | cut -f1)" || echo "ℹ️  Build (.next-build): Not found"
echo ""

# Check PM2 services
echo "🚀 PM2 Services:"
pm2 list --no-color | grep -E "(rss-reader|rss-sync)" | while read -r line; do
    NAME=$(echo "$line" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $3); print $3}')
    STATUS=$(echo "$line" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $10); print $10}')
    RESTARTS=$(echo "$line" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $9); print $9}')
    MEMORY=$(echo "$line" | awk -F'│' '{gsub(/^[ \t]+|[ \t]+$/, "", $12); print $12}')
    
    if [[ "$STATUS" == *"online"* ]]; then
        echo "✅ $NAME: Online - Restarts: $RESTARTS - Memory: $MEMORY"
    else
        echo "❌ $NAME: $STATUS"
    fi
done
echo ""

# Check health endpoints
echo "🏥 Health Checks:"
curl -sf http://localhost:3000/reader/api/health/app >/dev/null && echo "✅ App: Healthy" || echo "❌ App: Not responding"
curl -sf http://localhost:3001/server/health >/dev/null && echo "✅ Sync Server: Healthy" || echo "❌ Sync Server: Not responding"
curl -sf http://localhost:3000/reader/api/health/db >/dev/null && echo "✅ Database: Connected" || echo "❌ Database: Connection failed"
echo ""

# Show recent API calls
if [ -f "logs/inoreader-api-calls.jsonl" ]; then
    echo "📊 Recent API Calls (last hour):"
    HOUR_AGO=$(date -v-1H +%Y-%m-%dT%H)
    COUNT=$(grep "$HOUR_AGO" logs/inoreader-api-calls.jsonl 2>/dev/null | wc -l | xargs)
    echo "API calls in last hour: $COUNT"
fi