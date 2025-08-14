# RR-106: Manual Testing Procedures for Freshness API Removal

## Overview

This document provides step-by-step manual testing procedures for the complete removal of the Freshness API (`/api/health/freshness`) and consolidation of monitoring systems.

## Pre-Removal Baseline Testing

### 1. Service Health Verification

**Objective**: Establish baseline service health before making changes.

**Steps**:

1. Execute monitoring dashboard:

   ```bash
   cd /Users/shayon/DevProjects/rss-news-reader
   ./scripts/monitor-dashboard.sh
   ```

2. Verify all services show green status:
   - ✅ App: Healthy
   - ✅ Sync Server: Healthy
   - ✅ Database: Healthy
   - ✅ PM2 processes: Online
   - ✅ Last Sync: Recent (< 5 hours)
   - ✅ Article Freshness: Working

3. Document any existing issues in baseline state.

**Expected Results**:

- Monitor dashboard completes without critical errors
- Freshness API returns valid response (200 or 503)
- All other health endpoints functional

### 2. Endpoint Accessibility Test

**Steps**:

1. Test all health endpoints manually:

   ```bash
   # App health
   curl -s http://100.96.166.53:3000/reader/api/health/app | jq .

   # Database health
   curl -s http://100.96.166.53:3000/reader/api/health/db | jq .

   # Cron health
   curl -s http://100.96.166.53:3000/reader/api/health/cron | jq .

   # Freshness (currently working)
   curl -s http://100.96.166.53:3000/reader/api/health/freshness | jq .

   # Sync server health
   curl -s http://localhost:3001/server/health | jq .
   ```

2. Document response status and key fields for each endpoint.

**Expected Results**:

- All endpoints return valid JSON responses
- Status codes are 200 (healthy) or 503 (degraded)
- Response structures include `status` and `timestamp` fields

### 3. Monitoring Integration Test

**Steps**:

1. Check Uptime Kuma monitors:
   - Access http://localhost:3080
   - Verify "RSS Reader - Article Freshness" monitor exists and is functional
   - Note current status and response times

2. Verify monitoring scripts work:

   ```bash
   # Test sync health monitor
   ./scripts/sync-health-monitor.sh --check

   # Test build validation
   ./scripts/validate-build.sh --mode quick
   ```

**Expected Results**:

- Uptime Kuma shows freshness monitor as operational
- Monitoring scripts complete without errors
- Scripts include freshness endpoint checks

## Phase-by-Phase Removal Testing

### Phase 1: API Route File Removal

**After removing** `src/app/api/health/freshness/route.ts`:

**Steps**:

1. Verify route file is deleted:

   ```bash
   ls -la src/app/api/health/freshness/
   # Should return "No such file or directory"
   ```

2. Test endpoint accessibility:

   ```bash
   curl -s http://100.96.166.53:3000/reader/api/health/freshness
   # Should return 404 or connection error
   ```

3. Verify other endpoints still work:

   ```bash
   curl -s http://100.96.166.53:3000/reader/api/health/app | jq .status
   curl -s http://100.96.166.53:3000/reader/api/health/db | jq .status
   ```

4. Check application still loads:
   - Open http://100.96.166.53:3000/reader in browser
   - Verify no JavaScript errors in console
   - Confirm article list loads (if data available)

**Expected Results**:

- Freshness endpoint returns 404
- Other health endpoints remain functional
- Main application loads without errors

### Phase 2: Unit Test Cleanup

**After removing** `src/__tests__/unit/health-endpoints/freshness.test.ts`:

**Steps**:

1. Verify test file is deleted:

   ```bash
   ls -la src/__tests__/unit/health-endpoints/freshness.test.ts
   # Should return "No such file or directory"
   ```

2. Run unit test suite:

   ```bash
   npm run test:unit
   ```

3. Verify no failing tests due to missing freshness tests.

**Expected Results**:

- Unit test suite passes
- No references to deleted freshness test file
- Coverage reports don't include freshness API

### Phase 3: Integration Test Updates

**After updating integration test files**:

**Steps**:

