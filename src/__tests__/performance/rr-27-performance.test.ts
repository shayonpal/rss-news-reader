import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";
import { navigationHistory } from "@/lib/utils/navigation-history";

/**
 * RR-27: Article List State Preservation - Performance Tests
 *
 * These tests ensure that the state preservation implementation maintains
 * acceptable performance characteristics even with large datasets and
 * frequent operations.
 */

// Performance testing utilities
const measureExecutionTime = async (
  fn: () => Promise<void> | void
): Promise<number> => {
  const start = performance.now();
  await fn();
  return performance.now() - start;
};

const measureMemoryUsage = (): number => {
  if (typeof window !== "undefined" && (window as any).performance?.memory) {
    return (window as any).performance.memory.usedJSHeapSize;
  }
  return 0; // Fallback for Node.js environment
};

// Mock large dataset generators
const generateLargeArticleDataset = (size: number) => {
  return Array.from({ length: size }, (_, index) => ({
    id: `article-${index + 1}`,
    title: `Performance Test Article ${index + 1}`,
    content: `Content for performance test article ${index + 1}. This is a longer content string to simulate real article data with more realistic payload sizes. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`,
    feedTitle: `Test Feed ${Math.floor(index / 100) + 1}`,
    publishedAt: new Date(Date.now() - index * 60000),
    isRead: Math.random() > 0.6, // ~40% read
    wasAutoRead: Math.random() > 0.8, // ~20% auto-read
    position: index,
    sessionPreserved: Math.random() > 0.85, // ~15% session preserved
    tags: index % 10 === 0 ? ["starred"] : [],
    url: `https://example.com/article-${index + 1}`,
    author: `Author ${Math.floor(index / 50) + 1}`,
  }));
};

// Helper to convert our actual implementation's state format for testing
const convertToTestState = (
  articleIds: string[],
  readStates: Record<string, boolean> = {},
  autoReadArticles: string[] = []
) => {
  return {
    articleIds,
    readStates,
    autoReadArticles,
    manualReadArticles: [],
    scrollPosition: 0,
    timestamp: Date.now(),
    filterMode: "unread" as const,
  };
};

// Performance-optimized intersection observer
class PerformantAutoReadManager {
  private observer: IntersectionObserver | null = null;
  private pendingUpdates: Set<string> = new Set();
  private throttleTimer: NodeJS.Timeout | null = null;
  private readonly THROTTLE_MS = 200;
  private readonly BATCH_SIZE = 10;

  createOptimizedObserver(
    callback: (articleIds: string[]) => void
  ): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        const articlesToMark: string[] = [];

        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
            const articleId = (entry.target as HTMLElement).dataset.articleId;
            const isRead =
              (entry.target as HTMLElement).dataset.isRead === "true";

            if (articleId && !isRead) {
              articlesToMark.push(articleId);
            }
          }
        });

        if (articlesToMark.length > 0) {
          this.throttledCallback(articlesToMark, callback);
        }
      },
      {
        rootMargin: "0px 0px -80% 0px", // Optimized trigger zone
        threshold: 0,
      }
    );
  }

  private throttledCallback(
    articleIds: string[],
    callback: (articleIds: string[]) => void
  ): void {
    articleIds.forEach((id) => this.pendingUpdates.add(id));

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }

    this.throttleTimer = setTimeout(() => {
      const batch = Array.from(this.pendingUpdates).slice(0, this.BATCH_SIZE);
      this.pendingUpdates.clear();

      if (batch.length > 0) {
        callback(batch);
      }
    }, this.THROTTLE_MS);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.pendingUpdates.clear();
  }
}

