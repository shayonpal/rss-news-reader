import { create } from "zustand";
import { supabase } from "@/lib/db/supabase";
import { useSyncStore } from "./sync-store";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";
import type { Article, ArticleState, Summary } from "@/types";
import type { Database } from "@/lib/db/types";

interface ArticleStoreState {
  // Article data
  articles: Map<string, Article>;
  loadingArticles: boolean;
  articlesError: string | null;
  summarizingArticles: Set<string>; // Track which articles are being summarized

  // Selection and filters
  selectedFeedId: string | null;
  selectedFolderId: string | null;
  selectedArticleId: string | null;
  readStatusFilter: "all" | "unread" | "read";
  filter: "all" | "unread" | "starred"; // Legacy filter - keeping for starred

  // Pagination
  hasMore: boolean;
  loadingMore: boolean;

  // Navigation state (RR-27)
  navigatingToArticle: boolean;
  loadSeq: number; // <-- ADD THIS

  // Actions
  loadArticles: (
    feedId?: string,
    folderId?: string,
    tagId?: string
  ) => Promise<void>;
  loadMoreArticles: () => Promise<void>;
  getArticle: (id: string) => Promise<Article | null>;

  // Article operations
  markAsRead: (articleId: string) => Promise<void>;
  markAsUnread: (articleId: string) => Promise<void>;
  toggleStar: (articleId: string) => Promise<void>;
  markMultipleAsRead: (articleIds: string[]) => Promise<void>;

  // Summary operations
  generateSummary: (
    articleId: string,
    regenerate?: boolean
  ) => Promise<Summary | null>;
  getSummary: (articleId: string) => Promise<Summary | null>;

  // Batch operations
  markAllAsRead: (feedId?: string) => Promise<void>;
  markAllAsReadForTag: (tagId: string) => Promise<void>; // RR-179: Tag context support
  refreshArticles: () => Promise<void>;

  // Selection
  setSelectedFeed: (feedId: string | null) => void;
  setSelectedFolder: (folderId: string | null) => void;
  setSelectedArticle: (articleId: string | null) => void;
  setFilter: (filter: "all" | "unread" | "starred") => void;
  setReadStatusFilter: (filter: "all" | "unread" | "read") => void;

  // Navigation actions (RR-27)
  setNavigatingToArticle: (isNavigating: boolean) => void;

  // Utility
  clearError: () => void;
  getArticleCount: () => { total: number; unread: number };
}

// RR-197: localStorage optimization imports
import { localStorageStateManager } from "@/lib/utils/localstorage-state-manager";
import { articleCounterManager } from "@/lib/utils/article-counter-manager";
import { performanceMonitor } from "@/lib/utils/performance-monitor";
const ARTICLES_PER_PAGE = 50;

// Context for mark-as-read operations
interface MarkAsReadContext {
  feedId?: string;
  folderId?: string;
  currentView: "all" | "feed" | "folder";
  filterMode: "all" | "unread" | "read";
}

// Get initial read status filter from localStorage (client-side only)
const getInitialReadStatusFilter = (): "all" | "unread" | "read" => {
  // Always return default during SSR
  return "unread"; // Default to unread only
};

// Centralized function for all mark-as-read operations
async function markArticlesAsReadWithSession(
  articleIds: string[],
  articles: Map<string, Article>,
  context: MarkAsReadContext,
  markType: "manual" | "auto" | "bulk",
  updateDatabase: (ids: string[]) => Promise<void>,
  updateStore: (updatedArticles: Map<string, Article>) => void
): Promise<void> {
  if (articleIds.length === 0) return;

  try {
    // 1. Update database
    await updateDatabase(articleIds);

    // 2. Update store
    const updatedArticles = new Map(articles);
    articleIds.forEach((id) => {
      const article = updatedArticles.get(id);
      if (article) {
        updatedArticles.set(id, { ...article, isRead: true });
      }
    });
    updateStore(updatedArticles);

    // 3. Ensure session state exists with proper context
    let state = articleListStateManager.getListState();

    // Create new state if none exists
    if (!state) {
      state = {
        articleIds: [],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: context.filterMode,
        feedId: context.feedId,
        folderId: context.folderId,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(), // 30 minutes from now
      };
    }

    // 4. Add articles to appropriate session arrays based on markType
    // Update session state
    if (markType === "auto") {
      state.autoReadArticles = [
        ...new Set([...state.autoReadArticles, ...articleIds]),
      ];
    } else {
      state.manualReadArticles = [
        ...new Set([...state.manualReadArticles, ...articleIds]),
      ];
    }

    // Limit session state to prevent unbounded growth
    const MAX_SESSION_ARTICLES = 50;
    if (state.autoReadArticles.length > MAX_SESSION_ARTICLES) {
      state.autoReadArticles =
        state.autoReadArticles.slice(-MAX_SESSION_ARTICLES);
    }
    if (state.manualReadArticles.length > MAX_SESSION_ARTICLES) {
      state.manualReadArticles =
        state.manualReadArticles.slice(-MAX_SESSION_ARTICLES);
    }

    // Update read states - only keep states for articles we're tracking
    const trackedArticles = new Set([
      ...state.autoReadArticles,
      ...state.manualReadArticles,
    ]);
    const newReadStates: Record<string, boolean> = {};
    trackedArticles.forEach((id) => {
      newReadStates[id] = true;
    });
    articleIds.forEach((id) => {
      newReadStates[id] = true;
    });
    state.readStates = newReadStates;

    // Don't update context if state already exists - preserve the original view context
    // Only set context when creating new state (handled above)

    // Save updated session state
    articleListStateManager.saveListState(state);

    // 5. Also store article IDs separately for the hybrid query
    // This ensures they can be loaded from the database even when filtered
    const allPreservedIds = [
      ...new Set([
        ...(state.autoReadArticles || []),
        ...(state.manualReadArticles || []),
      ]),
    ];

    if (allPreservedIds.length > 0) {
      try {
        // Store with timestamps for expiry management
        const preservedWithTimestamps = allPreservedIds.map((id) => ({
          id,
          timestamp: Date.now(),
        }));

        // Get existing preserved IDs
        const existingPreserved = sessionStorage.getItem(
          "preserved_article_ids"
        );
        let allPreserved = preservedWithTimestamps;

        if (existingPreserved) {
          const parsed = JSON.parse(existingPreserved);
          // Merge with existing, keeping newer timestamps
          const existingMap = new Map(
            parsed.map((item: any) => [
              typeof item === "string" ? item : item.id,
              typeof item === "string"
                ? { id: item, timestamp: Date.now() }
                : item,
            ])
          );

          // Add new items
          preservedWithTimestamps.forEach((item) => {
            existingMap.set(item.id, item);
          });

          allPreserved = Array.from(existingMap.values()) as {
            id: string;
            timestamp: number;
          }[];
        }

        // Clean up old entries (>30 minutes) and limit to 50 most recent
        const now = Date.now();
        const validPreserved = allPreserved
          .filter((item: any) => {
            const timestamp = typeof item === "string" ? now : item.timestamp;
            return now - timestamp < 30 * 60 * 1000;
          })
          .sort((a: any, b: any) => {
            const aTime = typeof a === "string" ? 0 : a.timestamp;
            const bTime = typeof b === "string" ? 0 : b.timestamp;
            return bTime - aTime;
          })
          .slice(0, 50);

        sessionStorage.setItem(
          "preserved_article_ids",
          JSON.stringify(validPreserved)
        );
        console.log(
          `💾 Stored ${validPreserved.length} preserved article IDs for hybrid query`
        );
      } catch (e) {
        console.error("Failed to store preserved article IDs:", e);
      }
    }
  } catch (error) {
    console.error("Failed to mark articles as read with session:", error);
    throw error;
  }
}

