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
      // Use article counter manager for immediate update
      const responseTime = articleCounterManager.markArticleRead(
        articleId,
        feedId
      );

      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.endOperation();
      }

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
      const responseTime =
        articleCounterManager.batchMarkArticlesRead(articles);

      if (this.config.enablePerformanceMonitoring) {
        performanceMonitor.endOperation();
      }

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

// Export singleton instance
export const localStorageStateManager = new LocalStorageStateManager();
