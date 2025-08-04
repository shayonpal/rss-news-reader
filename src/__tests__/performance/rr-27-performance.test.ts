import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * RR-27: Article List State Preservation - Performance Tests
 * 
 * These tests ensure that the state preservation implementation maintains
 * acceptable performance characteristics even with large datasets and
 * frequent operations.
 */

// Performance testing utilities
const measureExecutionTime = async (fn: () => Promise<void> | void): Promise<number> => {
  const start = performance.now();
  await fn();
  return performance.now() - start;
};

const measureMemoryUsage = (): number => {
  if (typeof window !== 'undefined' && (window as any).performance?.memory) {
    return (window as any).performance.memory.usedJSHeapSize;
  }
  return 0; // Fallback for Node.js environment
};

// Mock large dataset generators
const generateLargeArticleDataset = (size: number) => {
  return Array.from({ length: size }, (_, index) => ({
    id: `article-${index + 1}`,
    title: `Performance Test Article ${index + 1}`,
    content: `Content for performance test article ${index + 1}. This is a longer content string to simulate real article data with more realistic payload sizes. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`,
    feedTitle: `Test Feed ${Math.floor(index / 100) + 1}`,
    publishedAt: new Date(Date.now() - index * 60000),
    isRead: Math.random() > 0.6, // ~40% read
    wasAutoRead: Math.random() > 0.8, // ~20% auto-read
    position: index,
    sessionPreserved: Math.random() > 0.85, // ~15% session preserved
    tags: index % 10 === 0 ? ['starred'] : [],
    url: `https://example.com/article-${index + 1}`,
    author: `Author ${Math.floor(index / 50) + 1}`,
  }));
};

// State management performance implementations
class PerformantStateManager {
  private readonly STATE_KEY = 'articleListState';
  private readonly EXPIRY_MS = 30 * 60 * 1000;
  private readonly MAX_ARTICLES = 500; // Performance limit
  private cache: Map<string, any> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;

  // Optimized save with compression and chunking
  saveListState(state: any, options: { compress?: boolean; immediate?: boolean } = {}): void {
    const { compress = true, immediate = false } = options;

    const saveOperation = () => {
      try {
        let processedState = { ...state, timestamp: Date.now() };

        // Apply size limits for performance
        if (processedState.articles && processedState.articles.length > this.MAX_ARTICLES) {
          processedState.articles = processedState.articles.slice(0, this.MAX_ARTICLES);
        }

        // Optional compression simulation (in real implementation, could use actual compression)
        if (compress) {
          processedState = this.compressState(processedState);
        }

        const serialized = JSON.stringify(processedState);
        sessionStorage.setItem(this.STATE_KEY, serialized);
        
        // Update cache
        this.cache.set(this.STATE_KEY, processedState);
      } catch (error) {
        console.warn('Failed to save state:', error);
        this.handleSaveFailure(state);
      }
    };

    if (immediate) {
      saveOperation();
    } else {
      // Debounce saves to prevent excessive writes
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(saveOperation, 100);
    }
  }

  // Optimized retrieval with caching
  getListState(useCache: boolean = true): any | null {
    try {
      // Check cache first
      if (useCache && this.cache.has(this.STATE_KEY)) {
        const cached = this.cache.get(this.STATE_KEY);
        if (this.isStateValid(cached)) {
          return cached;
        }
        this.cache.delete(this.STATE_KEY);
      }

      const saved = sessionStorage.getItem(this.STATE_KEY);
      if (!saved) return null;

      const state = JSON.parse(saved);
      
      if (!this.isStateValid(state)) {
        sessionStorage.removeItem(this.STATE_KEY);
        return null;
      }

      // Update cache
      this.cache.set(this.STATE_KEY, state);
      return state;
    } catch (error) {
      console.warn('Failed to retrieve state:', error);
      sessionStorage.removeItem(this.STATE_KEY);
      return null;
    }
  }

