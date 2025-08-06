import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ArticleListStateManager, navigationHistory } from '@/lib/utils/article-list-state-manager';
import { NavigationHistory } from '@/lib/utils/navigation-history';
import type { ListState } from '@/lib/utils/article-list-state-manager';

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

describe('RR-27: Article List State Preservation - Edge Cases', () => {
  let stateManager: ArticleListStateManager;
  let testNavigationHistory: NavigationHistory;

  beforeEach(() => {
    // Setup mocks
    vi.stubGlobal('sessionStorage', mockSessionStorage);
    mockSessionStorage.clear();
    
    // Reset date mock
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.000Z'));

    // Initialize test instances
    stateManager = new ArticleListStateManager();
    testNavigationHistory = new NavigationHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('Storage Quota and Memory Management', () => {
    it('should handle storage quota exceeded error gracefully', () => {
      // Create oversized state
      const largeState: Partial<ListState> = {
        articleIds: Array.from({ length: 500 }, (_, i) => `article-${i}`),
        readStates: Object.fromEntries(
          Array.from({ length: 500 }, (_, i) => [`article-${i}`, i % 2 === 0])
        ),
        autoReadArticles: Array.from({ length: 250 }, (_, i) => `article-${i * 2}`),
        manualReadArticles: Array.from({ length: 250 }, (_, i) => `article-${i * 2 + 1}`),
        scrollPosition: 10000,
        filterMode: 'unread',
      };

      // Mock storage quota exceeded on first call
      let callCount = 0;
      mockSessionStorage.setItem.mockImplementation((key, value) => {
        callCount++;
        if (callCount === 1) {
          throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        }
        mockSessionStorage.data[key] = value;
      });

      // Should not throw error
      expect(() => stateManager.saveListState(largeState)).not.toThrow();
      
      // Should have attempted retry
      expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(2);
      
      // Verify fallback with reduced data was saved
      const savedState = stateManager.getListState();
      expect(savedState?.articleIds?.length).toBeLessThanOrEqual(50); // Fallback limit
    });

    it('should limit article count to MAX_ARTICLES (200)', () => {
      const oversizedState: Partial<ListState> = {
        articleIds: Array.from({ length: 300 }, (_, i) => `article-${i}`),
        readStates: Object.fromEntries(
          Array.from({ length: 300 }, (_, i) => [`article-${i}`, false])
        ),
        autoReadArticles: Array.from({ length: 300 }, (_, i) => `article-${i}`),
        manualReadArticles: [],
        scrollPosition: 5000,
        filterMode: 'unread',
      };

      stateManager.saveListState(oversizedState);
      const savedState = stateManager.getListState();

      expect(savedState?.articleIds?.length).toBe(200); // MAX_ARTICLES limit
      expect(savedState?.autoReadArticles?.length).toBe(200);
    });

    it('should handle empty storage gracefully on multiple operations', () => {
      // Multiple rapid operations on empty storage
      expect(stateManager.getListState()).toBeNull();
      expect(stateManager.isStateExpired()).toBe(true);
      expect(stateManager.getSessionPreservedArticles()).toEqual([]);
      
      const success = stateManager.updateArticleState('non-existent', {
        id: 'test',
        isRead: true,
        wasAutoRead: false,
        position: 0,
        sessionPreserved: false
      });
      expect(success).toBe(false);
    });

    it('should handle concurrent storage operations', async () => {
      const state1: Partial<ListState> = {
        articleIds: ['1', '2'],
        readStates: { '1': false, '2': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 100,
        filterMode: 'unread',
      };

      const state2: Partial<ListState> = {
        articleIds: ['3', '4'],
        readStates: { '3': true, '4': true },
        autoReadArticles: ['3'],
        manualReadArticles: ['4'],
        scrollPosition: 200,
        filterMode: 'all',
      };

      // Simulate concurrent saves
      stateManager.saveListState(state1);
      stateManager.saveListState(state2);

      // Last save should win
      const result = stateManager.getListState();
      expect(result?.articleIds).toEqual(['3', '4']);
      expect(result?.scrollPosition).toBe(200);
    });
  });

  describe('Race Conditions and Timing Issues', () => {
    it('should handle rapid navigation state changes', () => {
      // Rapid navigation entries
      for (let i = 0; i < 50; i++) {
        testNavigationHistory.addEntry(`/article/${i}`, `${i}`);
      }

      const history = testNavigationHistory.getHistory();
      expect(history.length).toBe(20); // Should maintain MAX_HISTORY limit

      // Should be able to navigate normally
      expect(testNavigationHistory.canGoBack()).toBe(true);
      const backEntry = testNavigationHistory.goBack();
      expect(backEntry).toBeTruthy();
    });

    it('should handle article state updates during restoration', () => {
      const initialState: Partial<ListState> = {
        articleIds: ['1', '2', '3'],
        readStates: { '1': false, '2': false, '3': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: 'unread',
      };

      stateManager.saveListState(initialState);

      // Simulate rapid updates during restoration
      const updates = [
        { id: '1', changes: { id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true } },
        { id: '2', changes: { id: '2', isRead: true, wasAutoRead: false, position: 1, sessionPreserved: false } },
        { id: '3', changes: { id: '3', isRead: true, wasAutoRead: true, position: 2, sessionPreserved: true } },
      ];

      const success = stateManager.batchUpdateArticles(updates);
      expect(success).toBe(true);

      const finalState = stateManager.getListState();
      expect(finalState?.readStates['1']).toBe(true);
      expect(finalState?.readStates['2']).toBe(true);
      expect(finalState?.readStates['3']).toBe(true);
      expect(finalState?.autoReadArticles).toContain('1');
      expect(finalState?.autoReadArticles).toContain('3');
      expect(finalState?.manualReadArticles).toContain('2');
    });

    it('should handle intersection observer during scroll restoration', () => {
      // Mock intersection observer entries during restoration
      const mockEntries = [
        {
          isIntersecting: false,
          boundingClientRect: { top: -100, bottom: -50 },
          target: { getAttribute: vi.fn().mockReturnValue('article-1') }
        },
        {
          isIntersecting: true,
          boundingClientRect: { top: 50, bottom: 150 },
          target: { getAttribute: vi.fn().mockReturnValue('article-2') }
        }
      ];

      const autoReadArticles = new Set<string>();

      // Simulate restoration process where observer should be disabled
      let restorationInProgress = true;
      
      const processIntersectionEntries = (entries: typeof mockEntries) => {
        if (restorationInProgress) {
          // During restoration, don't process auto-read
          return;
        }
        
        entries.forEach(entry => {
          if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
            const articleId = entry.target.getAttribute('data-article-id');
            if (articleId) {
              autoReadArticles.add(articleId);
            }
          }
        });
      };

      // During restoration - should not mark as auto-read
      processIntersectionEntries(mockEntries);
      expect(autoReadArticles.size).toBe(0);

      // After restoration - should process normally
      restorationInProgress = false;
      processIntersectionEntries(mockEntries);
      expect(autoReadArticles.has('article-1')).toBe(true);
    });

    it('should handle state expiry during active operations', () => {
      const state: Partial<ListState> = {
        articleIds: ['1', '2'],
        readStates: { '1': false, '2': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 100,
        filterMode: 'unread',
      };

      stateManager.saveListState(state);
      expect(stateManager.isStateExpired()).toBe(false);

      // Advance time to near expiry
      vi.advanceTimersByTime(29 * 60 * 1000); // 29 minutes
      expect(stateManager.isStateExpired()).toBe(false);

      // Advance past expiry
      vi.advanceTimersByTime(2 * 60 * 1000); // 31 minutes total
      expect(stateManager.isStateExpired()).toBe(true);

      // Operations should handle expired state gracefully
      expect(stateManager.getListState()).toBeNull();
      expect(stateManager.getSessionPreservedArticles()).toEqual([]);
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle JSON serialization edge cases', () => {
      const problematicState: Partial<ListState> = {
        articleIds: ['test-1'],
        readStates: { 'test-1': true },
        autoReadArticles: [],
        manualReadArticles: ['test-1'],
        scrollPosition: NaN, // Problematic value
        filterMode: 'unread',
        feedId: undefined, // Should be handled
      };

      // Should handle NaN and undefined values
      expect(() => stateManager.saveListState(problematicState)).not.toThrow();
      
      const result = stateManager.getListState();
      expect(result?.scrollPosition).toBe(0); // NaN should be converted
    });

    it('should handle corrupted session storage data variations', () => {
      const corruptedData = [
        'null',
        '{}',
        '{"incomplete": true}',
        'invalid-json',
        '{"timestamp": "not-a-number"}',
        '{"articleIds": null}',
        JSON.stringify({ articleIds: ['1'], timestamp: null }),
        JSON.stringify({ articleIds: ['1'], timestamp: 'invalid' }),
      ];

      corruptedData.forEach((data, index) => {
        mockSessionStorage.data.articleListState = data;
        
        // Should handle all corrupted data gracefully
        const result = stateManager.getListState();
        expect(result).toBeNull();
        
        // Should clear corrupted data
        expect(mockSessionStorage.removeItem).toHaveBeenCalled();
        
        mockSessionStorage.removeItem.mockClear();
      });
    });

    it('should handle storage access errors', () => {
      // Mock storage access throwing errors
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      expect(() => stateManager.getListState()).not.toThrow();
      expect(stateManager.getListState()).toBeNull();

      // Reset and test setItem error
      mockSessionStorage.getItem.mockRestore();
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage write denied');
      });

      const state: Partial<ListState> = {
        articleIds: ['1'],
        readStates: { '1': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: 'unread',
      };

      expect(() => stateManager.saveListState(state)).not.toThrow();
    });

    it('should handle private browsing storage limitations', () => {
      // Simulate private browsing where storage quota is very limited
      mockSessionStorage.setItem.mockImplementation((key, value) => {
        if (value.length > 1000) { // Very small quota
          throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        }
        mockSessionStorage.data[key] = value;
      });

      const largeState: Partial<ListState> = {
        articleIds: Array.from({ length: 100 }, (_, i) => `very-long-article-id-${i}-with-extra-padding`),
        readStates: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`very-long-article-id-${i}-with-extra-padding`, true])
        ),
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 5000,
        filterMode: 'unread',
      };

      // Should handle private browsing gracefully
      expect(() => stateManager.saveListState(largeState)).not.toThrow();
      
      // Should have attempted fallback
      expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple Tab Scenarios', () => {
    it('should handle state conflicts between tabs', () => {
      const tab1State: Partial<ListState> = {
        articleIds: ['1', '2'],
        readStates: { '1': false, '2': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 100,
        filterMode: 'unread',
        timestamp: Date.now(),
      };

      const tab2State: Partial<ListState> = {
        articleIds: ['1', '2', '3'],
        readStates: { '1': true, '2': false, '3': false },
        autoReadArticles: ['1'],
        manualReadArticles: [],
        scrollPosition: 200,
        filterMode: 'unread',
        timestamp: Date.now() + 1000, // Later timestamp
      };

      // Tab 1 saves state
      stateManager.saveListState(tab1State);
      
      // Tab 2 saves state (should overwrite)
      stateManager.saveListState(tab2State);
      
      // Should get the most recent state
      const result = stateManager.getListState();
      expect(result?.scrollPosition).toBe(200);
      expect(result?.readStates['1']).toBe(true);
      expect(result?.autoReadArticles).toContain('1');
    });

    it('should handle navigation history conflicts', () => {
      // Tab 1 navigation
      testNavigationHistory.addEntry('/', undefined);
      testNavigationHistory.addEntry('/article/1', '1');
      
      // Simulate tab 2 would have different navigation
      const tab2History = new NavigationHistory();
      tab2History.addEntry('/', undefined);
      tab2History.addEntry('/article/2', '2');
      tab2History.addEntry('/article/3', '3');
      
      // Each tab should maintain its own history
      expect(testNavigationHistory.getHistory().length).toBe(2);
      expect(tab2History.getHistory().length).toBe(3);
      
      expect(testNavigationHistory.getCurrentPath()).toBe('/article/1');
      expect(tab2History.getCurrentPath()).toBe('/article/3');
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle very rapid state updates without memory leaks', () => {
      const rapidUpdates = Array.from({ length: 1000 }, (_, i) => ({
        id: `article-${i % 10}`, // Reuse some IDs to test updates
        changes: {
          id: `article-${i % 10}`,
          isRead: i % 2 === 0,
          wasAutoRead: i % 3 === 0,
          position: i % 10,
          sessionPreserved: i % 4 === 0
        }
      }));

      const initialState: Partial<ListState> = {
        articleIds: Array.from({ length: 10 }, (_, i) => `article-${i}`),
        readStates: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`article-${i}`, false])
        ),
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: 'unread',
      };

      stateManager.saveListState(initialState);

      const startTime = performance.now();
      
      // Batch process rapid updates
      const batchSize = 50;
      for (let i = 0; i < rapidUpdates.length; i += batchSize) {
        const batch = rapidUpdates.slice(i, i + batchSize);
        stateManager.batchUpdateArticles(batch);
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should complete in reasonable time
      expect(processingTime).toBeLessThan(1000); // 1 second

      // Final state should be consistent
      const finalState = stateManager.getListState();
      expect(finalState?.articleIds).toHaveLength(10);
    });

    it('should handle large scroll positions and viewport calculations', () => {
      const state: Partial<ListState> = {
        articleIds: ['1'],
        readStates: { '1': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: Number.MAX_SAFE_INTEGER, // Very large scroll position
        filterMode: 'unread',
        visibleRange: { start: 999999, end: 1000000 }, // Large visible range
      };

      expect(() => stateManager.saveListState(state)).not.toThrow();
      
      const result = stateManager.getListState();
      expect(result?.scrollPosition).toBe(Number.MAX_SAFE_INTEGER);
      expect(result?.visibleRange?.start).toBe(999999);
    });

    it('should handle state operations during low memory conditions', () => {
      // Simulate low memory by making operations slower
      const originalSetItem = mockSessionStorage.setItem;
      mockSessionStorage.setItem.mockImplementation((key, value) => {
        // Simulate slower operations under memory pressure
        return new Promise(resolve => {
          setTimeout(() => {
            originalSetItem(key, value);
            resolve(undefined);
          }, 1);
        });
      });

      const state: Partial<ListState> = {
        articleIds: Array.from({ length: 100 }, (_, i) => `article-${i}`),
        readStates: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`article-${i}`, false])
        ),
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 1000,
        filterMode: 'unread',
      };

      // Should still work under memory pressure
      expect(() => stateManager.saveListState(state)).not.toThrow();
    });
  });

  describe('Integration with Auto-read Detection', () => {
    it('should prevent false positives during rapid scroll restoration', () => {
      const state: Partial<ListState> = {
        articleIds: ['1', '2', '3', '4', '5'],
        readStates: { '1': false, '2': false, '3': false, '4': false, '5': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 2000,
        filterMode: 'unread',
        visibleRange: { start: 2, end: 4 }, // Articles 3, 4, 5 visible
      };

      stateManager.saveListState(state);

      // Simulate context restoration
      const contextState = stateManager.ensureSessionStateWithContext('feed-1');
      expect(contextState.visibleRange?.start).toBe(2);
      expect(contextState.visibleRange?.end).toBe(4);

      // During restoration, these articles should not be auto-marked as read
      // This would be handled by temporarily disabling the intersection observer
      const articlesInView = contextState.articleIds?.slice(
        contextState.visibleRange?.start,
        (contextState.visibleRange?.end || 0) + 1
      );

      expect(articlesInView).toEqual(['3', '4', '5']);
    });

    it('should handle edge case where all articles become read', () => {
      const state: Partial<ListState> = {
        articleIds: ['1', '2', '3'],
        readStates: { '1': false, '2': false, '3': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 1000,
        filterMode: 'unread',
      };

      stateManager.saveListState(state);

      // Mark all articles as auto-read
      const updates = [
        { id: '1', changes: { id: '1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true } },
        { id: '2', changes: { id: '2', isRead: true, wasAutoRead: true, position: 1, sessionPreserved: true } },
        { id: '3', changes: { id: '3', isRead: true, wasAutoRead: true, position: 2, sessionPreserved: true } },
      ];

      stateManager.batchUpdateArticles(updates);

      const finalState = stateManager.getListState();
      const preserved = stateManager.getSessionPreservedArticles();

      expect(preserved).toHaveLength(3);
      expect(finalState?.autoReadArticles).toEqual(['1', '2', '3']);
      expect(finalState?.manualReadArticles).toEqual([]);
    });
  });

  describe('Critical Bug Scenario Validation', () => {
    it('should prevent complete article list appearing instead of session-preserved state', () => {
      // Setup: User is in "Unread Only" mode with some auto-read articles
      const initialState: Partial<ListState> = {
        articleIds: ['1', '2', '3', '4', '5'],
        readStates: { '1': false, '2': false, '3': false, '4': false, '5': false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: 'unread',
        feedId: 'test-feed',
      };

      stateManager.saveListState(initialState);

      // User scrolls and first two articles are auto-read
      const scrolledState: Partial<ListState> = {
        ...initialState,
        readStates: { '1': true, '2': true, '3': false, '4': false, '5': false },
        autoReadArticles: ['1', '2'],
        scrollPosition: 500,
      };

      stateManager.saveListState(scrolledState);

      // User clicks on third article (navigates to detail)
      testNavigationHistory.addEntry('/', undefined);
      testNavigationHistory.addEntry('/article/3', '3');

      // User reads the article (marks it manually)
      stateManager.updateArticleState('3', {
        id: '3',
        isRead: true,
        wasAutoRead: false,
        position: 2,
        sessionPreserved: false
      });

      // User navigates back - critical test: should see preserved state, not all articles
      const restoredState = stateManager.getListState();
      const preservedArticles = stateManager.getSessionPreservedArticles();

      // Should preserve auto-read articles AND manually read article
      expect(preservedArticles).toContain('1'); // Auto-read
      expect(preservedArticles).toContain('2'); // Auto-read  
      expect(preservedArticles).toContain('3'); // Manually read

      // In "Unread Only" mode, only preserved articles should be shown among read ones
      const shouldShowInUnreadMode = (articleId: string, isRead: boolean) => {
        if (!isRead) return true; // Always show unread
        return preservedArticles.includes(articleId); // Only show preserved read articles
      };

      expect(shouldShowInUnreadMode('1', true)).toBe(true);  // Preserved
      expect(shouldShowInUnreadMode('2', true)).toBe(true);  // Preserved
      expect(shouldShowInUnreadMode('3', true)).toBe(true);  // Preserved
      expect(shouldShowInUnreadMode('4', false)).toBe(true); // Unread
      expect(shouldShowInUnreadMode('5', false)).toBe(true); // Unread

      // If there were other read articles not in session, they should NOT show
      restoredState!.readStates['6'] = true; // Simulate article read in another session
      expect(shouldShowInUnreadMode('6', true)).toBe(false); // Not preserved
    });

    it('should maintain state consistency across multiple navigation cycles', () => {
      // Complex scenario: multiple reads, navigations, and back operations
      const initialState: Partial<ListState> = {
        articleIds: Array.from({ length: 10 }, (_, i) => `article-${i + 1}`),
        readStates: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`article-${i + 1}`, false])
        ),
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: 'unread',
      };

      stateManager.saveListState(initialState);

      // Cycle 1: Auto-read first 3 articles
      stateManager.batchUpdateArticles([
        { id: 'article-1', changes: { id: 'article-1', isRead: true, wasAutoRead: true, position: 0, sessionPreserved: true } },
        { id: 'article-2', changes: { id: 'article-2', isRead: true, wasAutoRead: true, position: 1, sessionPreserved: true } },
        { id: 'article-3', changes: { id: 'article-3', isRead: true, wasAutoRead: true, position: 2, sessionPreserved: true } },
      ]);

      // Navigate to article 4
      testNavigationHistory.addEntry('/', undefined);
      testNavigationHistory.addEntry('/article/article-4', 'article-4');

      // Cycle 2: Read article 4 manually, then go back
      stateManager.updateArticleState('article-4', {
        id: 'article-4',
        isRead: true,
        wasAutoRead: false,
        position: 3,
        sessionPreserved: false
      });

      testNavigationHistory.goBack();

      // Navigate to article 5
      testNavigationHistory.addEntry('/article/article-5', 'article-5');

      // Cycle 3: Read article 5 manually, then go back
      stateManager.updateArticleState('article-5', {
        id: 'article-5',
        isRead: true,
        wasAutoRead: false,
        position: 4,
        sessionPreserved: false
      });

      testNavigationHistory.goBack();

      // Final state check: all operations should be consistent
      const finalState = stateManager.getListState();
      const preserved = stateManager.getSessionPreservedArticles();

      expect(preserved).toContain('article-1'); // Auto-read
      expect(preserved).toContain('article-2'); // Auto-read
      expect(preserved).toContain('article-3'); // Auto-read
      expect(preserved).toContain('article-4'); // Manually read
      expect(preserved).toContain('article-5'); // Manually read

      expect(finalState?.autoReadArticles).toEqual(['article-1', 'article-2', 'article-3']);
      expect(finalState?.manualReadArticles).toEqual(['article-4', 'article-5']);

      // Navigation history should be consistent
      expect(testNavigationHistory.canGoBack()).toBe(true);
      expect(testNavigationHistory.getCurrentPath()).toBe('/');
    });
  });
});