import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncArticles } from '@/lib/sync/sync-service';
import { getUserPreferences } from '@/lib/services/preferences';
import { createClient } from '@/lib/supabase/server';
import { retainArticles } from '@/lib/sync/article-retention';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/services/preferences');
vi.mock('@/lib/sync/article-retention');
vi.mock('@/lib/services/inoreader', () => ({
  fetchArticles: vi.fn(),
  getSubscriptions: vi.fn()
}));

import { fetchArticles, getSubscriptions } from '@/lib/services/inoreader';

describe('Sync Service Configuration (RR-274)', () => {
  const mockUserId = 'test-user-123';
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(mockSupabase as any);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Max Articles Limit', () => {
    it('should fetch only maxArticles from Inoreader', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 50, retentionCount: 2000 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [
          { id: 'feed-1', title: 'Feed 1' },
          { id: 'feed-2', title: 'Feed 2' }
        ]
      });

      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: 'next-page-token'
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 50 },
            error: null
          })
        })
      });

      const result = await syncArticles(mockUserId);

      expect(fetchArticles).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 50,
          userId: mockUserId
        })
      );
      expect(result.articlesAdded).toBe(50);
      expect(result.error).toBeNull();
    });

    it('should handle continuation tokens correctly', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 150, retentionCount: 2000 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      // First page
      vi.mocked(fetchArticles).mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: 'page-2-token'
      });

      // Second page (should fetch only 50 more)
      vi.mocked(fetchArticles).mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `article-${100 + i}`,
          title: `Article ${100 + i}`,
          published: Date.now() - (100 + i) * 1000
        })),
        continuation: 'page-3-token'
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 150 },
            error: null
          })
        })
      });

      const result = await syncArticles(mockUserId);

      expect(fetchArticles).toHaveBeenCalledTimes(2);
      expect(result.articlesAdded).toBe(150);
    });

    it('should stop fetching when limit reached', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 75, retentionCount: 2000 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      // Mock returns 100 articles but we should stop at 75
      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: 'next-page'
      });

      let insertedArticles: any[] = [];
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn((articles) => {
          insertedArticles = articles;
          return {
            select: vi.fn().mockResolvedValue({
              data: { count: articles.length },
              error: null
            })
          };
        })
      });

      await syncArticles(mockUserId);

      expect(insertedArticles.length).toBeLessThanOrEqual(75);
    });

    it('should apply limit per-feed in multi-feed sync', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 100, retentionCount: 2000 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [
          { id: 'feed-1', title: 'Feed 1' },
          { id: 'feed-2', title: 'Feed 2' },
          { id: 'feed-3', title: 'Feed 3' }
        ]
      });

      // Each feed should get approximately 33 articles (100/3)
      vi.mocked(fetchArticles).mockImplementation(({ feedId }) => {
        const feedIndex = parseInt(feedId.split('-')[1]);
        return Promise.resolve({
          items: Array.from({ length: 33 }, (_, i) => ({
            id: `article-${feedId}-${i}`,
            title: `Article ${i} from ${feedId}`,
            published: Date.now() - i * 1000
          })),
          continuation: null
        });
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 33 },
            error: null
          })
        })
      });

      const result = await syncArticles(mockUserId);

      expect(fetchArticles).toHaveBeenCalledTimes(3);
      expect(result.articlesAdded).toBeLessThanOrEqual(100);
    });

    it('should update limit dynamically from preferences', async () => {
      // First sync with limit 50
      vi.mocked(getUserPreferences).mockResolvedValueOnce({
        sync: { maxArticles: 50, retentionCount: 2000 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: null
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 50 },
            error: null
          })
        })
      });

      await syncArticles(mockUserId);
      expect(fetchArticles).toHaveBeenCalledWith(
        expect.objectContaining({ count: 50 })
      );

      // Second sync with updated limit 100
      vi.mocked(getUserPreferences).mockResolvedValueOnce({
        sync: { maxArticles: 100, retentionCount: 2000 },
        ai: { enabled: false }
      });

      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `article-new-${i}`,
          title: `New Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: null
      });

      await syncArticles(mockUserId);
      expect(fetchArticles).toHaveBeenLastCalledWith(
        expect.objectContaining({ count: 100 })
      );
    });
  });

  describe('Sync and Retention Coordination', () => {
    it('should trigger retention after successful sync', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 100, retentionCount: 500 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: null
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 100 },
            error: null
          })
        })
      });

      vi.mocked(retainArticles).mockResolvedValue({
        deletedCount: 50,
        retainedCount: 500,
        preservedStarredCount: 0,
        error: null
      });

      const result = await syncArticles(mockUserId);

      expect(retainArticles).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          maxCount: 500,
          preserveStarred: true
        })
      );
      expect(result.articlesDeleted).toBe(50);
    });

    it('should handle sync failure without retention', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 100, retentionCount: 500 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockRejectedValue(
        new Error('Network error')
      );

      const result = await syncArticles(mockUserId);

      expect(retainArticles).not.toHaveBeenCalled();
      expect(result.error).toContain('Network error');
      expect(result.articlesDeleted).toBe(0);
    });

    it('should prevent retention during active sync', async () => {
      const syncLock = { acquired: false };

      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 100, retentionCount: 500 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      vi.mocked(fetchArticles).mockImplementation(async () => {
        syncLock.acquired = true;
        // Simulate long-running sync
        await new Promise(resolve => setTimeout(resolve, 100));
        syncLock.acquired = false;
        return {
          items: Array.from({ length: 50 }, (_, i) => ({
            id: `article-${i}`,
            title: `Article ${i}`,
            published: Date.now() - i * 1000
          })),
          continuation: null
        };
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 50 },
            error: null
          })
        })
      });

      vi.mocked(retainArticles).mockImplementation(async () => {
        // Retention should not run while sync is active
        expect(syncLock.acquired).toBe(false);
        return {
          deletedCount: 10,
          retainedCount: 490,
          preservedStarredCount: 0,
          error: null
        };
      });

      await syncArticles(mockUserId);

      expect(retainArticles).toHaveBeenCalled();
    });

    it('should queue retention if sync in progress', async () => {
      const retentionQueue: string[] = [];

      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 100, retentionCount: 500 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: null
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 100 },
            error: null
          })
        })
      });

      vi.mocked(retainArticles).mockImplementation(async (userId) => {
        retentionQueue.push(userId);
        return {
          deletedCount: 50,
          retainedCount: 500,
          preservedStarredCount: 0,
          error: null
        };
      });

      // Start multiple syncs concurrently
      const sync1 = syncArticles('user-1');
      const sync2 = syncArticles('user-2');

      await Promise.all([sync1, sync2]);

      // Both users should have retention queued
      expect(retentionQueue).toContain('user-1');
      expect(retentionQueue).toContain('user-2');
      expect(retentionQueue.length).toBe(2);
    });

    it('should handle retention errors gracefully', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 100, retentionCount: 500 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          title: `Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: null
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 100 },
            error: null
          })
        })
      });

      vi.mocked(retainArticles).mockResolvedValue({
        deletedCount: 0,
        retainedCount: 0,
        preservedStarredCount: 0,
        error: 'Database error during retention'
      });

      const result = await syncArticles(mockUserId);

      // Sync should succeed even if retention fails
      expect(result.articlesAdded).toBe(100);
      expect(result.articlesDeleted).toBe(0);
      expect(result.retentionError).toBe('Database error during retention');
    });

    it('should respect retention settings during incremental sync', async () => {
      vi.mocked(getUserPreferences).mockResolvedValue({
        sync: { maxArticles: 50, retentionCount: 200 },
        ai: { enabled: false }
      });

      vi.mocked(getSubscriptions).mockResolvedValue({
        subscriptions: [{ id: 'feed-1', title: 'Feed 1' }]
      });

      // Simulate incremental sync with continuation token from last sync
      vi.mocked(fetchArticles).mockResolvedValue({
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `article-new-${i}`,
          title: `New Article ${i}`,
          published: Date.now() - i * 1000
        })),
        continuation: null
      });

      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: { count: 50 },
            error: null
          })
        })
      });

      vi.mocked(retainArticles).mockResolvedValue({
        deletedCount: 25,
        retainedCount: 200,
        preservedStarredCount: 5,
        error: null
      });

      const result = await syncArticles(mockUserId, {
        incremental: true,
        lastSyncToken: 'previous-sync-token'
      });

      expect(fetchArticles).toHaveBeenCalledWith(
        expect.objectContaining({
          continuation: 'previous-sync-token'
        })
      );
      expect(retainArticles).toHaveBeenCalled();
      expect(result.articlesAdded).toBe(50);
      expect(result.articlesDeleted).toBe(25);
    });
  });
});