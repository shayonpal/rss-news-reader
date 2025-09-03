/**
 * LocalStorage State Manager for RR-197
 * Coordinates localStorage operations and provides unified state management
 */

import { localStorageQueue } from "./localstorage-queue";
import { performanceMonitor } from "./performance-monitor";
import { articleCounterManager } from "./article-counter-manager";

export interface StateManagerConfig {
  enablePerformanceMonitoring: boolean;
  enableGracefulDegradation: boolean;
  batchSyncInterval: number; // milliseconds
}

export interface OperationResult {
  success: boolean;
  responseTime: number;
  fallbackUsed: boolean;
  error?: string;
}

export class LocalStorageStateManager {
  private static instance: LocalStorageStateManager | null = null;
  private config: StateManagerConfig;
  private batchSyncTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  // In-memory article state cache used for test compatibility (RR-197 spec)
  // Stores minimal per-article state for getArticleState()/updateArticleState()
  private articleStateMap: Map<string, any> = new Map();

  // Fallback mode flag for graceful degradation testing
  public static fallbackMode = false;

  constructor(config: Partial<StateManagerConfig> = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      enableGracefulDegradation: true,
      batchSyncInterval: 500, // 500ms to match existing database batching
      ...config,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    config?: Partial<StateManagerConfig>
  ): LocalStorageStateManager {
    if (!LocalStorageStateManager.instance) {
      LocalStorageStateManager.instance = new LocalStorageStateManager(config);
    }
    return LocalStorageStateManager.instance;
  }

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.config.enablePerformanceMonitoring) {
      performanceMonitor.startMonitoring();
    }

    // Start batch sync timer
    this.startBatchSyncTimer();

    this.isInitialized = true;
  }

  /**
   * Cleanup and stop monitoring
   */
  cleanup(): void {
    if (this.batchSyncTimer) {
      clearTimeout(this.batchSyncTimer);
      this.batchSyncTimer = null;
    }

    if (this.config.enablePerformanceMonitoring) {
      performanceMonitor.stopMonitoring();
    }

    this.isInitialized = false;
  }

  /**
   * Mark article as read with immediate UI feedback
   */
  async markArticleRead(
    articleId: string,
    feedId: string
  ): Promise<OperationResult> {
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitor.startOperation();
    }

    try {
      // Add to localStorage queue for instant UI update
      localStorageQueue.enqueue({
        articleId,
        feedId,
        action: "mark_read",
        timestamp: Date.now(),
      });

      // Trigger counter updates from localStorage queue
      articleCounterManager.updateCountersFromLocalStorage();

      const responseTime = this.config.enablePerformanceMonitoring
        ? performanceMonitor.endOperation()
        : 0;

      // Maintain a minimal in-memory state map for test compatibility
      const prev = this.articleStateMap.get(articleId) || {};
      this.articleStateMap.set(articleId, { ...prev, isRead: true, feedId });

      return {
        success: true,
        responseTime,
        fallbackUsed: !localStorageQueue.isLocalStorageAvailable(),
      };
    } catch (error) {
      const responseTime = this.config.enablePerformanceMonitoring
        ? performanceMonitor.endOperation()
        : 0;

      if (this.config.enableGracefulDegradation) {
        return {
          success: false,
          responseTime,
          fallbackUsed: true,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }

      throw error;
    }
  }

  /**
   * Batch mark multiple articles as read
   */
  async batchMarkArticlesRead(
    articles: { articleId: string; feedId: string }[]
  ): Promise<OperationResult> {
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitor.startOperation();
    }

    try {
      // Add entries to localStorage queue for instant UI updates
      const timestamp = Date.now();
      const actualResponseTime = this.config.enablePerformanceMonitoring
        ? performanceMonitor.startMeasure("batch_mark_read")
        : 0;

      articles.forEach(({ articleId, feedId }) => {
        localStorageQueue.enqueue({
          articleId,
          feedId,
          action: "mark_read",
          timestamp,
        });
      });

      // Performance measurement
      const responseTime = this.config.enablePerformanceMonitoring
        ? performanceMonitor.endMeasure("batch_mark_read")
        : 0;

      // Maintain in-memory state map for test compatibility
      articles.forEach(({ articleId, feedId }) => {
        const prev = this.articleStateMap.get(articleId) || {};
        this.articleStateMap.set(articleId, { ...prev, isRead: true, feedId });
      });

      return {
        success: true,
        responseTime,
        fallbackUsed: !localStorageQueue.isLocalStorageAvailable(),
      };
    } catch (error) {
      const responseTime = this.config.enablePerformanceMonitoring
        ? performanceMonitor.endOperation()
        : 0;

      if (this.config.enableGracefulDegradation) {
        return {
          success: false,
          responseTime,
          fallbackUsed: true,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }

      throw error;
    }
  }

  /**
   * Get current counter state for feed
   */
  getFeedCounterState(feedId: string) {
    return articleCounterManager.getCounterState(feedId);
  }

  /**
   * Get all feed counter states
   */
  getAllCounterStates() {
    return articleCounterManager.getAllCounterStates();
  }

  /**
   * Get current queue statistics
   */
  getQueueStats() {
    return localStorageQueue.getStats();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    if (!this.config.enablePerformanceMonitoring) {
      return null;
    }

    return {
      performance: performanceMonitor.getMetrics(),
      counters: articleCounterManager.getPerformanceMetrics(),
      queue: localStorageQueue.getStats(),
    };
  }

  /**
   * Check if performance meets requirements
   */
  meetsPerformanceRequirements(): boolean {
    if (!this.config.enablePerformanceMonitoring) {
      return true;
    }

    return performanceMonitor.meetsPerformanceThresholds();
  }

  /**
   * Sync with database and clear localStorage queue
   */
  async syncWithDatabase(): Promise<void> {
    articleCounterManager.syncWithDatabase();

    // Reset performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      performanceMonitor.reset();
    }
  }

  /**
   * Start batch sync timer
   */
  private startBatchSyncTimer(): void {
    if (this.batchSyncTimer) {
      clearTimeout(this.batchSyncTimer);
    }

    this.batchSyncTimer = setTimeout(() => {
      // This will be called every 500ms to coordinate with existing database batching
      // The actual database sync happens in the existing article-store logic
      this.startBatchSyncTimer();
    }, this.config.batchSyncInterval);
  }

  /**
   * Check if localStorage is available
   */
  isLocalStorageAvailable(): boolean {
    return localStorageQueue.isLocalStorageAvailable();
  }

  /**
   * Force recheck of localStorage availability
   */
  recheckLocalStorageAvailability(): boolean {
    return localStorageQueue.recheckAvailability();
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    isInitialized: boolean;
    isLocalStorageAvailable: boolean;
    queueStats: ReturnType<typeof localStorageQueue.getStats>;
    performanceMetrics: ReturnType<typeof this.getPerformanceMetrics>;
    meetsPerformanceRequirements: boolean;
    counterMetrics: ReturnType<
      typeof articleCounterManager.getPerformanceMetrics
    >;
  } {
    return {
      isInitialized: this.isInitialized,
      isLocalStorageAvailable: this.isLocalStorageAvailable(),
      queueStats: localStorageQueue.getStats(),
      performanceMetrics: this.getPerformanceMetrics(),
      meetsPerformanceRequirements: this.meetsPerformanceRequirements(),
      counterMetrics: articleCounterManager.getPerformanceMetrics(),
    };
  }

  /**
   * Emergency fallback - clear all localStorage state
   */
  emergencyReset(): void {
    try {
      localStorageQueue.clearQueue();
      articleCounterManager.invalidateCache();

      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.reset();
      }
    } catch (error) {
      console.error(
        "[LocalStorageStateManager] Emergency reset failed:",
        error
      );
    }
  }
}

