import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test Specification for RR-171: RefreshManager
 *
 * This test defines the contract for the RefreshManager class that coordinates
 * all refresh operations after manual sync.
 *
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

// Mock interfaces that implementation must follow
interface RefreshManager {
  // Core refresh methods
  refreshAll(): Promise<void>;
  refreshFeeds(): Promise<void>;
  refreshArticles(): Promise<void>;
  refreshTags(): Promise<void>;

  // Sync-specific methods
  handleManualSync(): Promise<SyncResult>;
  handleBackgroundSync(): Promise<SyncResult>;

  // State management
  isRefreshing: boolean;
  lastRefreshTime: Date | null;
  refreshErrors: RefreshError[];
}

interface SyncResult {
  syncId: string;
  status: "completed" | "partial" | "failed";
  metrics: {
    newArticles: number;
    deletedArticles: number;
    newTags: number;
    failedFeeds: number;
  };
}

interface RefreshError {
  component: "feeds" | "articles" | "tags";
  error: Error;
  timestamp: Date;
}

// Mock store interfaces
interface FeedStore {
  feeds: Map<string, Feed>;
  isLoading: boolean;
  refreshFeeds: () => Promise<void>;
}

interface ArticleStore {
  articles: Map<string, Article>;
  isLoading: boolean;
  refreshArticles: () => Promise<void>;
}

interface TagStore {
  tags: Map<string, Tag>;
  isLoading: boolean;
  refreshTags: () => Promise<void>;
}

interface Feed {
  id: string;
  title: string;
  unread_count: number;
}

interface Article {
  id: string;
  title: string;
  is_read: boolean;
  is_starred: boolean;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  article_count: number;
}

