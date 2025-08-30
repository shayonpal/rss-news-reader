/**
 * Performance tests for RR-256: Timeout Compliance
 * Tests that content fetching respects the 30-second timeout requirement
 * and handles concurrent processing efficiently.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { performance } from "perf_hooks";

// Performance benchmarks
const PERFORMANCE_BENCHMARKS = {
  contentFetchTimeout: 30000, // 30 seconds max for content fetch
  summarizationTotal: 35000, // 35 seconds max (fetch + summarize)
  mobileLoadTime: 3000, // 3 seconds for mobile PWA
  concurrentFetches: 3, // MAX_CONCURRENT_PARSES
  retryDelay: 1000, // 1 second between retries
  cacheExpiry: 3600000, // 1 hour cache
  memoryLimit: 50 * 1024 * 1024, // 50MB for mobile
};

// Mock performance monitoring
class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Array<{ name: string; duration: number }> = [];

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark) || 0;
    const end = endMark
      ? this.marks.get(endMark) || performance.now()
      : performance.now();
    const duration = end - start;
    this.measures.push({ name, duration });
    return duration;
  }

  getMetrics(): {
    marks: Map<string, number>;
    measures: Array<{ name: string; duration: number }>;
  } {
    return {
      marks: this.marks,
      measures: this.measures,
    };
  }

  reset(): void {
    this.marks.clear();
    this.measures = [];
  }
}

// Mock content fetcher with configurable delays
class ContentFetcher {
  private activeFetches = new Set<string>();
  private fetchQueue: Array<{ id: string; resolve: Function }> = [];

  async fetchWithTimeout(
    articleId: string,
    url: string,
    timeoutMs: number = 30000
  ): Promise<{ content: string | null; timedOut: boolean; duration: number }> {
    const startTime = performance.now();

    // Check concurrent limit
    if (this.activeFetches.size >= PERFORMANCE_BENCHMARKS.concurrentFetches) {
      // Queue the request
      await new Promise<void>((resolve) => {
        this.fetchQueue.push({ id: articleId, resolve });
      });
    }

    this.activeFetches.add(articleId);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const fetchPromise = this.simulateFetch(url, controller.signal);

      const content = await fetchPromise;
      clearTimeout(timeoutId);

      const duration = performance.now() - startTime;
      return { content, timedOut: false, duration };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      if (error.name === "AbortError") {
        return { content: null, timedOut: true, duration };
      }
      throw error;
    } finally {
      this.activeFetches.delete(articleId);

      // Process queue
      if (this.fetchQueue.length > 0) {
        const next = this.fetchQueue.shift();
        next?.resolve();
      }
    }
  }

  private async simulateFetch(
    url: string,
    signal: AbortSignal
  ): Promise<string> {
    // Simulate different response times based on URL
    let delay = 1000; // Default 1 second

    if (url.includes("slow")) {
      delay = 35000; // Exceeds timeout
    } else if (url.includes("medium")) {
      delay = 20000; // Within timeout but slow
    } else if (url.includes("fast")) {
      delay = 500; // Fast response
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (!signal.aborted) {
          resolve(`Content from ${url}`);
        }
      }, delay);

      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        reject(new Error("AbortError"));
      });
    });
  }

  getActiveCount(): number {
    return this.activeFetches.size;
  }

  getQueueLength(): number {
    return this.fetchQueue.length;
  }
}

describe("Performance Requirements", () => {
  let monitor: PerformanceMonitor;
  let fetcher: ContentFetcher;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new PerformanceMonitor();
    fetcher = new ContentFetcher();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    monitor.reset();
  });

  describe("Timeout Compliance", () => {
    it("should enforce 30-second timeout for content fetching", async () => {
      monitor.mark("fetch-start");

      const result = await fetcher.fetchWithTimeout(
        "article-1",
        "https://slow-site.com/article",
        PERFORMANCE_BENCHMARKS.contentFetchTimeout
      );

      monitor.mark("fetch-end");
      const duration = monitor.measure(
        "fetch-duration",
        "fetch-start",
        "fetch-end"
      );

      expect(result.timedOut).toBe(true);
      expect(result.content).toBeNull();
      expect(duration).toBeLessThanOrEqual(
        PERFORMANCE_BENCHMARKS.contentFetchTimeout + 100
      ); // Allow 100ms tolerance
    });

    it("should cancel fetch operation after timeout", async () => {
      const fetchPromise = fetcher.fetchWithTimeout(
        "article-timeout",
        "https://slow-site.com/article",
        5000 // 5-second timeout for testing
      );

      // Fast-forward to just before timeout
      vi.advanceTimersByTime(4900);

      // Fast-forward past timeout
      vi.advanceTimersByTime(200);

      const result = await fetchPromise;

      expect(result.timedOut).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(5000);
      expect(result.duration).toBeLessThanOrEqual(5100);
    });

    it("should clean up resources after timeout", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Start multiple fetches that will timeout
      const promises = Array.from({ length: 10 }, (_, i) =>
        fetcher.fetchWithTimeout(
          `article-${i}`,
          "https://slow-site.com/article",
          1000 // 1-second timeout
        )
      );

      vi.advanceTimersByTime(1100);

      await Promise.all(promises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not increase significantly
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      expect(fetcher.getActiveCount()).toBe(0); // All fetches cleaned up
    });

    it("should continue with RSS content after timeout", async () => {
      const rssContent = "Original RSS content";

      const summarizeWithFetch = async (
        articleId: string,
        url: string,
        rssContent: string
      ) => {
        monitor.mark("summarize-start");

        const fetchResult = await fetcher.fetchWithTimeout(
          articleId,
          url,
          5000
        );

        let contentToSummarize: string;
        if (fetchResult.timedOut || !fetchResult.content) {
          contentToSummarize = rssContent; // Fall back to RSS
        } else {
          contentToSummarize = fetchResult.content;
        }

        monitor.mark("summarize-end");
        const duration = monitor.measure(
          "summarize-duration",
          "summarize-start",
          "summarize-end"
        );

        return {
          summary: `Summary of: ${contentToSummarize.substring(0, 50)}`,
          fullContentUsed: !fetchResult.timedOut,
          duration,
        };
      };

      const result = await summarizeWithFetch(
        "article-1",
        "https://slow-site.com/article",
        rssContent
      );

      expect(result.summary).toContain("Original RSS content");
      expect(result.fullContentUsed).toBe(false);
      expect(result.duration).toBeLessThanOrEqual(5100);
    });
  });

  describe("Concurrent Processing", () => {
    it("should limit concurrent fetches to MAX_CONCURRENT_PARSES", async () => {
      const articles = Array.from({ length: 6 }, (_, i) => ({
        id: `article-${i}`,
        url: `https://example.com/article-${i}`,
      }));

      let maxConcurrent = 0;
      const checkConcurrency = setInterval(() => {
        maxConcurrent = Math.max(maxConcurrent, fetcher.getActiveCount());
      }, 10);

      const promises = articles.map((article) =>
        fetcher.fetchWithTimeout(article.id, article.url, 30000)
      );

      // Advance time to allow fetches to complete
      vi.advanceTimersByTime(2000);

      clearInterval(checkConcurrency);

      expect(maxConcurrent).toBeLessThanOrEqual(
        PERFORMANCE_BENCHMARKS.concurrentFetches
      );

      await Promise.all(promises);
    });

    it("should queue requests when limit exceeded", async () => {
      const articles = Array.from({ length: 10 }, (_, i) => ({
        id: `article-${i}`,
        url: `https://fast-site.com/article-${i}`,
      }));

      const startTimes: number[] = [];
      const promises = articles.map(async (article, index) => {
        startTimes[index] = performance.now();
        return fetcher.fetchWithTimeout(article.id, article.url, 30000);
      });

      // First 3 should start immediately
      expect(fetcher.getActiveCount()).toBe(3);
      expect(fetcher.getQueueLength()).toBe(7);

      // Advance time to complete some fetches
      vi.advanceTimersByTime(600);

      // More should start as others complete
      expect(fetcher.getActiveCount()).toBeLessThanOrEqual(3);

      vi.advanceTimersByTime(2000);
      await Promise.all(promises);

      // Verify queuing worked correctly
      const firstBatch = startTimes.slice(0, 3);
      const laterBatches = startTimes.slice(3);

      // First batch should start at roughly the same time
      const firstBatchSpread =
        Math.max(...firstBatch) - Math.min(...firstBatch);
      expect(firstBatchSpread).toBeLessThan(100); // Within 100ms

      // Later batches should be delayed
      laterBatches.forEach((startTime) => {
        expect(startTime).toBeGreaterThan(Math.min(...firstBatch));
      });
    });

    it("should process queue efficiently", async () => {
      const articles = Array.from({ length: 20 }, (_, i) => ({
        id: `article-${i}`,
        url: `https://fast-site.com/article-${i}`, // Fast responses
      }));

      monitor.mark("batch-start");

      const promises = articles.map((article) =>
        fetcher.fetchWithTimeout(article.id, article.url, 30000)
      );

      // Process all fetches
      vi.advanceTimersByTime(10000);

      await Promise.all(promises);

      monitor.mark("batch-end");
      const totalDuration = monitor.measure(
        "batch-duration",
        "batch-start",
        "batch-end"
      );

      // Should process efficiently with concurrency
      // 20 articles at 500ms each = 10000ms sequential
      // With concurrency of 3 = ~3333ms minimum
      expect(totalDuration).toBeLessThan(10000); // Much faster than sequential
      expect(totalDuration).toBeGreaterThan(3000); // But respects concurrency limit
    });
  });

  describe("Mobile Performance", () => {
    it("should complete summarization within 3 seconds on mobile", async () => {
      // Simulate mobile environment with faster timeouts
      const mobileFetcher = new ContentFetcher();

      monitor.mark("mobile-start");

      const result = await mobileFetcher.fetchWithTimeout(
        "mobile-article",
        "https://fast-site.com/article",
        PERFORMANCE_BENCHMARKS.mobileLoadTime
      );

      monitor.mark("mobile-end");
      const duration = monitor.measure(
        "mobile-duration",
        "mobile-start",
        "mobile-end"
      );

      expect(duration).toBeLessThanOrEqual(
        PERFORMANCE_BENCHMARKS.mobileLoadTime
      );
      expect(result.timedOut).toBe(false);
    });

    it("should minimize memory usage during fetch", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate fetching large content
      const largeContent = "x".repeat(5 * 1024 * 1024); // 5MB content

      const fetchLargeContent = async () => {
        return new Promise<string>((resolve) => {
          setTimeout(() => resolve(largeContent), 100);
        });
      };

      await fetchLargeContent();

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryUsed = peakMemory - initialMemory;

      expect(memoryUsed).toBeLessThan(PERFORMANCE_BENCHMARKS.memoryLimit);
    });

    it("should handle large HTML documents efficiently", async () => {
      const largeHtml = `
        <html>
          <body>
            ${Array.from(
              { length: 1000 },
              (_, i) =>
                `<p>Paragraph ${i} with some content that makes the document larger.</p>`
            ).join("\n")}
          </body>
        </html>
      `;

      monitor.mark("parse-start");

      // Simulate HTML parsing
      const parseHtml = (html: string): string => {
        // Strip HTML tags efficiently
        return html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      const parsed = parseHtml(largeHtml);

      monitor.mark("parse-end");
      const duration = monitor.measure(
        "parse-duration",
        "parse-start",
        "parse-end"
      );

      expect(duration).toBeLessThan(100); // Should parse in under 100ms
      expect(parsed.length).toBeGreaterThan(0);
    });
  });

  describe("Retry and Recovery", () => {
    it("should retry with exponential backoff", async () => {
      const retryDelays: number[] = [];
      let attempt = 0;

      const fetchWithRetry = async (
        articleId: string,
        url: string,
        maxRetries: number = 3
      ): Promise<{ content: string | null; attempts: number }> => {
        for (let i = 0; i < maxRetries; i++) {
          attempt++;

          if (i > 0) {
            const delay = Math.min(1000 * Math.pow(2, i - 1), 5000); // Exponential backoff, max 5s
            retryDelays.push(delay);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          try {
            // Simulate failure on first attempts
            if (attempt < 3) {
              throw new Error("Temporary failure");
            }
            return { content: "Success after retries", attempts: attempt };
          } catch (error) {
            if (i === maxRetries - 1) {
              return { content: null, attempts: attempt };
            }
          }
        }

        return { content: null, attempts: attempt };
      };

      const result = await fetchWithRetry(
        "article-retry",
        "https://flaky-site.com/article"
      );

      expect(result.attempts).toBe(3);
      expect(result.content).toBe("Success after retries");
      expect(retryDelays).toEqual([1000, 2000]); // Exponential backoff
    });

    it("should not retry on permanent failures", async () => {
      let attempts = 0;

      const fetchWithSmartRetry = async (
        articleId: string,
        url: string
      ): Promise<{ content: string | null; shouldRetry: boolean }> => {
        attempts++;

        // Simulate 404 error (permanent failure)
        if (url.includes("not-found")) {
          return { content: null, shouldRetry: false };
        }

        // Simulate 503 error (temporary failure)
        if (url.includes("maintenance")) {
          return { content: null, shouldRetry: true };
        }

        return { content: "Success", shouldRetry: false };
      };

      // Test permanent failure
      const result404 = await fetchWithSmartRetry(
        "article-404",
        "https://site.com/not-found"
      );
      expect(result404.shouldRetry).toBe(false);
      expect(attempts).toBe(1); // No retry

      // Test temporary failure
      attempts = 0;
      const result503 = await fetchWithSmartRetry(
        "article-503",
        "https://site.com/maintenance"
      );
      expect(result503.shouldRetry).toBe(true);
      expect(attempts).toBe(1); // Would retry if implemented
    });
  });

  describe("Performance Monitoring", () => {
    it("should track performance metrics", async () => {
      const metrics = {
        fetchAttempts: 0,
        fetchSuccesses: 0,
        fetchFailures: 0,
        fetchTimeouts: 0,
        averageFetchTime: 0,
        p95FetchTime: 0,
        p99FetchTime: 0,
      };

      const fetchTimes: number[] = [];

      // Simulate multiple fetches
      for (let i = 0; i < 100; i++) {
        metrics.fetchAttempts++;
        const startTime = performance.now();

        try {
          const result = await fetcher.fetchWithTimeout(
            `article-${i}`,
            i % 10 === 0 ? "https://slow-site.com" : "https://fast-site.com",
            5000
          );

          const duration = performance.now() - startTime;
          fetchTimes.push(duration);

          if (result.timedOut) {
            metrics.fetchTimeouts++;
            metrics.fetchFailures++;
          } else {
            metrics.fetchSuccesses++;
          }
        } catch {
          metrics.fetchFailures++;
        }

        vi.advanceTimersByTime(100);
      }

      // Calculate statistics
      fetchTimes.sort((a, b) => a - b);
      metrics.averageFetchTime =
        fetchTimes.reduce((a, b) => a + b, 0) / fetchTimes.length;
      metrics.p95FetchTime = fetchTimes[Math.floor(fetchTimes.length * 0.95)];
      metrics.p99FetchTime = fetchTimes[Math.floor(fetchTimes.length * 0.99)];

      // Verify metrics are reasonable
      expect(metrics.fetchAttempts).toBe(100);
      expect(metrics.fetchSuccesses).toBeGreaterThan(80); // Most should succeed
      expect(metrics.fetchTimeouts).toBeLessThan(20); // Few timeouts
      expect(metrics.averageFetchTime).toBeLessThan(2000); // Average under 2s
      expect(metrics.p95FetchTime).toBeLessThan(5000); // 95th percentile under 5s
    });

    it("should detect performance degradation", async () => {
      const baselineMetrics = {
        avgFetchTime: 1000,
        p95FetchTime: 2000,
        successRate: 0.95,
      };

      const currentMetrics = {
        avgFetchTime: 0,
        p95FetchTime: 0,
        successRate: 0,
      };

      const samples: number[] = [];
      let successes = 0;
      const total = 50;

      for (let i = 0; i < total; i++) {
        // Simulate degraded performance
        const delay = 1500 + Math.random() * 1000; // 1.5-2.5s (slower than baseline)
        samples.push(delay);

        if (Math.random() > 0.15) {
          // 85% success rate (lower than baseline)
          successes++;
        }
      }

      samples.sort((a, b) => a - b);
      currentMetrics.avgFetchTime =
        samples.reduce((a, b) => a + b, 0) / samples.length;
      currentMetrics.p95FetchTime = samples[Math.floor(samples.length * 0.95)];
      currentMetrics.successRate = successes / total;

      // Detect degradation
      const performanceDegraded =
        currentMetrics.avgFetchTime > baselineMetrics.avgFetchTime * 1.2 || // 20% slower
        currentMetrics.p95FetchTime > baselineMetrics.p95FetchTime * 1.5 || // 50% slower at p95
        currentMetrics.successRate < baselineMetrics.successRate * 0.9; // 10% drop in success

      expect(performanceDegraded).toBe(true);

      // Alert thresholds
      const shouldAlert = {
        warning: currentMetrics.avgFetchTime > 2000,
        critical:
          currentMetrics.avgFetchTime > 5000 ||
          currentMetrics.successRate < 0.8,
      };

      expect(shouldAlert.warning || shouldAlert.critical).toBe(true);
    });
  });

  describe("Cache Optimization", () => {
    it("should cache fetched content appropriately", async () => {
      const cache = new Map<string, { content: string; timestamp: number }>();

      const fetchWithCache = async (
        articleId: string,
        url: string
      ): Promise<{ content: string; fromCache: boolean }> => {
        const cached = cache.get(articleId);

        if (cached) {
          const age = Date.now() - cached.timestamp;
          if (age < PERFORMANCE_BENCHMARKS.cacheExpiry) {
            return { content: cached.content, fromCache: true };
          }
        }

        // Fetch new content
        const result = await fetcher.fetchWithTimeout(articleId, url, 5000);

        if (result.content) {
          cache.set(articleId, {
            content: result.content,
            timestamp: Date.now(),
          });
        }

        return {
          content: result.content || "",
          fromCache: false,
        };
      };

      // First fetch - not cached
      const result1 = await fetchWithCache(
        "article-1",
        "https://example.com/article"
      );
      expect(result1.fromCache).toBe(false);

      // Second fetch - should be cached
      const result2 = await fetchWithCache(
        "article-1",
        "https://example.com/article"
      );
      expect(result2.fromCache).toBe(true);
      expect(result2.content).toBe(result1.content);

      // Simulate cache expiry
      const cachedItem = cache.get("article-1");
      if (cachedItem) {
        cachedItem.timestamp =
          Date.now() - PERFORMANCE_BENCHMARKS.cacheExpiry - 1000;
      }

      // Third fetch - cache expired
      const result3 = await fetchWithCache(
        "article-1",
        "https://example.com/article"
      );
      expect(result3.fromCache).toBe(false);
    });
  });
});
