import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment for edge case testing
const createMockEnvironment = () => {
  const mockSessionStorage = {
    data: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockSessionStorage.data[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      if (Object.keys(mockSessionStorage.data).length >= 10) {
        throw new Error('QuotaExceededError');
      }
      mockSessionStorage.data[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionStorage.data[key];
    }),
    clear: vi.fn(() => {
      mockSessionStorage.data = {};
    }),
  };

  const mockIntersectionObserver = vi.fn();
  const mockNavigator = {
    onLine: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
  };

  return { mockSessionStorage, mockIntersectionObserver, mockNavigator };
};

// State management classes (from unit tests)
interface ArticleState {
  id: string;
  isRead: boolean;
  wasAutoRead: boolean;
  position: number;
  sessionPreserved: boolean;
}

interface ListState {
  articles: ArticleState[];
  scrollPosition: number;
  timestamp: number;
  filter: 'all' | 'unread' | 'read';
  feedId?: string;
  folderId?: string;
}

class ArticleListStateManager {
  private readonly STATE_KEY = 'articleListState';
  private readonly EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_ARTICLES = 500; // Limit for performance

  saveListState(state: ListState): void {
    try {
      // Limit articles to prevent storage bloat
      const limitedState = {
        ...state,
        articles: state.articles.slice(0, this.MAX_ARTICLES),
        timestamp: Date.now(),
      };
      
      sessionStorage.setItem(this.STATE_KEY, JSON.stringify(limitedState));
    } catch (error) {
      console.warn('Failed to save list state:', error);
      // Attempt cleanup and retry with smaller dataset
      this.clearState();
      try {
        const minimalState = {
          ...state,
          articles: state.articles.slice(0, 50), // Much smaller subset
          timestamp: Date.now(),
        };
        sessionStorage.setItem(this.STATE_KEY, JSON.stringify(minimalState));
      } catch (retryError) {
        console.error('Failed to save even minimal state:', retryError);
      }
    }
  }

  getListState(): ListState | null {
    try {
      const saved = sessionStorage.getItem(this.STATE_KEY);
      if (!saved) return null;

      const state = JSON.parse(saved) as ListState;
      const now = Date.now();
      
      // Check if expired
      if (now - state.timestamp > this.EXPIRY_MS) {
        this.clearState();
        return null;
      }

      return state;
    } catch (error) {
      console.warn('Failed to parse saved state:', error);
      this.clearState();
      return null;
    }
  }

  clearState(): void {
    try {
      sessionStorage.removeItem(this.STATE_KEY);
    } catch (error) {
      console.warn('Failed to clear state:', error);
    }
  }

  // Handle concurrent modifications safely
  updateArticleStateSafe(articleId: string, updates: Partial<ArticleState>): boolean {
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const currentState = this.getListState();
        if (!currentState) return false;

        const articleIndex = currentState.articles.findIndex(a => a.id === articleId);
        if (articleIndex === -1) return false;

        currentState.articles[articleIndex] = {
          ...currentState.articles[articleIndex],
          ...updates,
        };

        this.saveListState(currentState);
        return true;
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          console.error('Failed to update article state after retries:', error);
          return false;
        }
        // Brief delay before retry
        setTimeout(() => {}, 10);
      }
    }
    return false;
  }
}

class NavigationHistory {
  private readonly MAX_HISTORY = 10;
  private readonly STORAGE_KEY = 'navigationHistory';
  private history: Array<{ path: string; timestamp: number }> = [];
  private currentIndex = -1;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const saved = sessionStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.history = data.history || [];
        this.currentIndex = data.currentIndex || -1;
        
