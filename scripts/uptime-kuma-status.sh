#!/bin/bash

# Quick status check for all RSS Reader services
# This helps verify what Uptime Kuma should be monitoring

echo "🔍 RSS Reader Services Status Check"
echo "==================================="
echo ""

# Check Production App
echo -n "Production App (3147): "
if curl -s -m 2 "http://localhost:3147/reader/api/health/app?ping=true" | grep -q '"status":"ok"'; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Check Dev App
echo -n "Dev App (3000): "
if curl -s -m 2 "http://localhost:3000/reader/api/health/app?ping=true" | grep -q '"status":"ok"'; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Check Sync Server
echo -n "Sync Server (3001): "
if curl -s -m 2 "http://localhost:3001/server/health" | grep -q '"status":"ok"'; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Check Database Health
echo -n "Database Connection: "
if curl -s -m 2 "http://localhost:3147/reader/api/health/db" | grep -q '"database"'; then
    echo "✅ Connected"
else
    echo "❌ Not available"
fi

# Check PM2 Status
echo ""
echo "PM2 Process Status:"
echo "-------------------"
pm2 list

# Check Uptime Kuma
echo ""
echo -n "Uptime Kuma (3080): "
if curl -s -m 2 "http://localhost:3080" >/dev/null 2>&1; then
    echo "✅ Running"
    echo "Access at: http://localhost:3080"
else
    echo "❌ Not responding"
fi

echo ""
echo "Next Steps:"
echo "1. Open http://localhost:3080 in your browser"
echo "2. Create an admin account if first time"
echo "3. Add monitors from the configuration above"
echo "4. Set up Discord notifications"
echo "5. Create push monitors and update push keys in:"
echo "   /Users/shayon/.rss-reader/uptime-kuma-push-keys.json"