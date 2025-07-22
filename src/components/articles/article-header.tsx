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
  const { readStatusFilter } = useArticleStore();
  const { getFeed, getFolder } = useFeedStore();
  const [counts, setCounts] = useState<ArticleCounts>({ total: 0, unread: 0, read: 0 });
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
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

  return (
    <header className="border-b px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
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
          <h1 className="text-xl md:text-2xl font-semibold truncate">
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {getCountDisplay()}
          </p>
        </div>
      </div>
      
      {/* Read Status Filter */}
      <div className="flex-shrink-0">
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