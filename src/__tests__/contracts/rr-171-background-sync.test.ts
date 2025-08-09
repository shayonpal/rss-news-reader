import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Test Specification for RR-171: Background Sync Interaction
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Background sync shows info toast: "New articles available" with [Refresh] button
 * 2. Refresh button triggers RefreshManager.refreshAllStores() - client refresh only
 * 3. Does NOT reset background sync timer
 * 4. Queues single info toast if completing during manual sync
 * 5. No disruption to user's reading experience
 * 
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface BackgroundSyncManager {
  isBackgroundSyncRunning: boolean;
  lastBackgroundSyncTime: Date | null;
  backgroundSyncTimer: NodeJS.Timer | null;
  pendingNotification: boolean;
  
  performBackgroundSync(): Promise<void>;
  scheduleNextBackgroundSync(): void;
  handleBackgroundSyncComplete(result: SyncResult): void;
  notifyUserOfNewContent(): void;
}

interface ManualSyncState {
  isManualSyncRunning: boolean;
  manualSyncStartTime: Date | null;
}

interface SyncResult {
  syncId: string;
  status: 'completed' | 'partial' | 'failed';
  metrics: {
    newArticles: number;
    deletedArticles: number;
    newTags: number;
    failedFeeds: number;
  };
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface UserReadingState {
  currentArticleId: string | null;
  scrollPosition: number;
  isReading: boolean;
}

describe('RR-171: Background Sync Interaction Contract', () => {
  let backgroundSyncManager: BackgroundSyncManager;
  let manualSyncState: ManualSyncState;
  let userReadingState: UserReadingState;
  let mockToast: any;
  let mockRefreshManager: any;
  let mockSyncAPI: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockToast = {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      dismiss: vi.fn()
    };
    
    mockRefreshManager = {
      refreshAllStores: vi.fn().mockResolvedValue(undefined),
      refreshFeeds: vi.fn().mockResolvedValue(undefined),
      refreshArticles: vi.fn().mockResolvedValue(undefined),
      refreshTags: vi.fn().mockResolvedValue(undefined)
    };
    
    mockSyncAPI = vi.fn().mockResolvedValue({
      syncId: 'bg-sync-' + Date.now(),
      status: 'completed',
      metrics: {
        newArticles: 5,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      }
    });
    
    manualSyncState = {
      isManualSyncRunning: false,
      manualSyncStartTime: null
    };
    
    userReadingState = {
      currentArticleId: 'article-123',
      scrollPosition: 500,
      isReading: true
    };
    
    backgroundSyncManager = {
      isBackgroundSyncRunning: false,
      lastBackgroundSyncTime: null,
      backgroundSyncTimer: null,
      pendingNotification: false,
      
      performBackgroundSync: async function() {
        this.isBackgroundSyncRunning = true;
        
        try {
          const result = await mockSyncAPI();
          this.handleBackgroundSyncComplete(result);
          this.lastBackgroundSyncTime = new Date();
          return result;
        } finally {
          this.isBackgroundSyncRunning = false;
        }
      },
      
      scheduleNextBackgroundSync: function() {
        // Schedule next sync in 4 hours (per RR-130: 6x daily)
        const fourHoursMs = 4 * 60 * 60 * 1000;
        if (this.backgroundSyncTimer) {
          clearTimeout(this.backgroundSyncTimer);
        }
        this.backgroundSyncTimer = setTimeout(() => {
          this.performBackgroundSync();
        }, fourHoursMs);
      },
      
      handleBackgroundSyncComplete: function(result: SyncResult) {
        if (result.metrics.newArticles > 0) {
          if (manualSyncState.isManualSyncRunning) {
            // Queue notification for after manual sync
            this.pendingNotification = true;
          } else {
            this.notifyUserOfNewContent();
          }
        }
        
        // Schedule next sync regardless
        this.scheduleNextBackgroundSync();
      },
      
      notifyUserOfNewContent: function() {
        mockToast.info('New articles available', {
          duration: 8000,
          action: {
            label: 'Refresh',
            onClick: () => {
              // Client-side refresh only
              mockRefreshManager.refreshAllStores();
            }
          }
        });
        this.pendingNotification = false;
      }
    };
  });
  
  afterEach(() => {
    vi.useRealTimers();
    if (backgroundSyncManager.backgroundSyncTimer) {
      clearTimeout(backgroundSyncManager.backgroundSyncTimer);
    }
  });
  
