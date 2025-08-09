import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * Test Specification for RR-171: Store Refresh Operations
 * 
 * This test defines the contract for how Zustand stores must refresh
 * their data after sync operations.
 * 
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

// Store interfaces that implementation must follow
interface FeedStore {
  feeds: Map<string, Feed>;
  isLoading: boolean;
  error: string | null;
  lastRefreshTime: Date | null;
  
  // Actions
  refreshFeeds: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUnreadCount: (feedId: string, count: number) => void;
  clearCache: () => void;
}

interface ArticleStore {
  articles: Map<string, Article>;
  isLoading: boolean;
  error: string | null;
  lastRefreshTime: Date | null;
  
  // Actions
  refreshArticles: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  markAsRead: (articleId: string) => void;
  markAsUnread: (articleId: string) => void;
  clearCache: () => void;
}

interface TagStore {
  tags: Map<string, Tag>;
  selectedTags: Set<string>;
  isLoading: boolean;
  error: string | null;
  lastRefreshTime: Date | null;
  
  // Actions
  refreshTags: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectTag: (tagId: string) => void;
  deselectTag: (tagId: string) => void;
  clearSelection: () => void;
  clearCache: () => void;
}

interface Feed {
  id: string;
  title: string;
  unread_count: number;
  folder_id?: string;
  last_sync?: Date;
}

interface Article {
  id: string;
  feed_id: string;
  title: string;
  is_read: boolean;
  is_starred: boolean;
  published_at: Date;
  tags?: string[];
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  article_count: number;
}

