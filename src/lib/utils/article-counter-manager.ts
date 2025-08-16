/**
 * Article Counter Manager for RR-197
 * Manages real-time counter updates with localStorage integration
 */

import { localStorageQueue, type QueueEntry } from "./localstorage-queue";

export interface CounterState {
  feedId: string;
  unreadCount: number;
  totalCount: number;
  lastUpdated: number;
}

export interface FeedCountUpdate {
  feedId: string;
  deltaUnread: number;
  deltaTotal: number;
}

export class ArticleCounterManager {
  private counterCache = new Map<string, CounterState>();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Update counter based on localStorage queue entries
   */
  updateCountersFromLocalStorage(): FeedCountUpdate[] {
    const queueEntries = localStorageQueue.getQueue();
    const updates: FeedCountUpdate[] = [];

    // RR-197 Critical Fix: Use Set for O(1) lookup instead of Array.includes()
    const processedKey = "rss_reader_processed_entries";
    let processedSet = new Set<string>();

    try {
      const stored = localStorage.getItem(processedKey);
      if (stored) {
        const processedArray = JSON.parse(stored);
        processedSet = new Set(processedArray);
      }
    } catch {
      processedSet = new Set();
    }

    // Only process NEW entries (not already counted) - O(1) lookup
    const newEntries = queueEntries.filter((entry) => {
      const entryKey = `${entry.articleId}_${entry.timestamp}`;
      return !processedSet.has(entryKey);
    });

    if (newEntries.length === 0) {
      console.log(
        `[RR-197] No new localStorage entries to process (${queueEntries.length} total already processed)`
      );
      return []; // No new entries to process
    }

    const feedDeltas = new Map<string, { unread: number; total: number }>();

    // Process only new queue entries to calculate deltas
    newEntries.forEach((entry: QueueEntry) => {
      const current = feedDeltas.get(entry.feedId) || { unread: 0, total: 0 };

      switch (entry.action) {
        case "mark_read":
          current.unread -= 1;
          break;
        case "mark_unread":
          current.unread += 1;
          break;
        // toggle_star doesn't affect read counts
      }

      feedDeltas.set(entry.feedId, current);
    });

    // Convert to update format
    feedDeltas.forEach((delta, feedId) => {
      updates.push({
        feedId,
        deltaUnread: delta.unread,
        deltaTotal: delta.total,
      });
    });

    // RR-197 Critical Fix: Mark entries as processed atomically to prevent race conditions
    try {
      const newProcessedEntries = Array.from(processedSet);
      newEntries.forEach((entry) => {
        newProcessedEntries.push(`${entry.articleId}_${entry.timestamp}`);
      });

      // Keep only last 1000 processed entries to prevent storage bloat
      const trimmedEntries = newProcessedEntries.slice(-1000);
      localStorage.setItem(processedKey, JSON.stringify(trimmedEntries));

      console.log(
        `[RR-197] Atomically processed ${newEntries.length} new localStorage entries (${queueEntries.length} total in queue, ${trimmedEntries.length} tracked)`
      );
    } catch (error) {
      console.warn(
        "[ArticleCounterManager] Failed to track processed entries:",
        error
      );
    }

    return updates;
  }

  /**
   * Apply counter updates optimistically
   */
  applyCounterUpdates(updates: FeedCountUpdate[]): void {
    const now = Date.now();

    updates.forEach((update) => {
      const current = this.counterCache.get(update.feedId) || {
        feedId: update.feedId,
        unreadCount: 0,
        totalCount: 0,
        lastUpdated: 0,
      };

      // Apply deltas
      current.unreadCount = Math.max(
        0,
        current.unreadCount + update.deltaUnread
      );
      current.totalCount = Math.max(0, current.totalCount + update.deltaTotal);
      current.lastUpdated = now;

      this.counterCache.set(update.feedId, current);
    });

    this.lastCacheUpdate = now;
  }

  /**
   * Get counter state for a feed
   */
  getCounterState(feedId: string): CounterState | null {
    return this.counterCache.get(feedId) || null;
  }

  /**
   * Get all counter states
   */
  getAllCounterStates(): CounterState[] {
    return Array.from(this.counterCache.values());
  }

