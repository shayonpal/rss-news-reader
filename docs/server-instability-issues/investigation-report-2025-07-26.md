# RSS News Reader Server Instability Investigation Report

**Date: July 26, 2025**
**Time: 14:30 EST**

## Executive Summary

The RSS News Reader application is experiencing severe stability issues with multiple service crashes and restart loops. The investigation reveals critical problems across all three main services.

## Critical Findings

### 1. Production Build Issues

**Severity: CRITICAL**

The production server (rss-reader-prod) is missing critical build files:

- API routes are not being built (missing `/api/health/app` route)
- Module loading errors: `Cannot find module './vendor-chunks/dexie.js'`
- Missing error pages: `Cannot find module '.next/server/pages/_error.js'`
- Health endpoint returns 500 Internal Server Error

**Evidence:**

- 16 restarts in rapid succession at 13:56
- PM2 stopped the service due to "too many unstable restarts"
- Current uptime: Only 22 minutes since last restart

### 2. OAuth Token Access Failures

**Severity: HIGH**

The sync server cannot access OAuth tokens despite the file existing:

- Repeated errors: "No tokens found. Please run the OAuth setup first"
- Token file exists at `~/.rss-reader/tokens.json` (528 bytes, permissions: rw-------)
- This suggests a path resolution or permissions issue in the sync server code

**Evidence:**

- Continuous failures every 5-10 seconds in sync server logs
- 18 restarts of rss-sync-server service

### 3. Cron Service Health File Issues

**Severity: MEDIUM**

The cron health monitoring is failing:

- Health file at `/logs/cron-health.json` is either missing or stale
- Last update was 749 minutes ago (over 12 hours)
- Cron jobs may not be executing properly

### 4. System Resource Pressure

**Severity: MEDIUM**

The Mac Mini is under significant load:

- Load average: 10.65 (very high for typical operations)
- CPU usage: 93.5% (39.37% user + 54.12% system)
- This could be contributing to service instability

## Crash Patterns Analysis

### Restart Frequency

- **rss-reader-prod**: 16 restarts (rapid crash loop detected)
- **rss-sync-server**: 18 restarts (OAuth-related failures)
- **rss-sync-cron**: 7 restarts (cluster mode issues possible)
- **rss-reader-dev**: 4 restarts (least affected)

### Timeline of Issues

1. **02:00 AM**: Cron sync attempts failed with connection refused errors
2. **12:41-13:05 PM**: Sync server repeatedly failed with OAuth token errors
3. **13:56 PM**: Production server entered crash loop (16 restarts in seconds)
4. **14:04 PM**: PM2 manually restarted, but issues persist
5. **14:27-14:28 PM**: Health API route failures continue

## Root Cause Analysis

### Primary Issues:

1. **Incomplete Production Build**: The Next.js build is missing critical files, suggesting:
   - Build process failed or was interrupted
   - Wrong build directory is being used
   - Build cache corruption

2. **Environment Variable Issues**: OAuth token path may not be resolving correctly:
   - Possible HOME directory resolution issues
   - PM2 environment variable inheritance problems

3. **PM2 Configuration Problems**:
   - Fork mode vs cluster mode conflicts
   - Memory limits may be too restrictive
   - Restart policies causing cascade failures

## Immediate Recommendations

### 1. Rebuild Production Application

```bash
cd /Users/shayon/DevProjects/rss-news-reader
npm run build
pm2 restart rss-reader-prod
```

### 2. Check Environment Variables

```bash
pm2 env rss-sync-server
# Verify HOME and other path variables
```

### 3. Review PM2 Configuration

- Check memory limits in ecosystem.config.js
- Ensure correct exec_mode for each service
- Verify working directories

### 4. Clear and Rebuild

```bash
rm -rf .next
npm run build
pm2 restart all
```

### 5. Monitor System Resources

- Check what's causing high CPU usage
- Consider stopping non-essential services

## Long-term Recommendations

1. **Implement Proper Health Monitoring**:
   - Deploy Uptime Kuma as planned
   - Add more granular health checks
   - Implement automatic recovery procedures

2. **Improve Build Process**:
   - Add build verification steps
   - Implement rollback capabilities
   - Cache production builds

3. **Fix OAuth Token Access**:
   - Use absolute paths for token file
   - Add better error logging
   - Implement token validation on startup

4. **Resource Management**:
   - Set appropriate memory limits
   - Implement graceful shutdowns
   - Add resource monitoring alerts

## Next Steps

1. Immediately rebuild the production application
2. Fix the OAuth token path resolution
3. Restart all services with proper monitoring
4. Implement the monitoring improvements
5. Document the recovery process

## Monitoring Commands

```bash
# Check service status
pm2 list

# View error logs
pm2 logs rss-reader-prod --err --lines 100

# Monitor in real-time
pm2 monit

# Check system resources
top -o cpu

# Test health endpoints
curl http://localhost:3147/api/health/app
curl http://localhost:3001/server/health
```

This investigation shows systemic issues that require immediate attention to restore service stability.
