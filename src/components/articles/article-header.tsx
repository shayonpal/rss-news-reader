/**
 * Article Header Component with Database-Driven Counts
 * Based on PRD Section: Read Status Filtering with Database Counts
 * 
 * Displays dynamic page titles and accurate article counts from database
 * with 5-minute caching for performance optimization.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { ReadStatusFilter } from './read-status-filter';
import { useArticleStore } from '@/lib/stores/article-store';
import { useFeedStore } from '@/lib/stores/feed-store';
import { ArticleCountManager, getDynamicPageTitle } from '@/lib/article-count-manager';
import { Button } from '@/components/ui/button';
import { CheckCheck, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Feed, Folder } from '@/types';

interface ArticleCounts {
  total: number;
  unread: number;
  read: number;
}

interface ArticleHeaderProps {
  selectedFeedId?: string | null;
  selectedFolderId?: string | null;
  isMobile?: boolean;
  onMenuClick?: () => void;
  menuIcon?: React.ReactNode;
}

export function ArticleHeader({ 
  selectedFeedId, 
  selectedFolderId,
  isMobile = false,
  onMenuClick,
  menuIcon
}: ArticleHeaderProps) {
  const { readStatusFilter, markAllAsRead, refreshArticles } = useArticleStore();
  const { getFeed, getFolder } = useFeedStore();
  const [counts, setCounts] = useState<ArticleCounts>({ total: 0, unread: 0, read: 0 });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countManager = useRef(new ArticleCountManager());
  
  // Get selected feed/folder objects
  const selectedFeed = selectedFeedId ? getFeed(selectedFeedId) : undefined;
  const selectedFolder = selectedFolderId ? getFolder(selectedFolderId) : undefined;

  // Fetch counts when filters change
  useEffect(() => {
    const fetchCounts = async () => {
      setIsLoadingCounts(true);
      try {
        const newCounts = await countManager.current.getArticleCounts(
          selectedFeedId || undefined,
          selectedFolderId || undefined
        );
        setCounts(newCounts);
      } catch (error) {
        console.error('Failed to fetch article counts:', error);
        // Fallback to zero counts on error
        setCounts({ total: 0, unread: 0, read: 0 });
      } finally {
        setIsLoadingCounts(false);
      }
    };
    
    fetchCounts();
  }, [readStatusFilter, selectedFeedId, selectedFolderId]);

  // Function to invalidate cache on article actions
  const handleArticleAction = () => {
    countManager.current.invalidateCache(selectedFeedId || undefined);
  };

  // Expose cache invalidation to parent components
  useEffect(() => {
    // Store reference for external cache invalidation
    (window as any).__articleCountManager = countManager.current;
    
    return () => {
      delete (window as any).__articleCountManager;
    };
  }, []);

  // Get dynamic title based on PRD specifications
  // Use state to avoid hydration mismatch
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    setHydrated(true);
  }, []);
  
  const pageTitle = hydrated 
    ? getDynamicPageTitle(readStatusFilter, selectedFeed, selectedFolder)
    : 'Articles'; // Safe fallback during SSR

  // Get count display based on filter
  const getCountDisplay = () => {
    if (!hydrated || isLoadingCounts) {
      return 'Loading counts...';
    }
    
    return countManager.current.getCountDisplay(counts, readStatusFilter);
  };

  // Clear confirmation timeout on unmount
  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  // Handle mark all as read button click
  const handleMarkAllClick = async () => {
    if (!selectedFeedId || isMarkingAllRead) return;
    
    // First click - show confirmation state
    if (!waitingConfirmation) {
      setWaitingConfirmation(true);
      
      // Auto-cancel confirmation after 3 seconds
      confirmTimeoutRef.current = setTimeout(() => {
        setWaitingConfirmation(false);
      }, 3000);
      
      return;
    }
    
    // Second click - execute action
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }
    
    setWaitingConfirmation(false);
    setIsMarkingAllRead(true);
    
    try {
      await markAllAsRead(selectedFeedId);
      
      // Invalidate cache to refresh counts
      countManager.current.invalidateCache(selectedFeedId);
      
      // Refresh the article list to show updated read status
      await refreshArticles();
      
      // Re-fetch counts
      const newCounts = await countManager.current.getArticleCounts(
        selectedFeedId,
        selectedFolderId || undefined
      );
      setCounts(newCounts);
      
      toast.success(`Marked all articles as read in ${selectedFeed?.title || 'feed'}`);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all articles as read');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <header className="border-b px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 pwa-safe-area-top">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile Menu Button */}
        {isMobile && onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-muted rounded-lg flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            {menuIcon}
          </button>
        )}
        
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold break-words">
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {getCountDisplay()}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mark All Read Button - only show for specific feeds with unread articles */}
        {selectedFeedId && counts.unread > 0 && (
          <Button
            variant={waitingConfirmation ? "destructive" : "outline"}
            size="sm"
            onClick={handleMarkAllClick}
            disabled={isMarkingAllRead}
            className={waitingConfirmation ? "gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 border-red-500/50" : "gap-1.5"}
            title={waitingConfirmation ? "Click again to confirm" : "Mark all articles in this feed as read"}
          >
            {isMarkingAllRead ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Marking...</span>
              </>
            ) : waitingConfirmation ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Confirm?</span>
              </>
            ) : (
              <>
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark All Read</span>
              </>
            )}
          </Button>
        )}
        
        {/* Read Status Filter */}
        <ReadStatusFilter />
      </div>
    </header>
  );
}

/**
 * Hook for invalidating article counts cache
 * Use this after marking articles as read/unread
 */
export function useArticleCountInvalidation() {
  return {
    invalidateCache: (feedId?: string) => {
      const manager = (window as any).__articleCountManager as ArticleCountManager;
      if (manager) {
        manager.invalidateCache(feedId);
      }
    }
  };
}