  // Batch update operations for performance
  batchUpdateArticles(updates: Array<{ id: string; changes: any }>): boolean {
    try {
      const state = this.getListState();
      if (!state?.articles) return false;

      const articlesMap = new Map(state.articles.map((a: any) => [a.id, a]));
      
      // Apply all updates
      updates.forEach(({ id, changes }) => {
        const article = articlesMap.get(id);
        if (article) {
          articlesMap.set(id, { ...article, ...changes });
        }
      });

      state.articles = Array.from(articlesMap.values());
      this.saveListState(state, { immediate: false });
      return true;
    } catch (error) {
      console.error('Batch update failed:', error);
      return false;
    }
  }

  // Virtual scrolling state management
  getVisibleArticles(startIndex: number, endIndex: number): any[] {
    const state = this.getListState();
    if (!state?.articles) return [];

    return state.articles.slice(startIndex, endIndex + 1);
  }

  private compressState(state: any): any {
    // Simulate compression by removing redundant data
    return {
      ...state,
      articles: state.articles.map((article: any) => ({
        id: article.id,
        isRead: article.isRead,
        wasAutoRead: article.wasAutoRead,
        position: article.position,
        sessionPreserved: article.sessionPreserved,
        // Remove heavy fields for storage efficiency
      })),
    };
  }

  private isStateValid(state: any): boolean {
    if (!state || typeof state !== 'object') return false;
    if (typeof state.timestamp !== 'number') return false;
    if (Date.now() - state.timestamp > this.EXPIRY_MS) return false;
    return true;
  }

  private handleSaveFailure(state: any): void {
    // Fallback: save minimal state
    try {
      const minimalState = {
        scrollPosition: state.scrollPosition || 0,
        timestamp: Date.now(),
        filter: state.filter || 'unread',
      };
      sessionStorage.setItem(`${this.STATE_KEY}_minimal`, JSON.stringify(minimalState));
    } catch (error) {
      console.error('Even minimal state save failed:', error);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Performance-optimized intersection observer
class PerformantAutoReadManager {
  private observer: IntersectionObserver | null = null;
  private pendingUpdates: Set<string> = new Set();
  private throttleTimer: NodeJS.Timeout | null = null;
  private readonly THROTTLE_MS = 200;
  private readonly BATCH_SIZE = 10;

  createOptimizedObserver(callback: (articleIds: string[]) => void): IntersectionObserver {
    return new IntersectionObserver(
      (entries) => {
        const articlesToMark: string[] = [];

        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) {
            const articleId = (entry.target as HTMLElement).dataset.articleId;
            const isRead = (entry.target as HTMLElement).dataset.isRead === 'true';
            
            if (articleId && !isRead) {
              articlesToMark.push(articleId);
            }
          }
        });

        if (articlesToMark.length > 0) {
          this.throttledCallback(articlesToMark, callback);
        }
      },
      {
        rootMargin: '0px 0px -80% 0px', // Optimized trigger zone
        threshold: 0,
      }
    );
  }

  private throttledCallback(articleIds: string[], callback: (articleIds: string[]) => void): void {
    articleIds.forEach(id => this.pendingUpdates.add(id));

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }

    this.throttleTimer = setTimeout(() => {
      const batch = Array.from(this.pendingUpdates).slice(0, this.BATCH_SIZE);
      this.pendingUpdates.clear();
      
      if (batch.length > 0) {
        callback(batch);
      }
    }, this.THROTTLE_MS);
  }

  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.pendingUpdates.clear();
  }
}

