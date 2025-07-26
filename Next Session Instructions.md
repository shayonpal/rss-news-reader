# Next Session Instructions

**Last Updated:** Saturday, July 26, 2025 at 4:24 PM

## ✅ COMPLETED: TODO-039i - Uptime Kuma Monitoring Infrastructure

### Uptime Kuma Implementation Status: COMPLETE ✅
- **Deployment**: Successfully deployed on port 3080 using Colima Docker
- **Monitoring**: 6 monitors created for all RSS Reader services
- **Integration**: Push notifications integrated with cron service
- **Access**: http://localhost:3080 for monitoring dashboard
- **Discovery**: Health endpoint accuracy issues identified during testing

## 🚨 NEXT PRIORITY: TODO-039b - Build Validation System 🚨

### Current Server Status
- **Production (port 3147):** Currently loading/working ✅
- **Development (port 3000):** FAILING with environment variable issues ❌
- **Uptime Kuma:** DEPLOYED and monitoring all services ✅

### Primary Focus: TODO-039b (Build Validation System)

With monitoring now in place, the next critical priority is fixing the root cause issues discovered during Uptime Kuma testing:

### Discovered Issues from Uptime Kuma Testing:
1. **Production Health Endpoint**: Returns 500 error even when app is accessible
2. **Development Health Endpoint**: Returns false positives (200 OK when app shows "No articles found" error)
3. **Sync Server Monitoring**: May not accurately detect service downtimes

### Critical Sub-Tasks to Address (in order):

1. **TODO-039b: Build Validation System** 🎯 **IMMEDIATE PRIORITY**
   - Fix health endpoints to return accurate status reflecting true service state
   - Add validation for sync server health endpoint at http://localhost:3001/server/health
   - Prevent incomplete builds from being deployed
   - Add pre-deployment health checks that actually work
   - Validate all required files exist before PM2 restart

2. **TODO-039d: Environment Variable Management**
   - Fix the current dev environment failure
   - Centralize .env validation
   - Add startup checks for all required variables
   - Prevent server starts with missing configuration

3. **TODO-039e: PM2 Configuration Improvements**
   - Stop the constant restart loops
   - Add proper error handling and recovery
   - Configure intelligent restart delays
   - Implement startup health checks

### Context & Investigation Reports
Review the detailed investigation reports in `docs/server-instability-issues/`:
- Core issues identified with build process, environment variables, and PM2 configuration
- Root causes of the restart loops and crashes documented
- Specific recommendations for each sub-task

### Why This Is Critical
- Production has been unstable for 2+ days
- Development environment is currently broken
- User experience is severely impacted by crashes
- Data integrity at risk with incomplete syncs

## Previous Session Context
- **Branch:** dev
- **Last major work:** TODO-046 (iOS PWA status bar) and TODO-007 (full content extraction)
- **Production:** Deployed but experiencing stability issues

## Session Summary
TODO-007e successfully implemented the article list content priority display system. The article list now intelligently shows content in priority order:
1. AI summaries (full display)
2. Full extracted content (4-line preview)
3. RSS content (4-line preview)

This completes the entire TODO-007 feature set, providing users with a comprehensive full content extraction system with automatic fetching, manual controls, priority display, and detailed monitoring.

## Recent Accomplishments Summary
- TODO-007 is now 100% complete (all 7 sub-tasks done)
- Completed sub-tasks:
  - ✅ 007a: DB schema for full content
  - ✅ 007b: Server endpoint with rate limiting
  - ✅ 007c: Manual fetch button
  - ✅ 007d: Auto-fetch integration
  - ✅ 007f: UI integration
  - ✅ 007g: Fetch monitoring

## Important Production Notes
- **Fetch Statistics**: Live dashboard accessible from multiple entry points
- **Auto-Fetch**: Continues to run during syncs (50 articles/30 min)
- **Success Rates**: Visible per-feed in the new dashboard
- **Database**: fetch_logs table actively collecting metrics

## Commands to Run Next Session
```bash
# Navigate to project
cd /Users/shayon/DevProjects/rss-news-reader

# Check current server status
pm2 list
pm2 logs --lines 50

# Review investigation reports
ls -la docs/server-instability-issues/

# Check environment variables
cat .env | grep -E "NEXT_PUBLIC_|SUPABASE_" | wc -l

# Start working on build validation (TODO-039b)
# First, create the validation script as outlined in the investigation report
```

## Immediate Action Items
1. **Review Investigation Reports**: Start by reading the detailed analysis in `docs/server-instability-issues/`
2. **Fix Dev Environment**: Resolve the environment variable issues preventing dev server startup
3. **Implement Build Validation**: Create the build validation system to prevent incomplete deployments
4. **Test Changes Locally**: Ensure all fixes work before deploying to production
5. **Monitor Logs**: Keep PM2 logs open to catch any issues early

## Key Implementation Details
- Fetch stats API aggregates data in-memory for efficiency
- Dashboard uses collapsible sections for better UX
- Icons differentiate auto (RefreshCw) vs manual (MousePointer) fetches
- Back button properly styled with theme-aware colors
- Navigation added to both article view and homepage

## Architecture Summary
- Server-side analytics with Supabase queries
- Client-side dashboard with real-time data fetching
- Time-based aggregation for meaningful insights
- Performance optimized with in-memory processing
- Responsive design works on all devices
