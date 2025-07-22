#!/bin/bash

# RSS Reader Production Deployment Script

set -e  # Exit on error

echo "🚀 Starting RSS Reader deployment..."

# Change to project directory
cd /Users/shayon/DevProjects/rss-news-reader

# Build the Next.js app
echo "📦 Building Next.js application..."
npm run build

# Start PM2 process
echo "🔄 Starting PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup (run once)
# pm2 startup

# Start Caddy
echo "🌐 Starting Caddy..."
caddy start --config ./Caddyfile

echo "✅ Deployment complete!"
echo "📱 RSS Reader is available at: http://100.96.166.53/reader"
echo ""
echo "📊 Useful commands:"
echo "  pm2 status        - Check app status"
echo "  pm2 logs          - View app logs"
echo "  pm2 restart all   - Restart the app"
echo "  caddy reload      - Reload Caddy config"
echo "  caddy stop        - Stop Caddy"