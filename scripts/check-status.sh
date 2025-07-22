#!/bin/bash

# Check status of RSS Reader services

echo "🔍 RSS Reader Service Status Check"
echo "=================================="
echo ""

# Check PM2 status
echo "📊 PM2 Status:"
if command -v pm2 &> /dev/null; then
    pm2 status
else
    echo "❌ PM2 is not installed"
fi
echo ""

# Check if Next.js is responding
echo "🚀 Next.js App Status:"
if curl -s -o /dev/null -w "✅ Responding (HTTP %{http_code})\n" http://localhost:3000/reader; then
    echo "   URL: http://localhost:3000/reader"
else
    echo "❌ Not responding on port 3000"
fi
echo ""

# Check if Caddy is running
echo "🌐 Caddy Status:"
if pgrep -x "caddy" > /dev/null; then
    echo "✅ Caddy is running"
    echo "   PID: $(pgrep -x caddy)"
    
    # Test the proxied endpoint
    if curl -s -o /dev/null -w "✅ Proxy working (HTTP %{http_code})\n" http://localhost/reader; then
        echo "   URL: http://localhost/reader"
    else
        echo "❌ Proxy not responding"
    fi
else
    echo "❌ Caddy is not running"
fi
echo ""

# Check Tailscale status
echo "🔒 Tailscale Status:"
if tailscale status &> /dev/null; then
    echo "✅ Tailscale is connected"
    echo "   IP: $(tailscale ip -4 2>/dev/null || echo 'Unable to get IP')"
else
    echo "❌ Tailscale is not connected"
fi
echo ""

# Check disk space
echo "💾 Disk Space:"
df -h . | grep -v Filesystem | awk '{print "   Used: " $3 " of " $2 " (" $5 " full)"}'
echo ""

# Check recent logs
echo "📝 Recent Logs:"
if [ -f "logs/pm2-out.log" ]; then
    echo "   Last 5 lines from PM2:"
    tail -5 logs/pm2-out.log | sed 's/^/   /'
fi

if [ -f "logs/caddy-access.log" ]; then
    echo "   Last 5 access requests:"
    tail -5 logs/caddy-access.log | sed 's/^/   /'
fi