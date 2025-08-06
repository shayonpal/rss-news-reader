import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArticleListStateManager, navigationHistory, type ListState, type ArticleState } from '@/lib/utils/article-list-state-manager';
import { NavigationHistory } from '@/lib/utils/navigation-history';

// Mock sessionStorage for testing
const mockSessionStorage = {
  data: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockSessionStorage.data[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage.data[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage.data[key];
  }),
  clear: vi.fn(() => {
    mockSessionStorage.data = {};
  }),
  length: 0,
  key: vi.fn(),
};

// State preservation utility functions (to be implemented)
interface ArticleState {
  id: string;
  isRead: boolean;
  wasAutoRead: boolean;
  position: number;
  sessionPreserved: boolean;
}


class ArticleListStateManager {
  private readonly STATE_KEY = 'articleListState';
  private readonly EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  saveListState(state: ListState): void {
    const stateWithExpiry = {
      ...state,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(this.STATE_KEY, JSON.stringify(stateWithExpiry));
  }

  getListState(): ListState | null {
    const saved = sessionStorage.getItem(this.STATE_KEY);
    if (!saved) return null;

    try {
      const state = JSON.parse(saved) as ListState;
      const now = Date.now();
      
      // Check if expired
      if (now - state.timestamp > this.EXPIRY_MS) {
        this.clearState();
        return null;
      }

      return state;
    } catch {
      this.clearState();
      return null;
    }
  }

  clearState(): void {
    sessionStorage.removeItem(this.STATE_KEY);
  }

  updateArticleState(articleId: string, updates: Partial<ArticleState>): void {
    const currentState = this.getListState();
    if (!currentState) return;

    const articleIndex = currentState.articles.findIndex(a => a.id === articleId);
    if (articleIndex === -1) return;

    currentState.articles[articleIndex] = {
      ...currentState.articles[articleIndex],
      ...updates,
    };

    this.saveListState(currentState);
  }

  isArticleSessionPreserved(articleId: string): boolean {
    const state = this.getListState();
    if (!state) return false;

    const article = state.articles.find(a => a.id === articleId);
    return article?.sessionPreserved || false;
  }

  getPreservedArticles(): ArticleState[] {
    const state = this.getListState();
    if (!state) return [];

    return state.articles.filter(a => a.sessionPreserved);
  }
}

// Navigation history utility (circular buffer implementation)
class NavigationHistory {
  private readonly MAX_HISTORY = 10;
  private history: Array<{ path: string; timestamp: number }> = [];
  private currentIndex = -1;