1. Run integration test suite:

   ```bash
   npm run test:integration
   ```

2. Verify specific test files no longer reference freshness:

   ```bash
   grep -r "freshness" src/__tests__/integration/ || echo "No freshness references found"
   ```

3. Check that modified test files still pass:
   - `health-endpoints.test.ts`
   - `rr-119-acceptance.test.ts`
   - `rr-121-test-server-integration.test.ts`
   - `rr-121-acceptance-criteria.test.ts`
   - `rr-71-api-routes.test.ts`

**Expected Results**:

- Integration tests pass without freshness endpoint tests
- No broken test references
- Test coverage remains adequate for remaining endpoints

### Phase 4: Monitoring Script Updates

**After updating monitoring scripts**:

**Steps**:

1. Test updated monitor dashboard:

   ```bash
   ./scripts/monitor-dashboard.sh
   ```

2. Verify output no longer includes freshness checks:
   - Should not show "Article Freshness" section
   - Should still show other health checks
   - Should complete without errors

3. Test sync health monitor:

   ```bash
   ./scripts/sync-health-monitor.sh --check
   ```

4. Test build validation:

   ```bash
   ./scripts/validate-build.sh --mode quick
   ```

5. Check setup-sync-monitors.js output:
   ```bash
   node scripts/setup-sync-monitors.js
   ```

**Expected Results**:

- Monitor dashboard works without freshness section
- Other monitoring functions remain intact
- Build validation passes
- Uptime Kuma configuration excludes freshness monitor

### Phase 5: Uptime Kuma Monitor Updates

**After removing freshness monitor from Uptime Kuma**:

**Steps**:

1. Access Uptime Kuma dashboard: http://localhost:3080

2. Verify "RSS Reader - Article Freshness" monitor is removed or disabled

3. Confirm other monitors still function:
   - RSS Reader - App Health
   - RSS Reader - Database Health
   - RSS Reader - Cron Health
   - RSS Reader - Sync API Endpoint

4. Test alert functionality with remaining monitors

**Expected Results**:

- Freshness monitor removed from Uptime Kuma
- Other monitors continue working
- Alert notifications still functional

## Post-Removal Comprehensive Testing

### 1. Full System Health Check

**Steps**:

1. Run complete monitoring dashboard:

   ```bash
   ./scripts/monitor-dashboard.sh
   ```

2. Verify all sections work without freshness:
   - Service Health: ✅ All green
   - PM2 Processes: ✅ All online
   - Sync Health: ✅ Recent sync success
   - Monitoring Services: ✅ All running
   - Recent Alerts: No freshness-related errors

3. Check service logs for errors:
   ```bash
   pm2 logs rss-reader-dev --lines 20
   pm2 logs rss-sync-server --lines 20
   ```

**Expected Results**:

- Monitor dashboard completes successfully
- No freshness-related errors in output
- All other monitoring functions work normally

### 2. Application Functionality Test

**Steps**:

1. Load main application: http://100.96.166.53:3000/reader

2. Test core functionality:
   - Article list loads
   - Navigation works
   - No console errors
   - Page performance acceptable

3. Test sync functionality:

   ```bash
   curl -X POST http://100.96.166.53:3000/reader/api/sync
   ```

4. Verify health endpoints:
   ```bash
   curl http://100.96.166.53:3000/reader/api/health/app | jq .status
   curl http://100.96.166.53:3000/reader/api/health/db | jq .status
   curl http://100.96.166.53:3000/reader/api/health/cron | jq .status
   ```

**Expected Results**:

- Application loads and functions normally
- Core features work without freshness dependency
- Health endpoints provide adequate monitoring coverage

### 3. Test Suite Execution

**Steps**:

1. Run complete test suite:

   ```bash
   npm run test
   ```

2. Run pre-commit checks:

   ```bash
   npm run pre-commit
   ```

3. Verify build process:

   ```bash
   npm run build
   ```

4. Check test coverage reports for completeness

**Expected Results**:

- All tests pass
- Pre-commit checks succeed
- Build completes successfully
- Test coverage remains adequate

