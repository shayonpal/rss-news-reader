/**
 * @fileoverview Integration tests for RR-284 API transformation
 * Tests that API endpoints properly transform snake_case responses to camelCase
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMocks } from "node-mocks-http";
import { GET as articlesPageHandler } from "@/app/api/articles/paginated/route";
import { GET as syncStatusHandler } from "@/app/api/sync/route";
import { createClient } from "@supabase/supabase-js";

// Mock Supabase
vi.mock("@supabase/supabase-js");
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),
  data: null,
  error: null,
};

vi.mocked(createClient).mockReturnValue(mockSupabase as any);

describe("RR-284 API Transformation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("/api/articles/paginated transformation", () => {
    it("should transform snake_case article response to camelCase", async () => {
      // Mock database response with snake_case fields
      mockSupabase.data = [
        {
          id: "article-123",
          feed_id: "feed-uuid-456", // snake_case from database
          published_at: "2025-01-13T10:00:00Z", // snake_case from database
          is_partial_content: true,
          content_length: 150,
          feed_url: "https://feeds.bbci.co.uk/news/rss.xml",
          user_id: "user-789",
        },
      ];
      mockSupabase.single.mockResolvedValue({ data: mockSupabase.data[0] });

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=20",
        query: { page: "0", pageSize: "20" },
      });

      const response = await articlesPageHandler(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.articles).toHaveLength(1);

      const article = responseData.articles[0];

      // Verify camelCase transformation
      expect(article).toHaveProperty("feedId", "feed-uuid-456");
      expect(article).toHaveProperty("publishedAt", "2025-01-13T10:00:00Z");
      expect(article).toHaveProperty("isPartialContent", true);
      expect(article).toHaveProperty("contentLength", 150);
      expect(article).toHaveProperty(
        "feedUrl",
        "https://feeds.bbci.co.uk/news/rss.xml"
      );
      expect(article).toHaveProperty("userId", "user-789");

      // Verify snake_case fields are removed
      expect(article).not.toHaveProperty("feed_id");
      expect(article).not.toHaveProperty("published_at");
      expect(article).not.toHaveProperty("is_partial_content");
      expect(article).not.toHaveProperty("content_length");
      expect(article).not.toHaveProperty("feed_url");
      expect(article).not.toHaveProperty("user_id");
    });

    it("should handle paginated response metadata transformation", async () => {
      mockSupabase.data = [];

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=20",
        query: { page: "0", pageSize: "20" },
      });

      const response = await articlesPageHandler(req as any);
      const responseData = await response.json();

      expect(responseData).toHaveProperty("currentPage");
      expect(responseData).toHaveProperty("pageSize");
      expect(responseData).toHaveProperty("totalCount");
      expect(responseData).toHaveProperty("hasMore");

      // Verify no snake_case in metadata
      expect(responseData).not.toHaveProperty("current_page");
      expect(responseData).not.toHaveProperty("page_size");
      expect(responseData).not.toHaveProperty("total_count");
      expect(responseData).not.toHaveProperty("has_more");
    });

    it("should handle error responses without transformation issues", async () => {
      mockSupabase.error = { message: "Database connection failed" };
      mockSupabase.data = null;

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=20",
        query: { page: "0", pageSize: "20" },
      });

      const response = await articlesPageHandler(req as any);

      expect(response.status).toBe(500);
      const responseData = await response.json();

      // Error response should still be properly structured
      expect(responseData).toHaveProperty("error");
      expect(responseData.success).toBe(false);
    });
  });

  describe("/api/sync transformation", () => {
    it("should transform sync response data to camelCase", async () => {
      // Mock sync response with snake_case
      mockSupabase.data = {
        sync_status: "completed",
        last_sync_at: "2025-01-13T10:00:00Z",
        articles_synced: 45,
        feeds_updated: 12,
        error_count: 0,
      };

      const { req } = createMocks({
        method: "GET",
        url: "/api/sync",
      });

      const response = await syncStatusHandler(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);

      // Verify camelCase transformation
      expect(responseData.data).toHaveProperty("syncStatus", "completed");
      expect(responseData.data).toHaveProperty(
        "lastSyncAt",
        "2025-01-13T10:00:00Z"
      );
      expect(responseData.data).toHaveProperty("articlesSynced", 45);
      expect(responseData.data).toHaveProperty("feedsUpdated", 12);
      expect(responseData.data).toHaveProperty("errorCount", 0);

      // Verify snake_case fields are removed
      expect(responseData.data).not.toHaveProperty("sync_status");
      expect(responseData.data).not.toHaveProperty("last_sync_at");
      expect(responseData.data).not.toHaveProperty("articles_synced");
      expect(responseData.data).not.toHaveProperty("feeds_updated");
      expect(responseData.data).not.toHaveProperty("error_count");
    });
  });

  describe("Feed lookup compatibility", () => {
    it("should enable successful feed lookup with transformed feedId", async () => {
      // Mock feed data
      const mockFeedStore = new Map([
        [
          "feed-uuid-456",
          {
            id: "feed-uuid-456",
            isPartialContent: true,
            title: "BBC News",
            url: "https://feeds.bbci.co.uk/news/rss.xml",
          },
        ],
      ]);

      // Mock article with transformed feedId
      mockSupabase.data = [
        {
          id: "article-123",
          feed_id: "feed-uuid-456",
          published_at: "2025-01-13T10:00:00Z",
          is_partial_content: true,
        },
      ];

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=1",
        query: { page: "0", pageSize: "1" },
      });

      const response = await articlesPageHandler(req as any);
      const responseData = await response.json();

      const article = responseData.articles[0];

      // Simulate feed lookup logic
      const feedLookup = mockFeedStore.get(article.feedId);

      expect(feedLookup).toBeDefined();
      expect(feedLookup?.isPartialContent).toBe(true);
      expect(feedLookup?.id).toBe("feed-uuid-456");
    });
  });

  describe("Auto-fetch trigger scenario", () => {
    it("should provide correct data structure for auto-fetch logic", async () => {
      // Mock BBC article data
      mockSupabase.data = [
        {
          id: "bbc-article-123",
          feed_id: "bbc-feed-uuid",
          published_at: "2025-01-13T10:00:00Z",
          is_partial_content: true,
          content: "Truncated BBC content...",
          content_length: 150,
        },
      ];

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=1",
        query: { page: "0", pageSize: "1" },
      });

      const response = await articlesPageHandler(req as any);
      const responseData = await response.json();

      const article = responseData.articles[0];

      // Verify all properties needed for auto-fetch are present in camelCase
      expect(article.feedId).toBe("bbc-feed-uuid");
      expect(article.isPartialContent).toBe(true);
      expect(article.contentLength).toBe(150);

      // Simulate auto-fetch trigger logic
      const mockFeedStore = new Map([
        ["bbc-feed-uuid", { isPartialContent: true, title: "BBC News" }],
      ]);

      const feed = mockFeedStore.get(article.feedId);
      const shouldAutoFetch =
        feed?.isPartialContent &&
        article.isPartialContent &&
        article.contentLength < 200;

      expect(shouldAutoFetch).toBe(true);
    });
  });

  describe("Backwards compatibility", () => {
    it("should handle existing camelCase responses without corruption", async () => {
      // Mock response that's already in camelCase
      mockSupabase.data = [
        {
          id: "article-123",
          feedId: "feed-uuid-456", // Already camelCase
          publishedAt: "2025-01-13T10:00:00Z", // Already camelCase
          isPartialContent: false,
        },
      ];

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=1",
        query: { page: "0", pageSize: "1" },
      });

      const response = await articlesPageHandler(req as any);
      const responseData = await response.json();

      const article = responseData.articles[0];

      expect(article.feedId).toBe("feed-uuid-456");
      expect(article.publishedAt).toBe("2025-01-13T10:00:00Z");
      expect(article.isPartialContent).toBe(false);
    });

    it("should handle mixed case scenarios gracefully", async () => {
      // Mock response with mixed snake_case and camelCase
      mockSupabase.data = [
        {
          id: "article-123",
          feedId: "already-camel", // Already camelCase
          published_at: "2025-01-13T10:00:00Z", // Needs transformation
          isRead: true, // Already camelCase
        },
      ];

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=1",
        query: { page: "0", pageSize: "1" },
      });

      const response = await articlesPageHandler(req as any);
      const responseData = await response.json();

      const article = responseData.articles[0];

      expect(article.feedId).toBe("already-camel");
      expect(article.publishedAt).toBe("2025-01-13T10:00:00Z");
      expect(article.isRead).toBe(true);
      expect(article).not.toHaveProperty("published_at");
    });
  });

  describe("Performance impact", () => {
    it("should add minimal overhead to API responses", async () => {
      // Mock large response with 50 articles
      const articles = Array.from({ length: 50 }, (_, i) => ({
        id: `article-${i}`,
        feed_id: `feed-${i}`,
        published_at: "2025-01-13T10:00:00Z",
        is_partial_content: i % 2 === 0,
        content_length: 100 + i,
      }));

      mockSupabase.data = articles;

      const { req } = createMocks({
        method: "GET",
        url: "/api/articles/paginated?page=0&pageSize=50",
        query: { page: "0", pageSize: "50" },
      });

      const start = performance.now();
      const response = await articlesPageHandler(req as any);
      await response.json();
      const duration = performance.now() - start;

      // Total API response time including transformation should be reasonable
      expect(duration).toBeLessThan(100); // 100ms total
    });
  });
});