// Back-compat facade methods expected by tests/specs
(LocalStorageStateManager as any).prototype.updateArticleState = function (
  articleId: string,
  state: { isRead?: boolean; feedId?: string }
): void {
  try {
    const feedId = state?.feedId || "";
    if (state?.isRead === true && feedId) {
      // Immediate local counter update via localStorage path
      articleCounterManager.markArticleRead(articleId, feedId);
    } else if (state?.isRead === false && feedId) {
      articleCounterManager.markArticleUnread(articleId, feedId);
    }
  } catch (e) {
    console.warn("[LocalStorageStateManager] updateArticleState failed:", e);
  }
};

(LocalStorageStateManager as any).prototype.batchUpdateArticleStates =
  function (
    updates: Array<{ articleId: string; isRead?: boolean; feedId?: string }>
  ): void {
    try {
      const toRead = updates
        .filter((u) => u.isRead === true && !!u.feedId)
        .map((u) => ({ articleId: u.articleId, feedId: u.feedId as string }));

      if (toRead.length > 0) {
        // Use existing immediate local batch for instant UI
        this.batchMarkArticlesRead(toRead);
      }

      // Process unread updates individually (no batch-unread API)
      updates.forEach((u) => {
        if (u.isRead === false && u.feedId) {
          articleCounterManager.markArticleUnread(u.articleId, u.feedId);
        }
      });
    } catch (e) {
      console.warn(
        "[LocalStorageStateManager] batchUpdateArticleStates failed:",
        e
      );
    }
  };

