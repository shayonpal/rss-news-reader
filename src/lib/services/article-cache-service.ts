"use client";

import type { ArticleCountManager } from "@/lib/article-count-manager";

class ArticleCacheService {
  private managers = new Set<ArticleCountManager>();

  register(manager: ArticleCountManager) {
    this.managers.add(manager);
  }

  unregister(manager: ArticleCountManager) {
    this.managers.delete(manager);
  }

  invalidateCache(feedId?: string) {
    for (const manager of this.managers) {
      try {
        manager.invalidateCache(feedId);
      } catch (error) {
        console.warn("Manager invalidation failed:", error);
        // Don't let one faulty manager block others
      }
    }
  }

  /** Reset all managers. Used for testing. */
  reset() {
    this.managers.clear();
  }
}

export const articleCacheService = new ArticleCacheService();