  addEntry(path: string): void {
    const entry = { path, timestamp: Date.now() };
    
    // Remove entries after current index (if we went back and then navigated to new path)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new entry
    this.history.push(entry);
    
    // Maintain max size (circular buffer behavior)
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  goBack(): string | null {
    if (!this.canGoBack()) return null;
    this.currentIndex--;
    return this.history[this.currentIndex].path;
  }

  goForward(): string | null {
    if (!this.canGoForward()) return null;
    this.currentIndex++;
    return this.history[this.currentIndex].path;
  }

  getCurrentPath(): string | null {
    if (this.currentIndex === -1 || this.currentIndex >= this.history.length) return null;
    return this.history[this.currentIndex].path;
  }

  getHistory(): Array<{ path: string; timestamp: number }> {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}

describe('RR-27: Article List State Preservation - Unit Tests', () => {
  let stateManager: ArticleListStateManager;
  let navigationHistory: NavigationHistory;

  beforeEach(() => {
    // Setup mocks
    vi.stubGlobal('sessionStorage', mockSessionStorage);
    mockSessionStorage.clear();
    
    // Reset date mock
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    // Initialize test instances
    stateManager = new ArticleListStateManager();
    navigationHistory = new NavigationHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('ArticleListStateManager', () => {
    describe('saveListState', () => {
      it('should save list state to sessionStorage', () => {
        const state: ListState = {
          articles: [
            { id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false },
            { id: '2', isRead: true, wasAutoRead: true, position: 1, sessionPreserved: true },
          ],
          scrollPosition: 1000,
          timestamp: Date.now(),
          filter: 'unread',
          feedId: 'feed-1',
        };

        stateManager.saveListState(state);

        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
          'articleListState',
          expect.stringContaining('"timestamp":')
        );
        
        const savedData = JSON.parse(mockSessionStorage.data.articleListState);
        expect(savedData.articles).toHaveLength(2);
        expect(savedData.scrollPosition).toBe(1000);
        expect(savedData.filter).toBe('unread');
        expect(savedData.feedId).toBe('feed-1');
      });

      it('should add timestamp when saving state', () => {
        const state: ListState = {
          articles: [],
          scrollPosition: 0,
          timestamp: 0,
          filter: 'all',
        };

        const now = Date.now();
        stateManager.saveListState(state);

        const savedData = JSON.parse(mockSessionStorage.data.articleListState);
        expect(savedData.timestamp).toBe(now);
      });
    });

    describe('getListState', () => {
      it('should return null when no saved state exists', () => {
        const result = stateManager.getListState();
        expect(result).toBeNull();
      });

      it('should return saved state when valid', () => {
        const state: ListState = {
          articles: [{ id: '1', isRead: true, wasAutoRead: false, position: 0, sessionPreserved: true }],
          scrollPosition: 500,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(state);
        const result = stateManager.getListState();

        expect(result).toEqual(state);
      });

      it('should return null and clear state when expired (> 30 minutes)', () => {
        const oldTimestamp = Date.now() - (31 * 60 * 1000); // 31 minutes ago
        const expiredState = {
          articles: [],
          scrollPosition: 0,
          timestamp: oldTimestamp,
          filter: 'all' as const,
        };

        mockSessionStorage.setItem('articleListState', JSON.stringify(expiredState));

        const result = stateManager.getListState();
        expect(result).toBeNull();
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('articleListState');
      });

      it('should handle and clear corrupted state data', () => {
        mockSessionStorage.setItem('articleListState', 'invalid-json');

        const result = stateManager.getListState();
        expect(result).toBeNull();
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('articleListState');
      });
    });

    describe('updateArticleState', () => {
      it('should update specific article state', () => {
        const initialState: ListState = {
          articles: [
            { id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false },
            { id: '2', isRead: false, wasAutoRead: false, position: 1, sessionPreserved: false },
          ],
          scrollPosition: 0,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(initialState);
        
        stateManager.updateArticleState('1', { 
          isRead: true, 
          wasAutoRead: true, 
          sessionPreserved: true 
        });

        const updatedState = stateManager.getListState();
        expect(updatedState?.articles[0]).toEqual({
          id: '1',
          isRead: true,
          wasAutoRead: true,
          position: 0,
          sessionPreserved: true,
        });
        expect(updatedState?.articles[1].isRead).toBe(false); // Other article unchanged
      });

      it('should do nothing when no saved state exists', () => {
        stateManager.updateArticleState('1', { isRead: true });
        expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
      });

      it('should do nothing when article not found in state', () => {
        const state: ListState = {
          articles: [{ id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false }],
          scrollPosition: 0,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(state);
        stateManager.updateArticleState('non-existent', { isRead: true });

        const currentState = stateManager.getListState();
        expect(currentState?.articles[0].isRead).toBe(false); // Unchanged
      });
    });

    describe('isArticleSessionPreserved', () => {
      it('should return true for session-preserved articles', () => {
        const state: ListState = {
          articles: [
            { id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true },
          ],
          scrollPosition: 0,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(state);
        expect(stateManager.isArticleSessionPreserved('1')).toBe(true);
      });

      it('should return false for non-preserved articles', () => {
        const state: ListState = {
          articles: [
            { id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false },
          ],
          scrollPosition: 0,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(state);
        expect(stateManager.isArticleSessionPreserved('1')).toBe(false);
      });

      it('should return false when no saved state exists', () => {
        expect(stateManager.isArticleSessionPreserved('1')).toBe(false);
      });
    });

    describe('getPreservedArticles', () => {
      it('should return only session-preserved articles', () => {
        const state: ListState = {
          articles: [
            { id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true },
            { id: '2', isRead: false, wasAutoRead: false, position: 1, sessionPreserved: false },
            { id: '3', isRead: true, wasAutoRead: false, position: 2, sessionPreserved: true },
          ],
          scrollPosition: 0,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(state);
        const preserved = stateManager.getPreservedArticles();

        expect(preserved).toHaveLength(2);
        expect(preserved.map(a => a.id)).toEqual(['1', '3']);
        expect(preserved.every(a => a.sessionPreserved)).toBe(true);
      });

      it('should return empty array when no preserved articles', () => {
        const state: ListState = {
          articles: [
            { id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false },
          ],
          scrollPosition: 0,
          timestamp: Date.now(),
          filter: 'unread',
        };

        stateManager.saveListState(state);
        expect(stateManager.getPreservedArticles()).toEqual([]);
      });

      it('should return empty array when no saved state', () => {
        expect(stateManager.getPreservedArticles()).toEqual([]);
      });
    });
  });

  describe('NavigationHistory', () => {
    describe('addEntry', () => {
      it('should add navigation entries', () => {
        navigationHistory.addEntry('/');
        navigationHistory.addEntry('/article/1');

        const history = navigationHistory.getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].path).toBe('/');
        expect(history[1].path).toBe('/article/1');
      });

      it('should maintain circular buffer with max size', () => {
        // Add more than MAX_HISTORY entries
        for (let i = 0; i < 15; i++) {
          navigationHistory.addEntry(`/article/${i}`);
        }

        const history = navigationHistory.getHistory();
        expect(history).toHaveLength(10); // MAX_HISTORY
        expect(history[0].path).toBe('/article/5'); // Oldest entry
        expect(history[9].path).toBe('/article/14'); // Latest entry
      });

      it('should add timestamps to entries', () => {
        const before = Date.now();
        navigationHistory.addEntry('/');
        const after = Date.now();

        const history = navigationHistory.getHistory();
        expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
        expect(history[0].timestamp).toBeLessThanOrEqual(after);
      });

      it('should remove forward history when navigating to new path', () => {
        navigationHistory.addEntry('/');
        navigationHistory.addEntry('/article/1');
        navigationHistory.addEntry('/article/2');
        
        // Go back
        navigationHistory.goBack();
        expect(navigationHistory.getCurrentPath()).toBe('/article/1');
        
        // Navigate to new path - should remove forward history
        navigationHistory.addEntry('/article/3');
        
        const history = navigationHistory.getHistory();
        expect(history).toHaveLength(3);
        expect(history.map(h => h.path)).toEqual(['/', '/article/1', '/article/3']);
      });
    });

    describe('navigation methods', () => {
      beforeEach(() => {
        navigationHistory.addEntry('/');
        navigationHistory.addEntry('/article/1');
        navigationHistory.addEntry('/article/2');
      });

      it('should handle back navigation correctly', () => {
        expect(navigationHistory.canGoBack()).toBe(true);
        expect(navigationHistory.goBack()).toBe('/article/1');
        expect(navigationHistory.getCurrentPath()).toBe('/article/1');
        
        expect(navigationHistory.canGoBack()).toBe(true);
        expect(navigationHistory.goBack()).toBe('/');
        expect(navigationHistory.getCurrentPath()).toBe('/');
        
        expect(navigationHistory.canGoBack()).toBe(false);
        expect(navigationHistory.goBack()).toBeNull();
      });

      it('should handle forward navigation correctly', () => {
        // Go back first
        navigationHistory.goBack();
        navigationHistory.goBack();
        
        expect(navigationHistory.canGoForward()).toBe(true);
        expect(navigationHistory.goForward()).toBe('/article/1');
        
        expect(navigationHistory.canGoForward()).toBe(true);
        expect(navigationHistory.goForward()).toBe('/article/2');
        
        expect(navigationHistory.canGoForward()).toBe(false);
        expect(navigationHistory.goForward()).toBeNull();
      });

      it('should return correct current path', () => {
        expect(navigationHistory.getCurrentPath()).toBe('/article/2');
        
        navigationHistory.goBack();
        expect(navigationHistory.getCurrentPath()).toBe('/article/1');
        
        navigationHistory.goForward();
        expect(navigationHistory.getCurrentPath()).toBe('/article/2');
      });
    });

    describe('clear', () => {
      it('should clear all history', () => {
        navigationHistory.addEntry('/');
        navigationHistory.addEntry('/article/1');
        
        navigationHistory.clear();
        
        expect(navigationHistory.getHistory()).toEqual([]);
        expect(navigationHistory.getCurrentPath()).toBeNull();
        expect(navigationHistory.canGoBack()).toBe(false);
        expect(navigationHistory.canGoForward()).toBe(false);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete article read and preservation flow', () => {
      // Setup initial unread articles
      const initialState: ListState = {
        articles: [
          { id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false },
          { id: '2', isRead: false, wasAutoRead: false, position: 1, sessionPreserved: false },
          { id: '3', isRead: false, wasAutoRead: false, position: 2, sessionPreserved: false },
        ],
        scrollPosition: 0,
        timestamp: Date.now(),
        filter: 'unread',
      };

      stateManager.saveListState(initialState);

      // Simulate auto-reading first article
      stateManager.updateArticleState('1', { 
        isRead: true, 
        wasAutoRead: true, 
        sessionPreserved: true 
      });

      // Navigate to article detail (would trigger navigation history)
      navigationHistory.addEntry('/');
      navigationHistory.addEntry('/article/2');

      // Mark second article as manually read
      stateManager.updateArticleState('2', { 
        isRead: true, 
        wasAutoRead: false, 
        sessionPreserved: false 
      });

      // Check final state
      const finalState = stateManager.getListState();
      expect(finalState?.articles[0]).toMatchObject({
        id: '1',
        isRead: true,
        wasAutoRead: true,
        sessionPreserved: true,
      });
      expect(finalState?.articles[1]).toMatchObject({
        id: '2',
        isRead: true,
        wasAutoRead: false,
        sessionPreserved: false,
      });
      expect(finalState?.articles[2].isRead).toBe(false);

      // Check preserved articles
      const preserved = stateManager.getPreservedArticles();
      expect(preserved).toHaveLength(1);
      expect(preserved[0].id).toBe('1');

      // Check navigation
      expect(navigationHistory.canGoBack()).toBe(true);
      expect(navigationHistory.goBack()).toBe('/');
    });

    it('should handle state expiry during navigation', () => {
      const state: ListState = {
        articles: [{ id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true }],
        scrollPosition: 1000,
        timestamp: Date.now(),
        filter: 'unread',
      };

      stateManager.saveListState(state);

      // Fast forward time beyond expiry
      vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

      // State should be expired and cleared
      expect(stateManager.getListState()).toBeNull();
      expect(stateManager.isArticleSessionPreserved('1')).toBe(false);
      expect(stateManager.getPreservedArticles()).toEqual([]);
    });
  });
});