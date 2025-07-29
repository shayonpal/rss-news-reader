const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const BiDirectionalSyncService = require('../bidirectional-sync');

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}));

vi.mock('../../lib/token-manager', () => {
  return vi.fn(() => ({
    makeAuthenticatedRequest: vi.fn()
  }));
});

describe('BiDirectionalSyncService - Memory Optimization Tests', () => {
  let service;
  let mockSupabase;
  let mockTokenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set environment variables matching the optimized values
    process.env.SYNC_INTERVAL_MINUTES = '15'; // Increased from 5
    process.env.SYNC_MIN_CHANGES = '10'; // Increased from 5
    process.env.SYNC_BATCH_SIZE = '50'; // Reduced from 100
    process.env.SYNC_MAX_RETRIES = '3';
    process.env.NODE_OPTIONS = '--max-old-space-size=256'; // Memory limit
    
    service = new BiDirectionalSyncService();
    mockSupabase = service.supabase;
    mockTokenManager = service.tokenManager;
  });

  afterEach(() => {
    if (service.syncTimer) {
      clearInterval(service.syncTimer);
    }
  });

  describe('Memory-conscious configuration', () => {
    it('should respect optimized sync interval', () => {
      expect(service.SYNC_INTERVAL_MS).toBe(15 * 60 * 1000); // 15 minutes
    });

    it('should respect optimized minimum changes threshold', () => {
      expect(service.MIN_CHANGES).toBe(10);
    });

    it('should respect optimized batch size', () => {
      expect(service.BATCH_SIZE).toBe(50);
    });
  });

  describe('Batch processing with memory limits', () => {
    it('should process large queues in smaller batches', async () => {
      // Create 200 items to test batch processing
      const largeQueue = Array(200).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: 'read',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));

      mockSupabase.from = vi.fn((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: largeQueue,
                  error: null
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
          };
        }
      });

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      // Should have made 4 API calls (200 items / 50 batch size)
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledTimes(4);
      
      // Each call should have at most 50 items
      mockTokenManager.makeAuthenticatedRequest.mock.calls.forEach(call => {
        const params = call[1].body;
        const itemCount = params.getAll('i').length;
        expect(itemCount).toBeLessThanOrEqual(50);
      });
    });

    it('should wait for minimum changes before processing', async () => {
      // Create only 5 items (below the optimized threshold of 10)
      const smallQueue = Array(5).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: 'read',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));

      mockSupabase.from = vi.fn((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: smallQueue,
                  error: null
                })
              })
            })
          };
        }
      });

      const consoleLogSpy = vi.spyOn(console, 'log');
      
      await service.processSyncQueue();

      // Should not process due to minimum threshold
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Only 5 changes pending, waiting for minimum of 10')
      );
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('Memory pressure handling', () => {
    it('should handle memory allocation failures gracefully', async () => {
      // Simulate a scenario where memory allocation might fail
      const hugeQueue = Array(10000).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: 'read',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));

      let processingStarted = false;
      
      mockSupabase.from = vi.fn((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockImplementation(() => {
                  processingStarted = true;
                  // Return only a subset to simulate memory constraints
                  return Promise.resolve({
                    data: hugeQueue.slice(0, 1000),
                    error: null
                  });
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
          };
        }
      });

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      expect(processingStarted).toBe(true);
      // Should process in batches of 50
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledTimes(20); // 1000 / 50
    });

    it('should clean up resources after processing', async () => {
      const queue = Array(100).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: 'read',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));

      mockSupabase.from = vi.fn((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: queue,
                  error: null
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
          };
        }
      });

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      // Check memory before
      const memBefore = process.memoryUsage();

      await service.processSyncQueue();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Check memory after
      const memAfter = process.memoryUsage();

      // Processing flag should be reset
      expect(service.isProcessing).toBe(false);
      
      // Last processed time should be updated
      expect(service.lastProcessedTime).toBeTruthy();
      
      // Memory should not increase significantly after cleanup
      const heapDelta = memAfter.heapUsed - memBefore.heapUsed;
      // Allow for some variance but should be less than 10MB for 100 items
      expect(Math.abs(heapDelta)).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Concurrent processing prevention', () => {
    it('should prevent concurrent sync operations', async () => {
      // Start first sync
      service.isProcessing = true;
      
      const consoleLogSpy = vi.spyOn(console, 'log');
      
      // Try to start another sync
      await service.processSyncQueue();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Already processing, skipping this cycle'
      );
      
      // No database operations should occur
      expect(mockSupabase.from).not.toHaveBeenCalled();
      
      consoleLogSpy.mockRestore();
    });

    it('should handle periodic sync with longer intervals', async () => {
      vi.useFakeTimers();
      
      const processSyncQueueSpy = vi.spyOn(service, 'processSyncQueue').mockResolvedValue(undefined);
      
      await service.startPeriodicSync();
      
      // Initial sync
      expect(processSyncQueueSpy).toHaveBeenCalledTimes(1);
      
      // Fast forward 14 minutes - should not trigger
      vi.advanceTimersByTime(14 * 60 * 1000);
      expect(processSyncQueueSpy).toHaveBeenCalledTimes(1);
      
      // Fast forward 1 more minute (total 15) - should trigger
      vi.advanceTimersByTime(1 * 60 * 1000);
      expect(processSyncQueueSpy).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });
});
EOF < /dev/null