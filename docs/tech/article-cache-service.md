# ArticleCacheService Pattern

## Overview

The ArticleCacheService is a centralized service for managing ArticleCountManager cache invalidation across multiple React components. This service pattern replaces the global `(window as any).__articleCountManager` anti-pattern with a clean, type-safe, service-based architecture that eliminates coupling and race conditions.

**Issue Solved (RR-258)**: The mark-all-read button state was not updating correctly because cache invalidation was inconsistent across components using different ArticleCountManager instances.

## Problem Solved

### Before: Global Window Pattern Issues

```typescript
// Anti-pattern: Global window coupling
const manager = (window as any).__articleCountManager as ArticleCountManager;
if (manager) {
  manager.invalidateCache(feedId);
}
```

**Problems with this approach:**

- **Tight Coupling**: Components directly depended on global window state
- **Race Conditions**: Manager might not be available when accessed
- **Type Safety**: Required unsafe type casting with `any`
- **Testing Complexity**: Global state made unit testing difficult
- **Memory Leaks**: No cleanup mechanism for component unmounting
- **Cache Inconsistency**: Different components might miss invalidation calls

### After: Service-Based Registration

```typescript
// Clean pattern: Service registration
articleCacheService.register(countManager.current);
// Automatic coordination across all registered managers
articleCacheService.invalidateCache(feedId);
```

**Benefits of the service approach:**

- **Decoupled Architecture**: Components register their managers, no global dependency
- **Error Isolation**: One failing manager doesn't block others
- **Type Safety**: Full TypeScript support without casting
- **Easy Testing**: Service can be reset and mocked cleanly
- **Proper Cleanup**: Automatic unregistration on component unmount
- **Coordinated Invalidation**: All managers receive cache invalidation signals

## Architecture

### Service Class Structure

```typescript
class ArticleCacheService {
  private managers = new Set<ArticleCountManager>();

  register(manager: ArticleCountManager) {
    this.managers.add(manager);
  }

  unregister(manager: ArticleCountManager) {
    this.managers.delete(manager);
  }

  invalidateCache(feedId?: string) {
    for (const manager of this.managers) {
      try {
        manager.invalidateCache(feedId);
      } catch (error) {
        console.warn("Manager invalidation failed:", error);
        // Don't let one faulty manager block others
      }
    }
  }

  /** Reset all managers. Used for testing. */
  reset() {
    this.managers.clear();
  }
}
```

### Key Design Principles

1. **Set-Based Registration**: Uses `Set<ArticleCountManager>` to prevent duplicate registrations
2. **Error Isolation**: Try-catch around each manager prevents cascade failures
3. **Optional Parameters**: `feedId` parameter supports both specific and global cache invalidation
4. **Test Support**: `reset()` method enables clean test state
5. **Singleton Instance**: Exported as `articleCacheService` for global coordination

## Usage Examples

### Component Registration Pattern

```typescript
// In React components (page.tsx, article-header.tsx)
import { articleCacheService } from "@/lib/services/article-cache-service";
import { ArticleCountManager } from "@/lib/article-count-manager";

function MyComponent() {
  const countManager = useRef(new ArticleCountManager());

  // Register with service on mount
  useEffect(() => {
    articleCacheService.register(countManager.current);

    return () => {
      // Clean unregistration on unmount
      articleCacheService.unregister(countManager.current);
    };
  }, []);

  // Use manager normally for fetching counts
  const fetchCounts = async () => {
    const counts = await countManager.current.getArticleCounts(feedId);
    setCounts(counts);
  };
}
```

### Store Integration Pattern

```typescript
// In Zustand stores (article-store.ts)
import { articleCacheService } from "@/lib/services/article-cache-service";

export const useArticleStore = create<ArticleStore>((set, get) => ({
  async markAllAsRead(feedId: string) {
    try {
      // Perform database operations
      await supabase.rpc("mark_feed_articles_read", { feed_id: feedId });

      // Coordinate cache invalidation across all components
      articleCacheService.invalidateCache(feedId);

      // Update local state
      set((state) => ({
        /* updated state */
      }));
    } catch (error) {
      console.error("Mark all as read failed:", error);
    }
  },
}));
```

