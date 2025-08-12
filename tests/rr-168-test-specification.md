# RR-168 Test Specification: Remove Auto-cleanup of Fetched Full Content

## Overview

This document defines the comprehensive test specification for RR-168, which requires removing ALL automatic cleanup mechanisms for article.full_content fields in the RSS News Reader application.

## Test Philosophy

These tests follow Test-Driven Development (TDD) principles:

- Tests are written BEFORE implementation
- Tests define the specification - implementation must conform
- Tests should NOT be modified to match implementation
- If tests fail, fix the code, not the tests

## Test Contracts

### 1. File System Contracts

**Requirement**: No cleanup-related files should exist

| File/Path                           | Expected State                           | Verification Method              |
| ----------------------------------- | ---------------------------------------- | -------------------------------- |
| `scripts/cleanup-parsed-content.js` | MUST NOT EXIST                           | `fs.existsSync()` returns false  |
| `docs/tech/cleanup-architecture.md` | MUST NOT EXIST                           | `fs.existsSync()` returns false  |
| Any file with "cleanup" in name     | Should not contain content cleanup logic | Pattern matching in file content |

### 2. PM2 Configuration Contracts

**Requirement**: No cleanup processes in PM2 ecosystem

| Configuration             | Expected State                              | Test Coverage                |
| ------------------------- | ------------------------------------------- | ---------------------------- |
| `rss-content-cleanup` app | MUST NOT EXIST in ecosystem.config.js       | Parse and verify apps array  |
| Cleanup script references | No PM2 app should reference cleanup scripts | Check all app.script values  |
| Cron schedules            | No cleanup cron schedules                   | Verify cron_restart patterns |

### 3. Service Layer Contracts

**Requirement**: No cleanup methods in services

| Service/Method                              | Expected State               | Test Approach                                |
| ------------------------------------------- | ---------------------------- | -------------------------------------------- |
| `ContentParsingService.cleanupOldContent()` | MUST NOT EXIST               | Parse TypeScript file, verify method absence |
| Retention logic                             | No age-based content nulling | Search for retention patterns                |
| Cutoff date calculations                    | Should not exist             | Pattern match for cutoff/retention variables |

### 4. Database Contracts

**Requirement**: No automatic cleanup at database level

| Database Element                        | Expected State                   | Verification           |
| --------------------------------------- | -------------------------------- | ---------------------- |
| `cleanup_old_parsed_content()` function | MUST NOT EXIST                   | RPC call should fail   |
| Migration to drop function              | Should exist (cleanup migration) | Check migration files  |
| `content_retention_days` config         | MUST NOT EXIST in system_config  | Query returns null     |
| Cleanup triggers                        | No database triggers for cleanup | Verify trigger absence |

### 5. API/Health Endpoint Contracts

**Requirement**: No retention configuration exposed

| Endpoint              | Field            | Expected State          |
| --------------------- | ---------------- | ----------------------- |
| `/api/health/parsing` | `retentionDays`  | MUST NOT be in response |
| `/api/health/app`     | Cleanup metrics  | No cleanup statistics   |
| All health endpoints  | Cleanup schedule | No schedule information |

### 6. Documentation Contracts

**Requirement**: No cleanup references in documentation

| Document       | Expected State                    | Verification         |
| -------------- | --------------------------------- | -------------------- |
| README.md      | No cleanup features mentioned     | Text search          |
| Technical docs | No retention policy documentation | Pattern matching     |
| API docs       | No cleanup endpoint documentation | Content verification |

## Test Scenarios

### Scenario 1: Persistent Content Storage

```typescript
// Given: An article with old parsed content
const article = {
  id: "test-123",
  full_content: "<p>Content</p>",
  parsed_at: "2020-01-01T00:00:00Z", // 4+ years old
  is_read: true,
  is_starred: false,
};

// When: Time passes
// Then: Content should NEVER be automatically removed
// Expected: full_content remains unchanged
```

### Scenario 2: Database Growth Handling

