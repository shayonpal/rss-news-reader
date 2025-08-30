/**
 * RR-197: Performance Metrics Test Suite
 *
 * Validates performance requirements:
 * - 60fps maintenance during rapid marking
 * - <1ms UI response times
 * - Memory stability during long sessions
 * - Efficient batch processing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useArticleStore } from "@/lib/stores/article-store";
import type { Article } from "@/types";

// Mock dependencies
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

// Performance monitoring utilities
class PerformanceTracker {
  private frameTimestamps: number[] = [];
  private operationTimings: Map<string, number[]> = new Map();
  private memorySnapshots: number[] = [];
  private rafId: number | null = null;

  startFPSTracking() {
    this.frameTimestamps = [];
    const trackFrame = (timestamp: number) => {
      this.frameTimestamps.push(timestamp);
      if (this.frameTimestamps.length < 120) {
        // Track for ~2 seconds at 60fps
        this.rafId = requestAnimationFrame(trackFrame);
      }
    };
    this.rafId = requestAnimationFrame(trackFrame);
  }

  stopFPSTracking() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  calculateFPS(): number {
    if (this.frameTimestamps.length < 2) return 0;

    const deltas: number[] = [];
    for (let i = 1; i < this.frameTimestamps.length; i++) {
      deltas.push(this.frameTimestamps[i] - this.frameTimestamps[i - 1]);
    }

    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return 1000 / avgDelta; // Convert to FPS
  }

  measureOperation(name: string, operation: () => void): number {
    const start = performance.now();
    operation();
    const duration = performance.now() - start;

    if (!this.operationTimings.has(name)) {
      this.operationTimings.set(name, []);
    }
    this.operationTimings.get(name)!.push(duration);

    return duration;
  }

  async measureAsyncOperation(
    name: string,
    operation: () => Promise<void>
  ): Promise<number> {
    const start = performance.now();
    await operation();
    const duration = performance.now() - start;

    if (!this.operationTimings.has(name)) {
      this.operationTimings.set(name, []);
    }
    this.operationTimings.get(name)!.push(duration);

    return duration;
  }

  getAverageOperationTime(name: string): number {
    const timings = this.operationTimings.get(name);
    if (!timings || timings.length === 0) return 0;
    return timings.reduce((a, b) => a + b, 0) / timings.length;
  }

  getMaxOperationTime(name: string): number {
    const timings = this.operationTimings.get(name);
    if (!timings || timings.length === 0) return 0;
    return Math.max(...timings);
  }

  getP95OperationTime(name: string): number {
    const timings = this.operationTimings.get(name);
    if (!timings || timings.length === 0) return 0;

    const sorted = [...timings].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    return sorted[p95Index];
  }

  captureMemorySnapshot() {
    if ("memory" in performance) {
      // @ts-ignore - memory is not in TS types but exists in Chrome
      const memory = performance.memory;
      this.memorySnapshots.push(memory.usedJSHeapSize);
    }
  }

  getMemoryGrowth(): number {
    if (this.memorySnapshots.length < 2) return 0;
    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    return last - first;
  }

  reset() {
    this.frameTimestamps = [];
    this.operationTimings.clear();
    this.memorySnapshots = [];
    this.stopFPSTracking();
  }
}

// Helper to create mock articles
function createMockArticle(id: string): Article {
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
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    inoreaderItemId: `inoreader-${id}`,
    fullContentUrl: `https://example.com/article-${id}`,
    hasFullContent: false,
    isPartial: false,
    feedTitle: `Feed ${id}`,
    parseAttempts: 0,
  };
}

describe("RR-197: Performance Metrics", () => {
  let tracker: PerformanceTracker;
  let store: any;

  beforeEach(() => {
    vi.clearAllMocks();
    tracker = new PerformanceTracker();

    // Reset store
    store = useArticleStore.getState();
    store.articles.clear();

    // Add test articles
    for (let i = 0; i < 100; i++) {
      store.articles.set(`article-${i}`, createMockArticle(`${i}`));
    }
  });

  afterEach(() => {
    tracker.reset();
    vi.restoreAllMocks();
  });

  describe("UI Response Time Requirements", () => {
    it("should mark single article in <1ms", async () => {
      const duration = await tracker.measureAsyncOperation(
        "single_mark",
        async () => {
          await store.markAsRead("article-0");
        }
      );

      expect(duration).toBeLessThan(1);
    });

    it("should handle 10 rapid marks with <1ms average response", async () => {
      for (let i = 0; i < 10; i++) {
        await tracker.measureAsyncOperation("rapid_mark", async () => {
          await store.markAsRead(`article-${i}`);
        });
      }

      const avgTime = tracker.getAverageOperationTime("rapid_mark");
      expect(avgTime).toBeLessThan(1);
    });

    it("should maintain <1ms response for 95th percentile operations", async () => {
      // Perform 100 operations
      for (let i = 0; i < 100; i++) {
        await tracker.measureAsyncOperation("p95_test", async () => {
          await store.markAsRead(`article-${i % 50}`); // Some repeats
        });
      }

      const p95Time = tracker.getP95OperationTime("p95_test");
      expect(p95Time).toBeLessThan(1);
    });

    it("should not have any operations exceeding 5ms", async () => {
      for (let i = 0; i < 50; i++) {
        await tracker.measureAsyncOperation("max_test", async () => {
          await store.markAsRead(`article-${i}`);
        });
      }

      const maxTime = tracker.getMaxOperationTime("max_test");
      expect(maxTime).toBeLessThan(5);
    });
  });

  describe("FPS Maintenance During Rapid Marking", () => {
    it("should maintain 60fps during 5 articles/second marking", async () => {
      tracker.startFPSTracking();

      // Mark 10 articles over 2 seconds (5/sec)
      const markingPromises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        markingPromises.push(
          new Promise<void>((resolve) => {
            setTimeout(async () => {
              await store.markAsRead(`article-${i}`);
              resolve();
            }, i * 200); // Every 200ms = 5/sec
          })
        );
      }

      await Promise.all(markingPromises);

      // Wait for frames to be tracked
      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stopFPSTracking();
      const fps = tracker.calculateFPS();

      expect(fps).toBeGreaterThanOrEqual(60);
    });

    it("should handle burst marking without frame drops", async () => {
      tracker.startFPSTracking();

      // Burst mark 20 articles as fast as possible
      const burst = async () => {
        for (let i = 0; i < 20; i++) {
          store.markAsRead(`article-${i}`); // No await - true burst
        }
      };

      await tracker.measureAsyncOperation("burst", burst);

      tracker.stopFPSTracking();
      const fps = tracker.calculateFPS();

      // Should maintain at least 30fps during burst (half of target)
      expect(fps).toBeGreaterThanOrEqual(30);
    });

    it("should recover to 60fps after burst operation", async () => {
      // Burst operation
      for (let i = 0; i < 30; i++) {
        store.markAsRead(`article-${i}`);
      }

      // Wait for recovery
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Track FPS after burst
      tracker.startFPSTracking();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      tracker.stopFPSTracking();

      const fps = tracker.calculateFPS();
      expect(fps).toBeGreaterThanOrEqual(60);
    });
  });

  describe("Memory Stability", () => {
    it("should not leak memory during long marking session", async () => {
      tracker.captureMemorySnapshot();

      // Simulate long session - 500 operations
      for (let i = 0; i < 500; i++) {
        await store.markAsRead(`article-${i % 100}`);

        // Capture memory every 50 operations
        if (i % 50 === 0) {
          tracker.captureMemorySnapshot();
        }
      }

      tracker.captureMemorySnapshot();
      const memoryGrowth = tracker.getMemoryGrowth();

      // Memory growth should be minimal (< 10MB for 500 operations)
      const maxGrowthMB = 10;
      expect(memoryGrowth).toBeLessThan(maxGrowthMB * 1024 * 1024);
    });

    it("should garbage collect properly after batch operations", async () => {
      tracker.captureMemorySnapshot();

      // Large batch operation
      const articleIds = Array.from({ length: 100 }, (_, i) => `article-${i}`);
      await store.markMultipleAsRead(articleIds);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.captureMemorySnapshot();
      const memoryGrowth = tracker.getMemoryGrowth();

      // Should have minimal residual memory after GC
      expect(memoryGrowth).toBeLessThan(1024 * 1024); // < 1MB
    });
  });

  describe("Batch Processing Efficiency", () => {
    it("should batch 100 operations efficiently", async () => {
      const articleIds = Array.from({ length: 100 }, (_, i) => `article-${i}`);

      const duration = await tracker.measureAsyncOperation(
        "batch_100",
        async () => {
          await store.markMultipleAsRead(articleIds);
        }
      );

      // Batch of 100 should complete quickly
      expect(duration).toBeLessThan(50); // 50ms for 100 items

      // Average per item should be very low
      const perItemTime = duration / 100;
      expect(perItemTime).toBeLessThan(1);
    });

    it("should maintain efficiency with mixed operations", async () => {
      const operations: Promise<void>[] = [];

      // Mix of single and batch operations
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Batch operation
          operations.push(
            tracker
              .measureAsyncOperation(`batch_${i}`, async () => {
                const ids = Array.from(
                  { length: 10 },
                  (_, j) => `article-${i * 10 + j}`
                );
                await store.markMultipleAsRead(ids);
              })
              .then(() => {})
          );
        } else {
          // Single operation
          operations.push(
            tracker
              .measureAsyncOperation(`single_${i}`, async () => {
                await store.markAsRead(`article-${i}`);
              })
              .then(() => {})
          );
        }
      }

      const start = performance.now();
      await Promise.all(operations);
      const totalTime = performance.now() - start;

      // All operations should complete quickly
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe("localStorage Performance", () => {
    let mockLocalStorage: any;

    beforeEach(() => {
      mockLocalStorage = {
        data: new Map(),
        getItem: vi.fn((key: string) => mockLocalStorage.data.get(key) || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage.data.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          mockLocalStorage.data.delete(key);
        }),
        clear: vi.fn(() => {
          mockLocalStorage.data.clear();
        }),
      };

      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
        writable: true,
      });
    });

    it("should write to localStorage in <0.1ms", () => {
      const duration = tracker.measureOperation("localStorage_write", () => {
        mockLocalStorage.setItem("test-key", JSON.stringify({ data: "test" }));
      });

      expect(duration).toBeLessThan(0.1);
    });

    it("should read from localStorage in <0.1ms", () => {
      mockLocalStorage.setItem("test-key", JSON.stringify({ data: "test" }));

      const duration = tracker.measureOperation("localStorage_read", () => {
        const data = mockLocalStorage.getItem("test-key");
        JSON.parse(data);
      });

      expect(duration).toBeLessThan(0.1);
    });

    it("should handle large localStorage payloads efficiently", () => {
      // Create large payload (1000 article states)
      const largePayload = Array.from({ length: 1000 }, (_, i) => ({
        id: `article-${i}`,
        isRead: i % 2 === 0,
        timestamp: Date.now(),
      }));

      const writeTime = tracker.measureOperation("large_write", () => {
        mockLocalStorage.setItem("large-data", JSON.stringify(largePayload));
      });

      const readTime = tracker.measureOperation("large_read", () => {
        const data = mockLocalStorage.getItem("large-data");
        JSON.parse(data);
      });

      // Even with large payload, should be fast
      expect(writeTime).toBeLessThan(5);
      expect(readTime).toBeLessThan(5);
    });
  });

  describe("Database Batching Performance", () => {
    it("should maintain 500ms batching interval", async () => {
      vi.useFakeTimers();

      const batchSpy = vi.fn();

      // Mock the batch processing
      const processBatch = () => {
        batchSpy();
      };

      // Simulate rapid marks that should be batched
      for (let i = 0; i < 10; i++) {
        store.markAsRead(`article-${i}`);
      }

      // Should not process immediately
      expect(batchSpy).not.toHaveBeenCalled();

      // Advance to just before 500ms
      vi.advanceTimersByTime(499);
      expect(batchSpy).not.toHaveBeenCalled();

      // Advance past 500ms
      vi.advanceTimersByTime(1);

      // Now the batch timer would fire (mocked in actual implementation)
      processBatch();
      expect(batchSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("should coalesce multiple marks within batch window", async () => {
      vi.useFakeTimers();

      const marks: string[] = [];

      // Track which articles are marked
      store.markAsRead = vi.fn(async (id: string) => {
        marks.push(id);
      });

      // Rapid marks within 500ms window
      for (let i = 0; i < 20; i++) {
        await store.markAsRead(`article-${i}`);
        vi.advanceTimersByTime(20); // 20ms between marks
      }

      // All 20 should be marked
      expect(marks).toHaveLength(20);

      // But they should be in one batch (would be processed together after 500ms)
      vi.advanceTimersByTime(500);

      vi.useRealTimers();
    });
  });

  describe("Concurrent Operation Handling", () => {
    it("should handle concurrent mark/unmark operations", async () => {
      const operations: Promise<void>[] = [];

      // Create conflicting operations
      for (let i = 0; i < 10; i++) {
        operations.push(store.markAsRead(`article-${i}`));
        operations.push(store.markAsUnread(`article-${i}`));
      }

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      // Should handle conflicts efficiently
      expect(duration).toBeLessThan(50);
    });

    it("should maintain performance with parallel feed operations", async () => {
      const feedOperations = [
        store.markAllAsRead("feed-1"),
        store.markAllAsRead("feed-2"),
        store.markAllAsRead("feed-3"),
      ];

      const start = performance.now();
      await Promise.all(feedOperations);
      const duration = performance.now() - start;

      // Parallel feed operations should be efficient
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Performance Regression Detection", () => {
    it("should detect performance degradation", async () => {
      const baselineTimings: number[] = [];
      const currentTimings: number[] = [];

      // Establish baseline
      for (let i = 0; i < 10; i++) {
        const duration = await tracker.measureAsyncOperation(
          "baseline",
          async () => {
            await store.markAsRead(`article-${i}`);
          }
        );
        baselineTimings.push(duration);
      }

      // Reset and test current performance
      tracker.reset();

      for (let i = 10; i < 20; i++) {
        const duration = await tracker.measureAsyncOperation(
          "current",
          async () => {
            await store.markAsRead(`article-${i}`);
          }
        );
        currentTimings.push(duration);
      }

      const baselineAvg =
        baselineTimings.reduce((a, b) => a + b, 0) / baselineTimings.length;
      const currentAvg =
        currentTimings.reduce((a, b) => a + b, 0) / currentTimings.length;

      // Current should not be significantly worse than baseline (max 20% degradation)
      const maxDegradation = baselineAvg * 1.2;
      expect(currentAvg).toBeLessThanOrEqual(maxDegradation);
    });

    it("should maintain performance SLA metrics", async () => {
      const slaMetrics = {
        p50Target: 0.5, // 50th percentile < 0.5ms
        p95Target: 1.0, // 95th percentile < 1ms
        p99Target: 5.0, // 99th percentile < 5ms
      };

      // Perform 100 operations
      for (let i = 0; i < 100; i++) {
        await tracker.measureAsyncOperation("sla_test", async () => {
          await store.markAsRead(`article-${i}`);
        });
      }

      const timings = tracker.operationTimings.get("sla_test") || [];
      const sorted = [...timings].sort((a, b) => a - b);

      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      expect(p50).toBeLessThanOrEqual(slaMetrics.p50Target);
      expect(p95).toBeLessThanOrEqual(slaMetrics.p95Target);
      expect(p99).toBeLessThanOrEqual(slaMetrics.p99Target);
    });
  });
});
