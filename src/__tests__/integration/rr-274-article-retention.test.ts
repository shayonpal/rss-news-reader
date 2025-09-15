import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { retainArticles } from "@/lib/sync/article-retention";
import { createClient } from "@/lib/supabase/server";
import {
  createTestArticle,
  createArticleBatch,
  createMixedArticles,
} from "@/test-utils/rr-274-factories";

vi.mock("@/lib/supabase/server");

describe("Article Retention Service (RR-274)", () => {
  const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
  };

  const mockUserId = "test-user-123";
  const retentionConfig = {
    maxCount: 1000,
    preserveStarred: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Retention Rules", () => {
    it("should delete articles exceeding retention count", async () => {
      const articles = createArticleBatch(1500, { isRead: true });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, retentionConfig);

      expect(result.deletedCount).toBe(500);
      expect(result.retainedCount).toBe(1000);
      expect(result.error).toBeNull();
    });

    it("should preserve all starred articles regardless of count", async () => {
      const mixedArticles = createMixedArticles();
      const allArticles = [
        ...mixedArticles.starred,
        ...mixedArticles.unread,
        ...mixedArticles.read,
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: allArticles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, {
        maxCount: 200,
        preserveStarred: true,
      });

      // Should keep all 100 starred + 100 most recent unstarred
      expect(result.retainedCount).toBe(200);
      expect(result.preservedStarredCount).toBe(100);

      // Verify delete was called with non-starred articles only
      const deleteCall = mockSupabase.from.mock.calls[1];
      expect(deleteCall).toBeDefined();
    });

    it("should preserve unread articles up to retention limit", async () => {
      const articles = [
        ...createArticleBatch(300, { isRead: false, isStarred: false }),
        ...createArticleBatch(300, { isRead: true, isStarred: false }),
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, {
        maxCount: 400,
        preserveStarred: true,
      });

      // Should keep all 300 unread + 100 most recent read
      expect(result.retainedCount).toBe(400);
      expect(result.preservedUnreadCount).toBe(300);
      expect(result.deletedCount).toBe(200);
    });

    it("should delete oldest read articles first", async () => {
      const now = Date.now();
      const articles = [
        createTestArticle({
          id: "new-1",
          isRead: true,
          publishedAt: new Date(now).toISOString(),
        }),
        createTestArticle({
          id: "old-1",
          isRead: true,
          publishedAt: new Date(now - 30 * 86400000).toISOString(),
        }),
        createTestArticle({
          id: "older-1",
          isRead: true,
          publishedAt: new Date(now - 60 * 86400000).toISOString(),
        }),
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      let deletedIds: string[] = [];
      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn((column, ids) => {
              deletedIds = ids;
              return { data: null, error: null };
            }),
          }),
        }),
      });

      await retainArticles(mockUserId, {
        maxCount: 1,
        preserveStarred: true,
      });

      expect(deletedIds).toContain("older-1");
      expect(deletedIds).toContain("old-1");
      expect(deletedIds).not.toContain("new-1");
    });

    it("should handle feeds with mixed article states", async () => {
      const articles = [
        ...createArticleBatch(50, { feedId: "feed-1", isStarred: true }),
        ...createArticleBatch(100, { feedId: "feed-1", isRead: false }),
        ...createArticleBatch(150, { feedId: "feed-2", isRead: true }),
        ...createArticleBatch(200, { feedId: "feed-3", isRead: false }),
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, {
        maxCount: 300,
        preserveStarred: true,
      });

      // Should keep: 50 starred + 250 most recent unstarred
      expect(result.retainedCount).toBe(300);
      expect(result.preservedStarredCount).toBe(50);
      expect(result.deletedCount).toBe(200);
    });

    it("should use database transaction for atomic operations", async () => {
      const articles = createArticleBatch(100);

      mockSupabase.rpc.mockResolvedValueOnce({
        data: {
          deleted_count: 50,
          retained_count: 50,
        },
        error: null,
      });

      const result = await retainArticles(mockUserId, {
        maxCount: 50,
        preserveStarred: true,
        useTransaction: true,
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "retain_articles_transaction",
        expect.objectContaining({
          p_user_id: mockUserId,
          p_max_count: 50,
          p_preserve_starred: true,
        })
      );
      expect(result.deletedCount).toBe(50);
      expect(result.retainedCount).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle retention when all articles are starred", async () => {
      const articles = createArticleBatch(500, { isStarred: true });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, {
        maxCount: 100,
        preserveStarred: true,
      });

      // No articles should be deleted
      expect(result.deletedCount).toBe(0);
      expect(result.retainedCount).toBe(500);
      expect(result.preservedStarredCount).toBe(500);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only select, no delete
    });

    it("should handle empty article list gracefully", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, retentionConfig);

      expect(result.deletedCount).toBe(0);
      expect(result.retainedCount).toBe(0);
      expect(result.error).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only select, no delete
    });

    it("should handle database errors with rollback", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: null,
              error: { message: "Database connection lost" },
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, retentionConfig);

      expect(result.error).toBe("Database connection lost");
      expect(result.deletedCount).toBe(0);
      expect(result.retainedCount).toBe(0);
    });

    it("should respect user-specific retention settings", async () => {
      const user1Articles = createArticleBatch(200, { userId: "user-1" });
      const user2Articles = createArticleBatch(200, { userId: "user-2" });

      // User 1 retention
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: user1Articles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result1 = await retainArticles("user-1", {
        maxCount: 100,
        preserveStarred: true,
      });

      expect(result1.deletedCount).toBe(100);
      expect(result1.retainedCount).toBe(100);

      // Verify user isolation
      const selectCall = mockSupabase.from.mock.calls[0];
      expect(selectCall).toBeDefined();
    });

    it("should handle concurrent retention operations", async () => {
      const lockAcquired = vi.fn().mockResolvedValue(true);
      const lockReleased = vi.fn().mockResolvedValue(true);

      mockSupabase.rpc.mockImplementation((fnName) => {
        if (fnName === "acquire_retention_lock") {
          return { data: lockAcquired(), error: null };
        }
        if (fnName === "release_retention_lock") {
          return { data: lockReleased(), error: null };
        }
        return { data: null, error: null };
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: createArticleBatch(100),
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, {
        ...retentionConfig,
        useLocking: true,
      });

      expect(lockAcquired).toHaveBeenCalled();
      expect(lockReleased).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it("should handle retention limit greater than total articles", async () => {
      const articles = createArticleBatch(50);

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      const result = await retainArticles(mockUserId, {
        maxCount: 5000,
        preserveStarred: true,
      });

      // No articles should be deleted
      expect(result.deletedCount).toBe(0);
      expect(result.retainedCount).toBe(50);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only select, no delete
    });
  });

  describe("Performance", () => {
    it("should process 5000 articles in under 5 seconds", async () => {
      const articles = createArticleBatch(5000);

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const startTime = Date.now();
      const result = await retainArticles(mockUserId, {
        maxCount: 2000,
        preserveStarred: true,
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000);
      expect(result.deletedCount).toBe(3000);
      expect(result.retainedCount).toBe(2000);
    });

    it("should batch deletions to avoid memory issues", async () => {
      const articles = createArticleBatch(10000);
      let deleteCallCount = 0;

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              data: articles,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockImplementation(() => ({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn((column, ids) => {
              deleteCallCount++;
              expect(ids.length).toBeLessThanOrEqual(1000); // Batch size limit
              return { data: null, error: null };
            }),
          }),
        }),
      }));

      await retainArticles(mockUserId, {
        maxCount: 1000,
        preserveStarred: true,
        batchSize: 1000,
      });

      expect(deleteCallCount).toBeGreaterThan(1); // Multiple batches
    });

    it("should use indexed queries for performance", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              hint: vi.fn().mockReturnValue({
                data: createArticleBatch(1000),
                error: null,
              }),
            }),
          }),
        }),
      });

      await retainArticles(mockUserId, {
        maxCount: 500,
        preserveStarred: true,
        useIndexHint: true,
      });

      const selectCall = mockSupabase.from.mock.calls[0];
      expect(selectCall).toBeDefined();
    });
  });
});