### 4. Performance and Stability Test

**Steps**:

1. Monitor system resources during operation:

   ```bash
   pm2 monit
   ```

2. Load test application with multiple page visits

3. Check for memory leaks or performance degradation

4. Verify sync process continues working:
   ```bash
   tail -f logs/sync-cron.jsonl | jq .
   ```

**Expected Results**:

- System performance unchanged
- No memory leaks detected
- Sync process continues normally
- Resource usage remains stable

## Regression Testing

### 1. Core Feature Verification

**Test Article Reading Flow**:

1. Load application
2. Navigate to article (if available)
3. Mark as read/unread
4. Star/unstar article
5. Verify changes persist

**Test Sync Process**:

1. Trigger manual sync
2. Verify sync completes successfully
3. Check sync logs for errors
4. Confirm article data updates

**Test Monitoring**:

1. Check all remaining health endpoints
2. Verify monitoring alerts work
3. Test PM2 service management
4. Confirm log generation continues

### 2. Integration Point Testing

**Database Operations**:

- Verify article queries work
- Check sync metadata updates
- Confirm RLS policies function
- Test materialized view refresh

**API Endpoints**:

- Health endpoints respond correctly
- Sync API functions properly
- Error handling works
- Rate limiting active

**Monitoring Systems**:

- Uptime Kuma monitors function
- Discord alerts work
- Log rotation operates
- Service recovery functions

## Rollback Testing Procedures

### Emergency Rollback Verification

**If rollback is needed**:

1. **Restore freshness API file**:

   ```bash
   git checkout HEAD~1 -- src/app/api/health/freshness/route.ts
   ```

2. **Verify endpoint works**:

   ```bash
   curl http://100.96.166.53:3000/reader/api/health/freshness | jq .
   ```

3. **Restore monitoring scripts**:

   ```bash
   git checkout HEAD~1 -- scripts/monitor-dashboard.sh
   git checkout HEAD~1 -- scripts/setup-sync-monitors.js
   ```

4. **Test complete system**:

   ```bash
   ./scripts/monitor-dashboard.sh
   npm run test
   ```

5. **Update Uptime Kuma**:
   - Re-add freshness monitor
   - Verify alerts function

6. **Verify rollback success**:
   - All endpoints functional
   - Monitoring works completely
   - Tests pass
   - No new errors introduced

## Acceptance Criteria Verification

### Final Checklist

- [ ] Freshness API endpoint returns 404
- [ ] All other health endpoints functional
- [ ] Monitor dashboard works without freshness
- [ ] Uptime Kuma monitors updated
- [ ] Test suite passes completely
- [ ] Application performance unchanged
- [ ] No monitoring disruption
- [ ] Sync process continues normally
- [ ] Documentation updated
- [ ] Rollback procedures verified

### Success Criteria

1. **Functional**: System operates normally without freshness API
2. **Monitoring**: Adequate monitoring coverage remains
3. **Performance**: No performance degradation
4. **Stability**: No new errors or instability
5. **Maintainability**: Simplified monitoring architecture
6. **Testability**: Comprehensive test coverage maintained

## Troubleshooting Guide

### Common Issues and Solutions

**Issue**: Monitor dashboard fails after removal

- **Solution**: Check script syntax, verify remaining endpoints work
- **Rollback**: Restore monitoring scripts if critical

**Issue**: Uptime Kuma shows errors

- **Solution**: Remove/disable freshness monitor, verify other monitors
- **Mitigation**: Use remaining health endpoints for monitoring

**Issue**: Test suite failures

- **Solution**: Check for remaining freshness references, update tests
- **Verification**: Run individual test files to isolate issues

**Issue**: Application errors

- **Solution**: Check console logs, verify no freshness dependencies
- **Safety**: Core app should not depend on freshness API

### Emergency Contacts

- **Primary**: Manual verification by developer
- **Escalation**: Rollback procedures documented above
- **Monitoring**: Uptime Kuma + Discord alerts for critical issues

---

**Note**: This document should be followed step-by-step during the removal process to ensure comprehensive testing and successful implementation of RR-106.
