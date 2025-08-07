import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArticleList } from '@/components/articles/article-list';
import { StatusChangeLogger } from '@/lib/logging/status-change-logger';
import { useArticleStore } from '@/lib/stores/article-store';
import type { Article } from '@/types';

// Mock the status change logger
vi.mock('@/lib/logging/status-change-logger', () => ({
  StatusChangeLogger: {
    getInstance: vi.fn(() => ({
      logStatusChange: vi.fn(),
      batchLogStatusChanges: vi.fn(),
    })),
  },
}));

// Mock the article store
vi.mock('@/lib/stores/article-store', () => ({
  useArticleStore: vi.fn(),
}));

// Mock intersection observer
const mockIntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

global.IntersectionObserver = mockIntersectionObserver;

describe('Auto-Scroll Tracking Integration - RR-29', () => {
  let mockLogger: any;
  let mockStore: any;
  
  const createMockArticle = (id: string, isRead = false): Article => ({
    id,
    feedId: 'feed-1',
    title: `Test Article ${id}`,
    content: 'Test content',
    url: `https://example.com/${id}`,
    tags: [],
    publishedAt: new Date(),
    author: 'Test Author',
    authorName: 'Test Author', 
    isRead,
    createdAt: new Date(),
    updatedAt: new Date(),
    inoreaderItemId: `inoreader-${id}`,
    fullContentUrl: `https://example.com/${id}`,
    hasFullContent: false,
    isPartial: false,
    feedTitle: 'Test Feed',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogger = StatusChangeLogger.getInstance();
    
    const mockArticles = new Map([
      ['article-1', createMockArticle('article-1')],
      ['article-2', createMockArticle('article-2')],
      ['article-3', createMockArticle('article-3')],
    ]);

    mockStore = {
      articles: mockArticles,
      loadingArticles: false,
      loadingMore: false,
      articlesError: null,
      hasMore: true,
      summarizingArticles: new Set(),
      readStatusFilter: 'unread',
      loadArticles: vi.fn(),
      loadMoreArticles: vi.fn(),
      markAsRead: vi.fn(),
      markMultipleAsRead: vi.fn(),
      toggleStar: vi.fn(),
      refreshArticles: vi.fn(),
      clearError: vi.fn(),
    };

    vi.mocked(useArticleStore).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auto-Scroll Detection vs Manual Clicks', () => {
    it('should distinguish between manual click and auto-scroll', async () => {
      const { container } = render(<ArticleList />);
      
      // Simulate manual click on article
      const articleElement = container.querySelector('[data-article-id="article-1"]');
      if (articleElement) {
        fireEvent.click(articleElement);
      }
      
      expect(mockStore.markAsRead).toHaveBeenCalledWith('article-1', 'user_click');
    });

    it('should detect auto-scroll when article becomes visible', () => {
      render(<ArticleList />);
      
      // Get the intersection observer callback
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Simulate article becoming visible through scroll
      const mockEntry = {
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: true,
        intersectionRatio: 0.7,
        time: Date.now(),
      };
      
      observerCallback([mockEntry]);
      
      // Should trigger auto-scroll logging after dwell time
      setTimeout(() => {
        expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
          expect.objectContaining({
            trigger: 'auto_scroll',
            scrollPosition: expect.any(Number),
            viewportVisibility: 0.7,
            dwellTime: expect.any(Number),
          })
        );
      }, 2000); // After dwell time threshold
    });

    it('should capture scroll position metadata', () => {
      const scrollContainer = { scrollTop: 500, scrollHeight: 2000 };
      Object.defineProperty(window, 'scrollY', { value: 500, configurable: true });
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      const mockEntry = {
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: true,
        intersectionRatio: 0.8,
        time: Date.now(),
      };
      
      observerCallback([mockEntry]);
      
      setTimeout(() => {
        expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
          expect.objectContaining({
            scrollPosition: 500,
            scrollPercentage: 0.25, // 500/2000
            viewportVisibility: 0.8,
          })
        );
      }, 2000);
    });
  });

  describe('Time Spent Viewing Article Tracking', () => {
    it('should track dwell time for articles', () => {
      vi.useFakeTimers();
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Article enters viewport
      const enterTime = Date.now();
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: true,
        intersectionRatio: 0.8,
        time: enterTime,
      }]);
      
      // Article exits viewport after 3 seconds
      vi.advanceTimersByTime(3000);
      const exitTime = Date.now();
      
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: false,
        intersectionRatio: 0,
        time: exitTime,
      }]);
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          dwellTime: 3000,
          viewingDuration: 3000,
        })
      );
      
      vi.useRealTimers();
    });

    it('should have minimum dwell time threshold for auto-marking as read', () => {
      vi.useFakeTimers();
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Article visible for less than threshold (1 second)
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: true,
        intersectionRatio: 0.8,
        time: Date.now(),
      }]);
      
      vi.advanceTimersByTime(500); // Less than 1 second
      
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: false,
        intersectionRatio: 0,
        time: Date.now(),
      }]);
      
      // Should not auto-mark as read
      expect(mockStore.markAsRead).not.toHaveBeenCalledWith('article-1', 'auto_scroll');
      
      vi.useRealTimers();
    });
  });

  describe('Viewport Dimensions and Visibility Tracking', () => {
    it('should capture viewport dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: true,
        intersectionRatio: 0.5,
        time: Date.now(),
      }]);
      
      setTimeout(() => {
        expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
          expect.objectContaining({
            viewportWidth: 1024,
            viewportHeight: 768,
            viewportVisibility: 0.5,
          })
        );
      }, 2000);
    });

    it('should track article visibility percentage accurately', () => {
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Test different visibility percentages
      const visibilityTests = [
        { ratio: 0.25, expected: 0.25 },
        { ratio: 0.5, expected: 0.5 },
        { ratio: 0.75, expected: 0.75 },
        { ratio: 1.0, expected: 1.0 },
      ];
      
      visibilityTests.forEach(({ ratio, expected }) => {
        observerCallback([{
          target: { dataset: { articleId: 'article-1' } },
          isIntersecting: true,
          intersectionRatio: ratio,
          time: Date.now(),
        }]);
        
        setTimeout(() => {
          expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
            expect.objectContaining({
              viewportVisibility: expected,
            })
          );
        }, 2000);
      });
    });
  });

  describe('Intentional vs Rapid Scroll Detection', () => {
    it('should detect rapid scroll-through behavior', () => {
      vi.useFakeTimers();
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Simulate rapid scroll through multiple articles
      const articles = ['article-1', 'article-2', 'article-3'];
      const startTime = Date.now();
      
      articles.forEach((articleId, index) => {
        vi.advanceTimersByTime(100); // Very fast scroll
        
        observerCallback([{
          target: { dataset: { articleId } },
          isIntersecting: true,
          intersectionRatio: 0.8,
          time: startTime + (index * 100),
        }]);
        
        vi.advanceTimersByTime(50);
        
        observerCallback([{
          target: { dataset: { articleId } },
          isIntersecting: false,
          intersectionRatio: 0,
          time: startTime + (index * 100) + 50,
        }]);
      });
      
      // Should detect rapid scroll pattern
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollBehavior: 'rapid',
          scrollVelocity: expect.any(Number),
          dwellTime: expect.any(Number),
        })
      );
      
      vi.useRealTimers();
    });

    it('should detect intentional reading behavior', () => {
      vi.useFakeTimers();
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Article visible for extended time (intentional reading)
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: true,
        intersectionRatio: 0.9,
        time: Date.now(),
      }]);
      
      vi.advanceTimersByTime(5000); // 5 seconds of viewing
      
      observerCallback([{
        target: { dataset: { articleId: 'article-1' } },
        isIntersecting: false,
        intersectionRatio: 0,
        time: Date.now(),
      }]);
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          scrollBehavior: 'intentional',
          dwellTime: 5000,
          engagementLevel: 'high',
        })
      );
      
      vi.useRealTimers();
    });
  });

  describe('Batch Processing of Auto-Scroll Events', () => {
    it('should batch multiple auto-scroll events', () => {
      vi.useFakeTimers();
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Multiple articles become visible rapidly
      const articleIds = ['article-1', 'article-2', 'article-3'];
      
      articleIds.forEach(articleId => {
        observerCallback([{
          target: { dataset: { articleId } },
          isIntersecting: true,
          intersectionRatio: 0.8,
          time: Date.now(),
        }]);
        
        vi.advanceTimersByTime(2000); // Meet dwell threshold
        
        observerCallback([{
          target: { dataset: { articleId } },
          isIntersecting: false,
          intersectionRatio: 0,
          time: Date.now(),
        }]);
      });
      
      // Should batch the log entries
      expect(mockLogger.batchLogStatusChanges).toHaveBeenCalledWith(
        articleIds.map(articleId => expect.objectContaining({
          articleId,
          trigger: 'auto_scroll',
        }))
      );
      
      vi.useRealTimers();
    });

    it('should respect batch size limits', () => {
      render(<ArticleList />);
      
      // Simulate many articles becoming visible (more than batch limit)
      const manyArticles = Array.from({ length: 50 }, (_, i) => `article-${i}`);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      manyArticles.forEach(articleId => {
        observerCallback([{
          target: { dataset: { articleId } },
          isIntersecting: true,
          intersectionRatio: 0.8,
          time: Date.now(),
        }]);
      });
      
      // Should create multiple batches
      expect(mockLogger.batchLogStatusChanges).toHaveBeenCalledTimes(2);
      
      // First batch should have 25 items (default batch size)
      expect(mockLogger.batchLogStatusChanges).toHaveBeenNthCalledWith(1,
        expect.arrayContaining(
          Array.from({ length: 25 }, (_, i) => 
            expect.objectContaining({ articleId: `article-${i}` })
          )
        )
      );
    });
  });

  describe('Scroll Event Debouncing', () => {
    it('should debounce rapid scroll events', () => {
      vi.useFakeTimers();
      
      render(<ArticleList />);
      
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      
      // Rapid fire scroll events
      for (let i = 0; i < 10; i++) {
        observerCallback([{
          target: { dataset: { articleId: 'article-1' } },
          isIntersecting: true,
          intersectionRatio: 0.8,
          time: Date.now() + i,
        }]);
        
        vi.advanceTimersByTime(10);
      }
      
      // Should only process once after debounce period
      vi.advanceTimersByTime(1000);
      
      expect(mockLogger.logStatusChange).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });
});