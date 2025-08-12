# RSS News Reader Server Instability Investigation Report

**Date**: July 26, 2025  
**Investigators**: Claude Code with DevOps Expert and Doc Admin agents  
**Scope**: Read-only investigation into frequent server crashes over the past 2 days

## Executive Summary

The RSS News Reader PWA has been experiencing severe stability issues with frequent crashes and restarts. Our investigation reveals multiple interconnected problems creating a cascade of failures:

1. **Incomplete Production Builds**: API routes not being compiled, causing 500 errors
2. **Excessive PM2 Restarts**: Production app restarted 16 times in 30 minutes
3. **Environment Variable Issues**: Client-side code not receiving required configuration
4. **Missing Recovery Mechanisms**: No validation or rollback when services fail
5. **Configuration Conflicts**: PM2 cluster mode incompatible with Next.js and cron services

## Timeline of Recent Issues

### July 26, 2025 - Environment Variable Crisis

- **Issue**: Supabase environment variables not passed to client-side bundle
- **Cause**: PM2 runtime injection doesn't work for Next.js client builds
- **Attempted Fix**: Added `require('dotenv').config()` to ecosystem.config.js
- **Result**: Production fixed temporarily, development still affected

### July 26, 2025 - OAuth Token Failure

- **Issue**: Bidirectional sync server failed for ~12 hours
- **Cause**: Missing `~/.rss-reader/tokens.json` file
- **Attempted Fix**: Regenerated OAuth tokens
- **Result**: 177 failed sync queue items had to be cleared

### July 26, 2025 - Routing Confusion

- **Issue**: 500 Internal Server Errors on all endpoints
- **Cause**: Empty `src/pages/` directory confused Next.js router
- **Attempted Fix**: Removed empty directory
- **Result**: Temporary resolution, but builds remain unstable

### July 26, 2025 - PM2 Cluster Mode Disaster

- **Issue**: PM2 restarting 105+ times
- **Cause**: Cluster mode incompatible with Next.js production builds
- **Attempted Fix**: Changed to fork mode
- **Result**: Reduced restarts but didn't solve root cause

## Root Cause Analysis

### 1. Build Process Failures

**Current State**:

```
.next/server/app/
├── page.js (exists)
└── api/ (MISSING - critical failure)
```

**Evidence**:

- Health check endpoint returns: "Cannot find module '.next/server/app/api/health/app/route.js'"
- API routes directory doesn't exist in production build
- Vendor chunks incomplete

**Impact**: All API endpoints return 500 errors, making the application unusable

### 2. Environment Variable Loading Chain

**The Problem Chain**:

1. PM2 starts process with environment variables
2. Next.js build happens AFTER PM2 starts
3. Client-side build doesn't see NEXT*PUBLIC*\* variables
4. Supabase client initialization fails
5. Articles don't load from database

**Current Workaround**:

- Exporting variables in build script
- Loading dotenv in ecosystem.config.js
- Still unreliable in development mode

### 3. PM2 Configuration Issues

**Problematic Configuration**:

```javascript
{
  name: 'rss-sync-cron',
  exec_mode: 'cluster',  // ❌ Should be 'fork' for cron
  instances: 1,
  autorestart: true,
  max_restarts: 10      // Too low for production
}
```

**Issues Identified**:

- Cron service using cluster mode (should be fork)
- Low restart limits causing services to give up
- No health check delays before marking "online"
- Missing error logs for certain failure modes

### 4. Lack of Monitoring & Recovery

**What's Missing**:

- No build validation before starting services
- No health check verification before traffic
- No automated rollback on failures
- No memory usage alerts before crashes
- No log rotation (unbounded growth)
- Stale monitoring data (cron health 748 minutes old)

### 5. Cascading Failure Pattern

**The Failure Cascade**:

1. Build partially completes (missing API routes)
2. PM2 starts the incomplete build
3. Health checks fail with 500 errors
4. PM2 restarts the service
5. Build cache used (still incomplete)
6. Cycle repeats until max_restarts hit
7. Service marked as "errored"
8. Manual intervention required

## Critical Findings

### System Resource Status

- **Memory Usage**: Within limits but approaching thresholds
- **Port Conflicts**: None detected (3000, 3001, 3147 properly separated)
- **Disk Space**: Adequate but logs growing unbounded
- **CPU**: Normal usage between crashes

