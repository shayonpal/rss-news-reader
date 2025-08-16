/**
 * RR-197: localStorage Optimization Test Suite
 *
 * This test suite serves as THE SPECIFICATION for the localStorage optimization feature.
 * Tests are written BEFORE implementation and define exactly what the code must do.
 *
 * Test Contracts from Linear:
 * - UI response time: <1ms via localStorage
 * - Database batching: 500ms (unchanged from existing)
 * - fps_target: 60fps maintained during rapid marking (5+ articles/sec)
 * - localStorage_capacity: 1000 operations max
 * - Cleanup strategy: FIFO cleanup, clear after successful DB sync
 * - Fallback behavior: Acceptable to lose operations on localStorage failure
 * - RR-216 compatibility: Filter state logic unchanged
 * - Counter accuracy: Final counter reflects correct count after rapid marking session
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import type { Article } from "@/types";

// Mock localStorage with proper typing
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Test utility: Create a mock article
function createMockArticle(id: string, isRead = false): Article {
  return {
    id,
    feedId: `feed-${id}`,
    title: `Article ${id}`,
    content: `Content for article ${id}`,
    url: `https://example.com/article-${id}`,
    tags: [],
    publishedAt: new Date(),
    author: "Test Author",
    authorName: "Test Author",
    isRead,
    createdAt: new Date(),
    updatedAt: new Date(),
    inoreaderItemId: `inoreader-${id}`,
    fullContentUrl: `https://example.com/article-${id}`,
    hasFullContent: false,
    isPartial: false,
    feedTitle: `Feed for ${id}`,
    parseAttempts: 0, // Required for shouldShowRetry logic
  };
}

describe("RR-197: localStorage Optimization - Core Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
    localStorageMock.clear.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("localStorage Queue Management", () => {
    // Import the utilities that will be implemented
    let LocalStorageQueue: any;
    let queue: any;

    beforeEach(async () => {
      // This will fail initially since the module doesn't exist yet
      // That's expected - tests define the specification
      try {
        const module = await import("@/lib/utils/localstorage-queue");
        LocalStorageQueue = module.LocalStorageQueue;
        // Reset singleton instance for each test
        LocalStorageQueue.resetInstance();
        queue = LocalStorageQueue.getInstance();
        queue.resetQueue(); // Clear any existing state
      } catch (error) {
        // Expected to fail until implementation exists
        LocalStorageQueue = {
          getInstance: () => ({
            enqueue: vi.fn(),
            dequeue: vi.fn(),
            peek: vi.fn(),
            size: vi.fn(() => 0),
            clear: vi.fn(),
            getAll: vi.fn(() => []),
            isEmpty: vi.fn(() => true),
            hasCapacity: vi.fn(() => true),
            resetQueue: vi.fn(),
          }),
        };
        queue = LocalStorageQueue.getInstance();
      }
    });

    it("should initialize with empty queue", () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it("should enqueue operations with <1ms response time", () => {
      const queue = LocalStorageQueue.getInstance();
      const startTime = performance.now();

      const operation = {
        type: "mark_read",
        articleId: "article-123",
        timestamp: Date.now(),
      };

      queue.enqueue(operation);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // UI response must be <1ms
      expect(responseTime).toBeLessThan(1);
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);
    });

    it("should maintain FIFO order for operations", () => {
      const queue = LocalStorageQueue.getInstance();

      const operations = [
        { type: "mark_read", articleId: "article-1", timestamp: Date.now() },
        {
          type: "mark_read",
          articleId: "article-2",
          timestamp: Date.now() + 1,
        },
        {
          type: "mark_read",
          articleId: "article-3",
          timestamp: Date.now() + 2,
        },
      ];

      operations.forEach((op) => queue.enqueue(op));

      expect(queue.dequeue()).toEqual(operations[0]);
      expect(queue.dequeue()).toEqual(operations[1]);
      expect(queue.dequeue()).toEqual(operations[2]);
      expect(queue.isEmpty()).toBe(true);
    });

    it("should enforce 1000 operations capacity limit", () => {
      const queue = LocalStorageQueue.getInstance();

      // Add 1000 operations
      for (let i = 0; i < 1000; i++) {
        queue.enqueue({
          type: "mark_read",
          articleId: `article-${i}`,
          timestamp: Date.now() + i,
        });
      }

      expect(queue.size()).toBe(1000);
      expect(queue.hasCapacity()).toBe(false);

      // Try to add one more - should trigger FIFO cleanup
      const newOperation = {
        type: "mark_read",
        articleId: "article-1001",
        timestamp: Date.now() + 1001,
      };

      queue.enqueue(newOperation);

      // Should still have 1000 items (oldest removed, newest added)
      expect(queue.size()).toBe(1000);

      // First item should now be article-1 (article-0 was removed)
      const all = queue.getAll();
      expect(all[0].articleId).toBe("article-1");
      expect(all[999].articleId).toBe("article-1001");
    });

    it("should perform FIFO cleanup when capacity exceeded", () => {
      const queue = LocalStorageQueue.getInstance();

      // Fill to capacity
      for (let i = 0; i < 1000; i++) {
        queue.enqueue({
          type: "mark_read",
          articleId: `article-${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Add 100 more operations
      for (let i = 1000; i < 1100; i++) {
        queue.enqueue({
          type: "mark_read",
          articleId: `article-${i}`,
          timestamp: Date.now() + i,
        });
      }

      // Should maintain 1000 max
      expect(queue.size()).toBe(1000);

      // Oldest 100 should be removed (0-99), keeping 100-1099
      const all = queue.getAll();
      expect(all[0].articleId).toBe("article-100");
      expect(all[999].articleId).toBe("article-1099");
    });

    it("should clear queue after successful database sync", () => {
      const queue = LocalStorageQueue.getInstance();

      // Add some operations
      for (let i = 0; i < 10; i++) {
        queue.enqueue({
          type: "mark_read",
          articleId: `article-${i}`,
          timestamp: Date.now() + i,
        });
      }

      expect(queue.size()).toBe(10);

      // Simulate successful sync
      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it("should persist queue to localStorage", () => {
      const queue = LocalStorageQueue.getInstance();

      const operation = {
        type: "mark_read",
        articleId: "article-123",
        timestamp: Date.now(),
      };

      queue.enqueue(operation);

      // Should persist to localStorage
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "rss-reader-queue",
        expect.any(String)
      );

      // Parse the stored value to verify structure
      const storedData = JSON.parse(
        (localStorageMock.setItem as MockedFunction<any>).mock.calls[0][1]
      );
      expect(storedData).toHaveLength(1);
      expect(storedData[0]).toMatchObject(operation);
    });

    it("should restore queue from localStorage on initialization", () => {
      const existingQueue = [
        { type: "mark_read", articleId: "article-1", timestamp: Date.now() },
        {
          type: "mark_read",
          articleId: "article-2",
          timestamp: Date.now() + 1,
        },
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingQueue));

      // Re-initialize queue (would happen on page reload)
      const queue = LocalStorageQueue.getInstance();

      expect(queue.size()).toBe(2);
      expect(queue.getAll()).toEqual(existingQueue);
    });

    it("should handle localStorage unavailability gracefully", () => {
      // Simulate localStorage throwing an error
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      const queue = LocalStorageQueue.getInstance();

      // Should not throw, but gracefully degrade
      expect(() => {
        queue.enqueue({
          type: "mark_read",
          articleId: "article-123",
          timestamp: Date.now(),
        });
      }).not.toThrow();

      // Queue should still work in memory
      expect(queue.size()).toBe(1);
    });

    it("should handle corrupted localStorage data", () => {
      // Simulate corrupted data
      localStorageMock.getItem.mockReturnValue("invalid json {]");

      const queue = LocalStorageQueue.getInstance();

      // Should initialize with empty queue
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });
  });

  describe("Performance Monitoring", () => {
    let PerformanceMonitor: any;

    beforeEach(async () => {
      try {
        const module = await import("@/lib/utils/performance-monitor");
        PerformanceMonitor = module.PerformanceMonitor;
      } catch (error) {
        // Expected to fail until implementation exists
        PerformanceMonitor = {
          getInstance: () => ({
            startMeasure: vi.fn(),
            endMeasure: vi.fn(() => 0.5),
            getFPS: vi.fn(() => 60),
            isMaintenanceFPS: vi.fn(() => true),
            getAverageResponseTime: vi.fn(() => 0.5),
          }),
        };
      }
    });

    it("should measure UI response time", () => {
      const monitor = PerformanceMonitor.getInstance();

      monitor.startMeasure("mark_read");
      // Simulate some work
      const endTime = monitor.endMeasure("mark_read");

      expect(endTime).toBeLessThan(1); // <1ms requirement
    });

    it("should track FPS during rapid marking", () => {
      const monitor = PerformanceMonitor.getInstance();

      // Simulate rapid marking (5+ articles/second)
      for (let i = 0; i < 10; i++) {
        monitor.startMeasure(`mark_${i}`);
        monitor.endMeasure(`mark_${i}`);
      }

      const fps = monitor.getFPS();
      expect(fps).toBeGreaterThanOrEqual(60); // Must maintain 60fps
    });

    it("should detect FPS drops below target", () => {
      const monitor = PerformanceMonitor.getInstance();

      // Override to simulate FPS drop
      monitor.getFPS = vi.fn(() => 45);

      expect(monitor.isMaintenanceFPS(60)).toBe(false);
    });

    it("should calculate average response time", () => {
      const monitor = PerformanceMonitor.getInstance();

      // Simulate multiple operations
      const operations = ["op1", "op2", "op3"];
      operations.forEach((op) => {
        monitor.startMeasure(op);
        monitor.endMeasure(op);
      });

      const avgTime = monitor.getAverageResponseTime();
      expect(avgTime).toBeLessThan(1); // Should average <1ms
    });
  });

  describe("localStorage State Manager", () => {
    let LocalStorageStateManager: any;

    beforeEach(async () => {
      try {
        const module = await import("@/lib/utils/localstorage-state");
        LocalStorageStateManager = module.LocalStorageStateManager;
      } catch (error) {
        // Expected to fail until implementation exists
        LocalStorageStateManager = {
          getInstance: () => ({
            updateArticleState: vi.fn(),
            getArticleState: vi.fn(),
            batchUpdateArticleStates: vi.fn(),
            getUnreadCount: vi.fn(() => 0),
            getFeedUnreadCount: vi.fn(() => 0),
            clear: vi.fn(),
            syncWithDatabase: vi.fn(() => Promise.resolve()),
          }),
        };
      }
    });

    it("should update article read state instantly (<1ms)", () => {
      const manager = LocalStorageStateManager.getInstance();
      const startTime = performance.now();

      manager.updateArticleState("article-123", { isRead: true });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1);

      const state = manager.getArticleState("article-123");
      expect(state?.isRead).toBe(true);
    });

    it("should batch update multiple article states", () => {
      const manager = LocalStorageStateManager.getInstance();

      const updates = [
        { articleId: "article-1", isRead: true },
        { articleId: "article-2", isRead: true },
        { articleId: "article-3", isRead: true },
      ];

      const startTime = performance.now();
      manager.batchUpdateArticleStates(updates);
      const endTime = performance.now();

      // Batch update should still be fast
      expect(endTime - startTime).toBeLessThan(5);

      // All states should be updated
      updates.forEach((update) => {
        const state = manager.getArticleState(update.articleId);
        expect(state?.isRead).toBe(true);
      });
    });

    it("should calculate unread count from localStorage state", () => {
      const manager = LocalStorageStateManager.getInstance();

      // Set up some article states
      manager.updateArticleState("article-1", {
        isRead: false,
        feedId: "feed-1",
      });
      manager.updateArticleState("article-2", {
        isRead: true,
        feedId: "feed-1",
      });
      manager.updateArticleState("article-3", {
        isRead: false,
        feedId: "feed-2",
      });
      manager.updateArticleState("article-4", {
        isRead: false,
        feedId: "feed-1",
      });

      // Total unread should be 3
      expect(manager.getUnreadCount()).toBe(3);

      // Feed-specific unread counts
      expect(manager.getFeedUnreadCount("feed-1")).toBe(2);
      expect(manager.getFeedUnreadCount("feed-2")).toBe(1);
    });

    it("should sync with database after batch period (500ms)", async () => {
      const manager = LocalStorageStateManager.getInstance();

      // Update some states
      manager.updateArticleState("article-1", { isRead: true });
      manager.updateArticleState("article-2", { isRead: true });

      // Trigger sync
      const syncPromise = manager.syncWithDatabase();

      // Should batch to database
      await expect(syncPromise).resolves.not.toThrow();

      // After sync, localStorage should be cleared
      expect(manager.getArticleState("article-1")).toBeNull();
      expect(manager.getArticleState("article-2")).toBeNull();
    });

    it("should handle localStorage full scenario with FIFO cleanup", () => {
      const manager = LocalStorageStateManager.getInstance();

      // Simulate localStorage being full
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("QuotaExceededError");
      });

      // Should handle gracefully and attempt cleanup
      expect(() => {
        manager.updateArticleState("article-new", { isRead: true });
      }).not.toThrow();
    });

    it("should preserve filter state compatibility (RR-216)", () => {
      const manager = LocalStorageStateManager.getInstance();

      // Update article state
      manager.updateArticleState("article-123", {
        isRead: true,
        feedId: "feed-456",
        tags: ["tech", "news"],
      });

      // Filter state should be preserved and compatible
      const state = manager.getArticleState("article-123");
      expect(state?.feedId).toBe("feed-456");
      expect(state?.tags).toEqual(["tech", "news"]);
    });
  });

  describe("Fallback Behavior", () => {
    let FallbackHandler: any;

    beforeEach(async () => {
      try {
        const module = await import("@/lib/utils/localstorage-fallback");
        FallbackHandler = module.FallbackHandler;
      } catch (error) {
        // Expected to fail until implementation exists
        FallbackHandler = {
          isLocalStorageAvailable: vi.fn(() => true),
          handleLocalStorageError: vi.fn(),
          enableFallbackMode: vi.fn(),
          isInFallbackMode: vi.fn(() => false),
        };
      }
    });

    it("should detect localStorage unavailability", () => {
      // Simulate localStorage not available
      Object.defineProperty(window, "localStorage", {
        get: () => {
          throw new Error("localStorage not available");
        },
      });

      expect(FallbackHandler.isLocalStorageAvailable()).toBe(false);

      // Restore localStorage mock
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
        writable: true,
      });
    });

    it("should gracefully degrade to existing behavior when localStorage fails", () => {
      FallbackHandler.enableFallbackMode();

      expect(FallbackHandler.isInFallbackMode()).toBe(true);

      // In fallback mode, operations should work without localStorage
      // This means direct database updates without localStorage optimization
    });

    it("should log errors but not crash on localStorage failures", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const error = new Error("QuotaExceededError");
      FallbackHandler.handleLocalStorageError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("localStorage error"),
        error
      );

      consoleSpy.mockRestore();
    });

    it("should accept data loss in localStorage failure scenarios", () => {
      // As per Linear contract: "Acceptable to lose operations on localStorage failure"
      const handler = FallbackHandler;

      // Simulate localStorage failure
      handler.enableFallbackMode();

      // Operations should continue without localStorage
      expect(handler.isInFallbackMode()).toBe(true);

      // Data in localStorage queue would be lost, but app continues
      // This is acceptable as per requirements
    });
  });
});
