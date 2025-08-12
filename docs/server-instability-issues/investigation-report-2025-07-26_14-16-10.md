# Server Instability Investigation Report

**Date**: July 26, 2025 at 2:16 PM  
**Investigator**: Claude Code with devops-expert and doc-admin agents  
**Duration**: Past 2 days of server failures

## Executive Summary

The RSS News Reader PWA has experienced critical server instability over the past 2 days, with frequent crashes and restart loops. Investigation revealed three primary issues: missing vendor chunks causing production crashes, environment variable misconfiguration preventing client-side Supabase initialization, and cascading failures across dependent services. The root cause appears to be incomplete understanding of Next.js build requirements during recent configuration changes.

## Investigation Findings

### 1. Missing Vendor Chunks (Critical)

**Issue**: Production server (`rss-reader-prod`) experiencing rapid restart loops (16 restarts in recent logs)

**Root Cause**:

- Webpack runtime cannot locate vendor chunk files
- Looking for: `./vendor-chunks/dexie.js` and `./chunks/vendor-chunks/next.js`
- Files exist in `.next/server/vendor-chunks/` but webpack expects different paths

**Impact**:

- Production server crashes immediately on startup
- Prevents all dependent services from functioning properly
- Users cannot access the application

### 2. Environment Variable Configuration (High)

**Issue**: Supabase client-side initialization failing despite correct server-side configuration

**Root Cause**:

- Next.js requires `NEXT_PUBLIC_*` environment variables at **build time**
- PM2's runtime environment injection only provides variables at **runtime**
- Variables not being bundled into client-side JavaScript

**Impact**:

- UI displays "No feeds yet" despite database containing 1,033 articles
- Client cannot connect to Supabase
- All data fetching operations fail

**Current Status**: Production partially fixed after rebuild, development environment still affected

### 3. Cascading Service Failures (Medium)

**Issue**: Multiple services failing due to interdependencies

**Observed Pattern**:

1. Production app crashes → returns 500 errors
2. Sync cron cannot update metadata → ECONNREFUSED errors
3. Sync server experiences failures → 18 restarts
4. Health checks fail → monitoring alerts triggered

**Impact**:

- Sync operations become unreliable
- Monitoring provides false positives
- Difficult to identify root cause due to noise

### 4. OAuth Token Recovery (Resolved)

**Issue**: Missing OAuth tokens caused sync failures

**Timeline**:

- Tokens went missing (unknown cause)
- ~12 hours of failed syncs
- 177 items queued for sync
- Resolved after regenerating tokens at 13:05

**Current Status**: ✅ Resolved - tokens exist with proper permissions

## Root Cause Analysis

### Primary Factors

1. **Incomplete Build Understanding**
   - Changes made to configuration without full rebuilds
   - Misunderstanding of Next.js build vs runtime requirements
   - Partial fixes addressing symptoms not causes

2. **Configuration Management Issues**
   - Recent changes to `ecosystem.config.js`
   - Missing `_error.tsx` causing build failures
   - Incorrect assumptions about PM2 environment handling

3. **Lack of Build Verification**
   - No verification that builds complete successfully
   - No checks for missing vendor chunks
   - No validation of client-side environment variables

### Contributing Factors

- Rapid iteration without proper testing
- Making multiple changes simultaneously
- Not following established deployment procedures
- Insufficient error handling and recovery

## Proposed Solutions

### Immediate Actions (Do First)

1. **Clean Rebuild Production**

   ```bash
   cd /Users/shayon/DevProjects/rss-news-reader
   pm2 stop rss-reader-prod
   rm -rf .next
   npm run build
   pm2 restart rss-reader-prod
   ```

2. **Verify Environment Variables**

   ```bash
   # Ensure .env file contains all NEXT_PUBLIC_* variables
   # Build script must export these before running next build
   source .env && npm run build
   ```

3. **Test Health Endpoints**
   - Verify `/api/health/app?ping=true` returns 200
   - Confirm `/api/health/db` shows database connection
   - Check sync server at `http://localhost:3001/server/health`

### Short-term Fixes (Within 24 Hours)

1. **Create Build Validation Script**

   ```bash
   #!/bin/bash
   # scripts/validate-build.sh

   # Check for vendor chunks
   if [ ! -d ".next/server/vendor-chunks" ]; then
     echo "ERROR: Vendor chunks missing"
     exit 1
   fi

   # Verify environment variables in build
   if ! grep -q "NEXT_PUBLIC_SUPABASE_URL" .next/static/chunks/*.js; then
     echo "ERROR: Environment variables not bundled"
     exit 1
   fi
   ```

2. **Update PM2 Configuration**
   - Remove cluster mode permanently
   - Add proper error handling
   - Set up restart limits to prevent loops

3. **Implement Proper Build Script**

   ```bash
   #!/bin/bash
   # scripts/production-build.sh

   # Load environment
   source ~/.rss-reader/.env.production

   # Clean build
   rm -rf .next

   # Build with environment
   NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
   NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
   npm run build

   # Validate build
   ./scripts/validate-build.sh
   ```

### Long-term Improvements (Within 1 Week)

1. **Automated Build Pipeline**
   - Pre-build validation checks
   - Environment variable verification
   - Post-build testing
   - Automated rollback on failure

2. **Enhanced Monitoring**
   - Monitor vendor chunk availability
   - Track environment variable presence
   - Alert on build failures
   - PM2 restart count monitoring

3. **Documentation Updates**
   - Document build requirements clearly
   - Create deployment checklist
   - Add troubleshooting guide
   - Update CLAUDE.local.md with warnings

4. **Testing Strategy**
   - Add build tests to CI/CD
   - Test client-side initialization
   - Verify all services start correctly
   - End-to-end health checks

## Lessons Learned

1. **Next.js Build Requirements**
   - `NEXT_PUBLIC_*` variables MUST be available at build time
   - PM2 runtime injection is insufficient for client-side code
   - Always verify builds complete successfully

2. **Configuration Changes**
   - Test configuration changes in isolation
   - Always perform full rebuild after config changes
   - Verify all dependent services after changes

3. **Error Recovery**
   - Missing files should trigger immediate alerts
   - Restart loops indicate fundamental issues
   - Cascading failures mask root causes

## Recommended Process Changes

1. **Before Any Deployment**
   - Run build validation script
   - Test all health endpoints
   - Verify environment variables
   - Check PM2 logs for errors

2. **During Configuration Changes**
   - Make one change at a time
   - Test thoroughly before proceeding
   - Document what was changed and why
   - Have rollback plan ready

3. **After Deployment**
   - Monitor for 15 minutes
   - Check restart counts
   - Verify sync operations
   - Test user-facing functionality

## Conclusion

The server instability was caused by a combination of build configuration issues and misunderstanding of Next.js requirements. The immediate fix is a clean rebuild with proper environment variable handling. Long-term stability requires better build validation, monitoring, and deployment procedures.

The past 2 days of instability could have been avoided with:

- Proper build validation before deployment
- Understanding of build-time vs runtime requirements
- Testing of configuration changes in isolation
- Better error handling and recovery procedures

By implementing the proposed solutions and following the recommended processes, similar issues can be prevented in the future.
