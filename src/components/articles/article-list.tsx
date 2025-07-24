'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Loader2, RefreshCw, Star } from 'lucide-react';
import { useArticleStore } from '@/lib/stores/article-store';
import { extractTextContent } from '@/lib/utils/data-cleanup';
import { formatDistanceToNow } from 'date-fns';
import { SummaryButton } from './summary-button';
import type { Article } from '@/types';

interface ArticleListProps {
  feedId?: string;
  folderId?: string;
  onArticleClick?: (articleId: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export function ArticleList({ feedId, folderId, onArticleClick, scrollContainerRef }: ArticleListProps) {
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
    readStatusFilter
  } = useArticleStore();

  // Load articles on mount or when feed/folder changes
  useEffect(() => {
    // Clear pending marks when view changes
    pendingMarkAsRead.current.clear();
    if (markAsReadTimer.current) {
      clearTimeout(markAsReadTimer.current);
    }
    loadArticles(feedId, folderId);
  }, [feedId, folderId, loadArticles]);

  // Batch mark as read with debounce
  const processPendingMarkAsRead = useCallback(() => {
    if (pendingMarkAsRead.current.size > 0) {
      const articleIds = Array.from(pendingMarkAsRead.current);
      pendingMarkAsRead.current.clear();
      markMultipleAsRead(articleIds);
    }
  }, [markMultipleAsRead]);

  // Set up auto-mark as read observer
  useEffect(() => {
    // Clear pending marks when filter changes
    pendingMarkAsRead.current.clear();
    if (markAsReadTimer.current) {
      clearTimeout(markAsReadTimer.current);
    }

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
        const articleElements = scrollContainer.querySelectorAll('[data-article-id]');
        articleElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          
          // Article has scrolled off the top of the container
          if (rect.bottom < containerRect.top + 10) {
            const articleId = element.getAttribute('data-article-id');
            const isRead = element.getAttribute('data-is-read') === 'true';
            
            if (articleId && !isRead) {
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
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Create observer for articles leaving viewport
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        // Article is leaving the viewport from the top
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
          const articleElement = entry.target as HTMLElement;
          const articleId = articleElement.getAttribute('data-article-id');
          const isRead = articleElement.getAttribute('data-is-read') === 'true';
          
          if (articleId && !isRead) {
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
        rootMargin: '0px 0px -90% 0px', // Only trigger when article is mostly scrolled out
        threshold: 0 // Trigger as soon as article starts leaving
      });
    }

    // Clean up on unmount or when filter changes
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
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
  }, [readStatusFilter, processPendingMarkAsRead, scrollContainerRef]);


  // Restore scroll position after articles load
  useEffect(() => {
    if (!loadingArticles && articles.size > 0 && !hasRestoredScroll.current) {
      const savedScrollPos = sessionStorage.getItem('articleListScroll');
      
      if (savedScrollPos) {
        hasRestoredScroll.current = true;
        // Small delay to ensure DOM is updated
        requestAnimationFrame(() => {
          const scrollPos = parseInt(savedScrollPos, 10);
          const scrollContainer = scrollContainerRef?.current;
          if (scrollContainer) {
            scrollContainer.scrollTop = scrollPos;
          }
          // Clear the saved position after restoring
          sessionStorage.removeItem('articleListScroll');
        });
      }
    }
  }, [loadingArticles, articles.size]);

  // Reset restoration flag when feed changes
  useEffect(() => {
    hasRestoredScroll.current = false;
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
      rootMargin: '100px',
      threshold: 0.1
    });

    if (loadMoreRef.current && observerRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loadMoreArticles]);

  // Pull-to-refresh handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    lastPullY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const pullDistance = currentY - lastPullY.current;
    const scrollContainer = scrollContainerRef?.current;
    
