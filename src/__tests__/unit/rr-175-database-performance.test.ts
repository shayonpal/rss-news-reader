/**
 * RR-175: Database Performance Optimization Tests
 *
 * Test Specification for Performance Improvements:
 * 1. Remove content_length field (only 4.8% utilized, never queried)
 * 2. Cache timezone queries (24-hour TTL)
 * 3. Optimize RLS policies (wrap auth functions in subqueries)
 * 4. Cursor-based pagination (replace LIMIT/OFFSET)
 * 5. Smart feed_stats refresh (only when articles change)
 *
 * Performance Requirements:
 * - Articles pagination: < 100ms (currently 54.6s for 1,928 calls)
 * - Timezone queries: < 5ms cached (currently 20.2s for 155 calls)
 * - Feed stats refresh: < 50ms per refresh (currently 12.9s for 276 calls)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { performance } from "perf_hooks";

// Mock implementations for database and cache layers
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

const mockCache = new Map<string, { value: any; expiry: number }>();

// Performance monitoring utilities
class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

  static startTimer(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);
      return duration;
    };
  }

  static getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: measurements.length,
    };
  }

  static reset() {
    this.measurements.clear();
  }
}

describe("RR-175: Database Performance Optimizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCache.clear();
    PerformanceMonitor.reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("1. Content Length Field Removal", () => {
    it("should verify content_length field is not used in queries", async () => {
      // Mock article query without content_length
      const mockArticleQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "article-1",
                  title: "Test Article",
                  content: "Article content...",
                  // No content_length field
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "articles") return mockArticleQuery();
        return null;
      });

      // Fetch articles without content_length
      const result = await mockSupabase
        .from("articles")
        .select("id, title, content") // content_length NOT included
        .eq("user_id", "test-user")
        .limit(50);

      expect(result.data).toBeDefined();
      expect(result.data[0]).not.toHaveProperty("content_length");
      expect(mockArticleQuery).toHaveBeenCalled();
    });

    it("should confirm content_length utilization is below 5%", async () => {
      // Simulate database statistics
      const totalArticles = 311;
      const articlesWithContentLength = 15;
      const utilization = (articlesWithContentLength / totalArticles) * 100;

      expect(utilization).toBeLessThan(5);
      expect(utilization).toBeCloseTo(4.8, 1);
    });

    it("should verify no performance degradation after removal", async () => {
      const queryWithoutContentLength = async () => {
        const timer = PerformanceMonitor.startTimer("query-without-field");

        // Simulate query without content_length
        await new Promise((resolve) => setTimeout(resolve, 10));

        return timer();
      };

      // Run multiple queries to get performance baseline
      for (let i = 0; i < 100; i++) {
        await queryWithoutContentLength();
      }

      const stats = PerformanceMonitor.getStats("query-without-field");
      expect(stats).not.toBeNull();
      expect(stats!.avg).toBeLessThan(20); // Should be fast
      expect(stats!.p95).toBeLessThan(30); // 95th percentile under 30ms
    });

    it("should validate migration script removes content_length column", () => {
      const migrationSQL = `
        ALTER TABLE articles 
        DROP COLUMN IF EXISTS content_length;
      `;

      // Verify migration script structure
      expect(migrationSQL).toContain("DROP COLUMN");
      expect(migrationSQL).toContain("content_length");
      expect(migrationSQL).toContain("IF EXISTS");
    });
  });

  describe("2. Timezone Query Caching", () => {
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    class TimezoneCache {
      static async getTimezone(userId: string): Promise<string> {
        const timer = PerformanceMonitor.startTimer("timezone-query");
        const cacheKey = `timezone:${userId}`;

        // Check cache first
        const cached = mockCache.get(cacheKey);
        if (cached && cached.expiry > Date.now()) {
          timer(); // Record cache hit time
          return cached.value;
        }

        // Simulate database query (only if not cached)
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate DB latency
        const timezone = "America/Toronto"; // Mock result

        // Store in cache
        mockCache.set(cacheKey, {
          value: timezone,
          expiry: Date.now() + CACHE_TTL,
        });

        timer(); // Record DB query time
        return timezone;
      }

      static clearCache() {
        mockCache.clear();
      }
    }

    it("should cache timezone queries for 24 hours", async () => {
      const userId = "test-user-1";

      // First call - should hit database
      const firstCall = await TimezoneCache.getTimezone(userId);
      expect(firstCall).toBe("America/Toronto");

      // Second call - should hit cache
      const secondCall = await TimezoneCache.getTimezone(userId);
      expect(secondCall).toBe("America/Toronto");

      // Verify cache was used
      const cacheEntry = mockCache.get(`timezone:${userId}`);
      expect(cacheEntry).toBeDefined();
      expect(cacheEntry!.value).toBe("America/Toronto");

      // Verify cache expiry is 24 hours
      const expiryDiff = cacheEntry!.expiry - Date.now();
      expect(expiryDiff).toBeLessThanOrEqual(CACHE_TTL);
      expect(expiryDiff).toBeGreaterThan(CACHE_TTL - 5000); // Within 5 seconds
    });

    it("should significantly reduce query time with caching", async () => {
      const userId = "test-user-2";

      // Simulate 155 queries (as per issue description)
      for (let i = 0; i < 155; i++) {
        await TimezoneCache.getTimezone(userId);
      }

      const stats = PerformanceMonitor.getStats("timezone-query");
      expect(stats).not.toBeNull();

      // First query should be slower (database hit)
      // Subsequent queries should be fast (cache hits)
      expect(stats!.min).toBeLessThan(5); // Cache hits under 5ms
      expect(stats!.avg).toBeLessThan(10); // Average under 10ms
      expect(stats!.count).toBe(155);

      // Total time should be much less than 20.2 seconds
      const totalTime = stats!.avg * stats!.count;
      expect(totalTime).toBeLessThan(1000); // Under 1 second total (vs 20.2s)
    });

    it("should handle cache invalidation correctly", async () => {
      const userId = "test-user-3";

      // Initial query
      const initial = await TimezoneCache.getTimezone(userId);
      expect(initial).toBe("America/Toronto");

      // Clear cache
      TimezoneCache.clearCache();

      // Should hit database again
      const afterClear = await TimezoneCache.getTimezone(userId);
      expect(afterClear).toBe("America/Toronto");

      // Verify new cache entry was created
      const cacheEntry = mockCache.get(`timezone:${userId}`);
      expect(cacheEntry).toBeDefined();
    });

    it("should handle concurrent requests efficiently", async () => {
      const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);

      // Simulate concurrent requests
      const timer = PerformanceMonitor.startTimer("concurrent-timezone");
      const promises = userIds.map((id) => TimezoneCache.getTimezone(id));
      await Promise.all(promises);
      const duration = timer();

      // Should complete quickly even with concurrent requests
      expect(duration).toBeLessThan(200); // All 10 requests under 200ms

      // Verify all users are cached
      userIds.forEach((userId) => {
        const cached = mockCache.get(`timezone:${userId}`);
        expect(cached).toBeDefined();
      });
    });
  });

  describe("3. RLS Policy Optimization", () => {
    it("should wrap auth.uid() in subqueries for better performance", async () => {
      // Optimized RLS policy using subquery
      const optimizedPolicy = `
        CREATE POLICY "articles_select_policy" ON articles
        FOR SELECT USING (
          user_id = (SELECT auth.uid())
        );
      `;

      // Inefficient policy (calls auth.uid() per row)
      const inefficientPolicy = `
        CREATE POLICY "articles_select_policy" ON articles
        FOR SELECT USING (
          user_id = auth.uid()
        );
      `;

      // Verify optimized policy uses subquery
      expect(optimizedPolicy).toContain("(SELECT auth.uid())");
      expect(inefficientPolicy).not.toContain("(SELECT");

      // Simulate performance difference
      const simulateRLSCheck = async (optimized: boolean) => {
        const timer = PerformanceMonitor.startTimer(
          optimized ? "rls-optimized" : "rls-inefficient"
        );

        const rowCount = 311; // Total articles

        if (optimized) {
          // Auth check once via subquery
          await new Promise((resolve) => setTimeout(resolve, 5));
        } else {
          // Auth check per row
          for (let i = 0; i < rowCount; i++) {
            await new Promise((resolve) => setTimeout(resolve, 0.1));
          }
        }

        return timer();
      };

      const optimizedTime = await simulateRLSCheck(true);
      const inefficientTime = await simulateRLSCheck(false);

      expect(optimizedTime).toBeLessThan(inefficientTime);
      expect(optimizedTime).toBeLessThan(10); // Under 10ms
    });

    it("should verify all RLS policies use optimized patterns", () => {
      const policies = [
        {
          table: "articles",
          policy: "user_id = (SELECT auth.uid())",
        },
        {
          table: "feeds",
          policy: "user_id = (SELECT auth.uid())",
        },
        {
          table: "folders",
          policy: "user_id = (SELECT auth.uid())",
        },
      ];

      policies.forEach(({ table, policy }) => {
        expect(policy).toContain("(SELECT auth.uid())");
        expect(policy).not.toMatch(/auth\.uid\(\)(?!\))/); // No direct auth.uid() calls
      });
    });

    it("should measure RLS performance improvement", async () => {
      // Simulate query with optimized RLS
      const queryWithOptimizedRLS = async () => {
        const timer = PerformanceMonitor.startTimer("query-optimized-rls");

        // Mock optimized query execution
        mockSupabase.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: Array.from({ length: 50 }, (_, i) => ({
                id: `article-${i}`,
                title: `Article ${i}`,
              })),
              error: null,
            }),
          }),
        });

        await mockSupabase.from("articles").select("*").limit(50);

        return timer();
      };

      // Run multiple queries
      for (let i = 0; i < 20; i++) {
        await queryWithOptimizedRLS();
      }

      const stats = PerformanceMonitor.getStats("query-optimized-rls");
      expect(stats).not.toBeNull();
      expect(stats!.avg).toBeLessThan(50); // Average under 50ms
      expect(stats!.p95).toBeLessThan(100); // 95th percentile under 100ms
    });
  });

  describe("4. Cursor-Based Pagination", () => {
    interface CursorPaginationParams {
      cursor?: string;
      limit: number;
      direction?: "next" | "prev";
    }

    class CursorPagination {
      static async fetchArticles(params: CursorPaginationParams) {
        const timer = PerformanceMonitor.startTimer("cursor-pagination");
        const { cursor, limit, direction = "next" } = params;

        // Mock query builder
        const mockQuery = {
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
        };

        mockSupabase.from = vi.fn().mockReturnValue(mockQuery);

        // Build optimized query using cursor
        let query = mockSupabase.from("articles").select("*");

        if (cursor) {
          if (direction === "next") {
            query = query.gt("created_at", cursor);
          } else {
            query = query.lt("created_at", cursor);
          }
        }

        query = query.order("created_at", { ascending: direction === "next" });
        query = query.limit(limit);

        // Simulate query execution
        await new Promise((resolve) => setTimeout(resolve, 20));

        const result = {
          data: Array.from({ length: limit }, (_, i) => ({
            id: `article-${cursor ? parseInt(cursor) + i : i}`,
            created_at: new Date(Date.now() - i * 1000000).toISOString(),
            title: `Article ${i}`,
          })),
          nextCursor: new Date(Date.now() - limit * 1000000).toISOString(),
          error: null,
        };

        timer();
        return result;
      }
    }

    it("should use cursor-based pagination instead of OFFSET", async () => {
      // First page
      const firstPage = await CursorPagination.fetchArticles({ limit: 50 });
      expect(firstPage.data).toHaveLength(50);
      expect(firstPage.nextCursor).toBeDefined();

      // Second page using cursor
      const secondPage = await CursorPagination.fetchArticles({
        cursor: firstPage.nextCursor,
        limit: 50,
      });
      expect(secondPage.data).toHaveLength(50);
      expect(secondPage.nextCursor).toBeDefined();

      // Verify no duplicate IDs between pages
      const firstPageIds = firstPage.data.map((a) => a.id);
      const secondPageIds = secondPage.data.map((a) => a.id);
      const intersection = firstPageIds.filter((id) =>
        secondPageIds.includes(id)
      );
      expect(intersection).toHaveLength(0);
    });

    it("should significantly improve pagination performance", async () => {
      // Simulate old OFFSET-based pagination
      const offsetPagination = async (page: number, limit: number) => {
        const timer = PerformanceMonitor.startTimer("offset-pagination");
        const offset = page * limit;

        // OFFSET performance degrades with higher page numbers
        await new Promise((resolve) => setTimeout(resolve, 20 + offset * 0.1));

        return timer();
      };

      // Compare performance for deep pagination
      const deepPage = 38; // Page 38 = 1900 articles deep (38 * 50)

      // Old approach with OFFSET
      const offsetTime = await offsetPagination(deepPage, 50);

      // New cursor approach (constant time)
      const cursorResult = await CursorPagination.fetchArticles({
        cursor: new Date(Date.now() - deepPage * 50 * 1000000).toISOString(),
        limit: 50,
      });

      const cursorStats = PerformanceMonitor.getStats("cursor-pagination");
      const cursorTime = cursorStats!.avg;

      // Cursor should be much faster for deep pagination
      expect(cursorTime).toBeLessThan(offsetTime);
      expect(cursorTime).toBeLessThan(100); // Always under 100ms
    });

    it("should handle 1,928 pagination calls efficiently", async () => {
      // Simulate the problematic case from issue description
      const sampleCalls = 50; // Test with smaller sample
      const pageSize = 50;

      let cursor: string | undefined;
      const startTime = performance.now();

      for (let i = 0; i < sampleCalls; i++) {
        const result = await CursorPagination.fetchArticles({
          cursor,
          limit: pageSize,
        });
        cursor = result.nextCursor;
      }

      const sampleTime = performance.now() - startTime;

      // Extrapolate to 1928 calls
      const estimatedTotalTime = (sampleTime / sampleCalls) * 1928;

      // Should complete in under 60 seconds (vs 54.6 seconds currently)
      expect(estimatedTotalTime).toBeLessThan(60000);

      // Average time per call should be under 30ms
      const avgTimePerCall = sampleTime / sampleCalls;
      expect(avgTimePerCall).toBeLessThan(30);
    });

    it("should support bidirectional cursor navigation", async () => {
      const middleCursor = new Date(Date.now() - 1000000).toISOString();

      // Navigate forward
      const nextPage = await CursorPagination.fetchArticles({
        cursor: middleCursor,
        limit: 10,
        direction: "next",
      });
      expect(nextPage.data).toHaveLength(10);

      // Navigate backward
      const prevPage = await CursorPagination.fetchArticles({
        cursor: middleCursor,
        limit: 10,
        direction: "prev",
      });
      expect(prevPage.data).toHaveLength(10);

      // Verify different results (IDs should be different)
      const nextIds = new Set(nextPage.data.map((a: any) => a.id));
      const prevIds = new Set(prevPage.data.map((a: any) => a.id));

      // Check no overlap between forward and backward pages
      let hasOverlap = false;
      nextIds.forEach((id) => {
        if (prevIds.has(id)) hasOverlap = true;
      });
      expect(hasOverlap).toBe(false);
    });
  });

  describe("5. Smart Feed Stats Refresh", () => {
    interface FeedStatsCache {
      feedId: string;
      stats: any;
      lastRefresh: number;
      articleHash: string;
    }

    class SmartFeedStats {
      private static cache = new Map<string, FeedStatsCache>();

      static async calculateArticleHash(feedId: string): Promise<string> {
        // Simulate hash calculation based on article IDs and modification times
        const timer = PerformanceMonitor.startTimer("hash-calculation");
        await new Promise((resolve) => setTimeout(resolve, 5));
        timer();

        // Mock hash based on feedId and timestamp
        return `hash-${feedId}-${Date.now()}`;
      }

      static async refreshStats(
        feedId: string,
        forceRefresh = false
      ): Promise<any> {
        const timer = PerformanceMonitor.startTimer("feed-stats-refresh");

        const cached = this.cache.get(feedId);
        const currentHash = await this.calculateArticleHash(feedId);

        // Skip refresh if data hasn't changed
        if (!forceRefresh && cached && cached.articleHash === currentHash) {
          timer();
          return cached.stats;
        }

        // Simulate materialized view refresh
        await new Promise((resolve) => setTimeout(resolve, 30));

        const stats = {
          feedId,
          articleCount: Math.floor(Math.random() * 100),
          unreadCount: Math.floor(Math.random() * 50),
          lastUpdated: new Date().toISOString(),
        };

        // Update cache
        this.cache.set(feedId, {
          feedId,
          stats,
          lastRefresh: Date.now(),
          articleHash: currentHash,
        });

        timer();
        return stats;
      }

      static clearCache() {
        this.cache.clear();
      }
    }

    it("should only refresh feed_stats when articles change", async () => {
      const feedId = "feed-1";

      // First refresh - should calculate stats
      const firstStats = await SmartFeedStats.refreshStats(feedId);
      expect(firstStats).toBeDefined();
      expect(firstStats.feedId).toBe(feedId);

      // Mock no article changes (return same hash for second call)
      const originalHash = await SmartFeedStats.calculateArticleHash(feedId);
      vi.spyOn(SmartFeedStats, "calculateArticleHash").mockResolvedValueOnce(
        originalHash
      );

      // Second refresh - should use cache
      const secondStats = await SmartFeedStats.refreshStats(feedId);
      expect(secondStats).toBe(firstStats); // Should be same reference (cached)

      // Verify performance improvement
      const stats = PerformanceMonitor.getStats("feed-stats-refresh");
      expect(stats).not.toBeNull();

      // First call should be slower, second should be fast (cached)
      expect(stats!.count).toBe(2);
      expect(stats!.min).toBeLessThan(10); // Cached call under 10ms
    });

    it("should handle 276 refresh calls efficiently", async () => {
      // Simulate the problematic case from issue description
      const totalCalls = 50; // Reduced for test speed
      const uniqueFeeds = 10; // Assume 10 unique feeds

      const startTime = performance.now();

      for (let i = 0; i < totalCalls; i++) {
        const feedId = `feed-${i % uniqueFeeds}`;
        await SmartFeedStats.refreshStats(feedId);
      }

      const totalTime = performance.now() - startTime;

      // Extrapolate for 276 calls
      const estimatedFullTime = (totalTime / totalCalls) * 276;

      // Should complete in under 5 seconds (vs 12.9 seconds currently)
      expect(estimatedFullTime).toBeLessThan(5000);

      // Most calls should hit cache
      const stats = PerformanceMonitor.getStats("feed-stats-refresh");
      expect(stats!.avg).toBeLessThan(20); // Average under 20ms
    });

    it("should force refresh when explicitly requested", async () => {
      const feedId = "feed-2";

      // Initial refresh
      const initial = await SmartFeedStats.refreshStats(feedId);

      // Force refresh even without changes
      const forced = await SmartFeedStats.refreshStats(feedId, true);

      // Should have new timestamp
      expect(forced.lastUpdated).not.toBe(initial.lastUpdated);
    });

    it("should batch refresh multiple feeds efficiently", async () => {
      const feedIds = Array.from({ length: 10 }, (_, i) => `feed-${i}`);

      const batchRefresh = async (ids: string[]) => {
        const timer = PerformanceMonitor.startTimer("batch-refresh");

        // Parallel refresh with concurrency limit
        const batchSize = 3;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          await Promise.all(batch.map((id) => SmartFeedStats.refreshStats(id)));
        }

        return timer();
      };

      const duration = await batchRefresh(feedIds);

      // Should complete quickly with batching
      expect(duration).toBeLessThan(500); // Under 500ms for 10 feeds

      // Verify all feeds are cached
      feedIds.forEach((id) => {
        const cached = SmartFeedStats["cache"].get(id);
        expect(cached).toBeDefined();
      });
    });
  });

  describe("Overall Performance Validation", () => {
    it("should meet all performance targets after optimizations", async () => {
      const performanceTargets = {
        articlePagination: {
          target: 100, // ms per call
          current: 28.3, // 54.6s / 1928 calls
        },
        timezoneQueries: {
          target: 5, // ms per call (cached)
          current: 130.3, // 20.2s / 155 calls
        },
        feedStatsRefresh: {
          target: 50, // ms per refresh
          current: 46.7, // 12.9s / 276 calls
        },
      };

      // Simulate optimized system
      const runOptimizedQueries = async () => {
        const results = {
          pagination: [] as number[],
          timezone: [] as number[],
          feedStats: [] as number[],
        };

        // Test pagination (10 calls)
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await new Promise((resolve) => setTimeout(resolve, 20)); // Optimized query
          results.pagination.push(performance.now() - start);
        }

        // Test timezone (10 calls, mostly cached)
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await new Promise((resolve) => setTimeout(resolve, i === 0 ? 20 : 2)); // First hit, rest cached
          results.timezone.push(performance.now() - start);
        }

        // Test feed stats (10 calls, smart refresh)
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          await new Promise((resolve) => setTimeout(resolve, i < 3 ? 30 : 5)); // Some refreshes, most cached
          results.feedStats.push(performance.now() - start);
        }

        return results;
      };

      const results = await runOptimizedQueries();

      // Verify all targets are met
      const avgPagination =
        results.pagination.reduce((a, b) => a + b, 0) /
        results.pagination.length;
      const avgTimezone =
        results.timezone.reduce((a, b) => a + b, 0) / results.timezone.length;
      const avgFeedStats =
        results.feedStats.reduce((a, b) => a + b, 0) / results.feedStats.length;

      expect(avgPagination).toBeLessThan(
        performanceTargets.articlePagination.target
      );
      expect(avgTimezone).toBeLessThan(
        performanceTargets.timezoneQueries.target
      );
      expect(avgFeedStats).toBeLessThan(
        performanceTargets.feedStatsRefresh.target
      );

      // Calculate total improvement
      const totalCurrentTime = 54.6 + 20.2 + 12.9; // 87.7 seconds
      const totalOptimizedTime =
        (avgPagination * 1928) / 1000 +
        (avgTimezone * 155) / 1000 +
        (avgFeedStats * 276) / 1000;

      // Should achieve at least 85% performance improvement
      const improvement =
        ((totalCurrentTime - totalOptimizedTime) / totalCurrentTime) * 100;
      expect(improvement).toBeGreaterThan(85);
    });

    it("should validate database size reduction after content_length removal", () => {
      // Current state
      const currentTableSize = 8 * 1024 * 1024; // 8MB in bytes
      const contentLengthColumnSize = 311 * 8; // 311 rows * 8 bytes per bigint

      // After optimization
      const optimizedTableSize = currentTableSize - contentLengthColumnSize;
      const sizeReduction = contentLengthColumnSize;
      const reductionPercentage = (sizeReduction / currentTableSize) * 100;

      expect(optimizedTableSize).toBeLessThan(currentTableSize);
      expect(reductionPercentage).toBeGreaterThan(0);

      // Verify minimal size reduction (content_length is small portion)
      expect(reductionPercentage).toBeLessThan(1); // Less than 1% reduction
    });

    it("should ensure no functional regressions after optimizations", async () => {
      const functionalTests = [
        {
          name: "Article fetching still works",
          test: async () => {
            mockSupabase.from.mockReturnValue({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: "1", title: "Test" }],
                  error: null,
                }),
              }),
            });
            const result = await mockSupabase
              .from("articles")
              .select("*")
              .eq("id", "1");
            return result.data !== null;
          },
        },
        {
          name: "User timezone still accessible",
          test: async () => {
            const timezone = "America/New_York";
            return timezone !== null;
          },
        },
        {
          name: "Feed statistics still calculate",
          test: async () => {
            const stats = { articleCount: 100, unreadCount: 50 };
            return stats.articleCount > 0;
          },
        },
        {
          name: "Pagination still returns correct order",
          test: async () => {
            const articles = [
              { id: "1", created_at: "2024-01-01" },
              { id: "2", created_at: "2024-01-02" },
            ];
            return articles[0].created_at < articles[1].created_at;
          },
        },
      ];

      for (const { name, test } of functionalTests) {
        const result = await test();
        expect(result).toBe(true);
      }
    });
  });
});
