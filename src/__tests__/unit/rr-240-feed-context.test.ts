/**
 * Unit tests for RR-240: Feed Context Preservation
 * 
 * Test Requirements:
 * 1. SessionStorage structure changes - from flat array to objects with feedId
 * 2. markArticlesAsReadWithSession function storing feedId with preserved articles  
 * 3. getPreservedArticleIds function filtering by optional feedId parameter
 * 4. Backward compatibility with existing preserved articles without feedId
 * 
 * Testing through the public API of useArticleStore since markArticlesAsReadWithSession
 * is an internal function that's not exported.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Article } from '@/types/article';

// Mock Supabase client before importing modules that use it
vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
      insert: vi.fn(() => ({ data: [], error: null })),
      update: vi.fn(() => ({
        in: vi.fn(() => ({ data: [], error: null })),
        eq: vi.fn(() => ({ data: [], error: null })),
        data: [],
        error: null
      })),
      delete: vi.fn(() => ({ data: [], error: null })),
    })),
    rpc: vi.fn(() => ({ data: null, error: null })),
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'test-user' } } })),
    },
  },
}));

// Mock the article list state manager
vi.mock('@/lib/utils/article-list-state-manager', () => ({
  articleListStateManager: {
    getListState: vi.fn(),
    saveListState: vi.fn(),
  }
}));

// Mock performance monitor to avoid unnecessary noise in tests
vi.mock('@/lib/utils/performance-monitor', () => ({
  performanceMonitor: {
    startMeasure: vi.fn(),
    endMeasure: vi.fn(),
    logPerformance: vi.fn(),
  }
}));

// Mock localStorage state manager
vi.mock('@/lib/utils/localstorage-state-manager', () => ({
  localStorageStateManager: {
    getReadStatusFilter: vi.fn(() => 'unread'),
    saveReadStatusFilter: vi.fn(),
    batchMarkArticlesRead: vi.fn(() => Promise.resolve({ 
      success: true, 
      responseTime: 10, 
      fallbackUsed: false 
    })),
    markArticleRead: vi.fn(() => Promise.resolve({ 
      success: true, 
      responseTime: 10, 
      fallbackUsed: false 
    })),
    emergencyReset: vi.fn(),
  }
}));

// Mock article counter manager
vi.mock('@/lib/utils/article-counter-manager', () => ({
  articleCounterManager: {
    getCounts: vi.fn(() => ({ total: 0, unread: 0 })),
    updateCounts: vi.fn(),
    markArticleRead: vi.fn(),
    markArticleUnread: vi.fn(),
    invalidateCache: vi.fn(),
  }
}));

// Now import the store after mocks are set up
import { useArticleStore } from '@/lib/stores/article-store';
import { articleListStateManager } from '@/lib/utils/article-list-state-manager';
import { supabase } from '@/lib/db/supabase';

describe('RR-240: Feed Context Preservation', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.clear();
    }
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SessionStorage Structure with Feed Context', () => {
    it('should store preserved articles with feedId when marking as read in feed context', async () => {
      const feedId = 'feed-123';
      const mockArticles = [
        { 
          id: 'article-1', 
          feedId, 
          title: 'Article 1',
          isRead: false,
          isStarred: false,
          url: 'https://example.com/1'
        } as Article,
        { 
          id: 'article-2', 
          feedId, 
          title: 'Article 2',
          isRead: false,
          isStarred: false,
          url: 'https://example.com/2'
        } as Article
      ];

      // Mock Supabase responses
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      // Mock article list state manager to simulate feed context
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1', 'article-2'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId, // This is the key - context should have feedId
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      // Set up the store with articles in feed context
      act(() => {
        result.current.setSelectedFeed(feedId);
        // Convert array to Map for the store
        const articlesMap = new Map<string, Article>();
        mockArticles.forEach(article => articlesMap.set(article.id, article));
        result.current.articles = articlesMap;
      });

      // Mark an article as read
      await act(async () => {
        await result.current.markAsRead('article-1');
      });

      // Check that sessionStorage was updated with the new structure
      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      expect(preserved).toBeTruthy();
      
      const parsed = JSON.parse(preserved!);
      expect(parsed).toBeInstanceOf(Array);
      
      // Verify the new structure includes feedId
      const preservedItem = parsed.find((item: any) => item.id === 'article-1');
      expect(preservedItem).toBeDefined();
      expect(preservedItem).toHaveProperty('id', 'article-1');
      expect(preservedItem).toHaveProperty('feedId', feedId);
      expect(preservedItem).toHaveProperty('timestamp');
      expect(typeof preservedItem.timestamp).toBe('number');
    });

    it('should handle articles from different feeds with separate feedIds', async () => {
      // Mock different feed contexts
      const feed1Id = 'feed-1';
      const feed2Id = 'feed-2';

      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      const { result } = renderHook(() => useArticleStore());

      // First, mark articles from feed-1
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1', 'article-2'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId: feed1Id,
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      act(() => {
        result.current.setSelectedFeed(feed1Id);
        const articlesMap = new Map<string, Article>();
        articlesMap.set('article-1', { id: 'article-1', feedId: feed1Id, isRead: false } as Article);
        articlesMap.set('article-2', { id: 'article-2', feedId: feed1Id, isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      await act(async () => {
        await result.current.markMultipleAsRead(['article-1', 'article-2']);
      });

      // Then mark articles from feed-2
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-3', 'article-4'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId: feed2Id,
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      act(() => {
        result.current.setSelectedFeed(feed2Id);
        const articlesMap2 = new Map<string, Article>();
        articlesMap2.set('article-3', { id: 'article-3', feedId: feed2Id, isRead: false } as Article);
        articlesMap2.set('article-4', { id: 'article-4', feedId: feed2Id, isRead: false } as Article);
        result.current.articles = articlesMap2;
      });

      await act(async () => {
        await result.current.markMultipleAsRead(['article-3', 'article-4']);
      });

      // Verify sessionStorage contains articles from both feeds with correct feedIds
      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      const parsed = JSON.parse(preserved!);
      
      const feed1Articles = parsed.filter((item: any) => item.feedId === feed1Id);
      const feed2Articles = parsed.filter((item: any) => item.feedId === feed2Id);
      
      expect(feed1Articles.length).toBeGreaterThanOrEqual(2);
      expect(feed2Articles.length).toBeGreaterThanOrEqual(2);
      
      // Verify specific articles have correct feedIds
      expect(feed1Articles.some((a: any) => a.id === 'article-1')).toBe(true);
      expect(feed1Articles.some((a: any) => a.id === 'article-2')).toBe(true);
      expect(feed2Articles.some((a: any) => a.id === 'article-3')).toBe(true);
      expect(feed2Articles.some((a: any) => a.id === 'article-4')).toBe(true);
    });

    it('should preserve feedId from context even when article has different feedId', async () => {
      const contextFeedId = 'context-feed-456';
      const articleFeedId = 'article-feed-789';

      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      // Set up context with specific feedId
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId: contextFeedId, // Context feedId
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        result.current.setSelectedFeed(contextFeedId);
        // Article has different feedId than context
        const articlesMap = new Map<string, Article>();
        articlesMap.set('article-1', { id: 'article-1', feedId: articleFeedId, isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      await act(async () => {
        await result.current.markAsRead('article-1');
      });

      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      const parsed = JSON.parse(preserved!);
      
      // The preserved article should have the context feedId, not the article's feedId
      const preservedArticle = parsed.find((item: any) => item.id === 'article-1');
      expect(preservedArticle).toBeDefined();
      expect(preservedArticle.feedId).toBe(contextFeedId);
    });
  });

  describe('getPreservedArticleIds Function Filtering', () => {
    // Helper function to simulate getPreservedArticleIds behavior
    const getPreservedArticleIds = (feedId?: string): string[] => {
      try {
        const preservedIds = window.sessionStorage.getItem('preserved_article_ids');
        if (preservedIds) {
          const parsed = JSON.parse(preservedIds);
          const now = Date.now();
          
          let validItems = parsed.filter((item: any) => {
            if (typeof item === 'string') return true; // Legacy format
            return item.timestamp && now - item.timestamp < 30 * 60 * 1000;
          });

          // Filter by feedId if provided
          if (feedId) {
            validItems = validItems.filter((item: any) => {
              // Legacy items (strings) don't have feedId, exclude them when filtering
              if (typeof item === 'string') return false;
              return item.feedId === feedId;
            });
          }

          return validItems.map((item: any) => 
            typeof item === 'string' ? item : item.id
          );
        }
        return [];
      } catch {
        return [];
      }
    };

    it('should return all preserved article IDs when no feedId is provided', () => {
      const preservedData = [
        { id: 'article-1', feedId: 'feed-1', timestamp: Date.now() },
        { id: 'article-2', feedId: 'feed-2', timestamp: Date.now() },
        { id: 'article-3', feedId: 'feed-1', timestamp: Date.now() }
      ];

      window.sessionStorage.setItem('preserved_article_ids', JSON.stringify(preservedData));

      const result = getPreservedArticleIds();
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['article-1', 'article-2', 'article-3']));
    });

    it('should filter preserved article IDs by feedId when provided', () => {
      const preservedData = [
        { id: 'article-1', feedId: 'feed-1', timestamp: Date.now() },
        { id: 'article-2', feedId: 'feed-2', timestamp: Date.now() },
        { id: 'article-3', feedId: 'feed-1', timestamp: Date.now() },
        { id: 'article-4', feedId: 'feed-3', timestamp: Date.now() }
      ];

      window.sessionStorage.setItem('preserved_article_ids', JSON.stringify(preservedData));

      const feed1Articles = getPreservedArticleIds('feed-1');
      expect(feed1Articles).toHaveLength(2);
      expect(feed1Articles).toEqual(expect.arrayContaining(['article-1', 'article-3']));

      const feed2Articles = getPreservedArticleIds('feed-2');
      expect(feed2Articles).toHaveLength(1);
      expect(feed2Articles).toEqual(['article-2']);

      const feed3Articles = getPreservedArticleIds('feed-3');
      expect(feed3Articles).toHaveLength(1);
      expect(feed3Articles).toEqual(['article-4']);

      const noFeedArticles = getPreservedArticleIds('non-existent-feed');
      expect(noFeedArticles).toHaveLength(0);
    });

    it('should exclude expired articles (older than 30 minutes)', () => {
      const now = Date.now();
      const preservedData = [
        { id: 'article-1', feedId: 'feed-1', timestamp: now }, // Current
        { id: 'article-2', feedId: 'feed-1', timestamp: now - 25 * 60 * 1000 }, // 25 minutes old
        { id: 'article-3', feedId: 'feed-1', timestamp: now - 35 * 60 * 1000 }, // 35 minutes old (expired)
      ];

      window.sessionStorage.setItem('preserved_article_ids', JSON.stringify(preservedData));

      const result = getPreservedArticleIds('feed-1');
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(['article-1', 'article-2']));
      expect(result).not.toContain('article-3');
    });
  });

  describe('Backward Compatibility', () => {
    // Helper function for testing
    const getPreservedArticleIds = (feedId?: string): string[] => {
      try {
        const preservedIds = window.sessionStorage.getItem('preserved_article_ids');
        if (preservedIds) {
          const parsed = JSON.parse(preservedIds);
          const now = Date.now();
          
          let validItems = parsed.filter((item: any) => {
            if (typeof item === 'string') return true; // Legacy format
            return item.timestamp && now - item.timestamp < 30 * 60 * 1000;
          });

          if (feedId) {
            validItems = validItems.filter((item: any) => {
              if (typeof item === 'string') return false;
              return item.feedId === feedId;
            });
          }

          return validItems.map((item: any) => 
            typeof item === 'string' ? item : item.id
          );
        }
        return [];
      } catch {
        return [];
      }
    };

    it('should handle legacy flat array format (strings only)', () => {
      // Old format: just an array of strings
      const legacyData = ['article-1', 'article-2', 'article-3'];
      window.sessionStorage.setItem('preserved_article_ids', JSON.stringify(legacyData));

      const result = getPreservedArticleIds();
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['article-1', 'article-2', 'article-3']));
    });

    it('should handle mixed legacy and new format', () => {
      const mixedData = [
        'legacy-article-1', // Legacy string format
        { id: 'new-article-1', feedId: 'feed-1', timestamp: Date.now() }, // New format
        'legacy-article-2',
        { id: 'new-article-2', feedId: 'feed-2', timestamp: Date.now() }
      ];

      window.sessionStorage.setItem('preserved_article_ids', JSON.stringify(mixedData));

      // Without feedId filter, should return all
      const allArticles = getPreservedArticleIds();
      expect(allArticles).toHaveLength(4);
      expect(allArticles).toEqual(expect.arrayContaining([
        'legacy-article-1', 
        'legacy-article-2', 
        'new-article-1', 
        'new-article-2'
      ]));

      // With feedId filter, should only return new format items with matching feedId
      const feed1Articles = getPreservedArticleIds('feed-1');
      expect(feed1Articles).toHaveLength(1);
      expect(feed1Articles).toEqual(['new-article-1']);

      // Legacy articles are excluded when filtering by feedId
      expect(feed1Articles).not.toContain('legacy-article-1');
      expect(feed1Articles).not.toContain('legacy-article-2');
    });

    it('should migrate legacy format to new format when marking articles as read', async () => {
      // Start with legacy data
      const legacyData = ['old-article-1', 'old-article-2'];
      window.sessionStorage.setItem('preserved_article_ids', JSON.stringify(legacyData));

      const feedId = 'feed-123';
      
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['new-article-1'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId,
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        result.current.setSelectedFeed(feedId);
        const articlesMap = new Map<string, Article>();
        articlesMap.set('new-article-1', { id: 'new-article-1', feedId, isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      await act(async () => {
        await result.current.markAsRead('new-article-1');
      });

      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      const parsed = JSON.parse(preserved!);

      // Should contain both legacy and new items
      expect(parsed.length).toBeGreaterThanOrEqual(3);

      // New items should have the new structure
      const newItem = parsed.find((item: any) => 
        typeof item === 'object' && item.id === 'new-article-1'
      );
      expect(newItem).toBeDefined();
      expect(newItem.feedId).toBe(feedId);
      expect(newItem.timestamp).toBeDefined();

      // Legacy items should be migrated with timestamp
      const migratedLegacyItems = parsed.filter((item: any) => 
        typeof item === 'object' && (item.id === 'old-article-1' || item.id === 'old-article-2')
      );
      expect(migratedLegacyItems.length).toBe(2);
      migratedLegacyItems.forEach((item: any) => {
        expect(item.timestamp).toBeDefined();
        // Legacy items won't have feedId after migration
        expect(item.feedId).toBeUndefined();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle articles without feedId in context', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      // Context without feedId (viewing all articles)
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId: undefined, // No feedId in context
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        const articlesMap = new Map<string, Article>();
        articlesMap.set('article-1', { id: 'article-1', feedId: 'article-feed', isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      await act(async () => {
        await result.current.markAsRead('article-1');
      });

      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      const parsed = JSON.parse(preserved!);
      
      // Should store article with undefined feedId when context has no feedId
      const preservedArticle = parsed.find((item: any) => item.id === 'article-1');
      expect(preservedArticle).toBeDefined();
      expect(preservedArticle.id).toBe('article-1');
      expect(preservedArticle.feedId).toBeUndefined();
    });

    it('should limit preserved articles to prevent unbounded growth', async () => {
      // Create more than 50 articles
      const articleIds = Array.from({ length: 60 }, (_, i) => `article-${i}`);
      const articles = articleIds.map(id => ({ 
        id, 
        feedId: 'feed-1', 
        isRead: false 
      } as Article));

      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds,
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId: 'feed-1',
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        result.current.setSelectedFeed('feed-1');
        const articlesMap = new Map<string, Article>();
        articles.forEach(article => articlesMap.set(article.id, article));
        result.current.articles = articlesMap;
      });

      await act(async () => {
        await result.current.markMultipleAsRead(articleIds);
      });

      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      const parsed = JSON.parse(preserved!);
      
      // Should be limited to 50 most recent
      expect(parsed.length).toBeLessThanOrEqual(50);
    });

    it('should handle sessionStorage quota exceeded errors gracefully', async () => {
      // Mock sessionStorage.setItem to throw quota exceeded error
      const originalSetItem = window.sessionStorage.setItem;
      window.sessionStorage.setItem = vi.fn().mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        const articlesMap = new Map<string, Article>();
        articlesMap.set('article-1', { id: 'article-1', feedId: 'feed-1', isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      // Should not throw, but handle error gracefully
      await expect(
        act(async () => {
          await result.current.markAsRead('article-1');
        })
      ).resolves.not.toThrow();

      // Restore original setItem
      window.sessionStorage.setItem = originalSetItem;
    });
  });

  describe('Integration with Article Store', () => {
    it('should preserve feed context across navigation', async () => {
      const feed1Id = 'feed-1';
      
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      // Set up feed-1 context
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1', 'article-2'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId: feed1Id,
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        result.current.setSelectedFeed(feed1Id);
        const articlesMap = new Map<string, Article>();
        articlesMap.set('article-1', { id: 'article-1', feedId: feed1Id, isRead: false } as Article);
        articlesMap.set('article-2', { id: 'article-2', feedId: feed1Id, isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      // Mark articles as read with auto-read (simulating scroll behavior)
      await act(async () => {
        await result.current.markMultipleAsRead(['article-1', 'article-2']);
      });

      // Helper to get preserved IDs filtered by feed
      const getPreservedArticleIds = (feedId?: string): string[] => {
        try {
          const preservedIds = window.sessionStorage.getItem('preserved_article_ids');
          if (preservedIds) {
            const parsed = JSON.parse(preservedIds);
            const now = Date.now();
            
            let validItems = parsed.filter((item: any) => {
              if (typeof item === 'string') return true;
              return item.timestamp && now - item.timestamp < 30 * 60 * 1000;
            });

            if (feedId) {
              validItems = validItems.filter((item: any) => {
                if (typeof item === 'string') return false;
                return item.feedId === feedId;
              });
            }

            return validItems.map((item: any) => 
              typeof item === 'string' ? item : item.id
            );
          }
          return [];
        } catch {
          return [];
        }
      };

      // When viewing feed-1, should only get feed-1 preserved articles
      const feed1PreservedIds = getPreservedArticleIds(feed1Id);
      expect(feed1PreservedIds).toEqual(expect.arrayContaining(['article-1', 'article-2']));

      // When viewing a different feed, should not get feed-1 articles
      const feed2PreservedIds = getPreservedArticleIds('feed-2');
      expect(feed2PreservedIds).toEqual([]);

      // When viewing all articles (no feed filter), should get all preserved
      const allPreservedIds = getPreservedArticleIds();
      expect(allPreservedIds).toEqual(expect.arrayContaining(['article-1', 'article-2']));
    });

    it('should maintain separate preserved articles for different mark types in same feed', async () => {
      const feedId = 'feed-1';
      
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: null 
      });

      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1', 'article-2', 'article-3', 'article-4'],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId,
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      const { result } = renderHook(() => useArticleStore());

      act(() => {
        result.current.setSelectedFeed(feedId);
        const articlesMap = new Map<string, Article>();
        articlesMap.set('article-1', { id: 'article-1', feedId, isRead: false } as Article);
        articlesMap.set('article-2', { id: 'article-2', feedId, isRead: false } as Article);
        articlesMap.set('article-3', { id: 'article-3', feedId, isRead: false } as Article);
        articlesMap.set('article-4', { id: 'article-4', feedId, isRead: false } as Article);
        result.current.articles = articlesMap;
      });

      // Mark some articles as read (simulating different marking behaviors)
      await act(async () => {
        await result.current.markMultipleAsRead(['article-1', 'article-2']);
      });

      // Update the mock to simulate auto-read articles
      vi.mocked(articleListStateManager.getListState).mockReturnValue({
        articleIds: ['article-1', 'article-2', 'article-3', 'article-4'],
        readStates: { 'article-1': true, 'article-2': true },
        autoReadArticles: ['article-1', 'article-2'],
        manualReadArticles: [],
        scrollPosition: 0,
        timestamp: Date.now().toString(),
        filterMode: 'unread',
        feedId,
        folderId: undefined,
        expiresAt: (Date.now() + 30 * 60 * 1000).toString(),
      });

      // Mark others manually
      await act(async () => {
        await result.current.markMultipleAsRead(['article-3', 'article-4']);
      });

      const preserved = window.sessionStorage.getItem('preserved_article_ids');
      const parsed = JSON.parse(preserved!);
      
      // All should have the same feedId
      const feedArticles = parsed.filter((item: any) => item.feedId === feedId);
      expect(feedArticles.length).toBeGreaterThanOrEqual(4);
      
      // All article IDs should be preserved with correct feedId
      const ids = feedArticles.map((item: any) => item.id);
      expect(ids).toEqual(expect.arrayContaining(['article-1', 'article-2', 'article-3', 'article-4']));
    });
  });
});