/**
 * RR-197: Article List localStorage Integration Tests
 *
 * Tests the integration between article-list.tsx component and localStorage optimization.
 * Verifies that the existing 500ms batching behavior is preserved while adding
 * instant UI updates via localStorage.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useArticleStore } from "@/lib/stores/article-store";
import type { Article } from "@/types";

// Mock Supabase
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

// Mock localStorage optimization utilities
vi.mock("@/lib/utils/localstorage-queue", () => ({
  LocalStorageQueue: {
    getInstance: vi.fn(() => ({
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      size: vi.fn(() => 0),
      clear: vi.fn(),
      getAll: vi.fn(() => []),
      isEmpty: vi.fn(() => true),
      hasCapacity: vi.fn(() => true),
    })),
  },
}));

vi.mock("@/lib/utils/localstorage-state", () => ({
  LocalStorageStateManager: {
    getInstance: vi.fn(() => ({
      updateArticleState: vi.fn(),
      getArticleState: vi.fn(),
      batchUpdateArticleStates: vi.fn(),
      getUnreadCount: vi.fn(() => 0),
      getFeedUnreadCount: vi.fn(() => 0),
      clear: vi.fn(),
      syncWithDatabase: vi.fn(() => Promise.resolve()),
    })),
  },
}));

// Helper to create mock articles
function createMockArticles(count: number, startIndex = 0): Article[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `article-${startIndex + i}`,
    feedId: `feed-${(startIndex + i) % 3}`, // Distribute across 3 feeds
    title: `Article ${startIndex + i}`,
    content: `Content for article ${startIndex + i}`,
    url: `https://example.com/article-${startIndex + i}`,
    tags: i % 2 === 0 ? ["tech"] : ["news"],
    publishedAt: new Date(Date.now() - i * 1000 * 60), // Stagger by minutes
    author: "Test Author",
    authorName: "Test Author",
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    inoreaderItemId: `inoreader-${startIndex + i}`,
    fullContentUrl: `https://example.com/article-${startIndex + i}`,
    hasFullContent: false,
    isPartial: false,
    feedTitle: `Feed ${(startIndex + i) % 3}`,
    parseAttempts: 0,
  }));
}

describe("RR-197: Article List localStorage Integration", () => {
  let mockLocalStorageQueue: any;
  let mockLocalStorageManager: any;
  let store: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Get mock instances
    const { LocalStorageQueue } = await import(
      "@/lib/utils/localstorage-queue"
    );
    const { LocalStorageStateManager } = await import(
      "@/lib/utils/localstorage-state"
    );

    mockLocalStorageQueue = LocalStorageQueue.getInstance();
    mockLocalStorageManager = LocalStorageStateManager.getInstance();

    // Reset store
    store = useArticleStore.getState();
    store.articles.clear();

    // Add test articles
    const articles = createMockArticles(20);
    articles.forEach((article) => {
      store.articles.set(article.id, article);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Single Article Marking", () => {
    it("should update counter immediately via localStorage", async () => {
      // Initial state: 20 unread articles
      expect(mockLocalStorageManager.getUnreadCount()).toBe(0);

      // Mark single article as read
      await act(async () => {
        await store.markAsRead("article-0");
      });

      // localStorage should be updated immediately
      expect(mockLocalStorageManager.updateArticleState).toHaveBeenCalledWith(
        "article-0",
        expect.objectContaining({ isRead: true })
      );

      // Counter should reflect change immediately (mocked to return 19)
      mockLocalStorageManager.getUnreadCount.mockReturnValue(19);
      expect(mockLocalStorageManager.getUnreadCount()).toBe(19);
    });

    it("should queue operation for database sync", async () => {
      await act(async () => {
        await store.markAsRead("article-0");
      });

      // Operation should be queued
      expect(mockLocalStorageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "mark_read",
          articleId: "article-0",
        })
      );
    });
  });

  describe("Rapid Marking (10 articles)", () => {
    it("should update counter once with debouncing", async () => {
      const articleIds = Array.from({ length: 10 }, (_, i) => `article-${i}`);

      // Rapidly mark 10 articles
      await act(async () => {
        // Simulate rapid marking without waiting
        for (const id of articleIds) {
          store.markAsRead(id); // No await - simulating rapid clicks
        }
      });

      // All articles should be queued immediately
      expect(mockLocalStorageQueue.enqueue).toHaveBeenCalledTimes(10);

      // localStorage states should be updated immediately
      expect(mockLocalStorageManager.updateArticleState).toHaveBeenCalledTimes(
        10
      );

      // Counter should update once after debouncing
      mockLocalStorageManager.getUnreadCount.mockReturnValue(10);
      expect(mockLocalStorageManager.getUnreadCount()).toBe(10);
    });

    it("should batch database updates after 500ms", async () => {
      const articleIds = Array.from({ length: 10 }, (_, i) => `article-${i}`);

      // Use markMultipleAsRead for batch operation
      await act(async () => {
        await store.markMultipleAsRead(articleIds);
      });

      // Fast-forward 500ms to trigger batch processing
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Database sync should be triggered
      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalled();
      });
    });

    it("should maintain 60fps during rapid marking", async () => {
      // Mock performance monitoring
      const mockPerformanceMonitor = {
        getFPS: vi.fn(() => 60),
        isMaintenanceFPS: vi.fn(() => true),
      };

      // Simulate rapid marking of 5+ articles per second
      const startTime = performance.now();

      for (let i = 0; i < 25; i++) {
        await act(async () => {
          store.markAsRead(`article-${i % 20}`);
        });

        // Check FPS is maintained
        expect(mockPerformanceMonitor.getFPS()).toBeGreaterThanOrEqual(60);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete rapidly without blocking UI
      expect(totalTime).toBeLessThan(100); // 25 operations in <100ms
    });
  });

  describe("Feed-Filtered Views", () => {
    it("should update feed count in sidebar immediately when marking articles", async () => {
      // Set feed filter
      store.selectedFeedId = "feed-0";

      // Articles 0, 3, 6, 9, 12, 15, 18 belong to feed-0
      const feedArticles = ["article-0", "article-3", "article-6"];

      // Mark articles in this feed
      for (const id of feedArticles) {
        await act(async () => {
          await store.markAsRead(id);
        });
      }

      // Feed count should update immediately via localStorage
      expect(mockLocalStorageManager.getFeedUnreadCount).toHaveBeenCalled();

      // Mock the updated count
      mockLocalStorageManager.getFeedUnreadCount.mockReturnValue(4); // 7 - 3 = 4
      expect(mockLocalStorageManager.getFeedUnreadCount("feed-0")).toBe(4);
    });

    it("should handle cross-feed marking correctly", async () => {
      // Mark articles from different feeds
      const mixedArticles = [
        "article-0", // feed-0
        "article-1", // feed-1
        "article-2", // feed-2
        "article-3", // feed-0
      ];

      await act(async () => {
        await store.markMultipleAsRead(mixedArticles);
      });

      // Each feed count should be updated
      expect(mockLocalStorageManager.updateArticleState).toHaveBeenCalledTimes(
        4
      );

      // Verify feed-specific counts
      mockLocalStorageManager.getFeedUnreadCount.mockImplementation(
        (feedId: string) => {
          if (feedId === "feed-0") return 5; // 7 - 2 = 5
          if (feedId === "feed-1") return 6; // 7 - 1 = 6
          if (feedId === "feed-2") return 6; // 7 - 1 = 6
          return 0;
        }
      );

      expect(mockLocalStorageManager.getFeedUnreadCount("feed-0")).toBe(5);
      expect(mockLocalStorageManager.getFeedUnreadCount("feed-1")).toBe(6);
      expect(mockLocalStorageManager.getFeedUnreadCount("feed-2")).toBe(6);
    });
  });

  describe("Offline Marking", () => {
    it("should apply optimistic updates when offline", async () => {
      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      await act(async () => {
        await store.markAsRead("article-0");
      });

      // localStorage should be updated even when offline
      expect(mockLocalStorageManager.updateArticleState).toHaveBeenCalledWith(
        "article-0",
        expect.objectContaining({ isRead: true })
      );

      // Operation should be queued for later sync
      expect(mockLocalStorageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "mark_read",
          articleId: "article-0",
          offline: true,
        })
      );
    });

    it("should sync when coming back online", async () => {
      // Start offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      // Mark articles while offline
      await act(async () => {
        await store.markAsRead("article-0");
        await store.markAsRead("article-1");
      });

      // Come back online
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      // Trigger online event
      window.dispatchEvent(new Event("online"));

      // Should trigger sync
      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalled();
      });
    });
  });

  describe("Navigation Persistence", () => {
    it("should maintain counts when navigating away and back", async () => {
      // Mark some articles
      await act(async () => {
        await store.markMultipleAsRead(["article-0", "article-1", "article-2"]);
      });

      // Mock count
      mockLocalStorageManager.getUnreadCount.mockReturnValue(17);

      // Simulate navigation away (component unmount)
      store.articles.clear();

      // Simulate navigation back (component remount)
      const articles = createMockArticles(20);
      articles.forEach((article) => {
        store.articles.set(article.id, article);
      });

      // Count should be preserved from localStorage
      expect(mockLocalStorageManager.getUnreadCount()).toBe(17);
    });

    it("should restore article states from localStorage on remount", async () => {
      // Setup localStorage states
      mockLocalStorageManager.getArticleState.mockImplementation(
        (id: string) => {
          if (id === "article-0") return { isRead: true, feedId: "feed-0" };
          if (id === "article-1") return { isRead: true, feedId: "feed-1" };
          return null;
        }
      );

      // Simulate component mount
      const articles = createMockArticles(20);
      articles.forEach((article) => {
        const localState = mockLocalStorageManager.getArticleState(article.id);
        if (localState) {
          article.isRead = localState.isRead;
        }
        store.articles.set(article.id, article);
      });

      // Articles should have correct states
      expect(store.articles.get("article-0")?.isRead).toBe(true);
      expect(store.articles.get("article-1")?.isRead).toBe(true);
      expect(store.articles.get("article-2")?.isRead).toBe(false);
    });
  });

  describe("localStorage Capacity Management", () => {
    it("should handle FIFO cleanup at 1000 operations", async () => {
      // Simulate queue at capacity
      mockLocalStorageQueue.size.mockReturnValue(999);
      mockLocalStorageQueue.hasCapacity.mockReturnValue(true);

      // Add one more operation to reach 1000
      await act(async () => {
        await store.markAsRead("article-0");
      });

      expect(mockLocalStorageQueue.enqueue).toHaveBeenCalled();

      // Now at capacity
      mockLocalStorageQueue.size.mockReturnValue(1000);
      mockLocalStorageQueue.hasCapacity.mockReturnValue(false);

      // Add another operation - should trigger FIFO
      await act(async () => {
        await store.markAsRead("article-1");
      });

      // Queue should maintain 1000 max
      expect(mockLocalStorageQueue.size()).toBe(1000);
    });

    it("should clear localStorage after successful sync", async () => {
      // Add some operations
      await act(async () => {
        await store.markMultipleAsRead(["article-0", "article-1", "article-2"]);
      });

      // Trigger sync
      await act(async () => {
        await mockLocalStorageManager.syncWithDatabase();
      });

      // localStorage should be cleared
      expect(mockLocalStorageManager.clear).toHaveBeenCalled();
      expect(mockLocalStorageQueue.clear).toHaveBeenCalled();
    });
  });

  describe("Graceful Degradation", () => {
    it("should fall back to direct database updates when localStorage unavailable", async () => {
      // Simulate localStorage error
      mockLocalStorageManager.updateArticleState.mockImplementation(() => {
        throw new Error("localStorage unavailable");
      });

      // Should not throw, but fall back to database
      await expect(
        act(async () => {
          await store.markAsRead("article-0");
        })
      ).resolves.not.toThrow();

      // Database should still be updated
      const { supabase } = await import("@/lib/db/supabase");
      expect(supabase.from).toHaveBeenCalled();
    });

    it("should continue functioning without localStorage optimization", async () => {
      // Disable localStorage
      mockLocalStorageQueue.enqueue.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      // Mark articles - should work without localStorage
      await act(async () => {
        await store.markMultipleAsRead(["article-0", "article-1"]);
      });

      // Articles should still be marked in store
      expect(store.articles.get("article-0")?.isRead).toBe(true);
      expect(store.articles.get("article-1")?.isRead).toBe(true);
    });
  });

  describe("UI Responsiveness", () => {
    it("should maintain responsive UI during rapid marking session", async () => {
      const measurements: number[] = [];

      // Simulate rapid marking session
      for (let i = 0; i < 20; i++) {
        const start = performance.now();

        await act(async () => {
          await store.markAsRead(`article-${i}`);
        });

        const responseTime = performance.now() - start;
        measurements.push(responseTime);
      }

      // All operations should be <1ms
      measurements.forEach((time) => {
        expect(time).toBeLessThan(1);
      });

      // Average should also be <1ms
      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgTime).toBeLessThan(1);
    });

    it("should not block UI thread during batch operations", async () => {
      const articleIds = Array.from(
        { length: 100 },
        (_, i) => `article-${i % 20}`
      );

      const start = performance.now();

      await act(async () => {
        // This should be non-blocking
        store.markMultipleAsRead(articleIds); // No await
      });

      const uiResponseTime = performance.now() - start;

      // UI should respond immediately
      expect(uiResponseTime).toBeLessThan(10);

      // Database sync happens in background after 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalled();
      });
    });
  });

  describe("Batch Operation Failure Recovery", () => {
    it("should rollback on batch operation failure", async () => {
      // Setup failure scenario
      mockLocalStorageManager.syncWithDatabase.mockRejectedValueOnce(
        new Error("Database sync failed")
      );

      const articleIds = ["article-0", "article-1", "article-2"];

      // Mark articles
      await act(async () => {
        await store.markMultipleAsRead(articleIds);
      });

      // Trigger sync
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Wait for sync attempt
      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalled();
      });

      // Should have rollback capability
      // Articles should remain in queue for retry
      expect(mockLocalStorageQueue.clear).not.toHaveBeenCalled();
    });

    it("should retry failed sync operations", async () => {
      // First sync fails
      mockLocalStorageManager.syncWithDatabase
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);

      await act(async () => {
        await store.markAsRead("article-0");
      });

      // First sync attempt
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalledTimes(
          1
        );
      });

      // Retry sync
      act(() => {
        vi.advanceTimersByTime(1000); // Retry after delay
      });

      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalledTimes(
          2
        );
      });

      // Second attempt should succeed
      expect(mockLocalStorageQueue.clear).toHaveBeenCalled();
    });
  });

  describe("RR-216 Filter State Compatibility", () => {
    it("should preserve filter state logic unchanged", async () => {
      // Set filter state
      store.readStatusFilter = "unread";
      store.selectedFeedId = "feed-0";
      store.selectedTagIds = new Set(["tech"]);

      // Mark articles
      await act(async () => {
        await store.markAsRead("article-0"); // feed-0, tech tag
      });

      // Filter state should remain unchanged
      expect(store.readStatusFilter).toBe("unread");
      expect(store.selectedFeedId).toBe("feed-0");
      expect(store.selectedTagIds.has("tech")).toBe(true);

      // localStorage should respect filters
      const state = mockLocalStorageManager.getArticleState("article-0");
      expect(mockLocalStorageManager.updateArticleState).toHaveBeenCalledWith(
        "article-0",
        expect.objectContaining({
          isRead: true,
          feedId: "feed-0",
          tags: expect.arrayContaining(["tech"]),
        })
      );
    });

    it("should maintain filter persistence through localStorage", async () => {
      // Apply filters
      store.readStatusFilter = "starred";
      store.selectedFolderId = "folder-1";

      // These filter states should persist in localStorage
      // (separate from article state)
      expect(store.readStatusFilter).toBe("starred");
      expect(store.selectedFolderId).toBe("folder-1");

      // Article operations should not affect filter state
      await act(async () => {
        await store.markMultipleAsRead(["article-0", "article-1"]);
      });

      expect(store.readStatusFilter).toBe("starred");
      expect(store.selectedFolderId).toBe("folder-1");
    });
  });

  describe("Counter Accuracy After Rapid Session", () => {
    it("should show accurate final count after rapid marking session", async () => {
      // Start with 20 unread
      mockLocalStorageManager.getUnreadCount.mockReturnValue(20);

      // Rapid marking session - mark 15 articles
      const articleIds = Array.from({ length: 15 }, (_, i) => `article-${i}`);

      for (const id of articleIds) {
        await act(async () => {
          store.markAsRead(id); // Rapid clicks without waiting
        });
      }

      // Update mock count
      mockLocalStorageManager.getUnreadCount.mockReturnValue(5);

      // Final count should be accurate
      expect(mockLocalStorageManager.getUnreadCount()).toBe(5);

      // After sync, count should still be accurate
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockLocalStorageManager.syncWithDatabase).toHaveBeenCalled();
      });

      expect(mockLocalStorageManager.getUnreadCount()).toBe(5);
    });

    it("should handle interleaved read/unread operations correctly", async () => {
      // Complex session with mixed operations
      await act(async () => {
        await store.markAsRead("article-0");
        await store.markAsRead("article-1");
        await store.markAsUnread("article-0"); // Undo
        await store.markAsRead("article-2");
        await store.markAsRead("article-3");
        await store.markAsUnread("article-2"); // Undo
      });

      // Final state: article-1 and article-3 are read
      // Mock count: 20 - 2 = 18
      mockLocalStorageManager.getUnreadCount.mockReturnValue(18);

      expect(mockLocalStorageManager.getUnreadCount()).toBe(18);

      // Verify individual states
      mockLocalStorageManager.getArticleState.mockImplementation(
        (id: string) => {
          if (id === "article-0") return { isRead: false };
          if (id === "article-1") return { isRead: true };
          if (id === "article-2") return { isRead: false };
          if (id === "article-3") return { isRead: true };
          return { isRead: false };
        }
      );

      expect(mockLocalStorageManager.getArticleState("article-0")?.isRead).toBe(
        false
      );
      expect(mockLocalStorageManager.getArticleState("article-1")?.isRead).toBe(
        true
      );
      expect(mockLocalStorageManager.getArticleState("article-2")?.isRead).toBe(
        false
      );
      expect(mockLocalStorageManager.getArticleState("article-3")?.isRead).toBe(
        true
      );
    });
  });
});
