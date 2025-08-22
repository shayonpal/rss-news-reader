import { toast } from "sonner";
import type { SyncResult } from "@/types/sync";

interface RefreshState {
  isRefreshing: boolean;
  syncInProgress: boolean;
  lastRefreshTime: Date | null;
  errors: Array<{ component: string; error: Error; timestamp: Date }>;
}

interface SyncMetrics {
  newArticles: number;
  deletedArticles: number;
  newTags: number;
  failedFeeds: number;
}

interface SidebarData {
  feedCounts: Array<[string, number]>;
  tags: Array<{ id: string; name: string; count: number }>;
}

class RefreshManager {
  private static instance: RefreshManager | null = null;
  private state: RefreshState = {
    isRefreshing: false,
    syncInProgress: false,
    lastRefreshTime: null,
    errors: [],
  };
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500;
  private readonly RATE_LIMIT_KEY = "syncCooldownUntil";

  private constructor() {}

  static getInstance(): RefreshManager {
    if (!RefreshManager.instance) {
      RefreshManager.instance = new RefreshManager();
    }
    return RefreshManager.instance;
  }

  // Reset instance for testing
  static resetInstance(): void {
    RefreshManager.instance = null;
  }

  // Check if rate limited
  private isRateLimited(): boolean {
    if (typeof window === "undefined") return false;

    const cooldownUntil = localStorage.getItem(this.RATE_LIMIT_KEY);
    if (!cooldownUntil) return false;

    const endTime = parseInt(cooldownUntil, 10);
    if (isNaN(endTime)) return false;

    return Date.now() < endTime;
  }

  // Handle rate limit error
  private handleRateLimitError(retryAfterSeconds?: number): void {
    if (typeof window === "undefined") return;

    // Default to 5 minutes if not specified
    const cooldownSeconds = retryAfterSeconds || 300;
    const cooldownUntil = Date.now() + cooldownSeconds * 1000;
    localStorage.setItem(this.RATE_LIMIT_KEY, cooldownUntil.toString());
  }

  // Get remaining cooldown time in seconds
  getRemainingCooldown(): number {
    if (typeof window === "undefined") return 0;

    const cooldownUntil = localStorage.getItem(this.RATE_LIMIT_KEY);
    if (!cooldownUntil) return 0;

    const endTime = parseInt(cooldownUntil, 10);
    if (isNaN(endTime)) return 0;

    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    return remaining;
  }

