import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";
import path from "path";
import { getAdminClient } from "@/lib/db/supabase-admin";
import { SyncConflictDetector } from "@/lib/sync/conflict-detector";
import { ArticleCleanupService } from "@/lib/services/cleanup-service";
import { decodeHtmlEntities } from "@/lib/utils/html-decoder";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";
import { ApiUsageTracker } from "@/lib/api/api-usage-tracker";

// Import token manager at top level to ensure it's bundled
// @ts-ignore
import TokenManager from "../../../../server/lib/token-manager.js";

// Use singleton Supabase admin client for better connection pooling
const supabase = getAdminClient();

// File-based sync status tracking for serverless compatibility
interface SyncStatus {
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message?: string;
  error?: string;
  startTime: number;
  syncId: string;
  // RR-171: Add sync metrics and sidebar data
  metrics?: {
    newArticles: number;
    deletedArticles: number;
    newTags: number;
    failedFeeds: number;
  };
  sidebar?: {
    feedCounts: Array<[string, number]>;
    tags: Array<{ id: string; name: string; count: number }>;
  };
}

// Get sync status file path
function getSyncStatusPath(syncId: string): string {
  return path.join("/tmp", `sync-status-${syncId}.json`);
}

// RR-171: Gather sidebar data for immediate UI update
async function gatherSidebarData() {
  try {
    // Get feed counts from feed_stats materialized view
    const { data: feedStats } = await supabase
      .from("feed_stats")
      .select("feed_id, unread_count");

    const feedCounts: Array<[string, number]> =
      feedStats?.map((stat) => [stat.feed_id, stat.unread_count]) || [];

    // Get the actual user ID first
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", "shayon")
      .single();

    const userId = userData?.id;
    if (!userId) {
      console.error("[Sync] User not found for sidebar data");
      return null;
    }

    // RR-163: Get tags with UNREAD counts - properly join tags table for names
    const { data: unreadArticleTags, error: tagError } = await supabase
      .from("articles")
      .select(
        `
        id,
        article_tags!inner(
          tag_id,
          tags!inner(id, name)
        )
      `
      )
      .eq("user_id", userId)
      .eq("is_read", false);

    if (tagError) {
      console.error("[Sync] Error fetching unread article tags:", tagError);
    }
    console.log(
      "[Sync] Unread articles with tags count:",
      unreadArticleTags?.length || 0
    );

    // Count unread articles per tag
    const tagCounts = new Map<string, { name: string; count: number }>();
    unreadArticleTags?.forEach((article) => {
      if (article.article_tags && Array.isArray(article.article_tags)) {
        article.article_tags.forEach((tagRelation: any) => {
          const tag = tagRelation.tags;
          if (tag) {
            const existing = tagCounts.get(tag.id);
            if (existing) {
              existing.count++;
            } else {
              // Decode HTML entities in tag names
              const decodedName = tag.name
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&#x27;/g, "'")
                .replace(/&#x2F;/g, "/");

              tagCounts.set(tag.id, { name: decodedName, count: 1 });
            }
          }
        });
      }
    });

    const tagsArray = Array.from(tagCounts.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
    }));

    console.log("[Sync] Sidebar tags array:", tagsArray.length, "tags");

    return {
      feedCounts,
      tags: tagsArray,
    };
  } catch (error) {
    console.error("[Sync] Error gathering sidebar data:", error);
    return null;
  }
}

// Write sync status to file AND database (dual-write for reliability)
async function writeSyncStatus(
  syncId: string,
  status: SyncStatus
): Promise<void> {
  // 1. Write to file (primary - fast)
  const filePath = getSyncStatusPath(syncId);
  await fs.writeFile(filePath, JSON.stringify(status), "utf-8");

  // 2. Write to database (fallback - persistent)
  try {
    const { error: dbError } = await supabase.from("sync_status").upsert(
      {
        sync_id: syncId,
        status: status.status,
        progress_percentage: status.progress,
        current_step: status.message || null,
        error_message: status.error || null,
        created_at: new Date(status.startTime).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sync_id" }
    );

    if (dbError) {
      console.error(`[Sync] Database write failed for ${syncId}:`, dbError);
      // Consider tracking this failure for monitoring
    }
  } catch (error) {
    // Log but don't fail - file write is primary
    console.error(
      `[Sync] Exception during database write for ${syncId}:`,
      error
    );
  }
}

// Clean up old sync files (older than 24 hours - aligned with database retention)
async function cleanupOldSyncFiles(): Promise<void> {
  try {
    const files = await fs.readdir("/tmp");
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      if (file.startsWith("sync-status-") && file.endsWith(".json")) {
        const filePath = path.join("/tmp", file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < twentyFourHoursAgo) {
          await fs.unlink(filePath);
          console.log(`[Sync] Cleaned up old sync file (>24h): ${file}`);
        }
      }
    }
  } catch (error) {
    console.error("[Sync] Error cleaning up sync files:", error);
  }
}

