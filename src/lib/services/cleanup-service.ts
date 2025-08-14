/**
 * RR-129: Article Cleanup Service
 * Handles cleanup of deleted feeds and read articles with tracking to prevent re-import
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface CleanupConfig {
  deletionTrackingEnabled: boolean;
  cleanupReadArticlesEnabled: boolean;
  feedDeletionSafetyThreshold: number;
  maxArticlesPerCleanupBatch: number;
  deletionTrackingRetentionDays: number;
  maxIdsPerDeleteOperation: number;
}

export interface CleanupResult {
  feedsDeleted: number;
  articlesDeleted: number;
  readArticlesDeleted: number;
  trackingEntriesCreated: number;
  errors: string[];
}

export class ArticleCleanupService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get cleanup configuration from system_config table
   */
  async getCleanupConfig(): Promise<CleanupConfig> {
    const { data: configData } = await this.supabase
      .from("system_config")
      .select("key, value")
      .in("key", [
        "deletion_tracking_enabled",
        "cleanup_read_articles_enabled",
        "feed_deletion_safety_threshold",
        "max_articles_per_cleanup_batch",
        "deletion_tracking_retention_days",
        "max_ids_per_delete_operation",
      ]);

    const config: Record<string, string> = {};
    configData?.forEach((item) => {
      config[item.key] = item.value;
    });

    return {
      deletionTrackingEnabled: config.deletion_tracking_enabled === "true",
      cleanupReadArticlesEnabled:
        config.cleanup_read_articles_enabled === "true",
      feedDeletionSafetyThreshold: parseFloat(
        config.feed_deletion_safety_threshold || "0.5"
      ),
      maxArticlesPerCleanupBatch: parseInt(
        config.max_articles_per_cleanup_batch || "1000"
      ),
      deletionTrackingRetentionDays: parseInt(
        config.deletion_tracking_retention_days || "90"
      ),
      maxIdsPerDeleteOperation: parseInt(
        config.max_ids_per_delete_operation || "200"
      ),
    };
  }

  /**
   * Clean up feeds that no longer exist in Inoreader
   */
  async cleanupDeletedFeeds(
    inoreaderFeedIds: string[],
    userId: string
  ): Promise<{ feedsDeleted: number; articlesDeleted: number }> {
    const config = await this.getCleanupConfig();

    // Get current local feeds
    const { data: localFeeds } = await this.supabase
      .from("feeds")
      .select("id, inoreader_id")
      .eq("user_id", userId);

    if (!localFeeds) return { feedsDeleted: 0, articlesDeleted: 0 };

    // Find feeds to delete (exist locally but not in Inoreader)
    const localFeedIds = new Set(localFeeds.map((f) => f.inoreader_id));
    const inoreaderSet = new Set(inoreaderFeedIds);
    const feedsToDelete = localFeeds.filter(
      (f) => !inoreaderSet.has(f.inoreader_id)
    );

    // Safety check: Don't delete if more than threshold percentage
    const deletionPercentage = feedsToDelete.length / localFeeds.length;
    if (deletionPercentage > config.feedDeletionSafetyThreshold) {
      console.warn(
        `[Cleanup] Safety check triggered: Would delete ${(deletionPercentage * 100).toFixed(1)}% of feeds (threshold: ${config.feedDeletionSafetyThreshold * 100}%)`
      );
      return { feedsDeleted: 0, articlesDeleted: 0 };
    }

    // Count articles that will be deleted
    let articlesDeleted = 0;
    for (const feed of feedsToDelete) {
      const { count } = await this.supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("feed_id", feed.id);

      articlesDeleted += count || 0;
    }

    // Delete feeds (articles will CASCADE delete due to foreign key)
    if (feedsToDelete.length > 0) {
      const { error } = await this.supabase
        .from("feeds")
        .delete()
        .in(
          "id",
          feedsToDelete.map((f) => f.id)
        );

      if (error) {
        console.error("[Cleanup] Error deleting feeds:", error);
        return { feedsDeleted: 0, articlesDeleted: 0 };
      }

      console.log(
        `[Cleanup] Deleted ${feedsToDelete.length} feeds and ${articlesDeleted} associated articles`
      );
    }

    return {
      feedsDeleted: feedsToDelete.length,
      articlesDeleted,
    };
  }

  /**
   * Clean up read articles with tracking to prevent re-import
   */
  async cleanupReadArticles(userId: string): Promise<CleanupResult> {
    const config = await this.getCleanupConfig();
    const result: CleanupResult = {
      feedsDeleted: 0,
      articlesDeleted: 0,
      readArticlesDeleted: 0,
      trackingEntriesCreated: 0,
      errors: [],
    };

    if (!config.cleanupReadArticlesEnabled) {
      console.log("[Cleanup] Read article cleanup is disabled");
      return result;
    }

    if (!config.deletionTrackingEnabled) {
      console.log("[Cleanup] Deletion tracking is disabled - skipping cleanup");
      return result;
    }

    try {
      // Get read, unstarred articles to delete
      const { data: articlesToDelete, error: fetchError } = await this.supabase
        .from("articles")
        .select("id, inoreader_id, feed_id")
        .eq("is_read", true)
        .eq("is_starred", false)
        .limit(config.maxArticlesPerCleanupBatch);

      if (fetchError) {
        result.errors.push(`Failed to fetch articles: ${fetchError.message}`);
        return result;
      }

      if (!articlesToDelete || articlesToDelete.length === 0) {
        console.log("[Cleanup] No read articles to clean up");
        return result;
      }

      // Track deletions before removing articles
      const trackingEntries = articlesToDelete.map((article) => ({
        inoreader_id: article.inoreader_id,
        was_read: true,
        feed_id: article.feed_id,
        deleted_at: new Date().toISOString(),
      }));

      // Insert tracking entries (ignore conflicts for already tracked articles)
      const { error: trackingError } = await this.supabase
        .from("deleted_articles")
        .upsert(trackingEntries, {
          onConflict: "inoreader_id",
          ignoreDuplicates: true,
        });

      if (trackingError) {
        result.errors.push(
          `Failed to track deletions: ${trackingError.message}`
        );
        // Continue with deletion even if tracking fails
      } else {
        result.trackingEntriesCreated = trackingEntries.length;
      }

      // Delete the articles in chunks to avoid URI length limits
      const DELETE_CHUNK_SIZE = config.maxIdsPerDeleteOperation || 200; // Configurable, defaults to 200
      let totalDeleted = 0;
      const deleteErrors: string[] = [];

      // Process articles in chunks
      for (let i = 0; i < articlesToDelete.length; i += DELETE_CHUNK_SIZE) {
        const chunk = articlesToDelete.slice(i, i + DELETE_CHUNK_SIZE);
        const chunkNumber = Math.floor(i / DELETE_CHUNK_SIZE) + 1;
        const totalChunks = Math.ceil(
          articlesToDelete.length / DELETE_CHUNK_SIZE
        );

        console.log(
          `[Cleanup] Deleting chunk ${chunkNumber}/${totalChunks} (${chunk.length} articles)`
        );

        const { error: deleteError } = await this.supabase
          .from("articles")
          .delete()
          .in(
            "id",
            chunk.map((a) => a.id)
          );

        if (deleteError) {
          deleteErrors.push(`Chunk ${chunkNumber}: ${deleteError.message}`);
          console.error(
            `[Cleanup] Failed to delete chunk ${chunkNumber}:`,
            deleteError
          );
        } else {
          totalDeleted += chunk.length;
        }

        // Add delay between chunks to avoid overwhelming the database
        if (i + DELETE_CHUNK_SIZE < articlesToDelete.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Report any errors but continue processing
      if (deleteErrors.length > 0) {
        result.errors.push(
          `Failed to delete some article chunks: ${deleteErrors.join("; ")}`
        );
      }

      result.readArticlesDeleted = totalDeleted;
      console.log(
        `[Cleanup] Deleted ${result.readArticlesDeleted} read articles with tracking`
      );

      // Clean up old tracking entries
      await this.cleanupOldTrackingEntries(
        config.deletionTrackingRetentionDays
      );
    } catch (error) {
      result.errors.push(`Cleanup exception: ${error}`);
    }

    return result;
  }

  /**
   * Clean up old tracking entries beyond retention period
   */
  async cleanupOldTrackingEntries(retentionDays: number): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { error } = await this.supabase
        .from("deleted_articles")
        .delete()
        .lt("deleted_at", cutoffDate.toISOString());

      if (error) {
        console.error("[Cleanup] Error cleaning old tracking entries:", error);
      } else {
        console.log(
          `[Cleanup] Cleaned tracking entries older than ${retentionDays} days`
        );
      }
    } catch (error) {
      console.error("[Cleanup] Exception cleaning tracking entries:", error);
    }
  }

  /**
   * Check if an article was previously deleted and should not be re-imported
   */
  async wasArticleDeleted(inoreaderIds: string[]): Promise<Set<string>> {
    if (inoreaderIds.length === 0) return new Set();

    const { data } = await this.supabase
      .from("deleted_articles")
      .select("inoreader_id")
      .in("inoreader_id", inoreaderIds);

    return new Set(data?.map((item) => item.inoreader_id) || []);
  }

  /**
   * RR-149: Enforce article retention limit by deleting oldest read articles
   * Uses existing chunked deletion logic from cleanupReadArticles
   */
  async enforceRetentionLimit(
    userId: string,
    retentionLimit: number
  ): Promise<{ deletedCount: number; chunksProcessed: number }> {
    // Get current article count for this user (via feeds relationship)
    const { count: currentCount } = await this.supabase
      .from("articles")
      .select("*, feeds!inner(user_id)", { count: "exact", head: true })
      .eq("feeds.user_id", userId);

    if (!currentCount || currentCount <= retentionLimit) {
      console.log(
        `[Retention] Article count (${currentCount}) within limit (${retentionLimit})`
      );
      return { deletedCount: 0, chunksProcessed: 0 };
    }

    const articlesToDelete = currentCount - retentionLimit;
    console.log(
      `[Retention] Need to delete ${articlesToDelete} articles to meet limit of ${retentionLimit}`
    );

    const config = await this.getCleanupConfig();
    const DELETE_CHUNK_SIZE = config.maxIdsPerDeleteOperation || 200;

    // Get oldest read articles to delete (prioritize read over unread)
    // Need to join with feeds to filter by user
    const { data: articles, error: fetchError } = await this.supabase
      .from("articles")
      .select("id, inoreader_id, feed_id, feeds!inner(user_id)")
      .eq("feeds.user_id", userId)
      .eq("is_read", true)
      .eq("is_starred", false)
      .order("published_at", { ascending: true })
      .limit(articlesToDelete);

    if (fetchError || !articles || articles.length === 0) {
      // If no read articles or not enough, get oldest unread unstarred articles
      const { data: unreadArticles, error: unreadError } = await this.supabase
        .from("articles")
        .select("id, inoreader_id, feed_id, feeds!inner(user_id)")
        .eq("feeds.user_id", userId)
        .eq("is_starred", false)
        .order("published_at", { ascending: true })
        .limit(articlesToDelete);

      if (unreadError || !unreadArticles) {
        console.error(
          "[Retention] Failed to fetch articles for deletion:",
          unreadError
        );
        return { deletedCount: 0, chunksProcessed: 0 };
      }

      articles.push(...(unreadArticles || []));
    }

    // Track deletions if enabled
    if (config.deletionTrackingEnabled && articles.length > 0) {
      const trackingEntries = articles.map((article) => ({
        inoreader_id: article.inoreader_id,
        was_read: true,
        feed_id: article.feed_id,
        deleted_at: new Date().toISOString(),
      }));

      await this.supabase.from("deleted_articles").upsert(trackingEntries, {
        onConflict: "inoreader_id",
        ignoreDuplicates: true,
      });
    }

    // Delete articles in chunks using existing pattern
    let totalDeleted = 0;
    let chunksProcessed = 0;

    for (let i = 0; i < articles.length; i += DELETE_CHUNK_SIZE) {
      const chunk = articles.slice(i, i + DELETE_CHUNK_SIZE);
      chunksProcessed++;

      console.log(
        `[Retention] Deleting chunk ${chunksProcessed} (${chunk.length} articles)`
      );

      const { error: deleteError } = await this.supabase
        .from("articles")
        .delete()
        .in(
          "id",
          chunk.map((a) => a.id)
        );

      if (!deleteError) {
        totalDeleted += chunk.length;
      }

      // Add delay between chunks
      if (i + DELETE_CHUNK_SIZE < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(
      `[Retention] Deleted ${totalDeleted} articles in ${chunksProcessed} chunks`
    );
    return { deletedCount: totalDeleted, chunksProcessed };
  }

  /**
   * Execute full cleanup process
   */
  async executeFullCleanup(
    inoreaderFeedIds: string[],
    userId: string
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      feedsDeleted: 0,
      articlesDeleted: 0,
      readArticlesDeleted: 0,
      trackingEntriesCreated: 0,
      errors: [],
    };

    try {
      // Step 1: Clean up deleted feeds
      const feedCleanup = await this.cleanupDeletedFeeds(
        inoreaderFeedIds,
        userId
      );
      result.feedsDeleted = feedCleanup.feedsDeleted;
      result.articlesDeleted = feedCleanup.articlesDeleted;

      // Step 2: Clean up read articles with tracking
      const articleCleanup = await this.cleanupReadArticles(userId);
      result.readArticlesDeleted = articleCleanup.readArticlesDeleted;
      result.trackingEntriesCreated = articleCleanup.trackingEntriesCreated;
      result.errors.push(...articleCleanup.errors);
    } catch (error) {
      result.errors.push(`Full cleanup exception: ${error}`);
    }

    return result;
  }
}
