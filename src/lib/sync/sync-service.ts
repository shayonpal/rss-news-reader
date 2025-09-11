import { createClient } from "@/lib/supabase/server";
import { getUserPreferences } from "@/lib/services/preferences";
import { fetchArticles, getSubscriptions } from "@/lib/services/inoreader";
import { retainArticles } from "@/lib/sync/article-retention";
import type { InoreaderArticle, DatabaseArticle } from "@/types/inoreader";

interface SyncOptions {
  incremental?: boolean;
  lastSyncToken?: string;
}

interface SyncResult {
  articlesAdded: number;
  articlesDeleted: number;
  retentionError?: string;
  error: string | null;
}

interface FeedArticleQuota {
  feedId: string;
  quota: number;
  fetched: number;
}

const syncLocks = new Map<string, boolean>();

export async function syncArticles(
  userId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const result: SyncResult = {
    articlesAdded: 0,
    articlesDeleted: 0,
    error: null,
  };

  // Check if sync is already in progress
  if (syncLocks.get(userId)) {
    result.error = "Sync already in progress";
    return result;
  }

  // Acquire sync lock
  syncLocks.set(userId, true);

  try {
    // Get user preferences
    const preferences = await getUserPreferences();
    const maxArticles = preferences?.sync?.maxArticles || 100;
    const retentionCount = preferences?.sync?.retentionCount || 2000;

    // Get subscriptions
    const subscriptionsResult = await getSubscriptions();
    const subscriptions = subscriptionsResult?.subscriptions || [];

    if (subscriptions.length === 0) {
      result.error = "No subscriptions found";
      return result;
    }

    // Calculate per-feed quota
    const articlesPerFeed = Math.floor(maxArticles / subscriptions.length);
    const feedQuotas: FeedArticleQuota[] = subscriptions.map((sub) => ({
      feedId: sub.id,
      quota: articlesPerFeed,
      fetched: 0,
    }));

    // Distribute remaining articles to first feeds
    const remainingArticles = maxArticles % subscriptions.length;
    for (let i = 0; i < remainingArticles; i++) {
      feedQuotas[i].quota++;
    }

    const supabase = await createClient();
    let totalArticlesFetched = 0;

    // Process each feed
    for (const feedQuota of feedQuotas) {
      if (totalArticlesFetched >= maxArticles) {
        break;
      }

      let continuation =
        options.incremental && options.lastSyncToken
          ? options.lastSyncToken
          : undefined;
      let feedArticlesFetched = 0;

      while (feedArticlesFetched < feedQuota.quota) {
        const remainingQuota = Math.min(
          feedQuota.quota - feedArticlesFetched,
          maxArticles - totalArticlesFetched
        );

        if (remainingQuota <= 0) break;

        // Fetch articles for this feed
        const fetchResult = await fetchArticles({
          count: remainingQuota,
          userId,
          ...(feedQuota.feedId && { feedId: feedQuota.feedId }),
          ...(continuation && { continuation }),
        });

        if (!fetchResult?.items || fetchResult.items.length === 0) {
          break;
        }

        // Limit articles to remaining quota
        const articlesToStore = fetchResult.items.slice(0, remainingQuota);

        // Transform articles for database
        const dbArticles: DatabaseArticle[] = articlesToStore.map(
          (article: InoreaderArticle) => ({
            id: article.id,
            title: article.title || "Untitled",
            url:
              article.canonical?.[0]?.href ||
              article.alternate?.[0]?.href ||
              "",
            content: article.summary?.content || "",
            author: article.author || "",
            published_at: article.published
              ? new Date(article.published * 1000).toISOString()
              : new Date().toISOString(),
            feed_id: feedQuota.feedId,
            user_id: userId,
            starred: false,
            read_status: false,
          })
        );

        // Upsert articles to database
        const { error: upsertError } = await supabase
          .from("articles")
          .upsert(dbArticles, {
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("Error upserting articles:", upsertError);
          result.error = `Database error: ${upsertError.message}`;
          break;
        }

        feedArticlesFetched += articlesToStore.length;
        totalArticlesFetched += articlesToStore.length;
        feedQuota.fetched = feedArticlesFetched;

        // Check if we should continue with pagination
        if (
          !fetchResult.continuation ||
          feedArticlesFetched >= feedQuota.quota ||
          totalArticlesFetched >= maxArticles
        ) {
          break;
        }

        continuation = fetchResult.continuation;
      }
    }

    result.articlesAdded = totalArticlesFetched;

    // Run retention after successful sync
    if (totalArticlesFetched > 0 && !result.error) {
      try {
        const retentionResult = await retainArticles(userId, {
          maxCount: retentionCount,
          preserveStarred: true,
        });

        if (retentionResult && retentionResult.error) {
          result.retentionError = retentionResult.error;
        } else if (retentionResult) {
          result.articlesDeleted = retentionResult.deletedCount;
        }
      } catch (retentionError) {
        console.error("Retention error:", retentionError);
        result.retentionError = "Failed to run retention policy";
      }
    }
  } catch (error) {
    console.error("Sync error:", error);
    result.error =
      error instanceof Error ? error.message : "Unknown sync error";
  } finally {
    // Release sync lock
    syncLocks.delete(userId);
  }

  return result;
}