  /**
   * Update baseline counters from database
   */
  updateBaselineCounters(
    feedCounters: { feedId: string; unreadCount: number; totalCount: number }[]
  ): void {
    const now = Date.now();

    feedCounters.forEach((counter) => {
      // Only update if we don't have recent localStorage updates
      const current = this.counterCache.get(counter.feedId);
      if (!current || now - current.lastUpdated > this.CACHE_TTL) {
        this.counterCache.set(counter.feedId, {
          feedId: counter.feedId,
          unreadCount: counter.unreadCount,
          totalCount: counter.totalCount,
          lastUpdated: now,
        });
      }
    });
  }

  /**
   * Mark operation in localStorage and update counters immediately
   */
  markArticleRead(articleId: string, feedId: string): number {
    const startTime = performance.now();

    // Add to localStorage queue
    const success = localStorageQueue.enqueue({
      articleId,
      timestamp: Date.now(),
      action: "mark_read",
      feedId,
    });

    if (success) {
      // Apply immediate counter update
      this.applyCounterUpdates([
        {
          feedId,
          deltaUnread: -1,
          deltaTotal: 0,
        },
      ]);
    }

    return performance.now() - startTime;
  }

  /**
   * Mark operation in localStorage and update counters immediately
   */
  markArticleUnread(articleId: string, feedId: string): number {
    const startTime = performance.now();

    // Add to localStorage queue
    const success = localStorageQueue.enqueue({
      articleId,
      timestamp: Date.now(),
      action: "mark_unread",
      feedId,
    });

    if (success) {
      // Apply immediate counter update
      this.applyCounterUpdates([
        {
          feedId,
          deltaUnread: 1,
          deltaTotal: 0,
        },
      ]);
    }

    return performance.now() - startTime;
  }

  /**
   * Batch mark multiple articles and update counters
   */
  batchMarkArticlesRead(
    articles: { articleId: string; feedId: string }[]
  ): number {
    const startTime = performance.now();
    const feedDeltas = new Map<string, number>();

    // Process each article
    articles.forEach(({ articleId, feedId }) => {
      const success = localStorageQueue.enqueue({
        articleId,
        timestamp: Date.now(),
        action: "mark_read",
        feedId,
      });

      if (success) {
        feedDeltas.set(feedId, (feedDeltas.get(feedId) || 0) - 1);
      }
    });

    // Apply batch counter updates
    const updates: FeedCountUpdate[] = [];
    feedDeltas.forEach((delta, feedId) => {
      updates.push({
        feedId,
        deltaUnread: delta,
        deltaTotal: 0,
      });
    });

    this.applyCounterUpdates(updates);

    return performance.now() - startTime;
  }

  /**
   * Clear localStorage queue and reset counters to database baseline
   */
  syncWithDatabase(): void {
    localStorageQueue.clearQueue();
    this.counterCache.clear();
    this.lastCacheUpdate = 0;

    // RR-197 Fix: Also clear processed entries tracking to prevent memory bloat
    try {
      localStorage.removeItem("rss_reader_processed_entries");
      console.log(
        "[RR-197] Cleared processed entries tracking after database sync"
      );
    } catch (error) {
      console.warn(
        "[RR-197] Failed to clear processed entries tracking:",
        error
      );
    }
  }

  /**
   * Invalidate cache for specific feed
   */
  invalidateCache(feedId?: string): void {
    if (feedId) {
      this.counterCache.delete(feedId);
    } else {
      this.counterCache.clear();
      this.lastCacheUpdate = 0;
    }
  }

  /**
   * Get performance metrics for counter operations
   */
  getPerformanceMetrics(): {
    cacheSize: number;
    lastCacheUpdate: number;
    queueSize: number;
    isLocalStorageAvailable: boolean;
  } {
    const queueStats = localStorageQueue.getStats();

    return {
      cacheSize: this.counterCache.size,
      lastCacheUpdate: this.lastCacheUpdate,
      queueSize: queueStats.count,
      isLocalStorageAvailable: queueStats.isAvailable,
    };
  }

  /**
   * Check if cache is fresh
   */
  isCacheFresh(): boolean {
    return Date.now() - this.lastCacheUpdate < this.CACHE_TTL;
  }

  /**
   * Get aggregated unread count across all feeds
   */
  getTotalUnreadCount(): number {
    return Array.from(this.counterCache.values()).reduce(
      (total, counter) => total + counter.unreadCount,
      0
    );
  }
}

// Export singleton instance
export const articleCounterManager = new ArticleCounterManager();
