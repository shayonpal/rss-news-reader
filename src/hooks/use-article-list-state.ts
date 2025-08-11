/**
 * Hook for integrating article list state preservation (RR-27)
 */

import { useEffect, useCallback, useRef } from 'react';
import { articleListStateManager, type ListState } from '@/lib/utils/article-list-state-manager';
import { navigationHistory } from '@/lib/utils/navigation-history';
import type { Article } from '@/types';

interface UseArticleListStateProps {
  articles: Map<string, Article>;
  feedId?: string;
  folderId?: string;
  tagId?: string; // RR-163: Add tagId for state preservation
  readStatusFilter: 'all' | 'unread' | 'read';
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  onArticleClick?: (articleId: string) => void;
  autoMarkObserverRef: React.MutableRefObject<IntersectionObserver | null>;
}

interface UseArticleListStateReturn {
  sessionPreservedArticles: Set<string>;
  handleArticleClick: (article: Article) => void;
  shouldShowArticle: (article: Article) => boolean;
  getArticleClassName: (article: Article) => string;
  saveStateBeforeNavigation: () => void;
  restoreStateIfAvailable: () => boolean;
}

export function useArticleListState({
  articles,
  feedId,
  folderId,
  tagId, // RR-163
  readStatusFilter,
  scrollContainerRef,
  onArticleClick,
  autoMarkObserverRef,
}: UseArticleListStateProps): UseArticleListStateReturn {
  const sessionPreservedArticles = useRef<Set<string>>(new Set());
  const hasRestoredState = useRef(false);
  const restorationInProgress = useRef(false);
  
  // Initialize session preserved articles on mount
  useEffect(() => {
    const state = articleListStateManager.getListState();
    if (state && !articleListStateManager.isStateExpired()) {
      const preserved = articleListStateManager.getSessionPreservedArticles();
      sessionPreservedArticles.current = new Set(preserved);
      console.log(`🔧 Hook initialized with ${preserved.length} preserved articles`);
    }
  }, []);

  // Handle filter changes and feed/folder/tag changes
  const previousFilter = useRef(readStatusFilter);
  const previousFeed = useRef(feedId);
  const previousFolder = useRef(folderId);
  const previousTag = useRef(tagId); // RR-163: Track tag changes
  
  useEffect(() => {
    // Check what changed
    const filterChanged = previousFilter.current !== readStatusFilter;
    const feedChanged = previousFeed.current !== feedId;
    const folderChanged = previousFolder.current !== folderId;
    const tagChanged = previousTag.current !== tagId; // RR-163
    
    console.log(`🔧 Hook effect: filter ${previousFilter.current}→${readStatusFilter} (changed: ${filterChanged}), feed ${previousFeed.current}→${feedId} (changed: ${feedChanged}), folder ${previousFolder.current}→${folderId} (changed: ${folderChanged}), tag ${previousTag.current}→${tagId} (changed: ${tagChanged})`);
    
    // Clear state on filter changes OR feed/folder/tag changes (per RR-27 & RR-163)
    // This ensures that switching between "All Articles" and specific feeds/tags clears preserved state
    if ((filterChanged || feedChanged || folderChanged || tagChanged) && 
        (previousFilter.current !== undefined || previousFeed.current !== undefined || previousFolder.current !== undefined || previousTag.current !== undefined)) {
      
      if (filterChanged) {
        console.log(`🧹 Clearing state due to filter change: ${previousFilter.current} → ${readStatusFilter}`);
      } else if (feedChanged) {
        console.log(`🧹 Clearing state due to feed change: ${previousFeed.current} → ${feedId}`);
      } else if (folderChanged) {
        console.log(`🧹 Clearing state due to folder change: ${previousFolder.current} → ${folderId}`);
      } else if (tagChanged) {
        console.log(`🧹 Clearing state due to tag change: ${previousTag.current} → ${tagId}`); // RR-163
      }
      
      articleListStateManager.clearState();
      sessionPreservedArticles.current = new Set();
      
      // Also clear the preserved article IDs storage used by hybrid query
      try {
        sessionStorage.removeItem('preserved_article_ids');
        console.log(`🧹 Cleared preserved article IDs from session storage`);
      } catch (e) {
        console.error('Failed to clear preserved article IDs:', e);
      }
    }
    // If no changes, just load preserved state normally
    else {
      const state = articleListStateManager.getListState();
      if (state && !articleListStateManager.isStateExpired()) {
        const preserved = articleListStateManager.getSessionPreservedArticles();
        sessionPreservedArticles.current = new Set(preserved);
      } else {
        // If no state exists (was cleared), ensure our ref is also cleared
        sessionPreservedArticles.current = new Set();
      }
    }
    
    // Update refs for next comparison
    previousFilter.current = readStatusFilter;
    previousFeed.current = feedId;
    previousFolder.current = folderId;
    previousTag.current = tagId; // RR-163
  }, [readStatusFilter, feedId, folderId, tagId]); // RR-163: Add tagId to dependencies

  // Save state before navigation
  const saveStateBeforeNavigation = useCallback(() => {
    if (articles.size === 0) return;

    const articleArray = Array.from(articles.values());
    const scrollPosition = scrollContainerRef?.current?.scrollTop || 0;
    
    // Calculate visible range
    const scrollContainer = scrollContainerRef?.current;
    let visibleRange: { start: number; end: number } | undefined;
    
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      let firstVisible = -1;
      let lastVisible = -1;
      
      articleArray.forEach((article, index) => {
        const element = scrollContainer.querySelector(`[data-article-id="${article.id}"]`);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
            if (firstVisible === -1) firstVisible = index;
            lastVisible = index;
          }
        }
      });
      
      if (firstVisible !== -1) {
        visibleRange = { start: firstVisible, end: lastVisible };
      }
    }

    // Get existing state to preserve read articles
    const existingState = articleListStateManager.getListState();
    const existingAutoRead = existingState?.autoReadArticles || [];
    const existingManualRead = existingState?.manualReadArticles || [];

    // Build state object
    const state: Partial<ListState> = {
      articleIds: articleArray.map(a => a.id),
      readStates: articleArray.reduce((acc, article) => {
        acc[article.id] = article.isRead;
        return acc;
      }, {} as Record<string, boolean>),
      // Preserve existing session articles and add new ones
      autoReadArticles: [...new Set([
        ...existingAutoRead,
        ...articleArray
          .filter(a => a.isRead && sessionPreservedArticles.current.has(a.id))
          .map(a => a.id)
      ])],
      manualReadArticles: [...new Set([
        ...existingManualRead,
        ...articleArray
          .filter(a => a.isRead && !sessionPreservedArticles.current.has(a.id))
          .map(a => a.id)
      ])],
      scrollPosition,
      filterMode: readStatusFilter,
      feedId,
      folderId,
      tagId, // RR-163: Save tagId in state
      visibleRange,
    };

    articleListStateManager.saveListState(state);
  }, [articles, readStatusFilter, feedId, folderId, tagId, scrollContainerRef]); // RR-163: Add tagId

  // Enhanced article click handler with state preservation
  const handleArticleClick = useCallback((article: Article) => {
    // Save current state before navigation
    saveStateBeforeNavigation();
    
    // Track navigation
    navigationHistory.addEntry(`/article/${article.id}`, parseInt(article.id));
    
    // Don't mark as read here - let the server handle it
    // We'll track it as manually read when we navigate to the article detail page
    
    // Call original handler
    onArticleClick?.(article.id);
  }, [saveStateBeforeNavigation, onArticleClick]);

  // Determine if article should be shown based on filter and preservation state
  const shouldShowArticle = useCallback((article: Article) => {
    // In "all" or "read" filter, show everything normally
    if (readStatusFilter === 'all' || readStatusFilter === 'read') {
      return true;
    }
    
    // In "unread" filter, show unread articles and session-preserved read articles
    if (readStatusFilter === 'unread') {
      if (!article.isRead) {
        return true; // Always show unread articles
      }
      
      // For read articles, check if they're session-preserved
      const currentState = articleListStateManager.getListState();
      if (currentState && !articleListStateManager.isStateExpired()) {
        // Check if this article is preserved in the session
        const isAutoRead = currentState.autoReadArticles?.includes(article.id);
        const isManuallyReadInSession = currentState.manualReadArticles?.includes(article.id);
        
        // If the article is session-preserved, show it
        // This allows preserved articles to be visible even when switching between feeds
        if (isAutoRead || isManuallyReadInSession) {
          return true;
        }
      }
      
      // Not preserved, don't show read articles
      return false;
    }
    
    return true;
  }, [readStatusFilter]);

  // Get CSS classes for article including session-preserved state
  const getArticleClassName = useCallback((article: Article) => {
    const baseClasses = `relative cursor-pointer overflow-hidden p-4 transition-all duration-300 hover:bg-muted/50 sm:p-6`;
    
    let stateClasses = '';
    if (article.isRead) {
      // Check session state for proper styling
      const currentState = articleListStateManager.getListState();
      if (currentState && !articleListStateManager.isStateExpired()) {
        const isAutoRead = currentState.autoReadArticles?.includes(article.id);
        const isManuallyReadInSession = currentState.manualReadArticles?.includes(article.id);
        
        if (isAutoRead) {
          // Auto-read articles get special session-preserved styling
          stateClasses = 'opacity-85 session-preserved-read';
        } else if (isManuallyReadInSession) {
          // Manually read articles in session get standard read styling
          stateClasses = 'opacity-70';
        } else {
          // Normal read article (not session-preserved)
          stateClasses = 'opacity-70';
        }
      } else {
        // Fallback for legacy sessionPreservedArticles
        if (sessionPreservedArticles.current.has(article.id)) {
          stateClasses = 'opacity-85 session-preserved-read';
        } else {
          stateClasses = 'opacity-70';
        }
      }
    }
    
    return `${baseClasses} ${stateClasses}`.trim();
  }, []);

  // Restore state if available
  const restoreStateIfAvailable = useCallback(() => {
    if (hasRestoredState.current || restorationInProgress.current) {
      return false;
    }

    const savedState = articleListStateManager.getListState();
    if (!savedState || articleListStateManager.isStateExpired()) {
      return false;
    }

    // Check if we're on the same feed/folder/tag
    if (savedState.feedId !== feedId || savedState.folderId !== folderId || savedState.tagId !== tagId) {
      return false;
    }

    restorationInProgress.current = true;

    // Disable auto-mark observer during restoration
    if (autoMarkObserverRef.current) {
      autoMarkObserverRef.current.disconnect();
    }

    // Update session preserved articles (both auto-read and manually read)
    const allSessionArticles = [
      ...(savedState.autoReadArticles || []),
      ...(savedState.manualReadArticles || [])
    ];
    sessionPreservedArticles.current = new Set(allSessionArticles);

    // Schedule re-enabling of observer
    setTimeout(() => {
      restorationInProgress.current = false;
      // Observer will be recreated by the parent component
    }, 100);

    hasRestoredState.current = true;
    return true;
  }, [feedId, folderId, autoMarkObserverRef]);

  // Update auto-read tracking when articles are marked as read
  useEffect(() => {
    const handleAutoRead = (articleIds: string[]) => {
      articleIds.forEach(id => {
        sessionPreservedArticles.current.add(id);
        articleListStateManager.updateArticleState(id, {
          isRead: true,
          wasAutoRead: true,
        });
      });
    };

    // This would be connected to the auto-mark-as-read functionality
    // For now, we'll track it in the state manager
  }, []);

  // Check for external state clearing whenever articles change
  useEffect(() => {
    const state = articleListStateManager.getListState();
    if (!state && sessionPreservedArticles.current.size > 0) {
      console.log(`🔧 Detected external state clearing on articles change, clearing sessionRef (had ${sessionPreservedArticles.current.size} articles)`);
      sessionPreservedArticles.current = new Set();
    }
  }, [articles]);

  return {
    sessionPreservedArticles: sessionPreservedArticles.current,
    handleArticleClick,
    shouldShowArticle,
    getArticleClassName,
    saveStateBeforeNavigation,
    restoreStateIfAvailable,
  };
}