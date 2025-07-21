import { create } from 'zustand';
import { supabase } from '@/lib/db/supabase';
import { useSyncStore } from './sync-store';
import type { Article, ArticleState, Summary } from '@/types';
import type { Database } from '@/lib/db/types';

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
      let query = supabase
        .from('articles')
        .select(`
          *,
          feed:feeds(*)
        `)
        .order('published_at', { ascending: false });

      // Apply feed/folder filter
      if (feedId) {
        query = query.eq('feed_id', feedId);
      } else if (folderId) {
        // Get all feeds in folder first
        const { data: feeds } = await supabase
          .from('feeds')
          .select('id')
          .eq('folder_id', folderId);
        
        const feedIds = feeds?.map(f => f.id) || [];
        if (feedIds.length > 0) {
          query = query.in('feed_id', feedIds);
        }
      }
      
      // Apply read/starred filter
      const filter = get().filter;
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'starred') {
        query = query.eq('is_starred', true);
      }
      
      // Limit results
      query = query.limit(ARTICLES_PER_PAGE);
      
      const { data: articles, error } = await query;
      
      if (error) throw error;
      
      const articlesMap = new Map<string, Article>();
      articles?.forEach(article => {
        articlesMap.set(article.id, {
          id: article.id,
          feedId: article.feed_id || '',
          title: article.title || 'Untitled',
          content: article.content || '',
          url: article.url || '',
          tags: article.is_starred ? ['starred'] : [],
          publishedAt: new Date(article.published_at || Date.now()),
          authorName: '',
          isRead: article.is_read || false,
          state: 'active' as ArticleState,
          createdAt: new Date(article.created_at || Date.now()),
          updatedAt: new Date(article.updated_at || Date.now()),
          inoreaderItemId: article.inoreader_id,
          fullContentUrl: article.url,
          hasFullContent: article.has_full_content || false
        });
      });
      
      set({
        articles: articlesMap,
        loadingArticles: false,
        hasMore: (articles?.length || 0) === ARTICLES_PER_PAGE,
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
      
      let query = supabase
        .from('articles')
        .select(`
          *,
          feed:feeds(*)
        `)
        .order('published_at', { ascending: false })
        .lt('published_at', oldestDate.toISOString());

      // Apply filters
      if (selectedFeedId) {
        query = query.eq('feed_id', selectedFeedId);
      } else if (selectedFolderId) {
        const { data: feeds } = await supabase
          .from('feeds')
          .select('id')
          .eq('folder_id', selectedFolderId);
        
        const feedIds = feeds?.map(f => f.id) || [];
        if (feedIds.length > 0) {
          query = query.in('feed_id', feedIds);
        }
      }
      
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'starred') {
        query = query.eq('is_starred', true);
      }
      
      query = query.limit(ARTICLES_PER_PAGE);
      
      const { data: moreArticles, error } = await query;
      
      if (error) throw error;
      
      // Merge with existing articles
      const updatedArticles = new Map(articles);
      moreArticles?.forEach(article => {
        updatedArticles.set(article.id, {
          id: article.id,
          feedId: article.feed_id || '',
          title: article.title || 'Untitled',
          content: article.content || '',
          url: article.url || '',
          tags: article.is_starred ? ['starred'] : [],
          publishedAt: new Date(article.published_at || Date.now()),
          authorName: '',
          isRead: article.is_read || false,
          state: 'active' as ArticleState,
          createdAt: new Date(article.created_at || Date.now()),
          updatedAt: new Date(article.updated_at || Date.now()),
          inoreaderItemId: article.inoreader_id,
          fullContentUrl: article.url,
          hasFullContent: article.has_full_content || false
        });
      });
      
      set({
        articles: updatedArticles,
        loadingMore: false,
        hasMore: (moreArticles?.length || 0) === ARTICLES_PER_PAGE
      });
    } catch (error) {
      console.error('Failed to load more articles:', error);
      set({ loadingMore: false });
    }
  },

  // Get single article
  getArticle: async (id: string) => {
    try {
      const { data: article, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (article) {
        const articleObj: Article = {
          id: article.id,
          feedId: article.feed_id || '',
          title: article.title || 'Untitled',
          content: article.content || '',
          url: article.url || '',
          tags: article.is_starred ? ['starred'] : [],
          publishedAt: new Date(article.published_at || Date.now()),
          authorName: '',
          isRead: article.is_read || false,
          state: 'active' as ArticleState,
          createdAt: new Date(article.created_at || Date.now()),
          updatedAt: new Date(article.updated_at || Date.now()),
          inoreaderItemId: article.inoreader_id,
          fullContentUrl: article.url,
          hasFullContent: article.has_full_content || false
        };
        
        // Update in store if loaded
        const { articles } = get();
        const updatedArticles = new Map(articles);
        updatedArticles.set(id, articleObj);
        set({ articles: updatedArticles });
        
        return articleObj;
      }
      return null;
    } catch (error) {
      console.error('Failed to get article:', error);
      return null;
    }
  },

  // Mark as read
  markAsRead: async (articleId: string) => {
    try {
      const { articles } = get();
      const article = articles.get(articleId);
      if (!article || article.isRead) return;
      
      // Update in database
      const { error } = await supabase
        .from('articles')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) throw error;
      
      // Update in store
      const updatedArticles = new Map(articles);
      updatedArticles.set(articleId, { ...article, isRead: true });
      set({ articles: updatedArticles });
      
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
      const { articles } = get();
      const article = articles.get(articleId);
      if (!article || !article.isRead) return;
      
      // Update in database
      const { error } = await supabase
        .from('articles')
        .update({ 
          is_read: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) throw error;
      
      // Update in store
      const updatedArticles = new Map(articles);
      updatedArticles.set(articleId, { ...article, isRead: false });
      set({ articles: updatedArticles });
      
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
      const { articles } = get();
      const article = articles.get(articleId);
      if (!article) return;
      
      const tags = article.tags || [];
      const isStarred = tags.includes('starred');
      const updatedTags = isStarred 
        ? tags.filter(tag => tag !== 'starred')
        : [...tags, 'starred'];
      
      // Update in database
      const { error } = await supabase
        .from('articles')
        .update({ 
          is_starred: !isStarred,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) throw error;
      
      // Update in store
      const updatedArticles = new Map(articles);
      updatedArticles.set(articleId, { ...article, tags: updatedTags });
      set({ articles: updatedArticles });
      
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
      const { data: article, error } = await supabase
        .from('articles')
        .select('ai_summary')
        .eq('id', articleId)
        .single();

      if (error) throw error;

      if (article?.ai_summary) {
        return {
          articleId,
          summary: article.ai_summary,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Summary;
      }
      return null;
    } catch (error) {
      console.error('Failed to get summary:', error);
      return null;
    }
  },

  // Mark all as read
  markAllAsRead: async (feedId?: string) => {
    try {
      let query = supabase
        .from('articles')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('is_read', false);

      if (feedId) {
        query = query.eq('feed_id', feedId);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      
      // Update in store
      const { articles: storeArticles } = get();
      const updatedArticles = new Map(storeArticles);
      
      Array.from(storeArticles.entries()).forEach(([id, article]) => {
        if (!article.isRead && (!feedId || article.feedId === feedId)) {
          updatedArticles.set(id, { ...article, isRead: true });
          
          // Queue for sync if offline
          const syncStore = useSyncStore.getState();
          if (!navigator.onLine) {
            syncStore.addToQueue({
              type: 'mark_read',
              articleId: id,
              maxRetries: 3
            });
          }
        }
      });
      
      set({ articles: updatedArticles });
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