# RSS News Reader Server Instability Investigation Report

**Date**: Saturday, July 26, 2025 at 2:30 PM  
**Investigators**: Claude Code with doc-admin and devops-expert agents  
**Investigation Type**: Read-only analysis

## Executive Summary

Over the past 2 days, the RSS News Reader PWA has experienced severe instability with frequent crashes and restart loops. Our investigation reveals multiple cascading failures stemming from incomplete production builds, environment variable resolution issues, and PM2 configuration problems. The system is currently under extreme load (10.65 load average, 93.5% CPU) due to these restart loops.

## Critical Issues Identified

### 1. **Incomplete Production Build (CRITICAL)**

**Evidence:**

- Production server returns 404/500 errors for API routes including `/api/health/app`
- Module loading errors for vendor chunks and pages
- 16 rapid restarts detected before PM2 stopped the service

**Root Cause:**

- Next.js production build missing critical files, especially API routes
- Build process likely interrupted or misconfigured
- Environment variables not properly injected during build time

**Impact:**

- Complete application failure in production
- Health checks fail, triggering PM2 restart loops
- Cascade effect on all dependent services

### 2. **OAuth Token Access Failure (HIGH)**

**Evidence:**

- Sync server logs show repeated "No tokens found" errors
- Token file exists at `~/.rss-reader/tokens.json` with correct permissions (600)
- 18 restarts with continuous failures every 5-10 seconds

**Root Cause:**

- Path resolution issues in PM2 context
- HOME environment variable may not be properly set in PM2 process
- Possible race condition during startup

**Impact:**

- Bidirectional sync completely broken
- Read/star states not syncing to Inoreader
- User experience severely degraded

### 3. **PM2 Configuration Issues (HIGH)**

**Evidence:**

- Cron service running in cluster mode instead of fork mode
- Memory limits may be too restrictive (256MB for cron, 1GB for main app)
- Restart policies causing rapid cycling

**Root Cause:**

- Inconsistent exec_mode configuration across services
- Next.js incompatible with cluster mode
- Missing environment variable configuration in ecosystem.config.js

**Impact:**

- Services unable to start properly
- Excessive resource consumption from restart attempts
- System instability due to conflicting process modes

### 4. **System Resource Exhaustion (MEDIUM)**

**Evidence:**

- Load average: 10.65 (extremely high for the hardware)
- CPU usage: 93.5% (54% system, indicating kernel overhead)
- Memory pressure from multiple restart attempts

**Root Cause:**

- Restart loops consuming excessive CPU
- PM2 spawning new processes before old ones fully terminate
- No backoff strategy for failed starts

**Impact:**

- System becomes unresponsive
- Other services on the machine affected
- Potential for complete system lockup

### 5. **Health Monitoring Gaps (MEDIUM)**

**Evidence:**

- Cron health file 12+ hours stale
- No automated recovery mechanisms
- Uptime Kuma monitoring not yet implemented (TODO-039)

**Root Cause:**

- Health check system exists but no monitoring layer
- No alerting for failures
- Manual intervention required for all issues

**Impact:**

- Issues go undetected for hours
- No proactive problem resolution
- Increased downtime

## Pattern Analysis

### Cascade Failure Sequence

1. Production build incomplete/corrupted
2. Health checks fail (404/500 errors)
3. PM2 triggers restart
4. Service fails to start due to missing files
5. Rapid restart loop begins
6. System resources exhausted
7. All services become unstable

### Environmental Context Issues

- Services running under PM2 have different environment than manual execution
- Path resolution (`~` expansion) fails in PM2 context
- Environment variables not properly inherited

### Build vs Runtime Confusion

- Client-side environment variables (`NEXT_PUBLIC_*`) must be available at build time
- Recent fixes focused on runtime but didn't address build-time requirements
- Build artifacts may be incomplete or in wrong location

## Proposed Solutions

### Immediate Actions (Stop the Bleeding)

1. **Stop All Services**

   ```bash
   pm2 stop all
   pm2 delete all
   ```

2. **Clean Build with Proper Environment**

   ```bash
   cd /Users/shayon/DevProjects/rss-news-reader
   rm -rf .next
   npm run build  # Ensure all env vars are loaded
   ```

3. **Fix Token Path Resolution**

   - Use absolute path: `/Users/shayon/.rss-reader/tokens.json`
   - Or set HOME explicitly in ecosystem.config.js

4. **Update PM2 Configuration**

   - Ensure all services use fork mode
   - Add proper environment variables
   - Implement exponential backoff for restarts

5. **Start Services Individually**
   ```bash
   pm2 start ecosystem.config.js --only rss-reader-prod
   # Verify it's stable before starting others
   pm2 start ecosystem.config.js --only rss-sync-server
   pm2 start ecosystem.config.js --only rss-sync-cron
   ```

### Short-term Fixes (Next 24-48 hours)

1. **Implement Startup Health Checks**

   - Add pre-flight checks before starting services
   - Verify all dependencies accessible
   - Check database connectivity

2. **Create Recovery Scripts**

   - Automated build verification
   - Service dependency checks
   - Graceful degradation options

3. **Improve Logging**

   - Add detailed startup logs
   - Log environment variables (sanitized)
   - Track resource usage

4. **Add Build Validation**
   - Verify API routes exist after build
   - Check for required static files
   - Validate environment variable injection

### Long-term Improvements

1. **Implement Uptime Kuma Monitoring** (TODO-039)

   - Deploy as documented
   - Configure all health endpoints
   - Set up Discord notifications

2. **Create Deployment Pipeline**

   - Automated build verification
   - Blue-green deployment strategy
   - Rollback capabilities

3. **Improve Error Handling**

   - Graceful shutdown handlers
   - Proper error boundaries
   - Circuit breakers for external services

4. **Resource Management**

   - Implement connection pooling
   - Add memory leak detection
   - Monitor file descriptor usage

5. **Development Practices**
   - Separate development and production configs
   - Implement staging environment
   - Automated testing before deployment

## Key Learnings

1. **PM2 Cluster Mode Incompatibility**: Next.js applications must run in fork mode, not cluster mode
2. **Build-time vs Runtime Environment**: Client-side environment variables must be available during build
3. **Path Resolution in Services**: Always use absolute paths in service configurations
4. **Monitoring is Critical**: Without proper monitoring, issues compound before detection
5. **Restart Policies Need Limits**: Unlimited rapid restarts can exhaust system resources

## Recommendations for Claude Code Usage

Based on this investigation, when working with this codebase:

1. **Always verify builds**: After any build command, check that API routes exist in `.next`
2. **Test PM2 configs**: Start services one at a time and verify stability
3. **Use absolute paths**: Avoid `~` or relative paths in service configurations
4. **Check system resources**: Monitor load average and CPU during operations
5. **Implement changes incrementally**: Avoid multiple simultaneous system changes

## Conclusion

The server instability stems from a combination of build issues, configuration problems, and missing monitoring. The cascade effect of these issues created a perfect storm of system instability. By addressing the root causes systematically and implementing proper monitoring, the system can be restored to stable operation.

The immediate priority is to stop the restart loops, create a clean production build with proper environment variables, and start services individually with corrected configurations. Once stable, the monitoring and long-term improvements should be implemented to prevent future occurrences.
