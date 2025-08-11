import { db } from "./database";
import type { Article } from "@/types";

export interface StorageStats {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  quotaPercentage: number;
  isNearLimit: boolean;
  isCritical: boolean;
}

export class StorageManager {
  private readonly MAX_ARTICLES = 500;
  private readonly QUOTA_WARNING_THRESHOLD = 0.8; // 80%
  private readonly QUOTA_CRITICAL_THRESHOLD = 0.95; // 95%

  async getStorageStats(): Promise<StorageStats | null> {
    try {
      const estimate = await navigator.storage?.estimate();
      if (!estimate) {
        return null;
      }

      const totalBytes = estimate.quota ?? 0;
      const usedBytes = estimate.usage ?? 0;
      const availableBytes = totalBytes - usedBytes;
      const quotaPercentage = totalBytes > 0 ? usedBytes / totalBytes : 0;

      return {
        totalBytes,
        usedBytes,
        availableBytes,
        quotaPercentage,
        isNearLimit: quotaPercentage >= this.QUOTA_WARNING_THRESHOLD,
        isCritical: quotaPercentage >= this.QUOTA_CRITICAL_THRESHOLD,
      };
    } catch (error) {
      console.error("Failed to get storage estimate:", error);
      return null;
    }
  }

  async requestPersistentStorage(): Promise<boolean> {
    try {
      if ("storage" in navigator && "persist" in navigator.storage) {
        return await navigator.storage.persist();
      }
      return false;
    } catch (error) {
      console.error("Failed to request persistent storage:", error);
      return false;
    }
  }

  async isPersistentStorageGranted(): Promise<boolean> {
    try {
      if ("storage" in navigator && "persisted" in navigator.storage) {
        return await navigator.storage.persisted();
      }
      return false;
    } catch (error) {
      console.error("Failed to check persistent storage status:", error);
      return false;
    }
  }

  async pruneOldArticles(): Promise<number> {
    try {
      const count = await db.articles.count();

      if (count <= this.MAX_ARTICLES) {
        return 0;
      }

      const excessCount = count - this.MAX_ARTICLES;

      // Get articles to keep (recent, unread, or favorited)
      const articlesToKeep = await db.articles
        .orderBy("publishedAt")
        .reverse()
        .limit(this.MAX_ARTICLES)
        .primaryKeys();

      // Delete excess articles that are not favorites
      const deleted = await db.transaction(
        "rw",
        [db.articles, db.summaries] as any,
        async () => {
          const toDelete = await db.articles
            .where("id")
            .noneOf(articlesToKeep)
            .and((article) => !article.tags?.includes("favorite"))
            .primaryKeys();

          if (toDelete.length === 0) {
            return 0;
          }

          // Delete articles and their summaries
          await Promise.all([
            db.articles.bulkDelete(toDelete),
            db.summaries.where("articleId").anyOf(toDelete).delete(),
          ]);

          return toDelete.length;
        }
      );

      console.log(`Pruned ${deleted} old articles`);
      return deleted;
    } catch (error) {
      console.error("Failed to prune old articles:", error);
      return 0;
    }
  }

  async pruneOldApiUsage(): Promise<number> {
    try {
      // Keep only last 30 days of API usage
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffString = cutoffDate.toISOString().split("T")[0];

      const deleted = await db.apiUsage
        .where("date")
        .below(cutoffString)
        .delete();

      if (deleted > 0) {
        console.log(`Pruned ${deleted} old API usage records`);
      }

      return deleted;
    } catch (error) {
      console.error("Failed to prune old API usage:", error);
      return 0;
    }
  }

  async cleanupOrphanedData(): Promise<void> {
    try {
      await db.vacuum();
      console.log("Cleanup completed");
    } catch (error) {
      console.error("Failed to cleanup orphaned data:", error);
    }
  }

  async performMaintenanceCleanup(): Promise<{
    articlesDeleted: number;
    apiRecordsDeleted: number;
    stats: StorageStats | null;
  }> {
    const stats = await this.getStorageStats();

    // If we're near the quota limit, be more aggressive with cleanup
    const shouldCleanup = stats?.isNearLimit || false;

    if (!shouldCleanup) {
      return {
        articlesDeleted: 0,
        apiRecordsDeleted: 0,
        stats,
      };
    }

    const [articlesDeleted, apiRecordsDeleted] = await Promise.all([
      this.pruneOldArticles(),
      this.pruneOldApiUsage(),
    ]);

    await this.cleanupOrphanedData();

    const newStats = await this.getStorageStats();

    return {
      articlesDeleted,
      apiRecordsDeleted,
      stats: newStats,
    };
  }

  async handleQuotaExceeded(): Promise<boolean> {
    console.warn("Storage quota exceeded, attempting cleanup...");

    try {
      const result = await this.performMaintenanceCleanup();

      if (result.articlesDeleted === 0 && result.apiRecordsDeleted === 0) {
        // If no cleanup was possible, try a more aggressive approach
        const currentCount = await db.articles.count();
        const targetCount = Math.floor(this.MAX_ARTICLES * 0.7); // Keep only 70%

        if (currentCount > targetCount) {
          const toDelete = currentCount - targetCount;
          const deletedIds = await db.articles
            .orderBy("publishedAt")
            .limit(toDelete)
            .primaryKeys();

          await db.transaction("rw", [db.articles, db.summaries] as any, async () => {
            await Promise.all([
              db.articles.bulkDelete(deletedIds),
              db.summaries.where("articleId").anyOf(deletedIds).delete(),
            ]);
          });

          console.log(`Emergency cleanup: deleted ${toDelete} articles`);
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to handle quota exceeded:", error);
      return false;
    }
  }

  // Monitor storage and warn user if needed
  async checkStorageHealth(): Promise<{
    isHealthy: boolean;
    warning?: string;
    stats: StorageStats | null;
  }> {
    const stats = await this.getStorageStats();

    if (!stats) {
      return {
        isHealthy: false,
        warning: "Unable to check storage status",
        stats: null,
      };
    }

    if (stats.isCritical) {
      return {
        isHealthy: false,
        warning: `Storage is critically full (${Math.round(stats.quotaPercentage * 100)}%). Some data may be automatically cleaned up.`,
        stats,
      };
    }

    if (stats.isNearLimit) {
      return {
        isHealthy: false,
        warning: `Storage is getting full (${Math.round(stats.quotaPercentage * 100)}%). Consider clearing old data.`,
        stats,
      };
    }

    return {
      isHealthy: true,
      stats,
    };
  }
}

// Global storage manager instance
export const storageManager = new StorageManager();
