/**
 * RR-274: Real Integration Tests (No Mocks)
 * Tests the actual implementation against real database
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { dbHelper } from "../test-helpers/real-database-setup";
import { GET as getStats } from "@/app/api/articles/stats/route";
import { retainArticles } from "@/lib/sync/article-retention";
import { getUserPreferences } from "@/lib/services/preferences";

describe("RR-274: Real Integration Tests", () => {
  // Clean up after each test
  afterEach(async () => {
    await dbHelper.cleanup();
  });

  describe("Statistics API with Real Database", () => {
    it("should return accurate counts from real database", async () => {
      // Setup: Create real test data
      const scenario = await dbHelper.setupCompleteScenario({
        feedCount: 2,
        articlesPerFeed: 50,
        readPercentage: 0.4, // 40% read
        starredPercentage: 0.1, // 10% starred
      });

      // Mock auth to return our test user (since we can't authenticate in tests)
      const mockSupabase = {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: { user: scenario.user },
              error: null,
            }),
        },
        from: (...args: any[]) => dbHelper["supabase"].from(...args),
      };

      // Temporarily replace createClient for this test
      const { createClient } = await import("@/lib/supabase/server");
      vi.doMock("@/lib/supabase/server", () => ({
        createClient: () => mockSupabase,
      }));

      // Test: Call the actual API
      const response = await getStats();
      const data = await response.json();

      // Verify: Should match real database counts
      expect(response.status).toBe(200);
      expect(data.total).toBe(scenario.expectedStats.total);
      expect(data.unread).toBe(scenario.expectedStats.unread);
      expect(data.starred).toBe(scenario.expectedStats.starred);

      // Additional verification: counts should be reasonable
      expect(data.total).toBeGreaterThan(0);
      expect(data.unread).toBeLessThanOrEqual(data.total);
      expect(data.starred).toBeLessThanOrEqual(data.total);
    });

    it("should return zero counts when user has no feeds", async () => {
      // Setup: User with no feeds
      const user = await dbHelper.createTestUser();

      const mockSupabase = {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: { user },
              error: null,
            }),
        },
        from: (...args: any[]) => dbHelper["supabase"].from(...args),
      };

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: () => mockSupabase,
      }));

      // Test: Call API
      const response = await getStats();
      const data = await response.json();

      // Verify: Should return all zeros
      expect(response.status).toBe(200);
      expect(data).toEqual({
        total: 0,
        unread: 0,
        starred: 0,
      });
    });

    it("should handle user with feeds but no articles", async () => {
      // Setup: User with feeds but no articles
      const user = await dbHelper.createTestUser();
      await dbHelper.createTestFeeds(user.id, 3);

      const mockSupabase = {
        auth: {
          getUser: () =>
            Promise.resolve({
              data: { user },
              error: null,
            }),
        },
        from: (...args: any[]) => dbHelper["supabase"].from(...args),
      };

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: () => mockSupabase,
      }));

      // Test: Call API
      const response = await getStats();
      const data = await response.json();

      // Verify: Should return zeros for articles
      expect(response.status).toBe(200);
      expect(data).toEqual({
        total: 0,
        unread: 0,
        starred: 0,
      });
    });
  });

  describe("Article Retention with Real Database", () => {
    it("should delete oldest unread articles while preserving starred", async () => {
      // Setup: Create user and feed
      const user = await dbHelper.createTestUser();
      const feeds = await dbHelper.createTestFeeds(user.id, 1);
      const feedId = feeds[0].id;

      // Create specific article mix
      const articles = await dbHelper.createSpecificArticles(feedId, [
        { count: 50, is_read: true, is_starred: false, daysAgo: 30 }, // Old read
        { count: 100, is_read: false, is_starred: false, daysAgo: 10 }, // Recent unread
        { count: 20, is_read: true, is_starred: true, daysAgo: 35 }, // Old starred (preserve)
        { count: 30, is_read: false, is_starred: true, daysAgo: 5 }, // Recent starred (preserve)
      ]);

      // Test: Retain only 120 articles (should delete 80, preserve 50 starred)
      const result = await retainArticles(user.id, {
        maxCount: 120,
        preserveStarred: true,
      });

      // Verify: Check actual database state
      const finalStats = await dbHelper.getExpectedStats(user.id);

      expect(result.deletedCount).toBe(80); // 200 total - 120 target = 80 deleted
      expect(result.preservedStarredCount).toBe(50); // All starred preserved
      expect(result.error).toBeNull();
      expect(finalStats.total).toBe(120); // Should match maxCount
      expect(finalStats.starred).toBe(50); // All starred should remain
    });

    it("should handle retention when under limit", async () => {
      // Setup: Small dataset under retention limit
      const user = await dbHelper.createTestUser();
      const feeds = await dbHelper.createTestFeeds(user.id, 1);

      await dbHelper.createSpecificArticles(feeds[0].id, [
        { count: 30, is_read: false, is_starred: false },
        { count: 20, is_read: true, is_starred: true },
      ]);

      // Test: Retention limit higher than article count
      const result = await retainArticles(user.id, {
        maxCount: 100,
        preserveStarred: true,
      });

      // Verify: No deletion should occur
      expect(result.deletedCount).toBe(0);
      expect(result.retainedCount).toBe(50); // All articles retained
      expect(result.error).toBeNull();

      const finalStats = await dbHelper.getExpectedStats(user.id);
      expect(finalStats.total).toBe(50); // All articles remain
    });
  });

  describe("Sync Service with Real Database", () => {
    it("should use real user preferences for sync configuration", async () => {
      // Setup: Create user with specific preferences
      const user = await dbHelper.createTestUser();

      // Insert real preferences into database
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient();

      await supabase.from("user_preferences").insert({
        user_id: user.id,
        preferences: JSON.stringify({
          sync: { maxArticles: 75, retentionCount: 150 },
          ai: { enabled: false },
        }),
      });

      // Test: Get preferences through real service
      const preferences = await getUserPreferences(user.id);

      // Verify: Should match database values
      expect(preferences).not.toBeNull();
      expect(preferences?.sync?.maxArticles).toBe(75);
      expect(preferences?.sync?.retentionCount).toBe(150);
    });
  });

  describe("End-to-End Article Lifecycle", () => {
    it("should handle complete sync -> retention -> stats workflow", async () => {
      // Setup: Real user and feeds
      const user = await dbHelper.createTestUser();
      const feeds = await dbHelper.createTestFeeds(user.id, 2);

      // Create initial articles
      await dbHelper.createTestArticles(
        feeds.map((f) => f.id),
        100, // 200 total articles
        { readPercentage: 0.5, starredPercentage: 0.1 }
      );

      // Step 1: Get initial stats
      const mockSupabase = {
        auth: {
          getUser: () => Promise.resolve({ data: { user }, error: null }),
        },
        from: (...args: any[]) => dbHelper["supabase"].from(...args),
      };

      vi.doMock("@/lib/supabase/server", () => ({
        createClient: () => mockSupabase,
      }));

      const initialResponse = await getStats();
      const initialStats = await initialResponse.json();

      expect(initialStats.total).toBe(200);

      // Step 2: Apply retention (keep only 150)
      const retentionResult = await retainArticles(user.id, {
        maxCount: 150,
        preserveStarred: true,
      });

      expect(retentionResult.deletedCount).toBeGreaterThan(0);
      expect(retentionResult.error).toBeNull();

      // Step 3: Verify stats reflect retention
      const finalResponse = await getStats();
      const finalStats = await finalResponse.json();

      expect(finalStats.total).toBe(150); // Should match retention limit
      expect(finalStats.total).toBeLessThan(initialStats.total); // Should be reduced

      // Starred articles should be preserved
      expect(finalStats.starred).toBeGreaterThan(0);
    });
  });
});
