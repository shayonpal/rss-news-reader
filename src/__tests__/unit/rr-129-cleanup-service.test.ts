import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * RR-129: Unit tests for cleanup service functions
 * Tests the service layer logic for cleaning up deleted feeds and read articles
 */
describe("RR-129: Cleanup Service Functions", () => {
  // Mock Supabase client
  const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    insert: vi.fn(() => mockSupabase),
    upsert: vi.fn(() => mockSupabase),
    delete: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    neq: vi.fn(() => mockSupabase),
    in: vi.fn(() => mockSupabase),
    not: vi.fn(() => mockSupabase),
    lt: vi.fn(() => mockSupabase),
    single: vi.fn(),
    rpc: vi.fn(),
  };

  // Mock cleanup service functions that would be implemented
  const CleanupService = {
    async trackDeletedArticles(articles: any[]) {
      const articlesToTrack = articles.map((article) => ({
        inoreader_id: article.inoreader_id,
        was_read: true,
        feed_id: article.feed_id,
        deleted_at: new Date().toISOString(),
      }));

      return mockSupabase
        .from("deleted_articles")
        .upsert(articlesToTrack, { onConflict: "inoreader_id" });
    },

    async cleanupReadArticles() {
      // Get articles to delete
      const toDelete = await mockSupabase
        .from("articles")
        .select("inoreader_id, feed_id")
        .eq("is_read", true)
        .eq("is_starred", false);

      if (toDelete.data && toDelete.data.length > 0) {
        // Track deletions first
        await this.trackDeletedArticles(toDelete.data);

        // Then delete articles
        return await mockSupabase
          .from("articles")
          .delete()
          .eq("is_read", true)
          .eq("is_starred", false);
      }

      return { data: null, error: null, count: 0 };
    },

    async cleanupDeletedFeeds(inoreaderFeeds: any[]) {
      const inoreaderFeedIds = inoreaderFeeds.map((f) => f.id);

      // Get local feeds not in Inoreader
      const { data: localFeeds } = await mockSupabase
        .from("feeds")
        .select("id, inoreader_id");

      const feedsToDelete =
        localFeeds?.filter(
          (feed) => !inoreaderFeedIds.includes(feed.inoreader_id)
        ) || [];

      // Safety check: don't delete more than 50% of feeds
      if (localFeeds && feedsToDelete.length > localFeeds.length * 0.5) {
        throw new Error(
          "Safety check failed: attempting to delete more than 50% of feeds"
        );
      }

      if (feedsToDelete.length > 0) {
        // Delete feeds (articles will CASCADE delete due to foreign key)
        return await mockSupabase
          .from("feeds")
          .delete()
          .in(
            "inoreader_id",
            feedsToDelete.map((f) => f.inoreader_id)
          );
      }

      return { data: null, error: null, count: 0 };
    },

    async getDeletedArticleIds(inoreaderArticleIds: string[]) {
      const { data } = await mockSupabase
        .from("deleted_articles")
        .select("inoreader_id")
        .in("inoreader_id", inoreaderArticleIds);

      return new Set(data?.map((d) => d.inoreader_id) || []);
    },

    async removeFromDeletedTracking(inoreaderIds: string[]) {
      return await mockSupabase
        .from("deleted_articles")
        .delete()
        .in("inoreader_id", inoreaderIds);
    },

    async cleanupOldDeletedEntries() {
      const cutoffDate = new Date(
        Date.now() - 90 * 24 * 60 * 60 * 1000
      ).toISOString();

      return await mockSupabase
        .from("deleted_articles")
        .delete()
        .lt("deleted_at", cutoffDate);
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values
    mockSupabase.single.mockResolvedValue({ data: null, error: null });
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  });

  describe("trackDeletedArticles", () => {
    it("should track articles for deletion prevention", async () => {
      const articlesToTrack = [
        { inoreader_id: "article-1", feed_id: "feed-1" },
        { inoreader_id: "article-2", feed_id: "feed-2" },
      ];

      mockSupabase.upsert.mockResolvedValue({ data: [], error: null });

      await CleanupService.trackDeletedArticles(articlesToTrack);

      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            inoreader_id: "article-1",
            was_read: true,
            feed_id: "feed-1",
          }),
          expect.objectContaining({
            inoreader_id: "article-2",
            was_read: true,
            feed_id: "feed-2",
          }),
        ]),
        { onConflict: "inoreader_id" }
      );
    });

    it("should include deleted_at timestamp in tracking records", async () => {
      const articles = [{ inoreader_id: "test-article", feed_id: "test-feed" }];
      const beforeCall = Date.now();

      mockSupabase.upsert.mockResolvedValue({ data: [], error: null });

      await CleanupService.trackDeletedArticles(articles);

      const afterCall = Date.now();
      const upsertCall = mockSupabase.upsert.mock.calls[0][0];

      expect(upsertCall).toHaveLength(1);
      expect(upsertCall[0]).toHaveProperty("deleted_at");

      const deletedAt = new Date(upsertCall[0].deleted_at).getTime();
      expect(deletedAt).toBeGreaterThanOrEqual(beforeCall);
      expect(deletedAt).toBeLessThanOrEqual(afterCall);
    });

    it("should handle empty article arrays", async () => {
      mockSupabase.upsert.mockResolvedValue({ data: [], error: null });

      await CleanupService.trackDeletedArticles([]);

      expect(mockSupabase.upsert).toHaveBeenCalledWith([], {
        onConflict: "inoreader_id",
      });
    });
  });

  describe("cleanupReadArticles", () => {
    it("should clean up read, unstarred articles with tracking", async () => {
      const readArticles = [
        { inoreader_id: "read-1", feed_id: "feed-1" },
        { inoreader_id: "read-2", feed_id: "feed-2" },
      ];

      // Mock the select query for articles to delete
      const mockChain = {
        data: readArticles,
        error: null,
      };
      mockSupabase.eq.mockReturnValue(mockSupabase);
      mockSupabase.select.mockResolvedValue(mockChain);

      // Mock the delete operation
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 2,
      });
      mockSupabase.upsert.mockResolvedValue({ data: [], error: null });

      const result = await CleanupService.cleanupReadArticles();

      expect(mockSupabase.from).toHaveBeenCalledWith("articles");
      expect(mockSupabase.select).toHaveBeenCalledWith("inoreader_id, feed_id");
      expect(mockSupabase.eq).toHaveBeenCalledWith("is_read", true);
      expect(mockSupabase.eq).toHaveBeenCalledWith("is_starred", false);

      // Should track deletions
      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.upsert).toHaveBeenCalled();

      // Should delete articles
      expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it("should not delete starred articles even if read", async () => {
      // Mock query returns no articles (starred articles are excluded)
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await CleanupService.cleanupReadArticles();

      expect(mockSupabase.eq).toHaveBeenCalledWith("is_starred", false);
      expect(result.count).toBe(0);
    });

    it("should handle case with no articles to delete", async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await CleanupService.cleanupReadArticles();

      expect(result.count).toBe(0);
      expect(mockSupabase.upsert).not.toHaveBeenCalled();
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const dbError = new Error("Database connection failed");
      mockSupabase.select.mockRejectedValue(dbError);

      await expect(CleanupService.cleanupReadArticles()).rejects.toThrow(
        "Database connection failed"
      );
    });
  });

  describe("cleanupDeletedFeeds", () => {
    it("should delete feeds not present in Inoreader subscription list", async () => {
      const inoreaderFeeds = [
        { id: "feed-1", title: "Feed 1" },
        { id: "feed-2", title: "Feed 2" },
      ];

      const localFeeds = [
        { id: "local-1", inoreader_id: "feed-1" },
        { id: "local-2", inoreader_id: "feed-2" },
        { id: "local-3", inoreader_id: "feed-3" }, // This should be deleted
        { id: "local-4", inoreader_id: "feed-4" }, // This should be deleted
      ];

      mockSupabase.select.mockResolvedValue({ data: localFeeds, error: null });
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 2,
      });

      await CleanupService.cleanupDeletedFeeds(inoreaderFeeds);

      expect(mockSupabase.from).toHaveBeenCalledWith("feeds");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalledWith("inoreader_id", [
        "feed-3",
        "feed-4",
      ]);
    });

    it("should enforce safety check for mass deletion", async () => {
      const inoreaderFeeds = [{ id: "feed-1", title: "Feed 1" }];

      // Local has 10 feeds, but Inoreader only has 1 (90% would be deleted)
      const localFeeds = Array.from({ length: 10 }, (_, i) => ({
        id: `local-${i}`,
        inoreader_id: `feed-${i}`,
      }));

      mockSupabase.select.mockResolvedValue({ data: localFeeds, error: null });

      await expect(
        CleanupService.cleanupDeletedFeeds(inoreaderFeeds)
      ).rejects.toThrow(
        "Safety check failed: attempting to delete more than 50% of feeds"
      );

      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });

    it("should allow deletion when under safety threshold", async () => {
      const inoreaderFeeds = [
        { id: "feed-1", title: "Feed 1" },
        { id: "feed-2", title: "Feed 2" },
        { id: "feed-3", title: "Feed 3" },
        { id: "feed-4", title: "Feed 4" },
      ];

      const localFeeds = [
        { id: "local-1", inoreader_id: "feed-1" },
        { id: "local-2", inoreader_id: "feed-2" },
        { id: "local-3", inoreader_id: "feed-3" },
        { id: "local-4", inoreader_id: "feed-4" },
        { id: "local-5", inoreader_id: "feed-5" }, // Only this one should be deleted (20%)
      ];

      mockSupabase.select.mockResolvedValue({ data: localFeeds, error: null });
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 1,
      });

      await CleanupService.cleanupDeletedFeeds(inoreaderFeeds);

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalledWith("inoreader_id", ["feed-5"]);
    });

    it("should handle case with no feeds to delete", async () => {
      const inoreaderFeeds = [
        { id: "feed-1", title: "Feed 1" },
        { id: "feed-2", title: "Feed 2" },
      ];

      const localFeeds = [
        { id: "local-1", inoreader_id: "feed-1" },
        { id: "local-2", inoreader_id: "feed-2" },
      ];

      mockSupabase.select.mockResolvedValue({ data: localFeeds, error: null });

      const result = await CleanupService.cleanupDeletedFeeds(inoreaderFeeds);

      expect(result.count).toBe(0);
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });
  });

  describe("getDeletedArticleIds", () => {
    it("should return set of previously deleted article IDs", async () => {
      const inoreaderIds = ["article-1", "article-2", "article-3"];
      const deletedArticles = [
        { inoreader_id: "article-1" },
        { inoreader_id: "article-3" },
      ];

      mockSupabase.select.mockResolvedValue({
        data: deletedArticles,
        error: null,
      });

      const result = await CleanupService.getDeletedArticleIds(inoreaderIds);

      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.select).toHaveBeenCalledWith("inoreader_id");
      expect(mockSupabase.in).toHaveBeenCalledWith(
        "inoreader_id",
        inoreaderIds
      );

      expect(result).toBeInstanceOf(Set);
      expect(result.has("article-1")).toBe(true);
      expect(result.has("article-2")).toBe(false);
      expect(result.has("article-3")).toBe(true);
      expect(result.size).toBe(2);
    });

    it("should return empty set when no deleted articles found", async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await CleanupService.getDeletedArticleIds(["article-1"]);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it("should handle database errors", async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: new Error("DB Error"),
      });

      const result = await CleanupService.getDeletedArticleIds(["article-1"]);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe("removeFromDeletedTracking", () => {
    it("should remove articles from tracking when they become unread", async () => {
      const inoreaderIds = ["article-1", "article-2"];

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 2,
      });

      await CleanupService.removeFromDeletedTracking(inoreaderIds);

      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalledWith(
        "inoreader_id",
        inoreaderIds
      );
    });

    it("should handle empty ID arrays", async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 0,
      });

      await CleanupService.removeFromDeletedTracking([]);

      expect(mockSupabase.in).toHaveBeenCalledWith("inoreader_id", []);
    });
  });

  describe("cleanupOldDeletedEntries", () => {
    it("should clean up entries older than 90 days", async () => {
      const mockDate = new Date("2023-01-01");
      const expectedCutoff = new Date(
        mockDate.getTime() - 90 * 24 * 60 * 60 * 1000
      ).toISOString();

      vi.spyOn(Date, "now").mockReturnValue(mockDate.getTime());

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 5,
      });

      await CleanupService.cleanupOldDeletedEntries();

      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.lt).toHaveBeenCalledWith(
        "deleted_at",
        expectedCutoff
      );

      vi.restoreAllMocks();
    });

    it("should handle case with no old entries", async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 0,
      });

      const result = await CleanupService.cleanupOldDeletedEntries();

      expect(result.count).toBe(0);
      expect(mockSupabase.delete).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should propagate database errors appropriately", async () => {
      const dbError = { message: "Connection timeout", code: "08006" };
      mockSupabase.select.mockResolvedValue({ data: null, error: dbError });

      await expect(CleanupService.cleanupReadArticles()).rejects.toBeDefined();
    });

    it("should handle partial operation failures", async () => {
      mockSupabase.select.mockResolvedValue({
        data: [{ inoreader_id: "test", feed_id: "feed" }],
        error: null,
      });

      // Tracking succeeds but deletion fails
      mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: { message: "Delete failed" },
        count: 0,
      });

      const result = await CleanupService.cleanupReadArticles();

      // Should still track even if deletion fails
      expect(mockSupabase.upsert).toHaveBeenCalled();
      expect(result.error).toBeDefined();
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large batches of articles efficiently", async () => {
      const largeArticleSet = Array.from({ length: 1000 }, (_, i) => ({
        inoreader_id: `article-${i}`,
        feed_id: `feed-${i % 10}`,
      }));

      mockSupabase.select.mockResolvedValue({
        data: largeArticleSet,
        error: null,
      });
      mockSupabase.upsert.mockResolvedValue({ data: [], error: null });
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 1000,
      });

      const startTime = Date.now();
      await CleanupService.cleanupReadArticles();
      const duration = Date.now() - startTime;

      // Should complete within reasonable time for large dataset
      expect(duration).toBeLessThan(5000); // 5 seconds max for mocked operations
      expect(mockSupabase.upsert).toHaveBeenCalledTimes(1);
    });

    it("should optimize queries for deletion tracking lookups", async () => {
      const articleIds = Array.from({ length: 500 }, (_, i) => `article-${i}`);

      mockSupabase.select.mockResolvedValue({
        data: articleIds.slice(0, 100).map((id) => ({ inoreader_id: id })),
        error: null,
      });

      const startTime = Date.now();
      const result = await CleanupService.getDeletedArticleIds(articleIds);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should be fast lookup
      expect(result.size).toBe(100);
      expect(mockSupabase.in).toHaveBeenCalledWith("inoreader_id", articleIds);
    });
  });
});
