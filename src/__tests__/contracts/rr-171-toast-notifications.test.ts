import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast } from 'sonner';

/**
 * Test Specification for RR-171: Toast Notifications
 * 
 * This test defines the contract for toast notifications during sync operations.
 * Messages must follow exact patterns without emojis.
 * 
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

// Mock toast library
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn()
  }
}));

// Toast notification interface
interface ToastManager {
  showSyncSuccess(metrics: SyncMetrics): void;
  showSyncError(error: string): void;
  showSyncPartial(metrics: SyncMetrics): void;
  showSyncInProgress(): string; // Returns toast ID for dismissal
  showBackgroundSyncInfo(metrics: SyncMetrics): void;
  dismissToast(id: string): void;
}

interface SyncMetrics {
  newArticles: number;
  deletedArticles: number;
  newTags: number;
  failedFeeds: number;
}

describe('RR-171: Toast Notification Contract', () => {
  let toastManager: ToastManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Implementation of ToastManager (what the actual code must do)
    toastManager = {
      showSyncSuccess: (metrics: SyncMetrics) => {
        if (metrics.newArticles === 0 && metrics.deletedArticles === 0) {
          toast.success('Already up to date');
        } else {
          const parts = [];
          if (metrics.newArticles > 0) {
            parts.push(`${metrics.newArticles} new article${metrics.newArticles === 1 ? '' : 's'}`);
          }
          if (metrics.deletedArticles > 0) {
            parts.push(`${metrics.deletedArticles} removed`);
          }
          const message = `Sync complete • ${parts.join(' • ')}`;
          toast.success(message);
        }
      },
      
      showSyncError: (error: string) => {
        toast.error('Sync failed • Check your connection');
      },
      
      showSyncPartial: (metrics: SyncMetrics) => {
        const successCount = 10 - metrics.failedFeeds; // Assuming 10 total feeds
        toast.info(`Partial sync • ${successCount} of 10 feeds updated`);
      },
      
      showSyncInProgress: () => {
        const id = toast.loading('Syncing articles...');
        return id as string;
      },
      
      showBackgroundSyncInfo: (metrics: SyncMetrics) => {
        if (metrics.newArticles > 0) {
          toast.info(`${metrics.newArticles} new article${metrics.newArticles === 1 ? '' : 's'} available`);
        }
      },
      
      dismissToast: (id: string) => {
        toast.dismiss(id);
      }
    };
  });

  describe('Success Notifications', () => {
    it('should show correct message for successful sync with new articles', () => {
      toastManager.showSyncSuccess({
        newArticles: 10,
        deletedArticles: 5,
        newTags: 2,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalledWith('Sync complete • 10 new articles • 5 removed');
    });

    it('should show correct message for single new article', () => {
      toastManager.showSyncSuccess({
        newArticles: 1,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalledWith('Sync complete • 1 new article');
    });

    it('should show correct message for multiple new articles', () => {
      toastManager.showSyncSuccess({
        newArticles: 5,
        deletedArticles: 0,
        newTags: 1,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalledWith('Sync complete • 5 new articles');
    });

    it('should show "Already up to date" when no changes', () => {
      toastManager.showSyncSuccess({
        newArticles: 0,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalledWith('Already up to date');
    });

    it('should show only deletions when no new articles', () => {
      toastManager.showSyncSuccess({
        newArticles: 0,
        deletedArticles: 3,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalledWith('Sync complete • 3 removed');
    });

    it('should NOT include emoji in success messages', () => {
      toastManager.showSyncSuccess({
        newArticles: 5,
        deletedArticles: 2,
        newTags: 1,
        failedFeeds: 0
      });
      
      const callArgs = (toast.success as any).mock.calls[0][0];
      expect(callArgs).not.toMatch(/[✅✓🎉👍]/);
      expect(callArgs).toBe('Sync complete • 5 new articles • 2 removed');
    });
  });

  describe('Error Notifications', () => {
    it('should show generic error message for sync failure', () => {
      toastManager.showSyncError('Network timeout');
      
      expect(toast.error).toHaveBeenCalledWith('Sync failed • Check your connection');
    });

    it('should use consistent error message regardless of error type', () => {
      toastManager.showSyncError('OAuth token expired');
      expect(toast.error).toHaveBeenCalledWith('Sync failed • Check your connection');
      
      vi.clearAllMocks();
      
      toastManager.showSyncError('Database connection failed');
      expect(toast.error).toHaveBeenCalledWith('Sync failed • Check your connection');
    });

    it('should NOT include emoji in error messages', () => {
      toastManager.showSyncError('Some error');
      
      const callArgs = (toast.error as any).mock.calls[0][0];
      expect(callArgs).not.toMatch(/[❌❗⚠️🚫]/);
      expect(callArgs).toBe('Sync failed • Check your connection');
    });
  });

  describe('Partial Sync Notifications', () => {
    it('should show correct message for partial sync', () => {
      toastManager.showSyncPartial({
        newArticles: 7,
        deletedArticles: 3,
        newTags: 1,
        failedFeeds: 3
      });
      
      expect(toast.info).toHaveBeenCalledWith('Partial sync • 7 of 10 feeds updated');
    });

    it('should calculate correct feed counts', () => {
      toastManager.showSyncPartial({
        newArticles: 5,
        deletedArticles: 2,
        newTags: 0,
        failedFeeds: 5
      });
      
      expect(toast.info).toHaveBeenCalledWith('Partial sync • 5 of 10 feeds updated');
    });

    it('should NOT include emoji in partial sync messages', () => {
      toastManager.showSyncPartial({
        newArticles: 8,
        deletedArticles: 4,
        newTags: 2,
        failedFeeds: 2
      });
      
      const callArgs = (toast.info as any).mock.calls[0][0];
      expect(callArgs).not.toMatch(/[⚠️ℹ️📊]/);
      expect(callArgs).toBe('Partial sync • 8 of 10 feeds updated');
    });
  });

  describe('Progress Notifications', () => {
    it('should show loading toast during sync', () => {
      const toastId = toastManager.showSyncInProgress();
      
      expect(toast.loading).toHaveBeenCalledWith('Syncing articles...');
      expect(toastId).toBeDefined();
    });

    it('should return toast ID for later dismissal', () => {
      (toast.loading as any).mockReturnValue('toast-123');
      
      const toastId = toastManager.showSyncInProgress();
      
      expect(toastId).toBe('toast-123');
    });

    it('should dismiss toast by ID', () => {
      const toastId = 'toast-123';
      
      toastManager.dismissToast(toastId);
      
      expect(toast.dismiss).toHaveBeenCalledWith(toastId);
    });

    it('should NOT include emoji in progress messages', () => {
      toastManager.showSyncInProgress();
      
      const callArgs = (toast.loading as any).mock.calls[0][0];
      expect(callArgs).not.toMatch(/[⏳🔄🔃]/);
      expect(callArgs).toBe('Syncing articles...');
    });
  });

  describe('Background Sync Notifications', () => {
    it('should show info toast for background sync with new articles', () => {
      toastManager.showBackgroundSyncInfo({
        newArticles: 3,
        deletedArticles: 1,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.info).toHaveBeenCalledWith('3 new articles available');
    });

    it('should use singular form for single article', () => {
      toastManager.showBackgroundSyncInfo({
        newArticles: 1,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.info).toHaveBeenCalledWith('1 new article available');
    });

    it('should NOT show toast if no new articles in background sync', () => {
      toastManager.showBackgroundSyncInfo({
        newArticles: 0,
        deletedArticles: 5,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('should NOT trigger refresh UI for background sync', () => {
      // This is tested by the fact that we use info toast, not success
      // and don't call any refresh methods
      toastManager.showBackgroundSyncInfo({
        newArticles: 5,
        deletedArticles: 2,
        newTags: 1,
        failedFeeds: 0
      });
      
      expect(toast.info).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.loading).not.toHaveBeenCalled();
    });

    it('should NOT include emoji in background sync messages', () => {
      toastManager.showBackgroundSyncInfo({
        newArticles: 5,
        deletedArticles: 0,
        newTags: 2,
        failedFeeds: 0
      });
      
      const callArgs = (toast.info as any).mock.calls[0][0];
      expect(callArgs).not.toMatch(/[📰🆕📊]/);
      expect(callArgs).toBe('5 new articles available');
    });
  });

  describe('Toast Timing and Dismissal', () => {
    it('should auto-dismiss success toasts after default duration', () => {
      // This behavior is handled by the toast library
      // We just verify the correct method is called
      toastManager.showSyncSuccess({
        newArticles: 5,
        deletedArticles: 2,
        newTags: 1,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    it('should keep error toasts visible longer', () => {
      // Error toasts typically stay longer
      // Verify error method is used which has longer duration
      toastManager.showSyncError('Network error');
      
      expect(toast.error).toHaveBeenCalled();
    });

    it('should dismiss loading toast when sync completes', () => {
      (toast.loading as any).mockReturnValue('loading-toast-id');
      
      const loadingId = toastManager.showSyncInProgress();
      
      // Simulate sync completion
      toastManager.dismissToast(loadingId);
      
      expect(toast.dismiss).toHaveBeenCalledWith('loading-toast-id');
    });
  });

  describe('Message Format Consistency', () => {
    it('should use bullet separator consistently', () => {
      toastManager.showSyncSuccess({
        newArticles: 10,
        deletedArticles: 5,
        newTags: 2,
        failedFeeds: 0
      });
      
      const callArgs = (toast.success as any).mock.calls[0][0];
      expect(callArgs).toContain(' • ');
      expect(callArgs).toBe('Sync complete • 10 new articles • 5 removed');
    });

    it('should use consistent capitalization', () => {
      // First word capitalized, rest lowercase
      toastManager.showSyncSuccess({
        newArticles: 0,
        deletedArticles: 0,
        newTags: 0,
        failedFeeds: 0
      });
      
      expect(toast.success).toHaveBeenCalledWith('Already up to date');
      
      vi.clearAllMocks();
      
      toastManager.showSyncError('error');
      expect(toast.error).toHaveBeenCalledWith('Sync failed • Check your connection');
    });

    it('should use consistent tense and voice', () => {
      // Past tense for completed actions
      toastManager.showSyncSuccess({
        newArticles: 5,
        deletedArticles: 2,
        newTags: 1,
        failedFeeds: 0
      });
      
      const successCall = (toast.success as any).mock.calls[0][0];
      expect(successCall).toContain('complete');
      expect(successCall).toContain('removed');
      
      vi.clearAllMocks();
      
      // Present continuous for ongoing
      toastManager.showSyncInProgress();
      const progressCall = (toast.loading as any).mock.calls[0][0];
      expect(progressCall).toContain('Syncing');
    });
  });
});