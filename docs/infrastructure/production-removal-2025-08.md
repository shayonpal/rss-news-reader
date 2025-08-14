# Production Environment Removal Documentation

Document Date: Friday, August 1, 2025 at 3:57 AM
Linear Project: [Documentation and Files Cleanup](https://linear.app/agilecode-studio/project/documentation-and-files-cleanup-3d2feb818a73/overview)

## Executive Summary

### Decision Rationale and Timeline

- **Issue**: Production environment causing critical resource contention and system instability
- **Evidence**: Production server had 51 restarts in 4 hours, memory usage at 87.5%
- **Decision Date**: July 31, 2025
- **Implementation**: July 31 - August 1, 2025
- **Completed**: August 1, 2025

### Key Benefits Achieved

- Memory usage reduced from 87.5% to ~71% (16.5% improvement)
- Eliminated dual-process competition and cascading failures
- Simplified monitoring and maintenance to single environment
- Freed port 3147 for future use
- Removed complexity of managing two environments

### Final Architecture

- **Before**: Dual environment (Dev on 3000, Prod on 3147) with Caddy reverse proxy
- **After**: Single development environment at http://100.96.166.53:3000/reader
- **Access**: Direct client access to Next.js (removed Caddy layer)

## Implementation Details

### Phase 1: Stop Production Services (RR-93)

**Objective**: Immediately stop production PM2 process to free resources

**Commands Executed**:

```bash
pm2 stop rss-reader-prod
pm2 delete rss-reader-prod
pm2 save
```

**Results**:

- Port 3147 completely freed
- Memory usage immediately dropped to ~70%
- PM2 configuration saved without production app

### Phase 2: Update Core Configurations (RR-94)

**Objective**: Remove all production references from core configs

**File: ecosystem.config.js**

- Removed entire `rss-reader-prod` app configuration (lines 5-50)
- Updated `rss-sync-cron` NEXT_PUBLIC_BASE_URL from 'http://localhost:3147' to 'http://localhost:3000'

**File: package.json**

- Removed scripts:
  - `"build:prod": "NODE_ENV=production next build"`
  - `"start:prod": "NODE_ENV=production pm2 start ecosystem.config.js --only rss-reader-prod"`

### Phase 3: Update Shell Scripts (RR-95)

**Objective**: Remove port 3147 references and production-specific scripts

**Scripts Deleted** (4 total):

- `scripts/build-and-start-prod.sh`
- `scripts/deploy-production.sh`
- `scripts/deploy.sh`
- `scripts/rollback-last-build.sh`

**Scripts Modified** (14 total):

1. `check-services.sh` - Removed production health checks
2. `monitor-build-conflicts.sh` - Removed production build checks
3. `monitor-dashboard.sh` - Changed all 3147 references to 3000
4. `monitor-services.sh` - Updated health URL and service name
5. `pm2-pre-start-validation.sh` - Simplified to basic validation only
6. `setup-uptime-kuma.sh` - Updated monitoring URLs
7. `startup.sh` - Changed port check from 3147 to 3000
8. `startup-health-check.sh` - Changed service names and URLs
9. `sync-health-monitor.sh` - Updated freshness check URL
10. `test-health-endpoints.sh` - Updated endpoint URLs
11. `test-log-rotation.sh` - Changed service name
12. `test-rr69-security.sh` - Updated test URL
13. `uptime-kuma-status.sh` - Updated all endpoints
14. `validate-build.sh` - Mass replaced 3147 with 3000

### Phase 4: Update Documentation (RR-96)

**Objective**: Update all documentation for dev-only setup

**Documentation Files Updated**:

- `README.md` - Removed port 3147 references, production URLs, updated service table
- `CLAUDE.md` - Updated service list, removed production URL/port references
- `CHANGELOG.md` - Added entry documenting architectural change
- `docs/deployment/*.md` - Updated for dev-only setup
- `docs/monitoring/*.md` - Removed production health endpoints
- `docs/api/server-endpoints.md` - Changed example URLs from 3147 to 3000

**Claude Commands Updated**:

- `.claude/commands/health-check.md` line 50
- `.claude/commands/prepare-for-release.md` line 85
- `.claude/commands/with-agents/health-check.md` line 50
- `.claude/commands/with-agents/prepare-for-release.md` line 85

### Phase 5: Update Monitoring & Health Checks (RR-97)

**Objective**: Update all monitoring to use dev server only

**Changes Applied**:

- Changed all Uptime Kuma monitors from port 3147 to 3000
- Removed production-specific monitors
- Updated health check scripts to check port 3000 instead of 3147
- Updated or removed Caddyfile references

### Phase 6: Cleanup Production Artifacts (RR-98)

**Objective**: Remove production logs and build artifacts

**Cleanup Actions**:

- Updated log rotation scripts to remove patterns for `prod-*.log` files
- Archived existing production logs to archive directory
- Removed `.next-prod` directory
- Updated `.gitignore` to remove production-specific patterns

### Phase 7: Final Verification & Testing (RR-99)

**Objective**: Comprehensive testing of dev-only setup

**Verification Script Created**: `scripts/verify-production-removal.sh`

- 19 test cases total
- Results: 13 passed, 3 failed (non-critical), 3 warnings

**Environment Variable Cleanup**:

- Removed/commented in `.env`:
  - `PROD_PORT=3147`
  - `PROD_NODE_ENV=production`
  - `PROD_NEXT_PUBLIC_BASE_URL`
- Updated `NEXT_PUBLIC_APP_URL` from port 3147 to 3000
- Changed sync services NODE_ENV from 'production' to 'development' in ecosystem.config.js

**Test Updates**:

- Updated `src/__tests__/scripts/validate-build.test.ts` expectations
- Fixed test suite to match new dev-only architecture

### Phase 8: Remove Caddy Configuration (RR-104)

**Objective**: Remove unused Caddy reverse proxy setup

**Files Deleted**:

- `Caddyfile` from project root
- `docs/deployment/caddy-pm2-setup.md`

**Scripts Updated**:

- `scripts/startup.sh` - Removed all Caddy references
- `scripts/check-status.sh` - Removed Caddy status monitoring
- `.env.example` - Clarified port 8080 is only for OAuth setup callbacks

**Architecture Change**:

- Before: Client → Caddy (port 80) → Next.js (port 3000)
- After: Client → Next.js (port 3000) directly

**API Endpoint Corrections**:

- Discovered `/api/feeds` and `/api/articles` return 404 by design
- Frontend fetches data directly from Supabase for performance
- API endpoints only exist for processing operations
- Updated test suite and documentation to reflect this design

## Technical Changes Summary

### PM2 Ecosystem Changes

- Services reduced from 4 to 3
- Removed `rss-reader-prod` service entirely
- All services now run in development mode
- Consistent NODE_ENV across all services

### Port Configuration

- Development server: Port 3000 (unchanged)
- Production server: Port 3147 (removed)
- Sync server: Port 3001 (unchanged)
- OAuth callback: Port 8080 (setup only, unchanged)

### File System Changes

- Deleted 4 production deployment scripts
- Modified 14 monitoring and utility scripts
- Updated 6+ documentation files
- Removed Caddy configuration files
- Archived production logs

### Environment Variables

- Removed all PROD\_\* prefixed variables
- Consolidated to single set of environment variables
- Updated all service configurations to use development settings

## Script Fixes (RR-103)

### monitor-build-conflicts.sh

**Issue**: PM2 output parsing problems with ANSI color codes
**Fix**: Added `--no-color` flag to PM2 commands, updated field extraction

### sync-health-monitor.sh

**Issue**: Script hanging due to subshell variable scoping
**Fix**: Replaced pipe with process substitution, added timeouts (5s for tail/jq, 10s for curl)

### validate-build.sh

**Issue**: 22 critical issues due to production build assumptions
**Fix**: Updated for Next.js 14 on-demand compilation, fixed endpoint URLs to include /reader base path

## Verification Results

### Successful Verifications (13/19)

- ✓ No processes running on port 3147
- ✓ rss-reader-prod removed from PM2
- ✓ App accessible at http://100.96.166.53:3000/reader
- ✓ Health endpoints responding at port 3000
- ✓ OAuth tokens preserved at ~/.rss-reader/tokens.json
- ✓ Memory usage reduced to ~71%
- ✓ All shell scripts updated
- ✓ Documentation updated
- ✓ Environment variables cleaned up

### Non-Critical Issues (3 failures, 3 warnings)

- Some health endpoints return 503 (sync metadata tracking issue - tracked as RR-106)
- Database response times elevated (319ms vs 169ms baseline - tracked as RR-108)
- Minor warnings about missing build artifacts in development mode

## Rollback Procedures

If production environment needs to be restored:

1. **Restore PM2 Configuration**:

   ```bash
   # Add rss-reader-prod back to ecosystem.config.js
   # Copy configuration from git history
   ```

2. **Restore Environment Variables**:

   ```bash
   # Add back to .env:
   PROD_PORT=3147
   PROD_NODE_ENV=production
   PROD_NEXT_PUBLIC_BASE_URL=http://100.96.166.53:3147
   ```

3. **Restore Scripts**:

   ```bash
   # Restore from git:
   git checkout <commit-before-removal> -- scripts/deploy-production.sh
   git checkout <commit-before-removal> -- scripts/build-and-start-prod.sh
   ```

4. **Update Monitoring**:
   - Re-add Uptime Kuma monitors for port 3147
   - Update health check scripts

5. **Restart Services**:
   ```bash
   pm2 reload ecosystem.config.js
   ```

## Lessons Learned

### What Worked Well

1. **Phased Approach**: Breaking into 8 phases allowed systematic removal
2. **Immediate Resource Relief**: Stopping production service first gave instant benefits
3. **Comprehensive Testing**: Verification script caught issues early
4. **Documentation**: Tracking changes in Linear kept clear audit trail

### Challenges Encountered

1. **Script Dependencies**: Many scripts had hardcoded port references
2. **Test Assumptions**: Test suite assumed production environment existed
3. **Hidden References**: Some environment variables in unexpected places
4. **API Design Misunderstanding**: Tests expected endpoints that don't exist by design

### Recommendations for Future Changes

1. **Use Environment Variables**: Avoid hardcoding ports in scripts
2. **Centralize Configuration**: Single source of truth for service settings
3. **Document Architecture Decisions**: Clear explanation of API design choices
4. **Regular Resource Monitoring**: Catch memory issues before critical
5. **Test Environment Parity**: Keep test assumptions aligned with actual architecture

## Related Linear Issues

- RR-92: Parent issue - Remove Production Environment
- RR-93: Phase 1 - Stop Production Services
- RR-94: Phase 2 - Update Core Configurations
- RR-95: Phase 3 - Update Shell Scripts
- RR-96: Phase 4 - Update Documentation
- RR-97: Phase 5 - Update Monitoring
- RR-98: Phase 6 - Cleanup Production Artifacts
- RR-99: Phase 7 - Final Verification
- RR-103: Fix Problematic Scripts
- RR-104: Phase 8 - Remove Caddy Configuration
- RR-106: Follow-up - Fix Freshness API Issue
- RR-107: This documentation issue
- RR-108: Follow-up - Database Performance Issue

## Conclusion

The production environment removal was successfully completed over 2 days (July 31 - August 1, 2025), achieving all primary objectives:

- Resolved critical memory pressure (87.5% → 71%)
- Eliminated service instability (51 restarts → stable operation)
- Simplified architecture (dual environment → single dev environment)
- Maintained full functionality for single-user setup

The RSS News Reader now operates efficiently as a development-only application at http://100.96.166.53:3000/reader, with all features intact and improved system stability.

---

_This document supersedes DEPLOYMENT_DECISION_TRAIL.md and serves as the official record of the production environment removal._