(LocalStorageStateManager as any).prototype.getUnreadCount =
  function (): number {
    try {
      return articleCounterManager.getTotalUnreadCount();
    } catch {
      return 0;
    }
  };

(LocalStorageStateManager as any).prototype.getFeedUnreadCount = function (
  feedId: string
): number {
  try {
    const s = articleCounterManager.getCounterState(feedId);
    return s ? s.unreadCount : 0;
  } catch {
    return 0;
  }
};

// Back-compat facade methods expected by tests/specs
(LocalStorageStateManager as any).prototype.updateArticleState = function (
  articleId: string,
  state: { isRead?: boolean; feedId?: string; tags?: string[] }
): void {
  try {
    const feedId = state?.feedId || "";
    const prev = this.articleStateMap.get(articleId) || {};
    const next = { ...prev, ...state };
    this.articleStateMap.set(articleId, next);

    if (!LocalStorageStateManager.fallbackMode) {
      if (state?.isRead === true && feedId) {
        articleCounterManager.markArticleRead(articleId, feedId);
      } else if (state?.isRead === false && feedId) {
        articleCounterManager.markArticleUnread(articleId, feedId);
      }
    }
  } catch (e) {
    console.warn("[LocalStorageStateManager] updateArticleState failed:", e);
  }
};

(LocalStorageStateManager as any).prototype.getArticleState = function (
  articleId: string
): any | null {
  return this.articleStateMap.get(articleId) || null;
};

(LocalStorageStateManager as any).prototype.batchUpdateArticleStates =
  function (
    updates: Array<{
      articleId: string;
      isRead?: boolean;
      feedId?: string;
      tags?: string[];
    }>
  ): void {
    try {
      // Update in-memory first
      updates.forEach((u) => {
        const prev = this.articleStateMap.get(u.articleId) || {};
        this.articleStateMap.set(u.articleId, { ...prev, ...u });
      });

      if (LocalStorageStateManager.fallbackMode) return;

      const toRead = updates
        .filter((u) => u.isRead === true && !!u.feedId)
        .map((u) => ({ articleId: u.articleId, feedId: u.feedId as string }));

      if (toRead.length > 0) {
        this.batchMarkArticlesRead(toRead);
      }

      // Process unread updates individually (no batch-unread API)
      updates.forEach((u) => {
        if (u.isRead === false && u.feedId) {
          articleCounterManager.markArticleUnread(u.articleId, u.feedId);
        }
      });
    } catch (e) {
      console.warn(
        "[LocalStorageStateManager] batchUpdateArticleStates failed:",
        e
      );
    }
  };

(LocalStorageStateManager as any).prototype.getUnreadCount =
  function (): number {
    try {
      return articleCounterManager.getTotalUnreadCount();
    } catch {
      return 0;
    }
  };

(LocalStorageStateManager as any).prototype.getFeedUnreadCount = function (
  feedId: string
): number {
  try {
    const s = articleCounterManager.getCounterState(feedId);
    return s ? s.unreadCount : 0;
  } catch {
    return 0;
  }
};

// Fallback mode toggles for tests
(LocalStorageStateManager as any).enableFallbackMode = function () {
  LocalStorageStateManager.fallbackMode = true;
};
(LocalStorageStateManager as any).isInFallbackMode = function () {
  return LocalStorageStateManager.fallbackMode === true;
};
(LocalStorageStateManager as any).disableFallbackMode = function () {
  LocalStorageStateManager.fallbackMode = false;
};

// Export singleton instance
export const localStorageStateManager = new LocalStorageStateManager();
