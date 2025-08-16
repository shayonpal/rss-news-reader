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

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxEntries: 1000,
      storageKey: "rss_reader_mark_queue",
      enableGracefulDegradation: true,
      ...config,
    };

    // Test localStorage availability
    this.isAvailable = this.checkLocalStorageAvailability();
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
    if (!this.isAvailable) return [];

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Clear corrupted data
      this.clearQueue();
      return [];
    }
  }

  /**
   * Add entry to queue with FIFO management (original internal method)
   */
  private enqueueInternal(entry: QueueEntry): boolean {
    if (!this.isAvailable) {
      if (this.config.enableGracefulDegradation) {
        console.warn(
          "[LocalStorageQueue] localStorage unavailable, operation ignored"
        );
        return false;
      }
      throw new Error("localStorage is not available");
    }

    try {
      const queue = this.getQueue();

      // Remove duplicate entries for same article
      const filteredQueue = queue.filter(
        (item) => item.articleId !== entry.articleId
      );

      // Add new entry
      filteredQueue.push(entry);

      // Apply FIFO cleanup if needed
      const finalQueue = this.applyFIFOCleanup(filteredQueue);

      localStorage.setItem(this.config.storageKey, JSON.stringify(finalQueue));
      return true;
    } catch (error) {
      if (this.config.enableGracefulDegradation) {
        console.warn("[LocalStorageQueue] Failed to enqueue:", error);
        return false;
      }
      throw error;
    }
  }

  /**
   * Remove specific entry from queue by articleId
   */
  removeByArticleId(articleId: string): QueueEntry | null {
    if (!this.isAvailable) return null;

    try {
      const queue = this.getQueue();
      const entryIndex = queue.findIndex(
        (item) => item.articleId === articleId
      );

      if (entryIndex === -1) return null;

      const [removedEntry] = queue.splice(entryIndex, 1);
      localStorage.setItem(this.config.storageKey, JSON.stringify(queue));

      return removedEntry;
    } catch {
      return null;
    }
  }

  /**
   * Apply FIFO cleanup to maintain max entries limit
   */
  private applyFIFOCleanup(queue: QueueEntry[]): QueueEntry[] {
    if (queue.length <= this.config.maxEntries) {
      return queue;
    }

    // Sort by timestamp and keep newest entries
    const sorted = queue.sort((a, b) => a.timestamp - b.timestamp);
    return sorted.slice(-this.config.maxEntries);
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
    if (!this.isAvailable) return;

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
  batchDequeue(articleIds: string[]): QueueEntry[] {
    if (!this.isAvailable) return [];

    try {
      const queue = this.getQueue();
      const removedEntries: QueueEntry[] = [];
      const remainingEntries: QueueEntry[] = [];

      queue.forEach((entry) => {
        if (articleIds.includes(entry.articleId)) {
          removedEntries.push(entry);
        } else {
          remainingEntries.push(entry);
        }
      });

      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify(remainingEntries)
      );
      return removedEntries;
    } catch {
      return [];
    }
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
   * Dequeue - remove first item or specific item by articleId
   */
  dequeue(articleId?: string): QueueEntry | null {
    if (articleId) {
      return this.removeByArticleId(articleId);
    }

    // Remove first item (FIFO)
    const queue = this.getQueue();
    if (queue.length === 0) return null;

    const firstItem = queue.shift();
    if (firstItem) {
      try {
        localStorage.setItem(this.config.storageKey, JSON.stringify(queue));
      } catch {
        // Fail silently for graceful degradation
      }
    }
    return firstItem || null;
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
    return this.getQueue().length < this.config.maxEntries;
  }
}

// Export singleton instance
export const localStorageQueue = new LocalStorageQueue();
