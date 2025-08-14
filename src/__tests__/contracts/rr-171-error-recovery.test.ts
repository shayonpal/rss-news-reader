import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test Specification for RR-171: Error Recovery and Skeleton States
 *
 * CRITICAL REQUIREMENTS:
 * 1. Skeleton ALWAYS hides after sync attempt (success or failure)
 * 2. Stores remain unchanged on sync failure
 * 3. Proper error messages shown to user
 * 4. syncInProgress flag always cleared
 * 5. UI remains interactive after errors
 *
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface UIState {
  showingSkeleton: boolean;
  syncButtonDisabled: boolean;
  errorMessage: string | null;
}

interface SyncErrorHandler {
  handleSyncError(error: Error): void;
  clearError(): void;
  getErrorMessage(error: Error): string;
  recoverFromError(): void;
}

interface SkeletonManager {
  isShowing: boolean;
  showSkeleton(): void;
  hideSkeleton(): void;
  ensureHidden(): void;
}

interface StoreState {
  feeds: Map<string, any>;
  articles: Map<string, any>;
  tags: Map<string, any>;
  lastUpdate: Date | null;
}

interface SyncOrchestrator {
  uiState: UIState;
  skeletonManager: SkeletonManager;
  errorHandler: SyncErrorHandler;
  storeState: StoreState;

  performSync(): Promise<void>;
  getStoreSnapshot(): StoreState;
  restoreStoreSnapshot(snapshot: StoreState): void;
}

