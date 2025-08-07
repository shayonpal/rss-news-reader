import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useArticleStore } from '@/lib/stores/article-store';
import { StatusChangeLogger } from '@/lib/logging/status-change-logger';
import { supabase } from '@/lib/db/supabase';
import type { Article } from '@/types';

// Mock dependencies
vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

vi.mock('@/lib/logging/status-change-logger', () => ({
  StatusChangeLogger: {
    getInstance: vi.fn(() => ({
      logStatusChange: vi.fn(),
      batchLogStatusChanges: vi.fn(),
    })),
  },
}));

describe('Article Store Logging Integration - RR-29', () => {
  let store: any;
  let mockLogger: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = StatusChangeLogger.getInstance();
    
    // Reset the store to initial state
    store = useArticleStore.getState();
    store.articles.clear();
    
    // Add a test article
    const testArticle: Article = {
      id: 'article-123',
      feedId: 'feed-456',
      title: 'Test Article',
      content: 'Test content',
      url: 'https://example.com/test',
      tags: [],
      publishedAt: new Date(),
      author: 'Test Author',
      authorName: 'Test Author',
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      inoreaderItemId: 'inoreader-789',
      fullContentUrl: 'https://example.com/test',
      hasFullContent: false,
      isPartial: false,
      feedTitle: 'Test Feed',
    };
    
    store.articles.set('article-123', testArticle);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('markAsRead with Trigger Logging', () => {
    it('should log status change with user_click trigger', async () => {
      const article = store.articles.get('article-123');
      
      await store.markAsRead('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith({
        timestamp: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        articleId: 'article-123',
        feedId: 'feed-456',
        action: 'mark_read',
        trigger: 'user_click',
        previousValue: false,
        newValue: true,
        syncQueued: true,
        userAgent: expect.stringMatching(/Mozilla/),
        sessionId: expect.any(String),
        offline: false,
        viewportWidth: expect.any(Number),
        viewportHeight: expect.any(Number),
        devicePixelRatio: expect.any(Number),
      });
    });

    it('should log with auto_scroll trigger for auto-detected reads', async () => {
      await store.markAsRead('article-123', 'auto_scroll');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'mark_read',
          trigger: 'auto_scroll',
          previousValue: false,
          newValue: true,
        })
      );
    });

    it('should default to user_click trigger when not specified', async () => {
      await store.markAsRead('article-123');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'user_click',
        })
      );
    });

    it('should not log if article is already read', async () => {
      // Mark article as read first
      const article = store.articles.get('article-123');
      article.isRead = true;
      store.articles.set('article-123', article);
      
      await store.markAsRead('article-123');
      
      expect(mockLogger.logStatusChange).not.toHaveBeenCalled();
    });

    it('should log sync queue status accurately', async () => {
      // Mock successful sync queue addition
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: null });
      
      await store.markAsRead('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          syncQueued: true,
        })
      );
    });

    it('should log sync queue failure', async () => {
      // Mock sync queue addition failure
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ error: new Error('Queue full') });
      
      await store.markAsRead('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          syncQueued: false,
          syncError: 'Queue full',
        })
      );
    });
  });

  describe('markAsUnread with Trigger Logging', () => {
    beforeEach(() => {
      // Start with a read article
      const article = store.articles.get('article-123');
      article.isRead = true;
      store.articles.set('article-123', article);
    });

    it('should log status change with user_click trigger', async () => {
      await store.markAsUnread('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'mark_unread',
          trigger: 'user_click',
          previousValue: true,
          newValue: false,
        })
      );
    });

    it('should not log if article is already unread', async () => {
      // Make article unread first
      const article = store.articles.get('article-123');
      article.isRead = false;
      store.articles.set('article-123', article);
      
      await store.markAsUnread('article-123');
      
      expect(mockLogger.logStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('toggleStar with Trigger Logging', () => {
    it('should log starring action', async () => {
      await store.toggleStar('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'star',
          trigger: 'user_click',
          previousValue: false,
          newValue: true,
        })
      );
    });

    it('should log unstarring action', async () => {
      // Start with starred article
      const article = store.articles.get('article-123');
      article.tags = ['starred'];
      store.articles.set('article-123', article);
      
      await store.toggleStar('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'unstar',
          trigger: 'user_click',
          previousValue: true,
          newValue: false,
        })
      );
    });
  });

  describe('markMultipleAsRead with Batch Logging', () => {
    beforeEach(() => {
      // Add multiple articles
      for (let i = 1; i <= 5; i++) {
        const article: Article = {
          id: `article-${i}`,
          feedId: 'feed-456',
          title: `Test Article ${i}`,
          content: 'Test content',
          url: `https://example.com/test${i}`,
          tags: [],
          publishedAt: new Date(),
          author: 'Test Author',
          authorName: 'Test Author',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          inoreaderItemId: `inoreader-${i}`,
          fullContentUrl: `https://example.com/test${i}`,
          hasFullContent: false,
          isPartial: false,
          feedTitle: 'Test Feed',
        };
        store.articles.set(`article-${i}`, article);
      }
    });

    it('should batch log multiple status changes', async () => {
      const articleIds = ['article-1', 'article-2', 'article-3'];
      
      await store.markMultipleAsRead(articleIds, 'auto_scroll');
      
      expect(mockLogger.batchLogStatusChanges).toHaveBeenCalledWith(
        articleIds.map(id => expect.objectContaining({
          articleId: id,
          action: 'mark_read',
          trigger: 'auto_scroll',
          previousValue: false,
          newValue: true,
        }))
      );
    });

    it('should filter out already read articles from batch logging', async () => {
      // Mark one article as already read
      const article = store.articles.get('article-2');
      article.isRead = true;
      store.articles.set('article-2', article);
      
      const articleIds = ['article-1', 'article-2', 'article-3'];
      
      await store.markMultipleAsRead(articleIds, 'auto_scroll');
      
      expect(mockLogger.batchLogStatusChanges).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ articleId: 'article-1' }),
          expect.objectContaining({ articleId: 'article-3' }),
        ])
      );
      
      // Should not include article-2
      expect(mockLogger.batchLogStatusChanges).toHaveBeenCalledWith(
        expect.not.arrayContaining([
          expect.objectContaining({ articleId: 'article-2' }),
        ])
      );
    });
  });

  describe('markAllAsRead with Bulk Logging', () => {
    it('should log bulk operation with batch_action trigger', async () => {
      // Mock database response
      const mockMarkedArticles = [
        { id: 'article-1', inoreader_id: 'inoreader-1' },
        { id: 'article-2', inoreader_id: 'inoreader-2' },
        { id: 'article-3', inoreader_id: 'inoreader-3' },
      ];
      
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: mockMarkedArticles,
                error: null,
              }),
            }),
          }),
        }),
      } as any);
      
      await store.markAllAsRead('feed-456');
      
      expect(mockLogger.batchLogStatusChanges).toHaveBeenCalledWith(
        mockMarkedArticles.map(article => expect.objectContaining({
          articleId: article.id,
          action: 'mark_read',
          trigger: 'batch_action',
          previousValue: false,
          newValue: true,
        }))
      );
    });
  });

  describe('Client Context Capture', () => {
    it('should capture comprehensive client context', async () => {
      // Mock browser environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        configurable: true,
      });
      
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      });
      
      Object.defineProperty(window, 'innerWidth', {
        value: 1920,
        configurable: true,
      });
      
      Object.defineProperty(window, 'innerHeight', {
        value: 1080,
        configurable: true,
      });
      
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        configurable: true,
      });
      
      await store.markAsRead('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          offline: false,
          viewportWidth: 1920,
          viewportHeight: 1080,
          devicePixelRatio: 2,
          sessionId: expect.stringMatching(/^session-/),
        })
      );
    });

    it('should handle offline status correctly', async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      
      await store.markAsRead('article-123', 'user_click');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          offline: true,
        })
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without trigger parameter', async () => {
      // Call method without trigger parameter
      await store.markAsRead('article-123');
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'user_click', // Should default to user_click
        })
      );
    });

    it('should preserve existing method signatures', () => {
      // Test that methods can be called with original signatures
      expect(() => {
        store.markAsRead('article-123');
        store.markAsUnread('article-123');
        store.toggleStar('article-123');
      }).not.toThrow();
    });
  });
});