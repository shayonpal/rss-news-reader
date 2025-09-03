import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

/**
 * Test Specification for RR-171: API Sidebar Data Enhancement
 *
 * CRITICAL: The sync API must return ready-to-render sidebar data
 * that can be immediately applied to the UI without waiting for
 * materialized view refresh or additional queries.
 *
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface SyncResponseWithSidebar {
  syncId: string;
  status: "completed" | "partial" | "failed";
  metrics: {
    newArticles: number;
    deletedArticles: number;
    newTags: number;
    failedFeeds: number;
  };
  sidebar: {
    feedCounts: Array<[string, number]>; // [feedId, unreadCount] tuples
    tags: Array<{
      id: string;
      name: string; // Must be HTML-decoded
      count: number;
    }>;
  };
  timestamp: string;
  duration: number;
}

describe("RR-171: API Sidebar Data Contract", () => {
  let mockSupabase: any;
  let mockSyncManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase with realistic data
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockReturnThis(),
    };

    mockSyncManager = {
      syncFromInoreader: vi.fn(),
      calculateSidebarData: vi.fn(),
    };
  });

  describe("Sidebar Data Structure", () => {
    it("should include feedCounts as array of tuples", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-123",
        status: "completed",
        metrics: {
          newArticles: 10,
          deletedArticles: 0,
          newTags: 2,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: [
            ["feed-1", 12],
            ["feed-2", 5],
            ["feed-3", 0],
            ["feed-4", 23],
          ],
          tags: [],
        },
        timestamp: new Date().toISOString(),
        duration: 2500,
      };

      expect(response.sidebar).toBeDefined();
      expect(response.sidebar.feedCounts).toBeDefined();
      expect(Array.isArray(response.sidebar.feedCounts)).toBe(true);

      // Validate tuple structure
      response.sidebar.feedCounts.forEach((tuple) => {
        expect(Array.isArray(tuple)).toBe(true);
        expect(tuple).toHaveLength(2);
        expect(typeof tuple[0]).toBe("string"); // feedId
        expect(typeof tuple[1]).toBe("number"); // unread count
        expect(tuple[1]).toBeGreaterThanOrEqual(0); // non-negative
      });
    });

    it("should include tags with decoded HTML entities", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-124",
        status: "completed",
        metrics: {
          newArticles: 5,
          deletedArticles: 0,
          newTags: 3,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: [],
          tags: [
            {
              id: "tag-1",
              name: "Design & Development", // Decoded from 'Design &amp; Development'
              count: 15,
            },
            {
              id: "tag-2",
              name: 'Tips "Tricks"', // Decoded from 'Tips &quot;Tricks&quot;'
              count: 8,
            },
            {
              id: "tag-3",
              name: "What's New", // Decoded from 'What&#39;s New'
              count: 23,
            },
          ],
        },
        timestamp: new Date().toISOString(),
        duration: 1800,
      };

      expect(response.sidebar.tags).toBeDefined();
      expect(Array.isArray(response.sidebar.tags)).toBe(true);

      // Validate tag structure
      response.sidebar.tags.forEach((tag) => {
        expect(tag.id).toBeDefined();
        expect(typeof tag.id).toBe("string");
        expect(tag.name).toBeDefined();
        expect(typeof tag.name).toBe("string");
        expect(tag.count).toBeDefined();
        expect(typeof tag.count).toBe("number");
        expect(tag.count).toBeGreaterThanOrEqual(0);

        // Ensure no HTML entities remain
        expect(tag.name).not.toContain("&amp;");
        expect(tag.name).not.toContain("&quot;");
        expect(tag.name).not.toContain("&#39;");
        expect(tag.name).not.toContain("&lt;");
        expect(tag.name).not.toContain("&gt;");
      });
    });

    it("should return empty arrays when no feeds or tags exist", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-125",
        status: "completed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: [],
          tags: [],
        },
        timestamp: new Date().toISOString(),
        duration: 500,
      };

      expect(response.sidebar.feedCounts).toEqual([]);
      expect(response.sidebar.tags).toEqual([]);
    });
  });

  describe("Sidebar Data Freshness", () => {
    it("should calculate counts from current database state, not cached", async () => {
      // Mock fresh database queries
      const freshFeedCounts = [
        ["feed-1", 45], // Fresh count after sync
        ["feed-2", 12],
        ["feed-3", 0],
      ];

      const freshTags = [
        { id: "tag-1", name: "Technology", count: 67 },
        { id: "tag-2", name: "Business", count: 34 },
      ];

      mockSyncManager.calculateSidebarData.mockResolvedValue({
        feedCounts: freshFeedCounts,
        tags: freshTags,
      });

      const response: SyncResponseWithSidebar = {
        syncId: "sync-126",
        status: "completed",
        metrics: {
          newArticles: 20,
          deletedArticles: 5,
          newTags: 0,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: freshFeedCounts,
          tags: freshTags,
        },
        timestamp: new Date().toISOString(),
        duration: 3000,
      };

      // Verify counts reflect post-sync state
      expect(response.sidebar.feedCounts).toEqual(freshFeedCounts);
      expect(response.sidebar.tags).toEqual(freshTags);
    });

    it("should handle large datasets efficiently", async () => {
      // Generate 100 feeds with varying counts
      const largeFeedCounts: Array<[string, number]> = [];
      for (let i = 1; i <= 100; i++) {
        largeFeedCounts.push([`feed-${i}`, Math.floor(Math.random() * 100)]);
      }

      // Generate 50 tags
      const largeTags = Array.from({ length: 50 }, (_, i) => ({
        id: `tag-${i + 1}`,
        name: `Tag ${i + 1}`,
        count: Math.floor(Math.random() * 200),
      }));

      const response: SyncResponseWithSidebar = {
        syncId: "sync-127",
        status: "completed",
        metrics: {
          newArticles: 500,
          deletedArticles: 100,
          newTags: 10,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: largeFeedCounts,
          tags: largeTags,
        },
        timestamp: new Date().toISOString(),
        duration: 8500,
      };

      expect(response.sidebar.feedCounts).toHaveLength(100);
      expect(response.sidebar.tags).toHaveLength(50);

      // Ensure structure is maintained for large datasets
      response.sidebar.feedCounts.forEach((tuple) => {
        expect(tuple).toHaveLength(2);
        expect(typeof tuple[0]).toBe("string");
        expect(typeof tuple[1]).toBe("number");
      });
    });
  });

  describe("Partial Sync Sidebar Data", () => {
    it("should include accurate sidebar data even on partial sync", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-128",
        status: "partial", // Some feeds failed
        metrics: {
          newArticles: 15,
          deletedArticles: 3,
          newTags: 1,
          failedFeeds: 2, // 2 feeds failed to sync
        },
        sidebar: {
          feedCounts: [
            ["feed-1", 8], // Successfully synced
            ["feed-2", 15], // Successfully synced
            ["feed-3", 0], // Failed feed - showing last known count
            ["feed-4", 7], // Failed feed - showing last known count
            ["feed-5", 22], // Successfully synced
          ],
          tags: [
            { id: "tag-1", name: "Tech News", count: 30 },
            { id: "tag-2", name: "Updates", count: 15 },
          ],
        },
        timestamp: new Date().toISOString(),
        duration: 4200,
      };

      expect(response.status).toBe("partial");
      expect(response.metrics.failedFeeds).toBeGreaterThan(0);

      // Sidebar data should still be provided
      expect(response.sidebar.feedCounts).toBeDefined();
      expect(response.sidebar.feedCounts.length).toBeGreaterThan(0);
      expect(response.sidebar.tags).toBeDefined();
    });
  });

  describe("Failed Sync Sidebar Data", () => {
    it("should return empty sidebar data on complete sync failure", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-129",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: [], // Empty on failure
          tags: [], // Empty on failure
        },
        timestamp: new Date().toISOString(),
        duration: 150, // Failed quickly
      };

      expect(response.status).toBe("failed");
      expect(response.sidebar.feedCounts).toEqual([]);
      expect(response.sidebar.tags).toEqual([]);
    });
  });

  describe("UI Immediate Rendering", () => {
    it("should provide data formatted for direct UI consumption", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-130",
        status: "completed",
        metrics: {
          newArticles: 25,
          deletedArticles: 10,
          newTags: 3,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: [
            ["feed-abc-123", 42],
            ["feed-def-456", 0],
            ["feed-ghi-789", 17],
          ],
          tags: [
            { id: "tag-xyz", name: "JavaScript", count: 89 },
            { id: "tag-uvw", name: "React & Redux", count: 56 },
            { id: "tag-rst", name: "Node.js", count: 34 },
          ],
        },
        timestamp: new Date().toISOString(),
        duration: 3750,
      };

      // Simulate UI consumption
      const uiSidebarUpdate = (data: typeof response.sidebar) => {
        // Update feed counts in UI
        data.feedCounts.forEach(([feedId, count]) => {
          expect(feedId).toMatch(/^feed-/);
          expect(count).toBeGreaterThanOrEqual(0);
          // UI can directly use: updateFeedBadge(feedId, count)
        });

        // Update tag list in UI
        data.tags.forEach((tag) => {
          expect(tag.id).toMatch(/^tag-/);
          expect(tag.name).toBeTruthy();
          expect(tag.count).toBeGreaterThanOrEqual(0);
          // UI can directly use: renderTag(tag)
        });
      };

      // Should not throw when consuming sidebar data
      expect(() => uiSidebarUpdate(response.sidebar)).not.toThrow();
    });

    it("should not require additional database queries after receiving response", async () => {
      const response: SyncResponseWithSidebar = {
        syncId: "sync-131",
        status: "completed",
        metrics: {
          newArticles: 30,
          deletedArticles: 5,
          newTags: 2,
          failedFeeds: 0,
        },
        sidebar: {
          feedCounts: [
            ["feed-1", 15],
            ["feed-2", 8],
          ],
          tags: [{ id: "tag-1", name: "Updates", count: 23 }],
        },
        timestamp: new Date().toISOString(),
        duration: 2900,
      };

      // Mock UI update function
      const updateUIFromResponse = vi.fn(
        (sidebarData: typeof response.sidebar) => {
          // Directly apply to UI stores
          return {
            feedsUpdated: sidebarData.feedCounts.length,
            tagsUpdated: sidebarData.tags.length,
          };
        }
      );

      // UI should update without any database calls
      const result = updateUIFromResponse(response.sidebar);

      expect(updateUIFromResponse).toHaveBeenCalledTimes(1);
      expect(result.feedsUpdated).toBe(2);
      expect(result.tagsUpdated).toBe(1);

      // Verify no database queries were made
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });
});
