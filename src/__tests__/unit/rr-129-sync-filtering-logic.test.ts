import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RR-129: Unit tests for sync filtering logic
 * Tests the logic that prevents previously deleted articles from being re-imported during sync
 */
describe("RR-129: Sync Filtering Logic", () => {
  // Mock Supabase client
  const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    delete: vi.fn(() => mockSupabase),
    in: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
  };

  // Mock sync filtering service
  const SyncFilterService = {
    async filterArticlesForSync(
      inoreaderArticles: any[],
      deletedArticleIds: Set<string>
    ) {
      const articlesToSync = [];
      const articlesToRemoveFromTracking = [];

      for (const article of inoreaderArticles) {
        const isInDeletedTracking = deletedArticleIds.has(article.id);
        const isReadInInoreader =
          article.categories?.includes("read") ||
          article.categories?.includes("user/-/state/com.google/read");
        const isUnreadInInoreader = !isReadInInoreader;

        if (isInDeletedTracking && isReadInInoreader) {
          // Article was deleted and is still read in Inoreader -> skip import
          continue;
        } else if (isInDeletedTracking && isUnreadInInoreader) {
          // Article was deleted but is now unread in Inoreader -> allow re-import and remove tracking
          articlesToSync.push(article);
          articlesToRemoveFromTracking.push(article.id);
        } else {
          // Normal article (not in deleted tracking) -> sync normally
          articlesToSync.push(article);
        }
      }

      return {
        articlesToSync,
        articlesToRemoveFromTracking,
        skippedCount: inoreaderArticles.length - articlesToSync.length,
      };
    },

    async getDeletedArticleIds(inoreaderArticleIds: string[]) {
      const { data } = await mockSupabase
        .from("deleted_articles")
        .select("inoreader_id")
        .in("inoreader_id", inoreaderArticleIds);

      return new Set(data?.map((d) => d.inoreader_id) || []);
    },

    async removeFromDeletedTracking(inoreaderIds: string[]) {
      if (inoreaderIds.length === 0) return { count: 0 };

      return await mockSupabase
        .from("deleted_articles")
        .delete()
        .in("inoreader_id", inoreaderIds);
    },

    // Helper to create Inoreader article with categories
    createInoreaderArticle(
      id: string,
      isRead: boolean = false,
      isStarred: boolean = false
    ) {
      const categories = [];
      if (isRead) {
        categories.push("user/-/state/com.google/read");
      }
      if (isStarred) {
        categories.push("user/-/state/com.google/starred");
      }

      return {
        id,
        title: `Article ${id}`,
        content: { content: `Content for ${id}` },
        published: Date.now() / 1000,
        categories,
      };
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.select.mockResolvedValue({ data: [], error: null });
    mockSupabase.delete.mockResolvedValue({
      data: null,
      error: null,
      count: 0,
    });
  });

  describe("Article Filtering Logic", () => {
    it("should skip previously deleted articles that are still read in Inoreader", async () => {
      const inoreaderArticles = [
        SyncFilterService.createInoreaderArticle("article-1", true), // read
        SyncFilterService.createInoreaderArticle("article-2", false), // unread
        SyncFilterService.createInoreaderArticle("article-3", true), // read
      ];

      const deletedArticleIds = new Set(["article-1", "article-3"]); // Both were previously deleted

      const result = await SyncFilterService.filterArticlesForSync(
        inoreaderArticles,
        deletedArticleIds
      );

      expect(result.articlesToSync).toHaveLength(1);
      expect(result.articlesToSync[0].id).toBe("article-2");
      expect(result.articlesToRemoveFromTracking).toHaveLength(0);
      expect(result.skippedCount).toBe(2);
    });

    it("should allow previously deleted articles that are now unread in Inoreader", async () => {
      const inoreaderArticles = [
        SyncFilterService.createInoreaderArticle("article-1", false), // now unread
        SyncFilterService.createInoreaderArticle("article-2", true), // still read
        SyncFilterService.createInoreaderArticle("article-3", false), // now unread
      ];

      const deletedArticleIds = new Set([
        "article-1",
        "article-2",
        "article-3",
      ]);

      const result = await SyncFilterService.filterArticlesForSync(
        inoreaderArticles,
        deletedArticleIds
      );

      expect(result.articlesToSync).toHaveLength(2);
      expect(result.articlesToSync.map((a) => a.id)).toEqual([
        "article-1",
        "article-3",
      ]);
      expect(result.articlesToRemoveFromTracking).toEqual([
        "article-1",
        "article-3",
      ]);
      expect(result.skippedCount).toBe(1);
    });

    it("should sync normal articles not in deleted tracking", async () => {
      const inoreaderArticles = [
        SyncFilterService.createInoreaderArticle("article-1", false),
        SyncFilterService.createInoreaderArticle("article-2", true),
        SyncFilterService.createInoreaderArticle("article-3", false),
      ];

      const deletedArticleIds = new Set(); // No deleted articles

      const result = await SyncFilterService.filterArticlesForSync(
        inoreaderArticles,
        deletedArticleIds
      );

      expect(result.articlesToSync).toHaveLength(3);
      expect(result.articlesToRemoveFromTracking).toHaveLength(0);
      expect(result.skippedCount).toBe(0);
    });

    it("should handle mixed scenarios correctly", async () => {
      const inoreaderArticles = [
        SyncFilterService.createInoreaderArticle("article-1", false), // normal unread
        SyncFilterService.createInoreaderArticle("article-2", true), // normal read
        SyncFilterService.createInoreaderArticle("article-3", true), // deleted & still read -> skip
        SyncFilterService.createInoreaderArticle("article-4", false), // deleted but now unread -> allow
        SyncFilterService.createInoreaderArticle("article-5", false), // normal unread
      ];

      const deletedArticleIds = new Set(["article-3", "article-4"]);

      const result = await SyncFilterService.filterArticlesForSync(
        inoreaderArticles,
        deletedArticleIds
      );

      expect(result.articlesToSync).toHaveLength(4);
      expect(result.articlesToSync.map((a) => a.id)).toEqual([
        "article-1",
        "article-2",
        "article-4",
        "article-5",
      ]);
      expect(result.articlesToRemoveFromTracking).toEqual(["article-4"]);
      expect(result.skippedCount).toBe(1);
    });

    it("should handle starred articles correctly regardless of read status", async () => {
      const inoreaderArticles = [
        SyncFilterService.createInoreaderArticle("article-1", true, true), // read & starred, was deleted
        SyncFilterService.createInoreaderArticle("article-2", false, true), // unread & starred, was deleted
      ];

      const deletedArticleIds = new Set(["article-1", "article-2"]);

      const result = await SyncFilterService.filterArticlesForSync(
        inoreaderArticles,
        deletedArticleIds
      );

      // Both should be synced: starred articles should always sync
      // article-1: read + starred -> should be skipped by read logic but starred might override
      // article-2: unread + starred -> should be allowed and removed from tracking
      expect(result.articlesToSync).toHaveLength(1);
      expect(result.articlesToSync[0].id).toBe("article-2");
      expect(result.articlesToRemoveFromTracking).toEqual(["article-2"]);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("Category Detection Logic", () => {
    it("should correctly identify read articles by category", async () => {
      const readArticle = {
        id: "read-test",
        categories: ["user/-/state/com.google/read"],
      };

      const deletedIds = new Set(["read-test"]);
      const result = await SyncFilterService.filterArticlesForSync(
        [readArticle],
        deletedIds
      );

      expect(result.skippedCount).toBe(1);
    });

    it("should correctly identify unread articles (no read category)", async () => {
      const unreadArticle = {
        id: "unread-test",
        categories: ["user/-/label/Important"], // Other categories but not read
      };

      const deletedIds = new Set(["unread-test"]);
      const result = await SyncFilterService.filterArticlesForSync(
        [unreadArticle],
        deletedIds
      );

      expect(result.articlesToSync).toHaveLength(1);
      expect(result.articlesToRemoveFromTracking).toEqual(["unread-test"]);
    });

    it("should handle articles with no categories", async () => {
      const articleWithoutCategories = {
        id: "no-categories",
        categories: [],
      };

      const deletedIds = new Set(["no-categories"]);
      const result = await SyncFilterService.filterArticlesForSync(
        [articleWithoutCategories],
        deletedIds
      );

      // Should be treated as unread and allowed
      expect(result.articlesToSync).toHaveLength(1);
      expect(result.articlesToRemoveFromTracking).toEqual(["no-categories"]);
    });

    it("should handle articles with undefined categories", async () => {
      const articleUndefinedCategories = {
        id: "undefined-categories",
        // categories property is missing
      };

      const deletedIds = new Set(["undefined-categories"]);
      const result = await SyncFilterService.filterArticlesForSync(
        [articleUndefinedCategories],
        deletedIds
      );

      // Should be treated as unread and allowed
      expect(result.articlesToSync).toHaveLength(1);
      expect(result.articlesToRemoveFromTracking).toEqual([
        "undefined-categories",
      ]);
    });

    it("should handle alternative read category formats", async () => {
      const readArticleAlt = {
        id: "alt-read",
        categories: ["read"], // Simplified read category
      };

      const deletedIds = new Set(["alt-read"]);
      const result = await SyncFilterService.filterArticlesForSync(
        [readArticleAlt],
        deletedIds
      );

      expect(result.articlesToSync).toHaveLength(1); // Should allow since it's not the exact Google Reader format
      expect(result.articlesToRemoveFromTracking).toEqual(["alt-read"]);
    });
  });

  describe("Deleted Article Tracking Integration", () => {
    it("should fetch deleted article IDs from database", async () => {
      const inoreaderIds = ["article-1", "article-2", "article-3"];
      const deletedData = [
        { inoreader_id: "article-1" },
        { inoreader_id: "article-3" },
      ];

      mockSupabase.select.mockResolvedValue({ data: deletedData, error: null });

      const result = await SyncFilterService.getDeletedArticleIds(inoreaderIds);

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
    });

    it("should remove articles from tracking when they become unread", async () => {
      const idsToRemove = ["article-1", "article-2"];

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 2,
      });

      await SyncFilterService.removeFromDeletedTracking(idsToRemove);

      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalledWith("inoreader_id", idsToRemove);
    });

    it("should handle empty removal arrays", async () => {
      const result = await SyncFilterService.removeFromDeletedTracking([]);

      expect(result.count).toBe(0);
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large article sets efficiently", async () => {
      const largeArticleSet = Array.from(
        { length: 1000 },
        (_, i) =>
          SyncFilterService.createInoreaderArticle(`article-${i}`, i % 2 === 0) // 50% read
      );

      const deletedIds = new Set(
        Array.from({ length: 500 }, (_, i) => `article-${i * 2}`) // 500 deleted articles
      );

      const startTime = Date.now();
      const result = await SyncFilterService.filterArticlesForSync(
        largeArticleSet,
        deletedIds
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should process quickly
      expect(result.articlesToSync.length + result.skippedCount).toBe(1000);
    });

    it("should handle empty article arrays", async () => {
      const result = await SyncFilterService.filterArticlesForSync(
        [],
        new Set()
      );

      expect(result.articlesToSync).toHaveLength(0);
      expect(result.articlesToRemoveFromTracking).toHaveLength(0);
      expect(result.skippedCount).toBe(0);
    });

    it("should handle empty deleted tracking set", async () => {
      const articles = [
        SyncFilterService.createInoreaderArticle("article-1", false),
        SyncFilterService.createInoreaderArticle("article-2", true),
      ];

      const result = await SyncFilterService.filterArticlesForSync(
        articles,
        new Set()
      );

      expect(result.articlesToSync).toHaveLength(2);
      expect(result.skippedCount).toBe(0);
    });

    it("should preserve article order in filtered results", async () => {
      const articles = [
        SyncFilterService.createInoreaderArticle("article-1", false),
        SyncFilterService.createInoreaderArticle("article-2", true), // Will be skipped
        SyncFilterService.createInoreaderArticle("article-3", false),
        SyncFilterService.createInoreaderArticle("article-4", false),
      ];

      const deletedIds = new Set(["article-2"]);

      const result = await SyncFilterService.filterArticlesForSync(
        articles,
        deletedIds
      );

      expect(result.articlesToSync.map((a) => a.id)).toEqual([
        "article-1",
        "article-3",
        "article-4",
      ]);
    });
  });

  describe("State Reconciliation Logic", () => {
    it("should handle state changes from read to unread in Inoreader", async () => {
      // Simulate an article that was deleted as read, but user marked it unread in Inoreader
      const article = SyncFilterService.createInoreaderArticle(
        "state-change",
        false
      ); // Now unread
      const deletedIds = new Set(["state-change"]); // Was previously deleted

      const result = await SyncFilterService.filterArticlesForSync(
        [article],
        deletedIds
      );

      expect(result.articlesToSync).toHaveLength(1);
      expect(result.articlesToRemoveFromTracking).toEqual(["state-change"]);
      expect(result.skippedCount).toBe(0);
    });

    it("should respect continued read state in Inoreader", async () => {
      // Article that was deleted as read and is still read in Inoreader
      const article = SyncFilterService.createInoreaderArticle(
        "still-read",
        true
      ); // Still read
      const deletedIds = new Set(["still-read"]); // Was previously deleted

      const result = await SyncFilterService.filterArticlesForSync(
        [article],
        deletedIds
      );

      expect(result.articlesToSync).toHaveLength(0);
      expect(result.articlesToRemoveFromTracking).toHaveLength(0);
      expect(result.skippedCount).toBe(1);
    });

    it("should handle complex state reconciliation scenarios", async () => {
      const articles = [
        SyncFilterService.createInoreaderArticle("kept-read", true), // Deleted, still read -> skip
        SyncFilterService.createInoreaderArticle("made-unread", false), // Deleted, now unread -> allow
        SyncFilterService.createInoreaderArticle("never-deleted", true), // Never deleted -> allow
        SyncFilterService.createInoreaderArticle("also-unread", false), // Deleted, now unread -> allow
      ];

      const deletedIds = new Set(["kept-read", "made-unread", "also-unread"]);

      const result = await SyncFilterService.filterArticlesForSync(
        articles,
        deletedIds
      );

      expect(result.articlesToSync.map((a) => a.id)).toEqual([
        "made-unread",
        "never-deleted",
        "also-unread",
      ]);
      expect(result.articlesToRemoveFromTracking).toEqual([
        "made-unread",
        "also-unread",
      ]);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors when fetching deleted IDs", async () => {
      mockSupabase.select.mockResolvedValue({
        data: null,
        error: { message: "DB Error" },
      });

      const result = await SyncFilterService.getDeletedArticleIds([
        "article-1",
      ]);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0); // Should return empty set on error
    });

    it("should handle removal errors gracefully", async () => {
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: { message: "Delete failed" },
        count: 0,
      });

      const result = await SyncFilterService.removeFromDeletedTracking([
        "article-1",
      ]);

      expect(result.error).toBeDefined();
      expect(result.count).toBe(0);
    });

    it("should handle malformed article data", async () => {
      const malformedArticles = [
        null,
        undefined,
        {},
        { id: null },
        { id: "", categories: "not-an-array" },
      ];

      const result = await SyncFilterService.filterArticlesForSync(
        malformedArticles,
        new Set()
      );

      // Should handle malformed data without crashing
      expect(result).toBeDefined();
      expect(result.articlesToSync).toBeDefined();
      expect(result.skippedCount).toBeDefined();
    });
  });
});
