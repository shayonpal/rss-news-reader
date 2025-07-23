# Production Deployment Checklist - v0.5.1

**Date**: July 23, 2025  
**Version**: 0.5.1  
**Previous Production Version**: 0.5.0

## Pre-Deployment Checklist

### ✅ Code Preparation (COMPLETED)
- [x] Version updated in package.json (0.5.1)
- [x] CHANGELOG.md updated with release date
- [x] Release notes created (RELEASE_NOTES_v0.5.1.md)
- [x] Git tag created (v0.5.1)
- [x] Code pushed to dev branch
- [x] GitHub release created

### 🔄 Database Migrations Required
**IMPORTANT**: This release includes 2 database migrations for bi-directional sync:
1. `007_add_bidirectional_sync.sql` - Adds sync_queue table and related functions
2. `008_fix_sync_queue_function.sql` - Fixes function syntax error

### 📋 Deployment Steps

#### Step 1: Merge to Main Branch
```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

#### Step 2: SSH to Production Server
**You need to run this command:**
```bash
ssh shayon@100.96.166.53
```

#### Step 3: Navigate to Project Directory
```bash
cd /Users/shayon/DevProjects/rss-news-reader
```

#### Step 4: Pull Latest Code
```bash
git checkout main
git pull origin main
```

#### Step 5: Run Database Migrations
**CRITICAL**: Run these migrations before deploying the new code:
```bash
# Using Supabase MCP or direct SQL
# Migration 1:
cat src/lib/db/migrations/007_add_bidirectional_sync.sql

# Migration 2:
cat src/lib/db/migrations/008_fix_sync_queue_function.sql
```

#### Step 6: Install Dependencies
```bash
npm install --legacy-peer-deps
```

#### Step 7: Build Production Bundle
```bash
npm run build
```

#### Step 8: Update PM2 Processes
```bash
# Reload with zero downtime
pm2 reload rss-reader-prod

# Also reload the sync server if running
pm2 reload rss-sync-server

# Save PM2 state
pm2 save
```

#### Step 9: Verify Deployment
```bash
# Check process status
pm2 status

# Check logs
pm2 logs rss-reader-prod --lines 50

# Test the application
curl -I http://localhost:3147/reader
```

## Post-Deployment Verification

### Health Checks
- [ ] Production URL responds: http://100.96.166.53:3147/reader
- [ ] No errors in PM2 logs
- [ ] Sync functionality working
- [ ] New features working:
  - [ ] Auto-mark articles as read on scroll
  - [ ] Reddit-style auto-hiding header
  - [ ] Mobile responsiveness improvements

### Monitoring
- Check PM2 logs: `pm2 logs rss-reader-prod`
- Check sync logs: `pm2 logs rss-sync-cron`
- Monitor memory usage: `pm2 monit`

## Rollback Plan

If issues occur:
```bash
# Revert to previous version
git checkout v0.5.0
npm install --legacy-peer-deps
npm run build
pm2 reload rss-reader-prod
```

## Features in This Release

1. **Auto-Mark Articles as Read on Scroll**
   - Intersection Observer implementation
   - 500ms debounce for batch processing
   - Visual feedback with opacity transition

2. **Reddit-Style Auto-Hiding Header**
   - Hides on scroll down, shows on scroll up
   - Smooth 300ms transition
   - Saves screen space on mobile

3. **Enhanced Mobile Responsiveness**
   - Fixed folder name truncation
   - Responsive font sizing
   - iOS Safari gesture support

4. **Bi-directional Sync Infrastructure**
   - Sync queue for tracking local changes
   - Automatic retry with exponential backoff
   - Conflict resolution with timestamps

## Notes

- Port 3147 is used for production (not 80 due to Obsidian Docker)
- Automatic sync runs at 2:00 AM and 2:00 PM Toronto time
- Database migrations are required for bi-directional sync feature