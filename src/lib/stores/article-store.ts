import { create } from 'zustand';
import { db } from '@/lib/db/database';
import { useSyncStore } from './sync-store';
import type { Article, ArticleState, Summary } from '@/types';

interface ArticleStoreState {
  // Article data
  articles: Map<string, Article>;
  loadingArticles: boolean;
  articlesError: string | null;
  
  // Selection and filters
  selectedFeedId: string | null;
  selectedFolderId: string | null;
  selectedArticleId: string | null;
  filter: 'all' | 'unread' | 'starred';
  
  // Pagination
  hasMore: boolean;
  loadingMore: boolean;
  
  // Actions
  loadArticles: (feedId?: string, folderId?: string) => Promise<void>;
  loadMoreArticles: () => Promise<void>;
  getArticle: (id: string) => Promise<Article | null>;
  
  // Article operations
  markAsRead: (articleId: string) => Promise<void>;
  markAsUnread: (articleId: string) => Promise<void>;
  toggleStar: (articleId: string) => Promise<void>;
  
  // Summary operations
  generateSummary: (articleId: string) => Promise<Summary | null>;
  getSummary: (articleId: string) => Promise<Summary | null>;
  
  // Batch operations
  markAllAsRead: (feedId?: string) => Promise<void>;
  refreshArticles: () => Promise<void>;
  
  // Selection
  setSelectedFeed: (feedId: string | null) => void;
  setSelectedFolder: (folderId: string | null) => void;
  setSelectedArticle: (articleId: string | null) => void;
  setFilter: (filter: 'all' | 'unread' | 'starred') => void;
  
  // Utility
  clearError: () => void;
  getArticleCount: () => { total: number; unread: number };
}

const ARTICLES_PER_PAGE = 50;

