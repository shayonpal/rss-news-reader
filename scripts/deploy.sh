#!/bin/bash

# RSS Reader Deployment Script - Simplified for Single Database
# Supports both development and production deployments

set -e  # Exit on error

# Default to development
DEPLOY_ENV=${1:-dev}

echo "🚀 Starting RSS Reader deployment for: $DEPLOY_ENV"

# Change to project directory
cd /Users/shayon/DevProjects/rss-news-reader

if [ "$DEPLOY_ENV" = "prod" ] || [ "$DEPLOY_ENV" = "production" ]; then
    # Production deployment
    ./scripts/deploy-production.sh
elif [ "$DEPLOY_ENV" = "dev" ] || [ "$DEPLOY_ENV" = "development" ]; then
    # Development deployment
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🔍 Type checking..."
    npm run type-check || true  # Don't fail on type errors in dev
    
    # Check if dev app is running
    if pm2 describe rss-reader-dev > /dev/null 2>&1; then
        echo "♻️  Restarting development app..."
        pm2 restart rss-reader-dev
    else
        echo "🚀 Starting development app..."
        pm2 start ecosystem.config.js --only rss-reader-dev
    fi
    
    echo "✅ Development deployment complete!"
    echo "🌐 Development URL: http://100.96.166.53:3000/reader"
    echo "📊 View logs: pm2 logs rss-reader-dev"
else
    echo "❌ Unknown environment: $DEPLOY_ENV"
    echo "Usage: ./scripts/deploy.sh [dev|prod]"
    exit 1
fi

echo ""
echo "📊 Useful commands:"
echo "  pm2 status              - Check app status"
echo "  pm2 logs [app-name]     - View specific app logs"
echo "  pm2 monit               - Real-time monitoring"
echo "  ./scripts/check-status.sh - Check all services"