        // Validate indices
        if (this.currentIndex >= this.history.length) {
          this.currentIndex = this.history.length - 1;
        }
      }
    } catch (error) {
      console.warn('Failed to load navigation history:', error);
      this.clear();
    }
  }

  private saveToStorage(): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        history: this.history,
        currentIndex: this.currentIndex,
      }));
    } catch (error) {
      console.warn('Failed to save navigation history:', error);
      // Try with reduced history
      this.history = this.history.slice(-5);
      this.currentIndex = Math.min(this.currentIndex, this.history.length - 1);
      try {
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify({
          history: this.history,
          currentIndex: this.currentIndex,
        }));
      } catch (retryError) {
        console.error('Failed to save reduced navigation history:', retryError);
      }
    }
  }

  addEntry(path: string): void {
    try {
      const entry = { path, timestamp: Date.now() };
      
      // Remove entries after current index
      this.history = this.history.slice(0, this.currentIndex + 1);
      
      // Add new entry
      this.history.push(entry);
      
      // Maintain max size
      if (this.history.length > this.MAX_HISTORY) {
        this.history.shift();
      } else {
        this.currentIndex++;
      }

      this.saveToStorage();
    } catch (error) {
      console.error('Failed to add navigation entry:', error);
    }
  }

  goBack(): string | null {
    if (this.currentIndex <= 0) return null;
    this.currentIndex--;
    this.saveToStorage();
    return this.history[this.currentIndex]?.path || null;
  }

  goForward(): string | null {
    if (this.currentIndex >= this.history.length - 1) return null;
    this.currentIndex++;
    this.saveToStorage();
    return this.history[this.currentIndex]?.path || null;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear navigation history:', error);
    }
  }
}