describe("RR-171: Error Recovery Contract", () => {
  let orchestrator: SyncOrchestrator;
  let mockToast: any;
  let mockSyncAPI: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockToast = {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
    };

    mockSyncAPI = vi.fn();

    // Create skeleton manager
    const skeletonManager: SkeletonManager = {
      isShowing: false,

      showSkeleton: function () {
        this.isShowing = true;
      },

      hideSkeleton: function () {
        this.isShowing = false;
      },

      ensureHidden: function () {
        if (this.isShowing) {
          this.hideSkeleton();
        }
      },
    };

    // Create error handler
    const errorHandler: SyncErrorHandler = {
      handleSyncError: function (error: Error) {
        const message = this.getErrorMessage(error);
        mockToast.error(message, { duration: 6000 });
        orchestrator.uiState.errorMessage = message;
      },

      clearError: function () {
        orchestrator.uiState.errorMessage = null;
      },

      getErrorMessage: function (error: Error): string {
        if (error.message.includes("Network")) {
          return "Network error. Please check your connection.";
        }
        if (error.message.includes("401")) {
          return "Authentication failed. Please re-authenticate.";
        }
        if (error.message.includes("500")) {
          return "Server error. Please try again later.";
        }
        return `Sync failed: ${error.message}`;
      },

      recoverFromError: function () {
        orchestrator.skeletonManager.ensureHidden();
        orchestrator.uiState.syncButtonDisabled = false;
      },
    };

    // Create orchestrator
    orchestrator = {
      uiState: {
        showingSkeleton: false,
        syncButtonDisabled: false,
        errorMessage: null,
      },

      skeletonManager,
      errorHandler,

      storeState: {
        feeds: new Map([["feed1", { id: "feed1", unread: 5 }]]),
        articles: new Map([["art1", { id: "art1", title: "Article 1" }]]),
        tags: new Map([["tag1", { id: "tag1", name: "Tag 1" }]]),
        lastUpdate: new Date("2024-01-01"),
      },

      performSync: async function () {
        // Take snapshot before sync
        const snapshot = this.getStoreSnapshot();

        try {
          // Show skeleton
          this.skeletonManager.showSkeleton();
          this.uiState.showingSkeleton = true;
          this.uiState.syncButtonDisabled = true;
          this.errorHandler.clearError();

          // Perform sync
          const result = await mockSyncAPI();

          // Update stores on success
          if (result.status === "completed" || result.status === "partial") {
            // Simulate store updates
            this.storeState.lastUpdate = new Date();
            if (result.sidebar) {
              // Apply sidebar data
            }
          }

          return result;
        } catch (error) {
          // Restore stores on failure
          this.restoreStoreSnapshot(snapshot);
          this.errorHandler.handleSyncError(error as Error);
          throw error;
        } finally {
          // ALWAYS hide skeleton
          this.skeletonManager.hideSkeleton();
          this.uiState.showingSkeleton = false;
          this.uiState.syncButtonDisabled = false;
        }
      },

      getStoreSnapshot: function (): StoreState {
        return {
          feeds: new Map(this.storeState.feeds),
          articles: new Map(this.storeState.articles),
          tags: new Map(this.storeState.tags),
          lastUpdate: this.storeState.lastUpdate,
        };
      },

      restoreStoreSnapshot: function (snapshot: StoreState) {
        this.storeState.feeds = new Map(snapshot.feeds);
        this.storeState.articles = new Map(snapshot.articles);
        this.storeState.tags = new Map(snapshot.tags);
        this.storeState.lastUpdate = snapshot.lastUpdate;
      },
    };
  });

  describe("Skeleton State Management", () => {
    it("should ALWAYS hide skeleton after successful sync", async () => {
      mockSyncAPI.mockResolvedValue({
        status: "completed",
        metrics: {
          newArticles: 5,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      });

      expect(orchestrator.skeletonManager.isShowing).toBe(false);

      await orchestrator.performSync();

      expect(orchestrator.skeletonManager.isShowing).toBe(false);
      expect(orchestrator.uiState.showingSkeleton).toBe(false);
    });

    it("should ALWAYS hide skeleton after failed sync", async () => {
      mockSyncAPI.mockRejectedValue(new Error("Network error"));

      expect(orchestrator.skeletonManager.isShowing).toBe(false);

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected error
      }

      // Skeleton must be hidden even after error
      expect(orchestrator.skeletonManager.isShowing).toBe(false);
      expect(orchestrator.uiState.showingSkeleton).toBe(false);
    });

    it("should show skeleton during sync operation", async () => {
      let skeletonStateDuringSync = false;

      mockSyncAPI.mockImplementation(async () => {
        // Capture skeleton state during async operation
        skeletonStateDuringSync = orchestrator.skeletonManager.isShowing;
        return {
          status: "completed",
          metrics: {
            newArticles: 3,
            deletedArticles: 0,
            newTags: 0,
            failedFeeds: 0,
          },
        };
      });

      await orchestrator.performSync();

      expect(skeletonStateDuringSync).toBe(true);
      expect(orchestrator.skeletonManager.isShowing).toBe(false); // Hidden after
    });

    it("should handle multiple error types with skeleton properly hidden", async () => {
      const errors = [
        new Error("Network error"),
        new Error("401 Unauthorized"),
        new Error("500 Internal Server Error"),
        new Error("Unknown error"),
      ];

      for (const error of errors) {
        mockSyncAPI.mockRejectedValueOnce(error);

        try {
          await orchestrator.performSync();
        } catch (e) {
          // Expected
        }

        expect(orchestrator.skeletonManager.isShowing).toBe(false);
        expect(orchestrator.uiState.showingSkeleton).toBe(false);
      }
    });
  });

  describe("Store State Preservation on Error", () => {
    it("should NOT modify stores when sync fails", async () => {
      const originalFeeds = new Map(orchestrator.storeState.feeds);
      const originalArticles = new Map(orchestrator.storeState.articles);
      const originalTags = new Map(orchestrator.storeState.tags);
      const originalUpdate = orchestrator.storeState.lastUpdate;

      mockSyncAPI.mockRejectedValue(new Error("Sync failed"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      // Stores should be unchanged
      expect(orchestrator.storeState.feeds).toEqual(originalFeeds);
      expect(orchestrator.storeState.articles).toEqual(originalArticles);
      expect(orchestrator.storeState.tags).toEqual(originalTags);
      expect(orchestrator.storeState.lastUpdate).toEqual(originalUpdate);
    });

    it("should update stores only on successful sync", async () => {
      const originalUpdate = orchestrator.storeState.lastUpdate;

      mockSyncAPI.mockResolvedValue({
        status: "completed",
        metrics: {
          newArticles: 10,
          deletedArticles: 2,
          newTags: 1,
          failedFeeds: 0,
        },
      });

      await orchestrator.performSync();

      // lastUpdate should be changed
      expect(orchestrator.storeState.lastUpdate).not.toEqual(originalUpdate);
      expect(orchestrator.storeState.lastUpdate).toBeInstanceOf(Date);
    });

    it("should handle partial sync with partial store updates", async () => {
      mockSyncAPI.mockResolvedValue({
        status: "partial",
        metrics: {
          newArticles: 5,
          deletedArticles: 1,
          newTags: 0,
          failedFeeds: 2,
        },
      });

      const originalUpdate = orchestrator.storeState.lastUpdate;

      await orchestrator.performSync();

      // Should still update stores for partial success
      expect(orchestrator.storeState.lastUpdate).not.toEqual(originalUpdate);
    });

    it("should restore exact store state after error", async () => {
      // Modify stores to specific state
      orchestrator.storeState.feeds.set("feed2", { id: "feed2", unread: 10 });
      orchestrator.storeState.articles.set("art2", {
        id: "art2",
        title: "Article 2",
      });
      orchestrator.storeState.tags.set("tag2", { id: "tag2", name: "Tag 2" });

      const snapshot = orchestrator.getStoreSnapshot();

      mockSyncAPI.mockRejectedValue(new Error("Database error"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      // Should be restored to exact snapshot
      expect(orchestrator.storeState.feeds).toEqual(snapshot.feeds);
      expect(orchestrator.storeState.articles).toEqual(snapshot.articles);
      expect(orchestrator.storeState.tags).toEqual(snapshot.tags);
    });
  });

  describe("Error Message Handling", () => {
    it("should show appropriate error message for network errors", async () => {
      mockSyncAPI.mockRejectedValue(new Error("Network request failed"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        "Network error. Please check your connection.",
        { duration: 6000 }
      );
      expect(orchestrator.uiState.errorMessage).toBe(
        "Network error. Please check your connection."
      );
    });

    it("should show appropriate message for authentication errors", async () => {
      mockSyncAPI.mockRejectedValue(new Error("401 Unauthorized"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        "Authentication failed. Please re-authenticate.",
        { duration: 6000 }
      );
    });

    it("should show appropriate message for server errors", async () => {
      mockSyncAPI.mockRejectedValue(new Error("500 Internal Server Error"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        "Server error. Please try again later.",
        { duration: 6000 }
      );
    });

    it("should show generic message for unknown errors", async () => {
      mockSyncAPI.mockRejectedValue(new Error("Something unexpected"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(mockToast.error).toHaveBeenCalledWith(
        "Sync failed: Something unexpected",
        { duration: 6000 }
      );
    });

    it("should clear error message on new sync attempt", async () => {
      // First sync fails
      mockSyncAPI.mockRejectedValueOnce(new Error("First error"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(orchestrator.uiState.errorMessage).toBeTruthy();

      // Second sync succeeds
      mockSyncAPI.mockResolvedValueOnce({
        status: "completed",
        metrics: {
          newArticles: 5,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      });

      await orchestrator.performSync();

      expect(orchestrator.uiState.errorMessage).toBeNull();
    });
  });

  describe("UI State Recovery", () => {
    it("should re-enable sync button after error", async () => {
      mockSyncAPI.mockRejectedValue(new Error("Sync failed"));

      expect(orchestrator.uiState.syncButtonDisabled).toBe(false);

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(orchestrator.uiState.syncButtonDisabled).toBe(false);
    });

    it("should maintain UI interactivity after multiple errors", async () => {
      const errors = ["Error 1", "Error 2", "Error 3"];

      for (const errorMsg of errors) {
        mockSyncAPI.mockRejectedValueOnce(new Error(errorMsg));

        try {
          await orchestrator.performSync();
        } catch (error) {
          // Expected
        }

        // UI should remain interactive
        expect(orchestrator.uiState.syncButtonDisabled).toBe(false);
        expect(orchestrator.skeletonManager.isShowing).toBe(false);
      }
    });

    it("should properly transition UI states during sync lifecycle", async () => {
      const states: UIState[] = [];

      // Record initial state
      states.push({ ...orchestrator.uiState });

      // Mock sync with state recording
      mockSyncAPI.mockImplementation(async () => {
        // Record state during sync
        states.push({ ...orchestrator.uiState });
        throw new Error("Sync error");
      });

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      // Record final state
      states.push({ ...orchestrator.uiState });

      expect(states).toEqual([
        // Initial
        {
          showingSkeleton: false,
          syncButtonDisabled: false,
          errorMessage: null,
        },
        // During sync
        { showingSkeleton: true, syncButtonDisabled: true, errorMessage: null },
        // After error
        {
          showingSkeleton: false,
          syncButtonDisabled: false,
          errorMessage: expect.stringContaining("Sync failed"),
        },
      ]);
    });
  });

  describe("Error Recovery Actions", () => {
    it("should allow immediate retry after error", async () => {
      // First attempt fails
      mockSyncAPI.mockRejectedValueOnce(new Error("Temporary error"));

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      // Should be able to retry immediately
      expect(orchestrator.uiState.syncButtonDisabled).toBe(false);

      // Second attempt succeeds
      mockSyncAPI.mockResolvedValueOnce({
        status: "completed",
        metrics: {
          newArticles: 3,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 0,
        },
      });

      await expect(orchestrator.performSync()).resolves.toBeTruthy();
    });

    it("should handle timeout errors gracefully", async () => {
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).code = "ETIMEDOUT";

      mockSyncAPI.mockRejectedValue(timeoutError);

      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }

      expect(orchestrator.skeletonManager.isShowing).toBe(false);
      expect(orchestrator.uiState.syncButtonDisabled).toBe(false);
      expect(orchestrator.storeState.lastUpdate).toEqual(
        new Date("2024-01-01")
      ); // Unchanged
    });

    it("should maintain error recovery consistency", async () => {
      // Simulate rapid error-success-error pattern
      mockSyncAPI
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockResolvedValueOnce({
          status: "completed",
          metrics: {
            newArticles: 5,
            deletedArticles: 0,
            newTags: 0,
            failedFeeds: 0,
          },
        })
        .mockRejectedValueOnce(new Error("Error 2"));

      // First error
      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }
      expect(orchestrator.uiState.errorMessage).toContain("Error 1");

      // Success
      await orchestrator.performSync();
      expect(orchestrator.uiState.errorMessage).toBeNull();

      // Second error
      try {
        await orchestrator.performSync();
      } catch (error) {
        // Expected
      }
      expect(orchestrator.uiState.errorMessage).toContain("Error 2");

      // All attempts should leave UI in consistent state
      expect(orchestrator.skeletonManager.isShowing).toBe(false);
      expect(orchestrator.uiState.syncButtonDisabled).toBe(false);
    });
  });
});