### Cache Invalidation Scenarios

```typescript
// Specific feed invalidation
articleCacheService.invalidateCache("feed-123");

// Global cache invalidation (all feeds)
articleCacheService.invalidateCache();

// Called from multiple store operations:
// - markAllAsRead(feedId)
// - markAllAsReadForTag(tagId)
// - toggleArticleReadStatus(article)
// - deleteArticle(articleId)
```

## Testing Patterns

### Unit Testing the Service

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { articleCacheService } from "@/lib/services/article-cache-service";

describe("ArticleCacheService", () => {
  let mockManager1: ArticleCountManager;
  let mockManager2: ArticleCountManager;

  beforeEach(() => {
    // Reset service for clean state
    articleCacheService.reset();

    // Create mock managers
    mockManager1 = { invalidateCache: vi.fn() };
    mockManager2 = { invalidateCache: vi.fn() };
  });

  it("should register multiple managers", () => {
    articleCacheService.register(mockManager1);
    articleCacheService.register(mockManager2);

    articleCacheService.invalidateCache("feed-456");

    expect(mockManager1.invalidateCache).toHaveBeenCalledWith("feed-456");
    expect(mockManager2.invalidateCache).toHaveBeenCalledWith("feed-456");
  });

  it("should handle manager errors without blocking others", () => {
    const faultyManager = {
      invalidateCache: vi.fn(() => {
        throw new Error("Mock error");
      }),
    };

    articleCacheService.register(faultyManager);
    articleCacheService.register(mockManager1);

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    articleCacheService.invalidateCache("feed-error-test");

    expect(mockManager1.invalidateCache).toHaveBeenCalled(); // Still called
    expect(consoleSpy).toHaveBeenCalledWith(
      "Manager invalidation failed:",
      expect.any(Error)
    );
  });
});
```

### Integration Testing with Components

```typescript
import { render, screen, userEvent, waitFor } from "@testing-library/react";
import { articleCacheService } from "@/lib/services/article-cache-service";

describe("Component Integration", () => {
  beforeEach(() => {
    articleCacheService.reset(); // Clean state for each test
  });

  it("should coordinate cache invalidation between page and header", async () => {
    const pageManager = { invalidateCache: vi.fn() };
    const headerManager = { invalidateCache: vi.fn() };

    articleCacheService.register(pageManager);
    articleCacheService.register(headerManager);

    // Simulate mark-all-read action
    articleCacheService.invalidateCache("test-feed-id");

    expect(pageManager.invalidateCache).toHaveBeenCalledWith("test-feed-id");
    expect(headerManager.invalidateCache).toHaveBeenCalledWith("test-feed-id");
  });
});
```

### Mock Service for Component Tests

```typescript
// For testing components in isolation
vi.mock("@/lib/services/article-cache-service", () => ({
  articleCacheService: {
    register: vi.fn(),
    unregister: vi.fn(),
    invalidateCache: vi.fn(),
    reset: vi.fn(),
  },
}));
```

## Migration Guide

### Step 1: Replace Global Window Usage

**Before:**

```typescript
// OLD: Global window pattern
useEffect(() => {
  const manager = (window as any).__articleCountManager as ArticleCountManager;
  if (manager) {
    manager.invalidateCache(feedId);
  }
}, [feedId]);
```

**After:**

```typescript
// NEW: Service registration pattern
const countManager = useRef(new ArticleCountManager());

useEffect(() => {
  articleCacheService.register(countManager.current);
  return () => articleCacheService.unregister(countManager.current);
}, []);
```

### Step 2: Update Store Operations

**Before:**

```typescript
// OLD: Manual manager coordination
async markAllAsRead(feedId: string) {
  await performDatabaseOperation();

  // Had to manually find and coordinate managers
  const manager = (window as any).__articleCountManager;
  if (manager) manager.invalidateCache(feedId);
}
```

**After:**

```typescript
// NEW: Service-coordinated invalidation
async markAllAsRead(feedId: string) {
  await performDatabaseOperation();

  // Automatically coordinates all registered managers
  articleCacheService.invalidateCache(feedId);
}
```

### Step 3: Update Test Setup

**Before:**

```typescript
// OLD: Global state cleanup was complex
beforeEach(() => {
  delete (window as any).__articleCountManager;
});
```

**After:**

```typescript
// NEW: Clean service reset
beforeEach(() => {
  articleCacheService.reset();
});
```

## Implementation Details

### Service Instantiation

```typescript
// src/lib/services/article-cache-service.ts
class ArticleCacheService {
  // Implementation details...
}

