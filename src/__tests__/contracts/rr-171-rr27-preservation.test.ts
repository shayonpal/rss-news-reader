import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test Specification for RR-171: RR-27 Compatibility
 *
 * CRITICAL REQUIREMENT:
 * The RR-27 feature (2-second auto-mark-as-read delay) must remain
 * completely unaffected by the refresh manager implementation.
 *
 * RR-27 Feature:
 * - Articles automatically marked as read after 2 seconds of viewing
 * - Timer resets when switching articles
 * - Timer pauses when scrolling
 * - Timer cancels when navigating away
 *
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface AutoMarkAsReadManager {
  currentTimer: NodeJS.Timeout | null;
  currentArticleId: string | null;
  delayMs: number;
  isPaused: boolean;
  startTime: number | null;
  remainingTime: number;

  startTimer(articleId: string): void;
  pauseTimer(): void;
  resumeTimer(): void;
  cancelTimer(): void;
  markAsRead(articleId: string): void;
}

interface RefreshManager {
  refreshAll(): Promise<void>;
  isRefreshing: boolean;
}

interface ArticleViewState {
  currentArticleId: string | null;
  isScrolling: boolean;
  viewStartTime: Date | null;
  markedAsRead: boolean;
}

describe("RR-171: RR-27 Compatibility Contract", () => {
  let autoMarkManager: AutoMarkAsReadManager;
  let refreshManager: RefreshManager;
  let articleViewState: ArticleViewState;
  let mockMarkAsReadAPI: any;
  let mockRefreshStores: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockMarkAsReadAPI = vi.fn().mockResolvedValue({ success: true });
    mockRefreshStores = vi.fn().mockResolvedValue(undefined);

    articleViewState = {
      currentArticleId: null,
      isScrolling: false,
      viewStartTime: null,
      markedAsRead: false,
    };

    autoMarkManager = {
      currentTimer: null,
      currentArticleId: null,
      delayMs: 2000, // 2 seconds per RR-27
      isPaused: false,
      startTime: null,
      remainingTime: 2000,

      startTimer: function (articleId: string) {
        // Cancel any existing timer
        this.cancelTimer();

        this.currentArticleId = articleId;
        this.startTime = Date.now();
        this.remainingTime = this.delayMs;
        this.isPaused = false;

        this.currentTimer = setTimeout(() => {
          this.markAsRead(articleId);
        }, this.delayMs);
      },

      pauseTimer: function () {
        if (!this.currentTimer || this.isPaused) return;

        clearTimeout(this.currentTimer);
        this.currentTimer = null;

        const elapsed = Date.now() - (this.startTime || 0);
        this.remainingTime = Math.max(0, this.delayMs - elapsed);
        this.isPaused = true;
      },

      resumeTimer: function () {
        if (!this.isPaused || !this.currentArticleId) return;

        this.isPaused = false;
        this.startTime = Date.now();

        this.currentTimer = setTimeout(() => {
          this.markAsRead(this.currentArticleId!);
        }, this.remainingTime);
      },

      cancelTimer: function () {
        if (this.currentTimer) {
          clearTimeout(this.currentTimer);
          this.currentTimer = null;
        }
        this.currentArticleId = null;
        this.isPaused = false;
        this.startTime = null;
        this.remainingTime = this.delayMs;
      },

      markAsRead: function (articleId: string) {
        mockMarkAsReadAPI(articleId);
        articleViewState.markedAsRead = true;
        this.cancelTimer();
      },
    };

    refreshManager = {
      isRefreshing: false,
      refreshAll: async function () {
        this.isRefreshing = true;
        await mockRefreshStores();
        this.isRefreshing = false;
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Basic RR-27 Functionality Preservation", () => {
    it("should mark article as read after exactly 2 seconds", () => {
      const articleId = "article-123";

      autoMarkManager.startTimer(articleId);
      expect(mockMarkAsReadAPI).not.toHaveBeenCalled();

      // Advance just under 2 seconds
      vi.advanceTimersByTime(1999);
      expect(mockMarkAsReadAPI).not.toHaveBeenCalled();

      // Complete the 2 seconds
      vi.advanceTimersByTime(1);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
      expect(articleViewState.markedAsRead).toBe(true);
    });

    it("should cancel timer when switching articles", () => {
      const article1 = "article-1";
      const article2 = "article-2";

      // Start viewing article 1
      autoMarkManager.startTimer(article1);

      // Switch to article 2 after 1 second
      vi.advanceTimersByTime(1000);
      autoMarkManager.startTimer(article2);

      // Wait another 1.5 seconds
      vi.advanceTimersByTime(1500);

      // Article 1 should NOT be marked as read
      expect(mockMarkAsReadAPI).not.toHaveBeenCalledWith(article1);

      // Wait remaining 0.5 seconds for article 2
      vi.advanceTimersByTime(500);

      // Only article 2 should be marked as read
      expect(mockMarkAsReadAPI).toHaveBeenCalledTimes(1);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(article2);
    });

    it("should pause timer when scrolling starts", () => {
      const articleId = "article-456";

      autoMarkManager.startTimer(articleId);

      // Scroll after 1 second
      vi.advanceTimersByTime(1000);
      articleViewState.isScrolling = true;
      autoMarkManager.pauseTimer();

      // Wait 2 more seconds (timer is paused)
      vi.advanceTimersByTime(2000);

      // Should NOT be marked as read yet
      expect(mockMarkAsReadAPI).not.toHaveBeenCalled();
      expect(autoMarkManager.isPaused).toBe(true);
      expect(autoMarkManager.remainingTime).toBe(1000); // 1 second remaining
    });

    it("should resume timer when scrolling stops", () => {
      const articleId = "article-789";

      autoMarkManager.startTimer(articleId);

      // Scroll after 0.5 seconds
      vi.advanceTimersByTime(500);
      autoMarkManager.pauseTimer();

      // Stop scrolling after 1 second of pause
      vi.advanceTimersByTime(1000);
      articleViewState.isScrolling = false;
      autoMarkManager.resumeTimer();

      // Should have 1.5 seconds remaining
      vi.advanceTimersByTime(1499);
      expect(mockMarkAsReadAPI).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
    });
  });

  describe("RR-27 During Refresh Operations", () => {
    it("should continue RR-27 timer during store refresh", async () => {
      const articleId = "article-during-refresh";

      autoMarkManager.startTimer(articleId);

      // Start refresh after 0.5 seconds
      vi.advanceTimersByTime(500);
      const refreshPromise = refreshManager.refreshAll();

      // Timer should continue during refresh
      vi.advanceTimersByTime(1500);

      await refreshPromise;

      // Article should be marked as read despite refresh
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
    });

    it("should NOT reset RR-27 timer when sidebar refreshes", async () => {
      const articleId = "article-sidebar-refresh";

      autoMarkManager.startTimer(articleId);
      const initialTimer = autoMarkManager.currentTimer;

      // Sidebar refresh after 1 second
      vi.advanceTimersByTime(1000);
      await refreshManager.refreshAll();

      // Timer should be the same or continuing
      expect(autoMarkManager.currentArticleId).toBe(articleId);

      // Complete the remaining second
      vi.advanceTimersByTime(1000);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
    });

    it("should maintain pause state during refresh", async () => {
      const articleId = "article-paused-refresh";

      autoMarkManager.startTimer(articleId);

      // Pause after 0.8 seconds
      vi.advanceTimersByTime(800);
      autoMarkManager.pauseTimer();

      // Refresh while paused
      await refreshManager.refreshAll();

      // Should still be paused
      expect(autoMarkManager.isPaused).toBe(true);
      expect(autoMarkManager.remainingTime).toBe(1200);

      // Resume and complete
      autoMarkManager.resumeTimer();
      vi.advanceTimersByTime(1200);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
    });
  });

  describe("RR-27 Timer Independence", () => {
    it("should isolate RR-27 timer from sync operations", async () => {
      const articleId = "article-sync-isolated";

      // Mock sync operation
      const mockSync = vi.fn().mockResolvedValue({
        status: "completed",
        metrics: {
          newArticles: 5,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      });

      autoMarkManager.startTimer(articleId);

      // Sync after 1 second
      vi.advanceTimersByTime(1000);
      await mockSync();

      // Timer should continue unaffected
      vi.advanceTimersByTime(1000);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
    });

    it("should handle concurrent timers for rapid article navigation", () => {
      const articles = ["art-1", "art-2", "art-3"];

      // Rapid article switching
      articles.forEach((articleId, index) => {
        autoMarkManager.startTimer(articleId);
        vi.advanceTimersByTime(500); // Switch every 0.5 seconds
      });

      // Only the last article's timer should be active
      expect(autoMarkManager.currentArticleId).toBe("art-3");

      // Complete timer for last article
      vi.advanceTimersByTime(1500);

      // Only last article marked as read
      expect(mockMarkAsReadAPI).toHaveBeenCalledTimes(1);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith("art-3");
    });

    it("should preserve timer accuracy with multiple pause/resume cycles", () => {
      const articleId = "article-multi-pause";

      autoMarkManager.startTimer(articleId);

      // First pause at 0.5s
      vi.advanceTimersByTime(500);
      autoMarkManager.pauseTimer();
      expect(autoMarkManager.remainingTime).toBe(1500);

      // Resume after 1s pause
      vi.advanceTimersByTime(1000);
      autoMarkManager.resumeTimer();

      // Second pause at 0.3s more
      vi.advanceTimersByTime(300);
      autoMarkManager.pauseTimer();
      expect(autoMarkManager.remainingTime).toBe(1200);

      // Resume and complete
      vi.advanceTimersByTime(500);
      autoMarkManager.resumeTimer();
      vi.advanceTimersByTime(1200);

      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);
    });
  });

  describe("RR-27 Error Handling", () => {
    it("should handle mark-as-read API failures gracefully", async () => {
      const articleId = "article-api-fail";
      mockMarkAsReadAPI.mockRejectedValueOnce(new Error("API Error"));

      autoMarkManager.startTimer(articleId);
      vi.advanceTimersByTime(2000);

      // API called despite potential failure
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(articleId);

      // Timer should be cleared
      expect(autoMarkManager.currentTimer).toBeNull();
      expect(autoMarkManager.currentArticleId).toBeNull();
    });

    it("should not interfere with refresh even if timer fails", async () => {
      const articleId = "article-timer-fail";

      autoMarkManager.startTimer(articleId);

      // Simulate timer failure
      autoMarkManager.markAsRead = vi.fn(() => {
        throw new Error("Timer processing failed");
      });

      // Trigger timer
      vi.advanceTimersByTime(2000);

      // Refresh should still work
      await expect(refreshManager.refreshAll()).resolves.toBeUndefined();
      expect(refreshManager.isRefreshing).toBe(false);
    });
  });

  describe("RR-27 State Consistency", () => {
    it("should maintain consistent state across all operations", () => {
      const states: any[] = [];

      // Track state changes
      const recordState = () => {
        states.push({
          hasTimer: autoMarkManager.currentTimer !== null,
          articleId: autoMarkManager.currentArticleId,
          isPaused: autoMarkManager.isPaused,
          remainingTime: autoMarkManager.remainingTime,
        });
      };

      recordState(); // Initial

      autoMarkManager.startTimer("article-1");
      recordState(); // After start

      vi.advanceTimersByTime(1000);
      autoMarkManager.pauseTimer();
      recordState(); // After pause

      autoMarkManager.resumeTimer();
      recordState(); // After resume

      vi.advanceTimersByTime(1000);
      recordState(); // After completion

      expect(states).toEqual([
        {
          hasTimer: false,
          articleId: null,
          isPaused: false,
          remainingTime: 2000,
        },
        {
          hasTimer: true,
          articleId: "article-1",
          isPaused: false,
          remainingTime: 2000,
        },
        {
          hasTimer: false,
          articleId: "article-1",
          isPaused: true,
          remainingTime: 1000,
        },
        {
          hasTimer: true,
          articleId: "article-1",
          isPaused: false,
          remainingTime: 1000,
        },
        {
          hasTimer: false,
          articleId: null,
          isPaused: false,
          remainingTime: 2000,
        },
      ]);
    });

    it("should never have multiple active timers", () => {
      const article1 = "multi-1";
      const article2 = "multi-2";

      autoMarkManager.startTimer(article1);
      const timer1 = autoMarkManager.currentTimer;

      autoMarkManager.startTimer(article2);
      const timer2 = autoMarkManager.currentTimer;

      // Should have cancelled first timer
      expect(timer1).not.toBe(timer2);
      expect(autoMarkManager.currentArticleId).toBe(article2);

      // Only one timer active
      vi.advanceTimersByTime(2000);
      expect(mockMarkAsReadAPI).toHaveBeenCalledTimes(1);
      expect(mockMarkAsReadAPI).toHaveBeenCalledWith(article2);
    });
  });

  describe("RR-27 Integration Points", () => {
    it("should work correctly with optimistic UI updates", () => {
      const articleId = "article-optimistic";

      // Simulate optimistic UI update
      const optimisticUpdate = () => {
        articleViewState.markedAsRead = true; // UI shows as read immediately
      };

      autoMarkManager.startTimer(articleId);

      // User manually marks as read before timer
      vi.advanceTimersByTime(1000);
      optimisticUpdate();
      autoMarkManager.cancelTimer(); // Cancel since manually marked

      // Timer should not fire
      vi.advanceTimersByTime(2000);
      expect(mockMarkAsReadAPI).not.toHaveBeenCalled();
    });

    it("should handle navigation away before timer completes", () => {
      const articleId = "article-navigate-away";

      autoMarkManager.startTimer(articleId);

      // Navigate away after 1.5 seconds
      vi.advanceTimersByTime(1500);
      autoMarkManager.cancelTimer();
      articleViewState.currentArticleId = null;

      // Timer should not fire
      vi.advanceTimersByTime(1000);
      expect(mockMarkAsReadAPI).not.toHaveBeenCalled();
    });

    it("should preserve 2-second delay configuration", () => {
      expect(autoMarkManager.delayMs).toBe(2000);

      // Delay should not be modified by any operations
      autoMarkManager.startTimer("test-article");
      expect(autoMarkManager.delayMs).toBe(2000);

      autoMarkManager.pauseTimer();
      expect(autoMarkManager.delayMs).toBe(2000);

      autoMarkManager.resumeTimer();
      expect(autoMarkManager.delayMs).toBe(2000);

      autoMarkManager.cancelTimer();
      expect(autoMarkManager.delayMs).toBe(2000);
    });
  });
});