// Clean up old sync statuses from database (older than 24 hours)
async function cleanupOldDatabaseSyncStatuses(): Promise<void> {
  try {
    // Use expires_at column which is automatically set to 24 hours from creation
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("sync_status")
      .delete()
      .lt("expires_at", now);

    if (error) {
      console.error(
        "Error cleaning up old sync statuses from database:",
        error
      );
    } else {
      console.log(
        `[Sync] Database cleanup completed for expired sync statuses`
      );
    }
  } catch (error) {
    console.error("Error in database cleanup:", error);
  }
}

export async function POST() {
  try {
    // Check rate limit
    const rateLimit = await checkRateLimit();

    if (!rateLimit.allowed) {
      // Calculate retry-after based on environment or default to 5 minutes
      const retryAfterSeconds = process.env.RATE_LIMIT_RETRY_SECONDS
        ? parseInt(process.env.RATE_LIMIT_RETRY_SECONDS)
        : 300; // Default 5 minutes

      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: "Inoreader API rate limit exceeded",
          limit: rateLimit.limit,
          used: rateLimit.used,
          remaining: 0,
          retryAfter: retryAfterSeconds, // Include in body for backward compatibility
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(), // Standard HTTP header
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Generate sync ID
    const syncId = uuidv4();

    // Initialize sync status in file
    const initialStatus: SyncStatus = {
      syncId,
      status: "pending",
      progress: 0,
      startTime: Date.now(),
    };
    await writeSyncStatus(syncId, initialStatus);

    // Clean up old sync files and database entries in background
    cleanupOldSyncFiles().catch(console.error);
    cleanupOldDatabaseSyncStatuses().catch(console.error);

    // Start sync in background (non-blocking)
    performServerSync(syncId).catch(async (error) => {
      console.error("Sync failed:", error);
      await writeSyncStatus(syncId, {
        syncId,
        status: "failed",
        progress: 0,
        error: error.message,
        startTime: Date.now(),
      });
    });

    return NextResponse.json({
      syncId,
      status: "pending",
      progress: 0,
      message: "Sync operation started",
      startTime: initialStatus.startTime,
      metrics: {
        newArticles: 0,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0,
      },
    });
  } catch (error) {
    console.error("Failed to start sync:", error);
    return NextResponse.json(
      {
        error: "sync_start_failed",
        message: "Failed to start sync",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function performServerSync(syncId: string) {
  const status: SyncStatus = {
    syncId,
    status: "running",
    progress: 10,
    message: "Loading server tokens...",
    startTime: Date.now(),
  };

  try {
    // Update status to running
    await writeSyncStatus(syncId, status);

    // Use the imported TokenManager
    const tokenManager = new TokenManager();

    // Get access token
    const accessToken = await tokenManager.getAccessToken();

    // RR-149: Track current timestamp for incremental sync
    const currentTimestamp = Math.floor(Date.now() / 1000);

    status.progress = 20;
    status.message = "Fetching subscriptions...";
    await writeSyncStatus(syncId, status);

    // Step 1: Fetch subscriptions
    const subsResponse = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/subscription/list"
    );

    // Capture rate limit headers for RR-5 (even on failure)
    await captureRateLimitHeaders(subsResponse.headers);

    if (!subsResponse.ok) {
      // Check if it's a rate limit error
      if (subsResponse.status === 429) {
        console.error(
          "[Sync] Inoreader API rate limit reached during subscriptions fetch"
        );
        status.error = "Rate limit exceeded - sync incomplete";
        status.status = "failed";
        await writeSyncStatus(syncId, status);
      }
      throw new Error(
        `Failed to fetch subscriptions: ${subsResponse.statusText}`
      );
    }

    const subsData = await subsResponse.json();
    const subscriptions = subsData.subscriptions || [];

    status.progress = 30;
    status.message = `Found ${subscriptions.length} feeds...`;
    await writeSyncStatus(syncId, status);

    // Step 2: Build folder list from subscriptions to distinguish from tags (RR-128)
    // Since Inoreader doesn't always provide type field in tag list,
    // we identify folders from subscription categories
    const folderNames = new Set<string>();
    for (const sub of subscriptions) {
      if (sub.categories && Array.isArray(sub.categories)) {
        for (const category of sub.categories) {
          if (category.label) {
            folderNames.add(category.label);
          }
        }
      }
    }
    console.log(`[Sync] Found ${folderNames.size} folders from subscriptions`);

    // Step 3: Fetch tag list to get all labels
    const tagListResponse = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/tag/list"
    );

    // Capture rate limit headers for RR-5 (even on failure)
    await captureRateLimitHeaders(tagListResponse.headers);

    if (!tagListResponse.ok) {
      // Check if it's a rate limit error (RR-5)
      if (tagListResponse.status === 429) {
        console.error(
          "[Sync] Inoreader API rate limit reached during tag list fetch"
        );
        status.error =
          "Rate limit exceeded - sync incomplete after fetching subscriptions";
        status.status = "failed";
        await writeSyncStatus(syncId, status);
        return; // Exit gracefully with partial data
      }
      console.error(
        `[Sync] Failed to fetch tag list: ${tagListResponse.statusText}`
      );
      // Continue sync even if tag list fails for other reasons
    }

    // Get all user labels (both tags and folders)
    const allLabels = new Set<string>();
    if (tagListResponse.ok) {
      const tagListData = await tagListResponse.json();
      for (const tag of tagListData.tags || []) {
        if (tag.id && tag.id.includes("/label/")) {
          const labelName = tag.id.replace(/^user\/[^\/]*\/label\//, "");
          allLabels.add(labelName);
        }
      }
      console.log(
        `[Sync] Found ${allLabels.size} total labels (tags + folders)`
      );
    }

    // Tags are labels that are NOT folders
    const pureTags = new Set<string>();
    for (const label of allLabels) {
      if (!folderNames.has(label)) {
        pureTags.add(label);
      }
    }
    console.log(
      `[Sync] Identified ${pureTags.size} pure tags (excluding folders)`
    );

    // Create a map for quick lookup during article processing
    const tagTypeMap = new Map<string, string>();
    for (const label of allLabels) {
      if (folderNames.has(label)) {
        tagTypeMap.set(label, "folder");
      } else {
        tagTypeMap.set(label, "tag");
      }
    }

    // Step 4: Fetch unread counts
    const countsResponse = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/unread-count"
    );

    // Capture rate limit headers for RR-5 (even on failure)
    await captureRateLimitHeaders(countsResponse.headers);

    if (!countsResponse.ok) {
      // Check if it's a rate limit error (RR-5)
      if (countsResponse.status === 429) {
        console.error(
          "[Sync] Inoreader API rate limit reached during unread counts fetch"
        );
        status.error =
          "Rate limit exceeded - sync incomplete after fetching tags";
        status.status = "failed";
        await writeSyncStatus(syncId, status);
        return; // Exit gracefully with partial data
      }
      throw new Error(
        `Failed to fetch unread counts: ${countsResponse.statusText}`
      );
    }

    const countsData = await countsResponse.json();
    const unreadCounts = new Map(
      countsData.unreadcounts?.map((item: any) => [item.id, item.count]) || []
    );

    status.progress = 40;
    status.message = "Syncing feeds to Supabase...";
    await writeSyncStatus(syncId, status);

    // Get or create the single user
    const SINGLE_USER_ID = "shayon";
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", SINGLE_USER_ID)
      .single();

    let userId = user?.id;

    if (!userId) {
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          email: "shayon@local",
          inoreader_id: SINGLE_USER_ID,
          preferences: {},
        })
        .select("id")
        .single();

      if (error) throw new Error(`Failed to create user: ${error.message}`);
      userId = newUser.id;
    }

    // Process folders
    const processedFolders = new Set<string>();
    for (const sub of subscriptions) {
      for (const category of sub.categories || []) {
        if (!processedFolders.has(category.id)) {
          processedFolders.add(category.id);

          await supabase.from("folders").upsert(
            {
              user_id: userId,
              inoreader_id: category.id,
              name: category.label,
              parent_id: null,
            },
            { onConflict: "inoreader_id" }
          );
        }
      }
    }

    status.progress = 50;
    status.message = "Syncing feeds...";
    await writeSyncStatus(syncId, status);

    // Process feeds
    const feedsToUpsert = subscriptions.map((sub: any) => ({
      user_id: userId,
      inoreader_id: sub.id,
      title: sub.title,
      url: sub.url,
      folder_id: sub.categories?.[0]?.id || null,
      unread_count: unreadCounts.get(sub.id) || 0,
    }));

    if (feedsToUpsert.length > 0) {
      await supabase
        .from("feeds")
        .upsert(feedsToUpsert, { onConflict: "inoreader_id" });
    }

    // RR-129: Clean up deleted feeds and their articles
    const cleanupService = new ArticleCleanupService(supabase);
    const inoreaderFeedIds = subscriptions.map((sub: any) => sub.id);
    const feedCleanupResult = await cleanupService.cleanupDeletedFeeds(
      inoreaderFeedIds,
      userId
    );

    if (feedCleanupResult.feedsDeleted > 0) {
      console.log(
        `[Sync] Cleaned up ${feedCleanupResult.feedsDeleted} deleted feeds and ${feedCleanupResult.articlesDeleted} articles`
      );
    }

    status.progress = 60;
    status.message = "Fetching recent articles...";
    await writeSyncStatus(syncId, status);

    // RR-149: Get last incremental sync timestamp for incremental sync
    const { data: lastSyncData } = await supabase
      .from("sync_metadata")
      .select("value")
      .eq("key", "last_incremental_sync_timestamp")
      .single();

    const lastSyncTimestamp = lastSyncData?.value
      ? parseInt(lastSyncData.value)
      : null;

    // Check if we should do a full sync (weekly or no previous timestamp)
    const shouldDoFullSync =
      !lastSyncTimestamp ||
      currentTimestamp - lastSyncTimestamp > 7 * 24 * 60 * 60; // 7 days in seconds

    // Step 3: Fetch recent articles (single stream call)
    const maxArticles = process.env.SYNC_MAX_ARTICLES
      ? parseInt(process.env.SYNC_MAX_ARTICLES)
      : 100;

    // RR-149: Build URL with xt parameter to exclude read articles and ot for incremental sync
    let streamUrl = `https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list?n=${maxArticles}&xt=user/-/state/com.google/read`;

    if (!shouldDoFullSync && lastSyncTimestamp) {
      streamUrl += `&ot=${lastSyncTimestamp}`;
      console.log(
        `[Sync] Performing incremental sync (articles newer than ${new Date(lastSyncTimestamp * 1000).toISOString()})`
      );
    } else {
      console.log(
        `[Sync] Performing full sync (${shouldDoFullSync ? "weekly refresh" : "no previous timestamp"})`
      );
    }

    const streamResponse =
      await tokenManager.makeAuthenticatedRequest(streamUrl);

    // Capture rate limit headers for RR-5 (even on failure)
    await captureRateLimitHeaders(streamResponse.headers);

    if (!streamResponse.ok) {
      // Check if it's a rate limit error (RR-5)
      if (streamResponse.status === 429) {
        console.error(
          "[Sync] Inoreader API rate limit reached during stream contents fetch"
        );
        status.error =
          "Rate limit exceeded - sync incomplete after fetching unread counts";
        status.status = "failed";
        await writeSyncStatus(syncId, status);
        return; // Exit gracefully with partial data
      }
      throw new Error(`Failed to fetch articles: ${streamResponse.statusText}`);
    }

    const streamData = await streamResponse.json();
    const articles = streamData.items || [];

    status.progress = 70;
    status.message = `Processing ${articles.length} articles...`;
    await writeSyncStatus(syncId, status);

    // Get feed IDs mapping
    const { data: feeds } = await supabase
      .from("feeds")
      .select("id, inoreader_id")
      .eq("user_id", userId);

    const feedIdMap = new Map(feeds?.map((f) => [f.inoreader_id, f.id]) || []);

    // Mark sync timestamp for loop prevention
    const syncTimestamp = new Date().toISOString();

    // Initialize conflict detector for this sync session
    const conflictDetector = new SyncConflictDetector(syncId);

    // Process articles
    if (articles.length > 0 && feedIdMap.size > 0) {
      // RR-129: Check for previously deleted articles to prevent re-import
      const articleInoreaderIds = articles.map((a: any) => a.id);
      const deletedArticles =
        await cleanupService.wasArticleDeleted(articleInoreaderIds);

      const articlesToUpsert = articles
        .filter((article: any) => {
          // Find which feed this article belongs to
          const feedInorId = article.origin?.streamId;
          const hasValidFeed = feedInorId && feedIdMap.has(feedInorId);

          // RR-129: Skip articles that were previously deleted as read
          // UNLESS they are now unread in Inoreader (user changed their mind)
          if (deletedArticles.has(article.id)) {
            const isNowUnread = !article.categories?.includes(
              "user/-/state/com.google/read"
            );
            if (isNowUnread) {
              console.log(
                `[Sync] Re-importing article ${article.id} - now marked as unread in Inoreader`
              );
              // Remove from deletion tracking since user wants it back
              supabase
                .from("deleted_articles")
                .delete()
                .eq("inoreader_id", article.id)
                .then(() => {
                  console.log(
                    `[Sync] Removed ${article.id} from deletion tracking`
                  );
                });
              return hasValidFeed;
            } else {
              console.log(
                `[Sync] Skipping previously deleted article ${article.id}`
              );
              return false;
            }
          }

          return hasValidFeed;
        })
        .map((article: any) => {
          const feedInorId = article.origin?.streamId;
          const feedId = feedIdMap.get(feedInorId);

          return {
            feed_id: feedId,
            inoreader_id: article.id,
            title: decodeHtmlEntities(article.title) || "Untitled",
            author: article.author || null,
            content: decodeHtmlEntities(
              article.content?.content || article.summary?.content || ""
            ),
            url:
              article.canonical?.[0]?.href ||
              article.alternate?.[0]?.href ||
              "",
            published_at: article.published
              ? new Date(article.published * 1000).toISOString()
              : null,
            is_read:
              article.categories?.includes("user/-/state/com.google/read") ||
              false,
            is_starred:
              article.categories?.includes("user/-/state/com.google/starred") ||
              false,
            last_sync_update: syncTimestamp, // Mark as from sync
          };
        });

      if (articlesToUpsert.length > 0) {
        // Clear any pending sync queue items for these articles
        const inoreaderIds = articlesToUpsert.map((a: any) => a.inoreader_id);
        await supabase
          .from("sync_queue")
          .delete()
          .in("inoreader_id", inoreaderIds);

        // BIDIRECTIONAL SYNC CONFLICT RESOLUTION WITH DETECTION (RR-30)
        // ==============================================================
        // Get existing articles to check for local changes that need to be preserved.
        // We need to compare timestamps to avoid overwriting user actions made between syncs.
        const { data: existingArticles } = await supabase
          .from("articles")
          .select(
            "id, inoreader_id, feed_id, is_read, is_starred, last_local_update, last_sync_update, updated_at"
          )
          .in("inoreader_id", inoreaderIds);

        const existingMap = new Map(
          existingArticles?.map((a) => [a.inoreader_id, a]) || []
        );

        // Apply conflict resolution to preserve local changes
        const articlesWithConflictResolution = articlesToUpsert.map(
          (article: any) => {
            const existing = existingMap.get(article.inoreader_id);

            if (existing) {
              // Check if states differ (potential conflict)
              const statesDiffer =
                existing.is_read !== article.is_read ||
                existing.is_starred !== article.is_starred;

              if (existing.last_local_update) {
                // IMPORTANT: We compare last_local_update with last_sync_update (not current time)
                // This ensures we only preserve changes made AFTER the last sync from Inoreader.
                // Using current time would cause a race condition where all local changes would
                // always win, preventing Inoreader changes from ever being applied.
                const lastSyncTime =
                  existing.last_sync_update || existing.updated_at;

                if (
                  new Date(existing.last_local_update) > new Date(lastSyncTime)
                ) {
                  if (statesDiffer) {
                    // RR-30: Log conflict - local changes will be preserved
                    conflictDetector.detectConflict(existing, article, "local");
                    console.log(
                      `[Sync] Conflict detected for ${article.inoreader_id}: preserving local state`
                    );
                  }

                  // Local changes are newer than last sync - preserve local state
                  // This handles the case where user marked articles as read/starred
                  // between the last sync and now. Without this, their changes would
                  // be lost every time we sync from Inoreader.
                  return {
                    ...article,
                    is_read: existing.is_read,
                    is_starred: existing.is_starred,
                    // Update sync timestamp but keep local changes
                    last_sync_update: syncTimestamp,
                  };
                } else if (statesDiffer && existing.last_local_update) {
                  // Local changes exist but are older than last sync AND states differ
                  // This means remote wins but we should log the conflict
                  conflictDetector.detectConflict(existing, article, "remote");
                  console.log(
                    `[Sync] Conflict detected for ${article.inoreader_id}: applying remote state`
                  );
                }
              }
            }

            // No local changes or Inoreader state is newer - use Inoreader state
            // This is the normal case for articles that haven't been modified locally
            return article;
          }
        );

        // Batch insert in chunks
        const chunkSize = 50;
        for (
          let i = 0;
          i < articlesWithConflictResolution.length;
          i += chunkSize
        ) {
          const chunk = articlesWithConflictResolution.slice(i, i + chunkSize);
          const { data: upsertedArticles, error: upsertError } = await supabase
            .from("articles")
            .upsert(chunk, { onConflict: "inoreader_id" })
            .select("id, inoreader_id");

          if (upsertError) {
            console.error("[Sync] Error upserting articles:", upsertError);
          }

          status.progress =
            70 + Math.floor((i / articlesWithConflictResolution.length) * 20);
          await writeSyncStatus(syncId, status);
        }

        // RR-128: Extract and save tags for articles
        if (tagTypeMap.size > 0) {
          console.log("[Sync] Processing tags for articles...");

          // Get all unique tags from articles
          const allTags = new Set<string>();
          const articleTagAssociations: Array<{
            articleId: string;
            tagName: string;
          }> = [];

          for (const article of articles) {
            if (article.categories && Array.isArray(article.categories)) {
              for (const category of article.categories) {
                if (category.includes("/label/")) {
                  const labelName = category.replace(
                    /^user\/[^\/]*\/label\//,
                    ""
                  );
                  const tagType = tagTypeMap.get(labelName);

                  // Only process if it's explicitly a tag (not a folder)
                  if (tagType === "tag") {
                    allTags.add(labelName);
                    // Store association for later
                    articleTagAssociations.push({
                      articleId: article.id, // Inoreader ID
                      tagName: labelName,
                    });
                  }
                }
              }
            }
          }

          if (allTags.size > 0) {
            console.log(`[Sync] Found ${allTags.size} unique tags in articles`);

            // Upsert tags to database
            const tagsToUpsert = Array.from(allTags).map((tagName) => ({
              name: tagName,
              slug: tagName
                .toLowerCase()
                .replace(/[^\w\s-]/g, "")
                .replace(/[\s_-]+/g, "-")
                .replace(/^-+|-+$/g, ""),
              user_id: userId,
              article_count: 0, // Will be updated later
            }));

            const { data: upsertedTags, error: tagError } = await supabase
              .from("tags")
              .upsert(tagsToUpsert, { onConflict: "user_id,slug" })
              .select("id, name, slug");

            if (tagError) {
              console.error("[Sync] Error upserting tags:", tagError);
            } else if (upsertedTags) {
              console.log(`[Sync] Upserted ${upsertedTags.length} tags`);

              // Create tag name to ID map
              const tagIdMap = new Map(
                upsertedTags.map((tag) => [tag.name, tag.id])
              );

              // Get article IDs from database
              const inoreaderIds = articles.map((a) => a.id);
              const { data: dbArticles, error: articleLookupError } =
                await supabase
                  .from("articles")
                  .select("id, inoreader_id")
                  .in("inoreader_id", inoreaderIds);

              if (articleLookupError) {
                console.error(
                  "[Sync] Error looking up article IDs:",
                  articleLookupError
                );
              } else if (dbArticles) {
                // Create Inoreader ID to database ID map
                const articleIdMap = new Map(
                  dbArticles.map((a) => [a.inoreader_id, a.id])
                );

                // Create article-tag associations
                const associationsToInsert = articleTagAssociations
                  .map((assoc) => {
                    const articleId = articleIdMap.get(assoc.articleId);
                    const tagId = tagIdMap.get(assoc.tagName);
                    return articleId && tagId
                      ? { article_id: articleId, tag_id: tagId }
                      : null;
                  })
                  .filter((assoc) => assoc !== null);

                if (associationsToInsert.length > 0) {
                  // Batch insert associations
                  const assocChunkSize = 100;
                  for (
                    let i = 0;
                    i < associationsToInsert.length;
                    i += assocChunkSize
                  ) {
                    const assocChunk = associationsToInsert.slice(
                      i,
                      i + assocChunkSize
                    );
                    const { error: assocError } = await supabase
                      .from("article_tags")
                      .upsert(assocChunk, { onConflict: "article_id,tag_id" });

                    if (assocError) {
                      console.error(
                        "[Sync] Error creating article-tag associations:",
                        assocError
                      );
                    }
                  }

                  console.log(
                    `[Sync] Created ${associationsToInsert.length} article-tag associations`
                  );

                  // Update tag counts
                  const { error: updateCountError } =
                    await supabase.rpc("update_tag_counts");
                  if (updateCountError) {
                    console.error(
                      "[Sync] Error updating tag counts:",
                      updateCountError
                    );
                  } else {
                    console.log("[Sync] Updated tag counts");
                  }
                }
              }
            }
          }
        }
      }
    }

    status.progress = 90;
    status.message = "Refreshing feed statistics...";
    await writeSyncStatus(syncId, status);
    console.log("[Sync] Refreshing feed statistics...");

    // Refresh the materialized view for accurate unread counts
    try {
      const { error: refreshError } = await supabase.rpc("refresh_feed_stats");
      if (refreshError) {
        console.error("Failed to refresh feed stats:", refreshError);
        // Don't fail the sync if refresh fails - just log it
      } else {
        console.log("[Sync] Feed stats refreshed successfully");
      }
    } catch (error) {
      console.error("Error refreshing feed stats:", error);
      // Continue with sync completion even if refresh fails
    }

    // RR-162 & RR-176: Automatic full content fetching during sync has been removed
    // Auto-fetch is now only triggered on user navigation for partial feeds (RR-148)

    status.progress = 95;
    status.message = "Updating sync metadata...";
    await writeSyncStatus(syncId, status);
    console.log("[Sync] Updating sync metadata...");

    // Update sync metadata
    await supabase.from("sync_metadata").upsert(
      {
        key: "last_sync_time",
        value: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    // RR-149: Update incremental sync timestamp for next sync
    await supabase.from("sync_metadata").upsert(
      {
        key: "last_incremental_sync_timestamp",
        value: currentTimestamp.toString(),
      },
      { onConflict: "key" }
    );

    // Track API usage (approximately 4-5 calls per sync)
    await trackApiUsage("inoreader", 4);

    // RR-30: Write conflict log before completing sync
    status.progress = 97;
    status.message = "Logging sync conflicts...";
    await writeSyncStatus(syncId, status);

    const conflictSummary = conflictDetector.getSummary();
    if (conflictSummary.totalConflicts > 0) {
      await conflictDetector.writeConflicts();
      console.log(
        `[Sync] Detected ${conflictSummary.totalConflicts} conflicts:`
      );
      console.log(conflictDetector.generateReport());
    }

    // RR-129: Clean up read articles with tracking
    status.progress = 98;
    status.message = "Cleaning up read articles...";
    await writeSyncStatus(syncId, status);
    console.log("[Sync] Cleaning up read articles with tracking...");

    try {
      const articleCleanupResult =
        await cleanupService.cleanupReadArticles(userId);
      if (articleCleanupResult.readArticlesDeleted > 0) {
        console.log(
          `[Sync] Deleted ${articleCleanupResult.readArticlesDeleted} read articles, tracked ${articleCleanupResult.trackingEntriesCreated} deletions`
        );
      }
      if (articleCleanupResult.errors.length > 0) {
        console.error("[Sync] Cleanup errors:", articleCleanupResult.errors);
      }

      // RR-149: Enforce article retention limit
      const retentionLimit = process.env.ARTICLES_RETENTION_LIMIT
        ? parseInt(process.env.ARTICLES_RETENTION_LIMIT)
        : 1000;

      const retentionResult = await cleanupService.enforceRetentionLimit(
        userId,
        retentionLimit
      );
      if (retentionResult.deletedCount > 0) {
        console.log(
          `[Sync] Enforced retention limit: deleted ${retentionResult.deletedCount} articles in ${retentionResult.chunksProcessed} chunks`
        );
      }
    } catch (error) {
      console.error("[Sync] Error cleaning up read articles:", error);
      // Don't fail the sync if cleanup fails
    }

    // Trigger bidirectional sync to push local changes to Inoreader
    status.progress = 99;
    status.message = "Syncing local changes to Inoreader...";
    await writeSyncStatus(syncId, status);
    console.log("[Sync] Triggering bidirectional sync...");

    try {
      const syncServerUrl =
        process.env.SYNC_SERVER_URL || "http://localhost:3001";
      const syncResponse = await fetch(`${syncServerUrl}/server/sync/trigger`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify({ force: true }), // Force sync even if < 5 changes
      });

      if (syncResponse.ok) {
        console.log("[Sync] Bidirectional sync triggered successfully");
      } else {
        console.error(
          "[Sync] Failed to trigger bidirectional sync:",
          await syncResponse.text()
        );
      }
    } catch (error) {
      console.error("[Sync] Error triggering bidirectional sync:", error);
      // Don't fail the main sync if bidirectional sync fails
    }

    // RR-171: Calculate sync metrics
    const metrics = {
      newArticles: articles.length, // This is approximate, should track actual inserts
      deletedArticles: 0, // Track deletions if implemented
      newTags: 0, // Count new tags added during sync
      failedFeeds: 0, // Track failed feed fetches
    };

    // RR-171: Gather sidebar data for immediate UI update
    const sidebarData = await gatherSidebarData();

    // Complete with metrics and sidebar data
    status.status = "completed";
    status.progress = 100;
    status.metrics = metrics;
    if (sidebarData) {
      status.sidebar = sidebarData;
    }
    const conflictMessage =
      conflictSummary.totalConflicts > 0
        ? ` Detected ${conflictSummary.totalConflicts} conflicts.`
        : "";
    status.message = `Sync completed. Synced ${subscriptions.length} feeds and ${articles.length} articles.${conflictMessage}`;
    await writeSyncStatus(syncId, status);

    // Schedule file cleanup after 60 seconds to ensure clients can read final status
    setTimeout(async () => {
      try {
        const filePath = getSyncStatusPath(syncId);
        await fs.unlink(filePath);
        console.log(
          `[Sync] Cleaned up completed sync file after delay: ${syncId}`
        );
      } catch (error) {
        // File might already be cleaned up, which is fine
        console.log(`[Sync] File cleanup skipped (already removed): ${syncId}`);
      }
    }, 60000); // 60 seconds delay
  } catch (error) {
    console.error("Sync error:", error);
    status.status = "failed";
    status.error = error instanceof Error ? error.message : "Unknown error";
    await writeSyncStatus(syncId, status);

    // Schedule file cleanup after 60 seconds for failed syncs too
    setTimeout(async () => {
      try {
        const filePath = getSyncStatusPath(syncId);
        await fs.unlink(filePath);
        console.log(
          `[Sync] Cleaned up failed sync file after delay: ${syncId}`
        );
      } catch (error) {
        // File might already be cleaned up, which is fine
        console.log(`[Sync] File cleanup skipped (already removed): ${syncId}`);
      }
    }, 60000); // 60 seconds delay

    throw error;
  }
}

// Check rate limit for Inoreader API
async function checkRateLimit() {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("api_usage")
    .select("count")
    .eq("service", "inoreader")
    .eq("date", today)
    .single();

  if (error && error.code !== "PGRST116") {
    // Not found error is ok
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: 100, used: 0, limit: 100 };
  }

  const used = data?.count || 0;
  const limit = 100;
  const remaining = limit - used;

  // Warn at 80% and 95%
  if (remaining <= 20 && remaining > 5) {
    console.warn(
      `Inoreader API rate limit warning: ${remaining} calls remaining today`
    );
  } else if (remaining <= 5) {
    console.error(
      `Inoreader API rate limit critical: Only ${remaining} calls remaining today`
    );
  }

  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit,
  };
}

// Track API usage - RR-237: Updated to use ApiUsageTracker
async function trackApiUsage(service: string, count: number = 1) {
  const tracker = new ApiUsageTracker(supabase);
  const result = await tracker.trackUsageWithFallback({
    service,
    increment: count,
  });

  if (!result.success) {
    console.error("Failed to track API usage:", result.error);
  }
}
// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