    if (scrollContainer && scrollContainer.scrollTop === 0 && pullDistance > 0) {
      isPulling.current = true;
      // Visual feedback for pull-to-refresh could be added here
    }
  }, [scrollContainerRef]);

  const handleTouchEnd = useCallback(async () => {
    const scrollContainer = scrollContainerRef?.current;
    if (isPulling.current && scrollContainer && scrollContainer.scrollTop === 0) {
      await refreshArticles();
    }
    isPulling.current = false;
  }, [refreshArticles, scrollContainerRef]);

  // Handle article click
  const handleArticleClick = useCallback(async (article: Article) => {
    // Save scroll position before navigating
    const scrollContainer = scrollContainerRef?.current;
    const currentScroll = scrollContainer ? scrollContainer.scrollTop : 0;
    sessionStorage.setItem('articleListScroll', currentScroll.toString());
    
    if (!article.isRead) {
      await markAsRead(article.id);
    }
    onArticleClick?.(article.id);
  }, [markAsRead, onArticleClick, scrollContainerRef]);

  // Render article preview
  const renderPreview = (article: Article) => {
    // If article is being summarized, show loading shimmer
    if (summarizingArticles.has(article.id)) {
      return (
        <div className="mt-2 space-y-2 animate-pulse">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      );
    }
    
    // Priority 1: If we have an AI summary, show it in full
    if (article.summary) {
      return (
        <div className="mt-2 space-y-2">
          {article.summary.split(/\n+/).filter(para => para.trim()).map((paragraph, index) => (
            <p key={index} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
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
          <p className="text-sm text-muted-foreground line-clamp-4 mt-2 break-words">
            {fullContentText}
          </p>
        );
      }
    }
    
    // Priority 3: Show RSS content as 4-line preview
    const contentText = extractTextContent(article.content);
    if (contentText) {
      return (
        <p className="text-sm text-muted-foreground line-clamp-4 mt-2 break-words">
          {contentText}
        </p>
      );
    }
    
    return (
      <p className="text-sm text-muted-foreground italic mt-2">
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
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-muted-foreground mb-4">{articlesError}</p>
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
      <div className="flex flex-col items-center justify-center h-full p-8">
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
      <div className="divide-y divide-border overflow-x-hidden article-list-container">
        {Array.from(articles.values()).map((article) => (
          <article
            key={article.id}
            data-article-id={article.id}
            data-is-read={article.isRead}
            ref={(el) => {
              if (el && autoMarkObserverRef.current && !article.isRead) {
                autoMarkObserverRef.current.observe(el);
              }
            }}
            className={`relative p-4 sm:p-6 cursor-pointer transition-all duration-300 hover:bg-muted/50 overflow-hidden ${
              article.isRead ? 'opacity-70' : ''
            }`}
            onClick={() => handleArticleClick(article)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
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
                <h2 className={`text-base sm:text-lg flex-1 ${
                  article.isRead 
                    ? 'font-normal text-muted-foreground' 
                    : 'font-semibold text-foreground'
                }`}>
                  {article.title}
                </h2>
                <div className="flex items-center gap-1">
                  {article.summary && (
                    <span className="text-yellow-500 text-sm" title="AI Summary Available">
                      ⚡
                    </span>
                  )}
                  {!article.summary && !summarizingArticles.has(article.id) && (
                    <SummaryButton
                      articleId={article.id}
                      hasSummary={false}
                      variant="icon"
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(article.id);
                    }}
                    className="p-1 hover:bg-muted rounded"
                    aria-label={article.tags?.includes('starred') ? 'Unstar' : 'Star'}
                  >
                    <Star 
                      className={`h-4 w-4 ${
                        article.tags?.includes('starred') 
                          ? 'fill-yellow-500 text-yellow-500' 
                          : 'text-muted-foreground'
                      }`} 
                    />
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                <span className="font-medium">{article.feedTitle}</span>
                <span className="hidden sm:inline">•</span>
                <time dateTime={article.publishedAt.toISOString()} suppressHydrationWarning>
                  {formatTimestamp(article.publishedAt)}
                </time>
                {article.author && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="truncate max-w-[150px]">{article.author}</span>
                  </>
                )}
              </div>

              {/* Content Preview */}
              <div className="text-sm overflow-hidden">
                {renderPreview(article)}
              </div>
            </div>
          </article>
        ))}

        {/* Infinite scroll trigger */}
        {hasMore && (
          <div 
            ref={loadMoreRef} 
            className="p-8 text-center"
          >
            {loadingMore && (
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
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
    <div className="divide-y divide-border animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 sm:p-6 space-y-3">
          <div className="flex items-start gap-2">
            <div className="h-5 bg-muted rounded w-3/4" />
            <div className="h-4 w-4 bg-muted rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}