export const useArticleStore = create<ArticleStoreState>((set, get) => ({
  // Initial state
  articles: new Map(),
  loadingArticles: false,
  articlesError: null,
  selectedFeedId: null,
  selectedFolderId: null,
  selectedArticleId: null,
  filter: 'all',
  hasMore: true,
  loadingMore: false,

  // Load articles with pagination
  loadArticles: async (feedId?: string, folderId?: string) => {
    set({ loadingArticles: true, articlesError: null });
    
    try {
      // Get all articles and filter in memory
      let articles = await db.articles.orderBy('publishedAt').reverse().toArray();
      
      // Apply feed/folder filter
      if (feedId) {
        articles = articles.filter(article => article.feedId === feedId);
      } else if (folderId) {
        // Get all feeds in folder first
        const feeds = await db.feeds.where('folderId').equals(folderId).toArray();
        const feedIds = feeds.map(f => f.id);
        articles = articles.filter(article => feedIds.includes(article.feedId));
      }
      
      // Apply read/starred filter
      const filter = get().filter;
      if (filter === 'unread') {
        articles = articles.filter(article => !article.isRead);
      } else if (filter === 'starred') {
        articles = articles.filter(article => (article.tags?.includes('starred') ?? false));
      }
      
      // Take first page
      const pageArticles = articles.slice(0, ARTICLES_PER_PAGE);
      
      const articlesMap = new Map<string, Article>();
      pageArticles.forEach(article => {
        articlesMap.set(article.id, article);
      });
      
      set({
        articles: articlesMap,
        loadingArticles: false,
        hasMore: articles.length > ARTICLES_PER_PAGE,
        selectedFeedId: feedId || null,
        selectedFolderId: folderId || null
      });
    } catch (error) {
      console.error('Failed to load articles:', error);
      set({
        loadingArticles: false,
        articlesError: `Failed to load articles: ${error}`
      });
    }
  },

  // Load more articles (pagination)
  loadMoreArticles: async () => {
    const { loadingMore, hasMore, articles, selectedFeedId, selectedFolderId, filter } = get();
    
    if (loadingMore || !hasMore) return;
    
    set({ loadingMore: true });
    
    try {
      // Get the oldest article date from current set
      const articleArray = Array.from(articles.values());
      const oldestDate = articleArray[articleArray.length - 1]?.publishedAt;
      
      if (!oldestDate) {
        set({ loadingMore: false, hasMore: false });
        return;
      }
      
      // Get articles older than the oldest date
      let moreArticles = await db.articles
        .where('publishedAt')
        .below(oldestDate)
        .toArray();
      
      // Apply filters in memory
      if (selectedFeedId) {
        moreArticles = moreArticles.filter(article => article.feedId === selectedFeedId);
      } else if (selectedFolderId) {
        const feeds = await db.feeds.where('folderId').equals(selectedFolderId).toArray();
        const feedIds = feeds.map(f => f.id);
        moreArticles = moreArticles.filter(article => feedIds.includes(article.feedId));
      }
      
      if (filter === 'unread') {
        moreArticles = moreArticles.filter(article => !article.isRead);
      } else if (filter === 'starred') {
        moreArticles = moreArticles.filter(article => (article.tags?.includes('starred') ?? false));
      }
      
      // Sort and limit
      moreArticles = moreArticles
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, ARTICLES_PER_PAGE);
      
      // Merge with existing articles
      const updatedArticles = new Map(articles);
      moreArticles.forEach(article => {
        updatedArticles.set(article.id, article);
      });
      
      set({
        articles: updatedArticles,
        loadingMore: false,
        hasMore: moreArticles.length === ARTICLES_PER_PAGE
      });
    } catch (error) {
      console.error('Failed to load more articles:', error);
      set({ loadingMore: false });
    }
  },

  // Get single article
  getArticle: async (id: string) => {
    try {
      const article = await db.articles.get(id);
      if (article) {
        // Update in store if loaded
        const { articles } = get();
        const updatedArticles = new Map(articles);
        updatedArticles.set(id, article);
        set({ articles: updatedArticles });
      }
      return article || null;
    } catch (error) {
      console.error('Failed to get article:', error);
      return null;
    }
  },

  // Mark as read
  markAsRead: async (articleId: string) => {
    try {
      const article = await db.articles.get(articleId);
      if (!article || article.isRead) return;
      
      // Update in database
      await db.articles.update(articleId, {
        isRead: true,
        updatedAt: new Date()
      });
      
      // Update in store
      const { articles } = get();
      const updatedArticles = new Map(articles);
      const storeArticle = updatedArticles.get(articleId);
      if (storeArticle) {
        updatedArticles.set(articleId, { ...storeArticle, isRead: true });
        set({ articles: updatedArticles });
      }
      
      // Queue for sync if offline
      const syncStore = useSyncStore.getState();
      if (!navigator.onLine) {
        syncStore.addToQueue({
          type: 'mark_read',
          articleId,
          maxRetries: 3
        });
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },

  // Mark as unread
  markAsUnread: async (articleId: string) => {
    try {
      const article = await db.articles.get(articleId);
      if (!article || !article.isRead) return;
      
      // Update in database
      await db.articles.update(articleId, {
        isRead: false,
        updatedAt: new Date()
      });
      
      // Update in store
      const { articles } = get();
      const updatedArticles = new Map(articles);
      const storeArticle = updatedArticles.get(articleId);
      if (storeArticle) {
        updatedArticles.set(articleId, { ...storeArticle, isRead: false });
        set({ articles: updatedArticles });
      }
      
      // Queue for sync if offline
      const syncStore = useSyncStore.getState();
      if (!navigator.onLine) {
        syncStore.addToQueue({
          type: 'mark_unread',
          articleId,
          maxRetries: 3
        });
      }
    } catch (error) {
      console.error('Failed to mark as unread:', error);
    }
  },

  // Toggle star
  toggleStar: async (articleId: string) => {
    try {
      const article = await db.articles.get(articleId);
      if (!article) return;
      
      const tags = article.tags || [];
      const isStarred = tags.includes('starred');
      const updatedTags = isStarred 
        ? tags.filter(tag => tag !== 'starred')
        : [...tags, 'starred'];
      
      // Update in database
      await db.articles.update(articleId, {
        tags: updatedTags,
        updatedAt: new Date()
      });
      
      // Update in store
      const { articles } = get();
      const updatedArticles = new Map(articles);
      const storeArticle = updatedArticles.get(articleId);
      if (storeArticle) {
        updatedArticles.set(articleId, { ...storeArticle, tags: updatedTags });
        set({ articles: updatedArticles });
      }
      
      // Queue for sync if offline
      const syncStore = useSyncStore.getState();
      if (!navigator.onLine) {
        syncStore.addToQueue({
          type: isStarred ? 'unstar' : 'star',
          articleId,
          maxRetries: 3
        });
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  },

  // Generate summary (placeholder - will integrate with Claude API)
  generateSummary: async (articleId: string) => {
    // TODO: Implement Claude API integration
    console.log('Summary generation not yet implemented');
    return null;
  },

  // Get summary
  getSummary: async (articleId: string) => {
    try {
      return await db.summaries.get(articleId) || null;
    } catch (error) {
      console.error('Failed to get summary:', error);
      return null;
    }
  },

  // Mark all as read
  markAllAsRead: async (feedId?: string) => {
    try {
      // Get unread articles
      let articles = await db.articles.toArray();
      articles = articles.filter(article => !article.isRead);
      
      if (feedId) {
        articles = articles.filter(article => article.feedId === feedId);
      }
      
      const articleIds = articles.map(a => a.id);
      
      // Batch update in database
      await db.transaction('rw', db.articles, async () => {
        await Promise.all(
          articleIds.map(id => 
            db.articles.update(id, {
              isRead: true,
              updatedAt: new Date()
            })
          )
        );
      });
      
      // Update in store
      const { articles: storeArticles } = get();
      const updatedArticles = new Map(storeArticles);
      articleIds.forEach(id => {
        const article = updatedArticles.get(id);
        if (article) {
          updatedArticles.set(id, { ...article, isRead: true });
        }
      });
      set({ articles: updatedArticles });
      
      // Queue for sync if offline
      const syncStore = useSyncStore.getState();
      if (!navigator.onLine) {
        articleIds.forEach(articleId => {
          syncStore.addToQueue({
            type: 'mark_read',
            articleId,
            maxRetries: 3
          });
        });
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  },

  // Refresh articles
  refreshArticles: async () => {
    const { selectedFeedId, selectedFolderId } = get();
    await get().loadArticles(selectedFeedId || undefined, selectedFolderId || undefined);
  },

  // Selection setters
  setSelectedFeed: (feedId) => set({ selectedFeedId: feedId, selectedFolderId: null }),
  setSelectedFolder: (folderId) => set({ selectedFolderId: folderId, selectedFeedId: null }),
  setSelectedArticle: (articleId) => set({ selectedArticleId: articleId }),
  setFilter: (filter) => {
    set({ filter });
    get().refreshArticles();
  },

  // Utility
  clearError: () => set({ articlesError: null }),
  
  getArticleCount: () => {
    const articles = Array.from(get().articles.values());
    return {
      total: articles.length,
      unread: articles.filter(a => !a.isRead).length
    };
  }
}));