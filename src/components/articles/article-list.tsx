"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useArticleStore } from "@/lib/stores/article-store";
import { extractTextContent } from "@/lib/utils/data-cleanup";
import { formatDistanceToNow } from "date-fns";
import { SummaryButton } from "./summary-button";
import { StarButton } from "./star-button";
import { useArticleListState } from "@/hooks/use-article-list-state";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";
// RR-197: localStorage optimization imports
import { localStorageStateManager } from "@/lib/utils/localstorage-state-manager";
import { performanceMonitor } from "@/lib/utils/performance-monitor";
import type { Article } from "@/types";

interface ArticleListProps {
  feedId?: string;
  folderId?: string;
  tagId?: string;
  onArticleClick?: (articleId: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  filtersReady: boolean; // <-- ADD THIS
}

export function ArticleList({
  feedId,
  folderId,
  tagId,
  onArticleClick,
  scrollContainerRef,
  filtersReady, // <-- ADD THIS
}: ArticleListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const ownScrollContainerRef = useRef<HTMLDivElement>(null);
  const lastPullY = useRef<number>(0);
  const isPulling = useRef<boolean>(false);
  const hasRestoredScroll = useRef<boolean>(false);

  // Auto-mark as read refs
  const autoMarkObserverRef = useRef<IntersectionObserver | null>(null);
  const lastScrollY = useRef<number>(0);
  const pendingMarkAsRead = useRef<Set<string>>(new Set());
  const markAsReadTimer = useRef<NodeJS.Timeout | null>(null);
  const autoMarkEnabled = useRef<boolean>(false);

  const {
    articles,
    loadingArticles,
    loadingMore,
    articlesError,
    hasMore,
    summarizingArticles,
    loadArticles,
    loadMoreArticles,
    markAsRead,
    markMultipleAsRead,
    toggleStar,
    refreshArticles,
    clearError,
    readStatusFilter,
  } = useArticleStore();

  // Integrate article list state preservation
  const {
    sessionPreservedArticles,
    handleArticleClick: handleArticleClickWithState,
    shouldShowArticle,
    getArticleClassName,
    saveStateBeforeNavigation,
    restoreStateIfAvailable,
  } = useArticleListState({
    articles,
    feedId,
    folderId,
    tagId, // RR-163: Add tagId for state preservation
    readStatusFilter,
    scrollContainerRef,
    onArticleClick,
    autoMarkObserverRef,
  });

  // RR-197: Initialize localStorage state manager for instant UI updates
  useEffect(() => {
    const initializeLocalStorage = async () => {
      try {
        await localStorageStateManager.initialize();
        console.log("🚀 [RR-197] localStorage state manager initialized");
      } catch (error) {
        console.warn(
          "⚠️ [RR-197] localStorage initialization failed, using fallback:",
          error
        );
      }
    };

    initializeLocalStorage();

    // Cleanup on unmount
    return () => {
      localStorageStateManager.cleanup();
    };
  }, []); // Initialize once on mount

  // Load articles on mount or when feed/folder changes
  useEffect(() => {
    if (!filtersReady) {
      // <-- ADD THIS GUARD
      console.log("🚫 Filters not ready, skipping article load.");
      return;
    }

    // Clear pending marks when view changes
    pendingMarkAsRead.current.clear();
    if (markAsReadTimer.current) {
      clearTimeout(markAsReadTimer.current);
    }

    // RR-216 Fix: Force fresh load when filters change
    // This ensures we get the correct filtered articles from the database
    console.log(`🔄 Loading articles for feedId: ${feedId}, tagId: ${tagId}`);

    // Always load fresh articles based on current filters
    loadArticles(feedId, folderId, tagId);
  }, [feedId, folderId, tagId, loadArticles, filtersReady]); // <-- ADD filtersReady to dependency array

  // Batch mark as read with debounce - now tracking auto-read articles
  const processPendingMarkAsRead = useCallback(() => {
    if (pendingMarkAsRead.current.size > 0) {
      const articleIds = Array.from(pendingMarkAsRead.current);
      pendingMarkAsRead.current.clear();

      // RR-197: Apply immediate localStorage updates for instant UI feedback
      const articlesWithFeeds = articleIds
        .map((id) => {
          const article = articles.get(id);
          return article ? { articleId: id, feedId: article.feedId } : null;
        })
        .filter(Boolean) as { articleId: string; feedId: string }[];

      if (articlesWithFeeds.length > 0) {
        // Immediate localStorage update for instant counter changes
        localStorageStateManager
          .batchMarkArticlesRead(articlesWithFeeds)
          .then((result) => {
            if (result.success && result.responseTime < 1) {
              console.log(
                `🚀 [RR-197] localStorage batch update: ${result.responseTime.toFixed(2)}ms for ${articlesWithFeeds.length} articles`
              );
            } else if (!result.success && result.fallbackUsed) {
              console.warn(
                `⚠️ [RR-197] localStorage unavailable, using fallback behavior`
              );
            }
          })
          .catch((error) => {
            console.error("[RR-197] localStorage batch update failed:", error);
          });
      }

      // Update state manager to track auto-read articles (existing behavior)
      const updates = articleIds.map((id) => ({
        id,
        changes: { isRead: true, wasAutoRead: true },
      }));
      articleListStateManager.batchUpdateArticles(updates);

      // Call existing database batching (preserves 500ms timing)
      markMultipleAsRead(articleIds);
    }
  }, [markMultipleAsRead, articles]);

  // Set up auto-mark as read observer
  useEffect(() => {
    // Clear pending marks when filter OR feed/folder changes
    pendingMarkAsRead.current.clear();
    if (markAsReadTimer.current) {
      clearTimeout(markAsReadTimer.current);
    }

    // Disable auto-mark initially to prevent false marks during render
    autoMarkEnabled.current = false;

    // Detect iOS Safari for fallback behavior
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Track scroll direction - now using nearest scroll container
    const handleScroll = (e: Event) => {
      const scrollContainer = e.currentTarget as HTMLElement;
      const currentScrollY = scrollContainer.scrollTop;
      const isScrollingDown = currentScrollY > lastScrollY.current;
      lastScrollY.current = currentScrollY;

      // Fallback: manually check article positions on all platforms for reliability
      if (isScrollingDown) {
        const articleElements =
          scrollContainer.querySelectorAll("[data-article-id]");
        articleElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();

          // Article has scrolled off the top of the container
          if (rect.bottom < containerRect.top + 10) {
            const articleId = element.getAttribute("data-article-id");
            const isRead = element.getAttribute("data-is-read") === "true";

            if (articleId && !isRead && autoMarkEnabled.current) {
              pendingMarkAsRead.current.add(articleId);
            }
          }
        });
      }

      // Process pending marks if scrolling down
      if (isScrollingDown && pendingMarkAsRead.current.size > 0) {
        // Clear existing timer
        if (markAsReadTimer.current) {
          clearTimeout(markAsReadTimer.current);
        }
        // Set new timer to batch process
        markAsReadTimer.current = setTimeout(processPendingMarkAsRead, 500);
      }
    };

    // Use the passed scroll container
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
    }

