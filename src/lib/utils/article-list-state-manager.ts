/**
 * ArticleListStateManager - Manages article list state preservation for navigation
 * Part of RR-27: Fix Article List State Preservation on Back Navigation
 */



export interface ListState {
  timestamp: string;
  expiresAt: string;
  scrollPosition: number;
  articleIds: string[];
  readStates: Record<string, boolean>;
  autoReadArticles: string[];
  manualReadArticles: string[];
  filterMode: 'all' | 'unread' | 'read';
  feedId?: string;
  folderId?: string;
  visibleRange?: { start: number; end: number };
  totalArticles?: number;
}

export interface ArticleUpdate {
  id: string;
  changes: {
    isRead?: boolean;
    wasAutoRead?: boolean;
  };
}

class ArticleListStateManager {
  private static instance: ArticleListStateManager;
  private readonly SESSION_KEY = 'rss_reader_list_state';
  private readonly EXPIRY_MINUTES = 30;
  private readonly MAX_ARTICLES = 200;

  private constructor() {}

  static getInstance(): ArticleListStateManager {
    if (!ArticleListStateManager.instance) {
      ArticleListStateManager.instance = new ArticleListStateManager();
    }
    return ArticleListStateManager.instance;
  }

  saveListState(state: Partial<ListState>): void {
    try {
      const fullState: ListState = {
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000).toISOString(),
        scrollPosition: state.scrollPosition || 0,
        articleIds: state.articleIds || [],
        readStates: state.readStates || {},
        autoReadArticles: state.autoReadArticles || [],
        manualReadArticles: state.manualReadArticles || [],
        filterMode: state.filterMode || 'all',
        feedId: state.feedId,
        folderId: state.folderId,
        visibleRange: state.visibleRange,
        totalArticles: state.articleIds?.length,
      };

      // Limit articles to prevent storage quota issues
      if (fullState.articleIds.length > this.MAX_ARTICLES) {
        const limitedIds = fullState.articleIds.slice(0, this.MAX_ARTICLES);
        fullState.articleIds = limitedIds;
        
        // Filter other arrays to match limited IDs
        const limitedSet = new Set(limitedIds);
        fullState.autoReadArticles = fullState.autoReadArticles.filter(id => limitedSet.has(id));
        fullState.manualReadArticles = fullState.manualReadArticles.filter(id => limitedSet.has(id));
        
        // Filter readStates
        const newReadStates: Record<string, boolean> = {};
        limitedIds.forEach(id => {
          if (id in fullState.readStates) {
            newReadStates[id] = fullState.readStates[id];
          }
        });
        fullState.readStates = newReadStates;
      }

      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(fullState));
    } catch (error) {
      console.error('Failed to save list state:', error);
      // Try to save minimal state on quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.saveMinimalState(state);
      }
    }
  }

  private saveMinimalState(state: Partial<ListState>): void {
    try {
      const minimalState: ListState = {
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.EXPIRY_MINUTES * 60 * 1000).toISOString(),
        scrollPosition: state.scrollPosition || 0,
        articleIds: [],
        readStates: {},
        autoReadArticles: state.autoReadArticles?.slice(0, 50) || [],
        manualReadArticles: state.manualReadArticles?.slice(0, 50) || [],
        filterMode: state.filterMode || 'all',
        feedId: state.feedId,
        folderId: state.folderId,
      };
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(minimalState));
    } catch (error) {
      console.error('Failed to save even minimal state:', error);
    }
  }

  getListState(): ListState | null {
    try {
      const savedState = sessionStorage.getItem(this.SESSION_KEY);
      if (!savedState) return null;

      const state: ListState = JSON.parse(savedState);
      
      // Check if state has expired
      if (this.isStateExpired(state)) {
        this.clearState();
        return null;
      }

      return state;
    } catch (error) {
      console.error('Failed to parse saved state:', error);
      this.clearState();
      return null;
    }
  }

  clearState(): void {
    try {
      sessionStorage.removeItem(this.SESSION_KEY);
      // Also clear the preserved article IDs used for hybrid queries
      sessionStorage.removeItem('preserved_article_ids');
    } catch (error) {
      console.error('Failed to clear list state:', error);
    }
  }

  isStateExpired(state?: ListState | null): boolean {
    const checkState = state || this.getListState();
    if (!checkState) return true;
    return new Date(checkState.expiresAt) < new Date();
  }

  getSessionPreservedArticles(): string[] {
    const state = this.getListState();
    if (!state) return [];
    
    // Return all articles that are preserved in the session (both auto and manual)
    const preserved = new Set([
      ...(state.autoReadArticles || []),
      ...(state.manualReadArticles || [])
    ]);
    
    return Array.from(preserved);
  }

  updateArticleState(articleId: string, changes: { isRead?: boolean; wasAutoRead?: boolean }): void {
    const state = this.getListState();
    if (!state) return;

    // Update read states
    if (changes.isRead !== undefined) {
      state.readStates[articleId] = changes.isRead;
    }

    // Update auto-read tracking
    if (changes.isRead && changes.wasAutoRead) {
      if (!state.autoReadArticles.includes(articleId)) {
        state.autoReadArticles.push(articleId);
      }
      // Remove from manual if it was there
      state.manualReadArticles = state.manualReadArticles.filter(id => id !== articleId);
    } else if (changes.isRead && !changes.wasAutoRead) {
      if (!state.manualReadArticles.includes(articleId)) {
        state.manualReadArticles.push(articleId);
      }
      // Remove from auto if it was there
      state.autoReadArticles = state.autoReadArticles.filter(id => id !== articleId);
    }

    this.saveListState(state);
  }

  batchUpdateArticles(updates: ArticleUpdate[]): void {
    const state = this.getListState();
    if (!state) return;

    updates.forEach(update => {
      const { id, changes } = update;
      
      // Update read states
      if (changes.isRead !== undefined) {
        state.readStates[id] = changes.isRead;
      }

      // Update auto-read tracking
      if (changes.isRead && changes.wasAutoRead) {
        if (!state.autoReadArticles.includes(id)) {
          state.autoReadArticles.push(id);
        }
        state.manualReadArticles = state.manualReadArticles.filter(aid => aid !== id);
      } else if (changes.isRead && !changes.wasAutoRead) {
        if (!state.manualReadArticles.includes(id)) {
          state.manualReadArticles.push(id);
        }
        state.autoReadArticles = state.autoReadArticles.filter(aid => aid !== id);
      }
    });

    this.saveListState(state);
  }

  updateScrollPosition(scrollPosition: number): void {
    const state = this.getListState();
    if (state) {
      state.scrollPosition = scrollPosition;
      this.saveListState(state);
    }
  }

  shouldPreserveArticle(articleId: string, filterMode: 'all' | 'unread' | 'read'): boolean {
    if (filterMode !== 'unread') return false;
    
    const state = this.getListState();
    if (!state || this.isStateExpired()) return false;
    
    return state.autoReadArticles.includes(articleId) || 
           state.manualReadArticles.includes(articleId);
  }

  getPreservedArticleIds(): Set<string> {
    const state = this.getListState();
    if (!state) return new Set();
    
    return new Set([
      ...(state.autoReadArticles || []),
      ...(state.manualReadArticles || [])
    ]);
  }

  getAutoReadArticleIds(): Set<string> {
    const state = this.getListState();
    if (!state) return new Set();
    
    return new Set(state.autoReadArticles || []);
  }
}

// Export singleton instance
export const articleListStateManager = ArticleListStateManager.getInstance();