# RR-67: Database Security Fixes - Test Contracts Report

## Overview

This document provides the comprehensive test contracts for RR-67, which addresses 11 database security vulnerabilities identified by Supabase security advisors. These contracts define the exact behavior expected after implementation and serve as the specification that the implementation must conform to.

## Test Contract Files

### 1. Contract Definitions

**File**: `/src/__tests__/contracts/rr-67-security-fixes.contract.ts`

This file contains all test contracts organized into 7 sections:

- View Behavior Contracts
- Function Behavior Contracts
- Security Validation Contracts
- State Transition Contracts
- Integration Test Contracts
- Acceptance Criteria Validation
- Test Execution Plan

### 2. Integration Tests

**File**: `/src/__tests__/integration/rr-67-security-fixes.test.ts`

Integration tests that validate the implementation against the contracts:

- View security tests (SECURITY DEFINER removal)
- Function security tests (search_path validation)
- Security advisor validation
- Acceptance criteria validation
- End-to-end integration tests

### 3. Unit Tests

**File**: `/src/__tests__/unit/rr-67-security-validation.test.ts`

Unit tests that validate individual components without database connection:

- Contract structure validation
- Security specification tests
- Migration safety checks
- SQL generation validation

## Security Issues Being Fixed

### Critical (ERROR level) - 4 Views

1. **sync_queue_stats** - Sync monitoring view
2. **author_quality_report** - Author coverage analysis
3. **author_statistics** - Author metrics view
4. **sync_author_health** - Sync health monitoring

**Fix**: Convert from SECURITY DEFINER to SECURITY INVOKER

### High Priority (WARN level) - 7 Functions

1. **get_unread_counts_by_feed** - Core unread count functionality
2. **get_articles_optimized** - Main article fetching
3. **refresh_feed_stats** - Post-sync statistics update
4. **add_to_sync_queue** - Bi-directional sync operations
5. **update_updated_at_column** - Timestamp trigger
6. **increment_api_usage** - API call tracking
7. **cleanup_old_sync_queue_entries** - Queue maintenance

**Fix**: Add `SET search_path = public` to prevent schema hijacking

## Test Execution Strategy

### Phase 1: Pre-Migration Baseline

- Capture current security advisor report
- Document existing view security modes
- Record function search_path status
- Baseline performance metrics

### Phase 2: Migration Execution

- Run migration script
- Verify no errors during execution
- Check migration completes successfully

### Phase 3: Post-Migration Validation

- Verify all views converted to SECURITY INVOKER
- Confirm all functions have search_path
- Run security advisor - verify 0 errors
- Check warning count reduced to ~13

### Phase 4: Functional Testing

- Test article fetching
- Test sync operations
- Test monitoring views with different users
- Verify RLS enforcement

### Phase 5: Security Testing

- Attempt schema hijacking - should fail
- Test privilege escalation - should fail
- Verify data isolation between users

### Phase 6: Integration Testing

- Full sync cycle test
- API usage tracking test
- Feed statistics refresh test
- End-to-end user flow test

## Acceptance Criteria

### Required (Must Pass)

- **AC-1**: All 4 SECURITY DEFINER views converted to SECURITY INVOKER
- **AC-2**: All 7 critical functions have search_path set to public
- **AC-3**: Security advisor shows 0 ERROR level issues
- **AC-4**: 46% reduction in total security warnings achieved
- **AC-5**: All existing functionality continues to work

### Optional (Nice to Have)

- **OPT-1**: Performance remains within 5% of baseline
- **OPT-2**: Migration completes in under 1 second

## Test Commands

```bash
# Run unit tests only
npx vitest run src/__tests__/unit/rr-67-security-validation.test.ts

# Run integration tests (requires database)
npx vitest run src/__tests__/integration/rr-67-security-fixes.test.ts

# Run all RR-67 tests
npx vitest run --grep "RR-67"

# Run with coverage
npx vitest run --coverage --grep "RR-67"
```

## Expected Outcomes

### Security Improvements

- **Before**: 4 ERROR + 20 WARN = 24 total issues
- **After**: 0 ERROR + 13 WARN = 13 total issues
- **Reduction**: 46% improvement in security posture

### View Behavior Changes

- Views now respect Row Level Security (RLS)
- Users only see data they have access to
- No privilege escalation possible through views

### Function Security

- Functions protected from schema hijacking
- Always use public schema regardless of search_path manipulation
- Consistent and predictable behavior

## Test Coverage Requirements

### Critical Paths (100% coverage required)

1. Sync pipeline operations
2. Article fetching and reading
3. API usage tracking
4. Feed statistics updates

### Secondary Paths (80% coverage target)

1. Monitoring dashboards
2. Author statistics
3. Queue maintenance

## Failure Criteria

### Immediate Failures (Stop testing)

- Any view still has SECURITY DEFINER
- Any critical function lacks search_path
- Security advisor shows ERROR level issues
- Core functionality broken

### Investigation Required

- Performance degradation > 10%
- Unexpected warning in security advisor
- RLS behavior changes unexpectedly

## Test Data Requirements

### Minimum Test Data

- At least 1 user with authentication
- At least 10 feeds with articles
- Some sync queue entries
- API usage records

### Test User Contexts

1. **Service Role**: Full database access
2. **Authenticated User**: Normal user with RLS
3. **Anonymous**: No authentication

## Helper Functions Required

The following helper RPC functions need to be created in the test database:

```sql
-- Check view security modes
CREATE OR REPLACE FUNCTION get_view_security_modes()
RETURNS TABLE(viewname text, definition text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT viewname, definition
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname IN ('sync_queue_stats', 'author_quality_report', 'author_statistics', 'sync_author_health');
$$;

-- Check function search paths
CREATE OR REPLACE FUNCTION check_function_search_paths(function_names text[])
RETURNS TABLE(function_name text, has_search_path boolean, search_path text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.proname as function_name,
    p.proconfig IS NOT NULL as has_search_path,
    p.proconfig::text as search_path
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.proname = ANY(function_names);
$$;
```

## Implementation Notes

1. **Tests are the Specification**: These tests define the expected behavior. The implementation must pass all tests without modifying the tests themselves.

2. **Security First**: All security validations must pass before considering the implementation complete.

3. **No Regression**: Existing functionality must continue to work after the security fixes.

4. **Performance**: While security is the priority, performance should not degrade significantly (< 5% acceptable).

## Conclusion

These test contracts provide a comprehensive specification for fixing the database security vulnerabilities in RR-67. The implementation must:

1. Convert 4 views from SECURITY DEFINER to SECURITY INVOKER
2. Add search_path to 7 critical functions
3. Achieve 0 ERROR level security issues
4. Reduce total warnings by 46%
5. Maintain all existing functionality

The tests validate both the security improvements and the preservation of functionality, ensuring a safe and effective migration.