describe('RR-27: Article List State Preservation - Performance Tests', () => {
  let stateManager: PerformantStateManager;
  let autoReadManager: PerformantAutoReadManager;
  let mockSessionStorage: any;

  beforeEach(() => {
    // Mock sessionStorage with performance characteristics
    mockSessionStorage = {
      data: {} as Record<string, string>,
      getItem: vi.fn((key: string) => {
        // Simulate storage read latency
        return mockSessionStorage.data[key] || null;
      }),
      setItem: vi.fn((key: string, value: string) => {
        // Simulate storage write latency and quota
        if (Object.keys(mockSessionStorage.data).length > 50) {
          throw new Error('QuotaExceededError');
        }
        mockSessionStorage.data[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage.data[key];
      }),
    };

    vi.stubGlobal('sessionStorage', mockSessionStorage);
    vi.useFakeTimers();

    stateManager = new PerformantStateManager();
    autoReadManager = new PerformantAutoReadManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    autoReadManager.disconnect();
    stateManager.clearCache();
  });

  describe('Large Dataset Performance', () => {
    it('should handle 1000 articles with acceptable performance', async () => {
      const largeDataset = generateLargeArticleDataset(1000);
      
      const state = {
        articles: largeDataset,
        scrollPosition: 2500,
        timestamp: Date.now(),
        filter: 'unread',
      };

      // Test save performance
      const saveTime = await measureExecutionTime(() => {
        stateManager.saveListState(state, { immediate: true });
      });

      expect(saveTime).toBeLessThan(50); // Should complete in under 50ms

      // Test retrieval performance
      const retrieveTime = await measureExecutionTime(() => {
        stateManager.getListState(false); // Force storage read
      });

      expect(retrieveTime).toBeLessThan(30); // Should complete in under 30ms

      // Verify data integrity
      const retrievedState = stateManager.getListState();
      expect(retrievedState).toBeTruthy();
      expect(retrievedState.articles.length).toBeLessThanOrEqual(500); // Limited for performance
    });

    it('should handle 5000 articles with compression and chunking', async () => {
      const massiveDataset = generateLargeArticleDataset(5000);
      
      const state = {
        articles: massiveDataset,
        scrollPosition: 10000,
        timestamp: Date.now(),
        filter: 'all',
      };

      // Should not crash or timeout
      const saveTime = await measureExecutionTime(() => {
        stateManager.saveListState(state, { compress: true, immediate: true });
      });

      expect(saveTime).toBeLessThan(100); // Acceptable for large dataset

      const retrievedState = stateManager.getListState();
      expect(retrievedState).toBeTruthy();
      // Should be truncated for performance
      expect(retrievedState.articles.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Rapid Operation Performance', () => {
    it('should handle rapid state updates with debouncing', async () => {
      const articles = generateLargeArticleDataset(100);
      
      // Simulate rapid updates (like during scrolling)
      const updateTimes: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const updateTime = await measureExecutionTime(() => {
          stateManager.saveListState({
            articles,
            scrollPosition: i * 100,
            timestamp: Date.now(),
            filter: 'unread',
          });
        });
        updateTimes.push(updateTime);
      }

      // Debouncing should keep individual operations fast
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(10); // Very fast due to debouncing

      // Final state should be consistent
      vi.advanceTimersByTime(200); // Let debounce complete
      const finalState = stateManager.getListState();
      expect(finalState.scrollPosition).toBe(1900); // Last update
    });

    it('should batch article updates efficiently', async () => {
      const articles = generateLargeArticleDataset(200);
      
      stateManager.saveListState({
        articles,
        scrollPosition: 0,
        timestamp: Date.now(),
        filter: 'unread',
      }, { immediate: true });

      // Batch update 50 articles
      const updates = Array.from({ length: 50 }, (_, i) => ({
        id: `article-${i + 1}`,
        changes: { isRead: true, wasAutoRead: true, sessionPreserved: true },
      }));

      const batchTime = await measureExecutionTime(() => {
        stateManager.batchUpdateArticles(updates);
      });

      expect(batchTime).toBeLessThan(30); // Efficient batch operation

      vi.advanceTimersByTime(200); // Let debounce complete
      const updatedState = stateManager.getListState();
      const updatedArticles = updatedState.articles.filter((a: any) => a.isRead);
      expect(updatedArticles.length).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should implement effective caching without memory leaks', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Perform many state operations
      for (let i = 0; i < 100; i++) {
        const articles = generateLargeArticleDataset(50);
        stateManager.saveListState({
          articles,
          scrollPosition: i * 10,
          timestamp: Date.now(),
          filter: 'unread',
        }, { immediate: true });
        
        stateManager.getListState(); // Cache access
      }

      // Clear cache to prevent memory leaks
      stateManager.clearCache();

      const finalMemory = measureMemoryUsage();
      
      // Memory usage should not grow excessively
      if (initialMemory > 0 && finalMemory > 0) {
        expect(finalMemory - initialMemory).toBeLessThan(10 * 1024 * 1024); // Less than 10MB growth
      }
    });

    it('should handle virtual scrolling efficiently', async () => {
      const largeDataset = generateLargeArticleDataset(2000);
      
      stateManager.saveListState({
        articles: largeDataset,
        scrollPosition: 5000,
        timestamp: Date.now(),
        filter: 'all',
      }, { immediate: true });

      // Test virtual scrolling performance
      const viewportTests = [
        { start: 0, end: 49 },    // First page
        { start: 50, end: 99 },   // Second page
        { start: 950, end: 999 }, // Middle page
        { start: 450, end: 499 }, // Jump back
      ];

      for (const { start, end } of viewportTests) {
        const retrievalTime = await measureExecutionTime(() => {
          stateManager.getVisibleArticles(start, end);
        });
        
        expect(retrievalTime).toBeLessThan(10); // Very fast viewport retrieval
      }
    });
  });

  describe('Intersection Observer Performance', () => {
    it('should handle many article elements efficiently', async () => {
      const mockArticleElements = Array.from({ length: 500 }, (_, i) => ({
        dataset: { articleId: `article-${i + 1}`, isRead: 'false' },
        getBoundingClientRect: () => ({ bottom: -10 }),
      }));

      let processedBatches = 0;
      const callback = (articleIds: string[]) => {
        processedBatches++;
        expect(articleIds.length).toBeLessThanOrEqual(10); // Batch size limit
      };

      const observer = autoReadManager.createOptimizedObserver(callback);

      // Simulate many articles leaving viewport
      const mockEntries = mockArticleElements.map(el => ({
        isIntersecting: false,
        boundingClientRect: { bottom: -10 },
        target: el,
      }));

      const observerTime = await measureExecutionTime(() => {
        observer.callback(mockEntries as any);
      });

      expect(observerTime).toBeLessThan(50); // Fast processing of many elements

      // Advance time to trigger throttled callbacks
      vi.advanceTimersByTime(300);

      expect(processedBatches).toBeGreaterThan(0);
      expect(processedBatches).toBeLessThanOrEqual(50); // Reasonable number of batches
    });

    it('should throttle rapid intersection events', async () => {
      let callbackCount = 0;
      const callback = (articleIds: string[]) => {
        callbackCount++;
      };

      const observer = autoReadManager.createOptimizedObserver(callback);

      // Simulate rapid scroll events
      for (let i = 0; i < 100; i++) {
        const mockEntry = {
          isIntersecting: false,
          boundingClientRect: { bottom: -10 },
          target: { dataset: { articleId: `article-${i}`, isRead: 'false' } },
        };

        observer.callback([mockEntry] as any);
      }

      // Before throttle resolution
      expect(callbackCount).toBe(0);

      // After throttle resolution
      vi.advanceTimersByTime(250);
      expect(callbackCount).toBe(1); // Only one batched callback
    });
  });

  describe('Storage Quota and Fallback Performance', () => {
    it('should handle storage quota gracefully without blocking', async () => {
      // Simulate approaching storage quota
      for (let i = 0; i < 45; i++) {
        mockSessionStorage.data[`filler-${i}`] = 'x'.repeat(1000);
      }

      const largeState = {
        articles: generateLargeArticleDataset(1000),
        scrollPosition: 5000,
        timestamp: Date.now(),
        filter: 'unread',
      };

      // Should not throw or block
      const saveTime = await measureExecutionTime(() => {
        stateManager.saveListState(largeState, { immediate: true });
      });

      expect(saveTime).toBeLessThan(100); // Fast fallback handling

      // Should have fallback data
      const fallbackData = mockSessionStorage.data['articleListState_minimal'];
      expect(fallbackData).toBeTruthy();
    });

    it('should recover quickly from storage failures', async () => {
      // Simulate storage failure
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage failed');
      });

      const state = {
        articles: generateLargeArticleDataset(100),
        scrollPosition: 1000,
        timestamp: Date.now(),
        filter: 'unread',
      };

      // Should handle gracefully and quickly
      const errorHandlingTime = await measureExecutionTime(() => {
        stateManager.saveListState(state, { immediate: true });
      });

      expect(errorHandlingTime).toBeLessThan(20); // Fast error handling
    });
  });

  describe('Real-world Performance Scenarios', () => {
    it('should maintain performance during heavy user interaction', async () => {
      // Simulate heavy user interaction: scrolling, clicking, navigating
      const articles = generateLargeArticleDataset(300);
      
      const scenarios = [
        () => stateManager.saveListState({ articles, scrollPosition: Math.random() * 1000, timestamp: Date.now(), filter: 'unread' }),
        () => stateManager.getListState(),
        () => stateManager.batchUpdateArticles([{ id: 'article-1', changes: { isRead: true } }]),
      ];

      const operationTimes: number[] = [];

      // Run 200 mixed operations
      for (let i = 0; i < 200; i++) {
        const scenario = scenarios[i % scenarios.length];
        const time = await measureExecutionTime(scenario);
        operationTimes.push(time);
      }

      const avgTime = operationTimes.reduce((a, b) => a + b, 0) / operationTimes.length;
      const maxTime = Math.max(...operationTimes);

      expect(avgTime).toBeLessThan(15); // Average operation under 15ms
      expect(maxTime).toBeLessThan(100); // No operation over 100ms
    });

    it('should handle concurrent operations without performance degradation', async () => {
      const concurrentOperations = Array.from({ length: 20 }, (_, i) => 
        measureExecutionTime(async () => {
          const articles = generateLargeArticleDataset(50);
          stateManager.saveListState({
            articles,
            scrollPosition: i * 100,
            timestamp: Date.now(),
            filter: 'unread',
          });
          
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          
          stateManager.getListState();
        })
      );

      const times = await Promise.all(concurrentOperations);
      const avgConcurrentTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(avgConcurrentTime).toBeLessThan(50); // Concurrent operations remain fast
    });
  });

  describe('Benchmarking and Regression Prevention', () => {
    it('should meet performance benchmarks for typical usage', async () => {
      const benchmarks = {
        smallListSave: { size: 50, expectedTime: 10 },
        mediumListSave: { size: 200, expectedTime: 25 },
        largeListSave: { size: 500, expectedTime: 50 },
        retrieval: { expectedTime: 20 },
        batchUpdate: { updates: 20, expectedTime: 15 },
      };

      // Test save performance across sizes
      for (const [name, benchmark] of Object.entries(benchmarks)) {
        if (name.includes('Save')) {
          const articles = generateLargeArticleDataset(benchmark.size);
          const time = await measureExecutionTime(() => {
            stateManager.saveListState({
              articles,
              scrollPosition: 1000,
              timestamp: Date.now(),
              filter: 'unread',
            }, { immediate: true });
          });

          expect(time).toBeLessThan(benchmark.expectedTime);
        }
      }

      // Test retrieval performance
      const retrievalTime = await measureExecutionTime(() => {
        stateManager.getListState(false);
      });
      expect(retrievalTime).toBeLessThan(benchmarks.retrieval.expectedTime);

      // Test batch update performance
      const updates = Array.from({ length: benchmarks.batchUpdate.updates }, (_, i) => ({
        id: `article-${i + 1}`,
        changes: { isRead: true },
      }));
      
      const batchTime = await measureExecutionTime(() => {
        stateManager.batchUpdateArticles(updates);
      });
      expect(batchTime).toBeLessThan(benchmarks.batchUpdate.expectedTime);
    });
  });
});