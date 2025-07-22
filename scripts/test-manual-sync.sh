#!/bin/bash

# Test manual sync trigger script
# This tests the sync without running the cron service

echo "🔄 Testing Manual Sync Trigger..."
echo ""

# Check if server is running
echo "Checking if Next.js server is running..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ Server is not running. Please start it with: npm run dev"
    exit 1
fi

echo "✅ Server is running"
echo ""

# Trigger sync
echo "Triggering manual sync..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/sync \
  -H "Content-Type: application/json")

echo "Response: $RESPONSE"
echo ""

# Extract syncId using jq if available, otherwise use grep
if command -v jq &> /dev/null; then
    SYNC_ID=$(echo $RESPONSE | jq -r '.syncId')
    SUCCESS=$(echo $RESPONSE | jq -r '.success')
else
    SYNC_ID=$(echo $RESPONSE | grep -o '"syncId":"[^"]*"' | cut -d'"' -f4)
    SUCCESS=$(echo $RESPONSE | grep -o '"success":[^,}]*' | cut -d':' -f2)
fi

if [ "$SUCCESS" != "true" ]; then
    echo "❌ Sync failed to start"
    exit 1
fi

echo "✅ Sync started with ID: $SYNC_ID"
echo ""

# Poll for status
echo "Polling for sync status..."
for i in {1..30}; do
    sleep 2
    STATUS_RESPONSE=$(curl -s http://localhost:3000/api/sync/status/$SYNC_ID)
    
    if command -v jq &> /dev/null; then
        STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
        PROGRESS=$(echo $STATUS_RESPONSE | jq -r '.progress')
        MESSAGE=$(echo $STATUS_RESPONSE | jq -r '.message // empty')
    else
        STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        PROGRESS=$(echo $STATUS_RESPONSE | grep -o '"progress":[0-9]*' | cut -d':' -f2)
    fi
    
    echo "[$i/30] Status: $STATUS, Progress: $PROGRESS%"
    [ -n "$MESSAGE" ] && echo "      Message: $MESSAGE"
    
    if [ "$STATUS" = "completed" ]; then
        echo ""
        echo "✅ Sync completed successfully!"
        exit 0
    elif [ "$STATUS" = "failed" ]; then
        echo ""
        echo "❌ Sync failed!"
        echo "Full response: $STATUS_RESPONSE"
        exit 1
    fi
done

echo ""
echo "⏱️  Sync timed out after 60 seconds"
exit 1