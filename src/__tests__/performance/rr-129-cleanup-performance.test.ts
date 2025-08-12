import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getAdminClient } from "@/lib/db/supabase-admin";

/**
 * RR-129: Performance tests for cleanup operations
 * Tests that cleanup operations meet performance requirements and scale appropriately
 */
describe("RR-129: Cleanup Performance Tests", () => {
  const supabase = getAdminClient();
  const TEST_USER_ID = "test-user-rr129-performance";

  // Test data tracking
  const createdFeeds: string[] = [];
  const createdArticles: string[] = [];

  // Performance baselines (in milliseconds)
  const PERFORMANCE_TARGETS = {
    TRACKING_INSERT_BATCH_100: 1000, // Track 100 deletions < 1s
    TRACKING_INSERT_BATCH_1000: 5000, // Track 1000 deletions < 5s
    TRACKING_LOOKUP_1000: 500, // Lookup in 1000 tracked items < 500ms
    TRACKING_LOOKUP_10000: 1500, // Lookup in 10k tracked items < 1.5s
    CLEANUP_DELETE_100: 2000, // Delete 100 articles < 2s
    CLEANUP_DELETE_1000: 10000, // Delete 1000 articles < 10s
    SYNC_FILTER_1000: 1000, // Filter 1000 articles < 1s
    SYNC_FILTER_5000: 3000, // Filter 5000 articles < 3s
    TRACKING_CLEANUP_OLD: 5000, // Cleanup old entries < 5s
    CASCADE_DELETE_LARGE_FEED: 15000, // Delete feed with 1000 articles < 15s
  };

  beforeAll(async () => {
    // Create test user
    await supabase.from("users").upsert(
      {
        id: TEST_USER_ID,
        email: "rr129-perf-test@example.com",
        inoreader_id: "rr129-perf-inoreader-id",
      },
      { onConflict: "id" }
    );

    // Verify tables exist
    const { error: deletedTableError } = await supabase
      .from("deleted_articles")
      .select("*")
      .limit(1);

    expect(deletedTableError).toBeNull();
  });

  afterAll(async () => {
    // Clean up all test data
    if (createdArticles.length > 0) {
      await supabase.from("articles").delete().in("id", createdArticles);
    }

    if (createdFeeds.length > 0) {
      await supabase.from("feeds").delete().in("id", createdFeeds);
    }

    await supabase.from("users").delete().eq("id", TEST_USER_ID);
    await supabase
      .from("deleted_articles")
      .delete()
      .like("inoreader_id", "test-rr129-perf-%");
  });

  beforeEach(async () => {
    // Clear test data before each test
    await supabase
      .from("articles")
      .delete()
      .like("inoreader_id", "test-rr129-perf-%");
    await supabase
      .from("feeds")
      .delete()
      .like("inoreader_id", "test-rr129-perf-%");
    await supabase
      .from("deleted_articles")
      .delete()
      .like("inoreader_id", "test-rr129-perf-%");

    createdFeeds.length = 0;
    createdArticles.length = 0;
  });

  // Helper function to create test data
  const createTestData = async (
    articleCount: number,
    feedCount: number = 1
  ) => {
    // Create feeds
    const feedsData = Array.from({ length: feedCount }, (_, i) => ({
      user_id: TEST_USER_ID,
      inoreader_id: `test-rr129-perf-feed-${i}`,
      title: `Performance Test Feed ${i}`,
      url: `https://example.com/perf-feed-${i}.xml`,
      unread_count: Math.floor(articleCount / feedCount),
    }));

    const { data: feeds, error: feedsError } = await supabase
      .from("feeds")
      .insert(feedsData)
      .select();

    expect(feedsError).toBeNull();
    feeds?.forEach((feed) => createdFeeds.push(feed.id));

    // Create articles distributed across feeds
    const articlesData = [];
    for (let i = 0; i < articleCount; i++) {
      const feedIndex = i % feedCount;
      articlesData.push({
        feed_id: feeds![feedIndex].id,
        inoreader_id: `test-rr129-perf-article-${i}`,
        title: `Performance Article ${i}`,
        content: `Performance test content ${i} - ${"x".repeat(500)}`, // ~500 char content
        is_read: i % 3 === 0, // 33% read
        is_starred: i % 20 === 0, // 5% starred
        published_at: new Date(Date.now() - i * 1000).toISOString(),
      });
    }

    // Insert in batches to avoid timeout
    const batchSize = 500;
    const allArticles = [];

    for (let i = 0; i < articlesData.length; i += batchSize) {
      const batch = articlesData.slice(i, i + batchSize);
      const { data: batchArticles, error: batchError } = await supabase
        .from("articles")
        .insert(batch)
        .select("id");

      expect(batchError).toBeNull();
      if (batchArticles) {
        allArticles.push(...batchArticles);
      }
    }

    allArticles.forEach((article) => createdArticles.push(article.id));

    return { feeds: feeds!, articles: allArticles };
  };

  describe("Tracking Table Performance", () => {
    it("should insert tracking records in batches efficiently", async () => {
      const batchSizes = [100, 500, 1000];

      for (const batchSize of batchSizes) {
        const trackingData = Array.from({ length: batchSize }, (_, i) => ({
          inoreader_id: `test-rr129-perf-tracking-${batchSize}-${i}`,
          was_read: true,
          feed_id: `perf-feed-${i % 10}`,
        }));

        const startTime = Date.now();

        const { error } = await supabase
          .from("deleted_articles")
          .upsert(trackingData, { onConflict: "inoreader_id" });

        const insertTime = Date.now() - startTime;

        expect(error).toBeNull();

        // Performance assertions based on batch size
        if (batchSize <= 100) {
          expect(insertTime).toBeLessThan(
            PERFORMANCE_TARGETS.TRACKING_INSERT_BATCH_100
          );
        } else if (batchSize <= 1000) {
          expect(insertTime).toBeLessThan(
            PERFORMANCE_TARGETS.TRACKING_INSERT_BATCH_1000
          );
        }

        console.log(`Tracking insert batch ${batchSize}: ${insertTime}ms`);
      }
    });

    it("should perform fast lookups in large tracking tables", async () => {
      const trackingCounts = [1000, 5000, 10000];

      for (const trackingCount of trackingCounts) {
        // Create large tracking dataset
        const trackingData = Array.from({ length: trackingCount }, (_, i) => ({
          inoreader_id: `test-rr129-perf-lookup-${trackingCount}-${i}`,
          was_read: true,
          feed_id: `lookup-feed-${i % 100}`,
        }));

        await supabase.from("deleted_articles").insert(trackingData);

        // Test lookup performance
        const lookupIds = Array.from(
          { length: 100 },
          (_, i) => `test-rr129-perf-lookup-${trackingCount}-${i * 10}`
        );

        const startTime = Date.now();

        const { data, error } = await supabase
          .from("deleted_articles")
          .select("inoreader_id")
          .in("inoreader_id", lookupIds);

        const lookupTime = Date.now() - startTime;

        expect(error).toBeNull();
        expect(data).toBeDefined();

        // Performance assertions
        if (trackingCount <= 1000) {
          expect(lookupTime).toBeLessThan(
            PERFORMANCE_TARGETS.TRACKING_LOOKUP_1000
          );
        } else if (trackingCount <= 10000) {
          expect(lookupTime).toBeLessThan(
            PERFORMANCE_TARGETS.TRACKING_LOOKUP_10000
          );
        }

        console.log(
          `Tracking lookup (${trackingCount} entries): ${lookupTime}ms`
        );

        // Cleanup for next iteration
        await supabase
          .from("deleted_articles")
          .delete()
          .like("inoreader_id", `test-rr129-perf-lookup-${trackingCount}-%`);
      }
    });

    it("should cleanup old tracking entries efficiently", async () => {
      // Create mix of old and recent entries
      const oldTimestamp = new Date(
        Date.now() - 120 * 24 * 60 * 60 * 1000
      ).toISOString(); // 120 days old
      const recentTimestamp = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString(); // 30 days old

      const oldEntries = Array.from({ length: 1000 }, (_, i) => ({
        inoreader_id: `test-rr129-perf-cleanup-old-${i}`,
        was_read: true,
        feed_id: "cleanup-feed",
        deleted_at: oldTimestamp,
      }));

      const recentEntries = Array.from({ length: 500 }, (_, i) => ({
        inoreader_id: `test-rr129-perf-cleanup-recent-${i}`,
        was_read: true,
        feed_id: "cleanup-feed",
        deleted_at: recentTimestamp,
      }));

      // Insert test data
      await supabase
        .from("deleted_articles")
        .insert([...oldEntries, ...recentEntries]);

      // Test cleanup performance
      const cutoffDate = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000
      ).toISOString();
      const startTime = Date.now();

      const { error, count } = await supabase
        .from("deleted_articles")
        .delete()
        .lt("deleted_at", cutoffDate);

      const cleanupTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(count).toBe(1000); // Should delete all old entries
      expect(cleanupTime).toBeLessThan(
        PERFORMANCE_TARGETS.TRACKING_CLEANUP_OLD
      );

      console.log(`Tracking cleanup (1000 old entries): ${cleanupTime}ms`);
    });
  });

  describe("Article Cleanup Performance", () => {
    it("should delete large numbers of articles efficiently", async () => {
      const deletionSizes = [100, 500, 1000];

      for (const deletionSize of deletionSizes) {
        // Create test data
        await createTestData(deletionSize * 2); // Create 2x articles so we have some to delete

        // Identify articles to delete (read, unstarred)
        const { data: toDelete } = await supabase
          .from("articles")
          .select("id, inoreader_id, feed_id")
          .eq("is_read", true)
          .eq("is_starred", false)
          .limit(deletionSize);

        expect(toDelete!.length).toBeGreaterThanOrEqual(deletionSize * 0.8); // Should have enough to delete

        // Track deletions first
        const trackingData = toDelete!.map((article) => ({
          inoreader_id: article.inoreader_id,
          was_read: true,
          feed_id: article.feed_id,
        }));

        await supabase
          .from("deleted_articles")
          .upsert(trackingData, { onConflict: "inoreader_id" });

        // Measure deletion performance
        const startTime = Date.now();

        const { error, count } = await supabase
          .from("articles")
          .delete()
          .in(
            "id",
            toDelete!.map((a) => a.id)
          );

        const deleteTime = Date.now() - startTime;

        expect(error).toBeNull();
        expect(count).toBe(toDelete!.length);

        // Performance assertions
        if (deletionSize <= 100) {
          expect(deleteTime).toBeLessThan(
            PERFORMANCE_TARGETS.CLEANUP_DELETE_100
          );
        } else if (deletionSize <= 1000) {
          expect(deleteTime).toBeLessThan(
            PERFORMANCE_TARGETS.CLEANUP_DELETE_1000
          );
        }

        console.log(`Article deletion (${count} articles): ${deleteTime}ms`);

        // Update tracking (remove deleted articles)
        createdArticles.length = 0;
        const { data: remaining } = await supabase
          .from("articles")
          .select("id")
          .like("inoreader_id", "test-rr129-perf-%");
        remaining?.forEach((a) => createdArticles.push(a.id));
      }
    });

    it("should handle CASCADE deletion performance for large feeds", async () => {
      // Create feed with many articles
      const articleCount = 1000;
      const { feeds } = await createTestData(articleCount, 1);

      const feed = feeds[0];

      // Measure CASCADE deletion time
      const startTime = Date.now();

      const { error } = await supabase.from("feeds").delete().eq("id", feed.id);

      const cascadeTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(cascadeTime).toBeLessThan(
        PERFORMANCE_TARGETS.CASCADE_DELETE_LARGE_FEED
      );

      console.log(
        `CASCADE deletion (1 feed, ${articleCount} articles): ${cascadeTime}ms`
      );

      // Verify articles were deleted
      const { count } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("feed_id", feed.id);

      expect(count).toBe(0);

      // Clear tracking since items are deleted
      createdFeeds.length = 0;
      createdArticles.length = 0;
    });
  });

  describe("Sync Filtering Performance", () => {
    it("should filter sync articles efficiently with large tracking sets", async () => {
      const filterSizes = [1000, 2500, 5000];

      for (const filterSize of filterSizes) {
        // Create large tracking dataset
        const trackingData = Array.from({ length: filterSize }, (_, i) => ({
          inoreader_id: `test-rr129-perf-filter-${filterSize}-${i}`,
          was_read: true,
          feed_id: `filter-feed-${i % 10}`,
        }));

        await supabase.from("deleted_articles").insert(trackingData);

        // Simulate sync filtering (lookup + logic)
        const syncArticleIds = Array.from(
          { length: Math.floor(filterSize * 1.2) },
          (_, i) => `test-rr129-perf-filter-${filterSize}-${i}`
        );

        const startTime = Date.now();

        // Step 1: Lookup deleted IDs (main performance bottleneck)
        const { data: deletedData } = await supabase
          .from("deleted_articles")
          .select("inoreader_id")
          .in("inoreader_id", syncArticleIds);

        const deletedIds = new Set(
          deletedData?.map((d) => d.inoreader_id) || []
        );

        // Step 2: Filter logic (fast in-memory operations)
        const filteredArticles = syncArticleIds.filter((id) => {
          const isDeleted = deletedIds.has(id);
          const isStillRead = true; // Simulate read articles

          // Skip if deleted and still read
          return !(isDeleted && isStillRead);
        });

        const filterTime = Date.now() - startTime;

        // Performance assertions
        if (filterSize <= 1000) {
          expect(filterTime).toBeLessThan(PERFORMANCE_TARGETS.SYNC_FILTER_1000);
        } else if (filterSize <= 5000) {
          expect(filterTime).toBeLessThan(PERFORMANCE_TARGETS.SYNC_FILTER_5000);
        }

        expect(filteredArticles.length).toBeLessThan(syncArticleIds.length); // Some should be filtered

        console.log(
          `Sync filtering (${filterSize} tracking entries, ${syncArticleIds.length} articles): ${filterTime}ms`
        );

        // Cleanup
        await supabase
          .from("deleted_articles")
          .delete()
          .like("inoreader_id", `test-rr129-perf-filter-${filterSize}-%`);
      }
    });

    it("should maintain performance with concurrent sync operations", async () => {
      const concurrentSyncs = 3;
      const articlesPerSync = 500;

      // Create tracking data
      const trackingData = Array.from({ length: 1000 }, (_, i) => ({
        inoreader_id: `test-rr129-perf-concurrent-${i}`,
        was_read: true,
        feed_id: "concurrent-feed",
      }));

      await supabase.from("deleted_articles").insert(trackingData);

      // Simulate concurrent sync operations
      const syncPromises = Array.from(
        { length: concurrentSyncs },
        async (_, syncIndex) => {
          const syncArticleIds = Array.from(
            { length: articlesPerSync },
            (_, i) =>
              `test-rr129-perf-concurrent-${syncIndex * articlesPerSync + i}`
          );

          const startTime = Date.now();

          const { data: deletedData } = await supabase
            .from("deleted_articles")
            .select("inoreader_id")
            .in("inoreader_id", syncArticleIds);

          const syncTime = Date.now() - startTime;

          return { syncIndex, syncTime, resultCount: deletedData?.length || 0 };
        }
      );

      const results = await Promise.all(syncPromises);

      // All syncs should complete in reasonable time
      results.forEach((result) => {
        expect(result.syncTime).toBeLessThan(2000); // 2 seconds per concurrent sync
        console.log(
          `Concurrent sync ${result.syncIndex}: ${result.syncTime}ms, ${result.resultCount} found`
        );
      });

      const maxSyncTime = Math.max(...results.map((r) => r.syncTime));
      expect(maxSyncTime).toBeLessThan(3000); // Slowest sync should still be fast
    });
  });

  describe("Database Size Impact and Scalability", () => {
    it("should demonstrate storage efficiency improvements", async () => {
      const testSizes = [500, 1000, 2000];

      for (const testSize of testSizes) {
        // Create articles
        await createTestData(testSize);

        // Measure initial size (approximate by counting)
        const { count: initialCount } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true })
          .like("inoreader_id", "test-rr129-perf-%");

        expect(initialCount).toBe(testSize);

        // Perform cleanup
        const { data: toDelete } = await supabase
          .from("articles")
          .select("inoreader_id, feed_id")
          .eq("is_read", true)
          .eq("is_starred", false);

        const deleteStartTime = Date.now();

        // Track and delete
        if (toDelete && toDelete.length > 0) {
          await supabase.from("deleted_articles").upsert(
            toDelete.map((a) => ({
              inoreader_id: a.inoreader_id,
              was_read: true,
              feed_id: a.feed_id,
            })),
            { onConflict: "inoreader_id" }
          );

          await supabase
            .from("articles")
            .delete()
            .eq("is_read", true)
            .eq("is_starred", false);
        }

        const deleteTime = Date.now() - deleteStartTime;

        // Measure final size
        const { count: finalCount } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true })
          .like("inoreader_id", "test-rr129-perf-%");

        const reductionPercentage =
          ((initialCount - finalCount!) / initialCount) * 100;
        const deletedCount = initialCount - finalCount!;

        expect(reductionPercentage).toBeGreaterThan(20); // At least 20% reduction
        expect(deleteTime).toBeLessThan(10000); // Cleanup should be fast

        console.log(
          `Storage efficiency (${testSize} articles): ${reductionPercentage.toFixed(1)}% reduction, ${deletedCount} deleted in ${deleteTime}ms`
        );

        // Clear for next iteration
        createdArticles.length = 0;
        createdFeeds.length = 0;
      }
    });

    it("should scale linearly with database growth", async () => {
      const scaleSizes = [500, 1000, 2000];
      const performanceMetrics = [];

      for (const scaleSize of scaleSizes) {
        await createTestData(scaleSize);

        // Measure end-to-end cleanup performance
        const startTime = Date.now();

        // Get deletable articles
        const { data: toDelete } = await supabase
          .from("articles")
          .select("id, inoreader_id, feed_id")
          .eq("is_read", true)
          .eq("is_starred", false);

        // Track them
        if (toDelete && toDelete.length > 0) {
          await supabase.from("deleted_articles").upsert(
            toDelete.map((a) => ({
              inoreader_id: a.inoreader_id,
              was_read: true,
              feed_id: a.feed_id,
            })),
            { onConflict: "inoreader_id" }
          );

          // Delete them
          await supabase
            .from("articles")
            .delete()
            .in(
              "id",
              toDelete.map((a) => a.id)
            );
        }

        const totalTime = Date.now() - startTime;
        const timePerArticle = totalTime / scaleSize;

        performanceMetrics.push({
          size: scaleSize,
          totalTime,
          timePerArticle,
          deletedCount: toDelete?.length || 0,
        });

        console.log(
          `Scale test ${scaleSize}: ${totalTime}ms total, ${timePerArticle.toFixed(2)}ms per article`
        );

        // Clear for next iteration
        createdArticles.length = 0;
        createdFeeds.length = 0;
      }

      // Check that performance scales reasonably
      const small = performanceMetrics[0];
      const large = performanceMetrics[performanceMetrics.length - 1];

      // Performance should not degrade exponentially
      const scaleFactor = large.size / small.size;
      const timeIncrease = large.totalTime / small.totalTime;

      expect(timeIncrease).toBeLessThan(scaleFactor * 2); // Should be roughly linear, allow 2x buffer

      console.log(
        `Scale factor: ${scaleFactor}x size, ${timeIncrease.toFixed(2)}x time`
      );
    });
  });

  describe("Memory and Resource Usage", () => {
    it("should maintain stable memory usage during large operations", async () => {
      const largeDatasetSize = 2000;

      // Monitor memory usage pattern (Note: This is approximate in test environment)
      const initialMemory = process.memoryUsage();

      // Create large dataset
      await createTestData(largeDatasetSize, 5); // 5 feeds with 400 articles each

      const afterCreationMemory = process.memoryUsage();

      // Perform batch operations
      const { data: toDelete } = await supabase
        .from("articles")
        .select("id, inoreader_id, feed_id")
        .eq("is_read", true)
        .eq("is_starred", false);

      // Large batch tracking operation
      if (toDelete && toDelete.length > 0) {
        await supabase.from("deleted_articles").upsert(
          toDelete.map((a) => ({
            inoreader_id: a.inoreader_id,
            was_read: true,
            feed_id: a.feed_id,
          })),
          { onConflict: "inoreader_id" }
        );

        // Large batch deletion
        await supabase
          .from("articles")
          .delete()
          .in(
            "id",
            toDelete.map((a) => a.id)
          );
      }

      const finalMemory = process.memoryUsage();

      // Memory usage should not grow excessively
      const heapIncrease =
        (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      expect(heapIncrease).toBeLessThan(100); // Should not use more than 100MB additional heap

      console.log(
        `Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB, Increase: ${heapIncrease.toFixed(1)}MB`
      );

      // Verify operations completed successfully
      expect(toDelete!.length).toBeGreaterThan(0);
    });

    it("should handle resource cleanup properly", async () => {
      const resourceTestSize = 1000;

      // Create and immediately cleanup resources multiple times
      for (let iteration = 0; iteration < 5; iteration++) {
        await createTestData(resourceTestSize);

        // Full cleanup cycle
        const { data: toDelete } = await supabase
          .from("articles")
          .select("inoreader_id, feed_id")
          .eq("is_read", true)
          .eq("is_starred", false);

        if (toDelete && toDelete.length > 0) {
          await supabase.from("deleted_articles").upsert(
            toDelete.map((a) => ({
              inoreader_id: a.inoreader_id,
              was_read: true,
              feed_id: a.feed_id,
            })),
            { onConflict: "inoreader_id" }
          );

          await supabase
            .from("articles")
            .delete()
            .eq("is_read", true)
            .eq("is_starred", false);
        }

        // Cleanup feeds
        await supabase
          .from("feeds")
          .delete()
          .like("inoreader_id", "test-rr129-perf-%");

        // Clear tracking
        createdArticles.length = 0;
        createdFeeds.length = 0;
      }

      // Verify clean state
      const { count: remainingArticles } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .like("inoreader_id", "test-rr129-perf-%");

      const { count: remainingFeeds } = await supabase
        .from("feeds")
        .select("*", { count: "exact", head: true })
        .like("inoreader_id", "test-rr129-perf-%");

      expect(remainingArticles).toBe(0);
      expect(remainingFeeds).toBe(0);

      console.log("Resource cleanup verification passed - no leaked test data");
    });
  });

  describe("Performance Regression Detection", () => {
    it("should maintain consistent performance across multiple runs", async () => {
      const testRuns = 5;
      const testSize = 500;
      const performanceMeasurements = [];

      for (let run = 0; run < testRuns; run++) {
        await createTestData(testSize);

        const startTime = Date.now();

        // Standard cleanup operation
        const { data: toDelete } = await supabase
          .from("articles")
          .select("id, inoreader_id, feed_id")
          .eq("is_read", true)
          .eq("is_starred", false);

        if (toDelete && toDelete.length > 0) {
          await supabase.from("deleted_articles").upsert(
            toDelete.map((a) => ({
              inoreader_id: a.inoreader_id,
              was_read: true,
              feed_id: a.feed_id,
            })),
            { onConflict: "inoreader_id" }
          );

          await supabase
            .from("articles")
            .delete()
            .in(
              "id",
              toDelete.map((a) => a.id)
            );
        }

        const runTime = Date.now() - startTime;
        performanceMeasurements.push(runTime);

        // Cleanup for next run
        createdArticles.length = 0;
        createdFeeds.length = 0;
      }

      // Calculate statistics
      const avgTime =
        performanceMeasurements.reduce((a, b) => a + b, 0) / testRuns;
      const maxTime = Math.max(...performanceMeasurements);
      const minTime = Math.min(...performanceMeasurements);
      const variation = ((maxTime - minTime) / avgTime) * 100;

      // Performance should be consistent
      expect(variation).toBeLessThan(50); // Variation should be less than 50%
      expect(avgTime).toBeLessThan(5000); // Average should be under 5 seconds

      console.log(
        `Performance consistency - Avg: ${avgTime.toFixed(0)}ms, Min: ${minTime}ms, Max: ${maxTime}ms, Variation: ${variation.toFixed(1)}%`
      );
    });

    it("should meet overall performance targets for RR-129", async () => {
      // Create realistic dataset
      const testSize = 1500;
      await createTestData(testSize, 3); // 3 feeds

      // Measure complete cleanup cycle
      const fullCycleStart = Date.now();

      // Step 1: Identify cleanup candidates
      const identifyStart = Date.now();
      const { data: toDelete } = await supabase
        .from("articles")
        .select("id, inoreader_id, feed_id")
        .eq("is_read", true)
        .eq("is_starred", false);
      const identifyTime = Date.now() - identifyStart;

      // Step 2: Track deletions
      const trackingStart = Date.now();
      if (toDelete && toDelete.length > 0) {
        await supabase.from("deleted_articles").upsert(
          toDelete.map((a) => ({
            inoreader_id: a.inoreader_id,
            was_read: true,
            feed_id: a.feed_id,
          })),
          { onConflict: "inoreader_id" }
        );
      }
      const trackingTime = Date.now() - trackingStart;

      // Step 3: Delete articles
      const deleteStart = Date.now();
      if (toDelete && toDelete.length > 0) {
        await supabase
          .from("articles")
          .delete()
          .in(
            "id",
            toDelete.map((a) => a.id)
          );
      }
      const deleteTime = Date.now() - deleteStart;

      // Step 4: Sync filtering simulation
      const filterStart = Date.now();
      const syncArticleIds = Array.from(
        { length: 200 },
        (_, i) => `test-rr129-perf-article-${i}`
      );

      const { data: deletedData } = await supabase
        .from("deleted_articles")
        .select("inoreader_id")
        .in("inoreader_id", syncArticleIds);
      const filterTime = Date.now() - filterStart;

      const fullCycleTime = Date.now() - fullCycleStart;

      // Log detailed performance breakdown
      console.log(`Performance Breakdown:
        - Identify candidates: ${identifyTime}ms
        - Track deletions: ${trackingTime}ms  
        - Delete articles: ${deleteTime}ms
        - Sync filtering: ${filterTime}ms
        - Full cycle: ${fullCycleTime}ms
        - Articles processed: ${toDelete?.length || 0}`);

      // RR-129 Performance Requirements
      expect(fullCycleTime).toBeLessThan(15000); // Complete cycle < 15s
      expect(identifyTime).toBeLessThan(2000); // Identify < 2s
      expect(trackingTime).toBeLessThan(3000); // Tracking < 3s
      expect(deleteTime).toBeLessThan(5000); // Delete < 5s
      expect(filterTime).toBeLessThan(500); // Filter < 500ms

      // Overall success metrics
      const deletedCount = toDelete?.length || 0;
      const expectedMinDeleted = Math.floor(testSize * 0.2); // At least 20% should be deleted

      expect(deletedCount).toBeGreaterThan(expectedMinDeleted);

      console.log(
        `✅ RR-129 Performance targets met - processed ${deletedCount} articles in ${fullCycleTime}ms`
      );
    });
  });
});
