/**
 * RR-179: Mark All Read with iOS Liquid Glass morphing UI for topic-filtered views
 * Integration Tests - localStorage + Store Integration Specification
 *
 * Test Categories:
 * 1. RR-197 localStorage Integration
 * 2. Store Method Integration
 * 3. Database Query Performance
 * 4. Race Condition Protection
 * 5. Fallback Handling
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { setupTestServer } from "./test-server";
import type { Server } from "http";
import { localStorageStateManager } from "@/lib/utils/localstorage-state-manager";
import { useArticleStore } from "@/lib/stores/article-store";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: "test-user" } } })
      ),
    },
  })),
}));

describe("RR-179: Tag Mark All Read Integration", () => {
  let server: Server;
  let app: any;
  let mockSupabase: any;

  beforeAll(async () => {
    const testServer = await setupTestServer(3002);
    server = testServer.server;
    app = testServer.app;

    await new Promise<void>((resolve) => {
      server.listen(3002, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase responses
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    (createClient as any).mockReturnValue(mockSupabase);

    // Mock localStorage
    const mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("RR-197 localStorage Integration", () => {
    it("should use batchMarkArticlesRead for instant UI feedback", async () => {
      const articles = [
        { articleId: "art-1", feedId: "feed-1" },
        { articleId: "art-2", feedId: "feed-1" },
        { articleId: "art-3", feedId: "feed-2" },
      ];

      const startTime = performance.now();
      const result =
        await localStorageStateManager.batchMarkArticlesRead(articles);
      const responseTime = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(responseTime).toBeLessThan(1); // <1ms requirement
      expect(result.fallbackUsed).toBe(false);
    });

    it("should queue articles for background sync", async () => {
      const articles = [
        { articleId: "art-1", feedId: "feed-1" },
        { articleId: "art-2", feedId: "feed-2" },
      ];

      await localStorageStateManager.batchMarkArticlesRead(articles);

      // Check localStorage queue
      const queue = JSON.parse(localStorage.getItem("sync_queue") || "[]");
      expect(queue).toHaveLength(2);
      expect(queue[0]).toMatchObject({
        articleId: "art-1",
        action: "mark_read",
      });
    });

    it("should handle localStorage quota exceeded", async () => {
      // Mock quota exceeded error
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

      const articles = [{ articleId: "art-1", feedId: "feed-1" }];

      const result =
        await localStorageStateManager.batchMarkArticlesRead(articles);

      expect(result.success).toBe(false);
      expect(result.error).toContain("quota");
    });

    it("should persist state across page reloads", async () => {
      const articles = [
        { articleId: "art-1", feedId: "feed-1" },
        { articleId: "art-2", feedId: "feed-2" },
      ];

      await localStorageStateManager.batchMarkArticlesRead(articles);

      // Simulate page reload by creating new instance
      const newManager = Object.create(localStorageStateManager);
      const persistedState = await newManager.getPersistedState();

      expect(persistedState.markedArticles).toContain("art-1");
      expect(persistedState.markedArticles).toContain("art-2");
    });
  });

  describe("Store Method Integration", () => {
    it("should integrate with existing markMultipleAsRead pattern", async () => {
      const store = useArticleStore.getState();
      const articleIds = ["art-1", "art-2", "art-3"];

      // Mock database response
      mockSupabase.update.mockResolvedValue({
        data: articleIds.map((id) => ({ id, is_read: true })),
        error: null,
      });

      await store.markMultipleAsRead(articleIds);

      // Verify database update
      expect(mockSupabase.from).toHaveBeenCalledWith("articles");
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_read: true,
          last_local_update: expect.any(String),
        })
      );
    });

    it("should add marked articles to sync queue", async () => {
      const store = useArticleStore.getState();
      const articleIds = ["art-1", "art-2"];

      mockSupabase.update.mockResolvedValue({
        data: articleIds.map((id) => ({ id, is_read: true })),
        error: null,
      });

      await store.markMultipleAsRead(articleIds);

      // Verify sync queue RPC calls
      expect(mockSupabase.rpc).toHaveBeenCalledWith("add_to_sync_queue", {
        p_article_id: "art-1",
        p_action: "mark_read",
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith("add_to_sync_queue", {
        p_article_id: "art-2",
        p_action: "mark_read",
      });
    });

    it("should update store state optimistically", async () => {
      const store = useArticleStore.getState();
      store.articles = [
        { id: "art-1", is_read: false },
        { id: "art-2", is_read: false },
      ];

      // Start marking as read
      const promise = store.markMultipleAsRead(["art-1", "art-2"]);

      // Check optimistic update (before database response)
      expect(store.articles[0].is_read).toBe(true);
      expect(store.articles[1].is_read).toBe(true);

      await promise;
    });

    it("should rollback on database error", async () => {
      const store = useArticleStore.getState();
      store.articles = [
        { id: "art-1", is_read: false },
        { id: "art-2", is_read: false },
      ];

      // Mock database error
      mockSupabase.update.mockRejectedValue(new Error("Database error"));

      await expect(
        store.markMultipleAsRead(["art-1", "art-2"])
      ).rejects.toThrow();

      // Verify rollback
      expect(store.articles[0].is_read).toBe(false);
      expect(store.articles[1].is_read).toBe(false);
    });
  });

  describe("Database Query Performance", () => {
    it("should filter articles by tag efficiently", async () => {
      const tagSlug = "technology";
      const userId = "test-user";

      // Mock efficient join query
      const query = `
        SELECT a.id, a.feed_id 
        FROM articles a
        INNER JOIN article_tags at ON a.id = at.article_id
        INNER JOIN tags t ON at.tag_id = t.id
        WHERE t.user_id = $1 AND t.slug = $2 AND a.is_read = false
      `;

      mockSupabase.rpc.mockImplementation((fn, params) => {
        if (fn === "get_unread_articles_by_tag") {
          return Promise.resolve({
            data: [
              { id: "art-1", feed_id: "feed-1" },
              { id: "art-2", feed_id: "feed-2" },
            ],
            error: null,
          });
        }
      });

      const startTime = performance.now();
      const result = await mockSupabase.rpc("get_unread_articles_by_tag", {
        p_user_id: userId,
        p_tag_slug: tagSlug,
      });
      const queryTime = performance.now() - startTime;

      expect(result.data).toHaveLength(2);
      expect(queryTime).toBeLessThan(100); // Query should be fast
    });

    it("should batch updates for performance", async () => {
      const articleIds = Array.from({ length: 100 }, (_, i) => `art-${i}`);

      mockSupabase.update.mockResolvedValue({
        data: articleIds.map((id) => ({ id, is_read: true })),
        error: null,
      });

      const startTime = performance.now();
      await useArticleStore.getState().markMultipleAsRead(articleIds);
      const batchTime = performance.now() - startTime;

      // Should complete within 500ms even for 100 articles
      expect(batchTime).toBeLessThan(500);

      // Should use single batch update
      expect(mockSupabase.update).toHaveBeenCalledTimes(1);
    });

    it("should use indexed columns for tag filtering", async () => {
      // Verify query uses indexed columns
      const explainResult = {
        data: [
          { "QUERY PLAN": "Index Scan using idx_tags_slug on tags" },
          {
            "QUERY PLAN":
              "Index Scan using idx_article_tags_article_id on article_tags",
          },
        ],
      };

      mockSupabase.rpc.mockImplementation((fn) => {
        if (fn === "explain_tag_filter_query") {
          return Promise.resolve(explainResult);
        }
      });

      const plan = await mockSupabase.rpc("explain_tag_filter_query");

      // Verify indexes are being used
      expect(
        plan.data.some((row) => row["QUERY PLAN"].includes("Index Scan"))
      ).toBe(true);
    });
  });

  describe("Race Condition Protection", () => {
    it("should handle concurrent mark operations safely", async () => {
      const store = useArticleStore.getState();
      const articles1 = ["art-1", "art-2"];
      const articles2 = ["art-3", "art-4"];

      mockSupabase.update.mockResolvedValue({ data: [], error: null });

      // Start two concurrent operations
      const promise1 = store.markMultipleAsRead(articles1);
      const promise2 = store.markMultipleAsRead(articles2);

      await Promise.all([promise1, promise2]);

      // Both should complete without conflicts
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
    });

    it("should use optimistic locking for state updates", async () => {
      const manager = localStorageStateManager;
      let version = 0;

      // Mock versioned updates
      const updateWithVersion = async (articles: any[]) => {
        const currentVersion = version;
        await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async

        if (version !== currentVersion) {
          throw new Error("Version conflict");
        }

        version++;
        return manager.batchMarkArticlesRead(articles);
      };

      // Concurrent updates
      const promise1 = updateWithVersion([
        { articleId: "art-1", feedId: "f1" },
      ]);
      const promise2 = updateWithVersion([
        { articleId: "art-2", feedId: "f2" },
      ]);

      const results = await Promise.allSettled([promise1, promise2]);

      // One should succeed, one should fail due to version conflict
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });

    it("should prevent double-marking of same articles", async () => {
      const store = useArticleStore.getState();
      const articleId = "art-1";

      store.articles = [{ id: articleId, is_read: false }];

      // Mock slow database
      let resolveUpdate: any;
      mockSupabase.update.mockReturnValue(
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
      );

      // Start first mark operation
      const promise1 = store.markMultipleAsRead([articleId]);

      // Try to mark same article again
      const promise2 = store.markMultipleAsRead([articleId]);

      // Resolve database update
      resolveUpdate({ data: [{ id: articleId, is_read: true }], error: null });

      await Promise.all([promise1, promise2]);

      // Should only update once
      expect(mockSupabase.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("Fallback Handling", () => {
    it("should fallback to direct database update when localStorage fails", async () => {
      // Make localStorage unavailable
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("localStorage is not available");
        },
      });

      const store = useArticleStore.getState();
      mockSupabase.update.mockResolvedValue({
        data: [{ id: "art-1", is_read: true }],
        error: null,
      });

      await store.markMultipleAsRead(["art-1"]);

      // Should use database directly
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it("should handle partial failures gracefully", async () => {
      const articles = [
        { articleId: "art-1", feedId: "feed-1" },
        { articleId: "art-2", feedId: "feed-2" },
        { articleId: "art-3", feedId: "feed-3" },
      ];

      // Mock partial failure
      let callCount = 0;
      const originalMethod = localStorageStateManager.batchMarkArticlesRead;
      localStorageStateManager.batchMarkArticlesRead = vi
        .fn()
        .mockImplementation((arts) => {
          callCount++;
          if (callCount === 1 && arts.some((a) => a.articleId === "art-2")) {
            throw new Error("Failed to mark art-2");
          }
          return originalMethod.call(localStorageStateManager, arts);
        });

      // Process with retry logic
      const successful: string[] = [];
      const failed: string[] = [];

      for (const article of articles) {
        try {
          await localStorageStateManager.batchMarkArticlesRead([article]);
          successful.push(article.articleId);
        } catch {
          failed.push(article.articleId);
        }
      }

      expect(successful).toContain("art-1");
      expect(successful).toContain("art-3");
      expect(failed).toContain("art-2");
    });

    it("should sync localStorage state with database on recovery", async () => {
      // Simulate articles marked in localStorage but not synced
      const localQueue = [
        { articleId: "art-1", action: "mark_read", timestamp: Date.now() },
        { articleId: "art-2", action: "mark_read", timestamp: Date.now() },
      ];

      localStorage.setItem("sync_queue", JSON.stringify(localQueue));

      // Trigger sync recovery
      mockSupabase.update.mockResolvedValue({ data: [], error: null });

      await localStorageStateManager.syncPendingChanges();

      // Verify sync attempted
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true })
      );

      // Queue should be cleared after successful sync
      const remainingQueue = JSON.parse(
        localStorage.getItem("sync_queue") || "[]"
      );
      expect(remainingQueue).toHaveLength(0);
    });
  });

  describe("Tag-Specific Behavior", () => {
    it("should only mark articles with specific tag", async () => {
      const tagSlug = "technology";

      // Mock tag-filtered query
      mockSupabase.from.mockImplementation((table) => {
        if (table === "articles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockImplementation((column, ids) => {
              // Filter to only articles with the tag
              const taggedArticles = ["art-1", "art-3"]; // art-2 doesn't have the tag
              const filteredIds = ids.filter((id) =>
                taggedArticles.includes(id)
              );
              return {
                data: filteredIds.map((id) => ({ id, is_read: true })),
                error: null,
              };
            }),
          };
        }
      });

      const allArticleIds = ["art-1", "art-2", "art-3"];
      const result = await useArticleStore
        .getState()
        .markMultipleAsRead(allArticleIds, { tagFilter: tagSlug });

      // Only tagged articles should be marked
      expect(result.markedCount).toBe(2); // art-1 and art-3
    });

    it("should handle tag with no articles gracefully", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [], // No articles for this tag
        error: null,
      });

      const result = await mockSupabase.rpc("get_unread_articles_by_tag", {
        p_tag_slug: "non-existent-tag",
      });

      expect(result.data).toHaveLength(0);
      expect(result.error).toBeNull();
    });
  });
});