// Singleton instance for global coordination
export const articleCacheService = new ArticleCacheService();
```

### Component Integration Points

**Current Usage Locations:**

- `src/app/page.tsx` - Main page mark-all-read functionality
- `src/components/articles/article-header.tsx` - Header count display
- `src/lib/stores/article-store.ts` - Store operations (5 integration points)

**Store Integration Points:**

```typescript
// All store operations that modify article read status
await markAllAsRead(feedId: string)          // Line 831
await markAllAsReadForTag(tagId: string)     // Line 819
await toggleArticleReadStatus(article)       // Line 900
await deleteArticle(articleId: string)       // Line 1221
await updateArticleReadStatus(articleId)     // Line 1404
```

### Memory Management

The service uses JavaScript's `Set` data structure which automatically handles:

- **Duplicate Prevention**: Same manager instance registered multiple times = single entry
- **Efficient Cleanup**: O(1) unregistration performance
- **Memory Safety**: No references held after unregistration

### Error Handling Strategy

```typescript
invalidateCache(feedId?: string) {
  for (const manager of this.managers) {
    try {
      manager.invalidateCache(feedId);
    } catch (error) {
      console.warn('Manager invalidation failed:', error);
      // Continue with other managers - don't let one failure cascade
    }
  }
}
```

**Error Isolation Benefits:**

- One failing manager doesn't prevent others from updating
- Non-blocking operation ensures UI remains responsive
- Warning logged for debugging while maintaining functionality
- Graceful degradation for edge cases

## Related Patterns

### RR-157: Optimistic Updates

The ArticleCacheService integrates with optimistic update patterns by ensuring cache invalidation occurs immediately after optimistic state changes, maintaining UI consistency.

```typescript
// Optimistic update followed by cache coordination
const toggleReadStatus = async (article: Article) => {
  // 1. Optimistic UI update
  updateLocalState(article);

  // 2. Database operation
  await updateDatabase(article);

  // 3. Cache invalidation via service
  articleCacheService.invalidateCache(article.feedId);
};
```

### State Management Integration

Works seamlessly with Zustand stores to coordinate cache invalidation across:

- Article store operations
- Feed count updates
- Tag-based filtering
- Read status filtering

### Component Lifecycle Integration

Follows React's component lifecycle:

- **Mount**: Register manager with service
- **Update**: Use manager for data fetching
- **Unmount**: Unregister manager for cleanup

## Performance Considerations

### Cache Coordination Overhead

- **Registration**: O(1) per component mount
- **Invalidation**: O(n) where n = number of registered managers
- **Typical Usage**: 2-3 managers (page + header + potential modals)
- **Memory**: Minimal - only holds references to existing manager instances

### When to Use This Pattern

**Good Fit:**

- Cross-component cache coordination
- Centralized state invalidation
- Service-based architecture
- Multiple manager instances

**Not Needed:**

- Single component cache management
- Direct parent-child prop passing
- Simple state that doesn't require coordination

## Testing Coverage

**Unit Tests**: `src/__tests__/unit/rr-258-article-cache-service.test.ts`

- Manager registration/unregistration
- Cache invalidation coordination
- Error isolation testing
- Test utility validation

**Integration Tests**: `src/__tests__/integration/rr-258-mark-all-read-button-state.test.tsx`

- Complete mark-all-read flow
- Button state transitions
- Multi-component coordination
- Component lifecycle testing

**RR-258 Acceptance Criteria Coverage:**

- ✅ AC1: Button state transitions correctly
- ✅ AC2: Cache invalidation on markAllAsRead()
- ✅ AC3: Count refresh after operations
- ✅ AC4: Global window pattern eliminated
- ✅ AC5: Multi-component service registration

This pattern serves as the standard approach for cache coordination in the RSS News Reader codebase, providing a robust foundation for managing distributed cache invalidation across React components.