    // Create observer for articles leaving viewport
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        // Article is leaving the viewport from the top
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
          const articleElement = entry.target as HTMLElement;
          const articleId = articleElement.getAttribute("data-article-id");
          const isRead = articleElement.getAttribute("data-is-read") === "true";

          if (articleId && !isRead && autoMarkEnabled.current) {
            pendingMarkAsRead.current.add(articleId);
          }
        }
      });
    };

    // Create IntersectionObserver for all platforms
    // We'll use both approaches for reliability
    if (scrollContainer) {
      autoMarkObserverRef.current = new IntersectionObserver(observerCallback, {
        root: scrollContainer,
        rootMargin: "0px 0px -90% 0px", // Only trigger when article is mostly scrolled out
        threshold: 0, // Trigger as soon as article starts leaving
      });
    }

    // Enable auto-mark after a delay to prevent false marks during initial render/feed switch
    const enableTimer = setTimeout(() => {
      autoMarkEnabled.current = true;
      console.log("🔓 Auto-mark as read enabled after delay");
    }, 2000); // 2 second delay

    // Clean up on unmount or when filter changes
    return () => {
      clearTimeout(enableTimer);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
      if (autoMarkObserverRef.current) {
        autoMarkObserverRef.current.disconnect();
      }
      if (markAsReadTimer.current) {
        clearTimeout(markAsReadTimer.current);
      }
      // Process any pending marks before cleanup
      processPendingMarkAsRead();
    };
  }, [
    readStatusFilter,
    feedId,
    folderId,
    tagId,
    processPendingMarkAsRead,
    scrollContainerRef,
  ]);

  // Restore scroll position and state after articles load
  useEffect(() => {
    if (!loadingArticles && articles.size > 0 && !hasRestoredScroll.current) {
      // Try to restore full state first
      const stateRestored = restoreStateIfAvailable();

      // Also check for saved scroll position
      const savedScrollPos = sessionStorage.getItem("articleListScroll");
      const savedState = articleListStateManager.getListState();

      if (
        savedScrollPos ||
        (savedState && !articleListStateManager.isStateExpired())
      ) {
        hasRestoredScroll.current = true;
        // Small delay to ensure DOM is updated
        requestAnimationFrame(() => {
          const scrollPos =
            savedState?.scrollPosition || parseInt(savedScrollPos || "0", 10);
          const scrollContainer = scrollContainerRef?.current;
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollPos;
          }
          // Clear the saved position after restoring
          sessionStorage.removeItem("articleListScroll");
        });
      }
    }
  }, [
    loadingArticles,
    articles.size,
    scrollContainerRef,
    restoreStateIfAvailable,
  ]);

  // Reset restoration flag when feed changes
  const previousFeedIdRef = useRef(feedId);
  const previousFolderIdRef = useRef(folderId);

  useEffect(() => {
    hasRestoredScroll.current = false;

    // Track feed/folder changes but DON'T clear state
    // Preserved articles should remain visible across feed changes
    const feedChanged =
      previousFeedIdRef.current !== feedId &&
      previousFeedIdRef.current !== undefined;
    const folderChanged =
      previousFolderIdRef.current !== folderId &&
      previousFolderIdRef.current !== undefined;

    if (feedChanged || folderChanged) {
      console.log(
        `🔄 Feed/folder changed: ${previousFeedIdRef.current}→${feedId}, ${previousFolderIdRef.current}→${folderId} (keeping preserved articles)`
      );
    }

    // Update refs
    previousFeedIdRef.current = feedId;
    previousFolderIdRef.current = folderId;
  }, [feedId, folderId]);

  // Set up infinite scroll
  useEffect(() => {
    const callback = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loadingMore) {
        loadMoreArticles();
      }
    };

    // Use the passed scroll container as root for infinite scroll
    observerRef.current = new IntersectionObserver(callback, {
      root: scrollContainerRef?.current || null,
      rootMargin: "100px",
      threshold: 0.1,
    });

    if (loadMoreRef.current && observerRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loadMoreArticles, scrollContainerRef]);

  // Pull-to-refresh handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    lastPullY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - lastPullY.current;
      const scrollContainer = scrollContainerRef?.current;

      if (
        scrollContainer &&
        scrollContainer.scrollTop === 0 &&
        pullDistance > 0
      ) {
        isPulling.current = true;
        // Visual feedback for pull-to-refresh could be added here
      }
    },
    [scrollContainerRef]
  );

  const handleTouchEnd = useCallback(async () => {
    const scrollContainer = scrollContainerRef?.current;
    if (
      isPulling.current &&
      scrollContainer &&
      scrollContainer.scrollTop === 0
    ) {
      await refreshArticles();
    }
    isPulling.current = false;
  }, [refreshArticles, scrollContainerRef]);

  // Handle article click with state preservation
  const handleArticleClick = useCallback(
    async (article: Article) => {
      // Save full state before navigating
      saveStateBeforeNavigation();

      // Also save scroll position for backward compatibility
      const scrollContainer = scrollContainerRef?.current;
      const currentScroll = scrollContainer ? scrollContainer.scrollTop : 0;
      sessionStorage.setItem("articleListScroll", currentScroll.toString());

      // Don't mark as read here - let the article detail page handle it
      // This prevents the article from immediately disappearing from "Unread Only" view

      // Use the state-aware click handler
      handleArticleClickWithState(article);
    },
    [saveStateBeforeNavigation, handleArticleClickWithState, scrollContainerRef]
  );

  // Render article preview
  const renderPreview = (article: Article) => {
    // If article is being summarized, show loading shimmer
    if (summarizingArticles.has(article.id)) {
      return (
        <div className="mt-2 animate-pulse space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-3 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
      );
    }

    // Priority 1: If we have an AI summary, show it in full
    if (article.summary) {
      return (
        <div className="mt-2 space-y-2">
          {article.summary
            .split(/\n+/)
            .filter((para) => para.trim())
            .map((paragraph, index) => (
              <p
                key={index}
                className="text-sm leading-relaxed text-gray-700 dark:text-gray-300"
              >
                {paragraph.trim()}
              </p>
            ))}
        </div>
      );
    }

    // Priority 2: If we have full content (extracted), show 4-line preview
    if (article.fullContent) {
      const fullContentText = extractTextContent(article.fullContent);
      if (fullContentText) {
        return (
          <p className="mt-2 line-clamp-4 break-words text-sm text-muted-foreground">
            {fullContentText}
          </p>
        );
      }
    }

    // Priority 3: Show RSS content as 4-line preview
    const contentText = extractTextContent(article.content);
    if (contentText) {
      return (
        <p className="mt-2 line-clamp-4 break-words text-sm text-muted-foreground">
          {contentText}
        </p>
      );
    }

    return (
      <p className="mt-2 text-sm italic text-muted-foreground">
        No preview available
      </p>
    );
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return new Date(date).toLocaleDateString();
    }
  };

  if (loadingArticles && articles.size === 0) {
    return <ArticleListSkeleton />;
  }

  if (articlesError) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <p className="mb-4 text-muted-foreground">{articlesError}</p>
        <button
          onClick={clearError}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (articles.size === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <p className="text-muted-foreground">No articles found</p>
        <button
          onClick={refreshArticles}
          className="mt-4 flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ownScrollContainerRef}
      className="flex-1 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="article-list-container divide-y divide-border overflow-x-hidden">
        {Array.from(articles.values())
          .filter((article) => shouldShowArticle(article))
          .map((article) => (
            <article
              key={article.id}
              data-article-id={article.id}
              data-is-read={article.isRead}
              ref={(el) => {
                if (el && autoMarkObserverRef.current && !article.isRead) {
                  autoMarkObserverRef.current.observe(el);
                }
              }}
              className={getArticleClassName(article)}
              onClick={() => handleArticleClick(article)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleArticleClick(article);
                }
              }}
            >
              {/* Touch target helper for mobile - ensures 44x44px minimum */}
              <div className="absolute inset-0 sm:hidden" aria-hidden="true" />

              <div className="relative space-y-2">
                {/* Title with star indicator */}
                <div className="flex items-start gap-2">
                  <h2
                    className={`flex-1 text-base sm:text-lg ${
                      article.isRead
                        ? "font-normal text-muted-foreground"
                        : "font-semibold text-foreground"
                    }`}
                  >
                    {article.title}
                  </h2>
                  <div className="flex items-center gap-1">
                    {article.summary && (
                      <span
                        className="text-sm text-yellow-500"
                        title="AI Summary Available"
                      >
                        ⚡
                      </span>
                    )}
                    {!article.summary &&
                      !summarizingArticles.has(article.id) && (
                        <SummaryButton
                          articleId={article.id}
                          hasSummary={false}
                          variant="icon"
                          size="sm"
                        />
                      )}
                    {/* TODO: Temporarily commented out star button from article listing cards
                    <StarButton
                      onToggleStar={() => toggleStar(article.id)}
                      isStarred={article.tags?.includes("starred") || false}
                      size="sm"
                    />
                    */}
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                  <span className="font-medium">{article.feedTitle}</span>
                  {article.author && (
                    <>
                      <span>•</span>
                      <span className="max-w-[150px] truncate">
                        {article.author}
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <time
                    dateTime={article.publishedAt.toISOString()}
                    suppressHydrationWarning
                  >
                    {formatTimestamp(article.publishedAt)}
                  </time>
                </div>

                {/* Content Preview */}
                <div className="overflow-hidden text-sm">
                  {renderPreview(article)}
                </div>
              </div>
            </article>
          ))}

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="p-8 text-center">
            {loadingMore && (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Skeleton loading component
function ArticleListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-border">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-3 p-4 sm:p-6">
          <div className="flex items-start gap-2">
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-4 rounded bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
