import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Test Specification for RR-171: Concurrency Control and Debouncing
 *
 * CRITICAL REQUIREMENTS:
 * 1. Only ONE sync operation at a time
 * 2. 500ms debounce on rapid sync button clicks
 * 3. Show "Sync already in progress..." toast for concurrent attempts
 * 4. Singleton RefreshManager prevents duplicate orchestration
 * 5. syncInProgress flag properly managed
 *
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface SyncManager {
  syncInProgress: boolean;
  lastSyncAttempt: number;
  syncDebounceMs: number;

  startSync(): Promise<SyncResult>;
  canStartSync(): boolean;
  handleSyncRequest(): Promise<SyncResult | null>;
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

// Singleton RefreshManager interface
interface RefreshManagerSingleton {
  instance: RefreshManager | null;
  getInstance(): RefreshManager;
  resetInstance(): void;
}

interface RefreshManager {
  isRefreshing: boolean;
  refreshCount: number;
  refreshAll(): Promise<void>;
}

describe("RR-171: Concurrency Control Contract", () => {
  let syncManager: SyncManager;
  let refreshManagerSingleton: RefreshManagerSingleton;
  let mockToast: any;
  let mockSyncAPI: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockToast = {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
    };

    mockSyncAPI = vi.fn().mockResolvedValue({
      syncId: "sync-" + Date.now(),
      status: "completed",
      metrics: {
        newArticles: 5,
        deletedArticles: 2,
        newTags: 1,
        failedFeeds: 0,
      },
    });

    // Implementation should provide this
    syncManager = {
      syncInProgress: false,
      lastSyncAttempt: 0,
      syncDebounceMs: 500,

      canStartSync: function () {
        const now = Date.now();

        // Check if sync is already in progress
        if (this.syncInProgress) {
          return false;
        }

        // Check debounce
        if (now - this.lastSyncAttempt < this.syncDebounceMs) {
          return false;
        }

        return true;
      },

      startSync: async function () {
        if (!this.canStartSync()) {
          throw new Error(
            "Cannot start sync: already in progress or debounced"
          );
        }

        this.syncInProgress = true;
        this.lastSyncAttempt = Date.now();

        try {
          const result = await mockSyncAPI();
          return result;
        } finally {
          this.syncInProgress = false;
        }
      },

      handleSyncRequest: async function () {
        if (!this.canStartSync()) {
          mockToast.info("Sync already in progress...", { duration: 2000 });
          return null;
        }

        return this.startSync();
      },
    };

    // Singleton RefreshManager
    refreshManagerSingleton = {
      instance: null,

      getInstance: function () {
        if (!this.instance) {
          this.instance = {
            isRefreshing: false,
            refreshCount: 0,
            refreshAll: vi.fn(async function () {
              if (this.isRefreshing) {
                throw new Error("Already refreshing");
              }
              this.isRefreshing = true;
              this.refreshCount++;
              await new Promise((resolve) => setTimeout(resolve, 100));
              this.isRefreshing = false;
            }),
          };
        }
        return this.instance;
      },

      resetInstance: function () {
        this.instance = null;
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Singleton RefreshManager", () => {
    it("should return the same instance on multiple calls", () => {
      const instance1 = refreshManagerSingleton.getInstance();
      const instance2 = refreshManagerSingleton.getInstance();
      const instance3 = refreshManagerSingleton.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1.refreshCount).toBe(0);
    });

    it("should prevent duplicate refresh orchestration", async () => {
      const manager = refreshManagerSingleton.getInstance();

      // Start first refresh
      const refresh1 = manager.refreshAll();

      // Try to start second refresh while first is running
      await expect(manager.refreshAll()).rejects.toThrow("Already refreshing");

      // Wait for first to complete
      await refresh1;

      expect(manager.refreshCount).toBe(1);
      expect(manager.isRefreshing).toBe(false);
    });

    it("should allow new refresh after previous completes", async () => {
      const manager = refreshManagerSingleton.getInstance();

      // First refresh
      await manager.refreshAll();
      expect(manager.refreshCount).toBe(1);

      // Second refresh (should work)
      await manager.refreshAll();
      expect(manager.refreshCount).toBe(2);

      expect(manager.isRefreshing).toBe(false);
    });

    it("should maintain state across different component accesses", () => {
      // Simulate different components getting the manager
      const sidebarManager = refreshManagerSingleton.getInstance();
      const buttonManager = refreshManagerSingleton.getInstance();
      const articleManager = refreshManagerSingleton.getInstance();

      // All should be the same instance
      expect(sidebarManager).toBe(buttonManager);
      expect(buttonManager).toBe(articleManager);

      // State changes should be reflected everywhere
      sidebarManager.refreshCount = 5;
      expect(buttonManager.refreshCount).toBe(5);
      expect(articleManager.refreshCount).toBe(5);
    });
  });

  describe("Sync Concurrency Control", () => {
    it("should prevent concurrent sync operations", async () => {
      // Start first sync
      const sync1 = syncManager.startSync();

      // Try to start second sync immediately
      expect(syncManager.canStartSync()).toBe(false);
      await expect(syncManager.startSync()).rejects.toThrow(
        "Cannot start sync"
      );

      // Wait for first sync to complete
      await sync1;

      // Now should be able to sync again
      expect(syncManager.canStartSync()).toBe(true);
    });

    it("should set syncInProgress flag correctly", async () => {
      expect(syncManager.syncInProgress).toBe(false);

      // Start sync
      const syncPromise = syncManager.startSync();

      // Flag should be true during sync
      expect(syncManager.syncInProgress).toBe(true);

      // Wait for completion
      await syncPromise;

      // Flag should be false after sync
      expect(syncManager.syncInProgress).toBe(false);
    });

    it("should always clear syncInProgress flag even on error", async () => {
      // Make sync fail
      mockSyncAPI.mockRejectedValueOnce(new Error("Network error"));

      expect(syncManager.syncInProgress).toBe(false);

      try {
        await syncManager.startSync();
      } catch (error) {
        // Expected error
      }

      // Flag should be cleared even after error
      expect(syncManager.syncInProgress).toBe(false);
    });

    it("should show toast for concurrent sync attempts", async () => {
      // Start first sync
      const sync1 = syncManager.handleSyncRequest();

      // Try concurrent sync
      const sync2 = syncManager.handleSyncRequest();

      expect(mockToast.info).toHaveBeenCalledWith(
        "Sync already in progress...",
        { duration: 2000 }
      );

      await sync1;
      const result2 = await sync2;

      expect(result2).toBeNull(); // Second request returned null
    });
  });

  describe("Debounce Mechanism", () => {
    it("should enforce 500ms debounce between sync attempts", async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // First sync
      await syncManager.startSync();

      // Try immediately after (should be debounced)
      vi.setSystemTime(now + 100); // 100ms later
      expect(syncManager.canStartSync()).toBe(false);

      // Try after 400ms (still debounced)
      vi.setSystemTime(now + 400);
      expect(syncManager.canStartSync()).toBe(false);

      // Try after 500ms (should work)
      vi.setSystemTime(now + 500);
      expect(syncManager.canStartSync()).toBe(true);
    });

    it("should handle rapid button clicks gracefully", async () => {
      const clickTimes = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450];
      const results: (SyncResult | null)[] = [];

      for (const time of clickTimes) {
        vi.setSystemTime(time);
        const result = await syncManager.handleSyncRequest();
        results.push(result);
      }

      // Only first click should trigger sync
      expect(results[0]).toBeTruthy();
      expect(results[0]?.status).toBe("completed");

      // All others should be debounced
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeNull();
      }

      // Toast should be shown for debounced attempts
      expect(mockToast.info).toHaveBeenCalledTimes(clickTimes.length - 1);
    });

    it("should reset debounce timer after successful wait", async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // First sync
      await syncManager.startSync();

      // Wait for debounce period
      vi.setSystemTime(now + 600); // 600ms later

      // Second sync (should work)
      await syncManager.startSync();

      // Immediately try third (should be debounced again)
      vi.setSystemTime(now + 650); // 50ms after second sync
      expect(syncManager.canStartSync()).toBe(false);

      // Wait another 500ms
      vi.setSystemTime(now + 1100);
      expect(syncManager.canStartSync()).toBe(true);
    });
  });

  describe("Combined Concurrency and Debounce", () => {
    it("should check both conditions before allowing sync", async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Start a sync
      const syncPromise = syncManager.startSync();

      // During sync: both checks should prevent new sync
      expect(syncManager.syncInProgress).toBe(true); // Concurrency check
      expect(syncManager.lastSyncAttempt).toBe(now); // Debounce check
      expect(syncManager.canStartSync()).toBe(false);

      // Complete sync
      await syncPromise;

      // Right after sync: concurrency OK but debounce prevents
      vi.setSystemTime(now + 100);
      expect(syncManager.syncInProgress).toBe(false); // Concurrency OK
      expect(syncManager.canStartSync()).toBe(false); // Debounce prevents

      // After debounce period: both checks pass
      vi.setSystemTime(now + 500);
      expect(syncManager.canStartSync()).toBe(true);
    });

    it("should handle multiple users clicking sync button", async () => {
      const userClicks = [
        { userId: "user1", time: 0 },
        { userId: "user2", time: 100 },
        { userId: "user3", time: 200 },
        { userId: "user1", time: 600 }, // After debounce
        { userId: "user2", time: 650 },
      ];

      const results: { userId: string; result: SyncResult | null }[] = [];

      for (const click of userClicks) {
        vi.setSystemTime(click.time);
        const result = await syncManager.handleSyncRequest();
        results.push({ userId: click.userId, result });
      }

      // First click succeeds
      expect(results[0].result).toBeTruthy();

      // Next two are blocked (within debounce)
      expect(results[1].result).toBeNull();
      expect(results[2].result).toBeNull();

      // Fourth succeeds (after debounce)
      expect(results[3].result).toBeTruthy();

      // Fifth is blocked (within new debounce)
      expect(results[4].result).toBeNull();
    });
  });

  describe("Error Scenarios", () => {
    it("should handle sync API errors without breaking concurrency control", async () => {
      mockSyncAPI.mockRejectedValueOnce(new Error("API Error"));

      // Start failing sync
      const syncPromise = syncManager.startSync();

      // Should still prevent concurrent sync
      expect(syncManager.syncInProgress).toBe(true);
      expect(syncManager.canStartSync()).toBe(false);

      // Handle the error
      await expect(syncPromise).rejects.toThrow("API Error");

      // Should clear flag after error
      expect(syncManager.syncInProgress).toBe(false);

      // Should still enforce debounce after error
      expect(syncManager.canStartSync()).toBe(false);

      // After debounce, should allow retry
      vi.advanceTimersByTime(500);
      expect(syncManager.canStartSync()).toBe(true);
    });

    it("should handle timeout scenarios correctly", async () => {
      // Create a long-running sync
      mockSyncAPI.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  syncId: "sync-slow",
                  status: "completed",
                  metrics: {
                    newArticles: 1,
                    deletedArticles: 0,
                    newTags: 0,
                    failedFeeds: 0,
                  },
                }),
              10000
            )
          )
      );

      // Start sync
      const syncPromise = syncManager.startSync();

      // Flag should stay true during long sync
      expect(syncManager.syncInProgress).toBe(true);

      // Advance time partially
      vi.advanceTimersByTime(5000);
      expect(syncManager.syncInProgress).toBe(true);
      expect(syncManager.canStartSync()).toBe(false);

      // Complete the sync
      vi.advanceTimersByTime(5000);
      await syncPromise;

      expect(syncManager.syncInProgress).toBe(false);
    });
  });

  describe("State Consistency", () => {
    it("should maintain consistent state across sync lifecycle", async () => {
      const states: { inProgress: boolean; canStart: boolean }[] = [];

      // Record initial state
      states.push({
        inProgress: syncManager.syncInProgress,
        canStart: syncManager.canStartSync(),
      });

      // Start sync
      const syncPromise = syncManager.startSync();
      states.push({
        inProgress: syncManager.syncInProgress,
        canStart: syncManager.canStartSync(),
      });

      // Complete sync
      await syncPromise;
      states.push({
        inProgress: syncManager.syncInProgress,
        canStart: syncManager.canStartSync(),
      });

      // After debounce
      vi.advanceTimersByTime(500);
      states.push({
        inProgress: syncManager.syncInProgress,
        canStart: syncManager.canStartSync(),
      });

      expect(states).toEqual([
        { inProgress: false, canStart: true }, // Initial
        { inProgress: true, canStart: false }, // During sync
        { inProgress: false, canStart: false }, // After sync (debounced)
        { inProgress: false, canStart: true }, // After debounce
      ]);
    });
  });
});
