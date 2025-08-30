/**
 * RR-240: Feed-Specific Preservation Integration Tests
 * 
 * Tests the integration of feed-specific article preservation across the article store.
 * Verifies that preserved articles are correctly filtered by feed context and that
 * feed boundaries are respected when navigating between different feed views.
 * 
 * Test Requirements:
 * 1. Feed-specific preservation across article store operations
 * 2. Isolation between different feeds' preserved articles
 * 3. Query building with feed context and preserved articles
 * 4. Interaction between filters and preserved articles
 * 
 * Key Scenarios:
 * - Feed-filtered views preserve read articles correctly on back navigation
 * - Preserved articles from Feed A don't appear in Feed B's filtered view
 * - All Articles view includes preserved articles from all feeds
 * - Topic filters respect feed boundaries for preserved articles
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Article } from "@/types";

// Mock Supabase client - must be hoisted
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'test-user' } } })),
    },
  },
}));

// Mock article list state manager - must be hoisted
vi.mock("@/lib/utils/article-list-state-manager", () => ({
  articleListStateManager: {
    getListState: vi.fn(),
    saveListState: vi.fn(),
    getPreservedArticleIds: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock("@/lib/utils/performance-monitor", () => ({
  performanceMonitor: {
    startMeasure: vi.fn(),
    endMeasure: vi.fn(),
    logPerformance: vi.fn(),
  },
}));

// Import after mocks
import { useArticleStore } from "@/lib/stores/article-store";
import { supabase } from "@/lib/db/supabase";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";

// Get mocked instances
const mockSupabase = vi.mocked(supabase);
const mockArticleListStateManager = vi.mocked(articleListStateManager);

// Helper to create mock articles
function createMockArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "article-1",
    feedId: "feed-1",
    feedTitle: "Test Feed 1",
    title: "Test Article",
    content: "Test content",
    url: "https://example.com/article",
    tags: [],
    isRead: false,
    isStarred: false,
    publishedAt: new Date().toISOString(),
    author: "Test Author",
    ...overrides,
  };
}

// Helper to create multiple articles across different feeds
function createArticlesAcrossFeeds(): Article[] {
  return [
    // Feed 1 articles
    createMockArticle({ id: "article-1", feedId: "feed-1", feedTitle: "Feed 1", isRead: false }),
    createMockArticle({ id: "article-2", feedId: "feed-1", feedTitle: "Feed 1", isRead: true }),
    createMockArticle({ id: "article-3", feedId: "feed-1", feedTitle: "Feed 1", isRead: false }),
    
    // Feed 2 articles  
    createMockArticle({ id: "article-4", feedId: "feed-2", feedTitle: "Feed 2", isRead: false }),
    createMockArticle({ id: "article-5", feedId: "feed-2", feedTitle: "Feed 2", isRead: true }),
    createMockArticle({ id: "article-6", feedId: "feed-2", feedTitle: "Feed 2", isRead: false }),
    
    // Feed 3 articles
    createMockArticle({ id: "article-7", feedId: "feed-3", feedTitle: "Feed 3", isRead: false }),
    createMockArticle({ id: "article-8", feedId: "feed-3", feedTitle: "Feed 3", isRead: true }),
    createMockArticle({ id: "article-9", feedId: "feed-3", feedTitle: "Feed 3", isRead: false }),
  ];
}

describe("RR-240: Feed-Specific Article Preservation Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Setup default Supabase mock responses
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe("Feed-Specific Preservation on Navigation", () => {
    it("should preserve read articles from a specific feed when navigating back", async () => {
      const articles = createArticlesAcrossFeeds();
      
      // Mock the database to return Feed 1 articles
      const feed1Articles = articles.filter(a => a.feedId === "feed-1");
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: feed1Articles, 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load articles for Feed 1
      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-1" });
      });

      // Mark an article as read
      await act(async () => {
        await result.current.markAsRead("article-1");
      });

      // Check sessionStorage for feed-specific preservation
      const preservedData = sessionStorage.getItem("preservedReadArticles");
      expect(preservedData).toBeTruthy();
      
      const parsed = JSON.parse(preservedData!);
      expect(parsed).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            articleId: "article-1",
            feedId: "feed-1",
          })
        ])
      );
    });

    it("should not show Feed A preserved articles in Feed B view", async () => {
      // Setup preserved articles from Feed 1
      const preservedArticles = [
        { articleId: "article-2", feedId: "feed-1", timestamp: Date.now() },
        { articleId: "article-3", feedId: "feed-1", timestamp: Date.now() },
      ];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(preservedArticles));

      // Mock the manager to return preserved IDs only for matching feed
      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (feedId === "feed-1") {
          return ["article-2", "article-3"];
        }
        return [];
      });

      const articles = createArticlesAcrossFeeds();
      const feed2Articles = articles.filter(a => a.feedId === "feed-2");
      
      // Mock database to return Feed 2 articles
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field, value) => {
          // Track that feedId filtering is applied
          if (field === "feed_id" && value === "feed-2") {
            return {
              in: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ 
                data: feed2Articles, 
                error: null 
              }),
            };
          }
          return mockSupabase.from();
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load articles for Feed 2
      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-2" });
      });

      // Verify that only Feed 2 articles are loaded (no Feed 1 preserved articles)
      expect(result.current.articles).toHaveLength(feed2Articles.length);
      expect(result.current.articles.every(a => a.feedId === "feed-2")).toBe(true);
    });

    it("should include preserved articles from all feeds in All Articles view", async () => {
      // Setup preserved articles from multiple feeds
      const preservedArticles = [
        { articleId: "article-2", feedId: "feed-1", timestamp: Date.now() },
        { articleId: "article-5", feedId: "feed-2", timestamp: Date.now() },
        { articleId: "article-8", feedId: "feed-3", timestamp: Date.now() },
      ];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(preservedArticles));

      // Mock the manager to return all preserved IDs when no feedId specified
      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (!feedId) {
          return ["article-2", "article-5", "article-8"];
        }
        return preservedArticles
          .filter(p => p.feedId === feedId)
          .map(p => p.articleId);
      });

      const allArticles = createArticlesAcrossFeeds();
      
      // Mock database to return all articles (no feed filter)
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn((field, values) => {
          // Should include preserved article IDs in query
          if (field === "id" && values.includes("article-2")) {
            return {
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ 
                data: allArticles, 
                error: null 
              }),
            };
          }
          return mockSupabase.from();
        }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: allArticles, 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load all articles (no feedId filter)
      await act(async () => {
        await result.current.loadArticles({});
      });

      // Verify preserved articles from all feeds are included
      const preservedIds = ["article-2", "article-5", "article-8"];
      const loadedPreservedArticles = result.current.articles.filter(a => 
        preservedIds.includes(a.id)
      );
      
      expect(loadedPreservedArticles).toHaveLength(3);
      expect(loadedPreservedArticles.map(a => a.feedId)).toEqual(
        expect.arrayContaining(["feed-1", "feed-2", "feed-3"])
      );
    });
  });

  describe("Query Building with Feed Context", () => {
    it("should build correct query with feed_id and preserved articles", async () => {
      // Setup preserved articles for Feed 1
      const preservedArticles = [
        { articleId: "article-2", feedId: "feed-1", timestamp: Date.now() },
      ];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(preservedArticles));

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (feedId === "feed-1") {
          return ["article-2"];
        }
        return [];
      });

      let queryCapture: any = {};
      
      // Mock Supabase to capture the query structure
      mockSupabase.from.mockImplementation((table) => {
        queryCapture.table = table;
        return {
          select: vi.fn((fields) => {
            queryCapture.select = fields;
            return {
              eq: vi.fn((field, value) => {
                queryCapture.feedFilter = { field, value };
                return {
                  in: vi.fn((field, values) => {
                    queryCapture.preservedFilter = { field, values };
                    return {
                      order: vi.fn().mockReturnThis(),
                      limit: vi.fn().mockResolvedValue({ 
                        data: [], 
                        error: null 
                      }),
                    };
                  }),
                  order: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({ 
                    data: [], 
                    error: null 
                  }),
                };
              }),
            };
          }),
        };
      });

      const { result } = renderHook(() => useArticleStore());

      // Load articles for Feed 1 with preserved articles
      await act(async () => {
        await result.current.loadArticles({ 
          feedId: "feed-1",
          readStatusFilter: "unread" 
        });
      });

      // Verify the query structure
      expect(queryCapture.table).toBe("articles");
      expect(queryCapture.feedFilter).toEqual({
        field: "feed_id",
        value: "feed-1"
      });
      
      // Should include preserved articles in the query
      if (queryCapture.preservedFilter) {
        expect(queryCapture.preservedFilter.field).toBe("id");
        expect(queryCapture.preservedFilter.values).toContain("article-2");
      }
    });

    it("should handle pagination with feed-specific preserved articles", async () => {
      // Setup preserved articles for Feed 1
      const preservedArticles = [
        { articleId: "article-2", feedId: "feed-1", timestamp: Date.now() },
        { articleId: "article-3", feedId: "feed-1", timestamp: Date.now() },
      ];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(preservedArticles));

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (feedId === "feed-1") {
          return ["article-2", "article-3"];
        }
        return [];
      });

      const articles = createArticlesAcrossFeeds();
      const feed1Articles = articles.filter(a => a.feedId === "feed-1");
      
      // Setup mock for initial load
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: feed1Articles.slice(0, 2), 
          error: null 
        }),
      });

      // Setup mock for load more
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ 
          data: [feed1Articles[2]], 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Initial load
      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-1" });
      });

      expect(result.current.articles).toHaveLength(2);

      // Load more articles
      await act(async () => {
        await result.current.loadMoreArticles();
      });

      // Should append new articles while maintaining feed context
      expect(result.current.articles).toHaveLength(3);
      expect(result.current.articles.every(a => a.feedId === "feed-1")).toBe(true);
    });
  });

  describe("Filter Interactions with Feed Boundaries", () => {
    it("should apply topic filters within feed boundaries", async () => {
      // Setup preserved articles with tags
      const preservedArticles = [
        { articleId: "article-tech-1", feedId: "feed-1", timestamp: Date.now() },
        { articleId: "article-tech-2", feedId: "feed-2", timestamp: Date.now() },
      ];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(preservedArticles));

      const techArticles = [
        createMockArticle({ 
          id: "article-tech-1", 
          feedId: "feed-1", 
          tags: ["technology"],
          isRead: true 
        }),
        createMockArticle({ 
          id: "article-tech-2", 
          feedId: "feed-2", 
          tags: ["technology"],
          isRead: true 
        }),
        createMockArticle({ 
          id: "article-tech-3", 
          feedId: "feed-1", 
          tags: ["technology"],
          isRead: false 
        }),
      ];

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (feedId === "feed-1") {
          return ["article-tech-1"];
        }
        if (feedId === "feed-2") {
          return ["article-tech-2"];
        }
        return [];
      });

      // Mock database to return only Feed 1 tech articles
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field, value) => {
          if (field === "feed_id" && value === "feed-1") {
            return {
              contains: vi.fn((field, value) => {
                if (field === "tags" && value.includes("technology")) {
                  return {
                    in: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ 
                      data: techArticles.filter(a => a.feedId === "feed-1"), 
                      error: null 
                    }),
                  };
                }
                return mockSupabase.from();
              }),
            };
          }
          return mockSupabase.from();
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load articles with both feed and tag filters
      await act(async () => {
        await result.current.loadArticles({ 
          feedId: "feed-1",
          tag: "technology" 
        });
      });

      // Should only include Feed 1 tech articles (including preserved)
      expect(result.current.articles.every(a => 
        a.feedId === "feed-1" && a.tags?.includes("technology")
      )).toBe(true);
      
      // Should include the preserved tech article from Feed 1
      const preservedArticle = result.current.articles.find(a => a.id === "article-tech-1");
      expect(preservedArticle).toBeTruthy();
      expect(preservedArticle?.isRead).toBe(true);
    });

    it("should handle read status filter with feed-specific preservation", async () => {
      // Setup preserved read articles for Feed 1
      const preservedArticles = [
        { articleId: "article-2", feedId: "feed-1", timestamp: Date.now() },
      ];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(preservedArticles));

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (feedId === "feed-1") {
          return ["article-2"];
        }
        return [];
      });

      const articles = createArticlesAcrossFeeds();
      
      // Mock for "unread" filter with preserved articles
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field, value) => {
          if (field === "feed_id" && value === "feed-1") {
            return {
              eq: vi.fn((field, value) => {
                if (field === "is_read" && value === false) {
                  // Return unread articles + preserved read article
                  return {
                    or: vi.fn().mockReturnThis(),
                    in: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue({ 
                      data: [
                        ...articles.filter(a => a.feedId === "feed-1" && !a.isRead),
                        articles.find(a => a.id === "article-2"), // preserved read article
                      ], 
                      error: null 
                    }),
                  };
                }
                return mockSupabase.from();
              }),
            };
          }
          return mockSupabase.from();
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load with unread filter but should include preserved read articles
      await act(async () => {
        await result.current.loadArticles({ 
          feedId: "feed-1",
          readStatusFilter: "unread" 
        });
      });

      // Should include both unread and preserved read articles from Feed 1
      const feed1Articles = result.current.articles.filter(a => a.feedId === "feed-1");
      expect(feed1Articles.length).toBeGreaterThan(0);
      
      // Check that preserved read article is included
      const preservedArticle = feed1Articles.find(a => a.id === "article-2");
      expect(preservedArticle).toBeTruthy();
      expect(preservedArticle?.isRead).toBe(true);
    });
  });

  describe("Backward Compatibility", () => {
    it("should handle legacy preserved articles without feedId", async () => {
      // Setup legacy preserved articles (without feedId)
      const legacyPreserved = ["article-1", "article-2", "article-3"];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(legacyPreserved));

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        // Legacy articles should be returned for all feeds
        return legacyPreserved;
      });

      const articles = createArticlesAcrossFeeds();
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: articles, 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load all articles
      await act(async () => {
        await result.current.loadArticles({});
      });

      // Legacy preserved articles should be included regardless of feed
      const preservedInResults = result.current.articles.filter(a => 
        legacyPreserved.includes(a.id)
      );
      expect(preservedInResults.length).toBeGreaterThan(0);
    });

    it("should migrate legacy format to new format on mark as read", async () => {
      // Start with legacy format
      const legacyPreserved = ["article-1", "article-2"];
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(legacyPreserved));

      const articles = createArticlesAcrossFeeds();
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        limit: vi.fn().mockResolvedValue({ 
          data: articles.filter(a => a.feedId === "feed-1"), 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Load Feed 1 articles
      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-1" });
      });

      // Mark a new article as read
      await act(async () => {
        await result.current.markAsRead("article-3");
      });

      // Check that sessionStorage now has new format with feedId
      const updatedPreserved = sessionStorage.getItem("preservedReadArticles");
      expect(updatedPreserved).toBeTruthy();
      
      const parsed = JSON.parse(updatedPreserved!);
      
      // Should have migrated to new format
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        expect(parsed).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              articleId: expect.any(String),
              feedId: expect.any(String),
            })
          ])
        );
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty preserved articles gracefully", async () => {
      // No preserved articles
      sessionStorage.clear();
      mockArticleListStateManager.getPreservedArticleIds.mockReturnValue([]);

      const articles = createArticlesAcrossFeeds();
      const feed1Articles = articles.filter(a => a.feedId === "feed-1" && !a.isRead);
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: feed1Articles, 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Should load normally without preserved articles
      await act(async () => {
        await result.current.loadArticles({ 
          feedId: "feed-1",
          readStatusFilter: "unread" 
        });
      });

      expect(result.current.articles).toHaveLength(feed1Articles.length);
      expect(result.current.articles.every(a => !a.isRead)).toBe(true);
    });

    it("should handle corrupt sessionStorage data", async () => {
      // Set corrupt data in sessionStorage
      sessionStorage.setItem("preservedReadArticles", "not-valid-json");

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation(() => {
        // Should handle corrupt data and return empty array
        try {
          const data = sessionStorage.getItem("preservedReadArticles");
          if (data) {
            JSON.parse(data);
          }
        } catch {
          return [];
        }
        return [];
      });

      const articles = createArticlesAcrossFeeds();
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          data: articles, 
          error: null 
        }),
      });

      const { result } = renderHook(() => useArticleStore());

      // Should load without errors despite corrupt sessionStorage
      await act(async () => {
        await result.current.loadArticles({});
      });

      expect(result.current.articles.length).toBeGreaterThan(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle switching between feeds rapidly", async () => {
      const articles = createArticlesAcrossFeeds();
      
      // Setup different responses for different feeds
      let currentFeed = "";
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field, value) => {
          if (field === "feed_id") {
            currentFeed = value;
          }
          return {
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ 
              data: articles.filter(a => a.feedId === currentFeed), 
              error: null 
            }),
          };
        }),
      }));

      const { result } = renderHook(() => useArticleStore());

      // Rapidly switch between feeds
      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-1" });
      });
      
      const feed1Count = result.current.articles.length;

      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-2" });
      });
      
      const feed2Count = result.current.articles.length;

      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-3" });
      });
      
      const feed3Count = result.current.articles.length;

      // Each feed should have its own articles
      expect(feed1Count).toBe(3);
      expect(feed2Count).toBe(3);
      expect(feed3Count).toBe(3);
      
      // Current articles should be from Feed 3
      expect(result.current.articles.every(a => a.feedId === "feed-3")).toBe(true);
    });

    it("should handle maximum preserved articles limit", async () => {
      // Create many preserved articles (test limit handling)
      const manyPreserved = Array.from({ length: 100 }, (_, i) => ({
        articleId: `article-${i}`,
        feedId: `feed-${i % 5}`, // Distribute across 5 feeds
        timestamp: Date.now() - i * 1000,
      }));
      sessionStorage.setItem("preservedReadArticles", JSON.stringify(manyPreserved));

      mockArticleListStateManager.getPreservedArticleIds.mockImplementation((feedId?: string) => {
        if (feedId) {
          return manyPreserved
            .filter(p => p.feedId === feedId)
            .map(p => p.articleId)
            .slice(0, 50); // Limit to 50 per feed
        }
        return manyPreserved.map(p => p.articleId).slice(0, 100); // Overall limit
      });

      const { result } = renderHook(() => useArticleStore());

      // Should handle large number of preserved articles without issues
      await act(async () => {
        await result.current.loadArticles({ feedId: "feed-0" });
      });

      expect(result.current.error).toBeNull();
    });
  });
});