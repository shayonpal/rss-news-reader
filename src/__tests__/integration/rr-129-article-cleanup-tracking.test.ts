import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { getAdminClient } from "@/lib/db/supabase-admin";

/**
 * RR-129: Integration tests for article cleanup with tracking
 * Tests the complete article cleanup flow with deletion tracking to prevent re-import
 */
describe("RR-129: Article Cleanup with Tracking Integration", () => {
  const supabase = getAdminClient();
  const TEST_USER_ID = "test-user-rr129-cleanup";

  // Test data cleanup tracking
  const createdFeeds: string[] = [];
  const createdArticles: string[] = [];

  beforeAll(async () => {
    // Ensure we have a test user
    await supabase.from("users").upsert(
      {
        id: TEST_USER_ID,
        email: "rr129-cleanup-test@example.com",
        inoreader_id: "rr129-cleanup-inoreader-id",
      },
      { onConflict: "id" }
    );

    // Verify required tables exist
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

    // Clean up test user
    await supabase.from("users").delete().eq("id", TEST_USER_ID);

    // Clean up any test entries in deleted_articles
    await supabase
      .from("deleted_articles")
      .delete()
      .like("inoreader_id", "test-rr129-cleanup-%");
  });

  beforeEach(async () => {
    // Clear any existing test data before each test
    await supabase
      .from("articles")
      .delete()
      .like("inoreader_id", "test-rr129-cleanup-%");

    await supabase
      .from("feeds")
      .delete()
      .like("inoreader_id", "test-rr129-cleanup-%");

    await supabase
      .from("deleted_articles")
      .delete()
      .like("inoreader_id", "test-rr129-cleanup-%");

    // Reset tracking arrays
    createdFeeds.length = 0;
    createdArticles.length = 0;
  });

  describe("Read Article Cleanup with Tracking", () => {
    it("should track and delete read, unstarred articles", async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-feed-1",
          title: "Cleanup Test Feed",
          url: "https://example.com/cleanup-feed.xml",
          unread_count: 2,
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create test articles with different states
      const articlesData = [
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-read-unstarred",
          title: "Read Unstarred Article",
          content: "This should be deleted and tracked",
          is_read: true,
          is_starred: false,
        },
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-read-starred",
          title: "Read Starred Article",
          content: "This should be preserved",
          is_read: true,
          is_starred: true,
        },
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-unread",
          title: "Unread Article",
          content: "This should be preserved",
          is_read: false,
          is_starred: false,
        },
      ];

      const { data: articles, error: articlesError } = await supabase
        .from("articles")
        .insert(articlesData)
        .select();

      expect(articlesError).toBeNull();
      expect(articles).toHaveLength(3);
      articles?.forEach((article) => createdArticles.push(article.id));

      // Step 1: Track articles that will be deleted
      const { data: articlesToDelete } = await supabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(articlesToDelete).toHaveLength(1);
      expect(articlesToDelete![0].inoreader_id).toBe(
        "test-rr129-cleanup-read-unstarred"
      );

      // Track in deleted_articles table
      const trackingData = articlesToDelete!.map((article) => ({
        inoreader_id: article.inoreader_id,
        was_read: true,
        feed_id: article.feed_id,
      }));

      const { error: trackingError } = await supabase
        .from("deleted_articles")
        .upsert(trackingData, { onConflict: "inoreader_id" });

      expect(trackingError).toBeNull();

      // Step 2: Delete the read, unstarred articles
      const { error: deleteError, count: deletedCount } = await supabase
        .from("articles")
        .delete()
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(deleteError).toBeNull();
      expect(deletedCount).toBe(1);

      // Verify tracking entry exists
      const { data: trackingEntry } = await supabase
        .from("deleted_articles")
        .select("*")
        .eq("inoreader_id", "test-rr129-cleanup-read-unstarred")
        .single();

      expect(trackingEntry).toBeDefined();
      expect(trackingEntry.was_read).toBe(true);
      expect(trackingEntry.feed_id).toBe(feed.id);
      expect(trackingEntry.deleted_at).toBeDefined();

      // Verify remaining articles
      const { data: remainingArticles } = await supabase
        .from("articles")
        .select("inoreader_id, is_read, is_starred")
        .eq("feed_id", feed.id);

      expect(remainingArticles).toHaveLength(2);

      const readStarred = remainingArticles!.find(
        (a) => a.inoreader_id === "test-rr129-cleanup-read-starred"
      );
      const unread = remainingArticles!.find(
        (a) => a.inoreader_id === "test-rr129-cleanup-unread"
      );

      expect(readStarred).toBeDefined();
      expect(readStarred!.is_read).toBe(true);
      expect(readStarred!.is_starred).toBe(true);

      expect(unread).toBeDefined();
      expect(unread!.is_read).toBe(false);
      expect(unread!.is_starred).toBe(false);

      // Update tracking arrays to reflect actual state
      createdArticles.length = 0;
      remainingArticles?.forEach((article) => {
        const originalArticle = articles!.find(
          (a) => a.inoreader_id === article.inoreader_id
        );
        if (originalArticle) {
          createdArticles.push(originalArticle.id);
        }
      });
    });

    it("should preserve starred articles regardless of read status", async () => {
      // Create test feed
      const { data: feed, error: feedError } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-starred-feed",
          title: "Starred Articles Test Feed",
          url: "https://example.com/starred-feed.xml",
          unread_count: 0,
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create various starred articles
      const starredArticles = [
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-starred-read",
          title: "Starred and Read",
          content: "This should be preserved",
          is_read: true,
          is_starred: true,
        },
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-starred-unread",
          title: "Starred and Unread",
          content: "This should also be preserved",
          is_read: false,
          is_starred: true,
        },
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-read-not-starred",
          title: "Read but Not Starred",
          content: "This should be deleted",
          is_read: true,
          is_starred: false,
        },
      ];

      const { data: articles, error: articlesError } = await supabase
        .from("articles")
        .insert(starredArticles)
        .select();

      expect(articlesError).toBeNull();
      articles?.forEach((article) => createdArticles.push(article.id));

      // Attempt cleanup (should only delete read, unstarred)
      const { data: toDelete } = await supabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(toDelete).toHaveLength(1);

      // Track and delete
      await supabase.from("deleted_articles").upsert(
        toDelete!.map((a) => ({
          inoreader_id: a.inoreader_id,
          was_read: true,
          feed_id: a.feed_id,
        })),
        { onConflict: "inoreader_id" }
      );

      const { count: deletedCount } = await supabase
        .from("articles")
        .delete()
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(deletedCount).toBe(1);

      // Verify starred articles remain
      const { data: remainingArticles } = await supabase
        .from("articles")
        .select("inoreader_id, is_starred")
        .eq("feed_id", feed.id);

      expect(remainingArticles).toHaveLength(2);
      remainingArticles?.forEach((article) => {
        expect(article.is_starred).toBe(true);
      });

      // Update tracking
      createdArticles.length = 0;
      remainingArticles?.forEach((article) => {
        const originalArticle = articles!.find(
          (a) => a.inoreader_id === article.inoreader_id
        );
        if (originalArticle) {
          createdArticles.push(originalArticle.id);
        }
      });
    });
  });

  describe("Tracking Table Operations", () => {
    it("should handle upsert operations for idempotent tracking", async () => {
      const testInoreaderIds = [
        "test-rr129-cleanup-upsert-1",
        "test-rr129-cleanup-upsert-2",
      ];

      const trackingData = testInoreaderIds.map((id) => ({
        inoreader_id: id,
        was_read: true,
        feed_id: "test-feed-upsert",
      }));

      // First insert
      const { error: firstError } = await supabase
        .from("deleted_articles")
        .upsert(trackingData, { onConflict: "inoreader_id" });

      expect(firstError).toBeNull();

      // Verify entries exist
      const { data: firstCheck } = await supabase
        .from("deleted_articles")
        .select("inoreader_id, deleted_at")
        .in("inoreader_id", testInoreaderIds);

      expect(firstCheck).toHaveLength(2);
      const originalTimestamp = firstCheck![0].deleted_at;

      // Second upsert (should not error, should preserve timestamp)
      const { error: secondError } = await supabase
        .from("deleted_articles")
        .upsert(trackingData, { onConflict: "inoreader_id" });

      expect(secondError).toBeNull();

      // Verify timestamps preserved
      const { data: secondCheck } = await supabase
        .from("deleted_articles")
        .select("inoreader_id, deleted_at")
        .in("inoreader_id", testInoreaderIds);

      expect(secondCheck).toHaveLength(2);
      expect(secondCheck![0].deleted_at).toBe(originalTimestamp);
    });

    it("should support batch operations for large cleanups", async () => {
      // Create feed for batch test
      const { data: feed, error: feedError } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-batch-feed",
          title: "Batch Test Feed",
          url: "https://example.com/batch-feed.xml",
          unread_count: 50,
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create many articles
      const batchSize = 50;
      const articlesData = Array.from({ length: batchSize }, (_, i) => ({
        feed_id: feed.id,
        inoreader_id: `test-rr129-cleanup-batch-${i}`,
        title: `Batch Article ${i}`,
        content: `Content ${i}`,
        is_read: i % 2 === 0, // 50% read
        is_starred: i % 10 === 0, // 10% starred
      }));

      const { error: articlesError } = await supabase
        .from("articles")
        .insert(articlesData);

      expect(articlesError).toBeNull();

      // Get articles to delete (read but not starred)
      const { data: toDelete } = await supabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(toDelete!.length).toBeGreaterThan(10); // Should have many to delete

      // Batch track operation
      const trackingData = toDelete!.map((article) => ({
        inoreader_id: article.inoreader_id,
        was_read: true,
        feed_id: article.feed_id,
      }));

      const trackStartTime = Date.now();
      const { error: trackingError } = await supabase
        .from("deleted_articles")
        .upsert(trackingData, { onConflict: "inoreader_id" });
      const trackTime = Date.now() - trackStartTime;

      expect(trackingError).toBeNull();
      expect(trackTime).toBeLessThan(5000); // Should complete quickly

      // Batch delete operation
      const deleteStartTime = Date.now();
      const { error: deleteError, count: deletedCount } = await supabase
        .from("articles")
        .delete()
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);
      const deleteTime = Date.now() - deleteStartTime;

      expect(deleteError).toBeNull();
      expect(deletedCount).toBe(toDelete!.length);
      expect(deleteTime).toBeLessThan(5000); // Should complete quickly

      // Verify tracking entries exist
      const { count: trackingCount } = await supabase
        .from("deleted_articles")
        .select("*", { count: "exact", head: true })
        .in(
          "inoreader_id",
          toDelete!.map((a) => a.inoreader_id)
        );

      expect(trackingCount).toBe(deletedCount);
    });
  });

  describe("Tracking Cleanup and Maintenance", () => {
    it("should clean up old tracking entries (>90 days)", async () => {
      // Insert old tracking entries
      const oldTimestamp = new Date(
        Date.now() - 100 * 24 * 60 * 60 * 1000
      ).toISOString(); // 100 days ago
      const recentTimestamp = new Date(
        Date.now() - 50 * 24 * 60 * 60 * 1000
      ).toISOString(); // 50 days ago

      const oldEntries = [
        {
          inoreader_id: "test-rr129-cleanup-old-1",
          was_read: true,
          feed_id: "old-feed",
          deleted_at: oldTimestamp,
        },
        {
          inoreader_id: "test-rr129-cleanup-old-2",
          was_read: true,
          feed_id: "old-feed",
          deleted_at: oldTimestamp,
        },
        {
          inoreader_id: "test-rr129-cleanup-recent",
          was_read: true,
          feed_id: "recent-feed",
          deleted_at: recentTimestamp,
        },
      ];

      const { error: insertError } = await supabase
        .from("deleted_articles")
        .insert(oldEntries);

      expect(insertError).toBeNull();

      // Run cleanup (simulating cleanup function)
      const cutoffDate = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000
      ).toISOString();

      const { error: cleanupError, count: cleanedCount } = await supabase
        .from("deleted_articles")
        .delete()
        .lt("deleted_at", cutoffDate);

      expect(cleanupError).toBeNull();
      expect(cleanedCount).toBe(2); // Should delete the 2 old entries

      // Verify recent entry remains
      const { data: remainingEntries } = await supabase
        .from("deleted_articles")
        .select("inoreader_id")
        .in(
          "inoreader_id",
          oldEntries.map((e) => e.inoreader_id)
        );

      expect(remainingEntries).toHaveLength(1);
      expect(remainingEntries![0].inoreader_id).toBe(
        "test-rr129-cleanup-recent"
      );
    });

    it("should use database function for automated cleanup", async () => {
      // Test the cleanup function exists and can be called
      const { error } = await supabase.rpc("cleanup_old_deleted_articles");

      expect(error).toBeNull(); // Function should exist and execute without error
    });
  });

  describe("Integration with Article States", () => {
    it("should handle mixed article states correctly", async () => {
      // Create feed
      const { data: feed, error: feedError } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-mixed-feed",
          title: "Mixed States Test Feed",
          url: "https://example.com/mixed-feed.xml",
          unread_count: 3,
        })
        .select()
        .single();

      expect(feedError).toBeNull();
      createdFeeds.push(feed.id);

      // Create articles with all combinations of states
      const mixedArticles = [
        {
          inoreader_id: "mixed-unread-unstarred",
          is_read: false,
          is_starred: false,
        },
        {
          inoreader_id: "mixed-unread-starred",
          is_read: false,
          is_starred: true,
        },
        {
          inoreader_id: "mixed-read-unstarred",
          is_read: true,
          is_starred: false,
        },
        { inoreader_id: "mixed-read-starred", is_read: true, is_starred: true },
      ].map((article, i) => ({
        feed_id: feed.id,
        inoreader_id: `test-rr129-cleanup-${article.inoreader_id}`,
        title: `Mixed Article ${i}`,
        content: `Content ${i}`,
        is_read: article.is_read,
        is_starred: article.is_starred,
      }));

      const { data: articles, error: articlesError } = await supabase
        .from("articles")
        .insert(mixedArticles)
        .select();

      expect(articlesError).toBeNull();
      articles?.forEach((article) => createdArticles.push(article.id));

      // Cleanup should only affect read, unstarred articles
      const { data: toDelete } = await supabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(toDelete).toHaveLength(1);
      expect(toDelete![0].inoreader_id).toBe(
        "test-rr129-cleanup-mixed-read-unstarred"
      );

      // Track and delete
      await supabase.from("deleted_articles").upsert(
        [
          {
            inoreader_id: toDelete![0].inoreader_id,
            was_read: true,
            feed_id: toDelete![0].feed_id,
          },
        ],
        { onConflict: "inoreader_id" }
      );

      const { count: deletedCount } = await supabase
        .from("articles")
        .delete()
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(deletedCount).toBe(1);

      // Verify remaining articles
      const { data: remaining } = await supabase
        .from("articles")
        .select("inoreader_id, is_read, is_starred")
        .eq("feed_id", feed.id);

      expect(remaining).toHaveLength(3);

      // Should have: unread-unstarred, unread-starred, read-starred
      const expectedRemaining = [
        "test-rr129-cleanup-mixed-unread-unstarred",
        "test-rr129-cleanup-mixed-unread-starred",
        "test-rr129-cleanup-mixed-read-starred",
      ];

      remaining?.forEach((article) => {
        expect(expectedRemaining).toContain(article.inoreader_id);
      });

      // Update tracking
      createdArticles.length = 0;
      remaining?.forEach((article) => {
        const originalArticle = articles!.find(
          (a) => a.inoreader_id === article.inoreader_id
        );
        if (originalArticle) {
          createdArticles.push(originalArticle.id);
        }
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle tracking failures gracefully", async () => {
      // Create valid article
      const { data: feed } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-error-feed",
          title: "Error Test Feed",
          url: "https://example.com/error-feed.xml",
          unread_count: 1,
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      const { data: article } = await supabase
        .from("articles")
        .insert({
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-error-article",
          title: "Error Test Article",
          content: "Content",
          is_read: true,
          is_starred: false,
        })
        .select()
        .single();

      createdArticles.push(article.id);

      // First, successfully track the article
      const { error: trackError } = await supabase
        .from("deleted_articles")
        .insert({
          inoreader_id: article.inoreader_id,
          was_read: true,
          feed_id: article.feed_id,
        });

      expect(trackError).toBeNull();

      // Try to track again (should handle gracefully with upsert)
      const { error: upsertError } = await supabase
        .from("deleted_articles")
        .upsert(
          {
            inoreader_id: article.inoreader_id,
            was_read: true,
            feed_id: article.feed_id,
          },
          { onConflict: "inoreader_id" }
        );

      expect(upsertError).toBeNull();

      // Delete should still work
      const { error: deleteError } = await supabase
        .from("articles")
        .delete()
        .eq("id", article.id);

      expect(deleteError).toBeNull();

      createdArticles.length = 0; // Article is deleted
    });

    it("should handle empty cleanup operations", async () => {
      // Create feed with only unread/starred articles
      const { data: feed } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-empty-feed",
          title: "Empty Cleanup Feed",
          url: "https://example.com/empty-cleanup.xml",
          unread_count: 2,
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Create articles that should NOT be deleted
      const articles = [
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-empty-unread",
          title: "Unread Article",
          content: "Should not be deleted",
          is_read: false,
          is_starred: false,
        },
        {
          feed_id: feed.id,
          inoreader_id: "test-rr129-cleanup-empty-starred",
          title: "Starred Article",
          content: "Should not be deleted",
          is_read: true,
          is_starred: true,
        },
      ];

      const { data: createdArticlesData } = await supabase
        .from("articles")
        .insert(articles)
        .select();

      createdArticlesData?.forEach((a) => createdArticles.push(a.id));

      // Attempt cleanup
      const { data: toDelete } = await supabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(toDelete).toHaveLength(0); // Nothing should be found

      // Cleanup operations should handle empty results gracefully
      const { count: deletedCount } = await supabase
        .from("articles")
        .delete()
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      expect(deletedCount).toBe(0);

      // All articles should remain
      const { count: remainingCount } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("feed_id", feed.id);

      expect(remainingCount).toBe(2);
    });

    it("should handle database constraint violations gracefully", async () => {
      // Try to insert tracking entry with invalid data
      const { error } = await supabase.from("deleted_articles").insert({
        inoreader_id: "", // Empty string should be handled
        was_read: true,
        feed_id: "some-feed",
      });

      // Should either succeed or fail gracefully without crashing
      expect(error?.code).toBeDefined(); // If it fails, should have an error code
    });
  });

  describe("Performance Validation", () => {
    it("should perform cleanup operations within acceptable time limits", async () => {
      // Create feed for performance test
      const { data: feed } = await supabase
        .from("feeds")
        .insert({
          user_id: TEST_USER_ID,
          inoreader_id: "test-rr129-cleanup-perf-feed",
          title: "Performance Test Feed",
          url: "https://example.com/perf-feed.xml",
          unread_count: 100,
        })
        .select()
        .single();

      createdFeeds.push(feed.id);

      // Create many articles for performance testing
      const articleCount = 100;
      const articles = Array.from({ length: articleCount }, (_, i) => ({
        feed_id: feed.id,
        inoreader_id: `test-rr129-cleanup-perf-${i}`,
        title: `Performance Article ${i}`,
        content: `Content ${i}`,
        is_read: i % 2 === 0, // 50% read
        is_starred: false, // None starred for this test
      }));

      const { error: articlesError } = await supabase
        .from("articles")
        .insert(articles);

      expect(articlesError).toBeNull();

      // Time the cleanup operation
      const startTime = Date.now();

      // Get articles to cleanup
      const { data: toDelete } = await supabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      // Track them
      const trackingData = toDelete!.map((a) => ({
        inoreader_id: a.inoreader_id,
        was_read: true,
        feed_id: a.feed_id,
      }));

      await supabase
        .from("deleted_articles")
        .upsert(trackingData, { onConflict: "inoreader_id" });

      // Delete them
      const { count: deletedCount } = await supabase
        .from("articles")
        .delete()
        .eq("feed_id", feed.id)
        .eq("is_read", true)
        .eq("is_starred", false);

      const totalTime = Date.now() - startTime;

      expect(deletedCount).toBe(50); // 50% were read
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Cleaned up ${deletedCount} articles in ${totalTime}ms`);
    });
  });
});