```typescript
// Given: Database with 100,000 articles, 50,000 with full content
// When: Database size exceeds previous "limits"
// Then: No automatic cleanup should trigger
// Expected: All content preserved, no cleanup jobs run
```

### Scenario 3: PM2 Service Verification

```bash
# When: Checking PM2 status
pm2 list

# Then: Output should NOT contain:
# - rss-content-cleanup
# - Any cleanup-related service

# Expected services only:
# - rss-reader-dev
# - rss-sync-cron
# - rss-sync-server
# - rss-services-monitor
# - kuma-push-monitor
```

### Scenario 4: Manual Content Management

```typescript
// User-initiated content removal should still work
// But ONLY through explicit user action, never automatic

// Allowed: User clicks "Remove cached content"
await removeContent(articleId, userId); // Requires user context

// Not Allowed: System automatically removes content
await automaticCleanup(); // This function should not exist
```

## Test Execution Plan

### Phase 1: Pre-Implementation Tests (TDD Red Phase)

1. Run test suite - all tests should FAIL
2. Document failing test output as specification
3. Tests define what needs to be removed/changed

### Phase 2: Implementation

1. Remove `scripts/cleanup-parsed-content.js`
2. Update `ecosystem.config.js` - remove cleanup app
3. Modify `ContentParsingService` - remove cleanup method
4. Create database migration - DROP cleanup function
5. Update health endpoints - remove retention fields
6. Clean documentation - remove cleanup references

### Phase 3: Post-Implementation Verification

1. Run test suite - all tests should PASS
2. No test modifications allowed
3. If tests fail, fix implementation

## Test Commands

```bash
# Run specific test file
npm test src/__tests__/unit/rr-168-remove-auto-cleanup.test.ts

# Run with coverage
npm test -- --coverage src/__tests__/unit/rr-168-remove-auto-cleanup.test.ts

# Watch mode for TDD
npm test -- --watch src/__tests__/unit/rr-168-remove-auto-cleanup.test.ts
```

## Success Criteria

### All Tests Pass

- ✅ 15+ test cases covering all aspects
- ✅ No cleanup code remains
- ✅ System functions without auto-cleanup

### Code Changes Required

1. **DELETE** Files:
   - `scripts/cleanup-parsed-content.js`
   - `docs/tech/cleanup-architecture.md`

2. **MODIFY** Files:
   - `ecosystem.config.js` - Remove `rss-content-cleanup` app
   - `src/lib/services/content-parsing-service.ts` - Remove `cleanupOldContent` method
   - `src/app/api/health/parsing/route.ts` - Remove `retentionDays` field

3. **CREATE** Migration:
   - New migration file to DROP `cleanup_old_parsed_content` function
   - DELETE from system_config WHERE key = 'content_retention_days'

## Risk Assessment

### Low Risk

- Removing unused cleanup code
- No impact on core functionality
- Content remains accessible

### Considerations

- Database size will grow over time
- Manual content management may be needed later
- Monitor storage usage without auto-cleanup

## Rollback Plan

If issues arise:

1. Git revert the commit
2. Restore PM2 configuration
3. Re-run migrations if needed

## Notes for Implementation

### DO NOT:

- Modify these tests to pass
- Leave commented-out cleanup code
- Keep cleanup configuration "just in case"
- Add new cleanup mechanisms

### DO:

- Completely remove all cleanup code
- Update documentation
- Ensure tests pass without modification
- Verify in development environment

## Test Coverage Matrix

| Component          | Test Coverage | Priority |
| ------------------ | ------------- | -------- |
| File removal       | ✅ Complete   | Critical |
| PM2 config         | ✅ Complete   | Critical |
| Service methods    | ✅ Complete   | Critical |
| Database functions | ✅ Complete   | Critical |
| Health endpoints   | ✅ Complete   | High     |
| Documentation      | ✅ Complete   | Medium   |
| Monitoring         | ✅ Complete   | Medium   |
| Error handling     | ✅ Complete   | High     |

## Conclusion

This test specification provides comprehensive coverage for RR-168. The implementation must make ALL tests pass without modifying the test file. The tests serve as the authoritative specification for the feature removal.