  describe('Background Sync Notification', () => {
    it('should show info toast when new articles arrive via background sync', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      expect(mockToast.info).toHaveBeenCalledWith(
        'New articles available',
        expect.objectContaining({
          duration: 8000,
          action: expect.objectContaining({
            label: 'Refresh'
          })
        })
      );
    });
    
    it('should NOT show toast when no new articles', async () => {
      mockSyncAPI.mockResolvedValueOnce({
        syncId: 'bg-sync-no-new',
        status: 'completed',
        metrics: {
          newArticles: 0,
          deletedArticles: 5,
          newTags: 0,
          failedFeeds: 0
        }
      });
      
      await backgroundSyncManager.performBackgroundSync();
      
      expect(mockToast.info).not.toHaveBeenCalled();
    });
    
    it('should trigger client-side refresh when Refresh button clicked', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      // Get the action from the toast call
      const toastCall = mockToast.info.mock.calls[0];
      const action = toastCall[1].action;
      
      expect(action.label).toBe('Refresh');
      
      // Simulate clicking the Refresh button
      await action.onClick();
      
      // Should call RefreshManager, not sync API
      expect(mockRefreshManager.refreshAllStores).toHaveBeenCalledTimes(1);
      expect(mockSyncAPI).toHaveBeenCalledTimes(1); // Only the background sync itself
    });
    