### Service Health Status

```
┌─────────────────────┬─────────┬─────────┬──────────┐
│ Service             │ Status  │ Restart │ Health   │
├─────────────────────┼─────────┼─────────┼──────────┤
│ rss-reader-prod     │ online  │ 16      │ 500 err  │
│ rss-reader-dev      │ stopped │ 0       │ N/A      │
│ rss-sync-cron       │ online  │ 18      │ stale    │
│ rss-sync-server     │ online  │ 18      │ partial  │
└─────────────────────┴─────────┴─────────┴──────────┘
```

## Recommendations

### Immediate Actions (Critical)

1. **Stop Everything and Rebuild**

   ```bash
   pm2 stop all
   rm -rf .next
   rm -rf node_modules/.cache
   npm run build
   # Verify API routes exist before starting
   ls -la .next/server/app/api/
   ```

2. **Fix PM2 Configuration**
   - Change rss-sync-cron to fork mode
   - Increase max_restarts to 50
   - Add min_uptime: '10s'
   - Add kill_timeout: 5000

3. **Create Build Validation Script**
   ```bash
   #!/bin/bash
   # scripts/validate-build.sh
   if [ ! -d ".next/server/app/api" ]; then
     echo "ERROR: API routes not built"
     exit 1
   fi
   ```

### Short-term Fixes (This Week)

1. **Implement Startup Health Checks**
   - Wait for services to be truly ready
   - Verify all endpoints respond correctly
   - Only then allow traffic

2. **Add Monitoring Alerts**
   - Alert after 3 restarts in 5 minutes
   - Alert when memory > 80% of limit
   - Alert when health endpoints fail

3. **Create Recovery Scripts**
   - Auto-rebuild on API route detection failure
   - Auto-restore last known good build
   - Auto-clear PM2 logs when > 100MB

### Long-term Solutions (This Month)

1. **Blue-Green Deployment**
   - Build new version in separate directory
   - Test thoroughly before switching
   - Keep previous version for rollback

2. **Proper CI/CD Pipeline**
   - Automated tests before deployment
   - Build validation as part of pipeline
   - Automated rollback on failures

3. **Centralized Monitoring**
   - Implement Uptime Kuma (already planned)
   - Add application performance monitoring
   - Create unified dashboard

4. **Resource Management**
   - Implement log rotation
   - Add memory leak detection
   - Monitor for zombie processes

## Conclusion

The RSS News Reader is suffering from a combination of build process failures, configuration issues, and lack of proper monitoring. The most critical issue is the incomplete production builds causing API routes to be missing. This creates a cascade of failures that PM2's restart mechanism makes worse rather than better.

The system needs immediate intervention to:

1. Ensure complete builds before deployment
2. Fix configuration issues preventing stability
3. Implement proper health checks and monitoring
4. Add recovery mechanisms for common failures

Without these fixes, the application will continue to experience frequent crashes and require constant manual intervention.

## Appendix: Evidence Collected

### PM2 Status Output

```
┌─────┬─────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name                │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼─────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ rss-reader-prod     │ default     │ 0.6.17  │ fork    │ 71645    │ 28m    │ 16   │ online    │ 0%       │ 204.6mb  │ shayon   │ disabled │
│ 3   │ rss-sync-cron       │ default     │ 0.6.17  │ cluster │ 71647    │ 28m    │ 18   │ online    │ 0%       │ 66.6mb   │ shayon   │ disabled │
│ 4   │ rss-sync-server     │ default     │ 1.0.0   │ fork    │ 71648    │ 28m    │ 18   │ online    │ 0%       │ 64.3mb   │ shayon   │ disabled │
└─────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

### Health Check Responses

- `/api/health/app?ping=true`: 500 Internal Server Error
- `/api/health/db`: 500 Internal Server Error
- `http://localhost:3001/server/health`: 200 OK (sync server working)

### Build Output Analysis

- Total build size: ~2MB (suspiciously small)
- Missing directories: `.next/server/app/api/`
- Incomplete vendor chunks
- No trace files for debugging

### Log Patterns

- "Cannot find module" errors repeated
- "ECONNREFUSED" during startup
- Memory usage stable until crash
- No gradual degradation detected
