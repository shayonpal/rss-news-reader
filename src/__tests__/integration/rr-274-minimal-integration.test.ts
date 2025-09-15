/**
 * RR-274: Minimal Integration Tests
 * Tests core implementation without complex database setup
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUserPreferences } from "@/lib/services/preferences";
import { retainArticles } from "@/lib/sync/article-retention";
import { syncArticles } from "@/lib/sync/sync-service";

// Mock only external dependencies, test actual logic
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/services/inoreader");

import { createClient } from "@/lib/supabase/server";

describe("RR-274: Core Implementation Tests", () => {
  const mockUserId = "test-user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("User Preferences Integration", () => {
    it("should use database preferences for sync configuration", async () => {
      // Mock realistic database response
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  preferences: JSON.stringify({
                    sync: { maxArticles: 150, retentionCount: 3000 },
                    ai: { enabled: true, model: "claude-3-sonnet-20240229" },
                  }),
                },
              ],
              error: null,
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      // Test: Call getUserPreferences
      const preferences = await getUserPreferences(mockUserId);

      // Verify: Should return parsed preferences
      expect(preferences).not.toBeNull();
      expect(preferences?.sync?.maxArticles).toBe(150);
      expect(preferences?.sync?.retentionCount).toBe(3000);
      expect(preferences?.ai?.model).toBe("claude-3-sonnet-20240229");
    });

    it("should return defaults when no preferences exist", async () => {
      // Mock empty database response
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [], // No preferences found
              error: null,
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      // Test: Call getUserPreferences
      const preferences = await getUserPreferences(mockUserId);

      // Verify: Should return defaults (100 maxArticles, 2000 retentionCount)
      expect(preferences).not.toBeNull();
      expect(preferences?.sync?.maxArticles).toBe(100);
      expect(preferences?.sync?.retentionCount).toBe(2000);
    });
  });

  describe("Article Retention Logic", () => {
    it("should preserve starred articles during retention", async () => {
      // Mock the retention query pattern
      const mockSupabase = {
        from: vi.fn(),
      };

      // Step 1: Count total articles (through feeds)
      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 500, // Total articles
              error: null,
            }),
          }),
        })
        // Step 2: Count starred articles
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: 50, // Starred articles
                error: null,
              }),
            }),
          }),
        })
        // Step 3: Get articles to delete
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: Array.from({ length: 200 }, (_, i) => ({
                      id: `article-${i}`,
                    })),
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        })
        // Step 4: Delete articles
        .mockReturnValueOnce({
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              error: null, // Success
            }),
          }),
        });

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      // Test: Retain 300 articles from 500 total
      const result = await retainArticles(mockUserId, {
        maxCount: 300,
        preserveStarred: true,
      });

      // Verify: Should delete 200 articles, preserve 50 starred
      expect(result.deletedCount).toBe(200);
      expect(result.preservedStarredCount).toBe(50);
      expect(result.retainedCount).toBe(300); // 500 - 200 = 300
      expect(result.error).toBeNull();
    });

    it("should handle retention when under limit", async () => {
      // Mock scenario where articles < retention limit
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: 150, // Only 150 articles, under 200 limit
              error: null,
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      // Test: Retention with higher limit
      const result = await retainArticles(mockUserId, {
        maxCount: 200,
        preserveStarred: true,
      });

      // Verify: No deletion should occur
      expect(result.deletedCount).toBe(0);
      expect(result.retainedCount).toBe(150);
      expect(result.error).toBeNull();
    });
  });

  describe("Zero State Handling", () => {
    it("should handle users with no feeds", async () => {
      // This tests the edge case where stats API gets empty feed list
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [], // No feeds
              error: null,
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      // Import and test the actual GET function
      const { GET } = await import("@/app/api/articles/stats/route");
      const response = await GET();
      const data = await response.json();

      // Verify: Should return zero counts
      expect(response.status).toBe(200);
      expect(data).toEqual({
        total: 0,
        unread: 0,
        starred: 0,
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Database connection failed" },
            }),
          }),
        }),
      };

      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      // Test: Call stats API with database error
      const { GET } = await import("@/app/api/articles/stats/route");
      const response = await GET();
      const data = await response.json();

      // Verify: Should return 500 error
      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch statistics");
    });
  });
});