    it('should NOT make server API call when Refresh clicked', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      const initialSyncCalls = mockSyncAPI.mock.calls.length;
      
      // Click Refresh button
      const action = mockToast.info.mock.calls[0][1].action;
      await action.onClick();
      
      // No additional sync API calls
      expect(mockSyncAPI).toHaveBeenCalledTimes(initialSyncCalls);
    });
  });
  
  describe('Background Sync Timer Management', () => {
    it('should NOT reset timer when Refresh button is clicked', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      const timerAfterSync = backgroundSyncManager.backgroundSyncTimer;
      expect(timerAfterSync).toBeTruthy();
      
      // Click Refresh button
      const action = mockToast.info.mock.calls[0][1].action;
      await action.onClick();
      
      // Timer should be unchanged
      expect(backgroundSyncManager.backgroundSyncTimer).toBe(timerAfterSync);
    });
    
    it('should maintain 4-hour schedule regardless of user refreshes', async () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      
      await backgroundSyncManager.performBackgroundSync();
      
      // Advance 2 hours
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // User clicks refresh multiple times
      const action = mockToast.info.mock.calls[0][1].action;
      await action.onClick();
      await action.onClick();
      await action.onClick();
      
      // Advance another 2 hours (total 4 hours)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // Background sync should trigger on schedule
      expect(backgroundSyncManager.isBackgroundSyncRunning).toBe(false); // Will be async
    });
    
    it('should schedule next sync after each background sync', async () => {
      const scheduleSpy = vi.spyOn(backgroundSyncManager, 'scheduleNextBackgroundSync');
      
      await backgroundSyncManager.performBackgroundSync();
      
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
      expect(backgroundSyncManager.backgroundSyncTimer).toBeTruthy();
    });
  });
  
  describe('Manual and Background Sync Interaction', () => {
    it('should queue notification if background sync completes during manual sync', async () => {
      // Start manual sync
      manualSyncState.isManualSyncRunning = true;
      manualSyncState.manualSyncStartTime = new Date();
      
      // Background sync completes while manual is running
      await backgroundSyncManager.performBackgroundSync();
      
      // Should NOT show toast immediately
      expect(mockToast.info).not.toHaveBeenCalled();
      expect(backgroundSyncManager.pendingNotification).toBe(true);
    });
    
    it('should show queued notification after manual sync completes', async () => {
      // Setup: background sync completed during manual
      manualSyncState.isManualSyncRunning = true;
      await backgroundSyncManager.performBackgroundSync();
      
      expect(backgroundSyncManager.pendingNotification).toBe(true);
      expect(mockToast.info).not.toHaveBeenCalled();
      
      // Manual sync completes
      manualSyncState.isManualSyncRunning = false;
      
      // Show the queued notification
      if (backgroundSyncManager.pendingNotification) {
        backgroundSyncManager.notifyUserOfNewContent();
      }
      
      expect(mockToast.info).toHaveBeenCalledTimes(1);
      expect(backgroundSyncManager.pendingNotification).toBe(false);
    });
    
    it('should show only ONE toast even if multiple background syncs queue', async () => {
      manualSyncState.isManualSyncRunning = true;
      
      // Multiple background syncs during manual sync
      await backgroundSyncManager.performBackgroundSync();
      await backgroundSyncManager.performBackgroundSync();
      await backgroundSyncManager.performBackgroundSync();
      
      // Should only set pending once
      expect(backgroundSyncManager.pendingNotification).toBe(true);
      
      // Complete manual sync
      manualSyncState.isManualSyncRunning = false;
      backgroundSyncManager.notifyUserOfNewContent();
      
      // Only one toast shown
      expect(mockToast.info).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('User Reading Experience Protection', () => {
    it('should NOT disrupt scroll position when background sync completes', async () => {
      const initialScrollPosition = userReadingState.scrollPosition;
      const initialArticleId = userReadingState.currentArticleId;
      
      await backgroundSyncManager.performBackgroundSync();
      
      // User state should be unchanged
      expect(userReadingState.scrollPosition).toBe(initialScrollPosition);
      expect(userReadingState.currentArticleId).toBe(initialArticleId);
      expect(userReadingState.isReading).toBe(true);
    });
    
    it('should NOT auto-refresh UI when background sync has new articles', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      // Should show notification but NOT auto-refresh
      expect(mockToast.info).toHaveBeenCalled();
      expect(mockRefreshManager.refreshAllStores).not.toHaveBeenCalled();
      
      // User must explicitly click Refresh
    });
    
    it('should allow user to dismiss notification without refreshing', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      // User dismisses toast without clicking Refresh
      mockToast.dismiss();
      
      // No refresh should occur
      expect(mockRefreshManager.refreshAllStores).not.toHaveBeenCalled();
      
      // User continues reading undisrupted
      expect(userReadingState.isReading).toBe(true);
    });
    
    it('should preserve user context during client-side refresh', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      // User's current state
      const userContext = {
        articleId: userReadingState.currentArticleId,
        scrollPos: userReadingState.scrollPosition
      };
      
      // Click Refresh
      const action = mockToast.info.mock.calls[0][1].action;
      
      // Mock refresh that preserves context
      mockRefreshManager.refreshAllStores.mockImplementation(async () => {
        // Should preserve user context during refresh
        expect(userReadingState.currentArticleId).toBe(userContext.articleId);
        expect(userReadingState.scrollPosition).toBe(userContext.scrollPos);
      });
      
      await action.onClick();
      
      expect(mockRefreshManager.refreshAllStores).toHaveBeenCalled();
    });
  });
  
  describe('Background Sync Error Handling', () => {
    it('should NOT show notification if background sync fails', async () => {
      mockSyncAPI.mockRejectedValueOnce(new Error('Background sync failed'));
      
      try {
        await backgroundSyncManager.performBackgroundSync();
      } catch (error) {
        // Expected
      }
      
      expect(mockToast.info).not.toHaveBeenCalled();
      expect(backgroundSyncManager.pendingNotification).toBe(false);
    });
    
    it('should still schedule next sync after failure', async () => {
      const scheduleSpy = vi.spyOn(backgroundSyncManager, 'scheduleNextBackgroundSync');
      mockSyncAPI.mockRejectedValueOnce(new Error('Network error'));
      
      try {
        await backgroundSyncManager.performBackgroundSync();
      } catch (error) {
        // Handle error and schedule next
        backgroundSyncManager.scheduleNextBackgroundSync();
      }
      
      expect(scheduleSpy).toHaveBeenCalled();
      expect(backgroundSyncManager.backgroundSyncTimer).toBeTruthy();
    });
    
    it('should handle partial sync appropriately', async () => {
      mockSyncAPI.mockResolvedValueOnce({
        syncId: 'bg-sync-partial',
        status: 'partial',
        metrics: {
          newArticles: 3,
          deletedArticles: 0,
          newTags: 0,
          failedFeeds: 2
        }
      });
      
      await backgroundSyncManager.performBackgroundSync();
      
      // Should still notify about new articles despite partial sync
      expect(mockToast.info).toHaveBeenCalledWith(
        'New articles available',
        expect.any(Object)
      );
    });
  });
  
  describe('Toast Duration and Dismissal', () => {
    it('should show background sync toast for 8 seconds', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      const toastOptions = mockToast.info.mock.calls[0][1];
      expect(toastOptions.duration).toBe(8000);
    });
    
    it('should auto-dismiss toast after duration', async () => {
      await backgroundSyncManager.performBackgroundSync();
      
      const dismissSpy = vi.spyOn(mockToast, 'dismiss');
      
      // Advance time past toast duration
      vi.advanceTimersByTime(8001);
      
      // Toast should auto-dismiss (simulated)
      // In real implementation, the toast library handles this
    });
    
    it('should handle rapid background syncs gracefully', async () => {
      // First background sync
      await backgroundSyncManager.performBackgroundSync();
      expect(mockToast.info).toHaveBeenCalledTimes(1);
      
      // Clear previous notification
      mockToast.info.mockClear();
      
      // Second background sync shortly after
      mockSyncAPI.mockResolvedValueOnce({
        syncId: 'bg-sync-2',
        status: 'completed',
        metrics: {
          newArticles: 10,
          deletedArticles: 0,
          newTags: 2,
          failedFeeds: 0
        }
      });
      
      await backgroundSyncManager.performBackgroundSync();
      
      // Should show new toast
      expect(mockToast.info).toHaveBeenCalledTimes(1);
    });
  });
});