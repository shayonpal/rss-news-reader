# RR-171 Test Specification Report

## Issue Summary

**Linear Issue RR-171**: Sidebar counts/tags not refreshing after manual sync

**Problem**: After manual sync, new articles and article_tags are present in DB, but sidebar doesn't update unread counts or show newly available tags.

## Test Suite Overview

This comprehensive test suite defines the specification for implementing the sidebar refresh functionality. The implementation MUST conform to these tests - they are the contract.

### Test Files Created

1. **`rr-171-refresh-manager.test.ts`** (30 tests)
   - Core refresh operations coordination
   - Manual vs background sync behavior
   - State management and error handling
   - Concurrency control

2. **`rr-171-sync-api.test.ts`** (24 tests)
   - API endpoint response contract
   - Sync metrics structure
   - Success/partial/failure status handling
   - Concurrent sync prevention

3. **`rr-171-store-refresh.test.ts`** (16 tests)
   - Feed store refresh operations
   - Article store refresh operations
   - Tag store refresh operations
   - Cross-store coordination

4. **`rr-171-toast-notifications.test.ts`** (29 tests)
   - Success notification patterns (NO emojis)
   - Error and partial sync messages
   - Background sync info toasts
   - Message format consistency

5. **`rr-171-skeleton-states.test.ts`** (19 tests)
   - Manual sync skeleton behavior
   - Background sync (no skeletons)
   - Component-specific skeleton control
   - Performance optimizations

6. **`rr-171-rr27-compatibility.test.ts`** (20 tests)
   - Preserves 2-second auto-mark delay
   - Refresh doesn't interfere with timers
   - Feed switch behavior maintained
   - Session state preservation

## Key Implementation Requirements

### 1. RefreshManager Class

```typescript
class RefreshManager {
  // Coordinates all refresh operations
  refreshAll(): Promise<void>;
  handleManualSync(): Promise<SyncResult>;
  handleBackgroundSync(): Promise<SyncResult>;
}
```

### 2. Sync API Response

```json
{
  "syncId": "uuid",
  "status": "completed|partial|failed",
  "metrics": {
    "newArticles": 10,
    "deletedArticles": 5,
    "newTags": 2,
    "failedFeeds": 0
  }
}
```

### 3. Toast Messages (NO EMOJIS)

- Success: `"Sync complete • 10 new articles • 5 removed"`
- No changes: `"Already up to date"`
- Error: `"Sync failed • Check your connection"`
- Partial: `"Partial sync • 7 of 10 feeds updated"`
- Background: `"3 new articles available"` (info toast only)

### 4. Skeleton Behavior

- **Manual Sync**: Show skeletons on all components
- **Background Sync**: NO skeletons, silent data update
- **Error**: Hide skeletons immediately

### 5. RR-27 Compatibility

- 2-second auto-mark timer MUST NOT be affected by refresh
- Feed switch still cancels auto-mark
- Article selection behavior unchanged
- Session read state preserved

## Test Execution Summary

Total tests created: **138 tests** across 6 files

### Test Coverage Areas:

- ✅ Refresh coordination logic
- ✅ API response contracts
- ✅ Store update mechanisms
- ✅ Toast notification patterns
- ✅ Skeleton loading states
- ✅ RR-27 feature preservation
- ✅ Error handling
- ✅ Concurrency control
- ✅ Performance optimizations

## Implementation Guidance

### Critical Success Criteria:

1. **Data Refresh**: All stores (feeds, articles, tags) must refresh after manual sync
2. **User Feedback**: Clear toast notifications with sync metrics
3. **Visual Stability**: Skeletons for manual sync, no jarring refresh for background
4. **Feature Preservation**: RR-27 auto-mark functionality must work unchanged
5. **Error Resilience**: Graceful handling of partial failures

### Architecture Pattern:

```
User triggers sync → RefreshManager
                    ├─→ Show skeletons (manual only)
                    ├─→ Call /api/sync
                    ├─→ Get metrics response
                    ├─→ Refresh all stores in parallel
                    ├─→ Hide skeletons
                    └─→ Show toast with metrics
```

## Testing Commands

```bash
# Run all RR-171 tests
npx vitest run src/__tests__/contracts/rr-171-*.test.ts

# Run with coverage
npx vitest run --coverage src/__tests__/contracts/rr-171-*.test.ts

# Watch mode for development
npx vitest watch src/__tests__/contracts/rr-171-*.test.ts
```

## Notes for Implementation Team

1. **Tests are the specification** - Do not modify tests to match implementation
2. **All 138 tests must pass** before considering the feature complete
3. **Toast messages must exactly match** the patterns (no emojis!)
4. **RR-27 compatibility is critical** - regression here affects core UX
5. **Background sync must be invisible** - no UI disruption

## Acceptance Criteria Validation

From Linear Issue RR-171:

- [x] Sidebar unread counts refresh after manual sync
- [x] New tags appear after sync completes
- [x] Toast notifications show sync results
- [x] No jarring UI refresh (skeleton states)
- [x] Background sync doesn't disrupt user
- [x] RR-27 auto-mark feature still works

## Files Generated

- `/src/__tests__/contracts/rr-171-refresh-manager.test.ts`
- `/src/__tests__/contracts/rr-171-sync-api.test.ts`
- `/src/__tests__/contracts/rr-171-store-refresh.test.ts`
- `/src/__tests__/contracts/rr-171-toast-notifications.test.ts`
- `/src/__tests__/contracts/rr-171-skeleton-states.test.ts`
- `/src/__tests__/contracts/rr-171-rr27-compatibility.test.ts`

These tests define the complete specification for RR-171 implementation.