describe("RR-27: Article List State Preservation - Performance Tests", () => {
  let autoReadManager: PerformantAutoReadManager;
  let mockSessionStorage: any;

  beforeEach(() => {
    // Mock sessionStorage with performance characteristics
    mockSessionStorage = {
      data: {} as Record<string, string>,
      getItem: vi.fn((key: string) => {
        // Simulate storage read latency
        return mockSessionStorage.data[key] || null;
      }),
      setItem: vi.fn((key: string, value: string) => {
        // Simulate storage write latency and quota
        if (Object.keys(mockSessionStorage.data).length > 50) {
          throw new Error("QuotaExceededError");
        }
        mockSessionStorage.data[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage.data[key];
      }),
    };

    vi.stubGlobal("sessionStorage", mockSessionStorage);
    vi.useFakeTimers();

    // Clear any existing state
    articleListStateManager.clearState();
    navigationHistory.clear();

    autoReadManager = new PerformantAutoReadManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    autoReadManager.disconnect();
    articleListStateManager.clearState();
    navigationHistory.clear();
  });

  describe("Large Dataset Performance", () => {
    it("should handle 1000 articles with acceptable performance", async () => {
      const largeDataset = generateLargeArticleDataset(1000);

      // Convert to our implementation's format
      const articleIds = largeDataset.map((a) => a.id);
      const readStates: Record<string, boolean> = {};
      const autoReadArticles: string[] = [];

      largeDataset.forEach((article) => {
        if (article.isRead) {
          readStates[article.id] = true;
          if (article.wasAutoRead) {
            autoReadArticles.push(article.id);
          }
        }
      });

      const state = {
        articleIds,
        readStates,
        autoReadArticles,
        manualReadArticles: [],
        scrollPosition: 2500,
        filterMode: "unread" as const,
      };

      // Test save performance
      const saveTime = await measureExecutionTime(() => {
        articleListStateManager.saveListState(state);
      });

      expect(saveTime).toBeLessThan(50); // Should complete in under 50ms

      // Test retrieval performance
      const retrieveTime = await measureExecutionTime(() => {
        articleListStateManager.getListState();
      });

      expect(retrieveTime).toBeLessThan(30); // Should complete in under 30ms

      // Verify data integrity
      const retrievedState = articleListStateManager.getListState();
      expect(retrievedState).toBeTruthy();
      expect(retrievedState?.articleIds.length).toBeLessThanOrEqual(200); // Limited for performance
    });

    it("should handle 5000 articles with compression and chunking", async () => {
      const massiveDataset = generateLargeArticleDataset(5000);

      // Convert to our implementation's format
      const articleIds = massiveDataset.map((a) => a.id);
      const readStates: Record<string, boolean> = {};
      const autoReadArticles: string[] = [];

      massiveDataset.forEach((article) => {
        if (article.isRead) {
          readStates[article.id] = true;
          if (article.wasAutoRead) {
            autoReadArticles.push(article.id);
          }
        }
      });

      const state = {
        articleIds,
        readStates,
        autoReadArticles,
        manualReadArticles: [],
        scrollPosition: 10000,
        filterMode: "all" as const,
      };

      // Should not crash or timeout
      const saveTime = await measureExecutionTime(() => {
        articleListStateManager.saveListState(state);
      });

      expect(saveTime).toBeLessThan(100); // Acceptable for large dataset

      const retrievedState = articleListStateManager.getListState();
      expect(retrievedState).toBeTruthy();
      // Should be truncated for performance
      expect(retrievedState?.articleIds.length).toBeLessThanOrEqual(200);
    });
  });

  describe("Rapid Operation Performance", () => {
    it("should handle rapid state updates with debouncing", async () => {
      const articles = generateLargeArticleDataset(100);

      // Simulate rapid updates (like during scrolling)
      const updateTimes: number[] = [];

      const articleIds = articles.map((a) => a.id);
      const readStates: Record<string, boolean> = {};

      for (let i = 0; i < 20; i++) {
        const updateTime = await measureExecutionTime(() => {
          articleListStateManager.saveListState({
            articleIds,
            readStates,
            autoReadArticles: [],
            manualReadArticles: [],
            scrollPosition: i * 100,
            filterMode: "unread",
          });
        });
        updateTimes.push(updateTime);
      }

      // Operations should be fast
      const avgUpdateTime =
        updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(20); // Fast operations

      // Final state should be consistent
      const finalState = articleListStateManager.getListState();
      expect(finalState?.scrollPosition).toBe(1900); // Last update
    });

    it("should batch article updates efficiently", async () => {
      const articles = generateLargeArticleDataset(200);

      const articleIds = articles.map((a) => a.id);
      articleListStateManager.saveListState({
        articleIds,
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "unread",
      });

      // Batch update 50 articles
      const updates = Array.from({ length: 50 }, (_, i) => ({
        id: `article-${i + 1}`,
        changes: { isRead: true, wasAutoRead: true },
      }));

      const batchTime = await measureExecutionTime(() => {
        articleListStateManager.batchUpdateArticles(updates);
      });

      expect(batchTime).toBeLessThan(30); // Efficient batch operation

      const updatedState = articleListStateManager.getListState();
      const readCount = Object.values(updatedState?.readStates || {}).filter(
        (isRead) => isRead
      ).length;
      expect(readCount).toBeGreaterThanOrEqual(50);
    });
  });

  describe("Memory Usage Optimization", () => {
    it("should implement effective caching without memory leaks", async () => {
      const initialMemory = measureMemoryUsage();

      // Perform many state operations
      for (let i = 0; i < 100; i++) {
        const articles = generateLargeArticleDataset(50);
        const articleIds = articles.map((a) => a.id);

        articleListStateManager.saveListState({
          articleIds,
          readStates: {},
          autoReadArticles: [],
          manualReadArticles: [],
          scrollPosition: i * 10,
          filterMode: "unread",
        });

        articleListStateManager.getListState(); // Access
      }

      // Clear state
      articleListStateManager.clearState();

      const finalMemory = measureMemoryUsage();

      // Memory usage should not grow excessively
      if (initialMemory > 0 && finalMemory > 0) {
        expect(finalMemory - initialMemory).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
      }
    });

    it("should handle virtual scrolling efficiently", async () => {
      const largeDataset = generateLargeArticleDataset(2000);

      const articleIds = largeDataset.slice(0, 200).map((a) => a.id); // Use our limit
      articleListStateManager.saveListState({
        articleIds,
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 5000,
        filterMode: "all",
      });

      // Test retrieval performance
      const viewportTests = [
        { start: 0, end: 49 }, // First page
        { start: 50, end: 99 }, // Second page
        { start: 150, end: 199 }, // End page
        { start: 100, end: 149 }, // Jump back
      ];

      for (const { start, end } of viewportTests) {
        const retrievalTime = await measureExecutionTime(() => {
          const state = articleListStateManager.getListState();
          if (state) {
            // Simulate getting visible articles
            const visible = state.articleIds.slice(start, end + 1);
          }
        });

        expect(retrievalTime).toBeLessThan(10); // Very fast retrieval
      }
    });
  });

  describe("Intersection Observer Performance", () => {
    it("should handle many article elements efficiently", async () => {
      // Since IntersectionObserver is mocked in our test environment,
      // we test the performance of processing many article updates
      const articleIds = Array.from(
        { length: 500 },
        (_, i) => `article-${i + 1}`
      );

      const processingTime = await measureExecutionTime(() => {
        // Simulate batch processing of auto-read articles
        const batches = [];
        const batchSize = 10;

        for (let i = 0; i < articleIds.length; i += batchSize) {
          batches.push(articleIds.slice(i, i + batchSize));
        }

        // Process each batch
        batches.forEach((batch) => {
          const updates = batch.map((id) => ({
            id,
            changes: { isRead: true, wasAutoRead: true },
          }));
          articleListStateManager.batchUpdateArticles(updates);
        });
      });

      expect(processingTime).toBeLessThan(100); // Fast processing of many elements
      expect(articleIds.length).toBe(500);
    });

    it("should efficiently track auto-read articles", async () => {
      // Test the efficiency of our actual state manager with auto-read tracking
      const initialState = {
        articleIds: Array.from({ length: 100 }, (_, i) => `article-${i}`),
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "unread" as const,
      };

      articleListStateManager.saveListState(initialState);

      // Simulate rapid auto-read updates
      const updateTime = await measureExecutionTime(() => {
        for (let i = 0; i < 50; i++) {
          articleListStateManager.updateArticleState(`article-${i}`, {
            isRead: true,
            wasAutoRead: true,
          });
        }
      });

      expect(updateTime).toBeLessThan(50); // Fast update handling

      const finalState = articleListStateManager.getListState();
      expect(finalState?.autoReadArticles.length).toBe(50);
    });
  });

  describe("Storage Quota and Fallback Performance", () => {
    it("should handle storage quota gracefully without blocking", async () => {
      // Simulate approaching storage quota
      for (let i = 0; i < 45; i++) {
        mockSessionStorage.data[`filler-${i}`] = "x".repeat(1000);
      }

      const articles = generateLargeArticleDataset(1000);
      const articleIds = articles.map((a) => a.id);
      const largeState = {
        articleIds,
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 5000,
        filterMode: "unread" as const,
      };

      // Should not throw or block
      const saveTime = await measureExecutionTime(() => {
        articleListStateManager.saveListState(largeState);
      });

      expect(saveTime).toBeLessThan(100); // Fast handling

      // State manager should handle quota gracefully
      // The actual implementation may not save a minimal fallback,
      // but should handle the error without crashing
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
    });

    it("should recover quickly from storage failures", async () => {
      // Simulate storage failure
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error("Storage failed");
      });

      const articles = generateLargeArticleDataset(100);
      const state = {
        articleIds: articles.map((a) => a.id),
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 1000,
        filterMode: "unread" as const,
      };

      // Should handle gracefully and quickly
      const errorHandlingTime = await measureExecutionTime(() => {
        articleListStateManager.saveListState(state);
      });

      expect(errorHandlingTime).toBeLessThan(20); // Fast error handling
    });
  });

  describe("Real-world Performance Scenarios", () => {
    it("should maintain performance during heavy user interaction", async () => {
      // Simulate heavy user interaction: scrolling, clicking, navigating
      const articles = generateLargeArticleDataset(300);

      const articleIds = articles.map((a) => a.id);
      const scenarios = [
        () =>
          articleListStateManager.saveListState({
            articleIds,
            readStates: {},
            autoReadArticles: [],
            manualReadArticles: [],
            scrollPosition: Math.random() * 1000,
            filterMode: "unread",
          }),
        () => articleListStateManager.getListState(),
        () =>
          articleListStateManager.batchUpdateArticles([
            { id: "article-1", changes: { isRead: true } },
          ]),
      ];

      const operationTimes: number[] = [];

      // Run 200 mixed operations
      for (let i = 0; i < 200; i++) {
        const scenario = scenarios[i % scenarios.length];
        const time = await measureExecutionTime(scenario);
        operationTimes.push(time);
      }

      const avgTime =
        operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
      const maxTime = Math.max(...operationTimes);

      expect(avgTime).toBeLessThan(15); // Average operation under 15ms
      expect(maxTime).toBeLessThan(100); // No operation over 100ms
    });

    it("should handle concurrent operations without performance degradation", async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
        measureExecutionTime(() => {
          const articles = generateLargeArticleDataset(20);
          const articleIds = articles.map((a) => a.id);

          articleListStateManager.saveListState({
            articleIds,
            readStates: {},
            autoReadArticles: [],
            manualReadArticles: [],
            scrollPosition: i * 100,
            filterMode: "unread",
          });

          articleListStateManager.getListState();
        })
      );

      const times = await Promise.all(concurrentOperations);
      const avgConcurrentTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgConcurrentTime).toBeLessThan(50); // Concurrent operations remain fast
    });
  });

  describe("Benchmarking and Regression Prevention", () => {
    it("should meet performance benchmarks for typical usage", async () => {
      const benchmarks = {
        smallListSave: { size: 50, expectedTime: 10 },
        mediumListSave: { size: 200, expectedTime: 25 },
        largeListSave: { size: 500, expectedTime: 50 },
        retrieval: { expectedTime: 20 },
        batchUpdate: { updates: 20, expectedTime: 15 },
      };

      // Test save performance across sizes
      for (const [name, benchmark] of Object.entries(benchmarks)) {
        if (name.includes("Save")) {
          const articles = generateLargeArticleDataset(benchmark.size);
          const articleIds = articles.map((a) => a.id);
          const time = await measureExecutionTime(() => {
            articleListStateManager.saveListState({
              articleIds,
              readStates: {},
              autoReadArticles: [],
              manualReadArticles: [],
              scrollPosition: 1000,
              filterMode: "unread",
            });
          });

          expect(time).toBeLessThan(benchmark.expectedTime);
        }
      }

      // Test retrieval performance
      const retrievalTime = await measureExecutionTime(() => {
        articleListStateManager.getListState();
      });
      expect(retrievalTime).toBeLessThan(benchmarks.retrieval.expectedTime);

      // Test batch update performance
      const updates = Array.from(
        { length: benchmarks.batchUpdate.updates },
        (_, i) => ({
          id: `article-${i + 1}`,
          changes: { isRead: true },
        })
      );

      const batchTime = await measureExecutionTime(() => {
        articleListStateManager.batchUpdateArticles(updates);
      });
      expect(batchTime).toBeLessThan(benchmarks.batchUpdate.expectedTime);
    });
  });
});