  // Format countdown for display
  formatCountdown(seconds: number): string {
    if (seconds <= 0) return "Sync";

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
      return `Retry in ${minutes}:${secs.toString().padStart(2, "0")}`;
    }
    return `Retry in ${seconds}s`;
  }

  // Clear rate limit cooldown
  clearCooldown(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(this.RATE_LIMIT_KEY);
  }

  // Format toast message based on metrics
  private formatToastMessage(metrics: SyncMetrics): string {
    const parts: string[] = [];

    if (metrics.newArticles > 0) {
      parts.push(`${metrics.newArticles} new articles`);
    }

    if (metrics.deletedArticles > 0) {
      parts.push(`${metrics.deletedArticles} removed`);
    }

    if (metrics.newTags > 0) {
      parts.push(`${metrics.newTags} new topics`);
    }

    if (parts.length === 0) {
      return "Already up to date";
    }

    return `Sync complete • ${parts.join(" • ")}`;
  }

  // Show appropriate toast based on sync result
  private async showSyncToast(
    status: string,
    metrics: SyncMetrics
  ): Promise<void> {
    if (status === "failed") {
      toast.error("Sync failed • Check your connection", {
        duration: 6000,
        style: { background: "#fee2e2" },
      });
      return;
    }

    if (status === "partial" || metrics.failedFeeds > 0) {
      const failedCount = metrics.failedFeeds || 0;
      // Get actual feed count from store
      const feedStore = await this.getFeedStore();
      const totalFeeds = feedStore.feeds.size || 0;

      toast.warning(
        `Partial sync • ${totalFeeds - failedCount} of ${totalFeeds} feeds updated`,
        {
          duration: 4000, // Fixed: 4s for partial sync
          style: { background: "#fef3c7" },
        }
      );
      return;
    }

    const message = this.formatToastMessage(metrics);

    if (message === "Already up to date") {
      toast.info(message, {
        duration: 3000, // 3s for already up to date
        style: { background: "#f3f4f6" },
      });
    } else {
      toast.success(message, {
        duration: 3500, // 3-4s for success
        style: { background: "#dcfce7" },
      });
    }
  }

  // Apply sidebar data from API response
  private async applySidebarData(
    sidebarData: SidebarData | undefined
  ): Promise<void> {
    if (!sidebarData) return;

    // Apply feed counts
    if (sidebarData.feedCounts) {
      const feedStore = await this.getFeedStore();
      if (feedStore) {
        feedStore.applySidebarCounts(sidebarData.feedCounts);
      }
    }

    // Apply tags
    if (sidebarData.tags) {
      const tagStore = await this.getTagStore();
      if (tagStore) {
        tagStore.applySidebarTags(sidebarData.tags);
      }
    }

    // Refresh article list to show new articles after sync
    const articleStore = await this.getArticleStore();
    if (articleStore) {
      await articleStore.refreshArticles();
    }
  }

  // Get store instances
  private async getFeedStore() {
    const { useFeedStore } = await import("./stores/feed-store");
    return useFeedStore.getState();
  }

  private async getArticleStore() {
    const { useArticleStore } = await import("./stores/article-store");
    return useArticleStore.getState();
  }

  private async getTagStore() {
    const { useTagStore } = await import("./stores/tag-store");
    return useTagStore.getState();
  }

  private async getSyncStore() {
    const { useSyncStore } = await import("./stores/sync-store");
    return useSyncStore.getState();
  }

  // Show skeleton loading state
  private async showSkeleton(): Promise<void> {
    // This will be implemented to show skeleton in UI
    const feedStore = await this.getFeedStore();
    if (feedStore) {
      feedStore.setSkeletonLoading?.(true);
    }
  }

  // Hide skeleton loading state
  private async hideSkeleton(): Promise<void> {
    // This will be implemented to hide skeleton in UI
    const feedStore = await this.getFeedStore();
    if (feedStore) {
      feedStore.setSkeletonLoading?.(false);
    }
  }

  // Refresh all stores
  async refreshAllStores(): Promise<void> {
    if (this.state.isRefreshing) {
      throw new Error("Already refreshing");
    }

    this.state.isRefreshing = true;
    this.state.errors = [];

    try {
      const [feedStore, articleStore, tagStore] = await Promise.all([
        this.getFeedStore(),
        this.getArticleStore(),
        this.getTagStore(),
      ]);

      // Refresh all stores in parallel
      const results = await Promise.allSettled([
        feedStore.loadFeedHierarchy(),
        articleStore.refreshArticles(),
        tagStore.loadTags(),
      ]);

      // Collect any errors
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          const component = ["feeds", "articles", "tags"][index];
          this.state.errors.push({
            component,
            error: result.reason,
            timestamp: new Date(),
          });
        }
      });

      this.state.lastRefreshTime = new Date();
    } finally {
      this.state.isRefreshing = false;
    }
  }

  // Handle manual sync
  async afterManualSync(syncResult?: any): Promise<any> {
    // Early return if already syncing
    if (this.state.syncInProgress) {
      toast.info("Sync already in progress...", { duration: 2000 });
      return null;
    }

    // Check rate limiting
    if (this.isRateLimited()) {
      const remaining = this.getRemainingCooldown();
      toast.error(this.formatCountdown(remaining), { duration: 2000 });
      return null;
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Debounce rapid clicks
    return new Promise((resolve, reject) => {
      this.debounceTimer = setTimeout(async () => {
        // Double-check sync in progress (for concurrency)
        if (this.state.syncInProgress) {
          toast.info("Sync already in progress...", { duration: 2000 });
          resolve(null);
          return;
        }

        // Set flag immediately to prevent concurrent syncs
        this.state.syncInProgress = true;

        try {
          await this.showSkeleton();

          // Perform sync if not already done
          let result = syncResult;
          if (!result) {
            const syncStore = await this.getSyncStore();
            // Call performFullSync which now returns the status with metrics and sidebar
            result = await syncStore.performFullSync();
          }

          // Handle rate limit response
          if (result?.status === 429) {
            const retryAfter = result.retryAfter;
            this.handleRateLimitError(retryAfter);
            toast.error(this.formatCountdown(this.getRemainingCooldown()), {
              duration: 6000,
            });
            resolve(result);
            return;
          }

          // Apply sidebar data if provided (immediate UI update)
          if (result?.sidebar) {
            await this.applySidebarData(result.sidebar);
          } else {
            // Fallback: refresh stores if no sidebar data
            await this.refreshAllStores();
          }

          // Show appropriate toast
          if (result?.metrics) {
            await this.showSyncToast(
              result.status || "completed",
              result.metrics
            );
          }

          resolve(result);
        } catch (error) {
          console.error("Sync error:", error);
          toast.error("Sync failed • Check your connection", {
            duration: 6000,
            style: { background: "#fee2e2" },
          });
          // Still resolve with null instead of rejecting to prevent unhandled promise rejection
          resolve(null);
        } finally {
          // Always clean up state
          await this.hideSkeleton();
          this.state.syncInProgress = false;
          this.debounceTimer = null;
        }
      }, this.DEBOUNCE_MS);
    });
  }

  // Handle background sync completion
  async handleBackgroundSyncComplete(result: any): Promise<any> {
    // Background sync - refresh stores but don't show skeleton
    await this.refreshAllStores();

    if (result?.metrics?.newArticles > 0) {
      // Show info toast with refresh button
      toast.info("New articles available", {
        duration: 8000,
        action: {
          label: "Refresh",
          onClick: () => {
            this.refreshAllStores();
          },
        },
      });
    }

    return result;
  }

  // Get current state for testing
  getState(): RefreshState {
    return { ...this.state };
  }

  // Check if currently refreshing
  get isRefreshing(): boolean {
    return this.state.isRefreshing;
  }

  // Check if sync is in progress
  get syncInProgress(): boolean {
    return this.state.syncInProgress;
  }
}

export const refreshManager = RefreshManager.getInstance();
export { RefreshManager };
