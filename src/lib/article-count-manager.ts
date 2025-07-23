/**
 * Article Count Manager - Database-driven count caching
 * Based on PRD Section: Read Status Filtering with Database Counts
 * 
 * Provides accurate article counts from database with smart caching
 * for enhanced read status filtering performance.
 */

import { supabase } from '@/lib/db/supabase';

interface ArticleCounts {
  total: number;
  unread: number;
  read: number;
}

interface ArticleCountCache {
  counts: ArticleCounts;
  timestamp: number;
  feedId?: string;
  folderId?: string;
}

export class ArticleCountManager {
  private cache: Map<string, ArticleCountCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes as specified in PRD

  /**
   * Get counts from database with smart caching
   * Cache invalidation on user actions (mark read/unread)
   */
  async getArticleCounts(feedId?: string, folderId?: string): Promise<ArticleCounts> {
    const cacheKey = `${feedId || 'all'}-${folderId || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.counts;
    }
    
    // Fetch fresh counts from database
    const counts = await this.fetchCountsFromDatabase(feedId, folderId);
    
    // Update cache
    this.cache.set(cacheKey, {
      counts,
      timestamp: Date.now(),
      feedId,
      folderId
    });
    
    return counts;
  }

  /**
   * Fetch actual counts from Supabase database
   * Respects current feed/folder filters
   */
  private async fetchCountsFromDatabase(feedId?: string, folderId?: string): Promise<ArticleCounts> {
    try {
      // Get total count
      let totalQuery = supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });

      // Apply feed/folder filters to total count query
      if (feedId) {
        totalQuery = totalQuery.eq('feed_id', feedId);
      } else if (folderId) {
        // Get feeds in folder first
        const { data: feeds } = await supabase
          .from('feeds')
          .select('id')
          .eq('folder_id', folderId);
        
        const feedIds = feeds?.map(f => f.id) || [];
        if (feedIds.length === 0) {
          return { total: 0, unread: 0, read: 0 };
        }
        totalQuery = totalQuery.in('feed_id', feedIds);
      }
      
      const { count: total } = await totalQuery;
      
      // Get unread count with same filters
      let unreadQuery = supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (feedId) {
        unreadQuery = unreadQuery.eq('feed_id', feedId);
      } else if (folderId) {
        const { data: feeds } = await supabase
          .from('feeds')
          .select('id')
          .eq('folder_id', folderId);
        
        const feedIds = feeds?.map(f => f.id) || [];
        if (feedIds.length > 0) {
          unreadQuery = unreadQuery.in('feed_id', feedIds);
        }
      }
      
      const { count: unread } = await unreadQuery;
      
      return {
        total: total || 0,
        unread: unread || 0,
        read: (total || 0) - (unread || 0)
      };
    } catch (error) {
      console.error('Failed to fetch article counts:', error);
      return { total: 0, unread: 0, read: 0 };
    }
  }

  /**
   * Invalidate cache when articles change
   * Called after mark read/unread actions
   */
  invalidateCache(feedId?: string): void {
    if (feedId) {
      // Invalidate specific feed and 'all' cache
      const keysToDelete: string[] = [];
      this.cache.forEach((value, key) => {
        if (key.includes(feedId) || key.startsWith('all-')) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get counts for display based on read status filter
   * Used for dynamic header counts
   */
  getCountDisplay(counts: ArticleCounts, readStatusFilter: 'all' | 'unread' | 'read'): string {
    switch (readStatusFilter) {
      case 'unread':
        return `${counts.unread} unread articles`;
      case 'read':
        return `${counts.read} read articles`;
      case 'all':
        return `${counts.total} total articles (${counts.unread} unread)`;
      default:
        return `${counts.total} articles`;
    }
  }
}

/**
 * Get dynamic page title based on read status filter and feed selection
 * Simplified to show just "Articles" or the folder/feed name
 */
export const getDynamicPageTitle = (
  readStatusFilter: 'all' | 'unread' | 'read',
  selectedFeed?: { title: string },
  selectedFolder?: { title: string }
): string => {
  // Return folder or feed name directly, or "Articles" for all
  if (selectedFolder) {
    return selectedFolder.title;
  } else if (selectedFeed) {
    return selectedFeed.title;
  } else {
    return 'Articles';
  }
};

// Singleton instance for app-wide use
export const articleCountManager = new ArticleCountManager();