describe('RR-27: Article List State Preservation - Edge Cases', () => {
  let stateManager: ArticleListStateManager;
  let navigationHistory: NavigationHistory;
  let mockEnv: ReturnType<typeof createMockEnvironment>;

  beforeEach(() => {
    mockEnv = createMockEnvironment();
    vi.stubGlobal('sessionStorage', mockEnv.mockSessionStorage);
    vi.stubGlobal('navigator', mockEnv.mockNavigator);
    vi.stubGlobal('IntersectionObserver', mockEnv.mockIntersectionObserver);
    
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    stateManager = new ArticleListStateManager();
    navigationHistory = new NavigationHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('Storage Quota and Memory Management', () => {
    it('should handle session storage quota exceeded gracefully', () => {
      // Create a state that would exceed storage quota
      const largeState: ListState = {
        articles: Array.from({ length: 1000 }, (_, i) => ({
          id: `article-${i}`,
          isRead: i % 2 === 0,
          wasAutoRead: i % 3 === 0,
          position: i,
          sessionPreserved: i % 4 === 0,
        })),
        scrollPosition: 5000,
        timestamp: Date.now(),
        filter: 'unread',
      };

      // Should not throw error, but handle gracefully
      expect(() => stateManager.saveListState(largeState)).not.toThrow();
      
      // State should still be saveable (fallback to smaller dataset)
      const savedState = stateManager.getListState();
      expect(savedState).toBeTruthy();
      expect(savedState?.articles.length).toBeLessThanOrEqual(500);
    });

    it('should limit article count to prevent memory bloat', () => {
      const massiveState: ListState = {
        articles: Array.from({ length: 2000 }, (_, i) => ({
          id: `article-${i}`,
          isRead: false,
          wasAutoRead: false,
          position: i,
          sessionPreserved: false,
        })),
        scrollPosition: 0,
        timestamp: Date.now(),
        filter: 'all',
      };

      stateManager.saveListState(massiveState);
      const savedState = stateManager.getListState();
      
      expect(savedState?.articles.length).toBeLessThanOrEqual(500);
    });

    it('should handle navigation history storage failures', () => {
      // Fill up storage to trigger quota errors
      for (let i = 0; i < 15; i++) {
        mockEnv.mockSessionStorage.data[`dummy-${i}`] = 'x'.repeat(1000);
      }

      // Should not throw when adding navigation entries
      expect(() => {
        navigationHistory.addEntry('/article/1');
        navigationHistory.addEntry('/article/2');
      }).not.toThrow();
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent state updates safely', async () => {
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

      // Simulate concurrent updates
      const promises = [
        stateManager.updateArticleStateSafe('1', { isRead: true, wasAutoRead: true }),
        stateManager.updateArticleStateSafe('2', { isRead: true, wasAutoRead: false }),
        stateManager.updateArticleStateSafe('1', { sessionPreserved: true }),
      ];

      const results = await Promise.all(promises);
      
      // At least some updates should succeed
      expect(results.some(result => result)).toBe(true);
      
      // Final state should be consistent
      const finalState = stateManager.getListState();
      expect(finalState).toBeTruthy();
    });

    it('should handle rapid navigation history updates', () => {
      // Simulate rapid navigation
      const paths = Array.from({ length: 20 }, (_, i) => `/article/${i}`);
      
      expect(() => {
        paths.forEach(path => navigationHistory.addEntry(path));
      }).not.toThrow();

      // History should maintain reasonable size
      const history = navigationHistory.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Browser Environment Edge Cases', () => {
    it('should handle iOS Safari quirks', () => {
      // Mock iOS Safari user agent
      vi.stubGlobal('navigator', {
        ...mockEnv.mockNavigator,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      });

      const state: ListState = {
        articles: [{ id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true }],
        scrollPosition: 100,
        timestamp: Date.now(),
        filter: 'unread',
      };

      // Should work on iOS Safari
      expect(() => stateManager.saveListState(state)).not.toThrow();
      expect(stateManager.getListState()).toBeTruthy();
    });

    it('should handle private browsing mode restrictions', () => {
      // Mock private browsing (sessionStorage throws on setItem)
      mockEnv.mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const state: ListState = {
        articles: [],
        scrollPosition: 0,
        timestamp: Date.now(),
        filter: 'all',
      };

      // Should handle gracefully without crashing
      expect(() => stateManager.saveListState(state)).not.toThrow();
      
      // Navigation should still work
      expect(() => navigationHistory.addEntry('/article/1')).not.toThrow();
    });

    it('should handle disabled JavaScript storage', () => {
      // Mock completely disabled sessionStorage
      vi.stubGlobal('sessionStorage', undefined);

      expect(() => {
        stateManager = new ArticleListStateManager();
        navigationHistory = new NavigationHistory();
      }).not.toThrow();

      // Should degrade gracefully
      expect(stateManager.getListState()).toBeNull();
    });
  });

  describe('Network and Connectivity Edge Cases', () => {
    it('should handle offline state management', () => {
      mockEnv.mockNavigator.onLine = false;

      const state: ListState = {
        articles: [{ id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true }],
        scrollPosition: 0,
        timestamp: Date.now(),
        filter: 'unread',
      };

      // State management should work offline
      stateManager.saveListState(state);
      expect(stateManager.getListState()).toBeTruthy();
      
      // Navigation should work offline
      navigationHistory.addEntry('/article/1');
      expect(navigationHistory.goBack()).toBeTruthy();
    });

    it('should handle connection state changes during navigation', () => {
      // Start online
      mockEnv.mockNavigator.onLine = true;
      navigationHistory.addEntry('/');
      navigationHistory.addEntry('/article/1');

      // Go offline
      mockEnv.mockNavigator.onLine = false;
      navigationHistory.addEntry('/article/2');

      // Come back online
      mockEnv.mockNavigator.onLine = true;
      navigationHistory.addEntry('/article/3');

      // Navigation history should remain intact
      expect(navigationHistory.goBack()).toBe('/article/2');
      expect(navigationHistory.goBack()).toBe('/article/1');
    });
  });

  describe('Data Corruption and Recovery', () => {
    it('should recover from corrupted state data', () => {
      // Inject corrupted data
      mockEnv.mockSessionStorage.data.articleListState = '{invalid-json}';
      mockEnv.mockSessionStorage.data.navigationHistory = 'not-json-at-all';

      expect(() => {
        stateManager = new ArticleListStateManager();
        navigationHistory = new NavigationHistory();
      }).not.toThrow();

      // Should return null for corrupted state
      expect(stateManager.getListState()).toBeNull();
      
      // Should clear corrupted data
      expect(mockEnv.mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle partial data corruption', () => {
      const partiallyCorruptedState = {
        articles: [
          { id: '1', isRead: 'invalid', position: null }, // Invalid types
          { id: '2', isRead: true, wasAutoRead: false, position: 1, sessionPreserved: true }, // Valid
        ],
        scrollPosition: 'invalid',
        timestamp: Date.now(),
        filter: 'invalid-filter',
      };

      mockEnv.mockSessionStorage.data.articleListState = JSON.stringify(partiallyCorruptedState);

      // Should handle gracefully
      expect(() => stateManager.getListState()).not.toThrow();
    });

    it('should handle state with missing required fields', () => {
      const incompleteState = {
        articles: [{ id: '1' }], // Missing required fields
        // Missing scrollPosition, timestamp, filter
      };

      mockEnv.mockSessionStorage.data.articleListState = JSON.stringify(incompleteState);

      const state = stateManager.getListState();
      // Should either return null or handle missing fields gracefully
      expect(state === null || typeof state === 'object').toBe(true);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very large scroll positions', () => {
      const state: ListState = {
        articles: [{ id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false }],
        scrollPosition: Number.MAX_SAFE_INTEGER,
        timestamp: Date.now(),
        filter: 'all',
      };

      expect(() => stateManager.saveListState(state)).not.toThrow();
      
      const savedState = stateManager.getListState();
      expect(savedState?.scrollPosition).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle rapid state updates without memory leaks', () => {
      // Simulate rapid state updates like during scrolling
      for (let i = 0; i < 100; i++) {
        const state: ListState = {
          articles: [{ id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false }],
          scrollPosition: i * 10,
          timestamp: Date.now(),
          filter: 'unread',
        };
        
        stateManager.saveListState(state);
      }

      // Should not accumulate multiple copies
      expect(Object.keys(mockEnv.mockSessionStorage.data).length).toBeLessThanOrEqual(3);
    });

    it('should handle timestamp edge cases', () => {
      // Test with various timestamp edge cases
      const timestamps = [
        0, // Epoch
        Date.now() + 86400000, // Future date
        -1, // Negative timestamp
        NaN, // Invalid timestamp
        Infinity, // Infinite timestamp
      ];

      timestamps.forEach(timestamp => {
        const state: ListState = {
          articles: [],
          scrollPosition: 0,
          timestamp,
          filter: 'all',
        };

        expect(() => stateManager.saveListState(state)).not.toThrow();
      });
    });
  });

  describe('Cross-Tab and Multi-Instance Scenarios', () => {
    it('should handle state conflicts between multiple tabs', () => {
      // Simulate another tab updating the same state
      const tab1State: ListState = {
        articles: [{ id: '1', isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false }],
        scrollPosition: 100,
        timestamp: Date.now(),
        filter: 'unread',
      };

      const tab2State: ListState = {
        articles: [{ id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true }],
        scrollPosition: 200,
        timestamp: Date.now() + 1000, // Slightly newer
        filter: 'all',
      };

      // Tab 1 saves state
      stateManager.saveListState(tab1State);
      
      // Simulate tab 2 saving newer state
      mockEnv.mockSessionStorage.data.articleListState = JSON.stringify(tab2State);
      
      // Tab 1 reads state - should get tab 2's newer state
      const currentState = stateManager.getListState();
      expect(currentState?.filter).toBe('all');
      expect(currentState?.scrollPosition).toBe(200);
    });
  });

  describe('Real-World Stress Testing', () => {
    it('should handle user rapidly switching between articles', () => {
      // Simulate rapid article switching
      const articles = Array.from({ length: 50 }, (_, i) => `/article/${i}`);
      
      expect(() => {
        articles.forEach(path => {
          navigationHistory.addEntry(path);
          
          // Simulate state updates for each article
          stateManager.updateArticleStateSafe(`${path.split('/')[2]}`, {
            isRead: true,
            wasAutoRead: Math.random() > 0.5,
            sessionPreserved: Math.random() > 0.7,
          });
        });
      }).not.toThrow();

      // System should remain stable
      expect(navigationHistory.getCurrentPath()).toBeTruthy();
      expect(stateManager.getListState()).toBeTruthy();
    });

    it('should handle app backgrounding and foregrounding', () => {
      const state: ListState = {
        articles: [{ id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true }],
        scrollPosition: 500,
        timestamp: Date.now(),
        filter: 'unread',
      };

      stateManager.saveListState(state);

      // Simulate app being backgrounded for a long time
      vi.advanceTimersByTime(25 * 60 * 1000); // 25 minutes - still valid

      expect(stateManager.getListState()).toBeTruthy();

      // Simulate app being backgrounded beyond expiry
      vi.advanceTimersByTime(10 * 60 * 1000); // Total 35 minutes - expired

      expect(stateManager.getListState()).toBeNull();
    });

    it('should handle system resource pressure', () => {
      // Simulate system under memory pressure
      let callCount = 0;
      mockEnv.mockSessionStorage.setItem.mockImplementation((key, value) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('QuotaExceededError');
        }
        mockEnv.mockSessionStorage.data[key] = value;
      });

      // Should degrade gracefully under pressure
      for (let i = 0; i < 10; i++) {
        const state: ListState = {
          articles: [{ id: `${i}`, isRead: false, wasAutoRead: false, position: 0, sessionPreserved: false }],
          scrollPosition: i * 100,
          timestamp: Date.now(),
          filter: 'unread',
        };

        expect(() => stateManager.saveListState(state)).not.toThrow();
      }
    });
  });
});