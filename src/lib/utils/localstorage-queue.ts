/**
 * LocalStorage Queue Manager for RR-197
 * Provides FIFO queue management with 1000 entry limit and graceful degradation
 */

export interface QueueEntry {
  articleId: string;
  timestamp: number;
  action: "mark_read" | "mark_unread" | "toggle_star";
  feedId: string;
}

export interface QueueConfig {
  maxEntries: number;
  storageKey: string;
  enableGracefulDegradation: boolean;
}

export class LocalStorageQueue {
  private static instance: LocalStorageQueue | null = null;
  private config: QueueConfig;
  private isAvailable: boolean = true;
  // Store raw entries exactly as provided by callers (either legacy {type,...} or current {action,...})
  private memoryQueue: Array<
    | QueueEntry
    | { type: string; articleId: string; timestamp: number; feedId?: string }
  > = [];

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxEntries: 1000,
      storageKey: "rss-reader-queue",
      enableGracefulDegradation: true,
      ...config,
    };

    // Test localStorage availability
    this.isAvailable = this.checkLocalStorageAvailability();

    // Initialize in-memory queue from localStorage (graceful if unavailable)
    this.refreshFromStorage();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<QueueConfig>): LocalStorageQueue {
    if (!LocalStorageQueue.instance) {
      LocalStorageQueue.instance = new LocalStorageQueue(config);
    }
    return LocalStorageQueue.instance;
  }

  /**
   * Test if localStorage is available and functional
   */
  private checkLocalStorageAvailability(): boolean {
    try {
      const testKey = "__localStorage_test__";
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current queue entries
   */
  getQueue(): QueueEntry[] {
    // Always return a normalized copy for internal consumers
    return this.memoryQueue.map((e: any) =>
      "action" in e
        ? (e as QueueEntry)
        : ({
            articleId: e.articleId,
            timestamp: e.timestamp,
            action:
              (e.type as "mark_read" | "mark_unread" | "toggle_star") ??
              "mark_read",
            feedId: e.feedId ?? "",
          } as QueueEntry)
    );
  }

  /**
   * Add entry to queue with FIFO management (original internal method)
   */
  private enqueueInternal(
    entry:
      | QueueEntry
      | { type: string; articleId: string; timestamp: number; feedId?: string }
  ): boolean {
    // Validate entry has required fields
    const articleId = (entry as any).articleId;
    if (!articleId || typeof articleId !== "string") {
      console.warn(
        "[LocalStorageQueue] Invalid entry - missing articleId:",
        entry
      );
      return false;
    }

    // Always update in-memory queue for instant UI updates
    // Remove duplicate entries for same article (latest wins) - this prevents counter over-decrementing
    this.memoryQueue = this.memoryQueue.filter(
      (item: any) => item.articleId !== articleId
    );

    // Add new entry at end (FIFO order)
    this.memoryQueue.push(entry);

    // Apply FIFO cleanup if needed
    this.memoryQueue = this.applyFIFOCleanup(this.memoryQueue);

    // Best-effort persistence to localStorage (graceful on failure)
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(this.memoryQueue)
      );
    } catch (error) {
      if (this.config.enableGracefulDegradation) {
        console.warn("[LocalStorageQueue] Failed to persist enqueue:", error);
      } else {
        throw error;
      }
    }

    return true;
  }

  /**
   * Remove specific entry from queue by articleId
   */
  removeByArticleId(articleId: string): any | null {
    const idx = this.memoryQueue.findIndex(
      (i: any) => i.articleId === articleId
    );
    if (idx === -1) return null;

    const [removed] = this.memoryQueue.splice(idx, 1);

    // Persist best-effort
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(this.memoryQueue)
      );
    } catch {
      // ignore
    }

    return removed ?? null;
  }

  /**
   * Apply FIFO cleanup to maintain max entries limit
   * O(1) slice since we append new entries at the end
   */
  private applyFIFOCleanup<T extends any[]>(queue: any[]): any[] {
    if (queue.length <= this.config.maxEntries) {
      return queue;
    }
    // Keep newest entries while preserving insertion order
    return queue.slice(-this.config.maxEntries);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    count: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
    isAvailable: boolean;
  } {
    const queue = this.getQueue();

    if (queue.length === 0) {
      return {
        count: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        isAvailable: this.isAvailable,
      };
    }

    const timestamps = queue.map((entry) => entry.timestamp);

    return {
      count: queue.length,
      oldestTimestamp: Math.min(...timestamps),
      newestTimestamp: Math.max(...timestamps),
      isAvailable: this.isAvailable,
    };
  }

  /**
   * Clear entire queue
   */
  clearQueue(): void {
    this.memoryQueue = [];
    try {
      localStorage.removeItem(this.config.storageKey);
    } catch {
      // Fail silently
    }
  }

  /**
   * Get entries by feed
   */
  getEntriesByFeed(feedId: string): QueueEntry[] {
    return this.getQueue().filter((entry) => entry.feedId === feedId);
  }

  /**
   * Batch dequeue multiple entries
   */
  batchDequeue(articleIds: string[]): any[] {
    const removed: any[] = [];
    const remaining: any[] = [];

    this.memoryQueue.forEach((entry: any) => {
      if (articleIds.includes(entry.articleId)) {
        removed.push(entry);
      } else {
        remaining.push(entry);
      }
    });

    this.memoryQueue = remaining;

    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(this.memoryQueue)
      );
    } catch {
      // ignore
    }

    return removed;
  }

  /**
   * Check if localStorage is currently available
   */
  isLocalStorageAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Re-test localStorage availability (for recovery scenarios)
   */
  recheckAvailability(): boolean {
    this.isAvailable = this.checkLocalStorageAvailability();
    return this.isAvailable;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.getQueue().length === 0;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.getQueue().length;
  }

  /**
   * Get all queue entries
   */
  getAll(): QueueEntry[] {
    return this.getQueue();
  }

  /**
   * Add operation to queue (internal method)
   */
  addOperation(operation: QueueEntry): boolean {
    return this.enqueueInternal(operation);
  }

  /**
   * Remove operation from queue (alias for removeByArticleId)
   */
  removeOperation(articleId: string): QueueEntry | null {
    return this.removeByArticleId(articleId);
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    LocalStorageQueue.instance = null;
  }

  /**
   * Reset queue state (for testing)
   */
  resetQueue(): void {
    this.memoryQueue = [];
    try {
      localStorage.removeItem(this.config.storageKey);
    } catch {
      // ignore
    }
  }

  /**
   * Dequeue - remove first item or specific item by articleId
   */
  dequeue(articleId?: string): any | null {
    if (articleId) {
      return this.removeByArticleId(articleId);
    }

    if (this.memoryQueue.length === 0) return null;

    const firstItem = this.memoryQueue.shift() ?? null;

    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(this.memoryQueue)
      );
    } catch {
      // graceful degradation - continue without localStorage
    }

    return firstItem;
  }

  /**
   * Refresh memoryQueue from current localStorage (used on construction or when tests reset storage)
   */
  private refreshFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) {
        this.memoryQueue = [];
        return;
      }
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Accept legacy {type,...} or current {action,...}
        this.memoryQueue = parsed
          .map((e: any) => {
            if (e && typeof e === "object") {
              if ("type" in e || "action" in e) return e;
            }
            return null;
          })
          .filter(Boolean) as any[];
      } else {
        this.memoryQueue = [];
      }
    } catch {
      this.memoryQueue = [];
    }
  }

  /**
   * Enqueue with test-compatible interface
   */
  enqueue(
    entry: QueueEntry | { type: string; articleId: string; timestamp: number }
  ): boolean {
    // Convert test format to internal format if needed
    const normalizedEntry: QueueEntry =
      "action" in entry
        ? entry
        : {
            articleId: entry.articleId,
            timestamp: entry.timestamp,
            action: entry.type as "mark_read" | "mark_unread" | "toggle_star",
            feedId: "", // Will be filled by caller
          };

    return this.enqueueInternal(normalizedEntry);
  }

  /**
   * Check if queue has capacity
   */
  hasCapacity(): boolean {
    return this.memoryQueue.length < this.config.maxEntries;
  }

  /**
   * Peek at first item without removing it
   */
  peek(): any | null {
    if (this.memoryQueue.length === 0) return null;
    return this.memoryQueue[0] ?? null;
  }

  /**
   * Clear all entries from queue
   */
  clear(): void {
    this.clearQueue();
  }
}

// Export singleton instance
export const localStorageQueue = new LocalStorageQueue();
