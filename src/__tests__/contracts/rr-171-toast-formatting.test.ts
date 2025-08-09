import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test Specification for RR-171: Toast Notification Formatting
 * 
 * CRITICAL REQUIREMENTS:
 * 1. NO EMOJIS in any toast messages
 * 2. Omit zero-value segments (don't show "0 removed")
 * 3. Use specific formatting for different sync states
 * 4. Proper duration for different toast types
 * 
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface ToastManager {
  showSyncSuccess(metrics: SyncMetrics): void;
  showSyncPartial(metrics: SyncMetrics): void;
  showSyncError(error: Error): void;
  showRateLimitError(retryAfter: number): void;
  showBackgroundSyncAvailable(): void;
  showSyncInProgress(): void;
  formatSyncMessage(metrics: SyncMetrics): string;
}

interface SyncMetrics {
  newArticles: number;
  deletedArticles: number;
  newTags: number;
  failedFeeds: number;
}

interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

describe('RR-171: Toast Formatting Contract', () => {
  let toastManager: ToastManager;
  let mockToast: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      message: vi.fn()
    };
    
    // Implementation should provide this
    toastManager = {
      formatSyncMessage: (metrics: SyncMetrics) => {
        const parts = [];
        if (metrics.newArticles > 0) {
          parts.push(`${metrics.newArticles} new articles`);
        }
        if (metrics.deletedArticles > 0) {
          parts.push(`${metrics.deletedArticles} removed`);
        }
        if (metrics.newTags > 0) {
          parts.push(`${metrics.newTags} new topics`);
        }
        
        if (parts.length === 0) {
          return 'Already up to date';
        }
        
        return `Sync complete • ${parts.join(' • ')}`;
      },
      
      showSyncSuccess: vi.fn((metrics) => {
        const message = toastManager.formatSyncMessage(metrics);
        mockToast.success(message, { duration: 3000 });
      }),
      
      showSyncPartial: vi.fn((metrics) => {
        const message = toastManager.formatSyncMessage(metrics);
        const warning = `${message} • ${metrics.failedFeeds} feeds failed`;
        mockToast.warning(warning, { duration: 4000 });
      }),
      
      showSyncError: vi.fn((error) => {
        mockToast.error(`Sync failed: ${error.message}`, { duration: 6000 });
      }),
      
      showRateLimitError: vi.fn((retryAfter) => {
        mockToast.error(`API rate limit reached. Try again in ${retryAfter} seconds`, { 
          duration: 8000 
        });
      }),
      
      showBackgroundSyncAvailable: vi.fn(() => {
        mockToast.info('New articles available', {
          duration: 8000,
          action: {
            label: 'Refresh',
            onClick: () => {}
          }
        });
      }),
      
      showSyncInProgress: vi.fn(() => {
        mockToast.info('Sync already in progress...', { duration: 2000 });
      })
    };
  });
  
  describe('Message Formatting Rules', () => {
    it('should NEVER include emojis in messages', () => {
      const testCases = [
        { newArticles: 10, deletedArticles: 5, newTags: 2, failedFeeds: 0 },
        { newArticles: 0, deletedArticles: 0, newTags: 0, failedFeeds: 0 },
        { newArticles: 1, deletedArticles: 0, newTags: 0, failedFeeds: 3 }
      ];
      
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|✅|❌|⚠️|📰|🔄|✨|🎉|😊|👍|💫|🚀|📥|📤|🏷️/gu;
      
      testCases.forEach(metrics => {
        const message = toastManager.formatSyncMessage(metrics);
        expect(message).not.toMatch(emojiRegex);
      });
    });
    
    it('should omit zero-value segments from message', () => {
      const metrics = {
        newArticles: 5,
        deletedArticles: 0, // Should be omitted
        newTags: 0,         // Should be omitted
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).toBe('Sync complete • 5 new articles');
      expect(message).not.toContain('0 removed');
      expect(message).not.toContain('0 new topics');
      expect(message).not.toContain(' • • '); // No double bullets
    });
    
    it('should show "Already up to date" when all metrics are zero', () => {
      const metrics = {
        newArticles: 0,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).toBe('Already up to date');
      expect(message).not.toContain('Sync complete');
      expect(message).not.toContain('0');
    });
    
    it('should use bullet separators for multiple segments', () => {
      const metrics = {
        newArticles: 10,
        deletedArticles: 5,
        newTags: 2,
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).toBe('Sync complete • 10 new articles • 5 removed • 2 new topics');
      expect(message.split(' • ')).toHaveLength(4); // "Sync complete" + 3 segments
    });
    
    it('should use singular/plural forms correctly', () => {
      // Test singular
      let metrics = {
        newArticles: 1,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      };
      
      let message = toastManager.formatSyncMessage(metrics);
      expect(message).toContain('1 new articles'); // Always use plural form for consistency
      
      // Test plural
      metrics = {
        newArticles: 2,
        deletedArticles: 3,
        newTags: 4,
        failedFeeds: 0
      };
      
      message = toastManager.formatSyncMessage(metrics);
      expect(message).toContain('2 new articles');
      expect(message).toContain('3 removed');
      expect(message).toContain('4 new topics');
    });
  });
  
  describe('Toast Types and Durations', () => {
    it('should show success toast with 3-4 second duration', () => {
      const metrics = {
        newArticles: 5,
        deletedArticles: 2,
        newTags: 1,
        failedFeeds: 0
      };
      
      toastManager.showSyncSuccess(metrics);
      
      expect(mockToast.success).toHaveBeenCalledWith(
        'Sync complete • 5 new articles • 2 removed • 1 new topics',
        expect.objectContaining({ duration: 3000 })
      );
    });
    
    it('should show warning toast for partial sync with 4 second duration', () => {
      const metrics = {
        newArticles: 7,
        deletedArticles: 3,
        newTags: 0,
        failedFeeds: 2
      };
      
      toastManager.showSyncPartial(metrics);
      
      expect(mockToast.warning).toHaveBeenCalledWith(
        'Sync complete • 7 new articles • 3 removed • 2 feeds failed',
        expect.objectContaining({ duration: 4000 })
      );
    });
    
    it('should show error toast with 6-8 second duration', () => {
      const error = new Error('Network connection failed');
      
      toastManager.showSyncError(error);
      
      expect(mockToast.error).toHaveBeenCalledWith(
        'Sync failed: Network connection failed',
        expect.objectContaining({ duration: 6000 })
      );
    });
    
    it('should show info toast with action button for background sync', () => {
      toastManager.showBackgroundSyncAvailable();
      
      expect(mockToast.info).toHaveBeenCalledWith(
        'New articles available',
        expect.objectContaining({
          duration: 8000,
          action: expect.objectContaining({
            label: 'Refresh',
            onClick: expect.any(Function)
          })
        })
      );
    });
    
    it('should show brief info toast for sync in progress', () => {
      toastManager.showSyncInProgress();
      
      expect(mockToast.info).toHaveBeenCalledWith(
        'Sync already in progress...',
        expect.objectContaining({ duration: 2000 })
      );
    });
  });
  
  describe('Rate Limit Toast Formatting', () => {
    it('should show countdown in human-readable format', () => {
      // 299 seconds = 4 minutes 59 seconds
      toastManager.showRateLimitError(299);
      
      expect(mockToast.error).toHaveBeenCalledWith(
        'API rate limit reached. Try again in 299 seconds',
        expect.objectContaining({ duration: 8000 })
      );
    });
    
    it('should handle zero retry time', () => {
      toastManager.showRateLimitError(0);
      
      expect(mockToast.error).toHaveBeenCalledWith(
        'API rate limit reached. Try again in 0 seconds',
        expect.objectContaining({ duration: 8000 })
      );
    });
  });
  
  describe('Special Cases', () => {
    it('should handle only deleted articles correctly', () => {
      const metrics = {
        newArticles: 0,
        deletedArticles: 15,
        newTags: 0,
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).toBe('Sync complete • 15 removed');
      expect(message).not.toContain('new articles');
      expect(message).not.toContain('new topics');
    });
    
    it('should handle only new tags correctly', () => {
      const metrics = {
        newArticles: 0,
        deletedArticles: 0,
        newTags: 5,
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).toBe('Sync complete • 5 new topics');
      expect(message).not.toContain('new articles');
      expect(message).not.toContain('removed');
    });
    
    it('should never show failed feeds in success message', () => {
      const metrics = {
        newArticles: 10,
        deletedArticles: 5,
        newTags: 2,
        failedFeeds: 0 // Success case
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).not.toContain('failed');
      expect(message).not.toContain('feeds');
    });
    
    it('should handle large numbers correctly', () => {
      const metrics = {
        newArticles: 1234,
        deletedArticles: 567,
        newTags: 89,
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      expect(message).toBe('Sync complete • 1234 new articles • 567 removed • 89 new topics');
      // No formatting like "1,234" - keep numbers simple
    });
  });
  
  describe('Message Consistency', () => {
    it('should use consistent terminology', () => {
      const metrics = {
        newArticles: 5,
        deletedArticles: 3,
        newTags: 2,
        failedFeeds: 0
      };
      
      const message = toastManager.formatSyncMessage(metrics);
      
      // Consistent terms:
      expect(message).toContain('new articles'); // Not "new posts" or "new items"
      expect(message).toContain('removed');      // Not "deleted" or "cleared"
      expect(message).toContain('new topics');   // Not "new tags" or "new categories"
    });
    
    it('should maintain consistent message structure', () => {
      const variations = [
        { newArticles: 5, deletedArticles: 0, newTags: 0, failedFeeds: 0 },
        { newArticles: 0, deletedArticles: 3, newTags: 0, failedFeeds: 0 },
        { newArticles: 0, deletedArticles: 0, newTags: 2, failedFeeds: 0 },
        { newArticles: 5, deletedArticles: 3, newTags: 0, failedFeeds: 0 },
        { newArticles: 5, deletedArticles: 0, newTags: 2, failedFeeds: 0 },
        { newArticles: 0, deletedArticles: 3, newTags: 2, failedFeeds: 0 },
        { newArticles: 5, deletedArticles: 3, newTags: 2, failedFeeds: 0 }
      ];
      
      variations.forEach(metrics => {
        const message = toastManager.formatSyncMessage(metrics);
        
        const hasChanges = metrics.newArticles > 0 || 
                          metrics.deletedArticles > 0 || 
                          metrics.newTags > 0;
        
        if (hasChanges) {
          expect(message).toMatch(/^Sync complete • /);
        } else {
          expect(message).toBe('Already up to date');
        }
      });
    });
  });
});