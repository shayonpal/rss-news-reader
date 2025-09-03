# RR-197 localStorage Optimization Test Specification

## Overview

This document summarizes the comprehensive test suite for RR-197 localStorage optimization feature. These tests serve as THE SPECIFICATION for the implementation and were written BEFORE the implementation exists (TDD approach).

## Test Files Created

1. **Unit Tests**: `src/__tests__/unit/rr-197-localstorage-optimization.test.ts`
   - localStorage queue management with FIFO cleanup
   - Performance monitoring utilities
   - localStorage state manager
   - Fallback behavior when localStorage unavailable

2. **Integration Tests**: `src/__tests__/integration/rr-197-article-list-localstorage.test.ts`
   - Article list component integration with localStorage
   - Preserves existing 500ms batching behavior
   - Feed-filtered view updates
   - Offline/online sync scenarios
   - Navigation persistence

3. **Performance Tests**: `src/__tests__/performance/rr-197-performance-metrics.test.ts`
   - 60fps maintenance during rapid marking
   - <1ms UI response time validation
   - Memory stability monitoring
   - Batch processing efficiency

## Test Contracts from Linear (RR-197)

✅ **Performance Requirements**:

- UI response time: <1ms via localStorage
- Database batching: 500ms (unchanged from existing)
- fps_target: 60fps maintained during rapid marking (5+ articles/sec)
- localStorage_capacity: 1000 operations max
- Memory stability during long sessions

✅ **Functional Requirements**:

- Cleanup strategy: FIFO cleanup, clear after successful DB sync
- Fallback behavior: Acceptable to lose operations on localStorage failure
- RR-216 compatibility: Filter state logic unchanged
- Counter accuracy: Final counter reflects correct count after rapid marking session

## Test Scenarios Coverage

### 1. Single Article Marking ✅

- Counter decreases immediately via localStorage
- Operation queued for database sync
- <1ms response time verified

### 2. Rapid Marking (10 articles) ✅

- Counter updates once (debounced)
- All operations queued immediately
- Database batch after 500ms
- 60fps maintained throughout

### 3. Feed-Filtered Views ✅

- Mark articles as read → Feed count in sidebar updates immediately
- Cross-feed marking handled correctly
- Filter state preserved (RR-216 compatibility)

### 4. Offline Marking ✅

- Optimistic update applied
- Operations queued for sync
- Sync triggered when online

### 5. Navigation Persistence ✅

- Navigate away and back → Counts remain accurate
- Article states restored from localStorage
- No data loss on navigation

### 6. localStorage Capacity ✅

- FIFO cleanup at 1000 entries
- Oldest operations removed when full
- Performance maintained at capacity

### 7. Graceful Degradation ✅

- localStorage unavailable → Falls back to existing behavior
- No crashes on localStorage errors
- Direct database updates as fallback

### 8. UI Responsiveness ✅

- Rapid marking session → UI remains responsive
- <1ms average response time
- No UI thread blocking

### 9. Batch Failure Recovery ✅

- Batch operation failure → Rollback capability
- Retry mechanism for failed syncs
- Operations preserved in queue

## Implementation Requirements

The implementation MUST create these modules to pass the tests:

### 1. `@/lib/utils/localstorage-queue`

```typescript
export class LocalStorageQueue {
  static getInstance(): {
    enqueue(operation: any): void;
    dequeue(): any;
    peek(): any;
    size(): number;
    clear(): void;
    getAll(): any[];
    isEmpty(): boolean;
    hasCapacity(): boolean;
  };
}
```

### 2. `@/lib/utils/localstorage-state`

```typescript
export class LocalStorageStateManager {
  static getInstance(): {
    updateArticleState(id: string, state: any): void;
    getArticleState(id: string): any;
    batchUpdateArticleStates(updates: any[]): void;
    getUnreadCount(): number;
    getFeedUnreadCount(feedId: string): number;
    clear(): void;
    syncWithDatabase(): Promise<void>;
  };
}
```

### 3. `@/lib/utils/performance-monitor`

```typescript
export class PerformanceMonitor {
  static getInstance(): {
    startMeasure(name: string): void;
    endMeasure(name: string): number;
    getFPS(): number;
    isMaintenanceFPS(target: number): boolean;
    getAverageResponseTime(): number;
  };
}
```

### 4. `@/lib/utils/localstorage-fallback`

```typescript
export class FallbackHandler {
  static isLocalStorageAvailable(): boolean;
  static handleLocalStorageError(error: Error): void;
  static enableFallbackMode(): void;
  static isInFallbackMode(): boolean;
}
```

## Integration Points

The implementation must integrate with existing code:

1. **article-list.tsx**:
   - Keep existing `markAsReadTimer.current = setTimeout(processPendingMarkAsRead, 500)`
   - Add localStorage updates before database operations
   - Maintain `pendingMarkAsRead` Set behavior

2. **article-store.ts**:
   - Enhance `markMultipleAsRead` function (lines 773-904)
   - Add localStorage state updates
   - Preserve existing trigger logic ("auto" for batch operations)

3. **Database Schema**:
   - Use existing `last_local_update` field for tracking
   - Leverage `sync_queue` table for batching
   - Maintain RLS policies

## Success Criteria

1. **All tests pass** - Tests define the specification
2. **Performance maintained** - 60fps, <1ms UI response
3. **Backward compatible** - Existing 500ms batching preserved
4. **Graceful degradation** - Works without localStorage
5. **Memory efficient** - No leaks, stable during long sessions

## Testing Commands

```bash
# Run all RR-197 tests
npx vitest run src/__tests__/**/rr-197-*.test.ts

# Run with coverage
npx vitest run --coverage src/__tests__/**/rr-197-*.test.ts

# Watch mode for development
npx vitest watch src/__tests__/**/rr-197-*.test.ts
```

## Current Status

✅ **Tests Written** - Comprehensive test suite covering all scenarios
❌ **Tests Passing** - Tests fail as expected (no implementation yet)
⏳ **Implementation** - Waiting for developer to implement based on these specifications

## Notes for Implementation

1. Tests are THE specification - implementation must make these tests pass
2. Do NOT modify tests to match implementation - fix the implementation
3. Use mocked utilities in tests as interface contracts
4. Maintain existing 500ms timer behavior
5. Focus on <1ms UI response time requirement
6. Implement FIFO cleanup at 1000 operations
7. Ensure graceful degradation when localStorage fails