describe("RR-171: RefreshManager Contract", () => {
  let refreshManager: RefreshManager;
  let mockFeedStore: FeedStore;
  let mockArticleStore: ArticleStore;
  let mockTagStore: TagStore;
  let mockToast: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock stores
    mockFeedStore = {
      feeds: new Map(),
      isLoading: false,
      refreshFeeds: vi.fn().mockResolvedValue(undefined),
    };

    mockArticleStore = {
      articles: new Map(),
      isLoading: false,
      refreshArticles: vi.fn().mockResolvedValue(undefined),
    };

    mockTagStore = {
      tags: new Map(),
      isLoading: false,
      refreshTags: vi.fn().mockResolvedValue(undefined),
    };

    // Mock toast
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    // Create RefreshManager instance (implementation will provide this)
    refreshManager = {
      isRefreshing: false,
      lastRefreshTime: null,
      refreshErrors: [],

      refreshAll: vi.fn(async () => {
        refreshManager.isRefreshing = true;
        try {
          await Promise.all([
            mockFeedStore.refreshFeeds(),
            mockArticleStore.refreshArticles(),
            mockTagStore.refreshTags(),
          ]);
          refreshManager.lastRefreshTime = new Date();
        } finally {
          refreshManager.isRefreshing = false;
        }
      }),

      refreshFeeds: vi.fn(() => mockFeedStore.refreshFeeds()),
      refreshArticles: vi.fn(() => mockArticleStore.refreshArticles()),
      refreshTags: vi.fn(() => mockTagStore.refreshTags()),

      handleManualSync: vi.fn().mockResolvedValue({
        syncId: "test-sync-id",
        status: "completed",
        metrics: {
          newArticles: 10,
          deletedArticles: 5,
          newTags: 2,
          failedFeeds: 0,
        },
      }),

      handleBackgroundSync: vi.fn().mockResolvedValue({
        syncId: "test-sync-id",
        status: "completed",
        metrics: {
          newArticles: 3,
          deletedArticles: 1,
          newTags: 0,
          failedFeeds: 0,
        },
      }),
    };
  });

  describe("Core Refresh Operations", () => {
    it("should refresh all stores in parallel", async () => {
      await refreshManager.refreshAll();

      expect(mockFeedStore.refreshFeeds).toHaveBeenCalledOnce();
      expect(mockArticleStore.refreshArticles).toHaveBeenCalledOnce();
      expect(mockTagStore.refreshTags).toHaveBeenCalledOnce();
      expect(refreshManager.lastRefreshTime).toBeInstanceOf(Date);
    });

    it("should set isRefreshing flag during refresh", async () => {
      const refreshPromise = refreshManager.refreshAll();

      // Should be refreshing immediately after call
      expect(refreshManager.isRefreshing).toBe(true);

      await refreshPromise;

      // Should not be refreshing after completion
      expect(refreshManager.isRefreshing).toBe(false);
    });

    it("should handle errors in individual store refreshes", async () => {
      const feedError = new Error("Feed refresh failed");
      mockFeedStore.refreshFeeds = vi.fn().mockRejectedValue(feedError);

      await refreshManager.refreshAll();

      // Other stores should still refresh
      expect(mockArticleStore.refreshArticles).toHaveBeenCalled();
      expect(mockTagStore.refreshTags).toHaveBeenCalled();

      // Error should be recorded
      expect(refreshManager.refreshErrors).toContainEqual(
        expect.objectContaining({
          component: "feeds",
          error: feedError,
        })
      );
    });

    it("should refresh individual stores independently", async () => {
      await refreshManager.refreshFeeds();
      expect(mockFeedStore.refreshFeeds).toHaveBeenCalledOnce();
      expect(mockArticleStore.refreshArticles).not.toHaveBeenCalled();
      expect(mockTagStore.refreshTags).not.toHaveBeenCalled();

      await refreshManager.refreshArticles();
      expect(mockArticleStore.refreshArticles).toHaveBeenCalledOnce();

      await refreshManager.refreshTags();
      expect(mockTagStore.refreshTags).toHaveBeenCalledOnce();
    });
  });

  describe("Manual Sync Behavior", () => {
    it("should trigger full refresh after successful manual sync", async () => {
      const result = await refreshManager.handleManualSync();

      expect(result.status).toBe("completed");
      expect(mockFeedStore.refreshFeeds).toHaveBeenCalled();
      expect(mockArticleStore.refreshArticles).toHaveBeenCalled();
      expect(mockTagStore.refreshTags).toHaveBeenCalled();
    });

    it("should show skeleton loading during manual sync", async () => {
      const syncPromise = refreshManager.handleManualSync();

      // During sync, stores should show loading state
      expect(refreshManager.isRefreshing).toBe(true);

      await syncPromise;

      expect(refreshManager.isRefreshing).toBe(false);
    });

    it("should return correct metrics from manual sync", async () => {
      const result = await refreshManager.handleManualSync();

      expect(result.metrics).toEqual({
        newArticles: 10,
        deletedArticles: 5,
        newTags: 2,
        failedFeeds: 0,
      });
    });

    it("should handle partial sync correctly", async () => {
      refreshManager.handleManualSync = vi.fn().mockResolvedValue({
        syncId: "test-sync-id",
        status: "partial",
        metrics: {
          newArticles: 7,
          deletedArticles: 3,
          newTags: 1,
          failedFeeds: 3,
        },
      });

      const result = await refreshManager.handleManualSync();

      expect(result.status).toBe("partial");
      expect(result.metrics.failedFeeds).toBe(3);

      // Should still refresh available data
      expect(mockFeedStore.refreshFeeds).toHaveBeenCalled();
      expect(mockArticleStore.refreshArticles).toHaveBeenCalled();
      expect(mockTagStore.refreshTags).toHaveBeenCalled();
    });

    it("should handle sync failure gracefully", async () => {
      refreshManager.handleManualSync = vi.fn().mockResolvedValue({
        syncId: "test-sync-id",
        status: "failed",
        metrics: {
          newArticles: 0,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 10,
        },
      });

      const result = await refreshManager.handleManualSync();

      expect(result.status).toBe("failed");

      // Should not refresh stores on complete failure
      expect(mockFeedStore.refreshFeeds).not.toHaveBeenCalled();
      expect(mockArticleStore.refreshArticles).not.toHaveBeenCalled();
      expect(mockTagStore.refreshTags).not.toHaveBeenCalled();
    });
  });

  describe("Background Sync Behavior", () => {
    it("should NOT trigger visible refresh during background sync", async () => {
      const result = await refreshManager.handleBackgroundSync();

      expect(result.status).toBe("completed");

      // Stores should NOT show loading state for background sync
      expect(refreshManager.isRefreshing).toBe(false);

      // Should still update data in background
      expect(mockFeedStore.refreshFeeds).toHaveBeenCalled();
      expect(mockArticleStore.refreshArticles).toHaveBeenCalled();
      expect(mockTagStore.refreshTags).toHaveBeenCalled();
    });

    it("should return metrics from background sync", async () => {
      const result = await refreshManager.handleBackgroundSync();

      expect(result.metrics).toEqual({
        newArticles: 3,
        deletedArticles: 1,
        newTags: 0,
        failedFeeds: 0,
      });
    });

    it("should handle background sync errors silently", async () => {
      mockFeedStore.refreshFeeds = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const result = await refreshManager.handleBackgroundSync();

      // Should complete even with errors
      expect(result).toBeDefined();

      // Should not set visible error state
      expect(refreshManager.isRefreshing).toBe(false);
    });
  });

  describe("State Management", () => {
    it("should track last refresh time", async () => {
      const beforeTime = new Date();
      await refreshManager.refreshAll();
      const afterTime = new Date();

      expect(refreshManager.lastRefreshTime).toBeDefined();
      expect(refreshManager.lastRefreshTime!.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(refreshManager.lastRefreshTime!.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });

    it("should accumulate refresh errors", async () => {
      mockFeedStore.refreshFeeds = vi
        .fn()
        .mockRejectedValue(new Error("Feed error"));
      mockTagStore.refreshTags = vi
        .fn()
        .mockRejectedValue(new Error("Tag error"));

      await refreshManager.refreshAll();

      expect(refreshManager.refreshErrors).toHaveLength(2);
      expect(refreshManager.refreshErrors).toContainEqual(
        expect.objectContaining({ component: "feeds" })
      );
      expect(refreshManager.refreshErrors).toContainEqual(
        expect.objectContaining({ component: "tags" })
      );
    });

    it("should clear old errors on successful refresh", async () => {
      // First, create some errors
      refreshManager.refreshErrors = [
        {
          component: "feeds",
          error: new Error("Old error"),
          timestamp: new Date(),
        },
      ];

      // Then do successful refresh
      await refreshManager.refreshAll();

      expect(refreshManager.refreshErrors).toHaveLength(0);
    });
  });

  describe("Concurrency Control", () => {
    it("should prevent concurrent refresh operations", async () => {
      const refresh1 = refreshManager.refreshAll();
      const refresh2 = refreshManager.refreshAll();

      await Promise.all([refresh1, refresh2]);

      // Should only call each store refresh once
      expect(mockFeedStore.refreshFeeds).toHaveBeenCalledTimes(1);
      expect(mockArticleStore.refreshArticles).toHaveBeenCalledTimes(1);
      expect(mockTagStore.refreshTags).toHaveBeenCalledTimes(1);
    });

    it("should queue manual sync if refresh is in progress", async () => {
      const refreshPromise = refreshManager.refreshAll();
      const syncPromise = refreshManager.handleManualSync();

      await Promise.all([refreshPromise, syncPromise]);

      // Sync should wait for refresh to complete
      expect(refreshManager.isRefreshing).toBe(false);
    });
  });
});