export const useArticleStore = create<ArticleStoreState>((set, get) => ({
  // Initial state
  articles: new Map(),
  loadingArticles: false,
  articlesError: null,
  summarizingArticles: new Set(),
  selectedFeedId: null,
  selectedFolderId: null,
  selectedArticleId: null,
  readStatusFilter: getInitialReadStatusFilter(),
  filter: "all",
  hasMore: true,
  loadingMore: false,

  // Navigation state (RR-27)
  navigatingToArticle: false,
  loadSeq: 0, // <-- ADD THIS

  // Load articles with pagination
  loadArticles: async (feedId?: string, folderId?: string, tagId?: string) => {
    const seq = get().loadSeq + 1; // <-- Capture sequence at start
    set({ loadingArticles: true, articlesError: null, loadSeq: seq }); // <-- Increment sequence

    try {
      let query = supabase
        .from("articles")
        .select(
          `
          *,
          feed:feeds(*)
        `
        )
        .order("published_at", { ascending: false });

      // Apply feed/folder filter
      if (feedId) {
        query = query.eq("feed_id", feedId);
      } else if (folderId) {
        // Get all feeds in folder first
        const { data: feeds } = await supabase
          .from("feeds")
          .select("id")
          .eq("folder_id", folderId);

        const feedIds = feeds?.map((f) => f.id) || [];
        if (feedIds.length > 0) {
          query = query.in("feed_id", feedIds);
        }
      }

      // Apply read status filter
      const readStatusFilter = get().readStatusFilter;

      // Get preserved article IDs for hybrid query
      const getPreservedArticleIds = (): string[] => {
        try {
          // First check the dedicated preserved IDs storage
          const preservedIds = sessionStorage.getItem("preserved_article_ids");
          if (preservedIds) {
            const parsed = JSON.parse(preservedIds);
            // Clean up expired IDs (older than 30 minutes)
            const now = Date.now();
            const validIds = parsed
              .filter((item: any) => {
                if (typeof item === "string") return true; // Legacy format
                return item.timestamp && now - item.timestamp < 30 * 60 * 1000;
              })
              .map((item: any) => (typeof item === "string" ? item : item.id));
            return validIds;
          }

          // Fallback: extract from session state
          const state = sessionStorage.getItem("rss_reader_list_state");
          if (!state) return [];
          const parsed = JSON.parse(state);
          const isNotExpired =
            parsed.expiresAt && new Date(parsed.expiresAt) > new Date();
          if (!isNotExpired) return [];

          // Combine auto-read and manual-read articles
          const allPreserved = [
            ...(parsed.autoReadArticles || []),
            ...(parsed.manualReadArticles || []),
          ];
          return [...new Set(allPreserved)]; // Remove duplicates
        } catch {
          return [];
        }
      };

      const preservedArticleIds = getPreservedArticleIds();
      const hasPreservedArticles = preservedArticleIds.length > 0;

      // Apply hybrid query for unread filter with preserved articles
      console.log(
        `📊 Database query - preservedArticles: ${preservedArticleIds.length}, readStatusFilter: ${readStatusFilter}`
      );

      if (readStatusFilter === "unread" && hasPreservedArticles) {
        // Hybrid query: load unread articles + specific preserved read articles
        // Use Supabase's OR operator for optimal performance
        query = query.or(
          `is_read.eq.false,id.in.(${preservedArticleIds.join(",")})`
        );
        console.log(
          `🔀 Using hybrid query: unread + ${preservedArticleIds.length} preserved articles`
        );
      } else if (readStatusFilter === "unread") {
        // Standard unread filter
        query = query.eq("is_read", false);
      } else if (readStatusFilter === "read") {
        // Standard read filter
        query = query.eq("is_read", true);
      }
      // For "all" filter, no filtering needed

      // Apply starred filter (legacy filter - only for starred)
      const filter = get().filter;
      if (filter === "starred") {
        query = query.eq("is_starred", true);
      }

      // Apply tag filter
      if (tagId) {
        // Filter articles that have this tag through the article_tags junction table
        const { data: taggedArticles } = await supabase
          .from("article_tags")
          .select("article_id")
          .eq("tag_id", tagId);

        const articleIds = taggedArticles?.map((at) => at.article_id) || [];
        if (articleIds.length > 0) {
          query = query.in("id", articleIds);
        } else {
          // No articles with this tag, return empty result
          if (get().loadSeq !== seq) {
            // <-- THE CRITICAL CHECK
            console.log(
              `↩️ Stale request (seq: ${seq}) ignored on empty tag result.`
            );
            return;
          }
          set({
            articles: new Map(),
            hasMore: false,
            loadingArticles: false,
            selectedFeedId: feedId || null,
            selectedFolderId: folderId || null,
          });
          return;
        }
      }

      // Limit results
      query = query.limit(ARTICLES_PER_PAGE);

      const { data: articles, error } = await query;

      if (get().loadSeq !== seq) {
        // <-- THE CRITICAL CHECK
        console.log(`↩️ Stale request (seq: ${seq}) ignored.`);
        return;
      }

      if (error) throw error;

      const articlesMap = new Map<string, Article>();
      articles?.forEach((article) => {
        articlesMap.set(article.id, {
          id: article.id,
          feedId: article.feed_id || "",
          title: article.title || "Untitled",
          content: article.content || "",
          url: article.url || "",
          tags: article.is_starred ? ["starred"] : [],
          publishedAt: new Date(article.published_at || Date.now()),
          author: article.author || undefined,
          authorName: article.author || "", // Keep for backwards compatibility
          isRead: article.is_read || false,
          createdAt: new Date(article.created_at || Date.now()),
          updatedAt: new Date(article.updated_at || Date.now()),
          inoreaderItemId: article.inoreader_id,
          fullContentUrl: article.url,
          hasFullContent: article.has_full_content || false,
          fullContent: article.full_content || undefined,
          summary: article.ai_summary || undefined,
          isPartial: false,
          feedTitle: (article as any).feed?.title || "",
        });
      });

      set({
        articles: articlesMap,
        loadingArticles: false,
        hasMore: (articles?.length || 0) === ARTICLES_PER_PAGE,
        selectedFeedId: feedId || null,
        selectedFolderId: folderId || null,
      });
    } catch (error) {
      if (get().loadSeq !== seq) {
        // <-- ALSO CHECK IN CATCH BLOCK
        console.log(`↩️ Stale request (seq: ${seq}) ignored on error.`);
        return;
      }
      console.error("Failed to load articles:", error);
      set({
        loadingArticles: false,
        articlesError: `Failed to load articles: ${error}`,
      });
    }
  },

  // Load more articles (pagination)
  loadMoreArticles: async () => {
    const {
      loadingMore,
      hasMore,
      articles,
      selectedFeedId,
      selectedFolderId,
      readStatusFilter,
      filter,
    } = get();

    if (loadingMore || !hasMore) return;

    set({ loadingMore: true });

    try {
      // Get the oldest article date from current set
      const articleArray = Array.from(articles.values());
      const oldestDate = articleArray[articleArray.length - 1]?.publishedAt;

      if (!oldestDate) {
        set({ loadingMore: false, hasMore: false });
        return;
      }

      let query = supabase
        .from("articles")
        .select(
          `
          *,
          feed:feeds(*)
        `
        )
        .order("published_at", { ascending: false })
        .lt("published_at", oldestDate.toISOString());

      // Apply filters
      if (selectedFeedId) {
        query = query.eq("feed_id", selectedFeedId);
      } else if (selectedFolderId) {
        const { data: feeds } = await supabase
          .from("feeds")
          .select("id")
          .eq("folder_id", selectedFolderId);

        const feedIds = feeds?.map((f) => f.id) || [];
        if (feedIds.length > 0) {
          query = query.in("feed_id", feedIds);
        }
      }

      // Apply read status filter with hybrid query support
      // Get preserved article IDs for hybrid query (same logic as loadArticles)
      const getPreservedArticleIds = (): string[] => {
        try {
          // First check the dedicated preserved IDs storage
          const preservedIds = sessionStorage.getItem("preserved_article_ids");
          if (preservedIds) {
            const parsed = JSON.parse(preservedIds);
            // Clean up expired IDs (older than 30 minutes)
            const now = Date.now();
            const validIds = parsed
              .filter((item: any) => {
                if (typeof item === "string") return true; // Legacy format
                return item.timestamp && now - item.timestamp < 30 * 60 * 1000;
              })
              .map((item: any) => (typeof item === "string" ? item : item.id));
            return validIds;
          }

          // Fallback: extract from session state
          const state = sessionStorage.getItem("rss_reader_list_state");
          if (!state) return [];
          const parsed = JSON.parse(state);
          const isNotExpired =
            parsed.expiresAt && new Date(parsed.expiresAt) > new Date();
          if (!isNotExpired) return [];

          // Combine auto-read and manual-read articles
          const allPreserved = [
            ...(parsed.autoReadArticles || []),
            ...(parsed.manualReadArticles || []),
          ];
          return [...new Set(allPreserved)]; // Remove duplicates
        } catch {
          return [];
        }
      };

      const preservedArticleIds = getPreservedArticleIds();
      const hasPreservedArticles = preservedArticleIds.length > 0;

      if (readStatusFilter === "unread" && hasPreservedArticles) {
        // Hybrid query for pagination: unread + preserved articles
        query = query.or(
          `is_read.eq.false,id.in.(${preservedArticleIds.join(",")})`
        );
      } else if (readStatusFilter === "unread") {
        query = query.eq("is_read", false);
      } else if (readStatusFilter === "read") {
        query = query.eq("is_read", true);
      }

      // Apply starred filter
      if (filter === "starred") {
        query = query.eq("is_starred", true);
      }

      query = query.limit(ARTICLES_PER_PAGE);

      const { data: moreArticles, error } = await query;

      if (error) throw error;

      // Merge with existing articles
      const updatedArticles = new Map(articles);
      moreArticles?.forEach((article) => {
        updatedArticles.set(article.id, {
          id: article.id,
          feedId: article.feed_id || "",
          title: article.title || "Untitled",
          content: article.content || "",
          url: article.url || "",
          tags: article.is_starred ? ["starred"] : [],
          publishedAt: new Date(article.published_at || Date.now()),
          author: article.author || undefined,
          authorName: article.author || "", // Keep for backwards compatibility
          isRead: article.is_read || false,
          createdAt: new Date(article.created_at || Date.now()),
          updatedAt: new Date(article.updated_at || Date.now()),
          inoreaderItemId: article.inoreader_id,
          fullContentUrl: article.url,
          hasFullContent: article.has_full_content || false,
          fullContent: article.full_content || undefined,
          summary: article.ai_summary || undefined,
          isPartial: false,
          feedTitle: (article as any).feed?.title || "",
        });
      });

      set({
        articles: updatedArticles,
        loadingMore: false,
        hasMore: (moreArticles?.length || 0) === ARTICLES_PER_PAGE,
      });
    } catch (error) {
      console.error("Failed to load more articles:", error);
      set({ loadingMore: false });
    }
  },

  // Get single article
  getArticle: async (id: string) => {
    try {
      const { data: article, error } = await supabase
        .from("articles")
        .select(`*, feed:feeds(*)`)
        .eq("id", id)
        .single();

      if (error) throw error;

      if (article) {
        const articleObj: Article = {
          id: article.id,
          feedId: article.feed_id || "",
          title: article.title || "Untitled",
          content: article.content || "",
          url: article.url || "",
          tags: article.is_starred ? ["starred"] : [],
          publishedAt: new Date(article.published_at || Date.now()),
          author: article.author || undefined,
          authorName: article.author || "", // Keep for backwards compatibility
          isRead: article.is_read || false,
          createdAt: new Date(article.created_at || Date.now()),
          updatedAt: new Date(article.updated_at || Date.now()),
          inoreaderItemId: article.inoreader_id,
          fullContentUrl: article.url,
          hasFullContent: article.has_full_content || false,
          fullContent: article.full_content || undefined,
          summary: article.ai_summary || undefined,
          isPartial: false,
          feedTitle: (article as any).feed?.title || "",
        };

        // Update in store if loaded
        const { articles } = get();
        const updatedArticles = new Map(articles);
        updatedArticles.set(id, articleObj);
        set({ articles: updatedArticles });

        return articleObj;
      }
      return null;
    } catch (error) {
      console.error("Failed to get article:", error);
      return null;
    }
  },

  // Mark as read
  markAsRead: async (articleId: string) => {
    // RR-197: Route single article marking through markMultipleAsRead to avoid duplicate localStorage operations
    console.log(
      `[RR-197] Single markAsRead routing to markMultipleAsRead for consistency`
    );
    return get().markMultipleAsRead([articleId]);
  },

  // Mark multiple as read (batch operation)
  markMultipleAsRead: async (articleIds: string[]) => {
    if (articleIds.length === 0) return;

    try {
      const { articles, selectedFeedId, selectedFolderId, readStatusFilter } =
        get();

      // Filter out articles that are already read
      const articlesToMark = articleIds.filter((id) => {
        const article = articles.get(id);
        return article && !article.isRead;
      });

      if (articlesToMark.length === 0) return;

      // RR-197: Immediate localStorage optimization for instant UI feedback
      const articlesWithFeeds = articlesToMark
        .map((id) => {
          const article = articles.get(id);
          return { articleId: id, feedId: article?.feedId || "" };
        })
        .filter((item) => item.feedId);

      if (articlesWithFeeds.length > 0) {
        // Apply immediate localStorage updates for instant UI feedback
        await localStorageStateManager.batchMarkArticlesRead(articlesWithFeeds);

        // RR-197: Trigger immediate sidebar counter updates
        const { useFeedStore } = await import("./feed-store");
        useFeedStore.getState().applyLocalStorageCounterUpdates();
      }

      // Update local state immediately for UI responsiveness
      const updatedArticles = new Map(articles);
      articlesToMark.forEach((id) => {
        const article = updatedArticles.get(id);
        if (article) {
          updatedArticles.set(id, { ...article, isRead: true });
        }
      });
      set({ articles: updatedArticles });

      // Define database update function (preserves existing 500ms batching)
      const updateDatabase = async (ids: string[]) => {
        const timestamp = new Date().toISOString();
        const { error } = await supabase
          .from("articles")
          .update({
            is_read: true,
            last_local_update: timestamp,
            updated_at: timestamp,
          })
          .in("id", ids);

        if (error) throw error;

        // Add to sync queue for bi-directional sync
        for (const id of ids) {
          const article = articles.get(id);
          if (article?.inoreaderItemId) {
            const { error: rpcError } = await supabase.rpc(
              "add_to_sync_queue",
              {
                p_article_id: id,
                p_inoreader_id: article.inoreaderItemId,
                p_action_type: "read",
              }
            );

            if (rpcError) {
              console.error("Failed to add to sync queue:", rpcError);
            }
          }
        }

        // RR-197: Clear localStorage queue after successful database sync
        const queueEntries = articlesToMark
          .map((id) => {
            const article = articles.get(id);
            return article?.feedId
              ? { articleId: id, feedId: article.feedId }
              : null;
          })
          .filter(Boolean);

        // Clear processed entries from localStorage
        if (queueEntries.length > 0) {
          queueEntries.forEach((entry) => {
            if (entry) {
              // Individual cleanup happens automatically in the utilities
            }
          });
        }
      };

      // Define store update function (now just confirms localStorage updates)
      const updateStore = (updatedArticles: Map<string, Article>) => {
        set({ articles: updatedArticles });
      };

      // Determine context - infer from first article if needed
      const firstArticle = articles.get(articlesToMark[0]);
      const context: MarkAsReadContext = {
        feedId: selectedFeedId || firstArticle?.feedId,
        folderId: selectedFolderId || undefined,
        currentView: selectedFeedId
          ? "feed"
          : selectedFolderId
            ? "folder"
            : "all",
        filterMode: readStatusFilter,
      };

      // Use centralized function - preserves existing 500ms database batching
      await markArticlesAsReadWithSession(
        articlesToMark,
        updatedArticles, // Pass updated articles with immediate changes
        context,
        "auto", // markMultipleAsRead is typically used for auto-mark-as-read
        updateDatabase,
        updateStore
      );

      // RR-163: Optimistically update unread count for selected tag by the number of articles auto-marked
      try {
        const { useTagStore } = await import("./tag-store");
        const tagState = useTagStore.getState();
        if (tagState.selectedTagIds.size === 1) {
          tagState.updateSelectedTagUnreadCount(-articlesToMark.length);
        }
      } catch (e) {
        console.warn(
          "[Articles] Failed to optimistically update tag unread count (batch):",
          e
        );
      }

      // Invalidate article count cache (now handled by articleCounterManager)
      if (
        typeof window !== "undefined" &&
        (window as any).__articleCountManager &&
        firstArticle?.feedId
      ) {
        (window as any).__articleCountManager.invalidateCache(
          firstArticle.feedId
        );
      }

      // Invalidate article count cache for affected feeds (legacy support)
      if (
        typeof window !== "undefined" &&
        (window as any).__articleCountManager
      ) {
        const affectedFeeds = new Set<string>();
        articlesToMark.forEach((id) => {
          const article = articles.get(id);
          if (article) {
            affectedFeeds.add(article.feedId);
          }
        });
        affectedFeeds.forEach((feedId) => {
          (window as any).__articleCountManager.invalidateCache(feedId);
        });
      }

      // RR-197: Also invalidate our new counter manager
      articlesToMark.forEach((id) => {
        const article = articles.get(id);
        if (article?.feedId) {
          articleCounterManager.invalidateCache(article.feedId);
        }
      });

      console.log(
        `[RR-197] Marked ${articlesToMark.length} articles as read with localStorage optimization`
      );
    } catch (error) {
      console.error("Failed to mark multiple as read:", error);

      // RR-197: On error, try emergency fallback
      try {
        localStorageStateManager.emergencyReset();
        console.warn(
          "[RR-197] Applied emergency localStorage reset due to error"
        );
      } catch (resetError) {
        console.error("[RR-197] Emergency reset also failed:", resetError);
      }
    }
  },

  // Mark as unread
  markAsUnread: async (articleId: string) => {
    try {
      const { articles } = get();
      const article = articles.get(articleId);
      if (!article || !article.isRead) return;

      const timestamp = new Date().toISOString();

      // Update in database with local update timestamp
      const { error } = await supabase
        .from("articles")
        .update({
          is_read: false,
          last_local_update: timestamp,
          updated_at: timestamp,
        })
        .eq("id", articleId);

      if (error) throw error;

      // Add to sync queue for bi-directional sync
      if (article.inoreaderItemId) {
        const { error: rpcError } = await supabase.rpc("add_to_sync_queue", {
          p_article_id: articleId,
          p_inoreader_id: article.inoreaderItemId,
          p_action_type: "unread",
        });

        if (rpcError) {
          console.error("Failed to add to sync queue:", rpcError);
        }
      }

      // Update in store
      const updatedArticles = new Map(articles);
      updatedArticles.set(articleId, { ...article, isRead: false });
      set({ articles: updatedArticles });

      // Invalidate article count cache
      if (
        typeof window !== "undefined" &&
        (window as any).__articleCountManager
      ) {
        (window as any).__articleCountManager.invalidateCache(article.feedId);
      }

      // Queue for sync if offline (legacy offline queue)
      const syncStore = useSyncStore.getState();
      if (!navigator.onLine) {
        syncStore.addToQueue({
          type: "mark_unread",
          articleId,
          maxRetries: 3,
        });
      }
    } catch (error) {
      console.error("Failed to mark as unread:", error);
    }
  },

  // Toggle star
  toggleStar: async (articleId: string) => {
    try {
      const { articles } = get();
      const article = articles.get(articleId);
      if (!article) return;

      const tags = article.tags || [];
      const isStarred = tags.includes("starred");
      const updatedTags = isStarred
        ? tags.filter((tag) => tag !== "starred")
        : [...tags, "starred"];

      const timestamp = new Date().toISOString();

      // Update in database with local update timestamp
      const { error } = await supabase
        .from("articles")
        .update({
          is_starred: !isStarred,
          last_local_update: timestamp,
          updated_at: timestamp,
        })
        .eq("id", articleId);

      if (error) throw error;

      // Add to sync queue for bi-directional sync
      if (article.inoreaderItemId) {
        const { error: rpcError } = await supabase.rpc("add_to_sync_queue", {
          p_article_id: articleId,
          p_inoreader_id: article.inoreaderItemId,
          p_action_type: isStarred ? "unstar" : "star",
        });

        if (rpcError) {
          console.error("Failed to add to sync queue:", rpcError);
        }
      }

      // Update in store
      const updatedArticles = new Map(articles);
      updatedArticles.set(articleId, { ...article, tags: updatedTags });
      set({ articles: updatedArticles });

      // Queue for sync if offline (legacy offline queue)
      const syncStore = useSyncStore.getState();
      if (!navigator.onLine) {
        syncStore.addToQueue({
          type: isStarred ? "unstar" : "star",
          articleId,
          maxRetries: 3,
        });
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  },

  // Generate summary
  generateSummary: async (articleId: string, regenerate: boolean = false) => {
    const { summarizingArticles } = get();
    const updatedSummarizingArticles = new Set(summarizingArticles);
    updatedSummarizingArticles.add(articleId);
    set({ summarizingArticles: updatedSummarizingArticles });

    try {
      const response = await fetch(
        `/reader/api/articles/${articleId}/summarize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ regenerate }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate summary");
      }

      const result = await response.json();

      // Siri's Fix: Refresh full article from database after summarization
      // This ensures we get updated hasFullContent and fullContent fields
      const { getArticle } = get();
      const refreshedArticle = await getArticle(articleId);

      if (refreshedArticle) {
        // Update store with refreshed article data (includes full content + summary)
        const { articles } = get();
        const updatedArticles = new Map(articles);
        updatedArticles.set(articleId, refreshedArticle);
        set({ articles: updatedArticles });
      } else {
        // Fallback: Update just the summary if refresh fails
        const { articles } = get();
        const article = articles.get(articleId);
        if (article) {
          const updatedArticles = new Map(articles);
          updatedArticles.set(articleId, {
            ...article,
            summary: result.summary,
          });
          set({ articles: updatedArticles });
        }
      }

      return {
        id: articleId,
        articleId,
        content: result.summary,
        wordCount: result.summary.split(" ").length,
        generatedAt: new Date(),
        model: result.model || "claude-sonnet-4-20250514",
        isRegenerated: regenerate,
      } as Summary;
    } catch (error) {
      console.error("Failed to generate summary:", error);
      throw error;
    } finally {
      // Remove from summarizing set
      const { summarizingArticles } = get();
      const updatedSummarizingArticles = new Set(summarizingArticles);
      updatedSummarizingArticles.delete(articleId);
      set({ summarizingArticles: updatedSummarizingArticles });
    }
  },

  // Get summary
  getSummary: async (articleId: string) => {
    try {
      const { data: article, error } = await supabase
        .from("articles")
        .select("ai_summary")
        .eq("id", articleId)
        .single();

      if (error) throw error;

      if (article?.ai_summary) {
        return {
          id: articleId,
          articleId,
          content: article.ai_summary,
          wordCount: article.ai_summary.split(" ").length,
          generatedAt: new Date(),
          model: "claude-sonnet-4-20250514",
          isRegenerated: false,
        } as Summary;
      }
      return null;
    } catch (error) {
      console.error("Failed to get summary:", error);
      return null;
    }
  },

  // Mark all as read - marks ALL articles in database, not just loaded ones
  // Note: Different from markMultipleAsRead - this fetches ALL unread articles from DB first
  // while markMultipleAsRead operates only on loaded store articles. This is intentional
  // for bulk operations to ensure complete coverage of unread articles.
  markAllAsRead: async (feedId?: string) => {
    try {
      const {
        articles: storeArticles,
        selectedFeedId,
        selectedFolderId,
        readStatusFilter,
      } = get();

      if (!feedId) {
        console.log("No feedId provided for markAllAsRead");
        return;
      }

      // Step 1: Get ALL unread articles for this feed from database (not just loaded ones)
      const { data: unreadArticles, error: fetchError } = await supabase
        .from("articles")
        .select("id, inoreader_id")
        .eq("feed_id", feedId)
        .eq("is_read", false);

      if (fetchError) throw fetchError;

      if (!unreadArticles || unreadArticles.length === 0) {
        console.log("No unread articles to mark");
        // Slice 6c: Throw specific error for empty case handling
        throw new Error("No articles found to mark as read");
      }

      const articleIds = unreadArticles.map((a) => a.id);

      // Step 2: RR-197 Integration - Use same localStorage optimization as markMultipleAsRead
      const articlesWithFeeds = unreadArticles.map((article) => ({
        articleId: article.id,
        feedId: feedId,
      }));

      if (articlesWithFeeds.length > 0) {
        // Apply immediate localStorage updates for instant UI feedback (<1ms)
        await localStorageStateManager.batchMarkArticlesRead(articlesWithFeeds);

        // RR-197: Trigger immediate sidebar counter updates
        const { useFeedStore } = await import("./feed-store");
        useFeedStore.getState().applyLocalStorageCounterUpdates();
      }

      // Step 3: Update local state immediately for UI responsiveness
      const updatedArticles = new Map(storeArticles);
      articleIds.forEach((id) => {
        const article = updatedArticles.get(id);
        if (article) {
          updatedArticles.set(id, { ...article, isRead: true });
        }
      });
      set({ articles: updatedArticles });

      // Step 4: Define database update function (preserves existing 500ms batching)
      const updateDatabase = async (ids: string[]) => {
        const timestamp = new Date().toISOString();
        const { error } = await supabase
          .from("articles")
          .update({
            is_read: true,
            last_local_update: timestamp,
            updated_at: timestamp,
          })
          .in("id", ids);

        if (error) throw error;

        // Add to sync queue for bi-directional sync
        for (const id of ids) {
          const article = unreadArticles.find((a) => a.id === id);
          if (article?.inoreader_id) {
            const { error: rpcError } = await supabase.rpc(
              "add_to_sync_queue",
              {
                p_article_id: id,
                p_inoreader_id: article.inoreader_id,
                p_action_type: "read",
              }
            );

            if (rpcError) {
              console.error("Failed to add to sync queue:", rpcError);
            }
          }
        }
      };

      // Step 5: Define store update function (confirms localStorage updates)
      const updateStore = (articles: Map<string, Article>) => {
        set({ articles });
      };

      // Step 6: Use centralized markArticlesAsReadWithSession (preserves 500ms database batching)
      const context: MarkAsReadContext = {
        feedId,
        folderId: selectedFolderId || undefined,
        currentView: "feed",
        filterMode: readStatusFilter,
      };

      await markArticlesAsReadWithSession(
        articleIds,
        updatedArticles, // Pass updated articles with immediate changes
        context,
        "bulk", // markAllAsRead is bulk operation
        updateDatabase,
        updateStore
      );

      // Step 7: Invalidate article count cache (RR-197 integration)
      if (
        typeof window !== "undefined" &&
        (window as any).__articleCountManager
      ) {
        (window as any).__articleCountManager.invalidateCache(feedId);
      }

      // RR-197: Also invalidate our new counter manager
      const { articleCounterManager } = await import(
        "@/lib/utils/article-counter-manager"
      );
      articleCounterManager.invalidateCache(feedId);

      console.log(
        `[RR-197] Marked ${articleIds.length} articles as read with localStorage optimization (markAllAsRead)`
      );
    } catch (error) {
      console.error("Failed to mark all as read:", error);

      // RR-197: On error, try emergency fallback
      try {
        const { localStorageStateManager } = await import(
          "@/lib/utils/localstorage-state-manager"
        );
        localStorageStateManager.emergencyReset();
        console.warn(
          "[RR-197] Applied emergency localStorage reset due to markAllAsRead error"
        );
      } catch (resetError) {
        console.error("[RR-197] Emergency reset also failed:", resetError);
      }

      throw error;
    }
  },

  // RR-179: Mark all as read for tag - marks ALL articles with specific tag across all feeds
  markAllAsReadForTag: async (tagId: string) => {
    try {
      const {
        articles: storeArticles,
        selectedFeedId,
        selectedFolderId,
        readStatusFilter,
      } = get();

      if (!tagId) {
        console.log("No tagId provided for markAllAsReadForTag");
        return;
      }

      // Siri's Fix: Immediate optimistic tag counter update (before any DB work)
      const { useTagStore } = await import("./tag-store");
      const tagState = useTagStore.getState();
      const currentTag = tagState.tags.get(tagId);
      const currentUnreadCount = currentTag?.unreadCount || 0;

      if (currentUnreadCount > 0) {
        // Set tag counter to 0 immediately for instant UI feedback
        tagState.updateTagUnreadCount(tagId, -currentUnreadCount);
        console.log(
          `[RR-179] Immediate tag counter update: ${tagId} set to 0 (was ${currentUnreadCount})`
        );
      }

      // Step 1: Get ALL unread articles with this tag from database
      const { data: taggedArticles, error: tagFetchError } = await supabase
        .from("article_tags")
        .select("article_id")
        .eq("tag_id", tagId);

      if (tagFetchError) throw tagFetchError;

      if (!taggedArticles || taggedArticles.length === 0) {
        console.log("No articles with this tag");
        return;
      }

      const taggedArticleIds = taggedArticles.map((at) => at.article_id);

      // Step 2: Get unread articles from the tagged articles
      const { data: unreadTaggedArticles, error: fetchError } = await supabase
        .from("articles")
        .select("id, inoreader_id, feed_id")
        .in("id", taggedArticleIds)
        .eq("is_read", false);

      if (fetchError) throw fetchError;

      if (!unreadTaggedArticles || unreadTaggedArticles.length === 0) {
        console.log("No unread articles with this tag");
        // Slice 6c: Throw specific error for empty tag case
        throw new Error("No articles found for this tag");
      }

      const articleIds = unreadTaggedArticles.map((a) => a.id);

      // Step 3: RR-197 Integration - Use same localStorage optimization as markMultipleAsRead
      const articlesWithFeeds = unreadTaggedArticles.map((article) => ({
        articleId: article.id,
        feedId: article.feed_id || "",
      }));

      if (articlesWithFeeds.length > 0) {
        // Apply immediate localStorage updates for instant UI feedback (<1ms)
        await localStorageStateManager.batchMarkArticlesRead(articlesWithFeeds);

        // RR-197: Trigger immediate sidebar counter updates
        const { useFeedStore } = await import("./feed-store");
        useFeedStore.getState().applyLocalStorageCounterUpdates();
      }

      // Step 4: Update local state immediately for UI responsiveness
      const updatedArticles = new Map(storeArticles);
      articleIds.forEach((id) => {
        const article = updatedArticles.get(id);
        if (article) {
          updatedArticles.set(id, { ...article, isRead: true });
        }
      });
      set({ articles: updatedArticles });

      // Step 5: Define database update function (preserves existing 500ms batching)
      const updateDatabase = async (ids: string[]) => {
        const timestamp = new Date().toISOString();
        const { error } = await supabase
          .from("articles")
          .update({
            is_read: true,
            last_local_update: timestamp,
            updated_at: timestamp,
          })
          .in("id", ids);

        if (error) throw error;

        // Add to sync queue for bi-directional sync
        for (const id of ids) {
          const article = unreadTaggedArticles.find((a) => a.id === id);
          if (article?.inoreader_id) {
            const { error: rpcError } = await supabase.rpc(
              "add_to_sync_queue",
              {
                p_article_id: id,
                p_inoreader_id: article.inoreader_id,
                p_action_type: "read",
              }
            );

            if (rpcError) {
              console.error("Failed to add to sync queue:", rpcError);
            }
          }
        }
      };

      // Step 6: Define store update function (confirms localStorage updates)
      const updateStore = (articles: Map<string, Article>) => {
        set({ articles });
      };

      // Step 7: Use centralized markArticlesAsReadWithSession (preserves 500ms database batching)
      const context: MarkAsReadContext = {
        feedId: selectedFeedId || undefined,
        folderId: selectedFolderId || undefined,
        currentView: selectedFeedId
          ? "feed"
          : selectedFolderId
            ? "folder"
            : "all",
        filterMode: readStatusFilter,
      };

      await markArticlesAsReadWithSession(
        articleIds,
        updatedArticles, // Pass updated articles with immediate changes
        context,
        "bulk", // markAllAsReadForTag is bulk operation
        updateDatabase,
        updateStore
      );

      // Step 8: Invalidate cache for all affected feeds
      const affectedFeeds = new Set(
        unreadTaggedArticles.map((a) => a.feed_id).filter(Boolean)
      );

      if (
        typeof window !== "undefined" &&
        (window as any).__articleCountManager
      ) {
        affectedFeeds.forEach((feedId) => {
          (window as any).__articleCountManager.invalidateCache(feedId);
        });
      }

      // RR-197: Also invalidate our new counter manager for all affected feeds
      const { articleCounterManager } = await import(
        "@/lib/utils/article-counter-manager"
      );
      affectedFeeds.forEach((feedId) => {
        articleCounterManager.invalidateCache(feedId);
      });

      // RR-179: Tag counter already updated immediately at start of function
      // No additional tag counter update needed here

      console.log(
        `[RR-179] Marked ${articleIds.length} articles as read for tag ${tagId} across ${affectedFeeds.size} feeds`
      );
    } catch (error) {
      console.error("Failed to mark all as read for tag:", error);

      // RR-197: On error, try emergency fallback
      try {
        const { localStorageStateManager } = await import(
          "@/lib/utils/localstorage-state-manager"
        );
        localStorageStateManager.emergencyReset();
        console.warn(
          "[RR-197] Applied emergency localStorage reset due to markAllAsReadForTag error"
        );
      } catch (resetError) {
        console.error("[RR-197] Emergency reset also failed:", resetError);
      }

      throw error;
    }
  },

  // Refresh articles - preserves tag context
  refreshArticles: async () => {
    const { selectedFeedId, selectedFolderId } = get();
    // RR-179: Get tag context from TagStore to preserve tag filtering
    const { useTagStore } = await import("./tag-store");
    const tagState = useTagStore.getState();
    const selectedTagId =
      tagState.selectedTagIds.size === 1
        ? Array.from(tagState.selectedTagIds)[0]
        : undefined;

    await get().loadArticles(
      selectedFeedId || undefined,
      selectedFolderId || undefined,
      selectedTagId
    );
  },

  // Selection setters
  setSelectedFeed: (feedId) =>
    set({ selectedFeedId: feedId, selectedFolderId: null }),
  setSelectedFolder: (folderId) =>
    set({ selectedFolderId: folderId, selectedFeedId: null }),
  setSelectedArticle: (articleId) => set({ selectedArticleId: articleId }),
  setFilter: (filter) => {
    set({ filter });
    get().refreshArticles();
  },
  setReadStatusFilter: (filter) => {
    set({ readStatusFilter: filter });
    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("readStatusFilter", filter);
    }
    get().refreshArticles();
  },

  // Utility
  clearError: () => set({ articlesError: null }),

  // Navigation actions (RR-27)
  setNavigatingToArticle: (isNavigating: boolean) =>
    set({ navigatingToArticle: isNavigating }),

  getArticleCount: () => {
    const { readStatusFilter } = get();
    const articles = Array.from(get().articles.values());

    // Get base counts
    const total = articles.length;
    const unread = articles.filter((a) => !a.isRead).length;
    const read = total - unread;

    // Return counts based on current filter
    if (readStatusFilter === "unread") {
      return { total: unread, unread };
    } else if (readStatusFilter === "read") {
      return { total: read, unread: 0 };
    }

    return { total, unread };
  },
}));
