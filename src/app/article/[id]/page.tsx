"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useArticleStore } from "@/lib/stores/article-store";
import { useFeedStore } from "@/lib/stores/feed-store";
import { ArticleDetail } from "@/components/articles/article-detail";
import ArticleNotFound from "./not-found";
import type { Article } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { navigationHistory } from "@/lib/utils/navigation-history";

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const articleId = params.id ? decodeURIComponent(params.id as string) : "";

  const {
    articles,
    getArticle,
    markAsRead,
    toggleStar,
    setNavigatingToArticle,
  } = useArticleStore();
  const { feeds, loadFeedHierarchy } = useFeedStore();
  const [article, setArticle] = useState<Article | null>(null);
  const [articleTags, setArticleTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);
  const [feedsLoaded, setFeedsLoaded] = useState(false);

  // Read feed context from URL (Option 2: URL Query Parameters)
  const feedIdFromQuery = useMemo(() => {
    if (!searchParams) return null;
    // Prefer explicit feedId for article detail; fall back to generic 'feed'
    return searchParams.get("feedId") || searchParams.get("feed") || null;
  }, [searchParams]);

  // Ensure list filters are available for back navigation even after a refresh
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (feedIdFromQuery) {
        sessionStorage.setItem("articleListFilter", feedIdFromQuery);
      }
      // Preserve tag context if present (future-proofing; optional)
      const tagFromQuery =
        searchParams?.get("tagId") || searchParams?.get("tag");
      if (tagFromQuery) {
        sessionStorage.setItem("articleListTagFilter", tagFromQuery);
      }
    } catch (e) {
      console.warn("Failed to persist list filters from URL:", e);
    }
  }, [feedIdFromQuery, searchParams]);

  // Load feeds if not already loaded (happens on refresh)
  useEffect(() => {
    const loadFeeds = async () => {
      if (feeds.size === 0 && !feedsLoaded) {
        try {
          await loadFeedHierarchy();
          setFeedsLoaded(true);
        } catch (error) {
          console.warn("Failed to load feeds:", error);
          setFeedsLoaded(true); // Set to true even on error to prevent infinite retries
        }
      } else if (feeds.size > 0) {
        setFeedsLoaded(true);
      }
    };
    loadFeeds();
  }, [feeds.size, feedsLoaded, loadFeedHierarchy]);

  useEffect(() => {
    const loadArticle = async () => {
      // RR-27: Reset navigation intent when article page loads
      setNavigatingToArticle(false);

      try {
        const fetchedArticle = await getArticle(articleId);

        if (fetchedArticle) {
          setArticle(fetchedArticle);

          // Track navigation to this article
          // Track navigation to this article (store raw article id)
          navigationHistory.addEntry(articleId, parseInt(articleId));

          // Fetch tags for the article
          try {
            const tagsResponse = await fetch(
              `/reader/api/articles/${articleId}/tags`
            );
            if (tagsResponse.ok) {
              const { tags } = await tagsResponse.json();
              setArticleTags(tags || []);
            }
          } catch (error) {
            console.error("Error fetching article tags:", error);
          }

          // Mark as read when opened
          if (!fetchedArticle.isRead) {
            await markAsRead(articleId);
            // Note: markAsRead already handles all session state updates via markArticlesAsReadWithSession
            // No need for duplicate session state handling here
          }
        } else {
          // Article not found
          setNotFoundError(true);
        }
      } catch (error) {
        console.error("Error loading article:", error);
        setNotFoundError(true);
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [articleId, getArticle, markAsRead, setNavigatingToArticle]);

  // Watch for store updates (e.g., after summarization) and update local article state
  useEffect(() => {
    if (articleId && articles.has(articleId)) {
      const storeArticle = articles.get(articleId);
      if (
        storeArticle &&
        (!article || storeArticle.updatedAt > article.updatedAt)
      ) {
        console.log("📄 Article updated in store, refreshing local state");
        setArticle(storeArticle);
      }
    }
  }, [articles, articleId, article]);

  // Enhanced feed title resolution with multiple fallbacks (must be before conditionals)
  const feedTitle = useMemo(() => {
    if (!article) return "Unknown Feed";

    const effectiveFeedId = article.feedId || feedIdFromQuery || "";
    const feed = feeds.get(effectiveFeedId);

    // First try: Get from feed store
    if (feed?.title) {
      return feed.title;
    }

    // Second try: If feeds haven't loaded yet but we have a feedId, show loading state
    if (effectiveFeedId && feeds.size === 0 && !feedsLoaded) {
      return "Loading...";
    }

    // Final fallback
    return "Unknown Feed";
  }, [article, feedIdFromQuery, feeds, feedsLoaded]);

  const handleToggleStar = async () => {
    if (article) {
      await toggleStar(article.id);
      // Refresh the article to get the updated state from the store
      const updatedArticle = await getArticle(article.id);
      if (updatedArticle) {
        setArticle(updatedArticle);
      }
    }
  };

  const handleNavigate = async (direction: "prev" | "next") => {
    // Get all articles in current view
    const allArticles = Array.from(articles.values());
    const currentIndex = allArticles.findIndex((a) => a.id === articleId);

    if (currentIndex === -1) return;

    let targetIndex =
      direction === "next" ? currentIndex + 1 : currentIndex - 1;

    // Wrap around navigation
    if (targetIndex < 0) {
      targetIndex = allArticles.length - 1;
    } else if (targetIndex >= allArticles.length) {
      targetIndex = 0;
    }

    const targetArticle = allArticles[targetIndex];
    if (targetArticle) {
      // Mark the target article as read if navigating to it
      if (!targetArticle.isRead) {
        await markAsRead(targetArticle.id);
        // Note: markAsRead already handles all session state updates via markArticlesAsReadWithSession
      }

      // Next.js automatically prepends basePath to router operations
      // Carry forward feed context via query param to preserve on refresh
      const effectiveFeedId = feedIdFromQuery || targetArticle.feedId;
      const nextUrl = effectiveFeedId
        ? `/article/${encodeURIComponent(targetArticle.id)}?feedId=${encodeURIComponent(
            effectiveFeedId
          )}`
        : `/article/${encodeURIComponent(targetArticle.id)}`;
      router.push(nextUrl as any);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  if (notFoundError || !article) {
    return <ArticleNotFound />;
  }

  // Resolve feed using article data, falling back to URL param context
  const effectiveFeedId = article.feedId || feedIdFromQuery || "";
  const feed = feeds.get(effectiveFeedId);

  return (
    <ArticleDetail
      article={article}
      articleTags={articleTags}
      feed={feed}
      feedTitle={feedTitle}
      onToggleStar={handleToggleStar}
      onNavigate={handleNavigate}
      onBack={() => {
        // Check sessionStorage for active filters and build appropriate URL
        let feedFilter = sessionStorage.getItem("articleListFilter");
        const tagFilter = sessionStorage.getItem("articleListTagFilter");

        // Fallback to URL context if sessionStorage missing (e.g., after refresh)
        if (!feedFilter || feedFilter === "null") {
          feedFilter = feedIdFromQuery || (null as any);
          if (feedFilter) {
            sessionStorage.setItem("articleListFilter", feedFilter);
          }
        }

        // Next.js automatically prepends basePath to router operations
        let url = "/";
        const params = new URLSearchParams();

        // Only add params if filters are actually set (not null or "null" string)
        if (feedFilter && feedFilter !== "null") {
          params.set("feed", feedFilter);
        }
        if (tagFilter && tagFilter !== "null") {
          params.set("tag", tagFilter);
        }

        const queryString = params.toString();
        if (queryString) {
          url += "?" + queryString;
        }

        // Preserve list state on back navigation (avoid double penalty)
        setNavigatingToArticle(true);
        router.push(url as any);
      }}
    />
  );
}
