#!/bin/bash

# Test Caddy configuration locally

echo "🧪 Testing Caddy configuration..."

# Check if app is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Warning: Next.js app doesn't seem to be running on port 3000"
    echo "   Start it with: npm run dev:network"
fi

# Validate Caddyfile
echo "✓ Validating Caddyfile..."
caddy validate --config ./Caddyfile

# Run Caddy in the foreground for testing
echo ""
echo "🌐 Starting Caddy in test mode..."
echo "   The app will be available at: http://localhost/reader"
echo "   Press Ctrl+C to stop"
echo ""
caddy run --config ./Caddyfile