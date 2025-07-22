#!/bin/bash

# Deploy Production Script
# This script deploys the RSS Reader to production with zero downtime

set -e  # Exit on error

echo "🚀 Starting production deployment..."

# 1. Verify we're on the main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: You must be on the main branch to deploy to production"
    echo "Current branch: $CURRENT_BRANCH"
    echo "Run: git checkout main"
    exit 1
fi

# 2. Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes"
    echo "Please commit or stash your changes before deploying"
    exit 1
fi

# 3. Pull latest changes
echo "📥 Pulling latest changes from main..."
git pull origin main

# 4. Install dependencies if package.json changed
echo "📦 Checking dependencies..."
npm install

# 5. Run quality checks
echo "🔍 Running quality checks..."
npm run lint
npm run type-check

# 6. Build production bundle
echo "🔨 Building production bundle..."
npm run build

# 7. Check if production app is running
if pm2 describe rss-reader-prod > /dev/null 2>&1; then
    echo "♻️  Reloading production app with zero downtime..."
    pm2 reload rss-reader-prod
else
    echo "🚀 Starting production app..."
    pm2 start ecosystem.config.js --only rss-reader-prod
fi

# 8. Save PM2 state
echo "💾 Saving PM2 state..."
pm2 save

# 9. Health check
echo "🏥 Performing health check..."
sleep 5  # Wait for app to start
if curl -f http://localhost:3147/reader > /dev/null 2>&1; then
    echo "✅ Production deployment successful!"
    echo "🌐 Production URL: http://100.96.166.53/reader"
    echo "📊 View logs: pm2 logs rss-reader-prod"
else
    echo "❌ Health check failed!"
    echo "Check logs: pm2 logs rss-reader-prod"
    exit 1
fi

echo "🎉 Deployment complete!"