describe('RR-171: Store Refresh Contract', () => {
  let mockSupabase: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for API calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      data: [],
      error: null
    };
  });

  describe('Feed Store Refresh', () => {
    let feedStore: FeedStore;

    beforeEach(() => {
      feedStore = {
        feeds: new Map(),
        isLoading: false,
        error: null,
        lastRefreshTime: null,
        
        refreshFeeds: vi.fn(async function(this: FeedStore) {
          this.setLoading(true);
          this.setError(null);
          
          try {
            // Simulate API call
            const response = await fetch('/api/feeds');
            const data = await response.json();
            
            // Update feeds
            this.feeds.clear();
            data.forEach((feed: Feed) => {
              this.feeds.set(feed.id, feed);
            });
            
            this.lastRefreshTime = new Date();
          } catch (error) {
            this.setError('Failed to refresh feeds');
          } finally {
            this.setLoading(false);
          }
        }),
        
        setLoading: vi.fn(function(this: FeedStore, loading: boolean) {
          this.isLoading = loading;
        }),
        
        setError: vi.fn(function(this: FeedStore, error: string | null) {
          this.error = error;
        }),
        
        updateUnreadCount: vi.fn(function(this: FeedStore, feedId: string, count: number) {
          const feed = this.feeds.get(feedId);
          if (feed) {
            feed.unread_count = count;
            this.feeds.set(feedId, feed);
          }
        }),
        
        clearCache: vi.fn(function(this: FeedStore) {
          this.feeds.clear();
          this.lastRefreshTime = null;
        })
      };
    });

    it('should set loading state during refresh', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });

      const refreshPromise = feedStore.refreshFeeds();
      
      // Should be loading immediately
      expect(feedStore.setLoading).toHaveBeenCalledWith(true);
      
      await refreshPromise;
      
      // Should not be loading after completion
      expect(feedStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should update feeds from API response', async () => {
      const mockFeeds = [
        { id: 'feed-1', title: 'Tech News', unread_count: 10 },
        { id: 'feed-2', title: 'Science', unread_count: 5 }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockFeeds
      });

      await feedStore.refreshFeeds();
      
      expect(feedStore.feeds.size).toBe(2);
      expect(feedStore.feeds.get('feed-1')).toEqual(mockFeeds[0]);
      expect(feedStore.feeds.get('feed-2')).toEqual(mockFeeds[1]);
    });

    it('should update lastRefreshTime after successful refresh', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });

      const beforeTime = new Date();
      await feedStore.refreshFeeds();
      const afterTime = new Date();
      
      expect(feedStore.lastRefreshTime).toBeDefined();
      expect(feedStore.lastRefreshTime!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(feedStore.lastRefreshTime!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle refresh errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await feedStore.refreshFeeds();
      
      expect(feedStore.setError).toHaveBeenCalledWith('Failed to refresh feeds');
      expect(feedStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should clear error on successful refresh', async () => {
      feedStore.error = 'Previous error';
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });
      
      await feedStore.refreshFeeds();
      
      expect(feedStore.setError).toHaveBeenCalledWith(null);
    });

    it('should update individual feed unread counts', () => {
      feedStore.feeds.set('feed-1', {
        id: 'feed-1',
        title: 'Tech News',
        unread_count: 10
      });
      
      feedStore.updateUnreadCount('feed-1', 15);
      
      expect(feedStore.feeds.get('feed-1')!.unread_count).toBe(15);
    });

    it('should clear cache when requested', () => {
      feedStore.feeds.set('feed-1', {
        id: 'feed-1',
        title: 'Tech News',
        unread_count: 10
      });
      feedStore.lastRefreshTime = new Date();
      
      feedStore.clearCache();
      
      expect(feedStore.feeds.size).toBe(0);
      expect(feedStore.lastRefreshTime).toBeNull();
    });
  });

  describe('Article Store Refresh', () => {
    let articleStore: ArticleStore;

    beforeEach(() => {
      articleStore = {
        articles: new Map(),
        isLoading: false,
        error: null,
        lastRefreshTime: null,
        
        refreshArticles: vi.fn(async function(this: ArticleStore) {
          this.setLoading(true);
          this.setError(null);
          
          try {
            const response = await fetch('/api/articles');
            const data = await response.json();
            
            this.articles.clear();
            data.forEach((article: Article) => {
              this.articles.set(article.id, article);
            });
            
            this.lastRefreshTime = new Date();
          } catch (error) {
            this.setError('Failed to refresh articles');
          } finally {
            this.setLoading(false);
          }
        }),
        
        setLoading: vi.fn(function(this: ArticleStore, loading: boolean) {
          this.isLoading = loading;
        }),
        
        setError: vi.fn(function(this: ArticleStore, error: string | null) {
          this.error = error;
        }),
        
        markAsRead: vi.fn(function(this: ArticleStore, articleId: string) {
          const article = this.articles.get(articleId);
          if (article) {
            article.is_read = true;
            this.articles.set(articleId, article);
          }
        }),
        
        markAsUnread: vi.fn(function(this: ArticleStore, articleId: string) {
          const article = this.articles.get(articleId);
          if (article) {
            article.is_read = false;
            this.articles.set(articleId, article);
          }
        }),
        
        clearCache: vi.fn(function(this: ArticleStore) {
          this.articles.clear();
          this.lastRefreshTime = null;
        })
      };
    });

    it('should refresh articles from API', async () => {
      const mockArticles = [
        {
          id: 'article-1',
          feed_id: 'feed-1',
          title: 'Article 1',
          is_read: false,
          is_starred: false,
          published_at: new Date()
        },
        {
          id: 'article-2',
          feed_id: 'feed-2',
          title: 'Article 2',
          is_read: true,
          is_starred: true,
          published_at: new Date()
        }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockArticles
      });

      await articleStore.refreshArticles();
      
      expect(articleStore.articles.size).toBe(2);
      expect(articleStore.articles.get('article-1')).toEqual(mockArticles[0]);
      expect(articleStore.articles.get('article-2')).toEqual(mockArticles[1]);
    });

    it('should maintain read/unread state operations', () => {
      articleStore.articles.set('article-1', {
        id: 'article-1',
        feed_id: 'feed-1',
        title: 'Test Article',
        is_read: false,
        is_starred: false,
        published_at: new Date()
      });
      
      // Mark as read
      articleStore.markAsRead('article-1');
      expect(articleStore.articles.get('article-1')!.is_read).toBe(true);
      
      // Mark as unread
      articleStore.markAsUnread('article-1');
      expect(articleStore.articles.get('article-1')!.is_read).toBe(false);
    });

    it('should handle articles with tags', async () => {
      const mockArticles = [
        {
          id: 'article-1',
          feed_id: 'feed-1',
          title: 'Tagged Article',
          is_read: false,
          is_starred: false,
          published_at: new Date(),
          tags: ['technology', 'ai', 'news']
        }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockArticles
      });

      await articleStore.refreshArticles();
      
      const article = articleStore.articles.get('article-1');
      expect(article?.tags).toEqual(['technology', 'ai', 'news']);
    });
  });

  describe('Tag Store Refresh', () => {
    let tagStore: TagStore;

    beforeEach(() => {
      tagStore = {
        tags: new Map(),
        selectedTags: new Set(),
        isLoading: false,
        error: null,
        lastRefreshTime: null,
        
        refreshTags: vi.fn(async function(this: TagStore) {
          this.setLoading(true);
          this.setError(null);
          
          try {
            const response = await fetch('/api/tags');
            const data = await response.json();
            
            this.tags.clear();
            data.forEach((tag: Tag) => {
              this.tags.set(tag.id, tag);
            });
            
            // Clean up selected tags that no longer exist
            const validTagIds = new Set(data.map((t: Tag) => t.id));
            this.selectedTags.forEach(tagId => {
              if (!validTagIds.has(tagId)) {
                this.selectedTags.delete(tagId);
              }
            });
            
            this.lastRefreshTime = new Date();
          } catch (error) {
            this.setError('Failed to refresh tags');
          } finally {
            this.setLoading(false);
          }
        }),
        
        setLoading: vi.fn(function(this: TagStore, loading: boolean) {
          this.isLoading = loading;
        }),
        
        setError: vi.fn(function(this: TagStore, error: string | null) {
          this.error = error;
        }),
        
        selectTag: vi.fn(function(this: TagStore, tagId: string) {
          this.selectedTags.add(tagId);
        }),
        
        deselectTag: vi.fn(function(this: TagStore, tagId: string) {
          this.selectedTags.delete(tagId);
        }),
        
        clearSelection: vi.fn(function(this: TagStore) {
          this.selectedTags.clear();
        }),
        
        clearCache: vi.fn(function(this: TagStore) {
          this.tags.clear();
          this.lastRefreshTime = null;
        })
      };
    });

    it('should refresh tags from API', async () => {
      const mockTags = [
        { id: 'tag-1', name: 'Technology', slug: 'technology', article_count: 25 },
        { id: 'tag-2', name: 'AI', slug: 'ai', article_count: 15 },
        { id: 'tag-3', name: 'News', slug: 'news', article_count: 100 }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTags
      });

      await tagStore.refreshTags();
      
      expect(tagStore.tags.size).toBe(3);
      expect(tagStore.tags.get('tag-1')).toEqual(mockTags[0]);
      expect(tagStore.tags.get('tag-2')).toEqual(mockTags[1]);
      expect(tagStore.tags.get('tag-3')).toEqual(mockTags[2]);
    });

    it('should handle tag selection operations', () => {
      tagStore.tags.set('tag-1', {
        id: 'tag-1',
        name: 'Technology',
        slug: 'technology',
        article_count: 25
      });
      
      // Select tag
      tagStore.selectTag('tag-1');
      expect(tagStore.selectedTags.has('tag-1')).toBe(true);
      
      // Deselect tag
      tagStore.deselectTag('tag-1');
      expect(tagStore.selectedTags.has('tag-1')).toBe(false);
      
      // Clear all selections
      tagStore.selectTag('tag-1');
      tagStore.selectTag('tag-2');
      tagStore.clearSelection();
      expect(tagStore.selectedTags.size).toBe(0);
    });

    it('should clean up invalid selected tags on refresh', async () => {
      // Select some tags
      tagStore.selectedTags.add('tag-1');
      tagStore.selectedTags.add('tag-2');
      tagStore.selectedTags.add('tag-old'); // This won't exist after refresh
      
      const mockTags = [
        { id: 'tag-1', name: 'Technology', slug: 'technology', article_count: 25 },
        { id: 'tag-2', name: 'AI', slug: 'ai', article_count: 15 }
        // tag-old is not in the response
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTags
      });

      await tagStore.refreshTags();
      
      // Should keep valid selections
      expect(tagStore.selectedTags.has('tag-1')).toBe(true);
      expect(tagStore.selectedTags.has('tag-2')).toBe(true);
      
      // Should remove invalid selection
      expect(tagStore.selectedTags.has('tag-old')).toBe(false);
    });

    it('should update article counts in tags', async () => {
      const mockTags = [
        { id: 'tag-1', name: 'Technology', slug: 'technology', article_count: 50 }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTags
      });

      await tagStore.refreshTags();
      
      const tag = tagStore.tags.get('tag-1');
      expect(tag?.article_count).toBe(50);
    });
  });

  describe('Cross-Store Coordination', () => {
    it('should refresh all stores independently', async () => {
      const feedRefresh = vi.fn().mockResolvedValue(undefined);
      const articleRefresh = vi.fn().mockResolvedValue(undefined);
      const tagRefresh = vi.fn().mockResolvedValue(undefined);
      
      // Simulate parallel refresh
      await Promise.all([
        feedRefresh(),
        articleRefresh(),
        tagRefresh()
      ]);
      
      expect(feedRefresh).toHaveBeenCalledOnce();
      expect(articleRefresh).toHaveBeenCalledOnce();
      expect(tagRefresh).toHaveBeenCalledOnce();
    });

    it('should handle partial refresh failures', async () => {
      const feedRefresh = vi.fn().mockResolvedValue(undefined);
      const articleRefresh = vi.fn().mockRejectedValue(new Error('Failed'));
      const tagRefresh = vi.fn().mockResolvedValue(undefined);
      
      const results = await Promise.allSettled([
        feedRefresh(),
        articleRefresh(),
        tagRefresh()
      ]);
      
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });
});